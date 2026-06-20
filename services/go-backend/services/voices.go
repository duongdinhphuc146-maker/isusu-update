package services

import (
	"net/http"
	"os"
	"path/filepath"
)

func HandleVoices(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	if r.Method == "OPTIONS" {
		return
	}

	wd, _ := os.Getwd()
	candidates := []string{
		"Voice.json",
		filepath.Join(wd, "Voice.json"),
		filepath.Join(wd, "services", "capcut-tts-api", "Voice.json"),
		filepath.Join(wd, "cache", "capcut-tts-api", "Voice.json"),
		filepath.Join(filepath.Dir(wd), "capcut-tts-api", "Voice.json"),
		filepath.Join("..", "capcut-tts-api", "Voice.json"),
	}

	var voicePath string
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			voicePath = c
			break
		}
	}

	if voicePath == "" {
		http.Error(w, "Voice file not found in any standard path", http.StatusNotFound)
		return
	}

	data, err := os.ReadFile(voicePath)
	if err != nil {
		http.Error(w, "Failed to read voice file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}
