package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type PipelineStageProgress struct {
	Stage           string   `json:"stage"` // "idle", "extract_frames", "ocr", "translate", "dubbing", "render"
	Status          string   `json:"status"` // "pending", "processing", "succeed", "failed"
	ProgressPercent int      `json:"progress_percent"`
	Logs            []string `json:"logs"`
	Error           string   `json:"error"`
}

type PipelineProgress struct {
	ProjectID string                            `json:"project_id"`
	Status    string                            `json:"status"` // "pending", "processing", "succeed", "failed"
	Stages    map[string]*PipelineStageProgress `json:"stages"`
}

var ActivePipelines sync.Map

// RunOneClickPipeline điều phối và quản lý toàn bộ luồng tự động hóa
func RunOneClickPipeline(
	ctx context.Context,
	projectID string,
	provider string,
	targetLang string,
	voiceID string,
	resourceID string,
	updateProgress func(stage string, status string, percent int, logLine string),
) error {
	updateProgress("extract_frames", "processing", 10, "Bắt đầu trích xuất frame từ video...")

	// 1. Trích xuất frames
	videoPath, err := findProjectVideo(projectID)
	if err != nil {
		updateProgress("extract_frames", "failed", 0, "Không tìm thấy video: "+err.Error())
		return err
	}

	wd, _ := os.Getwd()
	framesDir := filepath.Join(wd, "projects", projectID, "frames")
	_ = os.MkdirAll(framesDir, 0755)

	extractReq := FrameExtractionRequest{
		ProjectID: projectID,
		Mode:      "interval",
		Interval:  5,
		MaxFrames: 200,
	}
	_, err = extractByInterval(videoPath, framesDir, extractReq)
	if err != nil {
		updateProgress("extract_frames", "failed", 0, "Trích xuất frame thất bại: "+err.Error())
		return err
	}
	updateProgress("extract_frames", "succeed", 100, "Trích xuất frame hoàn thành thành công!")

	// 2. Chạy OCR Pipeline
	updateProgress("ocr", "processing", 10, "Bắt đầu trích xuất phụ đề cứng bằng OCR...")
	ocrUpdate := func(status string, percent int, logLine string, srt string) {
		updateProgress("ocr", status, percent, logLine)
	}
	srtText, err := RunVideoOCRPipeline(ctx, projectID, provider, ocrUpdate)
	if err != nil {
		updateProgress("ocr", "failed", 0, "OCR phụ đề thất bại: "+err.Error())
		return err
	}
	updateProgress("ocr", "succeed", 100, "Hoàn thành nhận dạng phụ đề cứng.")

	// 3. Dịch thuật SRT
	updateProgress("translate", "processing", 10, "Bắt đầu dịch thuật phụ đề...")
	
	// Khởi tạo segments từ kết quả OCR
	segments := ParseSRT(srtText)
	if len(segments) == 0 {
		err = fmt.Errorf("không tìm thấy phụ đề nào để dịch")
		updateProgress("translate", "failed", 0, err.Error())
		return err
	}

	// Chạy translate worker bất đồng bộ (giả định dùng session/API key đã thiết lập trong env)
	translateTaskID := "pipeline_trans_" + projectID
	transProgress := &TranslateTaskProgress{
		TaskId:   translateTaskID,
		Status:   "pending",
		Progress: 0,
	}
	InFlightTranslateTasks.Store(translateTaskID, transProgress)

	TranslateRequestData := TranslateRequest{
		SRTText:      srtText,
		TargetLang:   targetLang,
		Provider:     provider,
		DialogueMode: false,
	}
	
	// Gọi trực tiếp worker chạy đồng bộ cho tới khi dịch xong
	TranslateWorker(translateTaskID, TranslateRequestData, segments)

	// Lấy kết quả dịch
	val, ok := InFlightTranslateTasks.Load(translateTaskID)
	if !ok {
		err = fmt.Errorf("lỗi đồng bộ tác vụ dịch thuật")
		updateProgress("translate", "failed", 0, err.Error())
		return err
	}
	finalTransTask := val.(*TranslateTaskProgress)
	if finalTransTask.Status != "succeed" {
		err = fmt.Errorf("dịch thuật phụ đề thất bại: %s", finalTransTask.Error)
		updateProgress("translate", "failed", 0, err.Error())
		return err
	}
	
	updateProgress("translate", "succeed", 100, "Hoàn thành dịch phụ đề sang ngôn ngữ đích.")

	// 4. Lồng tiếng tự động (TTS & Dubbing)
	updateProgress("dubbing", "processing", 10, "Bắt đầu sinh giọng nói và khớp khớp nối thời gian...")

	dubAudioPath := filepath.Join("projects", projectID, "exports", "dubbed_voice.mp3")
	dubAudioFullPath := filepath.Join(wd, dubAudioPath)
	_ = os.MkdirAll(filepath.Dir(dubAudioFullPath), 0755)

	// Build jobs lồng tiếng cho từng segment dịch
	translatedSegs := ParseSRT(finalTransTask.TranslatedSRT)
	var ttsJobs []TTSJob
	for idx, s := range translatedSegs {
		// Ước tính tốc độ đọc
		durSec := parseSRTDuration(s.Start, s.End)
		res := EstimateRate(s.Text, durSec, GetVoiceCPS(targetLang))
		rateStr := fmt.Sprintf("%.1f", res.Rate)

		ttsJobs = append(ttsJobs, TTSJob{
			Index:      idx,
			Text:       s.Text,
			Voice:      voiceID,
			ResourceID: resourceID,
			Rate:       rateStr,
		})
	}

	ttsResults := RunTTSWorkerPool(ctx, ttsJobs, 5, func(comp, tot int, res TTSJobResult) {
		updateProgress("dubbing", "processing", 10+(comp*70/tot), fmt.Sprintf("Đang chuyển đổi giọng đọc %d/%d...", comp, tot))
	})

	// Tải và trộn ghép audio thành timeline đồng bộ
	updateProgress("dubbing", "processing", 90, "Đang ghép nối các clip giọng nói đồng bộ timeline...")
	var splitPaths = make(map[int]string)
	for idx, res := range ttsResults {
		if res.Error != nil {
			continue
		}
		hash := fmt.Sprintf("pipeline_dub_%s_%d", projectID, res.Index)
		localPath, err := DownloadAndCacheAudio(res.AudioURL, hash)
		if err == nil {
			splitPaths[idx] = localPath
		}
	}

	// Render timeline âm thanh thô
	var mergedSegs []MergedSegment
	for idx, s := range translatedSegs {
		durSec := parseSRTDuration(s.Start, s.End)
		mergedSegs = append(mergedSegs, MergedSegment{
			ID:          idx,
			StartSec:    parseSRTTimeToSec(s.Start),
			EndSec:      parseSRTTimeToSec(s.End),
			DurationSec: durSec,
			ChildIDs:    []int{idx},
		})
	}

	timeline := BuildTimeline(mergedSegs, splitPaths)
	err = RenderTimeline(timeline, filepath.Join(wd, "projects", projectID), dubAudioFullPath)
	if err != nil {
		updateProgress("dubbing", "failed", 0, "Tổng hợp âm thanh lồng tiếng thất bại: "+err.Error())
		return err
	}
	updateProgress("dubbing", "succeed", 100, "Hoàn thành tạo file âm thanh lồng tiếng đồng bộ.")

	// 5. Render Video & Subtitles
	updateProgress("render", "processing", 10, "Bắt đầu mux video xuất bản và burn-in phụ đề...")

	renderReq := RenderRequest{
		ProjectID:    projectID,
		AudioPath:    filepath.Join("projects", projectID, "exports", "dubbed_voice.mp3"),
		SubtitlePath: filepath.Join("projects", projectID, "subtitles", "ocr_extracted.srt"), // sử dụng bản thô hoặc bản dịch
		SubtitleMode: "burn",
		OutputFormat: "mp4",
		Resolution:   "source",
	}
	
	outputPath := filepath.Join(wd, "projects", projectID, "exports", "output.mp4")
	err = renderFullVideo(videoPath, renderReq, filepath.Join(wd, "projects", projectID), outputPath)
	if err != nil {
		updateProgress("render", "failed", 0, "Xuất bản video thất bại: "+err.Error())
		return err
	}

	updateProgress("render", "succeed", 100, "Xuất bản video thành công! File sẵn sàng để tải xuống.")
	return nil
}

func parseSRTDuration(start, end string) float64 {
	return parseSRTTimeToSec(end) - parseSRTTimeToSec(start)
}

func parseSRTTimeToSec(t string) float64 {
	var h, m, s, ms int
	_, err := fmt.Sscanf(t, "%d:%d:%d,%d", &h, &m, &s, &ms)
	if err != nil {
		return 0
	}
	return float64(h*3600 + m*60 + s) + float64(ms)/1000.0
}
