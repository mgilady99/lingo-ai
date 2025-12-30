import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // הוספת כותרות CORS כדי לאפשר גישה מהדפדפן
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
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) {
      console.error("Server Error: Missing API Key");
      return res.status(500).json({ error: "Configuration Error on Server" });
    }

    const { text, langA, langB, langALabel, langBLabel } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // שימוש במודל מהיר יותר
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // הנחיה חכמה לתרגום דו-כיווני
    const prompt = `You are a professional interpreter. 
    Your task is to act as a bridge between two languages: ${langALabel} and ${langBLabel}.
    
    Here is the input text I heard: "${text}"
    
    Instructions:
    1. Detect whether the input text is in ${langALabel} or ${langBLabel}.
    2. If it's in ${langALabel}, translate it to ${langBLabel}.
    3. If it's in ${langBLabel}, translate it to ${langALabel}.
    4. Output ONLY the final translated text. Do not add any explanations, language tags, or notes. Keep it concise and natural to speak.`;

    console.log("Sending prompt to Gemini...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let translation = response.text();
    
    // ניקוי רווחים מיותרים
    translation = translation.trim();

    console.log("Translation received:", translation);

    if (!translation) {
       throw new Error("Empty translation received from AI");
    }

    return res.status(200).json({ translation });

  } catch (error) {
    console.error("Detailed Server Error:", error);
    // החזרת הודעת שגיאה ברורה יותר לדפדפן
    return res.status(500).json({ error: "Translation failed at AI provider", details: error.message });
  }
}
