<?php
// Build an isolated app from installed OPEN SOURCE framework dependencies only.
// Never include the host project's autoload.php, .env, providers or application code.
declare(strict_types=1);
[$script, $vendor, $target] = $argv;
$installed = json_decode(file_get_contents($vendor . '/composer/installed.json'), true, 512, JSON_THROW_ON_ERROR);
$packages = [];
foreach ($installed['packages'] ?? $installed as $package) { $packages[$package['name']] = $package; }
$selected = [];
$visit = static function (string $name) use (&$visit, &$selected, $packages): void {
    if (array_key_exists($name, $selected) || !isset($packages[$name])) { return; }
    $selected[$name] = null;
    foreach (array_keys($packages[$name]['require'] ?? []) as $dependency) { $visit($dependency); }
    unset($selected[$name]); $selected[$name] = $packages[$name];
};
$visit('laravel/framework');
if (!$selected) { throw new RuntimeException('Laravel framework dependency not found'); }
$maps = []; $files = [];
foreach ($selected as $name => $package) {
    $base = $vendor . '/' . $name;
    foreach ($package['autoload']['psr-4'] ?? [] as $prefix => $dirs) { foreach ((array)$dirs as $dir) { $maps[$prefix][] = $base . '/' . $dir; } }
    foreach ($package['autoload']['files'] ?? [] as $file) { $files[] = $base . '/' . $file; }
}
foreach (['vendor', 'bootstrap/cache', 'storage/logs', 'storage/framework/views', 'config', 'app'] as $dir) { if (!is_dir($target . '/' . $dir)) { mkdir($target . '/' . $dir, 0700, true); } }
$loader = "<?php\nrequire_once " . var_export($vendor . '/composer/ClassLoader.php', true) . ";\n\$loader = new Composer\\Autoload\\ClassLoader();\n";
foreach ($maps as $prefix => $dirs) { $loader .= '\$loader->addPsr4(' . var_export($prefix, true) . ', ' . var_export($dirs, true) . ");\n"; }
$loader = str_replace('\\$loader', '$loader', $loader);
$loader .= "\$loader->register();\n";
foreach ($files as $file) { $loader .= 'require_once ' . var_export($file, true) . ";\n"; }
file_put_contents($target . '/vendor/autoload.php', $loader);
file_put_contents($target . '/artisan', "<?php // isolated test marker\n");
file_put_contents($target . '/composer.json', '{"name":"tinkercraft/isolated-fixture"}');
file_put_contents($target . '/config/app.php', "<?php return ['name' => 'TinkerCraft Fixture', 'env' => 'testing', 'debug' => true, 'key' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'providers' => [], 'aliases' => []];");
file_put_contents($target . '/bootstrap/app.php', <<<'PHP'
<?php
$app = new Illuminate\Foundation\Application(dirname(__DIR__));
$app->singleton(Illuminate\Contracts\Console\Kernel::class, Illuminate\Foundation\Console\Kernel::class);
$app->singleton(Illuminate\Contracts\Debug\ExceptionHandler::class, Illuminate\Foundation\Exceptions\Handler::class);
return $app;
PHP);
echo $target;
