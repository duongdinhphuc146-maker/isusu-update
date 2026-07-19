import React from 'react';
import { Sparkles, RefreshCw, RotateCcw } from 'lucide-react';

interface HeaderProps {
  backendStatus: string;
  restarting: boolean;
  handleReconnect: () => void;
  handleReloadUI: () => void;
  handleRestartServer: () => void;
}

export default function Header({
  backendStatus,
  restarting,
  handleReconnect,
  handleReloadUI,
  handleRestartServer
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-icon">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="brand-title">
            CAPCUT STUDIO <span className="brand-badge">PORTABLE</span>
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Giải pháp biên tập video nhẹ &amp; chạy ngay không cần cài đặt
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="header-status">
          <span className={`status-dot ${backendStatus === 'running' ? 'active' : 'offline'}`} />
          <span>
            Dịch vụ Go Backend: {backendStatus === 'running' ? 'Đang hoạt động (Port 5000)' : 'Ngoại tuyến'}
          </span>
        </div>

        {backendStatus === 'offline' && (
          <button
            onClick={handleReconnect}
            className="btn-download"
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: '#ff6b6b'
            }}
            title="Thử kết nối lại với Go Backend"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kết Nối Lại</span>
          </button>
        )}

        <button
          onClick={handleReloadUI}
          className="btn-download"
          style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          title="Tải lại giao diện hiển thị"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Tải Lại UI</span>
        </button>

        {!!(window as any).electronAPI?.isElectron && (
          <button
            onClick={handleRestartServer}
            disabled={restarting}
            className="btn-download"
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: restarting ? 'var(--color-border)' : 'rgba(0, 240, 255, 0.4)',
              color: restarting ? 'var(--color-text-muted)' : 'var(--color-cyan)',
              cursor: restarting ? 'not-allowed' : 'pointer'
            }}
            title="Khởi động lại toàn bộ tiến trình Go Backend & AI Translate Bridge"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ animation: restarting ? 'spin 1s linear infinite' : 'none' }} />
            <span>{restarting ? 'Đang khởi động lại...' : 'Khởi Động Lại Server'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
