/* let generatedRPP = null; */


  let abortController = null;
  let isGenerating = false;

function alertSwal() {
  Swal.fire({
    title: "Sukses Menghapus",
    theme: "auto",
    text: "Data Berhasil dihapus!",
    icon: "success",
  });
}

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

var i = 0;
var txt = "Generator Modul Ajar";
var speed = 70;

function typeWriter() {
  if (i < txt.length) {
    document.getElementById("page-title").innerHTML += txt.charAt(i);
    i++;
    setTimeout(typeWriter, speed);
  }
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

/* delete cache hasil generate */
function resetRPPForm() {
  localStorage.removeItem("formValue");

  document
    .querySelectorAll('input:not([type="checkbox"]),textarea')
    .forEach((input) => {
      input.value = "";
    });

  document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });

  document.getElementById("metode").value = "";
  document.getElementById("deleteModalForm").style.display = "none";

  alertSwal();
}

function cancelGenerate() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  localStorage.removeItem("isGenerating");
  localStorage.removeItem("generatingLabel");
  btnGenerate.disabled = false;
  btnGenerate.innerHTML = '<i class="fas fa-magic"></i> Generate RPP Sekarang';
  document.getElementById("btnCancel").style.display = "none"; 
}

function clearGeneratedRPP() {
  localStorage.removeItem("generatedRPP");

  document.getElementById("rpp-output").innerHTML = "";

  document.getElementById("result-container").classList.add("hidden");

  alertSwal();

  // Close the modal
  document.getElementById("deleteModal").style.display = "none";

  setButtonVisibility(false);

  setPromptCustomizationLocked(true);
}

function updateGenerateButton(text, icon = "fa-spinner") {
  btnGenerate.disabled = true;
document.getElementById("btnCancel").style.display = "block";

  // Persist current label so it survives navigation
  localStorage.setItem("generatingLabel", JSON.stringify({ text, icon }));
}
/* btn download word */
function setButtonVisibility(isVisible) {
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.style.display = isVisible ? "block" : "none";
  }
}

function scopeAIStyles(html) {
  return html.replace(/<style>([\s\S]*?)<\/style>/gi, (match, css) => {
    // prefix semua selector dengan #rpp-output
    const scopedCSS = css.replace(
      /(^|\})([^{@}][^{]*)\{/g,
      (m, brace, selector) => {
        const scopedSelector = selector
          .split(",")
          .map((s) => `#rpp-output ${s.trim()}`)
          .join(", ");

        return `${brace}${scopedSelector}{`;
      },
    );

    return `<style>${scopedCSS}</style>`;
  });
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
  typeWriter();
 



  const saved = localStorage.getItem("generatedRPP");

  const output = document.getElementById("rpp-output");

  if (saved && output) {
    output.innerHTML = saved;
    document.getElementById("result-container").classList.remove("hidden");

    setPromptCustomizationLocked(false);
    setButtonVisibility(true);
  }

  const isGenerating = localStorage.getItem("isGenerating");

  if (isGenerating) {
    // Restore the loading UI
    const btn = document.getElementById("btnGenerate");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-brain fa-spin"></i> Generate Modul...';

    const savedLabel = localStorage.getItem("generatingLabel");
    if (savedLabel) {
      const { text, icon } = JSON.parse(savedLabel);
      btn.innerHTML = `<i class="fas ${icon} fa-spin"></i> ${text}`;
    } else {
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memproses...`;
    }

    // Show a toast so the user knows what's happening
    showToast("Masih dalam proses generate, harap tunggu...", 4000);
  }

  const savedForm = localStorage.getItem("formValue");

  if (savedForm) {
    const formData = JSON.parse(savedForm);

    document.getElementById("schoolName").value = formData.school;

    document.getElementById("subject").value = formData.subject;

    document.getElementById("topic").value = formData.topic;

    /* formData.cpText = cpText */ document.getElementById("customCP").value =
      formData.cpText || "";
    document.getElementById("jurusan").value = formData.jurusan;
    document.getElementById("gradeLevel").value = formData.grade;

    const tujuanInputs = document.querySelectorAll("#tujuan-list input");

    if (formData.tujuan) {
      const tujuanArray = formData.tujuan.split("\n");

      tujuanInputs.forEach((input, index) => {
        const item = tujuanArray[index] || "";

        input.value = item.replace(/^\d+\.\s*/, "");
      });
    }

    const selectedDPK = (formData.dpk || "")
      .split(",")
      .map((item) => item.trim());
    document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = selectedDPK.includes(cb.value);
    });
    document.getElementById("metode").value = formData.metode;
    document.getElementById("judul").value = formData.judul;
  }

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

    const validations = [
      {
        el: document.getElementById("schoolName"),
        msg: "Nama Sekolah tidak boleh kosong",
      },
      {
        el: document.getElementById("jurusan"),
        msg: "Jurusan tidak boleh kosong",
      },
      {
        el: document.getElementById("subject"),
        msg: "Bidang Studi tidak boleh kosong",
      },
      {
        el: document.getElementById("gradeLevel"),
        msg: "Fase / Kelas tidak boleh kosong",
      },
    ];

    for (const { el, msg } of validations) {
      if (!el.value.trim()) {
        showToast(msg, 3000);
        el.focus();
        return;
      }
    }

    /* function validateTujuanCount(){
      if (formData.tujuan.length <3){
        showToast("Isi minimal 3 tujuan",3000);
        focus();
        return;
      }

      else if (formData.tujuan.length == 0){
        showToast("tujuan tidak boleh kosong",3000);
        focus();
        return;
      }
    } */

    function validateTujuanCount() {
      const tujuanInputs = [...document.querySelectorAll("#tujuan-list input")];

      const filled = tujuanInputs.filter((input) => input.value.trim() !== "");

      if (filled.length < 3) {
        showToast("Isi minimal 3 tujuan", 3000);
        tujuanInputs[0].focus();
        return false;
      }

      return true;
    }

    const checked = document.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length < 2) {
      showToast("Pilih minimal 2 Dimensi Profil Kelulusan", 3000);
      focus();
      return;
    }

    if (!validateTujuanCount()) {
      return;
    }

    const userInstruction =
      document.getElementById("userInstruction")?.value.trim() || "";

    btnGenerate.disabled = true;

    /*   btnGenerate.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Generating...'; */

    const formData = {
      school: document.getElementById("schoolName").value,
      level: document.getElementById("taskOption").value,
      jurusan: document.getElementById("jurusan").value,
      subject: document.getElementById("subject").value,
      grade: document.getElementById("gradeLevel").value,
      topic: document.getElementById("topic").value,
      tujuan: [...document.querySelectorAll("#tujuan-list input")]
        .map((el, i) => `${i + 1}. ${el.value}`)
        .filter((v) => v.trim() !== `${v.split(".")[0]}.`)
        .join("\n"),
      metode: document.getElementById("metode").value,
      dpk: [...document.querySelectorAll('input[type="checkbox"]:checked')]
        .map((cb) => cb.value)
        .join(", "),
      judul: document.getElementById("judul").value,
    };

    // 🔥 ambil CP dari backend
    const fase = getFase(formData.grade);
    let cpText = "";
    let cpAvailable = false;
    localStorage.setItem("isGenerating", "true");
    localStorage.setItem("isGenerating", "true");
    abortController = new AbortController();
    updateGenerateButton("Mencari CP...", "fa-search");

    try {
      const res = await fetch(
        `/capaian?jurusan=${encodeURIComponent(document.getElementById("jurusan").value)}&mapel=${encodeURIComponent(formData.subject)}&fase=${encodeURIComponent(fase)}`,
        { signal: abortController.signal },
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
      if (error.name === "AbortError") return; 
      console.error("Terjadi error saat ambil cp:", error.message);
    }

    const customCPInput = document.querySelector("#customCP");

    if (!cpAvailable) {
      const cpLabel = document.querySelector(".cpLabel");

      /*   customCPInput.removeAttribute("hidden");
      cpLabel.removeAttribute("hidden"); */

      // kalau user BELUM isi CP → stop
      if (customCPInput.value.trim() === "") {
        showToast("CP tidak ditemukan, silahkan isi CP secara manual", 3000);

        btnGenerate.disabled = false;

        btnGenerate.innerHTML =
          '<i class="fas fa-magic"></i> Generate RPP Sekarang';

        customCPInput.focus();

        return;
      }

      // kalau SUDAH isi → pakai CP manual
      cpText = customCPInput.value.trim();
    }

    formData.cpText = cpText;

    localStorage.setItem("formValue", JSON.stringify(formData));

    updateGenerateButton("Generate Modul...", "fa-brain");

    try {
      const prompt = `
[DATA]
Judul : ${formData.judul}
Sekolah: ${formData.school}
Jurusan : ${formData.jurusan}
Mapel: ${formData.subject}
Kelas: ${formData.grade}
Materi: ${formData.topic}
Tujuan: ${formData.tujuan}
Metode Belajar :  ${formData.metode == "" ? "belum tersedia" : formData.metode}
Dimensi Profil Pancasila : Dimensi Profil Kelulusan: ${formData.dpk}

CP:
${cpText || "Belum tersedia"}

[INSTRUKSI]
Buat modul ajar lengkap.

Tambahan struktur:
- Lampiran berisi: materi, referensi, LKPD, dan rubrik penilaian
- Gunakan tujuan pembelajaran sebagai dasar penyusunan materi
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
            tujuan: formData.tujuan,
            dpk: formData.dpk,
            metode: formData.metode == "" ? "belum tersedia" : formData.metode,
          },
        }),
        signal: abortController.signal,
      });

      const dataAI = await resAI.json();
      updateGenerateButton("Menyusun Output...", "fa-file-lines");

      if (!resAI.ok || !dataAI.success) {
        throw new Error(dataAI.error || "AI error");
      }

      const aiResult = dataAI.result;

      const finalHTML = aiResult;

      const generateResult = document.getElementById("rpp-output");
      /*generateResult.innerHTML = finalHTML; */

      const safeHTML = scopeAIStyles(finalHTML);
      generateResult.innerHTML = safeHTML;

      localStorage.setItem("generatedRPP", safeHTML);

      document.getElementById("result-container").classList.remove("hidden");

      window.scrollTo({
        top: document.getElementById("result-container").offsetTop - 10,
        behavior: "smooth",
      });

      setButtonVisibility(true);
      setPromptCustomizationLocked(false);
    } catch (error) {
      if (error.name === "AbortError") {
        // User cancelled — already cleaned up in cancelGenerate()
        return;
      }
      alert("Gagal generate RPP: " + error.message);
    } finally {
      localStorage.removeItem("isGenerating");
      localStorage.removeItem("generatingLabel");
      btnGenerate.disabled = false;

      btnGenerate.classList.remove("generating");

      btnGenerate.innerHTML =
        '<i class="fas fa-magic"></i> Generate RPP Sekarang';
        document.getElementById("btnCancel").style.display = "none";
    }
  });
});
