package services

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"go-backend/services/go-backend/internal/httpx"
)

// ActiveVideoOCRTasks lưu trạng thái các task OCR đang chạy
var ActiveVideoOCRTasks sync.Map

type VideoOCRProgress struct {
	Status          string   `json:"status"` // "pending", "processing", "succeed", "failed"
	ProgressPercent int      `json:"progress_percent"`
	Logs            []string `json:"logs"`
	SRTResult       string   `json:"srt_result"`
	Error           string   `json:"error"`
}

// HandleVideoOCRPipeline tiếp nhận request và kích hoạt tiến trình OCR bất đồng bộ
func HandleVideoOCRPipeline(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectID string `json:"project_id"`
		Provider  string `json:"provider"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.ProjectID == "" {
		httpx.WriteError(w, "project_id is required", http.StatusBadRequest)
		return
	}

	if req.Provider == "" {
		req.Provider = "z-ai-session"
	}

	taskID := req.ProjectID // Dùng luôn ProjectID làm task key
	progress := &VideoOCRProgress{
		Status:          "pending",
		ProgressPercent: 0,
		Logs:            []string{"Khởi tạo hàng đợi tác vụ OCR video..."},
	}
	ActiveVideoOCRTasks.Store(taskID, progress)

	// Chạy background pipeline
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		defer cancel()

		updateFunc := func(status string, percent int, logLine string, srt string) {
			val, ok := ActiveVideoOCRTasks.Load(taskID)
			if ok {
				p := val.(*VideoOCRProgress)
				p.Status = status
				p.ProgressPercent = percent
				if logLine != "" {
					p.Logs = append(p.Logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), logLine))
				}
				if srt != "" {
					p.SRTResult = srt
				}
				ActiveVideoOCRTasks.Store(taskID, p)
			}
		}

		_, err := RunVideoOCRPipeline(ctx, req.ProjectID, req.Provider, updateFunc)
		if err != nil {
			updateFunc("failed", 0, "Lỗi khi chạy OCR: "+err.Error(), "")
			val, ok := ActiveVideoOCRTasks.Load(taskID)
			if ok {
				p := val.(*VideoOCRProgress)
				p.Error = err.Error()
				ActiveVideoOCRTasks.Store(taskID, p)
			}
		}
	}()

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"task_id": taskID,
	})
}
