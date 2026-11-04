import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Code2,
  FileCode2,
  FolderOpen,
  History as HistoryIcon,
  LoaderCircle,
  Play,
  Plus,
  Pencil,
  Command,
  AlertCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Settings2,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { api, errorText, uid } from "./api";
import {
  CodeEditor,
  releaseModel,
  editorAction,
  editorTabs,
  settleEditorInput,
} from "./editor";
import {
  ModeIcon,
  modeLabel,
  ProfileDialog,
  SettingsDialog,
  Modal,
} from "./dialogs";
import { Output } from "./output";
import { UpdatesDialog } from "./updates";
import { BrandIcon } from "./brand";
import {
  Shortcut,
  useCommandActions,
  useCommandHints,
  useCommandSystem,
} from "./commands";
import { snippetBody } from "./php";
import type {
  Health,
  BuildInfo,
  UpdateInfo,
  History,
  LanguageStatus,
  Profile,
  RunResult,
  Settings,
  State,
  Tab,
} from "./types";

const blankCode = "";
const timeAgo = (iso: string) => {
  const date = new Date(iso);
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function App() {
  const [state, setState] = useState<State>();
  const [fatal, setFatal] = useState("");
  const [health, setHealth] = useState<Health>();
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [language, setLanguage] = useState<Record<string, LanguageStatus>>({});
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const [sidebar, setSidebar] = useState<"projects" | "history" | null>(null);
  const [profileModal, setProfileModal] = useState<Profile | "new" | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    "general" | "shortcuts" | "updates"
  >("general");
  const [languageDetails, setLanguageDetails] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const hints = useCommandHints();
  const commandSystem = useCommandSystem();
  const [buildInfo, setBuildInfo] = useState<BuildInfo>();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>();
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const checkingUpdateRef = useRef(false);
  const [toast, setToast] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");
  const [renaming, setRenaming] = useState("");
  const renameGeneration = useRef(0);
  const [split, setSplit] = useState(52);
  const [saved, setSaved] = useState(true);
  const stateRef = useRef<State | undefined>(undefined);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const languageSeq = useRef(0);
  const runRef = useRef<() => void>(() => {});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  stateRef.current = state;
  const tab =
    state?.tabs.find((t) => t.id === state.activeTab) ?? state?.tabs[0];
  const profile = state?.profiles.find((p) => p.id === tab?.profileId);
  const notify = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  }, []);

  useEffect(() => {
    api
      .Bootstrap()
      .then((data) => {
        setState({
          ...data,
          tabs: data.tabs.map((t) => ({ ...t, code: snippetBody(t.code) })),
        });
        if (window.go) api.EnableCloseGuard().catch(() => {});
      })
      .catch((e) => setFatal(errorText(e)));
    api
      .BuildInfo()
      .then(setBuildInfo)
      .catch(() => {});
    api
      .Health()
      .then(setHealth)
      .catch(() => {});
    return () => clearTimeout(toastTimer.current);
  }, []);
  useEffect(
    () =>
      window.runtime?.EventsOn("language:progress", (event) => {
        if (stateRef.current?.activeTab !== event.tabId) return;
        setLanguage((current) => ({
          ...current,
          [event.tabId]: {
            mode: "loading",
            files: 0,
            root: "",
            message: event.message,
          },
        }));
      }),
    [],
  );
  const checkUpdates = useCallback(async (show = false) => {
    if (show) setUpdatesOpen(true);
    if (checkingUpdateRef.current) return;
    checkingUpdateRef.current = true;
    setCheckingUpdates(true);
    setUpdateError("");
    try {
      setUpdateInfo(await api.CheckUpdates());
    } catch (error) {
      setUpdateError(errorText(error));
    } finally {
      checkingUpdateRef.current = false;
      setCheckingUpdates(false);
    }
  }, []);
  const updateSourceKey = JSON.stringify([
    state?.settings.updateSource,
    state?.settings.checkUpdatesOnStartup,
    buildInfo?.releaseSource,
  ]);
  useEffect(() => {
    if (!state || !buildInfo || state.settings.checkUpdatesOnStartup === false)
      return;
    const source = state.settings.updateSource || buildInfo.releaseSource;
    if (!source) return;
    const timer = setTimeout(() => {
      checkUpdates();
    }, 2000);
    return () => clearTimeout(timer);
  }, [updateSourceKey, Boolean(state), Boolean(buildInfo), checkUpdates]);
  const lastWorkspace = useRef("");
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  const saveWorkspace = useCallback(
    async (showNotice = false) => {
      const current = stateRef.current;
      if (!current) return;
      const tabs = editorTabs(current.tabs);
      const serialized = JSON.stringify({
        tabs,
        active: current.activeTab,
      });
      const revision = saveRevision.current;
      setSaved(false);
      const write = saveQueue.current
        .catch(() => {})
        .then(() => api.SaveWorkspace(tabs, current.activeTab));
      saveQueue.current = write;
      try {
        await write;
        lastWorkspace.current = serialized;
        if (revision === saveRevision.current) setSaved(true);
        if (showNotice)
          notify(
            "Abas salvas neste dispositivo. Elas serão restauradas ao reabrir o aplicativo.",
          );
      } catch (error) {
        notify(`Não foi possível salvar: ${errorText(error)}`);
        throw error;
      }
    },
    [notify],
  );
  useEffect(() => {
    if (!state) return;
    const serialized = JSON.stringify({
      tabs: state.tabs,
      active: state.activeTab,
    });
    if (serialized === lastWorkspace.current) return;
    saveRevision.current++;
    setSaved(false);
    const timer = setTimeout(() => {
      saveWorkspace().catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [state?.tabs, state?.activeTab, saveWorkspace]);
  useEffect(
    () =>
      window.runtime?.EventsOn("app:before-close", async () => {
        try {
          await settleEditorInput();
          await saveWorkspace();
          await api.ConfirmClose();
        } catch {
          await api.CancelClose().catch(() => {});
        }
      }),
    [saveWorkspace],
  );
  const shortcutKey = JSON.stringify(state?.settings.shortcuts ?? {});
  useEffect(() => {
    commandSystem.setBindings(state?.settings.shortcuts ?? {});
  }, [shortcutKey]);
  useEffect(() => {
    const listener = (event: Event) => {
      const { id, message } = (event as CustomEvent).detail;
      setLanguage((values) => ({
        ...values,
        [id]: { ...values[id], warning: message },
      }));
    };
    window.addEventListener("tinkercraft:language-error", listener);
    return () =>
      window.removeEventListener("tinkercraft:language-error", listener);
  }, []);

  const startLanguage = useCallback(async (refresh = false) => {
    const current = stateRef.current;
    const target = current?.tabs.find((t) => t.id === current.activeTab);
    if (!target) return;
    const seq = ++languageSeq.current;
    if (!target.profileId) {
      setLanguage((values) => ({
        ...values,
        [target.id]: {
          mode: "none",
          message: "Selecione uma conexão",
          root: "",
          files: 0,
        },
      }));
      api.StopLanguage(target.id).catch(() => {});
      return;
    }
    setLanguage((values) => ({
      ...values,
      [target.id]: {
        mode: "loading",
        message: "Preparando autocomplete…",
        root: "",
        files: 0,
      },
    }));
    try {
      const status = await (refresh ? api.RefreshLanguage : api.StartLanguage)(
        target.id,
        target.profileId,
        target.code,
      );
      if (seq === languageSeq.current)
        setLanguage((values) => ({ ...values, [target.id]: status }));
    } catch (e) {
      if (seq === languageSeq.current)
        setLanguage((values) => ({
          ...values,
          [target.id]: {
            mode: "error",
            message: errorText(e),
            root: "",
            files: 0,
          },
        }));
    }
  }, []);
  const settingsKey = JSON.stringify([
    state?.settings.phpBinary,
    state?.settings.phpactorPath,
  ]);
  const profileKey = JSON.stringify(profile);
  useEffect(() => {
    if (!tab) return;
    startLanguage();
  }, [tab?.id, profileKey, settingsKey, startLanguage]);
  useEffect(() => {
    if (!tab) return;
    const id = tab.id;
    return () => {
      languageSeq.current++;
      api.StopLanguage(id).catch(() => {});
    };
  }, [tab?.id]);
  useEffect(() => {
    if (!tab) return;
    const timer = setTimeout(
      () => api.ChangeLanguage(tab.id, tab.code).catch(() => {}),
      220,
    );
    return () => clearTimeout(timer);
  }, [tab?.id, tab?.code]);

  function updateTab(id: string, changes: Partial<Tab>) {
    setState(
      (previous) =>
        previous && {
          ...previous,
          tabs: previous.tabs.map((t) =>
            t.id === id ? { ...t, ...changes } : t,
          ),
        },
    );
  }
  async function run() {
    const current = stateRef.current;
    const target = current?.tabs.find((t) => t.id === current.activeTab);
    if (!target) return;
    if (running[target.id]) {
      await api.Cancel(target.id).catch((e) => notify(errorText(e)));
      return;
    }
    if (!target.profileId) {
      setProfileModal("new");
      return;
    }
    setRunning((values) => ({ ...values, [target.id]: true }));
    try {
      const result = await api.Execute(
        target.id,
        target.profileId,
        target.code,
      );
      setResults((values) => ({ ...values, [target.id]: result }));
      const fresh = await api.Bootstrap();
      setState(
        (previous) => previous && { ...previous, history: fresh.history },
      );
    } catch (e) {
      notify(errorText(e));
    } finally {
      setRunning((values) => ({ ...values, [target.id]: false }));
    }
  }
  runRef.current = run;

  function createTab(
    code = blankCode,
    name = "Sem título",
    profileId?: string,
  ) {
    const current = stateRef.current;
    if (!current) return;
    if (current.tabs.length >= 20) {
      notify("Limite de 20 abas. Feche uma aba para continuar.");
      return;
    }
    const next: Tab = {
      id: uid(),
      name,
      code: snippetBody(code),
      profileId: profileId ?? tab?.profileId ?? "",
    };
    setState({ ...current, tabs: [...current.tabs, next], activeTab: next.id });
  }
  async function openSnippet() {
    try {
      const snippet = await api.OpenSnippet();
      if (snippet) createTab(snippet.code, snippet.name);
    } catch (e) {
      notify(errorText(e));
    }
  }
  function closeTab(id: string) {
    if (running[id]) {
      notify("Cancele a execução antes de fechar esta aba.");
      return;
    }
    const current = stateRef.current;
    if (!current) return;
    const tabs = current.tabs.filter((t) => t.id !== id);
    if (!tabs.length)
      tabs.push({
        id: uid(),
        name: "Sem título",
        code: blankCode,
        profileId: tab?.profileId ?? "",
      });
    setState({
      ...current,
      tabs,
      activeTab:
        current.activeTab === id
          ? tabs[Math.max(0, current.tabs.findIndex((t) => t.id === id) - 1)].id
          : current.activeTab,
    });
    api.StopLanguage(id).catch(() => {});
    releaseModel(id);
  }
  function selectProfile(id: string) {
    if (tab) updateTab(tab.id, { profileId: id });
  }
  function savedProfile(p: Profile) {
    setState(
      (current) =>
        current && {
          ...current,
          profiles: current.profiles.some((x) => x.id === p.id)
            ? current.profiles.map((x) => (x.id === p.id ? p : x))
            : [...current.profiles, p],
          tabs: current.tabs.map((t) =>
            t.id === current.activeTab ? { ...t, profileId: p.id } : t,
          ),
        },
    );
    notify("Conexão salva.");
  }
  function deletedProfile(id: string) {
    setState(
      (current) =>
        current && {
          ...current,
          profiles: current.profiles.filter((p) => p.id !== id),
          tabs: current.tabs.map((t) =>
            t.profileId === id ? { ...t, profileId: "" } : t,
          ),
        },
    );
  }
  function savedSettings(settings: Settings) {
    setState((current) => current && { ...current, settings });
    api
      .Health()
      .then(setHealth)
      .catch(() => {});
  }
  function resize(event: React.PointerEvent) {
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (rect)
        setSplit(
          Math.max(
            32,
            Math.min(70, ((e.clientX - rect.left) / rect.width) * 100),
          ),
        );
    };
    const stop = () => {
      element.removeEventListener("pointermove", move as EventListener);
      element.removeEventListener("pointerup", stop);
    };
    element.addEventListener("pointermove", move as EventListener);
    element.addEventListener("pointerup", stop);
  }
  function restore(item: History) {
    createTab(
      item.code,
      "Do histórico",
      state?.profiles.some((p) => p.id === item.profileId)
        ? item.profileId
        : "",
    );
  }

  function renameTab(id = tab?.id) {
    const target = stateRef.current?.tabs.find((t) => t.id === id);
    if (!target) return;
    renameGeneration.current++;
    setRenaming(target.id);
    setRenameDraft(target.name);
  }
  function finishRename(commit = true) {
    if (commit && renaming)
      updateTab(renaming, { name: renameDraft.trim() || "Sem título" });
    setRenaming("");
    const generation = ++renameGeneration.current;
    requestAnimationFrame(() => {
      if (generation === renameGeneration.current) editorAction("focus");
    });
  }
  function changeTab(offset: number) {
    const current = stateRef.current;
    if (!current) return;
    const index = current.tabs.findIndex((t) => t.id === current.activeTab);
    setState({
      ...current,
      activeTab:
        current.tabs[
          (index + offset + current.tabs.length) % current.tabs.length
        ].id,
    });
  }
  function preferences(
    section: "general" | "shortcuts" | "updates" = "general",
  ) {
    setSettingsSection(section);
    setSettingsOpen(true);
  }
  async function exportPHP() {
    const current = stateRef.current?.tabs.find(
      (t) => t.id === stateRef.current?.activeTab,
    );
    if (!current) return;
    try {
      if (await api.SaveSnippet(current.name, current.code))
        notify("Trecho salvo em arquivo PHP.");
    } catch (error) {
      notify(errorText(error));
    }
  }
  function focusOutput() {
    document.querySelector<HTMLElement>(".output-panel")?.focus();
  }
  async function clearHistory() {
    try {
      await api.ClearHistory();
      setState((current) => current && { ...current, history: [] });
    } catch (error) {
      notify(errorText(error));
    }
  }
  useCommandActions({
    checkUpdates: () => checkUpdates(true),
    run: () => runRef.current(),
    save: () => saveWorkspace(true).catch(() => {}),
    exportPHP,
    openPHP: openSnippet,
    newTab: () => createTab(),
    closeTab: () => tab && closeTab(tab.id),
    renameTab: () => renameTab(),
    nextTab: () => changeTab(1),
    previousTab: () => changeTab(-1),
    history: () =>
      setSidebar((value) => (value === "history" ? null : "history")),
    connections: () =>
      setSidebar((value) => (value === "projects" ? null : "projects")),
    newConnection: () => setProfileModal("new"),
    editConnection: () => setProfileModal(profile ?? "new"),
    selectConnection: () =>
      document.querySelector<HTMLSelectElement>(".connection-select")?.focus(),
    preferences: () => preferences(),
    shortcuts: () => preferences("shortcuts"),
    complete: () => {
      editorAction("editor.action.triggerSuggest");
      const status = tab && language[tab.id];
      if (status?.mode === "error" || status?.mode === "loading")
        notify(status.message);
    },
    refreshLanguage: () => startLanguage(true),
    languageDetails: () => setLanguageDetails(true),
    tabFocus: () => editorAction("editor.action.toggleTabFocusMode"),
    focusEditor: () => editorAction("focus"),
    focusOutput,
    widenEditor: () => setSplit((value) => Math.min(70, value + 5)),
    narrowEditor: () => setSplit((value) => Math.max(32, value - 5)),
    clearHistory: {
      run: clearHistory,
      enabled: Boolean(state?.history.length),
    },
    filterHistory: () => {
      setSidebar("history");
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>('[aria-label="Filtrar histórico"]')
          ?.focus(),
      );
    },
  });

  if (!state || !tab)
    return (
      <div className="boot-screen">
        <BrandIcon />
        {fatal ? (
          <>
            <h1>Não foi possível abrir o workspace.</h1>
            <p>{fatal}</p>
          </>
        ) : (
          <>
            <span className="spinner" />
            <p>Preparando seu espaço…</p>
          </>
        )}
      </div>
    );
  const status = language[tab.id];
  const isRunning = Boolean(running[tab.id]);
  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Navegação">
        <BrandIcon title="TinkerCraft" />
        <div className="activity-main">
          <button
            title={hints.title("connections")}
            aria-label="Projetos e conexões"
            className={sidebar === "projects" ? "active" : ""}
            onClick={() =>
              setSidebar(sidebar === "projects" ? null : "projects")
            }
          >
            <Code2 size={21} />
          </button>
          <button
            title={hints.title("history")}
            aria-label="Histórico"
            className={sidebar === "history" ? "active" : ""}
            onClick={() => setSidebar(sidebar === "history" ? null : "history")}
          >
            <HistoryIcon size={21} />
          </button>
          <button
            title={hints.title("openPHP")}
            aria-label="Abrir trecho PHP"
            onClick={openSnippet}
          >
            <FolderOpen size={21} />
          </button>
        </div>
        <div className="activity-bottom">
          <button
            title={hints.title("preferences")}
            aria-label="Preferências"
            onClick={() => preferences()}
          >
            <Settings2 size={20} />
          </button>
          <button
            title={hints.title("commands")}
            aria-label="Paleta de comandos"
            onClick={commandSystem.openPalette}
          >
            <Command size={20} />
          </button>
          <div className="avatar">H</div>
        </div>
      </nav>
      {sidebar && (
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span>
              TinkerCraft<span className="brand-period">.</span>
            </span>
            <span className="version-tag">PHP LAB</span>
          </div>
          <div className="sidebar-section-title">
            <span>
              {sidebar === "projects" ? "SEU WORKSPACE" : "HISTÓRICO"}
            </span>
            <button
              className="icon-button"
              title={
                sidebar === "projects"
                  ? hints.title("newConnection")
                  : hints.title("history", "Fechar histórico")
              }
              onClick={() =>
                sidebar === "projects"
                  ? setProfileModal("new")
                  : setSidebar("projects")
              }
            >
              {sidebar === "projects" ? <Plus size={16} /> : <X size={15} />}
            </button>
          </div>
          {sidebar === "projects" ? (
            <>
              <div className="sidebar-profiles">
                {state.profiles.map((p) => (
                  <div
                    className={`project-row ${p.id === tab.profileId ? "selected" : ""}`}
                    key={p.id}
                  >
                    <button
                      className="project-select"
                      onClick={() => selectProfile(p.id)}
                    >
                      <span className="project-icon">
                        <ModeIcon mode={p.mode} size={17} />
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.mode === "local"
                            ? "Projeto local"
                            : modeLabel(p.mode)}
                        </small>
                      </span>
                      {p.id === tab.profileId && (
                        <span className="selected-indicator" />
                      )}
                    </button>
                    <button
                      className="project-edit icon-button"
                      title={`Editar ${p.name}`}
                      onClick={() => setProfileModal(p)}
                    >
                      <Settings2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="add-project"
                title={hints.title("newConnection")}
                onClick={() => setProfileModal("new")}
              >
                <Plus size={14} />
                Adicionar conexão <Shortcut id="newConnection" />
              </button>
              <div className="sidebar-divider" />
              <div className="sidebar-section-title">
                <span>ABAS ABERTAS</span>
                <span>{state.tabs.length.toString().padStart(2, "0")}</span>
              </div>
              <div className="sidebar-tabs">
                {state.tabs.map((t) => (
                  <button
                    className={t.id === tab.id ? "active" : ""}
                    key={t.id}
                    onClick={() => setState({ ...state, activeTab: t.id })}
                  >
                    <FileCode2 size={14} />
                    <span>{t.name}</span>
                    {running[t.id] && (
                      <LoaderCircle size={12} className="spin" />
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="search-box history-search">
                <Search size={14} />
                <input
                  aria-label="Filtrar histórico"
                  placeholder="Buscar no histórico…"
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                />
              </label>
              <div className="history-items">
                {state.history
                  .filter((h) =>
                    `${h.code} ${h.profileName}`
                      .toLowerCase()
                      .includes(historyFilter.toLowerCase()),
                  )
                  .map((item) => (
                    <button
                      className="history-item"
                      key={item.id}
                      onClick={() => restore(item)}
                    >
                      <span className="history-heading">
                        <span
                          className={`result-dot ${item.success ? "success" : "failure"}`}
                        />
                        {item.profileName}
                        <small>{item.durationMs} ms</small>
                      </span>
                      <code>
                        {item.code
                          .replace(/^<\?php\s*/, "")
                          .trim()
                          .slice(0, 110)}
                      </code>
                      <span>{timeAgo(item.createdAt)}</span>
                    </button>
                  ))}
                {state.history.length === 0 && (
                  <div className="empty-small">
                    Suas execuções aparecerão aqui.
                  </div>
                )}
              </div>
              {state.history.length > 0 && (
                <button
                  className="text-button clear-history"
                  title={hints.title("clearHistory")}
                  onClick={() =>
                    api
                      .ClearHistory()
                      .then(() =>
                        setState(
                          (current) => current && { ...current, history: [] },
                        ),
                      )
                      .catch((e) => notify(errorText(e)))
                  }
                >
                  Limpar histórico <Shortcut id="clearHistory" />
                </button>
              )}
            </>
          )}
          <div className="sidebar-footer">
            <span className="small-status-dot" />
            Seu laboratório pessoal<span>v{buildInfo?.version ?? "…"}</span>
          </div>
        </aside>
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="workspace-identity">
            <ModeIcon mode={profile?.mode ?? "local"} size={18} />
            <select
              className="connection-select"
              aria-label="Ambiente de execução"
              title={`${hints.title("selectConnection")} — ${profile?.projectPath ?? ""}`}
              value={tab.profileId}
              onChange={(e) => selectProfile(e.target.value)}
            >
              <option value="" disabled>
                Selecionar conexão
              </option>
              {state.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span
              className="connection-mode"
              title={
                profile?.ssh.host || profile?.container || profile?.projectPath
              }
            >
              {modeLabel(profile?.mode ?? "local")}
            </span>
            <button
              className="icon-button"
              title={hints.title("editConnection")}
              aria-label="Configurar conexão"
              onClick={() => setProfileModal(profile ?? "new")}
            >
              <Settings2 size={18} />
            </button>
            <button
              className="icon-button"
              title={hints.title("newConnection")}
              aria-label="Nova conexão"
              onClick={() => setProfileModal("new")}
            >
              <Plus size={18} />
            </button>
          </div>
          <button
            className={`run-button ${isRunning ? "stop" : ""}`}
            onClick={run}
            title={hints.title("run")}
          >
            {isRunning ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            <span>{isRunning ? "Cancelar" : "Executar"}</span>
            <Shortcut id="run" />
          </button>
        </header>
        <div className="tabs-bar">
          <div className="tabs-list">
            {state.tabs.map((t) => (
              <div
                className={`editor-tab ${t.id === tab.id ? "active" : ""}`}
                key={t.id}
              >
                {renaming === t.id ? (
                  <div className="tab-select tab-renaming">
                    <span className="php-file-icon">php</span>
                    <input
                      autoFocus
                      aria-label="Nome da aba"
                      maxLength={100}
                      value={renameDraft}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => finishRename()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          e.preventDefault();
                          finishRename();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          finishRename(false);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <button
                    className="tab-select"
                    onClick={() => setState({ ...state, activeTab: t.id })}
                    onDoubleClick={() => renameTab(t.id)}
                    title={hints.title("renameTab", `Renomear ${t.name}`)}
                  >
                    <span className="php-file-icon">php</span>
                    <span>{t.name}</span>
                    {running[t.id] && (
                      <LoaderCircle size={12} className="spin" />
                    )}
                  </button>
                )}
                <button
                  className="tab-close"
                  title={hints.title("closeTab", `Fechar ${t.name}`)}
                  aria-label={`Fechar ${t.name}`}
                  onClick={() => closeTab(t.id)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="new-tab icon-button"
            title={hints.title("newTab")}
            aria-label="Nova aba"
            onClick={() => createTab()}
          >
            <Plus size={16} />
          </button>
          <div className="tabs-spacer" />
          <button
            className="icon-button"
            title={hints.title("renameTab")}
            aria-label="Renomear aba"
            onClick={() => renameTab()}
          >
            <Pencil size={14} />
          </button>
          <span
            className="autosave-status"
            title={
              saved
                ? "Abas salvas neste dispositivo; serão restauradas ao reabrir"
                : "Salvando alterações"
            }
            role="status"
            aria-label={saved ? "Abas salvas" : "Salvando abas"}
          >
            {saved ? <Check size={14} /> : <span className="unsaved-dot" />}
          </span>
          <button
            className="icon-button"
            title={hints.title("exportPHP")}
            aria-label="Salvar trecho como arquivo PHP"
            onClick={exportPHP}
          >
            <ArrowDownToLine size={15} />
          </button>
        </div>
        <div
          className="workspace-panels"
          ref={workspaceRef}
          style={{ "--editor-width": `${split}%` } as React.CSSProperties}
        >
          <section className="editor-panel">
            <CodeEditor
              tab={tab}
              onChange={(code) => updateTab(tab.id, { code })}
              onPosition={(line, column) => setPosition({ line, column })}
            />
          </section>
          <div
            className="splitter"
            role="separator"
            aria-label="Redimensionar editor e resultado"
            aria-orientation="vertical"
            onPointerDown={resize}
            tabIndex={0}
            aria-valuemin={32}
            aria-valuemax={70}
            aria-valuenow={split}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                setSplit((value) =>
                  Math.max(
                    32,
                    Math.min(70, value + (e.key === "ArrowRight" ? 2 : -2)),
                  ),
                );
              }
            }}
          />
          <Output
            key={tab.id}
            result={results[tab.id]}
            running={isRunning}
            clear={() =>
              setResults((values) => {
                const next = { ...values };
                delete next[tab.id];
                return next;
              })
            }
            notify={notify}
          />
        </div>
        <footer className="statusbar">
          <div>
            <span className="status-connection">
              <ModeIcon mode={profile?.mode ?? "local"} size={12} />
              {profile?.ssh.host || profile?.container || "Sua máquina"}
            </span>
            {updateInfo?.available && (
              <button
                className="update-badge"
                aria-label="Atualização disponível"
                onClick={() => setUpdatesOpen(true)}
                title={hints.title("checkUpdates")}
              >
                <ArrowUpCircle size={13} />
                Atualização {updateInfo.latestVersion}
              </button>
            )}
            <span className="status-divider" />
            <span>PHP {results[tab.id]?.phpVersion || health?.php || "…"}</span>
            {results[tab.id]?.framework && (
              <span className="framework-status">
                {results[tab.id].framework}
              </span>
            )}
          </div>
          <div>
            <button
              className={`language-status ${status?.warning ? "warning" : ""} ${status?.mode === "basic" ? "basic" : status?.mode === "error" ? "error" : ""}`}
              aria-label={
                status?.mode === "phpactor"
                  ? "Autocomplete pronto"
                  : (status?.message ?? "Preparando autocomplete")
              }
              title={`${hints.title("languageDetails")} — ${status?.warning || status?.message || "Preparando autocomplete"}`}
              onClick={() => setLanguageDetails(true)}
            >
              {status?.mode === "loading" ? (
                <LoaderCircle className="spin" size={12} />
              ) : (
                <span className="small-status-dot" />
              )}
              {status?.warning
                ? "Autocomplete com aviso"
                : status?.mode === "phpactor"
                  ? "Autocomplete"
                  : status?.mode === "basic"
                    ? "Autocomplete básico"
                    : status?.mode === "error"
                      ? "Verificar autocomplete"
                      : status?.mode === "none"
                        ? "Autocomplete desativado"
                        : "Preparando autocomplete"}
            </button>
            <button
              className="status-refresh"
              title={hints.title("refreshLanguage")}
              aria-label="Atualizar autocomplete"
              onClick={() => startLanguage(true)}
            >
              <RefreshCw size={11} />
            </button>
            <span className="status-divider" />
            <span>
              Ln {position.line}, Col {position.column}
            </span>
          </div>
        </footer>
      </main>
      {profileModal && (
        <ProfileDialog
          profiles={state.profiles}
          initial={profileModal === "new" ? undefined : profileModal}
          close={() => setProfileModal(null)}
          saved={savedProfile}
          deleted={deletedProfile}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          settings={state.settings}
          initialSection={settingsSection}
          build={buildInfo}
          checkUpdates={() => checkUpdates(true)}
          close={() => setSettingsOpen(false)}
          saved={savedSettings}
        />
      )}
      {updatesOpen && (
        <UpdatesDialog
          info={updateInfo}
          build={buildInfo}
          checking={checkingUpdates}
          error={updateError}
          check={() => checkUpdates(true)}
          close={() => setUpdatesOpen(false)}
        />
      )}
      {languageDetails && (
        <Modal
          title="Autocomplete"
          eyebrow="DIAGNÓSTICO"
          close={() => setLanguageDetails(false)}
          scope="language"
          className="language-modal"
        >
          <div className="language-details">
            <p>{status?.message || "Aguardando preparação do editor."}</p>
            {status?.warning && (
              <div className="form-error">
                <AlertCircle size={17} />
                {status.warning}
              </div>
            )}
            <dl>
              <dt>Servidor</dt>
              <dd>
                {status?.mode === "phpactor"
                  ? "Phpactor"
                  : status?.mode === "basic"
                    ? "Indexador básico"
                    : status?.mode || "Aguardando"}
              </dd>
              <dt>Origem dos tipos</dt>
              <dd>
                {(
                  {
                    cache: "Cache do projeto remoto",
                    mount: "Montagem local do Docker",
                    local: "Projeto local",
                    fallback: "Tipos PHP, sem fontes do projeto",
                  } as Record<string, string>
                )[status?.source || ""] || "Ainda não disponível"}
              </dd>
            </dl>
            <p>
              Use <Shortcut id="complete" /> para abrir as sugestões. A primeira
              indexação de um projeto grande pode levar algum tempo. Métodos
              mágicos do Laravel podem precisar de arquivos IDE Helper.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setLanguageDetails(false);
                  preferences();
                }}
              >
                Preferências <Shortcut id="preferences" />
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setLanguageDetails(false);
                  startLanguage(true);
                }}
              >
                Atualizar autocomplete <Shortcut id="refreshLanguage" />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Terminal size={15} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} title="Fechar aviso">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
