package storage

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWorkspaceDirectoryPreservesExistingData(t *testing.T) {
	for _, test := range []struct {
		name, currentEnv, legacyEnv, want string
		current, legacy                   bool
	}{
		{name: "new installation", want: "tinkercraft"},
		{name: "reuse previous workspace", legacy: true, want: "lume"},
		{name: "prefer current workspace", current: true, legacy: true, want: "tinkercraft"},
		{name: "legacy override", legacyEnv: "previous-custom-location", want: "previous-custom-location"},
		{name: "current override wins", currentEnv: "new-custom-location", legacyEnv: "previous-custom-location", legacy: true, want: "new-custom-location"},
	} {
		t.Run(test.name, func(t *testing.T) {
			config := t.TempDir()
			t.Setenv("XDG_CONFIG_HOME", config)
			t.Setenv("TINKERCRAFT_DATA_DIR", test.currentEnv)
			t.Setenv("LUME_DATA_DIR", test.legacyEnv)
			for name, exists := range map[string]bool{"tinkercraft": test.current, "lume": test.legacy} {
				if !exists {
					continue
				}
				dir := filepath.Join(config, name)
				if err := os.MkdirAll(dir, 0700); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(dir, "workspace.json"), []byte("preserve me"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			got, err := WorkspaceDirectory()
			want := test.want
			if test.currentEnv == "" && test.legacyEnv == "" {
				want = filepath.Join(config, want)
			}
			if err != nil || got != want {
				t.Fatalf("got %q, %v; want %q", got, err, want)
			}
			if test.legacy {
				data, err := os.ReadFile(filepath.Join(config, "lume", "workspace.json"))
				if err != nil || string(data) != "preserve me" {
					t.Fatal("legacy workspace changed")
				}
			}
		})
	}
}
