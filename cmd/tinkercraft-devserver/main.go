// Authenticated loopback harness for UI development and end-to-end tests.
// It is not used by the packaged desktop app and never binds a public interface.
package main

import (
	"crypto/subtle"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"reflect"
	"strings"
	"syscall"
	"time"
	"tinkercraft/internal/execution"
	"tinkercraft/internal/service"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:47831", "Loopback address")
	assets := flag.String("assets", "frontend/dist", "Built frontend")
	data := flag.String("data", ".data/devserver", "Isolated workspace")
	flag.Parse()
	host, _, err := net.SplitHostPort(*addr)
	if err != nil || net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback() {
		log.Fatal("Use um IP de loopback explícito")
	}
	abs, err := filepath.Abs(*data)
	if err != nil {
		log.Fatal(err)
	}
	svc, err := service.New(abs)
	if err != nil {
		log.Fatal(err)
	}
	defer svc.Close()
	token := execution.ID() + execution.ID()
	if override := os.Getenv("TINKERCRAFT_TEST_TOKEN"); override != "" {
		token = override
	}
	allowed := map[string]bool{}
	for _, name := range []string{"Bootstrap", "SaveProfile", "DeleteProfile", "SaveWorkspace", "SaveSettings", "Execute", "Cancel", "TestConnection", "ListContainers", "ContainerWorkdir", "StartLanguage", "RefreshLanguage", "StopLanguage", "ChangeLanguage", "LanguageRequest", "ResolveCompletion", "ClearHistory", "Health", "BuildInfo", "CheckUpdates", "DownloadUpdate"} {
		allowed[name] = true
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		fail := func(status int, message string) {
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(map[string]any{"error": message})
		}
		if r.Method != "POST" {
			fail(405, "POST obrigatório")
			return
		}
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("X-TinkerCraft-Token")), []byte(token)) != 1 {
			fail(401, "Token inválido")
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			parsed, e := url.Parse(origin)
			if e != nil || parsed.Host != r.Host {
				fail(403, "Origem inválida")
				return
			}
		}
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			fail(415, "JSON obrigatório")
			return
		}
		var request struct {
			Method string            `json:"method"`
			Args   []json.RawMessage `json:"args"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024*1024)).Decode(&request); err != nil {
			fail(400, "JSON inválido")
			return
		}
		if !allowed[request.Method] {
			fail(404, "Método indisponível")
			return
		}
		method := reflect.ValueOf(svc).MethodByName(request.Method)
		kind := method.Type()
		if kind.NumIn() != len(request.Args) {
			fail(400, "Argumentos inválidos")
			return
		}
		args := make([]reflect.Value, len(request.Args))
		for i, raw := range request.Args {
			arg := reflect.New(kind.In(i))
			if err := json.Unmarshal(raw, arg.Interface()); err != nil {
				fail(400, err.Error())
				return
			}
			args[i] = arg.Elem()
		}
		result := method.Call(args)
		var value any
		for _, v := range result {
			if v.Type().Implements(reflect.TypeOf((*error)(nil)).Elem()) {
				if !v.IsNil() {
					fail(422, v.Interface().(error).Error())
					return
				}
			} else {
				value = v.Interface()
			}
		}
		json.NewEncoder(w).Encode(map[string]any{"result": value})
	})
	mux.Handle("/", http.FileServer(http.Dir(*assets)))
	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second}
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)
	go func() { <-signalCh; svc.Close(); server.Close() }()
	fmt.Printf("TinkerCraft dev: http://%s/#devToken=%s\n", listener.Addr().String(), token)
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
