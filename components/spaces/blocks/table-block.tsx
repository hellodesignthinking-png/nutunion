"use client";

import { useState } from "react";
import { Plus, Trash2, MoreHorizontal } from "lucide-react";
import type { SpaceBlock } from "../space-pages-types";

interface Column {
  name: string;
}
interface TableData {
  columns: Column[];
  rows: string[][];
}

interface Props {
  block: SpaceBlock;
  onChange: (patch: Partial<SpaceBlock>) => void;
}

const DEFAULT_TABLE: TableData = {
  columns: [{ name: "이름" }, { name: "값" }],
  rows: [["", ""], ["", ""]],
};

/**
 * 인라인 미니 테이블 — Notion 의 inline database 와 비슷.
 * 셀 클릭 → input 으로 편집, 행/열 추가·삭제 가능.
 * 데이터는 block.data 에 jsonb 로 저장.
 */
export function TableBlock({ block, onChange }: Props) {
  const data = (block.data as Partial<TableData> | undefined) ?? {};
  const tbl: TableData = {
    columns: data.columns?.length ? data.columns : DEFAULT_TABLE.columns,
    rows: data.rows?.length ? data.rows : DEFAULT_TABLE.rows,
  };
  const [editingHeader, setEditingHeader] = useState<number | null>(null);

  function update(next: TableData) {
    onChange({ data: { ...(block.data || {}), ...next } });
  }

  function setCell(row: number, col: number, value: string) {
    const next = tbl.rows.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? value : c) : r);
    update({ ...tbl, rows: next });
  }

  function setHeader(col: number, name: string) {
    const next = tbl.columns.map((c, i) => i === col ? { ...c, name } : c);
    update({ ...tbl, columns: next });
  }

  function addRow() {
    update({ ...tbl, rows: [...tbl.rows, tbl.columns.map(() => "")] });
  }

  function addCol() {
    update({
      columns: [...tbl.columns, { name: `열 ${tbl.columns.length + 1}` }],
      rows: tbl.rows.map((r) => [...r, ""]),
    });
  }

  function deleteRow(row: number) {
    if (tbl.rows.length <= 1) return;
    update({ ...tbl, rows: tbl.rows.filter((_, i) => i !== row) });
  }

  function deleteCol(col: number) {
    if (tbl.columns.length <= 1) return;
    update({
      columns: tbl.columns.filter((_, i) => i !== col),
      rows: tbl.rows.map((r) => r.filter((_, i) => i !== col)),
    });
  }

  return (
    <div className="my-1 border-[2px] border-nu-ink overflow-x-auto bg-white">
      <table className="w-full text-[12px] table-fixed">
        <thead>
          <tr className="bg-nu-cream/40 border-b-[2px] border-nu-ink">
            {tbl.columns.map((col, ci) => (
              <th key={ci} className="border-r border-nu-ink/15 px-2 py-1 last:border-r-0 group relative">
                {editingHeader === ci ? (
                  <input
                    type="text"
                    autoFocus
                    value={col.name}
                    onChange={(e) => setHeader(ci, e.target.value)}
                    onBlur={() => setEditingHeader(null)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingHeader(null); }}
                    className="w-full bg-white border border-nu-ink/30 outline-none px-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingHeader(ci)}
                    className="w-full text-left font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink hover:text-nu-pink"
                  >
                    {col.name || `열 ${ci + 1}`}
                  </button>
                )}
                {tbl.columns.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteCol(ci)}
                    title="이 열 삭제"
                    className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-nu-muted hover:text-red-600 p-0.5"
                  >
                    <Trash2 size={9} />
                  </button>
                )}
              </th>
            ))}
            <th className="w-8 bg-nu-cream/60">
              <button
                type="button"
                onClick={addCol}
                className="w-full text-nu-muted hover:text-nu-pink p-1"
                title="열 추가"
              >
                <Plus size={11} className="mx-auto" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {tbl.rows.map((row, ri) => (
            <tr key={ri} className="group border-b border-nu-ink/10 last:border-b-0">
              {row.map((cell, ci) => (
                <td key={ci} className="border-r border-nu-ink/10 last:border-r-0 p-0">
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => setCell(ri, ci, e.target.value)}
                    placeholder=""
                    className="w-full px-2 py-1 text-[12px] outline-none bg-transparent focus:bg-yellow-50"
                  />
                </td>
              ))}
              <td className="w-8 text-center">
                {tbl.rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteRow(ri)}
                    className="opacity-0 group-hover:opacity-100 text-nu-muted hover:text-red-600 p-1"
                    title="이 행 삭제"
                  >
                    <Trash2 size={10} className="mx-auto" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={tbl.columns.length + 1} className="bg-nu-cream/30">
              <button
                type="button"
                onClick={addRow}
                className="w-full font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink py-1 flex items-center justify-center gap-1"
              >
                <Plus size={10} /> 행 추가
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
