/* let generatedRPP = null; */
function createRow(label, value) {
  return new docx.TableRow({
    children: [
      new docx.TableCell({
        children: [new docx.Paragraph(label)],
      }),
      new docx.TableCell({
        children: [new docx.Paragraph(value)],
      }),
    ],
  });
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

function getFase(grade) {
  if (grade.includes("10") || grade.toLowerCase().includes("fase e"))
    return "E";
  if (
    grade.includes("11") ||
    grade.includes("12") ||
    grade.toLowerCase().includes("fase f")
  )
    return "F";
  return "F";
}

function updateGenerateButton(text, icon = "fa-spinner") {
  btnGenerate.classList.add("Generate");

  btnGenerate.innerHTML = `
    <i class="fas ${icon}"></i>
    ${text}
  `;
}
/* btn download word */
function setButtonVisibility(isVisible) {
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.style.display = isVisible ? "block" : "none";
  }
}
/* func download word */

function exportToWord() {
  const content = document.getElementById("rpp-output").innerHTML;

  const header = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office'
  xmlns:w='urn:schemas-microsoft-com:office:word'
  xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'></head><body>`;

  const footer = "</body></html>";

  const sourceHTML = header + content + footer;

  const blob = new Blob(["\ufeff", sourceHTML], {
    type: "application/msword",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "Modul_Ajar_Kurikulum_Merdeka.docx";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setPromptCustomizationLocked(isLocked = true) {
  const toggle = document.getElementById("advancedToggle");
  const config = document.getElementById("prompt-config");

  if (isLocked) {
    toggle.classList.add("locked");

    // sembunyikan config
    config.classList.add("hidden");

    // klik diblok
    toggle.onclick = (e) => {
      e.preventDefault();

      showToast(
        "Silahkan generate dahulu untuk menggunakan fitur ini 🔒",
        2500,
      );
    };
  } else {
    toggle.classList.remove("locked");

    toggle.onclick = () => {
      utils.toggleElement("prompt-config");
    };
  }
}

console.log("DOM loaded");

document.addEventListener("DOMContentLoaded", () => {
  setPromptCustomizationLocked(true);
  setButtonVisibility(false);

  // 🔒 SYSTEM PROMPT DIKUNCI (tidak dari user)
  const formatPrompt = utils.defaultPrompts.rppSystem;

  // ✅ USER INSTRUCTION (optional dari UI)

  // Navigation Logic
  const navLinks = document.querySelectorAll(".nav-links a");
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      /* e.preventDefault(); */
      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      const targetId = link.getAttribute("data-target");
      document.querySelectorAll(".app-section").forEach((section) => {
        section.classList.remove("active");
      });
      document.getElementById(targetId).classList.add("active");
    });
  });

  // RPP Generator Logic
  const rppForm = document.getElementById("rpp-form");
  const btnGenerate = document.getElementById("btnGenerate");

  rppForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userInstruction =
      document.getElementById("userInstruction")?.value.trim() || "";

    btnGenerate.disabled = true;

    /*   btnGenerate.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Generating...'; */

    const formData = {
      school: document.getElementById("schoolName").value,
      level: document.getElementById("taskOption").value,
      subject: document.getElementById("subject").value,
      grade: document.getElementById("gradeLevel").value,
      topic: document.getElementById("topic").value,
    };

    // 🔥 ambil CP dari backend
    const fase = getFase(formData.grade);
    let cpText = "";
    let cpAvailable = false;
    updateGenerateButton("Mencari CP...", "fa-search");

    try {
      const res = await fetch(
        `/capaian?jurusan=${encodeURIComponent(document.getElementById("jurusan").value)}&mapel=${encodeURIComponent(formData.subject)}&fase=${encodeURIComponent(fase)}`,
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      /*    const { success, data, meta } = await res.json(); */
      const resJson = await res.json();

      const success = resJson.success;
      const data = resJson.data.data;
      const meta = resJson.data.meta;

      if (!success) {
        throw new Error("Gagal ambil CP");
      }

      /*  let cpText = ""; */
      cpAvailable = meta?.cpAvailable ?? false;

      if (cpAvailable && data && data.length > 0) {
        cpText = data
          .map((item) => `${item.title}: ${item.content}`)
          .join("\n");
      }

      console.log("CP:", cpText);
      console.log("CP Available:", cpAvailable);
    } catch (error) {
      console.error("Terjadi error saat ambil cp:", error.message);
    }

    if (!cpAvailable) {
      showToast("CP tidak ditemukan, menggunakan AI tanpa CP", "warning");
      /* alert("⚠️ CP tidak ditemukan, sistem menggunakan AI tanpa CP"); */
    }

    updateGenerateButton("Generate Modul...", "fa-brain");

    try {
      const prompt = `
[DATA]
Sekolah: ${formData.school}
Mapel: ${formData.subject}
Kelas: ${formData.grade}
Materi: ${formData.topic}
Metode Belajar : (isi dengan pjbl atau pbl, dsb sesuai subjek dan materi pembelajaran)

CP:
${cpText || "Tidak tersedia"}

[INSTRUKSI]
Buat modul ajar lengkap dengan 3 pertemuan.

Tambahan struktur:
- Lampiran berisi: materi, referensi, LKPD, dan rubrik penilaian
- Gunakan tujuan pembelajaran sebagai dasar penyusunan materi

${!cpAvailable ? "- Gunakan pendekatan umum tanpa CP" : ""}
`;

      const resAI = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          formatPrompt,
          userInstruction,
          meta: {
            school: formData.school,
            subject: formData.subject,
            grade: formData.grade,
            topic: formData.topic,
          },
        }),
      });

      const dataAI = await resAI.json();
      updateGenerateButton("Menyusun Output...", "fa-file-lines");

      if (!resAI.ok || !dataAI.success) {
        throw new Error(dataAI.error || "AI error");
      }

      const aiResult = dataAI.result;

      const finalHTML = aiResult;

      document.getElementById("rpp-output").innerHTML = finalHTML;
      document.getElementById("result-container").classList.remove("hidden");

      window.scrollTo({
        top: document.getElementById("result-container").offsetTop - 10,
        behavior: "smooth",
      });

      setButtonVisibility(true);
      setPromptCustomizationLocked(false);
    } catch (error) {
      alert("Gagal generate RPP: " + error.message);
    } finally {
      btnGenerate.disabled = false;

      btnGenerate.classList.remove("generating");

      btnGenerate.innerHTML =
        '<i class="fas fa-magic"></i> Generate RPP Sekarang';
    }
  });
});
