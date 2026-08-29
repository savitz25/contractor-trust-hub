/**
 * Ask ContractorTrustHub — interpreted query contract.
 * The parser may map language. It must not invent regulatory facts.
 */

export const ASK_CONTRACT_VERSION = "ask-contractor-v1" as const;

export type AskQueryMode =
  | "entity"
  | "count"
  | "aggregate"
  | "comparison"
  | "evidence"
  | "definition"
  | "fail_closed";

export type AskSort = "default" | "count_desc" | "unsupported_rate";

export type AskInterpretation = {
  location: string;
  trade: string;
  credentialStatus: string;
  evidenceFamily: string;
  entityType: string;
  sort: string;
  notes: string[];
};

export type AskResult = {
  version: typeof ASK_CONTRACT_VERSION;
  query: string;
  mode: AskQueryMode;
  supported: boolean;
  interpretation: AskInterpretation;
  href: string | null;
  count: { value: number; grain: string; caveat: string } | null;
  aggregate: Array<{ label: string; value: number; href: string }> | null;
  comparison: {
    left: { label: string; href: string };
    right: { label: string; href: string };
    metrics: Array<{ label: string; left: string; right: string }>;
    limitation: string;
  } | null;
  failMessage: string | null;
  changeHints: string[];
  definition?: { title: string; body: string; href: string } | null;
};
