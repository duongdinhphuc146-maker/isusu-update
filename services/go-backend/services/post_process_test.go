package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSplitAudioPCM_Fallback(t *testing.T) {
	// 100 samples representing audio data
	samples := make([]float32, 100)
	for i := range samples {
		samples[i] = float32(i) / 100.0
	}

	texts := []string{"word1", "word2"}
	// expectedCount = 2
	// Split proportionality: "word1" has length 5, "word2" has length 5. Total = 10. Split point = 50.
	clips := SplitAudioPCM(samples, nil, 2, texts)

	if len(clips) != 2 {
		t.Fatalf("expected 2 clips, got %d", len(clips))
	}

	if len(clips[0]) != 50 || len(clips[1]) != 50 {
		t.Errorf("incorrect split offsets: clip0 length=%d, clip1 length=%d", len(clips[0]), len(clips[1]))
	}
}

func TestWavEncoder(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "audio_encoder_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	samples := []float32{0.0, 0.5, -0.5, 0.0}
	wavPath := filepath.Join(tmpDir, "test.wav")

	err = EncodePCMToWav(samples, 44100, wavPath)
	if err != nil {
		t.Fatalf("failed to encode WAV: %v", err)
	}

	if _, err := os.Stat(wavPath); os.IsNotExist(err) {
		t.Fatalf("WAV file was not created")
	}
}

func TestTimelineBuilder(t *testing.T) {
	merged := []MergedSegment{
		{
			ID:          1,
			Speaker:     "SPK_01",
			Emotion:     "happy",
			Text:        "Hello. world",
			ChildIDs:    []int{1, 2},
			StartSec:    1.0,
			EndSec:      3.5,
			DurationSec: 2.5,
			Timings: []SubSegmentTiming{
				{Index: 1, StartOffset: 0.0, EndOffset: 1.0, DurationSec: 1.0},
				{Index: 2, StartOffset: 1.5, EndOffset: 2.5, DurationSec: 1.0},
			},
		},
	}

	splitPaths := map[int]string{
		1: "clip1.wav",
		2: "clip2.wav",
	}

	timeline := BuildTimeline(merged, splitPaths)

	// Timeline events expected:
	// 1. Gap before speech: 0.0s -> 1.0s (silence)
	// 2. Speech segment 1: 1.0s -> 2.0s (clip1.wav)
	// 3. Gap between segment 1 and 2: 2.0s -> 2.5s (silence)
	// 4. Speech segment 2: 2.5s -> 3.5s (clip2.wav)
	if len(timeline.Events) != 4 {
		t.Fatalf("expected 4 timeline events, got %d", len(timeline.Events))
	}

	if !timeline.Events[0].IsSilence || timeline.Events[0].EndSec != 1.0 {
		t.Errorf("event 0 incorrect: %+v", timeline.Events[0])
	}

	if timeline.Events[1].AudioPath != "clip1.wav" || timeline.Events[1].StartSec != 1.0 || timeline.Events[1].EndSec != 2.0 {
		t.Errorf("event 1 incorrect: %+v", timeline.Events[1])
	}
}
