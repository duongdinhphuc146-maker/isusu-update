package services

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"go-backend/services/go-backend/internal/httpx"
)

// HandlePipelineStart tiếp nhận yêu cầu chạy tự động hóa toàn bộ luồng
func HandlePipelineStart(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectID  string `json:"project_id"`
		Provider   string `json:"provider"`
		TargetLang string `json:"target_lang"`
		VoiceID    string `json:"voice_id"`
		ResourceID string `json:"resource_id"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.ProjectID == "" {
		httpx.WriteError(w, "project_id is required", http.StatusBadRequest)
		return
	}

	taskID := req.ProjectID
	stages := map[string]*PipelineStageProgress{
		"extract_frames": {Stage: "extract_frames", Status: "pending", Logs: []string{}},
		"ocr":            {Stage: "ocr", Status: "pending", Logs: []string{}},
		"translate":      {Stage: "translate", Status: "pending", Logs: []string{}},
		"dubbing":        {Stage: "dubbing", Status: "pending", Logs: []string{}},
		"render":         {Stage: "render", Status: "pending", Logs: []string{}},
	}

	pipelineProgress := &PipelineProgress{
		ProjectID: req.ProjectID,
		Status:    "pending",
		Stages:    stages,
	}
	ActivePipelines.Store(taskID, pipelineProgress)

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Minute)
		defer cancel()

		updateFunc := func(stage string, status string, percent int, logLine string) {
			val, ok := ActivePipelines.Load(taskID)
			if ok {
				p := val.(*PipelineProgress)
				p.Status = "processing"
				if sProgress, exists := p.Stages[stage]; exists {
					sProgress.Status = status
					sProgress.ProgressPercent = percent
					if logLine != "" {
						sProgress.Logs = append(sProgress.Logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), logLine))
					}
				}
				
				// Kiểm tra nếu bước cuối thành công
				if stage == "render" && status == "succeed" {
					p.Status = "succeed"
				}
				ActivePipelines.Store(taskID, p)
			}
		}

		err := RunOneClickPipeline(ctx, req.ProjectID, req.Provider, req.TargetLang, req.VoiceID, req.ResourceID, updateFunc)
		if err != nil {
			val, ok := ActivePipelines.Load(taskID)
			if ok {
				p := val.(*PipelineProgress)
				p.Status = "failed"
				ActivePipelines.Store(taskID, p)
			}
		}
	}()

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"task_id": taskID,
	})
}

// HandlePipelineStatus kiểm tra tiến độ của one-click automation pipeline
func HandlePipelineStatus(w http.ResponseWriter, r *http.Request) {
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

	val, ok := ActivePipelines.Load(projectID)
	if !ok {
		httpx.WriteJSON(w, map[string]interface{}{
			"status": "not_started",
			"stages": map[string]interface{}{},
		})
		return
	}

	p := val.(*PipelineProgress)
	httpx.WriteJSON(w, p)
}
