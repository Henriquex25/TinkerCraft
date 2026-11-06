package updates

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
	"tinkercraft/internal/buildinfo"
)

func installerFixture(t *testing.T, installed string) (*Installer, *[]string, *string) {
	t.Helper()
	build := buildinfo.Info{Version: "0.2.0", Distribution: "deb", Variant: "linux-amd64-webkit40", Architecture: "amd64", ReleaseSource: "https://github.com/example/repo"}
	i := NewInstaller(build)
	i.toolsAvailable = func() bool { return true }
	i.executable = func() (string, error) { return InstalledExecutable, nil }
	calls := []string{}
	i.run = func(_ context.Context, command string, args ...string) ([]byte, error) {
		calls = append(calls, command)
		switch command {
		case InstalledExecutable:
			info := build
			info.Version = installed
			return json.Marshal(info)
		case "/usr/bin/dpkg-query":
			return []byte("install ok installed\n" + installed + "\n"), nil
		case "/usr/bin/dpkg-deb":
			return []byte("Package: tinkercraft\nVersion: 0.3.0\nArchitecture: amd64\n"), nil
		case "/usr/bin/pkexec":
			want := []string{"--disable-internal-agent", "/usr/bin/apt-get", "--assume-yes", "--no-remove", "--no-install-recommends", "-o", "DPkg::Lock::Timeout=60", "-o", "Dpkg::Options::=--force-confold", "install", "/private/verified update.deb"}
			if !reflect.DeepEqual(args, want) {
				t.Errorf("unsafe install arguments: %q", args)
			}
			installed = "0.3.0"
			return nil, nil
		}
		t.Fatalf("unexpected command %s", command)
		return nil, nil
	}
	return i, &calls, &installed
}
func TestAlreadyInstalledUpdateOnlyNeedsRestart(t *testing.T) {
	i, calls, _ := installerFixture(t, "0.2.1")
	status := i.Status(context.Background(), "0.2.1")
	if !status.CanInstall || !status.RestartRequired || status.InstalledVersion != "0.2.1" {
		t.Fatal(status)
	}
	if err := i.Install(context.Background(), "", "0.2.1"); err != nil {
		t.Fatal(err)
	}
	for _, call := range *calls {
		if call == "/usr/bin/pkexec" || call == "/usr/bin/dpkg-deb" {
			t.Fatal("reinstalled already installed update")
		}
	}
	if i.Status(context.Background(), "0.3.0").RestartRequired {
		t.Fatal("skipped a newer update")
	}
}
func TestInstallVerifiesMetadataUsesAPTAndConfirmsVersion(t *testing.T) {
	i, calls, _ := installerFixture(t, "0.2.0")
	if err := i.Install(context.Background(), "/private/verified update.deb", "0.3.0"); err != nil {
		t.Fatal(err)
	}
	want := []string{InstalledExecutable, "/usr/bin/dpkg-query", "/usr/bin/dpkg-deb", "/usr/bin/pkexec", InstalledExecutable, "/usr/bin/dpkg-query"}
	if !reflect.DeepEqual(*calls, want) {
		t.Fatal(*calls)
	}
}
func TestInstallRejectsWrongPackageAndDowngrade(t *testing.T) {
	for _, metadata := range []string{"Package: other\nVersion: 0.3.0\nArchitecture: amd64\n", "Package: tinkercraft\nVersion: 0.2.0\nArchitecture: amd64\n", "Package: tinkercraft\nVersion: 0.3.0\nArchitecture: arm64\n"} {
		i, calls, _ := installerFixture(t, "0.2.0")
		run := i.run
		i.run = func(ctx context.Context, command string, args ...string) ([]byte, error) {
			if command == "/usr/bin/dpkg-deb" {
				return []byte(metadata), nil
			}
			return run(ctx, command, args...)
		}
		if err := i.Install(context.Background(), "/private/verified update.deb", "0.3.0"); err == nil {
			t.Fatal("invalid package accepted")
		}
		for _, call := range *calls {
			if call == "/usr/bin/pkexec" {
				t.Fatal("invalid package elevated")
			}
		}
	}
	i, _, _ := installerFixture(t, "0.4.0")
	if err := i.Install(context.Background(), "/private/verified update.deb", "0.3.0"); err == nil {
		t.Fatal("downgrade accepted")
	}
}
func TestInstallationFailureAndCancelledAuthorization(t *testing.T) {
	for _, mode := range []string{"cancel", "failure", "unconfirmed"} {
		i, _, _ := installerFixture(t, "0.2.0")
		run := i.run
		i.run = func(ctx context.Context, command string, args ...string) ([]byte, error) {
			if command != "/usr/bin/pkexec" {
				return run(ctx, command, args...)
			}
			switch mode {
			case "cancel":
				return nil, exec.Command("/bin/sh", "-c", "exit 126").Run()
			case "failure":
				return []byte("APT lock is held"), errors.New("failed")
			default:
				return nil, nil
			}
		}
		if err := i.Install(context.Background(), "/private/verified update.deb", "0.3.0"); err == nil {
			t.Fatal(mode, "was accepted")
		}
	}
}
func TestSourceBuildAndPackageMismatchCannotInstall(t *testing.T) {
	for _, mode := range []string{"source", "path", "package"} {
		i, calls, _ := installerFixture(t, "0.2.0")
		switch mode {
		case "source":
			i.build.Distribution = "source"
		case "path":
			i.executable = func() (string, error) { return "/tmp/tinkercraft", nil }
		case "package":
			run := i.run
			i.run = func(ctx context.Context, command string, args ...string) ([]byte, error) {
				if command == "/usr/bin/dpkg-query" {
					return []byte("install ok installed\n0.1.0\n"), nil
				}
				return run(ctx, command, args...)
			}
		}
		if i.Status(context.Background(), "0.3.0").CanInstall {
			t.Fatal("unsupported installation allowed")
		}
		if err := i.Install(context.Background(), "/private/verified update.deb", "0.3.0"); err == nil {
			t.Fatal("unsupported installation elevated")
		}
		for _, call := range *calls {
			if call == "/usr/bin/pkexec" {
				t.Fatal("unexpected elevation")
			}
		}
	}
}
func TestRestartWaitsForConfirmationAndParentExit(t *testing.T) {
	read, write, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer read.Close()
	defer write.Close()
	done := make(chan error, 1)
	go func() { done <- waitForRestart(read) }()
	write.Write([]byte{'R'})
	select {
	case <-done:
		t.Fatal("restarted before parent exit")
	case <-time.After(20 * time.Millisecond):
	}
	write.Close()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"", "X"} {
		if err := waitForRestart(strings.NewReader(value)); err == nil {
			t.Fatal("restart without save confirmation")
		}
	}
	reader, writer := io.Pipe()
	writer.CloseWithError(errors.New("broken pipe"))
	defer reader.Close()
	if err := waitForRestart(reader); err == nil {
		t.Fatal("broken restart accepted")
	}
}
func TestInstallerOutputIsBounded(t *testing.T) {
	var output limitedOutput
	n, err := output.Write([]byte(strings.Repeat("x", 50000)))
	if err != nil || n != 50000 || output.Len() != 16384 {
		t.Fatal(n, output.Len(), err)
	}
}

func TestRealDebianArchiveMetadata(t *testing.T) {
	if _, err := exec.LookPath("dpkg-deb"); err != nil {
		t.Skip("dpkg-deb is unavailable")
	}
	root := t.TempDir()
	control := filepath.Join(root, "package", "DEBIAN")
	if err := os.MkdirAll(control, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(control, "control"), []byte("Package: tinkercraft\nVersion: 0.3.0\nArchitecture: amd64\nMaintainer: Fixture <fixture@example.com>\nDescription: Isolated update test\n"), 0644); err != nil {
		t.Fatal(err)
	}
	archive := filepath.Join(root, "verified update.deb")
	if output, err := exec.Command("dpkg-deb", "--build", filepath.Dir(control), archive).CombinedOutput(); err != nil {
		t.Fatal(string(output), err)
	}
	i, _, installed := installerFixture(t, "0.2.0")
	run := i.run
	i.run = func(ctx context.Context, command string, args ...string) ([]byte, error) {
		if command == "/usr/bin/dpkg-deb" {
			return runInstallerCommand(ctx, command, args...)
		}
		if command == "/usr/bin/pkexec" {
			if args[len(args)-1] != archive {
				t.Fatal("installer did not receive the verified archive")
			}
			*installed = "0.3.0"
			return nil, nil
		}
		return run(ctx, command, args...)
	}
	if err := i.Install(context.Background(), archive, "0.3.0"); err != nil {
		t.Fatal(err)
	}
}

func TestPrepareRestartRejectsStaleVersionAndClosesFailedLaunch(t *testing.T) {
	i, _, _ := installerFixture(t, "0.3.0")
	started := false
	var inherited *os.File
	i.startRestart = func(read *os.File) error {
		started = true
		inherited = read
		return errors.New("launch failed")
	}
	if pipe, err := i.PrepareRestart(context.Background(), "0.2.1"); err == nil || pipe != nil || started {
		t.Fatal("stale installed version restarted", err)
	}
	if pipe, err := i.PrepareRestart(context.Background(), "0.3.0"); err == nil || pipe != nil || !started {
		t.Fatal("restart failure was not returned", err)
	}
	if _, err := inherited.Stat(); err == nil {
		t.Fatal("restart read pipe leaked")
	}
}
