import React, { useState } from 'react';
import { Copy, Trash2, Search, Check, Download } from 'lucide-react';
import { useTranslateStore } from '../../store/translateStore';

export default function TranslationPreviewPanel() {
  const {
    srtInput,
    translatedSRT,
    setSrtInput
  } = useTranslateStore();

  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedTranslated, setCopiedTranslated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDownloadTranslated = () => {
    if (!translatedSRT) return;
    const blob = new Blob(["\ufeff", translatedSRT], { type: 'text/srt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'translated.srt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (text: string, isOriginal: boolean) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (isOriginal) {
        setCopiedOriginal(true);
        setTimeout(() => setCopiedOriginal(false), 2000);
      } else {
        setCopiedTranslated(true);
        setTimeout(() => setCopiedTranslated(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleClearOriginal = () => {
    setSrtInput('');
  };

  const getSegmentCount = (srt: string) => {
    if (!srt) return 0;
    const normalized = srt.replace(/\r\n/g, '\n');
    const blocks = normalized.split('\n\n').filter(b => b.trim());
    return blocks.length;
  };

  const countOccurrences = (text: string, query: string) => {
    if (!text || !query) return 0;
    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = text.match(new RegExp(escapedQuery, 'gi'));
      return matches ? matches.length : 0;
    } catch (e) {
      return 0;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Search Box */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '0 12px' }}>
        <Search className="w-4 h-4 mr-2" style={{ color: 'var(--color-text-secondary)' }} />
        <input
          type="text"
          placeholder="Tìm kiếm cụm từ trong phụ đề..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'white', padding: '10px 0', fontSize: '0.8rem' }}
        />
        {searchQuery && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-cyan)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {countOccurrences(srtInput, searchQuery)} gốc | {countOccurrences(translatedSRT, searchQuery)} dịch
          </span>
        )}
      </div>

      {/* Side-by-Side Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Original Text Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <span className="form-label" style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Nội Dung Gốc (Original)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCopy(srtInput, true)}
                disabled={!srtInput}
                style={{ background: 'transparent', border: 'none', color: srtInput ? 'var(--color-cyan)' : 'var(--color-text-secondary)', cursor: srtInput ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}
                title="Copy toàn bộ nội dung gốc"
              >
                {copiedOriginal ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedOriginal ? 'Đã Copy' : 'Copy'}</span>
              </button>
              <button
                onClick={handleClearOriginal}
                disabled={!srtInput}
                style={{ background: 'transparent', border: 'none', color: srtInput ? '#ef4444' : 'var(--color-text-secondary)', cursor: srtInput ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}
                title="Xóa nội dung gốc"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            </div>
          </div>
          <textarea
            value={srtInput || ''}
            onChange={(e) => setSrtInput(e.target.value)}
            placeholder="Nội dung phụ đề gốc..."
            className="form-textarea"
            style={{ height: '420px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.75rem', border: 'none', borderRadius: 0, outline: 'none', padding: '12px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderTop: '1px solid var(--color-border)', fontSize: '0.65rem', color: 'var(--color-text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
            <span>Ký tự: {srtInput?.length || 0}</span>
            <span>Segment: {getSegmentCount(srtInput || '')}</span>
          </div>
        </div>
        
        {/* Translated Text Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <span className="form-label" style={{ margin: 0, fontWeight: 600, color: 'var(--color-cyan)' }}>Kết Quả Dịch (Translated)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCopy(translatedSRT, false)}
                disabled={!translatedSRT}
                style={{ background: 'transparent', border: 'none', color: translatedSRT ? 'var(--color-cyan)' : 'var(--color-text-secondary)', cursor: translatedSRT ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}
                title="Copy toàn bộ kết quả dịch"
              >
                {copiedTranslated ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTranslated ? 'Đã Copy' : 'Copy'}</span>
              </button>
              {translatedSRT && (
                <button
                  onClick={handleDownloadTranslated}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}
                  title="Tải phụ đề dịch về máy"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải (.srt)</span>
                </button>
              )}
            </div>
          </div>
          <textarea
            value={translatedSRT || ''}
            readOnly
            placeholder="Kết quả dịch..."
            className="form-textarea"
            style={{ height: '420px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.75rem', backgroundColor: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: 0, outline: 'none', padding: '12px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderTop: '1px solid var(--color-border)', fontSize: '0.65rem', color: 'var(--color-text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
            <span>Ký tự: {translatedSRT?.length || 0}</span>
            <span>Segment: {getSegmentCount(translatedSRT || '')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
