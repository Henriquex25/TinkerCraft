package core

import (
	"runtime"
	"testing"
)

func TestProfilePlatformPaths(t *testing.T) {
	profile := Profile{Name: "Test", Mode: "local", ProjectPath: t.TempDir(), PHPBinary: "php", Bootstrap: "none", Timeout: 5}
	if err := profile.Validate(); err != nil {
		t.Fatal("native local path rejected:", err)
	}
	for _, mode := range []string{"docker", "ssh", "ssh-docker"} {
		profile.Mode = mode
		profile.Container = "php"
		profile.SSH.Host = "test-host"
		for _, test := range []struct {
			path  string
			valid bool
		}{
			{"/var/www/project with spaces", true}, {"/", true},
			{"relative/path", false}, {`C:\project`, false}, {`C:/project`, false}, {`/app\..\other`, false},
		} {
			profile.ProjectPath = test.path
			if err := profile.Validate(); (err == nil) != test.valid {
				t.Fatalf("%s %q: %v", mode, test.path, err)
			}
		}
	}
	if runtime.GOOS == "windows" {
		profile.Mode = "local"
		profile.ProjectPath = "/var/www/project"
		if profile.Validate() == nil {
			t.Fatal("POSIX path accepted as absolute Windows local path")
		}
	}
}
