package execution

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"tinkercraft/internal/core"
	phpruntime "tinkercraft/runtime"
)

func fixture(t *testing.T) (*Engine, core.Profile, core.Settings) {
	t.Helper()
	if _, err := exec.LookPath("php"); err != nil {
		t.Skip("PHP CLI não instalado")
	}
	root := t.TempDir()
	dir, err := phpruntime.Materialize(filepath.Join(root, "assets"))
	if err != nil {
		t.Fatal(err)
	}
	project := filepath.Join(root, "projeto com 'aspas' e espaços")
	if err = os.MkdirAll(project, 0700); err != nil {
		t.Fatal(err)
	}
	return &Engine{RuntimeDir: dir}, core.Profile{ID: "test", Name: "Test", Mode: "local", ProjectPath: project, PHPBinary: "php", Bootstrap: "none", Timeout: 5}, core.Settings{PHPBinary: "php"}
}
func TestEvaluatePHP(t *testing.T) {
	engine, profile, settings := fixture(t)
	cases := []struct {
		name, code, kind string
		value            any
	}{
		{"expression without semicolon", "1 + 2", "int", float64(3)},
		{"PHP opening tag", "<?php\n21 * 2;", "int", float64(42)},
		{"string with delimiters", "$a = 'x;y;'; strtoupper($a);", "string", "X;Y;"},
		{"closure", "$fn = fn ($x) => $x * 2; $fn(7);", "int", float64(14)},
		{"explicit return", "return ['ok' => true];", "array", nil},
		{"no implicit return from control flow", "if (true) { $a = 1; }", "null", nil},
		{"comments", "$a = 7;\n$a // final comment", "int", float64(7)},
		{"namespace", "namespace Sample;\nclass A { public function value() { return 9; } }\n(new A)->value();", "int", float64(9)},
		{"large integer", "PHP_INT_MAX;", "int", "9223372036854775807"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			r := engine.Execute(context.Background(), profile, settings, tt.code)
			if !r.Success || r.Value == nil {
				t.Fatalf("%+v", r)
			}
			if r.Value.Type != tt.kind {
				t.Fatalf("got %s want %s", r.Value.Type, tt.kind)
			}
			if tt.value != nil && r.Value.Value != tt.value {
				t.Fatalf("got %#v want %#v", r.Value.Value, tt.value)
			}
		})
	}
}
func TestDumpsOutputWarningsAndErrors(t *testing.T) {
	engine, p, s := fixture(t)
	t.Run("dump and stdout", func(t *testing.T) {
		r := engine.Execute(context.Background(), p, s, "echo 'hello'; fwrite(STDOUT, 'direct'); dump(['a' => 1]); dump(false); 42;")
		if !r.Success || len(r.Dumps) != 2 || !strings.Contains(r.Stdout, "hello") || !strings.Contains(r.Stdout, "direct") {
			t.Fatalf("%+v", r)
		}
	})
	t.Run("dd shutdown envelope", func(t *testing.T) {
		r := engine.Execute(context.Background(), p, s, "dd(['done' => true]); 99;")
		if !r.Success || len(r.Dumps) != 1 || r.Value != nil {
			t.Fatalf("%+v", r)
		}
	})
	t.Run("warnings", func(t *testing.T) {
		r := engine.Execute(context.Background(), p, s, "trigger_error('heads up', E_USER_WARNING); 3;")
		if !r.Success || len(r.Warnings) != 1 || !strings.Contains(r.Warnings[0], "heads up") {
			t.Fatalf("%+v", r)
		}
	})
	t.Run("parse error", func(t *testing.T) {
		r := engine.Execute(context.Background(), p, s, "<?php\n\n$a = ;")
		if r.Success || r.Error == nil || r.Error.Class != "ParseError" || r.Error.Line != 3 {
			t.Fatalf("%+v", r)
		}
	})
	t.Run("exception line is original source", func(t *testing.T) {
		r := engine.Execute(context.Background(), p, s, "<?php\n\n// retained comments\n\nthrow new RuntimeException('boom');")
		if r.Success || r.Error == nil || r.Error.Message != "boom" || r.Error.Line != 5 {
			t.Fatalf("%+v", r)
		}
	})
	t.Run("nonzero exit", func(t *testing.T) {
		r := engine.Execute(context.Background(), p, s, "exit(7);")
		if r.Success || r.Error == nil || r.Error.Class != "ProcessExit" {
			t.Fatalf("%+v", r)
		}
	})
}
func TestInspectionLimitsAndCycles(t *testing.T) {
	engine, p, s := fixture(t)
	r := engine.Execute(context.Background(), p, s, "$a = new stdClass; $a->self = $a; $a;")
	if !r.Success || r.Value.Children[0].Value.Type != "reference" {
		t.Fatalf("%+v", r)
	}
	r = engine.Execute(context.Background(), p, s, "range(1, 1000);")
	if !r.Success || !r.Value.Truncated || len(r.Value.Children) != 300 {
		t.Fatalf("%+v", r)
	}
	r = engine.Execute(context.Background(), p, s, "echo str_repeat('a', 300000); 'ok';")
	if !r.Success || !r.Truncated || len(r.Stdout) != 262144 {
		t.Fatalf("%+v", r)
	}
	r = engine.Execute(context.Background(), p, s, "array_fill(0, 300, str_repeat('x', 32768));")
	if !r.Success || !r.Truncated || r.Value == nil {
		t.Fatalf("Large result must retain a valid bounded envelope: %+v", r.Error)
	}
}
func TestComposerBootstrap(t *testing.T) {
	engine, p, s := fixture(t)
	p.Bootstrap = "composer"
	os.Mkdir(filepath.Join(p.ProjectPath, "vendor"), 0700)
	os.WriteFile(filepath.Join(p.ProjectPath, "vendor/autoload.php"), []byte("<?php function project_helper() { return 'booted'; }"), 0600)
	r := engine.Execute(context.Background(), p, s, "project_helper();")
	if !r.Success || r.Value.Value != "booted" || r.Framework != "Composer" {
		t.Fatalf("%+v", r)
	}
}
func TestMissingBootstrapUsesAppErrorClass(t *testing.T) {
	engine, p, s := fixture(t)
	p.Bootstrap = "composer"
	r := engine.Execute(context.Background(), p, s, "42;")
	if r.Success || r.Error == nil || r.Error.Class != `TinkerCraft\Runtime\BootstrapError` || !strings.Contains(r.Error.Message, "vendor/autoload.php") {
		t.Fatalf("%+v", r)
	}
}
func TestCancellationAndTimeout(t *testing.T) {
	engine, p, s := fixture(t)
	p.Timeout = 1
	r := engine.Execute(context.Background(), p, s, "sleep(10); 3;")
	if r.Success || r.Error == nil || r.Error.Class != "Timeout" {
		t.Fatalf("%+v", r)
	}
	p.Timeout = 10
	ctx, cancel := context.WithCancel(context.Background())
	go func() { time.Sleep(150 * time.Millisecond); cancel() }()
	r = engine.Execute(ctx, p, s, "sleep(10); 3;")
	if !r.Cancelled {
		t.Fatalf("%+v", r)
	}
}
func TestCancellationBeforeAndDuringCompilation(t *testing.T) {
	for _, stage := range []string{"before compilation", "during compilation"} {
		t.Run(stage, func(t *testing.T) {
			engine, profile, settings := fixture(t)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if stage == "before compilation" {
				cancel()
			} else {
				ready := filepath.Join(t.TempDir(), "compiler-ready")
				t.Setenv("TINKERCRAFT_TEST_COMPILER_READY", ready)
				compiler := "<?php file_put_contents(getenv('TINKERCRAFT_TEST_COMPILER_READY'), 'ready'); sleep(30);"
				if err := os.WriteFile(filepath.Join(engine.RuntimeDir, "compile.php"), []byte(compiler), 0600); err != nil {
					t.Fatal(err)
				}
				go func() {
					ticker := time.NewTicker(10 * time.Millisecond)
					defer ticker.Stop()
					for {
						if _, err := os.Stat(ready); err == nil {
							cancel()
							return
						}
						select {
						case <-ctx.Done():
							return
						case <-ticker.C:
						}
					}
				}()
			}
			result := make(chan core.Result, 1)
			go func() {
				result <- engine.Execute(ctx, profile, settings, "file_put_contents('must-not-run', 'executed');")
			}()
			select {
			case got := <-result:
				if got.Success || !got.Cancelled || got.Error == nil || got.Error.Class != "ExecutionError" || got.Error.Message != "Execução cancelada" {
					t.Fatalf("expected a structured cancellation during %s, got %+v, error: %+v", stage, got, got.Error)
				}
			case <-time.After(5 * time.Second):
				t.Fatal("cancelling compilation did not stop the process promptly")
			}
			if _, err := os.Stat(filepath.Join(profile.ProjectPath, "must-not-run")); !os.IsNotExist(err) {
				t.Fatal("the snippet executed despite cancelling compilation")
			}
		})
	}
}
func TestTransportArgumentSafety(t *testing.T) {
	_, p, _ := fixture(t)
	p.Mode = "ssh-docker"
	p.SSH = core.SSH{Host: "dev-host", User: "forge", Port: 2222, IdentityFile: "/tmp/key with ' quotes"}
	p.Container = "app-1"
	spec, err := PHPCommand(p, "echo 'safe';")
	if err != nil {
		t.Fatal(err)
	}
	if spec.Binary != "ssh" {
		t.Fatal(spec)
	}
	cmd := spec.Args[len(spec.Args)-1]
	if !strings.Contains(cmd, "'docker' 'exec' '-i' '--workdir'") {
		t.Fatal(cmd)
	}

	bin := t.TempDir()
	docker := filepath.Join(bin, "docker")
	script := "#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n"
	os.WriteFile(docker, []byte(script), 0700)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	output, err := Run(context.Background(), Command{Binary: "sh", Args: []string{"-c", cmd}}, nil, 65536)
	if err != nil {
		t.Fatal(err)
	}
	var args []string
	if json.Unmarshal([]byte(output.Stdout), &args) != nil {
		t.Fatal(output)
	}
	if args[3] != p.ProjectPath || args[len(args)-1] != "echo 'safe';" {
		t.Fatalf("%q", args)
	}
	p.SSH.Host = "-oProxyCommand=evil"
	if _, err = PHPCommand(p, ""); err == nil {
		t.Fatal("accepted SSH option injection")
	}
	p.SSH.Host = "valid"
	p.Container = "app; touch /tmp/evil"
	if _, err = PHPCommand(p, ""); err == nil {
		t.Fatal("accepted invalid container")
	}
}
