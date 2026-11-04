package service

import (
	"os"
	"path/filepath"
	"tinkercraft/internal/buildinfo"
)

func bundledPhpactor() string {
	executable, err := os.Executable()
	candidates := []string{}
	if err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(executable), "phpactor.phar"))
	}
	if buildinfo.Current().Distribution == "source" {
		candidates = append(candidates,
			os.Getenv("TINKERCRAFT_PHPACTOR"), os.Getenv("LUME_PHPACTOR"),
			filepath.Join(filepath.Dir(executable), "..", "..", ".tools", "phpactor.phar"),
			filepath.Join(".tools", "phpactor.phar"))
	}
	for _, path := range candidates {
		if path == "" {
			continue
		}
		if info, err := os.Stat(path); err == nil && info.Mode().IsRegular() {
			if absolute, err := filepath.Abs(path); err == nil {
				return absolute
			}
		}
	}
	return ""
}
