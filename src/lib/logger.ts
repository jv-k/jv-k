/**
 * @fileoverview Shared logger factory with elegant, minimal output
 * @author John Valai <git@jvk.to>
 */

import pino from 'pino';
import type { Logger } from 'pino';

/**
 * Creates a pino logger with clean, minimal output
 * @param silent - Suppress all log output
 * @returns Configured pino logger instance
 */
export function createLogger(silent = false): Logger {
  if (silent) {
    return pino({ level: 'silent' });
  }

  return pino({
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname,time',
        messageFormat: '{msg}',
        hideObject: false,
      },
    },
  });
}

export type { Logger };
