package services

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"go-backend/services/go-backend/internal/httpx"
	"go-backend/services/go-backend/internal/logx"
	"net/http"
	"os"
	"path/filepath"
	"sync"

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
		var processed = make([]SRTSegment, total)
		var jobs []TTSJob
		segmentMap := make(map[int]SRTSegment)

		for _, seg := range segments {
			segmentMap[seg.Index] = seg
		}

		// Phase 1: Filter cached segments vs cache misses (jobs)
		for _, seg := range segments {
			hash := md5HexStr(seg.Text + "_" + voice + "_" + resourceID + "_" + rate)
			cachePath := filepath.Join(wd, "cache", hash+".mp3")
			localURL := "http://127.0.0.1:5000/cache/" + hash + ".mp3"

			if _, err := os.Stat(cachePath); err == nil {
				logx.Info("SRT Task cache hit", "index", seg.Index, "hash", hash)
				seg.AudioURL = localURL
				// Save immediately
				processed[seg.Index-1] = seg
			} else {
				jobs = append(jobs, TTSJob{
					Index:      seg.Index,
					Text:       seg.Text,
					Voice:      voice,
					ResourceID: resourceID,
					Rate:       rate,
					Hash:       hash,
				})
			}
		}

		// Store initially completed cached files count to accurately represent initial progress
		initialCompleted := total - len(jobs)
		if initialCompleted > 0 {
			var currentProcessed []SRTSegment
			for _, seg := range processed {
				if seg.Index != 0 {
					currentProcessed = append(currentProcessed, seg)
				}
			}
			progress.Progress = int(float64(initialCompleted) / float64(total) * 100)
			progress.Segments = currentProcessed
			InFlightSrtTasks.Store(taskId, progress)
		}

		// Phase 2: Run worker pool for cache misses
		if len(jobs) > 0 {
			RunTTSWorkerPool(context.Background(), jobs, 5, func(comp int, tot int, res TTSJobResult) {
				origSeg := segmentMap[res.Index]
				if res.Error == nil {
					cachedURL, cacheErr := DownloadAndCacheAudio(res.AudioURL, md5HexStr(origSeg.Text+"_"+voice+"_"+resourceID+"_"+rate))
					if cacheErr == nil {
						origSeg.AudioURL = cachedURL
					} else {
						origSeg.AudioURL = res.AudioURL
					}
				} else {
					logx.Error("SRT Task segment generation failed", res.Error, "taskId", taskId, "index", res.Index)
				}

				processed[res.Index-1] = origSeg

				// Update progress
				var currentProcessed []SRTSegment
				for _, seg := range processed {
					if seg.Index != 0 {
						currentProcessed = append(currentProcessed, seg)
					}
				}
				progress.Progress = int(float64(initialCompleted+comp) / float64(total) * 100)
				progress.Segments = currentProcessed
				InFlightSrtTasks.Store(taskId, progress)
			})
		}

		progress.Status = "succeed"
		progress.Progress = 100
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
