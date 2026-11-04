package language

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"tinkercraft/internal/execution"
)

func TestAnalysisMapsUseJSONAndStayInsideCache(t *testing.T) {
	root := t.TempDir()
	home := t.TempDir()
	for _, dir := range []string{"app", "tests", "vendor/acme/library/src", "legacy"} {
		if err := os.MkdirAll(filepath.Join(root, dir), 0700); err != nil {
			t.Fatal(err)
		}
	}
	os.WriteFile(filepath.Join(root, "composer.json"), []byte(`{"autoload":{"psr-4":{"App\\":"app/","Escape\\":"../"},"psr-0":{"Legacy_":"legacy/"}},"autoload-dev":{"psr-4":{"Tests\\":["tests/"]}}}`), 0600)
	os.WriteFile(filepath.Join(root, "vendor/acme/library/composer.json"), []byte(`{"autoload":{"psr-4":{"Acme\\":"src/"}}}`), 0600)
	if err := prepareAnalysisAutoload(root, home); err != nil {
		t.Fatal(err)
	}
	result, err := execution.Run(context.Background(), execution.Command{Binary: "php", Args: []string{"-r", "echo json_encode(require $argv[1]);", filepath.Join(home, "composer/autoload_psr4.php")}}, nil, 1024*1024)
	if err != nil || result.ExitCode != 0 {
		t.Fatalf("%v %s", err, result.Stderr)
	}
	var maps map[string][]string
	if err = json.Unmarshal([]byte(result.Stdout), &maps); err != nil {
		t.Fatal(err)
	}
	for prefix, path := range map[string]string{"App\\": "app", "Tests\\": "tests", "Acme\\": "vendor/acme/library/src"} {
		if len(maps[prefix]) != 1 || maps[prefix][0] != filepath.Join(root, path) {
			t.Fatalf("bad static map: %q %v", prefix, maps[prefix])
		}
	}
	if _, ok := maps["Escape\\"]; ok {
		t.Fatal("map escaped the source cache")
	}
	info, err := os.Stat(filepath.Join(home, "composer/autoload_psr4.php"))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("map permissions", err)
	}
}
