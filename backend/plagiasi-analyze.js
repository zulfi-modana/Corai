const express = require("express");
const router = express.Router();

const { callAI } = require("./ai-service");

router.post("/", async (req, res) => {
  try {
    const { textA, textB, similarity } = req.body;

    const prompt = `
Analisis kemiripan dua dokumen berikut.

Dokumen A:
${textA}

Dokumen B:
${textB}

Similarity:
${similarity}%

Jelaskan:
- kemungkinan penyebab kemiripan
- apakah karena definisi umum
- apakah ada indikasi copy paste
- bagian mana yang paling mirip
`;

    const result = await callAI(
      prompt,
      "Anda adalah analis plagiasi akademik."
    );

    res.json({
      success: true,
      analysis: result,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;