# Cấu Trúc Dự Án CapCut Studio Portable (Unified Edition)

Tệp tin này mô tả chi tiết sơ đồ thư mục, vai trò/chức năng của từng tệp tin cốt lõi, cùng với số dòng code thực tế của chúng trong hệ thống **CapCut Studio Portable**.

---

## 1. Bản Đồ Tổng Quan Thư Mục

```
Capcut tool/
├── services/                        # Các dịch vụ xử lý ngầm (Backend & Processing Engines)
│   ├── go-backend/                  # Trung tâm điều phối chính (Go Backend - Port: 5000)
│   │   ├── api/                     # Định tuyến đường dẫn API
│   │   ├── cmd/                     # Điểm khởi động hệ thống
│   │   ├── internal/                # Cấu hình nội bộ (.env)
│   │   ├── middleware/              # Bộ lọc bảo mật (JWT, CSRF, CORS, Rate Limiter) & Logger
│   │   └── services/                # Các dịch vụ nghiệp vụ chính (TTS, STT, Project)
│   └── cpp-engine/                  # Bộ lọc và xử lý hiệu ứng video hiệu năng cao bằng C++
│
├── ui/                              # Lớp giao diện (Frontend)
│   └── portable-app/                # React Shell duy nhất quản lý toàn bộ giao diện (Port: 3000)
│       └── src/
│           ├── clypra/              # Tích hợp Clypra Video Editor
│           ├── wannacut/            # Tích hợp WannaCut Video Editor
│           ├── store/               # Các kho lưu trữ Zustand toàn cục (project, editor, system)
│           ├── hooks/               # Các React hooks tùy chỉnh (useAutoSave)
│           ├── dashboard/           # Bảng điều khiển trung tâm (TTS, SRT, STT, System)
│           │   ├── layouts/         # Bố cục giao diện chung
│           │   └── pages/           # Các trang chức năng riêng biệt (HomePage, STT, v.v.)
│           ├── App.tsx              # Router điều phối chính của giao diện
│           └── main.tsx             # Khởi tạo React & nạp styles toàn cục
│
└── projects/                        # Thư mục lưu trữ dự án video cục bộ
```

---

## 2. Chi Tiết File Nghiệp Vụ Backend (`services/go-backend`)

Các cấu phần chính điều phối luồng xử lý giọng đọc, nhận dạng giọng nói và tích hợp hệ thống:

| Đường dẫn tệp tin | Chức năng chính / Vai trò | Số dòng code |
| :--- | :--- | :---: |
| [`main.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/main.go) | Khởi chạy máy chủ HTTP API Gateway bảo mật trên cổng 5000. | 31 |
| [`api/router.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/api/router.go) | Đăng ký toàn bộ các route công khai và bảo mật, phân quyền thông qua middleware. | 56 |
| [`middleware/auth.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/middleware/auth.go) | Xác thực mã khóa API cục bộ (`X-API-Key`) và cấp phát/xác minh JWT Token bảo mật. | 89 |
| [`middleware/security.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/middleware/security.go) | Áp dụng chính sách CORS, ngăn chặn tấn công giả mạo CSRF và giới hạn tần suất yêu cầu (Rate Limiting). | 104 |
| [`middleware/logger.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/middleware/logger.go) | Bộ ghi nhật ký hoạt động (Request Logger Middleware) theo dõi latency và status codes. | 32 |
| [`services/device.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/device.go) | Tạo lập thông tin thiết bị ảo ngẫu nhiên, tạo chữ ký RSA để bypass giới hạn và rate limits của CapCut. | 161 |
| [`services/stt_upload.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/stt_upload.go) | Giao tiếp với CapCut VOD qua chữ ký AWS4, tính toán tổng kiểm CRC32 và tải tệp tin âm thanh lên máy chủ CapCut. | 238 |
| [`services/stt_task.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/stt_task.go) | Khởi tạo tác vụ nhận dạng ASR, poll trạng thái xử lý định kỳ và trích xuất chuỗi hội thoại nhận dạng được. | 275 |
| [`services/stt.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/stt.go) | Điểm cuối (Endpoint) tiếp nhận file âm thanh upload từ frontend, chuyển đổi định dạng bằng FFmpeg và gọi chuỗi STT. | 114 |
| [`services/tts.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/tts.go) | Tiếp nhận văn bản đầu vào, đóng góiSSML lồng tiếng và gửi yêu cầu sinh giọng nói tới CapCut. | 212 |
| [`services/tts_poll.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/tts_poll.go) | Theo dõi tiến trình tạo âm thanh TTS cho đến khi có đường dẫn URL file âm thanh thành phẩm. | 129 |
| [`services/voices.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/voices.go) | Cung cấp danh mục cấu hình toàn bộ các giọng đọc (Việt Nam, Anh, v.v.) được hỗ trợ sẵn. | 25 |
| [`services/project.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/project.go) | Quản lý việc liệt kê và đọc ghi thông tin các dự án video được lưu trữ cục bộ. | 148 |
| [`services/editor.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/services/editor.go) | Kích hoạt và quản lý tiến trình khởi tạo các trình chỉnh sửa video Clypra/WannaCut. | 70 |
| [`test_stt_complete.go`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/services/go-backend/test_stt_complete.go) | File kiểm tra tích hợp đầu-cuối gửi yêu cầu nhận diện tệp âm thanh thực tế và in ra kết quả. | 75 |

---

## 3. Chi Tiết File Giao Diện Frontend (`ui/portable-app/src`)

Giao diện người dùng sử dụng React, Vite và Tailwind CSS chạy trên Port 3000:

| Đường dẫn tệp tin | Chức năng chính / Vai trò | Số dòng code |
| :--- | :--- | :---: |
| [`App.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/App.tsx) | Router điều phối chính giao diện, nạp hook tự động lưu và khởi chạy ToastContainer. | 95 |
| [`main.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/main.tsx) | Điểm neo gắn kết React DOM và nạp trước hệ thống Stylesheet toàn cục. | 11 |
| [`store/projectStore.ts`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/store/projectStore.ts) | Kho lưu trữ trạng thái Zustand cho các thao tác quản lý dự án (Tạo, Lưu, Load, Xóa). | 170 |
| [`store/editorStore.ts`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/store/editorStore.ts) | Kho lưu trữ trạng thái Zustand cho các tab chức năng, cài đặt editor, và các dữ liệu trang. | 135 |
| [`store/systemStore.ts`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/store/systemStore.ts) | Kho lưu trữ trạng thái Zustand cho các thông báo hệ thống và banner toasts. | 30 |
| [`hooks/useAutoSave.ts`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/hooks/useAutoSave.ts) | React hook quản lý bộ máy tự động lưu trữ, đồng bộ trạng thái khi có thay đổi (debounce 3s). | 110 |
| [`dashboard/layouts/DashboardLayout.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/dashboard/layouts/DashboardLayout.tsx) | Khung giao diện neon Slate-Cyan, bao gồm Sidebar điều hướng và thanh tiêu đề trạng thái hệ thống. | 102 |
| [`dashboard/components/ToastContainer.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/dashboard/components/ToastContainer.tsx) | Render các banner thông báo Success/Error/Warning toàn cục với hiệu ứng micro-animations. | 65 |
| [`dashboard/pages/HomePage.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/dashboard/pages/HomePage.tsx) | Trang chủ bảng điều khiển trung tâm, quản lý tạo/mở dự án, xem tài nguyên và kiểm tra hệ thống. | 255 |
| [`dashboard/pages/STTPage.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/dashboard/pages/STTPage.tsx) | Trang tải lên file âm thanh và nhận diện giọng nói thành văn bản, hỗ trợ sao chép, xuất TXT/SRT. | 185 |
| [`dashboard/pages/SubtitlePage.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/dashboard/pages/SubtitlePage.tsx) | Trang quản lý tải tệp phụ đề (.srt), cấu hình lồng tiếng giọng nói hàng loạt với chức năng cancel/retry. | 165 |
| [`dashboard/pages/VoicePage.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/dashboard/pages/VoicePage.tsx) | Trang tương tác chuyển đổi Văn bản thành Giọng nói (TTS) đơn lẻ với bộ chọn giọng và điều khiển request. | 224 |
| [`dashboard/pages/SystemPage.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/dashboard/pages/SystemPage.tsx) | Trang kiểm tra thông số hệ thống, thông tin tích hợp và hiển thị cấu hình thiết bị. | 26 |
| [`clypra/App.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/clypra/App.tsx) | Trang bao bọc (Wrapper) để khởi động Clypra Video Editor và tải danh sách dự án chỉnh sửa gần đây. | 114 |
| [`wannacut/App.tsx`](file:///c:/Users/ASUS%20ROD/Downloads/Capcut%20tool/ui/portable-app/src/wannacut/App.tsx) | Trang bao bọc (Wrapper) để nạp trình chỉnh sửa WannaCut 3D Track Video Editor. | 140 |

---

## 4. Bản Đồ Cổng Dịch Vụ (Service Ports)
*   **Port 3000**: Vite Dev Server chạy giao diện React Dashboard thống nhất.
*   **Port 5000**: Go Secured API Gateway điều hướng xử lý logic nghiệp vụ và giao tiếp mạng.
