package middleware

import (
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Rate Limiter
type clientLimiter struct {
	tokens     float64
	lastAccess time.Time
}

var (
	limitersMu sync.Mutex
	limiters   = make(map[string]*clientLimiter)
	rateLimit  = 5.0  // tokens per second
	burstLimit = 15.0 // max burst tokens
)

func LimitRate(ip string) bool {
	limitersMu.Lock()
	defer limitersMu.Unlock()

	limiter, exists := limiters[ip]
	now := time.Now()
	if !exists {
		limiters[ip] = &clientLimiter{
			tokens:     burstLimit,
			lastAccess: now,
		}
		return true
	}

	elapsed := now.Sub(limiter.lastAccess).Seconds()
	limiter.lastAccess = now
	limiter.tokens += elapsed * rateLimit
	if limiter.tokens > burstLimit {
		limiter.tokens = burstLimit
	}

	if limiter.tokens >= 1.0 {
		limiter.tokens -= 1.0
		return true
	}
	return false
}

func RateLimiterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		if !LimitRate(ip) {
			http.Error(w, `{"error": "Too many requests. Rate limit exceeded."}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// CSRF & Origin Protection
func CSRFMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "OPTIONS" {
			origin := r.Header.Get("Origin")
			referer := r.Header.Get("Referer")

			// Require local origin
			valid := false
			if origin != "" && (strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")) {
				valid = true
			}
			if referer != "" && (strings.HasPrefix(referer, "http://localhost:") || strings.HasPrefix(referer, "http://127.0.0.1:")) {
				valid = true
			}
			if !valid && origin == "" && referer == "" {
				// Accept same-device requests without browser headers (e.g. CLI or direct native app requests)
				valid = true
			}

			if !valid {
				http.Error(w, `{"error": "Forbidden - CSRF validation failed"}`, http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// Path Traversal Security Verification helper
func IsPathSafe(baseDir, targetPath string) (string, error) {
	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		return "", err
	}
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return "", err
	}

	// Verify targetPath is a subpath of baseDir
	rel, err := filepath.Rel(absBase, absTarget)
	if err != nil {
		return "", err
	}

	if strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", fmt.Errorf("directory traversal detected: path falls outside base directory")
	}

	return absTarget, nil
}
