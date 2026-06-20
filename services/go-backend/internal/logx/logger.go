package logx

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// LogEntry represents a structured JSON log entry.
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Error     string                 `json:"error,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

func logMessage(level string, message string, err error, fields ...interface{}) {
	entry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Level:     level,
		Message:   message,
	}
	if err != nil {
		entry.Error = err.Error()
	}
	if len(fields) > 0 {
		entry.Fields = make(map[string]interface{})
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				key, ok := fields[i].(string)
				if ok {
					entry.Fields[key] = fields[i+1]
				} else {
					entry.Fields[fmt.Sprintf("key_%d", i)] = fields[i]
					entry.Fields[fmt.Sprintf("val_%d", i)] = fields[i+1]
				}
			} else {
				entry.Fields["extra"] = fields[i]
			}
		}
	}
	bytes, _ := json.Marshal(entry)
	fmt.Fprintln(os.Stdout, string(bytes))
}

// Info logs message at INFO level.
func Info(msg string, fields ...interface{}) {
	logMessage("INFO", msg, nil, fields...)
}

// Error logs message at ERROR level.
func Error(msg string, err error, fields ...interface{}) {
	logMessage("ERROR", msg, err, fields...)
}
