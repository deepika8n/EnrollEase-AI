import StatusBadge from "./StatusBadge";

export default function DataTable({ columns, rows, onRowClick }) {
  return (
    <div className="panel overflow-hidden">
      <div className="max-h-[72vh] overflow-x-auto overflow-y-auto">
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
