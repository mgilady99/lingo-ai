// src/services/audioService.ts
export const decode = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const decodeAudioData = (arrayBuffer: ArrayBuffer, audioCtx: AudioContext, sampleRate: number = 24000): AudioBuffer => {
  const dataView = new DataView(arrayBuffer);
  const length = arrayBuffer.byteLength / 2;
  const audioBuffer = audioCtx.createBuffer(1, length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
  }
  return audioBuffer;
};

export const createPcmBlob = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
