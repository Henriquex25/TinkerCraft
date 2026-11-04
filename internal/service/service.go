package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"tinkercraft/internal/buildinfo"
	"tinkercraft/internal/core"
	"tinkercraft/internal/execution"
	"tinkercraft/internal/language"
	"tinkercraft/internal/storage"
	"tinkercraft/internal/updates"
	phpruntime "tinkercraft/runtime"
)

const WelcomeCode = "// A space to explore your ideas.\n$people = [\n    ['id' => 1, 'name' => 'Ana Silva', 'role' => 'Developer', 'active' => true],\n    ['id' => 2, 'name' => 'Bruno Costa', 'role' => 'Designer', 'active' => true],\n    ['id' => 3, 'name' => 'Clara Santos', 'role' => 'Developer', 'active' => false],\n];\n\n$people;\n"

type Service struct {
	suggestSupport     bool
	Updates            *updates.Manager
	Cache              *language.Cache
	preparations       map[string]preparation
	OnLanguageProgress func(string, string)
	Store              *storage.Store
	Engine             *execution.Engine
	Language           *language.Manager
	Dir                string
	mu                 sync.Mutex
	languageStartMu    sync.Mutex
	runs               map[string]context.CancelFunc
	root               context.Context
	cancel             context.CancelFunc
}

type preparation struct {
	id     string
	cancel context.CancelFunc
}

func New(dir string) (*Service, error) {
	store, err := storage.Open(dir)
	if err != nil {
		return nil, err
	}
	runtimeDir, err := phpruntime.Materialize(dir)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	s := &Service{Store: store, Engine: &execution.Engine{RuntimeDir: runtimeDir}, Language: language.NewManager(runtimeDir), Dir: dir, runs: map[string]context.CancelFunc{}, root: ctx, cancel: cancel}
	state := store.Snapshot()
	s.Updates = updates.New(buildinfo.Current(), nil)
	s.Cache = language.NewCache(filepath.Join(dir, "cache", "autocomplete"), s.Engine)
	s.preparations = map[string]preparation{}
	if state.Settings.CacheDays == 0 {
		if err := store.Update(func(st *core.State) error { st.Settings.CacheDays = 7; return nil }); err != nil {
			return nil, err
		}
	}
	if err := s.Cache.Cleanup(store.Snapshot().Settings.CacheDays, nil); err != nil {
		return nil, err
	}
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.Cache.Cleanup(store.Snapshot().Settings.CacheDays, s.Language.Roots())
			}
		}
	}()
	s.Language.PhpactorPath = bundledPhpactor()
	if len(state.Tabs) == 0 {
		playground := filepath.Join(dir, "playground")
		if err = os.MkdirAll(playground, 0700); err != nil {
			return nil, err
		}
		profile := core.Profile{ID: execution.ID(), Name: "PHP Playground", Mode: "local", ProjectPath: playground, PHPBinary: "php", Bootstrap: "none", Timeout: 30}
		tab := core.Tab{ID: execution.ID(), Name: "First idea", Code: WelcomeCode, ProfileID: profile.ID}
		if err := store.Update(func(state *core.State) error {
			state.Profiles = append(state.Profiles, profile)
			state.Tabs = []core.Tab{tab}
			state.ActiveTab = tab.ID
			return nil
		}); err != nil {
			return nil, err
		}
	}
	if store.Snapshot().LaunchCount < 5 {
		if err := store.Update(func(state *core.State) error {
			state.LaunchCount = min(5, max(0, state.LaunchCount)+1)
			return nil
		}); err != nil {
			s.Close()
			return nil, err
		}
	}
	current := store.Snapshot()
	s.suggestSupport = current.LaunchCount >= 5 && len(current.History) > 0 && current.Settings.StarPromptDismissed && !current.Settings.DonationPromptDismissed
	return s, nil
}
func (s *Service) Close() { s.cancel(); s.Language.Close() }
func (s *Service) Bootstrap() core.BootstrapState {
	state := s.Store.Snapshot()
	return core.BootstrapState{State: state, SuggestSupport: s.suggestSupport && !state.Settings.DonationPromptDismissed}
}
func (s *Service) SaveProfile(profile core.Profile) (core.Profile, error) {
	if profile.ID == "" {
		profile.ID = execution.ID()
	}
	profile.Name = strings.TrimSpace(profile.Name)
	if profile.Name == "" {
		return profile, fmt.Errorf("Dê um nome para a conexão")
	}
	if err := profile.Validate(); err != nil {
		return profile, err
	}
	err := s.Store.Update(func(state *core.State) error {
		for i, p := range state.Profiles {
			if p.ID == profile.ID {
				state.Profiles[i] = profile
				return nil
			}
		}
		if len(state.Profiles) >= 100 {
			return fmt.Errorf("Limite de 100 conexões")
		}
		state.Profiles = append(state.Profiles, profile)
		return nil
	})
	return profile, err
}
func (s *Service) DeleteProfile(id string) error {
	return s.Store.Update(func(state *core.State) error {
		profiles := []core.Profile{}
		for _, p := range state.Profiles {
			if p.ID != id {
				profiles = append(profiles, p)
			}
		}
		state.Profiles = profiles
		for i := range state.Tabs {
			if state.Tabs[i].ProfileID == id {
				state.Tabs[i].ProfileID = ""
			}
		}
		return nil
	})
}
func (s *Service) SaveWorkspace(tabs []core.Tab, active string) error {
	if len(tabs) < 1 || len(tabs) > 20 {
		return fmt.Errorf("Use entre 1 e 20 abas")
	}
	ids := map[string]bool{}
	for _, tab := range tabs {
		if tab.ID == "" || len(tab.ID) > 100 || len(tab.Name) > 100 || len(tab.Code) > 1048576 || ids[tab.ID] {
			return fmt.Errorf("Aba inválida ou trecho maior que 1 MiB")
		}
		ids[tab.ID] = true
	}
	if !ids[active] {
		return fmt.Errorf("Aba ativa inválida")
	}
	return s.Store.Update(func(state *core.State) error { state.Tabs = tabs; state.ActiveTab = active; return nil })
}
func (s *Service) SaveSettings(settings core.Settings) error {
	if rules := settings.Formatting; rules != nil {
		if rules.TabWidth < 1 || rules.TabWidth > 8 {
			return fmt.Errorf("Indentation must be between 1 and 8 spaces.")
		}
		if rules.PrintWidth < 40 || rules.PrintWidth > 240 {
			return fmt.Errorf("Line width must be between 40 and 240 characters.")
		}
		if rules.BraceStyle != "per-cs" && rules.BraceStyle != "1tbs" {
			return fmt.Errorf("Brace style must be per-cs or 1tbs.")
		}
	}
	if settings.Language == "" {
		settings.Language = "en"
	}
	if settings.Language != "en" && settings.Language != "pt-BR" {
		return fmt.Errorf("Unsupported interface language")
	}
	if len(settings.Shortcuts) > 128 {
		return fmt.Errorf("Limite de 128 atalhos")
	}
	for id, binding := range settings.Shortcuts {
		if len(id) > 100 || len(binding) > 80 || strings.ContainsAny(id+binding, "\x00\r\n") {
			return fmt.Errorf("Atalho inválido")
		}
	}
	if settings.CacheDays == 0 {
		settings.CacheDays = 7
	}
	if settings.CacheDays < 1 || settings.CacheDays > 90 {
		return fmt.Errorf("A expiração do cache deve ficar entre 1 e 90 dias")
	}
	if settings.PHPBinary == "" || strings.HasPrefix(settings.PHPBinary, "-") || strings.ContainsAny(settings.PHPBinary, "\x00\r\n") {
		return fmt.Errorf("Executável PHP inválido")
	}
	return s.Store.Update(func(state *core.State) error {
		settings.StarPromptDismissed = settings.StarPromptDismissed || state.Settings.StarPromptDismissed
		settings.DonationPromptDismissed = settings.DonationPromptDismissed || state.Settings.DonationPromptDismissed
		state.Settings = settings
		return nil
	})
}
func (s *Service) DismissStarPrompt() error {
	return s.Store.Update(func(state *core.State) error {
		state.Settings.StarPromptDismissed = true
		return nil
	})
}
func (s *Service) DismissDonationPrompt() error {
	return s.Store.Update(func(state *core.State) error {
		state.Settings.DonationPromptDismissed = true
		return nil
	})
}
func (s *Service) profile(id string) (core.Profile, error) {
	for _, p := range s.Store.Snapshot().Profiles {
		if p.ID == id {
			return p, nil
		}
	}
	return core.Profile{}, fmt.Errorf("Selecione uma conexão")
}
func (s *Service) Execute(tabID, profileID, code string) (core.Result, error) {
	if tabID == "" || len(tabID) > 100 || len(code) > 1048576 {
		return core.Result{}, fmt.Errorf("Aba inválida ou trecho maior que 1 MiB")
	}
	p, err := s.profile(profileID)
	if err != nil {
		return core.Result{}, err
	}
	ctx, cancel := context.WithCancel(s.root)
	s.mu.Lock()
	if _, exists := s.runs[tabID]; exists {
		s.mu.Unlock()
		cancel()
		return core.Result{}, fmt.Errorf("Esta aba já está executando")
	}
	s.runs[tabID] = cancel
	s.mu.Unlock()
	defer func() { cancel(); s.mu.Lock(); delete(s.runs, tabID); s.mu.Unlock() }()
	result := s.Engine.Execute(ctx, p, s.Store.Snapshot().Settings, code)
	historyErr := s.Store.Update(func(state *core.State) error {
		item := core.History{ID: execution.ID(), ProfileID: p.ID, ProfileName: p.Name, Code: code, CreatedAt: time.Now().Format(time.RFC3339), Success: result.Success, DurationMS: result.DurationMS}
		state.History = append([]core.History{item}, state.History...)
		if len(state.History) > 50 {
			state.History = state.History[:50]
		}
		return nil
	})
	if historyErr != nil {
		result.Warnings = append(result.Warnings, "Não foi possível salvar o histórico: "+historyErr.Error())
	}
	return result, nil
}
func (s *Service) Cancel(tabID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	cancel := s.runs[tabID]
	if cancel != nil {
		cancel()
		return true
	}
	return false
}
func (s *Service) TestConnection(profile core.Profile) (core.Result, error) {
	if err := profile.Validate(); err != nil {
		return core.Result{}, err
	}
	profile.Bootstrap = "none"
	profile.Timeout = 15
	return s.Engine.Execute(s.root, profile, s.Store.Snapshot().Settings, "['php' => PHP_VERSION, 'directory' => getcwd(), 'host' => gethostname()];"), nil
}
func (s *Service) ListContainers(profile core.Profile) ([]execution.Container, error) {
	return s.Engine.Containers(s.root, profile)
}
func (s *Service) ContainerWorkdir(profile core.Profile, container string) (string, error) {
	return s.Engine.ContainerWorkdir(s.root, profile, container)
}
func (s *Service) StartLanguage(tabID, profileID, code string) (language.Status, error) {
	return s.startLanguage(tabID, profileID, code, false)
}
func (s *Service) RefreshLanguage(tabID, profileID, code string) (language.Status, error) {
	return s.startLanguage(tabID, profileID, code, true)
}
func (s *Service) startLanguage(tabID, profileID, code string, refresh bool) (language.Status, error) {
	if tabID == "" || len(tabID) > 100 || len(code) > 1048576 {
		return language.Status{}, fmt.Errorf("Aba inválida ou trecho maior que 1 MiB")
	}
	p, err := s.profile(profileID)
	if err != nil {
		return language.Status{}, err
	}
	ctx, cancel := context.WithCancel(s.root)
	op := preparation{id: execution.ID(), cancel: cancel}
	s.mu.Lock()
	if previous, ok := s.preparations[tabID]; ok {
		previous.cancel()
	}
	s.preparations[tabID] = op
	s.mu.Unlock()
	defer func() {
		cancel()
		s.mu.Lock()
		if s.preparations[tabID].id == op.id {
			delete(s.preparations, tabID)
		}
		s.mu.Unlock()
	}()

	s.languageStartMu.Lock()
	defer s.languageStartMu.Unlock()
	if err := ctx.Err(); err != nil {
		return language.Status{}, err
	}
	s.Language.Stop(tabID)
	if p.AutocompleteMode() == "off" {
		return language.Status{Mode: "none", Message: "Autocomplete desativado nesta conexão"}, nil
	}
	settings := s.Store.Snapshot().Settings
	if err := s.Cache.Cleanup(settings.CacheDays, s.Language.Roots()); err != nil {
		return language.Status{}, err
	}
	if s.OnLanguageProgress != nil {
		s.OnLanguageProgress(tabID, "Preparando arquivos para autocomplete…")
	}
	project, err := s.Cache.Prepare(ctx, p, refresh)
	if err != nil {
		if ctx.Err() != nil {
			return language.Status{}, ctx.Err()
		}

		root := filepath.Join(s.Dir, "language-scratch", "project")
		if mkdirErr := os.MkdirAll(root, 0700); mkdirErr != nil {
			return language.Status{}, mkdirErr
		}
		project = language.CachedProject{Root: root, Source: "fallback", Notice: "Somente tipos PHP: não foi possível preparar os fontes do projeto. " + err.Error()}
	}
	if err = ctx.Err(); err != nil {
		return language.Status{}, err
	}
	if s.OnLanguageProgress != nil {
		s.OnLanguageProgress(tabID, "Indexando projeto…")
	}
	var status language.Status
	if project.Source == "cache" || project.Source == "fallback" {
		status, err = s.Language.StartCached(tabID, project.Root, code, settings)
	} else {
		status, err = s.Language.Start(tabID, project.Root, code, settings)
	}
	if ctx.Err() != nil {
		s.Language.Stop(tabID)
		return language.Status{}, ctx.Err()
	}
	status.Source = project.Source
	if !project.UpdatedAt.IsZero() {
		status.UpdatedAt = project.UpdatedAt.Format(time.RFC3339)
		status.Message += " · cache updated on " + status.UpdatedAt
	}
	if project.Source == "mount" {
		status.Message += " · diretório montado pelo Docker"
	}
	if project.Notice != "" {
		status.Warning = project.Notice
		status.Message += " · " + project.Notice
	}
	return status, err
}
func (s *Service) StopLanguage(tabID string) {
	s.mu.Lock()
	if op, ok := s.preparations[tabID]; ok {
		op.cancel()
		delete(s.preparations, tabID)
	}
	s.mu.Unlock()
	s.Language.Stop(tabID)
}
func (s *Service) ChangeLanguage(tabID, code string) error {
	s.Cache.Touch(s.Language.Root(tabID))
	return s.Language.Change(tabID, code)
}
func (s *Service) LanguageRequest(tabID, method, code string, line, character int) (any, error) {
	s.Cache.Touch(s.Language.Root(tabID))
	return s.Language.Request(tabID, method, code, line, character)
}
func (s *Service) ResolveCompletion(tabID string, item json.RawMessage) (any, error) {
	return s.Language.Resolve(tabID, item)
}
func (s *Service) ClearHistory() error {
	return s.Store.Update(func(state *core.State) error { state.History = []core.History{}; return nil })
}

type Health struct {
	PHP      string `json:"php"`
	Docker   bool   `json:"docker"`
	SSH      bool   `json:"ssh"`
	Phpactor string `json:"phpactor"`
	DataDir  string `json:"dataDir"`
}

func (s *Service) Health() Health {
	settings := s.Store.Snapshot().Settings
	ctx, cancel := context.WithTimeout(s.root, 5*time.Second)
	defer cancel()
	php := settings.PHPBinary
	if php == "" {
		php = "php"
	}
	output, err := execution.Run(ctx, execution.Command{Binary: php, Args: []string{"-r", "echo PHP_VERSION;"}}, nil, 1024)
	version := "Indisponível"
	if err == nil && output.ExitCode == 0 {
		version = output.Stdout
	}
	_, docker := exec.LookPath("docker")
	_, ssh := exec.LookPath("ssh")
	return Health{PHP: version, Docker: docker == nil, SSH: ssh == nil, Phpactor: s.Language.PhpactorPath, DataDir: s.Dir}
}
