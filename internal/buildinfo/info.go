package buildinfo

import (
	"fmt"
	"os"
	"runtime"
	"strings"
)

var Version = "0.2.0"
var ReleaseSource = ""
var Distribution = "source"
var Commit = "dev"
var BuildDate = ""

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
	source := ReleaseSource
	if override, ok := os.LookupEnv("TINKERCRAFT_RELEASE_SOURCE"); ok {
		source = override
	}
	return Info{Version, source, Distribution, runtime.GOOS, runtime.GOARCH, WebKit, Variant(), Commit, BuildDate}
}
func Variant() string {
	return fmt.Sprintf("%s-%s-webkit%s", runtime.GOOS, runtime.GOARCH, strings.ReplaceAll(WebKit, ".", ""))
}
func AssetName(version string) string {
	return fmt.Sprintf("tinkercraft_%s_%s.deb", strings.TrimPrefix(version, "v"), strings.ReplaceAll(Variant(), "-", "_"))
}
