export const decode = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const decodeAudioData = (
  arrayBuffer: ArrayBuffer,
  audioContext: AudioContext,
  sampleRate: number = 24000,
  channels: number = 1
): AudioBuffer => {
  const dataView = new DataView(arrayBuffer);
  const length = arrayBuffer.byteLength / 2; 
  
  if (length === 0) return audioContext.createBuffer(channels, 1, sampleRate);

  const audioBuffer = audioContext.createBuffer(channels, length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const int16 = dataView.getInt16(i * 2, true); 
    channelData[i] = int16 / 32768.0;
  }

  return audioBuffer;
};

export const createPcmBlob = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
