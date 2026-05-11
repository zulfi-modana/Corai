const express = require("express");
const similarity = require("compute-cosine-similarity");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "uploads/" });
const fs = require("fs");

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
  if (score >= 0.8) {
    return {
      text: "Tinggi",
      icon: "⚠️",
      className: "danger",
    };
  }

  if (score >= 0.5) {
    return {
      text: "Sedang",
      icon: "🟡",
      className: "warning",
    };
  }

  if (score >= 0.2) {
    return {
      text: "Rendah",
      icon: "✅",
      className: "safe",
    };
  }

  return {
    text: "Tidak Ditemukan Indikasi Plagiasi",
    icon: "✅",
    className: "safe",
  };
}

// ===== TF =====
function computeTF(tokens) {
  const tf = {};
  const total = tokens.length;
  tokens.forEach((word) => {
    tf[word] = (tf[word] || 0) + 1;
  });
  // Normalize by total token count
  Object.keys(tf).forEach((word) => {
    tf[word] = tf[word] / total;
  });
  return tf;
}

// ===== IDF =====
function computeIDF(allTokensPerDoc) {
  const idf = {};
  const N = allTokensPerDoc.length;

  // Collect all unique words
  const allWords = new Set(allTokensPerDoc.flat());

  allWords.forEach((word) => {
    // Count how many docs contain this word
    const docsWithWord = allTokensPerDoc.filter((tokens) =>
      tokens.includes(word),
    ).length;
    // Smoothed IDF to avoid division by zero
    idf[word] = Math.log((N + 1) / (docsWithWord + 1)) + 1;
  });

  return idf;
}

// ===== TF-IDF VECTOR =====
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

    // ================= TF-IDF + COSINE =================

    // 1. Tokenize all documents
    const allTokensPerDoc = texts.map((t) => tokenize(t));

    // 2. Compute global IDF across all documents
    const idf = computeIDF(allTokensPerDoc);

    // 3. Compute TF-IDF vector per document
    const tfidfVectors = allTokensPerDoc.map((tokens) =>
      computeTFIDF(tokens, idf),
    );

    // 4. Build unified word list
    const allWords = [...new Set(tfidfVectors.flatMap((v) => Object.keys(v)))];

    // 5. Pairwise cosine similarity
    const results = [];

    for (let i = 0; i < tfidfVectors.length; i++) {
      for (let j = i + 1; j < tfidfVectors.length; j++) {
        const vecA = toArray(tfidfVectors[i], allWords);
        const vecB = toArray(tfidfVectors[j], allWords);

        const sim = similarity(vecA, vecB) || 0;

        results.push({
          fileA: fileNames[i],
          fileB: fileNames[j],
          similarity: Number((sim * 100).toFixed(2)),
          level: getLabel(sim),
          rawScore: sim,
          textA: texts[i].slice(0, 3000),
          textB: texts[j].slice(0, 3000),
        });
        results.sort((a, b) => b.rawScore - a.rawScore);
      }
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
