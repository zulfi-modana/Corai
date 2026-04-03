const express = require("express");
const { getCapaian } = require("./scraper");

const app = express();

app.use(express.static("public"));

app.get("/capaian", async (req, res) => {
  const { jurusan, mapel } = req.query;

  try {
    const data = await getCapaian(jurusan, mapel);
    res.json({ success: true, data });
  } catch (err) {
    console.error("Scraping error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

console.log("Server mau jalan...");
app.listen(3000, () => {
  console.log("Server jalan di 3000");
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});
