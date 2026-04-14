import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const OPENAI_KEY = process.env.OPENAI_KEY;
const RELAY_SECRET = process.env.RELAY_SECRET;

// 健康检查
app.get("/", (req, res) => {
  res.send("OK");
});

// 翻译接口
app.post("/translate", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";

    if (auth !== `Bearer ${RELAY_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!auth.includes("Luna-JP")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { input_text } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "你是中日翻译，只返回翻译结果"
          },
          {
            role: "user",
            content: input_text
          }
        ]
      })
    });

    const data = await response.json();

    res.json({
      translation: data.choices?.[0]?.message?.content || ""
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 语音转文字（Whisper）
app.post("/transcribe", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";

    if (auth !== `Bearer ${RELAY_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!auth.includes("Luna-JP")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { audio_base64 } = req.body;

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file: audio_base64,
        model: "gpt-4o-mini-transcribe"
      })
    });

    const data = await response.json();

    res.json({
      text: data.text || ""
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("running");
});
