package services

import (
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

type SetupStatus struct {
	Installed     bool   `json:"installed"`
	ModelCached   bool   `json:"model_cached"`
	GPUAvailable  bool   `json:"gpu_available"`
	SetupRunning  bool   `json:"setup_running"`
	SetupLog      string `json:"setup_log"`
}

var (
	setupMutex    sync.Mutex
	setupRunning  bool
	setupLogParts []string
)

func HandleVieNeuStatus(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}

	installed := isPackageInstalled("vieneu")
	gpuAvailable := checkNvidiaGPU()
	modelCached := checkModelCached()

	setupMutex.Lock()
	running := setupRunning
	logs := strings.Join(setupLogParts, "\n")
	setupMutex.Unlock()

	httpx.WriteJSON(w, SetupStatus{
		Installed:    installed,
		GPUAvailable: gpuAvailable,
		ModelCached:  modelCached,
		SetupRunning: running,
		SetupLog:     logs,
	})
}

func HandleVieNeuSetup(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	setupMutex.Lock()
	if setupRunning {
		setupMutex.Unlock()
		httpx.WriteJSON(w, map[string]interface{}{"success": true, "message": "Setup is already running"})
		return
	}
	setupRunning = true
	setupLogParts = []string{"[" + r.Method + "] Khởi động tiến trình cài đặt tự động..."}
	setupMutex.Unlock()

	// Run installation asynchronously
	go runSetupProcess()

	httpx.WriteJSON(w, map[string]interface{}{"success": true, "message": "Setup started successfully"})
}

type lineWriter struct {
	buf string
}

func (w *lineWriter) Write(p []byte) (int, error) {
	w.buf += string(p)
	for {
		idx := strings.Index(w.buf, "\n")
		if idx == -1 {
			break
		}
		line := strings.TrimSpace(w.buf[:idx])
		if line != "" {
			appendLog(line)
		}
		w.buf = w.buf[idx+1:]
	}
	return len(p), nil
}

func runSetupProcess() {
	defer func() {
		setupMutex.Lock()
		setupRunning = false
		setupMutex.Unlock()
	}()

	wd, err := os.Getwd()
	if err != nil {
		appendLog("Lỗi thư mục hiện tại: " + err.Error())
		return
	}

	// Ensure portable python is configured
	pyPath, err := ensurePortablePython(wd)
	if err != nil {
		appendLog("Lỗi thiết lập Python di động: " + err.Error())
		appendLog("=== CÀI ĐẶT THẤT BẠI ===")
		return
	}

	setupScript := filepath.Join(wd, "services", "vieneu_setup.py")
	appendLog("Đang chạy python setup...")
	appendLog("Sử dụng trình thực thi python: " + pyPath)
	
	cmd := exec.Command(pyPath, setupScript)
	
	writer := &lineWriter{}
	cmd.Stdout = writer
	cmd.Stderr = writer

	err = cmd.Run()
	if err == nil {
		// Flush remaining buffer
		if writer.buf != "" {
			appendLog(strings.TrimSpace(writer.buf))
		}
		appendLog("=== HOÀN THÀNH CÀI ĐẶT THÀNH CÔNG ===")
	} else {
		appendLog("Lỗi: " + err.Error())
		appendLog("=== CÀI ĐẶT THẤT BẠI ===")
	}
}

func appendLog(msg string) {
	setupMutex.Lock()
	setupLogParts = append(setupLogParts, msg)
	setupMutex.Unlock()
	logx.Info("[VIENEU SETUP] " + msg)
}

func isPackageInstalled(pkg string) bool {
	pyPath := findPythonPath()
	cmd := exec.Command(pyPath, "-c", "import "+pkg)
	return cmd.Run() == nil
}

func checkNvidiaGPU() bool {
	cmd := exec.Command("nvidia-smi")
	return cmd.Run() == nil
}

func checkModelCached() bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	repoDir := filepath.Join(home, ".cache", "huggingface", "hub", "models--pnnbao-ump--VieNeu-TTS-v3-Turbo", "snapshots")
	if _, err := os.Stat(repoDir); os.IsNotExist(err) {
		return false
	}
	
	commits, err := os.ReadDir(repoDir)
	if err != nil {
		return false
	}

	for _, c := range commits {
		if c.IsDir() {
			int8Dir := filepath.Join(repoDir, c.Name(), "onnx_int8")
			if _, err := os.Stat(filepath.Join(int8Dir, "vieneu_acoustic_cached.onnx")); err == nil {
				if _, err := os.Stat(filepath.Join(int8Dir, "config.json")); err == nil {
					return true
				}
			}
		}
	}
	return false
}
