declare interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BASE?: string;
}
declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
