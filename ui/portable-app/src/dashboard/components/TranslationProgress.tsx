import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Ban, Terminal, X } from 'lucide-react';
import { useTranslateStore } from '../../store/translateStore';

export default function TranslationProgress() {
  const {
    translateStatus,
    translateProgress,
    completedChunks,
    totalChunks,
    translateError,
    cancelTranslation,
    translateLoading,
    translateLogs
  } = useTranslateStore();

  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [translateLogs, showLogs]);

  if (translateStatus === 'idle' && !translateLoading) {
    return null;
  }

  const getStatusText = () => {
    switch (translateStatus) {
      case 'pending':
        return 'Đang khởi tạo tiến trình dịch phụ đề...';
      case 'processing':
        return `Đang dịch phụ đề: Đã xử lý ${completedChunks}/${totalChunks} phần`;
      case 'succeed':
        return 'Dịch phụ đề thành công!';
      case 'failed':
        return 'Có lỗi xảy ra trong quá trình dịch.';
      case 'cancelled':
        return 'Tiến trình dịch đã bị hủy.';
      default:
        return 'Đang tải...';
    }
  };

  const getStatusColor = () => {
    switch (translateStatus) {
      case 'succeed':
        return 'var(--color-cyan)';
      case 'failed':
        return '#ef4444';
      case 'cancelled':
        return 'var(--color-text-secondary)';
      default:
        return 'var(--color-cyan)';
    }
  };

  return (
    <div style={{
      padding: '1.25rem',
      borderRadius: '16px',
      backgroundColor: 'var(--color-surface-card)',
      border: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(translateStatus === 'pending' || translateStatus === 'processing') && (
            <Loader2 className="w-5 h-5 text-cyan-400" style={{ animation: 'spin 1s linear infinite' }} />
          )}
          {translateStatus === 'succeed' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
          {(translateStatus === 'failed' || translateStatus === 'cancelled') && (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
            {getStatusText()}
          </span>
        </div>
        
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: getStatusColor() }}>
          {translateProgress}%
        </span>
      </div>

      {/* Progress Bar Container */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{
          width: `${translateProgress}%`,
          height: '100%',
          backgroundColor: getStatusColor(),
          borderRadius: '4px',
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
          Hệ thống chia phụ đề thành các phần nhỏ để dịch thông minh và ổn định.
        </span>

        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Show Logs Button */}
          <button
            onClick={() => setShowLogs(!showLogs)}
            style={{
              background: 'rgba(0, 242, 254, 0.1)',
              border: '1px solid rgba(0, 242, 254, 0.2)',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '0.7rem',
              color: 'var(--color-cyan)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{showLogs ? 'Ẩn Nhật Ký' : 'Xem Nhật Ký'}</span>
          </button>

          {(translateStatus === 'pending' || translateStatus === 'processing') && (
            <button
              onClick={cancelTranslation}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.7rem',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Hủy Dịch</span>
            </button>
          )}
        </div>
      </div>

      {translateError && (
        <div style={{
          padding: '10px',
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ff6b6b',
          fontSize: '0.75rem',
          marginTop: '4px'
        }}>
          {translateError}
        </div>
      )}

      {/* Logs Drawer overlay */}
      {showLogs && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '380px',
          height: '100vh',
          backgroundColor: '#0b0f17',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.25s cubic-bezier(0.1, 0.9, 0.2, 1)'
        }}>
          {/* Drawer Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-cyan)' }}>
              <Terminal className="w-4 h-4" />
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Nhật Ký Tiến Trình Dịch</span>
            </div>
            <button
              onClick={() => setShowLogs(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Drawer Content */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '8px', color: '#a6e22e', backgroundColor: '#090c12' }}>
            {translateLogs.length === 0 ? (
              <span style={{ color: 'var(--color-text-secondary)' }}>Chưa có bản ghi hoạt động...</span>
            ) : (
              translateLogs.map((log, index) => (
                <div key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px', wordBreak: 'break-all' }}>
                  {log}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
