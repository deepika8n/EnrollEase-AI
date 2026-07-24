import StatusBadge from "./StatusBadge";

export default function DataTable({ columns, rows, onRowClick }) {
  return (
    <div className="panel overflow-hidden">
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="block w-full bg-white p-4 text-left transition duration-200 hover:bg-brand-50/45"
            onClick={() => onRowClick?.(row)}
          >
            <div className="grid gap-3">
              {columns.map((column) => (
                <div key={column.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {column.label}
                  </p>
                  <div className="mt-2 break-words text-sm font-medium text-slate-700">
                    {column.render
                      ? column.render(row[column.key], row)
                      : column.badge
                        ? <StatusBadge value={row[column.key]} />
                        : row[column.key]}
                  </div>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="hidden max-h-[72vh] overflow-x-auto overflow-y-auto md:block">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-white">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 backdrop-blur sm:px-4"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b border-slate-100 transition duration-200 hover:bg-brand-50/45"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="break-words border-b border-slate-100 px-3 py-3 align-top text-[13px] font-medium text-slate-700 sm:px-4"
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : column.badge
                        ? <StatusBadge value={row[column.key]} />
                        : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
