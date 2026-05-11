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

Aturan :
-jelaskan dengan format (kemungkinan penyebab kemiripan, indikasi copy paste, dan saran tindakan sebagai guru(kasih grade bagus / cap plagiasi))
-output dalam bentuk paragraf (maks 50 kata)
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