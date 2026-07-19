import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

interface GpuSettingsCardProps {
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function GpuSettingsCard({ addToast }: GpuSettingsCardProps) {
  const [gpus, setGpus] = useState<string[]>([]);
  const [hwaccelOptions, setHwaccelOptions] = useState<string[]>([]);
  const [selectedHwaccel, setSelectedHwaccel] = useState('none');

  useEffect(() => {
    const fetchGpuInfo = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5000/api/system/gpu', {
          headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
        });
        const data = await res.json();
        if (data.gpus) setGpus(data.gpus);
        if (data.hwaccel_options) setHwaccelOptions(data.hwaccel_options);
        if (data.current_hwaccel) setSelectedHwaccel(data.current_hwaccel);
      } catch (e) {
        console.error('Failed to fetch GPU info', e);
      }
    };
    fetchGpuInfo();
  }, []);

  const handleHwaccelChange = async (val: string) => {
    setSelectedHwaccel(val);
    try {
      await fetch('http://127.0.0.1:5000/api/system/gpu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'capcut_local_secret_key_2026'
        },
        body: JSON.stringify({ hwaccel: val })
      });
      addToast(`Đã chuyển đổi GPU acceleration sang: ${val.toUpperCase()}`, 'success');
    } catch {
      addToast('Lỗi cập nhật cấu hình GPU', 'error');
    }
  };

  return (
    <div className="settings-section" style={{
      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.03) 0%, rgba(99, 102, 241, 0.03) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      padding: '1.25rem',
      borderRadius: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Cpu className="w-5 h-5 text-cyan-400" />
        <h3 className="panel-title" style={{ fontSize: '0.95rem', margin: 0 }}>Tăng Tốc Phần Cứng (GPU Acceleration)</h3>
      </div>
      <p className="panel-subtitle" style={{ margin: '4px 0 12px 0' }}>Tối ưu hóa tốc độ xử lý âm thanh/video bằng cách sử dụng nhân đồ họa.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {gpus.length > 0 && (
          <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
            <strong style={{ color: 'var(--color-cyan)', display: 'block', marginBottom: '2px' }}>Thiết bị đồ họa phát hiện:</strong>
            {gpus.map((g, i) => (
              <div key={i} style={{ color: '#e5e7eb' }}>• {g}</div>
            ))}
          </div>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '0.8rem', color: '#9ca3af', minWidth: '140px' }}>Chế độ tăng tốc (FFmpeg):</label>
          <select
            value={selectedHwaccel}
            onChange={(e) => handleHwaccelChange(e.target.value)}
            style={{
              background: '#1f2937',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer',
              flex: 1,
              fontSize: '0.8rem'
            }}
          >
            {hwaccelOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt.toUpperCase()} {opt === 'cuda' ? '(NVIDIA Recommend)' : opt === 'none' ? '(CPU Only)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
