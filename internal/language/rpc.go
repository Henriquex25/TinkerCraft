package language

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// RPC is a Content-Length framed JSON-RPC client for stdio language servers.
type RPC struct {
	cmd          *exec.Cmd
	writer       io.WriteCloser
	writeMu      sync.Mutex
	mu           sync.Mutex
	pending      map[int64]chan response
	next         atomic.Int64
	done         chan struct{}
	closeOnce    sync.Once
	notification func(string, json.RawMessage)
}
type response struct {
	result json.RawMessage
	err    error
}

func StartRPC(ctx context.Context, php, server, root string, notification func(string, json.RawMessage), cacheHome ...string) (*RPC, error) {
	cmd := exec.CommandContext(ctx, php, server, "language-server")
	cmd.Dir = root
	if len(cacheHome) > 0 && cacheHome[0] != "" {
		cmd.Env = append(os.Environ(), "XDG_CACHE_HOME="+cacheHome[0])
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	cmd.WaitDelay = time.Second
	in, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	out, err := cmd.StdoutPipe()
	if err != nil {
		in.Close()
		return nil, err
	}
	// stderr must always drain: servers can log heavily during indexing.
	cmd.Stderr = io.Discard
	if err := cmd.Start(); err != nil {
		in.Close()
		return nil, err
	}
	rpc := &RPC{cmd: cmd, writer: in, pending: map[int64]chan response{}, done: make(chan struct{}), notification: notification}
	go rpc.read(out)
	return rpc, nil
}
func (r *RPC) send(value any) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	r.writeMu.Lock()
	defer r.writeMu.Unlock()
	_, err = fmt.Fprintf(r.writer, "Content-Length: %d\r\n\r\n", len(payload))
	if err != nil {
		return err
	}
	_, err = r.writer.Write(payload)
	return err
}
func (r *RPC) Notify(method string, params any) error {
	return r.send(map[string]any{"jsonrpc": "2.0", "method": method, "params": params})
}
func (r *RPC) Call(ctx context.Context, method string, params any) (json.RawMessage, error) {
	id := r.next.Add(1)
	ch := make(chan response, 1)
	r.mu.Lock()
	r.pending[id] = ch
	r.mu.Unlock()
	defer func() { r.mu.Lock(); delete(r.pending, id); r.mu.Unlock() }()
	if err := r.send(map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params}); err != nil {
		return nil, err
	}
	select {
	case value := <-ch:
		return value.result, value.err
	case <-ctx.Done():
		r.Notify("$/cancelRequest", map[string]any{"id": id})
		return nil, ctx.Err()
	case <-r.done:
		return nil, errors.New("O servidor de linguagem encerrou")
	}
}
func (r *RPC) read(reader io.Reader) {
	defer r.cmd.Wait()
	defer close(r.done)
	buffer := bufio.NewReader(reader)
	for {
		size := -1
		for {
			line, err := buffer.ReadString('\n')
			if err != nil {
				return
			}
			line = strings.TrimSpace(line)
			if line == "" {
				break
			}
			if key, val, ok := strings.Cut(line, ":"); ok && strings.EqualFold(key, "Content-Length") {
				size, _ = strconv.Atoi(strings.TrimSpace(val))
			}
		}
		if size < 0 || size > 16*1024*1024 {
			return
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(buffer, payload); err != nil {
			return
		}
		var msg struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
			Result json.RawMessage `json:"result"`
			Error  *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(payload, &msg) != nil {
			continue
		}
		if msg.Method != "" {
			if len(msg.ID) > 0 {
				// Respond to server requests instead of deadlocking initialization.
				var result any
				if msg.Method == "workspace/configuration" {
					var p struct {
						Items []any `json:"items"`
					}
					json.Unmarshal(msg.Params, &p)
					items := make([]any, len(p.Items))
					for i := range items {
						items[i] = map[string]any{}
					}
					result = items
				}
				if msg.Method == "workspace/applyEdit" {
					result = map[string]any{"applied": false, "failureReason": "Edição não solicitada pelo usuário"}
				}
				r.send(map[string]any{"jsonrpc": "2.0", "id": msg.ID, "result": result})
			} else if r.notification != nil {
				r.notification(msg.Method, msg.Params)
			}
			continue
		}
		var id int64
		if json.Unmarshal(msg.ID, &id) != nil {
			continue
		}
		r.mu.Lock()
		ch := r.pending[id]
		r.mu.Unlock()
		if ch != nil {
			value := response{result: msg.Result}
			if msg.Error != nil {
				value.err = fmt.Errorf("LSP %d: %s", msg.Error.Code, msg.Error.Message)
			}
			select {
			case ch <- value:
			default:
			}
		}
	}
}
func (r *RPC) Close() {
	r.closeOnce.Do(func() {
		r.writer.Close()
		if r.cmd.Process != nil {
			syscall.Kill(-r.cmd.Process.Pid, syscall.SIGKILL)
		}
	})
}
