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
  lienEssai.classList.add('essai-duree');
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
      expect(m.ids['valider'].disabled).toBe(true);
      expect(m.ids['ecart'].textContent).toBe('·');
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

/* ---- La demande d'information (ligne commercial-site) ---- */

type Champ = ReturnType<typeof element> & { type?: string; checked?: boolean; attributs?: Record<string, string> };

async function monterDemande(reponse: { status: number; corps: unknown } | 'echec') {
  const ids: Record<string, Champ> = {};
  for (const id of ['d-nom', 'd-organisation', 'd-email', 'd-telephone', 'd-message']) {
    const e: Champ = element();
    const attributs: Record<string, string> = {};
    e.attributs = attributs;
    (e as unknown as { setAttribute: (k: string, v: string) => void }).setAttribute = (k, v) => {
      attributs[k] = v;
    };
    ids[id] = e;
  }
  ids['d-consentement'] = Object.assign(element(), { type: 'checkbox', checked: false });
  ids['demande-envoyer'] = Object.assign(element(), { hidden: true, disabled: true });
  ids['demande-etat'] = element();
  let remis = 0;
  ids['demande-form'] = Object.assign(element(), { reset: () => { remis += 1; } });
  const appels: Array<{ url: string; opts: Record<string, unknown> }> = [];
  const document = {
    documentElement: element(),
    getElementById: (id: string) => ids[id] ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const fenetre: Record<string, unknown> = {
    document, Intl, Number, Math, String, Date, Array, Promise, JSON,
    addEventListener() {}, requestAnimationFrame: (f: () => void) => f(), innerHeight: 800,
    fetch: (url: string, opts: Record<string, unknown>) => {
      appels.push({ url, opts });
      if (url.includes('inscription-essai')) return Promise.reject(new Error('sans objet'));
      if (reponse === 'echec') return Promise.reject(new Error('réseau'));
      return Promise.resolve({ ok: reponse.status < 300, status: reponse.status, json: () => Promise.resolve(reponse.corps) });
    },
  };
  fenetre.window = fenetre;
  runInContext(source, createContext(fenetre));
  await new Promise((r) => setTimeout(r, 0));
  const remplir = () => {
    ids['d-nom'].value = 'Ruth Kabeya';
    ids['d-organisation'].value = 'ASBL Lumière';
    ids['d-email'].value = 'ruth@exemple.cd';
    ids['d-message'].value = 'Nous voulons tenir notre comptabilité.';
    ids['d-consentement'].checked = true;
  };
  const envoyer = async () => {
    ids['demande-form'].emettre('submit');
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  return { ids, appels, remplir, envoyer, remis: () => remis };
}

describe('demande d\'information de la page publique', () => {
  it('le script montre et active l\'envoi, et efface la mention « sans script »', async () => {
    const m = await monterDemande({ status: 200, corps: { recue: true, message: 'ok' } });
    expect(m.ids['demande-envoyer'].hidden).toBe(false);
    expect(m.ids['demande-envoyer'].disabled).toBe(false);
    expect(m.ids['demande-etat'].textContent).toBe('');
  });

  it('refuse sans la case cochée, sans rien envoyer', async () => {
    const m = await monterDemande({ status: 200, corps: { recue: true } });
    m.remplir();
    m.ids['d-consentement'].checked = false;
    await m.envoyer();
    expect(m.appels.filter((a) => a.url.includes('demandes'))).toHaveLength(0);
    expect(m.ids['demande-etat'].textContent).toMatch(/Cochez la case/);
  });

  it('marque le champ fautif', async () => {
    const m = await monterDemande({ status: 200, corps: { recue: true } });
    m.remplir();
    m.ids['d-email'].value = 'pas-une-adresse';
    await m.envoyer();
    expect(m.ids['d-email'].attributs?.['aria-invalid']).toBe('true');
    expect(m.ids['d-nom'].attributs?.['aria-invalid']).toBe('false');
  });

  it('poste en JSON, sans témoin, et dit le message du serveur', async () => {
    const m = await monterDemande({ status: 200, corps: { recue: true, message: 'Votre demande est enregistrée.' } });
    m.remplir();
    await m.envoyer();
    const a = m.appels.find((x) => x.url === '/api/demandes/information')!;
    expect(a.opts.method).toBe('POST');
    expect(a.opts.credentials).toBe('omit');
    expect(JSON.parse(a.opts.body as string)).toEqual({
      nom: 'Ruth Kabeya',
      organisation: 'ASBL Lumière',
      email: 'ruth@exemple.cd',
      message: 'Nous voulons tenir notre comptabilité.',
      consentement: true,
    });
    expect(m.ids['demande-etat'].textContent).toBe('Votre demande est enregistrée.');
    expect(m.ids['demande-etat'].classes.has('reussite')).toBe(true);
    expect(m.remis()).toBe(1);
  });

  it('sans messagerie (503), la page dit le motif du serveur et l\'envoi reste possible', async () => {
    const m = await monterDemande({ status: 503, corps: { message: 'Aucune messagerie n\'est configurée.' } });
    m.remplir();
    await m.envoyer();
    expect(m.ids['demande-etat'].textContent).toBe('Aucune messagerie n\'est configurée.');
    expect(m.ids['demande-etat'].classes.has('erreur')).toBe(true);
    expect(m.ids['demande-envoyer'].disabled).toBe(false);
    expect(m.remis()).toBe(0);
  });

  it('dit une limite de débit et une panne réseau, jamais un succès', async () => {
    const limite = await monterDemande({ status: 429, corps: { message: 'ThrottlerException: Too Many Requests' } });
    limite.remplir();
    await limite.envoyer();
    expect(limite.ids['demande-etat'].textContent).toMatch(/Trop de demandes/);
    const global = await monterDemande({ status: 429, corps: { message: "Trop de demandes ont été reçues dans l'heure · réessayez plus tard." } });
    global.remplir();
    await global.envoyer();
    expect(global.ids['demande-etat'].textContent).toMatch(/reçues dans l'heure/);
    const panne = await monterDemande('echec');
    panne.remplir();
    await panne.envoyer();
    expect(panne.ids['demande-etat'].textContent).toMatch(/n'est pas partie/);
  });
});
