package services

import (
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type STTResponse struct {
	Text  string `json:"text,omitempty"`
	SRT   string `json:"srt,omitempty"`
	Error string `json:"error,omitempty"`
}

type SttTaskProgress struct {
	TaskId   string   `json:"task_id"`
	Status   string   `json:"status"` // "uploading", "converting", "processing", "succeed", "failed"
	Progress int      `json:"progress"` // 0-100
	Error    string   `json:"error,omitempty"`
	Text     string   `json:"text,omitempty"`
	SRT      string   `json:"srt,omitempty"`
	Logs     []string `json:"logs,omitempty"`
}

var InFlightSttTasks sync.Map // maps taskId (string) -> *SttTaskProgress

func HandleSTT(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method == "GET" {
		HandleSTTStatus(w, r)
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	logx.Info("Received speech-to-text request")

	// Parse Multipart Form
	err := r.ParseMultipartForm(4096 << 20) // limit 4GB
	if err != nil {
		logx.Error("Failed to parse form", err)
		httpx.WriteError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.WriteError(w, "Missing file parameter", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := map[string]bool{
		".mp3": true, ".wav": true, ".m4a": true, ".mp4": true, ".aac": true, ".flac": true, ".ogg": true,
		".ts": true, ".mkv": true, ".avi": true, ".mov": true, ".flv": true, ".webm": true,
	}
	if !allowed[ext] {
		httpx.WriteError(w, "Unsupported file format. Please upload a valid audio or video file.", http.StatusBadRequest)
		return
	}

	lang := r.FormValue("lang")
	if lang == "" {
		lang = r.URL.Query().Get("lang")
	}
	transLang := r.FormValue("trans_lang")
	if transLang == "" {
		transLang = r.URL.Query().Get("trans_lang")
	}

	taskId := uuid.New().String()
	progress := &SttTaskProgress{
		TaskId:   taskId,
		Status:   "uploading",
		Progress: 10,
		Logs:     []string{"[" + time.Now().Format("15:04:05") + "] Nhận được yêu cầu STT. Đang lưu tệp tạm thời..."},
	}
	InFlightSttTasks.Store(taskId, progress)

	// Copy file synchronously to avoid request lifetime issues
	tempDir := os.TempDir()
	tempInput, err := os.CreateTemp(tempDir, "stt_input_*"+ext)
	if err != nil {
		logx.Error("Failed to create temp input", err)
		httpx.WriteError(w, "Failed to create temp input file", http.StatusInternalServerError)
		return
	}
	tempInputPath := tempInput.Name()

	_, err = io.Copy(tempInput, file)
	tempInput.Close()
	if err != nil {
		os.Remove(tempInputPath)
		logx.Error("Failed to write temp input", err)
		httpx.WriteError(w, "Failed to save uploaded file", http.StatusInternalServerError)
		return
	}

	// Process asynchronously
	go func(taskId string, lang, transLang, ext, tempInputPath string) {
		defer os.Remove(tempInputPath)

		updateProgress := func(status string, p int, logMsg string, errStr string, text string, srt string) {
			progress.Status = status
			progress.Progress = p
			if logMsg != "" {
				formatted := "[" + time.Now().Format("15:04:05") + "] " + logMsg
				if len(progress.Logs) == 0 || progress.Logs[len(progress.Logs)-1] != formatted {
					progress.Logs = append(progress.Logs, formatted)
				}
			}
			if errStr != "" {
				progress.Logs = append(progress.Logs, "["+time.Now().Format("15:04:05")+"] LỖI: "+errStr)
			}
			progress.Error = errStr
			progress.Text = text
			progress.SRT = srt
			InFlightSttTasks.Store(taskId, progress)
		}

		text, srt, err := ProcessSTTInChunks(tempInputPath, ext, lang, transLang, updateProgress)
		if err != nil {
			logx.Error("STT chunk processing failed", err)
			updateProgress("failed", 0, "", "CapCut transcription failed: "+err.Error(), "", "")
			return
		}

		logx.Info("STT transcription task completed successfully", "taskId", taskId)
		updateProgress("succeed", 100, "Nhận dạng hoàn tất thành công!", "", text, srt)
	}(taskId, lang, transLang, ext, tempInputPath)

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"task_id": taskId,
	})
}

func HandleSTTStatus(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	taskId := r.URL.Query().Get("task_id")
	if taskId == "" {
		httpx.WriteError(w, "Missing task_id parameter", http.StatusBadRequest)
		return
	}

	progressVal, exists := InFlightSttTasks.Load(taskId)
	if !exists {
		httpx.WriteError(w, "STT task not found", http.StatusNotFound)
		return
	}

	httpx.WriteJSON(w, progressVal)
}
