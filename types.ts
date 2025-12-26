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
  { 
    code: 'he-IL',     // חייב להיות זהה ל-translations.ts
    name: 'Hebrew', 
    flag: '🇮🇱', 
    voiceName: 'he-IL-HilaNeural' 
  },
  { 
    code: 'en-US',     // חייב להיות זהה ל-translations.ts
    name: 'English', 
    flag: '🇺🇸', 
    voiceName: 'en-US-Journey-D' 
  },
  { 
    code: 'es-ES', 
    name: 'Spanish', 
    flag: '🇪🇸', 
    voiceName: 'es-ES-ElviraNeural' 
  },
  { 
    code: 'fr-FR', 
    name: 'French', 
    flag: '🇫🇷', 
    voiceName: 'fr-FR-DeniseNeural' 
  },
  { 
    code: 'de-DE', 
    name: 'German', 
    flag: '🇩🇪', 
    voiceName: 'de-DE-KatjaNeural' 
  },
  { 
    code: 'it-IT', 
    name: 'Italian', 
    flag: '🇮🇹', 
    voiceName: 'it-IT-ElsaNeural' 
  },
  { 
    code: 'pt-BR', 
    name: 'Portuguese', 
    flag: '🇧🇷', 
    voiceName: 'pt-BR-FranciscaNeural' 
  },
  { 
    code: 'zh-CN', 
    name: 'Chinese', 
    flag: '🇨🇳', 
    voiceName: 'zh-CN-XiaoxiaoNeural' 
  },
  { 
    code: 'ja-JP', 
    name: 'Japanese', 
    flag: '🇯🇵', 
    voiceName: 'ja-JP-NanamiNeural' 
  },
  { 
    code: 'ko-KR', 
    name: 'Korean', 
    flag: '🇰🇷', 
    voiceName: 'ko-KR-SunHiNeural' 
  },
  { 
    code: 'ru-RU', 
    name: 'Russian', 
    flag: '🇷🇺', 
    voiceName: 'ru-RU-SvetlanaNeural' 
  },
  { 
    code: 'ar-SA', 
    name: 'Arabic', 
    flag: '🇸🇦', 
    voiceName: 'ar-SA-ZariyahNeural' 
  },
  { 
    code: 'hi-IN', 
    name: 'Hindi', 
    flag: '🇮🇳', 
    voiceName: 'hi-IN-SwaraNeural' 
  },
  { 
    code: 'nl-NL', 
    name: 'Dutch', 
    flag: '🇳🇱', 
    voiceName: 'nl-NL-ColetteNeural' 
  }
];

export const SCENARIOS: PracticeScenario[] = [
  { 
    id: 'cafe', 
    icon: '☕', 
    title: 'Ordering Coffee', 
    systemInstruction: 'Simulation: Ordering coffee at a cafe.' 
  },
  { 
    id: 'taxi', 
    icon: '🚕', 
    title: 'Taking a Taxi', 
    systemInstruction: 'Simulation: Giving directions to a taxi driver.' 
  },
  { 
    id: 'hotel', 
    icon: '🏨', 
    title: 'Hotel Check-in', 
    systemInstruction: 'Simulation: Checking into a hotel.' 
  },
  { 
    id: 'doctor', 
    icon: '👨‍⚕️', 
    title: 'Doctor Visit', 
    systemInstruction: 'Simulation: Describing symptoms to a doctor.' 
  },
  { 
    id: 'job', 
    icon: '💼', 
    title: 'Job Interview', 
    systemInstruction: 'Simulation: Answering job interview questions.' 
  },
  { 
    id: 'shopping', 
    icon: '🛍️', 
    title: 'Shopping', 
    systemInstruction: 'Simulation: Buying clothes and asking for sizes.' 
  }
];
