package buildinfo

import "testing"

func TestVersionAcceptsStableReleasesAndRejectsInvalidMetadata(t *testing.T) {
	previous := Version
	t.Cleanup(func() { Version = previous })
	if err := SetVersion("2.3.4\n"); err != nil {
		t.Fatal(err)
	}
	if Current().Version != "2.3.4" {
		t.Fatal("version not reflected in build metadata")
	}
	for _, value := range []string{"", "v2.3.4", "02.3.4", "2.3", "2.3.4-beta", "2.3.4\n9.9.9", "2.3.4$(command)"} {
		if SetVersion(value) == nil {
			t.Fatalf("accepted invalid version %q", value)
		}
		if Version != "2.3.4" {
			t.Fatal("invalid input replaced the valid version")
		}
	}
}
