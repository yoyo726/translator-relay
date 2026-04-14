import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const OPENAI_KEY = process.env.OPENAI_KEY;
const RELAY_SECRET = process.env.RELAY_SECRET;

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

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
          "你是中日医疗翻译，自动判断语言并翻译。返回自然、准确、简洁的结果。"
      }
    ];

    if (mode === "image" && input_image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "识别图片中的文字并翻译。" },
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

const port = 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("running on", port);
});
