package execution

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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

func TestRealLaravelShortClassAliasesAndContainer(t *testing.T) {
	vendor := os.Getenv("TINKERCRAFT_LARAVEL_VENDOR")
	if vendor == "" {
		t.Skip("set TINKERCRAFT_LARAVEL_VENDOR")
	}
	engine, profile, settings := fixture(t)
	builder, err := filepath.Abs("../../tests/fixtures/build-laravel.php")
	if err != nil {
		t.Fatal(err)
	}
	if out, err := exec.Command("php", builder, vendor, profile.ProjectPath).CombinedOutput(); err != nil {
		t.Fatalf("fixture: %s %v", out, err)
	}
	model := filepath.Join(profile.ProjectPath, "app", "Models", "User.php")
	os.MkdirAll(filepath.Dir(model), 0700)
	os.WriteFile(model, []byte(`<?php namespace App\Models; class User extends \Illuminate\Database\Eloquent\Model { public $timestamps = false; }`), 0600)
	profile.Bootstrap = "laravel"
	setup := `app()->register(\Illuminate\Database\DatabaseServiceProvider::class);
 app()['config']->set('database.default', 'sqlite');
 app()['config']->set('database.connections.sqlite', ['driver'=>'sqlite','database'=>':memory:','prefix'=>'']);
 $db = app('db')->connection();
 $db->getSchemaBuilder()->create('users', function ($table) { $table->increments('id'); $table->string('name'); });
 $db->table('users')->insert([['name'=>'Ana'],['name'=>'Bruno']]);
 `
	for _, code := range []string{`User::count();`, `\App\Models\User::count();`, `app(User::class)->newQuery()->count();`, `resolve(User::class)->newQuery()->count();`, `use App\Models\User as Person; Person::count();`} {
		result := engine.Execute(context.Background(), profile, settings, setup+code)
		if !result.Success || result.Value == nil || fmt.Sprint(result.Value.Value) != "2" {
			t.Fatalf("%s: %+v", code, result)
		}
	}
	conflict := filepath.Join(profile.ProjectPath, "app", "Admin", "User.php")
	os.MkdirAll(filepath.Dir(conflict), 0700)
	os.WriteFile(conflict, []byte(`<?php namespace App\Admin; class User {}`), 0600)
	result := engine.Execute(context.Background(), profile, settings, setup+`User::count();`)
	if result.Success || result.Error == nil || !strings.Contains(result.Error.Message, "Ambiguous class alias") {
		t.Fatalf("ambiguous alias silently chosen: %+v", result)
	}
	result = engine.Execute(context.Background(), profile, settings, setup+`use App\Models\User; User::count();`)
	if !result.Success {
		t.Fatalf("explicit import failed: %+v", result)
	}
	os.Remove(conflict)
	os.WriteFile(filepath.Join(profile.ProjectPath, "config", "tinker.php"), []byte(`<?php return ['dont_alias'=>['App\\Models\\User']];`), 0600)
	result = engine.Execute(context.Background(), profile, settings, setup+`User::count();`)
	if result.Success {
		t.Fatal("ignored tinker.dont_alias")
	}
	profile.Bootstrap = "composer"
	result = engine.Execute(context.Background(), profile, settings, `User::count();`)
	if result.Success {
		t.Fatal("Laravel aliases leaked into Composer-only bootstrap")
	}
}
