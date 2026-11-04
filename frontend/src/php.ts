export function snippetBody(source: string) {
  return source
    .replace(/^\s*<\?php\b[ \t]*\r?\n?\r?\n?/i, "")
    .replace(/\?>\s*$/, "");
}
