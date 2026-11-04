export interface FormattingRules {
  tabWidth: number;
  printWidth: number;
  useTabs: boolean;
  singleQuote: boolean;
  trailingCommaPHP: boolean;
  braceStyle: "per-cs" | "1tbs";
}

export const defaultFormatting: FormattingRules = {
  tabWidth: 4,
  printWidth: 80,
  useTabs: false,
  singleQuote: true,
  trailingCommaPHP: true,
  braceStyle: "per-cs",
};

export function parseFormattingRules(source: string): FormattingRules {
  if (new TextEncoder().encode(source).length > 65536)
    throw new Error("Formatting rules must be smaller than 64 KiB.");
  const value = JSON.parse(source);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Formatting rules must be a JSON object.");
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(defaultFormatting, key))
      throw new Error("Unsupported formatting option: {0}".replace("{0}", key));
  }
  const rules = { ...defaultFormatting, ...value };
  if (
    !Number.isInteger(rules.tabWidth) ||
    rules.tabWidth < 1 ||
    rules.tabWidth > 8
  )
    throw new Error("Indentation must be between 1 and 8 spaces.");
  if (
    !Number.isInteger(rules.printWidth) ||
    rules.printWidth < 40 ||
    rules.printWidth > 240
  )
    throw new Error("Line width must be between 40 and 240 characters.");
  for (const key of ["useTabs", "singleQuote", "trailingCommaPHP"] as const) {
    if (typeof rules[key] !== "boolean")
      throw new Error("Formatting switches must be true or false.");
  }
  if (!["per-cs", "1tbs"].includes(rules.braceStyle))
    throw new Error("Brace style must be per-cs or 1tbs.");
  return rules;
}
