
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
  { code: 'zh-CN', name: 'Mandarin Chinese', flag: '🇨🇳' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'id-ID', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'bn-BD', name: 'Bengali', flag: '🇧🇩' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
];

export interface PracticeScenario {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const SCENARIOS: PracticeScenario[] = [
  { id: 'simultaneous', title: 'LIVE TRANSLATE', description: 'Real-time simultaneous interpretation (Lecture mode).', icon: '⚡' },
  { id: 'translator', title: 'DIALOGUE', description: 'Two-way translation, waits for sentence completion.', icon: '🔄' },
  { id: 'casual', title: 'CHAT', description: 'Practice conversation in the selected language.', icon: '💬' },
  { id: 'learn', title: 'LEARN', description: 'Language practice with real-time error corrections.', icon: '🎓' },
];

export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  correction?: string;
  translation?: string;
  timestamp: Date;
}
