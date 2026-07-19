package services

import (
	"net/http"

	"go-backend/services/go-backend/internal/httpx"
)

type RenderPreset struct {
	Name        string `json:"name"`
	Resolution  string `json:"resolution"`
	Fps         string `json:"fps"`
	VideoBitrate string `json:"video_bitrate"`
	Description string `json:"description"`
}

// HandleRenderPresets trả về danh sách preset chất lượng xuất video
func HandleRenderPresets(w http.ResponseWriter, r *http.Request) {
	if httpx.SetCORSHeaders(w, r) {
		return
	}
	if r.Method != "GET" {
		httpx.WriteError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	presets := []RenderPreset{
		{Name: "YouTube 1080p", Resolution: "1920x1080", Fps: "30", VideoBitrate: "8M", Description: "Được tối ưu hóa cho nền tảng chia sẻ YouTube FHD"},
		{Name: "TikTok 9:16", Resolution: "1080x1920", Fps: "30", VideoBitrate: "6M", Description: "Định dạng đứng tối ưu cho TikTok/Reels"},
		{Name: "HD Phổ Thông 720p", Resolution: "1280x720", Fps: "30", VideoBitrate: "4M", Description: "Kích thước nhỏ gọn, xử lý nhanh chóng"},
		{Name: "Source Resolution", Resolution: "source", Fps: "source", VideoBitrate: "auto", Description: "Giữ nguyên cấu hình gốc của video đầu vào"},
	}

	httpx.WriteJSON(w, presets)
}
