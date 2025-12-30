import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // --- שורת בדיקה סופית ---
  console.log("🚀 V11: BACK TO GEMINI 2.0 (WORKING) + NATURAL CONVERSATION PROMPT 🚀");
  // ------------------------

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

    // אנחנו מקבלים רק את תוויות השפות, בלי להתחשב בכיוון החצים
    const { text, langALabel, langBLabel } = req.body;
    
    if (!text) {
      console.error("Server Error: No text provided");
      return res.status(400).json({ error: "No text provided" });
    }

    console.log(`Processing free-flowing conversation between: ${langALabel} and ${langBLabel}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // --- חזרה למודל היחיד שעובד בשרת הזה ---
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    // -------------------------------------------

    // --- הנחיה חדשה לשיחה טבעית, מדויקת ודו-כיוונית אוטומטית ---
    const prompt = `You are a professional, highly skilled interpreter facilitating a natural, free-flowing conversation.
    
    The two languages involved in this conversation are: ${langALabel} and ${langBLabel}.
    
    Here is the exact text that was just spoken by one of the participants: "${text}"
    
    Your Task:
    1. Instantly detect which of the two languages (${langALabel} or ${langBLabel}) the input text is in.
    2. Translate the text accurately and naturally into the OTHER language.
    3. Maintain the original tone, context, and intent of the speaker. Do not sound robotic.
    4. CRITICAL: Output ONLY the final translated text. Do NOT add any notes, explanations, language tags, or introductory phrases. Just the translation.`;

    console.log("Sending conversation prompt to Gemini 2.0...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let translation = response.text();
    
    translation = translation.trim();

    console.log("Translation received successfully:", translation);

    if (!translation) {
       throw new Error("Empty translation received from AI");
    }

    return res.status(200).json({ translation });

  } catch (error) {
    console.error("Detailed Server Error Stack:", error);
    // החזרת שגיאה מפורטת כולל המודל שניסינו
    return res.status(500).json({ 
        error: "Translation failed at AI provider", 
        details: error.message,
        modelUsed: "gemini-2.0-flash-exp"
    });
  }
}
