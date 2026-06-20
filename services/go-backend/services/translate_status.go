package services

import (
	"net/http"
	"go-backend/services/go-backend/internal/httpx"
)

// HandleTranslateStatus handles polling for translation status.
func HandleTranslateStatus(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	taskId := r.URL.Query().Get("task_id")
	if taskId == "" {
		httpx.WriteError(w, "Missing task_id parameter", http.StatusBadRequest)
		return
	}

	progressVal, exists := InFlightTranslateTasks.Load(taskId)
	if !exists {
		httpx.WriteError(w, "Translate task not found", http.StatusNotFound)
		return
	}

	httpx.WriteJSON(w, progressVal)
}

// HandleTranslateExport handles downloading of the translated SRT file.
func HandleTranslateExport(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TaskId string `json:"task_id"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.TaskId == "" {
		httpx.WriteError(w, "task_id is required", http.StatusBadRequest)
		return
	}

	progressVal, exists := InFlightTranslateTasks.Load(req.TaskId)
	if !exists {
		httpx.WriteError(w, "Translate task not found", http.StatusNotFound)
		return
	}

	progress, ok := progressVal.(*TranslateTaskProgress)
	if !ok || progress.Status != "succeed" {
		httpx.WriteError(w, "Translation task has not completed successfully", http.StatusBadRequest)
		return
	}

	w.Header().Set("Access-Control-Expose-Headers", "Content-Disposition")
	w.Header().Set("Content-Type", "text/srt; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="translated.srt"`)
	_, _ = w.Write([]byte(progress.TranslatedSRT))
}
