import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslateStore } from '../../store/translateStore';
import TranslationProgress from '../components/TranslationProgress';
import SessionCapturePanel from '../components/SessionCapturePanel';
import TranslationConfigPanel from '../components/TranslationConfigPanel';
import TranslationPreviewPanel from '../components/TranslationPreviewPanel';

export default function TranslatePage() {
  const {
    fetchProviders,
    resumeTranslationPolling
  } = useTranslateStore();

  useEffect(() => {
    fetchProviders();
    resumeTranslationPolling();
  }, []);

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="panel-title">Dịch Phụ Đề Bằng Trí Tuệ Nhân Tạo (AI Translate)</h2>
          <p className="panel-subtitle">Dịch file phụ đề SRT thông minh, bảo toàn mốc thời gian tuyệt đối.</p>
        </div>
        <button
          onClick={fetchProviders}
          className="btn-download"
          style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Tải lại danh sách API"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Tải Lại API</span>
        </button>
      </div>

      <div className="editor-grid-layout">
        {/* Left Column: SRT Input & Target configuration */}
        <TranslationConfigPanel />

        {/* Center / Right Columns: Preview & Browser Capture management */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <TranslationProgress />
          <TranslationPreviewPanel />
          <SessionCapturePanel />
        </div>
      </div>
    </div>
  );
}
