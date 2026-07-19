package services

import (
	"math"
)

type RateResult struct {
	Rate            float64 `json:"rate"`
	NeedsShortening bool    `json:"needs_shortening"`
	RequiredCPS     float64 `json:"required_cps"`
	TargetCPS       float64 `json:"target_cps"`
}

// EstimateRate calculates the required rate multiplier compared to baseline voice CPS
func EstimateRate(text string, durationSec float64, voiceCPS float64) RateResult {
	if durationSec <= 0 {
		return RateResult{Rate: 1.0, NeedsShortening: false, RequiredCPS: 0, TargetCPS: voiceCPS}
	}

	charCount := float64(len([]rune(text)))
	requiredCPS := charCount / durationSec

	if voiceCPS <= 0 {
		voiceCPS = 10.0 // Default fallback CPS
	}

	rawRate := requiredCPS / voiceCPS

	// CapCut rate parameter bounds are [0.8, 2.2] to prevent robotic voice distortions
	rate := math.Max(0.8, math.Min(2.2, rawRate))
	needsShortening := rawRate > 2.2

	return RateResult{
		Rate:            rate,
		NeedsShortening: needsShortening,
		RequiredCPS:     requiredCPS,
		TargetCPS:       voiceCPS,
	}
}

// GetVoiceCPS returns average Characters Per Second constants for supported languages
func GetVoiceCPS(langCode string) float64 {
	// Standardized character densities: Vietnamese is high-density monosyllabic (~4.5 cps), English (~14.0 cps)
	switch langCode {
	case "vi", "vi-VN":
		return 4.5
	case "en", "en-US", "en-GB":
		return 14.0
	case "zh", "zh-CN":
		return 3.0
	case "ja", "ja-JP":
		return 5.0
	case "ko", "ko-KR":
		return 4.0
	default:
		return 8.0 // general default
	}
}
