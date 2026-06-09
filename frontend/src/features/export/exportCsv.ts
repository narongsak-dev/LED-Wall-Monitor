import { saveAs } from 'file-saver';

export function exportToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  const escape = (value: unknown): string => {
    if (value == null) return '';
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(','))
    .join('\n');

  const bom = '﻿';
  const blob = new Blob([bom + header + '\n' + body], {
    type: 'text/csv;charset=utf-8',
  });
  saveAs(blob, filename);
}
