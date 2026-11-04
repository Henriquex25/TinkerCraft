import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, webkit } from "playwright-core";
const root = path.resolve(import.meta.dirname, "..");
const data = await mkdtemp(path.join(tmpdir(), "tinkercraft-ui-"));
const token = "tinkercraft-test-" + Date.now();
let server, browser;
const fixtureRoot = path.join(data, "container-projects");
const fixtureProject = path.join(fixtureRoot, "shop");
const fixtureBin = path.join(data, "fixture-bin");
await mkdir(path.join(fixtureProject, "app"), { recursive: true });
await mkdir(fixtureBin, { recursive: true });
await writeFile(
  path.join(fixtureProject, "composer.json"),
  JSON.stringify({ autoload: { "psr-4": { "App\\": "app/" } } }),
);
await writeFile(
  path.join(fixtureProject, "app/Product.php"),
  "<?php namespace App; class Product { public function description(): string { return 'test'; } }",
);
await writeFile(path.join(fixtureProject, ".env"), "TEST_SECRET=not-for-cache");
await writeFile(
  path.join(fixtureBin, "docker"),
  `#!/usr/bin/env python3
import os,sys,json
a=sys.argv[1:]
if a[0]=='ps': print(json.dumps({'ID':'fixture-id','Names':'php-test','Image':'php:fixture'}))
elif a[0]=='inspect': print(json.dumps({'Config':{'WorkingDir':'/'},'Mounts':[{'Type':'volume','Destination':os.environ['TINKERCRAFT_UI_FIXTURE_ROOT']}]}))
else:
 assert a[:2]==['exec','-i']; a=a[2:]
 if a[0]=='--workdir': os.chdir(a[1]);a=a[2:]
 assert a[0]=='php-test';os.execvp(a[1],a[1:])
`,
  { mode: 0o700 },
);
try {
  server = spawn(
    "go",
    [
      "run",
      "-buildvcs=false",
      "-ldflags=-X tinkercraft/internal/buildinfo.ReleaseSource=",
      "./cmd/tinkercraft-devserver",
      "-addr",
      "127.0.0.1:0",
      "-data",
      data,
    ],
    {
      cwd: root,
      detached: true,
      env: {
        ...process.env,
        TINKERCRAFT_TEST_TOKEN: token,
        TINKERCRAFT_RELEASE_SOURCE: "",
        PATH: fixtureBin + path.delimiter + process.env.PATH,
        TINKERCRAFT_UI_FIXTURE_ROOT: fixtureRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const address = await new Promise((resolve, reject) => {
    let output = "",
      errors = "";
    const timer = setTimeout(
      () => reject(new Error("Backend did not start: " + errors)),
      120000,
    );
    server.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    server.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/TinkerCraft dev: (http:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Backend exit ${code}: ${errors}`));
    });
  });
  const engine =
    process.env.TINKERCRAFT_UI_BROWSER === "chromium" ? chromium : webkit;
  browser = await engine.launch({
    headless: true,
    ...(process.env.TINKERCRAFT_BROWSER_PATH
      ? { executablePath: process.env.TINKERCRAFT_BROWSER_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
  });
  const modifier = await page.evaluate(() =>
    /Mac|iPhone|iPad/.test(navigator.userAgent + navigator.platform)
      ? "Meta"
      : "Control",
  );
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedJSON = text;
        },
        write: async (items) => {
          await Promise.all(
            items.flatMap((item) =>
              item.types.map((type) =>
                item.getType(type).catch(() => new Blob([""])),
              ),
            ),
          );
        },
        readText: async () => "",
        read: async () => [],
      },
    }),
  );
  await page.goto(address);
  assert.equal(await page.title(), "TinkerCraft · PHP workspace");
  await page.getByTitle("TinkerCraft", { exact: true }).waitFor();
  await page.locator(".monaco-editor").waitFor();
  await page
    .getByRole("button", { name: "Run", exact: false })
    .first()
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  await page.locator(".repository-prompt").waitFor();
  await page.keyboard.press("F1");
  await page.getByLabel("Search commands").fill("Dismiss GitHub invitation");
  await page.keyboard.press("Enter");
  await page.locator(".repository-prompt").waitFor({ state: "detached" });
  assert.equal(await page.locator(".app-version").textContent(), "v0.2.0");
  const initialWorkspace = JSON.parse(
    await readFile(path.join(data, "workspace.json"), "utf8"),
  );
  async function savedCode(expected) {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      const workspace = JSON.parse(
        await readFile(path.join(data, "workspace.json"), "utf8"),
      );
      if (
        workspace.tabs.find((tab) => tab.id === workspace.activeTab)?.code ===
        expected
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Expected editor draft was not persisted: " + expected);
  }
  async function replaceCode(code) {
    await page.keyboard.press("Alt+1");
    await page.keyboard.press(`${modifier}+a`);
    await page.keyboard.insertText(code);
  }
  const compactPHP = "$items=[1,2];foreach($items as $item){echo $item;}";
  const formattedPHP =
    "$items = [1, 2];\nforeach ($items as $item) {\n    echo $item;\n}\n";
  await replaceCode(compactPHP);
  await page.keyboard.press("Alt+Shift+f");
  await savedCode(formattedPHP);
  await page.keyboard.press(`${modifier}+z`);
  await savedCode(compactPHP);
  await page.keyboard.press("F1");
  await page
    .getByLabel("Search commands", { exact: true })
    .fill("Format PHP code");
  await mkdir(path.join(root, "test-results"), { recursive: true });
  await page.screenshot({
    path: path.join(root, "test-results/tinkercraft-command-palette.png"),
    fullPage: true,
  });
  await page.keyboard.press("Enter");
  await savedCode(formattedPHP);
  await replaceCode("$invalid = ;");
  await page
    .getByRole("button", { name: "Format PHP code", exact: true })
    .click();
  await page
    .locator(".toast")
    .filter({ hasText: "Could not format PHP:" })
    .waitFor();
  await savedCode("$invalid = ;");
  await page.getByTitle("Dismiss notification", { exact: true }).click();
  const formattedWorkspace = JSON.parse(
    await readFile(path.join(data, "workspace.json"), "utf8"),
  );
  assert.equal(
    formattedWorkspace.history.length,
    initialWorkspace.history.length,
  );
  await page.keyboard.press(`${modifier}+,`);
  assert.equal(
    await page
      .getByText("path to phpactor.phar or PHP script", { exact: true })
      .count(),
    0,
  );
  await page.keyboard.press("Alt+4");
  assert.equal(
    await page.getByLabel("Indentation width", { exact: true }).inputValue(),
    "4",
  );
  await page
    .getByLabel("Formatting rules file", { exact: true })
    .setInputFiles({
      name: "unsafe.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"plugins":["untrusted"]}'),
    });
  await page
    .getByRole("alert")
    .filter({ hasText: "Unsupported formatting option: plugins" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Indentation width", { exact: true }).inputValue(),
    "4",
  );
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import JSON rules", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "my-style.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"tabWidth":2,"printWidth":80}'),
  });
  await page
    .getByText("Imported my-style.json. Save preferences to apply.", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("tab", { name: /^Formatting/ }).scrollIntoViewIfNeeded();
  await mkdir(path.join(root, "test-results"), { recursive: true });
  await page.screenshot({
    path: path.join(
      root,
      "test-results/tinkercraft-formatting-preferences.png",
    ),
    fullPage: true,
  });
  await page.keyboard.press(`${modifier}+s`);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await replaceCode(compactPHP);
  await page.keyboard.press("Alt+Shift+f");
  await savedCode(formattedPHP.replace("    echo", "  echo"));
  await page.reload();
  await page.locator(".monaco-editor textarea").waitFor();
  await page.keyboard.press(`${modifier}+,`);
  await page.keyboard.press("Alt+4");
  assert.equal(
    await page.getByLabel("Indentation width", { exact: true }).inputValue(),
    "2",
  );
  await page
    .getByRole("button", { name: "Restore default formatting", exact: true })
    .click();
  await page.keyboard.press(`${modifier}+s`);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  console.log(
    "PASS: safe JSON rule import, rejected plugins, custom indentation, preference persistence across reloads, and restoring defaults.",
  );
  const restoredDraft = await page.request.post(new URL("/api", address).href, {
    headers: { "X-TinkerCraft-Token": token },
    data: {
      method: "SaveWorkspace",
      args: [initialWorkspace.tabs, initialWorkspace.activeTab],
    },
  });
  assert(restoredDraft.ok());
  await page.reload();
  await page.locator(".monaco-editor textarea").waitFor();
  console.log(
    "PASS: offline PHP formatting through worker, shortcut, palette and button; undo, draft persistence, invalid-code preservation, and no implicit execution.",
  );
  const editorWidth = (await page.locator(".editor-panel").boundingBox()).width;
  await page.getByRole("button", { name: "Hide output", exact: true }).click();
  await page.locator(".output-panel").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".splitter").count(), 0);
  assert(
    (await page.locator(".editor-panel").boundingBox()).width >
      editorWidth * 1.5,
  );
  await page.keyboard.press(`${modifier}+j`);
  await page.locator(".output-panel").waitFor({ state: "visible" });
  assert(
    Math.abs(
      (await page.locator(".editor-panel").boundingBox()).width - editorWidth,
    ) < 3,
  );
  await page
    .getByRole("button", { name: "Toggle output visibility", exact: true })
    .click();
  await page.locator(".output-panel").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Run", exact: false }).first().click();
  await page.getByText("Execution completed", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("cell", { name: "Ana Silva", exact: true }).waitFor();
  await page.screenshot({
    path: path.join(root, "test-results/tinkercraft-english.png"),
    fullPage: true,
  });
  await page.keyboard.press(`${modifier}+,`);
  assert.equal(
    await page.getByLabel("Interface language", { exact: true }).inputValue(),
    "en",
  );
  await page
    .getByLabel("Interface language", { exact: true })
    .selectOption("pt-BR");
  const initialLanguageReload = page.waitForNavigation({ waitUntil: "load" });
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await initialLanguageReload;
  await page
    .getByRole("button", { name: "Executar", exact: false })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Autocomplete pronto", exact: true })
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "pt-BR");
  await page
    .getByRole("button", { name: "Autocomplete pronto", exact: true })
    .waitFor();
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("F1");
  await page.getByLabel("Buscar comando").fill("Localizar no editor");
  await page.keyboard.press("Enter");
  await page
    .locator(".find-widget .monaco-inputbox :is(input,textarea)")
    .first()
    .waitFor();
  assert.match(
    await page
      .locator(".find-widget .monaco-inputbox :is(input,textarea)")
      .first()
      .getAttribute("aria-label"),
    /localizar/i,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Executar", exact: false })
    .first()
    .click();
  await page.getByText("Execução concluída", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Tabela", exact: true }).click();
  await page.getByRole("cell", { name: "Ana Silva", exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 3);
  await page.getByLabel("Filtrar resultado").fill("Bruno");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "Ocultar saída", exact: true })
    .click();
  await page.locator(".output-panel").waitFor({ state: "hidden" });
  await page.keyboard.press(`${modifier}+j`);
  await page.getByLabel("Filtrar resultado").waitFor({ state: "visible" });
  assert.equal(
    await page.getByLabel("Filtrar resultado").inputValue(),
    "Bruno",
  );
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Filtrar resultado").fill("");
  await page
    .locator("th button")
    .filter({ hasText: /^name$/ })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  assert.equal((await download).suggestedFilename(), "resultado.csv");
  await mkdir(path.join(root, "test-results"), { recursive: true });
  await page.screenshot({
    path: path.join(root, "test-results/tinkercraft-table.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Autocomplete pronto", exact: true })
    .waitFor();
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText("$date = new \\DateTimeImmutable();\n$date->");
  await page.keyboard.press("Control+Space");
  await page
    .locator(".suggest-widget.visible")
    .getByText("format", { exact: true })
    .first()
    .waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText(
    'throw new RuntimeException("Teste de erro estruturado");',
  );
  await page.keyboard.press(`${modifier}+Enter`);
  await page.getByText("Teste de erro estruturado", { exact: true }).waitFor();
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText("sleep(10);\n42;");
  await page.keyboard.press(`${modifier}+Enter`);
  await page
    .getByRole("button", { name: "Cancelar", exact: false })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Cancelar", exact: false })
    .first()
    .click();
  await page.getByText("Execução cancelada", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Nova aba", exact: true }).click();
  assert.equal(await page.locator(".editor-tab").count(), 2);
  await page.getByRole("button", { name: "Nova conexão", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: "SSH + Docker", exact: false })
    .click();
  await page.getByPlaceholder("meu-servidor").waitFor();
  await page.getByText("Configurações avançadas", { exact: true }).click();
  const bootstrap = page.getByLabel("Bootstrap", { exact: true });
  await bootstrap.waitFor();
  await bootstrap.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  const selectStyle = await bootstrap.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
    appearance: getComputedStyle(el).appearance,
    image: getComputedStyle(el).backgroundImage,
    size: parseFloat(getComputedStyle(el).fontSize),
  }));
  assert.equal(selectStyle.background, "rgb(24, 24, 24)");
  assert.equal(selectStyle.appearance, "none");
  assert(selectStyle.image.includes("data:image/svg+xml"));
  assert(selectStyle.size >= 14);
  await page.screenshot({
    path: path.join(root, "test-results/tinkercraft-connections.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Nova conexão", exact: true }).click();
  await page.getByRole("button", { name: /^Docker/ }).click();
  await page
    .getByLabel("Nome da conexão", { exact: true })
    .fill("Container de teste");
  await page.getByLabel("Container PHP", { exact: true }).fill("php-test");
  await page
    .getByRole("button", { name: "Detectar diretório", exact: true })
    .click();
  await page.waitForFunction(
    (expected) =>
      document.querySelector('input[placeholder="/var/www/html"]')?.value ===
      expected,
    fixtureProject,
  );
  await page
    .getByRole("button", { name: "Salvar conexão", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Autocomplete pronto", exact: true })
    .waitFor();
  assert(
    (
      await page
        .getByRole("button", { name: "Autocomplete pronto", exact: true })
        .getAttribute("title")
    ).includes("cache atualizado"),
  );
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText(
    "$product = new \\App\\Product();\n$product->",
  );
  let cachedSuggestion = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.keyboard.press("Control+Space");
    try {
      await page
        .locator(".suggest-widget.visible")
        .getByText("description", { exact: true })
        .first()
        .waitFor({ timeout: 1500 });
      cachedSuggestion = true;
      break;
    } catch {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
  }
  assert(cachedSuggestion, "Completion for the cached project did not appear");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await page.locator(".history-item").first().waitFor();
  await page.waitForTimeout(600);
  await page.reload();
  await page.locator(".monaco-editor").waitFor();
  assert.equal(await page.locator(".editor-tab").count(), 2);
  await page.keyboard.press("F2");
  await page
    .getByLabel("Nome da aba", { exact: true })
    .fill("Consulta de amanhã");
  await page.keyboard.press("Enter");
  await page
    .locator(".editor-tab.active")
    .getByText("Consulta de amanhã", { exact: true })
    .waitFor();
  await page.keyboard.press("F2");
  await page
    .getByLabel("Nome da aba", { exact: true })
    .fill("Cancel this rename");
  await page.keyboard.press("Escape");
  await page
    .locator(".editor-tab.active")
    .getByText("Consulta de amanhã", { exact: true })
    .waitFor();
  const draft = "// Retomar amanhã, sem executar agora\n$tomorrow = 42;";
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText(draft);
  await page.keyboard.press(`${modifier}+s`);
  await page
    .getByText(
      "Abas salvas neste dispositivo. Elas serão restauradas ao reabrir o aplicativo.",
      { exact: true },
    )
    .waitFor();
  const phpDownload = page.waitForEvent("download");
  await page.keyboard.press(`${modifier}+Shift+s`);
  const phpFile = await phpDownload;
  assert.equal(phpFile.suggestedFilename(), "Consulta de amanhã.php");
  assert.equal(await readFile(await phpFile.path(), "utf8"), "<?php\n" + draft);
  await page.keyboard.press(`${modifier}+Shift+p`);
  await page
    .getByRole("dialog", { name: "Paleta de comandos", exact: true })
    .waitFor();
  await page.getByLabel("Buscar comando", { exact: true }).fill("Nova aba");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelectorAll(".editor-tab").length === 3,
  );
  await page.keyboard.press(`${modifier}+w`);
  await page.waitForFunction(
    () => document.querySelectorAll(".editor-tab").length === 2,
  );
  await page.keyboard.press(`${modifier}+Tab`);
  await page
    .locator(".editor-tab.active")
    .getByText("First idea", { exact: true })
    .waitFor();
  await page.keyboard.press(`${modifier}+Shift+Tab`);
  await page
    .locator(".editor-tab.active")
    .getByText("Consulta de amanhã", { exact: true })
    .waitFor();
  await page.keyboard.press(`${modifier}+Alt+k`);
  await page.getByRole("tab", { name: /^Atalhos de teclado/ }).waitFor();
  const runBinding = page.getByLabel("Executar ou cancelar — atalho", {
    exact: true,
  });
  await runBinding.press(`${modifier}+s`);
  await page.getByRole("alert").filter({ hasText: "mesmo atalho" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Salvar preferências", exact: true })
      .isDisabled(),
    true,
  );
  await runBinding.press(`${modifier}+Shift+Enter`);
  const completeBinding = page.getByLabel(
    "Mostrar sugestões de autocomplete — atalho",
    { exact: true },
  );
  await completeBinding.press(`${modifier}+Alt+Space`);
  const historyBinding = page.getByLabel("Histórico — atalho", { exact: true });
  await historyBinding.press(`${modifier}+Shift+h`);
  await page
    .getByLabel("Alternar visibilidade da saída — atalho", { exact: true })
    .press(`${modifier}+Shift+j`);
  await page.getByLabel("Buscar atalho", { exact: true }).fill("Executar");
  await page.screenshot({
    path: path.join(root, "test-results/tinkercraft-shortcuts.png"),
    fullPage: true,
  });
  await page.keyboard.press(`${modifier}+s`);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForFunction(() =>
    document
      .querySelector('[aria-label="Alternar visibilidade da saída"]')
      ?.getAttribute("title")
      ?.includes("Ctrl + Shift + J"),
  );
  await page.keyboard.press(`${modifier}+Shift+j`);
  await page.locator(".output-panel").waitFor({ state: "hidden" });
  await page.keyboard.press(`${modifier}+Shift+j`);
  await page.locator(".output-panel").waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    document
      .querySelector('[aria-label="Histórico"]')
      ?.getAttribute("title")
      ?.includes("Ctrl + Shift + H"),
  );
  assert(
    (
      await page
        .getByRole("button", { name: "Histórico", exact: true })
        .getAttribute("title")
    ).includes("Ctrl + Shift + H"),
  );
  assert(
    (await page.locator(".run-button kbd").textContent()).includes("Shift"),
  );
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.press("Backspace");
  await page.keyboard.type("[['name' => 'Tomorrow', 'active' => true]];");
  await page.keyboard.press(`${modifier}+Shift+Enter`);
  await page.getByText("Execução concluída", { exact: true }).waitFor();
  await page.keyboard.press(`${modifier}+Alt+2`);
  await page.getByRole("cell", { name: "Tomorrow", exact: true }).waitFor();
  const keyboardCSV = page.waitForEvent("download");
  await page.keyboard.press(`${modifier}+Shift+e`);
  assert(
    (await readFile(await (await keyboardCSV).path(), "utf8")).includes(
      '"Tomorrow"',
    ),
  );
  await page.keyboard.press(`${modifier}+Shift+c`);
  assert.deepEqual(await page.evaluate(() => JSON.parse(window.__copiedJSON)), [
    { name: "Tomorrow", active: true },
  ]);
  await page.keyboard.press(`${modifier}+Shift+h`);
  await page.locator(".history-item").first().waitFor();
  await page.keyboard.press(`${modifier}+Shift+h`);
  await page.getByRole("complementary").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Autocomplete pronto", exact: true })
    .waitFor();
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText("$date = new \\DateTimeImmutable();\n");
  await page.keyboard.type("$date->", { delay: 70 });
  await page
    .locator(".suggest-widget.visible")
    .getByText("format", { exact: true })
    .first()
    .waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press(`${modifier}+Alt+Space`);
  await page
    .locator(".suggest-widget.visible")
    .getByText("format", { exact: true })
    .first()
    .waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText(draft);
  await page.keyboard.press(`${modifier}+s`);
  await page
    .getByRole("status", { name: "Abas salvas", exact: true })
    .waitFor();
  await page.reload();
  await page.locator(".monaco-editor").waitFor();
  await page
    .locator(".editor-tab.active")
    .getByText("Consulta de amanhã", { exact: true })
    .waitFor();
  await page.waitForFunction(() =>
    document.querySelector(".run-button kbd")?.textContent.includes("Shift"),
  );
  assert(
    (await page.locator(".view-lines").textContent()).includes("$tomorrow"),
  );
  let updateDownloads = 0,
    installerOpens = 0;
  const releaseBuild = {
    version: "0.2.0",
    releaseSource: "https://github.com/Henriquex25/TinkerCraft",
    distribution: "deb",
    platform: "linux",
    architecture: "amd64",
    webkit: "4.0",
    variant: "linux-amd64-webkit40",
    commit: "test",
    buildDate: "",
  };
  await page.route("**/api", async (route) => {
    const request = route.request().postDataJSON();
    let result;
    if (request.method === "BuildInfo") result = releaseBuild;
    else if (request.method === "CheckUpdates")
      result = {
        build: releaseBuild,
        configured: true,
        source: "https://github.com/example/tinkercraft",
        available: true,
        latestVersion: "0.3.0",
        notes: "Melhorias de produtividade",
        releaseURL:
          "https://github.com/example/tinkercraft/releases/tag/v0.3.0",
        canDownload: true,
        packageName: "tinkercraft_0.3.0_linux_amd64_webkit40.deb",
        packageSize: 1024,
        message: "Uma nova versão está disponível",
        checkedAt: new Date().toISOString(),
      };
    else if (request.method === "DownloadUpdate") {
      updateDownloads++;
      result = { path: "/isolated/verified.deb", version: "0.3.0", size: 1024 };
    } else if (request.method === "OpenUpdateInstaller") {
      installerOpens++;
      result = null;
    } else return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result }),
    });
  });
  await page.keyboard.press(`${modifier}+,`);
  await page.keyboard.press("Alt+3");
  assert.equal(
    await page.getByLabel("Fonte de atualizações", { exact: true }).count(),
    0,
  );
  await page
    .getByLabel("Verificar atualizações ao iniciar", { exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Salvar preferências", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.keyboard.press(`${modifier}+,`);
  await page.keyboard.press("Alt+3");
  assert.equal(
    await page.getByLabel("Fonte de atualizações", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByLabel("Verificar atualizações ao iniciar", { exact: true })
      .isChecked(),
    false,
  );
  await page
    .getByLabel("Verificar atualizações ao iniciar", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Salvar preferências", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page
    .getByRole("button", { name: "Atualização disponível", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(updateDownloads, 0);
  assert.equal(installerOpens, 0);
  await page
    .getByRole("button", { name: "Atualização disponível", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Sobre e atualizações", exact: true })
    .waitFor();
  await page.getByText("Versão 0.3.0 disponível", { exact: true }).waitFor();
  await page.screenshot({
    path: path.join(root, "test-results/tinkercraft-update.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Baixar atualização", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Abrir instalador do sistema", exact: true })
    .waitFor();
  assert.equal(updateDownloads, 1);
  assert.equal(installerOpens, 0);
  await page
    .getByRole("button", { name: "Abrir instalador do sistema", exact: true })
    .click();
  await page.getByText(/Conclua a instalação na janela do sistema/).waitFor();
  assert.equal(installerOpens, 1);
  await page.keyboard.press("Escape");
  console.log(
    "PASS: update preferences, opt-out/persistence, startup badge, release dialog and explicit download/installer actions (isolated release and installer fixtures).",
  );
  await page.keyboard.press(`${modifier}+,`);
  await page.keyboard.press("Alt+1");
  assert.equal(
    await page.getByLabel("Idioma da interface", { exact: true }).inputValue(),
    "pt-BR",
  );
  await page
    .getByLabel("Idioma da interface", { exact: true })
    .selectOption("en");
  const englishReload = page.waitForNavigation({ waitUntil: "load" });
  await page
    .getByRole("button", { name: "Salvar preferências", exact: true })
    .click();
  await englishReload;
  await page
    .locator(".editor-tab.active")
    .getByText("Consulta de amanhã", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Completion ready", exact: true })
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert(
    (await page.locator(".view-lines").textContent()).includes("$tomorrow"),
  );
  assert(
    (await page.locator(".run-button kbd").textContent()).includes("Shift"),
  );
  await page.keyboard.press("F1");
  await page.getByLabel("Search commands").fill("Find in editor");
  await page.keyboard.press("Enter");
  const englishFind = page
    .locator(".find-widget .monaco-inputbox :is(input,textarea)")
    .first();
  await englishFind.waitFor();
  assert.match(await englishFind.getAttribute("aria-label"), /find/i);
  await page.keyboard.press("Escape");
  await page.keyboard.press(`${modifier}+,`);
  assert.equal(
    await page.getByLabel("Interface language", { exact: true }).inputValue(),
    "en",
  );
  await page.keyboard.press("Escape");
  console.log(
    "PASS: English default, persisted English/Portuguese selection, translated Monaco find, and unchanged named drafts and shortcuts across locale reloads.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: keyboard command palette, rename/cancel rename, persistent unexecuted drafts, PHP file export, tab navigation, shortcut conflicts/remapping/persistence, dynamic tooltips, keyboard run/CSV/JSON copy and automatic/manual completion.",
  );
  console.log(
    "PASS: Monaco + real Phpactor suggestions, PHP execution, table/filter/sort/CSV, errors, cancel, tabs, profiles, history, persistence, directory detection and automatic source cache (simulated Docker).",
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await mkdir(path.join(root, "test-results"), { recursive: true });
    await page
      .screenshot({
        path: path.join(root, "test-results/tinkercraft-failure.png"),
        fullPage: true,
      })
      .catch(() => {});
    console.error(
      await page.evaluate(() => ({
        editor: document.querySelector(".view-lines")?.textContent,
        error: document.querySelector(".error-card")?.textContent,
        toast: document.querySelector(".toast")?.textContent,
        completion: document
          .querySelector(".language-status")
          ?.getAttribute("title"),
        focus: document.activeElement?.outerHTML.slice(0, 500),
      })),
    );
  }
  throw error;
} finally {
  await browser?.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
  await rm(data, { recursive: true, force: true });
}
