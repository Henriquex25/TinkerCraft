package language

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const eloquentModel = "Illuminate\\Database\\Eloquent\\Model"
const eloquentBuilder = "Illuminate\\Database\\Eloquent\\Builder"
const queryBuilder = "Illuminate\\Database\\Query\\Builder"

func privateWrite(path string, data []byte) error {
	if current, err := readAnalysisFile(path, int64(len(data))); err == nil && bytes.Equal(current, data) {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".analysis-")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err = file.Write(data); err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(file.Name(), path)
}

func analysisFingerprint(ctx context.Context, root, php string, paths []string) (string, error) {
	paths = append([]string{}, paths...)
	sort.Strings(paths)
	hash := sha256.New()
	fmt.Fprintln(hash, "laravel-analysis-1", root, php)
	var total int64
	for _, path := range paths {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		info, err := os.Lstat(path)
		if err != nil || !info.Mode().IsRegular() || info.Size() > 1048576 {
			continue
		}
		total += info.Size()
		if total > 256*1024*1024 {
			return "", fmt.Errorf("Analysis sources exceed 256 MiB")
		}
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		fmt.Fprintln(hash, path, info.Size())
		_, err = io.Copy(hash, io.LimitReader(file, 1048577))
		file.Close()
		if err != nil {
			return "", err
		}
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func prepareProjectAnalysis(ctx context.Context, php, runtimeDir, root, home string) (*Index, error) {
	paths := indexPaths(root)
	fingerprint, err := analysisFingerprint(ctx, root, php, paths)
	if err != nil {
		return nil, err
	}
	script, err := readAnalysisFile(filepath.Join(runtimeDir, "index.php"), 1024*1024)
	if err != nil {
		return nil, err
	}
	versioned := sha256.Sum256(append([]byte(fingerprint), script...))
	fingerprint = hex.EncodeToString(versioned[:])
	var cached struct {
		Fingerprint string `json:"fingerprint"`
		Index       *Index `json:"index"`
	}
	data, err := readAnalysisFile(filepath.Join(home, "symbols.json"), 32*1024*1024)
	if err == nil && len(data) <= 32*1024*1024 {
		json.Unmarshal(data, &cached)
	}
	index := cached.Index
	if index == nil || cached.Fingerprint != fingerprint {
		index, err = buildIndexFiles(ctx, php, runtimeDir, paths)
		if err != nil {
			return nil, err
		}
		cached.Fingerprint = fingerprint
		cached.Index = index
		data, err = json.Marshal(cached)
		if err != nil {
			return nil, err
		}
		if err = privateWrite(filepath.Join(home, "symbols.json"), data); err != nil {
			return nil, err
		}
	}
	if err = prepareAnalysisAutoload(root, home); err != nil {
		return nil, err
	}
	maps, err := index.prepareLaravelHelpers(root, home)
	if err != nil {
		return nil, err
	}
	return index, writePHPMap(filepath.Join(home, "composer", "autoload_classmap.php"), maps)
}

func readAnalysisFile(path string, limit int64) ([]byte, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > limit {
		return nil, fmt.Errorf("Invalid or oversized analysis file")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("Analysis file exceeds limit")
	}
	return data, err
}

func writePHPMap(path string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return privateWrite(path, []byte("<?php\nreturn json_decode(base64_decode('"+encodePHPData(data)+"'), true, 512, JSON_THROW_ON_ERROR);\n"))
}
func encodePHPData(data []byte) string { return base64.StdEncoding.EncodeToString(data) }

var phpTypeToken = regexp.MustCompile(`\$this|[\\A-Za-z_][\\A-Za-z0-9_-]*`)
var docReturn = regexp.MustCompile(`@return\s+([^\s*]+)`)
var phpClassName = regexp.MustCompile(`^[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*(\\[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)*$`)

func qualifiedType(value string, class *Class, model bool) string {
	return phpTypeToken.ReplaceAllStringFunc(value, func(token string) string {
		switch strings.ToLower(token) {
		case "$this", "self", "static":
			if model {
				return "\\" + eloquentBuilder + "<static>"
			}
			return "$this"
		case "tmodel":
			if model {
				return "static"
			}
			return token
		case "void", "never", "mixed", "null", "bool", "boolean", "true", "false", "int", "integer", "float", "double", "string", "array", "list", "iterable", "object", "callable", "resource", "numeric", "scalar", "array-key", "class-string", "positive-int", "non-empty-array", "non-empty-list":
			return token
		}
		if strings.HasPrefix(token, "\\") {
			return token
		}
		if strings.Contains(token, "\\") {
			return "\\" + token
		}
		if name, ok := class.Imports[token]; ok {
			return "\\" + name
		}
		if strings.HasPrefix(token, "T") && len(token) > 1 && token[1] >= 'A' && token[1] <= 'Z' {
			return "mixed"
		}
		if token == "Closure" {
			return "\\Closure"
		}
		namespace := ""
		if cut := strings.LastIndex(class.Name, "\\"); cut >= 0 {
			namespace = class.Name[:cut+1]
		}
		return "\\" + namespace + token
	})
}
func methodReturn(method Method, class *Class, model bool) string {
	value := method.ReturnType
	if match := docReturn.FindStringSubmatch(method.Documentation); len(match) > 0 {
		value = match[1]
	}
	if value == "" {
		return "mixed"
	}
	return qualifiedType(value, class, model)
}
func methodParameters(method Method, class *Class) string {
	params := make([]string, 0, len(method.Parameters))
	for _, param := range method.Parameters {
		if cut := strings.Index(param, "$"); cut > 0 {
			param = qualifiedType(param[:cut], class, false) + param[cut:]
		}
		params = append(params, strings.ReplaceAll(strings.ReplaceAll(param, "\n", " "), "*/", "* /"))
	}
	return strings.Join(params, ", ")
}
func (i *Index) inherits(class *Class, parent string, seen map[string]bool) bool {
	if class == nil || seen[class.Name] {
		return false
	}
	if class.Name == parent {
		return true
	}
	seen[class.Name] = true
	return i.inherits(i.find(class.Extends), parent, seen)
}
func helperFile(path string) bool { return strings.HasPrefix(filepath.Base(path), "_ide_helper") }
func docTags(doc string) string {
	lines := []string{}
	for _, line := range strings.Split(doc, "\n") {
		line = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "*"))
		if strings.HasPrefix(line, "@") {
			lines = append(lines, " * "+strings.ReplaceAll(line, "*/", ""))
		}
	}
	return strings.Join(lines, "\n")
}
func (i *Index) prepareLaravelHelpers(root, home string) (map[string]string, error) {
	maps := map[string]string{}
	docs := map[string]string{}
	for _, class := range i.Classes {
		if helperFile(class.File) {
			docs[class.Name] += docTags(class.Documentation) + "\n"
			maps[class.Name] = class.File
		}
	}
	if i.find(eloquentModel) == nil {
		return maps, nil
	}
	type edit struct {
		start, end int
		doc        string
	}
	edits := map[string][]edit{}
	originals := map[string]string{}
	addDoc := func(class *Class, tags string) {
		if tags == "" || helperFile(class.File) {
			return
		}
		doc := strings.TrimSuffix(class.Documentation, "*/") + "\n" + tags + "\n */"
		if class.Documentation == "" {
			doc = "/**\n" + tags + "\n */\n"
		}
		start, end := class.Start, class.Start
		if class.DocStart >= 0 {
			start, end = class.DocStart, class.DocEnd+1
		}
		edits[class.File] = append(edits[class.File], edit{start, end, doc})
		originals[class.File] = class.SourceHash
	}
	virtuals := func(class *Class, source *Class, static bool) string {
		if class == nil || source == nil {
			return ""
		}
		tags := []string{}
		seen := map[string]bool{}
		for _, method := range class.Methods {
			seen[strings.ToLower(method.Name)] = true
		}
		for _, trait := range class.Traits {
			for _, method := range i.methods(i.find(trait), map[string]bool{}) {
				seen[strings.ToLower(method.Name)] = true
			}
		}
		for _, method := range i.methods(source, map[string]bool{}) {
			if seen[strings.ToLower(method.Name)] {
				continue
			}
			seen[strings.ToLower(method.Name)] = true
			if strings.HasPrefix(method.Name, "__") || (method.Visibility != "" && method.Visibility != "public") {
				continue
			}
			if strings.Contains(class.Documentation, " "+method.Name+"(") {
				continue
			}
			owner := i.findExact(method.Owner)
			if owner == nil {
				owner = source
			}
			if owner.Name == "Illuminate\\Database\\Concerns\\BuildsQueries" && static {
				method.Documentation = strings.ReplaceAll(method.Documentation, "TValue", "TModel")
			}
			returns := methodReturn(method, owner, static)
			prefix := ""
			if static {
				prefix = "static "
			}
			tags = append(tags, " * @method "+prefix+returns+" "+method.Name+"("+methodParameters(method, owner)+")")
			virtual := method
			virtual.Static = static
			virtual.ReturnType = returns
			virtual.Visibility = "public"
			class.Methods = append(class.Methods, virtual)
		}
		return strings.Join(tags, "\n")
	}
	model, builder, query := i.find(eloquentModel), i.find(eloquentBuilder), i.find(queryBuilder)
	builderTags := virtuals(builder, query, false)
	modelTags := virtuals(model, builder, true)
	if builder != nil {
		addDoc(builder, builderTags+"\n"+docs[builder.Name])
	}
	addDoc(model, modelTags+"\n"+docs[model.Name])
	aliases := map[string][]Class{}
	for n := range i.Classes {
		class := &i.Classes[n]
		if helperFile(class.File) || class.Name == eloquentModel || class.Name == eloquentBuilder {
			continue
		}
		tags := docs[class.Name]
		if i.inherits(class, eloquentModel, map[string]bool{}) {
			for _, method := range append([]Method{}, class.Methods...) {
				name := method.Name
				if strings.HasPrefix(name, "scope") && len(name) > 5 {
					name = strings.ToLower(name[5:6]) + name[6:]
				} else if !method.Scope {
					continue
				}
				params := method.Parameters
				if len(params) > 0 {
					params = params[1:]
				}
				method.Name = name
				method.Parameters = params
				method.Visibility = "public"
				method.Static = true
				method.ReturnType = "\\" + eloquentBuilder + "<static>"
				tags += "\n * @method static " + method.ReturnType + " " + name + "(" + methodParameters(method, class) + ")"
				class.Methods = append(class.Methods, method)
			}
		}
		addDoc(class, tags)
		rel, err := filepath.Rel(root, class.File)
		included := matchesAliasPrefix(class.Name, i.Aliases)
		allowed := err == nil && filepath.IsLocal(rel) && !strings.HasPrefix(filepath.ToSlash(rel), "vendor/") && !matchesAliasPrefix(class.Name, i.DontAlias)
		if (allowed || included) && strings.Contains(class.Name, "\\") && class.Kind == "Stmt_Class" && phpClassName.MatchString(class.Name) {
			aliases[strings.ToLower(class.Short)] = append(aliases[strings.ToLower(class.Short)], *class)
		}
	}
	for file, changes := range edits {
		data, err := os.ReadFile(file)
		if err != nil {
			return nil, err
		}
		hash := sha256.Sum256(data)
		if hex.EncodeToString(hash[:]) != originals[file] {
			return nil, fmt.Errorf("Project sources changed during analysis; refresh completion")
		}
		sort.Slice(changes, func(a, b int) bool { return changes[a].start > changes[b].start })
		for _, change := range changes {
			if change.start < 0 || change.end > len(data) || change.end < change.start {
				return nil, fmt.Errorf("Invalid helper source range")
			}
			data = append(append(append([]byte{}, data[:change.start]...), []byte(change.doc)...), data[change.end:]...)
		}
		digest := sha256.Sum256(data)
		dest := filepath.Join(home, "helpers", hex.EncodeToString(digest[:])+".php")
		if err = privateWrite(dest, data); err != nil {
			return nil, err
		}
		for _, class := range i.Classes {
			if class.File == file {
				maps[class.Name] = dest
			}
		}
	}
	lines := []string{"<?php"}
	createdAliases := []string{}
	for _, candidates := range aliases {
		if len(candidates) != 1 {
			continue
		}
		class := candidates[0]
		if i.findExact(class.Short) != nil {
			continue
		}
		lines = append(lines, "class "+class.Short+" extends \\"+class.Name+" {}")
		createdAliases = append(createdAliases, class.Short)
		alias := class
		alias.Name = class.Short
		alias.Extends = class.Name
		alias.Methods = nil
		alias.Properties = nil
		i.Classes = append(i.Classes, alias)
	}
	sort.Strings(lines[1:])
	path := filepath.Join(home, "helpers", "aliases.php")
	if err := privateWrite(path, []byte(strings.Join(lines, "\n")+"\n")); err != nil {
		return nil, err
	}
	for _, name := range createdAliases {
		maps[name] = path
	}
	return maps, nil
}

func matchesAliasPrefix(name string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if prefix != "" && strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}
func (i *Index) findExact(name string) *Class {
	for n := range i.Classes {
		if strings.EqualFold(i.Classes[n].Name, name) {
			return &i.Classes[n]
		}
	}
	return nil
}
