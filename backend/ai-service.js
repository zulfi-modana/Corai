require("dotenv").config();

const aiQueue = {
  running: 0,
  queue: [],
  concurrency: 3,
  add(fn) {
    if (this.queue.length >= 20) {
      return Promise.reject(new Error("Server sedang sibuk, coba lagi nanti"));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.run();
    });
  },
  run() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this.run();
        });
    }
  },
};

async function callAI(prompt, formatPrompt) {
  return aiQueue.add(() => _callAI(prompt, formatPrompt));
}

async function _callAI(prompt, formatPrompt) {
  const models = [
    "gemma-4-26b-a4b-it:free",
    "gemma-4-31b-it:free",
    "gpt-oss-120b:free",
    "gpt-oss-20b:free",
    "openrouter/free",
    "gpt-oss-120b"
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
            max_tokens: 1200
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

module.exports = { callAI };