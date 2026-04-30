/**
 * Tests for vintage-aware aging in style inference.
 *
 * Confirms that:
 * - Tannins soften progressively with age (high → medium @ 12y → low @ 25y)
 * - Body lightens at very advanced age (full → medium @ 40y, medium → light @ 60y)
 * - Acidity is unchanged
 * - Non-red wines and missing vintage return base unchanged
 */
import { describe, it, expect } from 'vitest';
import { applyAging, inferWineStyle, type WineStyle } from '../../lib/matching-agent/style-inference';

const CURRENT_YEAR = new Date().getFullYear();

const youngFullCab: WineStyle = { body: 'full', tannin: 'high', acidity: 'medium' };

describe('applyAging', () => {
  it('returns base unchanged when vintage is null/0/undefined', () => {
    expect(applyAging(youngFullCab, null, 'red')).toEqual(youngFullCab);
    expect(applyAging(youngFullCab, 0, 'red')).toEqual(youngFullCab);
    expect(applyAging(youngFullCab, undefined, 'red')).toEqual(youngFullCab);
  });

  it('returns base unchanged for non-red wines (white, sparkling, etc)', () => {
    expect(applyAging(youngFullCab, 1990, 'white')).toEqual(youngFullCab);
    expect(applyAging(youngFullCab, 1990, 'sparkling')).toEqual(youngFullCab);
    expect(applyAging(youngFullCab, 1990, 'rose')).toEqual(youngFullCab);
  });

  it('keeps young red wines (<8 years) unchanged', () => {
    expect(applyAging(youngFullCab, CURRENT_YEAR - 5, 'red')).toEqual(youngFullCab);
  });

  it('softens high tannin to medium at 12-year threshold', () => {
    const result = applyAging(youngFullCab, CURRENT_YEAR - 13, 'red');
    expect(result.tannin).toBe('medium');
    expect(result.body).toBe('full'); // body unchanged at this age
  });

  it('softens high tannin to low at 25-year threshold', () => {
    const result = applyAging(youngFullCab, CURRENT_YEAR - 25, 'red');
    expect(result.tannin).toBe('low');
  });

  it('softens medium tannin to low at 25-year threshold', () => {
    const result = applyAging({ body: 'medium', tannin: 'medium', acidity: 'medium' }, CURRENT_YEAR - 30, 'red');
    expect(result.tannin).toBe('low');
  });

  it('lightens full body to medium at 40-year threshold', () => {
    const result = applyAging(youngFullCab, CURRENT_YEAR - 40, 'red');
    expect(result.body).toBe('medium');
    expect(result.tannin).toBe('low'); // also dropped per 25y rule
  });

  it('lightens medium body to light at 60-year threshold', () => {
    const result = applyAging(
      { body: 'medium', tannin: 'medium', acidity: 'medium' },
      CURRENT_YEAR - 65,
      'red'
    );
    expect(result.body).toBe('light');
  });

  it('keeps acidity unchanged across all aging scenarios', () => {
    expect(applyAging(youngFullCab, CURRENT_YEAR - 10, 'red').acidity).toBe('medium');
    expect(applyAging(youngFullCab, CURRENT_YEAR - 30, 'red').acidity).toBe('medium');
    expect(applyAging(youngFullCab, CURRENT_YEAR - 60, 'red').acidity).toBe('medium');
  });
});

describe('inferWineStyle with vintage parameter', () => {
  it('a 2024 Cabernet Sauvignon stays full/high/medium', () => {
    const style = inferWineStyle('Cabernet Sauvignon', 'red', 'Bordeaux', undefined, 2024);
    expect(style.body).toBe('full');
    expect(style.tannin).toBe('high');
  });

  it('a 1995 Cabernet Sauvignon (31y) has tannin softened to low', () => {
    const style = inferWineStyle('Cabernet Sauvignon', 'red', 'Bordeaux', undefined, 1995);
    expect(style.tannin).toBe('low');
    expect(style.body).toBe('full'); // not yet 40y
  });

  it('a 1959 Cabernet Sauvignon (67y) has tannin low and body lightened', () => {
    const style = inferWineStyle('Cabernet Sauvignon', 'red', 'Bordeaux', undefined, 1959);
    expect(style.tannin).toBe('low');
    expect(style.body).toBe('medium'); // dropped from full at 40y
  });

  it('falls back to color defaults with applyAging when no grape match', () => {
    const style = inferWineStyle('', 'red', undefined, undefined, 1985);
    // Color default for red varies; just confirm vintage influence applied
    expect(['low', 'medium']).toContain(style.tannin);
  });

  it('a 2024 Pinot Noir is light/medium/high (unaged)', () => {
    const style = inferWineStyle('Pinot Noir', 'red', undefined, undefined, 2024);
    expect(style.body).toBe('light');
    expect(style.tannin).toBe('medium');
  });

  it('a 1990 Pinot Noir (36y) has tannin softened to low', () => {
    const style = inferWineStyle('Pinot Noir', 'red', undefined, undefined, 1990);
    expect(style.tannin).toBe('low');
  });
});
