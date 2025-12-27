
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
    systemInstruction: 'Translate exactly between SOURCE_LANG and TARGET_LANG. Output ONLY translation.' 
  },
  { 
    id: 'simul', icon: '🎧', title: 'mode_simul', 
    systemInstruction: 'Simultaneous interpreter. Translate SOURCE_LANG to TARGET_LANG fast.' 
  },
  { 
    id: 'chat', icon: '💬', title: 'mode_chat', 
    systemInstruction: 'Conversation partner in TARGET_LANG. Natural chat only.' 
  },
  { 
    id: 'learn', icon: '🎓', title: 'mode_learn', 
    systemInstruction: 'Tutor. Correct mistakes in SOURCE_LANG, then repeat in TARGET_LANG.' 
  }
];
