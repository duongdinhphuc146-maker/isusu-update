package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"go-backend/services/go-backend/internal/logx"
)

type Character struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Gender     string `json:"gender"`
	Traits     string `json:"traits"`
	VoiceType  string `json:"voice_type,omitempty"`
	ResourceID string `json:"resource_id,omitempty"`
}

type CharacterMap struct {
	Characters []Character `json:"characters"`
}

// ExtractAnchorChunks pulls high-density dialog blocks up to standard maximum line count
func ExtractAnchorChunks(segments []SRTSegment, count int) []SRTSegment {
	if len(segments) <= count {
		return segments
	}
	
	// Priority based on conversational tokens (quotes, question/exclamation marks)
	var priority []SRTSegment
	var ordinary []SRTSegment

	for _, seg := range segments {
		t := seg.Text
		if strings.Contains(t, "\"") || strings.Contains(t, "'") || strings.Contains(t, "?") || strings.Contains(t, "!") {
			priority = append(priority, seg)
		} else {
			ordinary = append(ordinary, seg)
		}
	}

	result := append([]SRTSegment{}, priority...)
	if len(result) < count {
		needed := count - len(result)
		if needed > len(ordinary) {
			needed = len(ordinary)
		}
		result = append(result, ordinary[:needed]...)
	}

	if len(result) > count {
		result = result[:count]
	}
	return result
}

// ProfileCharacters queries Gemini or a session bridge to generate character catalog profiles.
// If both are unavailable, it falls back to a default character catalog.
func ProfileCharacters(ctx context.Context, segments []SRTSegment, provider string, apiKey string) (*CharacterMap, error) {
	// Prepare simple JSON list of texts to feed model
	type DialogLine struct {
		ID   int    `json:"id"`
		Text string `json:"text"`
	}
	var lines []DialogLine
	for _, seg := range segments {
		lines = append(lines, DialogLine{ID: seg.Index, Text: seg.Text})
	}
	linesBytes, _ := json.Marshal(lines)

	systemInstructions := `Identify all distinct speakers/characters in this subtitle transcript chunk.
For each character identified, assign a standardized ID format (e.g., SPK_01, SPK_02, etc.).
Determine their likely name (or role if nameless), gender (male, female, or unknown), and brief character traits or personality descriptors.
Output MUST be valid JSON structure matching: {"characters": [{"id": "SPK_01", "name": "Character Name", "gender": "male", "traits": "polite, helpful"}]}`

	fullPrompt := fmt.Sprintf("%s\n\nInput segments:\n%s", systemInstructions, string(linesBytes))

	var respText string
	var lastErr error

	if apiKey == "" && strings.HasSuffix(provider, "-session") {
		// Use Browser Session Bridge
		bridgeProvider := strings.TrimSuffix(provider, "-session")
		respText, lastErr = ReplayViaBridge(ctx, fullPrompt, bridgeProvider)
	} else if apiKey != "" {
		// Use Direct Gemini API
		model := os.Getenv("GEMINI_MODEL")
		if model == "" {
			model = "gemini-2.0-flash-lite"
		}
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
		reqPayload := GeminiRequest{
			Contents: []GeminiContent{
				{Parts: []GeminiPart{{Text: fullPrompt}}},
			},
			GenerationConfig: &GeminiGenerationConfig{
				ResponseMimeType: "application/json",
			},
		}
		reqBytes, _ := json.Marshal(reqPayload)

		for attempt := 1; attempt <= 3; attempt++ {
			if attempt > 1 {
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(2 * time.Second):
				}
			}
			respText, lastErr = doGeminiRequest(ctx, url, reqBytes)
			if lastErr == nil {
				break
			}
		}
	} else {
		lastErr = errors.New("neither Gemini API key nor Browser Session is configured")
	}

	if lastErr != nil {
		// Fallback to default offline character map
		logx.Info("Falling back to offline character mapping", "reason", lastErr.Error())
		return &CharacterMap{
			Characters: []Character{
				{ID: "SPK_01", Name: "Nhân vật 1 (Nam)", Gender: "male", Traits: "Offline Fallback"},
				{ID: "SPK_02", Name: "Nhân vật 2 (Nữ)", Gender: "female", Traits: "Offline Fallback"},
			},
		}, nil
	}

	cleaned := CleanAndExtractJSON(respText)

	var characterMap CharacterMap
	if err := json.Unmarshal([]byte(cleaned), &characterMap); err != nil {
		// Fallback to offline character map if JSON parsing fails
		logx.Error("Failed to parse AI character response, using offline fallback", err)
		return &CharacterMap{
			Characters: []Character{
				{ID: "SPK_01", Name: "Nhân vật 1 (Nam)", Gender: "male", Traits: "Offline Fallback"},
				{ID: "SPK_02", Name: "Nhân vật 2 (Nữ)", Gender: "female", Traits: "Offline Fallback"},
			},
		}, nil
	}

	return &characterMap, nil
}
