import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // השתמש במפתח שמוגדר ב-Vercel תחת השם GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API Key on server" });
    }

    const { text, from, to } = req.body;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Translate the following text strictly from ${from} to ${to}. 
    Return ONLY the translated text without any quotes or explanations. 
    If it's a phone number or name, keep it as is.
    Text: ${text}`;

    const result = await model.generateContent(prompt);
    const translation = result.response.text().trim();

    return res.status(200).json({ translation });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Translation failed", details: error.message });
  }
}
