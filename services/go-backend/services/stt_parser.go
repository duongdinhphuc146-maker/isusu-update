package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var rxSource = regexp.MustCompile(`(?i)<source\b[^>]*>.*?</source>`)
var rxTags = regexp.MustCompile(`<([^>]+)>`)

func cleanSubtitleTags(text string) string {
	text = rxSource.ReplaceAllString(text, "")
	text = rxTags.ReplaceAllStringFunc(text, func(tag string) string {
		tagContent := strings.TrimSpace(tag[1 : len(tag)-1])
		if tagContent == "" {
			return ""
		}
		tagName := strings.ToLower(strings.Split(tagContent, " ")[0])
		if tagName == "i" || tagName == "/i" || tagName == "b" || tagName == "/b" || tagName == "u" || tagName == "/u" || tagName == "font" || tagName == "/font" {
			return tag
		}
		return ""
	})
	return strings.TrimSpace(text)
}

func FormatSRTTime(ms int64) string {
	s := ms / 1000
	m := s / 60
	h := m / 60

	return fmt.Sprintf("%02d:%02d:%02d,%03d", h, m%60, s%60, ms%1000)
}

func ExtractSubtitlesSRT(responseStr string) string {
	var captions struct {
		Utterances []struct {
			Text      string `json:"text"`
			StartTime int64  `json:"start_time"`
			EndTime   int64  `json:"end_time"`
		} `json:"utterances"`
	}

	_ = json.Unmarshal([]byte(responseStr), &captions)

	if len(captions.Utterances) == 0 {
		var payload struct {
			CapJson string `json:"cap_json"`
		}
		_ = json.Unmarshal([]byte(responseStr), &payload)
		if payload.CapJson != "" {
			_ = json.Unmarshal([]byte(payload.CapJson), &captions)
		}
	}

	var srtLines []string
	index := 1
	for _, u := range captions.Utterances {
		cleanedText := cleanSubtitleTags(u.Text)
		if cleanedText != "" {
			startStr := FormatSRTTime(u.StartTime)
			endStr := FormatSRTTime(u.EndTime)
			srtLines = append(srtLines, fmt.Sprintf("%d\n%s --> %s\n%s\n", index, startStr, endStr, cleanedText))
			index++
		}
	}

	return strings.Join(srtLines, "\n")
}

func ExtractSubtitlesText(responseStr string) string {
	var captions struct {
		Utterances []struct {
			Text  string `json:"text"`
			Words []struct {
				Text string `json:"text"`
			} `json:"words"`
		} `json:"utterances"`
	}

	_ = json.Unmarshal([]byte(responseStr), &captions)

	if len(captions.Utterances) == 0 {
		var payload struct {
			CapJson string `json:"cap_json"`
		}
		_ = json.Unmarshal([]byte(responseStr), &payload)
		if payload.CapJson != "" {
			_ = json.Unmarshal([]byte(payload.CapJson), &captions)
		}
	}

	var texts []string
	hasUtteranceText := false
	for _, u := range captions.Utterances {
		if u.Text != "" {
			texts = append(texts, u.Text)
			hasUtteranceText = true
		}
	}

	if !hasUtteranceText {
		var wordTexts []string
		for _, u := range captions.Utterances {
			for _, w := range u.Words {
				if w.Text != "" {
					wordTexts = append(wordTexts, w.Text)
				}
			}
		}
		return strings.Join(wordTexts, "")
	}

	return strings.Join(texts, " ")
}
