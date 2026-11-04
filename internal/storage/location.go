package storage

import (
	"os"
	"path/filepath"
)

func WorkspaceDirectory() (string, error) {
	for _, name := range []string{"TINKERCRAFT_DATA_DIR", "LUME_DATA_DIR"} {
		if dir := os.Getenv(name); dir != "" {
			return dir, nil
		}
	}
	config, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	current := filepath.Join(config, "tinkercraft")
	for _, dir := range []string{current, filepath.Join(config, "lume")} {
		if _, err := os.Stat(filepath.Join(dir, "workspace.json")); err == nil {
			return dir, nil
		} else if !os.IsNotExist(err) {
			return "", err
		}
	}
	return current, nil
}
