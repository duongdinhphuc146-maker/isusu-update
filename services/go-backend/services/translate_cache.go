package services

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"go-backend/services/go-backend/internal/logx"
)

// CachedTranslation holds cached data for a translated segment.
type CachedTranslation struct {
	OriginalText   string `json:"original_text"`
	TranslatedText string `json:"translated_text"`
	TargetLang     string `json:"target_lang"`
	Provider       string `json:"provider"`
}

func getCacheDir() string {
	wd, _ := os.Getwd()
	dir := filepath.Join(wd, "cache", "translations")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

// GetCacheKey computes MD5 hash of original text, target language, and provider.
func GetCacheKey(text, targetLang, provider string) string {
	hasher := md5.New()
	hasher.Write([]byte(text + "||" + targetLang + "||" + provider))
	return hex.EncodeToString(hasher.Sum(nil))
}

// GetCachedTranslation retrieves translated text from cache if it exists.
func GetCachedTranslation(key string) (string, bool) {
	cacheFile := filepath.Join(getCacheDir(), key+".json")
	if _, err := os.Stat(cacheFile); os.IsNotExist(err) {
		return "", false
	}

	data, err := os.ReadFile(cacheFile)
	if err != nil {
		logx.Error("Failed to read translation cache file", err, "file", cacheFile)
		return "", false
	}

	var cache CachedTranslation
	if err := json.Unmarshal(data, &cache); err != nil {
		logx.Error("Failed to unmarshal translation cache data", err)
		return "", false
	}

	return cache.TranslatedText, true
}

// SetCachedTranslation writes translation result to the cache.
func SetCachedTranslation(key, originalText, translatedText, targetLang, provider string) {
	cache := CachedTranslation{
		OriginalText:   originalText,
		TranslatedText: translatedText,
		TargetLang:     targetLang,
		Provider:       provider,
	}

	data, err := json.Marshal(cache)
	if err != nil {
		logx.Error("Failed to marshal translation cache data", err)
		return
	}

	cacheFile := filepath.Join(getCacheDir(), key+".json")
	if err := os.WriteFile(cacheFile, data, 0644); err != nil {
		logx.Error("Failed to write translation cache file", err, "file", cacheFile)
	}
}
