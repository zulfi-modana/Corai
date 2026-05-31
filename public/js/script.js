/* let generatedRPP = null; */

let abortController = null;
let isGenerating = false;
let btnGenerate;

function alertSwal() {
  Swal.fire({
    title: "Sukses Menghapus",
    theme: "auto",
    text: "Data Berhasil dihapus!",
    icon: "success",
  });
}

function closeProcessingSwal() {
  Swal.close();
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
  localStorage.removeItem("generateStage");
  localStorage.removeItem("cpText");

  btnGenerate.disabled = false;

  btnGenerate.innerHTML =
    '<i class="fas fa-magic"></i> Generate RPP Sekarang';

 
  closeProcessingSwal();
}

function clearGeneratedRPP() {
  localStorage.removeItem("generatedRPP");

  document.getElementById("rpp-output").innerHTML = "";

  document.getElementById("result-container").classList.add("hidden");

  alertSwal();

  document.getElementById("deleteModal").style.display = "none";

  setButtonVisibility(false);

  setPromptCustomizationLocked(true);
}

function showProcessingSwal(message = "Sedang memproses...") {
  Swal.fire({
    title: "⏳ Sedang Generate",
    text: message,
    icon: "info",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: '<i class="fas fa-times"></i> Batalkan',
    cancelButtonColor: "#d33",
    didOpen: () => {
      Swal.showLoading();
    },
  }).then((result) => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      cancelGenerate();
    }
  });
}

function updateSwalText(message) {
  const swalText = document.querySelector(".swal2-html-container, .swal2-content");
  if (swalText) swalText.textContent = message;
}

function updateGenerateButton(text, icon = "fa-spinner") {
  btnGenerate.disabled = true;

  btnGenerate.innerHTML = `<i class="fas ${icon} fa-spin"></i> ${text}`;

 

  localStorage.setItem(
    "generatingLabel",
    JSON.stringify({ text, icon }),
  );
    if (!Swal.isVisible()) {
    showProcessingSwal(text);
  } else {
    updateSwalText(text);
  }
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

    config.classList.add("hidden");

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

async function generateAI(
  formData,
  cpText,
  formatPrompt,
  userInstruction,
) {
  updateGenerateButton("Generate Modul...", "fa-brain");

  localStorage.setItem("generateStage", "generating_ai");

  abortController = new AbortController();

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
Metode Belajar :  ${
      formData.metode == "" ? "belum tersedia" : formData.metode
    }
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
          metode:
            formData.metode == "" ? "belum tersedia" : formData.metode,
        },
      }),

      signal: abortController.signal,
    });

    const dataAI = await resAI.json();

 updateSwalText("Menyusun output, mohon tunggu...");
    if (!resAI.ok || !dataAI.success) {
      throw new Error(dataAI.error || "AI error");
    }

    const aiResult = dataAI.result;

    const finalHTML = aiResult;

    const generateResult = document.getElementById("rpp-output");

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
       await Swal.fire({
      title: "✅ Berhasil!",
      text: "Modul ajar berhasil digenerate!",
      icon: "success",
      timer: 2500,
      timerProgressBar: true,
      showConfirmButton: true,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

     Swal.fire("Gagal Generate", error.message, "error");
  } finally {
       
    closeProcessingSwal();
    localStorage.removeItem("isGenerating");
    localStorage.removeItem("generatingLabel");
    localStorage.removeItem("generateStage");
    localStorage.removeItem("cpText");

    btnGenerate.disabled = false;

    btnGenerate.classList.remove("generating");

    btnGenerate.innerHTML =
      '<i class="fas fa-magic"></i> Generate RPP Sekarang';

 
  }
}

console.log("DOM loaded");

document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("restoring");
  btnGenerate = document.getElementById("btnGenerate");

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

  const savedGeneratingState =
    localStorage.getItem("isGenerating");

  if (savedGeneratingState) {
    const btn = document.getElementById("btnGenerate");

    btn.disabled = true;

  

    btn.innerHTML =
      '<i class="fas fa-brain fa-spin"></i> Generate Modul...';

    const savedLabel = localStorage.getItem("generatingLabel");

    if (savedLabel) {
      const { text, icon } = JSON.parse(savedLabel);

      btn.innerHTML =
        `<i class="fas ${icon} fa-spin"></i> ${text}`;
    } else {
      btn.innerHTML =
        `<i class="fas fa-spinner fa-spin"></i> Memproses...`;
    }

    showToast(
      "Masih dalam proses generate, harap tunggu...",
      4000,
    );
  }

  const savedForm = localStorage.getItem("formValue");

  if (savedForm) {
    const formData = JSON.parse(savedForm);

    document.getElementById("schoolName").value =
      formData.school;

    document.getElementById("subject").value =
      formData.subject;

    document.getElementById("topic").value =
      formData.topic;

    document.getElementById("customCP").value =
      formData.cpText || "";

    document.getElementById("jurusan").value =
      formData.jurusan;

    document.getElementById("gradeLevel").value =
      formData.grade;

    const tujuanInputs =
      document.querySelectorAll("#tujuan-list input");

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

    document
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = selectedDPK.includes(cb.value);
      });

    document.getElementById("metode").value =
      formData.metode;

    document.getElementById("judul").value =
      formData.judul;
  }

  const formatPrompt = utils.defaultPrompts.rppSystem;

  const generateStage =
    localStorage.getItem("generateStage");

  if (generateStage === "fetching_cp") {
    const savedFormData = JSON.parse(
      localStorage.getItem("formValue"),
    );

    if (!savedFormData) {
      localStorage.removeItem("isGenerating");

      localStorage.removeItem("generateStage");

      return;
    }

    showToast(
      "Melanjutkan pencarian CP...",
      3000,
    );

    (async () => {
      try {
        updateGenerateButton(
          "Mencari CP...",
          "fa-search",
        );

        abortController = new AbortController();

        const fase = getFase(savedFormData.grade);

        let cpText = "";

        let cpAvailable = false;

        const res = await fetch(
          `/capaian?jurusan=${encodeURIComponent(savedFormData.jurusan)}&mapel=${encodeURIComponent(savedFormData.subject)}&fase=${encodeURIComponent(fase)}`,
          {
            signal: abortController.signal,
          },
        );

        if (!res.ok) {
          throw new Error(
            `HTTP error! status: ${res.status}`,
          );
        }

        const resJson = await res.json();

        const success = resJson.success;

        const data = resJson.data.data;

        const meta = resJson.data.meta;

        if (!success) {
          throw new Error("Gagal ambil CP");
        }

        cpAvailable = meta?.cpAvailable ?? false;

        if (cpAvailable && data && data.length > 0) {
          cpText = data
            .map(
              (item) =>
                `${item.title}: ${item.content}`,
            )
            .join("\n");
        }

        const customCPInput =
          document.querySelector("#customCP");

        if (!cpAvailable) {
          if (
            customCPInput.value.trim() === ""
          ) {
            showToast(
              "CP tidak ditemukan, silahkan isi CP secara manual",
              3000,
            );

            btnGenerate.disabled = false;

            btnGenerate.innerHTML =
              '<i class="fas fa-magic"></i> Generate RPP Sekarang';

            

              // reset generating state
  localStorage.removeItem("isGenerating");
  localStorage.removeItem("generateStage");
  localStorage.removeItem("generatingLabel");
  localStorage.removeItem("cpText");

            customCPInput.focus();

            return;
          }

          cpText =
            customCPInput.value.trim();
        }

        savedFormData.cpText = cpText;

        localStorage.setItem(
          "formValue",
          JSON.stringify(savedFormData),
        );

        localStorage.setItem(
          "cpText",
          cpText,
        );

        localStorage.setItem(
          "generateStage",
          "generating_ai",
        );

        const userInstruction =
          document.getElementById(
            "userInstruction",
          )?.value.trim() || "";

        await generateAI(
          savedFormData,
          cpText,
          formatPrompt,
          userInstruction,
        );
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        console.error(
          "Resume fetching CP gagal:",
          error,
        );

        showToast(
          "Gagal melanjutkan generate",
          3000,
        );

        localStorage.removeItem(
          "isGenerating",
        );

        localStorage.removeItem(
          "generateStage",
        );

        localStorage.removeItem("cpText");

        btnGenerate.disabled = false;

        btnGenerate.innerHTML =
          '<i class="fas fa-magic"></i> Generate RPP Sekarang';

       
      }
    })();
  }

  if (generateStage === "generating_ai") {
    const savedFormData = JSON.parse(
      localStorage.getItem("formValue"),
    );

    const savedCPText =
      localStorage.getItem("cpText");

    const userInstruction =
      document.getElementById("userInstruction")?.value.trim() ||
      "";

    generateAI(
      savedFormData,
      savedCPText,
      formatPrompt,
      userInstruction,
    );
  }

  // Navigation Logic
  const navLinks = document.querySelectorAll(".nav-links a");

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      navLinks.forEach((l) =>
        l.classList.remove("active"),
      );

      link.classList.add("active");

      const targetId =
        link.getAttribute("data-target");

      document
        .querySelectorAll(".app-section")
        .forEach((section) => {
          section.classList.remove("active");
        });

      document
        .getElementById(targetId)
        .classList.add("active");
    });
  });

  // RPP Generator Logic
  const rppForm = document.getElementById("rpp-form");

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

    function validateTujuanCount() {
      const tujuanInputs = [
        ...document.querySelectorAll("#tujuan-list input"),
      ];

      const filled = tujuanInputs.filter(
        (input) => input.value.trim() !== "",
      );

      if (filled.length < 3) {
        showToast("Isi minimal 3 tujuan", 3000);

        tujuanInputs[0].focus();

        return false;
      }

      return true;
    }

    const checked =
      document.querySelectorAll(
        'input[type="checkbox"]:checked',
      );

    if (checked.length < 2) {
      showToast(
        "Pilih minimal 2 Dimensi Profil Kelulusan",
        3000,
      );

      focus();

      return;
    }

    if (!validateTujuanCount()) {
      return;
    }

    const userInstruction =
      document.getElementById("userInstruction")?.value.trim() ||
      "";

    btnGenerate.disabled = true;

    const formData = {
      school:
        document.getElementById("schoolName").value,

      level:
        document.getElementById("taskOption").value,

      jurusan:
        document.getElementById("jurusan").value,

      subject:
        document.getElementById("subject").value,

      grade:
        document.getElementById("gradeLevel").value,

      topic:
        document.getElementById("topic").value,

      tujuan: [
        ...document.querySelectorAll("#tujuan-list input"),
      ]
        .map((el, i) => `${i + 1}. ${el.value}`)
        .filter(
          (v) =>
            v.trim() !== `${v.split(".")[0]}.`,
        )
        .join("\n"),

      metode:
        document.getElementById("metode").value,

      dpk: [
        ...document.querySelectorAll(
          'input[type="checkbox"]:checked',
        ),
      ]
        .map((cb) => cb.value)
        .join(", "),

      judul:
        document.getElementById("judul").value,
    };

    localStorage.setItem(
      "formValue",
      JSON.stringify(formData),
    );

    const fase = getFase(formData.grade);

    let cpText = "";

    let cpAvailable = false;

    localStorage.setItem("isGenerating", "true");

    localStorage.setItem(
      "generateStage",
      "fetching_cp",
    );

    abortController = new AbortController();

    updateGenerateButton(
      "Mencari CP...",
      "fa-search",
    );

    try {
      const res = await fetch(
        `/capaian?jurusan=${encodeURIComponent(document.getElementById("jurusan").value)}&mapel=${encodeURIComponent(formData.subject)}&fase=${encodeURIComponent(fase)}`,
        {
          signal: abortController.signal,
        },
      );

      if (!res.ok) {
        throw new Error(
          `HTTP error! status: ${res.status}`,
        );
      }

      const resJson = await res.json();

      const success = resJson.success;

      const data = resJson.data.data;

      const meta = resJson.data.meta;

      if (!success) {
        throw new Error("Gagal ambil CP");
      }

      cpAvailable = meta?.cpAvailable ?? false;

      if (cpAvailable && data && data.length > 0) {
        cpText = data
          .map(
            (item) =>
              `${item.title}: ${item.content}`,
          )
          .join("\n");
      }

      console.log("CP:", cpText);

      console.log(
        "CP Available:",
        cpAvailable,
      );
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error(
        "Terjadi error saat ambil cp:",
        error.message,
      );
    }

    const customCPInput =
      document.querySelector("#customCP");

    if (!cpAvailable) {
      const cpLabel =
        document.querySelector(".cpLabel");

      if (customCPInput.value.trim() === "") {
        showToast(
          "CP tidak ditemukan, silahkan isi CP secara manual",
          3000,
        );

        btnGenerate.disabled = false;

        btnGenerate.innerHTML =
          '<i class="fas fa-magic"></i> Generate RPP Sekarang';

        customCPInput.focus();

  

        // reset generating state
  localStorage.removeItem("isGenerating");
  localStorage.removeItem("generateStage");
  localStorage.removeItem("generatingLabel");
  localStorage.removeItem("cpText");

        return;
      }

      cpText = customCPInput.value.trim();
    }

    formData.cpText = cpText;

    localStorage.setItem(
      "formValue",
      JSON.stringify(formData),
    );

    localStorage.setItem("cpText", cpText);

    await generateAI(
      formData,
      cpText,
      formatPrompt,
      userInstruction,
    );

  });
     requestAnimationFrame(() => {
    document.body.classList.remove("restoring");
  });
});