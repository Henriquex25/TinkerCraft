import assert from "node:assert/strict";
import { build } from "../frontend/node_modules/esbuild/lib/main.js";
import { createRequire } from "node:module";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const directory = await mkdtemp(path.join(tmpdir(), "tinkercraft-formatter-"));
const require = createRequire(path.join(root, "frontend/package.json"));
const Parser = require("php-parser");
const parser = new Parser();
function semantic(value) {
  if (Array.isArray(value)) return value.map(semantic);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              "loc",
              "raw",
              "comments",
              "leadingComments",
              "trailingComments",
              "tokens",
              "extra",
              "isDoubleQuote",
            ].includes(key),
        )
        .map(([key, item]) => [key, semantic(item)]),
    );
  return value;
}
try {
  await build({
    stdin: {
      contents:
        "export * from './src/format-php'; export * from './src/formatting-rules';",
      resolveDir: path.join(root, "frontend"),
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(directory, "formatter.cjs"),
  });
  const { formatPHP, parseFormattingRules, defaultFormatting } = await import(
    pathToFileURL(path.join(directory, "formatter.cjs")).href
  );
  const samples = [
    "$items=[1,2];foreach($items as $item){echo $item;}",
    "$users=User::query()->where('active',true)->get()->map(fn($user)=>['id'=>$user->id,'name'=>$user->name]);",
    "$f=function(int $n):array{if($n>0){return ['n'=>$n];}return [];};$f(42);",
    '// Keep this note\n$value="hello $name";$tags="<?php ?>";/* Keep this too */$value;',
    "$nowdoc = <<<'TEXT'\n<?php ?> and $literal\nTEXT;\n$nowdoc;",
    "$heredoc=<<<TEXT\nHello $name\nTEXT;\n$heredoc;",
    "match($value){1=>'one',default=>'other'};",
    "use App\\Models\\User;\nUser::find(id:42)?->name;",
    "<?php\n// Tags are optional\n$people=['João','日本語'];$people;\n?>",
  ];
  for (const code of samples) {
    const formatted = await formatPHP(code);
    const source = code.trimStart().startsWith("<?php")
      ? code
      : "<?php\n" + code;
    assert.deepEqual(
      semantic(parser.parseCode("<?php\n" + formatted)),
      semantic(parser.parseCode(source)),
    );
    assert.equal(
      await formatPHP(formatted),
      formatted,
      "formatting should be idempotent",
    );
    assert(!formatted.trimStart().startsWith("<?php"));
    if (code.includes("Keep this note")) {
      assert(formatted.includes("Keep this note"));
      assert(formatted.includes("Keep this too"));
    }
  }
  assert.equal(await formatPHP("21*2"), "21 * 2;\n");
  const chain = await formatPHP(
    "$users=User::query()->where('active',true)->orderBy('name')->limit(100)->get();",
  );
  assert(chain.includes("\n    ->where("));
  assert(chain.includes("\n    ->get();"));
  const custom = parseFormattingRules(
    '{"tabWidth":2,"printWidth":80,"singleQuote":false}',
  );
  assert.equal(custom.tabWidth, 2);
  assert.equal(custom.printWidth, 80);
  assert.equal(custom.singleQuote, false);
  const customResult = await formatPHP("if(true){echo 'hello';}", custom);
  assert(customResult.includes('\n  echo "hello";'));
  assert.deepEqual(parseFormattingRules("{}"), defaultFormatting);
  for (const json of [
    "[]",
    "null",
    '{"plugins":["untrusted"]}',
    '{"parser":"untrusted"}',
    '{"tabWidth":0}',
    '{"tabWidth":1.5}',
    '{"printWidth":999}',
    '{"useTabs":"false"}',
    '{"braceStyle":"unknown"}',
    '{"__proto__":{"polluted":true}}',
  ])
    assert.throws(() => parseFormattingRules(json));
  assert.throws(() => parseFormattingRules(" ".repeat(65537)));
  assert.equal(await formatPHP(""), "");
  await assert.rejects(formatPHP("$invalid = ;"));
  await assert.rejects(formatPHP("x".repeat(1048577)), /1 MiB/);
  const marker = path.join(directory, "must-not-execute");
  await formatPHP(`file_put_contents(${JSON.stringify(marker)},'executed');`);
  await assert.rejects(access(marker));
  console.log(
    "PASS: PHP formatting preserves syntax trees, comments, strings, Unicode and heredocs; supports tag-free expressions, rejects invalid/oversized snippets, and never executes PHP.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
