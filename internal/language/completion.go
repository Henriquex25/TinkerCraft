package language

import (
	"regexp"
	"sort"
	"strings"
	"unicode/utf16"
)

var qualifiedNameRE = regexp.MustCompile(`[\\A-Za-z_][\\A-Za-z0-9_]*$`)

func (i *Index) namespaceCompletions(code string, line, character int) (map[string]any, bool) {
	lines := strings.Split(code, "\n")
	if line < 0 || line >= len(lines) {
		return nil, false
	}
	prefix := utf16Prefix(lines[line], character)
	found := qualifiedNameRE.FindStringIndex(prefix)
	if found == nil {
		return nil, false
	}
	typed := prefix[found[0]:found[1]]
	if !strings.Contains(typed, "\\") {
		return nil, false
	}
	leading := ""
	if strings.HasPrefix(typed, "\\") {
		leading = "\\"
	}
	name := strings.TrimPrefix(typed, "\\")
	parent := ""
	if cut := strings.LastIndex(name, "\\"); cut >= 0 {
		parent = name[:cut+1]
	}
	choices := map[string]bool{}
	for _, class := range i.Classes {
		if !strings.HasPrefix(strings.ToLower(class.Name), strings.ToLower(parent)) {
			continue
		}
		rest := class.Name[len(parent):]
		candidate := class.Name
		namespace := false
		if cut := strings.Index(rest, "\\"); cut >= 0 {
			candidate = class.Name[:len(parent)+cut+1]
			namespace = true
		}
		if strings.HasPrefix(strings.ToLower(candidate), strings.ToLower(name)) {
			choices[candidate] = namespace
		}
	}
	names := make([]string, 0, len(choices))
	for name := range choices {
		names = append(names, name)
	}
	sort.Strings(names)
	items := []map[string]any{}
	for _, name := range names {
		kind := 7
		if choices[name] {
			kind = 9
		}
		text := leading + name
		items = append(items, map[string]any{"label": name, "kind": kind, "filterText": text, "detail": strings.TrimSuffix(name, "\\"), "textEdit": map[string]any{"newText": text, "range": map[string]any{"start": map[string]any{"line": line, "character": len(utf16.Encode([]rune(prefix[:found[0]])))}, "end": map[string]any{"line": line, "character": character}}}})
	}
	return map[string]any{"items": items, "isIncomplete": false}, true
}

func completionItems(value any) []any {
	if object, ok := value.(map[string]any); ok {
		value = object["items"]
	}
	switch items := value.(type) {
	case []any:
		return items
	case []map[string]any:
		result := make([]any, 0, len(items))
		for _, item := range items {
			result = append(result, item)
		}
		return result
	}
	return nil
}
func mergeCompletions(server, extra any) any {
	items := completionItems(server)
	seen := map[string]bool{}
	label := func(value any) string {
		object, _ := value.(map[string]any)
		text, _ := object["label"].(string)
		return text
	}
	for _, item := range items {
		seen[label(item)] = true
	}
	for _, item := range completionItems(extra) {
		if !seen[label(item)] {
			items = append(items, item)
			seen[label(item)] = true
		}
	}
	if result, ok := server.(map[string]any); ok {
		result["items"] = items
		return result
	}
	return map[string]any{"items": items, "isIncomplete": false}
}
