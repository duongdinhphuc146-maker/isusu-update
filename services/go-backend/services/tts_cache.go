package services

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"go-backend/services/go-backend/internal/logx"
)

func getCacheStats() (int, int64, int64, int64, error) {
	wd, _ := os.Getwd()
	cacheDir := filepath.Join(wd, "cache")
	_ = os.MkdirAll(cacheDir, 0755)

	var fileCount int
	var totalSize int64
	var oldestTime int64 = time.Now().Unix()
	var newestTime int64

	files, err := os.ReadDir(cacheDir)
	if err != nil {
		return 0, 0, 0, 0, err
	}

	for _, f := range files {
		if !f.IsDir() {
			info, err := f.Info()
			if err != nil {
				continue
			}
			fileCount++
			totalSize += info.Size()
			modTime := info.ModTime().Unix()
			if modTime < oldestTime {
				oldestTime = modTime
			}
			if modTime > newestTime {
				newestTime = modTime
			}
		}
	}
	if fileCount == 0 {
		oldestTime = 0
	}
	return fileCount, totalSize, oldestTime, newestTime, nil
}

func cleanCacheOlderThan(days int) error {
	wd, _ := os.Getwd()
	cacheDir := filepath.Join(wd, "cache")
	cutoff := time.Now().AddDate(0, 0, -days)

	files, err := os.ReadDir(cacheDir)
	if err != nil {
		return err
	}

	for _, f := range files {
		if !f.IsDir() {
			info, err := f.Info()
			if err != nil {
				continue
			}
			if info.ModTime().Before(cutoff) {
				_ = os.Remove(filepath.Join(cacheDir, f.Name()))
			}
		}
	}
	return nil
}

func cleanOldestFilesToLimit(limitBytes int64) error {
	wd, _ := os.Getwd()
	cacheDir := filepath.Join(wd, "cache")

	files, err := os.ReadDir(cacheDir)
	if err != nil {
		return err
	}

	type fileInfo struct {
		name    string
		modTime time.Time
		size    int64
	}

	var cacheFiles []fileInfo
	var currentSize int64
	for _, f := range files {
		if !f.IsDir() {
			info, err := f.Info()
			if err != nil {
				continue
			}
			cacheFiles = append(cacheFiles, fileInfo{
				name:    f.Name(),
				modTime: info.ModTime(),
				size:    info.Size(),
			})
			currentSize += info.Size()
		}
	}

	if currentSize <= limitBytes {
		return nil
	}

	sort.Slice(cacheFiles, func(i, j int) bool {
		return cacheFiles[i].modTime.Before(cacheFiles[j].modTime)
	})

	logx.Info("Cache exceeds threshold, cleaning up oldest files", "current_size", currentSize, "limit", limitBytes)
	for _, f := range cacheFiles {
		if currentSize <= limitBytes {
			break
		}
		err := os.Remove(filepath.Join(cacheDir, f.name))
		if err == nil {
			currentSize -= f.size
		}
	}
	return nil
}

func DownloadAndCacheAudio(audioURL string, hash string) (string, error) {
	wd, _ := os.Getwd()
	cacheDir := filepath.Join(wd, "cache")
	_ = os.MkdirAll(cacheDir, 0755)

	localPath := filepath.Join(cacheDir, hash+".mp3")
	localURL := "http://127.0.0.1:5000/cache/" + hash + ".mp3"

	if _, err := os.Stat(localPath); err == nil {
		logx.Info("TTS cache hit", "hash", hash)
		return localURL, nil
	}

	logx.Info("TTS cache miss, downloading remote audio", "url", audioURL)
	resp, err := http.Get(audioURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	out, err := os.Create(localPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", err
	}

	logx.Info("Successfully cached TTS audio file", "path", localPath)

	// Check cache limit (500MB)
	_ = cleanOldestFilesToLimit(500 * 1024 * 1024)

	return localURL, nil
}
