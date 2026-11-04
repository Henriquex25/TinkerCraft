package execution

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestRealLaravelBootstrapAndInspection(t *testing.T) {
	vendor := os.Getenv("TINKERCRAFT_LARAVEL_VENDOR")
	if vendor == "" {
		t.Skip("Defina TINKERCRAFT_LARAVEL_VENDOR para testar com dependências Laravel instaladas")
	}
	engine, p, s := fixture(t)
	builder, err := filepath.Abs("../../tests/fixtures/build-laravel.php")
	if err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command("php", builder, vendor, p.ProjectPath).CombinedOutput()
	if err != nil {
		t.Fatalf("isolated fixture: %v %s", err, out)
	}
	p.Bootstrap = "auto"
	r := engine.Execute(context.Background(), p, s, "dump(app()->version()); collect([['name' => 'Ana'], ['name' => 'Bruno']])->map(fn ($row) => ['name' => strtoupper($row['name'])]);")
	if !r.Success || len(r.Dumps) != 1 || r.Value == nil || len(r.Value.Children) != 2 || r.Value.Children[0].Value.Children[0].Value.Value != "ANA" {
		t.Fatalf("%+v", r)
	}
	t.Logf("Validated %s, PHP %s", r.Framework, r.PHPVersion)
	r = engine.Execute(context.Background(), p, s, "dd(['works' => true]);")
	if !r.Success || !r.HaltedByDump || len(r.Dumps) != 1 {
		t.Fatalf("Symfony dd: %+v", r)
	}
	r = engine.Execute(context.Background(), p, s, `$model = new class extends \Illuminate\Database\Eloquent\Model {
 protected $hidden = ['secret'];
 public function getNameAttribute($value) { throw new \RuntimeException('accessor must not execute'); }
 };
 $model->setRawAttributes(['id' => 1, 'name' => 'Ana', 'secret' => 'hidden']);
 $model;`)
	if !r.Success || r.Value == nil || len(r.Value.Children) != 2 {
		t.Fatalf("Eloquent inspection: %+v", r)
	}
	for _, entry := range r.Value.Children {
		if entry.Key == "secret" {
			t.Fatal("hidden model attribute exposed")
		}
	}
}
