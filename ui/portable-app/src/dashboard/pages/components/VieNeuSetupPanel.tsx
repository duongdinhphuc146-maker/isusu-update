import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, AlertCircle, CheckCircle2, Cpu } from 'lucide-react';

interface SetupStatus {
  installed: boolean;
  model_cached: boolean;
  gpu_available: boolean;
  setup_running: boolean;
  setup_log: string;
}

export default function VieNeuSetupPanel() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const logRef = React.useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [status?.setup_log]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/vieneu/status', {
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
      });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error("Failed to fetch setup status", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      await fetch('http://127.0.0.1:5000/api/vieneu/setup', {
        method: 'POST',
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
      });
      fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!status) return null;

  const isReady = status.installed && status.model_cached;

  return (
    <div className="result-card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🤖 Trạng thái cài đặt hệ thống
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '11px',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: status.gpu_available ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: status.gpu_available ? 'var(--color-green)' : 'var(--color-red)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Cpu className="w-3.5 h-3.5" />
            {status.gpu_available ? "Có GPU (NVIDIA CUDA)" : "Không có GPU / Chỉ CPU"}
          </span>
          <span style={{
            fontSize: '11px',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: isReady ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isReady ? 'var(--color-green)' : '#f59e0b',
            fontWeight: 600
          }}>
            {isReady ? "Sẵn sàng hoạt động" : "Cần cấu hình/Tải Model"}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.85rem' }}>
        <div>
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            Thư viện python (vieneu):{' '}
            {status.installed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
          </p>
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Model weights (VieNeu 0.3B INT8 ONNX):{' '}
            {status.model_cached ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            onClick={handleStartSetup}
            disabled={status.setup_running || loading}
            className="btn-launch"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-cyan)',
              color: 'var(--color-cyan)',
              padding: '10px 18px'
            }}
          >
            {status.setup_running ? "Đang cài đặt tự động..." : "Bấm vào đây để cài đặt tự động & Tải Model"}
          </button>
        </div>
      </div>

      {status.setup_log && (
        <div style={{ marginTop: '0.5rem' }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Terminal className="w-4 h-4 text-slate-400" /> Log Cài đặt Hệ thống:
          </label>
          <pre 
            ref={logRef}
            style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-cyan)',
              padding: '12px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '11px',
              maxHeight: '140px',
              overflowY: 'auto',
              border: '1px solid var(--color-border)'
            }}
          >
            {status.setup_log}
          </pre>
        </div>
      )}
    </div>
  );
}
