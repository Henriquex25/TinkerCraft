<?php
declare(strict_types=1);

namespace TinkerCraft\Runtime {
final class BootstrapError extends \RuntimeException {}
final class Inspector {
    private \SplObjectStorage $seen;
    private int $budget = 5000;
    private static int $remainingBytes = 2097152;
    private static int $remainingNodes = 10000;
    public function __construct() { $this->seen = new \SplObjectStorage(); }
    public function node(mixed $value, int $depth = 0): array {
        self::$remainingBytes -= 128;
        if (--$this->budget < 0 || --self::$remainingNodes < 0 || self::$remainingBytes < 0 || $depth > 8) { return ['type' => 'limit', 'value' => 'Limite de inspeção', 'truncated' => true]; }
        if ($value === null) { return ['type' => 'null']; }
        if (is_bool($value)) { return ['type' => 'bool', 'value' => $value]; }
        if (is_int($value)) { return ['type' => 'int', 'value' => abs($value) > 9007199254740991 ? (string)$value : $value]; }
        if (is_float($value)) { return ['type' => 'float', 'value' => is_finite($value) ? $value : (string)$value]; }
        if (is_string($value)) { $size = min(32768, max(0, self::$remainingBytes)); self::$remainingBytes -= min(strlen($value), $size); return ['type' => 'string', 'value' => substr($value, 0, $size), 'truncated' => strlen($value) > $size]; }
        if (is_resource($value)) { return ['type' => 'resource', 'value' => get_resource_type($value)]; }
        $class = null;
        $list = false;
        if (is_object($value)) {
            $class = get_class($value);
            self::$remainingBytes -= strlen($class);
            if (self::$remainingBytes < 0) { return ['type' => 'limit', 'value' => 'Limite de inspeção', 'truncated' => true]; }
            if ($this->seen->contains($value)) { return ['type' => 'reference', 'class' => $class, 'value' => 'Referência circular']; }
            $this->seen->attach($value);
            if ($value instanceof \DateTimeInterface) { $this->seen->detach($value); return ['type' => 'datetime', 'class' => $class, 'value' => $value->format(DATE_ATOM)]; }
            if ($value instanceof \UnitEnum) { $this->seen->detach($value); return ['type' => 'enum', 'class' => $class, 'value' => $value instanceof \BackedEnum ? $value->value : $value->name]; }
            if ($value instanceof \Closure) { $this->seen->detach($value); return ['type' => 'closure', 'class' => $class]; }

            if (is_a($value, 'Illuminate\\Database\\Eloquent\\Model')) {
                $values = $value->getAttributes();
                $hidden = array_flip($value->getHidden());
                $visible = $value->getVisible();
                $values = $visible ? array_intersect_key($values, array_flip($visible)) : array_diff_key($values, $hidden);
                foreach ($value->getRelations() as $key => $relation) {
                    if (!isset($hidden[$key]) && (!$visible || in_array($key, $visible, true))) { $values[$key] = $relation; }
                }
            } elseif (is_a($value, 'Illuminate\\Support\\Collection')) {
                $values = $value->all();
                $list = array_is_list($values);
            } else {
                $values = [];
                foreach ((array)$value as $key => $property) {
                    $key = (string)$key;
                    if (str_contains($key, "\0")) { $parts = explode("\0", $key); $key = end($parts) . ($parts[1] === '*' ? ' (protected)' : ' (private)'); }
                    $values[$key] = $property;
                }
            }
        } else { $values = $value; $list = array_is_list($values); }
        $children = [];
        foreach ($values as $key => $child) {
            self::$remainingBytes -= strlen((string)$key);
            if (count($children) >= 300 || $this->budget <= 0 || self::$remainingBytes <= 0 || self::$remainingNodes <= 0) { break; }
            $children[] = ['key' => (string)$key, 'value' => $this->node($child, $depth + 1)];
        }
        if (is_object($value)) { $this->seen->detach($value); }
        return ['type' => $class ? 'object' : 'array', 'class' => $class, 'list' => $list, 'children' => $children, 'count' => count($values), 'truncated' => count($children) < count($values)];
    }
}
final class LaravelAliases {
    public static function register(mixed $loader, string $root, array $included, array $excluded): void {
        $aliases = null;
        spl_autoload_register(static function (string $name) use ($loader, $root, $included, $excluded, &$aliases): void {
            if (str_contains($name, '\\')) { return; }
            if ($aliases === null) { $aliases = self::discover($loader, $root, $included, $excluded); }
            $candidates = $aliases[strtolower($name)] ?? [];
            if (count($candidates) > 1) {
                throw new \RuntimeException('Ambiguous class alias "' . $name . '". Use a fully qualified class name or an explicit use statement: ' . implode(', ', $candidates));
            }
            if (count($candidates) === 1 && class_exists($candidates[0])) { class_alias($candidates[0], $name); }
        });
    }
    private static function discover(mixed $loader, string $root, array $included, array $excluded): array {
        $names = [];
        $prefix = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        $matches = static function (string $name, array $patterns): bool {
            foreach ($patterns as $pattern) { if (is_string($pattern) && $pattern !== '' && str_starts_with($name, $pattern)) { return true; } }
            return false;
        };
        $add = static function (string $class, string $file, bool $explicit = false) use (&$names, $matches, $excluded, $prefix): void {
            if (!str_contains($class, '\\') || !preg_match('/^(?:[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*\\\\)+[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*$/D', $class)) { return; }
            if (!$explicit && ($matches($class, $excluded) || !str_starts_with($file, $prefix) || str_starts_with($file, $prefix . 'vendor' . DIRECTORY_SEPARATOR))) { return; }
            $short = substr($class, strrpos($class, '\\') + 1);
            $names[strtolower($short)][$class] = $class;
        };
        foreach ($included as $class) { if (is_string($class) && str_contains($class, '\\')) { $add($class, '', true); } }
        $maps = is_object($loader) && method_exists($loader, 'getClassMap') ? $loader->getClassMap() : [];
        foreach ($maps as $class => $file) { if (is_string($class) && is_string($file)) { $add($class, $file, $matches($class, $included)); } }
        $psr4 = is_object($loader) && method_exists($loader, 'getPrefixesPsr4') ? $loader->getPrefixesPsr4() : [];
        if (!$psr4 && is_file($root . '/composer.json')) {
            $manifest = json_decode(file_get_contents($root . '/composer.json'), true);
            $psr4 = $manifest['autoload']['psr-4'] ?? [];
            foreach ($psr4 as &$dirs) { $dirs = array_map(static fn ($dir) => $root . '/' . $dir, (array)$dirs); }
            unset($dirs);
        }
        $visited = 0;
        foreach ($psr4 as $namespace => $dirs) {
            if (!is_string($namespace)) { continue; }
            foreach ((array)$dirs as $dir) {
                $base = is_string($dir) ? realpath($dir) : false;
                if (!$base || !is_dir($base) || !str_starts_with($base . DIRECTORY_SEPARATOR, $prefix) || str_starts_with($base, $prefix . 'vendor')) { continue; }
                $filter = new \RecursiveCallbackFilterIterator(new \RecursiveDirectoryIterator($base, \FilesystemIterator::SKIP_DOTS), static fn ($file) => !$file->isLink() && !str_starts_with($file->getFilename(), '.') && !in_array($file->getFilename(), ['vendor', 'node_modules', 'storage'], true));
                foreach (new \RecursiveIteratorIterator($filter, \RecursiveIteratorIterator::LEAVES_ONLY, \RecursiveIteratorIterator::CATCH_GET_CHILD) as $file) {
                    if (++$visited > 10000) { throw new \RuntimeException('Class alias scan limit reached. Use a fully qualified class name.'); }
                    if (!$file->isFile() || $file->getExtension() !== 'php') { continue; }
                    $relative = substr($file->getPathname(), strlen($base) + 1, -4);
                    $class = rtrim($namespace, '\\') . '\\' . str_replace(DIRECTORY_SEPARATOR, '\\', $relative);
                    $add($class, $file->getPathname(), $matches($class, $included));
                }
            }
        }
        foreach ($names as &$candidates) { $candidates = array_values($candidates); sort($candidates); }
        unset($candidates);
        return $names;
    }
}
final class Execution {
    public static array $result = ['success' => true, 'value' => null, 'dumps' => [], 'warnings' => [], 'stdout' => '', 'framework' => 'PHP', 'truncated' => false];
    public static string $marker = '';
    public static float $started;
    public static int $bufferLevel;
    public static bool $finished = false;
    public static function capture(mixed ...$values): void {
        foreach (debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 12) as $frame) {
            if (($frame['function'] ?? '') === 'dd') { self::$result['haltedByDump'] = true; break; }
        }
        foreach ($values as $value) {
            if (count(self::$result['dumps']) >= 50) { self::$result['truncated'] = true; break; }
            self::$result['dumps'][] = (new Inspector())->node($value);
        }
    }
    public static function output(string $chunk): string {
        $remaining = 262144 - strlen(self::$result['stdout']);
        if (strlen($chunk) > $remaining) { self::$result['truncated'] = true; }
        if ($remaining > 0) { self::$result['stdout'] .= substr($chunk, 0, $remaining); }
        return '';
    }
    public static function fail(\Throwable $error): void {
        self::$result['success'] = false;
        self::$result['error'] = ['class' => get_class($error), 'message' => substr($error->getMessage(), 0, 32768), 'file' => $error->getFile(), 'line' => $error->getLine(), 'trace' => substr($error->getTraceAsString(), 0, 32768)];
    }
    public static function finish(): void {
        if (self::$finished) { return; }
        self::$finished = true;
        $error = error_get_last();
        if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            self::$result['success'] = false;
            self::$result['error'] = ['class' => 'FatalError', 'message' => $error['message'], 'file' => $error['file'], 'line' => $error['line'], 'trace' => ''];
        }
        while (ob_get_level() > self::$bufferLevel) { if (!@ob_end_flush()) { break; } }
        self::$result['durationMs'] = round((microtime(true) - self::$started) * 1000, 2);
        self::$result['memoryBytes'] = memory_get_peak_usage(true);
        self::$result['phpVersion'] = PHP_VERSION;
        $partial = static function ($node) use (&$partial): bool {
            if (!is_array($node)) { return false; }
            if ($node['truncated'] ?? false) { return true; }
            foreach ($node['children'] ?? [] as $entry) { if ($partial($entry['value'])) { return true; } }
            return false;
        };
        if ($partial(self::$result['value'])) { self::$result['truncated'] = true; }
        foreach (self::$result['dumps'] as $dump) { if ($partial($dump)) { self::$result['truncated'] = true; } }
        $json = json_encode(self::$result, JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);

        fwrite(STDOUT, "\n" . self::$marker . base64_encode($json) . "\n");
    }
}
}
namespace {
    $tinkercraftPayload = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    \TinkerCraft\Runtime\Execution::$marker = $tinkercraftPayload['marker'];
    \TinkerCraft\Runtime\Execution::$started = microtime(true);
    \TinkerCraft\Runtime\Execution::$bufferLevel = ob_get_level();
    ob_start([\TinkerCraft\Runtime\Execution::class, 'output'], 8192);
    register_shutdown_function([\TinkerCraft\Runtime\Execution::class, 'finish']);
    ini_set('display_errors', '0');
    set_time_limit($tinkercraftPayload['timeout']);
    set_error_handler(static function (int $level, string $message, string $file, int $line): bool {
        if (!(error_reporting() & $level)) { return false; }
        if (count(\TinkerCraft\Runtime\Execution::$result['warnings']) < 50) { \TinkerCraft\Runtime\Execution::$result['warnings'][] = substr("$message ($file:$line)", 0, 8192); }
        return true;
    });
    try {
        if (!is_dir($tinkercraftPayload['projectPath']) || !chdir($tinkercraftPayload['projectPath'])) { throw new \TinkerCraft\Runtime\BootstrapError('Diretório do projeto não encontrado: ' . $tinkercraftPayload['projectPath']); }
        $tinkercraftBootstrap = $tinkercraftPayload['bootstrap'];
        if ($tinkercraftBootstrap !== 'none' && is_file('vendor/autoload.php')) { $tinkercraftComposerLoader = require getcwd() . '/vendor/autoload.php'; \TinkerCraft\Runtime\Execution::$result['framework'] = 'Composer'; }
        if ($tinkercraftBootstrap === 'composer' && !is_file('vendor/autoload.php')) { throw new \TinkerCraft\Runtime\BootstrapError('vendor/autoload.php não encontrado. Execute composer install no projeto.'); }
        if ($tinkercraftBootstrap === 'laravel' || ($tinkercraftBootstrap === 'auto' && is_file('artisan') && is_file('bootstrap/app.php'))) {
            $tinkercraftApp = require getcwd() . '/bootstrap/app.php';
            $tinkercraftKernel = $tinkercraftApp->make(\Illuminate\Contracts\Console\Kernel::class);
            $tinkercraftKernel->bootstrap();
            if (class_exists(\Illuminate\Foundation\AliasLoader::class)) { \Illuminate\Foundation\AliasLoader::getInstance()->register(); }
            \TinkerCraft\Runtime\LaravelAliases::register($tinkercraftComposerLoader ?? null, getcwd(), (array)$tinkercraftApp['config']->get('tinker.alias', []), (array)$tinkercraftApp['config']->get('tinker.dont_alias', []));
            \TinkerCraft\Runtime\Execution::$result['framework'] = 'Laravel ' . $tinkercraftApp->version();
        }
        if ($tinkercraftBootstrap === 'custom') {
            $tinkercraftFile = $tinkercraftPayload['bootstrapFile'];
            if (!is_file($tinkercraftFile)) { throw new \TinkerCraft\Runtime\BootstrapError('Arquivo de bootstrap não encontrado: ' . $tinkercraftFile); }
            require $tinkercraftFile;
            \TinkerCraft\Runtime\Execution::$result['framework'] = 'Custom';
        }
        if (class_exists(\Symfony\Component\VarDumper\VarDumper::class)) {
            \Symfony\Component\VarDumper\VarDumper::setHandler(static function ($value): void { \TinkerCraft\Runtime\Execution::capture($value); });
        }
        if (!function_exists('dump')) { function dump(...$values) { \TinkerCraft\Runtime\Execution::capture(...$values); return count($values) === 1 ? $values[0] : $values; } }
        if (!function_exists('dd')) { function dd(...$values) { \TinkerCraft\Runtime\Execution::capture(...$values); exit(0); } }

        $tinkercraftValue = eval($tinkercraftPayload['code']);
        \TinkerCraft\Runtime\Execution::$result['value'] = (new \TinkerCraft\Runtime\Inspector())->node($tinkercraftValue);
    } catch (\Throwable $tinkercraftError) { \TinkerCraft\Runtime\Execution::fail($tinkercraftError); }
    \TinkerCraft\Runtime\Execution::finish();
}
