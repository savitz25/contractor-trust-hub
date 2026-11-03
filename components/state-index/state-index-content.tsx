import { getStateIndex, type StateEntityRow } from "@/lib/state-index/model";

const COLUMNS: Array<[string, keyof StateEntityRow]> = [
  ["Name", "name"],
  ["City", "city"],
  ["Credential type", "credentialType"],
  ["Status", "status"],
  ["Date", "date"],
];

export function StateIndexContent({ slug }: { slug: string }) {
  const model = getStateIndex(slug);
  if (!model) return null;
  const columns = COLUMNS.filter(([, key]) => model.rows.some((record) => record[key]));
  return (
    <section className="mt-8" aria-labelledby={`${slug}-named-records`}>
      {model.facts.map((fact) => (
        <p key={fact} className="mt-3 max-w-3xl text-sm leading-relaxed">
          {fact}
        </p>
      ))}
      <h2 id={`${slug}-named-records`} className="mt-8 text-xl font-semibold">
        Named records
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr>
              {columns.map(([label]) => (
                <th key={label} className="py-2 pr-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((record) => (
              <tr key={`${record.name}-${record.city}-${record.date}`} className="border-t border-[var(--border)]">
                {columns.map(([label, key]) => (
                  <td key={label} className="py-2 pr-3 align-top">
                    {key === "name" && record.href ? <a href={record.href}>{record.name}</a> : record[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 id={`${slug}-about`} className="mt-8 text-xl font-semibold">
        About this data
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed">{model.about}</p>
    </section>
  );
}
