package main

import (
	"bytes"
	"encoding/json"
	"go-backend/services/go-backend/api"
	"go-backend/services/go-backend/internal/config"
	"go-backend/services/go-backend/middleware"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestMain(m *testing.M) {
	wd, _ := os.Getwd()
	envPath := filepath.Join(wd, ".env")
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		envPath = filepath.Join(filepath.Dir(filepath.Dir(wd)), ".env")
	}
	_ = config.LoadEnv(envPath)
	middleware.InitAuthKeys()
	os.Exit(m.Run())
}

func TestGatewayHealth(t *testing.T) {
	router := api.NewRouter()

	req, _ := http.NewRequest("GET", "/api/health", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("health endpoint returned wrong status: got %v want %v", status, http.StatusOK)
	}

	var body map[string]string
	json.NewDecoder(rr.Body).Decode(&body)

	if body["status"] != "healthy" {
		t.Errorf("expected health status to be 'healthy', got '%s'", body["status"])
	}
}

func TestGatewayAuthUnauthorized(t *testing.T) {
	router := api.NewRouter()

	// Request without X-API-Key or Authorization header
	req, _ := http.NewRequest("POST", "/api/tts", bytes.NewBuffer([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 Unauthorized for missing API key, got %d", rr.Code)
	}
}

func TestGatewayAuthAuthorized(t *testing.T) {
	router := api.NewRouter()

	// Request with valid Local API Key
	req, _ := http.NewRequest("POST", "/api/tts", bytes.NewBuffer([]byte(`{"text":"test","voice":"BV074_streaming","resource_id":"7102355709945188865","rate":"1.0"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "capcut_local_secret_key_2026")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	// Since we mock/use direct sami TTS call, it might timeout or succeed.
	// But it shouldn't return 401 Unauthorized.
	if rr.Code == http.StatusUnauthorized {
		t.Errorf("expected request to be authorized, but got 401 Unauthorized")
	}
}
