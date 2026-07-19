package services

import (
	"encoding/json"
	"fmt"
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

type memoryStatusEx struct {
	cbSize             uint32
	dwMemoryLoad       uint32
	ullTotalPhys       uint64
	ullAvailPhys       uint64
	ullTotalPageFile   uint64
	ullAvailPageFile   uint64
	ullTotalVirtual    uint64
	ullAvailVirtual    uint64
	ullAvailExtendedVirtual uint64
}

type MemReductConfig struct {
	AutoClean bool `json:"auto_clean"`
	Threshold int  `json:"threshold"` // Percentage
}

var (
	configMutex sync.Mutex
	mrConfig    = MemReductConfig{
		AutoClean: true,
		Threshold: 85,
	}
	lastCleanTime time.Time
	cleanHistory  []string
	historyMutex  sync.Mutex
)

func init() {
	loadMemReductConfig()
	go startMemoryMonitor()
}

func getMemoryUsage() (uint32, uint64, uint64, error) {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	globalMemoryStatusEx := kernel32.NewProc("GlobalMemoryStatusEx")

	var ms memoryStatusEx
	ms.cbSize = uint32(unsafe.Sizeof(ms))

	r, _, err := globalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&ms)))
	if r == 0 {
		return 0, 0, 0, err
	}
	return ms.dwMemoryLoad, ms.ullTotalPhys, ms.ullAvailPhys, nil
}

func getMemReductPath() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	// Target executable: services/memreduct/memreduct.exe
	binDir := filepath.Join(wd, "services", "memreduct")
	exePath := filepath.Join(binDir, "memreduct.exe")

	if _, err := os.Stat(exePath); err == nil {
		return exePath, nil
	}

	// Not found, download it using PowerShell
	_ = os.MkdirAll(binDir, 0755)
	logx.Info("Mem Reduct not found. Downloading...")
	zipPath := filepath.Join(binDir, "memreduct.zip")
	
	downloadCmd := fmt.Sprintf(
		`[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; `+
			`Invoke-WebRequest -Uri 'https://github.com/henrypp/memreduct/releases/download/v.3.4/memreduct-3.4-bin.zip' -OutFile '%s'; `+
			`Expand-Archive -Path '%s' -DestinationPath '%s' -Force; `+
			`Remove-Item '%s'`,
		zipPath, zipPath, binDir, zipPath,
	)

	cmd := exec.Command("powershell", "-Command", downloadCmd)
	if err := cmd.Run(); err != nil {
		logx.Error("Failed to download Mem Reduct", err)
		return "", err
	}

	// Write default memreduct.ini to enable portable mode and silent settings
	iniPath := filepath.Join(binDir, "memreduct.ini")
	iniContent := `[main]
portable=1
clean_confirm=0
clean_result=0
clean_balloon=0
`
	_ = os.WriteFile(iniPath, []byte(iniContent), 0644)

	return exePath, nil
}

func optimizeMemory() (string, error) {
	exePath, err := getMemReductPath()
	if err != nil {
		return "", err
	}

	cmd := exec.Command(exePath, "-clean")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("optimization failed: %v, output: %s", err, string(output))
	}

	logMsg := fmt.Sprintf("[%s] Đã giải phóng bộ nhớ RAM tự động/thủ công.", time.Now().Format("15:04:05"))
	historyMutex.Lock()
	cleanHistory = append(cleanHistory, logMsg)
	if len(cleanHistory) > 20 {
		cleanHistory = cleanHistory[1:]
	}
	historyMutex.Unlock()
	lastCleanTime = time.Now()

	return "Memory optimized successfully", nil
}

func startMemoryMonitor() {
	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		load, _, _, err := getMemoryUsage()
		if err != nil {
			continue
		}

		configMutex.Lock()
		autoClean := mrConfig.AutoClean
		threshold := mrConfig.Threshold
		configMutex.Unlock()

		if autoClean && int(load) >= threshold {
			// Throttle auto-clean to run at most once every 2 minutes to prevent thrashing
			if time.Since(lastCleanTime) > 2*time.Minute {
				logx.Info(fmt.Sprintf("RAM usage reached %d%% (threshold %d%%). Triggering auto-clean...", load, threshold))
				_, _ = optimizeMemory()
			}
		}
	}
}

func loadMemReductConfig() {
	wd, _ := os.Getwd()
	configPath := filepath.Join(wd, "projects", "memreduct_config.json")
	if data, err := os.ReadFile(configPath); err == nil {
		configMutex.Lock()
		_ = json.Unmarshal(data, &mrConfig)
		configMutex.Unlock()
	}
}

func saveMemReductConfig() {
	wd, _ := os.Getwd()
	configPath := filepath.Join(wd, "projects", "memreduct_config.json")
	configMutex.Lock()
	data, _ := json.MarshalIndent(mrConfig, "", "  ")
	configMutex.Unlock()
	_ = os.WriteFile(configPath, data, 0644)
}

func HandleMemoryStatus(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method == "GET" {
		load, total, avail, err := getMemoryUsage()
		if err != nil {
			httpx.WriteError(w, err.Error(), http.StatusInternalServerError)
			return
		}

		configMutex.Lock()
		cfg := mrConfig
		configMutex.Unlock()

		historyMutex.Lock()
		history := make([]string, len(cleanHistory))
		copy(history, cleanHistory)
		historyMutex.Unlock()

		wd, _ := os.Getwd()
		exePath := filepath.Join(wd, "services", "memreduct", "memreduct.exe")
		_, installedErr := os.Stat(exePath)

		httpx.WriteJSON(w, map[string]interface{}{
			"load_percent":   load,
			"total_bytes":    total,
			"avail_bytes":    avail,
			"used_bytes":     total - avail,
			"auto_clean":     cfg.AutoClean,
			"threshold":      cfg.Threshold,
			"history":        history,
			"tool_installed": installedErr == nil,
		})
		return
	}
	httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func HandleMemoryOptimize(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	msg, err := optimizeMemory()
	if err != nil {
		httpx.WriteJSON(w, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
		"message": msg,
	})
}

func HandleMemoryConfig(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AutoClean bool `json:"auto_clean"`
		Threshold int  `json:"threshold"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, err.Error(), http.StatusBadRequest)
		return
	}

	configMutex.Lock()
	mrConfig.AutoClean = req.AutoClean
	if req.Threshold >= 10 && req.Threshold <= 95 {
		mrConfig.Threshold = req.Threshold
	}
	configMutex.Unlock()

	saveMemReductConfig()

	httpx.WriteJSON(w, map[string]interface{}{
		"success": true,
	})
}
