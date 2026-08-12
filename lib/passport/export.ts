import type { HomePassport } from "./types";
import type { Project } from "@/lib/projects/types";
import type { ContractAnalysis } from "@/lib/projects/types";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printHtmlDocument(title: string, bodyHtml: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!w) {
    alert("Pop-up blocked — allow pop-ups to print/export.");
    return;
  }
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Georgia,serif;color:#0f172a;margin:40px;line-height:1.45}
    h1{font-size:22px;margin:0 0 6px;color:#0b1f33}
    h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin:22px 0 8px}
    .brand{font-size:11px;color:#b45309;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    .meta{font-size:13px;color:#475569;margin-bottom:18px}
    ul{margin:0;padding-left:1.2rem} li{margin:4px 0;font-size:14px}
    .note{font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;margin-top:28px;padding-top:12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f8fafc}
  </style></head><body>
  <div class="brand">Contractor Trust Hub</div>
  ${bodyHtml}
  <p class="note">Educational homeowner record only — not a government property record, title report, insurance policy, or legal certificate. Official sources and original documents control. Not legal advice.</p>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export function projectPacketHtml(
  project: Project,
  analysis?: ContractAnalysis | null
): string {
  const ms = project.milestones
    .map((m) => `<li>${m.done ? "☑" : "☐"} ${escapeHtml(m.label)}</li>`)
    .join("");
  const pays = project.payments
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.milestoneLabel)}</td><td>${p.amount != null ? p.amount : "—"}</td><td>${p.hasInvoice ? "Y" : "N"} / ${p.hasLienWaiver ? "Y" : "N"}</td></tr>`
    )
    .join("");
  const docs = project.documents.map((d) => `<li>${escapeHtml(d.kind)}: ${escapeHtml(d.label)}</li>`).join("");
  const findings = analysis
    ? analysis.findings
        .filter((f) => f.status !== "present")
        .map(
          (f) =>
            `<li><strong>${escapeHtml(f.label)}</strong> (${f.status}): ${escapeHtml(f.detail)}</li>`
        )
        .join("")
    : "<li>No linked contract analysis</li>";

  return `
    <h1>Project packet — ${escapeHtml(project.title)}</h1>
    <p class="meta">Status: ${escapeHtml(project.status)} · Type: ${escapeHtml(project.projectType)} · Generated ${escapeHtml(new Date().toLocaleString())}<br/>
    ${project.address ? escapeHtml(project.address) : ""} ${project.contractorName ? `· Contractor: ${escapeHtml(project.contractorName)}` : ""}</p>
    <h2>Milestones</h2><ul>${ms || "<li>None</li>"}</ul>
    <h2>Payments (summary)</h2>
    <table><thead><tr><th>Date</th><th>Label</th><th>Amount</th><th>Invoice/Waiver</th></tr></thead>
    <tbody>${pays || "<tr><td colspan=4>None logged</td></tr>"}</tbody></table>
    <h2>Documents logged</h2><ul>${docs || "<li>None</li>"}</ul>
    <h2>Contract findings (missing/unclear)</h2><ul>${findings}</ul>
  `;
}

export function passportSummaryHtml(passport: HomePassport): string {
  const imp = passport.improvements
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.completedAt.slice(0, 10))}</td><td>${escapeHtml(i.title)}</td><td>${escapeHtml(i.contractorName || "—")}</td><td>${i.amount != null ? i.amount : "—"}</td></tr>`
    )
    .join("");
  const war = passport.warranties
    .map(
      (w) =>
        `<li>${escapeHtml(w.title)}${w.expiresAt ? ` — expires ${escapeHtml(w.expiresAt.slice(0, 10))}` : ""}</li>`
    )
    .join("");
  const docs = passport.documents
    .map((d) => `<li>${escapeHtml(d.kind)}: ${escapeHtml(d.label)}</li>`)
    .join("");

  return `
    <h1>Home Passport — ${escapeHtml(passport.addressLabel)}</h1>
    <p class="meta">${[passport.city, passport.county, passport.zip].filter((x): x is string => Boolean(x)).map(escapeHtml).join(" · ")} · Generated ${escapeHtml(new Date().toLocaleString())}</p>
    <h2>Improvement timeline</h2>
    <table><thead><tr><th>Date</th><th>Project</th><th>Contractor</th><th>Amount</th></tr></thead>
    <tbody>${imp || "<tr><td colspan=4>No completed projects yet</td></tr>"}</tbody></table>
    <h2>Warranties</h2><ul>${war || "<li>None</li>"}</ul>
    <h2>Documents vault</h2><ul>${docs || "<li>None</li>"}</ul>
    <h2>Contractors on this property</h2>
    <ul>${passport.contractorSlugs.map((s) => `<li>${escapeHtml(s)}</li>`).join("") || "<li>None</li>"}</ul>
  `;
}
