package service

import (
	"path/filepath"
	"testing"
)

func TestPackagedPhpactorCandidates(t *testing.T) {
	executable := filepath.Join("Applications", "TinkerCraft.app", "Contents", "MacOS", "tinkercraft")
	mac := packagedPhpactorCandidates("darwin", executable)
	if len(mac) != 2 || mac[0] != filepath.Join("Applications", "TinkerCraft.app", "Contents", "MacOS", "..", "Resources", "phpactor.phar") {
		t.Fatalf("unexpected macOS Phpactor candidates: %#v", mac)
	}
	if got := packagedPhpactorCandidates("linux", "/usr/bin/tinkercraft"); len(got) != 1 || got[0] != "/usr/bin/phpactor.phar" {
		t.Fatalf("unexpected Linux Phpactor candidates: %#v", got)
	}
}
