require("dotenv").config();

const express = require("express");
const Swal = require('sweetalert2');
const { getCapaian } = require("./scraper");


const app = express();
Swal.fire({
  title: 'Auto theme',
  theme: 'auto',
 title: 'Error!',
  text: 'Do you want to continue',
  icon: 'error',
  confirmButtonText: 'Cool'
});
// ===== CUSTOM QUEUE =====
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

// middleware
app.use(express.json());
app.use(express.static("public"));

const plagiasiRoutes = require("./plagiasi-backend.js");
app.use("/api/plagiasi", plagiasiRoutes);

const plagiasiAnalisisRoutes = require("./plagiasi-analyze.js");
app.use("/api/plagiasi/analyze", plagiasiAnalisisRoutes);

// ===== CACHE =====
const baseCache = new Map(); // hasil utama
const modifiedCache = new Map(); // hasil modifikasi

const CACHE_TTL = 1000 * 60 * 60; // 1 jam

const modifyPrompt = `
Anda bertugas memodifikasi RPP yang SUDAH ADA.

Aturan:
- Output HARUS berupa HTML valid
- Pertahankan struktur HTML
- Jangan generate ulang dari nol
- Jangan ubah bagian yang tidak diminta
- Jangan gunakan markdown
- Jangan gunakan ** atau ##
- Jangan gunakan codeblock
- Pertahankan tag HTML yang sudah ada
- Jangan beri penjelasan tambahan
- Fokus hanya pada instruksi tambahan user
`;

// helper cek expired
function isExpired(entry) {
  return !entry || Date.now() - entry.time > CACHE_TTL;
}

/* =========================
   🔹 ROUTE SCRAPER
========================= */
app.get("/capaian", async (req, res) => {
  const { jurusan, mapel, fase } = req.query;

   const ac = new AbortController();
  req.on("close", () => ac.abort());
  

  try {
    const data = await getCapaian(jurusan, mapel, fase);
    res.json({ success: true, data });
  } catch (err) {
    if (err.name === "AbortError") return; // client cancelled, do nothing
    console.error("Scraping error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================
   🔹 ROUTE AI (SMART CACHE)
========================= */
app.post("/api/ai", async (req, res) => {
  const { prompt, formatPrompt, userInstruction, meta } = req.body;

  console.log("SYSTEM PROMPT:", JSON.stringify(formatPrompt));

  if (!prompt) {
    return res.status(400).json({ error: "Prompt kosong" });
  }

  /**
   * 🔥 BASE KEY (IDENTITAS RPP)
   * gunakan meta supaya tidak tergantung prompt panjang
   */
  const baseKey = JSON.stringify(meta || { prompt });

  /**
   * 🔥 FULL KEY (UNTUK MODIFIKASI)
   */
  const modifiedKey = JSON.stringify({
    baseKey,
    userInstruction,
  });

  // =========================
  // 🔹 1. CEK MODIFIED CACHE
  // =========================
  const modifiedCached = modifiedCache.get(modifiedKey);

  if (!isExpired(modifiedCached)) {
    console.log("⚡ MODIFIED CACHE HIT");
    return res.json({
      success: true,
      result: modifiedCached.data,
      cached: "modified",
    });
  }

  // =========================
  // 🔹 2. CEK BASE CACHE
  // =========================
  let baseResult;
  const baseCached = baseCache.get(baseKey);

  if (!isExpired(baseCached)) {
    console.log("⚡ BASE CACHE HIT");
    baseResult = baseCached.data;
  } else {
    // =========================
    // 🔹 3. HIT API (MAHAL)
    // =========================
    console.log("🌐 CALL AI (BASE)");

    try {
      const result = await aiQueue.add(() => callAI(prompt, formatPrompt));
      baseResult = result;
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }

    baseCache.set(baseKey, {
      data: baseResult,
      time: Date.now(),
    });

    if (baseCache.size > 500) {
      const oldestKey = baseCache.keys().next().value;
      baseCache.delete(oldestKey);
    }
  }

  // =========================
  // 🔹 4. MODIFIKASI (OPSIONAL)
  // =========================
  let finalResult = baseResult;

  if (userInstruction && userInstruction.trim() !== "") {
    console.log("✨ APPLY MODIFICATION");

    try {
      finalResult = await aiQueue.add(() =>
        callAI(
          `
Berikut adalah RPP yang sudah dibuat:

${baseResult}

Lakukan modifikasi berikut TANPA mengubah struktur utama:

${userInstruction}
`,
          modifyPrompt,
        ),
      );
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }

    modifiedCache.set(modifiedKey, {
      data: finalResult,
      time: Date.now(),
    });
  }

  return res.json({
    success: true,
    result: finalResult,
    cached: false,
  });
});

/* =========================
   🔹 HELPER AI CALL
========================= */
async function callAI(prompt, formatPrompt) {
  const models = [
    "gpt-oss-120b:free",
    "gpt-oss-20b:free",
    "openrouter/free",
    "gemma-4-26b-a4b-it:free",
    "gemma-4-31b-it:free",
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
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: formatPrompt || "You are helpful assistant",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 3000,
          }),
        },
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
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error("Semua model gagal");
}

/* =========================
   🔹 START SERVER
========================= */
const PORT = 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});

/* database */

const mysql = require("mysql2/promise");

async function test() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "CorAI",
  });

  console.log("Connected!");
}

test();
