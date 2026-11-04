package storage

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"tinkercraft/internal/core"
)

func TestPersistenceAndFailedTransaction(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err = store.Update(func(s *core.State) error { s.Tabs = []core.Tab{{ID: "a", Code: "42;"}}; return nil }); err != nil {
		t.Fatal(err)
	}
	snapshot := store.Snapshot()
	snapshot.Tabs[0].Code = "changed"
	if store.Snapshot().Tabs[0].Code != "42;" {
		t.Fatal("snapshot mutated internal state")
	}
	if err := store.Update(func(s *core.State) error {
		s.Tabs[0].Code = "must not persist"
		return errors.New("transaction failed")
	}); err == nil {
		t.Fatal("failed update accepted")
	}
	if store.Snapshot().Tabs[0].Code != "42;" {
		t.Fatal("failed update changed state")
	}
	other, err := Open(dir)
	if err != nil || other.Snapshot().Tabs[0].Code != "42;" {
		t.Fatal(err)
	}
	info, _ := os.Stat(filepath.Join(dir, "workspace.json"))
	if info.Mode().Perm() != 0600 {
		t.Fatalf("workspace permissions %v", info.Mode())
	}
}
func TestCorruptWorkspaceIsPreserved(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "workspace.json")
	os.WriteFile(file, []byte("not json"), 0600)
	if _, err := Open(dir); err == nil {
		t.Fatal("corrupt state silently discarded")
	}
	data, _ := os.ReadFile(file)
	if string(data) != "not json" {
		t.Fatal("corrupt state overwritten")
	}
}
