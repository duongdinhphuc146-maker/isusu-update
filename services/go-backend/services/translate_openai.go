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

type OpenAIRequest struct {
	Model          string                `json:"model"`
	Messages       []OpenAIMessage       `json:"messages"`
	ResponseFormat *OpenAIResponseFormat `json:"response_format,omitempty"`
}

type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIResponseFormat struct {
	Type string `json:"type"`
}

type OpenAIResponse struct {
	Choices []OpenAIChoice `json:"choices"`
}

type OpenAIChoice struct {
	Message OpenAIMessage `json:"message"`
}

// TranslateViaOpenAIAPI translates a JSON prompt using the direct OpenAI chat completions API.
func TranslateViaOpenAIAPI(ctx context.Context, jsonPrompt string, apiKey string) (string, error) {
	if apiKey == "" {
		return "", errors.New("OpenAI API key is not configured")
	}

	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		model = "gpt-4o"
	}

	url := "https://api.openai.com/v1/chat/completions"

	systemInstructions := "You are a professional subtitle translator. Translate the 'text' field of each segment in the input JSON list to the target language. Keep the original 'id' exactly as is. Output MUST be valid JSON structure matching: {\"translations\": [{\"id\": N, \"text\": \"translated text\"}]}"

	reqPayload := OpenAIRequest{
		Model: model,
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: systemInstructions,
			},
			{
				Role:    "user",
				Content: jsonPrompt,
			},
		},
		ResponseFormat: &OpenAIResponseFormat{
			Type: "json_object",
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
			logx.Info("Retrying OpenAI translation request", "attempt", attempt)
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(3 * time.Second):
			}
		}

		respText, lastErr = doOpenAIRequest(ctx, url, apiKey, reqBytes)
		if lastErr == nil {
			return respText, nil
		}
		logx.Error("OpenAI request failed", lastErr, "attempt", attempt)
	}

	return "", fmt.Errorf("OpenAI translation failed after 3 attempts: %w", lastErr)
}

func doOpenAIRequest(ctx context.Context, url, apiKey string, reqBytes []byte) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

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
		return "", fmt.Errorf("OpenAI API returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var openaiResp OpenAIResponse
	if err := json.Unmarshal(respBytes, &openaiResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal OpenAI response: %w", err)
	}

	if len(openaiResp.Choices) == 0 {
		return "", errors.New("empty choices in response from OpenAI API")
	}

	return openaiResp.Choices[0].Message.Content, nil
}
