(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const normalize = (s) =>
        (s || "")
            .replace(/\u00A0/g, " ")     // non-breaking spaces
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

    const escapeHtml = (s) =>
        String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    // Chakra accordion buttons
    const buttons = Array.from(
        document.querySelectorAll('button[id^="accordion-button-"][aria-controls]')
    );

    if (!buttons.length) {
        console.log("❌ Nie znaleziono przycisków accordionu (chakra).");
        return;
    }

    console.log(`✅ Found ${buttons.length} questions. Scraping…`);

    const out = [];
    const seen = new Set();

    for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];

        const question = normalize(btn.innerText);
        if (!question) continue;

        btn.scrollIntoView({ block: "center" });

        // open
        if (btn.getAttribute("aria-expanded") !== "true") {
            btn.click();
            for (let t = 0; t < 40 && btn.getAttribute("aria-expanded") !== "true"; t++) {
                await sleep(50);
            }
            await sleep(120);
        } else {
            await sleep(80);
        }

        const panelId = btn.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        const answer = normalize(panel?.innerText || panel?.textContent || "");

        // store
        const key = question + "::" + answer;
        if (answer && !seen.has(key)) {
            seen.add(key);
            out.push({ question, answer });
        }

        if ((i + 1) % 20 === 0 || i === buttons.length - 1) {
            console.log(`… ${i + 1}/${buttons.length} clicked, captured ${out.length}`);
        }

        await sleep(60);
    }

    if (!out.length) {
        console.log("❌ Nie udało się pobrać odpowiedzi.");
        return;
    }

    console.log(`✅ Done. Captured ${out.length} Q&A. Building print page…`);

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSeF — Pytania i odpowiedzi (export)</title>
  <style>
    @page { margin: 18mm; }
    body { font-family: Arial, sans-serif; line-height: 1.35; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    .meta { color: #444; font-size: 12px; margin: 0 0 18px; }
    .item { margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid #ddd; break-inside: avoid; }
    .q { font-weight: 700; font-size: 13.5px; margin: 0 0 6px; }
    .a { font-size: 12.5px; margin: 0; white-space: pre-wrap; }
    .a ul, .a ol { margin: 6px 0 6px 18px; }
    .a li { margin: 2px 0; }
  </style>
</head>
<body>
  <h1>Pytania i odpowiedzi KSeF 2.0 — eksport</h1>
  <p class="meta">Liczba pozycji: ${out.length} • Wygenerowano: ${new Date().toLocaleString()}</p>

  ${out
        .map(
            (r, idx) => `
      <div class="item">
        <div class="q">${idx + 1}Q. ${escapeHtml(r.question)}</div>
        <div class="a">${escapeHtml(r.answer)}</div>
      </div>`
        )
        .join("")}
</body>
</html>`;

    // Replace current tab with print-friendly content (no popups)
    document.open();
    document.write(html);
    document.close();

    // Print → Save as PDF
    setTimeout(() => window.print(), 600);
})();