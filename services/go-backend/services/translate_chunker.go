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

type OverlapChunk struct {
	CoreSegments  []SRTSegment
	OverlapPrefix []SRTSegment
}

func ChunkSegmentsWithOverlap(segments []SRTSegment, chunkSize, overlapSize int) []OverlapChunk {
	var chunks []OverlapChunk
	n := len(segments)
	if n == 0 {
		return chunks
	}

	for i := 0; i < n; i += chunkSize {
		end := i + chunkSize
		if end > n {
			end = n
		}

		core := segments[i:end]
		var prefix []SRTSegment
		if i > 0 {
			startPrefix := i - overlapSize
			if startPrefix < 0 {
				startPrefix = 0
			}
			prefix = segments[startPrefix:i]
		}

		chunks = append(chunks, OverlapChunk{
			CoreSegments:  core,
			OverlapPrefix: prefix,
		})
	}
	return chunks
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

func CleanAndExtractJSON(input string) string {
	cleaned := strings.TrimSpace(input)
	if strings.HasPrefix(cleaned, ")]}'") {
		cleaned = strings.TrimPrefix(cleaned, ")]}'")
		cleaned = strings.TrimSpace(cleaned)
	}

	if idx := strings.Index(cleaned, "```json"); idx != -1 {
		sub := cleaned[idx+7:]
		if endIdx := strings.Index(sub, "```"); endIdx != -1 {
			cleaned = strings.TrimSpace(sub[:endIdx])
		}
	} else if idx := strings.Index(cleaned, "```"); idx != -1 {
		sub := cleaned[idx+3:]
		if endIdx := strings.Index(sub, "```"); endIdx != -1 {
			cleaned = strings.TrimSpace(sub[:endIdx])
		}
	}

	// Step 1: Extract block between first { and last } before unescaping,
	// because searching for { and } is safer when escape slashes are still there.
	start := strings.Index(cleaned, "{")
	end := strings.LastIndex(cleaned, "}")
	if start != -1 && end != -1 && end > start {
		cleaned = cleaned[start : end+1]
	}

	// Step 2: Perform robust unescaping of double and single escaped characters
	cleaned = strings.ReplaceAll(cleaned, `\\\"`, `"`)
	cleaned = strings.ReplaceAll(cleaned, `\\n`, "\n")
	cleaned = strings.ReplaceAll(cleaned, `\\t`, "\t")
	cleaned = strings.ReplaceAll(cleaned, `\\\\`, `\`)
	cleaned = strings.ReplaceAll(cleaned, `\"`, `"`)
	cleaned = strings.ReplaceAll(cleaned, `\n`, "\n")
	cleaned = strings.ReplaceAll(cleaned, `\t`, "\t")
	
	// Step 3: Run { and } check again on the unescaped result just to be clean
	start = strings.Index(cleaned, "{")
	end = strings.LastIndex(cleaned, "}")
	if start != -1 && end != -1 && end > start {
		cleaned = cleaned[start : end+1]
	}

	return cleaned
}

// ParseTranslationJSON parses the AI's JSON response and maps the translated text back to SRT segments.
func ParseTranslationJSON(jsonResponse string, originalSegs []SRTSegment) []TranslatedSegment {
	cleaned := CleanAndExtractJSON(jsonResponse)

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
