package services

import (
	"context"
	"sync"
	"testing"
)

func TestTTSWorkerPool(t *testing.T) {
	// Re-initialize device pool for testing
	GlobalDevicePool = nil
	poolOnce = sync.Once{}
	InitDevicePool("projects/device_pool.json")

	jobs := []TTSJob{
		{Index: 1, Text: "Test line one", Voice: "BV074_streaming", ResourceID: "7102355709945188865", Rate: "1.0"},
		{Index: 2, Text: "Test line two", Voice: "BV074_streaming", ResourceID: "7102355709945188865", Rate: "1.0"},
	}

	progressCalled := 0
	progressMu := sync.Mutex{}

	// Run with 2 workers
	results := RunTTSWorkerPool(context.Background(), jobs, 2, func(comp int, tot int, res TTSJobResult) {
		progressMu.Lock()
		progressCalled++
		progressMu.Unlock()
	})

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	if progressCalled != 2 {
		t.Errorf("expected progress callback to be called 2 times, got %d", progressCalled)
	}
}
