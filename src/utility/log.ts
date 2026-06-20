export const log = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug(...args)
  },
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
}
