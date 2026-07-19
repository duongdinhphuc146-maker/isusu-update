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

type ChatGPTRequest struct {
	Model          string                `json:"model"`
	Messages       []ChatGPTMessage       `json:"messages"`
	ResponseFormat *ChatGPTResponseFormat `json:"response_format,omitempty"`
}

type ChatGPTMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatGPTResponseFormat struct {
	Type string `json:"type"`
}

type ChatGPTResponse struct {
	Choices []ChatGPTChoice `json:"choices"`
}

type ChatGPTChoice struct {
	Message ChatGPTMessage `json:"message"`
}

// TranslateViaChatGPTAPI translates a JSON prompt using the direct ChatGPT (OpenAI) REST API.
func TranslateViaChatGPTAPI(ctx context.Context, jsonPrompt string, apiKey string) (string, error) {
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}
	if apiKey == "" {
		return "", errors.New("ChatGPT API key is not configured")
	}

	model := os.Getenv("CHATGPT_MODEL")
	if model == "" {
		model = "gpt-4o-mini"
	}

	url := "https://api.openai.com/v1/chat/completions"

	systemInstructions := "You are a professional subtitle translator. Translate the 'text' field of each segment in the input JSON list to the target language. Keep the original 'id' exactly as is. Output MUST be valid JSON structure matching: {\"translations\": [{\"id\": N, \"text\": \"translated text\"}]}"

	reqPayload := ChatGPTRequest{
		Model: model,
		Messages: []ChatGPTMessage{
			{
				Role:    "system",
				Content: systemInstructions,
			},
			{
				Role:    "user",
				Content: jsonPrompt,
			},
		},
		ResponseFormat: &ChatGPTResponseFormat{
			Type: "json_object",
		},
	}

	reqBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return "", err
	}

	var respText string
	var lastErr error

	// Retry loop: 3 attempts total
	for attempt := 1; attempt <= 3; attempt++ {
		if attempt > 1 {
			logx.Info("Retrying ChatGPT translation request", "attempt", attempt)
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(3 * time.Second):
			}
		}

		respText, lastErr = doChatGPTRequest(ctx, url, apiKey, reqBytes)
		if lastErr == nil {
			return respText, nil
		}
		logx.Error("ChatGPT request failed", lastErr, "attempt", attempt)
	}

	return "", fmt.Errorf("ChatGPT translation failed after 3 attempts: %w", lastErr)
}

func doChatGPTRequest(ctx context.Context, url, apiKey string, reqBytes []byte) (string, error) {
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
		return "", fmt.Errorf("ChatGPT API returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var chatgptResp ChatGPTResponse
	if err := json.Unmarshal(respBytes, &chatgptResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal ChatGPT response: %w", err)
	}

	if len(chatgptResp.Choices) == 0 {
		return "", errors.New("empty choices in response from ChatGPT API")
	}

	return chatgptResp.Choices[0].Message.Content, nil
}
