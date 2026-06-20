# CapCut Studio Portable

CapCut Studio Portable là một bộ công cụ máy tính cá nhân (desktop toolkit) được thiết kế để xử lý Văn bản thành giọng nói (TTS), Chuyển đổi giọng nói thành văn bản (STT), xử lý phụ đề (SRT) và tích hợp các công cụ biên tập video timeline Clypra & WannaCut.

Hệ thống được thiết kế hướng tới sự ổn định cao, bảo mật sandbox cục bộ, tự động lưu thay đổi (Auto-Save) và tự động khôi phục lỗi (Backup & Recovery Engine).

---

## Tính năng nổi bật

1. **Auto-Save & Recovery Engine**:
   - Tự động lưu trạng thái dự án sau 3 giây không hoạt động hoặc khi thay đổi trang.
   - Sao lưu dữ liệu dự án trước mỗi lần lưu (giữ tối đa 5 bản sao lưu tự động).
   - Hỗ trợ tạo bản sao lưu thủ công và khôi phục về bất kỳ phiên bản nào trực tiếp từ giao diện Dashboard.
   - Tự động phát hiện cấu hình lỗi/hỏng (Corrupted JSON) khi mở dự án và khôi phục từ bản sao lưu an toàn gần nhất.
2. **Tối ưu hóa TTS (Text-to-Speech)**:
   - Cơ chế lưu trữ đệm (Cache) âm thanh dựa trên MD5 checksum giúp tải lại tức thì và tiết kiệm lượt gọi API.
   - Hỗ trợ tải xuống tệp tin âm thanh, thử giọng và quản lý tệp cache.
3. **Nhận dạng giọng nói (STT & ASR)**:
   - Hỗ trợ tải tệp âm thanh lớn bằng cách truyền phát luồng dữ liệu (streaming).
   - Xuất phụ đề định dạng TXT hoặc phụ đề đồng bộ thời gian chuẩn SRT.
4. **Tích hợp Editor**:
   - Trình biên tập Clypra & WannaCut lưu trữ cấu trúc dòng thời gian (timeline tracks & clips) trực tiếp trong tệp `project.json` của thư mục sandbox dự án.
   - Tự động đồng bộ hóa dự án đang chọn khi chuyển đổi công cụ biên tập.

---

## Cấu trúc thư mục Sandbox Dự án

Mỗi dự án được lưu trữ trong một thư mục sandbox riêng biệt để đảm bảo tính di động cao:

```txt
projects/
└── [project-id]/
    ├── project.json       # Tệp cấu hình chứa TTS, STT, phụ đề & timeline Clypra/WannaCut
    ├── backups/           # Các bản sao lưu tự động & thủ công (project_*.json)
    ├── assets/            # Thư mục chứa hình ảnh, video gốc
    ├── audio/             # Thư mục chứa tệp tin âm thanh xử lý
    ├── subtitles/         # Thư mục chứa tệp phụ đề SRT
    └── exports/           # Tệp tin xuất bản
```

---

## Hướng dẫn cài đặt và chạy thử

### Yêu cầu hệ thống
- Hệ điều hành: Windows 10/11
- Go SDK (phiên bản 1.20 trở lên)
- Node.js & npm

### Các bước chạy cục bộ

1. **Khởi chạy API Backend**:
   ```bash
   cd services/go-backend
   go run main.go
   ```
   Backend sẽ lắng nghe trên cổng `http://127.0.0.1:5000`.

2. **Khởi chạy Frontend Dashboard**:
   ```bash
   cd ui/portable-app
   npm install
   npm run dev
   ```
   Frontend sẽ khởi động trên trình duyệt tại `http://localhost:3000`.

---

## Hướng dẫn đóng gói Portable (Release)

Để tạo ra một gói ứng dụng độc lập di động trên Windows:

1. Chạy tệp kịch bản `build.bat` ở thư mục gốc:
   ```cmd
   build.bat
   ```
2. Sau khi kịch bản chạy xong, thư mục đóng gói `capcut-studio-portable/` sẽ được tạo ra chứa:
   - `capcut-backend.exe`: API Gateway biên dịch từ Go.
   - `frontend/`: Toàn bộ mã nguồn React tĩnh đã được tối ưu hóa.
   - `.env`: Tệp cấu hình cổng kết nối và mã bảo mật.
   - `projects/` & `cache/`: Các thư mục trống chuẩn bị hoạt động.

---

## Hướng dẫn xử lý sự cố (Troubleshooting)

### Lỗi kết nối cổng 3000 hoặc 5000 (Address already in use)
Nếu ứng dụng không khởi động và báo lỗi cổng đã bị chiếm dụng:
- Tắt các tiến trình zombie chạy nền bằng Windows PowerShell (Quyền Admin):
  ```powershell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
  ```

### Trình duyệt báo lỗi gọi API (CORS hoặc CSRF)
- Đảm bảo bạn truy cập ứng dụng thông qua địa chỉ chuẩn `http://localhost:3000` hoặc `http://127.0.0.1:3000`. Cổng kết nối API Gateway bắt buộc phải là cổng `5000`.

### Không mở được giao diện Clypra hoặc WannaCut trên trình duyệt
- Hai trình biên tập timeline này sử dụng các thư viện tích hợp Tauri để giao tiếp với hệ điều hành. Khi chạy trực tiếp trên trình duyệt thường (Chrome/Edge), hệ thống đã kích hoạt cơ chế an toàn **Browser Fallback** để ngăn lỗi crash giao diện và chuyển sang mô phỏng lưu trữ thông qua API Gateway của Go.
