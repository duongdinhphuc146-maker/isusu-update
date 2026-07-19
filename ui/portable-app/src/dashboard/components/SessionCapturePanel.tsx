import React, { useEffect, useState } from 'react';
import { Chrome, StopCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslateStore } from '../../store/translateStore';
import SessionProviderRow from './SessionProviderRow';

export default function SessionCapturePanel() {
  const {
    sessions,
    providers,
    fetchSessions,
    fetchProviders,
    startCaptureSession,
    stopCaptureSession,
    deleteSession
  } = useTranslateStore();

  const [loading, setLoading] = useState<string | null>(null);
  const [capturingProvider, setCapturingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
    fetchProviders();
  }, []);

  const handleStartCapture = async (provider: string) => {
    setError(null);
    setLoading(provider);
    try {
      setCapturingProvider(provider);
      await startCaptureSession(provider);
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến AI Bridge. Hãy kiểm tra xem bridge đã được khởi chạy chưa.');
      setCapturingProvider(null);
    } finally {
      setLoading(null);
    }
  };

  const handleStopCapture = async () => {
    setError(null);
    setLoading('stop');
    try {
      await stopCaptureSession();
      setCapturingProvider(null);
    } catch (err: any) {
      setError(err.message || 'Không thể dừng và lưu phiên.');
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteSession = async (provider: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa phiên của ${provider}?`)) return;
    setError(null);
    setLoading(`delete-${provider}`);
    try {
      await deleteSession(provider);
    } catch (err: any) {
      setError(err.message || 'Không thể xóa phiên.');
    } finally {
      setLoading(null);
    }
  };

  const sessionProviders = [
    { id: 'gemini', name: 'Gemini', desc: 'gemini.google.com' },
    { id: 'chatgpt', name: 'ChatGPT', desc: 'chatgpt.com' },
    { id: 'qwen', name: 'Qwen AI', desc: 'chat.qwen.ai' },
    { id: 'minimax', name: 'Minimax / Hailuo', desc: 'hailuoai.video' },
    { id: 'aistudio', name: 'Google AI Studio', desc: 'aistudio.google.com' },
    { id: 'z-ai', name: 'Z.ai', desc: 'z.ai' },
  ];

  return (
    <div className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center' }}>
            <Chrome className="w-4 h-4 text-[#00f0ff]" style={{ marginRight: '8px' }} />
            Quản lý Phiên Trình Duyệt (Capture & Replay)
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Mở trình duyệt một lần để lấy request cookie sạch, sau đó dịch tốc độ cao không cần mở lại trình duyệt.
          </p>
        </div>
        <button 
          onClick={() => { fetchSessions(); fetchProviders(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          title="Tải lại danh sách"
        >
          <RefreshCw className="w-4 h-4 hover:text-white" />
        </button>
      </div>

      {capturingProvider && (
        <div style={{
          padding: '1rem',
          borderRadius: '12px',
          backgroundColor: 'rgba(0, 240, 255, 0.05)',
          border: '1px dashed var(--color-cyan)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 className="w-5 h-5 text-cyan-400" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white' }}>
              Đang ghi phiên cho: <strong style={{ color: 'var(--color-cyan)' }}>{capturingProvider.toUpperCase()}</strong>
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Một trình duyệt Chromium đã được mở tự động. Hãy đăng nhập tài khoản của bạn trên trang web,
            sau đó gửi tin nhắn chat có nội dung chính xác là: <strong style={{ color: '#00f0ff' }}>TRANSLATE_ME</strong> để kích hoạt API request, 
            sau đó quay lại đây bấm nút <strong>"Dừng Ghi & Lưu Phiên"</strong> bên dưới.
          </p>
          <button
            onClick={handleStopCapture}
            disabled={loading === 'stop'}
            className="btn-primary"
            style={{
              alignSelf: 'flex-start',
              padding: '6px 12px',
              fontSize: '0.75rem',
              backgroundColor: '#ef4444',
              borderColor: '#ef4444'
            }}
          >
            {loading === 'stop' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <StopCircle className="w-4 h-4" />
            )}
            <span>Dừng Ghi & Lưu Phiên</span>
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px',
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ff6b6b',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sessionProviders.map((sp) => (
          <SessionProviderRow
            key={sp.id}
            id={sp.id}
            name={sp.name}
            desc={sp.desc}
            matchedSession={sessions.find((s) => s.provider === sp.id)}
            loading={loading}
            capturingProvider={capturingProvider}
            onStartCapture={handleStartCapture}
            onDeleteSession={handleDeleteSession}
          />
        ))}
      </div>
    </div>
  );
}
