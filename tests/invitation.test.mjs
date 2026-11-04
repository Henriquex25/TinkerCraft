import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, webkit } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const engine =
  process.env.TINKERCRAFT_UI_BROWSER === "chromium" ? chromium : webkit;
const browser = await engine.launch({
  headless: true,
  ...(process.env.TINKERCRAFT_BROWSER_PATH
    ? { executablePath: process.env.TINKERCRAFT_BROWSER_PATH }
    : {}),
});
try {
  for (const choice of [
    "decline",
    "star",
    "support-decline",
    "support",
    "support-early",
  ]) {
    const data = await mkdtemp(path.join(tmpdir(), "tinkercraft-invitation-"));
    const donation = choice.startsWith("support");
    if (donation) {
      await writeFile(
        path.join(data, "workspace.json"),
        JSON.stringify({
          version: 1,
          launchCount: choice === "support-early" ? 0 : 4,
          settings: {
            language: "en",
            phpBinary: "php",
            cacheDays: 7,
            starPromptDismissed: true,
          },
          profiles: [],
          tabs: [],
          activeTab: "",
          history: [{ id: "fixture", code: "42;", success: true }],
        }),
      );
    }
    let server, context;
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
          env: { ...process.env, TINKERCRAFT_RELEASE_SOURCE: "" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const address = await new Promise((resolve, reject) => {
        let output = "",
          errors = "";
        const timer = setTimeout(
          () => reject(new Error("Backend did not start: " + errors)),
          60000,
        );
        server.stderr.on("data", (chunk) => {
          errors = (errors + chunk).slice(-10000);
        });
        server.stdout.on("data", (chunk) => {
          output += chunk;
          const match = /TinkerCraft dev: (http:\/\/\S+)/.exec(output);
          if (match) {
            clearTimeout(timer);
            resolve(match[1]);
          }
        });
        server.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        server.on("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Backend exit ${code}: ${errors}`));
        });
      });
      context = await browser.newContext({
        viewport: { width: 1440, height: 950 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.__repositoryOpens = [];
        window.open = (url, target, features) => {
          window.__repositoryOpens.push({ url, target, features });
          return null;
        };
      });
      await page.goto(address);
      if (choice === "support-early") {
        await page.locator(".run-button").waitFor();
        assert.equal(await page.locator(".repository-prompt").count(), 0);
        await page.keyboard.press("F1");
        await page.getByLabel("Search commands").fill("About and updates");
        await page.keyboard.press("Enter");
        await page
          .getByRole("button", { name: "Buy me a coffee", exact: true })
          .click();
        await page.waitForFunction(() => window.__repositoryOpens.length === 1);
        assert.equal(
          (await page.evaluate(() => window.__repositoryOpens))[0].url,
          "https://www.buymeacoffee.com/henriquemiranda",
        );
        const saved = JSON.parse(
          await readFile(path.join(data, "workspace.json"), "utf8"),
        );
        assert.equal(saved.settings.donationPromptDismissed, true);
        console.log(
          "PASS: support remains available in About before the delayed invitation, without displaying an early prompt.",
        );
        continue;
      }
      await page.locator(".repository-prompt").waitFor();
      assert.equal(
        await page.locator(".repository-prompt").getAttribute("data-kind"),
        donation ? "donation" : "star",
      );
      assert.equal(
        await page.locator(".repository-prompt").getByRole("button").count(),
        2,
      );
      assert.equal(
        await page.evaluate(() =>
          Boolean(document.activeElement?.closest(".repository-prompt")),
        ),
        false,
      );
      let button = "No, thanks";
      if (choice === "star" || choice === "support") {
        await page.keyboard.press("Control+,");
        await page
          .getByLabel("Interface language", { exact: true })
          .selectOption("pt-BR");
        const navigation = page.waitForNavigation({ waitUntil: "load" });
        await page
          .getByRole("button", { name: "Save preferences", exact: true })
          .click();
        await navigation;
        await page
          .getByRole("heading", {
            name: donation ? "Apoie o TinkerCraft" : "Gostando do TinkerCraft?",
            exact: true,
          })
          .waitFor();
        button = donation ? "Pague um café" : "Dar estrela no GitHub";
        await page.route("**/api", async (route) => {
          if (
            route.request().postDataJSON()?.method ===
            (donation ? "DismissDonationPrompt" : "DismissStarPrompt")
          )
            return route.fulfill({
              status: 422,
              contentType: "application/json",
              body: JSON.stringify({
                error: "Fixture: could not save preference",
              }),
            });
          await route.continue();
        });
        await page.getByRole("button", { name: button, exact: true }).click();
        await page
          .getByRole("alert")
          .getByText("Fixture: could not save preference", { exact: true })
          .waitFor();
        assert.deepEqual(
          await page.evaluate(() => window.__repositoryOpens),
          [],
        );
        assert(
          !JSON.parse(await readFile(path.join(data, "workspace.json"), "utf8"))
            .settings[
            donation ? "donationPromptDismissed" : "starPromptDismissed"
          ],
        );
        await page.unroute("**/api");
        await mkdir(path.join(root, "test-results"), { recursive: true });
        await page.screenshot({
          path: path.join(
            root,
            donation
              ? "test-results/tinkercraft-support-invitation.png"
              : "test-results/tinkercraft-star-invitation.png",
          ),
        });
      }
      await page.getByRole("button", { name: button, exact: true }).click();
      await page.locator(".repository-prompt").waitFor({ state: "detached" });
      if (choice === "star" || choice === "support")
        await page.waitForFunction(() => window.__repositoryOpens.length === 1);
      assert.deepEqual(
        await page.evaluate(() => window.__repositoryOpens),
        choice === "star" || choice === "support"
          ? [
              {
                url: donation
                  ? "https://www.buymeacoffee.com/henriquemiranda"
                  : "https://github.com/Henriquex25/TinkerCraft",
                target: "_blank",
                features: "noopener,noreferrer",
              },
            ]
          : [],
      );
      const saved = JSON.parse(
        await readFile(path.join(data, "workspace.json"), "utf8"),
      );
      assert.equal(saved.settings.starPromptDismissed, true);
      if (donation) assert.equal(saved.settings.donationPromptDismissed, true);
      assert.equal(saved.history.length, donation ? 1 : 0);
      await context.close();
      context = await browser.newContext();
      const reopened = await context.newPage();
      await reopened.goto(address);
      await reopened.locator(".run-button").waitFor();
      assert.equal(await reopened.locator(".repository-prompt").count(), 0);
      assert.deepEqual(errors, []);
      console.log(
        `PASS: ${choice} invitation persists in a fresh browser session; locale, save failure, and browser opening verified without visiting GitHub.`,
      );
    } finally {
      await context?.close();
      if (server?.pid) {
        try {
          process.kill(-server.pid, "SIGTERM");
        } catch {}
      }
      await rm(data, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
