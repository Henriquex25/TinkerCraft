package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"tinkercraft/internal/service"
)

func TestDevelopmentAPITrustBoundary(t *testing.T) {
	svc, err := service.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Close()
	handler := loopbackOnly(apiHandler(svc, "private-test-token"))
	valid := `{"method":"Bootstrap","args":[]}`
	cases := []struct {
		name, method, host, token, origin, contentType, body string
		status                                               int
	}{
		{"valid", "POST", "127.0.0.1:47831", "private-test-token", "http://127.0.0.1:47831", "application/json", valid, 200},
		{"missing token", "POST", "127.0.0.1:47831", "", "", "application/json", valid, 401},
		{"wrong token", "POST", "127.0.0.1:47831", "wrong", "", "application/json", valid, 401},
		{"cross origin", "POST", "127.0.0.1:47831", "private-test-token", "https://evil.example", "application/json", valid, 403},
		{"DNS rebinding host", "POST", "evil.example:47831", "private-test-token", "http://evil.example:47831", "application/json", valid, 403},
		{"method", "GET", "127.0.0.1:47831", "private-test-token", "", "application/json", valid, 405},
		{"media type", "POST", "127.0.0.1:47831", "private-test-token", "", "text/plain", valid, 415},
		{"media type prefix", "POST", "127.0.0.1:47831", "private-test-token", "", "application/json-invalid", valid, 415},
		{"installer excluded", "POST", "127.0.0.1:47831", "private-test-token", "", "application/json", `{"method":"OpenUpdateInstaller","args":[]}`, 404},
		{"unknown method", "POST", "127.0.0.1:47831", "private-test-token", "", "application/json", `{"method":"DoesNotExist","args":[]}`, 404},
		{"invalid args", "POST", "127.0.0.1:47831", "private-test-token", "", "application/json", `{"method":"SaveSettings","args":[42]}`, 400},
		{"trailing JSON", "POST", "127.0.0.1:47831", "private-test-token", "", "application/json", valid + `{}`, 400},
		{"oversized", "POST", "127.0.0.1:47831", "private-test-token", "", "application/json", `{"method":"` + strings.Repeat("x", 8*1024*1024) + `"}`, 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			request := httptest.NewRequest(c.method, "http://"+c.host+"/api", strings.NewReader(c.body))
			request.Header.Set("X-TinkerCraft-Token", c.token)
			request.Header.Set("Content-Type", c.contentType)
			if c.origin != "" {
				request.Header.Set("Origin", c.origin)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != c.status {
				t.Fatalf("status %d, expected %d", response.Code, c.status)
			}
			if response.Code == http.StatusOK && response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("sensitive response is cacheable")
			}
		})
	}
}
