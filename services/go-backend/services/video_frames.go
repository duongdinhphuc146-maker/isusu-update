package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
)

// FrameExtractionRequest defines the parameters for extracting frames.
type FrameExtractionRequest struct {
	ProjectID string `json:"project_id"`
	Mode      string `json:"mode"`       // "thumbnail" | "interval" | "keyframes"
	Interval  int    `json:"interval"`   // seconds between frames (for "interval" mode)
	MaxFrames int    `json:"max_frames"` // cap total frames (default 100)
	CropX     int    `json:"crop_x"`
	CropY     int    `json:"crop_y"`
	CropW     int    `json:"crop_w"`
	CropH     int    `json:"crop_h"`
}

// FrameResult describes a single extracted frame file.
type FrameResult struct {
	Index     int     `json:"index"`
	Path      string  `json:"path"`
	Timestamp float64 `json:"timestamp"`
}

// HandleExtractFrames extracts frames from a project video using FFmpeg.
func HandleExtractFrames(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req FrameExtractionRequest
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.ProjectID == "" {
		httpx.WriteError(w, "project_id is required", http.StatusBadRequest)
		return
	}

	videoPath, err := findProjectVideo(req.ProjectID)
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusNotFound)
		return
	}

	wd, _ := os.Getwd()
	framesDir := filepath.Join(wd, "projects", req.ProjectID, "frames")
	_ = os.MkdirAll(framesDir, 0755)

	if req.MaxFrames <= 0 {
		req.MaxFrames = 100
	}

	var frames []FrameResult
	var extractErr error

	switch req.Mode {
	case "thumbnail":
		frames, extractErr = extractThumbnail(videoPath, framesDir, req)
	case "keyframes":
		frames, extractErr = extractKeyframes(videoPath, framesDir, req)
	default: // "interval" or default
		if req.Interval <= 0 {
			req.Interval = 5
		}
		frames, extractErr = extractByInterval(videoPath, framesDir, req)
	}

	if extractErr != nil {
		httpx.WriteError(w, "Frame extraction failed: "+extractErr.Error(), http.StatusInternalServerError)
		return
	}

	logx.Info("Frames extracted", "project", req.ProjectID, "count", len(frames), "mode", req.Mode)

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"frames":  frames,
		"count":   len(frames),
	})
}

// HandleVideoPreview returns a single thumbnail frame for preview.
func HandleVideoPreview(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	projectID := r.URL.Query().Get("project_id")
	timestamp := r.URL.Query().Get("timestamp")
	if projectID == "" {
		httpx.WriteError(w, "project_id is required", http.StatusBadRequest)
		return
	}

	videoPath, err := findProjectVideo(projectID)
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusNotFound)
		return
	}

	ts := "00:00:01"
	if timestamp != "" {
		ts = timestamp
	}

	wd, _ := os.Getwd()
	previewPath := filepath.Join(wd, "projects", projectID, "preview_thumb.jpg")

	args := buildFFmpegArgs("-ss", ts, "-i", videoPath, "-vframes", "1", "-q:v", "2", "-y", previewPath)
	cmd := exec.Command("ffmpeg", args...)
	if err := cmd.Run(); err != nil {
		httpx.WriteError(w, "Preview generation failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"path":    "/projects/" + projectID + "/preview_thumb.jpg",
	})
}

// ProbeVideo uses FFprobe to extract video metadata.
func ProbeVideo(videoPath string) (*VideoInfoResponse, error) {
	cmd := exec.Command("ffprobe",
		"-v", "error",
		"-show_entries", "format=duration,size:stream=width,height,r_frame_rate,codec_name,codec_type",
		"-of", "json",
		videoPath,
	)

	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w", err)
	}

	var probe struct {
		Format struct {
			Duration string `json:"duration"`
			Size     string `json:"size"`
		} `json:"format"`
		Streams []struct {
			Width     int    `json:"width"`
			Height    int    `json:"height"`
			RFrameRate string `json:"r_frame_rate"`
			CodecName string `json:"codec_name"`
			CodecType string `json:"codec_type"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(out, &probe); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	info := &VideoInfoResponse{}
	info.Duration, _ = strconv.ParseFloat(probe.Format.Duration, 64)
	info.FileSize, _ = strconv.ParseInt(probe.Format.Size, 10, 64)

	for _, s := range probe.Streams {
		if s.CodecType == "video" && info.Width == 0 {
			info.Width = s.Width
			info.Height = s.Height
			info.Fps = s.RFrameRate
			info.Codec = s.CodecName
		}
		if s.CodecType == "audio" && info.AudioCodec == "" {
			info.AudioCodec = s.CodecName
		}
	}

	return info, nil
}

func extractThumbnail(videoPath, framesDir string, req FrameExtractionRequest) ([]FrameResult, error) {
	outPath := filepath.Join(framesDir, "thumb_0001.jpg")
	args := buildFFmpegArgs("-ss", "1", "-i", videoPath, "-vframes", "1", "-q:v", "2")
	args = appendCropFilter(args, req)
	args = append(args, "-y", outPath)

	cmd := exec.Command("ffmpeg", args...)
	if err := cmd.Run(); err != nil {
		return nil, err
	}
	return []FrameResult{{Index: 0, Path: relFramePath(outPath, req.ProjectID), Timestamp: 1.0}}, nil
}

func extractKeyframes(videoPath, framesDir string, req FrameExtractionRequest) ([]FrameResult, error) {
	pattern := filepath.Join(framesDir, "keyframe_%04d.jpg")
	filter := "select='eq(pict_type,I)'"
	if req.CropW > 0 && req.CropH > 0 {
		filter = fmt.Sprintf("select='eq(pict_type,I)',crop=%d:%d:%d:%d", req.CropW, req.CropH, req.CropX, req.CropY)
	}

	args := buildFFmpegArgs("-i", videoPath, "-vf", filter, "-vsync", "vfr", "-q:v", "3", "-y", pattern)

	cmd := exec.Command("ffmpeg", args...)
	if err := cmd.Run(); err != nil {
		return nil, err
	}

	return collectFrameResults(framesDir, "keyframe_", req)
}

func extractByInterval(videoPath, framesDir string, req FrameExtractionRequest) ([]FrameResult, error) {
	pattern := filepath.Join(framesDir, "frame_%04d.jpg")
	fpsFilter := fmt.Sprintf("fps=1/%d", req.Interval)
	if req.CropW > 0 && req.CropH > 0 {
		fpsFilter = fmt.Sprintf("fps=1/%d,crop=%d:%d:%d:%d", req.Interval, req.CropW, req.CropH, req.CropX, req.CropY)
	}

	args := buildFFmpegArgs("-i", videoPath, "-vf", fpsFilter, "-q:v", "3", "-y", pattern)
	cmd := exec.Command("ffmpeg", args...)
	if err := cmd.Run(); err != nil {
		return nil, err
	}

	return collectFrameResults(framesDir, "frame_", req)
}

func collectFrameResults(framesDir, prefix string, req FrameExtractionRequest) ([]FrameResult, error) {
	entries, err := os.ReadDir(framesDir)
	if err != nil {
		return nil, err
	}

	var results []FrameResult
	idx := 0
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), prefix) {
			continue
		}
		ts := float64(idx * req.Interval)
		fullPath := filepath.Join(framesDir, e.Name())
		results = append(results, FrameResult{
			Index:     idx,
			Path:      relFramePath(fullPath, req.ProjectID),
			Timestamp: ts,
		})
		idx++
		if idx >= req.MaxFrames {
			break
		}
	}

	return results, nil
}

func buildFFmpegArgs(args ...string) []string {
	hw := GetHwaccelSetting()
	var result []string
	if hw != "" && hw != "none" {
		result = append(result, "-hwaccel", hw)
	}
	return append(result, args...)
}

func appendCropFilter(args []string, req FrameExtractionRequest) []string {
	if req.CropW > 0 && req.CropH > 0 {
		crop := fmt.Sprintf("crop=%d:%d:%d:%d", req.CropW, req.CropH, req.CropX, req.CropY)
		return append(args, "-vf", crop)
	}
	return args
}

func relFramePath(absPath string, projectID string) string {
	idx := strings.Index(absPath, "projects")
	if idx >= 0 {
		return "/" + strings.ReplaceAll(absPath[idx:], "\\", "/")
	}
	return "/projects/" + projectID + "/frames/" + filepath.Base(absPath)
}
