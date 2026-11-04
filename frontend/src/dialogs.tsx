import { useEffect, useState } from "react";
import {
  Box,
  Braces,
  Wand2,
  Check,
  ChevronRight,
  Copy,
  Folder,
  FolderOpen,
  Globe,
  KeyRound,
  LoaderCircle,
  Monitor,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { api, errorText } from "./api";
import { Shortcut, useCommandActions, useCommandHints } from "./commands";
import { Keybindings } from "./keybindings";
import { bindingErrors } from "./shortcuts";
import type { BuildInfo, Container, Health, Profile, Settings } from "./types";

export const modeLabel = (mode: string) =>
  ({
    local: "Local",
    docker: "Docker local",
    ssh: "SSH",
    "ssh-docker": "Docker via SSH",
  })[mode] ?? mode;
export const ModeIcon = ({
  mode,
  size = 15,
}: {
  mode: string;
  size?: number;
}) =>
  mode === "local" ? (
    <Folder size={size} />
  ) : mode === "docker" ? (
    <Box size={size} />
  ) : mode === "ssh" ? (
    <Server size={size} />
  ) : (
    <Globe size={size} />
  );
export const newProfile = (): Profile => ({
  id: "",
  name: "",
  mode: "local",
  projectPath: "",
  localPath: "",
  autocomplete: "auto",
  phpBinary: "php",
  container: "",
  ssh: { host: "", user: "", port: 0, identityFile: "" },
  bootstrap: "auto",
  bootstrapFile: "",
  timeout: 30,
});

export function Modal({
  title,
  eyebrow,
  close,
  children,
  className = "",
  scope = "profile",
}: {
  title: string;
  eyebrow: string;
  close: () => void;
  children: React.ReactNode;
  className?: string;
  scope?: "profile" | "settings" | "dialog" | "language" | "updates";
}) {
  const hints = useCommandHints();
  useCommandActions({
    "dialog.close": close,
    "dialog.save": {
      enabled: scope === "profile" || scope === "settings",
      run: () => {
        const form = document.querySelector<HTMLFormElement>(
          `[data-command-scope="${scope}"] form`,
        );
        if (form && !form.querySelector('button[type="submit"]:disabled'))
          form.requestSubmit();
      },
    },
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const input = dialog?.querySelector("input,button") as HTMLElement;
    input?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...(dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? []),
      ];
      if (!nodes.length) return;
      if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
        e.preventDefault();
        nodes[0].focus();
      }
    };
    dialog?.addEventListener("keydown", trap);
    return () => {
      dialog?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-command-scope={scope}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            title={hints.title("dialog.close", "Fechar")}
            aria-label="Fechar"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ProfileDialog({
  profiles,
  initial,
  close,
  saved,
  deleted,
}: {
  profiles: Profile[];
  initial?: Profile;
  close: () => void;
  saved: (profile: Profile) => void;
  deleted: (id: string) => void;
}) {
  const [form, setForm] = useState<Profile>(() =>
    initial ? structuredClone(initial) : newProfile(),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [test, setTest] = useState("");
  const [containers, setContainers] = useState<Container[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remote = form.mode.includes("ssh"),
    docker = form.mode.includes("docker");
  const autocomplete = form.autocomplete ?? (form.localPath ? "local" : "auto");
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    setError("");
    setTest("");
    setConfirmDelete(false);
  }
  function ssh<K extends keyof Profile["ssh"]>(
    key: K,
    value: Profile["ssh"][K],
  ) {
    update("ssh", { ...form.ssh, [key]: value });
  }
  async function browse(key: "projectPath" | "localPath") {
    try {
      const value = await api.ChooseDirectory();
      if (value) update(key, value);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function loadContainers() {
    setBusy("containers");
    setError("");
    try {
      const items = await api.ListContainers(form);
      setContainers(items);
      if (!items.length)
        setError("Nenhum container em execução nesse ambiente.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function detectDirectory(container = form.container) {
    if (!container.trim()) {
      setError(
        "Informe ou selecione um container antes de detectar o diretório.",
      );
      return;
    }
    setBusy("detect");
    setError("");
    try {
      const dir = await api.ContainerWorkdir(
        { ...form, container, projectPath: form.projectPath || "/" },
        container,
      );
      setForm((current) =>
        current.container === container
          ? { ...current, projectPath: dir }
          : current,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function chooseContainer(container: string) {
    update("container", container);
    await detectDirectory(container);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError("");
    try {
      const profile = await api.SaveProfile(form);
      saved(profile);
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function testConnection() {
    setBusy("test");
    setError("");
    setTest("");
    try {
      const result = await api.TestConnection(form);
      if (!result.success)
        throw new Error(
          result.error?.message || result.stderr || "Conexão não estabelecida",
        );
      setTest(`Conexão estabelecida · PHP ${result.phpVersion}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy("delete");
    try {
      await api.DeleteProfile(form.id);
      deleted(form.id);
      setForm(newProfile());
      setConfirmDelete(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  function selectProfile(profile?: Profile) {
    setForm(profile ? structuredClone(profile) : newProfile());
    setContainers([]);
    setError("");
    setTest("");
    setConfirmDelete(false);
  }
  const hints = useCommandHints();
  async function chooseIdentity() {
    try {
      const file = await api.ChooseFile();
      if (file) ssh("identityFile", file);
    } catch (error) {
      setError(errorText(error));
    }
  }
  useCommandActions({
    "profile.new": { enabled: !busy, run: () => selectProfile() },
    "profile.test": { enabled: !busy, run: testConnection },
    "profile.containers": { enabled: docker && !busy, run: loadContainers },
    "profile.detect": {
      enabled: docker && !busy,
      run: () => detectDirectory(),
    },
    "profile.directory": {
      enabled: !remote && !docker && !busy,
      run: () => browse("projectPath"),
    },
    "profile.sources": {
      enabled: autocomplete === "local" && !busy,
      run: () => browse("localPath"),
    },
    "profile.identity": { enabled: remote && !busy, run: chooseIdentity },
    "profile.delete": { enabled: Boolean(form.id) && !busy, run: remove },
  });
  return (
    <Modal
      title="Conexões"
      eyebrow="AMBIENTE DE EXECUÇÃO"
      close={close}
      className="connections-modal"
    >
      <div className="connections-body">
        <aside className="connections-list">
          <button
            className={`new-connection ${!form.id ? "active" : ""}`}
            onClick={() => selectProfile()}
          >
            <Plus size={17} />
            Nova conexão <Shortcut id="profile.new" />
          </button>
          <div className="list-label">SEUS AMBIENTES</div>
          {profiles.map((profile) => (
            <button
              className={`connection-item ${form.id === profile.id ? "active" : ""}`}
              key={profile.id}
              onClick={() => selectProfile(profile)}
            >
              <ModeIcon mode={profile.mode} size={17} />
              <div>
                <strong>{profile.name}</strong>
                <span>{modeLabel(profile.mode)}</span>
              </div>
              <ChevronRight size={14} />
            </button>
          ))}
          <div className="connection-note">
            <KeyRound size={18} />
            <p>SSH usa suas chaves e configurações do OpenSSH.</p>
          </div>
        </aside>
        <form className="connection-form" onSubmit={save}>
          <div className="mode-grid">
            {(
              [
                {
                  mode: "local",
                  name: "Local",
                  detail: "PHP nesta máquina",
                  icon: Monitor,
                },
                {
                  mode: "docker",
                  name: "Docker",
                  detail: "Container local",
                  icon: Box,
                },
                {
                  mode: "ssh",
                  name: "SSH",
                  detail: "Servidor remoto",
                  icon: Server,
                },
                {
                  mode: "ssh-docker",
                  name: "SSH + Docker",
                  detail: "Container remoto",
                  icon: Globe,
                },
              ] as const
            ).map((item) => (
              <button
                type="button"
                className={form.mode === item.mode ? "selected" : ""}
                key={item.mode}
                onClick={() => {
                  update("mode", item.mode);
                  setContainers([]);
                }}
              >
                <item.icon size={21} />
                <strong>{item.name}</strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>Nome da conexão</span>
            <input
              required
              placeholder="Meu projeto Laravel"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          {remote && (
            <>
              <div className="form-row">
                <label className="field grow">
                  <span>Host ou alias SSH</span>
                  <input
                    required
                    placeholder="meu-servidor"
                    value={form.ssh.host}
                    onChange={(e) => ssh("host", e.target.value)}
                  />
                </label>
                <label className="field port-field">
                  <span>Porta</span>
                  <input
                    type="number"
                    min={0}
                    max={65535}
                    placeholder="Config / 22"
                    value={form.ssh.port || ""}
                    onChange={(e) => ssh("port", Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="field grow">
                  <span>
                    Usuário <small>opcional com SSH config</small>
                  </span>
                  <input
                    placeholder="forge"
                    value={form.ssh.user}
                    onChange={(e) => ssh("user", e.target.value)}
                  />
                </label>
                <label className="field grow">
                  <span>
                    Chave privada <small>opcional com agent</small>
                  </span>
                  <div className="input-action">
                    <input
                      placeholder="/home/voce/.ssh/id_ed25519"
                      value={form.ssh.identityFile}
                      onChange={(e) => ssh("identityFile", e.target.value)}
                    />
                    <button
                      type="button"
                      title={hints.title("profile.identity")}
                      onClick={async () => {
                        try {
                          const file = await api.ChooseFile();
                          if (file) ssh("identityFile", file);
                        } catch (e) {
                          setError(errorText(e));
                        }
                      }}
                    >
                      <FolderOpen size={17} />
                    </button>
                  </div>
                </label>
              </div>
            </>
          )}
          {docker && (
            <>
              <div className="container-picker">
                <label className="field grow">
                  <span>Container PHP</span>
                  <input
                    required
                    placeholder="meu-projeto-laravel.test-1"
                    list="containers"
                    value={form.container}
                    onChange={(e) => update("container", e.target.value)}
                  />
                  <datalist id="containers">
                    {containers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.image}
                      </option>
                    ))}
                  </datalist>
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={Boolean(busy)}
                  title={hints.title("profile.containers")}
                  onClick={loadContainers}
                >
                  {busy === "containers" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Buscar containers <Shortcut id="profile.containers" />
                </button>
              </div>
              {containers.length > 0 && (
                <div className="container-options">
                  {containers.map((c) => (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      key={c.id}
                      className={form.container === c.name ? "selected" : ""}
                      onClick={() => chooseContainer(c.name)}
                    >
                      <Box size={16} />
                      <span>
                        {c.name}
                        <small>{c.image}</small>
                      </span>
                      {form.container === c.name && <Check size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="project-path-row">
            <label className="field">
              <span>
                {docker
                  ? "Diretório dentro do container"
                  : remote
                    ? "Diretório no servidor"
                    : "Diretório do projeto"}
              </span>
              <div className="input-action">
                <input
                  required
                  placeholder={
                    remote || docker
                      ? "/var/www/html"
                      : "/home/voce/Projetos/meu-app"
                  }
                  value={form.projectPath}
                  onChange={(e) => update("projectPath", e.target.value)}
                />
                {!remote && !docker && (
                  <button
                    type="button"
                    title={hints.title("profile.directory")}
                    onClick={() => browse("projectPath")}
                  >
                    <FolderOpen size={17} />
                  </button>
                )}
              </div>
            </label>
            {docker && (
              <button
                type="button"
                className="secondary-button"
                disabled={Boolean(busy)}
                title={hints.title("profile.detect")}
                aria-label="Detectar diretório"
                onClick={() => detectDirectory()}
              >
                {busy === "detect" ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Wand2 size={16} />
                )}
                Detectar diretório <Shortcut id="profile.detect" />
              </button>
            )}
          </div>
          {(remote || docker) && autocomplete === "auto" && (
            <div className="autocomplete-summary">
              <Braces size={18} />
              <span>
                Autocomplete automático. O projeto será indexado a partir da
                montagem local ou de um cache temporário, sem precisar escolher
                outra pasta.
              </span>
            </div>
          )}
          <details
            className="advanced-settings"
            open={form.bootstrap === "custom" ? true : undefined}
          >
            <summary>Configurações avançadas</summary>
            <div className="form-row">
              <label className="field grow">
                <span>Executável PHP</span>
                <input
                  required
                  value={form.phpBinary}
                  onChange={(e) => update("phpBinary", e.target.value)}
                />
              </label>
              <label className="field grow">
                <span>Bootstrap</span>
                <select
                  aria-label="Bootstrap"
                  value={form.bootstrap}
                  onChange={(e) => update("bootstrap", e.target.value)}
                >
                  <option value="auto">Detectar automaticamente</option>
                  <option value="laravel">Laravel</option>
                  <option value="composer">Composer</option>
                  <option value="none">PHP puro</option>
                  <option value="custom">Arquivo personalizado</option>
                </select>
              </label>
              <label className="field timeout-field">
                <span>Timeout (s)</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={form.timeout}
                  onChange={(e) => update("timeout", Number(e.target.value))}
                />
              </label>
            </div>
            {form.bootstrap === "custom" && (
              <label className="field">
                <span>Arquivo de bootstrap</span>
                <input
                  required
                  placeholder="bootstrap.php"
                  value={form.bootstrapFile}
                  onChange={(e) => update("bootstrapFile", e.target.value)}
                />
              </label>
            )}
            <label className="field">
              <span>Autocomplete</span>
              <select
                aria-label="Modo de autocomplete"
                value={autocomplete}
                onChange={(e) =>
                  update(
                    "autocomplete",
                    e.target.value as Profile["autocomplete"],
                  )
                }
              >
                <option value="auto">Automático</option>
                <option value="local">Usar uma pasta local</option>
                <option value="off">Desativado</option>
              </select>
            </label>
            {autocomplete === "local" && (
              <label className="field">
                <span>Pasta local para indexação</span>
                <div className="input-action">
                  <input
                    required
                    placeholder="/home/voce/Projetos/meu-app"
                    value={form.localPath}
                    onChange={(e) => update("localPath", e.target.value)}
                  />
                  <button
                    type="button"
                    title="Selecionar pasta para indexação"
                    onClick={() => browse("localPath")}
                  >
                    <FolderOpen size={17} />
                  </button>
                </div>
                <small>
                  Use uma cópia local quando preferir controlar os arquivos
                  usados pelo autocomplete.
                </small>
              </label>
            )}
            {remote && (
              <p className="field-hint">
                Antes do primeiro acesso, conecte pelo terminal para registrar a
                chave do servidor em known_hosts.
              </p>
            )}
          </details>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {test && (
            <div className="form-success">
              <Check size={17} />
              {test}
            </div>
          )}
          <div className="form-footer">
            {form.id ? (
              <button
                type="button"
                className={`text-button danger ${confirmDelete ? "confirm-delete" : ""}`}
                disabled={Boolean(busy)}
                title={hints.title("profile.delete")}
                onClick={remove}
              >
                <Trash2 size={16} />
                {confirmDelete ? "Confirmar exclusão" : "Excluir"}{" "}
                <Shortcut id="profile.delete" />
              </button>
            ) : (
              <span />
            )}
            <div>
              <button
                type="button"
                className="secondary-button"
                disabled={Boolean(busy)}
                title={hints.title("profile.test")}
                onClick={testConnection}
              >
                {busy === "test" && <LoaderCircle className="spin" size={16} />}
                Testar conexão <Shortcut id="profile.test" />
              </button>
              <button
                className="primary-button"
                type="submit"
                aria-label="Salvar conexão"
                disabled={Boolean(busy)}
              >
                {busy === "save" ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Check size={16} />
                )}
                Salvar conexão <Shortcut id="dialog.save" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function SettingsDialog({
  settings,
  initialSection = "general",
  build,
  checkUpdates,
  close,
  saved,
}: {
  settings: Settings;
  initialSection?: "general" | "shortcuts" | "updates";
  build?: BuildInfo;
  checkUpdates: () => void;
  close: () => void;
  saved: (settings: Settings) => void;
}) {
  const [form, setForm] = useState({
    ...settings,
    cacheDays: settings.cacheDays || 7,
  });
  const [section, setSection] = useState(initialSection);
  const hints = useCommandHints();
  const [health, setHealth] = useState<Health>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api
      .Health()
      .then(setHealth)
      .catch((e) => setError(errorText(e)));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const conflicts = bindingErrors(form.shortcuts ?? {});
      if (conflicts.length) {
        setSection("shortcuts");
        throw new Error(conflicts.join(" "));
      }
      await api.SaveSettings(form);
      saved(form);
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function chooseTool(field: "phpBinary" | "phpactorPath") {
    try {
      const file = await api.ChooseFile();
      if (file) setForm((previous) => ({ ...previous, [field]: file }));
    } catch (error) {
      setError(errorText(error));
    }
  }
  function copyInstall() {
    api
      .Copy("./scripts/install-phpactor.sh")
      .then(() => setCopied(true))
      .catch((error) => setError(errorText(error)));
  }
  useCommandActions({
    "settings.php": () => chooseTool("phpBinary"),
    "settings.phpactor": () => chooseTool("phpactorPath"),
    "settings.install": copyInstall,
    "settings.reset": () =>
      setForm((previous) => ({ ...previous, shortcuts: {} })),
    "settings.general": () => setSection("general"),
    "settings.shortcuts": () => setSection("shortcuts"),
    "settings.updates": () => setSection("updates"),
    "settings.checkUpdates": {
      enabled: section === "updates" && !busy,
      run: saveAndCheck,
    },
  });
  async function saveAndCheck() {
    setBusy(true);
    setError("");
    try {
      const conflicts = bindingErrors(form.shortcuts ?? {});
      if (conflicts.length) {
        setSection("shortcuts");
        throw new Error(conflicts.join(" "));
      }
      await api.SaveSettings(form);
      saved(form);
      close();
      checkUpdates();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Seu espaço, do seu jeito."
      eyebrow="PREFERÊNCIAS"
      close={close}
      className="settings-modal"
      scope="settings"
    >
      <form className="settings-form" onSubmit={save}>
        <div
          className="settings-tabs"
          role="tablist"
          aria-label="Seções de preferências"
        >
          <button
            type="button"
            role="tab"
            aria-selected={section === "general"}
            onClick={() => setSection("general")}
          >
            Geral <Shortcut id="settings.general" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "shortcuts"}
            onClick={() => setSection("shortcuts")}
          >
            Atalhos de teclado <Shortcut id="settings.shortcuts" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "updates"}
            onClick={() => setSection("updates")}
          >
            Atualizações <Shortcut id="settings.updates" />
          </button>
        </div>
        {section === "updates" ? (
          <div className="updates-preferences">
            <div className="settings-intro">
              <RefreshCw size={20} />
              <p>
                TinkerCraft {build?.version ?? "…"}. As atualizações são
                baixadas após sua solicitação e instaladas pelo Linux.
              </p>
            </div>
            <label className="field">
              <span>Repositório GitHub de releases</span>
              <input
                aria-label="Fonte de atualizações"
                placeholder={
                  build?.releaseSource ||
                  "https://github.com/seu-usuario/tinkercraft"
                }
                value={form.updateSource ?? ""}
                onChange={(e) =>
                  setForm({ ...form, updateSource: e.target.value })
                }
              />
              <small>
                Informe a URL do repositório público. Vazio utiliza a fonte
                definida no build ou no .env de desenvolvimento. Um manifesto
                HTTPS próprio também é aceito.
              </small>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.checkUpdatesOnStartup !== false}
                onChange={(e) =>
                  setForm({ ...form, checkUpdatesOnStartup: e.target.checked })
                }
              />
              <span>Verificar atualizações ao iniciar</span>
            </label>
            <p className="field-hint">
              A verificação não envia seus códigos, conexões ou dados dos
              projetos. O aviso aparece no rodapé quando há uma versão nova.
            </p>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={saveAndCheck}
            >
              <RefreshCw size={15} />
              Salvar e verificar agora <Shortcut id="settings.checkUpdates" />
            </button>
          </div>
        ) : section === "shortcuts" ? (
          <Keybindings
            value={form.shortcuts ?? {}}
            change={(shortcuts) =>
              setForm((previous) => ({ ...previous, shortcuts }))
            }
          />
        ) : (
          <div className="settings-general">
            <div className="settings-intro">
              <Settings2 size={20} />
              <p>
                O PHP local analisa seus trechos e executa o servidor de
                linguagem. Pode ter uma versão diferente do PHP remoto.
              </p>
            </div>
            <label className="field">
              <span>
                Executável PHP local <small>PHP 8.2 ou superior</small>
              </span>
              <div className="input-action">
                <input
                  required
                  value={form.phpBinary}
                  onChange={(e) =>
                    setForm({ ...form, phpBinary: e.target.value })
                  }
                />
                <button
                  type="button"
                  title={hints.title("settings.php")}
                  onClick={async () => {
                    try {
                      const file = await api.ChooseFile();
                      if (file) setForm({ ...form, phpBinary: file });
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                >
                  <FolderOpen size={15} />
                </button>
              </div>
            </label>
            <div className="form-section-title">INTELIGÊNCIA DO EDITOR</div>
            <label className="field">
              <span>
                Phpactor <small>caminho para phpactor.phar ou script PHP</small>
              </span>
              <div className="input-action">
                <input
                  placeholder="Detectar phpactor no PATH"
                  value={form.phpactorPath}
                  onChange={(e) =>
                    setForm({ ...form, phpactorPath: e.target.value })
                  }
                />
                <button
                  type="button"
                  title={hints.title("settings.phpactor")}
                  onClick={async () => {
                    try {
                      const file = await api.ChooseFile();
                      if (file) setForm({ ...form, phpactorPath: file });
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                >
                  <FolderOpen size={15} />
                </button>
              </div>
              <small>
                Autocomplete de tipos, métodos encadeados, imports, assinatura e
                documentação via LSP.
              </small>
            </label>
            <div className="setup-note">
              <strong>Primeira configuração</strong>
              <p>
                Instale o Phpactor pelo script do projeto e selecione o arquivo
                baixado acima.
              </p>
              <button
                type="button"
                className="command-copy"
                title={hints.title("settings.install")}
                onClick={() => {
                  api
                    .Copy("./scripts/install-phpactor.sh")
                    .then(() => setCopied(true))
                    .catch((e) => setError(errorText(e)));
                }}
              >
                <code>./scripts/install-phpactor.sh</code>
                <Shortcut id="settings.install" />
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <small>
                Sem Phpactor, o indexador básico sugere funções, classes e
                membros públicos. Para métodos mágicos do Laravel, use os
                arquivos gerados pelo IDE Helper no projeto.
              </small>
            </div>
            <div className="form-section-title">CACHE DE AUTOCOMPLETE</div>
            <label className="field">
              <span>Remover após dias sem uso</span>
              <input
                aria-label="Dias sem uso para expirar cache"
                type="number"
                min={1}
                max={90}
                value={form.cacheDays}
                onChange={(e) =>
                  setForm({ ...form, cacheDays: Number(e.target.value) })
                }
              />
              <small>
                O cache inclui arquivos PHP e metadados Composer. Não copia
                .env, bancos de dados ou uploads. A limpeza ocorre ao abrir o
                aplicativo e enquanto ele está em uso.
              </small>
            </label>
            <div className="health-grid">
              <div>
                <span>PHP local</span>
                <strong>{health?.php ?? "Verificando…"}</strong>
              </div>
              <div>
                <span>Docker CLI</span>
                <strong>
                  {health
                    ? health.docker
                      ? "Encontrado"
                      : "Não encontrado"
                    : "…"}
                </strong>
              </div>
              <div>
                <span>OpenSSH</span>
                <strong>
                  {health
                    ? health.ssh
                      ? "Encontrado"
                      : "Não encontrado"
                    : "…"}
                </strong>
              </div>
            </div>
            {health && (
              <p className="data-path">
                Workspace salvo em <code>{health.dataDir}</code>
              </p>
            )}
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
        <div className="form-footer">
          <span>Preferências salvas neste dispositivo.</span>
          <button
            type="submit"
            aria-label="Salvar preferências"
            className="primary-button"
            disabled={busy || bindingErrors(form.shortcuts ?? {}).length > 0}
          >
            <Check size={14} />
            Salvar preferências <Shortcut id="dialog.save" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
