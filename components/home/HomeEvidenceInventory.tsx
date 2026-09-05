import Link from "next/link";
import { homepageEvidenceByFamily } from "@/lib/home-intel/evidence-inventory";
import { HOMEPAGE_EVIDENCE_INVENTORY } from "@/lib/home-intel/evidence-inventory";

const fmt = (count: number) => count.toLocaleString("en-US");

export function HomeEvidenceInventory() {
  const groups = homepageEvidenceByFamily();
  const highlightIds = ["live-credentials", "nj-construction", "austin-permits", "wa-bond-rows", "regulatory-actions", "state-pages"];
  const highlights = highlightIds.map((id) => HOMEPAGE_EVIDENCE_INVENTORY.find((item) => item.id === id)).filter((item): item is (typeof HOMEPAGE_EVIDENCE_INVENTORY)[number] => Boolean(item));
  return (
    <section id="scale" aria-labelledby="scale-title" className="cth-intel-inventory">
      <p className="cth-intel-eyebrow">Official evidence inventory</p>
      <h2 id="scale-title">The scale is real. The grains stay separate.</h2>
      <p className="cth-intel-section-lede">Hundreds of thousands of credentials sit alongside millions of construction-source rows, regulatory records, filing graphs, and business evidence. They answer different questions, so we never collapse them into one vanity total.</p>
      <div className="cth-intel-inventory-highlights" aria-label="Evidence scale overview">
        {highlights.map((item) => <article key={item.id}><strong>{fmt(item.count)}</strong><span>{item.label}</span></article>)}
      </div>
      <div className="cth-intel-inventory-groups">
        {groups.map((group, groupIndex) => (
          <details key={group.family} open={groupIndex < 3}>
            <summary><span>{String(groupIndex + 1).padStart(2, "0")}</span><strong>{group.family}</strong><small>{group.items.length} distinct measures</small></summary>
            <div className="cth-intel-table-scroll" tabIndex={0} role="region" aria-label={`${group.family} evidence inventory`}>
              <table><thead><tr><th>Evidence</th><th>Count</th><th>Grain / geography</th><th>Source clock</th><th>Meaning and limit</th></tr></thead>
                <tbody>{group.items.map((item) => <tr key={item.id}><th scope="row">{item.href ? <Link href={item.href}>{item.label}</Link> : item.label}<small>{item.artifact}</small></th><td className="cth-intel-inventory-count">{fmt(item.count)}</td><td>{item.grain}<small>{item.geography}</small></td><td>{item.sourceAsOf}</td><td>{item.counts}<small><strong>Does not count:</strong> {item.doesNotCount}</small></td></tr>)}</tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
      <p className="cth-intel-caution"><strong>Why there is no grand total:</strong> a permit row, bond filing, license row, contact observation, and regulatory action are not interchangeable units. Showing them separately preserves what the public source actually says.</p>
    </section>
  );
}
