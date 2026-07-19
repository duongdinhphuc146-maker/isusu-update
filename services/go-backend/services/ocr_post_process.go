package services

import (
	"regexp"
	"strings"
)

// CleanOCRErrors làm sạch các lỗi OCR phổ biến: ký tự lạ, khoảng trắng thừa, dấu câu lỗi...
func CleanOCRErrors(text string) string {
	// Lọc bỏ ký tự rác phi văn bản thường thấy ở rìa ảnh OCR
	reg := regexp.MustCompile(`[~` + "`" + `@#\$%\^\&\*\(\)_\+=\{\}\[\]\|\\<>\/]+`)
	text = reg.ReplaceAllString(text, "")

	// Loại bỏ nhiều dấu cách liền nhau
	spaceReg := regexp.MustCompile(`\s+`)
	text = spaceReg.ReplaceAllString(text, " ")

	// Chuẩn hóa dấu tiếng Việt/Trung nếu cần
	text = strings.TrimSpace(text)
	
	return text
}
