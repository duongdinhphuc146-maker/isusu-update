package services

import (
	"context"
	"net/http"
	"sync"
	"time"

	"go-backend/services/go-backend/internal/httpx"
)

type BatchTask struct {
	ProjectID string `json:"project_id"`
	Status    string `json:"status"` // "pending", "processing", "succeed", "failed"
	Error     string `json:"error"`
}

type BatchQueue struct {
	Tasks []BatchTask `json:"tasks"`
}

var (
	batchMutex sync.Mutex
	batchQueue BatchQueue
	batchActive bool
)

// HandleBatchAdd thêm các project vào hàng đợi xử lý hàng loạt
func HandleBatchAdd(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectIDs []string `json:"project_ids"`
		Provider   string   `json:"provider"`
		TargetLang string   `json:"target_lang"`
		VoiceID    string   `json:"voice_id"`
		ResourceID string   `json:"resource_id"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	batchMutex.Lock()
	for _, id := range req.ProjectIDs {
		// Kiểm tra nếu chưa tồn tại trong queue
		exists := false
		for _, t := range batchQueue.Tasks {
			if t.ProjectID == id {
				exists = true
				break
			}
		}
		if !exists {
			batchQueue.Tasks = append(batchQueue.Tasks, BatchTask{
				ProjectID: id,
				Status:    "pending",
			})
		}
	}
	batchMutex.Unlock()

	// Kích hoạt worker xử lý hàng loạt
	if !batchActive {
		batchActive = true
		go runBatchWorker(req.Provider, req.TargetLang, req.VoiceID, req.ResourceID)
	}

	httpx.WriteJSON(w, map[string]interface{}{"success": true, "queue_size": len(batchQueue.Tasks)})
}

// HandleBatchStatus trả về danh sách trạng thái của queue xử lý hàng loạt
func HandleBatchStatus(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	batchMutex.Lock()
	defer batchMutex.Unlock()
	httpx.WriteJSON(w, batchQueue)
}

func runBatchWorker(provider, targetLang, voiceID, resourceID string) {
	for {
		var nextTask *BatchTask
		batchMutex.Lock()
		for i, t := range batchQueue.Tasks {
			if t.Status == "pending" {
				batchQueue.Tasks[i].Status = "processing"
				nextTask = &batchQueue.Tasks[i]
				break
			}
		}
		batchMutex.Unlock()

		if nextTask == nil {
			break
		}

		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
		
		// Hàm rỗng updateProgress phục vụ chạy pipeline ngầm không cần gửi socket/polling chi tiết
		dummyUpdate := func(stage, status string, percent int, logLine string) {}
		
		err := RunOneClickPipeline(ctx, nextTask.ProjectID, provider, targetLang, voiceID, resourceID, dummyUpdate)
		cancel()

		batchMutex.Lock()
		for i, t := range batchQueue.Tasks {
			if t.ProjectID == nextTask.ProjectID {
				if err != nil {
					batchQueue.Tasks[i].Status = "failed"
					batchQueue.Tasks[i].Error = err.Error()
				} else {
					batchQueue.Tasks[i].Status = "succeed"
				}
				break
			}
		}
		batchMutex.Unlock()
	}

	batchMutex.Lock()
	batchActive = false
	batchMutex.Unlock()
}
