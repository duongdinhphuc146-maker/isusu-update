package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	JwtSecret   = []byte("default_fallback_jwt_secret_capcut_studio_3")
	LocalApiKey = "local_development_fallback_api_key_123"
)

func InitAuthKeys() {
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		JwtSecret = []byte(secret)
	}
	if key := os.Getenv("LOCAL_API_KEY"); key != "" {
		LocalApiKey = key
	}
}

type Claims struct {
	SessionID string `json:"session_id"`
	jwt.RegisteredClaims
}

func GenerateJWT() (string, string, error) {
	now := time.Now()
	// Access Token (Expires in 15 mins)
	atClaims := &Claims{
		SessionID: "local_session",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, atClaims)
	atStr, err := accessToken.SignedString(JwtSecret)
	if err != nil {
		return "", "", err
	}

	// Refresh Token (Expires in 7 days)
	rtClaims := &Claims{
		SessionID: "local_session_refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, rtClaims)
	rtStr, err := refreshToken.SignedString(JwtSecret)
	return atStr, rtStr, err
}

func ValidateToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return JwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Allow Options requests, public path check, and static asset routes (/cache/ and /projects/)
		if r.Method == "OPTIONS" || r.URL.Path == "/api/health" || 
			strings.HasPrefix(r.URL.Path, "/cache/") || 
			strings.HasPrefix(r.URL.Path, "/projects/") {
			next.ServeHTTP(w, r)
			return
		}

		// 2. Check X-API-Key
		apiKey := r.Header.Get("X-API-Key")
		if apiKey == LocalApiKey {
			next.ServeHTTP(w, r)
			return
		}

		// 3. Check Authorization Bearer Token (JWT)
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				if _, err := ValidateToken(parts[1]); err == nil {
					next.ServeHTTP(w, r)
					return
				}
			}
		}

		http.Error(w, `{"error": "Unauthorized - Missing or invalid API Key / JWT Token"}`, http.StatusUnauthorized)
	})
}
