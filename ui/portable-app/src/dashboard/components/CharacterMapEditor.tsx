import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslateStore } from '../../store/translateStore';
import { useSystemStore } from '../../store/systemStore';
import { defaultVoices } from '../types';

export default function CharacterMapEditor() {
  const { characterMap, updateCharacterVoice, dialogueMode, voices, targetLang } = useTranslateStore();
  const { addToast } = useSystemStore();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<HTMLAudioElement | null>(null);

  const playVoicePreview = async (voice: any) => {
    if (!voice.voice_type || !voice.resource_id) {
      addToast("Thông tin giọng đọc không đầy đủ để nghe thử.", "error");
      return;
    }

    if (playingVoiceId === voice.voice_type) {
      if (audioPreview) {
        audioPreview.pause();
        setPlayingVoiceId(null);
      }
      return;
    }

    if (audioPreview) {
      audioPreview.pause();
    }

    setPlayingVoiceId(voice.voice_type);

    const previewTexts: Record<string, string> = {
      vi: "Xin chào, đây là bản thử nghiệm giọng đọc của tôi.",
      en: "Hello, this is a preview of my voice.",
      ja: "こんにちは、これは私の声のプレビューです。",
      zh: "你好，这是我的声音预览。",
      th: "สวัสดีนี่คือตัวอย่างเสียง của tôi",
    };
    const lanKey = (voice.lan || 'en').toLowerCase().split('-')[0].split('_')[0];
    const text = previewTexts[lanKey] || "Hello, this is a voice preview.";

    try {
      console.log("Playing voice preview:", voice.voice_type, "with resource ID:", voice.resource_id);
      const res = await fetch('http://127.0.0.1:5000/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'capcut_local_secret_key_2026',
        },
        body: JSON.stringify({
          text,
          voice: voice.voice_type,
          resource_id: voice.resource_id,
          rate: "1.0",
        }),
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.success && data.audio_url) {
        const audio = new Audio(data.audio_url);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          addToast("Không thể phát âm thanh nghe thử.", "error");
          setPlayingVoiceId(null);
        };
        await audio.play();
        setAudioPreview(audio);
      } else {
        addToast(data.error || "Lỗi tạo giọng nói nghe thử.", "error");
        setPlayingVoiceId(null);
      }
    } catch (err: any) {
      console.error("TTS preview error:", err);
      addToast(`Lỗi kết nối nghe thử: ${err.message || err}`, "error");
      setPlayingVoiceId(null);
    }
  };

  if (!dialogueMode || characterMap.length === 0) {
    return null;
  }

  const langKey = (targetLang || 'vi').split('-')[0].toLowerCase();
  const filteredVoices = voices.filter(v => v.lan?.toLowerCase() === langKey);
  const displayVoices = filteredVoices.length > 0 ? filteredVoices : (voices.length > 0 ? voices : defaultVoices);

  return (
    <div className="settings-section" style={{ marginTop: '1.25rem' }}>
      <h3 className="panel-title" style={{ fontSize: '1rem' }}>Cấu Hình Giọng Đọc Nhân Vật (Character Voice Mapping)</h3>
      <p className="panel-subtitle">Gán giọng đọc phù hợp cho từng nhân vật phát hiện bởi trí tuệ nhân tạo.</p>
      
      <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Mã NV</th>
              <th style={{ padding: '8px' }}>Tên Nhân Vật</th>
              <th style={{ padding: '8px' }}>Giới Tính</th>
              <th style={{ padding: '8px' }}>Tính Cách / Đặc Điểm</th>
              <th style={{ padding: '8px' }}>Chọn Giọng Đọc CapCut</th>
            </tr>
          </thead>
          <tbody>
            {characterMap.map((char) => (
              <tr key={char.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '8px', fontWeight: 'bold', color: '#10b981' }}>{char.id}</td>
                <td style={{ padding: '8px' }}>{char.name}</td>
                <td style={{ padding: '8px', textTransform: 'capitalize' }}>{char.gender}</td>
                <td style={{ padding: '8px', color: '#9ca3af', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{char.traits}</td>
                <td style={{ padding: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={char.voice_type || ''}
                      onChange={(e) => {
                        const selectedVoice = displayVoices.find(v => v.voice_type === e.target.value);
                        if (selectedVoice) {
                          updateCharacterVoice(char.id, selectedVoice.voice_type, selectedVoice.resource_id);
                        }
                      }}
                      style={{
                        background: '#1f2937',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        outline: 'none',
                        cursor: 'pointer',
                        flex: 1
                      }}
                    >
                      <option value="">-- Chọn giọng đọc --</option>
                      {displayVoices.map((voice) => (
                        <option key={voice.voice_type} value={voice.voice_type}>
                          {voice.display_name} ({voice.lang || voice.lan})
                        </option>
                      ))}
                    </select>
                    {char.voice_type && (
                      <button
                        onClick={() => {
                          playVoicePreview({
                            voice_type: char.voice_type,
                            resource_id: char.resource_id,
                            lan: targetLang
                          });
                        }}
                        style={{
                          background: playingVoiceId === char.voice_type ? 'var(--color-cyan)' : 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: playingVoiceId === char.voice_type ? 'black' : 'white',
                          padding: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          transition: 'all 0.2s ease-in-out'
                        }}
                        title={playingVoiceId === char.voice_type ? "Dừng nghe thử" : "Nghe thử giọng này (Lưu cache)"}
                      >
                        {playingVoiceId === char.voice_type ? (
                          <VolumeX size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
