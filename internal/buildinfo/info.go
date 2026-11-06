package buildinfo

import (
	"fmt"
	"regexp"
	"runtime"
	"strings"
)

var Version = "dev"
var ReleaseSource = "https://github.com/Henriquex25/TinkerCraft"
var Distribution = "source"
var Commit = "dev"
var BuildDate = ""

func SetVersion(value string) error {
	value = strings.TrimSpace(value)
	if len(value) > 64 || !regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`).MatchString(value) {
		return fmt.Errorf("VERSION must contain MAJOR.MINOR.PATCH without a v prefix")
	}
	Version = value
	return nil
}

type Info struct {
	Version       string `json:"version"`
	ReleaseSource string `json:"releaseSource"`
	Distribution  string `json:"distribution"`
	Platform      string `json:"platform"`
	Architecture  string `json:"architecture"`
	WebKit        string `json:"webkit"`
	Variant       string `json:"variant"`
	Commit        string `json:"commit"`
	BuildDate     string `json:"buildDate"`
}

func Current() Info {
	return Info{Version, ReleaseSource, Distribution, runtime.GOOS, runtime.GOARCH, WebKit, Variant(), Commit, BuildDate}
}
func Variant() string {
	return fmt.Sprintf("%s-%s-webkit%s", runtime.GOOS, runtime.GOARCH, strings.ReplaceAll(WebKit, ".", ""))
}
func AssetName(version string) string {
	return fmt.Sprintf("tinkercraft_%s_%s.deb", strings.TrimPrefix(version, "v"), strings.ReplaceAll(Variant(), "-", "_"))
}
