import React from 'react';
import { useSystemStore } from '../../store/systemStore';
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useSystemStore();

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {toasts.map((toast) => {
        let bgColor = '#1e1e24';
        let borderColor = 'var(--color-border)';
        let Icon = CheckCircle;
        let iconColor = '#00f0ff';

        if (toast.type === 'success') {
          bgColor = 'rgba(16, 185, 129, 0.1)';
          borderColor = 'rgba(16, 185, 129, 0.3)';
          iconColor = '#10b981';
          Icon = CheckCircle;
        } else if (toast.type === 'error') {
          bgColor = 'rgba(239, 68, 68, 0.1)';
          borderColor = 'rgba(239, 68, 68, 0.3)';
          iconColor = '#ef4444';
          Icon = AlertCircle;
        } else if (toast.type === 'warning') {
          bgColor = 'rgba(245, 158, 11, 0.1)';
          borderColor = 'rgba(245, 158, 11, 0.3)';
          iconColor = '#f59e0b';
          Icon = AlertTriangle;
        }

        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              color: 'white',
              fontSize: '0.8rem',
              minWidth: '280px',
              backdropFilter: 'blur(8px)',
              animation: 'slideIn 0.2s ease-out'
            }}
          >
            <Icon className="w-4 h-4" style={{ color: iconColor, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--color-text-secondary)' }}
            >
              <X className="w-4 h-4 hover:text-white transition-colors" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
