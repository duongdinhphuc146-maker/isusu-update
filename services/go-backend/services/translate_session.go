package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
)

func getBridgeURL() string {
	port := os.Getenv("AI_BRIDGE_PORT")
	if port == "" {
		port = "5001"
	}
	return "http://127.0.0.1:" + port
}

// HandleCaptureStart starts session capture on the bridge.
func HandleCaptureStart(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Provider string `json:"provider"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	bridgeURL := fmt.Sprintf("%s/capture/start", getBridgeURL())
	bodyBytes, _ := json.Marshal(req)
	
	resp, err := http.Post(bridgeURL, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		httpx.WriteError(w, "Failed to connect to bridge: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// HandleCaptureStop stops session capture on the bridge.
func HandleCaptureStop(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bridgeURL := fmt.Sprintf("%s/capture/stop", getBridgeURL())
	resp, err := http.Post(bridgeURL, "application/json", nil)
	if err != nil {
		httpx.WriteError(w, "Failed to connect to bridge: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// HandleListSessions gets active sessions from the bridge.
func HandleListSessions(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bridgeURL := fmt.Sprintf("%s/sessions", getBridgeURL())
	resp, err := http.Get(bridgeURL)
	if err != nil {
		// If bridge is down, return empty list instead of crashing/erroring out
		httpx.WriteJSON(w, []interface{}{})
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// HandleDeleteSession deletes a session on the bridge.
func HandleDeleteSession(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Provider string `json:"provider"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	bridgeURL := fmt.Sprintf("%s/sessions/%s", getBridgeURL(), req.Provider)
	bridgeReq, err := http.NewRequest("DELETE", bridgeURL, nil)
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(bridgeReq)
	if err != nil {
		httpx.WriteError(w, "Failed to connect to bridge: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// ReplayViaBridge sends the prompt to the bridge for replay execution.
func ReplayViaBridge(ctx context.Context, jsonPrompt string, provider string) (string, error) {
	bridgeURL := fmt.Sprintf("%s/replay", getBridgeURL())
	
	reqBody, err := json.Marshal(map[string]string{
		"provider": provider,
		"prompt":   jsonPrompt,
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", bridgeURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("bridge replay failed with status %d: %s", resp.StatusCode, string(respBytes))
	}

	var respJSON struct {
		Response string `json:"response"`
	}
	if err := json.Unmarshal(respBytes, &respJSON); err != nil {
		// fallback: maybe the bridge returned raw translation json or a different format
		logx.Error("Failed to unmarshal bridge replay wrapper, trying raw", err)
		return string(respBytes), nil
	}

	return respJSON.Response, nil
}

// TranslateSessionV2 handles translation via a browser session for Dialogue Mode.
func TranslateSessionV2(ctx context.Context, provider string, targetLang string, cmap *CharacterMap, chunk OverlapChunk) ([]MultiTaskResult, error) {
	bridgeProvider := strings.TrimSuffix(provider, "-session")
	cmapData, _ := json.Marshal(cmap)
	var prefixLines []string
	for _, seg := range chunk.OverlapPrefix {
		prefixLines = append(prefixLines, fmt.Sprintf("ID: %d | Text: %s", seg.Index, seg.Text))
	}
	type SegInput struct {
		ID   int    `json:"id"`
		Text string `json:"text"`
	}
	var coreInputs []SegInput
	for _, seg := range chunk.CoreSegments {
		coreInputs = append(coreInputs, SegInput{ID: seg.Index, Text: seg.Text})
	}
	coreData, _ := json.Marshal(coreInputs)

	systemInstructions := fmt.Sprintf(`You are an expert subtitle translator and dialogue director.
Your tasks are:
1. Translate the 'text' of the core segments to %s naturally, preserving style, slang, and context.
2. Identify the 'speaker' ID (from the provided Character Map catalog) for each core segment. If a speaker is unknown or not in the catalog, default to SPK_DEFAULT or dynamically assign a new ID like SPK_01.
3. Classify the 'emotion' (e.g. neutral, happy, angry, sad, excited, whisper) of the speaker in each core segment.

The 'Overlap Prefix' is provided ONLY for conversation history context. DO NOT translate, process, or output the overlap segments. ONLY output translations for the Core segments.

Character Map Catalog:
%s

Overlap Prefix Context (Read-Only):
%s

Output MUST conform to valid JSON schema:
{"results": [{"id": 1, "speaker": "SPK_01", "emotion": "neutral", "text": "translated text"}]}`, targetLang, string(cmapData), strings.Join(prefixLines, "\n"))

	fullPrompt := fmt.Sprintf("%s\n\nCore input segments JSON:\n%s", systemInstructions, string(coreData))
	respText, err := ReplayViaBridge(ctx, fullPrompt, bridgeProvider)
	if err != nil {
		return nil, err
	}

	cleaned := CleanAndExtractJSON(respText)
	var mtaskResp struct {
		Results []MultiTaskResult `json:"results"`
	}
	if jsonErr := json.Unmarshal([]byte(cleaned), &mtaskResp); jsonErr != nil {
		return nil, fmt.Errorf("failed to parse session translation JSON: %w, raw: %s", jsonErr, cleaned)
	}

	return mtaskResp.Results, nil
}
