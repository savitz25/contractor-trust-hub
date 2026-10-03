/**
 * One-account presentation (PREP, default OFF).
 *
 * The locked model: there is ONE consumer account across TrustHub, My TrustHub,
 * which lives on Ask. My Contractor is this hub's specialist workspace
 * (projects, watched and saved contractors, Home Passport, tools). It is not a
 * separate consumer account.
 *
 * Contractor still has its own optional email sign-in that keeps the workspace
 * durable across devices (/account). Until the My TrustHub integration is live
 * that sign-in keeps working exactly as it does today. This flag only changes
 * how it is described and exposes the My TrustHub account entry; it moves no
 * data, changes no session and contacts nothing.
 *
 * NEXT_PUBLIC_* is inlined at build time: rebuild after changing it.
 */
export const MY_TRUSTHUB_ORIGIN = "https://www.asktrusthub.com";
export const MY_TRUSTHUB_ACCOUNT_HREF = `${MY_TRUSTHUB_ORIGIN}/my`;
export const ONE_ACCOUNT_PRESENTATION = process.env.NEXT_PUBLIC_MY_TRUSTHUB_ONE_ACCOUNT === "1";

export const MY_CONTRACTOR_PATH = "/my-contractor";

/** Words for the existing Contractor sign-in, by presentation. */
export function workspaceSyncCopy(oneAccount: boolean = ONE_ACCOUNT_PRESENTATION) {
  return oneAccount
    ? {
        navLabel: "Workspace sync",
        linkLabel: "Workspace sync",
        promptLead: "Keep my work:",
        promptBody: "projects on this device can be kept in sync across your devices for long-term Home Passport storage.",
        promptAction: "Workspace sync",
      }
    : {
        navLabel: "Account",
        linkLabel: "Optional account",
        promptLead: "Save my work:",
        promptBody: "projects on this device can be imported into an optional account for long-term Home Passport storage.",
        promptAction: "Save / sign in",
      };
}
