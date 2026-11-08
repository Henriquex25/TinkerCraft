# Autocomplete and cache

Completion combines Phpactor language support with a source index and static Laravel helpers. It supports namespace suggestions, member completion, hover information, signatures, and diagnostics.

Use **Ctrl+Space** to request suggestions manually. Typing namespace separators and member operators also triggers completion.

## Where the source comes from

| Connection         | Default source for analysis                              |
| ------------------ | -------------------------------------------------------- |
| Local              | Your selected directory                                  |
| Local Docker       | An accessible bind mount, or a temporary source snapshot |
| SSH / SSH + Docker | A source snapshot stored on your computer                |

There is no need to select a manual local copy in the usual setup. Advanced connection settings still allow a specific local directory or disabling completion.

Snapshots contain PHP source and Composer metadata. They exclude `.env`, databases, uploads, hidden directories, generated Composer loaders, and other non-source data. TinkerCraft does not upload changes to your project.

## Laravel methods

Private analysis helpers describe known Eloquent query methods, conventional model scopes, and attribute-based scopes. They make methods such as `User::count()` available to completion and diagnostics.

Generated helpers live in TinkerCraft's workspace, including for local projects. `_ide_helper.php` and `_ide_helper_models.php`, when present, are read as source metadata and preserved.

The generator does not install IDE Helper, boot your Laravel application, execute its models, or inspect database schema. Runtime-only macros and schema-derived properties may still need existing helper metadata.

## Refresh and expiration

Source-content fingerprints invalidate generated symbols on the next preparation. While visible, the app prepares the active tab again after five minutes. Remote snapshots are reused while less than fifteen minutes old.

**Refresh completion** (**Ctrl+Alt+R**) forces source collection and preparation immediately. Use it after a deployment or when a newly added method is missing.

Inactive caches expire after seven days by default. Configure 1–90 days in Preferences. Active language sessions are preserved.

## Diagnostics

Open **Completion diagnostics** with **Ctrl+Alt+I**. It identifies Phpactor versus the basic fallback, the source directory/cache, and preparation warnings.

First-time indexing can take a while. A source snapshot is limited to 256 MiB, 80,000 files, and three minutes, with up to 4 MiB per file. Static helper indexing covers up to 2,000 PHP files and ignores files larger than 1 MiB. Partial caches are reported. The basic fallback is more limited than Phpactor, especially for generics and chained expressions.
