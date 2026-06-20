package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"time"
)

func PollSTTTask(client *http.Client, device DeviceInfo, taskID, token string) (string, string, error) {
	pollStart := time.Now()
	sleepTime := 1 * time.Second

	for {
		if time.Since(pollStart) > 120*time.Second {
			return "", "", fmt.Errorf("transcription timed out after 120 seconds")
		}

		time.Sleep(sleepTime)

		// Exponential backoff: increase sleep by 50% up to a max of 5s
		sleepTime = sleepTime * 3 / 2
		if sleepTime > 5*time.Second {
			sleepTime = 5 * time.Second
		}

		pollNowStr := fmt.Sprintf("%d", time.Now().Unix())

		queryBody := map[string]interface{}{
			"tasks": []interface{}{
				map[string]interface{}{
					"bind_id":      "",
					"id":           taskID,
					"req_key":      "cc_audio_subtitle_asr",
					"task_version": "v3",
					"token":        token,
				},
			},
		}
		queryBodyBytes, _ := json.Marshal(queryBody)

		queryVal := url.Values{
			"app_name":        {device.AppName},
			"device_type":     {device.DeviceType},
			"os_version":      {device.OsVersion},
			"channel":         {device.Channel},
			"version_name":    {device.VersionName},
			"device_brand":    {device.DeviceBrand},
			"device_id":       {device.DeviceID},
			"iid":             {device.Iid},
			"version_code":    {device.VersionCode},
			"device_platform": {device.DevicePlatform},
			"aid":             {device.Aid},
		}
		queryUrl := fmt.Sprintf("https://editor-api-sg.capcutapi.com/lv/v1/common_task/query?%s", queryVal.Encode())

		queryReq, _ := http.NewRequest("POST", queryUrl, bytes.NewReader(queryBodyBytes))
		queryHeaders := base_headers_raw(device, string(queryBodyBytes))
		for k, v := range queryHeaders {
			queryReq.Header.Set(k, v)
		}
		queryReq.Header.Set("sign", MakeSignHeader(queryUrl, device.Appvr, pollNowStr, device.Tdid))

		queryResp, err := client.Do(queryReq)
		if err != nil {
			continue
		}

		if queryResp.StatusCode == 429 {
			queryResp.Body.Close()
			log.Printf("[STT POLL] Rate limited (429), backing off 5s...")
			time.Sleep(5 * time.Second)
			continue
		}

		qBytes, _ := io.ReadAll(queryResp.Body)
		queryResp.Body.Close()

		var qObj map[string]interface{}
		json.Unmarshal(qBytes, &qObj)
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

			log.Printf("[STT POLL] Task %s status: %v", taskID, qTask["status"])
			if isDone {
				responseStr, _ := qTask["payload"].(string)
				return ExtractSubtitlesText(responseStr), ExtractSubtitlesSRT(responseStr), nil
			} else if isFailed {
				return "", "", fmt.Errorf("transcription task failed on CapCut servers")
			}
		}
	}
}
