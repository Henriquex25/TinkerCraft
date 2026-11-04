import { formatPHP } from "./format-php";

self.onmessage = async (event: MessageEvent) => {
  try {
    const { code, rules } = event.data;
    self.postMessage({ code: await formatPHP(code, rules) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
