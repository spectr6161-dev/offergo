declare module "lodash/cloneDeep.js" {
  const cloneDeep: <T>(value: T) => T;
  export default cloneDeep;
}

declare module "lodash/debounce.js" {
  const debounce: <T extends (...args: never[]) => unknown>(
    func: T,
    wait?: number,
    options?: unknown
  ) => T & { cancel: () => void; flush: () => ReturnType<T> };
  export default debounce;
}
