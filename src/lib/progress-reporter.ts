/**
 * @fileoverview Progress reporter for terminal output
 *
 * Provides a clean, testable interface for reporting progress during
 * batch operations like icon fetching.
 *
 * @author John Valai <git@jvk.to>
 */

// ============================================================================
// Types
// ============================================================================

export type ProgressStatus = 'fetched' | 'cached' | 'fallback' | 'failed';

export interface ProgressReporter {
  /** Report a single item completion */
  tick(status: ProgressStatus): void;
  /** Finalize progress output */
  done(): void;
  /** Get current counts */
  getCounts(): ProgressCounts;
}

export interface ProgressCounts {
  fetched: number;
  cached: number;
  fallback: number;
  failed: number;
  total: number;
}

export interface ProgressReporterOptions {
  /** Total number of items to process */
  total: number;
  /** Number of items per line before wrapping (default: 50) */
  lineWidth?: number;
  /** Custom output function for testing (default: process.stdout.write) */
  write?: (text: string) => void;
  /** Suppress all output */
  silent?: boolean;
}

// ============================================================================
// Status Symbols
// ============================================================================

const STATUS_SYMBOLS: Record<ProgressStatus, string> = {
  fetched: '+',
  cached: '.',
  fallback: 'v',
  failed: 'x',
};

// ============================================================================
// ProgressReporter Implementation
// ============================================================================

/**
 * Creates a progress reporter for tracking batch operation status.
 *
 * Output format:
 * - '+' = newly fetched from latest version
 * - '.' = cached (reused existing)
 * - 'v' = fetched from older version (fallback)
 * - 'x' = failed (placeholder created)
 *
 * @example
 * ```typescript
 * const progress = createProgressReporter({ total: 100 });
 * for (const item of items) {
 *   await processItem(item);
 *   progress.tick('fetched');
 * }
 * progress.done();
 * ```
 */
export function createProgressReporter(options: ProgressReporterOptions): ProgressReporter {
  const { total, lineWidth = 50, write = (t) => process.stdout.write(t), silent = false } = options;

  let current = 0;
  const counts: ProgressCounts = {
    fetched: 0,
    cached: 0,
    fallback: 0,
    failed: 0,
    total,
  };

  return {
    tick(status: ProgressStatus): void {
      current++;
      counts[status]++;

      if (silent) return;

      write(STATUS_SYMBOLS[status]);

      // Add progress indicator at line width intervals
      if (current % lineWidth === 0) {
        write(` [${current}/${total}]\n`);
      }
    },

    done(): void {
      if (silent) return;

      // Complete the line if we're not at a line boundary
      if (current % lineWidth !== 0) {
        write(` [${current}/${total}]\n`);
      }
    },

    getCounts(): ProgressCounts {
      return { ...counts };
    },
  };
}

/**
 * Creates a silent progress reporter that tracks counts but produces no output.
 * Useful for testing or programmatic usage.
 */
export function createSilentProgressReporter(total: number): ProgressReporter {
  return createProgressReporter({ total, silent: true });
}
