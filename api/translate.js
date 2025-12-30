import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // --- שורת בדיקה חדשה ---
  console.log("✨ V10: GEMINI 1.5 PRO - NATURAL CONVERSATION MODE ✨");
  // -----------------------

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

    const { text, langALabel, langBLabel } = req.body;
    
    if (!text) {
      console.error("Server Error: No text provided");
      return res.status(400).json({ error: "No text provided" });
    }

    console.log(`Processing conversation between: ${langALabel} and ${langBLabel}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // --- שינוי למודל החזק והיציב יותר לשיחות ---
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    // -------------------------------------------

    // הנחיה חדשה לשיחה טבעית ודו-כיוונית אוטומטית
    const prompt = `You are a skilled interpreter facilitating a natural conversation between two people.
    
    One person speaks ${langALabel}, and the other speaks ${langBLabel}.
    
    Here is what was just said: "${text}"
    
    Your Task:
    1. Identify which of the two languages (${langALabel} or ${langBLabel}) the text is in.
    2. Translate it naturally and accurately into the OTHER language.
    3. Maintain the original tone and intent of the speaker.
    4. Output ONLY the final translation. Do not add any notes or explanations.`;

    console.log("Sending prompt to Gemini 1.5 Pro...");
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
        modelUsed: "gemini-1.5-pro"
    });
  }
}
