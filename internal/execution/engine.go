package execution

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"
	"tinkercraft/internal/core"
	phpruntime "tinkercraft/runtime"
)

type Engine struct{ RuntimeDir string }

func ID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(bytes[:])
}
func failure(class, message string) core.Result {
	return core.Result{Success: false, Error: &core.Failure{Class: class, Message: message}, Dumps: []core.Node{}, Warnings: []string{}}
}

func (e *Engine) Execute(ctx context.Context, p core.Profile, settings core.Settings, code string) core.Result {
	if err := p.Validate(); err != nil {
		return failure("ConfigurationError", err.Error())
	}
	if len(code) > 1048576 {
		return failure("InputLimit", "O trecho ultrapassa 1 MiB")
	}
	started := time.Now()
	compileCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	input, _ := json.Marshal(map[string]any{"code": code})
	php := settings.PHPBinary
	if php == "" {
		php = "php"
	}
	compiled, err := Run(compileCtx, Command{Binary: php, Args: []string{filepath.Join(e.RuntimeDir, "compile.php")}}, input, 4*1024*1024)
	if ctx.Err() != nil {
		result := failure("ExecutionError", "Execução cancelada")
		result.Cancelled = true
		result.DurationMS = float64(time.Since(started).Milliseconds())
		return result
	}
	if err != nil {
		return failure("CompilerError", fmt.Sprintf("Não foi possível analisar o código com o PHP local (%s): %v", php, err))
	}
	var ast struct {
		Code  string        `json:"code"`
		Error *core.Failure `json:"error"`
	}
	if err := json.Unmarshal([]byte(compiled.Stdout), &ast); err != nil {
		return failure("CompilerError", strings.TrimSpace(compiled.Stderr+compiled.Stdout))
	}
	if ast.Error != nil {
		return core.Result{Success: false, Error: ast.Error, Dumps: []core.Node{}, Warnings: []string{}}
	}
	marker := "__TINKERCRAFT_" + ID() + "__"
	payload, _ := json.Marshal(map[string]any{"code": ast.Code, "marker": marker, "projectPath": p.ProjectPath, "bootstrap": p.Bootstrap, "bootstrapFile": p.BootstrapFile, "timeout": p.Timeout})
	spec, err := PHPCommand(p, phpruntime.Runner())
	if err != nil {
		return failure("ConfigurationError", err.Error())
	}
	runCtx, stop := context.WithTimeout(ctx, time.Duration(p.Timeout)*time.Second)
	defer stop()
	output, err := Run(runCtx, spec, payload, 8*1024*1024)
	if err != nil {
		result := failure("ExecutionError", err.Error())
		result.Stderr = output.Stderr
		result.Stdout = output.Stdout
		result.DurationMS = float64(time.Since(started).Milliseconds())
		if ctx.Err() != nil {
			result.Cancelled = true
			result.Error.Message = "Execução cancelada"
		} else if runCtx.Err() != nil {
			result.Error.Class = "Timeout"
			result.Error.Message = fmt.Sprintf("A execução excedeu %d segundos", p.Timeout)
		}
		return result
	}
	result, err := Decode(output.Stdout, marker)
	if err != nil {
		result = failure("TransportError", fmt.Sprintf("O PHP não retornou uma resposta válida (saída %d). %s", output.ExitCode, strings.TrimSpace(output.Stderr)))
		result.Stdout = output.Stdout
	}
	result.Stderr = output.Stderr
	result.Truncated = result.Truncated || output.Truncated
	if output.ExitCode != 0 && result.Success && !(output.ExitCode == 1 && result.HaltedByDump) {
		result.Success = false
		result.Error = &core.Failure{Class: "ProcessExit", Message: fmt.Sprintf("O PHP encerrou com código %d", output.ExitCode)}
	}
	return result
}

func Decode(stdout, marker string) (core.Result, error) {
	start := strings.LastIndex(stdout, marker)
	if start < 0 {
		return core.Result{}, fmt.Errorf("Marcador ausente")
	}
	rest := stdout[start+len(marker):]
	end := strings.IndexByte(rest, '\n')
	if end >= 0 {
		rest = rest[:end]
	}
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(rest))
	if err != nil {
		return core.Result{}, err
	}
	var result core.Result
	if err = json.Unmarshal(data, &result); err != nil {
		return result, err
	}
	outside := strings.TrimSpace(stdout[:start])
	if outside != "" {
		result.Stdout = outside + "\n" + result.Stdout
	}
	if result.Dumps == nil {
		result.Dumps = []core.Node{}
	}
	if result.Warnings == nil {
		result.Warnings = []string{}
	}
	return result, nil
}

type Container struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	Workdir string `json:"workdir"`
}

func (e *Engine) Containers(ctx context.Context, p core.Profile) ([]Container, error) {
	spec, err := DockerCommand(p, "ps", "--format", "{{json .}}")
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	result, err := Run(ctx, spec, nil, 1048576)
	if err != nil {
		return nil, err
	}
	if result.ExitCode != 0 {
		return nil, fmt.Errorf("Docker: %s", strings.TrimSpace(result.Stderr))
	}
	containers := []Container{}
	for _, line := range strings.Split(strings.TrimSpace(result.Stdout), "\n") {
		var row struct{ ID, Names, Image string }
		if json.Unmarshal([]byte(line), &row) == nil {
			containers = append(containers, Container{ID: row.ID, Name: row.Names, Image: row.Image})
		}
	}
	return containers, nil
}
