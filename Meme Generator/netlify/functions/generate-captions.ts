import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const handler = async (event: any, context: any) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { image, mimeType, language = "English" } = body;
    
    if (!image || !mimeType) {
      return { statusCode: 400, body: JSON.stringify({ error: "Image and mimeType are required" }) };
    }

    const base64Data = image.split(",")[1] || image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: `You are an expert meme creator. Analyze this image and generate exactly 5 funny, clever, and relevant meme captions.
CRITICAL CONTEXT: The generated captions MUST be in the following language/dialect: ${language}.
Respond ONLY with a valid JSON array of strings. Do not include any markdown formatting like \`\`\`json. 
Keep captions relatively short (under 15 words) so they fit well on an image. Make them punchy and internet-humor style.`,
            },
          ],
        },
      ],
    });

    const text = response.text || "[]";
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
      const captions = JSON.parse(cleanedText);
      return { statusCode: 200, body: JSON.stringify({ captions }) };
    } catch (err) {
      console.error("Failed to parse JSON", cleanedText);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to generate valid captions format." }) };
    }

  } catch (error) {
    console.error("Error generating captions:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to generate captions" }) };
  }
};
