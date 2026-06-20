package services

import (
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

type SRTSegment struct {
	Index      int     `json:"index"`
	Start      string  `json:"start"`
	End        string  `json:"end"`
	DurationMs float64 `json:"duration_ms"`
	Text       string  `json:"text"`
	AudioURL   string  `json:"audio_url,omitempty"`
}

func ParseSRT(srtContent string) []SRTSegment {
	var segments []SRTSegment
	content := strings.ReplaceAll(srtContent, "\r\n", "\n")
	blocks := strings.Split(content, "\n\n")
	timeRegex := regexp.MustCompile(`(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})`)

	for _, block := range blocks {
		block = strings.TrimSpace(block)
		if block == "" {
			continue
		}
		lines := strings.Split(block, "\n")
		if len(lines) < 3 {
			continue
		}

		index, _ := strconv.Atoi(strings.TrimSpace(lines[0]))
		timeMatch := timeRegex.FindStringSubmatch(lines[1])
		if len(timeMatch) != 3 {
			continue
		}

		startStr := timeMatch[1]
		endStr := timeMatch[2]
		dur := parseSRTTime(endStr) - parseSRTTime(startStr)
		textLines := lines[2:]
		text := strings.Join(textLines, " ")

		segments = append(segments, SRTSegment{
			Index:      index,
			Start:      startStr,
			End:        endStr,
			DurationMs: dur,
			Text:       text,
		})
	}
	return segments
}

func parseSRTTime(tStr string) float64 {
	parts := strings.Split(tStr, ":")
	if len(parts) != 3 {
		return 0
	}
	h, _ := strconv.ParseFloat(parts[0], 64)
	m, _ := strconv.ParseFloat(parts[1], 64)
	secParts := strings.Split(parts[2], ",")
	s, _ := strconv.ParseFloat(secParts[0], 64)
	ms, _ := strconv.ParseFloat(secParts[1], 64)
	return (h * 3600 * 1000) + (m * 60 * 1000) + (s * 1000) + ms
}

type SRTRequest struct {
	SRTText    string `json:"srt_text"`
	Voice      string `json:"voice"`
	ResourceID string `json:"resource_id"`
	Rate       string `json:"rate,omitempty"`
}

func HandleSRTToSpeak(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SRTRequest
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, err.Error(), http.StatusBadRequest)
		return
	}

	rate := "1.0"
	if req.Rate != "" {
		rate = req.Rate
	}

	logx.Info("Received SRT-to-Speak request", "voice", req.Voice, "rate", rate)
	taskId := StartSRTToSpeakTask(req.SRTText, req.Voice, req.ResourceID, rate)

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"task_id": taskId,
	})
}

type ExportRequest struct {
	TaskId string `json:"task_id,omitempty"`
	Format string `json:"format"` // "txt" | "srt" | "json"
	Text   string `json:"text,omitempty"`
	SRT    string `json:"srt,omitempty"`
}

func HandleExportTranscript(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExportRequest
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, err.Error(), http.StatusBadRequest)
		return
	}

	var text, srt string
	if req.TaskId != "" {
		progressVal, exists := InFlightSttTasks.Load(req.TaskId)
		if !exists {
			httpx.WriteError(w, "Task ID not found", http.StatusNotFound)
			return
		}
		progress, ok := progressVal.(*SttTaskProgress)
		if !ok || progress.Status != "succeed" {
			httpx.WriteError(w, "Transcription task has not completed successfully", http.StatusBadRequest)
			return
		}
		text = progress.Text
		srt = progress.SRT
	} else {
		text = req.Text
		srt = req.SRT
	}

	w.Header().Set("Access-Control-Expose-Headers", "Content-Disposition")
	switch strings.ToLower(req.Format) {
	case "txt":
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="transcript.txt"`)
		w.Write([]byte(text))
	case "srt":
		w.Header().Set("Content-Type", "text/srt; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="transcript.srt"`)
		w.Write([]byte(srt))
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="transcript.json"`)
		httpx.WriteJSON(w, map[string]string{
			"text": text,
			"srt":  srt,
		})
	default:
		httpx.WriteError(w, "Invalid export format. Supported formats: txt, srt, json", http.StatusBadRequest)
	}
}
