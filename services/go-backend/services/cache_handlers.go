package services

import (
	"net/http"
	"os"
	"path/filepath"
	"go-backend/services/go-backend/internal/httpx"
)

// HandleCleanCache cleans both TTS audio cache and translation cache.
func HandleCleanCache(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := cleanCacheOlderThan(7)
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Also clear translation cache directory completely
	wd, _ := os.Getwd()
	transDir := filepath.Join(wd, "cache", "translations")
	files, err := os.ReadDir(transDir)
	if err == nil {
		for _, f := range files {
			if !f.IsDir() {
				_ = os.Remove(filepath.Join(transDir, f.Name()))
			}
		}
	}

	httpx.WriteJSON(w, map[string]interface{}{"success": true, "message": "Cache cleaned successfully"})
}

// HandleCacheStats returns stats about the cached files.
func HandleCacheStats(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	count, size, oldest, newest, err := getCacheStats()
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	httpx.WriteJSON(w, map[string]interface{}{
		"file_count":  count,
		"total_size":  size,
		"oldest_file": oldest,
		"newest_file": newest,
	})
}
