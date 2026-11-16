package service

import (
	"os"
	"path/filepath"
	"runtime"
	"tinkercraft/internal/buildinfo"
)

func bundledPhpactor() string {
	if runtime.GOOS == "windows" {
		return ""
	}
	executable, err := os.Executable()
	candidates := []string{}
	if err == nil {
		candidates = append(candidates, packagedPhpactorCandidates(runtime.GOOS, executable)...)
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

func packagedPhpactorCandidates(goos, executable string) []string {
	directory := filepath.Dir(executable)
	candidates := []string{filepath.Join(directory, "phpactor.phar")}
	if goos == "darwin" {
		candidates = append([]string{filepath.Join(directory, "..", "Resources", "phpactor.phar")}, candidates...)
	}
	return candidates
}
