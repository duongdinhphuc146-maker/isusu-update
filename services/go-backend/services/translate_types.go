package services

import (
	"sync"
)

// TranslateRequest represents a request to translate an SRT file.
type TranslateRequest struct {
	SRTText    string `json:"srt_text"`
	TargetLang string `json:"target_lang"`
	Provider   string `json:"provider"`
	SessionId  string `json:"session_id,omitempty"`
}

// TranslatedSegment represents a single translated subtitle segment.
type TranslatedSegment struct {
	Index        int    `json:"index"`
	Start        string `json:"start"`
	End          string `json:"end"`
	OriginalText string `json:"original_text"`
	TranslatedText string `json:"translated_text"`
}

// TranslateTaskProgress represents the status and progress of an active translation task.
type TranslateTaskProgress struct {
	TaskId          string   `json:"task_id"`
	Status          string   `json:"status"` // "pending", "processing", "succeed", "failed"
	Progress        int      `json:"progress"` // 0-100
	TotalChunks     int      `json:"total_chunks"`
	CompletedChunks int      `json:"completed_chunks"`
	Error           string   `json:"error,omitempty"`
	TranslatedSRT   string   `json:"translated_srt,omitempty"`
	Logs            []string `json:"logs,omitempty"`
}

// InFlightTranslateTasks stores active translation task progress.
// Maps TaskId (string) -> *TranslateTaskProgress
var InFlightTranslateTasks sync.Map
