//go:build !linux

package updates

import (
	"context"
	"testing"
	"tinkercraft/internal/buildinfo"
)

func TestAutomaticInstallerUnavailableOutsideLinux(t *testing.T) {
	installer := NewInstaller(buildinfo.Info{Distribution: "deb", Version: "1.0.0"})
	installer.executable = func() (string, error) { return InstalledExecutable, nil }
	installer.run = func(context.Context, string, ...string) ([]byte, error) {
		t.Fatal("attempted a Debian installer command outside Linux")
		return nil, nil
	}
	ctx := context.Background()
	if status := installer.Status(ctx, "1.0.1"); status.CanInstall || status.RestartRequired {
		t.Fatalf("unexpected update capability: %+v", status)
	}
	if installer.Install(ctx, "/tmp/update.deb", "1.0.1") == nil {
		t.Fatal("installation accepted outside Linux")
	}
	if _, err := installer.PrepareRestart(ctx, "1.0.1"); err == nil {
		t.Fatal("restart prepared outside Linux")
	}
	if startRestart(nil) == nil || RelaunchAfterUpdate() == nil {
		t.Fatal("Linux relaunch protocol accepted outside Linux")
	}
}
