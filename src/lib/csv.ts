export type CsvValue = string | number | null | undefined;

// Serialize a header row + data rows to RFC 4180 CSV: CRLF line endings, and
// any value containing a comma, quote, or newline is wrapped in double quotes
// with internal quotes doubled. Returned as a plain string for the caller to
// download (Blob) or stream.
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

function escapeCell(value: CsvValue): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
