package execution

import (
	"fmt"
	"strconv"
	"strings"
	"tinkercraft/internal/core"
)

func Quote(value string) string { return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'" }
func ShellCommand(binary string, args []string) string {
	parts := []string{Quote(binary)}
	for _, arg := range args {
		parts = append(parts, Quote(arg))
	}
	return strings.Join(parts, " ")
}

func viaSSH(p core.Profile, binary string, args []string) Command {
	options := []string{"-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2"}
	if p.SSH.Port > 0 {
		options = append(options, "-p", strconv.Itoa(p.SSH.Port))
	}
	if p.SSH.IdentityFile != "" {
		options = append(options, "-i", p.SSH.IdentityFile)
	}
	if p.SSH.User != "" {
		options = append(options, "-l", p.SSH.User)
	}
	options = append(options, "--", p.SSH.Host, ShellCommand(binary, args))
	return Command{Binary: "ssh", Args: options}
}

func PHPCommand(p core.Profile, runner string) (Command, error) {
	if err := p.Validate(); err != nil {
		return Command{}, err
	}
	binary := p.PHPBinary
	args := []string{"-d", "display_errors=stderr", "-d", "log_errors=0", "-r", runner}
	if p.Docker() {
		args = append([]string{"exec", "-i", "--workdir", p.ProjectPath, p.Container, binary}, args...)
		binary = "docker"
	}
	if p.Remote() {
		return viaSSH(p, binary, args), nil
	}
	spec := Command{Binary: binary, Args: args}
	if p.Mode == "local" {
		spec.Dir = p.ProjectPath
	}
	return spec, nil
}

func DockerCommand(p core.Profile, args ...string) (Command, error) {
	if p.Remote() {
		check := p
		check.Mode = "ssh"
		if check.ProjectPath == "" {
			check.ProjectPath = "/"
		}
		if err := check.Validate(); err != nil {
			return Command{}, err
		}
		return viaSSH(p, "docker", args), nil
	}
	if p.Mode != "local" && p.Mode != "docker" {
		return Command{}, fmt.Errorf("Modo inválido")
	}
	return Command{Binary: "docker", Args: args}, nil
}
