@echo off
echo ===================================================
echo Packaging CapCut Studio Portable v1.0.0
echo ===================================================

echo 1. Creating build directories...
if exist capcut-studio-portable rmdir /s /q capcut-studio-portable
mkdir capcut-studio-portable
mkdir capcut-studio-portable\projects
mkdir capcut-studio-portable\cache

echo 2. Bundling React Frontend...
cd ui\portable-app
call npm install
call npm run build
cd ..\..
mkdir capcut-studio-portable\frontend
xcopy /s /e /y ui\portable-app\dist capcut-studio-portable\frontend

echo 3. Compiling Go Backend...
cd services\go-backend
go build -o ..\..\capcut-studio-portable\capcut-backend.exe main.go
cd ..\..

echo 4. Copying configuration files...
copy .env capcut-studio-portable\.env
if exist services\capcut-tts-api\Voice.json (
    copy services\capcut-tts-api\Voice.json capcut-studio-portable\Voice.json
)
if exist README.md (
    copy README.md capcut-studio-portable\README.md
)

echo 5. Building and Packaging AI Translate Bridge...
cd services\ai-translate-bridge
call npm install
call npm run build
cd ..\..
mkdir capcut-studio-portable\services\ai-translate-bridge
mkdir capcut-studio-portable\services\ai-translate-bridge\dist
copy services\ai-translate-bridge\package.json capcut-studio-portable\services\ai-translate-bridge\package.json
xcopy /s /e /y services\ai-translate-bridge\dist capcut-studio-portable\services\ai-translate-bridge\dist
cd capcut-studio-portable\services\ai-translate-bridge
call npm install --omit=dev
call npx playwright install chromium
cd ..\..\..

echo 6. Packaging Electron App with electron-packager...
cd ui\portable-app
call npm install --save-dev electron-packager
call npm run electron:package
cd ..\..

echo 7. Copying Go Backend and Services to packaged Electron app...
if exist ui\portable-app\dist-electron\"CapCut Studio-win32-x64"\capcut-studio-portable rmdir /s /q ui\portable-app\dist-electron\"CapCut Studio-win32-x64"\capcut-studio-portable
mkdir ui\portable-app\dist-electron\"CapCut Studio-win32-x64"\capcut-studio-portable
xcopy /s /e /y capcut-studio-portable ui\portable-app\dist-electron\"CapCut Studio-win32-x64"\capcut-studio-portable

echo 8. Cleaning up temporary folders...
if exist capcut-studio-portable rmdir /s /q capcut-studio-portable

echo ===================================================
echo Build Completed! Portable Electron app is ready in:
echo ui/portable-app/dist-electron/CapCut Studio-win32-x64/
echo ===================================================
