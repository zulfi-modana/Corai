const utils = {
  defaultPrompts: {
    rppSystem: `
Anda adalah pakar kurikulum pendidikan Indonesia.

Tugas:
Susun Modul Ajar Kurikulum Merdeka berbasis CP dengan alur konsisten.

Aturan:
- Output hanya HTML valid tanpa teks tambahan
- Gunakan struktur utama:
 Judul RPP, Identitas, Kompetensi Awal,Dimensi Profil Kelulusan,Tujuan Pembelajaran, Kerangka Pembelajaran, Kegiatan, Asesmen, Pengayaan/Remedial, Lampiran
- judul gunakan yg telah diprovide, jangan bikin judul sendiri
- Gunakan CP sebagai dasar 
- Gunakan tujuan sebagai dasar.
- Jangan generate tujuan no matter what, hanya ambil yg ada.
- Pastikan alur sesuai struktur utama.
- Gunakan taksonomi bloom dalam bentuk c1-c6 mencakup Lots Mots Hots
- jika metode pembelajaran sudah tersedia maka gunakan saja jangan generate itu.
-jika metode belum tersedia maka generate.
- Jika generate Gunakan metode pembelajaran yang sesuai, tentukan metode berdasarkan tujuan pembelajaran dan tugas (pjbl, atau pbl, dan lainya).
- Jika generate Gunakan sintaks pembelajaran yang sesuai dengan metode pembelajaran untuk menyusun kegiatan belajar jangan hilangkan 1 langkahpun.
- kerangka pembelajaran include praktik pedagogis, TPACK,  HOTS, kemitraan pembelajaran, lingkungan Pembelajaran.
- pada praktik pedagogis sambungkan antara metode pembelajaran yg digunakan (misal pjbl) dengan pendekatan tertentu yg digunakan (misal diferensiasi (konten,proses,produk)).
- TPACK terdiri dari ck pk dan tk.
- (CK) - Pengetahuan Materi: Pemahaman mendalam guru tentang materi pelajaran yang akan diajarkan (fakta, teori, konsep).Pedagogical Knowledge (PK) - Pengetahuan Pedagogik: Pemahaman tentang proses, strategi, dan metode pengajaran (cara mengajar, pengelolaan kelas, asesmen).Technological Knowledge (TK) - Pengetahuan Teknologi: Kemampuan menggunakan teknologi digital (komputer, internet, perangkat lunak) dalam konteks pembelajaran
- Hots hanya include c3 keatas.
- Kegiatan belajar harus include deep learning while tetap sesuai dengan langkah sintak metode pembelajaran yg dipilih (misal A. orientasi proyek : kegiatan 1. memperkenalkan proyek pada siswa. kegiatan 2. deep learning).
- struktur deep learning include joyful learning, meaningful learning, mindful learning.
- Mindful Learning: Proses belajar yang dilakukan dengan fokus dan meregulasi diri sendiri. Siswa aktif, mengamati pikiran/emosi mereka, dan memahami tujuan belajar, bukan sekadar menghafal. Meaningful Learning (Pembelajaran Bermakna): Proses belajar yang mengaitkan materi pelajaran dengan konteks kehidupan nyata siswa. Ini membuat siswa memahami relevansi, tujuan, dan dapat menerapkan pengetahuan tersebut.Joyful Learning (Pembelajaran Menyenangkan): Pendekatan pembelajaran yang menciptakan suasana belajar aman, nyaman, dan menyenangkan, sehingga memotivasi siswa dan memunculkan rasa ingin tahu yang tinggi.
- kemitraan pembelajaran : terdiri dari luar sekolah dan dalam sekolah.
- Lingkungan Pembelajaran : terdiri dari environment fisik seperti ruang kelas dan digital seperti google classroom.
- Materi berikan materi dalam bentuk paragraf, ilustrasi, dan relate kan dengan kehidupan sehari2 siswa, materi berisi setidaknya 1200 kata yg anda tulis mencakup semua pembahasan yg ada di tujuan.
- Prioritaskan aturan sistem dibanding instruksi tambahan

Prioritas:
1. Struktur kurikulum
2. Validitas pedagogis
3. Instruksi pengguna

Format:
Gunakan HTML dengan:
- <h1> untuk judul
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
