# Run PHP and Laravel

Select a connection, write PHP, and press **Ctrl+Enter** or click **Run**. TinkerCraft runs only when you request execution. Typing, completing, and formatting code do not execute your snippet.

## Return values and dumps

The last expression is returned automatically:

```php
collect([1, 2, 3])->map(fn ($number) => $number * 2);
```

You can also use `return`, `dump()`, or `dd()`. Dumps appear separately from the final return value. `dd()` stops execution.

Each run starts a new PHP process. Include every variable and setup statement that your snippet needs; variables from a previous run do not persist.

## Laravel classes and the container

With Laravel bootstrap, use fully qualified classes:

```php
\App\Models\User::count();
```

Unique application classes also support short-name aliases:

```php
User::count();
```

If two application classes share a short name, make your choice explicit:

```php
use App\Models\User;

User::count();
```

Class aliases are separate from dependency injection. The initialized Laravel container is available through `app()` and `resolve()`:

```php
app(\App\Models\User::class)->newQuery()->count();
```

The runner honors `tinker.alias` and `tinker.dont_alias`. Use a fully qualified name when a short name is excluded or ambiguous. Laravel aliases are enabled only with Laravel bootstrap.

## Stop a run

Click **Cancel** or use the run/cancel shortcut while execution is active. You can configure the timeout in the connection's advanced settings.

::: warning Real application access
A snippet uses the actual permissions, services, and database of the selected project. There is no sandbox or automatic rollback. Cancellation stops the local process/transport; it does not guarantee termination of work already started remotely or undo its effects.
:::
