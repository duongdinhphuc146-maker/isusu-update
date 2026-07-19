import React from 'react';

interface VieNeuSettingsProps {
  mode: 'local' | 'remote';
  setMode: (m: 'local' | 'remote') => void;
  apiBase: string;
  setApiBase: (url: string) => void;
  device: 'auto' | 'cpu' | 'cuda';
  setDevice: (d: 'auto' | 'cpu' | 'cuda') => void;
}

export default function VieNeuSettings({ mode, setMode, apiBase, setApiBase, device, setDevice }: VieNeuSettingsProps) {
  return (
    <div className="result-card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', fontWeight: 600, color: 'white' }}>
        <span>⚙️ Cấu hình hoạt động VieNeu-TTS</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label">Chế độ hoạt động</label>
          <select 
            value={mode}
            onChange={(e) => setMode(e.target.value as 'local' | 'remote')}
            className="form-select"
          >
            <option value="remote">API Từ Xa (Remote API - Docker/Server GPU)</option>
            <option value="local">Chạy Offline Cục Bộ (Local Python CPU/GPU)</option>
          </select>
        </div>

        {mode === 'remote' ? (
          <div className="form-group">
            <label className="form-label">Địa chỉ API Server (LMDeploy / OpenSource)</label>
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://localhost:23333/v1"
              className="form-textarea"
              style={{ height: '46px', padding: '10px 14px' }}
            />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Thiết bị tăng tốc (Device)</label>
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value as 'auto' | 'cpu' | 'cuda')}
              className="form-select"
            >
              <option value="auto">Tự động phát hiện (Auto Detect)</option>
              <option value="cpu">Chỉ dùng CPU (CPU Only)</option>
              <option value="cuda">Card đồ họa NVIDIA (CUDA GPU)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
