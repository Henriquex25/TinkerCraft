import { translateStatus } from "./i18n";
import { t as tr } from "./i18n";
import { formatLocale } from "./i18n";
import { useMemo, useState, useRef } from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Download,
  ListTree,
  Search,
  Table2,
  Terminal,
  X,
  AlertCircle,
} from "lucide-react";
import { api } from "./api";
import { Shortcut, useCommandActions, useCommandHints } from "./commands";
import type { RunResult, ValueNode } from "./types";
import { csv, cellText } from "./csv";
const appFailureClasses = new Set([
  "ConfigurationError",
  "CompilerError",
  "ExecutionError",
  "InputLimit",
  "TransportError",
  "Timeout",
  "ProcessExit",
  "TinkerCraft\\Runtime\\BootstrapError",
]);
export function plain(node: ValueNode | null | undefined): any {
  if (!node) return null;
  if (node.children) {
    if (node.list) return node.children.map((e) => plain(e.value));
    return Object.fromEntries(
      node.children.map((e) => [e.key, plain(e.value)]),
    );
  }
  if (node.type === "array" || node.type === "object")
    return node.list ? [] : {};
  return node.type === "null" ? null : (node.value ?? node.class ?? node.type);
}
const preview = (node: ValueNode): string => {
  if (node.type === "limit") return tr("Inspection limit");
  if (node.type === "reference") return tr("Circular reference");
  if (node.children || node.type === "array" || node.type === "object")
    return `${node.class?.split("\\").pop() ?? "array"} ${node.list ? "[" : "{"}${node.count ?? node.children?.length ?? 0}${node.list ? "]" : "}"}`;
  if (node.type === "string") return JSON.stringify(node.value);
  if (node.type === "null") return "null";
  return String(node.value ?? node.class ?? node.type);
};
function TreeNode({
  node,
  label,
  depth = 0,
  expand,
  depthLimit = 2,
}: {
  node: ValueNode;
  label?: string;
  depth?: number;
  expand: number;
  depthLimit?: number;
}) {
  const [open, setOpen] = useState(depth < depthLimit);
  const hasChildren = Boolean(node.children?.length);
  return (
    <div className="tree-node">
      <button
        className={`tree-line ${hasChildren ? "expandable" : ""}`}
        style={{ paddingLeft: depth * 18 + 12 }}
        onClick={() => hasChildren && setOpen(!open)}
        aria-expanded={hasChildren ? open : undefined}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" && hasChildren) {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === "ArrowLeft" && hasChildren) {
            event.preventDefault();
            setOpen(false);
          }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const nodes = Array.from(
              event.currentTarget
                .closest(".tree-view")
                ?.querySelectorAll<HTMLButtonElement>(".tree-line") ?? [],
            ).filter((el) => el.offsetParent !== null);
            const index = nodes.indexOf(event.currentTarget);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? nodes.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        nodes.length - 1,
                        index + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    );
            nodes[next]?.focus();
          }
        }}
      >
        <span className="tree-chevron">
          {hasChildren ? (
            open ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span className="tree-dot" />
          )}
        </span>
        {label !== undefined && (
          <span className="tree-key">
            {label}
            <span className="colon">:</span>
          </span>
        )}
        <span className={`tree-value value-${node.type}`}>{preview(node)}</span>
        {node.class && (
          <span className="tree-type" title={node.class}>
            {node.class}
          </span>
        )}
        {node.truncated && <span className="limit-tag">{tr("partial")}</span>}
      </button>
      {open &&
        node.children?.map((entry, i) => (
          <TreeNode
            key={`${entry.key}-${i}`}
            node={entry.value}
            label={entry.key}
            depth={depth + 1}
            expand={expand}
            depthLimit={depthLimit}
          />
        ))}
    </div>
  );
}
function DataTable({
  node,
  notify,
  activate,
  commandsEnabled,
}: {
  node: ValueNode;
  notify: (text: string) => void;
  activate: () => void;
  commandsEnabled: boolean;
}) {
  const hints = useCommandHints();
  const table = useRef<HTMLTableElement>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{
    key: string;
    desc: boolean;
  } | null>(null);
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const data = plain(node);
    const list = Array.isArray(data)
      ? data
      : data && typeof data === "object"
        ? Object.entries(data).map(([key, value]) => ({ key, value }))
        : [{ value: data }];
    return list.map((value: any) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? value
        : { value },
    );
  }, [node]);
  const columns = useMemo(
    () => [...new Set<string>(rows.flatMap((row) => Object.keys(row)))],
    [rows],
  );
  const filtered = useMemo(() => {
    const values = rows.filter((row) =>
      Object.values(row).some((value) =>
        cellText(value)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
      ),
    );
    if (sort)
      values.sort((a, b) => {
        const x = a[sort.key],
          y = b[sort.key];
        const order =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : cellText(x ?? "").localeCompare(cellText(y ?? ""), undefined, {
                numeric: true,
              });
        return sort.desc ? -order : order;
      });
    return values;
  }, [rows, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages - 1);
  async function exportCSV() {
    try {
      await api.Export(tr("result.csv"), csv(filtered, columns));
    } catch (error) {
      notify(String(error));
    }
  }
  useCommandActions(
    commandsEnabled
      ? {
          exportCSV,
          nextPage: {
            enabled: currentPage < pages - 1,
            run: () => {
              activate();
              setPage(currentPage + 1);
            },
          },
          previousPage: {
            enabled: currentPage > 0,
            run: () => {
              activate();
              setPage(currentPage - 1);
            },
          },
          sortTable: () => {
            activate();
            const focused = document.activeElement;
            const buttons = Array.from(
              table.current?.querySelectorAll<HTMLButtonElement>("th button") ??
                [],
            );
            const target = buttons.find((b) => b === focused) ?? buttons[0];
            target?.click();
            target?.focus();
          },
        }
      : {},
  );
  return (
    <div className="table-view">
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={14} />
          <input
            data-output-filter
            aria-label={tr("Filter output")}
            placeholder={tr("Filter output…")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          className="icon-button"
          title={hints.title("exportCSV")}
          aria-label={tr("Export CSV")}
          onClick={exportCSV}
        >
          <Download size={15} />
        </button>
      </div>
      <div className="table-scroll">
        <table ref={table}>
          <thead>
            <tr>
              <th className="row-index">#</th>
              {columns.map((column) => (
                <th key={column}>
                  <button
                    title={hints.title(
                      "sortTable",
                      tr("Sort by {0}", [column]),
                    )}
                    onClick={() =>
                      setSort({
                        key: column,
                        desc: sort?.key === column ? !sort.desc : false,
                      })
                    }
                  >
                    {column}
                    {sort?.key === column && (
                      <span>{sort.desc ? " ↓" : " ↑"}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * 25, currentPage * 25 + 25)
              .map((row, i) => (
                <tr key={i}>
                  <td className="row-index">{currentPage * 25 + i + 1}</td>
                  {columns.map((column) => (
                    <td key={column} title={cellText(row[column] ?? "")}>
                      <span
                        className={
                          typeof row[column] === "boolean" ? "table-bool" : ""
                        }
                      >
                        {typeof row[column] === "boolean" ? (
                          <>
                            <span
                              className={`boolean-dot ${row[column] ? "yes" : "no"}`}
                            />
                            {String(row[column])}
                          </>
                        ) : (
                          cellText(row[column] ?? "—")
                        )}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-small">
            {tr("No results match this filter.")}
          </div>
        )}
      </div>
      <footer className="table-footer">
        <span>
          {filtered.length}{" "}
          {filtered.length === 1 ? tr("record") : tr("records")}
        </span>
        <div>
          <button
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            {tr("Previous") + " "}
            <Shortcut id="previousPage" />
          </button>
          <span>
            {currentPage + 1} / {pages}
          </span>
          <button
            disabled={currentPage >= pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            {tr("Next") + " "}
            <Shortcut id="nextPage" />
          </button>
        </div>
      </footer>
    </div>
  );
}
export function Output({
  result,
  running,
  clear,
  notify,
  hide,
  visible = true,
}: {
  result?: RunResult;
  running: boolean;
  clear: () => void;
  notify: (message: string) => void;
  hide: () => void;
  visible?: boolean;
}) {
  const [mode, setMode] = useState<"tree" | "table" | "json">("tree");
  const hints = useCommandHints();
  const [expand, setExpand] = useState(0);
  const [depthLimit, setDepthLimit] = useState(2);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState(-1);
  const dumps = result?.dumps ?? [];
  const dumpIndex =
    selected >= 0 && dumps[selected]
      ? selected
      : result?.value
        ? -1
        : dumps.length - 1;
  const node = dumpIndex >= 0 ? dumps[dumpIndex] : result?.value;
  const json = JSON.stringify(plain(node), null, 2);
  async function copy() {
    try {
      await api.Copy(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      notify(String(e));
    }
  }
  function changeDump(offset: number) {
    const choices = [
      ...(result?.value ? [-1] : []),
      ...dumps.map((_, index) => index),
    ];
    if (!choices.length) return;
    setSelected(
      choices[
        (choices.indexOf(dumpIndex) + offset + choices.length) % choices.length
      ],
    );
  }
  function openTree(depth = 2) {
    setMode("tree");
    setDepthLimit(depth);
    setExpand((value) => value + 1);
  }
  useCommandActions(
    visible
      ? {
          tree: () => setMode("tree"),
          table: () => setMode("table"),
          json: () => setMode("json"),
          copyOutput: { enabled: Boolean(node), run: copy },
          clearOutput: { enabled: Boolean(result), run: clear },
          expandTree: { enabled: Boolean(node), run: () => openTree() },
          collapseTree: { enabled: Boolean(node), run: () => openTree(0) },
          filterOutput: {
            enabled: Boolean(node),
            run: () => {
              setMode("table");
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLInputElement>("[data-output-filter]")
                  ?.focus(),
              );
            },
          },
          nextDump: { enabled: dumps.length > 0, run: () => changeDump(1) },
          previousDump: {
            enabled: dumps.length > 0,
            run: () => changeDump(-1),
          },
        }
      : {},
  );
  return (
    <section
      className="output-panel"
      hidden={!visible}
      aria-label={tr("Output")}
      tabIndex={-1}
    >
      <div className="output-tabs">
        <div>
          {(
            [
              { id: "tree", title: tr("Inspect"), icon: ListTree },
              { id: "table", title: tr("Table"), icon: Table2 },
              { id: "json", title: "JSON", icon: Braces },
            ] as const
          ).map((item) => (
            <button
              className={mode === item.id ? "active" : ""}
              key={item.id}
              title={hints.title(item.id, item.title)}
              aria-label={item.title}
              onClick={() => setMode(item.id)}
            >
              <item.icon size={14} />
              {item.title} <Shortcut id={item.id} />
            </button>
          ))}
        </div>
        <div className="output-tools">
          {node && mode === "tree" && (
            <button
              className="icon-button"
              title={hints.title("expandTree")}
              aria-label={tr("Reopen tree")}
              onClick={() => openTree()}
            >
              <ListTree size={16} />
            </button>
          )}
          <button
            className="icon-button"
            disabled={!node}
            onClick={copy}
            title={hints.title("copyOutput")}
            aria-label={tr("Copy JSON")}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            className="icon-button"
            onClick={hide}
            title={hints.title("toggleOutput", tr("Hide output"))}
            aria-label={tr("Hide output")}
          >
            <X size={17} />
          </button>
        </div>
      </div>
      <div className="output-content">
        {running && (
          <div className="running-banner">
            <span className="spinner" />
            {tr("Running in the selected environment…")}
          </div>
        )}
        {!result && !running && (
          <div className="output-empty">
            <div className="empty-symbol">
              <Terminal size={27} strokeWidth={1.3} />
            </div>
            <p>{tr("Run a snippet to see its output.")}</p>
            <span className="shortcut-hint">
              <Shortcut id="run" />
            </span>
          </div>
        )}
        {result?.error && (
          <div
            className={`error-card ${result.cancelled ? "cancelled-card" : ""}`}
          >
            <div>
              <AlertCircle size={16} />
              <strong>{result.error.class}</strong>
              {result.error.line > 0 && (
                <span>
                  {tr("line") + " "}
                  {result.error.line}
                </span>
              )}
            </div>
            <p>
              {appFailureClasses.has(result.error.class)
                ? translateStatus(result.error.message)
                : result.error.message}
            </p>
            {result.error.file && (
              <small>
                {result.error.file.includes("eval()'d code")
                  ? tr("Evaluated snippet")
                  : result.error.file}
              </small>
            )}
            {result.error.trace && (
              <details>
                <summary>{tr("Stack trace")}</summary>
                <pre>{result.error.trace}</pre>
              </details>
            )}
          </div>
        )}
        {(dumps.length > 0 || result?.value) && result && (
          <>
            {dumps.length > 0 && (
              <div className="dump-selector">
                {result?.value && (
                  <button
                    className={dumpIndex === -1 ? "active" : ""}
                    onClick={() => setSelected(-1)}
                  >
                    {tr("Return")}
                  </button>
                )}
                {dumps.map((_, i) => (
                  <button
                    className={dumpIndex === i ? "active" : ""}
                    key={i}
                    onClick={() => setSelected(i)}
                  >
                    dump {i + 1}
                  </button>
                ))}
              </div>
            )}
            {node && (
              <div className="value-container">
                {mode === "tree" ? (
                  <div className="tree-view">
                    <div className="value-label">
                      <span>
                        {dumpIndex >= 0
                          ? `DUMP ${dumpIndex + 1}`
                          : tr("RETURN VALUE")}
                      </span>
                      <span>{node.class ?? node.type}</span>
                    </div>
                    <TreeNode
                      key={`${expand}-${JSON.stringify(node).slice(0, 80)}`}
                      node={node}
                      expand={expand}
                      depthLimit={depthLimit}
                    />
                  </div>
                ) : mode === "json" ? (
                  <pre className="json-view">{json}</pre>
                ) : null}
                <div hidden={mode !== "table"} className="table-container">
                  <DataTable
                    commandsEnabled={visible}
                    key={dumpIndex}
                    node={node}
                    notify={notify}
                    activate={() => setMode("table")}
                  />
                </div>
              </div>
            )}
          </>
        )}
        {result?.stdout && (
          <div className="text-output">
            <div>
              <Terminal size={13} />
              {tr("STANDARD OUTPUT")}
            </div>
            <pre>{result.stdout}</pre>
          </div>
        )}
        {result?.stderr && (
          <div className="text-output stderr">
            <div>STDERR</div>
            <pre>{result.stderr}</pre>
          </div>
        )}
        {(result?.warnings ?? []).map((warning, i) => (
          <div className="warning-card" key={i}>
            {warning}
          </div>
        ))}
        {result?.truncated && (
          <div className="warning-card">
            {tr(
              "Inspection was limited to keep the app responsive. Displayed results and exports are partial.",
            )}
          </div>
        )}
      </div>
      <div className="result-footer">
        {result ? (
          <>
            <span className={result.success ? "success-text" : "muted"}>
              {result.cancelled
                ? tr("Cancelled")
                : result.success
                  ? tr("Execution completed")
                  : tr("Execution failed")}
            </span>
            <span>
              {result.durationMs.toLocaleString(formatLocale())} ms <i />
              {(result.memoryBytes / 1048576).toLocaleString(formatLocale(), {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              MB
            </span>
          </>
        ) : (
          <>
            <span>{tr("Ready when you are.")}</span>
            <span>PHP / Laravel</span>
          </>
        )}
      </div>
    </section>
  );
}
