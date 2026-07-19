package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type ShortenResponse struct {
	ShortenedText string `json:"shortened_text"`
}

func ShortenText(ctx context.Context, text string, targetReduction float64, apiKey string) (string, error) {
	if apiKey == "" {
		return text, errors.New("Gemini API key is not configured")
	}

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.0-flash-lite"
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	systemInstructions := fmt.Sprintf(`You are a dialogue compressor.
Your task is to shorten/compress the input subtitle text by approximately %.0f%%.
You MUST retain the original core meaning, emotion, and tone.
The output MUST be a valid JSON structure: {"shortened_text": "new shortened text"}`, targetReduction*100)

	reqPayload := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: fmt.Sprintf("%s\n\nInput Text:\n%s", systemInstructions, text)},
				},
			},
		},
		GenerationConfig: &GeminiGenerationConfig{
			ResponseMimeType: "application/json",
		},
	}

	reqBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return text, err
	}

	var respText string
	var lastErr error

	for attempt := 1; attempt <= 3; attempt++ {
		if attempt > 1 {
			select {
			case <-ctx.Done():
				return text, ctx.Err()
			case <-time.After(2 * time.Second):
			}
		}

		respText, lastErr = doGeminiRequest(ctx, url, reqBytes)
		if lastErr == nil {
			break
		}
	}

	if lastErr != nil {
		return text, lastErr
	}

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

	var sResp ShortenResponse
	if err := json.Unmarshal([]byte(cleaned), &sResp); err != nil {
		return text, err
	}

	return sResp.ShortenedText, nil
}
