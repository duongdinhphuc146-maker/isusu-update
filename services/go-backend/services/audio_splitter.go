package services

import (
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"os/exec"
)

type SilenceRegion struct {
	StartSample int
	EndSample   int
}

// DecodeToPCM uses FFmpeg to convert MP3/WAV to raw float32 PCM in memory
func DecodeToPCM(audioPath string, sampleRate int) ([]float32, error) {
	tmpRaw := audioPath + ".raw"
	defer os.Remove(tmpRaw)

	hw := GetHwaccelSetting()
	var cmd *exec.Cmd
	if hw != "" && hw != "none" {
		cmd = exec.Command("ffmpeg", "-y", "-hwaccel", hw, "-i", audioPath, "-f", "f32le", "-acodec", "pcm_f32le", "-ar", fmt.Sprintf("%d", sampleRate), "-ac", "1", tmpRaw)
	} else {
		cmd = exec.Command("ffmpeg", "-y", "-i", audioPath, "-f", "f32le", "-acodec", "pcm_f32le", "-ar", fmt.Sprintf("%d", sampleRate), "-ac", "1", tmpRaw)
	}
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg decode failed: %w", err)
	}

	data, err := os.ReadFile(tmpRaw)
	if err != nil {
		return nil, err
	}

	samplesCount := len(data) / 4
	samples := make([]float32, samplesCount)
	for i := 0; i < samplesCount; i++ {
		bits := binary.LittleEndian.Uint32(data[i*4 : (i+1)*4])
		samples[i] = math.Float32frombits(bits)
	}

	return samples, nil
}

// DetectSilence finds silence intervals using Root Mean Square (RMS) envelope
func DetectSilence(samples []float32, sampleRate int, thresholdDB float64, minDurationMs int) []SilenceRegion {
	var regions []SilenceRegion
	minSamples := (minDurationMs * sampleRate) / 1000
	windowSize := sampleRate / 100 // 10ms window

	thresholdVal := math.Pow(10, thresholdDB/20.0) // Convert dB to amplitude ratio

	inSilence := false
	silenceStart := 0

	for i := 0; i < len(samples); i += windowSize {
		endIdx := i + windowSize
		if endIdx > len(samples) {
			endIdx = len(samples)
		}

		// Calculate RMS
		var sum float64
		for _, s := range samples[i:endIdx] {
			sum += float64(s * s)
		}
		rms := math.Sqrt(sum / float64(endIdx-i))

		if rms < thresholdVal {
			if !inSilence {
				inSilence = true
				silenceStart = i
			}
		} else {
			if inSilence {
				inSilence = false
				durationSamples := i - silenceStart
				if durationSamples >= minSamples {
					regions = append(regions, SilenceRegion{
						StartSample: silenceStart,
						EndSample:   i,
					})
				}
			}
		}
	}

	if inSilence {
		durationSamples := len(samples) - silenceStart
		if durationSamples >= minSamples {
			regions = append(regions, SilenceRegion{
				StartSample: silenceStart,
				EndSample:   len(samples),
			})
		}
	}

	return regions
}

// SplitAudioPCM slices PCM buffer into child blocks matching expected count using silence regions or fallback
func SplitAudioPCM(samples []float32, silenceRegions []SilenceRegion, expectedCount int, childTexts []string) [][]float32 {
	if expectedCount <= 1 || len(samples) == 0 {
		return [][]float32{samples}
	}

	var clips [][]float32

	// If we detected exactly expectedCount - 1 silence intervals, we can split clean
	if len(silenceRegions) == expectedCount-1 {
		lastIdx := 0
		for _, r := range silenceRegions {
			// Split in the middle of silence region
			splitPoint := (r.StartSample + r.EndSample) / 2
			clips = append(clips, samples[lastIdx:splitPoint])
			lastIdx = splitPoint
		}
		clips = append(clips, samples[lastIdx:])
		return clips
	}

	// Robust Fallback: Split proportional to character length of texts
	totalChars := 0
	for _, text := range childTexts {
		totalChars += len([]rune(text))
	}
	if totalChars == 0 {
		// Split evenly
		chunkSize := len(samples) / expectedCount
		for i := 0; i < expectedCount; i++ {
			start := i * chunkSize
			end := (i + 1) * chunkSize
			if i == expectedCount-1 {
				end = len(samples)
			}
			clips = append(clips, samples[start:end])
		}
		return clips
	}

	lastIdx := 0
	accumChars := 0
	for i, text := range childTexts {
		if i == expectedCount-1 {
			clips = append(clips, samples[lastIdx:])
			break
		}
		accumChars += len([]rune(text))
		splitPoint := (accumChars * len(samples)) / totalChars
		clips = append(clips, samples[lastIdx:splitPoint])
		lastIdx = splitPoint
	}

	return clips
}
