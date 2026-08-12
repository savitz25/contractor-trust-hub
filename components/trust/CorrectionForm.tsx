"use client";

import { useMemo, useState, type FormEvent } from "react";

const DEFAULT_TO =
  process.env.NEXT_PUBLIC_CORRECTIONS_EMAIL || "corrections@contractortrusthub.com";

type Props = {
  /** Prefill from a Trust Report slug when linked with ?slug= */
  defaultSlug?: string;
  defaultLicense?: string;
};

export function CorrectionForm({ defaultSlug = "", defaultLicense = "" }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("homeowner");
  const [license, setLicense] = useState(defaultLicense);
  const [slug, setSlug] = useState(defaultSlug);
  const [issueType, setIssueType] = useState("license_status");
  const [details, setDetails] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(
      `[Correction request] ${license || slug || "Florida contractor"}`
    );
    const body = encodeURIComponent(
      [
        "Correction request — Contractor Trust Hub",
        "",
        `Name: ${name || "(not provided)"}`,
        `Email: ${email || "(not provided)"}`,
        `Role: ${role}`,
        `License id: ${license || "(not provided)"}`,
        `Profile slug / URL: ${slug || "(not provided)"}`,
        `Issue type: ${issueType}`,
        `Official source URL: ${sourceUrl || "(not provided)"}`,
        "",
        "Description of the issue and the correct information:",
        details || "(not provided)",
        "",
        "—",
        "Submitted via contractortrusthub.com/corrections",
      ].join("\n")
    );
    return `mailto:${DEFAULT_TO}?subject=${subject}&body=${body}`;
  }, [name, email, role, license, slug, issueType, details, sourceUrl]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (details.trim().length < 10) return;
    window.location.href = mailtoHref;
    setSubmitted(true);
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 text-base text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--text)]">Request a correction</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        This form opens your email app with a pre-filled message to{" "}
        <span className="text-[var(--text)]">{DEFAULT_TO}</span>. Attach screenshots or links to
        official board pages when you can.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="corr-name" className="text-sm font-medium text-[var(--text)]">
              Your name
            </label>
            <input
              id="corr-name"
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="corr-email" className="text-sm font-medium text-[var(--text)]">
              Your email
            </label>
            <input
              id="corr-email"
              type="email"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="corr-role" className="text-sm font-medium text-[var(--text)]">
            I am a…
          </label>
          <select
            id="corr-role"
            className={fieldClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="homeowner">Homeowner / buyer</option>
            <option value="contractor">Licensed contractor or company</option>
            <option value="agent">Agent / representative</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="corr-license" className="text-sm font-medium text-[var(--text)]">
              License id (if known)
            </label>
            <input
              id="corr-license"
              className={fieldClass}
              placeholder="e.g. CBC015082"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="corr-slug" className="text-sm font-medium text-[var(--text)]">
              Profile path or slug
            </label>
            <input
              id="corr-slug"
              className={fieldClass}
              placeholder="e.g. contractors/… or full URL"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="corr-type" className="text-sm font-medium text-[var(--text)]">
            What seems wrong?
          </label>
          <select
            id="corr-type"
            className={fieldClass}
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
          >
            <option value="license_status">License status or dates</option>
            <option value="identity">Wrong company / wrong person</option>
            <option value="sunbiz_link">Sunbiz entity link</option>
            <option value="discipline">Discipline information</option>
            <option value="location">Address / county / location</option>
            <option value="other">Other data issue</option>
          </select>
        </div>

        <div>
          <label htmlFor="corr-details" className="text-sm font-medium text-[var(--text)]">
            Describe the issue and the correct information
          </label>
          <textarea
            id="corr-details"
            required
            minLength={10}
            rows={5}
            className={fieldClass + " resize-y"}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="What does our page show, and what does the official source show?"
          />
        </div>

        <div>
          <label htmlFor="corr-source" className="text-sm font-medium text-[var(--text)]">
            Link to official source (optional)
          </label>
          <input
            id="corr-source"
            type="url"
            className={fieldClass}
            placeholder="https://…"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="min-h-12 w-full rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] transition hover:brightness-105 sm:w-auto"
        >
          Open email to submit request
        </button>
      </form>

      {submitted && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
        >
          <p className="font-medium">Your mail client should open next.</p>
          <p className="mt-1 text-emerald-100/85">
            If it did not, email us directly at{" "}
            <a href={`mailto:${DEFAULT_TO}`} className="text-[var(--accent)]">
              {DEFAULT_TO}
            </a>{" "}
            with the same details. We review requests against official public sources.
          </p>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        Prefer not to use a form? Email{" "}
        <a href={`mailto:${DEFAULT_TO}`} className="text-[var(--accent)]">
          {DEFAULT_TO}
        </a>{" "}
        with the license id, profile URL, and a link to the official record.
      </p>
    </div>
  );
}
