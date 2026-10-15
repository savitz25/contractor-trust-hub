/**
 * Browser half of the Contractor parent hand-off.
 *
 * The page starts a hand-off only when the build was produced with
 * NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC set to "1". Any other value,
 * including an unset variable, keeps Save on this device.
 *
 * This flag is not the security kill switch. The one-profile activation
 * opens the server gate for ccc057187-a-r-roofing-inc even when this flag is
 * unset. Closing the canary is the revert documented in
 * docs/my-trusthub/ONE-PROFILE-CANARY.md, plus leaving this variable unset
 * at deployment.
 */
export function contractorClientSyncEnabled(value: string | undefined): boolean {
  return value === "1";
}

/** Canonical profile page only. The server still decides which slug is admitted. */
export function contractorClientMayHandoff(value: string | undefined, syncEligible: boolean, pathname: string, slug: string): boolean {
  return contractorClientSyncEnabled(value) && syncEligible && pathname === "/contractors/" + slug;
}
