package services

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"go-backend/services/go-backend/internal/logx"
)

// TranslateWorker processes the translation task asynchronously in chunks.
func TranslateWorker(taskId string, req TranslateRequest, segments []SRTSegment) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	updateProgress := func(status string, progressPercent int, completed int, total int, errStr string, srt string, logLine string) {
		val, exists := InFlightTranslateTasks.Load(taskId)
		if exists {
			p, ok := val.(*TranslateTaskProgress)
			if ok {
				p.Status = status
				p.Progress = progressPercent
				p.CompletedChunks = completed
				p.TotalChunks = total
				p.Error = errStr
				p.TranslatedSRT = srt
				if logLine != "" {
					p.Logs = append(p.Logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), logLine))
				}
				InFlightTranslateTasks.Store(taskId, p)
			}
		}
	}

	chunks := ChunkSegments(segments, 3000)
	totalChunks := len(chunks)
	updateProgress("processing", 5, 0, totalChunks, "", "", fmt.Sprintf("Bắt đầu dịch phụ đề: %d segments chia thành %d chunks.", len(segments), totalChunks))

	var allTranslated []TranslatedSegment

	for chunkIdx, chunk := range chunks {
		select {
		case <-ctx.Done():
			updateProgress("failed", 0, chunkIdx, totalChunks, "Task cancelled or timed out", "", "Lỗi: Quá trình dịch bị hủy hoặc hết thời gian chờ.")
			return
		default:
		}

		var uncachedSegs []SRTSegment
		var translatedChunk []TranslatedSegment

		logMsg := fmt.Sprintf("[Chunk %d/%d] Đang xử lý các segment từ ID %d đến %d...", chunkIdx+1, totalChunks, chunk[0].Index, chunk[len(chunk)-1].Index)
		updateProgress("processing", 5+(chunkIdx*90/totalChunks), chunkIdx, totalChunks, "", "", logMsg)

		// 1. Check cache first
		for _, seg := range chunk {
			key := GetCacheKey(seg.Text, req.TargetLang, req.Provider)
			if transText, exists := GetCachedTranslation(key); exists {
				translatedChunk = append(translatedChunk, TranslatedSegment{
					Index:          seg.Index,
					Start:          seg.Start,
					End:            seg.End,
					OriginalText:   seg.Text,
					TranslatedText: transText,
				})
			} else {
				uncachedSegs = append(uncachedSegs, seg)
			}
		}

		if len(uncachedSegs) < len(chunk) {
			updateProgress("processing", 5+(chunkIdx*90/totalChunks), chunkIdx, totalChunks, "", "", fmt.Sprintf("  - Đã tìm thấy %d/%d segment trong bộ nhớ đệm (Cache).", len(chunk)-len(uncachedSegs), len(chunk)))
		}

		// 2. Translate uncached segments
		if len(uncachedSegs) > 0 {
			updateProgress("processing", 5+(chunkIdx*90/totalChunks), chunkIdx, totalChunks, "", "", fmt.Sprintf("  - Gửi %d segment chưa dịch đến %s...", len(uncachedSegs), req.Provider))
			jsonPrompt, err := BuildTranslationJSON(uncachedSegs, req.TargetLang)
			if err != nil {
				logx.Error("Failed to build translation JSON", err)
				updateProgress("failed", 0, chunkIdx, totalChunks, "Internal error encoding segments: "+err.Error(), "", "Lỗi mã hóa dữ liệu segment: "+err.Error())
				return
			}

			var translatedJSON string

			// Direct API or session replay
			if strings.HasSuffix(req.Provider, "-session") {
				bridgeProvider := strings.TrimSuffix(req.Provider, "-session")
				systemInstructions := fmt.Sprintf("You are a professional subtitle translator. Translate the 'text' field of each segment in the input JSON list to %s naturally, fluently, and preserving all context (slang, adult/sexual terms) without censoring or softening. Keep the original 'id' exactly as is. Output MUST be valid JSON structure matching: {\"translations\": [{\"id\": N, \"text\": \"translated text\"}]}. Output only the JSON. Do not include markdown code block wrappers.", req.TargetLang)
				fullSessionPrompt := fmt.Sprintf("%s\n\nInput segments JSON:\n%s", systemInstructions, jsonPrompt)
				translatedJSON, err = ReplayViaBridge(ctx, fullSessionPrompt, bridgeProvider)
			} else if req.Provider == "gemini-api" {
				translatedJSON, err = TranslateViaGeminiAPI(ctx, jsonPrompt, os.Getenv("GEMINI_API_KEY"))
			} else if req.Provider == "openai-api" {
				translatedJSON, err = TranslateViaOpenAIAPI(ctx, jsonPrompt, os.Getenv("OPENAI_API_KEY"))
			} else {
				err = fmt.Errorf("unknown translation provider: %s", req.Provider)
			}

			if err != nil {
				logx.Error("Translation failed for chunk", err, "provider", req.Provider, "chunk", chunkIdx)
				updateProgress("failed", 0, chunkIdx, totalChunks, "Translation failed: "+err.Error(), "", "Lỗi gọi API dịch: "+err.Error())
				return
			}

			// Parse response and merge
			newlyTranslated := ParseTranslationJSON(translatedJSON, uncachedSegs)
			matchedCount := 0
			for _, trans := range newlyTranslated {
				if trans.TranslatedText != trans.OriginalText {
					matchedCount++
					// Cache the result only if it was successfully translated (different from original)
					key := GetCacheKey(trans.OriginalText, req.TargetLang, req.Provider)
					SetCachedTranslation(key, trans.OriginalText, trans.TranslatedText, req.TargetLang, req.Provider)
				}
				translatedChunk = append(translatedChunk, trans)
			}
			updateProgress("processing", 5+(chunkIdx*90/totalChunks), chunkIdx, totalChunks, "", "", fmt.Sprintf("  - Hoàn thành: dịch thành công %d/%d segment từ AI.", matchedCount, len(uncachedSegs)))

			// Jitter only if we actually hit the API and it's not the last chunk
			if chunkIdx < totalChunks-1 {
				// pseudo-random jitter 2-5 seconds
				jitterSecs := 2 + (time.Now().Nanosecond() % 4)
				updateProgress("processing", 5+(chunkIdx*90/totalChunks), chunkIdx, totalChunks, "", "", fmt.Sprintf("  - Nghỉ %d giây trước chunk tiếp theo...", jitterSecs))
				select {
				case <-ctx.Done():
					updateProgress("failed", 0, chunkIdx, totalChunks, "Task cancelled during jitter sleep", "", "Lỗi: Quá trình dịch bị hủy khi đang chờ.")
					return
				case <-time.After(time.Duration(jitterSecs) * time.Second):
				}
			}
		}

		allTranslated = append(allTranslated, translatedChunk...)
		completed := chunkIdx + 1
		progressPercent := 5 + (completed * 90 / totalChunks)
		updateProgress("processing", progressPercent, completed, totalChunks, "", "", fmt.Sprintf("[Chunk %d/%d] Hoàn thành.", completed, totalChunks))
	}

	// Sort segments to match original order just in case
	sort.Slice(allTranslated, func(i, j int) bool {
		return allTranslated[i].Index < allTranslated[j].Index
	})

	finalSRT := ReassembleSRT(allTranslated)
	updateProgress("succeed", 100, totalChunks, totalChunks, "", finalSRT, "Quá trình dịch hoàn thành thành công!")
	logx.Info("Subtitle translation task completed successfully", "taskId", taskId)
}
