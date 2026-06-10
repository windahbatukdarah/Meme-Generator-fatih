import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for base64 image strings
  app.use(express.json({ limit: "20mb" }));

  // API Route for Magic Caption
  app.post("/api/generate-captions", async (req, res) => {
    try {
      const { image, mimeType, language = "English" } = req.body;
      
      if (!image || !mimeType) {
        return res.status(400).json({ error: "Image and mimeType are required" });
      }

      // Base64 without the 'data:image/...;base64,' prefix
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
      // Clean up markdown just in case the model ignored directions
      const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      try {
        const captions = JSON.parse(cleanedText);
        res.json({ captions });
      } catch (err) {
        console.error("Failed to parse JSON", cleanedText);
        res.status(500).json({ error: "Failed to generate valid captions format." });
      }

    } catch (error) {
      console.error("Error generating captions:", error);
      res.status(500).json({ error: "Failed to generate captions" });
    }
  });

  // Image proxy route to bypass CORS for templates
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "image/jpeg";
      res.set("Content-Type", contentType);
      res.send(buffer);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
