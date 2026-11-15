package language

import (
	"context"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"tinkercraft/internal/core"
	phpruntime "tinkercraft/runtime"
)

func TestNativeFileURI(t *testing.T) {
	file := filepath.Join(t.TempDir(), "projeto Olá # 100%", "scratch.php")
	uri := fileURI(file)
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "file" || !strings.HasPrefix(parsed.Path, "/") || parsed.Fragment != "" {
		t.Fatalf("invalid file URI %q: %v", uri, err)
	}
	want := filepath.ToSlash(file)
	if runtime.GOOS == "windows" {
		want = "/" + want
		if got := fileURI(`\\server\share\Olá #.php`); got != "file://server/share/Ol%C3%A1%20%23.php" {
			t.Fatal("UNC URI:", got)
		}
	}
	if parsed.Path != want {
		t.Fatalf("URI path %q, want %q", parsed.Path, want)
	}
}

func TestNativeCompletion(t *testing.T) {
	root := t.TempDir()
	dir, err := phpruntime.Materialize(filepath.Join(root, "runtime"))
	if err != nil {
		t.Fatal(err)
	}
	project := filepath.Join(root, "projeto Olá com espaços")
	if err := os.MkdirAll(filepath.Join(project, "app"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(project, "app", "User.php"), []byte("<?php namespace Example; class User { public function greet(): string { return ''; } }"), 0600); err != nil {
		t.Fatal(err)
	}
	manager := NewManager(dir)
	defer manager.Close()
	if runtime.GOOS == "windows" {
		manager.PhpactorPath = filepath.Join(root, "must-not-run.phar")
	}
	status, err := manager.Start("native", project, "", core.Settings{PHPBinary: "php"})
	if err != nil || status.Mode != "basic" || status.Files != 1 {
		t.Fatalf("%+v: %v", status, err)
	}
	if runtime.GOOS == "windows" && !strings.Contains(status.Message, "Windows") {
		t.Fatal("missing Windows fallback explanation:", status.Message)
	}
	index, err := BuildIndex(context.Background(), "php", dir, project)
	if err != nil || len(index.Classes) != 1 {
		t.Fatalf("native index: %+v, %v", index, err)
	}
}
