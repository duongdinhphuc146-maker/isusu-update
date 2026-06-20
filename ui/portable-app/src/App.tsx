import React, { useEffect } from 'react';

import DashboardLayout from './dashboard/layouts/DashboardLayout';
import HomePage from './dashboard/pages/HomePage';
import VoicePage from './dashboard/pages/VoicePage';
import SubtitlePage from './dashboard/pages/SubtitlePage';
import STTPage from './dashboard/pages/STTPage';
import TranslatePage from './dashboard/pages/TranslatePage';
import SystemPage from './dashboard/pages/SystemPage';
import ToastContainer from './dashboard/components/ToastContainer';

import { Voice } from './dashboard/types';
import { useEditorStore } from './store/editorStore';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    selectedVoice,
    setSelectedVoice,
    voices,
    setVoices,
    backendStatus,
    setBackendStatus
  } = useEditorStore();

  useEffect(() => {
    // If activeTab is not one of the available tabs, reset to home
    if (!['home', 'tts', 'srt', 'stt', 'system', 'translate'].includes(activeTab)) {
      setActiveTab('home');
    }

    const checkConnection = () => {
      fetch('http://127.0.0.1:5000/api/voices', {
        headers: {
          'X-API-Key': 'capcut_local_secret_key_2026'
        }
      })
        .then(res => res.json())
        .then((data: Voice[]) => {
          setBackendStatus('running');
          if (data && data.length > 0) {
            setVoices(data);
          }
        })
        .catch(() => {
          setBackendStatus('offline');
        });
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [activeTab, setActiveTab, setBackendStatus, setVoices]);

  return (
    <>
      <DashboardLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
      >
        {activeTab === 'home' && <HomePage />}

        {activeTab === 'tts' && (
          <VoicePage
            voices={voices}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            backendStatus={backendStatus}
          />
        )}

        {activeTab === 'srt' && (
          <SubtitlePage
            voices={voices}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            backendStatus={backendStatus}
          />
        )}

        {activeTab === 'stt' && <STTPage />}

        {activeTab === 'translate' && <TranslatePage />}

        {activeTab === 'system' && <SystemPage />}
      </DashboardLayout>
      <ToastContainer />
    </>
  );
}
