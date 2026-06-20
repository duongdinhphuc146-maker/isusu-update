package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type UploadCredentials struct {
	Domain          string `json:"domain"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	SessionToken    string `json:"session_token"`
	SpaceName       string `json:"space_name"`
}

type CommitResult struct {
	Vid        string `json:"vid"`
	Md5        string `json:"md5"`
	DurationMs int    `json:"duration_ms"`
}

func UploadAudioToCapCut(audioBytes []byte) (*CommitResult, error) {
	device := GetDynamicDevice()
	client := &http.Client{Timeout: 90 * time.Second}

	// 1. Request Upload Sign
	signUrl := "https://editor-api-sg.capcutapi.com/lv/v1/upload_sign?" + url.Values{
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
	}.Encode()

	bodyMap := map[string]interface{}{"biz": "cc_pc_text_recognize", "key_version": "v5"}
	bodyBytes, _ := json.Marshal(bodyMap)

	req, _ := http.NewRequest("POST", signUrl, bytes.NewReader(bodyBytes))
	headers := base_headers_raw(device, string(bodyBytes))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("sign", MakeSignHeader(signUrl, device.Appvr, headers["device-time"], device.Tdid))

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var signData struct {
		Data UploadCredentials `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&signData); err != nil {
		return nil, fmt.Errorf("failed to decode upload sign: %w", err)
	}
	creds := signData.Data
	if creds.Domain == "" {
		return nil, fmt.Errorf("empty upload domain in credentials sign response")
	}

	// 2. Apply Upload Inner
	addr, err := ApplyUploadInner(client, creds, device)
	if err != nil {
		return nil, err
	}

	// 3 & 4. Binary Transfer & Finish
	httpDate := time.Now().UTC().Format("Mon, 02 Jan 2006 15:04:05 GMT")
	err = TransferAndFinishAudio(client, audioBytes, addr, httpDate)
	if err != nil {
		return nil, err
	}

	// 5. Commit upload
	amzDate := time.Now().UTC().Format("20060102T150405Z")
	return CommitUploadInner(client, creds, device, addr.SessionKey, amzDate, httpDate, audioBytes)
}


