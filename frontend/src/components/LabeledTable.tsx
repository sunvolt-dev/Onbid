export type ColDef = { key: string; label: string; fmt?: (v: unknown) => string };

export function LabeledTable({ data, columns }: { data: Record<string, unknown>[]; columns: ColDef[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-[#9c9a92] py-2">데이터 없음</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[#e8e6df]">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#faf9f7] border-b border-[#e8e6df]">
            {columns.map((c) => (
              <th key={c.key} className="px-2.5 py-2 text-left text-[#9c9a92] font-normal whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[#e8e6df] last:border-0">
              {columns.map((c) => {
                const v = row[c.key];
                const display = c.fmt ? c.fmt(v) : (v == null || v === "" ? "-" : String(v));
                return (
                  <td key={c.key} className="px-2.5 py-2 text-[#3d3d3a] whitespace-nowrap">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
