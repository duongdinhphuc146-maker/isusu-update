import React, { useState, useRef } from 'react';
import { Volume2, Smile, AlertCircle, Play, Download } from 'lucide-react';

const PRESETS = [
  { name: "Trúc Ly", desc: "Trúc Ly — Nữ · Bắc · Phong cách tự nhiên" },
  { name: "Phạm Tuyên", desc: "Phạm Tuyên — Nam · Bắc · Phong cách tự nhiên" },
  { name: "Thái Sơn", desc: "Thái Sơn — Nam · Nam · Phong cách kể chuyện" },
  { name: "Xuân Vĩnh", desc: "Xuân Vĩnh — Nam · Nam · Phong cách tự nhiên" },
  { name: "Thanh Bình", desc: "Thanh Bình — Nam · Bắc · Phong cách kể chuyện" },
  { name: "Minh Đức", desc: "Minh Đức — Nam · Bắc · Phong cách tin tức" },
  { name: "Ngọc Linh", desc: "Ngọc Linh — Nữ · Bắc · Phong cách kể chuyện" },
  { name: "Đoan Trang", desc: "Đoan Trang — Nữ · Bắc · Phong cách tự nhiên" },
  { name: "Mai Anh", desc: "Mai Anh — Nữ · Bắc · Phong cách tin tức" },
  { name: "Thục Đoan", desc: "Thục Đoan — Nữ · Nam · Phong cách kể chuyện" },
  { name: "Minh Triết", desc: "Minh Triết — Nam · Nam · Phong cách tin tức" },
  { name: "Thùy Dung", desc: "Thùy Dung — Nữ · Nam · Phong cách tin tức" },
  { name: "Quang Sơn", desc: "Quang Sơn — Nam · Trung · Phong cách tự nhiên" },
  { name: "Ngọc Trân", desc: "Ngọc Trân — Nữ · Trung · Phong cách tự nhiên" }
];

const EMOTIONS = [
  { tag: "[cười]", label: "Cười 😊" },
  { tag: "[thở dài]", label: "Thở dài 💨" },
  { tag: "[hắng giọng]", label: "Hắng giọng 🗣️" },
  { tag: "[khóc]", label: "Khóc 😢" },
  { tag: "[ngáp]", label: "Ngáp 🥱" },
  { tag: "[nhai]", label: "Nhai 🍎" },
  { tag: "[ho]", label: "Ho 😷" },
  { tag: "[thì thầm]", label: "Thì thầm 🤫" },
  { tag: "[la hét]", label: "La hét 😱" },
  { tag: "[thở dốc]", label: "Thở dốc 🥵" },
  { tag: "[e hèm]", label: "E hèm 🤨" },
  { tag: "[chậc]", label: "Chậc 👅" }
];

interface StandardTTSProps {
  mode: 'local' | 'remote';
  apiBase: string;
  device: 'auto' | 'cpu' | 'cuda';
}

export default function VieNeuStandardTTS({ mode, apiBase, device }: StandardTTSProps) {
  const [text, setText] = useState('Chào mừng bạn đến với VieNeu-TTS [cười], giọng nói nhân tạo.');
  const [voice, setVoice] = useState('Trúc Ly');
  const [readingStyle, setReadingStyle] = useState('tu_nhien');
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + tag + text.substring(end);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    const formData = new FormData();
    formData.append('text', text);
    formData.append('voice', voice);
    formData.append('mode', mode);
    formData.append('api_base', apiBase);
    formData.append('style', readingStyle);
    formData.append('device', device);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/vieneu/tts', {
        method: 'POST',
        headers: { 'X-API-Key': 'capcut_local_secret_key_2026' },
        body: formData
      });
      const data = await res.json();
      if (data.success) setAudioUrl(data.audio_url);
      else setError(data.error || 'Lỗi sinh giọng nói.');
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editor-grid-layout" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
        <div className="form-group">
          <label className="form-label">Văn bản cần đọc</label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="form-textarea"
            placeholder="Nhập nội dung văn bản..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Chèn Cảm Xúc ({EMOTIONS.length} loại)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {EMOTIONS.map(e => (
              <button
                key={e.tag}
                type="button"
                onClick={() => insertTag(e.tag)}
                style={{
                  backgroundColor: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Smile className="w-3.5 h-3.5" style={{ color: 'var(--color-cyan)' }} />
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">Chọn giọng đọc tiếng việt</label>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className="form-select">
            {PRESETS.map(v => <option key={v.name} value={v.name}>{v.desc}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Phong cách đọc (Reading Style)</label>
          <select value={readingStyle} onChange={(e) => setReadingStyle(e.target.value)} className="form-select">
            <option value="tu_nhien">Tự nhiên / Trò chuyện (tu_nhien)</option>
            <option value="tin_tuc">Đọc tin tức / Báo chí (tin_tuc)</option>
            <option value="doc_truyen">Kể chuyện / Đọc truyện (doc_truyen)</option>
          </select>
        </div>

        <button onClick={handleGenerate} disabled={loading || !text} className="btn-primary" style={{ width: '100%', marginTop: 'auto' }}>
          <Volume2 className="w-5 h-5" />
          {loading ? "Đang xử lý..." : "Sinh giọng nói"}
        </button>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-red)', color: 'var(--color-red)', padding: '0.75rem', borderRadius: '8px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {audioUrl && (
          <div className="result-card" style={{ padding: '1rem', marginTop: '0.5rem' }}>
            <audio src={audioUrl} controls style={{ width: '100%', marginBottom: '8px' }} />
            <a href={audioUrl} download="vieneu_tts.wav" className="btn-download" style={{ width: '100%' }}>
              <Download className="w-4 h-4" /> Tải về âm thanh
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
