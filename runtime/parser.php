<?php
declare(strict_types=1);
spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'PhpParser\\')) {
        $file = __DIR__ . '/vendor/php-parser/lib/' . str_replace('\\', '/', $class) . '.php';
        if (is_file($file)) { require $file; }
    }
});
