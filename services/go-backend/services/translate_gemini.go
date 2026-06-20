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
