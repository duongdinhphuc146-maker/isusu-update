package config

import (
	"bufio"
	"os"
	"strings"
)

const (
	AppVersion = "3.1.0-portable"
	APIVersion = "v3"
	BuildDate  = "2026-06-19"
)

func LoadEnv(path string) error {
	file, err := os.Open(path)
	if err != nil {
		// Fallback to existing environment variables if no file
		return nil
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			// Strip optional quotes
			if strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"") {
				val = val[1 : len(val)-1]
			}
			if os.Getenv(key) == "" {
				os.Setenv(key, val)
			}
		}
	}
	return scanner.Err()
}
