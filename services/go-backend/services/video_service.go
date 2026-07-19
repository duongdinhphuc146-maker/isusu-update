package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
)

// VideoUploadResponse is returned after a successful video upload.
type VideoUploadResponse struct {
	Success   bool   `json:"success"`
	ProjectID string `json:"project_id"`
	VideoPath string `json:"video_path"`
	FileName  string `json:"file_name"`
	FileSize  int64  `json:"file_size"`
}

// VideoInfoResponse contains metadata about an uploaded video.
type VideoInfoResponse struct {
	Duration   float64 `json:"duration"`
	Width      int     `json:"width"`
	Height     int     `json:"height"`
	Fps        string  `json:"fps"`
	Codec      string  `json:"codec"`
	AudioCodec string  `json:"audio_codec"`
	FileSize   int64   `json:"file_size"`
}

// HandleVideoUpload receives a video file via multipart upload
// and stores it in the project sandbox directory.
func HandleVideoUpload(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Limit to 4GB
	r.Body = http.MaxBytesReader(w, r.Body, 4<<30)

	file, header, err := r.FormFile("video")
	if err != nil {
		httpx.WriteError(w, "Failed to read video file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	projectID := r.FormValue("project_id")
	if projectID == "" {
		projectID = uuid.New().String()
	}

	wd, _ := os.Getwd()
	projectDir := filepath.Join(wd, "projects", projectID)
	assetsDir := filepath.Join(projectDir, "assets")
	_ = os.MkdirAll(assetsDir, 0755)

	// Sanitize and save file
	safeName := sanitizeFilename(header.Filename)
	destPath := filepath.Join(assetsDir, safeName)
	dest, err := os.Create(destPath)
	if err != nil {
		httpx.WriteError(w, "Failed to create file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer dest.Close()

	written, err := io.Copy(dest, file)
	if err != nil {
		httpx.WriteError(w, "Failed to save video: "+err.Error(), http.StatusInternalServerError)
		return
	}

	logx.Info("Video uploaded", "project", projectID, "file", safeName, "size", written)

	// Save project metadata
	saveProjectMeta(projectDir, projectID, safeName)

	httpx.WriteJSON(w, VideoUploadResponse{
		Success:   true,
		ProjectID: projectID,
		VideoPath: "/projects/" + projectID + "/assets/" + safeName,
		FileName:  safeName,
		FileSize:  written,
	})
}

// HandleVideoInfo returns FFprobe metadata for a project video.
func HandleVideoInfo(w http.ResponseWriter, r *http.Request) {
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

	videoPath, err := findProjectVideo(projectID)
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusNotFound)
		return
	}

	info, err := ProbeVideo(videoPath)
	if err != nil {
		httpx.WriteError(w, "Failed to probe video: "+err.Error(), http.StatusInternalServerError)
		return
	}

	httpx.WriteJSON(w, info)
}

// HandleVideoList returns all video projects with metadata.
func HandleVideoList(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	wd, _ := os.Getwd()
	projectsDir := filepath.Join(wd, "projects")

	type ProjectEntry struct {
		ID        string `json:"id"`
		VideoFile string `json:"video_file"`
		CreatedAt string `json:"created_at"`
	}

	var projects []ProjectEntry
	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		httpx.WriteJSON(w, projects)
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		metaPath := filepath.Join(projectsDir, entry.Name(), "project_meta.json")
		data, err := os.ReadFile(metaPath)
		if err != nil {
			continue
		}
		var meta map[string]string
		if json.Unmarshal(data, &meta) == nil {
			projects = append(projects, ProjectEntry{
				ID:        entry.Name(),
				VideoFile: meta["video_file"],
				CreatedAt: meta["created_at"],
			})
		}
	}

	httpx.WriteJSON(w, projects)
}

func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, " ", "_")
	safe := strings.Map(func(r rune) rune {
		if r == '.' || r == '-' || r == '_' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return '_'
	}, name)
	return safe
}

func saveProjectMeta(projectDir, projectID, videoFile string) {
	meta := map[string]string{
		"id":         projectID,
		"video_file": videoFile,
		"created_at": time.Now().Format(time.RFC3339),
	}
	data, _ := json.MarshalIndent(meta, "", "  ")
	_ = os.WriteFile(filepath.Join(projectDir, "project_meta.json"), data, 0644)
}

func findProjectVideo(projectID string) (string, error) {
	wd, _ := os.Getwd()
	assetsDir := filepath.Join(wd, "projects", projectID, "assets")
	entries, err := os.ReadDir(assetsDir)
	if err != nil {
		return "", fmt.Errorf("project not found: %s", projectID)
	}
	videoExts := []string{".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}
	for _, e := range entries {
		ext := strings.ToLower(filepath.Ext(e.Name()))
		for _, ve := range videoExts {
			if ext == ve {
				return filepath.Join(assetsDir, e.Name()), nil
			}
		}
	}
	return "", fmt.Errorf("no video file found in project %s", projectID)
}
