package services

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestDevicePool(t *testing.T) {
	// Setup custom temp pool file
	tmpDir, err := os.MkdirTemp("", "devices_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	poolFile := filepath.Join(tmpDir, "device_pool_test.json")
	content := `[
		{"device_id": "DEV_001", "aid": "359289"},
		{"device_id": "DEV_002", "aid": "359289"}
	]`
	_ = os.WriteFile(poolFile, []byte(content), 0644)

	// Override once for clean testing state
	GlobalDevicePool = nil
	poolOnce = sync.Once{}
	InitDevicePool(poolFile)

	dev1 := GetNextDevice()
	dev2 := GetNextDevice()

	if dev1.DeviceID == dev2.DeviceID {
		t.Errorf("expected different device IDs, got %s and %s", dev1.DeviceID, dev2.DeviceID)
	}

	// Mark DEV_001 in cooldown
	MarkDeviceCooldown("DEV_001", 10*time.Second)

	// Since DEV_001 is cooling down, the next device must be DEV_002
	dev3 := GetNextDevice()
	if dev3.DeviceID != "DEV_002" {
		t.Errorf("expected DEV_002 to be selected due to DEV_001 cooldown, got %s", dev3.DeviceID)
	}
}

func TestDevicePoolConcurrency(t *testing.T) {
	GlobalDevicePool = nil
	poolOnce = sync.Once{}
	InitDevicePool("projects/device_pool.json")

	var wg sync.WaitGroup
	workers := 50

	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer wg.Done()
			_ = GetNextDevice()
		}()
	}

	wg.Wait()
}
