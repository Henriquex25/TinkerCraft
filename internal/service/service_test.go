package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"tinkercraft/internal/buildinfo"
	"tinkercraft/internal/core"
)

func TestLegacyCoreSettingsCannotOverridePackagedServices(t *testing.T) {
	distribution := buildinfo.Distribution
	buildinfo.Distribution = "deb"
	t.Cleanup(func() { buildinfo.Distribution = distribution })
	dir := t.TempDir()
	marker := filepath.Join(dir, "untrusted-script-executed")
	script := filepath.Join(dir, "custom-phpactor.php")
	if err := os.WriteFile(script, []byte("<?php file_put_contents("+fmt.Sprintf("%q", marker)+", 'executed');"), 0600); err != nil {
		t.Fatal(err)
	}
	settings := map[string]any{"phpBinary": "php", "language": "en", "cacheDays": 7, "phpactorPath": script, "updateSource": "https://example.invalid/updates"}
	payload, err := json.Marshal(map[string]any{"version": 1, "settings": settings})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "workspace.json"), payload, 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TINKERCRAFT_PHPACTOR", script)
	t.Setenv("LUME_PHPACTOR", script)
	t.Setenv("TINKERCRAFT_RELEASE_SOURCE", "https://example.invalid/environment")
	svc, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Close()
	if svc.Language.PhpactorPath == script || svc.UpdateSource() != buildinfo.ReleaseSource || svc.BuildInfo().ReleaseSource != buildinfo.ReleaseSource {
		t.Fatal("saved preferences or environment replaced a packaged component")
	}
	state := svc.Bootstrap()
	if _, err := svc.StartLanguage(state.Tabs[0].ID, state.Profiles[0].ID, "str"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("untrusted Phpactor script executed")
	}
	settings["language"] = "pt-BR"
	payload, _ = json.Marshal(settings)
	var submitted core.Settings
	if err := json.Unmarshal(payload, &submitted); err != nil {
		t.Fatal(err)
	}
	if err := svc.SaveSettings(submitted); err != nil {
		t.Fatal(err)
	}
	stored, err := os.ReadFile(filepath.Join(dir, "workspace.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(stored), "phpactorPath") || strings.Contains(string(stored), "updateSource") || svc.Bootstrap().Settings.Language != "pt-BR" {
		t.Fatal("internal settings remained exposed or user preferences were not saved")
	}
}

func TestStarInvitationDismissalIsPermanentAndPreservesWorkspace(t *testing.T) {
	dir := t.TempDir()
	svc, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Close()
	if svc.Bootstrap().Settings.StarPromptDismissed {
		t.Fatal("new workspaces should show the invitation")
	}
	settings := svc.Bootstrap().Settings
	if err := svc.SaveSettings(settings); err != nil {
		t.Fatal(err)
	}
	staleSettings := svc.Bootstrap().Settings
	expected := svc.Bootstrap()
	expected.Settings.StarPromptDismissed = true
	for range 2 {
		if err := svc.DismissStarPrompt(); err != nil {
			t.Fatal(err)
		}
	}
	if !reflect.DeepEqual(svc.Bootstrap(), expected) {
		t.Fatal("dismissing the invitation changed unrelated workspace data")
	}
	if err := svc.SaveSettings(staleSettings); err != nil {
		t.Fatal(err)
	}
	if !svc.Bootstrap().Settings.StarPromptDismissed {
		t.Fatal("saving an older settings form restored the invitation")
	}
	svc.Close()
	reopened, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	if !reopened.Bootstrap().Settings.StarPromptDismissed {
		t.Fatal("dismissal was lost after restarting the service")
	}
}

func TestInterfaceLanguageDefaultsPersistsAndRejectsUnknownValues(t *testing.T) {
	dir := t.TempDir()
	svc, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	if svc.Bootstrap().Settings.Language != "en" {
		t.Fatal("new workspaces must default to English")
	}
	settings := svc.Bootstrap().Settings
	settings.Language = "pt-BR"
	if err = svc.SaveSettings(settings); err != nil {
		t.Fatal(err)
	}
	svc.Close()
	reopened, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	if reopened.Bootstrap().Settings.Language != "pt-BR" {
		t.Fatal("language preference was not persisted")
	}
	settings.Language = "unsupported"
	if reopened.SaveSettings(settings) == nil {
		t.Fatal("unsupported language accepted")
	}
	if reopened.Bootstrap().Settings.Language != "pt-BR" {
		t.Fatal("rejected language changed the saved preference")
	}
}

func TestFormattingPreferencesPersistAndRejectInvalidRules(t *testing.T) {
	dir := t.TempDir()
	svc, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	settings := svc.Bootstrap().Settings
	settings.Formatting = &core.FormattingRules{TabWidth: 2, PrintWidth: 80, SingleQuote: true, TrailingCommaPHP: true, BraceStyle: "per-cs"}
	if err := svc.SaveSettings(settings); err != nil {
		t.Fatal(err)
	}
	svc.Close()
	reopened, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	if !reflect.DeepEqual(reopened.Bootstrap().Settings.Formatting, settings.Formatting) {
		t.Fatal("formatting rules lost on restart")
	}
	for _, invalid := range []core.FormattingRules{
		{TabWidth: 0, PrintWidth: 80, BraceStyle: "per-cs"},
		{TabWidth: 9, PrintWidth: 80, BraceStyle: "per-cs"},
		{TabWidth: 4, PrintWidth: 39, BraceStyle: "per-cs"},
		{TabWidth: 4, PrintWidth: 241, BraceStyle: "per-cs"},
		{TabWidth: 4, PrintWidth: 80, BraceStyle: "custom"},
	} {
		submitted := settings
		submitted.Formatting = &invalid
		if reopened.SaveSettings(submitted) == nil {
			t.Fatal("invalid formatting rule accepted")
		}
	}
	if !reflect.DeepEqual(reopened.Bootstrap().Settings.Formatting, settings.Formatting) {
		t.Fatal("invalid rules replaced saved preferences")
	}
}

func TestOversizedInputDoesNotStartLanguageOrPersistHistory(t *testing.T) {
	svc, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Close()
	state := svc.Bootstrap()
	code := strings.Repeat("x", 1048577)
	if _, err := svc.Execute("tab", state.Profiles[0].ID, code); err == nil {
		t.Fatal("oversized execution accepted")
	}
	if len(svc.Bootstrap().History) != 0 {
		t.Fatal("rejected input leaked into history")
	}
	if _, err := svc.StartLanguage("tab", state.Profiles[0].ID, code); err == nil {
		t.Fatal("oversized language input accepted")
	}
}

func TestRemoteSourceFailurePreservesPHPCompletions(t *testing.T) {
	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "ssh"), []byte("#!/bin/sh\necho 'snapshot unavailable' >&2\nexit 1\n"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	svc, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Close()
	if err = svc.SaveSettings(core.Settings{PHPBinary: "php", CacheDays: 7}); err != nil {
		t.Fatal(err)
	}
	svc.Language.PhpactorPath = "/missing-phpactor"
	p, err := svc.SaveProfile(core.Profile{Name: "Remote test", Mode: "ssh", ProjectPath: "/project", PHPBinary: "php", Bootstrap: "none", Timeout: 10, SSH: core.SSH{Host: "fixture"}})
	if err != nil {
		t.Fatal(err)
	}
	status, err := svc.StartLanguage("test", p.ID, "str")
	if err != nil || status.Mode != "basic" || status.Source != "fallback" || !strings.Contains(status.Warning, "snapshot unavailable") {
		t.Fatalf("%+v %v", status, err)
	}
	result, err := svc.LanguageRequest("test", "textDocument/completion", "str", 0, 3)
	data, _ := json.Marshal(result)
	if err != nil || !strings.Contains(string(data), "strlen") {
		t.Fatalf("PHP completions lost: %s %v", data, err)
	}
}
func TestWorkspacePersistsNamedDraftsAndShortcuts(t *testing.T) {
	dir := t.TempDir()
	svc, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	state := svc.Bootstrap()
	tab := state.Tabs[0]
	tab.Name = "Useful command"
	tab.Code = "$tomorrow = 42;"
	if err = svc.SaveWorkspace([]core.Tab{tab}, tab.ID); err != nil {
		t.Fatal(err)
	}
	settings := state.Settings
	settings.Shortcuts = map[string]string{"run": "Ctrl+Shift+Enter"}
	if err = svc.SaveSettings(settings); err != nil {
		t.Fatal(err)
	}
	svc.Close()
	reopened, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	loaded := reopened.Bootstrap()
	if loaded.Tabs[0].Name != tab.Name || loaded.Tabs[0].Code != tab.Code || loaded.Tabs[0].ProfileID != tab.ProfileID || loaded.Settings.Shortcuts["run"] != "Ctrl+Shift+Enter" {
		t.Fatal("named draft or shortcut lost on reopen")
	}
	loaded.Settings.Shortcuts["run"] = "changed outside store"
	if reopened.Bootstrap().Settings.Shortcuts["run"] != "Ctrl+Shift+Enter" {
		t.Fatal("settings snapshot shares shortcut map")
	}
}
