<?php
declare(strict_types=1);

$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$root = realpath($input['projectPath']);
if ($root === false || !is_dir($root)) { fwrite(STDERR, 'Diretório do projeto não encontrado'); exit(2); }
$blocked = ['storage', 'cache', 'logs', 'log', 'tmp', 'temp', 'public', 'var', 'uploads', 'upload', 'backups', 'media'];
$maxBytes = max(1, min(268435456, (int) ($input['maxBytes'] ?? 268435456)));
$maxFiles = max(1, min(80000, (int) ($input['maxFiles'] ?? 80000)));
$files = 0; $bytes = 0; $skipped = 0; $limited = false;
$collect = static function (string $base, bool $vendor) use ($root, $blocked, $maxBytes, $maxFiles, &$files, &$bytes, &$skipped, &$limited): void {
    if (!is_dir($base) || is_link($base)) { return; }
    $directory = new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS);
    $filter = new RecursiveCallbackFilterIterator($directory, static function ($entry) use ($blocked, $root, $vendor): bool {
        if ($entry->isLink()) { return false; }
        $name = $entry->getFilename();
        if (str_starts_with($name, '.')) { return false; }
        if (!$entry->isDir()) { return true; }
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($entry->getPathname(), strlen(rtrim($root, DIRECTORY_SEPARATOR)) + 1));
        if ($name === 'node_modules' || $relative === 'bootstrap/cache' || (!$vendor && $relative === 'vendor')) { return false; }
        if (!str_contains($relative, '/') && in_array($name, $blocked, true)) { return false; }

        if ($vendor && substr_count($relative, '/') >= 3 && in_array(strtolower($name), ['test', 'tests', 'fixtures', 'doc', 'docs', 'examples', 'benchmarks'], true)) { return false; }
        return true;
    });
    foreach (new RecursiveIteratorIterator($filter, RecursiveIteratorIterator::LEAVES_ONLY, RecursiveIteratorIterator::CATCH_GET_CHILD) as $file) {
        if (!$file->isFile() || $file->isLink()) { continue; }
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen(rtrim($root, DIRECTORY_SEPARATOR)) + 1));
        $name = $file->getFilename();
        if ($relative === 'vendor/autoload.php' || (dirname($relative) === 'vendor/composer' && str_starts_with($name, 'autoload') && str_ends_with($name, '.php'))) { continue; }
        if (strtolower($file->getExtension()) !== 'php' && !in_array($name, ['composer.json', 'composer.lock'], true) && $relative !== 'vendor/composer/installed.json') { continue; }
        if ($file->getSize() > 4194304 || !$file->isReadable()) { $skipped++; continue; }
        $content = @file_get_contents($file->getPathname());
        if ($content === false) { $skipped++; continue; }
        if ($bytes + strlen($content) > $maxBytes || $files >= $maxFiles) { $limited = true; $skipped++; break; }
        $bytes += strlen($content); $files++;
        echo json_encode(['path' => $relative, 'data' => base64_encode($content)], JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR) . "\n";
    }
};

$collect($root, false);
if (!$limited) { $collect($root . '/vendor', true); }
echo json_encode(['done' => true, 'files' => $files, 'bytes' => $bytes, 'skipped' => $skipped, 'limited' => $limited], JSON_THROW_ON_ERROR) . "\n";
