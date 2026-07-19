package services

import (
	"fmt"
	"math"
	"strings"
)

// DeduplicateOCR nhận mảng phân đoạn OCR thô và gom cụm các văn bản giống/gần giống nhau
func DeduplicateOCR(raw []VideoOCRSegment) []VideoOCRSegment {
	if len(raw) == 0 {
		return nil
	}

	var result []VideoOCRSegment
	current := raw[0]

	for i := 1; i < len(raw); i++ {
		next := raw[i]

		// Tính khoảng tương đồng (Similarity) đơn giản hoặc so sánh text
		if isSimilarText(current.RawText, next.RawText) {
			// Giữ text dài hơn/rõ hơn, không đổi timestamp bắt đầu của block
			if len(next.RawText) > len(current.RawText) {
				current.RawText = next.RawText
			}
		} else {
			result = append(result, current)
			current = next
		}
	}
	result = append(result, current)
	return result
}

// isSimilarText kiểm tra xem 2 dòng OCR có tương đồng nhau không (lọc nhiễu lệch ký tự nhẹ)
func isSimilarText(s1, s2 string) bool {
	s1 = cleanText(s1)
	s2 = cleanText(s2)
	if s1 == s2 {
		return true
	}
	if len(s1) == 0 || len(s2) == 0 {
		return false
	}
	
	// Thuật toán khoảng cách Levenshtein đơn giản
	dist := levenshteinDistance(s1, s2)
	maxLen := math.Max(float64(len(s1)), float64(len(s2)))
	
	// Nếu sai lệch ít hơn 30% tổng chiều dài ký tự -> coi như trùng
	return float64(dist)/maxLen < 0.3
}

func cleanText(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "\n", "")
	return s
}

func levenshteinDistance(s, t string) int {
	d := make([][]int, len(s)+1)
	for i := range d {
		d[i] = make([]int, len(t)+1)
	}
	for i := range d {
		d[i][0] = i
	}
	for j := range d[0] {
		d[0][j] = j
	}
	for j := 1; j <= len(t); j++ {
		for i := 1; i <= len(s); i++ {
			if s[i-1] == t[j-1] {
				d[i][j] = d[i-1][j-1]
			} else {
				d[i][j] = min(d[i-1][j]+1, min(d[i][j-1]+1, d[i-1][j-1]+1))
			}
		}
	}
	return d[len(s)][len(t)]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GenerateSRTFromSegments chuyển đổi các đoạn OCR đã deduplicate thành cấu trúc file SRT chuẩn
func GenerateSRTFromSegments(segments []VideoOCRSegment) string {
	var sb strings.Builder
	for idx, seg := range segments {
		startMs := int(seg.Timestamp * 1000)
		// Giả định thời lượng hiển thị mỗi sub là 3 giây hoặc kéo dài tới sát frame tiếp theo
		endMs := startMs + 3000 
		
		sb.WriteString(fmt.Sprintf("%d\n", idx+1))
		sb.WriteString(fmt.Sprintf("%s --> %s\n", formatMsToSRTTime(startMs), formatMsToSRTTime(endMs)))
		sb.WriteString(seg.RawText + "\n\n")
	}
	return sb.String()
}

func formatMsToSRTTime(ms int) string {
	h := ms / 3600000
	ms %= 3600000
	m := ms / 60000
	ms %= 60000
	s := ms / 1000
	nms := ms % 1000
	return fmt.Sprintf("%02d:%02d:%02d,%03d", h, m, s, nms)
}
