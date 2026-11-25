package language

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"tinkercraft/internal/core"
	"tinkercraft/internal/execution"
	phpruntime "tinkercraft/runtime"
)

func laravelAnalysisFixture(t *testing.T) (string, string, string) {
	t.Helper()
	root := t.TempDir()
	runtimeDir, err := phpruntime.Materialize(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	home := t.TempDir()
	files := map[string]string{
		"composer.json":                          `{"autoload":{"psr-4":{"App\\":"app/"}}}`,
		"app/Models/User.php":                    `<?php namespace App\Models; use Illuminate\Foundation\Auth\User as Authenticatable; class User extends Authenticatable { public function scopeActive(\Illuminate\Database\Eloquent\Builder $query): void {} }`,
		"vendor/laravel/framework/composer.json": `{"autoload":{"psr-4":{"Illuminate\\":"src/Illuminate/"}}}`,
		"vendor/laravel/framework/src/Illuminate/Database/Eloquent/Model.php":   `<?php namespace Illuminate\Database\Eloquent; abstract class Model { public static function query(): Builder { return new Builder; } }`,
		"vendor/laravel/framework/src/Illuminate/Database/Eloquent/Builder.php": `<?php namespace Illuminate\Database\Eloquent; /** @template TModel */ class Builder { /** @return $this */ public function where($column, $value = null) {} /** @return TModel|null */ public function first() {} }`,
		"vendor/laravel/framework/src/Illuminate/Database/Query/Builder.php":    `<?php namespace Illuminate\Database\Query; class Builder { /** @return int */ public function count($columns = '*') {} /** @return $this */ public function orderBy($column, $direction = 'asc') {} }`,
		"vendor/laravel/framework/src/Illuminate/Foundation/Auth/User.php":      `<?php namespace Illuminate\Foundation\Auth; class User extends \Illuminate\Database\Eloquent\Model {}`,
	}
	for name, source := range files {
		path := filepath.Join(root, name)
		os.MkdirAll(filepath.Dir(path), 0700)
		if err := os.WriteFile(path, []byte(source), 0600); err != nil {
			t.Fatal(err)
		}
	}
	return root, runtimeDir, home
}
func TestLaravelHelpersStayOutsideSourcesAndRefreshByContent(t *testing.T) {
	root, runtimeDir, home := laravelAnalysisFixture(t)
	marker := filepath.Join(root, "must-not-execute")
	malicious := "<?php file_put_contents(" + "'" + marker + "'" + ", 'executed');"
	for _, file := range []string{"vendor/autoload.php", "vendor/composer/autoload_classmap.php", ".phpactor.php"} {
		os.MkdirAll(filepath.Dir(filepath.Join(root, file)), 0700)
		os.WriteFile(filepath.Join(root, file), []byte(malicious), 0600)
	}
	original, _ := os.ReadFile(filepath.Join(root, "app/Models/User.php"))
	index, err := prepareProjectAnalysis(context.Background(), "php", runtimeDir, root, home)
	if err != nil {
		t.Fatal(err)
	}
	for _, class := range []string{"\\App\\Models\\User::", "User::"} {
		result := index.Complete(class, 0, len(class))
		data, _ := json.Marshal(result)
		for _, method := range []string{"count", "where", "active"} {
			if !strings.Contains(string(data), `"label":"`+method+`"`) {
				t.Fatalf("missing %s: %s", method, data)
			}
		}
	}
	current, _ := os.ReadFile(filepath.Join(root, "app/Models/User.php"))
	if string(current) != string(original) {
		t.Fatal("modified project model")
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("executed project code")
	}
	result := index.Complete(`\App`, 0, 4)
	data, _ := json.Marshal(result)
	if !strings.Contains(string(data), `App\\`) {
		t.Fatal(string(data))
	}
	helperFiles, _ := filepath.Glob(filepath.Join(home, "helpers", "*.php"))
	if len(helperFiles) == 0 {
		t.Fatal("helpers not generated")
	}
	for _, file := range helperFiles {
		result, err := execution.Run(context.Background(), execution.Command{Binary: "php", Args: []string{"-l", file}}, nil, 1024)
		if err != nil || result.ExitCode != 0 {
			t.Fatalf("invalid helper: %s %s %v", file, result.Stdout, err)
		}
	}
	before, _ := os.ReadFile(filepath.Join(home, "symbols.json"))
	newSource := strings.Replace(string(original), "scopeActive", "scopeRecent", 1)
	os.WriteFile(filepath.Join(root, "app/Models/User.php"), []byte(newSource), 0600)
	index, err = prepareProjectAnalysis(context.Background(), "php", runtimeDir, root, home)
	if err != nil {
		t.Fatal(err)
	}
	after, _ := os.ReadFile(filepath.Join(home, "symbols.json"))
	if string(before) == string(after) {
		t.Fatal("source change did not invalidate cache")
	}
	result = index.Complete("User::", 0, 6)
	data, _ = json.Marshal(result)
	if !strings.Contains(string(data), `"label":"recent"`) || strings.Contains(string(data), `"label":"active"`) {
		t.Fatal(string(data))
	}
}
func TestNamespaceCompletionEditsTheWholeQualifiedName(t *testing.T) {
	index := Index{Classes: []Class{{Name: "App\\Models\\User"}, {Name: "App\\Models\\Order"}, {Name: "App\\Services\\Mailer"}}}
	for _, code := range []string{`\App`, `\App\`, `\App\Models\U`} {
		result := index.Complete(code, 0, len(code))
		items := completionItems(result)
		if len(items) == 0 {
			t.Fatal(code, result)
		}
		for _, item := range items {
			data := item.(map[string]any)
			edit := data["textEdit"].(map[string]any)
			text := edit["newText"].(string)
			if strings.Contains(text, `\\`) {
				t.Fatal("duplicated namespace separator", text)
			}
			r := edit["range"].(map[string]any)
			if r["start"].(map[string]any)["character"] != 0 {
				t.Fatal("partial namespace replacement", r)
			}
		}
	}
}
func TestRealPhpactorLaravelMethodsAndAliases(t *testing.T) {
	server := os.Getenv("TINKERCRAFT_PHPACTOR_REAL")
	if server == "" {
		t.Skip("set TINKERCRAFT_PHPACTOR_REAL")
	}
	root, runtimeDir, _ := laravelAnalysisFixture(t)
	manager := NewManager(runtimeDir)
	manager.PhpactorPath = server
	defer manager.Close()
	status, err := manager.Start("laravel", root, `\App\Models\User::`, core.Settings{PHPBinary: "php"})
	if err != nil || status.Mode != "phpactor" {
		t.Fatal(status, err)
	}
	if status.Warning != "" {
		t.Fatal(status.Warning)
	}
	session := manager.get("laravel")
	for _, code := range []string{`\App\Models\User::`, `User::`} {
		deadline := time.Now().Add(15 * time.Second)
		for {
			session.mu.Lock()
			session.sync(code)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			result, err := session.rpc.Call(ctx, "textDocument/completion", map[string]any{"textDocument": map[string]any{"uri": session.uri}, "position": map[string]int{"line": 1, "character": len(code)}})
			cancel()
			session.mu.Unlock()
			if err == nil && strings.Contains(string(result), `"label":"count"`) {
				break
			}
			if time.Now().After(deadline) {
				t.Fatalf("Phpactor itself did not see helper for %s: %s %v", code, result, err)
			}
			time.Sleep(150 * time.Millisecond)
		}
	}
	result, err := manager.Request("laravel", "textDocument/hover", `\App\Models\User::count();`, 0, 20)
	data, _ := json.Marshal(result)
	if err != nil || !strings.Contains(string(data), "count") {
		t.Fatalf("hover: %s %v", data, err)
	}
	t.Log("Real Phpactor resolves static Eloquent query methods and short class aliases from generated cache helpers")
}

func TestRealPhpactorActualLaravelDiagnostics(t *testing.T) {
	server, vendor := os.Getenv("TINKERCRAFT_PHPACTOR_REAL"), os.Getenv("TINKERCRAFT_LARAVEL_VENDOR")
	if server == "" || vendor == "" {
		t.Skip("set real Phpactor and Laravel fixture paths")
	}
	root, runtimeDir, _ := laravelAnalysisFixture(t)
	os.RemoveAll(filepath.Join(root, "vendor"))
	if err := os.Symlink(vendor, filepath.Join(root, "vendor")); err != nil {
		t.Fatal(err)
	}
	manager := NewManager(runtimeDir)
	manager.PhpactorPath = server
	defer manager.Close()
	diagnostics := make(chan json.RawMessage, 100)
	manager.OnDiagnostics = func(_ string, data json.RawMessage) {
		select {
		case diagnostics <- data:
		default:
		}
	}
	code := `\App\Models\User::where('active', true)->count();
$clock = new \DateTimeImmutable(); $clock->methodThatDoesNotExist();`
	status, err := manager.Start("real-laravel", root, code, core.Settings{PHPBinary: "php"})
	if err != nil || status.Mode != "phpactor" || status.Warning != "" {
		t.Fatal(status, err)
	}
	deadline := time.Now().Add(15 * time.Second)
	for {
		hover, hoverErr := manager.Request("real-laravel", "textDocument/hover", code, 0, strings.Index(code, "count")+2)
		encoded, _ := json.Marshal(hover)
		if hoverErr == nil && strings.Contains(string(encoded), "count") {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("real Laravel count hover: %s %v", encoded, hoverErr)
		}
		time.Sleep(150 * time.Millisecond)
	}
	awaitDiagnostics := func(version int) {
		t.Helper()
		timeout := time.After(15 * time.Second)
		for {
			select {
			case data := <-diagnostics:
				var result struct {
					Version     int `json:"version"`
					Diagnostics []struct {
						Message string `json:"message"`
					} `json:"diagnostics"`
				}
				if json.Unmarshal(data, &result) != nil || result.Version != version {
					continue
				}
				found := false
				for _, diagnostic := range result.Diagnostics {
					if strings.Contains(diagnostic.Message, "methodThatDoesNotExist") {
						found = true
						continue
					}
					if strings.Contains(diagnostic.Message, "does not exist") {
						t.Fatalf("valid Eloquent method or alias diagnosed: %s", data)
					}
				}
				if found {
					return
				}
			case <-timeout:
				t.Fatal("actual missing-method diagnostic was lost")
			}
		}
	}
	awaitDiagnostics(1)
	code = strings.Replace(code, `\App\Models\User::where`, `User::where`, 1)
	if err := manager.Change("real-laravel", code); err != nil {
		t.Fatal(err)
	}
	awaitDiagnostics(2)
	t.Log("Real Laravel: qualified and short Eloquent chains accepted; the intentional DateTime missing method remains diagnosed")
}

func TestExistingIDEHelperIsMergedWithoutExecutingIt(t *testing.T) {
	root, runtimeDir, home := laravelAnalysisFixture(t)
	marker := filepath.Join(t.TempDir(), "not-executed")
	helper := "<?php namespace App\\Models; file_put_contents('" + marker + "', 'bad');\n/**\n * @property string $nickname\n * @method static bool cachedMagic()\n */\nclass User {}"
	os.WriteFile(filepath.Join(root, "_ide_helper_models.php"), []byte(helper), 0600)
	_, err := prepareProjectAnalysis(context.Background(), "php", runtimeDir, root, home)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	files, _ := filepath.Glob(filepath.Join(home, "helpers", "*.php"))
	for _, file := range files {
		data, _ := os.ReadFile(file)
		if strings.Contains(string(data), "cachedMagic") && strings.Contains(string(data), "scopeActive") {
			found = true
		}
	}
	if !found {
		t.Fatal("existing helper metadata was not merged into the model overlay")
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("IDE helper was executed")
	}
	current, _ := os.ReadFile(filepath.Join(root, "_ide_helper_models.php"))
	if string(current) != helper {
		t.Fatal("existing IDE helper was modified")
	}
}
func TestAnalysisExpirationPreservesActiveAndUnrelatedFolders(t *testing.T) {
	root := t.TempDir()
	manager := NewManager(filepath.Join(root, "runtime"))
	base := filepath.Join(root, "language-analysis")
	old, active, fresh := filepath.Join(base, strings.Repeat("a", 64)), filepath.Join(base, strings.Repeat("b", 64)), filepath.Join(base, strings.Repeat("c", 64))
	unknown := filepath.Join(base, "unrelated")
	for _, path := range []string{old, active, fresh, unknown} {
		os.MkdirAll(path, 0700)
	}
	past := time.Now().Add(-10 * 24 * time.Hour)
	for _, path := range []string{old, active, unknown} {
		os.Chtimes(path, past, past)
	}
	manager.sessions["active"] = &Session{home: active}
	if err := manager.cleanupAnalysis(7); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Fatal("expired analysis not removed")
	}
	for _, path := range []string{active, fresh, unknown} {
		if _, err := os.Stat(path); err != nil {
			t.Fatal("removed live analysis or unrelated directory", path, err)
		}
	}
}

func TestStaticTinkerAliasExclusionsAndAmbiguity(t *testing.T) {
	root, runtimeDir, home := laravelAnalysisFixture(t)
	os.MkdirAll(filepath.Join(root, "config"), 0700)
	os.WriteFile(filepath.Join(root, "config", "tinker.php"), []byte(`<?php return ['dont_alias'=>[\App\Models\User::class]];`), 0600)
	index, err := prepareProjectAnalysis(context.Background(), "php", runtimeDir, root, home)
	if err != nil {
		t.Fatal(err)
	}
	if index.findExact("User") != nil {
		t.Fatal("excluded short alias generated")
	}
	os.Remove(filepath.Join(root, "config", "tinker.php"))
	os.MkdirAll(filepath.Join(root, "app", "Admin"), 0700)
	os.WriteFile(filepath.Join(root, "app", "Admin", "User.php"), []byte(`<?php namespace App\Admin; class User {}`), 0600)
	index, err = prepareProjectAnalysis(context.Background(), "php", runtimeDir, root, home)
	if err != nil {
		t.Fatal(err)
	}
	if index.find("User") != nil {
		t.Fatal("ambiguous short class resolved silently")
	}
	if index.find(`App\Models\User`) == nil {
		t.Fatal("fully qualified class was lost")
	}
}
