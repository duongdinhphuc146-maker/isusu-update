@echo off
chcp 65001 > nul
echo =======================================================
echo   VieNeuVoice - THIẾT LẬP PYTHON DI ĐỘNG (PORTABLE)
echo =======================================================
echo.
echo Kịch bản này sẽ tự động tải và cấu hình môi trường Python 3.10 di động
echo ngay trong thư mục ứng dụng để chạy mô hình VieNeu-TTS.
echo Điều này giúp bạn có thể sao chép ứng dụng sang máy khác mà không cần cài Python.
echo.

set "PORTABLE_DIR=%~dp0python"
set "ZIP_FILE=%~dp0python-3.10.11-embed-amd64.zip"

if exist "%PORTABLE_DIR%\python.exe" (
    echo [OK] Thư mục python di động đã tồn tại.
    goto install_deps
)

echo 1. Đang tải Python 3.10.11 Embeddable từ python.org...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip' -OutFile '%ZIP_FILE%'"
if %ERRORLEVEL% neq 0 (
    echo [LỖI] Không thể tải xuống Python. Vui lòng kiểm tra kết nối mạng.
    pause
    exit /b 1
)

echo 2. Đang giải nén Python vào thư mục %PORTABLE_DIR%...
powershell -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%PORTABLE_DIR%' -Force"
del "%ZIP_FILE%"

echo 3. Cấu hình file ._pth để hỗ trợ tải thư viện (pip)...
set "PTH_FILE=%PORTABLE_DIR%\python310._pth"
if exist "%PTH_FILE%" (
    echo import site >> "%PTH_FILE%"
)

echo 4. Đang tải get-pip.py để cài đặt công cụ quản lý thư viện pip...
powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%PORTABLE_DIR%\get-pip.py'"
"%PORTABLE_DIR%\python.exe" "%PORTABLE_DIR%\get-pip.py" --no-warn-script-location
del "%PORTABLE_DIR%\get-pip.py"

:install_deps
echo 5. Đang cài đặt thư viện 'vieneu' và tải trọng số mô hình...
"%PORTABLE_DIR%\python.exe" "%~dp0services\go-backend\services\vieneu_setup.py"

echo.
echo =======================================================
echo  [HOÀN THÀNH] Môi trường Python di động đã sẵn sàng!
echo  Bạn có thể chạy dự án VieNeuVoice độc lập ngay bây giờ.
echo =======================================================
pause
