// src/services/AudioService.ts

class AudioService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    this.voices = this.synth.getVoices();
  }

  public speak(text: string, lang: string = 'he-IL') {
    // עצירה של כל דיבור קודם כדי למנוע התנגשויות
    this.synth.cancel();

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    
    // מציאת קול נשי בעדיפות ראשונה
    const femaleVoice = this.voices.find(v => 
      (v.name.includes('Google') || v.name.includes('Female')) && v.lang.includes(lang.split('-')[0])
    ) || this.voices.find(v => v.lang.includes(lang.split('-')[0]));

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.lang = lang;
    utterance.pitch = 1.3; // טון גבוה לנשיות
    utterance.rate = 1.0;

    // פקודה כפויה להפעלה
    this.synth.speak(utterance);

    return new Promise((resolve) => {
      utterance.onend = resolve;
    });
  }

  public stop() {
    this.synth.cancel();
  }
}

export const audioService = new AudioService();
