class AudioProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        // לקיחת הערוץ הראשון (מונו)
        const inputChannel = input[0];
        
        // המרת Float32 ל-PCM 16-bit
        const pcmData = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
            let s = Math.max(-1, Math.min(1, inputChannel[i]));
            s = s < 0 ? s * 0x8000 : s * 0x7FFF;
            pcmData[i] = s;
        }

        // שליחת המידע ל-Main Thread
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
        return true;
    }
}
registerProcessor('audio-processor', AudioProcessor);
