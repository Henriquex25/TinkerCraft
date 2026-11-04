package execution

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"tinkercraft/internal/core"
)

type Mount struct {
	Type        string `json:"Type"`
	Source      string `json:"Source"`
	Destination string `json:"Destination"`
}
type ContainerInfo struct {
	Config struct {
		WorkingDir string `json:"WorkingDir"`
	} `json:"Config"`
	Mounts []Mount `json:"Mounts"`
}

func (e *Engine) InspectContainer(ctx context.Context, p core.Profile, container string) (ContainerInfo, error) {
	var info ContainerInfo
	check := p
	check.Container = container
	check.Mode = "docker"
	if p.Remote() {
		check.Mode = "ssh-docker"
	}
	if check.ProjectPath == "" {
		check.ProjectPath = "/"
	}
	if err := check.Validate(); err != nil {
		return info, err
	}
	spec, err := DockerCommand(check, "inspect", "--format", "{{json .}}", container)
	if err != nil {
		return info, err
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	r, err := Run(ctx, spec, nil, 1048576)
	if err != nil {
		return info, err
	}
	if r.ExitCode != 0 {
		return info, fmt.Errorf("Docker: %s", strings.TrimSpace(r.Stderr))
	}
	if err = json.Unmarshal([]byte(r.Stdout), &info); err != nil {
		return info, fmt.Errorf("Não foi possível ler os detalhes do container: %w", err)
	}
	return info, nil
}

const detectDirectoryPHP = `$input=json_decode(stream_get_contents(STDIN),true);$checked=[];
$isProject=static fn($p)=>is_file($p.'/composer.json')||is_file($p.'/artisan');
foreach($input['candidates'] as $candidate){
 if(!$candidate||$candidate==='/')continue;$candidate=rtrim($candidate,'/');
 $parent=$candidate;for($i=0;$i<3&&$parent!=='/';$i++,$parent=dirname($parent)){if($isProject($parent)){echo realpath($parent);exit;}}
 $queue=[[$candidate,0]];
 while($queue&&count($checked)<250){[$p,$depth]=array_shift($queue);if(isset($checked[$p])||!is_dir($p))continue;$checked[$p]=true;
 if($isProject($p)){echo realpath($p);exit;}if($depth>=2)continue;
 foreach(@scandir($p)?:[] as $name){if(str_starts_with($name,'.')||in_array($name,['vendor','node_modules','storage','proc','sys','dev'],true))continue;$child=$p.'/'.$name;if(!is_link($child)&&is_dir($child))$queue[]=[$child,$depth+1];}}
}
foreach($input['fallbacks'] as $p){if($p&&$p!=='/'&&is_dir($p)){echo realpath($p);exit;}}
fwrite(STDERR,'Não foi possível localizar o projeto automaticamente. Informe o diretório manualmente.');exit(2);`

func (e *Engine) ContainerWorkdir(ctx context.Context, p core.Profile, container string) (string, error) {
	info, err := e.InspectContainer(ctx, p, container)
	if err != nil {
		return "", err
	}
	candidates := []string{info.Config.WorkingDir, p.ProjectPath}
	for _, mount := range info.Mounts {
		candidates = append(candidates, mount.Destination)
	}
	candidates = append(candidates, "/var/www/html", "/var/www", "/app", "/srv/app", "/workspace", "/usr/src/app", "/code", "/opt/app")
	payload, _ := json.Marshal(map[string]any{"candidates": candidates, "fallbacks": []string{info.Config.WorkingDir, p.ProjectPath}})
	spec, err := DockerCommand(p, "exec", "-i", container, p.PHPBinary, "-r", detectDirectoryPHP)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	r, err := Run(ctx, spec, payload, 65536)
	if err != nil {
		return "", err
	}
	if r.ExitCode != 0 {
		return "", fmt.Errorf("%s", strings.TrimSpace(r.Stderr))
	}
	dir := strings.TrimSpace(r.Stdout)
	if !filepath.IsAbs(dir) {
		return "", fmt.Errorf("O container não informou um diretório válido")
	}
	return dir, nil
}

func (e *Engine) LocalMount(ctx context.Context, p core.Profile) (string, error) {
	if p.Mode != "docker" {
		return "", nil
	}
	info, err := e.InspectContainer(ctx, p, p.Container)
	if err != nil {
		return "", err
	}
	sort.SliceStable(info.Mounts, func(i, j int) bool { return len(info.Mounts[i].Destination) > len(info.Mounts[j].Destination) })
	for _, mount := range info.Mounts {
		dest := strings.TrimRight(mount.Destination, "/")
		if dest == "" {
			dest = "/"
		}
		if mount.Type != "bind" || !filepath.IsAbs(mount.Source) {
			continue
		}
		rel, err := filepath.Rel(dest, p.ProjectPath)
		if err != nil || !filepath.IsLocal(rel) {
			continue
		}
		local := filepath.Join(mount.Source, rel)
		if stat, err := os.Stat(local); err == nil && stat.IsDir() {
			return local, nil
		}
	}
	return "", nil
}
