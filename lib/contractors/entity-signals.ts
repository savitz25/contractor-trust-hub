/**
 * Related-entity / pattern observations from public extracts ("phoenix detector" facts).
 * Factual only — no accusations of fraud or intent.
 */

import { formatDate } from "./format";
import type { ContractorDetail } from "./types";

export type EntitySignalConfidence = "low" | "medium" | "high";

export type EntitySignal = {
  id: string;
  title: string;
  detail: string;
  /** Evidence lines shown under the signal */
  evidence: string[];
  confidence: EntitySignalConfidence;
  questions: string[];
};

function normalizePerson(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .replace(/[.,'"/\\-]/g, " ")
    .replace(/\b(JR|SR|II|III|IV|MR|MRS|MS|DR)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYear(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

/**
 * Rule-based observations from licenses + linked entities already on the profile.
 * Cross-contractor principal graph is not available without additional queries —
 * we surface multi-entity, multi-officer, and age-gap facts on this record only.
 */
export function buildRelatedEntitySignals(
  contractor: ContractorDetail
): EntitySignal[] {
  const signals: EntitySignal[] = [];
  const entities = contractor.entities;
  const lic = contractor.licenses[0];

  if (entities.length >= 2) {
    signals.push({
      id: "multi_entity",
      title: "Multiple business entities linked on this profile",
      detail:
        "More than one Sunbiz entity is associated with this contractor profile in our extracts. Confirm which legal entity will appear on your contract and certificates of insurance.",
      evidence: entities.map(
        (e) =>
          `${e.legalName} (Doc ${e.externalKey}${e.status ? ` · ${e.status}` : ""}${e.formationDate ? ` · formed ${formatDate(e.formationDate)}` : ""})`
      ),
      confidence: "high",
      questions: [
        "Which legal entity will be the contracting party on my project?",
        "Does the COI and license name match that same entity?",
      ],
    });
  }

  // Officer name repetition across entities (or within one entity with many officers of same name)
  const officerNames: string[] = [];
  for (const ent of entities) {
    for (const o of ent.officers || []) {
      const n = normalizePerson(o.name);
      if (n.length >= 5) officerNames.push(n);
    }
  }
  const uniqueOfficers = [...new Set(officerNames)];
  if (entities.length >= 2 && uniqueOfficers.length > 0) {
    const shared: string[] = [];
    for (const name of uniqueOfficers) {
      let hits = 0;
      for (const ent of entities) {
        if ((ent.officers || []).some((o) => normalizePerson(o.name) === name)) {
          hits++;
        }
      }
      if (hits >= 2) shared.push(name);
    }
    if (shared.length > 0) {
      signals.push({
        id: "shared_principal",
        title: "These entities share a principal name in current extracts",
        detail:
          "Officer/manager names appear on more than one linked entity. This is a factual relationship signal, not a determination of wrongdoing.",
        evidence: shared.slice(0, 5).map((n) => `Shared principal name: ${n}`),
        confidence: "medium",
        questions: [
          "Can you explain how these entities relate to the work on my project?",
          "Which entity’s officers will be responsible for warranty callbacks?",
        ],
      });
    }
  }

  // Entity formation substantially newer than license identity
  if (lic && entities[0]) {
    const licYear = parseYear(lic.originalLicensureDate);
    const formYear = parseYear(entities[0].formationDate);
    if (licYear != null && formYear != null && formYear - licYear >= 8) {
      signals.push({
        id: "new_entity_old_license",
        title: "Entity formation date is substantially newer than license identity on file",
        detail:
          "The linked business entity was formed many years after the original licensure date on the board extract. That can be ordinary (reorganization, LLC conversion) — worth confirming who you are contracting with.",
        evidence: [
          `Original licensure (extract): ${formatDate(lic.originalLicensureDate)}`,
          `Entity formation (Sunbiz extract): ${formatDate(entities[0].formationDate)} · ${entities[0].legalName}`,
        ],
        confidence: "medium",
        questions: [
          "Was this entity formed as a conversion or rebrand of an older company?",
          "Does the license qualifier still match the entity named on my contract?",
        ],
      });
    }
  }

  // Inactive/dissolved entity while license active (also in discrepancies — surface as pattern signal)
  if (lic && entities[0]) {
    const licOk =
      lic.statusNormalized === "active" || lic.statusNormalized === "current";
    const entBad = /inactive|dissolved|revoked|expired/i.test(
      entities[0].status || ""
    );
    if (licOk && entBad) {
      signals.push({
        id: "active_lic_inactive_entity",
        title: "License active while linked entity status is not",
        detail:
          "DBPR shows an active/current license while the linked Sunbiz entity status is inactive-style. Confirm the contracting entity and current filings before signing.",
        evidence: [
          `License ${lic.externalKey}: ${lic.statusNormalized}`,
          `Entity ${entities[0].legalName}: ${entities[0].status}`,
        ],
        confidence: "high",
        questions: [
          "Which entity is currently authorized to contract under this license?",
          "Can you provide current Sunbiz status for the contracting party?",
        ],
      });
    }
  }

  // Registered agent vs display name — only if clearly different and agent looks like a person-service
  if (entities[0]?.registeredAgentName) {
    const agent = normalizePerson(entities[0].registeredAgentName);
    const display = normalizePerson(contractor.displayName);
    const legal = normalizePerson(contractor.legalName || entities[0].legalName);
    if (
      agent.length >= 5 &&
      display &&
      !agent.includes(display.slice(0, 8)) &&
      legal &&
      !agent.includes(legal.slice(0, 8)) &&
      !display.includes(agent.slice(0, 8))
    ) {
      // Low confidence — many legitimate registered agents are services
      signals.push({
        id: "registered_agent_differs",
        title: "Registered agent name differs from contractor trade name",
        detail:
          "Sunbiz lists a registered agent that does not match the contractor’s primary trade name. Registered agents are often third parties — still useful to know who receives legal notices.",
        evidence: [
          `Trade/display name: ${contractor.displayName}`,
          `Registered agent (extract): ${entities[0].registeredAgentName}`,
        ],
        confidence: "low",
        questions: [
          "Who is the registered agent, and how do I reach the responsible officer for this project?",
        ],
      });
    }
  }

  // Filter: only show meaningful confidence (drop low unless nothing else — still allow low alone)
  const meaningful = signals.filter((s) => s.confidence !== "low");
  if (meaningful.length > 0) return meaningful;
  return signals.filter((s) => s.confidence !== "low" || signals.length === 1);
}

export function hasRelatedEntitySignal(contractor: ContractorDetail): boolean {
  return buildRelatedEntitySignals(contractor).length > 0;
}
