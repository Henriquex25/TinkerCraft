package main

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"reflect"
	"tinkercraft/internal/service"
)

func apiHandler(svc *service.Service, token string) http.Handler {
	allowed := map[string]bool{}
	for _, name := range []string{"Bootstrap", "SaveProfile", "DeleteProfile", "SaveWorkspace", "SaveSettings", "Execute", "Cancel", "TestConnection", "ListContainers", "ContainerWorkdir", "StartLanguage", "RefreshLanguage", "StopLanguage", "ChangeLanguage", "LanguageRequest", "ResolveCompletion", "ClearHistory", "Health", "BuildInfo", "CheckUpdates", "DownloadUpdate"} {
		allowed[name] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
			if e != nil || parsed.Scheme != "http" || parsed.Host != r.Host || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
				fail(403, "Origem inválida")
				return
			}
		}
		mediaType, _, mediaErr := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if mediaErr != nil || mediaType != "application/json" {
			fail(415, "JSON obrigatório")
			return
		}
		var request struct {
			Method string            `json:"method"`
			Args   []json.RawMessage `json:"args"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024*1024))
		if err := decoder.Decode(&request); err != nil {
			fail(400, "JSON inválido")
			return
		}
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			fail(400, "Envie apenas um objeto JSON")
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
}

func loopbackOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.Host)
		ip := net.ParseIP(host)
		if err != nil || ip == nil || !ip.IsLoopback() {
			http.Error(w, "Host de loopback obrigatório", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
