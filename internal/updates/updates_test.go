package updates

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"tinkercraft/internal/buildinfo"
)

func fixtureBuild() buildinfo.Info {
	return buildinfo.Info{Version: "0.2.0", Variant: "linux-amd64-webkit40", Distribution: "deb"}
}
func TestVersionOrdering(t *testing.T) {
	for _, c := range []struct {
		a, b string
		n    int
	}{{"v0.2.0", "0.2.0", 0}, {"0.10.0", "0.9.9", 1}, {"1.0.0-beta.2", "1.0.0-beta.10", -1}, {"1.0.0", "1.0.0-rc.1", 1}, {"1.0.0+abc", "1.0.0+other", 0}} {
		n, e := CompareVersions(c.a, c.b)
		if e != nil || n != c.n {
			t.Fatalf("%+v -> %d %v", c, n, e)
		}
	}
	for _, v := range []string{"01.0.0", "dev", "1.0", "1.0.0-01", "1.0.0-alpha..beta"} {
		if _, _, e := parseVersion(v); e == nil {
			t.Fatal("invalid version", v)
		}
	}
}
func TestSourceValidation(t *testing.T) {
	endpoint, github, e := SourceURL("https://github.com/owner/TinkerCraft")
	if e != nil || !github || endpoint != "https://api.github.com/repos/owner/TinkerCraft/releases/latest" {
		t.Fatal(endpoint, e)
	}
	for _, source := range []string{"http://example.com/feed", "https://user:secret@example.com/feed", "https://github.com/owner/repo/releases", "file:///tmp/feed", "https://example.com/feed#fragment"} {
		if _, _, e = SourceURL(source); e == nil {
			t.Fatal("accepted", source)
		}
	}
}
func TestManifestDownloadAndIntegrity(t *testing.T) {
	packageBytes := []byte("!<arch>\nverified Debian fixture")
	digest := sha256.Sum256(packageBytes)
	sum := hex.EncodeToString(digest[:])
	name := "tinkercraft_0.3.0_linux_amd64_webkit40.deb"
	var server *httptest.Server
	bad := false
	server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/package.deb" {
			if bad {
				w.Write(append([]byte(nil), packageBytes[:len(packageBytes)-1]...))
				return
			}
			w.Write(packageBytes)
			return
		}
		json.NewEncoder(w).Encode(Manifest{SchemaVersion: 1, Version: "0.3.0", ReleaseURL: server.URL + "/release", Assets: map[string]Asset{"linux-amd64-webkit40": {server.URL + "/package.deb", sum, int64(len(packageBytes)), name}}})
	}))
	defer server.Close()
	m := New(fixtureBuild(), server.Client())
	source := server.URL + "/manifest.json"
	info, e := m.Check(context.Background(), source)
	if e != nil || !info.Available || !info.CanDownload {
		t.Fatalf("%+v %v", info, e)
	}
	if _, e = m.InstallerPackage(source); e == nil {
		t.Fatal("installer available before verified download")
	}
	dir := t.TempDir()
	download, e := m.Download(context.Background(), dir, source)
	if e != nil {
		t.Fatal(e)
	}
	if download.Path != filepath.Join(dir, name) {
		t.Fatal(download)
	}
	if _, e = m.InstallerPackage(source); e != nil {
		t.Fatal(e)
	}
	if _, e = m.InstallerPackage("https://different.example/feed"); e == nil {
		t.Fatal("source switch allowed installer")
	}
	infoStat, _ := os.Stat(download.Path)
	if infoStat.Mode().Perm() != 0600 {
		t.Fatal("package not private")
	}
	os.WriteFile(download.Path, []byte("tampered"), 0600)
	if _, e = m.InstallerPackage(source); e == nil {
		t.Fatal("tampered package accepted")
	}
	bad = true
	if _, e = m.Download(context.Background(), dir, source); e == nil {
		t.Fatal("bad download accepted")
	}
	for _, f := range mustReadDir(t, dir) {
		if strings.HasPrefix(f.Name(), ".download-") {
			t.Fatal("temporary download leaked")
		}
	}
}
func mustReadDir(t *testing.T, path string) []os.DirEntry {
	t.Helper()
	files, e := os.ReadDir(path)
	if e != nil {
		t.Fatal(e)
	}
	return files
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestGitHubLatestAndChecksumsFallback(t *testing.T) {
	name := "tinkercraft_0.3.0_linux_amd64_webkit40.deb"
	sum := strings.Repeat("a", 64)
	requests := 0
	client := &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
		requests++
		var body string
		if strings.HasSuffix(r.URL.Path, "/checksums.txt") {
			body = sum + "  " + name + "\n"
		} else {
			body = fmt.Sprintf(`{"tag_name":"v0.3.0","html_url":"https://github.com/owner/repo/releases/tag/v0.3.0","body":"notes","assets":[{"name":%q,"browser_download_url":"https://github.com/owner/repo/releases/download/v0.3.0/%s","size":123},{"name":"checksums.txt","browser_download_url":"https://github.com/owner/repo/releases/download/v0.3.0/checksums.txt"}]}`, name, name)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	info, e := New(fixtureBuild(), client).Check(context.Background(), "https://github.com/owner/repo")
	if e != nil || !info.CanDownload || info.PackageName != name || requests != 2 {
		t.Fatalf("%+v %v requests=%d", info, e, requests)
	}
}
func TestNoDowngradeAndMissingVariant(t *testing.T) {
	version := "0.1.0"
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(Manifest{SchemaVersion: 1, Version: version, Assets: map[string]Asset{}})
	}))
	defer server.Close()
	m := New(fixtureBuild(), server.Client())
	info, e := m.Check(context.Background(), server.URL)
	if e != nil || info.Available || info.CanDownload {
		t.Fatal(info, e)
	}
	version = "0.3.0"
	info, e = m.Check(context.Background(), server.URL)
	if e != nil || !info.Available || info.CanDownload {
		t.Fatal(info, e)
	}
	empty, e := m.Check(context.Background(), "")
	if e != nil || empty.Configured {
		t.Fatal(empty, e)
	}
}
func TestRejectHTTPSDowngrade(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "http://example.com/manifest", 302) }))
	defer server.Close()
	if _, e := New(fixtureBuild(), server.Client()).Check(context.Background(), server.URL); e == nil {
		t.Fatal("HTTPS downgrade accepted")
	}
}
