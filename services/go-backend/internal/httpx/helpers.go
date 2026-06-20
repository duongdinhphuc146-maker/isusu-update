package httpx

import (
	"encoding/json"
	"net/http"
)

// SetCORSHeaders sets standard CORS headers. Returns true if request was OPTIONS and handles it.
func SetCORSHeaders(w http.ResponseWriter, r *http.Request) bool {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization, X-Save-Reason")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return true
	}
	return false
}

// WriteJSON encodes data as JSON and writes it.
func WriteJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(data)
}

// WriteError sends a JSON formatted error response.
func WriteError(w http.ResponseWriter, errMsg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
}

// ParseJSON decodes JSON body into the target pointer.
func ParseJSON(r *http.Request, target interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}
