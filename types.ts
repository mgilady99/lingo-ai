// src/types.ts
export interface Language {
  code: string;
  name: string;
  flag: string;
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
  { code: 'he-IL', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' }
];

export const SCENARIOS: PracticeScenario[] = [
  { 
    id: 'live', icon: '🎙️', title: 'mode_live', 
    systemInstruction: 'Act as a precise bi-directional interpreter between SOURCE_LANG and TARGET_LANG. Output ONLY the translation.' 
  },
  { 
    id: 'simul', icon: '🎧', title: 'mode_simul', 
    systemInstruction: 'Act as a simultaneous interpreter. Translate from SOURCE_LANG to TARGET_LANG as fast as possible.' 
  },
  { 
    id: 'chat', icon: '💬', title: 'mode_chat', 
    systemInstruction: 'Act as a friendly conversation partner in TARGET_LANG. Speak only in target language.' 
  },
  { 
    id: 'learn', icon: '🎓', title: 'mode_learn', 
    systemInstruction: 'Language tutor for TARGET_LANG. If the user makes a mistake, correct them gently in SOURCE_LANG, then repeat in TARGET_LANG.' 
  }
];
