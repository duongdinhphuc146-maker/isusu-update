import React, { useState } from 'react';
import { Volume2, Sparkles, AudioLines } from 'lucide-react';
import VieNeuSettings from './components/VieNeuSettings';
import VieNeuGuide from './components/VieNeuGuide';
import VieNeuSetupPanel from './components/VieNeuSetupPanel';
import VieNeuStandardTTS from './components/VieNeuStandardTTS';
import VieNeuVoiceCloning from './components/VieNeuVoiceCloning';

export default function VieNeuTTSPage() {
  const [mode, setMode] = useState<'local' | 'remote'>(() => {
    return (localStorage.getItem('vieneu_mode') as 'local' | 'remote') || 'remote';
  });
  const [apiBase, setApiBase] = useState(() => {
    return localStorage.getItem('vieneu_api_base') || 'http://localhost:23333/v1';
  });
  const [device, setDevice] = useState<'auto' | 'cpu' | 'cuda'>(() => {
    return (localStorage.getItem('vieneu_device') as 'auto' | 'cpu' | 'cuda') || 'auto';
  });
  const [activeSubTab, setActiveSubTab] = useState<'tts' | 'clone'>('tts');

  const handleSetMode = (m: 'local' | 'remote') => {
    setMode(m);
    localStorage.setItem('vieneu_mode', m);
  };

  const handleSetApiBase = (url: string) => {
    setApiBase(url);
    localStorage.setItem('vieneu_api_base', url);
  };

  const handleSetDevice = (d: 'auto' | 'cpu' | 'cuda') => {
    setDevice(d);
    localStorage.setItem('vieneu_device', d);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles className="w-6 h-6 text-indigo-400" />
            VieNeu-TTS (Vietnamese TTS)
          </h2>
          <p className="panel-subtitle">
            Hỗ trợ chuyển đổi giọng nói tiếng Việt tự nhiên và sao chép giọng nói tức thì (Zero-Shot Voice Cloning).
          </p>
        </div>
      </div>

      {/* Auto Setup Status Panel */}
      <VieNeuSetupPanel />

      {/* System Settings */}
      <VieNeuSettings 
        mode={mode} 
        setMode={handleSetMode} 
        apiBase={apiBase} 
        setApiBase={handleSetApiBase} 
        device={device}
        setDevice={handleSetDevice}
      />

      {/* Tabs Selection */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        gap: '1.5rem',
        marginBottom: '1rem'
      }}>
        <button
          onClick={() => setActiveSubTab('tts')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'tts' ? '3px solid var(--color-cyan)' : '3px solid transparent',
            color: activeSubTab === 'tts' ? 'white' : 'var(--color-text-secondary)',
            padding: '10px 14px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Volume2 className="w-4 h-4" />
          Sinh giọng nói chuẩn (Standard TTS)
        </button>
        <button
          onClick={() => setActiveSubTab('clone')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'clone' ? '3px solid var(--color-cyan)' : '3px solid transparent',
            color: activeSubTab === 'clone' ? 'white' : 'var(--color-text-secondary)',
            padding: '10px 14px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AudioLines className="w-4 h-4" />
          Sao chép giọng nói (Voice Cloning)
        </button>
      </div>

      {/* Tab Panels */}
      {activeSubTab === 'tts' ? (
        <VieNeuStandardTTS mode={mode} apiBase={apiBase} device={device} />
      ) : (
        <VieNeuVoiceCloning mode={mode} apiBase={apiBase} device={device} />
      )}

      {/* Collapsible Manual Guide */}
      <VieNeuGuide />
    </div>
  );
}
