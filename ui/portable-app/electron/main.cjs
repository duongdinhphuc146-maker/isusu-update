const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let goProcess;
let bridgeProcess;

function startBackend() {
  const isDev = !app.isPackaged;
  const rootDir = isDev 
    ? path.resolve(__dirname, '../../..') 
    : path.dirname(process.resourcesPath);

  // Kill any orphaned backend or bridge processes on Windows using ports 5000 and 5001
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      
      // Kill anything on Port 5000 (Go Backend)
      try {
        const netstatOutput = execSync('netstat -ano | findstr LISTENING | findstr :5000', { encoding: 'utf8' });
        const lines = netstatOutput.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid) && pid !== '0') {
            execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
            console.log(`[ELECTRON] Killed orphaned process ${pid} on port 5000`);
          }
        }
      } catch (e) {}

      // Kill anything on Port 5001 (AI Translate Bridge)
      try {
        const netstatOutput = execSync('netstat -ano | findstr LISTENING | findstr :5001', { encoding: 'utf8' });
        const lines = netstatOutput.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid) && pid !== '0') {
            execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
            console.log(`[ELECTRON] Killed orphaned process ${pid} on port 5001`);
          }
        }
      } catch (e) {}

      // Also clean up by image name just in case
      execSync('taskkill /f /im capcut-backend.exe', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors
    }
  }

  // Start Go backend
  const goCwd = isDev 
    ? path.join(rootDir, 'services/go-backend')
    : path.join(rootDir, 'capcut-studio-portable');
  
  console.log(`[ELECTRON] Spawning Go Backend from: ${goCwd}`);
  const fs = require('fs');
  const logFile = path.join(rootDir, 'backend-log.txt');
  fs.appendFileSync(logFile, `\n--- STARTING SERVICES (${new Date().toISOString()}) ---\n`);
  fs.appendFileSync(logFile, `rootDir: ${rootDir}\n`);
  fs.appendFileSync(logFile, `goCwd: ${goCwd}\n`);

  if (isDev) {
    goProcess = spawn('go', ['run', 'main.go'], {
      cwd: goCwd,
      shell: true,
      windowsHide: true
    });
    goProcess.stdout.pipe(process.stdout);
    goProcess.stderr.pipe(process.stderr);
  } else {
    const binaryPath = path.join(goCwd, 'capcut-backend.exe');
    fs.appendFileSync(logFile, `binaryPath: ${binaryPath}\n`);
    goProcess = spawn(binaryPath, [], {
      cwd: goCwd,
      windowsHide: true
    });
    
    goProcess.stdout.on('data', (data) => {
      fs.appendFileSync(logFile, `[GO STDOUT] ${data.toString()}`);
    });
    goProcess.stderr.on('data', (data) => {
      fs.appendFileSync(logFile, `[GO STDERR] ${data.toString()}`);
    });
  }

  if (goProcess) {
    goProcess.on('error', (err) => {
      console.error('[ELECTRON] Failed to start Go Backend:', err);
      fs.appendFileSync(logFile, `[GO ERROR EVENT] ${err.stack || err.message || err}\n`);
    });
    goProcess.on('exit', (code, signal) => {
      fs.appendFileSync(logFile, `[GO EXIT] Code: ${code}, Signal: ${signal}\n`);
    });
  }

  // Start AI Translate Bridge
  const bridgeCwd = isDev 
    ? path.join(rootDir, 'services/ai-translate-bridge')
    : path.join(rootDir, 'capcut-studio-portable/services/ai-translate-bridge');
  
  console.log(`[ELECTRON] Spawning AI Translate Bridge from: ${bridgeCwd}`);
  if (isDev) {
    bridgeProcess = spawn('npm', ['run', 'dev'], {
      cwd: bridgeCwd,
      shell: true,
      windowsHide: true
    });
    bridgeProcess.stdout.pipe(process.stdout);
    bridgeProcess.stderr.pipe(process.stderr);
  } else {
    const bridgeJs = path.join(bridgeCwd, 'dist/server.js');
    bridgeProcess = spawn('node', [bridgeJs], {
      cwd: bridgeCwd,
      windowsHide: true
    });
    
    bridgeProcess.stdout.on('data', (data) => {
      fs.appendFileSync(logFile, `[BRIDGE STDOUT] ${data.toString()}`);
    });
    bridgeProcess.stderr.on('data', (data) => {
      fs.appendFileSync(logFile, `[BRIDGE STDERR] ${data.toString()}`);
    });
  }

  if (bridgeProcess) {
    bridgeProcess.on('error', (err) => {
      console.error('[ELECTRON] Failed to start AI Translate Bridge (make sure Node.js is installed):', err);
      fs.appendFileSync(logFile, `[BRIDGE ERROR EVENT] ${err.stack || err.message || err}\n`);
    });
    bridgeProcess.on('exit', (code, signal) => {
      fs.appendFileSync(logFile, `[BRIDGE EXIT] Code: ${code}, Signal: ${signal}\n`);
    });
  }
}

function killProcesses() {
  console.log('[ELECTRON] Terminating child server processes...');
  if (goProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', goProcess.pid, '/f', '/t'], { shell: true, windowsHide: true });
      } else {
        goProcess.kill('SIGINT');
      }
    } catch (e) {
      console.error('[ELECTRON] Error killing Go process:', e);
    }
    goProcess = null;
  }
  if (bridgeProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', bridgeProcess.pid, '/f', '/t'], { shell: true, windowsHide: true });
      } else {
        bridgeProcess.kill('SIGINT');
      }
    } catch (e) {
      console.error('[ELECTRON] Error killing Bridge process:', e);
    }
    bridgeProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register IPC handlers
  ipcMain.handle('restart-backend', async () => {
    console.log('[ELECTRON IPC] Restarting backend services...');
    killProcesses();
    // Wait 1.5 seconds to make sure the ports are fully released
    await new Promise(resolve => setTimeout(resolve, 1500));
    startBackend();
    return { success: true };
  });

  ipcMain.handle('reload-window', () => {
    console.log('[ELECTRON IPC] Reloading window...');
    if (mainWindow) {
      mainWindow.webContents.reload();
    }
    return { success: true };
  });

  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('exit', () => {
  killProcesses();
});
process.on('SIGINT', () => {
  killProcesses();
  process.exit(0);
});
process.on('SIGTERM', () => {
  killProcesses();
  process.exit(0);
});
