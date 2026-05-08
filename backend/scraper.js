const puppeteer = require("puppeteer");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getCapaian(jurusan, elemen_capaian, fase) {
  if (!jurusan || !elemen_capaian || !fase) {
    throw new Error(
      "Parameter tidak lengkap: jurusan, elemen_capaian, dan fase wajib diisi",
    );
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1 - 12 TETAP (tidak diubah sama sekali)
    console.log("step 1 :goto");
    await page.goto(
      "https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/",
      { waitUntil: "networkidle2" },
    );

    await delay(800);

    console.log("step 2 :pilih jenjang");
    await page.locator("text=Pilih jenjang pendidikan").click();
    await page.locator("text=SMK").click();

    await delay(800);

    console.log("step 3 :waitmapelbutton");
    await page.waitForSelector(".mapel-button");

    await delay(800);

    console.log("step 4 : wait mapel btn enabled");
    await page.waitForFunction(() => {
      const btn = document.querySelector(".mapel-button");
      return btn && !btn.disabled && !btn.classList.contains("btn-disabled");
    });

    await delay(400);

    console.log("step 5 :click dropdown jurusan");
    await page.evaluate(() => {
      const btn = document.querySelector(".mapel-button");
      if (!btn) return;

      const evtOpts = { bubbles: true, cancelable: true, composed: true };

      btn.dispatchEvent(new PointerEvent("pointerdown", evtOpts));
      btn.dispatchEvent(new MouseEvent("mousedown", evtOpts));
      btn.dispatchEvent(new MouseEvent("mouseup", evtOpts));
      btn.dispatchEvent(new PointerEvent("pointerup", evtOpts));
      btn.dispatchEvent(new Event("click", evtOpts));
    });

    await delay(800);

    console.log("step 6 :tunggu input modal");
    await page.waitForSelector('input[placeholder="Cari Mata Pelajaran"]', {
      visible: true,
    });

    await delay(800);

    console.log("step 7 :isi jurusan");
    await page.type('input[placeholder="Cari Mata Pelajaran"]', jurusan, {
      delay: 100,
    });

    await delay(800);

    console.log("step 8 :select jurusan");
    await page.waitForFunction(
      (keyword) => {
        const normalize = (s) => s.toLowerCase().trim();

        const match = [
          ...document.querySelectorAll(
            "#modal > div > div > div > div:nth-child(2) > div > div.flex-1.flex",
          ),
        ].find((p) => normalize(p.innerText).includes(normalize(keyword)));

        if (!match) return false;

        match.click();
        return true;
      },
      { polling: 150, timeout: 10000 },
      jurusan,
    );

    await delay(800);

    console.log("step 9 :klik tombol pilih");
    await page.evaluate(() => {
      const btn = document.querySelector(
        "#modal > div > div > div.absolute.bottom-0.w-full.flex.justify-center.items-center.p-4 > button",
      );
      if (btn) btn.click();
    });

    await delay(400);

    console.log("step 10 :lihat cp & atp");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((b) =>
        b.innerText.includes("Lihat CP & ATP"),
      ),
    );

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        b.innerText.includes("Lihat CP & ATP"),
      );
      if (btn) btn.click();
    });

    await delay(800);

    console.log("step 11 :klik fase");

    try {
      await page.waitForFunction(
        (f) =>
          [...document.querySelectorAll("button")].some((b) =>
            b.innerText.includes(`Fase ${f}`),
          ),
        { timeout: 5000 },
        fase,
      );

      await page.evaluate((f) => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          b.innerText.includes(`Fase ${f}`),
        );
        if (btn) btn.click();
      }, fase);
    } catch {
      return {
        success: true,
        data: [],
        meta: { cpAvailable: false, reason: "FASE_NOT_FOUND" },
      };
    }

    await delay(800);

    console.log("step 12 :tunggu accordion");

    await page.waitForSelector(
      "body > div.min-h-screen > main > div > div > div.p-4.pt-0 > div > h2",
      { visible: true },
    );

    await delay(800);

    // =========================
    // 🔥 STEP 13 FIXED (COSINE SIMILARITY)
    // =========================
    console.log("step 13 :cosine similarity filter");

    const hasil = await page.evaluate((filter) => {
      const normalize = (s) =>
        (s || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .trim();

      const tokenize = (s) => normalize(s).split(/\s+/).filter(Boolean);

      const keywordTokens = tokenize(filter);

      const items = document.querySelectorAll("details");

      const debugTitles = [];
      const scored = [];

 

      items.forEach((item) => {
  item.open = true; // 🔥 WAJIB

  const title = item.querySelector("summary")?.innerText || "";

  debugTitles.push(title);

  const content =
    item.querySelector("div")?.innerText || "";

  const titleTokens = tokenize(title);

  let score = 0;

  keywordTokens.forEach((k) => {
    if (titleTokens.includes(k)) score += 2;
  });

  score -= Math.abs(titleTokens.length - keywordTokens.length) * 0.5;

  scored.push({ title, content, score });
});


      scored.sort((a, b) => b.score - a.score);

      return {
        keyword: filter,
        debug: debugTitles,
        best: scored[0],
        all: scored,
      };
    }, elemen_capaian);

   

    console.log("KEYWORD:", hasil.keyword);
    console.log("ALL TITLES:", hasil.debug);
    console.log("BEST:", hasil.best);
    console.log("ALL SCORED:", hasil.all);


    return {
      success: true,
      data: hasil.best ? [hasil.best] : [],
      meta: {
        cpAvailable: !!hasil.best,
      },
    };
  } catch (err) {
    console.error("Scraping error:", err.message);

    return {
      success: false,
      data: [],
      meta: { error: err.message, cpAvailable: false },
    };
  } finally {
    await browser.close();
  }
}

module.exports = { getCapaian };
