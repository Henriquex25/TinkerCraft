package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"tinkercraft/internal/buildinfo"
	"tinkercraft/internal/core"
	"tinkercraft/internal/execution"
	"tinkercraft/internal/language"
	"tinkercraft/internal/service"
	"tinkercraft/internal/updates"
)

type App struct {
	closeGuard    atomic.Bool
	closePending  atomic.Bool
	closeAllowed  atomic.Bool
	updateBusy    atomic.Bool
	updateMu      sync.Mutex
	updateVersion string
	restartPipe   *os.File
	installer     *updates.Installer
	ctx           context.Context
	svc           *service.Service
}

func (a *App) EnableCloseGuard()  { a.closeGuard.Store(true) }
func (a *App) DisableCloseGuard() { a.closeGuard.Store(false) }
func (a *App) ConfirmClose() {
	a.updateMu.Lock()
	if a.restartPipe != nil {
		if _, err := a.restartPipe.Write([]byte{'R'}); err != nil {
			a.updateMu.Unlock()
			a.CancelClose()
			return
		}
	}
	a.updateMu.Unlock()
	a.closeAllowed.Store(true)
	runtime.Quit(a.ctx)
}
func (a *App) CancelClose() {
	a.updateMu.Lock()
	if a.restartPipe != nil {
		a.restartPipe.Close()
		a.restartPipe = nil
	}
	a.updateMu.Unlock()
	a.closePending.Store(false)
}
func (a *App) beforeClose(ctx context.Context) bool {
	if a.updateBusy.Load() {
		runtime.EventsEmit(ctx, "update:busy")
		return true
	}
	if !a.closeGuard.Load() || a.closeAllowed.Load() {
		return false
	}
	if a.closePending.CompareAndSwap(false, true) {
		runtime.EventsEmit(ctx, "app:before-close")
	}
	return true
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.svc.OnLanguageProgress = func(id, message string) {
		runtime.EventsEmit(ctx, "language:progress", map[string]string{"tabId": id, "message": message})
	}
	a.svc.Language.OnDiagnostics = func(id string, params json.RawMessage) {
		var payload any
		json.Unmarshal(params, &payload)
		runtime.EventsEmit(ctx, "language:diagnostics", map[string]any{"tabId": id, "data": payload})
	}
}
func (a *App) shutdown(context.Context)                         { a.svc.Close() }
func (a *App) Bootstrap() core.BootstrapState                   { return a.svc.Bootstrap() }
func (a *App) SaveProfile(p core.Profile) (core.Profile, error) { return a.svc.SaveProfile(p) }
func (a *App) DeleteProfile(id string) error                    { return a.svc.DeleteProfile(id) }
func (a *App) DismissStarPrompt() error                         { return a.svc.DismissStarPrompt() }
func (a *App) DismissDonationPrompt() error                     { return a.svc.DismissDonationPrompt() }
func (a *App) OpenSupportPage() error {
	runtime.BrowserOpenURL(a.ctx, "https://www.buymeacoffee.com/henriquemiranda")
	return nil
}
func (a *App) OpenProjectRepository() error {
	runtime.BrowserOpenURL(a.ctx, "https://github.com/Henriquex25/TinkerCraft")
	return nil
}
func (a *App) SaveWorkspace(tabs []core.Tab, active string) error {
	return a.svc.SaveWorkspace(tabs, active)
}
func (a *App) SaveSettings(settings core.Settings) error {
	if err := a.svc.SaveSettings(settings); err != nil {
		return err
	}
	runtime.WindowSetTitle(a.ctx, a.dialogText("TinkerCraft · PHP workspace", "TinkerCraft · Workspace PHP"))
	return nil
}
func (a *App) Execute(tabID, profileID, code string) (core.Result, error) {
	return a.svc.Execute(tabID, profileID, code)
}
func (a *App) Cancel(id string) bool                              { return a.svc.Cancel(id) }
func (a *App) TestConnection(p core.Profile) (core.Result, error) { return a.svc.TestConnection(p) }
func (a *App) ListContainers(p core.Profile) ([]execution.Container, error) {
	return a.svc.ListContainers(p)
}
func (a *App) ContainerWorkdir(p core.Profile, container string) (string, error) {
	return a.svc.ContainerWorkdir(p, container)
}
func (a *App) StartLanguage(tabID, profileID, code string) (language.Status, error) {
	return a.svc.StartLanguage(tabID, profileID, code)
}
func (a *App) RefreshLanguage(tabID, profileID, code string) (language.Status, error) {
	return a.svc.RefreshLanguage(tabID, profileID, code)
}
func (a *App) StopLanguage(id string)               { a.svc.StopLanguage(id) }
func (a *App) ChangeLanguage(id, code string) error { return a.svc.ChangeLanguage(id, code) }
func (a *App) LanguageRequest(id, method, code string, line, character int) (any, error) {
	return a.svc.LanguageRequest(id, method, code, line, character)
}
func (a *App) ResolveCompletion(id string, item json.RawMessage) (any, error) {
	return a.svc.ResolveCompletion(id, item)
}
func (a *App) ClearHistory() error       { return a.svc.ClearHistory() }
func (a *App) BuildInfo() buildinfo.Info { return a.svc.BuildInfo() }
func (a *App) CheckUpdates() (updates.Info, error) {
	info, err := a.svc.CheckUpdates()
	info.InstallStatus = a.installer.Status(a.ctx, info.LatestVersion)
	return info, err
}
func (a *App) DownloadUpdate() (updates.Download, error) { return a.svc.DownloadUpdate() }
func (a *App) UpdateApp() error {
	if a.closePending.Load() {
		return fmt.Errorf("The app is closing. Try updating after reopening it.")
	}
	if !a.updateBusy.CompareAndSwap(false, true) {
		return fmt.Errorf("An update is already in progress.")
	}
	defer a.updateBusy.Store(false)
	ctx, cancel := context.WithTimeout(a.ctx, 20*time.Minute)
	defer cancel()
	info, err := a.svc.CheckUpdates()
	if err != nil {
		return err
	}
	status := a.installer.Status(ctx, info.LatestVersion)
	version := status.InstalledVersion
	if !status.CanInstall {
		return fmt.Errorf("Automatic updates are available in the installed Debian app. Install the official .deb package first.")
	}
	if !status.RestartRequired {
		runtime.EventsEmit(a.ctx, "update:progress", "downloading")
		download, err := a.svc.DownloadUpdate()
		if err != nil {
			return err
		}
		path, err := a.svc.InstallerPackage()
		if err != nil {
			return err
		}
		runtime.EventsEmit(a.ctx, "update:progress", "installing")
		if err := a.installer.Install(ctx, path, download.Version); err != nil {
			return err
		}
		version = download.Version
	}
	a.updateMu.Lock()
	a.updateVersion = version
	a.updateMu.Unlock()
	return nil
}
func (a *App) RestartUpdatedApp() error {
	if !a.closeGuard.Load() {
		return fmt.Errorf("The editor is not ready to save and restart. Please try again.")
	}
	a.updateMu.Lock()
	defer a.updateMu.Unlock()
	if a.restartPipe != nil {
		return fmt.Errorf("An update restart is already pending.")
	}
	if a.updateVersion == "" {
		return fmt.Errorf("Verify the installed update before restarting.")
	}
	pipe, err := a.installer.PrepareRestart(a.ctx, a.updateVersion)
	if err != nil {
		return err
	}
	a.restartPipe = pipe
	runtime.Quit(a.ctx)
	return nil
}
func (a *App) OpenUpdateRelease() error {
	address, err := a.svc.UpdateReleasePage()
	if err != nil {
		return err
	}
	runtime.BrowserOpenURL(a.ctx, address)
	return nil
}
func (a *App) Health() service.Health { return a.svc.Health() }
func (a *App) dialogText(english, portuguese string) string {
	if a.svc.Store.Snapshot().Settings.Language == "pt-BR" {
		return portuguese
	}
	return english
}
func (a *App) ChooseDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: a.dialogText("Select the project directory", "Selecione o diretório do projeto"), CanCreateDirectories: false})
}
func (a *App) ChooseFile() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: a.dialogText("Select a file", "Selecione um arquivo")})
}
func (a *App) OpenSnippet() (*core.Tab, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: a.dialogText("Open PHP snippet", "Abrir trecho PHP"), Filters: []runtime.FileFilter{{DisplayName: "PHP", Pattern: "*.php"}}})
	if err != nil || path == "" {
		return nil, err
	}
	stat, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if stat.Size() > 1048576 {
		return nil, fmt.Errorf("Arquivo maior que 1 MiB")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return &core.Tab{ID: execution.ID(), Name: strings.TrimSuffix(filepath.Base(path), ".php"), Code: string(data)}, nil
}
func (a *App) SaveSnippet(name, code string) (bool, error) {
	if !strings.HasPrefix(strings.TrimSpace(code), "<?php") {
		code = "<?php\n" + code
	}
	return a.saveFile(name+".php", code, a.dialogText("Save PHP snippet", "Salvar trecho PHP"))
}
func (a *App) Export(name, content string) (bool, error) {
	if len(content) > 32*1024*1024 {
		return false, fmt.Errorf("Exportação maior que 32 MiB")
	}
	return a.saveFile(filepath.Base(name), content, a.dialogText("Export output", "Exportar resultado"))
}
func (a *App) saveFile(name, content, title string) (bool, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: title, DefaultFilename: filepath.Base(name)})
	if err != nil || path == "" {
		return false, err
	}
	return true, os.WriteFile(path, []byte(content), 0600)
}
func (a *App) Copy(text string) error { return runtime.ClipboardSetText(a.ctx, text) }
