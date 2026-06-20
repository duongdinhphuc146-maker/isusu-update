package main

import (
	"go-backend/services/go-backend/api"
	"go-backend/services/go-backend/internal/config"
	"go-backend/services/go-backend/middleware"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	// Look for .env file at workspace root or locally
	wd, _ := os.Getwd()
	envPath := filepath.Join(wd, ".env")
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		envPath = filepath.Join(filepath.Dir(filepath.Dir(wd)), ".env")
	}

	log.Printf("[GATEWAY] Loading environment variables from: %s", envPath)
	if err := config.LoadEnv(envPath); err != nil {
		log.Printf("[GATEWAY WARNING] Failed to load .env: %v", err)
	}

	// Initialize secrets inside auth middleware
	middleware.InitAuthKeys()

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	router := api.NewRouter()

	log.Printf("[GATEWAY] Starting secured API Gateway on Port %s...", port)
	if err := http.ListenAndServe("127.0.0.1:"+port, router); err != nil {
		log.Fatalf("[GATEWAY FATAL] Server failed: %v", err)
	}
}
