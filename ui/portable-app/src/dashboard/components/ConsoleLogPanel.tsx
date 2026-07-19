import React, { useEffect, useRef } from 'react';
import { Terminal, X, ChevronRight } from 'lucide-react';

interface ConsoleLogPanelProps {
  logs: string[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ConsoleLogPanel({ logs, isOpen, onClose }: ConsoleLogPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && isOpen) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        backgroundColor: '#090d16',
        overflow: 'hidden',
        height: 'fit-content',
        maxHeight: '650px',
        width: '100%',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        animation: 'fadeIn 0.2s ease-out-in',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-cyan)', fontSize: '0.8rem', fontWeight: 'bold' }}>
          <Terminal className="w-4 h-4" />
          <span>Real-Time Logs</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Đóng Console"
        >
          <X className="w-4 h-4 hover:text-white transition-colors" />
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          color: '#10b981',
          overflowY: 'auto',
          maxHeight: '500px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          backgroundColor: '#04070e',
          minHeight: '350px',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Chưa có tiến trình hoạt động. Hãy tải file lên và bắt đầu quy trình...
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                paddingBottom: '3px',
                wordBreak: 'break-all',
                lineHeight: '1.4',
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
