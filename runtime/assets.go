package phpruntime

import (
	"crypto/sha256"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed compile.php parser.php index.php runner.php snapshot.php vendor/php-parser/lib vendor/php-parser/LICENSE
var Assets embed.FS

func Materialize(base string) (string, error) {
	h := sha256.New()
	fs.WalkDir(Assets, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			data, e := Assets.ReadFile(path)
			if e != nil {
				return e
			}
			h.Write(data)
		}
		return nil
	})
	dir := filepath.Join(base, fmt.Sprintf("runtime-%x", h.Sum(nil)[:8]))
	if _, err := os.Stat(filepath.Join(dir, ".ready")); err == nil {
		return dir, nil
	}
	err := fs.WalkDir(Assets, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		target := filepath.Join(dir, path)
		if entry.IsDir() {
			return os.MkdirAll(target, 0700)
		}
		data, err := Assets.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0600)
	})
	if err != nil {
		return "", err
	}
	return dir, os.WriteFile(filepath.Join(dir, ".ready"), []byte("1"), 0600)
}

func Runner() string {
	b, _ := Assets.ReadFile("runner.php")
	return strings.TrimPrefix(string(b), "<?php\n")
}

func Snapshot() string {
	b, _ := Assets.ReadFile("snapshot.php")
	return strings.TrimPrefix(string(b), "<?php\n")
}
