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

  /* dropZone.addEventListener("drop", (e) => {
    e.preventDefault();

    const files = e.dataTransfer.files;

    pdfInput.files = files;
    renderFileList(files);

    dropZone.classList.remove("dragover");

    console.log("File dropped:", files);
  });

  pdfInput.addEventListener("change", () => {
    
      const MAX_FILE_SIZE = 5 * 1024 * 1024;

      for (let file of pdfInput.files) {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} melebihi batas 5MB`);

          pdfInput.value = "";
          return;
        }
      }
    
    renderFileList(pdfInput.files);
  }); */

  // Replace your drop and change handlers + renderFileList with this

  let selectedFiles = []; // track files manually

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf",
    );

    if (dropped.length === 0) {
      alert("Hanya file PDF yang diizinkan.");
      return;
    }

    selectedFiles = dropped; // REPLACE, not append
    renderFileList(selectedFiles);
  });

  pdfInput.addEventListener("change", () => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const incoming = Array.from(pdfInput.files);

    for (let file of incoming) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} melebihi batas 5MB`);
        pdfInput.value = "";
        return;
      }
    }

    selectedFiles = incoming; // REPLACE, not append
    renderFileList(selectedFiles);
  });

  function renderFileList(files) {
    const fileList = document.getElementById("fileList");
    const dragLabel = document.getElementById("pdfDragFile");

    if (!files || files.length === 0) {
      fileList.innerHTML = "";
      dragLabel.textContent = "Drag & Drop file PDF di sini";
      dragLabel.classList.remove("pdfNumberUploaded");
      return;
    }

    dragLabel.textContent = `${files.length} file dipilih`;
    dragLabel.classList.add("pdfNumberUploaded");

    // Rebuild list from scratch so old files are always cleared
    fileList.innerHTML = files
      .map(
        (f) => `
      <div class="file-item">
        <i class="fas fa-file-pdf"></i>
        <span>${f.name}</span>
        <small>(${(f.size / 1024).toFixed(1)} KB)</small>
      </div>`,
      )
      .join("");
  }

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
        /*  const files = document.getElementById("pdfInput").files; */

        if (selectedFiles.length < 2) {
          alert("Minimal 2 file PDF untuk dibandingkan!");
          return;
        }
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        for (let file of selectedFiles) {
          if (file.size > MAX_FILE_SIZE) {
            alert(`File ${file.name} melebihi batas 5MB`);
            return;
          }

            formData.append("files", file);
        }

        /*  for (let file of selectedFiles) {
          formData.append("files", file);
        }

        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

        for (let file of selectedFiles) {
          // cek ukuran file
          if (file.size > MAX_FILE_SIZE) {
            alert(`File ${file.name} melebihi batas 5MB`);
            return;
          }

        
        } */
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

     <div class="btnAnalisis">
          <button class="btn btn-primary btn-analisis">Analisis AI</button>
          </div>
          <br>
  `;

        const analyzeBtn = card.querySelector(".btn-analisis");
        if (item.level.className === "safe") {
          analyzeBtn.disabled = true;
          analyzeBtn.innerHTML = `Analisis Tidak Diperlukan`;
        } else {
          analyzeBtn.addEventListener("click", async () => {
            analyzeBtn.disabled = true;
            analyzeBtn.innerText = "Menganalisis, Mohon Bersabar...";

            try {
              const resAI = await fetch("/api/plagiasi/analyze", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  textA: item.textA,
                  textB: item.textB,
                  similarity: item.similarity,
                }),
              });

              const dataAI = await resAI.json();

              const analysisDiv = document.createElement("div");

              analysisDiv.className = "ai-analysis";

              analysisDiv.innerHTML = `
      <h2>Analisis AI</h2>
      <div>${dataAI.analysis}</div>
    `;

              card.appendChild(analysisDiv);
            } catch (err) {
              console.error("AI Analyze Error:", err);
              alert("Gagal analisis AI");
            } finally {
              analyzeBtn.disabled = false;
              analyzeBtn.innerText = "Analisis AI";
            }
          });
        }

        output.appendChild(card);
      });
    });

  function renderFileList(files) {
    const fileList = document.getElementById("fileList");

    if (!files || files.length === 0) {
      fileList.innerHTML = "";

      document.getElementById("pdfDragFile").textContent =
        "Drag & Drop file PDF di sini";
      return;
    }

    document.getElementById("pdfDragFile").classList.add("pdfNumberUploaded");

    const pdfIconAvail =
      document.getElementsByClassName(".fas.fa-file-pdf").length;
    if (pdfIconAvail >= 1) {
      document
        .querySelector(".fas.fa-file-pdf")
        .classList.remove("fa-file-pdf");
    }

    document.getElementById("pdfDragFile").textContent =
      `${files.length} file dipilih`;
  }
});
