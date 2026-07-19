import React, { useState, useEffect, useRef } from 'react';
import { Shield, Settings, Sliders, AlertTriangle, Play, RefreshCw, Activity, Terminal } from 'lucide-react';

interface MemoryStatus {
  load_percent: number;
  total_bytes: number;
  avail_bytes: number;
  used_bytes: number;
  auto_clean: boolean;
  threshold: number;
  history: string[];
  tool_installed: boolean;
}

export default function SystemMonitor() {
  const [data, setData] = useState<MemoryStatus | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoClean, setAutoClean] = useState(true);
  const [threshold, setThreshold] = useState(85);
  const logRef = useRef<HTMLPreElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/system/memory', {
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
      });
      const json = await res.json();
      setData(json);
      setAutoClean(json.auto_clean);
      setThreshold(json.threshold);
    } catch (e) {
      console.error("Failed to fetch memory status", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [data?.history]);

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/system/memory/optimize', {
        method: 'POST',
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
      });
      await res.json();
      fetchStatus();
    } catch (e) {
      console.error("Failed to optimize RAM", e);
    } finally {
      setOptimizing(false);
    }
  };

  const handleSaveConfig = async (newAuto: boolean, newThreshold: number) => {
    setSaving(true);
    try {
      await fetch('http://127.0.0.1:5000/api/system/memory/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'capcut_local_secret_key_2026'
        },
        body: JSON.stringify({ auto_clean: newAuto, threshold: newThreshold })
      });
    } catch (e) {
      console.error("Failed to save memory config", e);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  const toGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  const getProgressColor = (percent: number) => {
    if (percent > 85) return 'var(--color-red)';
    if (percent > 65) return '#f59e0b';
    return 'var(--color-green)';
  };

  return (
    <div className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity className="w-5 h-5 text-cyan-400" /> Giám sát & Tối ưu RAM Hệ thống
        </span>
        <span style={{
          fontSize: '11px',
          padding: '4px 8px',
          borderRadius: '6px',
          backgroundColor: data.tool_installed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          color: data.tool_installed ? 'var(--color-green)' : '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Shield className="w-3.5 h-3.5" />
          {data.tool_installed ? "Đã cài Mem Reduct" : "Đang tích hợp Mem Reduct..."}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Left Side: RAM Progress & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: 'slate-300' }}>
              <span>Dung lượng RAM đang sử dụng:</span>
              <span style={{ fontWeight: 600, color: getProgressColor(data.load_percent) }}>{data.load_percent}%</span>
            </div>
            
            {/* Premium RAM Bar */}
            <div style={{
              width: '100%',
              height: '14px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '999px',
              overflow: 'hidden',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{
                width: `${data.load_percent}%`,
                height: '100%',
                backgroundColor: getProgressColor(data.load_percent),
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 10px ${getProgressColor(data.load_percent)}`
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '6px', color: '#94a3b8' }}>
              <span>Đang dùng: {toGB(data.used_bytes)} GB</span>
              <span>Còn trống: {toGB(data.avail_bytes)} GB</span>
              <span>Tổng: {toGB(data.total_bytes)} GB</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleOptimize}
              disabled={optimizing}
              className="btn-launch"
              style={{
                flex: 1,
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                borderColor: 'var(--color-cyan)',
                color: 'var(--color-cyan)',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 600
              }}
            >
              <RefreshCw className={`w-4 h-4 ${optimizing ? 'animate-spin' : ''}`} />
              {optimizing ? "Đang giải phóng..." : "Giải phóng RAM ngay"}
            </button>
          </div>
        </div>

        {/* Right Side: Auto Clean Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings className="w-4 h-4 text-slate-400" /> Cấu hình Tự động Tối ưu
          </span>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={autoClean}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAutoClean(val);
                  handleSaveConfig(val, threshold);
                }}
                style={{
                  accentColor: 'var(--color-cyan)',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              Tự động giải phóng RAM
            </label>
          </div>

          {autoClean && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span>Ngưỡng kích hoạt:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-cyan)' }}>{threshold}% RAM</span>
              </div>
              <input
                type="range"
                min="30"
                max="95"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                onMouseUp={() => handleSaveConfig(autoClean, threshold)}
                onTouchEnd={() => handleSaveConfig(autoClean, threshold)}
                style={{
                  width: '100%',
                  accentColor: 'var(--color-cyan)',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  height: '6px',
                  borderRadius: '999px',
                  border: 'none',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
            * Khuyên dùng cho máy có bộ nhớ RAM thấp. Mem Reduct sẽ tự động kích hoạt ngầm để dọn dẹp bộ nhớ đệm hệ thống khi ứng dụng chạy các mô hình AI TTS/OCR nặng.
          </p>
        </div>
      </div>

      {data.history && data.history.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.8rem' }}>
            <Terminal className="w-4 h-4 text-slate-400" /> Nhật ký dọn dẹp hệ thống:
          </label>
          <pre 
            ref={logRef}
            style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-cyan)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '11px',
              maxHeight: '80px',
              overflowY: 'auto',
              border: '1px solid var(--color-border)',
              margin: 0
            }}
          >
            {data.history.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
