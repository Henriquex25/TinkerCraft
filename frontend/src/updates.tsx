import { useEffect, useState } from "react";
import {
  ArrowUpCircle,
  Check,
  Download,
  ExternalLink,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
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
}: {
  info?: UpdateInfo;
  build?: BuildInfo;
  checking: boolean;
  error: string;
  check: () => void;
  close: () => void;
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
      title="Sobre e atualizações"
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
            <p>Versão {build?.version ?? info?.build.version ?? "…"}</p>
          </div>
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
                ? "Verificando atualizações…"
                : info?.available
                  ? `Versão ${info.latestVersion} disponível`
                  : info?.message || "Verifique se há uma nova versão"}
            </strong>
            <p>
              {downloading
                ? "Baixando e conferindo o pacote…"
                : opened
                  ? "Conclua a instalação na janela do sistema e depois feche esta janela e abra o TinkerCraft pelo menu do Linux."
                  : downloaded
                    ? "Pacote baixado e integridade SHA-256 conferida. Você pode abrir o instalador do Linux."
                    : info?.canDownload
                      ? `O pacote tem ${(info.packageSize / 1024 / 1024).toFixed(1)} MiB. O instalador do sistema pedirá autorização para instalar.`
                      : !info?.configured
                        ? "Configure a URL do repositório GitHub em Preferências → Atualizações."
                        : "Seus códigos, conexões e preferências permanecem no workspace local."}
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
            <summary>Novidades da versão</summary>
            <pre>{info.notes}</pre>
          </details>
        )}
        {info?.checkedAt && (
          <p className="field-hint">
            Última verificação:{" "}
            {new Date(info.checkedAt).toLocaleString("pt-BR")}
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
            Verificar agora <Shortcut id="updates.check" />
          </button>
          {info?.releaseURL && (
            <button
              className="secondary-button"
              title={hints.title("updates.release")}
              onClick={release}
            >
              <ExternalLink size={15} />
              Ver release <Shortcut id="updates.release" />
            </button>
          )}
          {info?.canDownload && !downloaded && (
            <button
              className="primary-button"
              aria-label="Baixar atualização"
              title={hints.title("updates.download")}
              onClick={download}
              disabled={downloading || checking}
            >
              {downloading ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Download size={15} />
              )}
              Baixar atualização <Shortcut id="updates.download" />
            </button>
          )}
          {downloaded && (
            <button
              className="primary-button"
              aria-label="Abrir instalador do sistema"
              title={hints.title("updates.install")}
              onClick={install}
            >
              <PackageCheck size={16} />
              Abrir instalador do sistema <Shortcut id="updates.install" />
            </button>
          )}
        </div>
        <p className="update-footnote">
          O TinkerCraft não instala atualizações em segundo plano. Após
          instalar, reinicie o aplicativo para usar a nova versão.
        </p>
      </div>
    </Modal>
  );
}
