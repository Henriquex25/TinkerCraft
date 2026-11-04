package updates

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var versionPattern = regexp.MustCompile(`^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$`)

func parseVersion(value string) ([3]uint64, []string, error) {
	var result [3]uint64
	m := versionPattern.FindStringSubmatch(value)
	if m == nil {
		return result, nil, fmt.Errorf("Versão inválida: %s", value)
	}
	for i := range result {
		n, e := strconv.ParseUint(m[i+1], 10, 64)
		if e != nil {
			return result, nil, e
		}
		result[i] = n
	}
	var pre []string
	if m[4] != "" {
		pre = strings.Split(m[4], ".")
		for _, part := range pre {
			if part == "" {
				return result, nil, fmt.Errorf("Pré-release inválido")
			}
			if _, err := strconv.ParseUint(part, 10, 64); err == nil && len(part) > 1 && part[0] == '0' {
				return result, nil, fmt.Errorf("Pré-release numérico inválido")
			}
		}
	}
	return result, pre, nil
}
func CompareVersions(a, b string) (int, error) {
	x, xp, e := parseVersion(a)
	if e != nil {
		return 0, e
	}
	y, yp, e := parseVersion(b)
	if e != nil {
		return 0, e
	}
	for i := range x {
		if x[i] < y[i] {
			return -1, nil
		}
		if x[i] > y[i] {
			return 1, nil
		}
	}
	if len(xp) == 0 && len(yp) == 0 {
		return 0, nil
	}
	if len(xp) == 0 {
		return 1, nil
	}
	if len(yp) == 0 {
		return -1, nil
	}
	for i := 0; i < len(xp) && i < len(yp); i++ {
		if xp[i] == yp[i] {
			continue
		}
		xn, xe := strconv.ParseUint(xp[i], 10, 64)
		yn, ye := strconv.ParseUint(yp[i], 10, 64)
		if xe == nil && ye == nil {
			if xn < yn {
				return -1, nil
			}
			return 1, nil
		}
		if xe == nil {
			return -1, nil
		}
		if ye == nil {
			return 1, nil
		}
		if xp[i] < yp[i] {
			return -1, nil
		}
		return 1, nil
	}
	if len(xp) < len(yp) {
		return -1, nil
	}
	if len(xp) > len(yp) {
		return 1, nil
	}
	return 0, nil
}
