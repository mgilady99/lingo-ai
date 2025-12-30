import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // ---------------------------------------------------------
  // שורת בדיקה קריטית - חייבת להופיע בלוגים של Vercel
  console.log("🔥🔥🔥 FINAL ATTEMPT: RUNNING GEMINI 2.0 CODE 🔥🔥🔥");
  // ---------------------------------------------------------

  // הוספת כותרות CORS מלאות
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // טיפול בבקשת OPTIONS (בדיקה מקדימה של הדפדפן)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ניסיון לטעון את המפתח משני שמות אפשריים
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) {
      console.error("Server Error: Missing API Key in Environment Variables");
      return res.status(500).json({ error: "Configuration Error on Server: Missing API Key" });
    }

    const { text, langA, langB, langALabel, langBLabel } = req.body;
    
    if (!text) {
      console.error("Server Error: No text provided in request body");
      return res.status(400).json({ error: "No text provided" });
    }

    console.log(`Attempting to translate text of length: ${text.length}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // שימוש במודל החדש ביותר
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // הנחיה מפורטת למודל
    const prompt = `You are a professional interpreter. 
    Your task is to act as a bridge between two languages: ${langALabel} and ${langBLabel}.
    
    Here is the input text I heard: "${text}"
    
    Instructions:
    1. Detect whether the input text is in ${langALabel} or ${langBLabel}.
    2. If it's in ${langALabel}, translate it to ${langBLabel}.
    3. If it's in ${langBLabel}, translate it to ${langALabel}.
    4. Output ONLY the final translated text. Do not add any explanations, language tags, or notes. Keep it concise and natural to speak.`;

    console.log("Sending prompt to Gemini 2.0...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let translation = response.text();
    
    // ניקוי רווחים מיותרים
    translation = translation.trim();

    console.log("Translation received successfully:", translation);

    if (!translation) {
       throw new Error("Empty translation received from AI");
    }

    return res.status(200).json({ translation });

  } catch (error) {
    console.error("Detailed Server Error Stack:", error);
    // החזרת הודעת שגיאה מפורטת לדפדפן
    return res.status(500).json({ 
        error: "Translation failed at AI provider", 
        details: error.message,
        modelUsed: "gemini-2.0-flash-exp"
    });
  }
}
