package services

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
)

// RenderRequest defines the parameters for final video rendering.
type RenderRequest struct {
	ProjectID      string `json:"project_id"`
	AudioPath      string `json:"audio_path"`       // relative path to dubbed audio
	SubtitlePath   string `json:"subtitle_path"`     // relative path to SRT file
	SubtitleMode   string `json:"subtitle_mode"`     // "burn" | "soft" | "none"
	OutputFormat   string `json:"output_format"`     // "mp4" | "mkv"
	Resolution     string `json:"resolution"`        // "source" | "1080p" | "720p"
	AudioOnly      bool   `json:"audio_only"`        // export audio track only
	KeepOrigAudio  bool   `json:"keep_original_audio"` // mix with original audio
	OrigAudioLevel float64 `json:"orig_audio_level"` // 0.0 - 1.0
}

// HandleVideoRender combines video, dubbed audio, and subtitles into final output.
func HandleVideoRender(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RenderRequest
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
	projectDir := filepath.Join(wd, "projects", req.ProjectID)
	exportsDir := filepath.Join(projectDir, "exports")
	_ = os.MkdirAll(exportsDir, 0755)

	ext := ".mp4"
	if req.OutputFormat == "mkv" {
		ext = ".mkv"
	}
	outputPath := filepath.Join(exportsDir, "output"+ext)

	if req.AudioOnly {
		err = renderAudioOnly(req, outputPath)
	} else {
		err = renderFullVideo(videoPath, req, projectDir, outputPath)
	}

	if err != nil {
		logx.Error("Video render failed", err, "project", req.ProjectID)
		httpx.WriteError(w, "Render failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	logx.Info("Video render completed", "project", req.ProjectID, "output", outputPath)

	httpx.WriteJSON(w, map[string]interface{}{
		"success":     true,
		"output_path": "/projects/" + req.ProjectID + "/exports/output" + ext,
	})
}

func renderFullVideo(videoPath string, req RenderRequest, projectDir, outputPath string) error {
	var args []string
	args = append(args, "-y")

	hw := GetHwaccelSetting()
	if hw != "" && hw != "none" {
		args = append(args, "-hwaccel", hw)
	}

	// Input: original video
	args = append(args, "-i", videoPath)

	// Input: dubbed audio (if provided)
	wd, _ := os.Getwd()
	hasAudio := false
	if req.AudioPath != "" {
		audioFullPath := filepath.Join(wd, req.AudioPath)
		if _, err := os.Stat(audioFullPath); err == nil {
			args = append(args, "-i", audioFullPath)
			hasAudio = true
		}
	}

	// Build filter complex for audio mixing
	if hasAudio && req.KeepOrigAudio {
		level := req.OrigAudioLevel
		if level <= 0 {
			level = 0.15
		}
		dubLevel := 1.0
		filter := fmt.Sprintf("[0:a]volume=%.2f[orig];[1:a]volume=%.2f[dub];[orig][dub]amix=inputs=2:duration=longest[aout]", level, dubLevel)
		args = append(args, "-filter_complex", filter, "-map", "0:v", "-map", "[aout]")
	} else if hasAudio {
		args = append(args, "-map", "0:v", "-map", "1:a")
	} else {
		args = append(args, "-map", "0:v", "-map", "0:a")
	}

	// Subtitle burn-in
	if req.SubtitleMode == "burn" && req.SubtitlePath != "" {
		subFullPath := filepath.Join(wd, req.SubtitlePath)
		if _, err := os.Stat(subFullPath); err == nil {
			// Escape path for FFmpeg subtitles filter
			escaped := escapeFFmpegPath(subFullPath)
			args = append(args, "-vf", fmt.Sprintf("subtitles='%s'", escaped))
		}
	} else if req.SubtitleMode == "soft" && req.SubtitlePath != "" {
		subFullPath := filepath.Join(wd, req.SubtitlePath)
		if _, err := os.Stat(subFullPath); err == nil {
			args = append(args, "-i", subFullPath, "-c:s", "mov_text")
		}
	}

	// Resolution scaling
	switch req.Resolution {
	case "1080p":
		args = append(args, "-vf", "scale=-2:1080")
	case "720p":
		args = append(args, "-vf", "scale=-2:720")
	}

	args = append(args, "-c:v", "libx264", "-preset", "medium", "-crf", "23")
	args = append(args, "-c:a", "aac", "-b:a", "192k")
	args = append(args, outputPath)

	cmd := exec.Command("ffmpeg", args...)
	cmd.Dir = projectDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg error: %w, output: %s", err, string(output))
	}
	return nil
}

func renderAudioOnly(req RenderRequest, outputPath string) error {
	wd, _ := os.Getwd()
	audioPath := filepath.Join(wd, req.AudioPath)
	if _, err := os.Stat(audioPath); err != nil {
		return fmt.Errorf("audio file not found: %s", req.AudioPath)
	}

	// Convert to MP3 output
	mp3Out := filepath.Join(filepath.Dir(outputPath), "output_audio.mp3")
	cmd := exec.Command("ffmpeg", "-y", "-i", audioPath, "-c:a", "libmp3lame", "-b:a", "192k", mp3Out)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("audio export failed: %w", err)
	}
	return nil
}

func escapeFFmpegPath(p string) string {
	p = filepath.ToSlash(p)
	p = fmt.Sprintf("%s", p)
	// Escape special characters for FFmpeg subtitle filter
	replacer := map[string]string{
		":":  "\\:",
		"\\": "/",
		"'":  "\\'",
	}
	for old, new := range replacer {
		result := ""
		for _, c := range p {
			if string(c) == old {
				result += new
			} else {
				result += string(c)
			}
		}
		p = result
	}
	return p
}
