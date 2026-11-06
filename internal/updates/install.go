package updates

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"tinkercraft/internal/buildinfo"
)

const InstalledExecutable = "/usr/lib/tinkercraft/tinkercraft"

type InstallStatus struct {
	InstalledVersion string `json:"installedVersion"`
	RestartRequired  bool   `json:"restartRequired"`
	CanInstall       bool   `json:"canInstall"`
}

type Installer struct {
	mu             sync.Mutex
	build          buildinfo.Info
	executable     func() (string, error)
	toolsAvailable func() bool
	run            func(context.Context, string, ...string) ([]byte, error)
	startRestart   func(*os.File) error
}

type limitedOutput struct{ bytes.Buffer }

func (b *limitedOutput) Write(p []byte) (int, error) {
	n := len(p)
	if remaining := 16384 - b.Len(); remaining > 0 {
		b.Buffer.Write(p[:min(remaining, n)])
	}
	return n, nil
}

func runInstallerCommand(ctx context.Context, name string, args ...string) ([]byte, error) {
	command := exec.CommandContext(ctx, name, args...)
	command.Dir = "/"
	var output limitedOutput
	command.Stdout, command.Stderr = &output, &output
	err := command.Run()
	return output.Bytes(), err
}

func NewInstaller(build buildinfo.Info) *Installer {
	return &Installer{build: build, executable: os.Executable, run: runInstallerCommand, startRestart: startRestart, toolsAvailable: func() bool {
		for _, path := range []string{"/usr/bin/pkexec", "/usr/bin/apt-get"} {
			if stat, err := os.Stat(path); err != nil || !stat.Mode().IsRegular() || stat.Mode().Perm()&0111 == 0 {
				return false
			}
		}
		return true
	}}
}

func startRestart(read *os.File) error {
	command := exec.Command(InstalledExecutable, "--relaunch-after-update")
	command.Dir = "/"
	command.ExtraFiles = []*os.File{read}
	if err := command.Start(); err != nil {
		return err
	}
	go command.Wait()
	return nil
}

func (i *Installer) installed(ctx context.Context) (buildinfo.Info, error) {
	var info buildinfo.Info
	path, err := i.executable()
	if err != nil || i.build.Distribution != "deb" || path != InstalledExecutable {
		return info, errors.New("Automatic updates are available in the installed Debian app. Install the official .deb package first.")
	}
	data, err := i.run(ctx, InstalledExecutable, "--version-json")
	if err != nil || json.Unmarshal(data, &info) != nil || info.Distribution != "deb" || info.Variant != i.build.Variant || info.ReleaseSource != i.build.ReleaseSource {
		return info, errors.New("Could not verify the installed TinkerCraft version.")
	}
	if _, err = CompareVersions(info.Version, i.build.Version); err != nil {
		return info, err
	}
	data, err = i.run(ctx, "/usr/bin/dpkg-query", "-W", "-f=${Status}\n${Version}\n", "tinkercraft")
	if err != nil || string(data) != "install ok installed\n"+info.Version+"\n" {
		return info, errors.New("The installed package and executable versions do not match.")
	}
	return info, nil
}

func (i *Installer) Status(ctx context.Context, target string) InstallStatus {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	info, err := i.installed(ctx)
	if err != nil {
		return InstallStatus{}
	}
	status := InstallStatus{InstalledVersion: info.Version, CanInstall: true}
	newer, _ := CompareVersions(info.Version, i.build.Version)
	ready, err := CompareVersions(info.Version, target)
	status.RestartRequired = err == nil && newer > 0 && ready >= 0
	return status
}

func (i *Installer) Install(ctx context.Context, path, target string) error {
	if !i.mu.TryLock() {
		return errors.New("An update is already in progress.")
	}
	defer i.mu.Unlock()
	installed, err := i.installed(ctx)
	if err != nil {
		return err
	}
	comparison, err := CompareVersions(target, installed.Version)
	if err != nil {
		return err
	}
	if comparison < 0 {
		return errors.New("A newer version is already installed. Restart TinkerCraft.")
	}
	if comparison == 0 {
		return nil
	}
	if !filepath.IsAbs(path) || filepath.Ext(path) != ".deb" {
		return errors.New("Invalid update package path.")
	}
	metadata, err := i.run(ctx, "/usr/bin/dpkg-deb", "-f", path, "Package", "Version", "Architecture")
	if err != nil || string(metadata) != fmt.Sprintf("Package: tinkercraft\nVersion: %s\nArchitecture: %s\n", target, i.build.Architecture) {
		return errors.New("The Debian package identity does not match this update.")
	}
	if !i.toolsAvailable() {
		return errors.New("Automatic installation requires APT, pkexec and a graphical authentication agent.")
	}
	output, err := i.run(ctx, "/usr/bin/pkexec", "--disable-internal-agent", "/usr/bin/apt-get", "--assume-yes", "--no-remove", "--no-install-recommends", "-o", "DPkg::Lock::Timeout=60", "-o", "Dpkg::Options::=--force-confold", "install", path)
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) && exit.ExitCode() == 126 {
			return errors.New("Update cancelled. Your current app remains open.")
		}
		return fmt.Errorf("Installation did not complete. Your app remains open. %s", strings.TrimSpace(string(output)))
	}
	info, err := i.installed(ctx)
	if err != nil || info.Version != target {
		return errors.New("Installation could not be confirmed. Your app remains open.")
	}
	return nil
}

func (i *Installer) PrepareRestart(ctx context.Context, version string) (*os.File, error) {
	info, err := i.installed(ctx)
	if err != nil || info.Version != version {
		return nil, errors.New("Verify the installed update before restarting.")
	}
	read, write, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	defer read.Close()
	if err = i.startRestart(read); err != nil {
		write.Close()
		return nil, err
	}
	return write, nil
}

func RelaunchAfterUpdate() error {
	if len(os.Args) != 2 || os.Getuid() == 0 {
		return errors.New("Invalid update restart.")
	}
	pipe := os.NewFile(3, "update-parent")
	if pipe == nil {
		return errors.New("Missing update restart pipe.")
	}
	defer pipe.Close()
	stat, err := pipe.Stat()
	if err != nil || stat.Mode()&os.ModeNamedPipe == 0 {
		return errors.New("Invalid update restart pipe.")
	}
	return waitForRestart(pipe)
}

func waitForRestart(pipe io.Reader) error {
	data, err := io.ReadAll(io.LimitReader(pipe, 1))
	if err != nil || len(data) != 1 || data[0] != 'R' {
		return errors.New("Update restart was not confirmed.")
	}
	_, err = io.Copy(io.Discard, pipe)
	return err
}
