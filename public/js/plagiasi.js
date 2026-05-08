document.addEventListener("DOMContentLoaded", () => {
  /* plagiasi input */
  const dropZone = document.getElementById("dropZone");
  const pdfInput = document.getElementById("pdfInput");
  
  // klik area → buka file picker
  dropZone.addEventListener("click", () => {
    pdfInput.click();
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();

  const files = e.dataTransfer.files;

  pdfInput.files = files;
  renderFileList(files);

  dropZone.classList.remove("dragover");

  console.log("File dropped:", files);
});


   
  pdfInput.addEventListener("change", () => {
    renderFileList(pdfInput.files);
    console.log("File selected:", pdfInput.files);
  });

  const modeSelect = document.getElementById("inputMode");
  const textContainer = document.getElementById("textContainer");
  const pdfContainer = document.getElementById("pdfContainer");

  // SWITCH MODE
  modeSelect.addEventListener("change", () => {
    if (modeSelect.value === "pdf") {
      pdfContainer.style.display = "block";
      textContainer.style.display = "none";
    } else {
      pdfContainer.style.display = "none";
      textContainer.style.display = "block";
    }
  });

  // ADD TEXT INPUT
  document.getElementById("addText").addEventListener("click", () => {
    const container = document.getElementById("textInputs");

    const textarea = document.createElement("textarea");
    textarea.className = "text-input";
    textarea.rows = 4;
    textarea.placeholder = `Jawaban siswa ${container.children.length + 1}`;

    container.appendChild(textarea);
  });

  // SUBMIT
  document
    .getElementById("plagiasiForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const mode = modeSelect.value;
      const formData = new FormData();

      formData.append("mode", mode);

      if (mode === "pdf") {
        const files = document.getElementById("pdfInput").files;

        if (files.length < 2) {
          alert("Minimal 2 file PDF untuk dibandingkan!");
          return;
        }

        for (let file of files) {
          formData.append("files", file);
        }
      } else {
        const texts = document.querySelectorAll(".text-input");

        const values = Array.from(texts)
          .map((t) => t.value.trim())
          .filter((t) => t.length > 0);

        if (values.length < 2) {
          alert("Minimal 2 jawaban teks!");
          return;
        }

        formData.append("texts", JSON.stringify(values));
      }

      const res = await fetch("/api/plagiasi", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      console.log(data);

      document.getElementById("correction-result").classList.remove("hidden");
     const output = document.getElementById("correction-output");

output.innerHTML = "";

data.comparisons.forEach((item) => {
  const card = document.createElement("div");

  card.className = `plagiarism-card ${item.level.className}`;

  card.innerHTML = `
    <div class="pair-header">
      <div class="pdf-box">
        <i class="fas fa-file-pdf"></i>
        <span>${item.fileA}</span>
      </div>

      <div class="vs">VS</div>

      <div class="pdf-box">
        <i class="fas fa-file-pdf"></i>
        <span>${item.fileB}</span>
      </div>
    </div>

    <div class="similarity-score">
      ${item.similarity}%
    </div>

    <div class="danger-level">
      ${item.level.icon} ${item.level.text}
    </div>
  `;

  output.appendChild(card);
});
    });

  function renderFileList(files) {
    const fileList = document.getElementById("fileList");

    if (!files || files.length === 0) {
      fileList.innerHTML = "<p>Belum ada file</p>";
      return;
    }

    fileList.innerHTML = "";

    Array.from(files).forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "file-item";

      item.innerHTML = `
      <i class="fas fa-file-pdf"></i>
      ${file.name} (${(file.size / 1024).toFixed(1)} KB)
    `;

      fileList.appendChild(item);
    });
  }
});
