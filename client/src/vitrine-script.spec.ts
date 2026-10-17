import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

/**
 * LE SCRIPT DE LA PAGE PUBLIQUE S'EXÉCUTE (relecture « échecs silencieux » · le spec
 * voisin ne relit que des chaînes du source). Pas de jsdom au client · un document minimal
 * suffit : la feuille de journal et le lien d'essai n'en demandent pas davantage.
 */
const source = readFileSync(join(__dirname, '..', 'public', 'vitrine', 'vitrine.js'), 'utf8');

function element(valeur = '') {
  const ecouteurs: Record<string, Array<() => void>> = {};
  const classes = new Set<string>();
  return {
    value: valeur, textContent: '', hidden: false, disabled: false, readOnly: false,
    classList: {
      add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c),
      toggle: (c: string, v?: boolean) => { if (v === undefined ? !classes.has(c) : v) classes.add(c); else classes.delete(c); },
      contains: (c: string) => classes.has(c),
    },
    removeAttribute() {}, setAttribute() {}, focus() {}, select() {},
    addEventListener: (type: string, f: () => void) => { (ecouteurs[type] ??= []).push(f); },
    emettre: (type: string) => (ecouteurs[type] ?? []).forEach((f) => (f as (e: unknown) => void)({ preventDefault() {} })),
    classes,
  };
}

async function monter(reponse: unknown | 'echec') {
  const ids: Record<string, ReturnType<typeof element>> = {};
  for (const id of ['m-debit', 'm-credit']) ids[id] = element('1 250 000,00');
  for (const id of ['t-debit', 't-credit', 'ecart', 'etat-texte', 'valider', 'remettre']) ids[id] = element();
  ids['piece'] = element();
  const feuille = element();
  const lienEssai = element();
  lienEssai.hidden = true;
  lienEssai.classList.add('bouton-plein');
  const document = {
    documentElement: element(),
    getElementById: (id: string) => ids[id] ?? null,
    querySelector: (s: string) => (s === '.feuille' ? feuille : null),
    querySelectorAll: (s: string) => (s === '[data-essai]' ? [lienEssai] : []),
  };
  const fenetre: Record<string, unknown> = {
    document, Intl, Number, Math, String, Date, Array, Promise,
    addEventListener() {}, requestAnimationFrame: (f: () => void) => f(),
    innerHeight: 800, getComputedStyle: () => ({}),
    fetch: (_url: string, opts: Record<string, unknown>) => {
      fenetre.optionsFetch = opts;
      if (reponse === 'echec') return Promise.reject(new Error('réseau'));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(reponse) });
    },
  };
  fenetre.window = fenetre;
  const ctx = createContext(fenetre);
  runInContext(source, ctx);
  await new Promise((r) => setTimeout(r, 0));
  return { ids, feuille, lienEssai, fenetre };
}

const saisir = (m: Awaited<ReturnType<typeof monter>>, d: string, c: string) => {
  m.ids['m-debit'].value = d;
  m.ids['m-credit'].value = c;
  m.ids['m-debit'].emettre('input');
};

describe('feuille de journal de la page publique', () => {
  it('boucle sur l\'exemple, et la validation est offerte', async () => {
    const m = await monter('echec');
    expect(m.ids['ecart'].textContent.replace(/\s/g, '')).toBe('0,00');
    expect(m.ids['valider'].disabled).toBe(false);
  });
  it('lit les formats français et anglais, au centime', async () => {
    const m = await monter('echec');
    saisir(m, '1 250 000,5', '1250000.50');
    expect(m.ids['valider'].disabled).toBe(false);
    saisir(m, '1 250 000,50', '1 250 000,49');
    expect(m.ids['valider'].disabled).toBe(true);
    expect(m.ids['ecart'].textContent.replace(/\s/g, '')).toBe('0,01');
  });
  it('refuse négatif, trois décimales, deux virgules et un montant illisible', async () => {
    const m = await monter('echec');
    for (const brut of ['-5', '1,234', '1,234,56', 'abc', '']) {
      saisir(m, brut, '1');
      expect(m.ids['valider'].disabled, brut).toBe(true);
      expect(m.ids['ecart'].textContent, brut).toBe('·');
    }
  });
  it('refuse une pièce à zéro, et ne confond pas deux montants au-delà de 2^53 centimes', async () => {
    const m = await monter('echec');
    saisir(m, '0', '0');
    expect(m.ids['valider'].disabled).toBe(true);
    saisir(m, '90071992547409.93', '90071992547409.92');
    expect(m.ids['valider'].disabled).toBe(true);
    expect(m.ids['ecart'].textContent).toBe('·');
  });
  it('dit à l\'irréel ce que la validation fait', async () => {
    const m = await monter('echec');
    m.ids['piece'].emettre('submit');
    expect(m.ids['etat-texte'].textContent).toContain('serait inscrite');
  });
});

describe('lien d\'essai de la page publique', () => {
  const montre = (m: Awaited<ReturnType<typeof monter>>) => m.lienEssai.hidden === false;
  it('reste caché sur une lecture échouée', async () => expect(montre(await monter('echec'))).toBe(false));
  it.each([
    [{ ouverte: false, joursEssai: 30 }],
    [{ ouverte: 'true', joursEssai: 30 }],
    [{ ouverte: true, joursEssai: '30' }],
    [{ ouverte: true, joursEssai: 0 }],
    [{ ouverte: true }],
    [null],
  ])('reste caché sur %j', async (rep) => expect(montre(await monter(rep))).toBe(false));
  it('s\'offre sur une porte ouverte, avec la durée lue', async () => {
    const m = await monter({ ouverte: true, joursEssai: 14 });
    expect(montre(m)).toBe(true);
    expect(m.lienEssai.textContent).toBe('Essayer gratuitement 14 jours');
  });
  it('lit sans cache', async () => {
    const m = await monter('echec');
    expect((m.fenetre.optionsFetch as { cache: string }).cache).toBe('no-store');
  });
});
