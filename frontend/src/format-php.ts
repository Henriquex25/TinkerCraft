import { format } from "prettier/standalone";
import phpPlugin from "@prettier/plugin-php/standalone";
import { snippetBody } from "./php";
import { defaultFormatting, type FormattingRules } from "./formatting-rules";

export async function formatPHP(
  code: string,
  rules: FormattingRules = defaultFormatting,
) {
  if (new TextEncoder().encode(code).length > 1048576)
    throw new Error("Formatting is limited to 1 MiB of PHP code.");
  const body = snippetBody(code);
  if (!body.trim()) return body;
  const options = {
    plugins: [phpPlugin],
    parser: "php",
    phpVersion: "8.2",
    ...rules,
  };
  const source = "<?php\n" + body;
  let result;
  try {
    result = await format(source, options);
  } catch (error) {
    try {
      result = await format(source + "\n;", options);
    } catch {
      if (error instanceof Error)
        throw new Error(
          error.message
            .split("\n")[0]
            .replace(
              /on line (\d+)/,
              (_match, line) => `on line ${Math.max(1, Number(line) - 1)}`,
            ),
        );
      throw error;
    }
  }
  return snippetBody(result);
}
