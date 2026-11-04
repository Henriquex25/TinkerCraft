package execution

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

type Command struct {
	Binary string
	Args   []string
	Dir    string
}
type ProcessResult struct {
	Stdout    string
	Stderr    string
	ExitCode  int
	Truncated bool
}
type boundedBuffer struct {
	mu        sync.Mutex
	data      bytes.Buffer
	limit     int
	truncated bool
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	size := len(p)
	remaining := b.limit - b.data.Len()
	if size > remaining {
		b.truncated = true
		p = p[:max(0, remaining)]
	}
	b.data.Write(p)
	return size, nil
}
func (b *boundedBuffer) String() string { b.mu.Lock(); defer b.mu.Unlock(); return b.data.String() }

func Run(ctx context.Context, spec Command, input []byte, limit int) (ProcessResult, error) {
	out := &boundedBuffer{limit: limit}
	result, err := Stream(ctx, spec, input, out)
	result.Stdout = out.String()
	result.Truncated = result.Truncated || out.truncated
	return result, err
}

func Stream(ctx context.Context, spec Command, input []byte, stdout io.Writer) (ProcessResult, error) {
	cmd := exec.CommandContext(ctx, spec.Binary, spec.Args...)
	cmd.Dir = spec.Dir
	cmd.Stdin = bytes.NewReader(input)
	errout := &boundedBuffer{limit: 262144}
	cmd.Stdout = stdout
	cmd.Stderr = errout
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return os.ErrProcessDone
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	cmd.WaitDelay = time.Second
	err := cmd.Run()
	result := ProcessResult{Stderr: errout.String(), Truncated: errout.truncated}
	if cmd.ProcessState != nil {
		result.ExitCode = cmd.ProcessState.ExitCode()
	}
	if ctx.Err() != nil {
		return result, ctx.Err()
	}
	if err != nil {
		var exit *exec.ExitError
		if !errors.As(err, &exit) {
			return result, err
		}
	}
	return result, nil
}

var _ io.Writer = (*boundedBuffer)(nil)
