package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go-backend/services/go-backend/internal/logx"
)

func TranslateWorkerV2(taskId string, req TranslateRequest, segments []SRTSegment) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	updateProgress := func(status string, progressPercent int, completed int, total int, errStr string, srt string, logLine string, cmap *CharacterMap) {
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
				if cmap != nil {
					p.CharacterMap = cmap
				}
				if status == "succeed" {
					p.AudioUrl = "/projects/dialogue_" + taskId + "/final_timeline_mix.mp3"
				}
				if logLine != "" {
					p.Logs = append(p.Logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), logLine))
				}
				InFlightTranslateTasks.Store(taskId, p)
			}
		}
	}

	projectDir := filepath.Join("projects", "dialogue_"+taskId)
	var cmap *CharacterMap
	var err error
	apiKey := os.Getenv("GEMINI_API_KEY")

	if req.Stage == "dub" {
		// Stage 2: Dubbing and executing translation + E2E pipeline
		cmap, err = LoadCharacterMap(projectDir)
		if err != nil {
			logx.Error("Failed to load character map for dub stage", err)
			cmap = &CharacterMap{}
		}
		
		// Update and persist selected character voices
		voiceMap := make(map[string]CharacterVoice)
		for _, cv := range req.CharacterVoices {
			voiceMap[cv.ID] = cv
		}
		for i, char := range cmap.Characters {
			if cv, exists := voiceMap[char.ID]; exists {
				cmap.Characters[i].VoiceType = cv.VoiceType
				cmap.Characters[i].ResourceID = cv.ResourceID
			}
		}
		_ = SaveCharacterMap(cmap, projectDir)

		for _, c := range cmap.Characters {
			logx.Info("Dialogue Stage 2 Voice Config", "charID", c.ID, "gender", c.Gender, "voice", c.VoiceType, "resource", c.ResourceID)
		}

		updateProgress("processing", 20, 0, 1, "", "", "Khởi tạo thành công từ cấu hình giọng đọc nhân vật. Bắt đầu dịch thuật...", cmap)
	} else {
		// Stage 1: Analyze & profile characters
		updateProgress("processing", 2, 0, 1, "", "", "Bắt đầu trích xuất hội thoại và phân tích nhân vật...", nil)
		anchorChunks := ExtractAnchorChunks(segments, 150)
		cmap, err = ProfileCharacters(ctx, anchorChunks, req.Provider, apiKey)
		if err != nil {
			logx.Error("Character profiling failed", err)
			updateProgress("failed", 0, 0, 1, "Character profiling failed: "+err.Error(), "", "Lỗi nhận dạng nhân vật: "+err.Error(), nil)
			return
		}
		_ = os.MkdirAll(projectDir, 0755)
		_ = SaveCharacterMap(cmap, projectDir)
		updateProgress("waiting_voices", 20, 0, 1, "", "", fmt.Sprintf("Nhận diện thành công %d nhân vật. Đang chờ cấu hình giọng đọc...", len(cmap.Characters)), cmap)
		return // Exit goroutine to wait for user to configure and trigger Stage 2!
	}

	// Step 2: Overlap chunking
	chunks := ChunkSegmentsWithOverlap(segments, 80, 10)
	totalChunks := len(chunks)
	updateProgress("processing", 20, 0, totalChunks, "", "", fmt.Sprintf("Bắt đầu dịch hội thoại đa nhiệm (%d chunks)...", totalChunks), nil)

	var allTranslated []TranslatedSegment

	for chunkIdx, chunk := range chunks {
		select {
		case <-ctx.Done():
			updateProgress("failed", 0, chunkIdx, totalChunks, "Task cancelled or timed out", "", "Lỗi: Quá trình dịch bị hủy.", nil)
			return
		default:
		}

		logMsg := fmt.Sprintf("[Chunk %d/%d] Gửi %d core segments...", chunkIdx+1, totalChunks, len(chunk.CoreSegments))
		updateProgress("processing", 20+(chunkIdx*75/totalChunks), chunkIdx, totalChunks, "", "", logMsg, nil)

		var results []MultiTaskResult
		var err error

		if strings.HasSuffix(req.Provider, "-session") {
			results, err = TranslateSessionV2(ctx, req.Provider, req.TargetLang, cmap, chunk)
		} else {
			results, err = TranslateMultiTaskViaGemini(ctx, chunk, cmap, req.TargetLang, apiKey)
		}

		if err != nil {
			logx.Error("Multi-task translation chunk failed", err)
			updateProgress("failed", 0, chunkIdx, totalChunks, "Translation failed: "+err.Error(), "", "Lỗi dịch chunk: "+err.Error(), nil)
			return
		}

		// Map results back to segments
		resultMap := make(map[int]MultiTaskResult)
		for _, res := range results {
			resultMap[res.ID] = res
		}

		for _, coreSeg := range chunk.CoreSegments {
			res, exists := resultMap[coreSeg.Index]
			transText := coreSeg.Text
			spk := "SPK_DEFAULT"
			emo := "neutral"

			if exists {
				transText = res.Text
				spk = res.Speaker
				emo = res.Emotion
			} else {
				logx.Info("Missing multi-task translation result for core segment, using original", "index", coreSeg.Index)
			}

			allTranslated = append(allTranslated, TranslatedSegment{
				Index:          coreSeg.Index,
				Start:          coreSeg.Start,
				End:            coreSeg.End,
				OriginalText:   coreSeg.Text,
				TranslatedText: transText,
				Speaker:        spk,
				Emotion:        emo,
			})
		}

		completed := chunkIdx + 1
		progressPercent := 20 + (completed * 75 / totalChunks)
		updateProgress("processing", progressPercent, completed, totalChunks, "", "", fmt.Sprintf("[Chunk %d/%d] Hoàn thành.", completed, totalChunks), nil)

		if chunkIdx < totalChunks-1 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(2 * time.Second):
			}
		}
	}

	sort.Slice(allTranslated, func(i, j int) bool {
		return allTranslated[i].Index < allTranslated[j].Index
	})

	var builder strings.Builder
	for _, seg := range allTranslated {
		builder.WriteString(fmt.Sprintf("%d\n", seg.Index))
		builder.WriteString(fmt.Sprintf("%s --> %s\n", seg.Start, seg.End))
		builder.WriteString(fmt.Sprintf("%s\n\n", seg.TranslatedText))
	}

	finalSRT := builder.String()

	err = RunDialogueE2EPipeline(ctx, taskId, allTranslated, cmap, req.CharacterVoices, req.TargetLang, apiKey, updateProgress)
	if err != nil {
		logx.Error("E2E Dialogue Pipeline execution failed", err)
		updateProgress("failed", 0, totalChunks, totalChunks, "Pipeline execution failed: "+err.Error(), "", "Lỗi xử lý luồng E2E: "+err.Error(), nil)
		return
	}

	updateProgress("succeed", 100, totalChunks, totalChunks, "", finalSRT, "Toàn bộ quy trình 1-Click đã hoàn thành xuất sắc!", nil)
}
