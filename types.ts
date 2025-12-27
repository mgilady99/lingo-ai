// src/types.ts

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

export const SCENARIOS: PracticeScenario[] = [
  { 
    id: 'live', 
    icon: '🎙️', 
    title: 'mode_live', 
    systemInstruction: 'Act as a professional bi-directional interpreter. Translate everything between SOURCE_LANG and TARGET_LANG. Output ONLY the translation.' 
  },
  { 
    id: 'simul', 
    icon: '🎧', 
    title: 'mode_simul', 
    systemInstruction: 'Simultaneous interpreter from SOURCE_LANG to TARGET_LANG. Translate fast and continuously.' 
  },
  { 
    id: 'chat', 
    icon: '💬', 
    title: 'mode_chat', 
    systemInstruction: 'Conversation partner. Speak ONLY in TARGET_LANG. Natural dialogue, no translation.' 
  },
  { 
    id: 'learn', 
    icon: '🎓', 
    title: 'mode_learn', 
    systemInstruction: 'Language tutor for TARGET_LANG. Correct mistakes in SOURCE_LANG, then repeat in TARGET_LANG.' 
  }
];
