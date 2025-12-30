import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // --- שורת בדיקה ---
  console.log("🚀 TRANSLATION REQUEST STARTED - V5 (MULTI-MODE) 🚀");
  // ------------------

  // כותרות CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) {
      console.error("Server Error: Missing API Key");
      return res.status(500).json({ error: "Configuration Error on Server: Missing API Key" });
    }

    // קבלת פרמטר המצב (mode) החדש מהבקשה
    const { text, langA, langB, langALabel, langBLabel, mode } = req.body;
    
    if (!text) {
      console.error("Server Error: No text provided");
      return res.status(400).json({ error: "No text provided" });
    }

    console.log(`Processing request in mode: ${mode || 'default (live)'}`);
    console.log(`Text length: ${text.length}, LangA: ${langALabel}, LangB: ${langBLabel}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    let prompt = "";

    // בחירת הנחיה לפי המצב הנבחר
    switch (mode) {
      case 'chat':
        // מצב שיחת צ'אט: ה-AI מגיב כבן שיח טבעי
        prompt = `You are a friendly and intelligent conversation partner.
        The user is speaking in either ${langALabel} or ${langBLabel}.
        Your task is to respond naturally to their input, keeping the conversation going.
        
        User input: "${text}"
        
        Instructions:
        1. Identify the language of the user's input (${langALabel} or ${langBLabel}).
        2. Respond in the OTHER language. For example, if they speak ${langALabel}, respond in ${langBLabel}.
        3. Your response should be a natural, relevant continuation of the conversation. Do not just translate.
        4. Keep your response concise (1-3 sentences).`;
        break;

      case 'learning':
        // מצב לימוד שפה: ה-AI מתנהג כמורה פרטי
        prompt = `You are a helpful and encouraging language tutor.
        The user is learning ${langBLabel} (target language) and knows ${langALabel} (source language).
        They have just said: "${text}"
        
        Instructions:
        1. If the input is in the source language (${langALabel}), translate it to the target language (${langBLabel}) and provide a brief tip on pronunciation or grammar.
        2. If the input is in the target language (${langBLabel}), correct any mistakes gently, offer a more natural way to say it if necessary, and then respond with a simple follow-up question in the target language to encourage practice.
        3. Keep your response encouraging and educational.`;
        break;

      case 'simultaneous':
        // מצב תרגום סימולטני (כמו בהרצאה) - תרגום חד כיווני בלבד
        prompt = `You are a professional simultaneous interpreter.
        Your task is to translate spoken text from a source language to a target language in real-time.
        
        Source Language: ${langALabel} (The language being spoken)
        Target Language: ${langBLabel} (The language for translation)
        Input text: "${text}"
        
        Instructions:
        1. Translate the input text ONLY from ${langALabel} to ${langBLabel}.
        2. Provide a strictly literal, word-for-word translation.
        3. Do NOT add any explanations, context, notes, or conversational elements.
        4. Do NOT attempt to detect the language; assume it is always ${langALabel}.
        5. Output ONLY the translated text.`;
        break;

      default:
        // ברירת מחדל (תרגום חי דו-כיווני) - ההנחיה הקשוחה הקודמת
        prompt = `You are a strict, professional interpreter providing real-time bi-directional translation.
        
        Languages: ${langALabel} <-> ${langBLabel}
        Input text: "${text}"
        
        Instructions:
        1. Detect the language of the input text (${langALabel} or ${langBLabel}).
        2. Translate it IMMEDIATELY to the other language.
        3. Provide a strictly literal, word-for-word translation.
        4. Do NOT add any explanations, context, notes, or conversational elements.
        5. Do NOT summarize or change the meaning.
        6. Output ONLY the translated text.`;
        break;
    }

    console.log("Sending prompt to Gemini 2.0...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let translation = response.text();
    
    translation = translation.trim();

    console.log("Translation received successfully.");

    if (!translation) {
       throw new Error("Empty translation received from AI");
    }

    return res.status(200).json({ translation });

  } catch (error) {
    console.error("Detailed Server Error Stack:", error);
    return res.status(500).json({ 
        error: "Translation failed at AI provider", 
        details: error.message
    });
  }
}
