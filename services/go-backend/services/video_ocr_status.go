package services

import (
	"go-backend/services/go-backend/internal/httpx"
	"net/http"
)

// HandleVideoOCRStatus kiểm tra trạng thái tiến trình OCR của một video project
func HandleVideoOCRStatus(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	projectID := r.URL.Query().Get("project_id")
	if projectID == "" {
		httpx.WriteError(w, "project_id is required", http.StatusBadRequest)
		return
	}

	val, ok := ActiveVideoOCRTasks.Load(projectID)
	if !ok {
		httpx.WriteJSON(w, map[string]interface{}{
			"status":           "not_started",
			"progress_percent": 0,
			"logs":             []string{},
			"srt_result":       "",
		})
		return
	}

	p := val.(*VideoOCRProgress)
	httpx.WriteJSON(w, p)
}
