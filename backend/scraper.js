const puppeteer = require("puppeteer");
 
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const normalize = (s) => s.toLowerCase().trim();
 
async function getCapaian(jurusan = "Rekayasa Perangkat Lunak", elemen_capaian = "Pemrograman web") {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
 
  try {
    // 1. Masuk URL
    await page.goto(
      "https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/",
      { waitUntil: "networkidle2" }
    );
 
    // 2. Klik jenjang pendidikan -> SMK
    await page.locator("text=Pilih jenjang pendidikan").click();
    await page.locator("text=SMK").click();
 
    // 3. Tunggu tombol dropdown jurusan tersedia
    await page.waitForSelector(".mapel-button");
 
    // 4. Tunggu tombol benar-benar enabled
    await page.waitForFunction(() => {
      const btn = document.querySelector(".mapel-button");
      return btn && !btn.disabled && !btn.classList.contains("btn-disabled");
    });
 
    await delay(400);
 
    // 5. Klik dropdown jurusan pakai dispatch pointer events agar Svelte trigger
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
 
    // 6. Tunggu input modal muncul
    await page.waitForSelector('input[placeholder="Cari Mata Pelajaran"]', { visible: true });
 
    // 7. Isi jurusan
    await page.type('input[placeholder="Cari Mata Pelajaran"]', jurusan, { delay: 100 });
 
    // 8. Poll sampai elemen hasil muncul DAN langsung klik dalam satu evaluate
    await page.waitForFunction(
      (keyword) => {
        const normalize = (s) => s.toLowerCase().trim();
        const match = [
          ...document.querySelectorAll(
            "#modal > div > div > div > div:nth-child(2) > div > div.flex-1.flex"
          ),
        ].find((p) => normalize(p.innerText).includes(normalize(keyword)));
        if (!match) return false;
        match.click();
        return true;
      },
      { polling: 150, timeout: 10000 },
      jurusan
    );
 
    // 9. Klik tombol "Pilih"
    await page.waitForSelector(
      "#modal > div > div > div.absolute.bottom-0.w-full.flex.justify-center.items-center.p-4 > button",
      { visible: true }
    );
    await page.evaluate(() => {
      const btn = document.querySelector(
        "#modal > div > div > div.absolute.bottom-0.w-full.flex.justify-center.items-center.p-4 > button"
      );
      if (btn) btn.click();
    });
 
    await delay(400);
 
    // 10. Klik "Lihat CP & ATP"
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((b) => b.innerText.includes("Lihat CP & ATP"))
    );
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        b.innerText.includes("Lihat CP & ATP")
      );
      if (btn) btn.click();
    });
 
    // 11. Klik Fase F
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((b) => b.innerText.includes("Fase F"))
    );
    await page.evaluate(() => {
      const fase = [...document.querySelectorAll("button")].find((b) =>
        b.innerText.includes("Fase F")
      );
      if (fase) fase.click();
    });
 
    // 12. Tunggu accordion muncul
    await page.waitForSelector(
      "body > div.min-h-screen > main > div > div > div.p-4.pt-0 > div > h2",
      { visible: true }
    );
    await delay(800);
 
    // 13. Force open semua details + scrape, filter fuzzy
    const hasil = await page.evaluate((filter) => {
      const normalize = (s) => s.toLowerCase().trim();
      const data = [];
      const items = document.querySelectorAll(
        "body > div.min-h-screen > main > div > div > div.p-4.pt-0 > div > div"
      );
 
      items.forEach((item) => {
        const details = item.querySelector("details");
        if (details) details.open = true;
 
        const title = item.querySelector("details > summary > span > p > span")?.innerText || "";
        const content = item.querySelector("details > div > p")?.innerText || "";
        data.push({ title, content });
      });
 
      return data.filter((mapel) => normalize(mapel.title).includes(normalize(filter)));
    }, elemen_capaian);
 
    return hasil;
 
  } catch (err) {
    console.error("Scraping error:", err.message);
    throw err;
  } finally {
    await browser.close();
  }
}
 
module.exports = { getCapaian };