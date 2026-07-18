import { describe, expect, it } from 'vitest';
import { normalizeArabic, normalizeWithMap } from '../../src/core';

describe('normalizeArabic — Latin rules', () => {
  it('strips Latin combining diacritics: Sáleh == saleh', () => {
    expect(normalizeArabic('Sáleh')).toBe('saleh');
  });

  it('treats precomposed and decomposed forms equally (NFC/NFD)', () => {
    const precomposed = 'Sáleh'; // á as one char
    const decomposed = 'Sáleh'; // a + combining acute
    expect(normalizeArabic(precomposed)).toBe(normalizeArabic(decomposed));
    expect(normalizeArabic(decomposed)).toBe('saleh');
  });

  it('lowercases Latin', () => {
    expect(normalizeArabic('JOHN Doe')).toBe('john doe');
    expect(normalizeArabic('APPLEJOHN')).toBe('applejohn');
  });

  it('keeps diacritics when the rule is off', () => {
    expect(normalizeArabic('Sáleh', { stripLatinDiacritics: false })).toBe('sáleh');
  });

  it('keeps case when lowercase is off', () => {
    expect(normalizeArabic('John', { lowercase: false })).toBe('John');
  });
});

describe('normalizeArabic — tashkeel / harakat', () => {
  it('normalizes all spellings of Muhammad equally', () => {
    const a = normalizeArabic('مُحَمَّد'); // full harakat + shadda
    const b = normalizeArabic('محمّد'); // shadda only
    const c = normalizeArabic('محمد'); // bare
    expect(a).toBe('محمد');
    expect(b).toBe('محمد');
    expect(c).toBe('محمد');
  });

  it('strips tanween and sukun (U+064B–U+065F)', () => {
    expect(normalizeArabic('كتابٌ')).toBe('كتاب');
    expect(normalizeArabic('بِسْمِ')).toBe('بسم');
  });

  it('strips superscript alef U+0670 (رحمٰن)', () => {
    expect(normalizeArabic('رحمٰن')).toBe('رحمن');
  });

  it('strips marks from the U+0610–U+061A block', () => {
    expect(normalizeArabic('محمدؐ')).toBe('محمد');
  });

  it('strips Quranic annotation marks U+06D6–U+06ED subranges', () => {
    expect(normalizeArabic('قلۖ')).toBe('قل');
    expect(normalizeArabic('قلۡ')).toBe('قل');
    expect(normalizeArabic('قل۫')).toBe('قل');
  });

  it('keeps tashkeel when the rule is off', () => {
    expect(normalizeArabic('مُحمد', { stripTashkeel: false })).toBe('مُحمد');
  });
});

describe('normalizeArabic — tatweel', () => {
  it('strips tatweel/kashida', () => {
    expect(normalizeArabic('محـــمد')).toBe('محمد');
  });

  it('keeps tatweel when the rule is off', () => {
    expect(normalizeArabic('محـمد', { stripTatweel: false })).toBe('محـمد');
  });
});

describe('normalizeArabic — alef forms', () => {
  it('unifies hamza-above alef: أحمد → احمد', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
  });

  it('unifies hamza-below alef: إبراهيم → ابراهيم', () => {
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
  });

  it('unifies madda alef: آمنة → امنه', () => {
    expect(normalizeArabic('آمنة')).toBe('امنه');
  });

  it('unifies wasla alef: ٱلله → الله', () => {
    expect(normalizeArabic('ٱلله')).toBe('الله');
  });

  it('makes أحمد, احمد and إحمد spellings equal', () => {
    expect(normalizeArabic('أحمد')).toBe(normalizeArabic('احمد'));
    expect(normalizeArabic('إحمد')).toBe(normalizeArabic('احمد'));
  });

  it('keeps alef forms when the rule is off', () => {
    expect(normalizeArabic('أحمد', { unifyAlef: false })).toBe('أحمد');
  });
});

describe('normalizeArabic — alef maqsura', () => {
  it('على and علي normalize equal (ى → ي)', () => {
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('على')).toBe(normalizeArabic('علي'));
  });

  it('مصطفى → مصطفي', () => {
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
  });

  it('keeps ى when the rule is off', () => {
    expect(normalizeArabic('مصطفى', { unifyAlefMaqsura: false })).toBe('مصطفى');
  });
});

describe('normalizeArabic — ta marbuta', () => {
  it('فاطمة → فاطمه', () => {
    expect(normalizeArabic('فاطمة')).toBe('فاطمه');
  });

  it('keeps ة when the rule is off (some users want this)', () => {
    expect(normalizeArabic('فاطمة', { unifyTaMarbuta: false })).toBe('فاطمة');
  });
});

describe('normalizeArabic — hamza carriers', () => {
  it('ؤ → و (مؤمن → مومن)', () => {
    expect(normalizeArabic('مؤمن')).toBe('مومن');
  });

  it('ئ → ي (هيئة → هييه)', () => {
    expect(normalizeArabic('هيئة')).toBe('هييه');
  });

  it('drops standalone hamza (شيء → شي)', () => {
    expect(normalizeArabic('شيء')).toBe('شي');
  });

  it('keeps hamza forms when the rule is off', () => {
    expect(normalizeArabic('مؤمن', { unifyHamzaCarriers: false })).toBe('مؤمن');
    expect(normalizeArabic('شيء', { unifyHamzaCarriers: false })).toBe('شيء');
  });
});

describe('normalizeArabic — digits', () => {
  it('maps Arabic-Indic digits ٠–٩ to 0–9', () => {
    expect(normalizeArabic('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('maps Eastern Arabic-Indic digits ۰–۹ to 0–9', () => {
    expect(normalizeArabic('۰۱۸۹')).toBe('0189');
  });

  it('keeps native digits when the rule is off', () => {
    expect(normalizeArabic('٥', { unifyDigits: false })).toBe('٥');
  });
});

describe('normalizeArabic — whitespace', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(normalizeArabic('  صالح \t\t محفوظ \n داهي  ')).toBe('صالح محفوظ داهي');
  });

  it('keeps whitespace when the rule is off', () => {
    expect(normalizeArabic('a  b', { collapseWhitespace: false })).toBe('a  b');
  });
});

describe('normalizeArabic — combinations & properties', () => {
  it('handles a fully decorated real name', () => {
    expect(normalizeArabic('مُحَمَّدُ بْنُ عَبْدِ ٱللَّهِ')).toBe('محمد بن عبد الله');
  });

  it('is idempotent', () => {
    for (const s of ['مُحَمَّد', 'Sáleh Mahfoud', 'أحمد على فاطمة ٥', 'هيئة  شيء']) {
      const once = normalizeArabic(s);
      expect(normalizeArabic(once)).toBe(once);
    }
  });

  it('returns empty string for empty/whitespace-only input', () => {
    expect(normalizeArabic('')).toBe('');
    expect(normalizeArabic('   ')).toBe('');
  });
});

describe('normalizeWithMap — offset mapping', () => {
  it('maps each normalized char back to its source char', () => {
    const { norm, source, starts, ends } = normalizeWithMap('مُحَمَّد');
    expect(norm).toBe('محمد');
    expect(starts.length).toBe(norm.length);
    // First normalized char maps to source index 0 (م).
    expect(starts[0]).toBe(0);
    // Last normalized char (د) is the last source char.
    expect(source[starts[3] as number]).toBe('د');
    expect(ends[3]).toBe(source.length);
  });

  it('maps through whitespace collapse', () => {
    const { norm, starts } = normalizeWithMap('صالح   داهي');
    expect(norm).toBe('صالح داهي');
    // The single space maps into the original whitespace run.
    expect(starts[4]).toBe(4);
    // 'د' after the collapsed run maps past the run.
    expect(starts[5]).toBe(7);
  });

  it('keeps map alignment for mapped chars (أ→ا)', () => {
    const { norm, source, starts, ends } = normalizeWithMap('أحمد');
    expect(norm).toBe('احمد');
    expect(source.slice(starts[0] as number, ends[0] as number)).toBe('أ');
  });
});
