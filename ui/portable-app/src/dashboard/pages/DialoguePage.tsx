import React, { useEffect, useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import { useTranslateStore } from '../../store/translateStore';
import { useSystemStore } from '../../store/systemStore';
import SessionCapturePanel from '../components/SessionCapturePanel';
import AudioPlayerPanel from '../components/AudioPlayerPanel';
import CharacterMapEditor from '../components/CharacterMapEditor';
import PipelineDashboard from '../components/PipelineDashboard';
import PipelineConfigCard from '../components/PipelineConfigCard';
import ConsoleLogPanel from '../components/ConsoleLogPanel';
import GpuSettingsCard from '../components/GpuSettingsCard';

const LANGUAGES = [
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en-US', name: 'Tiếng Anh', flag: '🇺🇸' },
  { code: 'ja-JP', name: 'Tiếng Nhật', flag: '🇯🇵' },
  { code: 'zh-CN', name: 'Tiếng Trung', flag: '🇨🇳' },
  { code: 'ko-KR', name: 'Tiếng Hàn', flag: '🇰🇷' },
];

export default function DialoguePage() {
  const {
    providers, selectedProvider, targetLang, srtInput, translateLoading,
    setSelectedProvider, setTargetLang, setSrtInput, startTranslation,
    translateLogs, setDialogueMode, fetchProviders, resumeTranslationPolling,
    voices, audioUrl, fetchVoices, translateStatus, characterMap
  } = useTranslateStore();

  const { addToast } = useSystemStore();
  const [sttMode, setSttMode] = useState<'extract' | 'upload'>('extract');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [sttLang, setSttLang] = useState('vi-VN');
  const [sttLoading, setSttLoading] = useState(false);
  const [sttProgress, setSttProgress] = useState(0);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [showLogConsole, setShowLogConsole] = useState(true);

  useEffect(() => {
    setDialogueMode(true);
    fetchProviders();
    fetchVoices();
    resumeTranslationPolling();
    return () => { setDialogueMode(false); };
  }, []);

  useEffect(() => {
    if (translateLogs?.length > 0) {
      setPipelineLogs(prev => [
        ...prev.filter(l => l.startsWith('[STT]')),
        ...translateLogs.map(l => `[AI] ${l}`)
      ]);
    }
  }, [translateLogs]);

  const handleStage1Profile = async () => {
    if (sttMode === 'extract') {
      if (!mediaFile) return addToast('Vui lòng chọn file video/audio trước!', 'error');
      setSttLoading(true);
      setSttProgress(0);
      setPipelineLogs([`[STT] Bắt đầu trích xuất từ: ${mediaFile.name}...`]);
      addToast('Đang trích xuất phụ đề tự động (STT)...', 'success');

      const formData = new FormData();
      formData.append('file', mediaFile);
      formData.append('lang', sttLang);

      try {
        const response = await fetch('http://127.0.0.1:5000/api/stt', {
          method: 'POST',
          headers: { 'X-API-Key': 'capcut_local_secret_key_2026' },
          body: formData
        });
        const data = await response.json();
        if (!data.success) {
          setSttLoading(false);
          return addToast(data.error || 'Trích xuất thất bại', 'error');
        }

        const poll = setInterval(async () => {
          try {
            const res = await fetch(`http://127.0.0.1:5000/api/stt?task_id=${data.task_id}`, {
              headers: { 'X-API-Key': 'capcut_local_secret_key_2026' }
            });
            const status = await res.json();
            if (status.progress !== undefined) setSttProgress(status.progress);
            if (status.logs) {
              setPipelineLogs(prev => [
                ...status.logs.map((l: string) => `[STT] ${l}`),
                ...prev.filter(l => !l.startsWith('[STT]'))
              ]);
            }
            if (status.status === 'succeed') {
              clearInterval(poll);
              setSrtInput(status.srt || '');
              setSttLoading(false);
              addToast('Đang phân tích nhân vật...', 'success');
              setTimeout(() => { startTranslation('profile'); }, 500);
            } else if (status.status === 'failed') {
              clearInterval(poll);
              setSttLoading(false);
              addToast(status.error || 'Nhận dạng thất bại', 'error');
            }
          } catch {
            clearInterval(poll);
            setSttLoading(false);
          }
        }, 1000);
      } catch {
        setSttLoading(false);
        addToast('Lỗi kết nối đến backend', 'error');
      }
    } else {
      startTranslation('profile');
    }
  };

  const handleStage2Dub = () => {
    addToast('Đang tiến hành dịch thuật & sinh giọng nói...', 'success');
    startTranslation('dub');
  };

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="panel-title">Dịch Hội Thoại Đa Nhiệm (Dialogue Mode)</h2>
          <p className="panel-subtitle">Tách và sinh giọng nói nhân vật thông minh, trích xuất srt từ video tự động.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowLogConsole(!showLogConsole)}
            className="btn-download"
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: showLogConsole ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
              backgroundColor: showLogConsole ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
              color: showLogConsole ? 'var(--color-cyan)' : 'white'
            }}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{showLogConsole ? 'Ẩn Logs' : 'Xem Logs'}</span>
          </button>
          <button
            onClick={fetchProviders}
            className="btn-download"
            style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tải Lại API</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <PipelineConfigCard
            sttMode={sttMode}
            setSttMode={setSttMode}
            mediaFile={mediaFile}
            setMediaFile={setMediaFile}
            sttLang={sttLang}
            setSttLang={setSttLang}
            languages={LANGUAGES}
            providers={providers}
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            targetLang={targetLang}
            setTargetLang={setTargetLang}
            sttLoading={sttLoading}
            translateLoading={translateLoading}
            sttProgress={sttProgress}
            srtInput={srtInput}
            handleStage1Profile={handleStage1Profile}
            handleStage2Dub={handleStage2Dub}
            translateStatus={translateStatus}
            characterMapLength={characterMap.length}
            handleSrtFileChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (event) => {
                if (event.target?.result) {
                  setSrtInput(event.target.result as string);
                  addToast(`Đã nạp file phụ đề: ${file.name}`, 'success');
                  setPipelineLogs([`[SRT] Đã nạp file phụ đề SRT thành công: ${file.name}`]);
                }
              };
              reader.readAsText(file);
            }}
          />
          <PipelineDashboard />
        </div>

        <ConsoleLogPanel
          logs={pipelineLogs}
          isOpen={showLogConsole}
          onClose={() => setShowLogConsole(false)}
        />

        <CharacterMapEditor />
        <GpuSettingsCard addToast={addToast} />
        <AudioPlayerPanel audioUrl={audioUrl} />
        <SessionCapturePanel />
      </div>
    </div>
  );
}
