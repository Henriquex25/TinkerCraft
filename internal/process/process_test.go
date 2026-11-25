package process

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestProcessHelper(t *testing.T) {
	switch os.Getenv("TINKERCRAFT_PROCESS_HELPER") {
	case "echo":
		for i, arg := range os.Args {
			if arg == "--" {
				json.NewEncoder(os.Stdout).Encode(os.Args[i+1:])
				os.Exit(0)
			}
		}
		os.Exit(2)
	case "parent":
		child := exec.Command(os.Args[0], "-test.run=^TestProcessHelper$")
		child.Env = append(os.Environ(), "TINKERCRAFT_PROCESS_HELPER=leaf")
		child.Stdout, child.Stderr = os.Stdout, os.Stderr
		if err := child.Start(); err != nil {
			os.Exit(2)
		}
		time.Sleep(10 * time.Second)
		os.Exit(0)
	case "leaf":
		for i := 0; i < 300; i++ {
			if os.WriteFile(os.Getenv("TINKERCRAFT_PROCESS_HEARTBEAT"), []byte(fmt.Sprint(i)), 0600) != nil {
				os.Exit(2)
			}
			time.Sleep(10 * time.Millisecond)
		}
		os.Exit(0)
	}
}

func TestArgumentsPreserveSpacesUnicodeAndShellCharacters(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	want := []string{"", "Olá 世界", `C:\project with spaces\`, `one'two"three`, "$(touch never); & | %PATH%"}
	cmd := exec.CommandContext(ctx, os.Args[0], append([]string{"-test.run=^TestProcessHelper$", "--"}, want...)...)
	cmd.Env = append(os.Environ(), "TINKERCRAFT_PROCESS_HELPER=echo")
	var output bytes.Buffer
	cmd.Stdout = &output
	cleanup, err := Start(cmd)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	if err = cmd.Wait(); err != nil {
		t.Fatal(err)
	}
	var got []string
	if err = json.Unmarshal(output.Bytes(), &got); err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("arguments changed: %q, %v", got, err)
	}
}

func TestCancellationStopsDescendants(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	file := filepath.Join(t.TempDir(), "heartbeat")
	cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestProcessHelper$")
	cmd.Env = append(os.Environ(), "TINKERCRAFT_PROCESS_HELPER=parent", "TINKERCRAFT_PROCESS_HEARTBEAT="+file)
	cmd.WaitDelay = time.Second
	cleanup, err := Start(cmd)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	ready := false
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); {
		if data, err := os.ReadFile(file); err == nil && len(data) > 0 {
			ready = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	if err := cmd.Wait(); err == nil {
		t.Fatal("cancelled process succeeded")
	}
	if !ready {
		t.Fatal("descendant did not become ready")
	}
	time.Sleep(100 * time.Millisecond)
	before, _ := os.ReadFile(file)
	time.Sleep(150 * time.Millisecond)
	after, _ := os.ReadFile(file)
	if !bytes.Equal(before, after) {
		t.Fatalf("descendant continued after cancellation: %s -> %s", before, after)
	}
}

func TestCancelledBeforeStartAndMissingExecutable(t *testing.T) {
	for _, missing := range []bool{false, true} {
		ctx, cancel := context.WithCancel(context.Background())
		binary := os.Args[0]
		if missing {
			binary = filepath.Join(t.TempDir(), "does-not-exist")
		} else {
			cancel()
		}
		cmd := exec.CommandContext(ctx, binary)
		cleanup, err := Start(cmd)
		cancel()
		if cleanup != nil {
			cleanup()
		}
		if err == nil || (missing && !strings.Contains(err.Error(), "does-not-exist")) {
			t.Fatalf("unexpected start result: %v", err)
		}
	}
}
