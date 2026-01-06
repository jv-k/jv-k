/**
 * Type declarations for node-yaml-config
 * @see https://www.npmjs.com/package/node-yaml-config
 */

declare module 'node-yaml-config' {
  /**
   * Load a YAML configuration file
   * @param path - Path to the YAML config file
   * @param env - Optional environment name to load specific config section
   * @returns The parsed configuration object
   */
  export function load<T = Record<string, unknown>>(path: string, env?: string): T;

  /**
   * Reload configuration from the same file
   * @returns The reloaded configuration object
   */
  export function reload<T = Record<string, unknown>>(): T;
}
