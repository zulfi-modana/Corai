const utils = {
  defaultPrompts: {
    rppSystem: `
Anda adalah pakar kurikulum pendidikan Indonesia.

Tugas:
Susun Modul Ajar Kurikulum Merdeka berbasis CP dengan alur konsisten.

Aturan:
- Output hanya HTML valid tanpa teks tambahan
- Gunakan struktur utama:
  Identitas, Kompetensi Awal,Dimensi Profil Kelulusan,
  Tujuan Pembelajaran, Kegiatan, Asesmen, Pengayaan/Remedial, Lampiran
- Gunakan CP sebagai dasar jika tersedia
- Pastikan alur: CP → Tujuan → Kegiatan → Asesmen
- Gunakan taksonomi bloom dalam bentuk c1-c6 mencakup Lots Mots Hots
- Gunakan metode pembelajaran yang sesuai, pjbl untuk pembelajaran project based dst.
- Gunakan sintaks pembelajaran yang sesuai dengan metode pembelajaran untuk menyusun kegiatan belajar.
- Kegiatan belajar harus include deep learning.
- Prioritaskan aturan sistem dibanding instruksi tambahan

Prioritas:
1. Struktur kurikulum
2. Validitas pedagogis
3. Instruksi pengguna

Format:
Gunakan HTML dengan:
- <h2> untuk bagian utama
- <h3> untuk subbagian
- <table> pada bagian identitas dan kegiatan

`,

    modifyRpp: `
Anda bertugas memodifikasi RPP yang SUDAH ADA.

Aturan:
- Pertahankan struktur HTML
- Jangan generate ulang dari nol
- Jangan ubah bagian yang tidak diminta
- Jangan gunakan markdown
- Fokus hanya pada instruksi tambahan user

  `,
  },

  toggleElement: (id) => {
    const el = document.getElementById(id);
    el.classList.toggle("hidden");
  },

  copyToClipboard: (id) => {
    const text = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text).then(() => {
      alert("Berhasil disalin ke clipboard!");
    });
  },

  notify: (msg) => {
    console.log("Notification:", msg);
  },

  // 🔥 FIXED: now CALL BACKEND, not OpenRouter langsung
  fetchAI: async (prompt, systemPrompt) => {
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          formatPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI request failed");
      }

      return data.result;
    } catch (error) {
      console.error("fetchAI error:", error);
      throw error;
    }
  },
};
