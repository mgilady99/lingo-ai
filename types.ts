export interface Language {
  code: string;
  name: string;
  flag: string;
  voiceName: string;
}

export interface PracticeScenario {
  id: string;
  icon: string;
  title: string; // המפתח לתרגום
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

// --- 4 המודולים החדשים ---
export const SCENARIOS: PracticeScenario[] = [
  { 
    id: 'live', 
    icon: '🎙️', 
    title: 'mode_live', 
    systemInstruction: 'Act as a precise interpreter. Translate exactly what is said between the two languages instantly. Do not add conversational filler.' 
  },
  { 
    id: 'simul', 
    icon: '🎧', 
    title: 'mode_simul', 
    systemInstruction: 'Act as a simultaneous interpreter. Provide continuous, fluid translation of the speech stream. Prioritize speed and flow.' 
  },
  { 
    id: 'chat', 
    icon: '💬', 
    title: 'mode_chat', 
    systemInstruction: 'Act as a friendly conversation partner. Engage in a natural dialogue in the target language. Ask follow-up questions.' 
  },
  { 
    id: 'learn', 
    icon: '🎓', 
    title: 'mode_learn', 
    systemInstruction: 'Act as a language tutor. Help the user learn. Correct their grammar mistakes gently and explain new vocabulary when necessary.' 
  }
];
