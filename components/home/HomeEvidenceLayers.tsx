const LAYERS = [
  ["01", "Identity", "License, registration, or official business identity", "All six intelligence states", "Distinguishes an exact public identity from a similar name.", "Identity does not establish quality or service area."],
  ["02", "Credential", "Status, classification, and regulatory authority", "FL · NJ · CA · TX · WA · AZ", "Shows which authority and work class apply.", "Active or current does not mean recommended."],
  ["03", "Financial responsibility", "Bond and liability-insurance filing evidence", "Washington; selected credential sources elsewhere", "Adds dated filing evidence to an exact identity.", "A filing is not endorsement, safety, or guaranteed present coverage."],
  ["04", "Work history", "Permit, public-work, or attributable activity evidence", "Selected FL/NJ research; SF, LA, and Austin modules", "Separates performed or attributed activity from credential status.", "Permit activity does not prove quality or completion."],
  ["05", "Regulatory history", "Discipline, enforcement, unlicensed activity, and debarment", "Depth varies across all six states", "Surfaces official records that merit direct review.", "No row is not a clean record; discipline is not a criminal conviction."],
  ["06", "Business evidence", "Official contacts, addresses, qualifiers, and entity relationships", "Where source-published and safely attributable", "Helps connect the credential to the business behind it.", "A contact is not a verified service area; a qualifier is not necessarily an owner."],
] as const;

export function HomeEvidenceLayers() {
  return (
    <section id="layers" aria-labelledby="layers-title" className="cth-intel-layers">
      <p className="cth-intel-eyebrow">What we can research</p>
      <h2 id="layers-title">Six layers behind a contractor name</h2>
      <p className="cth-intel-section-lede">Not every jurisdiction publishes every layer, and not every contractor has every record. Each layer answers a different question.</p>
      <ol>
        {LAYERS.map(([number, title, what, where, why, limit]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p className="cth-intel-layer-what">{what}</p><dl><div><dt>Where</dt><dd>{where}</dd></div><div><dt>Why care</dt><dd>{why}</dd></div><div><dt>Does not prove</dt><dd>{limit}</dd></div></dl></div></li>)}
      </ol>
    </section>
  );
}
