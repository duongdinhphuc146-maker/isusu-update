package services

import (
	"os"
	"testing"
)

func TestExtractAnchorChunks(t *testing.T) {
	segs := []SRTSegment{
		{Index: 1, Text: "Normal greeting."},
		{Index: 2, Text: `"Hello!" he said.`},
		{Index: 3, Text: "Where are you going?"},
		{Index: 4, Text: "Just walking."},
	}

	anchors := ExtractAnchorChunks(segs, 2)
	if len(anchors) != 2 {
		t.Fatalf("expected 2 anchors, got %d", len(anchors))
	}

	// Index 2 and 3 contain priority conversational tokens (quote, question mark)
	if anchors[0].Index != 2 && anchors[0].Index != 3 {
		t.Errorf("expected prioritized segments first, got index %d", anchors[0].Index)
	}
}

func TestCharacterMemory(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "character_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	cmap := &CharacterMap{
		Characters: []Character{
			{ID: "SPK_01", Name: "Alice", Gender: "female", Traits: "Adventurous"},
		},
	}

	err = SaveCharacterMap(cmap, tmpDir)
	if err != nil {
		t.Fatalf("failed to save character map: %v", err)
	}

	loaded, err := LoadCharacterMap(tmpDir)
	if err != nil {
		t.Fatalf("failed to load character map: %v", err)
	}

	if len(loaded.Characters) != 1 || loaded.Characters[0].Name != "Alice" {
		t.Errorf("character map load mismatch")
	}
}
