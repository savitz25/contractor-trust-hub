/** Open a print-friendly window for scope / comparison summaries (PDF via browser print). */

export function printHtmlDocument(title: string, bodyHtml: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!w) {
    alert("Pop-up blocked — allow pop-ups to download / print the summary.");
    return;
  }
  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 40px; line-height: 1.45; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #0b1f33; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin: 24px 0 8px; }
    .brand { font-size: 12px; color: #b45309; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .meta { font-size: 13px; color: #475569; margin-bottom: 20px; }
    ul { margin: 0; padding-left: 1.2rem; }
    li { margin: 4px 0; font-size: 14px; }
    .note { font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 28px; padding-top: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <div class="brand">Contractor Trust Hub</div>
  ${bodyHtml}
  <p class="note">Educational worksheet only — not legal advice, not a contract, and not an endorsement of any contractor. Conceptual ranges are not appraisals. Verify licenses and written terms before hiring.</p>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`);
  w.document.close();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}
