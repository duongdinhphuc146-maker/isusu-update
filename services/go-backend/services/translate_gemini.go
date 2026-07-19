package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"go-backend/services/go-backend/internal/logx"
)

type GeminiRequest struct {
	Contents         []GeminiContent         `json:"contents"`
	GenerationConfig *GeminiGenerationConfig `json:"generationConfig,omitempty"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiGenerationConfig struct {
	ResponseMimeType string `json:"responseMimeType,omitempty"`
}

type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
}

type GeminiCandidate struct {
	Content GeminiContent `json:"content"`
}

// TranslateViaGeminiAPI translates a JSON prompt using the direct Google Gemini REST API.
func TranslateViaGeminiAPI(ctx context.Context, jsonPrompt string, apiKey string) (string, error) {
	if apiKey == "" {
		return "", errors.New("Gemini API key is not configured")
	}

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.0-flash-lite"
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
	
	systemInstructions := "You are a professional subtitle translator. Translate the 'text' field of each segment in the input JSON list to the target language. Keep the original 'id' exactly as is. Output MUST be valid JSON structure matching: {\"translations\": [{\"id\": N, \"text\": \"translated text\"}]}"
	fullPrompt := fmt.Sprintf("%s\n\nInput segments:\n%s", systemInstructions, jsonPrompt)

	reqPayload := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: fullPrompt},
				},
			},
		},
		GenerationConfig: &GeminiGenerationConfig{
			ResponseMimeType: "application/json",
		},
	}

	reqBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return "", err
	}

	var respText string
	var lastErr error

	// Retry loop: 3 attempts total (2 retries)
	for attempt := 1; attempt <= 3; attempt++ {
		if attempt > 1 {
			logx.Info("Retrying Gemini translation request", "attempt", attempt)
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(3 * time.Second):
			}
		}

		respText, lastErr = doGeminiRequest(ctx, url, reqBytes)
		if lastErr == nil {
			return respText, nil
		}
		logx.Error("Gemini request failed", lastErr, "attempt", attempt)
	}

	return "", fmt.Errorf("Gemini translation failed after 3 attempts: %w", lastErr)
}

func doGeminiRequest(ctx context.Context, url string, reqBytes []byte) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
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
		return "", fmt.Errorf("Gemini API returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(respBytes, &geminiResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal Gemini response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", errors.New("empty response content from Gemini API")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

type GeminiMultiTaskResponse struct {
	Results []MultiTaskResult `json:"results"`
}

func TranslateMultiTaskViaGemini(ctx context.Context, chunk OverlapChunk, characterMap *CharacterMap, targetLang string, apiKey string) ([]MultiTaskResult, error) {
	if apiKey == "" {
		return nil, errors.New("Gemini API key is not configured")
	}

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.0-flash-lite"
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	// Prepare Character Map context
	cmapData, _ := json.Marshal(characterMap)

	// Prepare Overlap context (read-only prefix)
	var prefixLines []string
	for _, seg := range chunk.OverlapPrefix {
		prefixLines = append(prefixLines, fmt.Sprintf("ID: %d | Text: %s", seg.Index, seg.Text))
	}

	// Prepare Core segments to translate
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

	reqPayload := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: fullPrompt},
				},
			},
		},
		GenerationConfig: &GeminiGenerationConfig{
			ResponseMimeType: "application/json",
		},
	}

	reqBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, err
	}

	var respText string
	var lastErr error

	for attempt := 1; attempt <= 3; attempt++ {
		if attempt > 1 {
			logx.Info("Retrying Gemini multi-task request", "attempt", attempt)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(3 * time.Second):
			}
		}

		respText, lastErr = doGeminiRequest(ctx, url, reqBytes)
		if lastErr == nil {
			break
		}
		logx.Error("Gemini multi-task request failed", lastErr, "attempt", attempt)
	}

	if lastErr != nil {
		return nil, fmt.Errorf("Gemini multi-task translation failed after 3 attempts: %w", lastErr)
	}

	// Clean markdown block wrappers if present (e.g. ```json ... ```)
	cleaned := strings.TrimSpace(respText)
	if strings.HasPrefix(cleaned, "```") {
		split := strings.Split(cleaned, "\n")
		var contentLines []string
		for _, line := range split {
			trimmedLine := strings.TrimSpace(line)
			if !strings.HasPrefix(trimmedLine, "```") {
				contentLines = append(contentLines, line)
			}
		}
		cleaned = strings.Join(contentLines, "\n")
	}

	var mtaskResp GeminiMultiTaskResponse
	if err := json.Unmarshal([]byte(cleaned), &mtaskResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal multi-task JSON: %w, raw response: %s", err, cleaned)
	}

	return mtaskResp.Results, nil
}
