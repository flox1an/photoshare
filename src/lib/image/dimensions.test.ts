import { describe, it, expect } from 'vitest';
import { fitToLongEdge } from '@/lib/image/dimensions';

/**
 * Wave 0 test scaffold for resize math (PROC-04) and thumbnail sizing (PROC-06).
 * These tests are RED — fitToLongEdge is not yet implemented.
 * Plans 02-02+ will implement the function and turn these GREEN.
 */

describe('fitToLongEdge — resize math', () => {
  it('scales landscape 4032x3024 to fit within 2560 long edge', () => {
    expect(fitToLongEdge(4032, 3024, 2560)).toEqual({ w: 2560, h: 1920 });
  });

  it('scales portrait 3024x4032 to fit within 2560 long edge', () => {
    expect(fitToLongEdge(3024, 4032, 2560)).toEqual({ w: 1920, h: 2560 });
  });

  it('does not upscale 1920x1080 when max is 2560', () => {
    expect(fitToLongEdge(1920, 1080, 2560)).toEqual({ w: 1920, h: 1080 });
  });

  it('scales landscape 4032x3024 to thumbnail 300 long edge', () => {
    expect(fitToLongEdge(4032, 3024, 300)).toEqual({ w: 300, h: 225 });
  });

  it('scales portrait 3024x4032 to thumbnail 300 long edge', () => {
    expect(fitToLongEdge(3024, 4032, 300)).toEqual({ w: 225, h: 300 });
  });

  it('does not upscale 100x100 square when max is 300', () => {
    expect(fitToLongEdge(100, 100, 300)).toEqual({ w: 100, h: 100 });
  });
});
