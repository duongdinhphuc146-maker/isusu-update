package services

import (
	"encoding/json"
	"go-backend/services/go-backend/internal/httpx"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

func HandleSystemInfo(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	wd, _ := os.Getwd()
	cacheDir := filepath.Join(wd, "cache")
	projectsDir := filepath.Join(wd, "projects")

	var cacheFiles int
	var totalBytes int64

	_ = filepath.Walk(cacheDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			cacheFiles++
			totalBytes += info.Size()
		}
		return nil
	})

	var projectsCount int
	files, err := os.ReadDir(projectsDir)
	if err == nil {
		for _, f := range files {
			if f.IsDir() {
				projectsCount++
				_ = filepath.Walk(filepath.Join(projectsDir, f.Name()), func(path string, info os.FileInfo, err error) error {
					if err == nil && !info.IsDir() {
						totalBytes += info.Size()
					}
					return nil
				})
			}
		}
	}

	httpx.WriteJSON(w, map[string]interface{}{
		"total_storage_bytes": totalBytes,
		"projects_count":      projectsCount,
		"cache_files":         cacheFiles,
	})
}

func HandleListGeneratedFiles(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	wd, _ := os.Getwd()
	cacheDir := filepath.Join(wd, "cache")
	_ = os.MkdirAll(cacheDir, 0755)

	files, err := os.ReadDir(cacheDir)
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	type GeneratedFile struct {
		Name         string `json:"name"`
		URL          string `json:"url"`
		Size         int64  `json:"size"`
		LastModified int64  `json:"last_modified"`
	}

	var list []GeneratedFile
	for _, f := range files {
		if !f.IsDir() {
			info, err := f.Info()
			if err != nil {
				continue
			}
			list = append(list, GeneratedFile{
				Name:         f.Name(),
				URL:          "http://127.0.0.1:5000/cache/" + f.Name(),
				Size:         info.Size(),
				LastModified: info.ModTime().Unix(),
			})
		}
	}

	for i := 0; i < len(list); i++ {
		for j := i + 1; j < len(list); j++ {
			if list[i].LastModified < list[j].LastModified {
				list[i], list[j] = list[j], list[i]
			}
		}
	}

	if len(list) > 5 {
		list = list[:5]
	}

	httpx.WriteJSON(w, list)
}

type SystemConfig struct {
	Hwaccel string `json:"hwaccel"`
}

var cachedHwaccel = "none"
var hwaccelMutex sync.Mutex
var hwaccelLoaded = false

func GetHwaccelSetting() string {
	hwaccelMutex.Lock()
	defer hwaccelMutex.Unlock()
	if hwaccelLoaded {
		return cachedHwaccel
	}
	wd, _ := os.Getwd()
	configPath := filepath.Join(wd, "projects", "system_config.json")
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err == nil {
			var config SystemConfig
			if json.Unmarshal(data, &config) == nil {
				cachedHwaccel = config.Hwaccel
			}
		}
	}
	hwaccelLoaded = true
	return cachedHwaccel
}

func SetHwaccelSetting(val string) {
	hwaccelMutex.Lock()
	defer hwaccelMutex.Unlock()
	cachedHwaccel = val
	hwaccelLoaded = true
	wd, _ := os.Getwd()
	_ = os.MkdirAll(filepath.Join(wd, "projects"), 0755)
	configPath := filepath.Join(wd, "projects", "system_config.json")
	config := SystemConfig{Hwaccel: val}
	data, _ := json.MarshalIndent(config, "", "  ")
	_ = os.WriteFile(configPath, data, 0644)
}

func HandleGPU(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method == "GET" {
		var gpus []string
		cmd := exec.Command("wmic", "path", "win32_VideoController", "get", "name")
		out, err := cmd.CombinedOutput()
		if err == nil {
			lines := strings.Split(string(out), "\r\n")
			if len(lines) <= 1 {
				lines = strings.Split(string(out), "\n")
			}
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" && line != "Name" && !strings.HasPrefix(line, "Name") {
					gpus = append(gpus, line)
				}
			}
		}
		httpx.WriteJSON(w, map[string]interface{}{
			"gpus":            gpus,
			"hwaccel_options": []string{"none", "auto", "cuda", "dxva2", "d3d11va", "qsv"},
			"current_hwaccel": GetHwaccelSetting(),
		})
		return
	}
	if r.Method == "POST" {
		var req struct {
			Hwaccel string `json:"hwaccel"`
		}
		if err := httpx.ParseJSON(r, &req); err != nil {
			httpx.WriteError(w, err.Error(), http.StatusBadRequest)
			return
		}
		SetHwaccelSetting(req.Hwaccel)
		httpx.WriteJSON(w, map[string]interface{}{"success": true, "hwaccel": req.Hwaccel})
		return
	}
	httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
}
