package main

import (
	"context"
	"errors"
	"go-backend/services/go-backend/api"
	"go-backend/services/go-backend/internal/config"
	"go-backend/services/go-backend/middleware"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

func cleanupTempFiles() {
	wd, err := os.Getwd()
	if err != nil {
		return
	}

	dirsToClean := []string{
		wd,
		filepath.Join(wd, "cache"),
	}

	now := time.Now()
	for _, dir := range dirsToClean {
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			continue
		}
		_ = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if !info.IsDir() && (strings.HasSuffix(strings.ToLower(info.Name()), ".tmp") || strings.HasPrefix(strings.ToLower(info.Name()), "tmp_")) {
				if now.Sub(info.ModTime()) > 1*time.Hour {
					log.Printf("[CLEANUP] Removing old temp file: %s", path)
					_ = os.Remove(path)
				}
			}
			return nil
		})
	}
}

func main() {
	wd, _ := os.Getwd()
	envPath := filepath.Join(wd, ".env")
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		envPath = filepath.Join(filepath.Dir(filepath.Dir(wd)), ".env")
	}

	log.Printf("[GATEWAY] Loading environment variables from: %s", envPath)
	if err := config.LoadEnv(envPath); err != nil {
		log.Printf("[GATEWAY WARNING] Failed to load .env: %v", err)
	}

	middleware.InitAuthKeys()

	// Clean up temporary files on startup
	cleanupTempFiles()

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	router := api.NewRouter()
	srv := &http.Server{
		Addr:    "127.0.0.1:" + port,
		Handler: router,
	}

	// Channel to listen for interrupts to shut down gracefully
	idleConnsClosed := make(chan struct{})
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		log.Printf("[GATEWAY] Shutting down server gracefully...")

		// Enforce a timeout context for shutdown
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("[GATEWAY ERROR] Graceful shutdown failed: %v", err)
		}
		close(idleConnsClosed)
	}()

	log.Printf("[GATEWAY] Starting secured API Gateway on Port %s...", port)
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("[GATEWAY FATAL] Server failed: %v", err)
	}

	<-idleConnsClosed
	log.Printf("[GATEWAY] Server stopped.")
}
