package language

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"tinkercraft/internal/core"
	"tinkercraft/internal/execution"
	phpruntime "tinkercraft/runtime"
)

const cacheMaxBytes = 256 * 1024 * 1024
const cacheMaxFiles = 80000
const cacheFormat = 2

type CacheMetadata struct {
	Format    int       `json:"format"`
	UpdatedAt time.Time `json:"updatedAt"`
	LastUsed  time.Time `json:"lastUsed"`
	Files     int       `json:"files"`
	Bytes     int64     `json:"bytes"`
	Skipped   int       `json:"skipped"`
	Limited   bool      `json:"limited"`
}
type CachedProject struct {
	Root      string
	Source    string
	UpdatedAt time.Time
	Notice    string
}
type Cache struct {
	mu     sync.Mutex
	Base   string
	engine *execution.Engine
}

func NewCache(base string, engine *execution.Engine) *Cache {
	return &Cache{Base: base, engine: engine}
}
func cacheKey(p core.Profile) string {
	data, _ := json.Marshal(struct {
		Mode, Host, User, IdentityFile, Container, Project string
		Port                                               int
	}{p.Mode, p.SSH.Host, p.SSH.User, p.SSH.IdentityFile, p.Container, p.ProjectPath, p.SSH.Port})
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}
func readMetadata(dir string) (CacheMetadata, error) {
	var meta CacheMetadata
	data, err := os.ReadFile(filepath.Join(dir, "metadata.json"))
	if err != nil {
		return meta, err
	}
	err = json.Unmarshal(data, &meta)
	return meta, err
}
func writeMetadata(dir string, meta CacheMetadata) error {
	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(dir, ".metadata-")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(name, filepath.Join(dir, "metadata.json"))
}

func (c *Cache) Prepare(ctx context.Context, p core.Profile, refresh bool) (CachedProject, error) {
	switch p.AutocompleteMode() {
	case "off":
		return CachedProject{Source: "off"}, nil
	case "local":
		if p.LocalPath == "" {
			return CachedProject{}, fmt.Errorf("Informe a pasta local nas opções de autocomplete")
		}
		return CachedProject{Root: p.LocalPath, Source: "local"}, nil
	}
	if p.Mode == "local" {
		return CachedProject{Root: p.ProjectPath, Source: "local"}, nil
	}
	if p.Mode == "docker" {
		if mount, err := c.engine.LocalMount(ctx, p); err == nil && mount != "" {
			return CachedProject{Root: mount, Source: "mount"}, nil
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return CachedProject{}, err
	}
	if err := os.MkdirAll(c.Base, 0700); err != nil {
		return CachedProject{}, err
	}
	dir := filepath.Join(c.Base, cacheKey(p))
	root := filepath.Join(dir, "project")
	old, metaErr := readMetadata(dir)
	stat, rootErr := os.Stat(root)
	existing := metaErr == nil && rootErr == nil && stat.IsDir() && old.Format == cacheFormat
	if existing && !refresh && time.Since(old.UpdatedAt) < 15*time.Minute {
		old.LastUsed = time.Now()
		if err := writeMetadata(dir, old); err != nil {
			return CachedProject{}, err
		}
		return CachedProject{Root: root, Source: "cache", UpdatedAt: old.UpdatedAt, Notice: cacheNotice(old)}, nil
	}
	staging, err := os.MkdirTemp(c.Base, ".stage-")
	if err != nil {
		return CachedProject{}, err
	}
	defer os.RemoveAll(staging)
	project := filepath.Join(staging, "project")
	if err = os.Mkdir(project, 0700); err != nil {
		return CachedProject{}, err
	}
	meta, err := c.download(ctx, p, project)
	if err != nil {
		if existing && ctx.Err() == nil {
			old.LastUsed = time.Now()
			writeMetadata(dir, old)
			return CachedProject{Root: root, Source: "cache", UpdatedAt: old.UpdatedAt, Notice: "Não foi possível atualizar o cache; usando a cópia anterior. " + err.Error()}, nil
		}
		return CachedProject{}, err
	}
	meta.UpdatedAt = time.Now()
	meta.Format = cacheFormat
	meta.LastUsed = meta.UpdatedAt
	if err = writeMetadata(staging, meta); err != nil {
		return CachedProject{}, err
	}
	backup := dir + ".previous-" + execution.ID()
	hadPrevious := false
	if info, err := os.Lstat(dir); err == nil {
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return CachedProject{}, fmt.Errorf("Entrada de cache inválida")
		}
		if err = os.Rename(dir, backup); err != nil {
			return CachedProject{}, err
		}
		hadPrevious = true
	}
	if err = os.Rename(staging, dir); err != nil {
		if hadPrevious {
			os.Rename(backup, dir)
		}
		return CachedProject{}, err
	}
	if hadPrevious {
		os.RemoveAll(backup)
	}
	return CachedProject{Root: root, Source: "cache", UpdatedAt: meta.UpdatedAt, Notice: cacheNotice(meta)}, nil
}
func cacheNotice(meta CacheMetadata) string {
	if meta.Limited {
		return "Cache parcial: limite de 256 MiB ou 80.000 arquivos atingido; os fontes da aplicação têm prioridade"
	}
	if meta.Skipped > 0 {
		return fmt.Sprintf("Cache parcial: %d arquivos grandes ou sem permissão foram ignorados", meta.Skipped)
	}
	return ""
}

func (c *Cache) download(ctx context.Context, p core.Profile, project string) (CacheMetadata, error) {
	var meta CacheMetadata
	spec, err := execution.PHPCommand(p, phpruntime.Snapshot())
	if err != nil {
		return meta, err
	}
	input, _ := json.Marshal(map[string]any{"projectPath": p.ProjectPath, "maxBytes": cacheMaxBytes, "maxFiles": cacheMaxFiles})
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	reader, writer := io.Pipe()
	type outcome struct {
		result execution.ProcessResult
		err    error
	}
	finished := make(chan outcome, 1)
	go func() {
		result, err := execution.Stream(ctx, spec, input, writer)
		writer.CloseWithError(err)
		finished <- outcome{result, err}
	}()
	meta, extractErr := extractSnapshot(io.LimitReader(reader, 400*1024*1024), project)
	if extractErr != nil {
		cancel()
		reader.CloseWithError(extractErr)
	} else {
		reader.Close()
	}
	run := <-finished
	if extractErr != nil {
		return meta, fmt.Errorf("Não foi possível preparar o cache de autocomplete: %v. %s", extractErr, strings.TrimSpace(run.result.Stderr))
	}
	if run.err != nil {
		return meta, run.err
	}
	if run.result.ExitCode != 0 {
		return meta, fmt.Errorf("Cache: %s", strings.TrimSpace(run.result.Stderr))
	}
	return meta, nil
}

var excludedDirectories = map[string]bool{"storage": true, "cache": true, "logs": true, "log": true, "tmp": true, "temp": true, "public": true, "var": true, "uploads": true, "upload": true, "backups": true, "media": true}

func allowedSnapshotPath(name string) bool {
	if name == "" || strings.ContainsAny(name, "\\\x00") || strings.HasPrefix(name, "/") || path.Clean(name) != name || !filepath.IsLocal(name) {
		return false
	}
	parts := strings.Split(name, "/")
	for i, dir := range parts[:len(parts)-1] {
		if strings.HasPrefix(dir, ".") || dir == "node_modules" || (i == 0 && excludedDirectories[dir]) || (i == 1 && parts[0] == "bootstrap" && dir == "cache") {
			return false
		}
		if parts[0] == "vendor" && i >= 3 {
			switch strings.ToLower(dir) {
			case "test", "tests", "fixtures", "doc", "docs", "examples", "benchmarks":
				return false
			}
		}
	}
	base := path.Base(name)
	if name == "vendor/autoload.php" || (path.Dir(name) == "vendor/composer" && strings.HasPrefix(base, "autoload") && strings.HasSuffix(base, ".php")) {
		return false
	}
	if strings.HasPrefix(base, ".") {
		return false
	}
	return strings.EqualFold(path.Ext(base), ".php") || base == "composer.json" || base == "composer.lock" || name == "vendor/composer/installed.json"
}
func extractSnapshot(reader io.Reader, project string) (CacheMetadata, error) {
	var meta CacheMetadata
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 4096), 6*1024*1024+8192)
	seen := map[string]bool{}
	done := false
	for scanner.Scan() {
		if len(strings.TrimSpace(scanner.Text())) == 0 {
			continue
		}
		if done {
			return meta, fmt.Errorf("Dados inesperados após o fim da transferência")
		}
		var record struct {
			Path    string `json:"path"`
			Data    string `json:"data"`
			Done    bool   `json:"done"`
			Files   int    `json:"files"`
			Bytes   int64  `json:"bytes"`
			Skipped int    `json:"skipped"`
			Limited bool   `json:"limited"`
		}
		if err := json.Unmarshal(scanner.Bytes(), &record); err != nil {
			return meta, fmt.Errorf("Transferência incompleta: %w", err)
		}
		if record.Done {
			if meta.Files != record.Files || meta.Bytes != record.Bytes {
				return meta, fmt.Errorf("Contagem de arquivos inconsistente")
			}
			meta.Skipped = record.Skipped
			meta.Limited = record.Limited
			done = true
			continue
		}
		if !allowedSnapshotPath(record.Path) || len(record.Path) > 4096 || seen[record.Path] {
			return meta, fmt.Errorf("Caminho de arquivo inválido no cache")
		}
		if len(record.Data) > 6*1024*1024 {
			return meta, fmt.Errorf("Arquivo maior que o limite de cache")
		}
		data, err := base64.StdEncoding.DecodeString(record.Data)
		if err != nil {
			return meta, err
		}
		if len(data) > 4*1024*1024 {
			return meta, fmt.Errorf("Arquivo maior que 4 MiB")
		}
		meta.Files++
		meta.Bytes += int64(len(data))
		if meta.Files > cacheMaxFiles || meta.Bytes > cacheMaxBytes {
			return meta, fmt.Errorf("Projeto maior que o limite de cache (256 MiB / 80.000 arquivos)")
		}
		seen[record.Path] = true
		target := filepath.Join(project, filepath.FromSlash(record.Path))
		if err = os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return meta, err
		}
		if err = os.WriteFile(target, data, 0600); err != nil {
			return meta, err
		}
	}
	if err := scanner.Err(); err != nil {
		return meta, fmt.Errorf("Registro de cache inválido ou maior que o limite: %w", err)
	}
	if !done {
		return meta, fmt.Errorf("Transferência incompleta: marcador final ausente")
	}
	return meta, nil
}

func (c *Cache) Touch(root string) {
	if filepath.Dir(filepath.Dir(root)) != filepath.Clean(c.Base) || filepath.Base(root) != "project" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	dir := filepath.Dir(root)
	meta, err := readMetadata(dir)
	if err == nil && time.Since(meta.LastUsed) > time.Minute {
		meta.LastUsed = time.Now()
		writeMetadata(dir, meta)
	}
}
func (c *Cache) Cleanup(days int, active []string) error {
	if days <= 0 {
		days = 7
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	entries, err := os.ReadDir(c.Base)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	keep := map[string]bool{}
	for _, root := range active {
		keep[filepath.Clean(root)] = true
	}
	for _, entry := range entries {
		if !entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
			continue
		}
		dir := filepath.Join(c.Base, entry.Name())
		if strings.HasPrefix(entry.Name(), ".stage-") {
			if info, err := entry.Info(); err == nil && time.Since(info.ModTime()) > time.Hour {
				os.RemoveAll(dir)
			}
			continue
		}
		if len(entry.Name()) != 64 {
			continue
		}
		if _, err := hex.DecodeString(entry.Name()); err != nil {
			continue
		}
		if keep[filepath.Join(dir, "project")] {
			continue
		}
		meta, err := readMetadata(dir)
		if err != nil {
			continue
		}
		if time.Since(meta.LastUsed) > time.Duration(days)*24*time.Hour {
			if err = os.RemoveAll(dir); err != nil {
				return err
			}
		}
	}
	return nil
}
