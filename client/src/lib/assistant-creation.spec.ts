import {
  CLE_MODE_ASSISTANT,
  ETAPES_COMPTE,
  etapesJournal,
  etapeVoisine,
  lireModeAssistant,
  memoriserModeAssistant,
  rangEtape,
} from './assistant-creation';

/**
 * LE MODE ASSISTANT DE CRÉATION (ligne sage-l1, fonction 18) · une
 * préférence du poste, et des étapes qui ne sortent jamais de leur liste.
 */
describe('mode assistant · préférence du poste', () => {
  const g = globalThis as { localStorage?: unknown };
  let avant: PropertyDescriptor | undefined;
  beforeEach(() => {
    avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  });
  afterEach(() => {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant);
    else delete g.localStorage;
  });
  const poser = (valeur: unknown) => Object.defineProperty(globalThis, 'localStorage', { value: valeur, configurable: true, writable: true });

  it('faux par défaut, retenu puis retiré', () => {
    const m = new Map<string, string>();
    poser({
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    });
    expect(lireModeAssistant()).toBe(false);
    memoriserModeAssistant(true);
    expect(m.get(CLE_MODE_ASSISTANT)).toBe('oui');
    expect(lireModeAssistant()).toBe(true);
    memoriserModeAssistant(false);
    expect(m.has(CLE_MODE_ASSISTANT)).toBe(false);
    expect(lireModeAssistant()).toBe(false);
  });

  it('un stockage qui jette (fenêtre privée) ne casse rien · le mode reste faux', () => {
    const jette = () => {
      throw new Error('refusé');
    };
    poser({ getItem: jette, setItem: jette, removeItem: jette });
    expect(lireModeAssistant()).toBe(false);
    expect(() => memoriserModeAssistant(true)).not.toThrow();
  });
});

describe('mode assistant · les étapes', () => {
  it('un compte · numéro et intitulé, type, récapitulatif', () => {
    expect(ETAPES_COMPTE).toEqual(['NUMERO', 'TYPE', 'RECAPITULATIF']);
  });

  it('le compte du journal n’est une étape que pour la trésorerie', () => {
    expect(etapesJournal('GENERAL')).toEqual(['TYPE', 'CODE', 'NUMEROTATION', 'RECAPITULATIF']);
    expect(etapesJournal('TRESORERIE')).toEqual(['TYPE', 'CODE', 'NUMEROTATION', 'COMPTE', 'RECAPITULATIF']);
  });

  it('suivant et précédent restent dans la liste, une étape disparue ramène à la première', () => {
    const e = etapesJournal('GENERAL');
    expect(etapeVoisine(e, 'TYPE', -1)).toBe('TYPE');
    expect(etapeVoisine(e, 'NUMEROTATION', 1)).toBe('RECAPITULATIF');
    expect(etapeVoisine(e, 'RECAPITULATIF', 1)).toBe('RECAPITULATIF');
    // Le type est passé de trésorerie à général · l'étape du compte n'existe plus.
    expect(etapeVoisine(e, 'COMPTE', 1)).toBe('TYPE');
    expect(rangEtape(e, 'CODE')).toEqual({ rang: 2, total: 4 });
  });
});
