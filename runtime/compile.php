<?php
declare(strict_types=1);
require __DIR__ . '/parser.php';
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$code = $input['code'];
$prefix = preg_match('/^\s*<\?php\b/', $code) ? 0 : 1;
if ($prefix) { $code = "<?php\n" . $code; }
try {
    $parser = (new PhpParser\ParserFactory())->createForNewestSupportedVersion();
    try { $statements = $parser->parse($code) ?? []; }
    catch (PhpParser\Error $first) {
        // A final expression may omit its semicolon, as in a REPL.
        $code .= "\n;";
        $statements = $parser->parse($code) ?? [];
    }
    // Work on syntax trees: semicolons inside strings/closures never split expressions.
    $returnPosition = null;
    $returnLast = static function (array &$nodes) use (&$returnLast, &$returnPosition): void {
        $last = array_key_last($nodes);
        if ($last === null) { return; }
        while ($nodes[$last] instanceof PhpParser\Node\Stmt\Nop) { unset($nodes[$last]); $last = array_key_last($nodes); if ($last === null) { return; } }
        if ($nodes[$last] instanceof PhpParser\Node\Stmt\Namespace_) {
            $returnLast($nodes[$last]->stmts);
        } elseif ($nodes[$last] instanceof PhpParser\Node\Stmt\Expression) {
            $returnPosition = $nodes[$last]->getStartFilePos();
        }
    };
    $returnLast($statements);
    if ($returnPosition !== null) { $code = substr_replace($code, 'return ', $returnPosition, 0); }
    // Preserve the original source, comments and line numbers. Only insert `return`.
    $compiled = $prefix ? substr($code, 6) : preg_replace('/^(\s*)<\?php\b/', '$1', $code, 1);
    echo json_encode(['code' => $compiled, 'prefix' => $prefix], JSON_THROW_ON_ERROR);
} catch (PhpParser\Error $error) {
    echo json_encode(['error' => ['class' => 'ParseError', 'message' => $error->getRawMessage(), 'line' => max(1, $error->getStartLine() - $prefix)]], JSON_THROW_ON_ERROR);
    exit(2);
}
