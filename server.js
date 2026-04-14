import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "20mb" }));

const OPENAI_KEY = process.env.OPENAI_KEY;
const RELAY_SECRET = process.env.RELAY_SECRET;

app.post("/translate", async (req, res) => {

  if (req.headers.authorization !== `Bearer ${RELAY_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { mode, input_text, input_image } = req.body;

  let messages = [
    {
      role: "system",
      content: "你是中日医疗翻译，自动判断语言并翻译"
    }
  ];

  if (mode === "text") {
    messages.push({ role: "user", content: input_text });
  }

  if (mode === "image") {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "识别图片并翻译" },
        { type: "image_url", image_url: { url: input_image } }
      ]
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages
    })
  });

  const data = await response.json();

  res.json({
    translation: data.choices[0].message.content
  });

});


// 🎤 Whisper 语音转文字
app.post("/transcribe", async (req, res) => {
  try {
    if (req.headers.authorization !== `Bearer ${RELAY_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { audio_base64 } = req.body;

    if (!audio_base64) {
      return res.status(400).json({ error: "No audio provided" });
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: (() => {
        const form = new FormData();
        const buffer = Buffer.from(audio_base64, "base64");
        form.append("file", new Blob([buffer]), "audio.m4a");
        form.append("model", "gpt-4o-mini-transcribe");
        return form;
      })()
    });

    const data = await response.json();

    res.json({ text: data.text });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.listen(process.env.PORT || 3000, () => {
  console.log("running");
});
