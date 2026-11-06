package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"os"
	"tinkercraft/internal/buildinfo"
	"tinkercraft/internal/service"
	"tinkercraft/internal/storage"
	"tinkercraft/internal/updates"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon-small.png
var appIcon []byte

//go:embed VERSION
var appVersion string

func main() {
	if err := buildinfo.SetVersion(appVersion); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if len(os.Args) > 1 && os.Args[1] == "--version" {
		fmt.Println(buildinfo.Version)
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "--version-json" {
		json.NewEncoder(os.Stdout).Encode(buildinfo.Current())
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "--relaunch-after-update" {
		if err := updates.RelaunchAfterUpdate(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}

	dir, err := storage.WorkspaceDirectory()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	svc, err := service.New(dir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer svc.Close()
	app := &App{svc: svc, installer: updates.NewInstaller(buildinfo.Current())}
	windowTitle := "TinkerCraft · PHP workspace"
	if svc.Store.Snapshot().Settings.Language == "pt-BR" {
		windowTitle = "TinkerCraft · Workspace PHP"
	}
	err = wails.Run(&options.App{Title: windowTitle, Width: 1440, Height: 920, MinWidth: 1000, MinHeight: 660, BackgroundColour: options.NewRGB(20, 20, 20), AssetServer: &assetserver.Options{Assets: assets}, OnStartup: app.startup, OnBeforeClose: app.beforeClose, OnShutdown: app.shutdown, Bind: []interface{}{app}, Linux: &linux.Options{Icon: appIcon, ProgramName: "tinkercraft", WebviewGpuPolicy: linux.WebviewGpuPolicyOnDemand}})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
