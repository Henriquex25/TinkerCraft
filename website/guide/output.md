# Explore output and export CSV

The output panel provides **Inspect**, **Table**, and **JSON** views. Switch with **Ctrl+Alt+1**, **Ctrl+Alt+2**, and **Ctrl+Alt+3**.

## Inspect

Expand arrays, objects, Collections, and Eloquent attributes as a tree. Use the arrow keys while a tree item is focused. Select a dump to inspect it separately from the return value.

Eloquent inspection respects `hidden` and `visible`, and includes relations that are already loaded. It avoids accessors and additional lazy-loading queries. This can differ from your application's normal JSON serialization.

## Table and CSV

Return a collection or array of similar rows. For example, with Laravel bootstrap and a standard User model:

```php
\App\Models\User::query()
    ->select(['id', 'name'])
    ->limit(100)
    ->get();
```

Open **Table**, filter or sort the inspected rows, and use **Export CSV** or **Ctrl+Shift+E**. The export includes the filtered, sorted rows across the table's pages, not just the visible page.

CSV exports the data already received and inspected by TinkerCraft. It does not issue another database query or fetch rows omitted by inspection limits. For a large database export, prepare an export in your application instead.

## JSON and other output

Use **JSON** for the structured value. **Copy JSON** (**Ctrl+Shift+C**) copies the selected inspected value. Standard output, warnings, errors, and stack traces are displayed separately when present.

## Hide or clear

**Ctrl+J** and the panel's X hide the output and give the editor more space. The current result and view are preserved. Running code or focusing output shows it again.

**Ctrl+Shift+Delete** clears the current result.

## Partial results

Inspection is bounded: up to 300 children per node, depth 8, 50 dumps, and a shared value budget of approximately 2 MiB. A node inspection also has a 5,000-node budget. Standard output is limited to 256 KiB. Partial indicators mean that the tree, table, copied JSON, and CSV may contain only part of the original data.
