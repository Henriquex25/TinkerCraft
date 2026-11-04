declare module "*?raw" {
  const content: string;
  export default content;
}
declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*?worker&inline" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

declare module "monaco-editor/languages/definitions/php/php.js" {
  export const conf: any;
  export const language: any;
}
