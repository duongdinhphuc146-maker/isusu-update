import React from 'react';
import { Cpu } from 'lucide-react';

export default function SystemPage() {
  return (
    <div className="space-y-6" style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
      <div>
        <h2 className="panel-title">Kiến trúc Ứng dụng Portable Multi-Window</h2>
        <p className="panel-subtitle">Hệ sinh thái tích hợp đa cửa sổ liên kết qua Tauri API.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
          <h3 style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>1. Khởi động Tự động (Auto Startup Server)</h3>
          <p style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
            Mỗi khi bấm mở Clypra hoặc WannaCut, Dashboard sẽ kiểm tra trạng thái cổng (5173 và 5174). Nếu chưa chạy, Go Backend sẽ thực thi lệnh khởi động server chạy ngầm trước khi hiển thị giao diện.
          </p>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
          <h3 style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>2. Cơ chế Chống Chặn (Anti-Blocking)</h3>
          <p style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
            Xoay vòng ngẫu nhiên DeviceID, IID, TDID và User-Agent để mô phỏng chân thực hoạt động của ứng dụng CapCut chính thức.
          </p>
        </div>
      </div>
    </div>
  );
}
