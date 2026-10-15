import * as React from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

/** Simple responsive data table for host/admin lists. */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            {columns.map((c) => (
              <th key={c.header} scope="col" className="px-4 py-2.5 font-semibold text-stone-700">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-stone-100 last:border-0">
              {columns.map((c) => (
                <td key={c.header} className="px-4 py-2.5 align-top">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
