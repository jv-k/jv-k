/**
 * @fileoverview Tests for ProgressReporter
 * @author John Valai <git@jvk.to>
 */

import { describe, test, expect } from 'bun:test';
import {
  createProgressReporter,
  createSilentProgressReporter,
} from '../src/lib/progress-reporter.js';

describe('ProgressReporter', () => {
  describe('createProgressReporter', () => {
    test('should write correct symbols for each status', () => {
      const output: string[] = [];
      const progress = createProgressReporter({
        total: 4,
        lineWidth: 100, // Prevent line breaks
        write: (text) => output.push(text),
      });

      progress.tick('fetched');
      progress.tick('cached');
      progress.tick('fallback');
      progress.tick('failed');

      expect(output).toContain('+');
      expect(output).toContain('.');
      expect(output).toContain('v');
      expect(output).toContain('x');
    });

    test('should wrap at lineWidth intervals', () => {
      const output: string[] = [];
      const progress = createProgressReporter({
        total: 60,
        lineWidth: 10,
        write: (text) => output.push(text),
      });

      // Process 25 items
      for (let i = 0; i < 25; i++) {
        progress.tick('fetched');
      }

      // Should have wrapped at 10 and 20
      const lineBreaks = output.filter((s) => s.includes('\n'));
      expect(lineBreaks.length).toBe(2);
      expect(output.some((s) => s.includes('[10/60]'))).toBe(true);
      expect(output.some((s) => s.includes('[20/60]'))).toBe(true);
    });

    test('should complete line on done()', () => {
      const output: string[] = [];
      const progress = createProgressReporter({
        total: 15,
        lineWidth: 10,
        write: (text) => output.push(text),
      });

      for (let i = 0; i < 15; i++) {
        progress.tick('fetched');
      }
      progress.done();

      // Should have final line break with count
      const lastOutput = output[output.length - 1];
      expect(lastOutput).toContain('[15/15]');
      expect(lastOutput).toContain('\n');
    });

    test('should not add extra line break if already at boundary', () => {
      const output: string[] = [];
      const progress = createProgressReporter({
        total: 10,
        lineWidth: 10,
        write: (text) => output.push(text),
      });

      for (let i = 0; i < 10; i++) {
        progress.tick('fetched');
      }

      const outputBeforeDone = [...output];
      progress.done();

      // done() should not add anything since we ended at boundary
      expect(output.length).toBe(outputBeforeDone.length);
    });

    test('should track counts correctly', () => {
      const progress = createProgressReporter({
        total: 10,
        silent: true,
      });

      progress.tick('fetched');
      progress.tick('fetched');
      progress.tick('cached');
      progress.tick('fallback');
      progress.tick('failed');

      const counts = progress.getCounts();
      expect(counts.fetched).toBe(2);
      expect(counts.cached).toBe(1);
      expect(counts.fallback).toBe(1);
      expect(counts.failed).toBe(1);
      expect(counts.total).toBe(10);
    });
  });

  describe('createSilentProgressReporter', () => {
    test('should not produce any output', () => {
      // This would throw if it tried to write to stdout
      const progress = createSilentProgressReporter(100);

      for (let i = 0; i < 100; i++) {
        progress.tick('fetched');
      }
      progress.done();

      // Should still track counts
      expect(progress.getCounts().fetched).toBe(100);
    });

    test('should track counts correctly', () => {
      const progress = createSilentProgressReporter(10);

      progress.tick('fetched');
      progress.tick('cached');
      progress.tick('fallback');
      progress.tick('failed');

      const counts = progress.getCounts();
      expect(counts.fetched).toBe(1);
      expect(counts.cached).toBe(1);
      expect(counts.fallback).toBe(1);
      expect(counts.failed).toBe(1);
    });
  });
});
