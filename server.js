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
  res.status(200).send("OK");
});

// 文本 / 图片翻译
app.post("/translate", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";

    if (auth !== `Bearer ${RELAY_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!auth.includes("Luna-JP")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { mode, input_text, input_image, model, temperature, system_prompt } = req.body;

    const messages = [
      {
        role: "system",
        content:
          system_prompt ||
          "你是中日医疗翻译。自动识别中文或日文，并翻译成另一种语言。只返回翻译后的文本，不要解释，不要JSON。"
      }
    ];

    if (mode === "image" && input_image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "识别图片中的文字并翻译成另一种语言。" },
          { type: "image_url", image_url: { url: input_image } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: input_text || ""
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || "gpt-4.1-mini",
        temperature: typeof temperature === "number" ? temperature : 0.2,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed",
        raw: data
      });
    }

    return res.json({
      translation: data?.choices?.[0]?.message?.content || ""
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// 语音：一次前端请求，后端内部完成“转写 + 翻译”
app.post("/speech-translate", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";

    if (auth !== `Bearer ${RELAY_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!auth.includes("Luna-JP")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { audio_base64 } = req.body;

    if (!audio_base64) {
      return res.status(400).json({ error: "No audio provided" });
    }

    // 第一步：转写
    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
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

    const transcriptionData = await transcriptionResponse.json();

    if (!transcriptionResponse.ok) {
      return res.status(transcriptionResponse.status).json({
        error: transcriptionData?.error?.message || "Transcription failed",
        raw: transcriptionData
      });
    }

    const sourceText = transcriptionData?.text || "";

    if (!sourceText) {
      return res.status(500).json({ error: "Empty transcription result" });
    }

    // 第二步：翻译，并返回结构化 JSON
    const translateResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是中日医疗口译助手。请自动识别输入文本是中文还是日文，并翻译成另一种语言。只返回严格 JSON，不要解释。格式必须是：{\"source_text\":\"...\",\"source_language\":\"zh或ja\",\"target_language\":\"ja或zh\",\"translation\":\"...\"}"
          },
          {
            role: "user",
            content: sourceText
          }
        ]
      })
    });

    const translateData = await translateResponse.json();

    if (!translateResponse.ok) {
      return res.status(translateResponse.status).json({
        error: translateData?.error?.message || "Translation failed",
        raw: translateData
      });
    }

    const content = translateData?.choices?.[0]?.message?.content || "";
    let parsed = null;

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }

    return res.json({
      source_text: parsed?.source_text || sourceText,
      source_language: parsed?.source_language || "",
      target_language: parsed?.target_language || "",
      translation: parsed?.translation || content
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Speech translate error" });
  }
});

const port = 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("running on", port);
});
