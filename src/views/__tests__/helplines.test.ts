import { describe, expect, it } from 'vitest';
import helplines from '../../../data/helplines.json';

type Localized = { zh: string; en: string };
type Entry = { name: Localized; detail?: Localized; contact?: string | Localized | null; source?: string | null };
type Region = { label: Localized; help: Entry[]; fraud: Entry[] };

const regions = helplines.regions as unknown as Record<string, Region>;
const entries = Object.entries(regions).flatMap(([key, r]) => [...r.help, ...r.fraud].map((e) => ({ key, e })));

/** 公开号码，不需要逐条附出处 */
const WELL_KNOWN = new Set(['110']);

describe('data/helplines.json', () => {
  it('every entry with a contact links to an official https source', () => {
    for (const { key, e } of entries) {
      if (e.contact == null || (typeof e.contact === 'string' && WELL_KNOWN.has(e.contact))) continue;
      expect(e.source, `${key}: ${e.name.zh}`).toMatch(/^https:\/\//);
    }
  });

  it('every entry has both languages', () => {
    for (const { key, e } of entries) {
      for (const field of [e.name, e.detail].filter(Boolean) as Localized[]) {
        expect(field.zh.trim(), `${key}: ${e.name.en}`).not.toBe('');
        expect(field.en.trim(), `${key}: ${e.name.zh}`).not.toBe('');
      }
    }
  });

  it('Chinese text is Simplified (the site is zh-CN)', () => {
    const traditional = /[東華賭會處輔導熱線臺灣聖務門關為個們時區據]/;
    for (const { key, e } of entries) {
      const zh = [e.name.zh, e.detail?.zh ?? '', typeof e.contact === 'object' && e.contact ? e.contact.zh : ''].join(' ');
      expect(zh, `${key}: ${e.name.en}`).not.toMatch(traditional);
    }
  });

  it('the four tabs on the Ending page all have content', () => {
    for (const key of ['cn', 'us', 'uk', 'other']) {
      expect(regions[key].help.length + regions[key].fraud.length, key).toBeGreaterThan(0);
    }
  });
});
