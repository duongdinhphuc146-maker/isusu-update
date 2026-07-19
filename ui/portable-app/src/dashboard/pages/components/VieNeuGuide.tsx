import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function VieNeuGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '16px',
      padding: '1.25rem',
      marginTop: '1.5rem'
    }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          color: 'var(--color-cyan)',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontSize: '1rem',
          fontWeight: 600,
          padding: 0
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, textAlign: 'left' }}>
          📖 Hướng dẫn tải model &amp; Cấu hình GPU máy tính
        </span>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          fontSize: '0.85rem',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6
        }}>
          <div>
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ Trạng thái model hiện tại
            </h4>
            <p>
              Hệ thống kiểm tra thấy máy tính của bạn <strong style={{ color: 'var(--color-red)' }}>chưa tải sẵn</strong> model VieNeu-TTS. 
              Model sẽ tự động tải về khi chạy lần đầu tiên qua internet, hoặc bạn có thể khởi chạy server Docker để tự động kéo model về.
            </p>
          </div>

          <div>
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🟢 Cách 1: Sử dụng Docker GPU (Cực kỳ khuyên dùng)
            </h4>
            <p style={{ marginBottom: '0.5rem' }}>
              Đây là cách tốt nhất để tận dụng card đồ họa GPU Nvidia (nếu máy có GPU). Chạy lệnh này trong Terminal để tự động tải model 0.3B và kích hoạt GPU:
            </p>
            <pre style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-cyan)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '11px',
              overflowX: 'auto',
              border: '1px solid var(--color-border)'
            }}>
              docker run --gpus all -p 23333:23333 -v hf_cache:/root/.cache/huggingface pnnbao/vieneu-tts:latest
            </pre>
          </div>

          <div>
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔵 Cách 2: Sử dụng Local Python (Chạy offline)
            </h4>
            <p style={{ marginBottom: '0.5rem' }}>
              Yêu cầu cài đặt <strong style={{ color: 'white' }}>eSpeak NG</strong> trên Windows và thêm vào biến môi trường PATH. Sau đó, chạy lệnh sau để cài đặt thư viện hỗ trợ GPU/CPU:
            </p>
            <pre style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-cyan)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '11px',
              overflowX: 'auto',
              border: '1px solid var(--color-border)'
            }}>
              # Hỗ trợ CUDA GPU:{"\n"}
              pip install "vieneu[gpu]"{"\n\n"}
              # Chỉ chạy CPU:{"\n"}
              pip install vieneu
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
