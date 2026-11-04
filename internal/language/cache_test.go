package language

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"tinkercraft/internal/core"
	"tinkercraft/internal/execution"
	phpruntime "tinkercraft/runtime"
)

func cacheFixture(t *testing.T) (*Cache, core.Profile) {
	t.Helper()
	root := t.TempDir()
	project := filepath.Join(root, "project with ' quotes")
	os.MkdirAll(filepath.Join(project, "app"), 0700)
	for name, content := range map[string]string{"composer.json": "{}", "app/Person.php": "<?php namespace App; class Person {public function greet(): string{return 'hello';}}", ".env": "SECRET=hidden", ".env.php": "<?php // secret", ".phpactor.php": "<?php throw new RuntimeException('Remote config must not run');", "storage/private.php": "<?php // private", "node_modules/private.php": "<?php // private", "vendor/composer/installed.json": "[]", "vendor/psr/cache/CacheItem.php": "<?php // dependency source"} {
		file := filepath.Join(project, name)
		os.MkdirAll(filepath.Dir(file), 0700)
		os.WriteFile(file, []byte(content), 0600)
	}
	os.Symlink(filepath.Join(project, ".env"), filepath.Join(project, "app", "linked.php"))
	bin := filepath.Join(root, "bin")
	os.Mkdir(bin, 0700)
	os.WriteFile(filepath.Join(bin, "ssh"), []byte("#!/usr/bin/env python3\nimport os,sys\nos.execvp('sh',['sh','-c',sys.argv[-1]])\n"), 0700)
	docker := `#!/usr/bin/env python3
import os,sys,json
a=sys.argv[1:]
if a[0]=='inspect': print(os.environ['TINKERCRAFT_CACHE_INSPECT'])
else:
 assert a[:2]==['exec','-i'];a=a[2:]
 if a[0]=='--workdir': os.chdir(a[1]);a=a[2:]
 a=a[1:];os.execvp(a[0],a)
`
	os.WriteFile(filepath.Join(bin, "docker"), []byte(docker), 0700)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("TINKERCRAFT_CACHE_INSPECT", `{"Config":{"WorkingDir":"/"},"Mounts":[]}`)
	return NewCache(filepath.Join(root, "cache"), &execution.Engine{}), core.Profile{ID: "fixture", Name: "Fixture", Mode: "ssh", ProjectPath: project, PHPBinary: "php", Container: "php-test", Bootstrap: "none", Timeout: 30, SSH: core.SSH{Host: "fixture-host"}}
}
func TestAutomaticCacheTransfersOnlySourceAndRefreshes(t *testing.T) {
	for _, mode := range []string{"ssh", "docker", "ssh-docker"} {
		t.Run(mode, func(t *testing.T) {
			cache, p := cacheFixture(t)
			p.Mode = mode
			snapshot, err := cache.Prepare(context.Background(), p, false)
			if err != nil {
				t.Fatal(err)
			}
			if snapshot.Source != "cache" {
				t.Fatal(snapshot)
			}
			for _, name := range []string{"composer.json", "app/Person.php", "vendor/composer/installed.json", "vendor/psr/cache/CacheItem.php"} {
				if _, err := os.Stat(filepath.Join(snapshot.Root, name)); err != nil {
					t.Fatal(err)
				}
			}
			for _, name := range []string{".env", ".env.php", ".phpactor.php", "storage/private.php", "node_modules/private.php", "app/linked.php"} {
				if _, err := os.Stat(filepath.Join(snapshot.Root, name)); !os.IsNotExist(err) {
					t.Fatalf("unexpected cached file %s", name)
				}
			}
			info, _ := os.Stat(filepath.Join(snapshot.Root, "app/Person.php"))
			if info.Mode().Perm() != 0600 {
				t.Fatal("cache file permissions")
			}
			source := filepath.Join(p.ProjectPath, "app/Person.php")
			os.WriteFile(source, []byte("<?php // updated"), 0600)
			reused, err := cache.Prepare(context.Background(), p, false)
			if err != nil {
				t.Fatal(err)
			}
			content, _ := os.ReadFile(filepath.Join(reused.Root, "app/Person.php"))
			if strings.Contains(string(content), "updated") {
				t.Fatal("fresh cache unexpectedly recopied")
			}
			refreshed, err := cache.Prepare(context.Background(), p, true)
			if err != nil {
				t.Fatal(err)
			}
			content, _ = os.ReadFile(filepath.Join(refreshed.Root, "app/Person.php"))
			if string(content) != "<?php // updated" {
				t.Fatal("refresh did not update source")
			}
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			if _, err = cache.Prepare(ctx, p, true); err == nil {
				t.Fatal("cancelled preparation succeeded")
			}
			if _, err = os.Stat(filepath.Join(refreshed.Root, "app/Person.php")); err != nil {
				t.Fatal("cancel damaged earlier cache")
			}
		})
	}
}
func TestCacheExpiryKeepsActiveProjects(t *testing.T) {
	cache, p := cacheFixture(t)
	snapshot, err := cache.Prepare(context.Background(), p, false)
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Dir(snapshot.Root)
	meta, err := readMetadata(dir)
	if err != nil {
		t.Fatal(err)
	}
	meta.LastUsed = time.Now().Add(-8 * 24 * time.Hour)
	writeMetadata(dir, meta)
	if err = cache.Cleanup(7, []string{snapshot.Root}); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(snapshot.Root); err != nil {
		t.Fatal("active cache removed")
	}
	if err = cache.Cleanup(7, nil); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("inactive cache was not removed")
	}
	if _, err = os.Stat(p.ProjectPath); err != nil {
		t.Fatal("source project removed")
	}
}
func TestCacheRejectsTraversalSecretsAndIncompleteTransfers(t *testing.T) {
	for _, name := range []string{"../escape.php", "/escape.php", "app/../../escape.php", "app\\escape.php", ".env", ".phpactor.php", "app/.env.php", "storage/data.php", "app/./Person.php"} {
		var input bytes.Buffer
		json.NewEncoder(&input).Encode(map[string]any{"path": name, "data": base64.StdEncoding.EncodeToString([]byte("<?php"))})
		if _, err := extractSnapshot(&input, t.TempDir()); err == nil {
			t.Fatalf("accepted %q", name)
		}
	}
	var input bytes.Buffer
	json.NewEncoder(&input).Encode(map[string]any{"path": "app/Person.php", "data": base64.StdEncoding.EncodeToString([]byte("<?php"))})
	if _, err := extractSnapshot(&input, t.TempDir()); err == nil {
		t.Fatal("incomplete snapshot accepted")
	}
}
func TestAutomaticCacheReusesDockerBindMount(t *testing.T) {
	cache, p := cacheFixture(t)
	local := p.ProjectPath
	p.Mode = "docker"
	p.ProjectPath = "/app"
	metadata := map[string]any{"Config": map[string]any{"WorkingDir": "/app"}, "Mounts": []any{map[string]string{"Type": "bind", "Source": local, "Destination": "/app"}}}
	data, _ := json.Marshal(metadata)
	t.Setenv("TINKERCRAFT_CACHE_INSPECT", string(data))
	result, err := cache.Prepare(context.Background(), p, false)
	if err != nil || result.Source != "mount" || result.Root != local {
		t.Fatalf("%+v %v", result, err)
	}
	if _, err = os.Stat(cache.Base); !os.IsNotExist(err) {
		t.Fatal("unnecessary local cache")
	}
}

func TestRealPhpactorUsesCachedSourcesWithoutBootstrapping(t *testing.T) {
	server := os.Getenv("TINKERCRAFT_PHPACTOR_REAL")
	if server == "" {
		t.Skip("Defina TINKERCRAFT_PHPACTOR_REAL para testar o cache com Phpactor real")
	}
	cache, p := cacheFixture(t)
	os.WriteFile(filepath.Join(p.ProjectPath, "composer.json"), []byte(`{"autoload":{"psr-4":{"App\\":"app/"}}}`), 0600)
	marker := filepath.Join(filepath.Dir(cache.Base), "autoload-must-not-run")
	os.MkdirAll(filepath.Join(p.ProjectPath, "vendor"), 0700)
	os.WriteFile(filepath.Join(p.ProjectPath, "vendor/autoload.php"), []byte(fmt.Sprintf("<?php file_put_contents(%q, 'unexpected bootstrap');", marker)), 0600)
	os.WriteFile(filepath.Join(p.ProjectPath, "vendor/composer/autoload_psr4.php"), []byte(fmt.Sprintf("<?php file_put_contents(%q, 'unexpected remote map'); return [];", marker)), 0600)
	snapshot, err := cache.Prepare(context.Background(), p, false)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"vendor/autoload.php", "vendor/composer/autoload_psr4.php"} {
		if _, err := os.Stat(filepath.Join(snapshot.Root, name)); !os.IsNotExist(err) {
			t.Fatalf("remote loader was copied: %s", name)
		}
	}
	manager := NewManager("")
	defer manager.Close()
	code := "use App\\Person;\n$person = new Person();\n$person->"
	status, err := manager.StartCached("cached", snapshot.Root, code, core.Settings{PHPBinary: "php", PhpactorPath: server})
	if err != nil || status.Mode != "phpactor" {
		t.Fatalf("%+v %v", status, err)
	}
	deadline := time.Now().Add(20 * time.Second)
	for {
		result, e := manager.Request("cached", "textDocument/completion", code, 2, 9)
		data, _ := json.Marshal(result)
		if e == nil && strings.Contains(string(data), `"label":"greet"`) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("cached class completion: %s %v", data, e)
		}
		time.Sleep(200 * time.Millisecond)
	}
	if _, err = os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("cached project's autoloader was executed on the host")
	}
	entries, err := os.ReadDir(filepath.Join(filepath.Dir(snapshot.Root), "analysis"))
	if err != nil || len(entries) == 0 {
		t.Fatalf("language analysis cache not isolated: %v", err)
	}
}

func TestSnapshotPrioritizesApplicationAndCompletesAtBudget(t *testing.T) {
	project := t.TempDir()
	// Create dependencies first to catch filesystem-order dependent collection.
	os.MkdirAll(filepath.Join(project, "vendor", "package", "library", "tests"), 0700)
	os.WriteFile(filepath.Join(project, "vendor", "package", "library", "source.php"), []byte("<?php // dependency"), 0600)
	os.WriteFile(filepath.Join(project, "vendor", "package", "library", "tests", "fixture.php"), []byte("<?php // fixture"), 0600)
	os.MkdirAll(filepath.Join(project, "app"), 0700)
	os.WriteFile(filepath.Join(project, "app", "Useful.php"), []byte("<?php class Useful {}"), 0600)
	p := core.Profile{ID: "budget", Name: "Budget", Mode: "local", ProjectPath: project, PHPBinary: "php", Bootstrap: "none", Timeout: 30}
	spec, err := execution.PHPCommand(p, phpruntime.Snapshot())
	if err != nil {
		t.Fatal(err)
	}
	input, _ := json.Marshal(map[string]any{"projectPath": project, "maxFiles": 1})
	result, err := execution.Run(context.Background(), spec, input, 1024*1024)
	if err != nil || result.ExitCode != 0 {
		t.Fatalf("%v %s", err, result.Stderr)
	}
	root := t.TempDir()
	meta, err := extractSnapshot(strings.NewReader(result.Stdout), root)
	if err != nil || !meta.Limited || meta.Files != 1 {
		t.Fatalf("%+v %v", meta, err)
	}
	if _, err = os.Stat(filepath.Join(root, "app", "Useful.php")); err != nil {
		t.Fatal("application source lost at budget", err)
	}
	if cacheNotice(meta) == "" {
		t.Fatal("partial cache has no notice")
	}
	if allowedSnapshotPath("vendor/package/library/tests/fixture.php") {
		t.Fatal("dependency test fixture accepted")
	}
}
