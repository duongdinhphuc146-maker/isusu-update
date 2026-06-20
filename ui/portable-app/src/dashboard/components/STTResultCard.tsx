import React from 'react';
import { FileText, HelpCircle, AlertCircle } from 'lucide-react';

interface STTResultCardProps {
  sttResult: string | null;
  sttSrt: string | null;
  error: string | null;
  handleCopy: () => void;
  handleDownloadTxt: () => void;
  handleDownloadSrt: () => void;
  handleClear: () => void;
}

export default function STTResultCard({
  sttResult,
  sttSrt,
  error,
  handleCopy,
  handleDownloadTxt,
  handleDownloadSrt,
  handleClear
}: STTResultCardProps) {
  return (
    <div className="result-card">
      <div>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <FileText className="w-4 h-4 text-[#00f0ff]" style={{ marginRight: '8px' }} /> Kết quả nhận dạng văn bản
        </h3>

        {sttResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'white', lineHeight: 1.6, minHeight: '220px', maxHeight: '480px', overflowY: 'auto' }}>
              {sttResult}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={handleCopy} className="btn-download" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                Sao chép văn bản
              </button>
              <button onClick={handleDownloadTxt} className="btn-download" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                Xuất file TXT
              </button>
              {sttSrt && (
                <button onClick={handleDownloadSrt} className="btn-download" style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--color-cyan)' }}>
                  Xuất file SRT
                </button>
              )}
              <button onClick={handleClear} className="btn-download" style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ff6b6b' }}>
                Xóa kết quả
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <HelpCircle className="w-12 h-12" style={{ color: 'var(--color-border)', margin: '0 auto' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '12px' }}>Văn bản sẽ hiển thị ở đây sau khi nhận dạng.</p>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#2d1212', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--color-red)' }}>
            <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
