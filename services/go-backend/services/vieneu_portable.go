package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func getProjectRoot(wd string) string {
	if _, err := os.Stat(filepath.Join(wd, "go.mod")); err == nil {
		return wd
	}
	parent := filepath.Dir(wd)
	if _, err := os.Stat(filepath.Join(parent, "go.mod")); err == nil {
		return parent
	}
	parent2 := filepath.Dir(parent)
	if _, err := os.Stat(filepath.Join(parent2, "go.mod")); err == nil {
		return parent2
	}
	return wd
}

func ensurePortablePython(wd string) (string, error) {
	projectRoot := getProjectRoot(wd)
	pythonDir := filepath.Join(projectRoot, "python")
	pyPath := filepath.Join(pythonDir, "python.exe")

	if _, err := os.Stat(pyPath); err == nil {
		return pyPath, nil
	}

	appendLog("Không tìm thấy Python di động. Bắt đầu tải Python 3.10 Embeddable...")

	zipPath := filepath.Join(projectRoot, "python-3.10.11-embed-amd64.zip")

	appendLog("Bước 1/4: Đang tải Python 3.10.11 Embeddable...")
	downloadCmd := fmt.Sprintf(`[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip' -OutFile '%s'`, zipPath)
	cmdDownload := exec.Command("powershell", "-Command", downloadCmd)
	if err := cmdDownload.Run(); err != nil {
		return "", fmt.Errorf("không thể tải Python: %v", err)
	}

	appendLog("Bước 2/4: Đang giải nén Python...")
	extractCmd := fmt.Sprintf(`Expand-Archive -Path '%s' -DestinationPath '%s' -Force`, zipPath, pythonDir)
	cmdExtract := exec.Command("powershell", "-Command", extractCmd)
	if err := cmdExtract.Run(); err != nil {
		os.Remove(zipPath)
		return "", fmt.Errorf("không thể giải nén Python: %v", err)
	}
	os.Remove(zipPath)

	appendLog("Bước 3/4: Đấu nối cấu hình file ._pth...")
	pthFile := filepath.Join(pythonDir, "python310._pth")
	f, err := os.OpenFile(pthFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err == nil {
		f.WriteString("\nimport site\n")
		f.Close()
	}

	appendLog("Bước 4/4: Đang cấu hình và cài đặt pip...")
	pipScriptPath := filepath.Join(pythonDir, "get-pip.py")
	downloadPipCmd := fmt.Sprintf(`Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%s'`, pipScriptPath)
	cmdDownloadPip := exec.Command("powershell", "-Command", downloadPipCmd)
	if err := cmdDownloadPip.Run(); err != nil {
		return "", fmt.Errorf("không thể tải get-pip.py: %v", err)
	}

	cmdInstallPip := exec.Command(pyPath, pipScriptPath, "--no-warn-script-location")
	if err := cmdInstallPip.Run(); err != nil {
		os.Remove(pipScriptPath)
		return "", fmt.Errorf("không thể cài đặt pip: %v", err)
	}
	os.Remove(pipScriptPath)

	appendLog("Môi trường Python di động đã được cấu hình thành công!")
	return pyPath, nil
}

func findPythonPath() string {
	wd, err := os.Getwd()
	if err == nil {
		projectRoot := getProjectRoot(wd)
		// 1. Check local portable python folder inside project root
		localPy := filepath.Join(projectRoot, "python", "python.exe")
		if _, err := os.Stat(localPy); err == nil {
			return localPy
		}

		// 2. Check local venv python
		paths := []string{
			filepath.Join(projectRoot, ".venv", "Scripts", "python.exe"),
			filepath.Join(wd, ".venv", "Scripts", "python.exe"),
			filepath.Join(wd, "services", ".venv", "Scripts", "python.exe"),
		}
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}

	// 3. Fallback to system Python path
	home, err := os.UserHomeDir()
	if err == nil {
		pattern := filepath.Join(home, "AppData", "Local", "Programs", "Python", "Python*", "python.exe")
		matches, err := filepath.Glob(pattern)
		if err == nil && len(matches) > 0 {
			return matches[len(matches)-1]
		}
	}
	matches, err := filepath.Glob("C:\\Program Files\\Python*\\python.exe")
	if err == nil && len(matches) > 0 {
		return matches[len(matches)-1]
	}
	return "python"
}

