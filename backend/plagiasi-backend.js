const express = require("express");
const similarity = require("compute-cosine-similarity");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "uploads/" });
const fs = require("fs");

// ===== CALCULATION QUEUE =====
const calcQueue = {
  running: 0,
  queue: [],
  concurrency: 2,
  add(fn) {
    if (this.queue.length >= 10) {
      return Promise.reject(new Error("Antrian penuh, coba lagi nanti"));
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
      Promise.resolve()
        .then(() => fn())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this.run();
        });
    }
  },
};

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function getLabel(score) {
  if (score >= 0.8) return { text: "Tinggi", icon: "⚠️", className: "danger" };
  if (score >= 0.35) return { text: "Sedang", icon: "🟡", className: "warning" };
  if (score >= 0.2) return { text: "Rendah", icon: "✅", className: "safe" };
  return { text: "Tidak Ditemukan Indikasi Plagiasi", icon: "✅", className: "safe" };
}

function computeTF(tokens) {
  const tf = {};
  const total = tokens.length;
  tokens.forEach((word) => { tf[word] = (tf[word] || 0) + 1; });
  Object.keys(tf).forEach((word) => { tf[word] = tf[word] / total; });
  return tf;
}

function computeIDF(allTokensPerDoc) {
  const idf = {};
  const N = allTokensPerDoc.length;
  const allWords = new Set(allTokensPerDoc.flat());
  allWords.forEach((word) => {
    const docsWithWord = allTokensPerDoc.filter((tokens) => tokens.includes(word)).length;
    idf[word] = Math.log((N + 1) / (docsWithWord + 1)) + 1;
  });
  return idf;
}

function computeTFIDF(tokens, idf) {
  const tf = computeTF(tokens);
  const tfidf = {};
  Object.keys(tf).forEach((word) => { tfidf[word] = tf[word] * (idf[word] || 0); });
  return tfidf;
}

function toArray(vec, allWords) {
  return allWords.map((word) => vec[word] || 0);
}

function findMatchingWords(textA, textB, tfidfA, tfidfB) {
  const normalize = (t) =>
    t.toLowerCase().replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();

  const wordsA = normalize(textA).split(" ").filter((w) => w.length > 2);
  const wordsB = normalize(textB).split(" ").filter((w) => w.length > 2);

  // Highlight any word that has a non-zero TF-IDF score in BOTH documents
  const sharedSignificant = new Set(
    Object.keys(tfidfA).filter((word) => tfidfA[word] > 0 && tfidfB[word] > 0)
  );

  function buildHighlightedHTML(words, shared) {
    return words
      .map((w) => {
        const clean = w.replace(/[^a-z0-9]/gi, "").toLowerCase();
        return shared.has(clean) ? `<mark>${w}</mark>` : w;
      })
      .join(" ");
  }

  return {
    highlightedA: buildHighlightedHTML(wordsA, sharedSignificant),
    highlightedB: buildHighlightedHTML(wordsB, sharedSignificant),
  };
}

// ===== THE HEAVY WORK =====
function runCalculation(texts, fileNames) {
  const allTokensPerDoc = texts.map((t) => tokenize(t));
  const idf = computeIDF(allTokensPerDoc);
  const tfidfVectors = allTokensPerDoc.map((tokens) => computeTFIDF(tokens, idf));
  const allWords = [...new Set(tfidfVectors.flatMap((v) => Object.keys(v)))];

  const results = [];

  for (let i = 0; i < tfidfVectors.length; i++) {
    for (let j = i + 1; j < tfidfVectors.length; j++) {
      const vecA = toArray(tfidfVectors[i], allWords);
      const vecB = toArray(tfidfVectors[j], allWords);
      const sim = similarity(vecA, vecB) || 0;

      const { highlightedA, highlightedB } = findMatchingWords(
        texts[i].slice(0, 3000),
        texts[j].slice(0, 3000),
        tfidfVectors[i],
        tfidfVectors[j]
      );

      results.push({
        fileA: fileNames[i],
        fileB: fileNames[j],
        similarity: Number((sim * 100).toFixed(2)),
        level: getLabel(sim),
        rawScore: sim,
        textA: texts[i].slice(0, 3000),
        textB: texts[j].slice(0, 3000),
        highlightedA,
        highlightedB,
      });
    }
  }

  results.sort((a, b) => b.rawScore - a.rawScore);
  return results;
}

// ===== ROUTE =====
router.post("/", upload.array("files"), async (req, res) => {
  try {
    const fileNames = [];
    const mode = req.body.mode;
    let texts = [];

    if (mode === "pdf") {
      const pdfParse = require("pdf-parse");
      const files = req.files;

      if (!files || files.length < 2) {
        return res.status(400).json({ error: "Minimal 2 file PDF diperlukan" });
      }

      for (let file of files) {
        const buffer = fs.readFileSync(file.path);
        const data = await pdfParse(buffer);
        if (data.text && data.text.trim().length > 0) {
          texts.push(data.text);
          fileNames.push(file.originalname);
        }
        fs.unlinkSync(file.path);
      }
    } else if (mode === "text") {
      texts = JSON.parse(req.body.texts || "[]");
      if (texts.length < 2) {
        return res.status(400).json({ error: "Minimal 2 teks diperlukan" });
      }
      fileNames.push(...texts.map((_, i) => `Teks ${i + 1}`));
    } else {
      return res.status(400).json({ error: "Mode tidak valid" });
    }

    let results;
    try {
      results = await calcQueue.add(() => runCalculation(texts, fileNames));
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }

    return res.json({ success: true, total: texts.length, comparisons: results });
  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

module.exports = router;

/* const express = require("express");


const similarity = require("compute-cosine-similarity");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "uploads/" });
const fs = require("fs");

// ===== CALCULATION QUEUE =====
const calcQueue = {
  running: 0,
  queue: [],
  concurrency: 2, // max 2 heavy calc jobs at once
  add(fn) {
    if (this.queue.length >= 10) {
      return Promise.reject(new Error("Antrian penuh, coba lagi nanti"));
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
      Promise.resolve()
        .then(() => fn())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this.run();
        });
    }
  },
};

// Tokenisasi
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

// Kriteria label
function getLabel(score) {
  if (score >= 0.8) return { text: "Tinggi", icon: "⚠️", className: "danger" };
  if (score >= 0.5) return { text: "Sedang", icon: "🟡", className: "warning" };
  if (score >= 0.2) return { text: "Rendah", icon: "✅", className: "safe" };
  return {
    text: "Tidak Ditemukan Indikasi Plagiasi",
    icon: "✅",
    className: "safe",
  };
}

function computeTF(tokens) {
  const tf = {};
  const total = tokens.length;
  tokens.forEach((word) => {
    tf[word] = (tf[word] || 0) + 1;
  });
  Object.keys(tf).forEach((word) => {
    tf[word] = tf[word] / total;
  });
  return tf;
}

function computeIDF(allTokensPerDoc) {
  const idf = {};
  const N = allTokensPerDoc.length;
  const allWords = new Set(allTokensPerDoc.flat());
  allWords.forEach((word) => {
    const docsWithWord = allTokensPerDoc.filter((tokens) =>
      tokens.includes(word),
    ).length;
    idf[word] = Math.log((N + 1) / (docsWithWord + 1)) + 1;
  });
  return idf;
}

function computeTFIDF(tokens, idf) {
  const tf = computeTF(tokens);
  const tfidf = {};
  Object.keys(tf).forEach((word) => {
    tfidf[word] = tf[word] * (idf[word] || 0);
  });
  return tfidf;
}

function toArray(vec, allWords) {
  return allWords.map((word) => vec[word] || 0);
}

function findMatchingWords(textA, textB, tfidfA, tfidfB, threshold = 0) {
  const normalize = (t) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const wordsA = normalize(textA)
    .split(" ")
    .filter((w) => w.length > 2);
  const wordsB = normalize(textB)
    .split(" ")
    .filter((w) => w.length > 2);

  // Words that exist in both docs AND have meaningful TF-IDF weight in both
  const sharedSignificant = new Set(
    Object.keys(tfidfA).filter(
      (word) =>
        tfidfB[word] && tfidfA[word] >= threshold && tfidfB[word] >= threshold,
    ),
  );

  function buildHighlightedHTML(words, shared) {
    return words
      .map((w) => {
        const clean = w.replace(/[^a-z0-9]/gi, "").toLowerCase();
        return shared.has(clean) ? `<mark>${w}</mark>` : w;
      })
      .join(" ");
  }

  return {
    highlightedA: buildHighlightedHTML(wordsA, sharedSignificant),
    highlightedB: buildHighlightedHTML(wordsB, sharedSignificant),
  };
}

// ===== THE HEAVY WORK (wrapped in queue) =====
function runCalculation(texts, fileNames) {
  const allTokensPerDoc = texts.map((t) => tokenize(t));
  const idf = computeIDF(allTokensPerDoc);
  const tfidfVectors = allTokensPerDoc.map((tokens) =>
    computeTFIDF(tokens, idf),
  );
  const allWords = [...new Set(tfidfVectors.flatMap((v) => Object.keys(v)))];

  const results = [];
  for (let i = 0; i < tfidfVectors.length; i++) {
    for (let j = i + 1; j < tfidfVectors.length; j++) {
      const vecA = toArray(tfidfVectors[i], allWords);
      const vecB = toArray(tfidfVectors[j], allWords);
      const sim = similarity(vecA, vecB) || 0;
      const { highlightedA, highlightedB } = findMatchingWords(
        texts[i].slice(0, 3000),
        texts[j].slice(0, 3000),
        tfidfVectors[i],
        tfidfVectors[j],
      );

     
    }

     // debug — remove after confirming
      console.log(
        "sharedSignificant count would be:",
        Object.keys(tfidfVectors[i]).filter(
          (word) =>
            tfidfVectors[j][word] &&
            tfidfVectors[i][word] >= 0.01 &&
            tfidfVectors[j][word] >= 0.01,
        ).length,
      );
      console.log(
        "sample tfidf values:",
        Object.entries(tfidfVectors[i]).slice(0, 5),
      );
      results.sort((a, b) => b.rawScore - a.rawScore);
      return results;


    results.push({
      fileA: fileNames[i],
      fileB: fileNames[j],
      similarity: Number((sim * 100).toFixed(2)),
      level: getLabel(sim),
      rawScore: sim,
      textA: texts[i].slice(0, 3000),
      textB: texts[j].slice(0, 3000),
      highlightedA,
      highlightedB,
    });
  }
}

// ===== ROUTE =====
router.post("/", upload.array("files"), async (req, res) => {
  try {
    const fileNames = [];
    const mode = req.body.mode;
    let texts = [];

    // ================= PDF =================
    if (mode === "pdf") {
      const pdfParse = require("pdf-parse");
      const files = req.files;

      if (!files || files.length < 2) {
        return res.status(400).json({ error: "Minimal 2 file PDF diperlukan" });
      }

      for (let file of files) {
        const buffer = fs.readFileSync(file.path);
        const data = await pdfParse(buffer);
        if (data.text && data.text.trim().length > 0) {
          texts.push(data.text);
          fileNames.push(file.originalname);
        }
        fs.unlinkSync(file.path);
      }
    }

    // ================= TEXT =================
    else if (mode === "text") {
      texts = JSON.parse(req.body.texts || "[]");
      if (texts.length < 2) {
        return res.status(400).json({ error: "Minimal 2 teks diperlukan" });
      }
      fileNames.push(...texts.map((_, i) => `Teks ${i + 1}`));
    }

    // ================= INVALID =================
    else {
      return res.status(400).json({ error: "Mode tidak valid" });
    }

    // ================= QUEUE + CALC =================
    let results;
    try {
      results = await calcQueue.add(() => runCalculation(texts, fileNames));
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }

    return res.json({
      success: true,
      total: texts.length,
      comparisons: results,
    });
  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

module.exports = router;
 */