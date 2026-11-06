package updates

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
	"tinkercraft/internal/buildinfo"
)

const maxPackageSize = 512 * 1024 * 1024

var repoPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$`)
var digestPattern = regexp.MustCompile(`^[a-fA-F0-9]{64}$`)

type Asset struct {
	URL      string `json:"url"`
	SHA256   string `json:"sha256"`
	Size     int64  `json:"size"`
	Filename string `json:"filename"`
}
type Manifest struct {
	SchemaVersion int              `json:"schemaVersion"`
	Version       string           `json:"version"`
	Notes         string           `json:"notes"`
	ReleaseURL    string           `json:"releaseURL"`
	Assets        map[string]Asset `json:"assets"`
}
type Info struct {
	InstallStatus
	Build         buildinfo.Info `json:"build"`
	Configured    bool           `json:"configured"`
	Source        string         `json:"source"`
	Available     bool           `json:"available"`
	LatestVersion string         `json:"latestVersion"`
	Notes         string         `json:"notes"`
	ReleaseURL    string         `json:"releaseURL"`
	CanDownload   bool           `json:"canDownload"`
	PackageName   string         `json:"packageName"`
	PackageSize   int64          `json:"packageSize"`
	Message       string         `json:"message"`
	CheckedAt     string         `json:"checkedAt"`
}
type Download struct {
	Path    string `json:"path"`
	Version string `json:"version"`
	Size    int64  `json:"size"`
}
type release struct {
	Info  Info
	Asset Asset
}
type Manager struct {
	mu              sync.Mutex
	checkMu         sync.Mutex
	downloadMu      sync.Mutex
	http            *http.Client
	build           buildinfo.Info
	last            *release
	downloaded      *Download
	downloadedAsset Asset
}

func New(build buildinfo.Info, client *http.Client) *Manager {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Minute}
	}
	copy := *client
	copy.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("Redirecionamentos demais")
		}
		return validateURL(req.URL.String())
	}
	return &Manager{build: build, http: &copy}
}
func validateURL(value string) error {
	u, e := url.Parse(value)
	if e != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Fragment != "" {
		return errors.New("Use uma URL HTTPS sem credenciais ou fragmentos")
	}
	return nil
}

func SourceURL(source string) (string, bool, error) {
	if source == "" {
		return "", false, nil
	}
	if len(source) > 2048 {
		return "", false, errors.New("Fonte de atualização muito longa")
	}
	if e := validateURL(source); e != nil {
		return "", false, e
	}
	u, _ := url.Parse(source)
	if strings.EqualFold(u.Hostname(), "github.com") && (u.Port() == "" || u.Port() == "443") {
		repo := strings.TrimSuffix(strings.Trim(u.Path, "/"), ".git")
		if !repoPattern.MatchString(repo) || u.RawQuery != "" {
			return "", false, errors.New("Informe a URL do repositório GitHub, sem /releases ou parâmetros")
		}
		return "https://api.github.com/repos/" + repo + "/releases/latest", true, nil
	}
	return source, false, nil
}
func (m *Manager) get(ctx context.Context, address string, limit int64) ([]byte, error) {
	if e := validateURL(address); e != nil {
		return nil, e
	}
	req, e := http.NewRequestWithContext(ctx, "GET", address, nil)
	if e != nil {
		return nil, e
	}
	req.Header.Set("User-Agent", "TinkerCraft/"+m.build.Version)
	req.Header.Set("Accept", "application/vnd.github+json, application/json, text/plain")
	response, e := m.http.Do(req)
	if e != nil {
		return nil, e
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, fmt.Errorf("A fonte de atualizações respondeu HTTP %d", response.StatusCode)
	}
	data, e := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if e != nil {
		return nil, e
	}
	if int64(len(data)) > limit {
		return nil, errors.New("Resposta da fonte de atualizações excedeu o limite")
	}
	return data, nil
}
func (m *Manager) Check(ctx context.Context, source string) (Info, error) {
	m.checkMu.Lock()
	defer m.checkMu.Unlock()
	info := Info{Build: m.build, Source: source, Configured: source != ""}
	if source == "" {
		info.Message = "Configure a fonte de atualizações nas preferências"
		m.mu.Lock()
		m.last = nil
		m.mu.Unlock()
		return info, nil
	}
	address, github, e := SourceURL(source)
	if e != nil {
		return info, e
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	data, e := m.get(ctx, address, 2*1024*1024)
	if e != nil {
		return info, e
	}
	var manifest Manifest
	if github {
		manifest, e = m.githubManifest(ctx, data)
		if e != nil {
			return info, e
		}
	} else {
		if e = json.Unmarshal(data, &manifest); e != nil {
			return info, fmt.Errorf("Manifesto de atualização inválido: %w", e)
		}
		if manifest.SchemaVersion != 1 {
			return info, errors.New("Formato de atualização não suportado")
		}
	}
	compare, e := CompareVersions(manifest.Version, m.build.Version)
	if e != nil {
		return info, e
	}
	info.LatestVersion = strings.TrimPrefix(manifest.Version, "v")
	info.Available = compare > 0
	info.CheckedAt = time.Now().Format(time.RFC3339)
	info.Notes = manifest.Notes
	if len(info.Notes) > 16000 {
		info.Notes = info.Notes[:16000]
	}
	if manifest.ReleaseURL != "" {
		if e = validateURL(manifest.ReleaseURL); e != nil {
			return info, e
		}
		info.ReleaseURL = manifest.ReleaseURL
	}
	asset, exists := manifest.Assets[m.build.Variant]
	info.Message = "Você está usando a versão mais recente deste canal"
	if compare < 0 {
		info.Message = "Esta instalação é mais recente que a versão publicada"
	}
	if info.Available {
		info.Message = "Uma nova versão do TinkerCraft está disponível"
		if !exists {
			info.Message = "Nova versão disponível; ainda não há pacote para esta instalação"
		} else if !digestPattern.MatchString(asset.SHA256) {
			info.Message = "O release ainda não fornece um SHA-256 válido para o pacote"
		} else {
			expected := fmt.Sprintf("tinkercraft_%s_%s.deb", info.LatestVersion, strings.ReplaceAll(m.build.Variant, "-", "_"))
			if asset.Filename != expected || asset.Size <= 0 || asset.Size > maxPackageSize {
				return info, errors.New("Pacote de atualização inválido")
			}
			if e = validateURL(asset.URL); e != nil {
				return info, e
			}
			info.CanDownload = true
			info.PackageName = asset.Filename
			info.PackageSize = asset.Size
		}
	}
	m.mu.Lock()
	m.last = &release{info, asset}
	m.mu.Unlock()
	return info, nil
}
func (m *Manager) githubManifest(ctx context.Context, data []byte) (Manifest, error) {
	var response struct {
		Tag        string `json:"tag_name"`
		Body       string `json:"body"`
		HTML       string `json:"html_url"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
		Assets     []struct {
			Name   string `json:"name"`
			URL    string `json:"browser_download_url"`
			Digest string `json:"digest"`
			Size   int64  `json:"size"`
		} `json:"assets"`
	}
	if e := json.Unmarshal(data, &response); e != nil {
		return Manifest{}, e
	}
	if response.Draft || response.Prerelease {
		return Manifest{}, errors.New("O canal estável não aceita rascunhos ou pré-releases")
	}
	version := strings.TrimPrefix(response.Tag, "v")
	name := fmt.Sprintf("tinkercraft_%s_%s.deb", version, strings.ReplaceAll(m.build.Variant, "-", "_"))
	result := Manifest{SchemaVersion: 1, Version: version, Notes: response.Body, ReleaseURL: response.HTML, Assets: map[string]Asset{}}
	var selected Asset
	var checksumURL string
	for _, a := range response.Assets {
		if a.Name == name {
			selected = Asset{a.URL, strings.TrimPrefix(a.Digest, "sha256:"), a.Size, a.Name}
		}
		if a.Name == "checksums.txt" {
			checksumURL = a.URL
		}
	}
	if selected.Filename != "" {
		if !digestPattern.MatchString(selected.SHA256) && checksumURL != "" {
			checks, e := m.get(ctx, checksumURL, 1024*1024)
			if e != nil {
				return result, e
			}
			for _, line := range strings.Split(string(checks), "\n") {
				parts := strings.Fields(line)
				if len(parts) == 2 && strings.TrimPrefix(parts[1], "*") == name && digestPattern.MatchString(parts[0]) {
					selected.SHA256 = parts[0]
					break
				}
			}
		}
		result.Assets[m.build.Variant] = selected
	}
	return result, nil
}
func validFile(path string, asset Asset) bool {
	stat, e := os.Lstat(path)
	if e != nil || !stat.Mode().IsRegular() || stat.Size() != asset.Size {
		return false
	}
	file, e := os.Open(path)
	if e != nil {
		return false
	}
	defer file.Close()
	hash := sha256.New()
	if _, e = io.Copy(hash, file); e != nil {
		return false
	}
	return strings.EqualFold(hex.EncodeToString(hash.Sum(nil)), asset.SHA256)
}
func (m *Manager) Download(ctx context.Context, dir, source string) (Download, error) {
	m.downloadMu.Lock()
	defer m.downloadMu.Unlock()
	m.mu.Lock()
	var r release
	if m.last != nil {
		r = *m.last
	}
	m.mu.Unlock()
	if !r.Info.CanDownload || !r.Info.Available || r.Info.Source != source {
		return Download{}, errors.New("Verifique as atualizações antes de baixar o pacote")
	}
	if e := os.MkdirAll(dir, 0700); e != nil {
		return Download{}, e
	}
	dest := filepath.Join(dir, r.Asset.Filename)
	if !validFile(dest, r.Asset) {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		defer cancel()
		req, e := http.NewRequestWithContext(ctx, "GET", r.Asset.URL, nil)
		if e != nil {
			return Download{}, e
		}
		req.Header.Set("User-Agent", "TinkerCraft/"+m.build.Version)
		response, e := m.http.Do(req)
		if e != nil {
			return Download{}, e
		}
		defer response.Body.Close()
		if response.StatusCode != 200 {
			return Download{}, fmt.Errorf("Download respondeu HTTP %d", response.StatusCode)
		}
		file, e := os.CreateTemp(dir, ".download-")
		if e != nil {
			return Download{}, e
		}
		temporary := file.Name()
		defer os.Remove(temporary)
		_, e = io.Copy(file, io.LimitReader(response.Body, r.Asset.Size+1))
		if e == nil {
			e = file.Sync()
		}
		closeErr := file.Close()
		if e != nil {
			return Download{}, e
		}
		if closeErr != nil {
			return Download{}, closeErr
		}
		if !validFile(temporary, r.Asset) {
			return Download{}, errors.New("O pacote não corresponde ao tamanho e SHA-256 publicados; download descartado")
		}
		if e = os.Rename(temporary, dest); e != nil {
			return Download{}, e
		}
	}
	file, e := os.Open(dest)
	if e != nil {
		return Download{}, e
	}
	magic := make([]byte, 8)
	_, e = io.ReadFull(file, magic)
	file.Close()
	if e != nil || string(magic) != "!<arch>\n" {
		os.Remove(dest)
		return Download{}, errors.New("O arquivo recebido não é um pacote Debian")
	}
	result := Download{dest, r.Info.LatestVersion, r.Asset.Size}
	m.mu.Lock()
	m.downloaded = &result
	m.downloadedAsset = r.Asset
	m.mu.Unlock()
	return result, nil
}
func (m *Manager) InstallerPackage(source string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.downloaded == nil || m.last == nil || m.last.Info.Source != source || m.downloaded.Version != m.last.Info.LatestVersion || m.downloadedAsset.SHA256 != m.last.Asset.SHA256 || !validFile(m.downloaded.Path, m.downloadedAsset) {
		return "", errors.New("Baixe e verifique o pacote antes de abrir o instalador")
	}
	return m.downloaded.Path, nil
}
func (m *Manager) ReleasePage() (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.last == nil || m.last.Info.ReleaseURL == "" {
		return "", errors.New("Verifique as atualizações para obter a página do release")
	}
	return m.last.Info.ReleaseURL, nil
}
