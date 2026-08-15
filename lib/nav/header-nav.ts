/** Primary header IA — grouped menus. Not a marketplace. */

export type HeaderLink = {
  href: string;
  label: string;
  hint?: string;
};

export type HeaderGroup = {
  id: string;
  label: string;
  links: HeaderLink[];
};

export const EXPLORE_GROUP: HeaderGroup = {
  id: "explore",
  label: "Explore",
  links: [
    { href: "/florida", label: "Browse Florida", hint: "County and trade lists" },
    { href: "/verify", label: "Verify by state", hint: "License or name search" },
    { href: "/#states", label: "Coverage", hint: "Where we have evidence" },
  ],
};

export const PLAN_GROUP: HeaderGroup = {
  id: "plan",
  label: "Plan",
  links: [
    { href: "/plan/start", label: "Plan a project", hint: "Choose state first" },
    { href: "/plan", label: "Florida plan intake", hint: "Full FL tools" },
    { href: "/studios", label: "Project Studios" },
    { href: "/studio/kitchen", label: "Kitchen calculator" },
    { href: "/studio/bathroom", label: "Bathroom calculator" },
    { href: "/studio/roofing", label: "Roofing calculator" },
    { href: "/tools/scope-builder", label: "Scope Builder" },
  ],
};

export const TOOLS_GROUP: HeaderGroup = {
  id: "tools",
  label: "Tools",
  links: [
    { href: "/tools/quote-analyzer", label: "Quote Analyzer" },
    { href: "/tools/contract-analyzer", label: "Contract Analyzer" },
    { href: "/compare", label: "Compare" },
    { href: "/watch", label: "Watched list", hint: "Saved on this device" },
    { href: "/property", label: "Property / permits" },
    { href: "/tools/coverage", label: "Where we cover" },
  ],
};

export const GUIDES_GROUP: HeaderGroup = {
  id: "guides",
  label: "Guides",
  links: [
    { href: "/guides", label: "All guides" },
    { href: "/guides/how-to-verify-florida-contractor", label: "How to verify a Florida contractor" },
    { href: "/guides/florida-contractor-red-flags", label: "Red flags" },
    { href: "/guides/florida-contractor-license-types", label: "License types" },
  ],
};

export const MY_PROJECT_GROUP: HeaderGroup = {
  id: "my-project",
  label: "My Project",
  links: [
    { href: "/projects", label: "Projects" },
    { href: "/watch", label: "Watched contractors", hint: "Saved on this device" },
    { href: "/passport", label: "Home Passport" },
    { href: "/account", label: "Account" },
  ],
};

export const DESKTOP_GROUPS: HeaderGroup[] = [
  EXPLORE_GROUP,
  PLAN_GROUP,
  TOOLS_GROUP,
  GUIDES_GROUP,
];

export const MOBILE_GROUPS: HeaderGroup[] = [
  EXPLORE_GROUP,
  PLAN_GROUP,
  TOOLS_GROUP,
  GUIDES_GROUP,
  MY_PROJECT_GROUP,
];
