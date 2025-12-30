import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // --- שורת בדיקה ---
  console.log("🔥 V8: REVERTED TO GEMINI 2.0 (KNOWN GOOD MODEL) WITH STRICT PROMPTS 🔥");
  // ------------------

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

    const { text, langALabel, langBLabel, mode } = req.body;
    
    if (!text) {
      console.error("Server Error: No text provided");
      return res.status(400).json({ error: "No text provided" });
    }

    console.log(`Processing [Mode: ${mode || 'default'}] | Langs: ${langALabel} <-> ${langBLabel}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // --- תיקון קריטי: חזרה למודל שעבד קודם ---
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    // -------------------------------------------

    let prompt = "";

    switch (mode) {
      case 'chat':
        prompt = `You are a friendly and intelligent conversation partner.
        The user is speaking in either ${langALabel} or ${langBLabel}.
        Your task is to respond naturally to their input, keeping the conversation going.
        
        User input: "${text}"
        
        Instructions:
        1. Identify the language of the user's input (${langALabel} or ${langBLabel}).
        2. Respond in the OTHER language.
        3. Keep your response concise and natural.`;
        break;

      case 'learning':
        prompt = `You are a helpful language tutor.
        User knows: ${langALabel}. User is learning: ${langBLabel}.
        User Input: "${text}"
        
        Instructions:
        1. If input is ${langALabel}, translate to ${langBLabel} and give a brief tip.
        2. If input is ${langBLabel}, correct gently and ask a simple follow-up question in ${langBLabel}.`;
        break;

      case 'simultaneous':
        prompt = `ROLE: Professional Simultaneous Interpreter.
        TASK: Translate precisely from SOURCE to TARGET language.
        
        SOURCE LANGUAGE: ${langALabel}
        TARGET LANGUAGE: ${langBLabel}
        
        INPUT TEXT: "${text}"
        
        INSTRUCTIONS:
        1. Translate the INPUT TEXT directly into the TARGET LANGUAGE (${langBLabel}).
        2. Maintain the exact meaning, tone, and register.
        3. OUTPUT ONLY THE TRANSLATION. NO explanations. NO notes.`;
        break;

      default:
        prompt = `ROLE: Strict, Real-time Interpreter.
        LANGUAGES: ${langALabel} and ${langBLabel}.
        
        INPUT TEXT: "${text}"
        
        INSTRUCTIONS:
        1. DETECT instantly whether the INPUT TEXT is in ${langALabel} or ${langBLabel}.
        2. IF detected as ${langALabel} -> TRANSLATE ONLY TO ${langBLabel}.
        3. IF detected as ${langBLabel} -> TRANSLATE ONLY TO ${langALabel}.
        4. CRITICAL: Provide the most accurate, literal translation possible.
        5. CRITICAL: OUTPUT ONLY THE FINAL TRANSLATED TEXT. Do NOT add any other words, context, or explanations.`;
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
        details: error.message,
        modelUsed: "gemini-2.0-flash-exp"
    });
  }
}
