import { memo, useEffect, useRef, useState } from "react";
import { flexRender, type Row } from "@tanstack/react-table";
import type { LdxpGoods } from "../types";

// 使用浏览器观察器按组挂载可见行，保留实测高度，维持页面自然滚动。
const RowGroup = memo(function RowGroup({ rows, columns, initial }: { rows: Row<LdxpGoods>[]; columns: string; initial: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const height = useRef(rows.length * 170);
  const [visible, setVisible] = useState(initial);
  useEffect(() => {
    const node = element.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && node.dataset.visible === "true") height.current = node.getBoundingClientRect().height;
      setVisible(entry.isIntersecting);
    }, { rootMargin: "900px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={element} data-visible={visible} style={visible ? undefined : { height: height.current }}>
      {visible && rows.map((row) => (
        <div key={row.id} role="row" className="grid min-h-[82px] border-b border-border bg-card transition-colors duration-200 hover:bg-blue-50/45" style={{ gridTemplateColumns: columns }}>
          {row.getVisibleCells().map((cell) => (
            <div key={cell.id} role="cell" className="min-w-0 px-3 py-3">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

export function ResultRows({ rows, columns }: { rows: Row<LdxpGoods>[]; columns: string }) {
  if (rows.length <= 100) {
    return <RowGroup rows={rows} columns={columns} initial />;
  }
  const groups = [];
  for (let index = 0; index < rows.length; index += 25) {
    groups.push(<RowGroup key={index} rows={rows.slice(index, index + 25)} columns={columns} initial={index === 0} />);
  }
  return <>{groups}</>;
}
