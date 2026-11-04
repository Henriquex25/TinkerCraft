package language

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"tinkercraft/internal/core"
	phpruntime "tinkercraft/runtime"
)

func TestBasicIndexUnderstandsProjectClasses(t *testing.T) {
	root := t.TempDir()
	runtimeDir, err := phpruntime.Materialize(filepath.Join(root, "runtime"))
	if err != nil {
		t.Fatal(err)
	}
	project := filepath.Join(root, "project")
	os.MkdirAll(filepath.Join(project, "app"), 0700)
	os.WriteFile(filepath.Join(project, "app/User.php"), []byte("<?php namespace App; class Base { public function inherited(): string { return ''; } } class User extends Base { public string $email; public function greet(string $name): string { return $name; } private function secret() {} }"), 0600)
	index, err := BuildIndex(context.Background(), "php", runtimeDir, project)
	if err != nil {
		t.Fatal(err)
	}
	if index.Files != 1 {
		t.Fatalf("files %d", index.Files)
	}
	code := "$user = new \\App\\User;\n$user->"
	response := index.Complete(code, 1, 7)
	data, _ := json.Marshal(response)
	text := string(data)
	for _, want := range []string{"greet", "inherited", "email"} {
		if !strings.Contains(text, `"label":"`+want+`"`) {
			t.Fatalf("missing %s in %s", want, text)
		}
	}
	if strings.Contains(text, `"label":"secret"`) {
		t.Fatal("private member suggested")
	}
	response = index.Complete("str", 0, 3)
	data, _ = json.Marshal(response)
	if !strings.Contains(string(data), `"label":"strlen"`) {
		t.Fatal("PHP builtins not indexed")
	}
}

// A protocol fixture tests framing, server requests, diagnostics and UTF-16 offsets
// without making claims about the availability of a real Phpactor installation.
const fakeServer = `<?php
function send($value) { $json = json_encode($value); fwrite(STDOUT, 'Content-Length: '.strlen($json)."\r\n\r\n".$json); fflush(STDOUT); }
$configured=false;
while (!feof(STDIN)) {
 $size=0;
 while (($line=fgets(STDIN))!==false) { if (trim($line)==='') break; if (stripos($line,'Content-Length:')===0) $size=(int)trim(substr($line,15)); }
 if (!$size) break;
 $body=''; while (strlen($body)<$size) { $chunk=fread(STDIN,$size-strlen($body)); if ($chunk===false||$chunk==='') break 2; $body.=$chunk; }
 $m=json_decode($body,true);
 if (($m['id']??null)==='config') { $configured=true; continue; }
 switch($m['method']??'') {
 case 'initialize':
 send(['jsonrpc'=>'2.0','id'=>'config','method'=>'workspace/configuration','params'=>['items'=>[['section'=>'phpactor']]]]);
 send(['jsonrpc'=>'2.0','id'=>$m['id'],'result'=>['capabilities'=>['completionProvider'=>['resolveProvider'=>true]]]]); break;
 case 'textDocument/didOpen': send(['jsonrpc'=>'2.0','method'=>'textDocument/publishDiagnostics','params'=>['uri'=>$m['params']['textDocument']['uri'],'diagnostics'=>[]]]);break;
 case 'textDocument/completion':
 send(['jsonrpc'=>'2.0','id'=>$m['id'],'result'=>['items'=>[['label'=>$configured?'método':'missing-config','kind'=>2,'textEdit'=>['range'=>['start'=>$m['params']['position'],'end'=>$m['params']['position']],'newText'=>'método']]]]]);break;
 case 'textDocument/hover':send(['jsonrpc'=>'2.0','id'=>$m['id'],'result'=>['contents'=>['kind'=>'markdown','value'=>'Olá 🌿']]]);break;
 }
}
`

func TestLSPFramingRequestsAndLineOffsets(t *testing.T) {
	root := t.TempDir()
	server := filepath.Join(root, "server.php")
	os.WriteFile(server, []byte(fakeServer), 0600)
	manager := NewManager(root)
	defer manager.Close()
	diagnostics := make(chan struct{}, 1)
	manager.OnDiagnostics = func(string, json.RawMessage) {
		select {
		case diagnostics <- struct{}{}:
		default:
		}
	}
	status, err := manager.Start("tab", root, "$a->", core.Settings{PHPBinary: "php", PhpactorPath: server})
	if err != nil || status.Mode != "phpactor" {
		t.Fatalf("%+v %v", status, err)
	}
	result, err := manager.Request("tab", "textDocument/completion", "$a->", 0, 4)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(result)
	if !strings.Contains(string(data), "método") || !strings.Contains(string(data), `"line":0`) {
		t.Fatal(string(data))
	}
	result, err = manager.Request("tab", "textDocument/hover", "// 🌿\n$a->", 1, 4)
	data, _ = json.Marshal(result)
	if err != nil || !strings.Contains(string(data), "Olá 🌿") {
		t.Fatalf("%s %v", data, err)
	}
	select {
	case <-diagnostics:
	case <-time.After(time.Second):
		t.Fatal("diagnostics not delivered")
	}
	manager.Stop("tab")
	if err := manager.Change("tab", "new"); err != nil {
		t.Fatal(err)
	}
}

func TestRealPhpactorCompletionHoverAndSignature(t *testing.T) {
	server := os.Getenv("TINKERCRAFT_PHPACTOR_REAL")
	if server == "" {
		t.Skip("Defina TINKERCRAFT_PHPACTOR_REAL para testar o servidor real")
	}
	root := t.TempDir()
	manager := NewManager(root)
	defer manager.Close()
	code := "<?php\n$date = new \\DateTimeImmutable();\n$date->"
	status, err := manager.Start("real", root, code, core.Settings{PHPBinary: "php", PhpactorPath: server})
	if err != nil || status.Mode != "phpactor" {
		t.Fatalf("%+v %v", status, err)
	}
	deadline := time.Now().Add(15 * time.Second)
	for {
		result, e := manager.Request("real", "textDocument/completion", code, 2, 7)
		data, _ := json.Marshal(result)
		if e == nil && strings.Contains(string(data), `"label":"format"`) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("completion: %s %v", data, e)
		}
		time.Sleep(200 * time.Millisecond)
	}
	result, err := manager.Request("real", "textDocument/hover", "<?php\n$date = new \\DateTimeImmutable();\n$date->format('Y-m-d');", 2, 9)
	data, _ := json.Marshal(result)
	if err != nil || !strings.Contains(string(data), "format") {
		t.Fatalf("hover: %s %v", data, err)
	}
	result, err = manager.Request("real", "textDocument/signatureHelp", "<?php\n$date = new \\DateTimeImmutable();\n$date->format(", 2, 14)
	data, _ = json.Marshal(result)
	if err != nil || !strings.Contains(string(data), "signatures") {
		t.Fatalf("signature: %s %v", data, err)
	}
	t.Log("Real Phpactor: method completion, hover and signature help passed")
}
