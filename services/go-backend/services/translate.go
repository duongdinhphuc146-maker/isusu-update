package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
)

// HandleTranslate handles the POST translation request.
func HandleTranslate(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req TranslateRequest
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.SRTText == "" {
		httpx.WriteError(w, "SRT text is required", http.StatusBadRequest)
		return
	}
	if req.TargetLang == "" {
		httpx.WriteError(w, "Target language is required", http.StatusBadRequest)
		return
	}
	if req.Provider == "" {
		httpx.WriteError(w, "Provider is required", http.StatusBadRequest)
		return
	}

	segments := ParseSRT(req.SRTText)
	if len(segments) == 0 {
		httpx.WriteError(w, "No valid SRT segments found", http.StatusBadRequest)
		return
	}

	taskId := req.TaskId
	if req.Stage == "dub" && taskId != "" {
		// Resume existing task for dubbing stage
		val, exists := InFlightTranslateTasks.Load(taskId)
		if exists {
			p, ok := val.(*TranslateTaskProgress)
			if ok {
				p.Status = "pending"
				p.Progress = 20
				p.Error = ""
				if p.CharacterMap == nil {
					projectDir := fmt.Sprintf("projects/dialogue_%s", taskId)
					if cmap, err := LoadCharacterMap(projectDir); err == nil {
						p.CharacterMap = cmap
					}
				}
				if p.CharacterMap != nil {
					voiceMap := make(map[string]CharacterVoice)
					for _, cv := range req.CharacterVoices {
						voiceMap[cv.ID] = cv
					}
					for i, char := range p.CharacterMap.Characters {
						if cv, exists := voiceMap[char.ID]; exists {
							p.CharacterMap.Characters[i].VoiceType = cv.VoiceType
							p.CharacterMap.Characters[i].ResourceID = cv.ResourceID
						}
					}
				}
				InFlightTranslateTasks.Store(taskId, p)
			}
		}
	} else {
		// New task
		taskId = uuid.New().String()
		progress := &TranslateTaskProgress{
			TaskId:          taskId,
			Status:          "pending",
			Progress:        0,
			TotalChunks:     0,
			CompletedChunks: 0,
		}
		InFlightTranslateTasks.Store(taskId, progress)
	}

	// Launch background worker
	go TranslateWorker(taskId, req, segments)

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"task_id": taskId,
	})
}

// ProviderInfo defines details about a translation provider.
type ProviderInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Available  bool   `json:"available"`
	HasSession bool   `json:"has_session"`
}

// HandleListProviders lists the available translation providers.
func HandleListProviders(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	providers := []ProviderInfo{
		{ID: "gemini-api", Name: "Gemini Direct API", Available: os.Getenv("GEMINI_API_KEY") != "", HasSession: false},
		{ID: "openai-api", Name: "OpenAI Direct API", Available: os.Getenv("OPENAI_API_KEY") != "", HasSession: false},
		{ID: "chatgpt-api", Name: "ChatGPT Direct API", Available: os.Getenv("CHATGPT_API_KEY") != "" || os.Getenv("OPENAI_API_KEY") != "", HasSession: false},
	}

	// Fetch bridge sessions to add browser session options
	bridgeURL := fmt.Sprintf("%s/sessions", getBridgeURL())
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(bridgeURL)
	if err == nil {
		defer resp.Body.Close()
		var sessions []struct {
			Provider   string `json:"provider"`
			CapturedAt string `json:"capturedAt"`
			Status     string `json:"status"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&sessions); err == nil {
			sessionMap := make(map[string]bool)
			for _, s := range sessions {
				if s.Status == "valid" {
					sessionMap[s.Provider] = true
				}
			}

			sessionProviders := []struct {
				ID   string
				Name string
			}{
				{"gemini", "Gemini Browser Session"},
				{"chatgpt", "ChatGPT Browser Session"},
				{"qwen", "Qwen Browser Session"},
				{"minimax", "Minimax Browser Session"},
				{"aistudio", "Google AI Studio Browser Session"},
				{"z-ai", "Z.ai Browser Session"},
			}

			for _, sp := range sessionProviders {
				hasSession := sessionMap[sp.ID]
				providers = append(providers, ProviderInfo{
					ID:         sp.ID + "-session",
					Name:       sp.Name,
					Available:  hasSession,
					HasSession: hasSession,
				})
			}
		}
	} else {
		logx.Info("Bridge is not running, session providers will be unavailable", "error", err.Error())
	}

	httpx.WriteJSON(w, providers)
}
