import type { ProjectTypeId } from "@/lib/plan/types";

/** Expected scope line items by project type for Scope Builder + quote completeness. */

export type TemplateItem = {
  id: string;
  label: string;
  /** Keywords that suggest this item is present in quote text */
  keywords: string[];
};

const COMMON_CLOSEOUT: TemplateItem[] = [
  {
    id: "demo",
    label: "Demolition / removal of existing finishes",
    keywords: ["demo", "demolition", "tear out", "remove existing"],
  },
  {
    id: "debris",
    label: "Debris removal / haul-away",
    keywords: ["debris", "haul", "dumpster", "disposal", "trash"],
  },
  {
    id: "protection",
    label: "Jobsite protection / dust control",
    keywords: ["protection", "plastic", "dust", "floor protection", "masking"],
  },
  {
    id: "cleanup",
    label: "Final cleanup",
    keywords: ["cleanup", "clean up", "broom clean", "final clean"],
  },
  {
    id: "permits",
    label: "Permits and inspections responsibility",
    keywords: ["permit", "inspection", "building department", "code"],
  },
  {
    id: "change_orders",
    label: "Change-order process language",
    keywords: ["change order", "change-order", "extras", "additional work"],
  },
  {
    id: "timeline",
    label: "Project schedule / duration",
    keywords: ["timeline", "schedule", "duration", "weeks", "days", "start date"],
  },
  {
    id: "warranty",
    label: "Warranty terms",
    keywords: ["warranty", "guarantee", "workmanship"],
  },
];

const BY_TYPE: Record<ProjectTypeId, TemplateItem[]> = {
  kitchen_remodel: [
    { id: "cabinets", label: "Cabinets / cabinet install", keywords: ["cabinet", "cabinetry"] },
    { id: "countertops", label: "Countertops", keywords: ["countertop", "quartz", "granite", "solid surface"] },
    { id: "backsplash", label: "Backsplash", keywords: ["backsplash"] },
    { id: "appliances", label: "Appliance install / disconnect", keywords: ["appliance"] },
    { id: "plumbing", label: "Plumbing (sink, faucet, lines)", keywords: ["plumbing", "sink", "faucet", "dishwasher"] },
    { id: "electrical", label: "Electrical / lighting updates", keywords: ["electrical", "lighting", "outlet", "under-cabinet"] },
    { id: "flooring", label: "Flooring", keywords: ["flooring", "floor", "tile floor", "lvp"] },
    { id: "layout", label: "Layout / plumbing relocation (if any)", keywords: ["layout", "relocat", "move plumbing", "island"] },
    ...COMMON_CLOSEOUT,
  ],
  bathroom_remodel: [
    { id: "vanity", label: "Vanity / storage", keywords: ["vanity", "cabinet"] },
    { id: "counter_sink", label: "Countertop / sink", keywords: ["countertop", "sink", "lavatory"] },
    { id: "shower", label: "Shower rebuild / replacement", keywords: ["shower", "pan", "waterproof"] },
    { id: "tub", label: "Tub / tub-to-shower conversion", keywords: ["tub", "bathtub", "tub to shower"] },
    { id: "tile", label: "Tile work", keywords: ["tile", "tiling", "grout"] },
    { id: "plumbing", label: "Plumbing relocation / rough-in", keywords: ["plumbing", "valve", "rough-in", "fixture"] },
    { id: "electrical", label: "Lighting / electrical / GFCI", keywords: ["electrical", "gfci", "lighting", "exhaust"] },
    { id: "ventilation", label: "Ventilation / exhaust fan", keywords: ["vent", "exhaust", "fan"] },
    { id: "flooring", label: "Flooring", keywords: ["flooring", "floor"] },
    ...COMMON_CLOSEOUT,
  ],
  roofing: [
    { id: "tearoff", label: "Tear-off of existing covering", keywords: ["tear-off", "tear off", "remove", "strip"] },
    { id: "decking", label: "Decking repair / replacement", keywords: ["decking", "sheathing", "plywood", "osb"] },
    { id: "underlayment", label: "Underlayment / ice & water", keywords: ["underlayment", "felt", "synthetic", "ice and water"] },
    { id: "covering", label: "New roof covering material", keywords: ["shingle", "tile", "metal", "tpo", "membrane"] },
    { id: "flashing", label: "Flashing / valleys / penetrations", keywords: ["flashing", "valley", "boot", "penetration"] },
    { id: "ventilation", label: "Roof ventilation", keywords: ["vent", "ridge vent", "soffit"] },
    { id: "disposal", label: "Material disposal", keywords: ["disposal", "debris", "dumpster"] },
    { id: "permits", label: "Permits and inspections", keywords: ["permit", "inspection"] },
    { id: "warranty", label: "Material and workmanship warranty", keywords: ["warranty", "manufacturer"] },
    { id: "timeline", label: "Schedule / weather contingencies", keywords: ["schedule", "timeline", "weather"] },
  ],
  addition: [
    { id: "foundation", label: "Foundation / slab work", keywords: ["foundation", "slab", "footer", "footing"] },
    { id: "framing", label: "Framing / structure", keywords: ["framing", "structural", "lumber"] },
    { id: "roof_tie", label: "Roof tie-in", keywords: ["roof", "tie-in", "tie in"] },
    { id: "envelope", label: "Exterior envelope / windows", keywords: ["siding", "window", "stucco", "envelope"] },
    { id: "electrical", label: "Electrical rough and finish", keywords: ["electrical", "panel", "wiring"] },
    { id: "plumbing", label: "Plumbing (if wet areas)", keywords: ["plumbing"] },
    { id: "hvac", label: "HVAC extension", keywords: ["hvac", "ac", "duct"] },
    { id: "interior", label: "Interior finishes", keywords: ["drywall", "paint", "flooring", "trim"] },
    ...COMMON_CLOSEOUT,
  ],
  basement_finish: [
    { id: "framing", label: "Framing / partitions", keywords: ["framing", "stud", "partition"] },
    { id: "insulation", label: "Insulation / moisture control", keywords: ["insulation", "vapor", "moisture"] },
    { id: "electrical", label: "Electrical", keywords: ["electrical", "outlet", "lighting"] },
    { id: "plumbing", label: "Plumbing (bath / wet bar)", keywords: ["plumbing", "bathroom", "wet bar"] },
    { id: "hvac", label: "HVAC / ventilation", keywords: ["hvac", "duct", "vent"] },
    { id: "finishes", label: "Drywall, paint, flooring", keywords: ["drywall", "paint", "flooring", "ceiling"] },
    ...COMMON_CLOSEOUT,
  ],
  siding_exterior: [
    { id: "siding", label: "Siding material and install", keywords: ["siding", "cladding", "stucco"] },
    { id: "wrap", label: "Weather barrier / wrap", keywords: ["wrap", "housewrap", "weather barrier", "tyvek"] },
    { id: "trim", label: "Trim / fascia / soffit", keywords: ["trim", "fascia", "soffit"] },
    { id: "windows", label: "Window / door integration", keywords: ["window", "door", "flashing"] },
    { id: "disposal", label: "Old material disposal", keywords: ["disposal", "debris", "haul"] },
    { id: "permits", label: "Permits if required", keywords: ["permit"] },
    { id: "warranty", label: "Warranty", keywords: ["warranty"] },
  ],
  deck_outdoor: [
    { id: "structure", label: "Deck structure / framing", keywords: ["framing", "joist", "post", "beam"] },
    { id: "decking", label: "Decking boards", keywords: ["decking", "composite", "board"] },
    { id: "railings", label: "Railings", keywords: ["railing", "baluster"] },
    { id: "stairs", label: "Stairs", keywords: ["stair", "steps"] },
    { id: "footer", label: "Footings / posts", keywords: ["footing", "footer", "post hole"] },
    { id: "permits", label: "Permits", keywords: ["permit"] },
    { id: "finish", label: "Finish / sealant", keywords: ["stain", "seal", "finish"] },
  ],
  full_home_renovation: [
    { id: "kitchen", label: "Kitchen scope", keywords: ["kitchen"] },
    { id: "baths", label: "Bathroom scope", keywords: ["bath", "bathroom"] },
    { id: "flooring", label: "Flooring throughout", keywords: ["flooring"] },
    { id: "paint", label: "Paint / interior finishes", keywords: ["paint", "drywall"] },
    { id: "electrical", label: "Electrical systems", keywords: ["electrical", "panel"] },
    { id: "plumbing", label: "Plumbing systems", keywords: ["plumbing"] },
    { id: "hvac", label: "HVAC", keywords: ["hvac"] },
    ...COMMON_CLOSEOUT,
  ],
  custom_home_rebuild: [
    { id: "site", label: "Site work / demo", keywords: ["site", "demo", "clear"] },
    { id: "foundation", label: "Foundation", keywords: ["foundation", "slab"] },
    { id: "structure", label: "Structure / framing", keywords: ["framing", "structure"] },
    { id: "envelope", label: "Envelope / roof", keywords: ["roof", "siding", "window"] },
    { id: "systems", label: "MEP systems", keywords: ["electrical", "plumbing", "hvac", "mechanical"] },
    { id: "finishes", label: "Interior finishes", keywords: ["finish", "flooring", "cabinets", "paint"] },
    ...COMMON_CLOSEOUT,
  ],
  general_contracting: [
    { id: "scope_defined", label: "Written scope of work", keywords: ["scope", "work includes"] },
    { id: "materials", label: "Materials responsibility", keywords: ["materials", "allowance", "owner furnish"] },
    { id: "labor", label: "Labor / trade coordination", keywords: ["labor", "subcontractor", "trade"] },
    ...COMMON_CLOSEOUT,
  ],
};

export function scopeTemplateFor(projectType: ProjectTypeId): TemplateItem[] {
  return BY_TYPE[projectType] ?? BY_TYPE.general_contracting;
}
