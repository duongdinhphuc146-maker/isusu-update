import React, { useState } from 'react';
import { Upload, CheckCircle } from 'lucide-react';
import { useTranslateStore } from '../../store/translateStore';
import { SUPPORTED_LANGUAGES } from '../types';

export default function TranslationConfigPanel() {
  const {
    providers,
    selectedProvider,
    targetLang,
    srtInput,
    translateLoading,
    setSelectedProvider,
    setTargetLang,
    setSrtInput,
    startTranslation
  } = useTranslateStore();

  const [srtFile, setSrtFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSrtFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSrtInput(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="form-group">
        <label className="form-label">Tải lên tệp phụ đề (.srt)</label>
        <div style={{ border: '2px dashed var(--color-border)', padding: '1.5rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--color-surface-card)', transition: 'all 0.2s' }}>
          <input 
            type="file" 
            accept=".srt" 
            onChange={handleFileChange}
            style={{ display: 'none' }} 
            id="srt-uploader"
          />
          <label htmlFor="srt-uploader" style={{ cursor: 'pointer', display: 'block' }}>
            <Upload className="w-8 h-8" style={{ color: 'var(--color-cyan)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600 }}>
              {srtFile ? srtFile.name : 'Chọn tệp phụ đề SRT'}
            </p>
            <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {srtFile ? `${(srtFile.size / 1024).toFixed(1)} KB` : 'Nhấp hoặc kéo thả file srt vào đây'}
            </p>
          </label>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Chọn Trình Dịch (AI Provider)</label>
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="form-select"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.available}>
              {p.name} {!p.available ? ' (Chưa cấu hình)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Chọn Ngôn Ngữ Đích</label>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="form-select"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={startTranslation}
        disabled={translateLoading || !srtInput}
        className="btn-primary"
        style={{ marginTop: '0.5rem' }}
      >
        <CheckCircle className="w-5 h-5" />
        <span>Bắt Đầu Dịch Phụ Đề</span>
      </button>
    </div>
  );
}
