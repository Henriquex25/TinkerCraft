package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"tinkercraft/internal/core"
)

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
	if err = svc.SaveSettings(core.Settings{PHPBinary: "php", PhpactorPath: "/missing-phpactor", CacheDays: 7}); err != nil {
		t.Fatal(err)
	}
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
