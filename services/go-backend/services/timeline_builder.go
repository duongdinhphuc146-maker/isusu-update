package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type TimelineEvent struct {
	StartSec  float64 `json:"start_sec"`
	EndSec    float64 `json:"end_sec"`
	AudioPath string  `json:"audio_path,omitempty"`
	IsSilence bool    `json:"is_silence"`
}

type Timeline struct {
	Events []TimelineEvent `json:"events"`
}

// BuildTimeline aligns audio clips according to timing metadata
func BuildTimeline(merged []MergedSegment, splitClipPaths map[int]string) Timeline {
	var events []TimelineEvent
	currentTime := 0.0

	// Split clips should map original child ID -> file path.
	// We iterate through merged blocks to align them.
	for _, m := range merged {
		// Gap before speech block
		if m.StartSec > currentTime {
			events = append(events, TimelineEvent{
				StartSec:  currentTime,
				EndSec:    m.StartSec,
				IsSilence: true,
			})
			currentTime = m.StartSec
		}

		// Add speech sub-clips sequentially
		for _, childID := range m.ChildIDs {
			path, ok := splitClipPaths[childID]
			if !ok {
				continue
			}

			// We need to calculate child timings inside merged
			// Find timing from MergedSegment
			var childStart = m.StartSec
			var childEnd = m.EndSec
			for _, t := range m.Timings {
				if t.Index == childID {
					childStart = m.StartSec + t.StartOffset
					childEnd = m.StartSec + t.EndOffset
					break
				}
			}

			if childStart > currentTime {
				// Inter-segment gap
				events = append(events, TimelineEvent{
					StartSec:  currentTime,
					EndSec:    childStart,
					IsSilence: true,
				})
			}

			events = append(events, TimelineEvent{
				StartSec:  childStart,
				EndSec:    childEnd,
				AudioPath: path,
				IsSilence: false,
			})
			currentTime = childEnd
		}
		currentTime = m.EndSec
	}

	return Timeline{Events: events}
}

func GetAudioDuration(path string) float64 {
	cmd := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path)
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	var dur float64
	_, _ = fmt.Sscanf(strings.TrimSpace(string(out)), "%f", &dur)
	return dur
}

// RenderTimeline uses FFmpeg to concatenate audio clips and silence pads into a final output
func RenderTimeline(timeline Timeline, projectDir string, outputPath string) error {
	_ = os.MkdirAll(projectDir, 0755)

	// Persist timeline JSON for audit logs
	tJSON, _ := json.MarshalIndent(timeline, "", "  ")
	_ = os.WriteFile(filepath.Join(projectDir, "timeline.json"), tJSON, 0644)

	var args []string
	args = append(args, "-y")

	hw := GetHwaccelSetting()
	if hw != "" && hw != "none" {
		args = append(args, "-hwaccel", hw)
	}

	var filterComplex = ""
	var inputIdx = 0

	for _, ev := range timeline.Events {
		if ev.IsSilence || ev.AudioPath == "" {
			continue
		}
		args = append(args, "-i", ev.AudioPath)
		
		actDur := GetAudioDuration(ev.AudioPath)
		subDur := ev.EndSec - ev.StartSec
		tempo := 1.0
		if actDur > subDur && subDur > 0 {
			tempo = actDur / subDur
		}

		delayMs := int(ev.StartSec * 1000)
		
		// Chain atempo filters if tempo is greater than 2.0
		var tempoFilters []string
		remaining := tempo
		for remaining > 2.0 {
			tempoFilters = append(tempoFilters, "atempo=2.0")
			remaining /= 2.0
		}
		if remaining > 1.01 {
			tempoFilters = append(tempoFilters, fmt.Sprintf("atempo=%.2f", remaining))
		}

		filterStr := ""
		if len(tempoFilters) > 0 {
			filterStr = strings.Join(tempoFilters, ",") + ","
		}

		// Apply atrim to guarantee the segment never overflows into next events
		if subDur > 0 {
			filterComplex += fmt.Sprintf("[%d]%satrim=duration=%.3f,adelay=%d|%d[a%d];", inputIdx, filterStr, subDur, delayMs, delayMs, inputIdx)
		} else {
			filterComplex += fmt.Sprintf("[%d]%sadelay=%d|%d[a%d];", inputIdx, filterStr, delayMs, delayMs, inputIdx)
		}
		inputIdx++
	}

	if inputIdx == 0 {
		return fmt.Errorf("no audio inputs to render")
	}

	// Mix all delayed clips
	var mixInputs = ""
	for i := 0; i < inputIdx; i++ {
		mixInputs += fmt.Sprintf("[a%d]", i)
	}
	filterComplex += fmt.Sprintf("%samix=inputs=%d:normalize=0[out]", mixInputs, inputIdx)

	args = append(args, "-filter_complex", filterComplex, "-map", "[out]", "-ac", "1", outputPath)

	cmd := exec.Command("ffmpeg", args...)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg render failed: %w", err)
	}

	return nil
}
