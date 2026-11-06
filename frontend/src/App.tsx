import { translateStatus } from "./i18n";
import { t as tr } from "./i18n";
import {
  setUILanguage,
  uiLanguage,
  normalizeLanguage,
  formatLocale,
} from "./i18n";
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
  PanelRight,
  Wand2,
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
import { UpdatePrompt, UpdatesDialog, useAppUpdate } from "./updates";
import { CommunityPrompt } from "./community";
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
  return `${date.toLocaleDateString(formatLocale(), { day: "2-digit", month: "2-digit" })} · ${date.toLocaleTimeString(formatLocale(), { hour: "2-digit", minute: "2-digit" })}`;
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
  const [dismissedUpdate, setDismissedUpdate] = useState("");
  const checkingUpdateRef = useRef(false);
  const [toast, setToast] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");
  const [renaming, setRenaming] = useState("");
  const renameGeneration = useRef(0);
  const [split, setSplit] = useState(52);
  const [outputVisible, setOutputVisible] = useState(true);
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
        const language = normalizeLanguage(data.settings.language);
        const reload = language !== uiLanguage();
        setUILanguage(language);
        if (reload) {
          window.location.reload();
          return;
        }
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
    state?.settings.checkUpdatesOnStartup,
    buildInfo?.releaseSource,
  ]);
  useEffect(() => {
    if (!state || !buildInfo || state.settings.checkUpdatesOnStartup === false)
      return;
    const source = buildInfo.releaseSource;
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
            tr(
              "Tabs saved on this device. They will be restored when you reopen the app.",
            ),
          );
      } catch (error) {
        notify(tr("Could not save: {0}", [errorText(error)]));
        throw error;
      }
    },
    [notify],
  );
  const updater = useAppUpdate(async () => {
    await settleEditorInput();
    await saveWorkspace();
  });
  useEffect(
    () =>
      window.runtime?.EventsOn("update:busy", () =>
        notify(tr("Please wait for the update to finish.")),
      ),
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
    const listener = (event: Event) =>
      notify((event as CustomEvent<string>).detail);
    window.addEventListener("tinkercraft:format-error", listener);
    return () =>
      window.removeEventListener("tinkercraft:format-error", listener);
  }, [notify]);
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
          message: tr("Select a connection"),
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
        message: tr("Preparing completion…"),
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
  const settingsKey = JSON.stringify([state?.settings.phpBinary]);
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
    setOutputVisible(true);
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
    name = tr("Untitled"),
    profileId?: string,
  ) {
    const current = stateRef.current;
    if (!current) return;
    if (current.tabs.length >= 20) {
      notify(tr("You can open up to 20 tabs. Close a tab to continue."));
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
      notify(tr("Cancel execution before closing this tab."));
      return;
    }
    const current = stateRef.current;
    if (!current) return;
    const tabs = current.tabs.filter((t) => t.id !== id);
    if (!tabs.length)
      tabs.push({
        id: uid(),
        name: tr("Untitled"),
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
    notify(tr("Connection saved."));
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
  async function savedSettings(settings: Settings) {
    settings = {
      ...settings,
      starPromptDismissed:
        settings.starPromptDismissed ||
        stateRef.current?.settings.starPromptDismissed,
      donationPromptDismissed:
        settings.donationPromptDismissed ||
        stateRef.current?.settings.donationPromptDismissed,
    };
    const language = normalizeLanguage(settings.language);
    if (language !== uiLanguage()) {
      await settleEditorInput();
      await saveWorkspace();
      if (window.go) await api.DisableCloseGuard();
      setUILanguage(language);
      window.location.reload();
      return;
    }
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
      tr("From history"),
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
      updateTab(renaming, { name: renameDraft.trim() || tr("Untitled") });
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
        notify(tr("Snippet saved as a PHP file."));
    } catch (error) {
      notify(errorText(error));
    }
  }
  function focusOutput() {
    setOutputVisible(true);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".output-panel")?.focus(),
    );
  }
  function hideOutput() {
    setOutputVisible(false);
    requestAnimationFrame(() => editorAction("focus"));
  }
  function toggleOutput() {
    setOutputVisible((visible) => !visible);
    requestAnimationFrame(() => editorAction("focus"));
  }
  async function supportProject() {
    try {
      await api.DismissDonationPrompt();
      setState(
        (current) =>
          current && {
            ...current,
            settings: { ...current.settings, donationPromptDismissed: true },
          },
      );
      await api.OpenSupportPage();
    } catch (error) {
      notify(errorText(error));
    }
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
    formatPHP: () => editorAction("editor.action.formatDocument"),
    toggleOutput,
    "community.support": supportProject,
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
        notify(translateStatus(status.message));
    },
    refreshLanguage: () => startLanguage(true),
    languageDetails: () => setLanguageDetails(true),
    tabFocus: () => editorAction("editor.action.toggleTabFocusMode"),
    focusEditor: () => editorAction("focus"),
    findEditor: () => editorAction("actions.find"),
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
          .querySelector<HTMLInputElement>("[data-history-filter]")
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
            <h1>{tr("Could not open the workspace.")}</h1>
            <p>{fatal}</p>
          </>
        ) : (
          <>
            <span className="spinner" />
            <p>{tr("Preparing your workspace…")}</p>
          </>
        )}
      </div>
    );
  const status = language[tab.id];
  const isRunning = Boolean(running[tab.id]);
  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label={tr("Navigation")}>
        <BrandIcon title="TinkerCraft" />
        <div className="activity-main">
          <button
            title={hints.title("connections")}
            aria-label={tr("Projects and connections")}
            className={sidebar === "projects" ? "active" : ""}
            onClick={() =>
              setSidebar(sidebar === "projects" ? null : "projects")
            }
          >
            <Code2 size={21} />
          </button>
          <button
            title={hints.title("history")}
            aria-label={tr("History")}
            className={sidebar === "history" ? "active" : ""}
            onClick={() => setSidebar(sidebar === "history" ? null : "history")}
          >
            <HistoryIcon size={21} />
          </button>
          <button
            title={hints.title("openPHP")}
            aria-label={tr("Open PHP snippet")}
            onClick={openSnippet}
          >
            <FolderOpen size={21} />
          </button>
        </div>
        <div className="activity-bottom">
          <button
            title={hints.title("preferences")}
            aria-label={tr("Preferences")}
            onClick={() => preferences()}
          >
            <Settings2 size={20} />
          </button>
          <button
            title={hints.title("commands")}
            aria-label={tr("Command palette")}
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
              {sidebar === "projects" ? tr("YOUR WORKSPACE") : tr("HISTORY")}
            </span>
            <button
              className="icon-button"
              title={
                sidebar === "projects"
                  ? hints.title("newConnection")
                  : hints.title("history", tr("Close history"))
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
                            ? tr("Local project")
                            : modeLabel(p.mode)}
                        </small>
                      </span>
                      {p.id === tab.profileId && (
                        <span className="selected-indicator" />
                      )}
                    </button>
                    <button
                      className="project-edit icon-button"
                      title={tr("Edit {0}", [p.name])}
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
                {tr("Add connection") + " "}
                <Shortcut id="newConnection" />
              </button>
              <div className="sidebar-divider" />
              <div className="sidebar-section-title">
                <span>{tr("OPEN TABS")}</span>
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
                  data-history-filter
                  aria-label={tr("Filter history")}
                  placeholder={tr("Search history…")}
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
                    {tr("Your executions will appear here.")}
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
                  {tr("Clear history") + " "}
                  <Shortcut id="clearHistory" />
                </button>
              )}
            </>
          )}
          <div className="sidebar-footer">
            <span className="small-status-dot" />
            {tr("Your personal playground")}
            <span>v{buildInfo?.version ?? "…"}</span>
          </div>
        </aside>
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="workspace-identity">
            <ModeIcon mode={profile?.mode ?? "local"} size={18} />
            <select
              className="connection-select"
              aria-label={tr("Execution environment")}
              title={`${hints.title("selectConnection")} — ${profile?.projectPath ?? ""}`}
              value={tab.profileId}
              onChange={(e) => selectProfile(e.target.value)}
            >
              <option value="" disabled>
                {tr("Select connection")}
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
              aria-label={tr("Configure connection")}
              onClick={() => setProfileModal(profile ?? "new")}
            >
              <Settings2 size={18} />
            </button>
            <button
              className="icon-button"
              title={hints.title("newConnection")}
              aria-label={tr("New connection")}
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
            <span>{isRunning ? tr("Cancel") : tr("Run")}</span>
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
                      aria-label={tr("Tab name")}
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
                    title={hints.title("renameTab", tr("Rename {0}", [t.name]))}
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
                  title={hints.title("closeTab", tr("Close {0}", [t.name]))}
                  aria-label={tr("Close {0}", [t.name])}
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
            aria-label={tr("New tab")}
            onClick={() => createTab()}
          >
            <Plus size={16} />
          </button>
          <div className="tabs-spacer" />
          <button
            className="icon-button"
            aria-label={tr("Format PHP code")}
            title={hints.title("formatPHP")}
            onClick={() => editorAction("editor.action.formatDocument")}
          >
            <Wand2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={tr("Toggle output visibility")}
            aria-pressed={outputVisible}
            title={hints.title(
              "toggleOutput",
              outputVisible ? tr("Hide output") : tr("Show output"),
            )}
            onClick={toggleOutput}
          >
            <PanelRight size={16} />
          </button>
          <button
            className="icon-button"
            title={hints.title("renameTab")}
            aria-label={tr("Rename tab")}
            onClick={() => renameTab()}
          >
            <Pencil size={14} />
          </button>
          <span
            className="autosave-status"
            title={
              saved
                ? tr(
                    "Tabs are saved on this device and restored when you reopen the app",
                  )
                : tr("Saving changes")
            }
            role="status"
            aria-label={saved ? tr("Tabs saved") : tr("Saving tabs")}
          >
            {saved ? <Check size={14} /> : <span className="unsaved-dot" />}
          </span>
          <button
            className="icon-button"
            title={hints.title("exportPHP")}
            aria-label={tr("Save snippet as PHP file")}
            onClick={exportPHP}
          >
            <ArrowDownToLine size={15} />
          </button>
        </div>
        <div
          className="workspace-panels"
          ref={workspaceRef}
          style={
            {
              "--editor-width": outputVisible ? `${split}%` : "100%",
            } as React.CSSProperties
          }
        >
          <section className="editor-panel">
            <CodeEditor
              tab={tab}
              formatting={state.settings.formatting}
              onChange={(code) => updateTab(tab.id, { code })}
              onPosition={(line, column) => setPosition({ line, column })}
            />
          </section>
          {outputVisible && (
            <div
              className="splitter"
              role="separator"
              aria-label={tr("Resize editor and output")}
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
          )}
          <Output
            visible={outputVisible}
            hide={hideOutput}
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
              {profile?.ssh.host || profile?.container || tr("Your machine")}
            </span>
            {updateInfo?.available && (
              <button
                className="update-badge"
                aria-label={tr("Update available")}
                onClick={() => setUpdatesOpen(true)}
                title={hints.title("checkUpdates")}
              >
                <ArrowUpCircle size={13} />
                {tr("Update") + " "}
                {updateInfo.latestVersion}
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
                  ? tr("Completion ready")
                  : translateStatus(status?.message ?? "Preparing completion")
              }
              title={`${hints.title("languageDetails")} — ${translateStatus(status?.warning || status?.message || "Preparing completion")}`}
              onClick={() => setLanguageDetails(true)}
            >
              {status?.mode === "loading" ? (
                <LoaderCircle className="spin" size={12} />
              ) : (
                <span className="small-status-dot" />
              )}
              {status?.warning
                ? tr("Completion warning")
                : status?.mode === "phpactor"
                  ? tr("Completion")
                  : status?.mode === "basic"
                    ? tr("Basic completion")
                    : status?.mode === "error"
                      ? tr("Check completion")
                      : status?.mode === "none"
                        ? tr("Completion disabled")
                        : tr("Preparing completion")}
            </button>
            <button
              className="status-refresh"
              title={hints.title("refreshLanguage")}
              aria-label={tr("Refresh completion")}
              onClick={() => startLanguage(true)}
            >
              <RefreshCw size={11} />
            </button>
            <span className="status-divider" />
            <span>
              Ln {position.line}, Col {position.column}
            </span>
            {buildInfo?.version && (
              <>
                <span className="status-divider" />
                <span
                  className="app-version"
                  aria-label={tr("Version {0}", [buildInfo.version])}
                >
                  v{buildInfo.version}
                </span>
              </>
            )}
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
          updater={updater}
          support={supportProject}
          info={updateInfo}
          build={buildInfo}
          checking={checkingUpdates}
          error={updateError}
          check={() => checkUpdates(true)}
          close={() => {
            setUpdatesOpen(false);
            if (updateInfo) setDismissedUpdate(updateInfo.latestVersion);
          }}
        />
      )}
      {languageDetails && (
        <Modal
          title={tr("Completion")}
          eyebrow={tr("DIAGNOSTICS")}
          close={() => setLanguageDetails(false)}
          scope="language"
          className="language-modal"
        >
          <div className="language-details">
            <p>
              {translateStatus(
                status?.message || "Waiting for the editor to initialize.",
              )}
            </p>
            {status?.warning && (
              <div className="form-error">
                <AlertCircle size={17} />
                {translateStatus(status.warning)}
              </div>
            )}
            <dl>
              <dt>{tr("Server")}</dt>
              <dd>
                {status?.mode === "phpactor"
                  ? "Phpactor"
                  : status?.mode === "basic"
                    ? tr("Basic indexer")
                    : status?.mode || tr("Waiting")}
              </dd>
              <dt>{tr("Type sources")}</dt>
              <dd>
                {(
                  {
                    cache: tr("Remote project cache"),
                    mount: tr("Local Docker mount"),
                    local: tr("Local project"),
                    fallback: tr("PHP types without project sources"),
                  } as Record<string, string>
                )[status?.source || ""] || tr("Not available yet")}
              </dd>
            </dl>
            <p>
              Use <Shortcut id="complete" />{" "}
              {" " +
                tr(
                  "to open suggestions. Initial indexing of a large project may take some time. Laravel magic methods may need IDE Helper files.",
                )}
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setLanguageDetails(false);
                  preferences();
                }}
              >
                {tr("Preferences") + " "}
                <Shortcut id="preferences" />
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setLanguageDetails(false);
                  startLanguage(true);
                }}
              >
                {tr("Refresh completion") + " "}
                <Shortcut id="refreshLanguage" />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {updateInfo?.available &&
        dismissedUpdate !== updateInfo.latestVersion &&
        !updatesOpen &&
        !settingsOpen &&
        !profileModal &&
        !languageDetails && (
          <UpdatePrompt
            info={updateInfo}
            updater={updater}
            dismiss={() => setDismissedUpdate(updateInfo.latestVersion)}
            details={() => setUpdatesOpen(true)}
          />
        )}
      {!updateInfo?.available && !state.settings.starPromptDismissed && (
        <CommunityPrompt
          dismissed={() =>
            setState(
              (current) =>
                current && {
                  ...current,
                  settings: { ...current.settings, starPromptDismissed: true },
                },
            )
          }
          notify={notify}
        />
      )}
      {!updateInfo?.available &&
        state.settings.starPromptDismissed &&
        state.suggestSupport &&
        !state.settings.donationPromptDismissed && (
          <CommunityPrompt
            kind="donation"
            dismissed={() =>
              setState(
                (current) =>
                  current && {
                    ...current,
                    settings: {
                      ...current.settings,
                      donationPromptDismissed: true,
                    },
                  },
              )
            }
            notify={notify}
          />
        )}
      {toast && (
        <div className="toast" role="status">
          <Terminal size={15} />
          <span>{tr(toast)}</span>
          <button
            onClick={() => setToast("")}
            title={tr("Dismiss notification")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
