package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"go-backend/services/go-backend/internal/logx"
)

func RunDialogueE2EPipeline(
	ctx context.Context,
	taskId string,
	allTranslated []TranslatedSegment,
	cmap *CharacterMap,
	characterVoices []CharacterVoice,
	targetLang string,
	apiKey string,
	updateProgress func(status string, progressPercent int, completed int, total int, errStr string, srt string, logLine string, cmap *CharacterMap),
) error {
	updateProgress("processing", 78, 1, 1, "", "", "[Merge] Bắt đầu hợp nhất các đoạn thoại cùng nhân vật và cảm xúc...", nil)
	merged := MergeSegments(allTranslated)
	updateProgress("processing", 82, 1, 1, "", "", fmt.Sprintf("[Merge] Hợp nhất thành công %d cụm hội thoại.", len(merged)), nil)

	updateProgress("processing", 84, 1, 1, "", "", "[Speed] Đang tối ưu hóa tốc độ đọc và rút gọn câu thoại dài...", nil)
	for i, m := range merged {
		res := EstimateRate(m.Text, m.DurationSec, GetVoiceCPS(targetLang))
		if res.NeedsShortening && apiKey != "" {
			shortText, err := ShortenText(ctx, m.Text, 0.25, apiKey)
			if err == nil {
				merged[i].Text = shortText
			}
		}
	}

	customVoiceMap := make(map[string]CharacterVoice)
	for _, cv := range characterVoices {
		customVoiceMap[cv.ID] = cv
	}

	speakerVoiceMap := make(map[string]struct{ voice, resource string })
	maleVoice, maleRes := GetDefaultVoiceForLanguage(targetLang, "male")
	femaleVoice, femaleRes := GetDefaultVoiceForLanguage(targetLang, "female")

	for _, char := range cmap.Characters {
		if cv, exists := customVoiceMap[char.ID]; exists && cv.VoiceType != "" {
			speakerVoiceMap[char.ID] = struct{ voice, resource string }{cv.VoiceType, cv.ResourceID}
		} else {
			if IsMaleGender(char.Gender) {
				speakerVoiceMap[char.ID] = struct{ voice, resource string }{maleVoice, maleRes}
			} else {
				speakerVoiceMap[char.ID] = struct{ voice, resource string }{femaleVoice, femaleRes}
			}
		}
	}

	var ttsJobs []TTSJob
	for _, m := range merged {
		vinfo, ok := speakerVoiceMap[m.Speaker]
		voice := "BV074_streaming"
		resourceID := "7102355709945188865"
		if ok {
			voice = vinfo.voice
			resourceID = vinfo.resource
		}
		res := EstimateRate(m.Text, m.DurationSec, GetVoiceCPS(targetLang))
		rateStr := fmt.Sprintf("%.1f", res.Rate)

		ttsJobs = append(ttsJobs, TTSJob{
			Index:      m.ID,
			Text:       m.Text,
			Voice:      voice,
			ResourceID: resourceID,
			Rate:       rateStr,
		})
	}

	updateProgress("processing", 86, 1, 1, "", "", fmt.Sprintf("[TTS] Bắt đầu chuyển đổi giọng nói song song cho %d cụm thoại...", len(ttsJobs)), nil)
	ttsResults := RunTTSWorkerPool(ctx, ttsJobs, 5, func(comp int, tot int, res TTSJobResult) {
		updateProgress("processing", 86+(comp*10/tot), 1, 1, "", "", fmt.Sprintf("  - [TTS] Đã sinh xong giọng nói cho cụm thoại %d/%d.", comp, tot), nil)
	})

	projectDir := filepath.Join("projects", "dialogue_"+taskId)
	_ = os.MkdirAll(projectDir, 0755)
	_ = SaveCharacterMap(cmap, projectDir)

	var srtSegs []SRTSegment
	for _, t := range allTranslated {
		srtSegs = append(srtSegs, SRTSegment{
			Index: t.Index,
			Start: t.Start,
			End:   t.End,
			Text:  t.TranslatedText,
		})
	}
	_ = ExportMetadata(srtSegs, projectDir)

	updateProgress("processing", 96, 1, 1, "", "", "[Split] Bắt đầu cắt ghép âm thanh khớp với timeline phụ đề...", nil)
	splitClipPaths := make(map[int]string)
	wd, _ := os.Getwd()

	for _, res := range ttsResults {
		if res.Error != nil {
			continue
		}

		hash := fmt.Sprintf("dialogue_block_%s_%d", taskId, res.Index)
		_, err := DownloadAndCacheAudio(res.AudioURL, hash)
		if err != nil {
			continue
		}
		localPath := filepath.Join(wd, "cache", hash+".mp3")

		var currentMerged MergedSegment
		for _, m := range merged {
			if m.ID == res.Index {
				currentMerged = m
				break
			}
		}

		pcmSamples, err := DecodeToPCM(localPath, 44100)
		var childTexts []string
		for _, cid := range currentMerged.ChildIDs {
			for _, t := range allTranslated {
				if t.Index == cid {
					childTexts = append(childTexts, t.TranslatedText)
					break
				}
			}
		}

		var silenceRegions []SilenceRegion
		if err == nil {
			silenceRegions = DetectSilence(pcmSamples, 44100, -35.0, 200)
		}

		splitPCMClips := SplitAudioPCM(pcmSamples, silenceRegions, len(currentMerged.ChildIDs), childTexts)

		for idx, childID := range currentMerged.ChildIDs {
			outWav := filepath.Join(projectDir, fmt.Sprintf("split_child_%d.wav", childID))
			err = EncodePCMToWav(splitPCMClips[idx], 44100, outWav)
			if err == nil {
				splitClipPaths[childID] = outWav
			}
		}
	}

	updateProgress("processing", 98, 1, 1, "", "", "[Render] Đang kết xuất tệp âm thanh đồng bộ hoàn chỉnh...", nil)
	timeline := BuildTimeline(merged, splitClipPaths)
	finalAudioPath := filepath.Join(projectDir, "final_timeline_mix.mp3")

	err := RenderTimeline(timeline, projectDir, finalAudioPath)
	if err != nil {
		logx.Error("E2E Dialogue Timeline rendering failed", err)
		return err
	}
	return nil
}
