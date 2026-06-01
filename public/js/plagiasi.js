function savePlagiasiResult() {
  const output = document.getElementById("correction-output");
  localStorage.setItem("plagiasiResult", JSON.stringify({ resultHTML: output.innerHTML }));
}

function loadPlagiasiResult() {
  const saved = localStorage.getItem("plagiasiResult");
  return saved ? JSON.parse(saved) : null;
}

function clearPlagiasiResult() {
  localStorage.removeItem("plagiasiResult");
}

function attachCardEvents(card) {
  // =========================
  // Highlight Toggle
  // =========================
  const highlightBtn = card.querySelector(".btn-highlight");
  const highlightView = card.querySelector(".highlight-view");

  if (highlightBtn && highlightView) {
    highlightBtn.onclick = () => {
      const isOpen = highlightView.style.display !== "none";
      highlightView.style.display = isOpen ? "none" : "block";
      highlightBtn.textContent = isOpen ? "Lihat Highlight" : "Tutup Highlight";
    };
  }

  // =========================
  // Delete Card
  // =========================
  const deleteBtn = card.querySelector(".btn-delete-card");

  if (deleteBtn) {
    deleteBtn.onclick = () => {
      Swal.fire({
        title: "Hapus hasil?",
        text: "Card plagiasi akan dihapus",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Hapus",
        confirmButtonColor: "#f70a0a",
      }).then((result) => {
        if (result.isConfirmed) {
          card.remove();
          const output = document.getElementById("correction-output");
          if (output.querySelectorAll(".plagiarism-card").length === 0) {
            clearPlagiasiResult();
            document.getElementById("correction-result").classList.add("hidden");
          } else {
            savePlagiasiResult();
          }
          Swal.fire("Berhasil", "Card berhasil dihapus", "success");
        }
      });
    };
  }

  // =========================
  // AI Analyze
  // =========================
  const analyzeBtn = card.querySelector(".btn-analisis");

  if (analyzeBtn) {
    if (analyzeBtn.dataset.disabled === "true") {
      analyzeBtn.disabled = true;
    }

    analyzeBtn.onclick = async () => {
      if (analyzeBtn.disabled && analyzeBtn.innerText.includes("Menganalisis")) return;

      const existing = card.querySelector(".ai-analysis");
      if (existing) {
        existing.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      analyzeBtn.disabled = true;
      analyzeBtn.innerText = "Menganalisis, Mohon Bersabar...";

      let cancelled = false;
      const controller = new AbortController();

      Swal.fire({
        title: "🤖 Analisis AI",
        text: "Sedang menganalisis kemiripan teks...",
        icon: "info",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: '<i class="fas fa-times"></i> Batalkan',
        cancelButtonColor: "#d33",
        didOpen: () => Swal.showLoading(),
      }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
          cancelled = true;
          controller.abort();
          analyzeBtn.disabled = false;
          analyzeBtn.innerText = "Analisis AI";
        }
      });

      try {
        const resAI = await fetch("/api/plagiasi/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textA: decodeURIComponent(analyzeBtn.dataset.texta),
            textB: decodeURIComponent(analyzeBtn.dataset.textb),
            similarity: analyzeBtn.dataset.similarity,
          }),
          signal: controller.signal,
        });

        if (cancelled) return;

        const dataAI = await resAI.json();

        Swal.close();

        const analysisDiv = document.createElement("div");
        analysisDiv.className = "ai-analysis";
        analysisDiv.innerHTML = `<h2>Analisis AI</h2><div>${dataAI.analysis}</div>`;
        card.appendChild(analysisDiv);

        analyzeBtn.innerText = "Analisis Selesai";
        savePlagiasiResult();

        await Swal.fire({
          title: "🤖 Analisis AI Selesai!",
          text: "Hasil analisis telah ditampilkan di bawah.",
          icon: "success",
          timer: 7500,
          timerProgressBar: true,
          showConfirmButton: true,
          confirmButtonColor: "#28a745",
        });

      } catch (err) {
        if (err.name === "AbortError") return;
        Swal.fire("Error", "Gagal analisis AI.", "error");
        analyzeBtn.disabled = false;
        analyzeBtn.innerText = "Analisis AI";
      }
    };
  }
}

function restoreCardEvents() {
  document.querySelectorAll(".plagiarism-card").forEach((card) => {
    attachCardEvents(card);
  });
}

function deletePlagiasiResult() {
  Swal.fire({
    title: "Hapus semua hasil?",
    text: "Semua hasil plagiasi akan dihapus",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    confirmButtonColor: "#ff0000",
  }).then((result) => {
    if (result.isConfirmed) {
      clearPlagiasiResult();
      document.getElementById("correction-output").innerHTML = "";
      document.getElementById("correction-result").classList.add("hidden");
      Swal.fire("Berhasil", "Semua hasil dihapus", "success");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  const pdfInput = document.getElementById("pdfInput");
  const saved = loadPlagiasiResult();

  // =========================
  // Restore Saved Result
  // =========================
  if (saved) {
    const restoreSavedResult = () => {
      document.getElementById("correction-result").classList.remove("hidden");
      document.getElementById("correction-output").innerHTML = saved.resultHTML;
      restoreCardEvents();
    };
    if ("requestIdleCallback" in window) {
      requestIdleCallback(restoreSavedResult);
    } else {
      setTimeout(restoreSavedResult, 0);
    }
  }

  // =========================
  // Dropzone
  // =========================
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

  let selectedFiles = [];

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf",
    );

    if (dropped.length === 0) {
      Swal.fire({ title: "Format Salah", text: "Hanya file PDF yang diizinkan.", icon: "error" });
      return;
    }

    if (dropped.length > 15) {
      Swal.fire({ title: "Terlalu Banyak File", text: "Maksimal 15 file PDF yang diizinkan.", icon: "error" });
      return;
    }

    selectedFiles = dropped;
    renderFileList(selectedFiles);
  });

  pdfInput.addEventListener("change", () => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const incoming = Array.from(pdfInput.files);

    if (incoming.length > 15) {
      Swal.fire({ title: "Terlalu Banyak File", text: "Maksimal 15 file PDF yang diizinkan.", icon: "error" });
      pdfInput.value = "";
      return;
    }

    for (let file of incoming) {
      if (file.size > MAX_FILE_SIZE) {
        Swal.fire({ title: "File Terlalu Besar", text: `File "${file.name}" melebihi batas 5MB.`, icon: "error" });
        pdfInput.value = "";
        return;
      }
    }

    selectedFiles = incoming;
    renderFileList(selectedFiles);
  });

  function renderFileList(files) {
    const fileList = document.getElementById("fileList");
    const dragLabel = document.getElementById("pdfDragFile");
    const pdfIcon = document.getElementById("pdfIcon");

    if (!files || files.length === 0) {
      fileList.innerHTML = "";
      dragLabel.textContent = "Klik atau seret file PDF ke sini";
      dragLabel.classList.remove("pdfNumberUploaded");
      pdfIcon.classList.add("fa-file-pdf");
      return;
    }

    dragLabel.textContent = `${files.length} file dipilih`;
    dragLabel.classList.add("pdfNumberUploaded");
    pdfIcon.classList.remove("fa-file-pdf");

    fileList.innerHTML = `
      <div style="width:100%; border-top:1px dashed var(--border-strong); margin:8px 0;"></div>
      ${files.map((f) => `
        <div class="file-item" style="background-color:var(--accent)">
          <i class="fas fa-file-pdf"></i>
          <span style="color:white">${f.name}</span>
          <small style="color:white">(${(f.size / 1024).toFixed(1)} KB)</small>
        </div>
      `).join("")}
    `;
  }

  // =========================
  // Mode Switch
  // =========================
  const modeSelect = document.getElementById("inputMode");
  const textContainer = document.getElementById("textContainer");
  const pdfContainer = document.getElementById("pdfContainer");

  modeSelect.addEventListener("change", () => {
    if (modeSelect.value === "pdf") {
      pdfContainer.style.display = "block";
      textContainer.style.display = "none";
    } else {
      pdfContainer.style.display = "none";
      textContainer.style.display = "block";
    }
  });

  // =========================
  // Add Text Input
  // =========================
  document.getElementById("addText").addEventListener("click", () => {
    const container = document.getElementById("textInputs");
    const textarea = document.createElement("textarea");
    textarea.className = "text-input";
    textarea.rows = 4;
    textarea.placeholder = `Jawaban siswa ${container.children.length + 1}`;
    container.appendChild(textarea);
  });

  // =========================
  // Submit
  // =========================
  document.getElementById("plagiasiForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const mode = modeSelect.value;
    const formData = new FormData();
    formData.append("mode", mode);

    // PDF MODE
    if (mode === "pdf") {
      if (selectedFiles.length < 2) {
        Swal.fire({ title: "Kurang File", text: "Minimal 2 file PDF untuk dibandingkan!", icon: "warning" ,confirmButtonColor: "#28a745",},
          
        );
        return;
      }
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      for (let file of selectedFiles) {
        if (file.size > MAX_FILE_SIZE) {
          Swal.fire({ title: "File Terlalu Besar", text: `File "${file.name}" melebihi batas 5MB.`, icon: "error" });
          return;
        }
        formData.append("files", file);
      }
    }
    // TEXT MODE
    else {
      const texts = document.querySelectorAll(".text-input");
      const values = Array.from(texts).map((t) => t.value.trim()).filter((t) => t.length > 0);
      if (values.length < 2) {
        Swal.fire({ title: "Kurang Teks", text: "Minimal 2 jawaban teks!", icon: "warning" });
        return;
      }
      formData.append("texts", JSON.stringify(values));
    }

    // =========================
    // Processing Swal
    // =========================
    let cancelled = false;
    const controller = new AbortController();

    Swal.fire({
      title: "⏳ Menganalisis Plagiasi",
      text: "Sedang memproses, mohon tunggu...",
      icon: "info",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: '<i class="fas fa-times"></i> Batalkan',
      cancelButtonColor: "#d33",
      didOpen: () => Swal.showLoading(),
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        cancelled = true;
        controller.abort();
      }
    });

    // =========================
    // Fetch
    // =========================
    try {
      const res = await fetch("/api/plagiasi", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (cancelled) return;

      const data = await res.json();

      Swal.close();

      document.getElementById("correction-result").classList.remove("hidden");

      const output = document.getElementById("correction-output");
      output.innerHTML = "";

      data.comparisons.forEach((item) => {
        const card = document.createElement("div");
        card.className = `plagiarism-card ${item.level.className}`;
        card.innerHTML = `
          <div class="pair-header">
            <div class="pdf-box"><i class="fas fa-file-pdf"></i><span>${item.fileA}</span></div>
            <div class="vs">VS</div>
            <div class="pdf-box"><i class="fas fa-file-pdf"></i><span>${item.fileB}</span></div>
          </div>
          <div class="similarity-score">${item.similarity}%</div>
          <div class="danger-level">${item.level.icon} ${item.level.text}</div>
          <div class="btnAnalisis" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-outline-secondary btn-highlight">Lihat Highlight</button>
            <button
              class="btn btn-primary btn-analisis"
              data-texta="${encodeURIComponent(item.textA)}"
              data-textb="${encodeURIComponent(item.textB)}"
              data-similarity="${item.similarity}"
              ${item.level.className === "safe" ? 'disabled data-disabled="true"' : ""}
            >
              ${item.level.className === "safe" ? "Analisis Tidak Diperlukan" : "Analisis AI"}
            </button>
            <button class="btn btn-danger btn-delete-card">Hapus</button>
          </div>
          <br>
          <div class="highlight-view" style="display:none; margin-top:16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div>
                <div style="font-size:11px; font-weight:600; margin-bottom:8px;">${item.fileA}</div>
                <div class="highlight-box" style="font-size:13px; line-height:1.9; padding:14px 16px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); max-height:280px; overflow-y:auto;">
                  ${item.highlightedA}
                </div>
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; margin-bottom:8px;">${item.fileB}</div>
                <div class="highlight-box" style="font-size:13px; line-height:1.9; padding:14px 16px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); max-height:280px; overflow-y:auto;">
                  ${item.highlightedB}
                </div>
              </div>
            </div>
          </div>
        `;
        output.appendChild(card);
        attachCardEvents(card);
      });

      savePlagiasiResult();

      await Swal.fire({
        title: "✅ Analisis Selesai!",
        text: `Ditemukan ${data.comparisons.length} perbandingan dokumen.`,
        icon: "success",
        timer: 7500,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonColor: "#28a745",
      });

    } catch (err) {
      if (err.name === "AbortError") {
        Swal.fire("Dibatalkan", "Analisis plagiasi dibatalkan.", "info");
        return;
      }
      Swal.fire("Error", "Terjadi kesalahan saat analisis.", "error");
    }
  });
});