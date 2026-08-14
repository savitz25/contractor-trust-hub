import type { TradeDef } from "@/lib/discovery/types";

/**
 * Consumer trade families → published ROC class codes.
 * Labels follow Class Detail on the posting list — not invented permissions.
 */
export const ARIZONA_TRADES: TradeDef[] = [
  {
    slug: "dual-general",
    label: "Dual general",
    title: "Dual general contractors",
    description:
      "Published ROC dual general classes (KB-1, KB-2, KA). Dual is the ROC category — confirm current status and exact class on the official search.",
    occupationCodes: ["KB-1", "KB-2", "KA"],
  },
  {
    slug: "general-residential",
    label: "General residential",
    title: "General residential contractors",
    description:
      "Published ROC general residential / remodeling classes (B, B-3, R-62) as listed on the current posting list.",
    occupationCodes: ["B", "B-3", "R-62"],
  },
  {
    slug: "general-commercial",
    label: "General commercial",
    title: "General commercial contractors",
    description:
      "Published ROC commercial general classes (B-1, B-2, A). Not every Arizona job is commercial-general work.",
    occupationCodes: ["B-1", "B-2", "A"],
  },
  {
    slug: "roofing",
    label: "Roofing",
    title: "Roofing contractors",
    description: "Published ROC roofing class CR-42 as listed on the current posting list.",
    occupationCodes: ["CR-42"],
  },
  {
    slug: "hvac",
    label: "HVAC",
    title: "Air conditioning & refrigeration",
    description:
      "Published ROC air-conditioning / refrigeration classes (CR-39, C-39, R-39R).",
    occupationCodes: ["CR-39", "C-39", "R-39R"],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    title: "Plumbing contractors",
    description: "Published ROC plumbing classes (CR-37, C-37, R-37R).",
    occupationCodes: ["CR-37", "C-37", "R-37R"],
  },
  {
    slug: "electrical",
    label: "Electrical",
    title: "Electrical contractors",
    description: "Published ROC electrical classes (CR-11, C-11, R-11).",
    occupationCodes: ["CR-11", "C-11", "R-11"],
  },
  {
    slug: "remodeling",
    label: "Remodeling",
    title: "Remodeling & repair",
    description:
      "Published ROC remodeling / carpentry-repair classes (B-3, CR-61, R-62) as listed — not automatically all trades on a job.",
    occupationCodes: ["B-3", "CR-61", "R-62"],
  },
  {
    slug: "pool",
    label: "Pool",
    title: "Swimming pool contractors",
    description:
      "Published ROC pool classes (KA-5 dual swimming pool, CR-6 pool service and repair).",
    occupationCodes: ["KA-5", "CR-6"],
  },
  {
    slug: "outdoor",
    label: "Outdoor / exterior",
    title: "Outdoor & exterior contractors",
    description:
      "Published ROC exterior specialty classes: hardscaping (CR-21), fencing (CR-14), masonry (CR-31), painting (CR-34).",
    occupationCodes: ["CR-21", "CR-14", "CR-31", "CR-34"],
  },
  {
    slug: "painting",
    label: "Painting",
    title: "Painting contractors",
    description: "Published ROC painting and wall covering class CR-34.",
    occupationCodes: ["CR-34"],
  },
  {
    slug: "carpentry",
    label: "Carpentry",
    title: "Carpentry contractors",
    description: "Published ROC carpentry classes (CR-60, CR-61, CR-7, R-60).",
    occupationCodes: ["CR-60", "CR-61", "CR-7", "R-60"],
  },
];
