package core

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

type SSH struct {
	Host         string `json:"host"`
	User         string `json:"user"`
	Port         int    `json:"port"`
	IdentityFile string `json:"identityFile"`
}

type Profile struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Mode          string `json:"mode"`
	ProjectPath   string `json:"projectPath"`
	LocalPath     string `json:"localPath"`
	Autocomplete  string `json:"autocomplete"`
	PHPBinary     string `json:"phpBinary"`
	Container     string `json:"container"`
	SSH           SSH    `json:"ssh"`
	Bootstrap     string `json:"bootstrap"`
	BootstrapFile string `json:"bootstrapFile"`
	Timeout       int    `json:"timeout"`
}

func (p Profile) Remote() bool { return p.Mode == "ssh" || p.Mode == "ssh-docker" }
func (p Profile) Docker() bool { return p.Mode == "docker" || p.Mode == "ssh-docker" }
func (p Profile) IndexPath() string {
	if p.LocalPath != "" {
		return p.LocalPath
	}
	if p.Mode == "local" {
		return p.ProjectPath
	}
	return ""
}

func (p Profile) AutocompleteMode() string {
	if p.Autocomplete != "" {
		return p.Autocomplete
	}
	if p.LocalPath != "" {
		return "local"
	}
	return "auto"
}

var hostPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._:-]*$`)
var userPattern = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$`)
var containerPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

func (p Profile) Validate() error {
	if mode := p.AutocompleteMode(); mode != "auto" && mode != "local" && mode != "off" {
		return errors.New("Modo de autocomplete inválido")
	}
	if len(p.ID) > 100 || len(p.Name) > 200 {
		return errors.New("Perfil muito longo")
	}
	switch p.Mode {
	case "local", "docker", "ssh", "ssh-docker":
	default:
		return errors.New("Tipo de execução inválido")
	}
	if strings.TrimSpace(p.ProjectPath) == "" || !filepath.IsAbs(p.ProjectPath) || strings.ContainsAny(p.ProjectPath, "\x00\r\n") {
		return errors.New("Informe um caminho absoluto para o projeto no ambiente de execução")
	}
	if p.LocalPath != "" && !filepath.IsAbs(p.LocalPath) {
		return errors.New("A cópia local deve usar um caminho absoluto")
	}
	if p.PHPBinary == "" || strings.HasPrefix(p.PHPBinary, "-") || strings.ContainsAny(p.PHPBinary, "\x00\r\n") {
		return errors.New("Informe o executável PHP (por exemplo, php ou /usr/bin/php)")
	}
	if p.Remote() {
		if !hostPattern.MatchString(p.SSH.Host) {
			return errors.New("Host SSH inválido; use um hostname, IP ou alias de ~/.ssh/config")
		}
		if p.SSH.User != "" && !userPattern.MatchString(p.SSH.User) {
			return errors.New("Usuário SSH inválido")
		}
		if p.SSH.Port < 0 || p.SSH.Port > 65535 {
			return errors.New("Porta SSH inválida")
		}
		if strings.ContainsAny(p.SSH.IdentityFile, "\x00\r\n") {
			return errors.New("Caminho da chave SSH inválido")
		}
	}
	if p.Docker() && !containerPattern.MatchString(p.Container) {
		return errors.New("Selecione um container em execução")
	}
	switch p.Bootstrap {
	case "auto", "none", "composer", "laravel", "custom":
	default:
		return errors.New("Bootstrap inválido")
	}
	if p.Bootstrap == "custom" && p.BootstrapFile == "" {
		return errors.New("Informe o arquivo de bootstrap")
	}
	if p.Timeout < 1 || p.Timeout > 300 {
		return fmt.Errorf("O timeout deve ficar entre 1 e 300 segundos")
	}
	return nil
}

type Settings struct {
	Formatting              *FormattingRules  `json:"formatting,omitempty"`
	DonationPromptDismissed bool              `json:"donationPromptDismissed,omitempty"`
	StarPromptDismissed     bool              `json:"starPromptDismissed,omitempty"`
	Language                string            `json:"language"`
	CheckUpdatesOnStartup   *bool             `json:"checkUpdatesOnStartup,omitempty"`
	Shortcuts               map[string]string `json:"shortcuts,omitempty"`
	CacheDays               int               `json:"cacheDays"`
	PHPBinary               string            `json:"phpBinary"`
}

type FormattingRules struct {
	TabWidth         int    `json:"tabWidth"`
	PrintWidth       int    `json:"printWidth"`
	UseTabs          bool   `json:"useTabs"`
	SingleQuote      bool   `json:"singleQuote"`
	TrailingCommaPHP bool   `json:"trailingCommaPHP"`
	BraceStyle       string `json:"braceStyle"`
}
type Tab struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	ProfileID string `json:"profileId"`
}
type History struct {
	ID          string  `json:"id"`
	ProfileID   string  `json:"profileId"`
	ProfileName string  `json:"profileName"`
	Code        string  `json:"code"`
	CreatedAt   string  `json:"createdAt"`
	Success     bool    `json:"success"`
	DurationMS  float64 `json:"durationMs"`
}
type State struct {
	LaunchCount int       `json:"launchCount,omitempty"`
	Version     int       `json:"version"`
	Profiles    []Profile `json:"profiles"`
	Settings    Settings  `json:"settings"`
	Tabs        []Tab     `json:"tabs"`
	ActiveTab   string    `json:"activeTab"`
	History     []History `json:"history"`
}

type BootstrapState struct {
	State
	SuggestSupport bool `json:"suggestSupport"`
}

type Node struct {
	Type      string  `json:"type"`
	Class     string  `json:"class,omitempty"`
	Value     any     `json:"value,omitempty"`
	Children  []Entry `json:"children,omitempty"`
	Count     int     `json:"count,omitempty"`
	Truncated bool    `json:"truncated,omitempty"`
	List      bool    `json:"list,omitempty"`
}
type Entry struct {
	Key   string `json:"key"`
	Value Node   `json:"value"`
}
type Failure struct {
	Class   string `json:"class"`
	Message string `json:"message"`
	File    string `json:"file"`
	Line    int    `json:"line"`
	Trace   string `json:"trace"`
}
type Result struct {
	HaltedByDump bool     `json:"haltedByDump"`
	Success      bool     `json:"success"`
	Value        *Node    `json:"value"`
	Dumps        []Node   `json:"dumps"`
	Stdout       string   `json:"stdout"`
	Stderr       string   `json:"stderr"`
	Warnings     []string `json:"warnings"`
	Error        *Failure `json:"error"`
	DurationMS   float64  `json:"durationMs"`
	MemoryBytes  int64    `json:"memoryBytes"`
	Framework    string   `json:"framework"`
	PHPVersion   string   `json:"phpVersion"`
	Truncated    bool     `json:"truncated"`
	Cancelled    bool     `json:"cancelled"`
}
