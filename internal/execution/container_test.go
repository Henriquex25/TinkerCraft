package execution

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDetectContainerProjectBelowMount(t *testing.T) {
	engine, p, _ := fixture(t)
	containerRoot := t.TempDir()
	project := filepath.Join(containerRoot, "shop")
	os.Mkdir(project, 0700)
	os.WriteFile(filepath.Join(project, "composer.json"), []byte("{}"), 0600)
	info := ContainerInfo{}
	info.Config.WorkingDir = "/"
	info.Mounts = []Mount{{Type: "volume", Destination: containerRoot}}
	metadata, _ := json.Marshal(info)
	bin := t.TempDir()
	script := `#!/usr/bin/env python3
import os,sys
a=sys.argv[1:]
if a[0]=='inspect': print(os.environ['TINKERCRAFT_DETECT_INSPECT'])
else:
 assert a[:3]==['exec','-i','php-test'];os.execvp(a[3],a[3:])
`
	os.WriteFile(filepath.Join(bin, "docker"), []byte(script), 0700)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("TINKERCRAFT_DETECT_INSPECT", string(metadata))
	p.Mode = "docker"
	p.Container = "php-test"
	p.ProjectPath = ""
	dir, err := engine.ContainerWorkdir(context.Background(), p, p.Container)
	if err != nil || dir != project {
		t.Fatalf("got %q, %v; want %q", dir, err, project)
	}
}
