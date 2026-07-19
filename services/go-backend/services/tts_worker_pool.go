package services

import (
	"context"
	"crypto/rand"
	"math/big"
	"strings"
	"sync"
	"time"
)

type TTSJob struct {
	Index      int
	Text       string
	Voice      string
	ResourceID string
	Rate       string
	Hash       string
}

type TTSJobResult struct {
	Index    int
	AudioURL string
	Error    error
}

func RunTTSWorkerPool(ctx context.Context, jobs []TTSJob, maxWorkers int, progressCallback func(completed int, total int, res TTSJobResult)) []TTSJobResult {
	total := len(jobs)
	if total == 0 {
		return nil
	}

	jobChan := make(chan TTSJob, total)
	resultChan := make(chan TTSJobResult, total)

	for _, job := range jobs {
		jobChan <- job
	}
	close(jobChan)

	var wg sync.WaitGroup
	if maxWorkers <= 0 {
		maxWorkers = 5
	}
	if maxWorkers > total {
		maxWorkers = total
	}

	for i := 0; i < maxWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for job := range jobChan {
				select {
				case <-ctx.Done():
					return
				default:
				}

				// Inject random jitter delay between 200ms and 800ms before sending request
				jitter, _ := rand.Int(rand.Reader, big.NewInt(600))
				time.Sleep(time.Duration(200+jitter.Int64()) * time.Millisecond)

				var audioURL string
				var err error

				// Retry with device rotation up to 3 times
				for attempt := 1; attempt <= 3; attempt++ {
					device := GetNextDevice()
					audioURL, err = GenerateTtsInternal(ctx, job.Text, job.Voice, job.ResourceID, job.Rate, device)
					if err == nil {
						break
					}
					if strings.Contains(err.Error(), "429") {
						MarkDeviceCooldown(device.DeviceID, 15*time.Minute)
						// Sleep longer on rate limit
						time.Sleep(3 * time.Second)
					}
				}

				resultChan <- TTSJobResult{
					Index:    job.Index,
					AudioURL: audioURL,
					Error:    err,
				}
			}
		}(i)
	}

	// Close result channel when all workers are done
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	results := make([]TTSJobResult, total)
	completed := 0

	for res := range resultChan {
		completed++
		if progressCallback != nil {
			progressCallback(completed, total, res)
		}
		// Find and place in corresponding index order (or collect for sorting later)
		results[completed-1] = res
	}

	return results
}
