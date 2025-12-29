require('dotenv').config();
const WebSocket = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`LingoLive Server running on ws://localhost:${PORT}`);

// הגדרת המודל וההנחיות
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// שימוש במודל התומך בסטרימינג דו-כיווני
const model = "gemini-2.0-flash-exp"; 

wss.on('connection', ws => {
    console.log('Client connected');
    let geminiWs = null;
    let isGeminiConnected = false;
    let configSent = false;

    // פונקציה לחיבור ל-Gemini
    const connectToGemini = () => {
        const url = `wss://generativelanguage.googleapis.com/ws/v1alpha/models/${model}:bidiConnect?key=${process.env.GOOGLE_API_KEY}`;
        geminiWs = new WebSocket(url);

        geminiWs.on('open', () => {
            console.log('Connected to Gemini Bidi API');
            isGeminiConnected = true;
        });

        geminiWs.on('message', data => {
            // קבלת מידע מג'מיני והעברה חזרה לדפדפן
            try {
                const response = JSON.parse(data.toString());
                // שליחת המידע הגולמי חזרה לקליינט
                ws.send(JSON.stringify(response));
            } catch (e) {
                console.error('Error parsing Gemini message:', e);
            }
        });

        geminiWs.on('close', (code, reason) => {
            console.log(`Gemini connection closed: ${code} - ${reason}`);
            isGeminiConnected = false;
            // סגירת החיבור מול הדפדפן אם ג'מיני התנתק
            ws.close();
        });

        geminiWs.on('error', error => {
            console.error('Gemini WebSocket error:', error);
        });
    };

    // התחברות ראשונית לג'מיני בעת חיבור לקוח
    connectToGemini();

    ws.on('message', message => {
        if (!isGeminiConnected) return;

        // בדיקה האם זו הודעת קונפיגורציה מהדפדפן או מידע בינארי (אודיו)
        if (typeof message === 'string') {
            try {
                const parsed = JSON.parse(message);
                if (parsed.type === 'config' && !configSent) {
                    console.log('Sending configuration to Gemini...');
                    // שליחת הגדרות ראשוניות לג'מיני
                    geminiWs.send(JSON.stringify({
                        setup: {
                            model: `models/${model}`,
                            generation_config: {
                                response_modalities: ["AUDIO"],
                                speech_config: {
                                    voice_config: { prebuilt_voice_config: { voice_name: "Zephyr" } }
                                }
                            },
                            system_instruction: {
                                parts: [{ text: parsed.systemInstruction }]
                            }
                        }
                    }));
                    configSent = true;
                }
            } catch (e) {
                console.error('Invalid setup message from client', e);
            }
        } else if (Buffer.isBuffer(message)) {
            // הזרמת אודיו בינארי מהמיקרופון לג'מיני
            if (configSent) {
                const realtimeInput = {
                    realtime_input: {
                        media_chunks: [{
                            mime_type: "audio/pcm; rate=16000",
                            data: message.toString('base64')
                        }]
                    }
                };
                geminiWs.send(JSON.stringify(realtimeInput));
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });
});
