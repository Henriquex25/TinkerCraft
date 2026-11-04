package language

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func prepareAnalysisAutoload(root, home string) error {
	type autoload struct {
		PSR4 map[string]json.RawMessage `json:"psr-4"`
		PSR0 map[string]json.RawMessage `json:"psr-0"`
	}
	type manifest struct {
		Autoload autoload `json:"autoload"`
		Dev      autoload `json:"autoload-dev"`
	}
	psr4, psr0 := map[string][]string{}, map[string][]string{}
	add := func(target map[string][]string, entries map[string]json.RawMessage, base string) {
		for prefix, raw := range entries {
			if len(prefix) > 1024 || strings.ContainsAny(prefix, "\x00\r\n") {
				continue
			}
			var values []string
			var single string
			if json.Unmarshal(raw, &single) == nil {
				values = []string{single}
			} else if json.Unmarshal(raw, &values) != nil {
				continue
			}
			for _, value := range values {
				if strings.ContainsAny(value, "\x00\r\n") || filepath.IsAbs(value) {
					continue
				}
				dir := filepath.Clean(filepath.Join(base, filepath.FromSlash(value)))
				rel, err := filepath.Rel(root, dir)
				if err != nil || !filepath.IsLocal(rel) {
					continue
				}
				info, err := os.Stat(dir)
				if err != nil || !info.IsDir() {
					continue
				}
				target[prefix] = append(target[prefix], dir)
			}
		}
	}
	read := func(base string, dev bool) {
		file := filepath.Join(base, "composer.json")
		info, err := os.Stat(file)
		if err != nil || info.Size() > 4*1024*1024 {
			return
		}
		data, err := os.ReadFile(file)
		if err != nil {
			return
		}
		var m manifest
		if json.Unmarshal(data, &m) != nil {
			return
		}
		add(psr4, m.Autoload.PSR4, base)
		add(psr0, m.Autoload.PSR0, base)
		if dev {
			add(psr4, m.Dev.PSR4, base)
			add(psr0, m.Dev.PSR0, base)
		}
	}
	read(root, true)
	vendor := filepath.Join(root, "vendor")
	vendors, _ := os.ReadDir(vendor)
	for _, v := range vendors {
		if !v.IsDir() || v.Type()&os.ModeSymlink != 0 || strings.HasPrefix(v.Name(), ".") {
			continue
		}
		packages, _ := os.ReadDir(filepath.Join(vendor, v.Name()))
		for _, p := range packages {
			if p.IsDir() && p.Type()&os.ModeSymlink == 0 {
				read(filepath.Join(vendor, v.Name(), p.Name()), false)
			}
		}
	}
	dir := filepath.Join(home, "composer")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	for name, entries := range map[string]map[string][]string{"autoload_psr4.php": psr4, "autoload_namespaces.php": psr0} {
		for key, values := range entries {
			sort.Strings(values)
			entries[key] = values
		}
		data, err := json.Marshal(entries)
		if err != nil {
			return err
		}
		source := fmt.Sprintf("<?php\nreturn json_decode(base64_decode('%s'), true, 512, JSON_THROW_ON_ERROR);\n", base64.StdEncoding.EncodeToString(data))
		if err = os.WriteFile(filepath.Join(dir, name), []byte(source), 0600); err != nil {
			return err
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "autoload_classmap.php"), []byte("<?php return [];\n"), 0600); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(home, "autoload.php"), []byte("<?php return null;\n"), 0600)
}
