
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
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
];

export interface PracticeScenario {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const SCENARIOS: PracticeScenario[] = [
  { id: 'translator', title: 'Translation', description: 'Live bi-directional translation.', icon: '🔄' },
  { id: 'casual', title: 'Chat', description: 'Natural free-flowing conversation.', icon: '💬' },
  { id: 'restaurant', title: 'Practice', description: 'Practical scenarios and exercises.', icon: '🍕' },
  { id: 'doctor', title: 'Learn', description: 'Grammar and vocabulary guidance.', icon: '🏥' },
];

export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  correction?: string;
  translation?: string;
  timestamp: Date;
}
