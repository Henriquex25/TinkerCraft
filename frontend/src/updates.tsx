import { useEffect, useRef, useState } from "react";
import { ReleaseNotes } from "./release-notes";
import {
  ArrowUpCircle,
  Check,
  RefreshCw,
  ExternalLink,
  LoaderCircle,
  Coffee,
} from "lucide-react";
import { api, errorText } from "./api";
import { Modal } from "./dialogs";
import { Shortcut, useCommandActions, useCommandHints } from "./commands";
import { t as tr, formatLocale, translateStatus } from "./i18n";
import type { BuildInfo, UpdateInfo } from "./types";
import { BrandIcon } from "./brand";

type UpdatePhase = "idle" | "downloading" | "installing" | "restarting";
export function useAppUpdate(save: () => Promise<void>) {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(
    () =>
      window.runtime?.EventsOn("update:progress", (value) => {
        if (
          pending.current &&
          (value === "downloading" || value === "installing")
        )
          setPhase(value);
      }),
    [],
  );
  async function run() {
    if (pending.current) return;
    pending.current = true;
    setError("");
    setPhase("downloading");
    try {
      await save();
      await api.UpdateApp();
      setPhase("restarting");
      await save();
      await api.RestartUpdatedApp();
    } catch (error) {
      setError(errorText(error));
      setPhase("idle");
      pending.current = false;
    }
  }
  return { phase, busy: phase !== "idle", error, run };
}
type UpdateAction = ReturnType<typeof useAppUpdate>;
const phaseText = (phase: UpdatePhase) =>
  tr(
    {
      idle: "Your snippets, connections, and preferences remain in the local workspace.",
      downloading: "Downloading and verifying package…",
      installing: "Authorize the update in the Linux dialog. Installing…",
      restarting: "Saving your tabs and restarting TinkerCraft…",
    }[phase],
  );
function UpdateButton({
  info,
  updater,
  command = "updates.install",
}: {
  info: UpdateInfo;
  updater: UpdateAction;
  command?: string;
}) {
  const hints = useCommandHints();
  return (
    <button
      className="primary-button"
      aria-label={tr("Update")}
      title={hints.title(command)}
      disabled={
        updater.busy ||
        !info.canInstall ||
        (!info.canDownload && !info.restartRequired)
      }
      onClick={updater.run}
    >
      {updater.busy ? (
        <LoaderCircle size={16} className="spin" />
      ) : (
        <ArrowUpCircle size={16} />
      )}
      {tr("Update")} <Shortcut id={command} />
    </button>
  );
}
export function UpdatePrompt({
  info,
  updater,
  dismiss,
  details,
}: {
  info: UpdateInfo;
  updater: UpdateAction;
  dismiss: () => void;
  details: () => void;
}) {
  useCommandActions({
    "updates.accept": {
      enabled:
        !updater.busy &&
        info.canInstall &&
        (info.canDownload || info.restartRequired),
      run: updater.run,
    },
    "updates.dismiss": { enabled: !updater.busy, run: dismiss },
  });
  return (
    <aside
      className="repository-prompt update-prompt"
      aria-labelledby="update-prompt-title"
      aria-live="polite"
    >
      <div className="repository-prompt-heading">
        <ArrowUpCircle size={20} aria-hidden="true" />
        <h2 id="update-prompt-title">
          {tr("Version {0} available", [info.latestVersion])}
        </h2>
      </div>
      <p>
        {updater.busy
          ? phaseText(updater.phase)
          : tr(
              info.restartRequired
                ? "The update is already installed. Restart to use the new version."
                : "Update TinkerCraft and continue with your tabs restored. Linux may ask for administrator authorization.",
            )}
      </p>
      {updater.error && (
        <p className="form-error" role="alert">
          {updater.error}
        </p>
      )}
      <button
        className="text-button"
        title={tr("Release notes")}
        onClick={details}
      >
        {tr("Release notes")}
      </button>
      <div className="repository-prompt-actions">
        <button
          className="secondary-button"
          disabled={updater.busy}
          onClick={dismiss}
        >
          {tr("Remind me later")} <Shortcut id="updates.dismiss" />
        </button>
        <UpdateButton info={info} updater={updater} command="updates.accept" />
      </div>
    </aside>
  );
}
export function UpdatesDialog({
  info,
  build,
  checking,
  error,
  check,
  close,
  support,
  updater,
}: {
  info?: UpdateInfo;
  build?: BuildInfo;
  checking: boolean;
  error: string;
  check: () => void;
  close: () => void;
  support: () => void;
  updater: UpdateAction;
}) {
  const [failure, setFailure] = useState("");
  const hints = useCommandHints();
  async function release() {
    try {
      await api.OpenUpdateRelease();
    } catch (e) {
      setFailure(errorText(e));
    }
  }
  useCommandActions({
    "updates.check": { enabled: !checking && !updater.busy, run: check },
    "updates.install": {
      enabled:
        Boolean(
          info?.available &&
          info.canInstall &&
          (info.canDownload || info.restartRequired),
        ) &&
        !checking &&
        !updater.busy,
      run: updater.run,
    },
    "updates.release": { enabled: Boolean(info?.releaseURL), run: release },
  });
  return (
    <Modal
      title={tr("About and updates")}
      eyebrow="TINKERCRAFT"
      close={close}
      className="updates-modal"
      scope="updates"
    >
      <div className="updates-content">
        <div className="update-heading">
          <BrandIcon />
          <div>
            <h3>TinkerCraft</h3>
            <p>
              {tr("Version")} {build?.version ?? info?.build.version ?? "…"}
            </p>
          </div>
        </div>
        <div className="project-support">
          <div>
            <strong>{tr("Support TinkerCraft")}</strong>
            <p>{tr("Support continued development with a coffee.")}</p>
          </div>
          <button
            className="secondary-button"
            onClick={support}
            title={hints.title("community.support")}
          >
            <Coffee size={16} aria-hidden="true" />
            {tr("Buy me a coffee")} <Shortcut id="community.support" />
          </button>
        </div>
        <div className={`update-summary ${info?.available ? "available" : ""}`}>
          {checking || updater.busy ? (
            <LoaderCircle size={22} className="spin" />
          ) : info?.available ? (
            <ArrowUpCircle size={22} />
          ) : info?.configured ? (
            <Check size={22} />
          ) : (
            <RefreshCw size={22} />
          )}
          <div>
            <strong>
              {checking
                ? tr("Checking for updates…")
                : info?.available
                  ? tr("Version {0} available", [info.latestVersion])
                  : tr(
                      translateStatus(info?.message || "") ||
                        "Check whether a new version is available",
                    )}
            </strong>
            <p>
              {updater.busy
                ? phaseText(updater.phase)
                : info?.restartRequired
                  ? tr(
                      "The update is already installed. Restart to use the new version.",
                    )
                  : info?.available && !info.canInstall
                    ? tr(
                        "Automatic updates are available in the installed Debian app. Install the official .deb package first.",
                      )
                    : info?.canDownload
                      ? tr(
                          "The package is {0} MiB. TinkerCraft will install it and restart after Linux authorization.",
                          [
                            (info.packageSize / 1024 / 1024).toLocaleString(
                              formatLocale(),
                              {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              },
                            ),
                          ],
                        )
                      : !info?.configured
                        ? tr(
                            "Updates are unavailable in this development build.",
                          )
                        : phaseText("idle")}
            </p>
          </div>
        </div>
        {(updater.error || failure || error) && (
          <div className="form-error" role="alert">
            {updater.error || failure || error}
          </div>
        )}
        {info?.notes && (
          <details className="release-notes">
            <summary>{tr("Release notes")}</summary>
            <ReleaseNotes notes={info.notes} />
          </details>
        )}
        {info?.checkedAt && (
          <p className="field-hint">
            {tr("Last checked:")}{" "}
            {new Date(info.checkedAt).toLocaleString(formatLocale())}
          </p>
        )}
        <div className="update-actions">
          <button
            className="secondary-button"
            title={hints.title("updates.check")}
            onClick={check}
            disabled={checking || updater.busy}
          >
            <RefreshCw size={15} />
            {tr("Check now")} <Shortcut id="updates.check" />
          </button>
          {info?.releaseURL && (
            <button
              className="secondary-button"
              title={hints.title("updates.release")}
              onClick={release}
            >
              <ExternalLink size={15} />
              {tr("View release")} <Shortcut id="updates.release" />
            </button>
          )}
          {info?.available && <UpdateButton info={info} updater={updater} />}
        </div>
        <p className="update-footnote">
          {tr(
            "Updates start only when you choose Update. If authorization or installation fails, the app stays open.",
          )}
        </p>
      </div>
    </Modal>
  );
}
