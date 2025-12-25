
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'he-IL', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'zh-CN', name: 'Mandarin Chinese', flag: '🇨🇳' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr-TR', name: 'Turkish', flag: '🇹🇷' },
  { code: 'vi-VN', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th-TH', name: 'Thai', flag: '🇹🇭' },
  { code: 'nl-NL', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl-PL', name: 'Polish', flag: '🇵🇱' },
  { code: 'id-ID', name: 'Indonesian', flag: '🇮🇩' },
];

export interface PracticeScenario {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const SCENARIOS: PracticeScenario[] = [
  { id: 'simultaneous', title: 'LIVE TRANSLATE', description: 'Real-time simultaneous interpretation (No waiting).', icon: '⚡' },
  { id: 'translator', title: 'DIALOGUE', description: 'Two-way translation (Waits for full sentences).', icon: '🔄' },
  { id: 'casual', title: 'CHAT', description: 'Conversation practice in the selected language.', icon: '💬' },
  { id: 'learn', title: 'LEARN', description: 'Practice with real-time grammar corrections.', icon: '🎓' },
];

export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  correction?: string;
  timestamp: Date;
}

