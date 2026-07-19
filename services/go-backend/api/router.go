package api

import (
	"fmt"
	"go-backend/services/go-backend/internal/config"
	"go-backend/services/go-backend/middleware"
	"go-backend/services/go-backend/services"
	"net/http"
	"os"
	"path/filepath"
)

func NewRouter() http.Handler {
	mux := http.NewServeMux()

	wd, _ := os.Getwd()
	// Serve static files from cache and projects
	mux.Handle("/cache/", http.StripPrefix("/cache/", http.FileServer(http.Dir(filepath.Join(wd, "cache")))))
	mux.Handle("/projects/", http.StripPrefix("/projects/", http.FileServer(http.Dir(filepath.Join(wd, "projects")))))


	// Public Health / Info check
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		response := fmt.Sprintf(`{"status": "healthy", "version": "%s", "api_version": "%s", "build_date": "%s"}`, 
			config.AppVersion, config.APIVersion, config.BuildDate)
		w.Write([]byte(response))
	})

	// Authenticate Route to obtain JWT tokens
	mux.HandleFunc("/api/auth/token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		if r.Method == "OPTIONS" {
			return
		}

		apiKey := r.Header.Get("X-API-Key")
		if apiKey != middleware.LocalApiKey {
			http.Error(w, `{"error": "Invalid API Key"}`, http.StatusUnauthorized)
			return
		}

		accessToken, refreshToken, err := middleware.GenerateJWT()
		if err != nil {
			http.Error(w, `{"error": "Failed to generate tokens"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"access_token": "` + accessToken + `", "refresh_token": "` + refreshToken + `"}`))
	})

	// Services endpoints
	mux.HandleFunc("/api/tts", services.HandleTTS)
	mux.HandleFunc("/api/vieneu/tts", services.HandleVieNeuTTS)
	mux.HandleFunc("/api/vieneu/status", services.HandleVieNeuStatus)
	mux.HandleFunc("/api/vieneu/setup", services.HandleVieNeuSetup)
	mux.HandleFunc("/api/voices", services.HandleVoices)
	mux.HandleFunc("/api/srt-to-speak", services.HandleSRTToSpeak)
	mux.HandleFunc("/api/srt-to-speak/status", services.HandleSRTStatus)
	mux.HandleFunc("/api/cache/clean", services.HandleCleanCache)
	mux.HandleFunc("/api/cache/stats", services.HandleCacheStats)
	mux.HandleFunc("/api/system/info", services.HandleSystemInfo)
	mux.HandleFunc("/api/system/gpu", services.HandleGPU)
	mux.HandleFunc("/api/system/generated-files", services.HandleListGeneratedFiles)
	mux.HandleFunc("/api/system/memory", services.HandleMemoryStatus)
	mux.HandleFunc("/api/system/memory/optimize", services.HandleMemoryOptimize)
	mux.HandleFunc("/api/system/memory/config", services.HandleMemoryConfig)
	mux.HandleFunc("/api/stt", services.HandleSTT)
	mux.HandleFunc("/api/stt/status", services.HandleSTTStatus)
	mux.HandleFunc("/api/stt/export", services.HandleExportTranscript)

	// Translate endpoints
	mux.HandleFunc("/api/translate", services.HandleTranslate)
	mux.HandleFunc("/api/translate/status", services.HandleTranslateStatus)
	mux.HandleFunc("/api/translate/export", services.HandleTranslateExport)
	mux.HandleFunc("/api/translate/providers", services.HandleListProviders)
	mux.HandleFunc("/api/translate/capture/start", services.HandleCaptureStart)
	mux.HandleFunc("/api/translate/capture/stop", services.HandleCaptureStop)
	mux.HandleFunc("/api/translate/sessions", services.HandleListSessions)
	mux.HandleFunc("/api/translate/sessions/delete", services.HandleDeleteSession)

	// OCR endpoints
	mux.HandleFunc("/api/ocr", services.HandleOCR)
	mux.HandleFunc("/api/ocr/capture/start", services.HandleOCRCaptureStart)
	mux.HandleFunc("/api/ocr/capture/stop", services.HandleOCRCaptureStop)
	mux.HandleFunc("/api/ocr/sessions", services.HandleOCRListSessions)
	mux.HandleFunc("/api/ocr/sessions/delete", services.HandleOCRDeleteSession)

	// Video endpoints (ViDub Pro Phase 1)
	mux.HandleFunc("/api/video/upload", services.HandleVideoUpload)
	mux.HandleFunc("/api/video/info", services.HandleVideoInfo)
	mux.HandleFunc("/api/video/list", services.HandleVideoList)
	mux.HandleFunc("/api/video/frames", services.HandleExtractFrames)
	mux.HandleFunc("/api/video/preview", services.HandleVideoPreview)
	mux.HandleFunc("/api/video/render", services.HandleVideoRender)
	mux.HandleFunc("/api/video/ocr-pipeline", services.HandleVideoOCRPipeline)
	mux.HandleFunc("/api/video/ocr-status", services.HandleVideoOCRStatus)

	// Pipeline endpoints (ViDub Pro Phase 3)
	mux.HandleFunc("/api/pipeline/start", services.HandlePipelineStart)
	mux.HandleFunc("/api/pipeline/status", services.HandlePipelineStatus)

	// Render endpoints (ViDub Pro Phase 5)
	mux.HandleFunc("/api/render/presets", services.HandleRenderPresets)

	// Batch endpoints (ViDub Pro Phase 6)
	mux.HandleFunc("/api/batch/add", services.HandleBatchAdd)
	mux.HandleFunc("/api/batch/status", services.HandleBatchStatus)



	// Wrap Mux with Security, Auth, and Logger middlewares
	var handler http.Handler = mux
	handler = middleware.AuthMiddleware(handler)
	handler = middleware.RateLimiterMiddleware(handler)
	handler = middleware.CSRFMiddleware(handler)
	handler = middleware.RequestLoggerMiddleware(handler)

	return handler
}
