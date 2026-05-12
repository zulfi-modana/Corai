require("dotenv").config();

async function callAI(prompt, formatPrompt) {
  const models = [
    "gemma-4-26b-a4b-it:free",
    "gemma-4-31b-it:free",
    "openrouter/free",
    "gpt-oss-120b:free",
    "gpt-oss-20b:free",
    "free"
  ];

  for (let model of models) {
    try {
      console.log(`🔄 Try model: ${model}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: formatPrompt || "You are helpful assistant" },
              { role: "user", content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 1000
          })
        }
      );

      clearTimeout(timeout);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message);
      }

      console.log(`✅ Success: ${model}`);

      return data.choices[0].message.content;

    } catch (err) {
      console.warn(`❌ Gagal di ${model}:`, err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error("Semua model gagal");
}

module.exports = {callAI}