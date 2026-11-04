package language

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"tinkercraft/internal/core"
	"tinkercraft/internal/execution"
)

type Status struct {
	Warning   string `json:"warning,omitempty"`
	Source    string `json:"source,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
	Mode      string `json:"mode"`
	Message   string `json:"message"`
	Files     int    `json:"files"`
	Root      string `json:"root"`
}

func (m *Manager) Roots() []string {
	m.mu.Lock()
	sessions := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	m.mu.Unlock()
	roots := []string{}
	for _, s := range sessions {
		s.mu.Lock()
		roots = append(roots, s.status.Root)
		s.mu.Unlock()
	}
	return roots
}
func (m *Manager) Root(id string) string {
	s := m.get(id)
	if s == nil {
		return ""
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status.Root
}

type Session struct {
	mu           sync.Mutex
	rpc          *RPC
	index        *Index
	uri          string
	code         string
	version      int
	prefix       int
	cancel       context.CancelFunc
	status       Status
	capabilities map[string]any
}
type Manager struct {
	mu            sync.Mutex
	sessions      map[string]*Session
	RuntimeDir    string
	OnDiagnostics func(string, json.RawMessage)
}

func NewManager(dir string) *Manager {
	return &Manager{sessions: map[string]*Session{}, RuntimeDir: dir}
}
func fileURI(path string) string { return (&url.URL{Scheme: "file", Path: path}).String() }
func source(code string) (string, int) {
	if strings.HasPrefix(strings.TrimSpace(code), "<?php") {
		return code, 0
	}
	return "<?php\n" + code, 1
}

func (m *Manager) Start(id, root, code string, settings core.Settings) (Status, error) {
	return m.start(id, root, code, settings, "")
}
func (m *Manager) StartCached(id, root, code string, settings core.Settings) (Status, error) {
	home := filepath.Join(filepath.Dir(root), "analysis")
	if err := os.MkdirAll(home, 0700); err != nil {
		return Status{}, err
	}
	if err := prepareAnalysisAutoload(root, home); err != nil {
		return Status{}, err
	}
	return m.start(id, root, code, settings, home)
}
func (m *Manager) start(id, root, code string, settings core.Settings, cacheHome string) (Status, error) {
	m.Stop(id)
	if root == "" {
		return Status{Mode: "none", Message: "Selecione uma cópia local para o autocomplete"}, nil
	}
	if !filepath.IsAbs(root) {
		return Status{}, fmt.Errorf("O diretório local precisa ser absoluto")
	}
	if stat, err := os.Stat(root); err != nil || !stat.IsDir() {
		return Status{}, fmt.Errorf("Cópia local não encontrada: %s", root)
	}
	ctx, cancel := context.WithCancel(context.Background())
	s := &Session{cancel: cancel, uri: fileURI(filepath.Join(root, ".tinkercraft-scratch-"+execution.ID()+".php")), version: 1, status: Status{Root: root}, capabilities: map[string]any{}}
	s.code, s.prefix = source(code)
	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()
	php := settings.PHPBinary
	if php == "" {
		php = "php"
	}
	server := settings.PhpactorPath
	if server == "" {
		server, _ = exec.LookPath("phpactor")
	}
	var serverError error
	if server != "" {
		rpc, err := StartRPC(ctx, php, server, root, func(method string, params json.RawMessage) {
			if method == "textDocument/publishDiagnostics" && m.OnDiagnostics != nil {
				var info struct {
					URI string `json:"uri"`
				}
				json.Unmarshal(params, &info)
				if info.URI == s.uri {
					m.OnDiagnostics(id, params)
				}
			}
		}, cacheHome)
		if err == nil {
			options := map[string]any{"language_server.enable_trust_check": false}

			if cacheHome != "" {
				options["composer.enable"] = true
				options["composer.class_maps_only"] = true
				options["composer.autoloader_path"] = filepath.Join(cacheHome, "autoload.php")
			}
			initCtx, stop := context.WithTimeout(ctx, 20*time.Second)
			response, initializeErr := rpc.Call(initCtx, "initialize", map[string]any{"processId": os.Getpid(), "rootUri": fileURI(root), "rootPath": root, "workspaceFolders": []any{map[string]any{"uri": fileURI(root), "name": filepath.Base(root)}}, "capabilities": map[string]any{"general": map[string]any{"positionEncodings": []string{"utf-16"}}, "textDocument": map[string]any{"completion": map[string]any{"completionItem": map[string]any{"snippetSupport": true, "documentationFormat": []string{"markdown", "plaintext"}, "resolveSupport": map[string]any{"properties": []string{"documentation", "detail", "additionalTextEdits"}}}}, "hover": map[string]any{"contentFormat": []string{"markdown", "plaintext"}}, "publishDiagnostics": map[string]any{"relatedInformation": false}}, "workspace": map[string]any{"configuration": true, "workspaceFolders": true}}, "initializationOptions": options})
			stop()
			if initializeErr == nil {
				var initialized struct {
					Capabilities map[string]any `json:"capabilities"`
				}
				json.Unmarshal(response, &initialized)
				rpc.Notify("initialized", map[string]any{})
				s.mu.Lock()
				s.capabilities = initialized.Capabilities
				s.rpc = rpc
				rpc.Notify("textDocument/didOpen", map[string]any{"textDocument": map[string]any{"uri": s.uri, "languageId": "php", "version": s.version, "text": s.code}})
				s.status = Status{Mode: "phpactor", Message: "Phpactor conectado", Root: root}
				status := s.status
				s.mu.Unlock()
				return status, nil
			}
			rpc.Close()
			serverError = initializeErr
		} else {
			serverError = err
		}
	}
	index, err := BuildIndex(ctx, php, m.RuntimeDir, root)
	if err != nil {
		cancel()
		m.remove(id, s)
		return Status{}, fmt.Errorf("Falha ao indexar o projeto: %w", err)
	}
	message := "Autocomplete básico · configure Phpactor para inferência avançada"
	if serverError != nil {
		message = "Phpactor indisponível: " + serverError.Error() + " · usando indexador básico"
	}
	if index.Limited {
		message += " · limite de 2.000 arquivos"
	}
	s.mu.Lock()
	s.index = index
	s.status = Status{Mode: "basic", Message: message, Files: index.Files, Root: root}
	status := s.status
	s.mu.Unlock()
	return status, nil
}
func (m *Manager) remove(id string, s *Session) {
	m.mu.Lock()
	if m.sessions[id] == s {
		delete(m.sessions, id)
	}
	m.mu.Unlock()
}
func (m *Manager) get(id string) *Session { m.mu.Lock(); defer m.mu.Unlock(); return m.sessions[id] }
func (m *Manager) Stop(id string) {
	m.mu.Lock()
	s := m.sessions[id]
	delete(m.sessions, id)
	m.mu.Unlock()
	if s != nil {
		s.cancel()
		s.mu.Lock()
		if s.rpc != nil {
			s.rpc.Close()
		}
		s.mu.Unlock()
	}
}
func (m *Manager) Close() {
	m.mu.Lock()
	ids := []string{}
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()
	for _, id := range ids {
		m.Stop(id)
	}
}
func (s *Session) sync(code string) error {
	code, prefix := source(code)
	s.prefix = prefix
	if code == s.code {
		return nil
	}
	s.code = code
	s.version++
	if s.rpc != nil {
		return s.rpc.Notify("textDocument/didChange", map[string]any{"textDocument": map[string]any{"uri": s.uri, "version": s.version}, "contentChanges": []any{map[string]any{"text": s.code}}})
	}
	return nil
}
func (m *Manager) Change(id, code string) error {
	if len(code) > 1048576 {
		return fmt.Errorf("Trecho muito grande")
	}
	s := m.get(id)
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.sync(code)
}
func (m *Manager) Request(id, method, code string, line, character int) (any, error) {
	if len(code) > 1048576 || line < 0 || character < 0 {
		return nil, fmt.Errorf("Posição ou trecho inválido")
	}
	switch method {
	case "textDocument/completion", "textDocument/hover", "textDocument/signatureHelp":
	default:
		return nil, fmt.Errorf("Método não permitido")
	}
	s := m.get(id)
	if s == nil {
		return nil, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.sync(code); err != nil {
		return nil, err
	}
	if s.rpc == nil {
		if s.index != nil && method == "textDocument/completion" {
			return s.index.Complete(code, line, character), nil
		}
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	response, err := s.rpc.Call(ctx, method, map[string]any{"textDocument": map[string]any{"uri": s.uri}, "position": map[string]any{"line": line + s.prefix, "character": character}, "context": map[string]any{"triggerKind": 1}})
	if err != nil {
		return nil, err
	}
	var result any
	if len(response) == 0 {
		return nil, nil
	}
	err = json.Unmarshal(response, &result)

	if s.prefix > 0 {
		shiftRanges(result, -s.prefix)
	}
	return result, err
}
func shiftRanges(value any, offset int) {
	switch x := value.(type) {
	case map[string]any:
		if line, ok := x["line"].(float64); ok {
			if _, ok := x["character"]; ok {
				x["line"] = max(0, line+float64(offset))
			}
		}
		for key, child := range x {
			if key == "data" {
				continue
			}
			shiftRanges(child, offset)
		}
	case []any:
		for _, child := range x {
			shiftRanges(child, offset)
		}
	}
}
func (m *Manager) Resolve(id string, item json.RawMessage) (any, error) {
	s := m.get(id)
	if s == nil {
		return nil, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.rpc == nil {
		return nil, nil
	}
	var data any
	if json.Unmarshal(item, &data) != nil {
		return nil, fmt.Errorf("Item inválido")
	}
	if s.prefix > 0 {
		shiftRanges(data, s.prefix)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	raw, err := s.rpc.Call(ctx, "completionItem/resolve", data)
	if err != nil {
		return nil, err
	}
	var result any
	err = json.Unmarshal(raw, &result)
	if s.prefix > 0 {
		shiftRanges(result, -s.prefix)
	}
	return result, err
}
