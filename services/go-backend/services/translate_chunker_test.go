package services

import (
	"testing"
)

func TestChunkSegments(t *testing.T) {
	segments := []SRTSegment{
		{Index: 1, Text: "Hello", Start: "00:00:01,000", End: "00:00:03,000"},
		{Index: 2, Text: "World", Start: "00:00:04,000", End: "00:00:06,000"},
		{Index: 3, Text: "Subtitle", Start: "00:00:07,000", End: "00:00:09,000"},
	}

	// Max 6 characters limit forces each word into its own chunk
	chunks := ChunkSegments(segments, 6)
	if len(chunks) != 3 {
		t.Errorf("expected 3 chunks, got %d", len(chunks))
	}
}

func TestBuildAndParseTranslationJSON(t *testing.T) {
	segments := []SRTSegment{
		{Index: 1, Text: "私とストエッチ", Start: "00:00:01,000", End: "00:00:03,000"},
		{Index: 2, Text: "したい", Start: "00:00:04,000", End: "00:00:06,000"},
	}

	jsonPrompt, err := BuildTranslationJSON(segments, "English")
	if err != nil {
		t.Fatalf("failed to build translation JSON: %v", err)
	}

	// Ensure prompt does not contain timestamps
	if jsonPrompt == "" {
		t.Fatalf("jsonPrompt is empty")
	}

	// Mock response from AI wrap in markdown block
	aiResponse := "```json\n{\n  \"translations\": [\n    {\"id\": 1, \"text\": \"Stretching with me\"},\n    {\"id\": 2, \"text\": \"I want to\"}\n  ]\n}\n```"

	translated := ParseTranslationJSON(aiResponse, segments)
	if len(translated) != 2 {
		t.Fatalf("expected 2 translated segments, got %d", len(translated))
	}

	if translated[0].TranslatedText != "Stretching with me" {
		t.Errorf("expected 'Stretching with me', got '%s'", translated[0].TranslatedText)
	}
	if translated[0].Start != "00:00:01,000" {
		t.Errorf("expected original start timestamp, got '%s'", translated[0].Start)
	}
	if translated[1].TranslatedText != "I want to" {
		t.Errorf("expected 'I want to', got '%s'", translated[1].TranslatedText)
	}
}

func TestChunkSegmentsWithOverlap(t *testing.T) {
	segments := []SRTSegment{
		{Index: 1, Text: "S1"},
		{Index: 2, Text: "S2"},
		{Index: 3, Text: "S3"},
		{Index: 4, Text: "S4"},
		{Index: 5, Text: "S5"},
	}

	chunks := ChunkSegmentsWithOverlap(segments, 2, 1)
	// Chunk 0: Core [S1, S2], Overlap []
	// Chunk 1: Core [S3, S4], Overlap [S2]
	// Chunk 2: Core [S5], Overlap [S4]
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}

	if len(chunks[0].CoreSegments) != 2 || len(chunks[0].OverlapPrefix) != 0 {
		t.Errorf("chunk 0 invalid")
	}

	if chunks[1].CoreSegments[0].Text != "S3" || chunks[1].OverlapPrefix[0].Text != "S2" {
		t.Errorf("chunk 1 overlap mismatch: got %v", chunks[1])
	}
}
