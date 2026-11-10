export const CONTRACTOR_HUB = "contractor" as const;

export const TRUSTHUB_EVENTS = {
  PAGEVIEW: "$pageview",
  SEARCH_SUBMITTED: "search_submitted",
  SEARCH_RESULTS_RETURNED: "search_results_returned",
  SEARCH_RESULT_OPENED: "search_result_opened",
  SPECIALIST_HANDOFF_STARTED: "specialist_handoff_started",
  PROFILE_VIEWED: "profile_viewed",
  PROFILE_SAVED: "profile_saved",
  PROFILE_SAVE_FAILED: "profile_save_failed",
  PROFILE_UNSAVED: "profile_unsaved",
  CLAIM_STARTED: "claim_started",
} as const;

export type TrustHubEventName = (typeof TRUSTHUB_EVENTS)[keyof typeof TRUSTHUB_EVENTS];

export type TrustHubEventProperties = {
  hub?: typeof CONTRACTOR_HUB;
  environment?: "production" | "preview" | "development";
  surface?: string;
  state?: string;
  specialist_hub?: string;
  result_count?: number;
  capability_state?: string;
  success?: boolean;
  slug?: string;
  $pathname?: string;
  $current_url?: string;
};
