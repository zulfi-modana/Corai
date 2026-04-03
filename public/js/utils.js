const utils = {
  defaultPrompts: {
    rppSystem:
      "Anda adalah pakar kurikulum pendidikan di Indonesia. Tugas Anda adalah membuat Modul Ajar / RPP Kurikulum Merdeka yang komprehensif, kreatif, dan sesuai standar Kemendikbudristek. Gunakan bahasa Indonesia yang formal namun mudah dipahami.",
  },

  toggleElement: (id) => {
    const el = document.getElementById(id);
    el.classList.toggle("hidden");
  },

  /* showLoader: (show) => {
        const loader = document.getElementById('loader');
        show ? loader.classList.remove('hidden') : loader.classList.add('hidden');
    }, */

  copyToClipboard: (id) => {
    const text = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text).then(() => {
      alert("Berhasil disalin ke clipboard!");
    });
  },

  notify: (msg) => {
    console.log("Notification:", msg);
  },

  // Fetch using a free third-party proxy/aggregator for DeepSeek
  // Note: Using a public proxy for demonstration. In production, use your own backend.
  fetchAI: async (prompt, systemPrompt) => {
  try {
    console.log("Calling OpenRouter API...");
  await new Promise(resolve => setTimeout(resolve, 5000));
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer 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",
          "HTTP-Referer": window.location.href,
          "X-Title": "AI RPP Generator",
        },
        body: JSON.stringify({
          model: "gpt-oss-120b:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        }),
      }
    );

    const data = await response.json();

    console.log("HTTP Status:", response.status);
    console.log("Full Response:", data);

    if (!response.ok) {
      throw new Error(data?.error?.message || "Provider returned error");
    }

    return data.choices[0].message.content;

  } catch (error) {
    console.error("FetchAI Error:", error);
    throw error;
  }
}

};
