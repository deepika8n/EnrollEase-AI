import StatusBadge from "./StatusBadge";

export default function DataTable({ columns, rows, onRowClick }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-4 text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4 text-sm text-slate-700">
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
