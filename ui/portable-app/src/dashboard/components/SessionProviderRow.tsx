import React from 'react';
import { Trash2, PlayCircle, Loader2 } from 'lucide-react';
import { CapturedSession } from '../types';

interface SessionProviderRowProps {
  id: string;
  name: string;
  desc: string;
  matchedSession: CapturedSession | undefined;
  loading: string | null;
  capturingProvider: string | null;
  onStartCapture: (provider: string) => void;
  onDeleteSession: (provider: string) => void;
}

export default function SessionProviderRow({
  id,
  name,
  desc,
  matchedSession,
  loading,
  capturingProvider,
  onStartCapture,
  onDeleteSession
}: SessionProviderRowProps) {
  const hasSession = matchedSession && matchedSession.status === 'valid';
  const isProcessing = loading === id || loading === `delete-${id}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: hasSession ? '#10b981' : '#6b7280'
        }} />
        <div>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white' }}>{name}</h4>
          <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>{desc}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {hasSession && (
          <button
            onClick={() => onDeleteSession(id)}
            disabled={isProcessing || !!capturingProvider}
            style={{
              background: 'none',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#ef4444'
            }}
            title="Xóa phiên"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        
        <button
          onClick={() => onStartCapture(id)}
          disabled={isProcessing || !!capturingProvider}
          style={{
            backgroundColor: isProcessing ? 'var(--color-border)' : 'rgba(0, 240, 255, 0.1)',
            border: '1px solid ' + (isProcessing ? 'var(--color-border)' : 'var(--color-cyan)'),
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PlayCircle className="w-3.5 h-3.5" />
          )}
          <span>{hasSession ? 'Ghi Đè Phiên' : 'Ghi Phiên Mới'}</span>
        </button>
      </div>
    </div>
  );
}
