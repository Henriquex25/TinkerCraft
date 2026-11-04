import { translateStatus } from "./i18n";
import { t as tr } from "./i18n";
import { formatLocale } from "./i18n";
import { useEffect, useState } from "react";
import {
  ArrowUpCircle,
  Check,
  Download,
  ExternalLink,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Coffee,
} from "lucide-react";
import { api, errorText } from "./api";
import { Modal } from "./dialogs";
import { Shortcut, useCommandActions, useCommandHints } from "./commands";
import type { BuildInfo, UpdateInfo } from "./types";
import { BrandIcon } from "./brand";
export function UpdatesDialog({
  info,
  build,
  checking,
  error,
  check,
  close,
  support,
}: {
  info?: UpdateInfo;
  build?: BuildInfo;
  checking: boolean;
  error: string;
  check: () => void;
  close: () => void;
  support: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [opened, setOpened] = useState(false);
  const [failure, setFailure] = useState("");
  const hints = useCommandHints();
  useEffect(() => {
    setDownloaded(false);
    setOpened(false);
  }, [info]);
  async function download() {
    setDownloading(true);
    setFailure("");
    try {
      await api.DownloadUpdate();
      setDownloaded(true);
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setDownloading(false);
    }
  }
  async function install() {
    setFailure("");
    try {
      await api.OpenUpdateInstaller();
      setOpened(true);
    } catch (e) {
      setFailure(errorText(e));
    }
  }
  async function release() {
    try {
      await api.OpenUpdateRelease();
    } catch (e) {
      setFailure(errorText(e));
    }
  }
  useCommandActions({
    "updates.check": { enabled: !checking && !downloading, run: check },
    "updates.download": {
      enabled: Boolean(info?.canDownload) && !downloading && !checking,
      run: download,
    },
    "updates.install": { enabled: downloaded && !downloading, run: install },
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
              {tr("Version") + " "}
              {build?.version ?? info?.build.version ?? "…"}
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
          {checking ? (
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
              {downloading
                ? tr("Downloading and verifying package…")
                : opened
                  ? tr(
                      "Complete installation in the system window, then close this window and reopen TinkerCraft from the Linux menu.",
                    )
                  : downloaded
                    ? tr(
                        "Package downloaded and SHA-256 verified. You can open the Linux installer.",
                      )
                    : info?.canDownload
                      ? tr(
                          "The package is {0} MiB. The system installer will ask for authorization.",
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
                            "Configure the GitHub repository URL in Preferences → Updates.",
                          )
                        : tr(
                            "Your snippets, connections, and preferences remain in the local workspace.",
                          )}
            </p>
          </div>
        </div>
        {(failure || error) && (
          <div className="form-error" role="alert">
            {failure || error}
          </div>
        )}
        {info?.notes && (
          <details className="release-notes" open>
            <summary>{tr("Release notes")}</summary>
            <pre>{info.notes}</pre>
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
            disabled={checking || downloading}
          >
            <RefreshCw size={15} />
            {tr("Check now") + " "}
            <Shortcut id="updates.check" />
          </button>
          {info?.releaseURL && (
            <button
              className="secondary-button"
              title={hints.title("updates.release")}
              onClick={release}
            >
              <ExternalLink size={15} />
              {tr("View release") + " "}
              <Shortcut id="updates.release" />
            </button>
          )}
          {info?.canDownload && !downloaded && (
            <button
              className="primary-button"
              aria-label={tr("Download update")}
              title={hints.title("updates.download")}
              onClick={download}
              disabled={downloading || checking}
            >
              {downloading ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Download size={15} />
              )}
              {tr("Download update") + " "}
              <Shortcut id="updates.download" />
            </button>
          )}
          {downloaded && (
            <button
              className="primary-button"
              aria-label={tr("Open system installer")}
              title={hints.title("updates.install")}
              onClick={install}
            >
              <PackageCheck size={16} />
              {tr("Open system installer") + " "}
              <Shortcut id="updates.install" />
            </button>
          )}
        </div>
        <p className="update-footnote">
          {tr(
            "TinkerCraft does not install updates in the background. Restart the app after installation to use the new version.",
          )}
        </p>
      </div>
    </Modal>
  );
}
