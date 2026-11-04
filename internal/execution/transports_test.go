package execution

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"tinkercraft/internal/core"
)

func TestSimulatedTransportsUseRealPHPRunner(t *testing.T) {
	engine, p, s := fixture(t)
	bin := t.TempDir()
	docker := `#!/usr/bin/env python3
import os,sys,json
a=sys.argv[1:]
if a[0]=='ps': print(json.dumps({'ID':'abc123','Names':'php-test','Image':'php:8.4-cli'}))
elif a[0]=='inspect': print(json.dumps({'Config':{'WorkingDir':os.environ['TINKERCRAFT_FIXTURE_PROJECT']},'Mounts':[]}))
else:
 assert a[:2]==['exec','-i']
 a=a[2:]
 if a[0]=='--workdir':
  os.chdir(a[1]);a=a[2:]
 else: os.chdir(os.environ['TINKERCRAFT_FIXTURE_PROJECT'])
 assert a[0]=='php-test'
 os.execvp(a[1],a[1:])
`
	ssh := `#!/usr/bin/env python3
import os,sys
assert 'BatchMode=yes' in sys.argv and 'StrictHostKeyChecking=yes' in sys.argv
os.execvp('sh',['sh','-c',sys.argv[-1]])
`
	os.WriteFile(filepath.Join(bin, "docker"), []byte(docker), 0700)
	os.WriteFile(filepath.Join(bin, "ssh"), []byte(ssh), 0700)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("TINKERCRAFT_FIXTURE_PROJECT", p.ProjectPath)
	for _, mode := range []string{"docker", "ssh", "ssh-docker"} {
		t.Run(mode, func(t *testing.T) {
			profile := p
			profile.Mode = mode
			profile.Container = "php-test"
			profile.SSH = core.SSH{Host: "fixture-host", User: "fixture-user", Port: 2222}
			result := engine.Execute(context.Background(), profile, s, "['cwd' => getcwd(), 'sum' => 2 + 3];")
			if !result.Success || result.Value == nil || len(result.Value.Children) != 2 || result.Value.Children[0].Value.Value != p.ProjectPath || result.Value.Children[1].Value.Value != float64(5) {
				t.Fatalf("%+v", result)
			}
			if profile.Docker() {
				containers, err := engine.Containers(context.Background(), profile)
				if err != nil || len(containers) != 1 || containers[0].Name != "php-test" {
					t.Fatalf("%+v %v", containers, err)
				}
				dir, err := engine.ContainerWorkdir(context.Background(), profile, "php-test")
				if err != nil || dir != p.ProjectPath {
					t.Fatalf("%s %v", dir, err)
				}
			}
		})
	}
}
