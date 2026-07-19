import React from 'react';
import { useTranslateStore } from '../../store/translateStore';

export default function PipelineDashboard() {
  const { pipelineSteps, dialogueMode, translateStatus, translateLogs } = useTranslateStore();

  if (!dialogueMode || translateStatus === 'idle') {
    return null;
  }

  const hasLog = (prefix: string) => translateLogs.some(log => log.includes(prefix));

  // Derive dynamic pipeline step states depending on backend overall status & logs
  const getStepStatus = (stepName: string) => {
    if (translateStatus === 'succeed') return 'done';

    switch (stepName) {
      case 'Profile':
        if (translateStatus === 'pending') return 'processing';
        if (translateStatus === 'processing' || translateStatus === 'waiting_voices') return 'done';
        if (translateStatus === 'failed') return 'error';
        return 'idle';
      case 'Translate':
        if (translateStatus === 'failed' && !hasLog('[Merge]')) return 'error';
        if (hasLog('[Merge]')) return 'done';
        if (translateStatus === 'processing') return 'processing';
        return 'idle';
      case 'Merge':
        if (translateStatus === 'failed' && hasLog('[Merge]') && !hasLog('[TTS]')) return 'error';
        if (hasLog('[TTS]')) return 'done';
        if (hasLog('[Merge]')) return 'processing';
        return 'idle';
      case 'TTS':
        if (translateStatus === 'failed' && hasLog('[TTS]') && !hasLog('[Split]')) return 'error';
        if (hasLog('[Split]')) return 'done';
        if (hasLog('[TTS]')) return 'processing';
        return 'idle';
      case 'Split':
        if (translateStatus === 'failed' && hasLog('[Split]') && !hasLog('[Render]')) return 'error';
        if (hasLog('[Render]')) return 'done';
        if (hasLog('[Split]')) return 'processing';
        return 'idle';
      case 'Render':
        if (translateStatus === 'failed' && hasLog('[Render]')) return 'error';
        if (hasLog('[Render]')) return 'processing';
        return 'idle';
      default:
        return 'idle';
    }
  };

  const steps = [
    { name: 'Phân tích nhân vật', key: 'Profile', desc: 'Gemini character catalog profiling' },
    { name: 'Dịch thuật hội thoại', key: 'Translate', desc: 'Overlapping translation blocks' },
    { name: 'Hợp nhất câu thoại', key: 'Merge', desc: 'Punctuation pause merging' },
    { name: 'Chuyển văn bản thành giọng nói', key: 'TTS', desc: 'Concurrent voiceovers' },
    { name: 'Cắt ghép âm thanh', key: 'Split', desc: 'In-memory silent alignment' },
    { name: 'Hoàn thiện luồng', key: 'Render', desc: 'Final render' }
  ];

  return (
    <div className="settings-section" style={{ marginTop: '1.25rem' }}>
      <h3 className="panel-title" style={{ fontSize: '1rem' }}>Tiến Trình Xử Lý Đa Nhiệm (Dialogue Pipeline Dashboard)</h3>
      <p className="panel-subtitle">Theo dõi trạng thái các bước xử lý tự động trong luồng dialogue.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          let statusColor = '#4b5563'; // gray
          let statusLabel = 'Đang chờ...';
          
          if (status === 'processing') {
            statusColor = '#3b82f6'; // blue
            statusLabel = 'Đang xử lý...';
          } else if (status === 'done') {
            statusColor = '#10b981'; // green
            statusLabel = 'Hoàn tất';
          } else if (status === 'error') {
            statusColor = '#ef4444'; // red
            statusLabel = 'Lỗi';
          }

          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{step.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{step.desc}</div>
              </div>
              <div style={{ fontSize: '0.8rem', color: statusColor, fontWeight: 'bold' }}>{statusLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
