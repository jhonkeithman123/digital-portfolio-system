declare interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_URL_LOCAL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BASE?: string;
  readonly BASE_URL?: string;
  readonly PUBLIC_URL?: string;
  readonly MODE?: string;
  readonly REACT_APP_API_URL?: string;
}
declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
