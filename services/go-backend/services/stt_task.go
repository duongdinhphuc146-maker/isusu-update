package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

func CreateSTTTaskAndPoll(vid, md5 string, durationMs int, lang string, transLang string) (string, string, error) {
	device := GetDynamicDevice()
	client := &http.Client{Timeout: 30 * time.Second}

	useTrans := transLang != ""
	if lang == "" {
		lang = "vi-VN"
	}

	capJson := map[string]interface{}{
		"adjust_endtime":       200,
		"audio":                vid,
		"audio_type":           "vid",
		"caption_type":         0,
		"client_request_id":    uuid.New().String(),
		"duration":             durationMs,
		"enable_cache":         true,
		"enter_from":           "asr",
		"language":             lang,
		"max_lines":            1,
		"md5":                  md5,
		"pack_options":         map[string]interface{}{"need_attribute": true},
		"songs_info":           []interface{}{map[string]interface{}{"end_time": float64(durationMs), "id": "", "start_time": 0}},
		"translation_language": transLang,
		"use_translation":      useTrans,
		"words_per_line":       15,
	}

	payloadBytes, _ := json.Marshal(map[string]interface{}{"cap_json": capJson})
	body := map[string]interface{}{
		"bind_id":   strings.ToUpper(uuid.New().String()),
		"can_queue": true,
		"enter_from": "asr",
		"tasks": []interface{}{
			map[string]interface{}{
				"context":      uuid.New().String(),
				"payload":      string(payloadBytes),
				"req_key":      "cc_audio_subtitle_asr",
				"task_version": "v3",
			},
		},
	}

	bodyBytes, _ := json.Marshal(body)
	nowStr := fmt.Sprintf("%d", time.Now().Unix())

	query := url.Values{
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
		"region":          {device.Region},
	}
	babiBytes, _ := json.Marshal(map[string]interface{}{
		"feature_entrance":        "editor",
		"feature_entrance_detail": "editor-elements-captions-subtitle_recognition",
		"feature_key":             "subtitle_recognition",
		"scenario":                "video_editor",
	})
	query.Set("babi_param", string(babiBytes))

	reqUrl := fmt.Sprintf("https://editor-api-sg.capcutapi.com/lv/v1/common_task/new?%s", query.Encode())
	httpReq, _ := http.NewRequest("POST", reqUrl, bytes.NewReader(bodyBytes))
	headers := base_headers_raw(device, string(bodyBytes))
	for k, v := range headers {
		httpReq.Header.Set(k, v)
	}
	httpReq.Header.Set("sign", MakeSignHeader(reqUrl, device.Appvr, nowStr, device.Tdid))

	resp, err := client.Do(httpReq)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var respObj map[string]interface{}
	json.Unmarshal(respBytes, &respObj)

	dataObj, _ := respObj["data"].(map[string]interface{})
	taskList, _ := dataObj["tasks"].([]interface{})
	if len(taskList) == 0 {
		return "", "", fmt.Errorf("empty tasks list in ASR: %s", string(respBytes))
	}

	taskObj, _ := taskList[0].(map[string]interface{})
	taskID, _ := taskObj["id"].(string)
	token, _ := taskObj["token"].(string)

	return PollSTTTask(client, device, taskID, token)
}


