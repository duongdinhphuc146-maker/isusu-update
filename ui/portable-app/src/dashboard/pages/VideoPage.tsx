import React, { useState, useEffect, useCallback } from 'react';
import { Film, ExternalLink, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

const OPENREEL_PORT = 5174;
const OPENREEL_URL = `http://localhost:${OPENREEL_PORT}`;
const POLL_INTERVAL = 2000;

type ServerStatus = 'checking' | 'online' | 'offline';

export default function VideoPage() {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [iframeKey, setIframeKey] = useState(0);

  const checkServer = useCallback(() => {
    fetch(OPENREEL_URL, { mode: 'no-cors' })
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));
  }, []);

  useEffect(() => {
    checkServer();
    const interval = setInterval(checkServer, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkServer]);

  const handleRefresh = () => {
    setStatus('checking');
    setIframeKey(k => k + 1);
    setTimeout(checkServer, 500);
  };

  const openInBrowser = () => {
    window.open(OPENREEL_URL, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Film size={20} style={{ color: 'var(--accent)' }} />
          <h1 className="page-title" style={{ fontSize: 16, margin: 0 }}>
            OpenReel Video Editor
          </h1>
          {/* Status Badge */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
            background: status === 'online'
              ? 'rgba(16, 185, 129, 0.15)'
              : status === 'offline'
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(107, 114, 128, 0.15)',
            color: status === 'online' ? '#10b981'
              : status === 'offline' ? '#ef4444'
              : 'var(--text-muted)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: status === 'online' ? '#10b981'
                : status === 'offline' ? '#ef4444'
                : 'var(--text-muted)',
              ...(status === 'online' ? { animation: 'pulse 2s infinite' } : {}),
            }} />
            {status === 'online' ? 'Đang chạy' : status === 'offline' ? 'Chưa khởi động' : 'Đang kiểm tra...'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleRefresh}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            title="Tải lại"
          >
            <RefreshCw size={14} />
            Tải lại
          </button>
          <button
            onClick={openInBrowser}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            title="Mở trong trình duyệt"
          >
            <ExternalLink size={14} />
            Mở ngoài
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {status === 'checking' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 16, background: 'var(--bg-primary)',
          }}>
            <Loader2 size={40} className="spin" style={{ color: 'var(--accent)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Đang kết nối đến OpenReel Video...
            </p>
          </div>
        )}

        {status === 'offline' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 20, padding: 32, background: 'var(--bg-primary)',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={32} style={{ color: '#ef4444' }} />
            </div>

            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                OpenReel Video chưa khởi động
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
                Trình chỉnh sửa video cần chạy trên <code style={{
                  background: 'var(--bg-hover)', padding: '1px 6px',
                  borderRadius: 4, fontFamily: 'monospace', fontSize: 12,
                }}>localhost:{OPENREEL_PORT}</code>.
                Mở terminal và chạy lệnh bên dưới trong thư mục <strong>openreel-video-temp/apps/web</strong>:
              </p>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px 20px',
              width: '100%',
              maxWidth: 500,
              fontFamily: 'monospace',
              fontSize: 13,
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>Terminal:</div>
              <div style={{ color: '#00d4ff' }}>
                cd openreel-video-temp<br />
                pnpm install<br />
                <span style={{ color: '#10b981' }}>VITE_PORT={OPENREEL_PORT} pnpm dev</span>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Hoặc nếu đã build: <code style={{ fontFamily: 'monospace' }}>pnpm preview --port {OPENREEL_PORT}</code>
            </p>

            <button
              onClick={handleRefresh}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RefreshCw size={16} />
              Thử kết nối lại
            </button>
          </div>
        )}

        {status === 'online' && (
          <iframe
            key={iframeKey}
            src={OPENREEL_URL}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
            allow="clipboard-read; clipboard-write; fullscreen"
            title="OpenReel Video Editor"
          />
        )}
      </div>
    </div>
  );
}
