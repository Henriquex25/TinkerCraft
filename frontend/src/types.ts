export interface SSH {
  host: string;
  user: string;
  port: number;
  identityFile: string;
}
export interface Profile {
  id: string;
  name: string;
  mode: "local" | "docker" | "ssh" | "ssh-docker";
  projectPath: string;
  localPath: string;
  autocomplete?: "auto" | "local" | "off";
  phpBinary: string;
  container: string;
  ssh: SSH;
  bootstrap: string;
  bootstrapFile: string;
  timeout: number;
}
export interface Settings {
  donationPromptDismissed?: boolean;
  starPromptDismissed?: boolean;
  language?: "en" | "pt-BR";
  updateSource?: string;
  checkUpdatesOnStartup?: boolean;
  shortcuts?: Record<string, string>;
  cacheDays?: number;
  phpBinary: string;
  phpactorPath: string;
}
export interface Tab {
  id: string;
  name: string;
  code: string;
  profileId: string;
}
export interface History {
  id: string;
  profileId: string;
  profileName: string;
  code: string;
  createdAt: string;
  success: boolean;
  durationMs: number;
}
export interface State {
  launchCount?: number;
  suggestSupport?: boolean;
  version: number;
  profiles: Profile[];
  settings: Settings;
  tabs: Tab[];
  activeTab: string;
  history: History[];
}
export interface ValueNode {
  type: string;
  class?: string;
  value?: unknown;
  children?: {
    key: string;
    value: ValueNode;
  }[];
  count?: number;
  list?: boolean;
  truncated?: boolean;
}
export interface RunResult {
  success: boolean;
  value: ValueNode | null;
  dumps: ValueNode[];
  stdout: string;
  stderr: string;
  warnings: string[];
  error: {
    class: string;
    message: string;
    file: string;
    line: number;
    trace: string;
  } | null;
  durationMs: number;
  memoryBytes: number;
  framework: string;
  phpVersion: string;
  truncated: boolean;
  cancelled: boolean;
}
export interface LanguageStatus {
  warning?: string;
  source?: string;
  updatedAt?: string;
  mode: string;
  message: string;
  files: number;
  root: string;
}
export interface Container {
  id: string;
  name: string;
  image: string;
  workdir: string;
}
export interface Health {
  php: string;
  docker: boolean;
  ssh: boolean;
  phpactor: string;
  dataDir: string;
}
export interface BuildInfo {
  version: string;
  releaseSource: string;
  distribution: string;
  platform: string;
  architecture: string;
  webkit: string;
  variant: string;
  commit: string;
  buildDate: string;
}
export interface UpdateInfo {
  build: BuildInfo;
  configured: boolean;
  source: string;
  available: boolean;
  latestVersion: string;
  notes: string;
  releaseURL: string;
  canDownload: boolean;
  packageName: string;
  packageSize: number;
  message: string;
  checkedAt: string;
}
export interface UpdateDownload {
  path: string;
  version: string;
  size: number;
}
export interface API {
  BuildInfo(): Promise<BuildInfo>;
  CheckUpdates(): Promise<UpdateInfo>;
  DownloadUpdate(): Promise<UpdateDownload>;
  OpenUpdateInstaller(): Promise<void>;
  OpenUpdateRelease(): Promise<void>;
  EnableCloseGuard(): Promise<void>;
  DisableCloseGuard(): Promise<void>;
  ConfirmClose(): Promise<void>;
  CancelClose(): Promise<void>;
  Bootstrap(): Promise<State>;
  SaveProfile(profile: Profile): Promise<Profile>;
  DeleteProfile(id: string): Promise<void>;
  SaveWorkspace(tabs: Tab[], active: string): Promise<void>;
  SaveSettings(settings: Settings): Promise<void>;
  DismissStarPrompt(): Promise<void>;
  DismissDonationPrompt(): Promise<void>;
  OpenSupportPage(): Promise<void>;
  OpenProjectRepository(): Promise<void>;
  Execute(tabId: string, profileId: string, code: string): Promise<RunResult>;
  Cancel(tabId: string): Promise<boolean>;
  TestConnection(profile: Profile): Promise<RunResult>;
  ListContainers(profile: Profile): Promise<Container[]>;
  ContainerWorkdir(profile: Profile, container: string): Promise<string>;
  StartLanguage(
    tabId: string,
    profileId: string,
    code: string,
  ): Promise<LanguageStatus>;
  RefreshLanguage(
    tabId: string,
    profileId: string,
    code: string,
  ): Promise<LanguageStatus>;
  StopLanguage(tabId: string): Promise<void>;
  ChangeLanguage(tabId: string, code: string): Promise<void>;
  LanguageRequest(
    tabId: string,
    method: string,
    code: string,
    line: number,
    character: number,
  ): Promise<any>;
  ResolveCompletion(tabId: string, item: any): Promise<any>;
  ClearHistory(): Promise<void>;
  Health(): Promise<Health>;
  ChooseDirectory(): Promise<string>;
  ChooseFile(): Promise<string>;
  OpenSnippet(): Promise<Tab | null>;
  SaveSnippet(name: string, code: string): Promise<boolean>;
  Export(name: string, content: string): Promise<boolean>;
  Copy(text: string): Promise<void>;
}
declare global {
  interface Window {
    go?: {
      main: {
        App: API;
      };
    };
    runtime?: {
      EventsOn(name: string, callback: (data: any) => void): () => void;
    };
    MonacoEnvironment?: {
      getWorkerUrl?: (module: string, label: string) => string;
      getWorker?: (module: string, label: string) => Worker;
    };
  }
}
