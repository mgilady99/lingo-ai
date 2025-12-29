// api/translate.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// פונקציה זו רצה על השרתים של Vercel בכל פעם שהאפליקציה מבקשת תרגום
export default async function handler(request, response) {
  // וידוא שזו בקשת POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // שליפת מפתח ה-API משתני הסביבה של Vercel (בצד השרת)
    const apiKey = process.env.VITE_API_KEY;
    if (!apiKey) {
      throw new Error('Missing API Key on server environment variables');
    }

    // קבלת הנתונים מהאפליקציה (מהדפדפן)
    const { text, sourceLangName, targetLangName } = JSON.parse(request.body);

    if (!text) {
      throw new Error('No text provided for translation');
    }

    // חיבור ל-Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    // שימוש במודל מהיר ויציב לתרגום טקסט
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // הנחיה מדויקת לתרגום
    const prompt = `Task: Translate the following text strictly from ${sourceLangName} to ${targetLangName}.
    Rules:
    1. Output ONLY the translated text.
    2. Do not add any explanations, notes, or extra words.
    3. Maintain the original tone and intent.
    Input Text: "${text}"`;

    // ביצוע הקריאה ל-AI
    const result = await model.generateContent(prompt);
    const translatedText = result.response.text().trim();

    // החזרת התשובה לדפדפן
    return response.status(200).json({ translation: translatedText });

  } catch (error) {
    console.error('Translation error on server:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
