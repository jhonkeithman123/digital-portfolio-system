declare module "marked" {
  export function parse(src: string, options?: any): string;
  export const marked: { parse: typeof parse };
  export default marked;
}
