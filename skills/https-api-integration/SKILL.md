---
name: https-api-integration
description: Guides agents on how to create and integrate direct HTTPS API fetch translation providers in the Go backend without requiring browser automation.
---

# HTTPS API Integration Skill

This skill provides step-by-step instructions and code patterns on how to create a direct HTTPS REST API client in the Go backend (e.g. for Gemini API, OpenAI API, ChatGPT Direct API) to run translations silently without opening a Playwright browser window.

## How It Works

1. **Define Data Structures**: Define matching Go structs for the API request payload, messages/contents, and JSON response.
2. **Implement Fetch Request**: Write a request handler function using Go's `http.Client` with support for:
   - Request context cancellation (`http.NewRequestWithContext`)
   - Header credentials (e.g. `Authorization` or query parameters)
   - Jitter and automatic retry logic
   - Response status code validation and error handling
3. **Register Provider**: Register the new provider ID in both:
   - `translate_worker.go` to route the translation chunks to the new fetch function.
   - `translate.go` to make it visible to the front-end clients.
4. **Isolate Changes**: Keep all provider logic in a separate file (e.g. `translate_chatgpt.go`) to prevent side-effects on other providers.

## Usage

Below is the standard template for direct API integration in Go:

```go
package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type ApiRequest struct {
	Model    string       `json:"model"`
	Messages []ApiMessage `json:"messages"`
}

type ApiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ApiResponse struct {
	Choices []struct {
		Message ApiMessage `json:"message"`
	} `json:"choices"`
}

func TranslateViaDirectAPI(ctx context.Context, prompt string, apiKey string) (string, error) {
	url := "https://api.example.com/v1/chat/completions"
	
	payload := ApiRequest{
		Model: "model-name",
		Messages: []ApiMessage{
			{Role: "user", Content: prompt},
		},
	}
	
	reqBytes, _ := json.Marshal(payload)
	
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer " + apiKey)
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBytes))
	}
	
	var apiResp ApiResponse
	json.Unmarshal(respBytes, &apiResp)
	
	return apiResp.Choices[0].Message.Content, nil
}
```

## Troubleshooting

- **401 Unauthorized**: Check that the API key environment variable is configured correctly and read by Go.
- **Timeout / Context Canceled**: Ensure the `http.Client` timeout does not exceed the worker context timeout.
