package middleware

import (
	"log"
	"net/http"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func RequestLoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{w, http.StatusOK}
		
		log.Printf("[REQUEST START] Method: %s Path: %s Origin: %s", r.Method, r.URL.Path, r.Header.Get("Origin"))
		
		next.ServeHTTP(rw, r)
		
		duration := time.Since(start)
		log.Printf("[REQUEST END] Method: %s Path: %s Status: %d Duration: %v", r.Method, r.URL.Path, rw.statusCode, duration)
	})
}
