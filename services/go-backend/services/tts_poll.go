package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"time"
)

func PollTtsTask(ctx context.Context, client *http.Client, device DeviceInfo, taskID, token, nowStr, traceID string) (string, error) {
	audioURL := ""
	for i := 0; i < 60; i++ {
		// Respect context cancellation
		select {
		case <-ctx.Done():
			log.Printf("[TTS POLL] Task %s cancelled via context", taskID)
			return "", ctx.Err()
		default:
		}

		time.Sleep(1 * time.Second)

		queryBody := map[string]interface{}{
			"tasks": []interface{}{
				map[string]interface{}{
					"bind_id":      "",
					"id":           taskID,
					"req_key":      "sami_text_to_speech",
					"task_version": "v3",
					"token":        token,
				},
			},
		}

		queryBodyBytes, _ := json.Marshal(queryBody)
		queryBodyText := string(queryBodyBytes)

		pollNowStr := fmt.Sprintf("%d", time.Now().Unix())

		queryVal := url.Values{}
		queryVal.Set("app_name", device.AppName)
		queryVal.Set("device_type", device.DeviceType)
		queryVal.Set("os_version", device.OsVersion)
		queryVal.Set("channel", device.Channel)
		queryVal.Set("version_name", device.VersionName)
		queryVal.Set("device_brand", device.DeviceBrand)
		queryVal.Set("device_id", device.DeviceID)
		queryVal.Set("iid", device.Iid)
		queryVal.Set("version_code", device.VersionCode)
		queryVal.Set("device_platform", device.DevicePlatform)
		queryVal.Set("aid", device.Aid)

		queryUrl := fmt.Sprintf("%s/lv/v1/common_task/query?%s", BASE, queryVal.Encode())
		querySignHeader := MakeSignHeader(queryUrl, device.Appvr, pollNowStr, device.Tdid)

		queryHttpReq, _ := http.NewRequestWithContext(ctx, "POST", queryUrl, bytes.NewBuffer(queryBodyBytes))
		queryHttpReq.Header.Set("content-type", "application/json")
		queryHttpReq.Header.Set("appvr", device.Appvr)
		queryHttpReq.Header.Set("ch", device.Channel)
		queryHttpReq.Header.Set("device-time", pollNowStr)
		queryHttpReq.Header.Set("lan", device.Lan)
		queryHttpReq.Header.Set("loc", device.Loc)
		queryHttpReq.Header.Set("pf", device.Pf)
		queryHttpReq.Header.Set("sign-ver", "1")
		queryHttpReq.Header.Set("tdid", device.Tdid)
		queryHttpReq.Header.Set("x-ss-stub", Md5Hex(queryBodyText))
		queryHttpReq.Header.Set("x-ss-dp", device.Aid)
		queryHttpReq.Header.Set("x-khronos", pollNowStr)
		queryHttpReq.Header.Set("x-tt-trace-id", traceID)
		queryHttpReq.Header.Set("user-agent", device.UserAgent)
		queryHttpReq.Header.Set("sign", querySignHeader)
		queryHttpReq.Header.Set("app-sdk-version", device.Appvr)
		queryHttpReq.Header.Set("appid", device.Aid)

		queryResp, err := client.Do(queryHttpReq)
		if err != nil {
			log.Printf("[TTS POLL ERROR] Query request failed: %v", err)
			continue
		}
		queryRespBytes, _ := io.ReadAll(queryResp.Body)
		queryResp.Body.Close()

		if queryResp.StatusCode == 429 {
			log.Printf("[TTS POLL] Rate limited (429), backing off 5s...")
			time.Sleep(5 * time.Second)
			continue
		}

		var qObj map[string]interface{}
		json.Unmarshal(queryRespBytes, &qObj)
		qData, _ := qObj["data"].(map[string]interface{})
		qTasks, _ := qData["tasks"].([]interface{})
		if len(qTasks) > 0 {
			qTask, _ := qTasks[0].(map[string]interface{})

			isDone := false
			isFailed := false
			switch s := qTask["status"].(type) {
			case float64:
				isDone = s == 5
				isFailed = s == 6
			case string:
				isDone = s == "succeed"
				isFailed = s == "failed"
			}

			log.Printf("[TTS POLL] Task %s status: %v", taskID, qTask["status"])

			if isDone {
				payloadStr, _ := qTask["payload"].(string)
				if payloadStr != "" {
					var payloadObj map[string]interface{}
					if err := json.Unmarshal([]byte(payloadStr), &payloadObj); err == nil {
						audioSubs, _ := payloadObj["audio_subtitles"].([]interface{})
						if len(audioSubs) > 0 {
							sub0, _ := audioSubs[0].(map[string]interface{})
							audioURL, _ = sub0["speech_url"].(string)
						}
					}
				}

				if audioURL == "" {
					qRespObj, _ := qTask["response"].(map[string]interface{})
					samiResp, _ := qRespObj["sami_response"].(map[string]interface{})
					audioInfo, _ := samiResp["audio_info"].(map[string]interface{})
					audioURL, _ = audioInfo["audio_url"].(string)
				}

				log.Printf("[TTS SUCCESS] Generated: %s", audioURL)
				break
			} else if isFailed {
				log.Printf("[TTS ERROR] Task status failed on CapCut servers: %s", string(queryRespBytes))
				return "", fmt.Errorf("task failed on CapCut servers")
			}
		} else {
			log.Printf("[TTS POLL WARNING] No task info returned in query: %s", string(queryRespBytes))
		}
	}

	if audioURL == "" {
		log.Printf("[TTS ERROR] Generation timed out after 60 seconds")
		return "", fmt.Errorf("timeout generating voiceover")
	}

	return audioURL, nil
}
