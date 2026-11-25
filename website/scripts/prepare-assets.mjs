import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const directory = new URL("../", import.meta.url);
const destination = new URL("../public/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const [source, name] of [
  ["../../build/appicon.png", "logo.png"],
  ["../../build/appicon-small.png", "favicon.png"],
  ["../../docs/images/workspace.png", "workspace.png"],
  ["../../LICENSE", "license.txt"],
]) {
  await copyFile(new URL(source, import.meta.url), new URL(name, destination));
}

const { stdout } = await promisify(execFile)(
  "npm",
  ["ls", "--parseable", "--all"],
  {
    cwd: fileURLToPath(directory),
  },
);
const notices = [
  "TinkerCraft documentation website: third-party license notices.",
];
for (const folder of [...new Set(stdout.trim().split("\n"))].sort()) {
  if (folder === fileURLToPath(directory).replace(/\/$/, "")) continue;
  const metadata = JSON.parse(await readFile(`${folder}/package.json`, "utf8"));
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !/^(licen[sc]e|copying|notice|third.?party)/i.test(entry.name)
    )
      continue;
    notices.push(
      `\n${metadata.name} ${metadata.version} — ${entry.name}\n`,
      await readFile(`${folder}/${entry.name}`, "utf8"),
    );
  }
}
await writeFile(
  new URL("third-party-notices.txt", destination),
  notices.join("\n"),
);
