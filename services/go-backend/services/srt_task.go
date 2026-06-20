package services

import (
	"context"
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

type SrtTaskProgress struct {
	TaskId   string        `json:"task_id"`
	Status   string        `json:"status"`   // "processing", "succeed", "failed"
	Progress int           `json:"progress"` // 0-100
	Error    string        `json:"error,omitempty"`
	Segments []SRTSegment  `json:"segments,omitempty"`
}

var InFlightSrtTasks sync.Map // maps taskId (string) -> *SrtTaskProgress

func md5HexStr(s string) string {
	h := md5.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

func StartSRTToSpeakTask(srtText, voice, resourceID, rate string) string {
	taskId := uuid.New().String()
	progress := &SrtTaskProgress{
		TaskId:   taskId,
		Status:   "processing",
		Progress: 0,
		Segments: []SRTSegment{},
	}
	InFlightSrtTasks.Store(taskId, progress)

	go func(taskId, srtText, voice, resourceID, rate string) {
		segments := ParseSRT(srtText)
		total := len(segments)
		if total == 0 {
			progress.Status = "failed"
			progress.Error = "No valid SRT segments found."
			InFlightSrtTasks.Store(taskId, progress)
			return
		}

		wd, _ := os.Getwd()
		var processed []SRTSegment

		for i, seg := range segments {
			hash := md5HexStr(seg.Text + "_" + voice + "_" + resourceID + "_" + rate)
			cachePath := filepath.Join(wd, "cache", hash+".mp3")
			localURL := "http://127.0.0.1:5000/cache/" + hash + ".mp3"

			// Check local cache first
			if _, err := os.Stat(cachePath); err == nil {
				logx.Info("SRT Task cache hit", "index", seg.Index, "hash", hash)
				seg.AudioURL = localURL
				processed = append(processed, seg)

				percent := int(float64(i+1) / float64(total) * 100)
				progress.Progress = percent
				progress.Segments = processed
				InFlightSrtTasks.Store(taskId, progress)
				continue
			}

			// Cache miss - sleep to prevent rate-limit before requesting CapCut
			if i > 0 {
				jitter, _ := rand.Int(rand.Reader, big.NewInt(1000))
				sleepTime := time.Duration(1500+jitter.Int64()) * time.Millisecond
				logx.Info("SRT Task Sleep before next segment", "taskId", taskId, "index", seg.Index, "duration", sleepTime)
				time.Sleep(sleepTime)
			}

			// Generate TTS for the segment
			audioURL, err := GenerateTtsInternal(context.Background(), seg.Text, voice, resourceID, rate)
			if err == nil {
				// Save generated file to local cache
				cachedURL, cacheErr := DownloadAndCacheAudio(audioURL, hash)
				if cacheErr == nil {
					seg.AudioURL = cachedURL
				} else {
					seg.AudioURL = audioURL
				}
			} else {
				logx.Error("SRT Task segment generation failed", err, "taskId", taskId, "index", seg.Index)
			}
			processed = append(processed, seg)

			// Update progress percentage
			percent := int(float64(i+1) / float64(total) * 100)
			progress.Progress = percent
			progress.Segments = processed
			InFlightSrtTasks.Store(taskId, progress)
		}

		progress.Status = "succeed"
		InFlightSrtTasks.Store(taskId, progress)
		logx.Info("SRT Task completed successfully", "taskId", taskId)
	}(taskId, srtText, voice, resourceID, rate)

	return taskId
}

func HandleSRTStatus(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	taskId := r.URL.Query().Get("task_id")
	if taskId == "" {
		httpx.WriteError(w, "Missing task_id parameter", http.StatusBadRequest)
		return
	}

	progressVal, exists := InFlightSrtTasks.Load(taskId)
	if !exists {
		httpx.WriteError(w, "SRT task not found", http.StatusNotFound)
		return
	}

	httpx.WriteJSON(w, progressVal)
}
