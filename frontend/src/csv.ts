export const cellText = (value: unknown): string =>
  typeof value === "object" && value !== null
    ? JSON.stringify(value)
    : value === null
      ? "null"
      : String(value);
function quote(value: string, protect: boolean): string {
  if (
    protect &&
    (/^[\s\u0000-\u001f]*[=+\-@]/u.test(value) || /^[\t\r\n]/.test(value))
  )
    value = `'${value}`;
  return `"${value.replaceAll('"', '""')}"`;
}
export function csv(
  rows: Record<string, unknown>[],
  columns: string[],
): string {
  return (
    "\uFEFF" +
    [
      columns.map((column) => quote(column, true)).join(","),
      ...rows.map((row) =>
        columns
          .map((column) => {
            const value = Object.hasOwn(row, column) ? row[column] : "";
            return quote(cellText(value ?? ""), typeof value === "string");
          })
          .join(","),
      ),
    ].join("\r\n")
  );
}
