import FormatWorker from "./format-worker?worker&inline";
import type { FormattingRules } from "./formatting-rules";

export function requestPHPFormat(
  code: string,
  rules: FormattingRules,
  token: {
    isCancellationRequested: boolean;
    onCancellationRequested: (callback: () => void) => { dispose: () => void };
  },
): Promise<string | undefined> {
  if (token.isCancellationRequested) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const worker = new FormatWorker();
    const finish = (result?: string, error?: string) => {
      clearTimeout(timer);
      subscription.dispose();
      worker.terminate();
      if (error) reject(new Error(error));
      else resolve(result);
    };
    const timer = setTimeout(
      () =>
        finish(undefined, "PHP formatting timed out. Try a smaller snippet."),
      10000,
    );
    const subscription = token.onCancellationRequested(() => finish());
    worker.onmessage = (event) => finish(event.data.code, event.data.error);
    worker.onerror = () =>
      finish(undefined, "The PHP formatter could not start.");
    worker.postMessage({ code, rules });
  });
}
