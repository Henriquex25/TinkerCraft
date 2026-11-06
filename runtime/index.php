<?php
declare(strict_types=1);
require __DIR__ . '/parser.php';
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$parser = (new PhpParser\ParserFactory())->createForNewestSupportedVersion();
$printer = new PhpParser\PrettyPrinter\Standard();
$typeName = static function ($type) use (&$typeName): string {
    if ($type === null) { return ''; }
    if ($type instanceof PhpParser\Node\NullableType) { return '?' . $typeName($type->type); }
    if ($type instanceof PhpParser\Node\UnionType) { return implode('|', array_map($typeName, $type->types)); }
    if ($type instanceof PhpParser\Node\IntersectionType) { return implode('&', array_map($typeName, $type->types)); }
    return (string)$type;
};
$signature = static function ($node) use ($typeName, $printer): array {
    $params = [];
    foreach ($node->params as $param) {
        $text = ($param->type ? $typeName($param->type) . ' ' : '') . ($param->byRef ? '&' : '') . ($param->variadic ? '...' : '') . '$' . $param->var->name;
        if ($param->default) { $text .= ' = ' . $printer->prettyPrintExpr($param->default); }
        $params[] = $text;
    }
    $return = $typeName($node->returnType);
    return ['name' => (string)$node->name, 'detail' => (string)$node->name . '(' . implode(', ', $params) . ')' . ($return ? ': ' . $return : ''), 'returnType' => $return, 'parameters' => $params, 'documentation' => $node->getDocComment()?->getText() ?? '', 'line' => $node->getStartLine()];
};
$output = ['classes' => [], 'functions' => [], 'files' => 0, 'aliases' => [], 'dontAlias' => []];
foreach ($input['files'] as $file) {
    try {
        if (filesize($file) > 1048576) { continue; }
        $source = file_get_contents($file);
        $nodes = $parser->parse($source) ?? [];
        $traverser = new PhpParser\NodeTraverser(new PhpParser\NodeVisitor\NameResolver());
        $nodes = $traverser->traverse($nodes);
        $finder = new PhpParser\NodeFinder();
        if (str_ends_with(str_replace('\\', '/', $file), '/config/tinker.php')) {
            foreach ($finder->findInstanceOf($nodes, PhpParser\Node\Stmt\Return_::class) as $return) {
                if (!$return->expr instanceof PhpParser\Node\Expr\Array_) { continue; }
                foreach ($return->expr->items as $item) {
                    if (!$item?->key instanceof PhpParser\Node\Scalar\String_ || !$item->value instanceof PhpParser\Node\Expr\Array_) { continue; }
                    $target = match ($item->key->value) { 'alias' => 'aliases', 'dont_alias' => 'dontAlias', default => null };
                    if ($target === null) { continue; }
                    foreach ($item->value->items as $entry) {
                        $value = $entry?->value;
                        if ($value instanceof PhpParser\Node\Scalar\String_) { $output[$target][] = $value->value; }
                        elseif ($value instanceof PhpParser\Node\Expr\ClassConstFetch && $value->class instanceof PhpParser\Node\Name && (string)$value->name === 'class') { $output[$target][] = (string)$value->class; }
                    }
                }
            }
        }

        $imports = [];
        foreach ($finder->findInstanceOf($nodes, PhpParser\Node\Stmt\Use_::class) as $use) {
            if ($use->type !== PhpParser\Node\Stmt\Use_::TYPE_NORMAL) { continue; }
            foreach ($use->uses as $item) { $imports[(string)($item->alias ?? $item->name->getLast())] = (string)$item->name; }
        }
        foreach ($finder->findInstanceOf($nodes, PhpParser\Node\Stmt\GroupUse::class) as $use) {
            foreach ($use->uses as $item) {
                if ($use->type === PhpParser\Node\Stmt\Use_::TYPE_NORMAL || $item->type === PhpParser\Node\Stmt\Use_::TYPE_NORMAL) { $imports[(string)($item->alias ?? $item->name->getLast())] = $use->prefix . '\\' . $item->name; }
            }
        }
        foreach ($finder->findInstanceOf($nodes, PhpParser\Node\Stmt\ClassLike::class) as $class) {
            if (!$class->name) { continue; }
            $name = isset($class->namespacedName) ? (string)$class->namespacedName : (string)$class->name;
            $entry = ['name' => $name, 'short' => (string)$class->name, 'extends' => isset($class->extends) && $class->extends instanceof PhpParser\Node\Name ? (string)$class->extends : '', 'methods' => [], 'properties' => [], 'file' => $file, 'line' => $class->getStartLine()];
            $doc = $class->getDocComment();
            $entry += ['documentation' => $doc?->getText() ?? '', 'docStart' => $doc?->getStartFilePos() ?? -1, 'docEnd' => $doc?->getEndFilePos() ?? -1, 'start' => $class->getStartFilePos(), 'sourceHash' => hash('sha256', $source), 'imports' => (object)$imports, 'traits' => [], 'kind' => $class->getType()];
            foreach ($class->stmts as $statement) {
                if ($statement instanceof PhpParser\Node\Stmt\TraitUse) { foreach ($statement->traits as $trait) { $entry['traits'][] = (string)$trait; } }
            }
            foreach ($class->getMethods() as $method) {
                $scope = false;
                foreach ($method->attrGroups as $group) { foreach ($group->attrs as $attribute) { if ((string)$attribute->name === 'Illuminate\\Database\\Eloquent\\Attributes\\Scope') { $scope = true; } } }
                if (!$method->isPublic() && !$scope && !str_starts_with((string)$method->name, 'scope')) { continue; }
                $item = $signature($method); $item['owner'] = $name; $item['static'] = $method->isStatic(); $item['scope'] = $scope; $item['visibility'] = $method->isPublic() ? 'public' : 'protected'; $entry['methods'][] = $item;
            }
            foreach ($class->stmts as $property) {
                if (!$property instanceof PhpParser\Node\Stmt\Property || !$property->isPublic()) { continue; }
                foreach ($property->props as $prop) { $entry['properties'][] = ['name' => (string)$prop->name, 'type' => $typeName($property->type)]; }
            }
            $output['classes'][] = $entry;
        }
        foreach ($finder->findInstanceOf($nodes, PhpParser\Node\Stmt\Function_::class) as $function) {
            $entry = $signature($function); $entry['name'] = isset($function->namespacedName) ? (string)$function->namespacedName : (string)$function->name; $output['functions'][] = $entry;
        }
        $output['files']++;
    } catch (Throwable $error) {                                                         }
}
foreach (get_defined_functions()['internal'] as $name) {
    $function = new ReflectionFunction($name); $params = [];
    foreach ($function->getParameters() as $param) { $params[] = ($param->hasType() ? (string)$param->getType() . ' ' : '') . ($param->isVariadic() ? '...' : '') . '$' . $param->getName(); }
    $output['functions'][] = ['name' => $name, 'detail' => $name . '(' . implode(', ', $params) . ')', 'returnType' => $function->hasReturnType() ? (string)$function->getReturnType() : '', 'parameters' => $params, 'documentation' => 'PHP ' . PHP_VERSION];
}
echo json_encode($output, JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
