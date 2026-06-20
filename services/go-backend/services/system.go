package services

import (
	"go-backend/services/go-backend/internal/httpx"
	"net/http"
	"os"
	"path/filepath"
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
