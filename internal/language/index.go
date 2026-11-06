package language

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"tinkercraft/internal/execution"
)

type Method struct {
	Owner         string   `json:"owner,omitempty"`
	Visibility    string   `json:"visibility,omitempty"`
	Scope         bool     `json:"scope,omitempty"`
	Name          string   `json:"name"`
	Detail        string   `json:"detail"`
	ReturnType    string   `json:"returnType"`
	Documentation string   `json:"documentation"`
	Parameters    []string `json:"parameters"`
	Static        bool     `json:"static"`
	Line          int      `json:"line"`
}
type Class struct {
	Documentation string            `json:"documentation"`
	DocStart      int               `json:"docStart"`
	DocEnd        int               `json:"docEnd"`
	Start         int               `json:"start"`
	SourceHash    string            `json:"sourceHash"`
	Imports       map[string]string `json:"imports"`
	Traits        []string          `json:"traits"`
	Kind          string            `json:"kind"`
	Name          string            `json:"name"`
	Short         string            `json:"short"`
	Extends       string            `json:"extends"`
	Methods       []Method          `json:"methods"`
	Properties    []struct {
		Name string `json:"name"`
		Type string `json:"type"`
	} `json:"properties"`
	File string `json:"file"`
	Line int    `json:"line"`
}
type Index struct {
	Aliases   []string `json:"aliases"`
	DontAlias []string `json:"dontAlias"`
	Classes   []Class  `json:"classes"`
	Functions []Method `json:"functions"`
	Files     int      `json:"files"`
	Limited   bool     `json:"limited"`
}

func BuildIndex(ctx context.Context, php, runtimeDir, root string) (*Index, error) {
	return buildIndexFiles(ctx, php, runtimeDir, indexPaths(root))
}

func indexPaths(root string) []string {
	paths := []string{}
	seen := map[string]bool{}
	add := func(path string) {
		if !seen[path] && len(paths) < 2000 && strings.HasSuffix(path, ".php") {
			seen[path] = true
			paths = append(paths, path)
		}
	}
	roots := []string{filepath.Join(root, "app"), filepath.Join(root, "src"), filepath.Join(root, "lib")}
	var composer struct {
		Autoload struct {
			PSR4  map[string]json.RawMessage `json:"psr-4"`
			Files []string                   `json:"files"`
		} `json:"autoload"`
	}
	if data, err := os.ReadFile(filepath.Join(root, "composer.json")); err == nil && json.Unmarshal(data, &composer) == nil {
		for _, raw := range composer.Autoload.PSR4 {
			var one string
			var many []string
			if json.Unmarshal(raw, &one) == nil {
				many = []string{one}
			} else {
				json.Unmarshal(raw, &many)
			}
			for _, dir := range many {
				candidate := filepath.Clean(filepath.Join(root, dir))
				rel, err := filepath.Rel(root, candidate)
				if err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
					roots = append(roots, candidate)
				}
			}
		}
		for _, file := range composer.Autoload.Files {
			candidate := filepath.Clean(filepath.Join(root, file))
			rel, err := filepath.Rel(root, candidate)
			if err == nil && !strings.HasPrefix(rel, "..") {
				add(candidate)
			}
		}
	}

	for _, base := range []string{"vendor/laravel/framework/src/Illuminate/Database", "vendor/laravel/framework/src/Illuminate/Foundation/Auth", "vendor/laravel/framework/src/Illuminate/Collections", "vendor/laravel/framework/src/Illuminate/Support/Facades", "vendor/illuminate/database", "vendor/illuminate/collections"} {
		roots = append(roots, filepath.Join(root, base))
	}
	for _, dir := range roots {
		filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if len(paths) >= 2000 {
				return fs.SkipAll
			}
			if d.IsDir() {
				switch d.Name() {
				case ".git", "node_modules", "vendor", "storage", "cache":
					if path != dir {
						return fs.SkipDir
					}
				}
				return nil
			}
			if d.Type()&os.ModeSymlink == 0 {
				add(path)
			}
			return nil
		})
	}
	for _, name := range []string{"_ide_helper.php", "_ide_helper_models.php", "config/tinker.php"} {
		if info, err := os.Lstat(filepath.Join(root, name)); err == nil && info.Mode().IsRegular() {
			add(filepath.Join(root, name))
		}
	}
	return paths
}

func buildIndexFiles(ctx context.Context, php, runtimeDir string, paths []string) (*Index, error) {
	input, _ := json.Marshal(map[string]any{"files": paths})
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	output, err := execution.Run(ctx, execution.Command{Binary: php, Args: []string{filepath.Join(runtimeDir, "index.php")}}, input, 16*1024*1024)
	if err != nil {
		return nil, err
	}
	var index Index
	if err = json.Unmarshal([]byte(output.Stdout), &index); err != nil {
		return nil, err
	}
	index.Limited = len(paths) >= 2000
	return &index, nil
}

func (i *Index) find(name string) *Class {
	name = strings.TrimLeft(name, "\\?")
	if exact := i.findExact(name); exact != nil {
		return exact
	}
	var found *Class
	for n := range i.Classes {
		c := &i.Classes[n]
		if strings.EqualFold(c.Short, name) {
			if found != nil && found.Name != c.Name {
				return nil
			}
			found = c
		}
	}
	return found
}
func (i *Index) methods(class *Class, seen map[string]bool) []Method {
	if class == nil || seen[class.Name] {
		return nil
	}
	seen[class.Name] = true
	items := append([]Method{}, class.Methods...)
	for _, trait := range class.Traits {
		items = append(items, i.methods(i.find(trait), seen)...)
	}
	parent := i.find(class.Extends)
	items = append(items, i.methods(parent, seen)...)
	if class.Extends == "Illuminate\\Database\\Eloquent\\Model" || class.Name == "Illuminate\\Database\\Eloquent\\Model" {
		items = append(items, i.methods(i.find("Illuminate\\Database\\Eloquent\\Builder"), seen)...)
		items = append(items, i.methods(i.find("Illuminate\\Database\\Query\\Builder"), seen)...)
	}
	return items
}

var memberRE = regexp.MustCompile(`([\\A-Za-z_][\\A-Za-z0-9_]*|\$[A-Za-z_][A-Za-z0-9_]*)(::|->)([A-Za-z0-9_]*)$`)
var variableRE = regexp.MustCompile(`\$[A-Za-z_][A-Za-z0-9_]*`)

func (i *Index) Complete(code string, line, character int) map[string]any {
	lines := strings.Split(code, "\n")
	if line < 0 || line >= len(lines) {
		return map[string]any{"items": []any{}}
	}
	prefix := strings.Join(lines[:line], "\n")
	current := utf16Prefix(lines[line], character)
	prefix += "\n" + current
	items := []map[string]any{}
	seen := map[string]bool{}
	add := func(label string, kind int, detail, insert, doc string) {
		if seen[label] {
			return
		}
		seen[label] = true
		items = append(items, map[string]any{"label": label, "kind": kind, "detail": detail, "insertText": insert, "documentation": doc})
	}
	if match := memberRE.FindStringSubmatch(prefix); len(match) > 0 {
		name := match[1]
		if strings.HasPrefix(name, "$") {
			re := regexp.MustCompile(regexp.QuoteMeta(name) + `\s*=\s*new\s+([\\A-Za-z_][\\A-Za-z0-9_]*)`)
			matches := re.FindAllStringSubmatch(prefix, -1)
			if len(matches) > 0 {
				name = matches[len(matches)-1][1]
			} else {
				re = regexp.MustCompile(`([\\A-Za-z_][\\A-Za-z0-9_]*)\s+` + regexp.QuoteMeta(name) + `\b`)
				matches = re.FindAllStringSubmatch(prefix, -1)
				if len(matches) > 0 {
					name = matches[len(matches)-1][1]
				}
			}
		}
		class := i.find(name)
		if class != nil {
			for _, method := range i.methods(class, map[string]bool{}) {
				if method.Visibility != "" && method.Visibility != "public" {
					continue
				}
				if match[2] == "::" && !method.Static {
					continue
				}
				add(method.Name, 2, method.Detail, method.Name, method.Documentation)
			}
			for _, prop := range class.Properties {
				if match[2] == "::" {
					continue
				}
				add(prop.Name, 10, prop.Type, prop.Name, "")
			}
		}
	} else {
		if result, ok := i.namespaceCompletions(code, line, character); ok {
			return result
		}
		for _, class := range i.Classes {
			add(class.Short, 7, class.Name, "\\"+class.Name, "")
		}
		for _, fn := range i.Functions {
			add(fn.Name, 3, fn.Detail, fn.Name, fn.Documentation)
		}
		for _, variable := range variableRE.FindAllString(prefix, -1) {
			add(strings.TrimPrefix(variable, "$"), 6, "Variável local", strings.TrimPrefix(variable, "$"), "")
		}
		for _, name := range []string{"app", "collect", "config", "env", "dump", "dd", "now", "resolve"} {
			add(name, 3, "Helper PHP/Laravel", name, "")
		}
	}
	sort.SliceStable(items, func(a, b int) bool { return items[a]["label"].(string) < items[b]["label"].(string) })
	return map[string]any{"isIncomplete": false, "items": items}
}
func utf16Prefix(s string, units int) string {
	count := 0
	for offset, r := range s {
		step := 1
		if r > 0xffff {
			step = 2
		}
		if count+step > units {
			return s[:offset]
		}
		count += step
	}
	return s
}
