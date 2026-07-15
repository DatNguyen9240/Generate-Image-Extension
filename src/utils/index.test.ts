import { describe, expect, it } from 'vitest';
import { sanitizeText } from './index';

describe('prompt utilities', () => {
  it('sanitizes control characters', () => expect(sanitizeText('safe\u0000 text')).toBe('safe text'));
});
