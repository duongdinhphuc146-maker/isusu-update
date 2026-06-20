package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

// ─── Test SRT Fixture ───────────────────────────────────────────────────────

const testSRTVietnamese = `1
00:00:01,000 --> 00:00:04,000
Xin chào mọi người, hôm nay tôi sẽ giới thiệu về cách làm video

2
00:00:05,000 --> 00:00:08,500
Đầu tiên chúng ta cần chuẩn bị một kịch bản chi tiết

3
00:00:09,000 --> 00:00:12,000
Sau đó quay phim và chỉnh sửa trên CapCut

4
00:00:13,000 --> 00:00:16,500
Cuối cùng xuất video và đăng lên YouTube

5
00:00:17,000 --> 00:00:20,000
Cảm ơn các bạn đã xem, đừng quên đăng ký kênh nhé
`

// ─── Helper: Check if a service is reachable ─────────────────────────────────

func isServiceUp(url string) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// ─── Test: Parse SRT ────────────────────────────────────────────────────────

func TestParseSRT_Vietnamese(t *testing.T) {
	segments := ParseSRT(testSRTVietnamese)

	if len(segments) != 5 {
		t.Fatalf("expected 5 segments, got %d", len(segments))
	}

	// Verify first segment
	if segments[0].Index != 1 {
		t.Errorf("segment[0] index: expected 1, got %d", segments[0].Index)
	}
	if segments[0].Start != "00:00:01,000" {
		t.Errorf("segment[0] start: expected '00:00:01,000', got '%s'", segments[0].Start)
	}
	if segments[0].End != "00:00:04,000" {
		t.Errorf("segment[0] end: expected '00:00:04,000', got '%s'", segments[0].End)
	}
	if !strings.Contains(segments[0].Text, "Xin chào") {
		t.Errorf("segment[0] text should contain 'Xin chào', got '%s'", segments[0].Text)
	}

	// Verify last segment
	if segments[4].Index != 5 {
		t.Errorf("segment[4] index: expected 5, got %d", segments[4].Index)
	}
	if !strings.Contains(segments[4].Text, "đừng quên đăng ký kênh") {
		t.Errorf("segment[4] text should contain 'đừng quên đăng ký kênh', got '%s'", segments[4].Text)
	}
}

// ─── Test: Chunk + Build + Parse round-trip ─────────────────────────────────

func TestTranslateChunkerRoundTrip(t *testing.T) {
	segments := ParseSRT(testSRTVietnamese)
	if len(segments) == 0 {
		t.Fatal("no segments parsed")
	}

	// Chunk with limit that allows 2 chunks
	chunks := ChunkSegments(segments, 100)
	if len(chunks) < 1 {
		t.Fatal("expected at least 1 chunk")
	}

	// Build JSON for first chunk
	jsonPrompt, err := BuildTranslationJSON(chunks[0], "English")
	if err != nil {
		t.Fatalf("failed to build translation JSON: %v", err)
	}

	// Verify JSON structure
	var payload PromptPayload
	if err := json.Unmarshal([]byte(jsonPrompt), &payload); err != nil {
		t.Fatalf("failed to unmarshal prompt JSON: %v", err)
	}
	if payload.TargetLanguage != "English" {
		t.Errorf("expected target language 'English', got '%s'", payload.TargetLanguage)
	}
	if len(payload.Segments) != len(chunks[0]) {
		t.Errorf("expected %d segments in prompt, got %d", len(chunks[0]), len(payload.Segments))
	}

	// Simulate AI response
	var mockTranslations []JSONSegment
	for _, seg := range chunks[0] {
		mockTranslations = append(mockTranslations, JSONSegment{
			ID:   seg.Index,
			Text: "Mock translated text for segment " + fmt.Sprint(seg.Index),
		})
	}
	mockResponse, _ := json.Marshal(ResponsePayload{Translations: mockTranslations})

	// Parse response
	translated := ParseTranslationJSON(string(mockResponse), chunks[0])
	if len(translated) != len(chunks[0]) {
		t.Fatalf("expected %d translated segments, got %d", len(chunks[0]), len(translated))
	}

	// Verify timestamps preserved
	for i, trans := range translated {
		if trans.Start != chunks[0][i].Start {
			t.Errorf("segment %d start time not preserved: expected '%s', got '%s'",
				trans.Index, chunks[0][i].Start, trans.Start)
		}
		if trans.End != chunks[0][i].End {
			t.Errorf("segment %d end time not preserved: expected '%s', got '%s'",
				trans.Index, chunks[0][i].End, trans.End)
		}
	}

	// Reassemble SRT
	srt := ReassembleSRT(translated)
	if !strings.Contains(srt, "-->") {
		t.Error("reassembled SRT missing timestamp arrows")
	}
	blocks := strings.Split(strings.TrimSpace(srt), "\n\n")
	if len(blocks) != len(chunks[0]) {
		t.Errorf("expected %d SRT blocks, got %d", len(chunks[0]), len(blocks))
	}
}

// ─── Test: Bridge Health Check ──────────────────────────────────────────────

func TestBridgeHealthCheck(t *testing.T) {
	bridgePort := os.Getenv("AI_BRIDGE_PORT")
	if bridgePort == "" {
		bridgePort = "5001"
	}
	bridgeURL := fmt.Sprintf("http://127.0.0.1:%s/health", bridgePort)

	if !isServiceUp(bridgeURL) {
		t.Skip("Bridge service is not running on port " + bridgePort + " - skipping integration tests")
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(bridgeURL)
	if err != nil {
		t.Fatalf("failed to reach bridge: %v", err)
	}
	defer resp.Body.Close()

	var health map[string]string
	json.NewDecoder(resp.Body).Decode(&health)
	if health["status"] != "healthy" {
		t.Errorf("bridge health check failed: %v", health)
	}
}

// ─── Test: Bridge Sessions - Gemini ─────────────────────────────────────────

func TestBridgeGeminiSessionExists(t *testing.T) {
	bridgePort := os.Getenv("AI_BRIDGE_PORT")
	if bridgePort == "" {
		bridgePort = "5001"
	}
	if !isServiceUp(fmt.Sprintf("http://127.0.0.1:%s/health", bridgePort)) {
		t.Skip("Bridge service is not running - skipping")
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%s/sessions", bridgePort))
	if err != nil {
		t.Fatalf("failed to fetch sessions: %v", err)
	}
	defer resp.Body.Close()

	var sessions []map[string]string
	json.NewDecoder(resp.Body).Decode(&sessions)

	foundGemini := false
	for _, s := range sessions {
		if s["provider"] == "gemini" && s["status"] == "valid" {
			foundGemini = true
			break
		}
	}
	if !foundGemini {
		t.Error("Gemini session not found or not valid. Run capture first.")
	}
}

// ─── Test: E2E SRT Translation via Bridge (Gemini Session) ─────────────────

func TestE2E_TranslateSRTViaGeminiSession(t *testing.T) {
	bridgePort := os.Getenv("AI_BRIDGE_PORT")
	if bridgePort == "" {
		bridgePort = "5001"
	}
	if !isServiceUp(fmt.Sprintf("http://127.0.0.1:%s/health", bridgePort)) {
		t.Skip("Bridge service is not running - skipping E2E test")
	}

	// Parse SRT
	segments := ParseSRT(testSRTVietnamese)
	if len(segments) == 0 {
		t.Fatal("no segments parsed from test SRT")
	}

	// Build translation prompt (same as worker)
	jsonPrompt, err := BuildTranslationJSON(segments, "English")
	if err != nil {
		t.Fatalf("failed to build translation JSON: %v", err)
	}

	targetLang := "English"
	systemInstructions := fmt.Sprintf("You are a professional subtitle translator. Translate the 'text' field of each segment in the input JSON list to %s. Keep the original 'id' exactly as is. Output MUST be valid JSON structure matching: {\"translations\": [{\"id\": N, \"text\": \"translated text\"}]}. Output only the JSON. Do not include markdown code block wrappers.", targetLang)
	fullSessionPrompt := fmt.Sprintf("%s\n\nInput segments JSON:\n%s", systemInstructions, jsonPrompt)

	// Call bridge replay
	t.Logf("Sending translation request to bridge (Gemini session)...")
	start := time.Now()

	reqBody, _ := json.Marshal(map[string]string{
		"provider": "gemini",
		"prompt":   fullSessionPrompt,
	})

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(
		fmt.Sprintf("http://127.0.0.1:%s/replay", bridgePort),
		"application/json",
		bytes.NewReader(reqBody),
	)
	if err != nil {
		t.Fatalf("bridge replay request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	elapsed := time.Since(start)
	t.Logf("Bridge replay completed in %v", elapsed.Round(time.Millisecond))

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("bridge replay returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	// Parse bridge response wrapper
	var respJSON struct {
		Response string `json:"response"`
	}
	if err := json.Unmarshal(respBytes, &respJSON); err != nil {
		t.Fatalf("failed to unmarshal bridge response: %v\nRaw: %s", err, string(respBytes))
	}

	if respJSON.Response == "" {
		t.Fatal("bridge returned empty response")
	}

	t.Logf("Response length: %d chars", len(respJSON.Response))

	// Parse the translation JSON from Gemini's response
	translated := ParseTranslationJSON(respJSON.Response, segments)
	if len(translated) != len(segments) {
		t.Fatalf("expected %d translated segments, got %d", len(segments), len(translated))
	}

	// Verify each segment has a translation
	allTranslated := true
	for _, trans := range translated {
		if trans.TranslatedText == trans.OriginalText {
			t.Logf("WARNING: Segment %d was not translated (text unchanged): '%s'", trans.Index, trans.OriginalText)
			allTranslated = false
		}
		if trans.TranslatedText == "" {
			t.Errorf("Segment %d has empty translated text", trans.Index)
		}
		// Timestamps must be preserved
		orig := segments[trans.Index-1]
		if trans.Start != orig.Start {
			t.Errorf("Segment %d start time mismatch: expected '%s', got '%s'", trans.Index, orig.Start, trans.Start)
		}
		if trans.End != orig.End {
			t.Errorf("Segment %d end time mismatch: expected '%s', got '%s'", trans.Index, orig.End, trans.End)
		}
	}

	if allTranslated {
		t.Log("All segments were successfully translated!")
	}

	// Reassemble and log final SRT
	finalSRT := ReassembleSRT(translated)
	t.Logf("Translated SRT:\n%s", finalSRT)

	// Verify SRT structure
	blocks := strings.Split(strings.TrimSpace(finalSRT), "\n\n")
	if len(blocks) != len(segments) {
		t.Errorf("output SRT has %d blocks, expected %d", len(blocks), len(segments))
	}
}

// ─── Test: E2E via Go Backend /api/translate endpoint ───────────────────────

func TestE2E_TranslateViaGoBackend(t *testing.T) {
	backendPort := os.Getenv("PORT")
	if backendPort == "" {
		backendPort = "5000"
	}
	backendURL := fmt.Sprintf("http://127.0.0.1:%s", backendPort)
	apiKey := os.Getenv("LOCAL_API_KEY")
	if apiKey == "" {
		apiKey = "capcut_local_secret_key_2026"
	}

	if !isServiceUp(backendURL + "/api/health") {
		t.Skip("Go backend is not running - skipping E2E backend test")
	}

	// Check if Gemini session provider is available
	client := &http.Client{Timeout: 5 * time.Second}
	providersReq, _ := http.NewRequest("GET", backendURL+"/api/translate/providers", nil)
	providersReq.Header.Set("X-API-Key", apiKey)
	pResp, err := client.Do(providersReq)
	if err != nil {
		t.Fatalf("failed to fetch providers: %v", err)
	}
	defer pResp.Body.Close()

	var providers []map[string]interface{}
	json.NewDecoder(pResp.Body).Decode(&providers)

	geminiSessionAvailable := false
	for _, p := range providers {
		if p["id"] == "gemini-session" && p["available"] == true {
			geminiSessionAvailable = true
			break
		}
	}
	if !geminiSessionAvailable {
		t.Skip("Gemini session provider is not available - skipping backend E2E test")
	}

	// Submit translation task
	t.Log("Submitting translation task to Go backend...")
	translateReq, _ := json.Marshal(map[string]string{
		"srt_text":    testSRTVietnamese,
		"target_lang": "English",
		"provider":    "gemini-session",
	})

	req, _ := http.NewRequest("POST", backendURL+"/api/translate", bytes.NewReader(translateReq))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", apiKey)

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to submit translation: %v", err)
	}
	defer resp.Body.Close()

	var submitResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&submitResp)

	if submitResp["success"] != true {
		t.Fatalf("translation submission failed: %v", submitResp)
	}

	taskId := submitResp["task_id"].(string)
	t.Logf("Task ID: %s", taskId)

	// Poll for completion
	pollClient := &http.Client{Timeout: 120 * time.Second}
	deadline := time.Now().Add(120 * time.Second)

	for time.Now().Before(deadline) {
		time.Sleep(2 * time.Second)

		pollReq, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/translate/status?task_id=%s", backendURL, taskId), nil)
		pollReq.Header.Set("X-API-Key", apiKey)

		pollResp, err := pollClient.Do(pollReq)
		if err != nil {
			t.Logf("Poll error: %v", err)
			continue
		}

		var progress map[string]interface{}
		json.NewDecoder(pollResp.Body).Decode(&progress)
		pollResp.Body.Close()

		status := progress["status"].(string)
		progressPct := int(progress["progress"].(float64))
		t.Logf("Status: %s, Progress: %d%%", status, progressPct)

		if status == "succeed" {
			translatedSRT := progress["translated_srt"].(string)
			elapsed := time.Since(start)
			t.Logf("Translation completed in %v", elapsed.Round(time.Millisecond))

			if translatedSRT == "" {
				t.Fatal("translated SRT is empty")
			}

			// Verify structure
			blocks := strings.Split(strings.TrimSpace(translatedSRT), "\n\n")
			if len(blocks) != 5 {
				t.Errorf("expected 5 SRT blocks in output, got %d", len(blocks))
			}
			if !strings.Contains(translatedSRT, "-->") {
				t.Error("output SRT missing timestamp arrows")
			}

			t.Logf("Translated SRT:\n%s", translatedSRT)
			return
		}

		if status == "failed" {
			errMsg := ""
			if e, ok := progress["error"]; ok {
				errMsg = e.(string)
			}
			t.Fatalf("Translation failed: %s", errMsg)
		}
	}

	t.Fatal("Translation timed out after 120 seconds")
}
