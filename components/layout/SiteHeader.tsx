import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderMenus } from "@/components/layout/HeaderMenus";
import { AskNetworkBar } from "@/components/network/AskNetworkBar";
import { SwitchHubMenu } from "@/components/network/SwitchHubMenu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 shadow-[var(--shadow-sm)] backdrop-blur-md">
      <AskNetworkBar />

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="shrink-0 no-underline"
          aria-label="Contractor Trust Hub home"
        >
          <BrandLogo height={36} priority surface="onLight" />
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-1.5">
          <HeaderMenus />
          <SwitchHubMenu className="hidden sm:block" />
          <Link
            href="/verify"
            data-entry-path="header-verify"
            className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)] hover:brightness-105"
          >
            Verify
          </Link>
        </div>
      </div>
    </header>
  );
}
