const startConversation = async () => {
    try {
      stopConversation();
      setStatus(ConnectionStatus.CONNECTING);

      // ************************************************************************
      // השינוי הקיצוני: הדבק את המפתח ישירות בתוך הסוגריים למטה!
      // אל תשתמש במשתנה const apiKey. פשוט שים את הטקסט במרכאות בפנים.
      // ************************************************************************
      
      const ai = new GoogleGenAI("AIzaSyBvxi9k8SjgfC_dY7qLSGgTJrxXf_Nug1A"); 
      
      // ************************************************************************

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const inCtx = new AudioContext();
      inputAudioContextRef.current = inCtx;
      outputAudioContextRef.current = new AudioContext();

      const session = await ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: { 
          systemInstruction: selectedScenario.systemInstruction.replace(/SOURCE_LANG/g, nativeLang.name).replace(/TARGET_LANG/g, targetLang.name),
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
        callbacks: { 
            onopen: () => console.log("Connected"), 
            onmessage: () => {}, 
            onerror: (e) => console.error("Error:", e), 
            onclose: () => console.log("Closed") 
        }
      });
      activeSessionRef.current = session;

      const source = inCtx.createMediaStreamSource(stream);
      const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        if (activeSessionRef.current && activeSessionRef.current.send) {
          const pcmBase64 = createPcmBlob(e.inputBuffer.getChannelData(0), inCtx.sampleRate);
          activeSessionRef.current.send({ realtimeInput: { mediaChunks: [{ data: pcmBase64, mimeType: 'audio/pcm;rate=16000' }] } });
        }
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inCtx.destination);

      (async () => {
        try {
          if (!session.listen) return;
          for await (const msg of session.listen()) {
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              setIsSpeaking(true);
              const outCtx = outputAudioContextRef.current!;
              const buffer = decodeAudioData(decode(audio), outCtx, 24000);
              const audioSource = outCtx.createBufferSource();
              audioSource.buffer = buffer; 
              audioSource.connect(outCtx.destination);
              audioSource.onended = () => { setIsSpeaking(false); };
              audioSource.start(Math.max(nextStartTimeRef.current, outCtx.currentTime));
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime) + buffer.duration;
            }
          }
        } catch(e) { stopConversation(); }
      })();
      setStatus(ConnectionStatus.CONNECTED);
    } catch (e: any) { stopConversation(); alert(`Connection failed: ${e.message}`); }
  };
