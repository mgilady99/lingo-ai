
export interface Language {
  code: string;
  name: string;
  flag: string;
  voiceName: string;
}

export interface PracticeScenario {
  id: string;
  icon: string;
  title: string;
  systemInstruction: string;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'he-IL', name: 'Hebrew', flag: '🇮🇱', voiceName: 'he-IL-HilaNeural' },
  { code: 'en-US', name: 'English', flag: '🇺🇸', voiceName: 'en-US-Journey-D' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸', voiceName: 'es-ES-ElviraNeural' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷', voiceName: 'fr-FR-DeniseNeural' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪', voiceName: 'de-DE-KatjaNeural' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹', voiceName: 'it-IT-ElsaNeural' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷', voiceName: 'pt-BR-FranciscaNeural' },
  { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳', voiceName: 'zh-CN-XiaoxiaoNeural' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵', voiceName: 'ja-JP-NanamiNeural' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷', voiceName: 'ko-KR-SunHiNeural' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺', voiceName: 'ru-RU-SvetlanaNeural' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦', voiceName: 'ar-SA-ZariyahNeural' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳', voiceName: 'hi-IN-SwaraNeural' },
  { code: 'nl-NL', name: 'Dutch', flag: '🇳🇱', voiceName: 'nl-NL-ColetteNeural' }
];

// --- 4 המודולים המדויקים ---
export const SCENARIOS: PracticeScenario[] = [
  { 
    id: 'live', 
    icon: '🎙️', 
    title: 'mode_live', 
    systemInstruction: 'You are a precise bi-directional translator. Listen to the user. Translate their exact words from SOURCE_LANG to TARGET_LANG (or vice versa). Do not summarize. Do not answer questions. Just translate.' 
  },
  { 
    id: 'simul', 
    icon: '🎧', 
    title: 'mode_simul', 
    systemInstruction: 'You are a simultaneous interpreter. Your priority is SPEED. Translate the speech stream continuously from SOURCE_LANG to TARGET_LANG. Keep the flow natural and fast.' 
  },
  { 
    id: 'chat', 
    icon: '💬', 
    title: 'mode_chat', 
    systemInstruction: 'You are a friendly conversation partner. Do NOT translate. Converse naturally with the user in TARGET_LANG. Ask questions and keep the chat going.' 
  },
  { 
    id: 'learn', 
    icon: '🎓', 
    title: 'mode_learn', 
    systemInstruction: 'You are a language teacher. Converse in TARGET_LANG. If the user makes a mistake, stop and gently correct them in SOURCE_LANG, then encourage them to try again.' 
  }
];
