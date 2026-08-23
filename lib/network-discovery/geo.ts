/** USPS states + DC. Invalid extract values (e.g. RE) are not published as location.state. */
export const USPS_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

export function uspsState(raw: string | null | undefined): string | undefined {
  const s = (raw || "").trim().toUpperCase();
  return USPS_STATES.has(s) ? s : undefined;
}
