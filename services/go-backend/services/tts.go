package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type TTSRequest struct {
	Text       string `json:"text"`
	Voice      string `json:"voice"`
	ResourceID string `json:"resource_id"`
	Rate       string `json:"rate"`
}

type TTSResponse struct {
	Success  bool   `json:"success"`
	AudioURL string `json:"audio_url,omitempty"`
	Error    string `json:"error,omitempty"`
}

var InFlightTts sync.Map // maps hash string -> context.CancelFunc



func GenerateTtsInternal(ctx context.Context, text, voice, resourceID, rateStr string, device DeviceInfo) (string, error) {
	logx.Info("Starting TTS generation", "text", text, "voice", voice, "rate", rateStr)

	jitter, _ := rand.Int(rand.Reader, big.NewInt(600))
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-time.After(time.Duration(200+jitter.Int64()) * time.Millisecond):
	}

	ssml := fmt.Sprintf(`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <voice name="%s" mock_tone_info="" platform="sami" resource_id="%s" emotion="" emotion_scale="0" style="" role="" moyin_emotion="" is_clone_tone="false" need_subtitle_timestamp="false">
        <prosody rate="%s">%s</prosody>
    </voice>
</speak>`, voice, resourceID, rateStr, EscapeXML(text))

	extraInfo := `{"benefit_info":{}}`
	payloadSign, err := MakeTtsPayloadSign(ssml, extraInfo, device.DeviceID, device.Aid)
	if err != nil {
		logx.Error("Sign generation failed", err)
		return "", err
	}

	payload := map[string]interface{}{
		"audio_format":            "mp3",
		"babi_param":              `{"feature_entrance":"editor","feature_entrance_detail":"editor-feature-text_to_speech","feature_key":"text_to_speech","scenario":"video_editor"}`,
		"credit_disable":          false,
		"extra_info":              extraInfo,
		"need_merge_voice":        false,
		"need_subtitle_timestamp": false,
		"scene":                   "text_to_speech",
		"ssml":                    ssml,
		"sign":                    payloadSign,
	}

	payloadBytes, _ := json.Marshal(payload)
	body := map[string]interface{}{
		"bind_id":   uuid.New().String(),
		"can_queue": true,
		"enter_from": "text_to_speech",
		"tasks": []interface{}{
			map[string]interface{}{
				"context":      uuid.New().String(),
				"payload":      string(payloadBytes),
				"req_key":      "sami_text_to_speech",
				"task_version": "v3",
			},
		},
	}

	bodyBytes, _ := json.Marshal(body)
	nowStr := fmt.Sprintf("%d", time.Now().Unix())
	traceID := fmt.Sprintf("00-%s-%s-01", strings.ReplaceAll(uuid.New().String(), "-", ""), strings.ReplaceAll(uuid.New().String(), "-", "")[:16])

	query := url.Values{}
	query.Set("app_name", device.AppName)
	query.Set("device_type", device.DeviceType)
	query.Set("os_version", device.OsVersion)
	query.Set("channel", device.Channel)
	query.Set("version_name", device.VersionName)
	query.Set("device_brand", device.DeviceBrand)
	query.Set("device_id", device.DeviceID)
	query.Set("iid", device.Iid)
	query.Set("version_code", device.VersionCode)
	query.Set("device_platform", device.DevicePlatform)
	query.Set("aid", device.Aid)
	query.Set("region", device.Region)
	query.Set("babi_param", `{"feature_entrance":"editor","feature_entrance_detail":"editor-feature-text_to_speech","feature_key":"text_to_speech","scenario":"video_editor"}`)

	reqUrl := fmt.Sprintf("%s/lv/v1/common_task/new?%s", BASE, query.Encode())
	signHeader := MakeSignHeader(reqUrl, device.Appvr, nowStr, device.Tdid)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", reqUrl, bytes.NewBuffer(bodyBytes))
	httpReq.Header.Set("content-type", "application/json")
	httpReq.Header.Set("appvr", device.Appvr)
	httpReq.Header.Set("ch", device.Channel)
	httpReq.Header.Set("device-time", nowStr)
	httpReq.Header.Set("lan", device.Lan)
	httpReq.Header.Set("loc", device.Loc)
	httpReq.Header.Set("pf", device.Pf)
	httpReq.Header.Set("sign-ver", "1")
	httpReq.Header.Set("tdid", device.Tdid)
	httpReq.Header.Set("x-ss-stub", Md5Hex(string(bodyBytes)))
	httpReq.Header.Set("x-ss-dp", device.Aid)
	httpReq.Header.Set("x-khronos", nowStr)
	httpReq.Header.Set("x-tt-trace-id", traceID)
	httpReq.Header.Set("user-agent", device.UserAgent)
	httpReq.Header.Set("sign", signHeader)
	httpReq.Header.Set("app-sdk-version", device.Appvr)
	httpReq.Header.Set("appid", device.Aid)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		logx.Error("TTS request creation failed", err)
		return "", err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var respObj map[string]interface{}
	if err := json.Unmarshal(respBytes, &respObj); err != nil {
		return "", fmt.Errorf("invalid json response from server")
	}

	dataObj, _ := respObj["data"].(map[string]interface{})
	taskList, _ := dataObj["tasks"].([]interface{})
	if len(taskList) == 0 {
		return "", fmt.Errorf("empty task list: %s", string(respBytes))
	}

	taskObj, _ := taskList[0].(map[string]interface{})
	taskID, _ := taskObj["id"].(string)
	token, _ := taskObj["token"].(string)

	if taskID == "" || token == "" {
		return "", fmt.Errorf("failed to get task ID: %s", string(respBytes))
	}

	return PollTtsTask(ctx, client, device, taskID, token, nowStr, traceID)
}

func HandleTTS(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method == "DELETE" {
		HandleCancelTTS(w, r)
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req TTSRequest
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, err.Error(), http.StatusBadRequest)
		return
	}

	hash := Md5Hex(req.Text + "_" + req.Voice + "_" + req.ResourceID + "_" + req.Rate)
	wd, _ := os.Getwd()
	cachePath := filepath.Join(wd, "cache", hash+".mp3")
	localURL := "http://127.0.0.1:5000/cache/" + hash + ".mp3"

	if _, err := os.Stat(cachePath); err == nil {
		logx.Info("TTS returned from cache", "hash", hash)
		httpx.WriteJSON(w, TTSResponse{Success: true, AudioURL: localURL})
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	InFlightTts.Store(hash, cancel)
	defer InFlightTts.Delete(hash)

	var audioURL string
	var err error
	for attempt := 1; attempt <= 3; attempt++ {
		device := GetNextDevice()
		audioURL, err = GenerateTtsInternal(ctx, req.Text, req.Voice, req.ResourceID, req.Rate, device)
		if err == nil {
			break
		}
		if strings.Contains(err.Error(), "429") {
			MarkDeviceCooldown(device.DeviceID, 15*time.Minute)
		}
		if ctx.Err() != nil {
			break
		}
		
		isRetryable := false
		errStr := err.Error()
		if strings.Contains(errStr, "429") || strings.Contains(errStr, "5xx") || strings.Contains(errStr, "500") || strings.Contains(errStr, "timeout") {
			isRetryable = true
		}
		
		if isRetryable && attempt < 3 {
			logx.Info("TTS attempt failed, retrying in 3s...", "attempt", attempt, "err", err.Error())
			select {
			case <-ctx.Done():
				err = ctx.Err()
				break
			case <-time.After(3 * time.Second):
			}
		} else {
			break
		}
	}

	if err != nil {
		logx.Error("TTS generation failed after retries", err)
		httpx.WriteJSON(w, TTSResponse{Success: false, Error: err.Error()})
		return
	}

	cachedURL, err := DownloadAndCacheAudio(audioURL, hash)
	if err != nil {
		logx.Error("Failed to cache audio, returning remote URL", err)
		httpx.WriteJSON(w, TTSResponse{Success: true, AudioURL: audioURL})
	} else {
		httpx.WriteJSON(w, TTSResponse{Success: true, AudioURL: cachedURL})
	}
}

func HandleCancelTTS(w http.ResponseWriter, r *http.Request) {
	hash := r.URL.Query().Get("hash")
	if hash == "" {
		httpx.WriteError(w, "Missing hash parameter", http.StatusBadRequest)
		return
	}

	cancelFuncVal, exists := InFlightTts.Load(hash)
	if exists {
		cancelFunc, ok := cancelFuncVal.(context.CancelFunc)
		if ok {
			cancelFunc()
			InFlightTts.Delete(hash)
			httpx.WriteJSON(w, map[string]interface{}{"success": true, "message": "TTS generation cancelled"})
			return
		}
	}

	httpx.WriteJSON(w, map[string]interface{}{"success": true, "message": "No active TTS generation found for this hash"})
}


