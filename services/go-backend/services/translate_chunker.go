package services

import (
	"encoding/json"
	"fmt"
	"go-backend/services/go-backend/internal/logx"
	"strings"
)

type PromptPayload struct {
	TargetLanguage string        `json:"target_language"`
	Segments       []JSONSegment `json:"segments"`
}

type JSONSegment struct {
	ID   int    `json:"id"`
	Text string `json:"text"`
}

type ResponsePayload struct {
	Translations []JSONSegment `json:"translations"`
}

// ChunkSegments splits a list of SRT segments into smaller chunks based on max character count.
func ChunkSegments(segments []SRTSegment, maxChars int) [][]SRTSegment {
	var chunks [][]SRTSegment
	var currentChunk []SRTSegment
	currentChars := 0

	for _, seg := range segments {
		segLen := len(seg.Text)
		if currentChars+segLen > maxChars && len(currentChunk) > 0 {
			chunks = append(chunks, currentChunk)
			currentChunk = []SRTSegment{}
			currentChars = 0
		}
		currentChunk = append(currentChunk, seg)
		currentChars += segLen
	}

	if len(currentChunk) > 0 {
		chunks = append(chunks, currentChunk)
	}

	return chunks
}

// BuildTranslationJSON constructs the JSON prompt for the AI translation model.
func BuildTranslationJSON(segs []SRTSegment, targetLang string) (string, error) {
	payload := PromptPayload{
		TargetLanguage: targetLang,
		Segments:       make([]JSONSegment, len(segs)),
	}

	for i, seg := range segs {
		payload.Segments[i] = JSONSegment{
			ID:   seg.Index,
			Text: seg.Text,
		}
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ParseTranslationJSON parses the AI's JSON response and maps the translated text back to SRT segments.
func ParseTranslationJSON(jsonResponse string, originalSegs []SRTSegment) []TranslatedSegment {
	// Clean markdown block wrappers if present (e.g. ```json ... ```)
	cleaned := strings.TrimSpace(jsonResponse)
	if strings.HasPrefix(cleaned, "```") {
		lines := strings.Split(cleaned, "\n")
		var contentLines []string
		for _, line := range lines {
			trimmedLine := strings.TrimSpace(line)
			if !strings.HasPrefix(trimmedLine, "```") {
				contentLines = append(contentLines, line)
			}
		}
		cleaned = strings.Join(contentLines, "\n")
	}

	var payload ResponsePayload
	err := json.Unmarshal([]byte(cleaned), &payload)
	
	// Create lookup map of ID -> Translated Text
	translationMap := make(map[int]string)
	if err != nil {
		logx.Error("Failed to parse AI JSON response", err, "raw", jsonResponse)
	} else {
		for _, trans := range payload.Translations {
			translationMap[trans.ID] = trans.Text
		}
	}

	translatedSegs := make([]TranslatedSegment, len(originalSegs))
	for i, seg := range originalSegs {
		transText, exists := translationMap[seg.Index]
		if !exists {
			logx.Info("Missing translation for segment, using original text", "index", seg.Index)
			transText = seg.Text
		}
		translatedSegs[i] = TranslatedSegment{
			Index:          seg.Index,
			Start:          seg.Start,
			End:            seg.End,
			OriginalText:   seg.Text,
			TranslatedText: transText,
		}
	}

	return translatedSegs
}

// ReassembleSRT formats the translated segments back into a valid SRT file.
func ReassembleSRT(segs []TranslatedSegment) string {
	var builder strings.Builder
	for _, seg := range segs {
		builder.WriteString(fmt.Sprintf("%d\n", seg.Index))
		builder.WriteString(fmt.Sprintf("%s --> %s\n", seg.Start, seg.End))
		builder.WriteString(fmt.Sprintf("%s\n\n", seg.TranslatedText))
	}
	return builder.String()
}
