package services

import (
	"testing"
)

func TestMergeSegments(t *testing.T) {
	segments := []TranslatedSegment{
		{
			Index:          1,
			Start:          "00:00:01,000",
			End:            "00:00:03,000",
			TranslatedText: "Hello",
			Speaker:        "SPK_01",
			Emotion:        "happy",
		},
		{
			Index:          2,
			Start:          "00:00:04,000",
			End:            "00:00:05,000",
			TranslatedText: "world",
			Speaker:        "SPK_01",
			Emotion:        "happy",
		},
		{
			Index:          3,
			Start:          "00:00:06,000",
			End:            "00:00:07,000",
			TranslatedText: "Different speaker",
			Speaker:        "SPK_02",
			Emotion:        "happy",
		},
	}

	merged := MergeSegments(segments)
	if len(merged) != 2 {
		t.Fatalf("expected 2 merged blocks, got %d", len(merged))
	}

	// 1st block: merged "Hello" and "world" with gap of 1.0s -> mapping to "."
	if merged[0].Text != "Hello. world" {
		t.Errorf("expected merged text 'Hello. world', got '%s'", merged[0].Text)
	}

	if len(merged[0].ChildIDs) != 2 || merged[0].ChildIDs[0] != 1 || merged[0].ChildIDs[1] != 2 {
		t.Errorf("child IDs mapped incorrectly: %v", merged[0].ChildIDs)
	}
}

func TestEstimateRate(t *testing.T) {
	// 30 characters in 2 seconds -> required CPS = 15. Standard voice CPS = 14.
	// raw rate = 15 / 14 = 1.07 -> within bounds [0.8, 1.4]
	res := EstimateRate("Thirty characters in two secs.", 2.0, 14.0)
	if res.Rate < 1.0 || res.Rate > 1.1 {
		t.Errorf("estimated rate multiplier out of expected range: %f", res.Rate)
	}
	if res.NeedsShortening {
		t.Errorf("expected needs_shortening=false")
	}

	// Extreme case: 100 characters in 1 second -> raw rate = 100 / 14 = 7.14 -> clamped to 2.2, needs shortening
	res2 := EstimateRate("Extreme test character count that is definitely going to require shortening fallback due to too many characters.", 1.0, 14.0)
	if res2.Rate != 2.2 {
		t.Errorf("expected clamped rate to be 2.2, got %f", res2.Rate)
	}
	if !res2.NeedsShortening {
		t.Errorf("expected needs_shortening=true")
	}
}
