package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseSRT(t *testing.T) {
	srtContent := `1
00:00:01,000 --> 00:00:03,500
Hello World!

2
00:00:04,100 --> 00:00:06,200
Testing SRT Normalization.`

	segments := ParseSRT(srtContent)
	if len(segments) != 2 {
		t.Fatalf("expected 2 segments, got %d", len(segments))
	}

	if segments[0].Index != 1 || segments[0].Text != "Hello World!" {
		t.Errorf("segment 1 text mismatch: got %s", segments[0].Text)
	}

	if segments[0].StartSec != 1.0 || segments[0].EndSec != 3.5 || segments[0].DurationSec != 2.5 {
		t.Errorf("segment 1 timings incorrect: start=%f, end=%f, dur=%f", segments[0].StartSec, segments[0].EndSec, segments[0].DurationSec)
	}

	if segments[1].Index != 2 || segments[1].Text != "Testing SRT Normalization." {
		t.Errorf("segment 2 text mismatch: got %s", segments[1].Text)
	}

	if segments[1].StartSec != 4.1 || segments[1].EndSec != 6.2 || segments[1].DurationSec != 2.1 {
		t.Errorf("segment 2 timings incorrect: start=%f, end=%f, dur=%f", segments[1].StartSec, segments[1].EndSec, segments[1].DurationSec)
	}
}

func TestExportMetadata(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "projects_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	segments := []SRTSegment{
		{
			Index:       1,
			Start:       "00:00:01,000",
			End:         "00:00:03,500",
			DurationMs:  2500,
			StartSec:    1.0,
			EndSec:      3.5,
			DurationSec: 2.5,
			Text:        "Hello World!",
		},
	}

	err = ExportMetadata(segments, tmpDir)
	if err != nil {
		t.Fatalf("failed to export metadata: %v", err)
	}

	metaFile := filepath.Join(tmpDir, "metadata.json")
	if _, err := os.Stat(metaFile); os.IsNotExist(err) {
		t.Fatalf("metadata.json not created")
	}
}
