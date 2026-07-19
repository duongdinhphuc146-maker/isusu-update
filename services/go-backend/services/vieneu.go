package services

import (
	"fmt"
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

type VieNeuTTSResponse struct {
	Success  bool   `json:"success"`
	AudioURL string `json:"audio_url,omitempty"`
	Error    string `json:"error,omitempty"`
}

func HandleVieNeuTTS(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	logx.Info("Processing VieNeu-TTS request")

	// Max 50MB for voice clone audio files
	err := r.ParseMultipartForm(50 << 20)
	if err != nil {
		logx.Error("Failed to parse multipart form", err)
		httpx.WriteError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	text := r.FormValue("text")
	voice := r.FormValue("voice")
	mode := r.FormValue("mode")
	apiBase := r.FormValue("api_base")

	if text == "" {
		httpx.WriteError(w, "Text is required", http.StatusBadRequest)
		return
	}
	if mode == "" {
		mode = "remote"
	}
	if apiBase == "" {
		apiBase = "http://localhost:23333/v1"
	}
	if voice == "" {
		voice = "Trúc Ly"
	}

	wd, err := os.Getwd()
	if err != nil {
		httpx.WriteError(w, "Server directory error", http.StatusInternalServerError)
		return
	}

	var cloneAudioPath string
	file, header, err := r.FormFile("clone_audio")
	if err == nil {
		defer file.Close()
		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext != ".mp3" && ext != ".wav" && ext != ".m4a" && ext != ".ogg" {
			httpx.WriteError(w, "Invalid clone audio format. Must be mp3, wav, m4a, or ogg", http.StatusBadRequest)
			return
		}

		// Save clone reference audio to cache temporarily
		tempFilename := fmt.Sprintf("clone_ref_%s%s", uuid.New().String(), ext)
		cloneAudioPath = filepath.Join(wd, "cache", tempFilename)
		
		tempFile, err := os.Create(cloneAudioPath)
		if err != nil {
			httpx.WriteError(w, "Failed to create temp clone file", http.StatusInternalServerError)
			return
		}
		defer tempFile.Close()
		
		_, _ = io.Copy(tempFile, file)
		// Clean up the reference file after generation
		defer os.Remove(cloneAudioPath)
	}

	style := r.FormValue("style")
	if style == "" {
		style = "tu_nhien"
	}

	device := r.FormValue("device")
	if device == "" {
		device = "auto"
	}

	// Auto-detect and trigger setup if using local mode and packages are missing
	if mode == "local" {
		if !isPackageInstalled("vieneu") {
			setupMutex.Lock()
			if !setupRunning {
				setupRunning = true
				setupLogParts = []string{"[AUTO] Phát hiện thiếu môi trường VieNeu-TTS. Đang tự động tải và cấu hình..."}
				go runSetupProcess()
			}
			setupMutex.Unlock()

			httpx.WriteJSON(w, VieNeuTTSResponse{
				Success: false,
				Error:   "Mô hình VieNeu-TTS chưa được thiết lập trên máy tính này. Hệ thống đang tự động cài đặt và tải mô hình ở chế độ nền. Vui lòng đợi 2-3 phút rồi bấm 'Sinh giọng nói' lại.",
			})
			return
		}
	}

	// Output audio path
	outputFilename := fmt.Sprintf("vieneu_%s.wav", uuid.New().String())
	outputPath := filepath.Join(wd, "cache", outputFilename)

	// Check if a standalone compiled binary of vieneu_cli exists
	exePath := filepath.Join(wd, "services", "vieneu_cli.exe")
	var cmd *exec.Cmd
	if _, err := os.Stat(exePath); err == nil {
		cmdArgs := []string{
			"--text", text,
			"--mode", mode,
			"--output", outputPath,
			"--style", style,
			"--device", device,
		}
		if cloneAudioPath != "" {
			cmdArgs = append(cmdArgs, "--clone-audio", cloneAudioPath)
		} else {
			cmdArgs = append(cmdArgs, "--voice", voice)
		}
		if mode == "remote" {
			cmdArgs = append(cmdArgs, "--api-base", apiBase)
		}
		logx.Info("Executing VieNeu compiled binary: " + exePath)
		cmd = exec.Command(exePath, cmdArgs...)
	} else {
		// Build CLI arguments for Python
		args := []string{
			filepath.Join(wd, "services", "vieneu_cli.py"),
			"--text", text,
			"--mode", mode,
			"--output", outputPath,
			"--style", style,
			"--device", device,
		}
		if cloneAudioPath != "" {
			args = append(args, "--clone-audio", cloneAudioPath)
		} else {
			args = append(args, "--voice", voice)
		}
		if mode == "remote" {
			args = append(args, "--api-base", apiBase)
		}
		pyPath := findPythonPath()
		logx.Info("Executing VieNeu CLI using python path: " + pyPath)
		cmd = exec.Command(pyPath, args...)
	}

	output, err := cmd.CombinedOutput()

	if err != nil {
		logx.Error("VieNeu CLI execution failed", err)
		logx.Info("CLI Output: " + string(output))
		httpx.WriteJSON(w, VieNeuTTSResponse{
			Success: false,
			Error:   fmt.Sprintf("CLI error: %v. Output: %s", err, string(output)),
		})
		return
	}

	audioURL := fmt.Sprintf("http://127.0.0.1:5000/cache/%s", outputFilename)
	httpx.WriteJSON(w, VieNeuTTSResponse{
		Success:  true,
		AudioURL: audioURL,
	})
}

