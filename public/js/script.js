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

function getFase(grade) {
  if (grade.includes("10")) return "E";
  if (grade.includes("11") || grade.includes("12")) return "F";
  return "F";
}



function exportToWord() {

  const content = document.getElementById("rpp-output").innerHTML;

  const header = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office'
  xmlns:w='urn:schemas-microsoft-com:office:word'
  xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'></head><body>`;

  const footer = "</body></html>";

  const sourceHTML = header + content + footer;

  const blob = new Blob(['\ufeff', sourceHTML], {
    type: 'application/msword'
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "Modul_Ajar_Kurikulum_Merdeka.doc";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

}

console.log("DOM loaded");

document.addEventListener("DOMContentLoaded", () => {
  // Initialize default prompts
  document.getElementById("systemPrompt").value =
    utils.defaultPrompts.rppSystem;

  // Navigation Logic
  const navLinks = document.querySelectorAll(".nav-links a");
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
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
    btnGenerate.disabled = true;
    btnGenerate.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Generating...';
    console.log("Submit triggered");

    

    const sections = [
  "Identitas",
  "Kompetensi Awal",
  "Profil Pelajar Pancasila",
  "Tujuan Pembelajaran",
  "Pendahuluan",
  "Kegiatan Inti",
  "Penutup",
  "Asesmen"
];


    const formData = {
      school: document.getElementById("schoolName").value,
      level: document.getElementById("taskOption").value,
      subject: document.getElementById("subject").value,
      grade: document.getElementById("gradeLevel").value,
      topic: document.getElementById("topic").value,
    };

    // 🔥 ambil CP dari backend
const fase = getFase(formData.grade);

const res = await fetch(
  `/tujuan?mapel=${formData.subject}&fase=${fase}`
);


const dataCP = await res.json();

let cpText = "";

// kalau hasil array
if (Array.isArray(dataCP)) {
  cpText = dataCP.map(item => item.cp || item).join("\n");
} else {
  cpText = dataCP.cp || "";
}

console.log("CP:", cpText);


    /*  utils.showLoader(true); */

    try {

      let finalHTML = "<h1>MODUL AJAR KURIKULUM MERDEKA</h1>";

for (const section of sections) {

  let detailPrompt = "";

  // Prompt berbeda untuk tiap section (biar lebih rapi)
  if (section === "Identitas") {
    detailPrompt = `
Buatkan bagian Identitas dalam bentuk tabel HTML.

Kolom:
- Nama Sekolah
- Mata Pelajaran
- Kelas
- Materi

Data:
Sekolah: ${formData.school}
Mapel: ${formData.subject}
Kelas: ${formData.grade}
Materi: ${formData.topic}


`;
  } else if (section === "Kegiatan Inti") {
    detailPrompt = `
Buatkan Kegiatan Inti pembelajaran secara rinci dalam bentuk langkah-langkah HTML (gunakan <ol><li>).

Data:
Mapel: ${formData.subject}
Kelas: ${formData.grade}
Materi: ${formData.topic}

Gunakan referensi capaian pembelajaran berikut:
${cpText}
`
;
  } else {
    detailPrompt = `
Buatkan bagian "${section}" untuk RPP Modul Ajar Kurikulum Merdeka.

Gunakan HTML rapi dengan <p> atau <ul> jika perlu.

Data:
Mapel: ${formData.subject}
Kelas: ${formData.grade}
Materi: ${formData.topic}
`;
  }

  const content = await utils.fetchAI(
    detailPrompt,
    document.getElementById("systemPrompt").value
  );

  finalHTML += `
    <h2>${section}</h2>
    ${content}
  `;

  // delay biar aman dari 429
/*   await delay(1200); */
}


/*  const prompt = `
Buatkan Modul Ajar Kurikulum Merdeka.

Formatkan output dalam HTML yang rapi menggunakan struktur berikut:

<h1>MODUL AJAR KURIKULUM MERDEKA</h1>

<h2>Identitas</h2>
<table border="1">
<tr><th>Komponen</th><th>Keterangan</th></tr>
<tr><td>Nama Sekolah</td><td>...</td></tr>
<tr><td>Mata Pelajaran</td><td>...</td></tr>
<tr><td>Kelas</td><td>...</td></tr>
<tr><td>Materi</td><td>...</td></tr>
</table>

<h2>Kompetensi Awal</h2>
<p>...</p>

<h2>Profil Pelajar Pancasila</h2>
<p>...</p>

<h2>Tujuan Pembelajaran</h2>
<p>...</p>

<h2>Kegiatan Pembelajaran</h2>

<h3>Pendahuluan</h3>
<p>...</p>

<h3>Inti</h3>
<p>...</p>

<h3>Penutup</h3>
<p>...</p>

<h2>Asesmen</h2>
<p>...</p>



Data:
Sekolah: ${formData.school}
Mapel: ${formData.subject}
Kelas: ${formData.grade}
Materi: ${formData.topic}
Jenis tugas: ${formData.level}
`;
 */


    /*   const response = await utils.fetchAI(
        
        prompt,
        document.getElementById("systemPrompt").value,
        
      );


      


      let rppData; */

     /*  try {
        // kadang AI mengirim ```json ... ```
        const cleaned = response
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        // ambil hanya JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          throw new Error("JSON tidak ditemukan pada response AI");
        }

        rppData = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.error("JSON parse error:", response);
        throw new Error("AI tidak mengembalikan JSON yang valid");
      }
 */
   
    document.getElementById("rpp-output").innerHTML = finalHTML;


      document.getElementById("result-container").classList.remove("hidden");
      window.scrollTo({
        top: document.getElementById("result-container").offsetTop - 100,
        behavior: "smooth",
      });
    } catch (error) {
      alert("Gagal generate RPP: " + error.message);
    } finally {
      console.log("Finally running");
      btnGenerate.disabled = false;
      btnGenerate.innerHTML =
        '<i class="fas fa-magic"></i> Generate RPP Sekarang';
      /* utils.showLoader(false); */
    }
  });

 
 /*  const dropZone = document.getElementById("dropZone");
  const imageInput = document.getElementById("imageInput");

  dropZone.addEventListener("click", () => imageInput.click());

  imageInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      // In a real app, we would process OCR here.
      // For this prototype, we simulate reading text from image
      document.getElementById("correctionInput").value =
        "[Hasil Scan Gambar]: Menunggu analisis AI untuk soal yang terdeteksi di foto...";
      utils.notify("Gambar berhasil diunggah (Simulasi OCR)");
    }
  });

  document.getElementById("btnCorrect").addEventListener("click", async () => {
    const content = document.getElementById("correctionInput").value;
    if (!content) return alert("Input soal terlebih dahulu");

    utils.showLoader(true);
    try {
      const systemMsg =
        "Anda adalah asisten ahli pendidikan. Koreksi jawaban siswa berikut, berikan penjelasan mana yang salah, apa jawaban yang benar, dan berikan nilai estimasi 0-100.";
      const response = await utils.fetchAI(
        
        `Koreksi teks berikut: ${content}`,
        systemMsg,
      );
      

      document.getElementById("correction-output").innerHTML =
        components.formatMarkdown(response);
      document.getElementById("correction-result").classList.remove("hidden");
    } catch (error) {
      alert("Gagal koreksi: " + error.message);
    } finally {
      utils.showLoader(false);
    }
  }); */
});
