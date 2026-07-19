package services

import (
	"strings"
)

type MergedSegment struct {
	ID          int               `json:"id"`
	Speaker     string            `json:"speaker"`
	Emotion     string            `json:"emotion"`
	Text        string            `json:"text"`
	ChildIDs    []int             `json:"child_ids"`
	StartSec    float64           `json:"start_sec"`
	EndSec      float64           `json:"end_sec"`
	DurationSec float64           `json:"duration_sec"`
	Timings     []SubSegmentTiming `json:"timings"` // Relative timings of children inside the merged segment
}

type SubSegmentTiming struct {
	Index       int     `json:"index"`
	StartOffset float64 `json:"start_offset"` // relative offset from parent StartSec
	EndOffset   float64 `json:"end_offset"`   // relative offset from parent StartSec
	DurationSec float64 `json:"duration_sec"`
}

func MergeSegments(segments []TranslatedSegment) []MergedSegment {
	var merged []MergedSegment
	n := len(segments)
	if n == 0 {
		return merged
	}

	// First parse timing boundaries
	// We need actual float64 seconds. Let's map them from TranslatedSegment. Start and End are timestamps.
	// Since we already calculated start_sec and end_sec during SRT parsing, let's look up original segment times.
	// However, TranslatedSegment only has Start and End string timestamps. Let's parse them to float64 seconds here.
	parseSec := func(tStr string) float64 {
		parts := strings.Split(tStr, ":")
		if len(parts) != 3 {
			return 0
		}
		h := parseVal(parts[0])
		m := parseVal(parts[1])
		secParts := strings.Split(parts[2], ",")
		s := parseVal(secParts[0])
		var ms float64
		if len(secParts) > 1 {
			ms = parseVal(secParts[1])
		}
		return (h * 3600) + (m * 60) + s + (ms / 1000.0)
	}

	var current MergedSegment
	hasCurrent := false

	for i := 0; i < n; i++ {
		seg := segments[i]
		segStart := parseSec(seg.Start)
		segEnd := parseSec(seg.End)
		segDur := segEnd - segStart

		if !hasCurrent {
			current = MergedSegment{
				ID:          seg.Index,
				Speaker:     seg.Speaker,
				Emotion:     seg.Emotion,
				Text:        seg.TranslatedText,
				ChildIDs:    []int{seg.Index},
				StartSec:    segStart,
				EndSec:      segEnd,
				DurationSec: segDur,
				Timings: []SubSegmentTiming{
					{
						Index:       seg.Index,
						StartOffset: 0.0,
						EndOffset:   segDur,
						DurationSec: segDur,
					},
				},
			}
			hasCurrent = true
			continue
		}

		// Check merge eligibility
		prevEnd := current.EndSec
		gap := segStart - prevEnd
		sameSpeaker := (seg.Speaker == current.Speaker) && (seg.Speaker != "" && seg.Speaker != "SPK_DEFAULT")
		sameEmotion := (seg.Emotion == current.Emotion)
		canMerge := sameSpeaker && sameEmotion && gap >= 0 && gap < 2.0

		if canMerge {
			// Map gap to punctuation pause
			punctuation := ""
			if gap >= 0.2 && gap < 0.6 {
				punctuation = ", "
			} else if gap >= 0.6 && gap < 1.2 {
				punctuation = ". "
			} else if gap >= 1.2 && gap < 2.0 {
				punctuation = "... "
			} else {
				punctuation = " "
			}

			// Concatenate text
			current.Text = strings.TrimSpace(current.Text) + punctuation + strings.TrimSpace(seg.TranslatedText)
			current.ChildIDs = append(current.ChildIDs, seg.Index)
			current.EndSec = segEnd
			current.DurationSec = current.EndSec - current.StartSec

			// Add relative timings
			startOffset := segStart - current.StartSec
			endOffset := segEnd - current.StartSec
			current.Timings = append(current.Timings, SubSegmentTiming{
				Index:       seg.Index,
				StartOffset: startOffset,
				EndOffset:   endOffset,
				DurationSec: segDur,
			})
		} else {
			merged = append(merged, current)
			current = MergedSegment{
				ID:          seg.Index,
				Speaker:     seg.Speaker,
				Emotion:     seg.Emotion,
				Text:        seg.TranslatedText,
				ChildIDs:    []int{seg.Index},
				StartSec:    segStart,
				EndSec:      segEnd,
				DurationSec: segDur,
				Timings: []SubSegmentTiming{
					{
						Index:       seg.Index,
						StartOffset: 0.0,
						EndOffset:   segDur,
						DurationSec: segDur,
					},
				},
			}
		}
	}

	if hasCurrent {
		merged = append(merged, current)
	}

	return merged
}

func parseVal(s string) float64 {
	var val float64
	s = strings.TrimSpace(s)
	_, _ = fmtSscanf(s, "%f", &val)
	return val
}

func fmtSscanf(s string, format string, a *float64) (int, error) {
	_ = format // suppress unused parameter warning
	// Simple float64 parser fallback to avoid complex fmt dependencies
	var v float64
	n, err := strings.NewReader(s), error(nil)
	_, err = fmtScanf(n, &v)
	if err == nil {
		*a = v
		return 1, nil
	}
	return 0, err
}

func fmtScanf(r *strings.Reader, v *float64) (int, error) {
	var accum float64
	var decimal float64 = 10.0
	var isDecimal bool
	var hasDigits bool

	for {
		b, err := r.ReadByte()
		if err != nil {
			break
		}
		if b >= '0' && b <= '9' {
			hasDigits = true
			if !isDecimal {
				accum = accum*10 + float64(b-'0')
			} else {
				accum = accum + float64(b-'0')/decimal
				decimal *= 10
			}
		} else if b == '.' || b == ',' {
			isDecimal = true
		} else {
			break
		}
	}
	if hasDigits {
		*v = accum
		return 1, nil
	}
	return 0, nil
}
