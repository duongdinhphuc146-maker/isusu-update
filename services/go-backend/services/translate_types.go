package services

import (
	"sync"
)

// TranslateRequest represents a request to translate an SRT file.
type CharacterVoice struct {
	ID         string `json:"id"`
	VoiceType  string `json:"voice_type"`
	ResourceID string `json:"resource_id"`
}

// TranslateRequest represents a request to translate an SRT file.
type TranslateRequest struct {
	SRTText         string           `json:"srt_text"`
	TargetLang      string           `json:"target_lang"`
	Provider        string           `json:"provider"`
	SessionId       string           `json:"session_id,omitempty"`
	DialogueMode    bool             `json:"dialogue_mode,omitempty"`
	Stage           string           `json:"stage,omitempty"`            // "profile" | "dub"
	TaskId          string           `json:"task_id,omitempty"`          // used in "dub" stage
	CharacterVoices []CharacterVoice `json:"character_voices,omitempty"` // mapped voices
}

// TranslatedSegment represents a single translated subtitle segment.
type TranslatedSegment struct {
	Index          int    `json:"index"`
	Start          string `json:"start"`
	End            string `json:"end"`
	OriginalText   string `json:"original_text"`
	TranslatedText string `json:"translated_text"`
	Speaker        string `json:"speaker,omitempty"`
	Emotion        string `json:"emotion,omitempty"`
}

type MultiTaskResult struct {
	ID      int    `json:"id"`
	Speaker string `json:"speaker"`
	Emotion string `json:"emotion"`
	Text    string `json:"text"`
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
	CharacterMap    *CharacterMap `json:"character_map,omitempty"`
	AudioUrl        string   `json:"audio_url,omitempty"`
}

// InFlightTranslateTasks stores active translation task progress.
// Maps TaskId (string) -> *TranslateTaskProgress
var InFlightTranslateTasks sync.Map
