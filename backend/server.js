require("dotenv").config();

const express = require("express");
const Swal = require("sweetalert2");
const { getCapaian } = require("./scraper");
const { searchIllustration } = require("./mediawiki");

const app = express();
Swal.fire({
  title: "Auto theme",
  theme: "auto",
  title: "Error!",
  text: "Do you want to continue",
  icon: "error",
  confirmButtonText: "Cool",
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

    /* generate ilustration start */
    let illustration = [];
    const tujuanList = meta.tujuan
      .split("\n")
      .map((t) => t.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);

    try {
      const keywordResults = await generateIllustrationKeywords(
        meta.subject,
        meta.topic,
        tujuanList,
      );

      console.log(keywordResults);

      for (const item of keywordResults) {
        console.log("Keyword:", item.keyword);
        const images = await searchIllustration(item.keyword);
        if (images.length > 0) {
          illustration.push({
            tujuan: item.tujuan,
            keyword: item.keyword,
            ...images[0],
          });
        }
      }
    } catch (err) {
      console.error("Illustration fetch gagal:", err.message);
    }

    /* generate ilustration end */

    let finalPrompt = prompt;

    if (illustration.length > 0) {
      finalPrompt += `

[ILUSTRASI]
${illustration
  .map(
    (img, index) => `Ilustrasi ${index + 1}

Tujuan:
${img.tujuan}

Keyword:
${img.keyword}

Judul:
${img.title}

URL:
${img.imageUrl}
`,
  )
  .join("\n")}
`;
    }

    try {
      const result = await aiQueue.add(() => callAI(finalPrompt, formatPrompt));
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

/* Media wiki AI helper */

async function generateIllustrationKeywords(subject, topic, tujuanList) {
  const prompt = `
Mata Pelajaran: ${subject}
Materi: ${topic}

Tujuan:

${tujuanList.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Buat keyword pencarian gambar UNTUK MASING2 TUJUAN.

JANGAN PERNAH MENGGUNAKAN KATA TUTORIAL, GUIDE, DIAGRAM, LATIHAN, OVERVIEW, VISUAL, DIAGRAM, ILLUSTRATION DSB. FOKUS SEBAGAI GURU YG MENCARI KEYWORD UNTUK MEMUDAHKAN SISWA, MISAL GURU HTML MENCARI KEYWORD " HTML ELEMENT STRUCTURE BREAKDOWN ". Keyword yg digunakan akan digunakan untuk API database gambar umum sehingga avoid keyword yg tidak penting & ambigu /  kepanjangan (misal gunakan "css grid layout", bukan "css grid layout example")
Tugasmu hanya membuat keyword supaya media ditemukan, tidak perlu menggunakan kata2 tutorial, example dll cukup keyword inti saja karna keyword akan dikirim ke API mediasearch.


Output hanya json array, pastikan keyword ringkas dan harus relevan dgn search wikimedia, gunakan konteks materi misal html javascript sebagai bahan utama keyword, utamakan mendapat gambar yg relevan dengan materi.

Contoh hasil json array dengan mata pelajaran pemrograman web:

[
 {
  "tujuan":"siswa mampu menerapkan struktur elemen html",
  "keyword":"breakdown parts of html structure"
 },
 {
  "tujuan":"siswa mampu menerapkan media query css",
  "keyword":"css grid layout media query"
 },
 {
  "tujuan":"siswa mampu menerapkan javascript dom",
  "keyword":"document model object javascript"
 }
]

JANGAN output string array. JANGAN tambah penjelasan. HANYA JSON array.

`;

  const result = await callAI(prompt, "Output hanya JSON valid.");

  return JSON.parse(result);
}



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
            max_tokens: 9999,
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

/* const mysql = require("mysql2/promise"); */

/* async function test() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "CorAI",
  });

  console.log("Connected!");
} */
