import { describe, expect, it } from 'vitest';
import { findSubmitControl } from './submit';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
  toJSON: () => ({}),
} as DOMRect);

describe('findSubmitControl', () => {
  it('prefers a semantic submit control', () => {
    document.body.innerHTML = '<form><textarea></textarea><button type="submit">Go</button></form>';
    const editor = document.querySelector('textarea')!;
    const button = document.querySelector('button')!;
    button.getBoundingClientRect = () => rect(200, 20, 40, 40);
    expect(findSubmitControl(editor)).toBe(button);
  });

  it('uses the right-most nearby button when Grok has no send attributes', () => {
    document.body.innerHTML = '<div><textarea></textarea><button id="plus">+</button><button id="mic" aria-label="Microphone"></button><button id="arrow"></button></div>';
    const editor = document.querySelector('textarea')!;
    const plus = document.querySelector<HTMLElement>('#plus')!;
    const mic = document.querySelector<HTMLElement>('#mic')!;
    const arrow = document.querySelector<HTMLElement>('#arrow')!;
    editor.getBoundingClientRect = () => rect(50, 50, 800, 120);
    plus.getBoundingClientRect = () => rect(60, 130, 40, 40);
    mic.getBoundingClientRect = () => rect(760, 130, 40, 40);
    arrow.getBoundingClientRect = () => rect(810, 125, 44, 44);
    expect(findSubmitControl(editor)).toBe(arrow);
  });
});
