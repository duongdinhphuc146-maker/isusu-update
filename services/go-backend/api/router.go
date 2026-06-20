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
	// Serve static files from cache
	mux.Handle("/cache/", http.StripPrefix("/cache/", http.FileServer(http.Dir(filepath.Join(wd, "cache")))))


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
	mux.HandleFunc("/api/voices", services.HandleVoices)
	mux.HandleFunc("/api/srt-to-speak", services.HandleSRTToSpeak)
	mux.HandleFunc("/api/srt-to-speak/status", services.HandleSRTStatus)
	mux.HandleFunc("/api/cache/clean", services.HandleCleanCache)
	mux.HandleFunc("/api/cache/stats", services.HandleCacheStats)
	mux.HandleFunc("/api/system/info", services.HandleSystemInfo)
	mux.HandleFunc("/api/system/generated-files", services.HandleListGeneratedFiles)
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


	// Wrap Mux with Security, Auth, and Logger middlewares
	var handler http.Handler = mux
	handler = middleware.AuthMiddleware(handler)
	handler = middleware.RateLimiterMiddleware(handler)
	handler = middleware.CSRFMiddleware(handler)
	handler = middleware.RequestLoggerMiddleware(handler)

	return handler
}
