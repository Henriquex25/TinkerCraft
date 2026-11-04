import ts from "../frontend/node_modules/typescript/lib/typescript.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sources = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const localization = JSON.parse(
  fs.readFileSync(process.argv[3], "utf8"),
).contents;
const overrides = new Map(
  Object.entries(
    JSON.parse(
      fs.readFileSync(
        path.join(root, "frontend/src/locales/monaco-overrides.pt-BR.json"),
        "utf8",
      ),
    ),
  ),
);
const modules = new Map();
const shared = new Map();
const literal = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;

for (const item of sources) {
  const source = ts.createSourceFile(
    item.module + ".ts",
    item.source,
    ts.ScriptTarget.Latest,
    true,
  );
  const dictionary = new Map();
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      /^(?:nls\.)?localize2?$/.test(node.expression.getText(source)) &&
      node.arguments.length >= 2
    ) {
      let key = literal(node.arguments[0]);
      if (ts.isObjectLiteralExpression(node.arguments[0])) {
        const property = node.arguments[0].properties.find(
          (value) => value.name?.getText(source) === "key",
        );
        key = property && literal(property.initializer);
      }
      const english = literal(node.arguments[1]);
      let portuguese = key && localization[item.module]?.[key];
      if (portuguese && typeof portuguese === "object")
        portuguese = portuguese.message;
      if (english && typeof portuguese === "string") {
        dictionary.set(english, portuguese);
        if (!shared.has(english)) shared.set(english, new Set());
        shared.get(english).add(portuguese);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  modules.set(item.module, dictionary);
}

const messages = [];
const missing = new Set();
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(filename);
      continue;
    }
    if (!filename.endsWith(".js")) continue;
    const module =
      "vs/" + filename.replaceAll("\\", "/").split("/esm/vs/")[1].slice(0, -3);
    const text = fs.readFileSync(filename, "utf8");
    if (!text.includes("localize(") && !text.includes("localize2(")) continue;
    const source = ts.createSourceFile(
      filename,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        /^localize2?$/.test(node.expression.getText(source)) &&
        node.arguments.length >= 2 &&
        ts.isNumericLiteral(node.arguments[0])
      ) {
        const english = literal(node.arguments[1]);
        if (english) {
          const index = Number(node.arguments[0].text);
          if (!Number.isInteger(index) || index < 0 || index > 10000)
            throw new Error("Invalid upstream localization index");
          const portuguese =
            overrides.get(english) ??
            modules.get(module)?.get(english) ??
            (shared.get(english)?.size === 1
              ? [...shared.get(english)][0]
              : undefined);
          if (typeof portuguese !== "string") missing.add(english);
          messages[index] = portuguese ?? english;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
collect(path.join(root, "frontend/node_modules/monaco-editor/esm/vs"));
if (missing.size)
  throw new Error("Review translations for: " + [...missing].join("\n"));
fs.writeFileSync(
  path.join(root, "frontend/src/locales/monaco.pt-BR.json"),
  JSON.stringify(messages, null, 2) + "\n",
);
console.log(
  "Generated " +
    messages.filter((message) => typeof message === "string").length +
    " Monaco translations from official Microsoft sources.",
);
