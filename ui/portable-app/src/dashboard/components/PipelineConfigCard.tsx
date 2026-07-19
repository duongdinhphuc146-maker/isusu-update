import React from 'react';
import { Upload, FileVideo, FileAudio, X, Sparkles, RefreshCw } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  flag: string;
}

interface Provider {
  id: string;
  name: string;
  available: boolean;
}

interface PipelineConfigCardProps {
  sttMode: 'extract' | 'upload';
  setSttMode: (mode: 'extract' | 'upload') => void;
  mediaFile: File | null;
  setMediaFile: (file: File | null) => void;
  sttLang: string;
  setSttLang: (lang: string) => void;
  languages: Language[];
  providers: Provider[];
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
  targetLang: string;
  setTargetLang: (lang: string) => void;
  sttLoading: boolean;
  translateLoading: boolean;
  sttProgress: number;
  srtInput: string;
  handleStage1Profile: () => void;
  handleStage2Dub: () => void;
  translateStatus: string;
  characterMapLength: number;
  handleSrtFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function PipelineConfigCard({
  sttMode,
  setSttMode,
  mediaFile,
  setMediaFile,
  sttLang,
  setSttLang,
  languages,
  providers,
  selectedProvider,
  setSelectedProvider,
  targetLang,
  setTargetLang,
  sttLoading,
  translateLoading,
  sttProgress,
  srtInput,
  handleStage1Profile,
  handleStage2Dub,
  translateStatus,
  characterMapLength,
  handleSrtFileChange,
}: PipelineConfigCardProps) {
  return (
    <div className="settings-section">
      <h3 className="panel-title" style={{ fontSize: '0.95rem' }}>1-Click Dialogue Pipeline</h3>
      <p className="panel-subtitle" style={{ marginBottom: '12px' }}>Chỉ cần tải video/audio đầu vào, hệ thống tự động xử lý trọn gói quy trình.</p>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
        <button
          onClick={() => setSttMode('extract')}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid ' + (sttMode === 'extract' ? 'var(--color-cyan)' : 'var(--color-border)'),
            backgroundColor: sttMode === 'extract' ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
            color: sttMode === 'extract' ? 'var(--color-cyan)' : 'white'
          }}
        >
          Từ file Video/Audio (STT + Dịch + Lồng tiếng)
        </button>
        <button
          onClick={() => setSttMode('upload')}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid ' + (sttMode === 'upload' ? 'var(--color-cyan)' : 'var(--color-border)'),
            backgroundColor: sttMode === 'upload' ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
            color: sttMode === 'upload' ? 'var(--color-cyan)' : 'white'
          }}
        >
          Sử dụng file SRT có sẵn (Dịch + Lồng tiếng)
        </button>
      </div>

      {sttMode === 'extract' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.25rem' }}>
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Chọn file Video hoặc Audio</label>
              {!mediaFile ? (
                <div style={{ border: '2px dashed var(--color-border)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--color-surface-card)' }}>
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => setMediaFile(e.target.files ? e.target.files[0] : null)}
                    style={{ display: 'none' }}
                    id="dialogue-media-uploader"
                  />
                  <label htmlFor="dialogue-media-uploader" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload className="w-8 h-8" style={{ color: 'var(--color-cyan)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '0.75rem', color: 'white', fontWeight: 600 }}>Tải lên file video/audio</p>
                  </label>
                </div>
              ) : (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {mediaFile.type?.startsWith('video/') ? (
                    <FileVideo className="w-6 h-6 text-cyan-400" />
                  ) : (
                    <FileAudio className="w-6 h-6 text-cyan-400" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.75rem', color: 'white', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mediaFile.name}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{(mediaFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button onClick={() => setMediaFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>Ngôn ngữ phát âm gốc</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSttLang(lang.code)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid ' + (sttLang === lang.code ? 'var(--color-cyan)' : 'var(--color-border)'),
                      backgroundColor: sttLang === lang.code ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                      color: sttLang === lang.code ? 'var(--color-cyan)' : 'white'
                    }}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1rem', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ background: 'rgba(0, 240, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.1)', padding: '12px', borderRadius: '8px', fontSize: '0.7rem', color: '#e5e7eb', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--color-cyan)', display: 'block', marginBottom: '4px' }}>🔥 Tự động hoá 1-Click:</strong>
              Sau khi trích xuất phụ đề (STT) xong, hệ thống sẽ tự động dịch, phân tích nhân vật, sinh giọng nói và mix timeline audio hoàn thiện.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Tải lên tệp phụ đề (.srt)</label>
            <div style={{ border: '2px dashed var(--color-border)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--color-surface-card)' }}>
              <input
                type="file"
                accept=".srt"
                onChange={handleSrtFileChange}
                style={{ display: 'none' }}
                id="srt-direct-uploader"
              />
              <label htmlFor="srt-direct-uploader" style={{ cursor: 'pointer', display: 'block' }}>
                <Upload className="w-8 h-8" style={{ color: 'var(--color-cyan)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.75rem', color: 'white', fontWeight: 600 }}>Chọn file phụ đề .srt đầu vào</p>
              </label>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Chọn Trình Dịch (AI Provider)</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="form-select"
            style={{ fontSize: '0.8rem', padding: '8px' }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.name} {!p.available ? ' (Chưa cấu hình)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Chọn Ngôn Ngữ Đích</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="form-select"
            style={{ fontSize: '0.8rem', padding: '8px' }}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
        <button
          onClick={handleStage1Profile}
          disabled={sttLoading || translateLoading || (sttMode === 'extract' && !mediaFile) || (sttMode === 'upload' && !srtInput)}
          className="btn-primary"
          style={{ padding: '10px', background: 'var(--gradient-neon)', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          {sttLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Trích xuất SRT ({sttProgress}%)...</span>
            </>
          ) : (translateLoading && translateStatus !== 'waiting_voices') ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang phân tích...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>1. Phân Tích Nhân Vật</span>
            </>
          )}
        </button>

        <button
          onClick={handleStage2Dub}
          disabled={sttLoading || translateLoading || characterMapLength === 0 || (translateStatus !== 'waiting_voices' && translateStatus !== 'succeed' && translateStatus !== 'failed')}
          className="btn-primary"
          style={{
            padding: '10px',
            background: (translateStatus === 'waiting_voices') ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.05)',
            border: (translateStatus === 'waiting_voices') ? 'none' : '1px solid rgba(255,255,255,0.1)',
            color: (translateStatus === 'waiting_voices') ? 'white' : 'var(--color-text-muted)',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            cursor: (translateStatus === 'waiting_voices') ? 'pointer' : 'not-allowed'
          }}
        >
          {translateLoading && translateStatus === 'processing' ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang tạo audio...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>2. Dịch & Lồng Tiếng</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
