import React, { useState, useMemo } from 'react';
import { Play, Volume2, Download, RefreshCw, HelpCircle, AlertCircle } from 'lucide-react';
import { Voice } from '../types';
import { useEditorStore } from '../../store/editorStore';

interface VoicePageProps {
  voices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (v: Voice) => void;
  backendStatus: string;
}

const languageNames: Record<string, string> = {
  "vi": "Tiếng Việt",
  "en": "Tiếng Anh",
  "zh": "Tiếng Trung",
  "ja": "Tiếng Nhật",
  "ko": "Tiếng Hàn",
  "th": "Tiếng Thái",
  "es": "Tiếng Tây Ban Nha",
  "pt": "Tiếng Bồ Đào Nha",
  "id": "Tiếng Indonesia",
  "ms": "Tiếng Mã Lai"
};

export default function VoicePage({ voices, selectedVoice, setSelectedVoice, backendStatus }: VoicePageProps) {
  const {
    ttsText: text,
    setTtsText: setText,
    ttsRate: rate,
    setTtsRate: setRate,
    ttsAudioUrl: audioUrl,
    setTtsAudioUrl: setAudioUrl,
    ttsLoading: loading,
    setTtsLoading: setLoading,
    ttsError: error,
    setTtsError: setError
  } = useEditorStore();
  
  // Default to Vietnamese ('vi') or the language of the currently selected voice
  const [selectedLang, setSelectedLang] = useState<string>(selectedVoice.lan || 'vi');

  // Extract unique languages available in voice profiles list
  const availableLangs = useMemo(() => {
    const langs = new Set<string>();
    voices.forEach(v => {
      if (v.lan) langs.add(v.lan);
    });
    return Array.from(langs);
  }, [voices]);

  // Filter voices list by selected language
  const filteredVoices = useMemo(() => {
    return voices.filter(v => v.lan === selectedLang);
  }, [voices, selectedLang]);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleLangChange = (lang: string) => {
    setSelectedLang(lang);
    const firstVoice = voices.find(v => v.lan === lang);
    if (firstVoice) {
      setSelectedVoice(firstVoice);
    }
  };

  const handleGenerateTTS = async () => {
    setLoading(true);
    setError(null);
    setAudioUrl(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const maxRetries = 2;
    let attempt = 0;
    let success = false;

    const timeoutId = setTimeout(() => {
      controller.abort();
      setError('Yêu cầu hết thời gian (Timeout). Vui lòng thử lại.');
      setLoading(false);
    }, 45000);

    while (attempt <= maxRetries && !success) {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'capcut_local_secret_key_2026'
          },
          body: JSON.stringify({
            text: text,
            voice: selectedVoice.voice_type,
            resource_id: selectedVoice.resource_id,
            rate: rate.toFixed(1),
          }),
          signal: controller.signal
        });

        const data = await response.json();
        if (data.success && data.audio_url) {
          setAudioUrl(data.audio_url);
          success = true;
        } else {
          throw new Error(data.error || 'Không thể tạo âm thanh.');
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Request aborted');
          return;
        }
        attempt++;
        if (attempt > maxRetries) {
          setError(err.message || 'Không thể kết nối đến backend dịch vụ Go.');
        } else {
          console.warn(`Attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    clearTimeout(timeoutId);
    setLoading(false);
  };

  const handleCancelTTS = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setError('Đã hủy yêu cầu sinh giọng nói.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="panel-title">Chuyển đổi Văn Bản thành Giọng Nói (TTS)</h2>
        <p className="panel-subtitle">Sử dụng API ẩn của CapCut để tạo ra giọng nói tự nhiên chất lượng cao.</p>
      </div>

      <div className="editor-grid-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          <div className="form-group">
            <label className="form-label">Nội dung văn bản</label>
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="form-textarea"
              placeholder="Nhập nội dung cần đọc tại đây..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Chọn Ngôn Ngữ</label>
              <select 
                value={selectedLang}
                onChange={(e) => handleLangChange(e.target.value)}
                className="form-select"
              >
                {availableLangs.map((langCode) => (
                  <option key={langCode} value={langCode}>
                    {languageNames[langCode] || langCode.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Giọng đọc ({filteredVoices.length})</label>
              <select 
                value={JSON.stringify(selectedVoice)}
                onChange={(e) => setSelectedVoice(JSON.parse(e.target.value))}
                className="form-select"
              >
                {filteredVoices.map((v, idx) => (
                  <option key={idx} value={JSON.stringify(v)}>
                    {v.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tốc độ đọc: {rate.toFixed(1)}x</label>
            <div className="slider-container">
              <input 
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="form-slider"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleGenerateTTS}
              disabled={loading || backendStatus !== 'running'}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Đang kết nối CapCut...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" style={{ fill: 'currentColor' }} />
                  <span>Tạo Giọng Nói CapCut</span>
                </>
              )}
            </button>

            {loading && (
              <button
                onClick={handleCancelTTS}
                className="btn-download"
                style={{ backgroundColor: 'var(--color-red)', color: 'white', border: 'none', padding: '0 16px', borderRadius: '12px' }}
              >
                Hủy
              </button>
            )}
          </div>
        </div>

        <div className="result-card">
          <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center' }}>
              <Volume2 className="w-4 h-4 text-[#00f0ff]" style={{ marginRight: '8px' }} /> Kết quả âm thanh
            </h3>
            
            {audioUrl ? (
              <div className="audio-preview">
                <div className="audio-player-wrapper">
                  <audio controls src={audioUrl} />
                </div>
                
                <a href={audioUrl} target="_blank" rel="noreferrer" className="btn-download">
                  <Download className="w-4 h-4" />
                  <span>Tải xuống tệp MP3</span>
                </a>
              </div>
            ) : (
              <div style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem 0' }}>
                <HelpCircle className="w-12 h-12" style={{ color: 'var(--color-border)', margin: '0 auto' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '12px' }}>Chưa có âm thanh được tạo.</p>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#2d1212', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--color-red)' }}>
                <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1.5rem', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
            * Các giọng đọc được tối ưu hóa cho tốc độ xử lý nhanh và hoàn toàn miễn phí.
          </div>
        </div>
      </div>
    </div>
  );
}
