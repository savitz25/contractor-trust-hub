"use client";

import { useMemo, useState } from "react";

const ITEMS = [
  "Verify state credential",
  "Check status",
  "Review trade/class",
  "Review entity/business relationship",
  "Review regulatory evidence",
  "Review local permits where available",
  "Review contract/quote",
  "Save research",
] as const;

export function ContractorHomeChecklist() {
  const [checked, setChecked] = useState<boolean[]>(() => ITEMS.map(() => false));
  const done = useMemo(() => checked.filter(Boolean).length, [checked]);
  return (
    <div className="cth-intel-checklist">
      <p>
        You&apos;ve reviewed {done} of {ITEMS.length} research areas. This is your process — not a contractor score.
      </p>
      <ul>
        {ITEMS.map((item, index) => (
          <li key={item}>
            <label>
              <input
                type="checkbox"
                checked={checked[index]}
                onChange={() => setChecked((prev) => prev.map((value, i) => (i === index ? !value : value)))}
              />
              {item}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
