package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go-backend/services/go-backend/internal/logx"
)

// VideoOCRSegment đại diện cho 1 kết quả OCR thô từ frame
type VideoOCRSegment struct {
	Timestamp float64 `json:"timestamp"`
	RawText   string  `json:"raw_text"`
	ImageName string  `json:"image_name"`
}

// RunVideoOCRPipeline chạy toàn bộ quy trình:
// 1. Quét danh sách frame đã trích xuất trong thư mục project
// 2. Gửi từng frame qua Z.ai OCR thông qua Bridge (Replay session)
// 3. Gom kết quả thô, lọc trùng (deduplicate) & chuẩn hóa thời gian
// 4. Tạo file SRT phụ đề thô
func RunVideoOCRPipeline(
	ctx context.Context,
	projectID string,
	provider string, // ví dụ: "z-ai-session"
	updateProgress func(status string, progressPercent int, logLine string, srtResult string),
) (string, error) {
	wd, _ := os.Getwd()
	framesDir := filepath.Join(wd, "projects", projectID, "frames")
	
	entries, err := os.ReadDir(framesDir)
	if err != nil {
		return "", fmt.Errorf("không tìm thấy thư mục frame: %w", err)
	}

	var frameFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && (filepath.Ext(entry.Name()) == ".jpg" || filepath.Ext(entry.Name()) == ".png") {
			if !strings.HasPrefix(entry.Name(), "preview") {
				frameFiles = append(frameFiles, entry.Name())
			}
		}
	}

	if len(frameFiles) == 0 {
		return "", fmt.Errorf("không có ảnh frame nào để chạy OCR")
	}

	// Sắp xếp frame theo tên/thứ tự
	sort.Strings(frameFiles)
	total := len(frameFiles)
	
	updateProgress("processing", 5, fmt.Sprintf("Bắt đầu OCR cho %d frames bằng provider %s...", total, provider), "")

	var rawSegments []VideoOCRSegment

	for idx, file := range frameFiles {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}

		framePath := filepath.Join(framesDir, file)
		
		// Đọc ảnh thành base64
		imgData, err := os.ReadFile(framePath)
		if err != nil {
			logx.Error("Lỗi đọc file frame", err)
			continue
		}

		// Giả định timestamp từ tên file hoặc tính tương đối dựa trên index (nếu interval = 5s)
		// Ví dụ: frame_0000.jpg -> 0s, frame_0001.jpg -> 5s...
		timestamp := float64(idx * 5) // Fallback mặc định
		var parsedIdx int
		if _, err := fmt.Sscanf(file, "frame_%d.jpg", &parsedIdx); err == nil {
			timestamp = float64(parsedIdx * 5)
		} else if _, err := fmt.Sscanf(file, "keyframe_%d.jpg", &parsedIdx); err == nil {
			timestamp = float64(parsedIdx * 2) // Giả định keyframe cách nhau khoảng 2s
		}

		updateProgress("processing", 5+(idx*80/total), fmt.Sprintf("Đang nhận dạng frame %d/%d (%s)...", idx+1, total, file), "")

		// Call OCR Replay Bridge
		ocrText, err := callBridgeOCR(ctx, imgData, provider)
		if err != nil {
			updateProgress("processing", 5+(idx*80/total), fmt.Sprintf("  - Lỗi OCR frame %s: %s", file, err.Error()), "")
			continue
		}

		ocrText = strings.TrimSpace(ocrText)
		if ocrText != "" {
			ocrText = CleanOCRErrors(ocrText)
		}
		if ocrText != "" {
			updateProgress("processing", 5+(idx*80/total), fmt.Sprintf("  - Frame %s: \"%s\"", file, ocrText), "")
			rawSegments = append(rawSegments, VideoOCRSegment{
				Timestamp: timestamp,
				RawText:   ocrText,
				ImageName: file,
			})
		}

		// Thêm khoảng nghỉ jitter nhẹ tránh spam bridge
		time.Sleep(500 * time.Millisecond)
	}

	updateProgress("processing", 85, "Đang lọc trùng lặp và đồng bộ hóa timeline...", "")
	
	// Khử trùng lặp và gom dòng phụ đề
	deduped := DeduplicateOCR(rawSegments)

	// Build SRT
	srtOutput := GenerateSRTFromSegments(deduped)

	// Lưu SRT vào project
	projectDir := filepath.Join(wd, "projects", projectID)
	subDir := filepath.Join(projectDir, "subtitles")
	_ = os.MkdirAll(subDir, 0755)
	srtPath := filepath.Join(subDir, "ocr_extracted.srt")
	_ = os.WriteFile(srtPath, []byte(srtOutput), 0644)

	updateProgress("succeed", 100, "Hoàn thành trích xuất phụ đề OCR từ video!", srtOutput)

	return srtOutput, nil
}

// callBridgeOCR gọi API Replay của node bridge
func callBridgeOCR(ctx context.Context, imgBytes []byte, provider string) (string, error) {
	providerID := strings.TrimSuffix(provider, "-session")

	port := os.Getenv("AI_BRIDGE_PORT")
	if port == "" {
		port = "5001"
	}
	url := fmt.Sprintf("http://127.0.0.1:%s/ocr", port) // Gọi qua route /api/ocr của Go hoặc bridge /ocr/replay trực tiếp

	var req struct {
		Provider string `json:"provider"`
		Image    string `json:"image"` // base64 string
	}
	req.Provider = providerID
	req.Image = base64.StdEncoding.EncodeToString(imgBytes)

	bodyBytes, _ := json.Marshal(req)
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("bridge error (%d): %s", resp.StatusCode, string(respBody))
	}

	var respData struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&respData); err == nil && respData.Text != "" {
		return respData.Text, nil
	}

	// Fallback nếu trả về string thô
	respBody, _ := io.ReadAll(resp.Body)
	return string(respBody), nil
}
