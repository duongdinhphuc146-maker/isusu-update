import React, { useMemo } from 'react';
import { Voice } from '../types';

interface SubtitleSelectorProps {
  voices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (v: Voice) => void;
  selectedLang: string;
  setSelectedLang: (l: string) => void;
  rate: number;
  setRate: (r: number) => void;
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

export default function SubtitleSelector({
  voices,
  selectedVoice,
  setSelectedVoice,
  selectedLang,
  setSelectedLang,
  rate,
  setRate
}: SubtitleSelectorProps) {
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

  const handleLangChange = (lang: string) => {
    setSelectedLang(lang);
    const firstVoice = voices.find(v => v.lan === lang);
    if (firstVoice) {
      setSelectedVoice(firstVoice);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
    </div>
  );
}
