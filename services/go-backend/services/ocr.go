package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"go-backend/services/go-backend/internal/httpx"
)

func getBridgeURLForOCR() string {
	port := os.Getenv("AI_BRIDGE_PORT")
	if port == "" {
		port = "5001"
	}
	return "http://127.0.0.1:" + port
}

func HandleOCRCaptureStart(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Provider string `json:"provider"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	bridgeURL := fmt.Sprintf("%s/capture/start", getBridgeURLForOCR())
	bodyBytes, _ := json.Marshal(req)

	resp, err := http.Post(bridgeURL, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		httpx.WriteError(w, "Failed to connect to bridge: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func HandleOCRCaptureStop(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bridgeURL := fmt.Sprintf("%s/capture/stop", getBridgeURLForOCR())
	resp, err := http.Post(bridgeURL, "application/json", nil)
	if err != nil {
		httpx.WriteError(w, "Failed to connect to bridge: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func HandleOCRListSessions(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bridgeURL := fmt.Sprintf("%s/sessions", getBridgeURLForOCR())
	resp, err := http.Get(bridgeURL)
	if err != nil {
		httpx.WriteJSON(w, []interface{}{})
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func HandleOCRDeleteSession(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Provider string `json:"provider"`
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	bridgeURL := fmt.Sprintf("%s/sessions/%s", getBridgeURLForOCR(), req.Provider)
	bridgeReq, err := http.NewRequest("DELETE", bridgeURL, nil)
	if err != nil {
		httpx.WriteError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(bridgeReq)
	if err != nil {
		httpx.WriteError(w, "Failed to connect to bridge: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func HandleOCR(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "POST" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Provider string `json:"provider"`
		Image    string `json:"image"` // base64 string
	}
	if err := httpx.ParseJSON(r, &req); err != nil {
		httpx.WriteError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	bridgeURL := fmt.Sprintf("%s/ocr/replay", getBridgeURLForOCR())
	bodyBytes, _ := json.Marshal(req)

	resp, err := http.Post(bridgeURL, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		httpx.WriteError(w, "Failed to connect to bridge: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}
