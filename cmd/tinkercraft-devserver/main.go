package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
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
	mux := http.NewServeMux()
	mux.Handle("/api", apiHandler(svc, token))
	mux.Handle("/", http.FileServer(http.Dir(*assets)))
	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{Handler: loopbackOnly(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 * 1024}
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)
	go func() { <-signalCh; svc.Close(); server.Close() }()
	fmt.Printf("TinkerCraft dev: http://%s/#devToken=%s\n", listener.Addr().String(), token)
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
