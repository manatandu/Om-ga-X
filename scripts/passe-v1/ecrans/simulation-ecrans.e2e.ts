import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { API, FENETRE_EN_ERREUR, MOT_DE_PASSE, seConnecter, surveiller } from './outils';

/**
 * SIMULATION · LES ÉCRANS (lot M de la passe V1).
 *
 * Toutes les autres simulations passent par l'API · aucune ne vérifie que la
 * fenêtre affiche les chiffres que le serveur rend. Ici, deux dossiers naissent
 * par l'API (une association SYCEBNL et une SARL SYSCOHADA normale assujettie
 * à la TVA), sur 2025 clôturé et 2026 ouvert, puis chaque écran de chiffres est
 * OUVERT PAR SON MENU, comme un utilisateur, et chaque valeur lue dans le DOM
 * est confrontée DEUX fois · au serveur (la route que l'écran appelle, relue
 * côté test) et au calcul fait à la main depuis les données du scénario
 * (commentaires à côté de chaque attendu).
 *
 * Trois règles, celles du banc (scripts/passe-v1/README.md).
 *  · Aucun refus n'est contourné · un geste refusé est consigné (statut et
 *    corps) et le scénario continue avec ce qu'il peut.
 *  · Aucun numéro de compte n'est deviné · chaque compte est lu dans le plan
 *    SEMÉ du dossier, `compte()` lève si le numéro manque.
 *  · Un montant affiché passe par `lib/montants.ts` (deux décimales, espace
 *    insécable) · il est normalisé avant la comparaison, et une absence « · »
 *    n'est JAMAIS lue comme un zéro. Seules les cellules que l'écran écrit par
 *    `montantOuVide` (balance, balance âgée) lisent le vide comme un zéro,
 *    parce que c'est ce que ce formatage veut dire.
 *
 * Horloge RÉELLE · le navigateur et le serveur lisent la même date. Les
 * retards des relances se calculent donc au jour de Kinshasa du passage
 * (UTC+1, `common/echeance.ts`).
 *
 * Le résultat (contrôles, écarts, erreurs HTTP) est écrit dans
 * `SIM_ECRANS_SORTIE` (par défaut /tmp/claude-0/sim/ecrans.json), comme le banc.
 *
 * SE JOUE DEPUIS `e2e/tests/` (il importe `./outils`), sur le montage du job
 * (CLAUDE.md § 10, « En local, le montage du job, à la main ») · serveur
 * compilé contre une base jetable avec `INSCRIPTION_PUBLIQUE=true`, client
 * construit avec `VITE_API_URL=/api` et servi par `vite preview` avec
 * `OMEGAX_API_RELAIS`, puis
 * `OMEGAX_APP=… OMEGAX_API=…/api npx playwright test simulation-ecrans --project=chromium`.
 * Le test tombe tant qu'un écart demeure · il n'en corrige aucun.
 */

const SORTIE = process.env.SIM_ECRANS_SORTIE ?? '/tmp/claude-0/sim/ecrans.json';

// --- Le registre des contrôles ------------------------------------------------

const auCentime = (x: number) => Math.round(x * 100) / 100;

type Reference = 'serveur' | 'calcul à la main' | 'forme';
interface Controle {
  dossier: string;
  ecran: string;
  libelle: string;
  reference: Reference;
  attendu: unknown;
  lu: unknown;
  difference: number | null;
  verdict: 'concorde' | 'écart';
}

class Registre {
  controles: Controle[] = [];
  erreurs: { dossier: string; geste: string; methode: string; chemin: string; statut: number; corps: unknown }[] = [];
  notes: { dossier: string; texte: string }[] = [];
  dossier = '';
  ecran = '';

  /** Un montant au centime · deux absences concordent, une absence et un nombre jamais. */
  montant(libelle: string, reference: Reference, attendu: number | null | undefined, lu: number | null | undefined) {
    const a = attendu === null || attendu === undefined ? null : auCentime(attendu);
    const l = lu === null || lu === undefined ? null : auCentime(lu);
    const ok = a === null ? l === null : l !== null && Math.abs(l - a) < 0.005;
    this.pousser({ libelle, reference, attendu: a, lu: l, difference: a !== null && l !== null ? auCentime(l - a) : null, ok });
    return ok;
  }

  /** Une égalité exacte (texte, liste, booléen). */
  egal(libelle: string, reference: Reference, attendu: unknown, lu: unknown) {
    const ok = JSON.stringify(attendu) === JSON.stringify(lu);
    this.pousser({ libelle, reference, attendu, lu: lu === undefined ? null : lu, difference: null, ok });
    return ok;
  }

  private pousser(c: { libelle: string; reference: Reference; attendu: unknown; lu: unknown; difference: number | null; ok: boolean }) {
    const controle: Controle = {
      dossier: this.dossier,
      ecran: this.ecran,
      libelle: c.libelle,
      reference: c.reference,
      attendu: c.attendu,
      lu: c.lu,
      difference: c.difference,
      verdict: c.ok ? 'concorde' : 'écart',
    };
    this.controles.push(controle);
    const detail = c.ok ? '' : ` · attendu ${JSON.stringify(c.attendu)}, lu ${JSON.stringify(c.lu)}`;
    console.log(`  [${c.ok ? 'concorde' : 'ÉCART   '}] ${this.dossier} · ${this.ecran} · ${c.libelle} (${c.reference})${detail}`);
  }

  erreurHttp(geste: string, methode: string, chemin: string, statut: number, corps: unknown) {
    this.erreurs.push({ dossier: this.dossier, geste, methode, chemin, statut, corps });
    console.log(`  [HTTP ${statut}] ${this.dossier} · ${geste} · ${methode} ${chemin} · ${JSON.stringify(corps).slice(0, 400)}`);
  }

  note(texte: string) {
    this.notes.push({ dossier: this.dossier, texte });
    console.log(`  [note] ${this.dossier} · ${texte}`);
  }

  bilan() {
    const ecarts = this.controles.filter((c) => c.verdict !== 'concorde');
    return {
      date: new Date().toISOString(),
      api: API,
      nombreControles: this.controles.length,
      concordances: this.controles.length - ecarts.length,
      nombreEcarts: ecarts.length,
      nombreErreursHttp: this.erreurs.length,
      ecarts,
      erreursHttp: this.erreurs,
      notes: this.notes,
      controles: this.controles,
    };
  }
}

const R = new Registre();

/** Une valeur lue à l'écran, confrontée au serveur et, s'il est donné, au calcul à la main. */
function confronter(libelle: string, ecran: number | null, serveur: number | null | undefined, main?: number | null) {
  R.montant(`${libelle} · écran = serveur`, 'serveur', serveur ?? null, ecran);
  if (main !== undefined) R.montant(`${libelle} · écran = calcul à la main`, 'calcul à la main', main, ecran);
}

// --- Le client de l'API (côté test) -------------------------------------------

let compteurAdresse = 1;
/**
 * UNE ADRESSE CLIENTE PAR ACTEUR · la limite générale de débit est par adresse
 * (app.module.ts), comme dans `outils.ts`. Le dossier monté par l'API et la
 * session du navigateur ne se partagent jamais une adresse.
 */
function adresseNeuve() {
  const n = (Date.now() + compteurAdresse++ * 7919 + Math.floor(Math.random() * 1000)) % 16_777_216;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

class Client {
  adresse = adresseNeuve();
  cookie = '';
  csrf = '';
  email = '';
  plan = new Map<string, { id: string; numero: string }>();
  journaux: { id: string; code: string; type: string }[] = [];

  async req(methode: string, chemin: string, corps?: unknown): Promise<{ statut: number; corps: Json }> {
    const r = await fetch(API + chemin, {
      method: methode,
      headers: {
        'X-Forwarded-For': this.adresse,
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.csrf && methode !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const kv = c.split(';')[0];
      if (kv.startsWith('__session=')) this.cookie = kv;
    }
    const texte = await r.text();
    let json: Json;
    try {
      json = texte ? JSON.parse(texte) : undefined;
    } catch {
      json = texte;
    }
    if (json && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    return { statut: r.status, corps: json };
  }

  /** Un geste · un refus est CONSIGNÉ et rend `null`, jamais un second essai. */
  async geste(libelle: string, methode: string, chemin: string, corps?: unknown): Promise<Json> {
    const r = await this.req(methode, chemin, corps);
    if (r.statut >= 400) {
      R.erreurHttp(libelle, methode, chemin, r.statut, r.corps);
      return null;
    }
    return r.corps ?? {};
  }

  lire(libelle: string, chemin: string) {
    return this.geste(libelle, 'GET', chemin);
  }

  async rechargerPlan() {
    const comptes: { id: string; numero: string }[] = (await this.lire('Plan des comptes', '/comptes')) ?? [];
    this.plan = new Map(comptes.map((x) => [x.numero, x]));
  }

  /** L'identifiant d'un compte du plan SEMÉ · un numéro absent arrête le geste. */
  compte(numero: string) {
    const x = this.plan.get(numero);
    if (!x) throw new Error(`Compte ${numero} absent du plan du dossier`);
    return x.id;
  }

  journal(code: string) {
    const j = this.journaux.find((x) => x.code === code);
    if (!j) throw new Error(`Journal ${code} absent du dossier`);
    return j;
  }
}

/** Une étape · une exception du banc est consignée, la suite continue. */
async function etape<T>(nom: string, fn: () => Promise<T>): Promise<T | null> {
  console.log(` · ${R.dossier} · ${nom}`);
  try {
    return await fn();
  } catch (e) {
    R.note(`Étape « ${nom} » interrompue · ${(e as Error).message}`);
    return null;
  }
}

async function nouveauDossier(nom: string, corps: Record<string, unknown>) {
  const c = new Client();
  c.email = `sim-ecrans-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`;
  const r = await c.geste('Inscription du dossier', 'POST', '/auth/register', {
    nomEntite: nom,
    email: c.email,
    motDePasse: MOT_DE_PASSE,
    // L'exercice PRÉCÉDENT naît avec le dossier · 2025, que le scénario clôt.
    dateDebutExercice: '2025-01-01',
    dateFinExercice: '2025-12-31',
    ...corps,
  });
  if (!r) throw new Error('Inscription refusée · le scénario ne peut pas commencer');
  await c.rechargerPlan();
  c.journaux = (await c.lire('Journaux', '/journaux')) ?? [];
  return c;
}

type LigneSaisie = [numero: string, debit: number, credit: number, extra?: Record<string, unknown>];

/** Une écriture · lignes [numéro, débit, crédit, extra?]. */
async function ecriture(c: Client, geste: string, exerciceId: string, journal: string, date: string, libelle: string, lignes: LigneSaisie[], reference?: string) {
  return c.geste(geste, 'POST', '/ecritures', {
    exerciceId,
    journalId: c.journal(journal).id,
    date,
    libelle,
    ...(reference ? { reference } : {}),
    lignes: lignes.map(([numero, debit, credit, extra]) => ({ compteId: c.compte(numero), libelle, debit, credit, ...(extra ?? {}) })),
  });
}

/** La ligne d'une écriture rendue par le serveur, retrouvée par son compte. */
function ligneDe(c: Client, e: Json, numero: string): Json {
  const id = c.plan.get(numero)?.id;
  return e?.lignes?.find((l: Json) => l.compteId === id) ?? null;
}

async function tiers(c: Client, type: string, code: string, nom: string) {
  const t = await c.geste(`Tiers ${code}`, 'POST', '/tiers', { type, code, nom, creerCompteIndividuel: true });
  if (!t) throw new Error(`Tiers ${code} non créé`);
  await c.rechargerPlan();
  return { id: t.id as string, compteId: t.compteIndividuel?.id as string, numero: t.compteIndividuel?.numero as string, libelle: `${code} - ${nom}` };
}

const validerJusqua = (c: Client, exerciceId: string, dateLimite: string) =>
  c.geste(`Validation jusqu’au ${dateLimite}`, 'POST', '/ecritures/valider-jusqua', { exerciceId, dateLimite });

// --- Le calendrier ----------------------------------------------------------------

/** Le jour de Kinshasa (UTC+1) · celui où le serveur compte un retard (`common/echeance.ts`). */
const jourDeKinshasa = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const joursEntre = (de: string, a: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

// --- Lire l'écran ----------------------------------------------------------------

/**
 * Un montant affiché, en nombre · `lib/montants.ts` écrit « 52 389 300,00 »
 * avec une espace insécable fine (U+202F) ou insécable (U+00A0), la virgule
 * décimale, le moins ordinaire ou typographique. Une absence (« · ») ou un
 * texte illisible rend `null`, jamais zéro.
 */
function nombre(texte: string | null | undefined): number | null {
  if (texte === null || texte === undefined) return null;
  const s = texte
    .replace(/CDF|FC/g, '')
    .replace(/[\s  ]/g, '')
    .replace(/−/g, '-');
  if (s === '' || s === '·') return null;
  const negatif = /^\(.*\)$/.test(s) || s.startsWith('−');
  const brut = s.replace(/[()]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(brut)) return null;
  return (negatif ? -1 : 1) * Number(brut);
}
/** Une cellule écrite par `montantOuVide` · le vide y veut dire zéro, et seulement là. */
const ouZero = (texte: string | undefined) => (texte !== undefined && texte.trim() === '' ? 0 : nombre(texte));

/** La forme d'un montant de `lib/montants.ts` · deux décimales, milliers séparés par une espace insécable. */
const FORME_MONTANT = /^-?\(?\d{1,3}(?:[  ]\d{3})*,\d{2}\)?$/;
const formesFautives: string[] = [];
function forme(texte: string | undefined) {
  const t = (texte ?? '').replace(/\s*(CDF|FC)$/, '').trim();
  if (t !== '' && t !== '·' && !FORME_MONTANT.test(t)) formesFautives.push(t);
  return texte;
}

const FENETRE = 'div.anim-fenetre:not(.fenetre-inactive)';
const fenetre = (page: Page): Locator => page.locator(FENETRE).first();

/**
 * Les lignes en grille (display: grid, classe ou style) de la fenêtre active
 * dont la cellule de rang `rang` vaut `cle` · rend le texte de chaque cellule.
 */
async function lignesGrille(page: Page, cle: string, rang = 0): Promise<string[][]> {
  return page.evaluate(
    ({ cle, rang, selecteur }) => {
      const racine = document.querySelector(selecteur) ?? document.body;
      const res: string[][] = [];
      for (const el of Array.from(racine.querySelectorAll('div'))) {
        if (getComputedStyle(el).display !== 'grid') continue;
        const enfants = Array.from(el.children) as HTMLElement[];
        if (enfants.length <= rang) continue;
        if ((enfants[rang].textContent ?? '').trim() === cle) res.push(enfants.map((e) => (e.textContent ?? '').trim()));
      }
      return res;
    },
    { cle, rang, selecteur: FENETRE },
  );
}

/** Une seule ligne attendue · plusieurs ou aucune se disent, et rendent `null`. */
async function ligne(page: Page, cle: string, rang = 0): Promise<string[] | null> {
  const l = await lignesGrille(page, cle, rang);
  if (l.length !== 1) {
    R.note(`ligne « ${cle} » trouvée ${l.length} fois dans la fenêtre « ${R.ecran} »`);
    return l[0] ?? null;
  }
  return l[0];
}

/** Les lignes d'un tableau HTML de la fenêtre active dont une cellule vaut `cle`. */
async function lignesTableau(page: Page, cle: string): Promise<string[][]> {
  return page.evaluate(
    ({ cle, selecteur }) => {
      const racine = document.querySelector(selecteur) ?? document.body;
      return Array.from(racine.querySelectorAll('tr'))
        .map((tr) => Array.from(tr.children).map((td) => (td.textContent ?? '').trim()))
        .filter((cellules) => cellules.some((t) => t === cle || t.startsWith(`${cle} `)));
    },
    { cle, selecteur: FENETRE },
  );
}

/** Ferme toutes les fenêtres · une seule fenêtre à la fois, lue une fois rendue (ecrans.e2e.ts). */
async function fermerFenetres(page: Page) {
  const croix = page.locator('button[aria-label^="Fermer "]');
  for (let i = 0; i < 12; i++) {
    const ouvertes = await croix.count();
    if (ouvertes === 0) return;
    await croix.first().click({ timeout: 5_000 }).catch(() => undefined);
    await expect(croix).toHaveCount(ouvertes - 1, { timeout: 5_000 }).catch(() => undefined);
  }
}

/** Attend que la fenêtre active ait chargé ses données. */
async function attendreFenetre(page: Page) {
  await fenetre(page).waitFor({ timeout: 15_000 });
  await fenetre(page).getByText('Chargement…', { exact: true }).first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle');
  if ((await page.getByText(FENETRE_EN_ERREUR).count()) > 0) R.note(`la fenêtre « ${R.ecran} » affiche la limite d'erreur`);
}

/**
 * OUVRIR PAR LE MENU, comme un utilisateur · le titre de la barre, puis le
 * groupe, puis la commande (MenuBar.tsx, mode volant à 1 366 px).
 */
async function ouvrirParMenu(page: Page, ecran: string, chemin: string[]) {
  R.ecran = ecran;
  await fermerFenetres(page);
  const [titre, ...suite] = chemin;
  await page.getByRole('button', { name: titre, exact: true }).click();
  let panneau = page.getByRole('menu', { name: titre, exact: true });
  for (let i = 0; i < suite.length; i++) {
    await panneau.getByRole('menuitem', { name: suite[i], exact: true }).first().click();
    if (i < suite.length - 1) panneau = page.getByRole('menu', { name: suite[i], exact: true });
  }
  await attendreFenetre(page);
}

/** Change l'exercice de travail par le sélecteur de la barre d'état. */
async function choisirExercice(page: Page, exerciceId: string) {
  await fermerFenetres(page);
  await page.locator('select[aria-label="Exercice de travail"]').selectOption(exerciceId);
  await page.waitForLoadState('networkidle');
}

/** La colonne d'une balance âgée qui contient une date · « Avant le … » ou « Du … au … ». */
function colonneDeLaDate(entetes: string[], iso: string): number {
  const d = Date.parse(`${iso}T00:00:00Z`);
  const lire = (fr: string) => Date.parse(`${fr.slice(6, 10)}-${fr.slice(3, 5)}-${fr.slice(0, 2)}T00:00:00Z`);
  return entetes.findIndex((h) => {
    const avant = /^Avant le (\d\d\/\d\d\/\d{4})$/.exec(h);
    if (avant) return d < lire(avant[1]);
    const du = /^Du (\d\d\/\d\d\/\d{4}) au (\d\d\/\d\d\/\d{4})$/.exec(h);
    return du ? d >= lire(du[1]) && d <= lire(du[2]) : false;
  });
}

// --- Les attendus d'un dossier ----------------------------------------------------

interface Attendus {
  referentiel: 'SYSCOHADA' | 'SYCEBNL';
  n1: string;
  n: string;
  /** Balance 2026 · totaux [ouverture D, ouverture C, mouvements D, mouvements C, clôture D, clôture C]. */
  totauxBalanceN: number[];
  totauxBalanceN1: number[];
  /** Comptes lus à la balance 2026 · [ouverture D, ouverture C, mouvements D, mouvements C, clôture D, clôture C]. */
  comptesBalance: Record<string, number[]>;
  grandLivre: { numero: string; totalDebit: number; totalCredit: number; soldeFinal: number };
  journalN: number;
  journalN1: number;
  bilan: Record<string, { n: number; n1: number }>;
  resultat: { ref: string; n: number; n1: number };
  tresorerie: { ouverture: string; cloture: string; zaN: number; zhN: number; zhN1: number };
  notes: { code: string; lignes: { libelle: string; colonnes: Record<string, number> }[] }[];
  /** Poste d'immobilisation au bilan 2026 · brut et amortissements. */
  immobilisationBilan: { ref: string; brut: number; amortissement: number };
  /** Autres lignes du compte de résultat 2026 · N et N-1. */
  autresResultat: Record<string, { n: number; n1: number }>;
  /** Flux de trésorerie des activités opérationnelles (ZB) de 2026. */
  fluxOperationnels: number;
  /** Balance regroupée sur le collectif des clients · numéro et solde de clôture débiteur. */
  collectifClients: { numero: string; solde: number };
  ageeTous: { libelle: string; parDate: Record<string, number>; solde: number }[];
  ageeTotalDebiteurs: number;
  fournisseur: { libelle: string; solde: number; echeance: string };
  relances: { numero: string; tiers: string; montantDu: number; echeancePlusAncienne: string; lignes: { echeance: string; montant: number }[] }[];
  tableauDeBord: { tresorerie: number; produits: number; charges: number; resultat: number };
  immobilisation: { designation: string; valeurOrigine: number; cumulAmorti: number; vnc: number };
  bilanN1: { totalRef: string; total: number; resultatRef: string; resultat: number };
}

// --- La SARL (SYSCOHADA, système normal, assujettie) --------------------------------

/**
 * KIVU NÉGOCE SARL · 2025 clôturé, 2026 ouvert. Chaque montant attendu est
 * calculé ici à la main depuis les écritures passées ; les comptes viennent du
 * plan SYSCOHADA semé (compétence `syscohada`), le taux de 16 % de l'O.-L.
 * n° 10/001 (compétence `fiscalite-rdc`, tva/references/04, « taux normal :
 * 16 % »).
 */
async function monterSarl(): Promise<{ c: Client; att: Attendus; bulletinId: string | null } | null> {
  R.dossier = 'SARL';
  R.ecran = 'montage par l’API';
  const c = await nouveauDossier('Simulation écrans · Kivu Négoce SARL', { referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' });
  const exercices: Json[] = (await c.lire('Exercices', '/exercices')) ?? [];
  const n1 = exercices.find((e) => String(e.dateDebut).startsWith('2025'))?.id as string;
  let n = '';
  let bulletinId: string | null = null;
  const BQ = '52110000';
  const CAISSE = '57110000';
  const ctx: Record<string, Json> = {};

  await etape('Paramètres · forme, TVA, module de paie', async () => {
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Assujettissement à la TVA', 'PATCH', '/dossier/regime', { assujettiTva: true, reponseAssujettissementTva: 'OUI', venteBiensServices: 'OUI' });
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    const taux: Json[] = (await c.lire('Taux de TVA', '/taux-tva')) ?? [];
    ctx.tva16 = taux.find((t) => t.code === 'TVA16')?.id;
  });
  const C1 = await tiers(c, 'CLIENT', 'C1', 'Mines du Sud');
  const C2 = await tiers(c, 'CLIENT', 'C2', 'Quincaillerie du Lac');
  const F1 = await tiers(c, 'FOURNISSEUR', 'F1', 'Grossiste de Kinshasa');
  const tva = (extra: Record<string, unknown> = {}) => ({ tauxTvaId: ctx.tva16, ...extra });

  await etape('2025 · apport, achat, ventes, règlements, camion, caisse, dotation', async () => {
    await ecriture(c, 'Apport en capital', n1, 'BQ', '2025-01-02', 'Apport en capital', [[BQ, 50_000_000, 0], ['10130000', 0, 50_000_000]]);
    // 4 000 000 HT × 16 % = 640 000 de TVA récupérable · 4 640 000 TTC.
    const a1 = await ecriture(c, 'Facture d’achat FA-001', n1, 'ACH', '2025-03-10', 'Facture FA-001 marchandises', [
      ['60110000', 4_000_000, 0], ['44520000', 640_000, 0, tva()], [F1.numero, 0, 4_640_000, { dateEcheance: '2025-04-10' }],
    ], 'FA-001');
    // 10 000 000 HT × 16 % = 1 600 000 · 11 600 000 TTC.
    const v1 = await ecriture(c, 'Facture de vente FV-001', n1, 'VEN', '2025-04-15', 'Facture FV-001 Mines du Sud', [
      [C1.numero, 11_600_000, 0, { dateEcheance: '2025-05-15' }], ['70110000', 0, 10_000_000], ['44310000', 0, 1_600_000, tva()],
    ], 'FV-001');
    await validerJusqua(c, n1, '2025-04-30');
    await c.geste('Règlement de FA-001', 'POST', '/reglements', {
      sens: 'FOURNISSEUR', exerciceId: n1, journalId: c.journal('BQ').id, date: '2025-05-10',
      reglements: [{ compteId: F1.compteId, ligneIds: [ligneDe(c, a1, F1.numero)?.id], montant: 4_640_000 }],
    });
    await c.geste('Encaissement de FV-001', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n1, journalId: c.journal('BQ').id, date: '2025-06-20',
      reglements: [{ compteId: C1.compteId, ligneIds: [ligneDe(c, v1, C1.numero)?.id], montant: 11_600_000 }],
    });
    ctx.camion = await c.geste('Acquisition du camion', 'POST', '/immobilisations', {
      compteImmobilisationId: c.compte('24510000'), designation: 'Camion Isuzu NPR', dateAcquisition: '2025-07-01', dateMiseEnService: '2025-07-01',
      valeurOrigine: 12_000_000, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: c.compte(BQ), exerciceId: n1, journalId: c.journal('BQ').id,
    });
    await ecriture(c, 'Alimentation de la caisse', n1, 'BQ', '2025-08-01', 'Alimentation de la caisse', [[CAISSE, 500_000, 0], [BQ, 0, 500_000]]);
    // CAISSE À ZÉRO AU 31/12/2025 · la clôture refuse une caisse 57 à solde
    // non nul sans procès-verbal de comptage (CLAUDE.md, PV par caisse).
    await ecriture(c, 'Fournitures payées en espèces', n1, 'CA', '2025-08-20', 'Fournitures de bureau payées en espèces', [['60550000', 500_000, 0], [CAISSE, 0, 500_000]]);
    // LA CRÉANCE REPORTÉE · 5 000 000 HT + 800 000 de TVA, échue le 05/11/2025, jamais payée.
    await ecriture(c, 'Facture de vente FV-002', n1, 'VEN', '2025-10-05', 'Facture FV-002 Quincaillerie du Lac', [
      [C2.numero, 5_800_000, 0, { dateEcheance: '2025-11-05' }], ['70110000', 0, 5_000_000], ['44310000', 0, 800_000, tva()],
    ], 'FV-002');
    // Dotation 2025 · 12 000 000 / 4 ans × 6/12 (mise en service le 1er juillet) = 1 500 000.
    if (ctx.camion) await c.geste('Dotation 2025 du camion', 'POST', `/immobilisations/${ctx.camion.id}/dotation`, { exerciceId: n1, journalId: c.journal('OD').id });
    await validerJusqua(c, n1, '2025-12-31');
  });

  await etape('Ouverture de 2026 et clôture de 2025', async () => {
    const e = await c.geste('Exercice 2026', 'POST', '/exercices', { dateDebut: '2026-01-01', dateFin: '2026-12-31' });
    n = e?.id ?? '';
    await c.geste('Clôture de 2025', 'POST', `/exercices/${n1}/cloturer`, {});
  });
  if (!n) return null;

  await etape('2026 · ventes, achat, caisse, paie, affectation, dotation', async () => {
    // 8 000 000 HT + 1 280 000 de TVA = 9 280 000, payée le 20/03/2026.
    const v3 = await ecriture(c, 'Facture de vente FV-003', n, 'VEN', '2026-02-15', 'Facture FV-003 Mines du Sud', [
      [C1.numero, 9_280_000, 0, { dateEcheance: '2026-03-15' }], ['70110000', 0, 8_000_000], ['44310000', 0, 1_280_000, tva()],
    ], 'FV-003');
    await validerJusqua(c, n, '2026-02-28');
    await c.geste('Encaissement de FV-003', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n, journalId: c.journal('BQ').id, date: '2026-03-20',
      reglements: [{ compteId: C1.compteId, ligneIds: [ligneDe(c, v3, C1.numero)?.id], montant: 9_280_000 }],
    });
    await ecriture(c, 'Alimentation de la caisse', n, 'BQ', '2026-06-01', 'Alimentation de la caisse', [[CAISSE, 300_000, 0], [BQ, 0, 300_000]]);
    await ecriture(c, 'Fournitures payées en espèces', n, 'CA', '2026-06-10', 'Fournitures de bureau payées en espèces', [['60550000', 120_000, 0], [CAISSE, 0, 120_000]]);
    // 2 000 000 HT + 320 000 = 2 320 000, échue le 05/10/2026, non payée.
    await ecriture(c, 'Facture d’achat FA-002', n, 'ACH', '2026-09-05', 'Facture FA-002 marchandises', [
      ['60110000', 2_000_000, 0], ['44520000', 320_000, 0, tva()], [F1.numero, 0, 2_320_000, { dateEcheance: '2026-10-05' }],
    ], 'FA-002');
    // 3 000 000 HT + 480 000 = 3 480 000, échue le 30/09/2026.
    const v4 = await ecriture(c, 'Facture de vente FV-004', n, 'VEN', '2026-09-12', 'Facture FV-004 Mines du Sud', [
      [C1.numero, 3_480_000, 0, { dateEcheance: '2026-09-30' }], ['70110000', 0, 3_000_000], ['44310000', 0, 480_000, tva()],
    ], 'FV-004');
    await validerJusqua(c, n, '2026-09-30');
    // ENCAISSEMENT PARTIEL · 1 000 000 le 02/10/2026, lettré en partiel avec FV-004 ;
    // il reste 2 480 000 dus, échus le 30/09/2026.
    await c.geste('Encaissement partiel de FV-004', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n, journalId: c.journal('BQ').id, date: '2026-10-02',
      reglements: [{ compteId: C1.compteId, ligneIds: [ligneDe(c, v4, C1.numero)?.id], montant: 1_000_000 }],
    });
  });

  await etape('2026 · paie de septembre (un bulletin, passation, net payé)', async () => {
    const s = await c.geste('Salarié MBUYI', 'POST', '/personnel/salaries', { nom: 'MBUYI', sexe: 'MASCULIN', nationalite: 'congolaise', lieuNaissance: 'Goma' });
    if (!s) return;
    // Classe 7 · 1 500 000 par mois, au-dessus du minimum de la classe (décret n° 25/22, annexe 2).
    await c.geste('Contrat de MBUYI', 'POST', `/personnel/salaries/${s.id}/contrats`, {
      type: 'DUREE_INDETERMINEE', lieuExecution: 'Kinshasa', dateEntreeEnVigueur: '2026-01-01', natureTravail: 'Comptable',
      classeProfessionnelle: 7, periodiciteRemuneration: 'MOIS', remunerationBase: 1_500_000, deviseRemuneration: 'CDF',
    });
    const b = await c.geste('Bulletin de septembre 2026', 'POST', `/personnel/salaries/${s.id}/bulletins`, {
      moisDePaie: '2026-09', dateMiseADisposition: '2026-09-30', natureEmployeurInpp: 'PRIVE', effectif: 1, regimeSalarial: 'BAREME_ARTICLE_118',
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 1_500_000 }],
    });
    bulletinId = b?.id ?? null;
    await c.geste('Passation de la paie de septembre', 'POST', '/personnel/paie-du-mois/2026-09/comptabilisation', { exerciceId: n, journalId: c.journal('OD').id, date: '2026-09-30' });
    // Net à payer calculé à la main plus bas (1 230 700) · le banc paie le net lu, et le contrôle le confronte.
    if (b) await ecriture(c, 'Paiement du net de septembre', n, 'BQ', '2026-09-30', 'Salaires nets septembre 2026', [['42200000', b.netAPayerFc, 0], [BQ, 0, b.netAPayerFc]]);
  });

  await etape('2026 · affectation du résultat 2025 et dotation 2026', async () => {
    // AUSCGIE art. 346 · « une dotation égale à un dixième au moins » à la
    // réserve légale · 9 000 000 × 10 % = 900 000 au 11100000, le reste,
    // 8 100 000, au report à nouveau 12100000.
    await c.geste('Affectation du résultat 2025', 'POST', '/affectation-resultat', {
      exerciceId: n1, dateDecision: '2026-04-30', organe: 'Assemblée générale ordinaire des associés',
      lignes: [{ compteId: c.compte('11100000'), montant: 900_000 }, { compteId: c.compte('12100000'), montant: 8_100_000 }],
    });
    // Dotation 2026 · 12 000 000 / 4 = 3 000 000.
    if (ctx.camion) await c.geste('Dotation 2026 du camion', 'POST', `/immobilisations/${ctx.camion.id}/dotation`, { exerciceId: n, journalId: c.journal('OD').id });
    await validerJusqua(c, n, '2026-12-31');
  });

  /*
   * LES ATTENDUS, À LA MAIN.
   *
   * 2025 · résultat = ventes 15 000 000 − achats 4 000 000 − fournitures
   * 500 000 − dotation 1 500 000 = 9 000 000. Banque au 31/12/2025 ·
   * 50 000 000 − 4 640 000 + 11 600 000 − 12 000 000 − 500 000 = 44 460 000.
   * Journal 2025 (débits) · 50 000 000 + 4 640 000 + 11 600 000 + 4 640 000 +
   * 11 600 000 + 12 000 000 + 500 000 + 500 000 + 5 800 000 + 1 500 000 =
   * 102 780 000, plus l'écriture qui solde les comptes de gestion (débit du
   * 70110000 de 15 000 000) · 117 780 000.
   * À-nouveaux 2026 · débiteurs 12 000 000 (24510000) + 5 800 000 (C2) +
   * 640 000 (44520000) + 44 460 000 (banque) = 62 900 000 = créditeurs
   * 50 000 000 + 9 000 000 + 1 500 000 + 2 400 000.
   *
   * PAIE DE SEPTEMBRE 2026 · décret n° 18/041, art. 2 à 4 (CLAUDE.md, P2b) ·
   * quote-part ouvrière 5 % = 75 000 ; patronales 6,5 % + 5 % + 1,5 % =
   * 195 000 ; INPP 3,5 % (privé, moins de 50) = 52 500 ; ONEM 0,5 % = 7 500.
   * IRPP (loi n° 23/053, art. 118, fiscalite-rdc code-general-2026/05) ·
   * (1 500 000 − 75 000) × 12 = 17 100 000 ; 1 944 000 × 3 % = 58 320 ;
   * (17 100 000 − 1 944 000) × 15 % = 2 273 400 ; 2 331 720 / 12 = 194 310,
   * arrondi selon l'art. 150 (tranche de 10 < 50) · 194 300. Net · 1 500 000
   * − 75 000 − 194 300 = 1 230 700.
   *
   * 2026 · résultat = ventes 11 000 000 − achats 2 000 000 − fournitures
   * 120 000 − personnel 1 695 000 − impôts et taxes 60 000 − dotation
   * 3 000 000 = 4 125 000. Banque · 44 460 000 + 9 280 000 + 1 000 000 −
   * 300 000 − 1 230 700 = 53 209 300 ; caisse 180 000 ; trésorerie
   * 53 389 300. Clients · C1 3 480 000 − 1 000 000 = 2 480 000, C2 5 800 000.
   * Journal 2026 · 62 900 000 (à-nouveaux) + 9 280 000 + 9 280 000 + 300 000
   * + 120 000 + 2 320 000 + 3 480 000 + 1 000 000 + 2 024 300 (paie ·
   * 1 500 000 + 269 300 + 195 000 + 52 500 + 7 500) + 1 230 700 + 9 000 000
   * (affectation) + 3 000 000 = 103 935 000 ; hors à-nouveaux 41 035 000.
   * Soldes au 31/12/2026 · débiteurs 12 000 000 + 2 480 000 + 5 800 000 +
   * 960 000 + 53 209 300 + 180 000 + 2 000 000 + 120 000 + 7 500 + 52 500 +
   * 1 500 000 + 195 000 + 3 000 000 = 81 504 300 = créditeurs.
   */
  const att: Attendus = {
    referentiel: 'SYSCOHADA',
    n1,
    n,
    totauxBalanceN: [62_900_000, 62_900_000, 41_035_000, 41_035_000, 81_504_300, 81_504_300],
    totauxBalanceN1: [0, 0, 117_780_000, 117_780_000, 62_900_000, 62_900_000],
    comptesBalance: {
      [BQ]: [44_460_000, 0, 10_280_000, 1_530_700, 53_209_300, 0],
      [C1.numero]: [0, 0, 12_760_000, 10_280_000, 2_480_000, 0],
      [C2.numero]: [5_800_000, 0, 0, 0, 5_800_000, 0],
      '70110000': [0, 0, 0, 11_000_000, 0, 11_000_000],
      '44310000': [0, 2_400_000, 0, 1_760_000, 0, 4_160_000],
      '13100000': [0, 9_000_000, 9_000_000, 0, 0, 0],
    },
    // Grand livre de la banque · l'à-nouveau de 44 460 000 et les encaissements
    // de 9 280 000 et 1 000 000 au débit, la caisse (300 000) et le net (1 230 700) au crédit.
    grandLivre: { numero: BQ, totalDebit: 54_740_000, totalCredit: 1_530_700, soldeFinal: 53_209_300 },
    journalN: 103_935_000,
    journalN1: 117_780_000,
    bilan: {
      // Camion · brut 12 000 000, amortissements 1 500 000 + 3 000 000.
      AN: { n: 7_500_000, n1: 10_500_000 },
      // Clients · C1 2 480 000 + C2 5 800 000 ; en 2025, C2 seul.
      BI: { n: 8_280_000, n1: 5_800_000 },
      BS: { n: 53_389_300, n1: 44_460_000 },
      BZ: { n: 70_129_300, n1: 61_400_000 },
      CF: { n: 900_000, n1: 0 },
      CJ: { n: 4_125_000, n1: 9_000_000 },
      // Dettes fiscales et sociales · 4 160 000 (443) + 270 000 (43) + 60 000 (4428) + 194 300 (447).
      DK: { n: 4_684_300, n1: 2_400_000 },
      DZ: { n: 70_129_300, n1: 61_400_000 },
    },
    resultat: { ref: 'XI', n: 4_125_000, n1: 9_000_000 },
    tresorerie: { ouverture: 'ZA', cloture: 'ZH', zaN: 44_460_000, zhN: 53_389_300, zhN1: 44_460_000 },
    notes: [
      // NOTE 7 · clients 8 280 000 en 2026, 5 800 000 en 2025 ; tout échoit à un an au plus de la clôture.
      { code: '7', lignes: [{ libelle: 'Clients (hors réserves de propriété Groupe)', colonnes: { 'Année N': 8_280_000, 'Année N-1': 5_800_000, 'Créances à un an au plus': 8_280_000 } }] },
      // NOTE 3C · 1 500 000 à l'ouverture, dotation 3 000 000, 4 500 000 à la clôture.
      {
        code: '3C',
        lignes: [{
          libelle: 'Matériel de transport',
          colonnes: {
            "A · AMORTISSEMENTS CUMULÉS À L'OUVERTURE DE L'EXERCICE": 1_500_000,
            "B · AUGMENTATIONS : DOTATIONS DE L'EXERCICE": 3_000_000,
            "D = A + B - C · CUMUL DES AMORTISSEMENTS À LA CLÔTURE DE L'EXERCICE": 4_500_000,
          },
        }],
      },
    ],
    immobilisationBilan: { ref: 'AN', brut: 12_000_000, amortissement: 4_500_000 },
    autresResultat: {
      // Ventes 8 000 000 + 3 000 000 ; 2025 · 10 000 000 + 5 000 000.
      TA: { n: 11_000_000, n1: 15_000_000 },
      // Personnel · 1 500 000 (661) + 195 000 (664) ; aucun en 2025.
      RK: { n: -1_695_000, n1: 0 },
      RL: { n: -3_000_000, n1: -1_500_000 },
      // EBE · 11 000 000 − 2 000 000 − 120 000 − 60 000 − 1 695 000 ; 2025 · 15 000 000 − 4 000 000 − 500 000.
      XD: { n: 7_125_000, n1: 10_500_000 },
    },
    // Aucun investissement ni financement en 2026 · toute la variation (53 389 300 − 44 460 000 = 8 929 300) vient de l'exploitation.
    fluxOperationnels: 8_929_300,
    collectifClients: { numero: '41110000', solde: 8_280_000 },
    ageeTous: [
      { libelle: C2.libelle, parDate: { '2025-11-05': 5_800_000 }, solde: 5_800_000 },
      // Ce qui reste dû de FV-004 (2 480 000), rangé à son échéance.
      { libelle: C1.libelle, parDate: { '2026-09-30': 2_480_000 }, solde: 2_480_000 },
    ],
    ageeTotalDebiteurs: 8_280_000,
    fournisseur: { libelle: F1.libelle, solde: 2_320_000, echeance: '2026-10-05' },
    relances: [
      { numero: C2.numero, tiers: 'Quincaillerie du Lac', montantDu: 5_800_000, echeancePlusAncienne: '2025-11-05', lignes: [{ echeance: '2025-11-05', montant: 5_800_000 }] },
      { numero: C1.numero, tiers: 'Mines du Sud', montantDu: 2_480_000, echeancePlusAncienne: '2026-09-30', lignes: [{ echeance: '2026-09-30', montant: 2_480_000 }] },
    ],
    // Charges · 2 000 000 + 120 000 + 7 500 + 52 500 + 1 500 000 + 195 000 + 3 000 000 = 6 875 000.
    tableauDeBord: { tresorerie: 53_389_300, produits: 11_000_000, charges: 6_875_000, resultat: 4_125_000 },
    immobilisation: { designation: 'Camion Isuzu NPR', valeurOrigine: 12_000_000, cumulAmorti: 4_500_000, vnc: 7_500_000 },
    // Bilan 2025 · 10 500 000 + 5 800 000 + 640 000 + 44 460 000 = 61 400 000.
    bilanN1: { totalRef: 'BZ', total: 61_400_000, resultatRef: 'XI', resultat: 9_000_000 },
  };
  return { c, att, bulletinId };
}

// --- L'association (SYCEBNL, associations et ordres professionnels) ----------------

/**
 * LUMIÈRE DU KASAÏ, ASSOCIATION · 2025 clôturé, 2026 ouvert, non assujettie.
 * Comptes lus dans le plan SYCEBNL semé (compétence `sycebnl`).
 */
async function monterAssociation(): Promise<{ c: Client; att: Attendus } | null> {
  R.dossier = 'Association';
  R.ecran = 'montage par l’API';
  const c = await nouveauDossier('Simulation écrans · Lumière du Kasaï', { referentiel: 'SYCEBNL', jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' });
  const exercices: Json[] = (await c.lire('Exercices', '/exercices')) ?? [];
  const n1 = exercices.find((e) => String(e.dateDebut).startsWith('2025'))?.id as string;
  let n = '';
  const BQ = '52110000';
  const CAISSE = '57100000';
  const ctx: Record<string, Json> = {};
  const U1 = await tiers(c, 'CLIENT', 'U1', 'Centre de santé Lumière');
  const F1 = await tiers(c, 'FOURNISSEUR', 'F1', 'Papeterie du Kasaï');

  await etape('2025 · dotation, don, prestations, fournitures, matériel, caisse, dotation aux amortissements', async () => {
    await ecriture(c, 'Dotation initiale', n1, 'BQ', '2025-01-05', 'Dotation initiale des fondateurs', [[BQ, 30_000_000, 0], ['10110000', 0, 30_000_000]]);
    await ecriture(c, 'Don reçu', n1, 'BQ', '2025-02-10', 'Don de la Fondation Kasaï', [[BQ, 5_000_000, 0], ['70410000', 0, 5_000_000]]);
    // LA CRÉANCE REPORTÉE · 2 000 000 échus le 15/04/2025, payés 800 000 en 2026.
    await ecriture(c, 'Prestations PF-001', n1, 'VEN', '2025-03-15', 'Prestations de formation U1', [[U1.numero, 2_000_000, 0, { dateEcheance: '2025-04-15' }], ['70520000', 0, 2_000_000]], 'PF-001');
    const f1 = await ecriture(c, 'Facture fournitures FF-001', n1, 'ACH', '2025-04-01', 'Facture fournitures F1', [['60550000', 1_200_000, 0], [F1.numero, 0, 1_200_000, { dateEcheance: '2025-05-01' }]], 'FF-001');
    await validerJusqua(c, n1, '2025-04-30');
    await c.geste('Règlement de FF-001', 'POST', '/reglements', {
      sens: 'FOURNISSEUR', exerciceId: n1, journalId: c.journal('BQ').id, date: '2025-05-01',
      reglements: [{ compteId: F1.compteId, ligneIds: [ligneDe(c, f1, F1.numero)?.id], montant: 1_200_000 }],
    });
    ctx.parc = await c.geste('Acquisition du parc informatique', 'POST', '/immobilisations', {
      compteImmobilisationId: c.compte('24420000'), designation: 'Parc informatique', dateAcquisition: '2025-06-01', dateMiseEnService: '2025-06-01',
      valeurOrigine: 6_000_000, dureeAmortissementAns: 5, modeAmortissement: 'LINEAIRE', compteContrepartieId: c.compte(BQ), exerciceId: n1, journalId: c.journal('BQ').id,
    });
    await ecriture(c, 'Alimentation de la caisse', n1, 'BQ', '2025-07-01', 'Alimentation de la caisse', [[CAISSE, 400_000, 0], [BQ, 0, 400_000]]);
    await ecriture(c, 'Fournitures payées en espèces', n1, 'CA', '2025-07-15', 'Fournitures payées en espèces', [['60550000', 400_000, 0], [CAISSE, 0, 400_000]]);
    // Dotation 2025 · 6 000 000 / 5 ans × 7/12 (juin à décembre) = 700 000.
    if (ctx.parc) await c.geste('Dotation 2025 du parc', 'POST', `/immobilisations/${ctx.parc.id}/dotation`, { exerciceId: n1, journalId: c.journal('OD').id });
    await validerJusqua(c, n1, '2025-12-31');
  });

  await etape('Ouverture de 2026 et clôture de 2025', async () => {
    const e = await c.geste('Exercice 2026', 'POST', '/exercices', { dateDebut: '2026-01-01', dateFin: '2026-12-31' });
    n = e?.id ?? '';
    await c.geste('Clôture de 2025', 'POST', `/exercices/${n1}/cloturer`, {});
  });
  if (!n) return null;

  await etape('2026 · encaissement partiel, don, prestations, fournitures, caisse, affectation, dotation', async () => {
    // Le règlement vise la ligne d'À-NOUVEAU du 01/01/2026 · la facture de
    // 2025 appartient à l'exercice clos (« Les factures réglées doivent
    // appartenir à l'exercice du règlement »).
    const ouvertes: Json[] = (await c.lire('Lignes ouvertes de U1', `/comptes/${U1.compteId}/lettrage?nonLettreesSeulement=true`))?.lignes ?? [];
    const report = ouvertes.find((l) => String(l.date).startsWith('2026-01-01') && Number(l.debit) === 2_000_000);
    if (!report) R.note('Ligne d’à-nouveau de U1 introuvable · encaissement partiel non passé');
    else await c.geste('Encaissement partiel de PF-001', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n, journalId: c.journal('BQ').id, date: '2026-03-10',
      reglements: [{ compteId: U1.compteId, ligneIds: [report.id], montant: 800_000 }],
    });
    await ecriture(c, 'Don reçu', n, 'BQ', '2026-04-05', 'Don de la Fondation Kasaï', [[BQ, 3_000_000, 0], ['70410000', 0, 3_000_000]]);
    await ecriture(c, 'Prestations PF-002', n, 'VEN', '2026-05-20', 'Prestations de formation U1', [[U1.numero, 1_500_000, 0, { dateEcheance: '2026-06-20' }], ['70520000', 0, 1_500_000]], 'PF-002');
    await ecriture(c, 'Facture fournitures FF-002', n, 'ACH', '2026-06-15', 'Facture fournitures F1', [['60550000', 900_000, 0], [F1.numero, 0, 900_000, { dateEcheance: '2026-07-15' }]], 'FF-002');
    await ecriture(c, 'Alimentation de la caisse', n, 'BQ', '2026-07-01', 'Alimentation de la caisse', [[CAISSE, 250_000, 0], [BQ, 0, 250_000]]);
    await ecriture(c, 'Fournitures payées en espèces', n, 'CA', '2026-07-10', 'Fournitures payées en espèces', [['60550000', 100_000, 0], [CAISSE, 0, 100_000]]);
    // L'excédent de 2025 au report à nouveau des excédents (12100000).
    await c.geste('Affectation du résultat 2025', 'POST', '/affectation-resultat', {
      exerciceId: n1, dateDecision: '2026-04-30', organe: 'Assemblée générale ordinaire',
      lignes: [{ compteId: c.compte('12100000'), montant: 4_700_000 }],
    });
    // Dotation 2026 · 6 000 000 / 5 = 1 200 000.
    if (ctx.parc) await c.geste('Dotation 2026 du parc', 'POST', `/immobilisations/${ctx.parc.id}/dotation`, { exerciceId: n, journalId: c.journal('OD').id });
    await validerJusqua(c, n, '2026-12-31');
  });

  /*
   * LES ATTENDUS, À LA MAIN.
   *
   * 2025 · excédent = don 5 000 000 + prestations 2 000 000 − fournitures
   * 1 600 000 − dotation 700 000 = 4 700 000. Banque · 30 000 000 +
   * 5 000 000 − 1 200 000 − 6 000 000 − 400 000 = 27 400 000. Journal ·
   * 30 000 000 + 5 000 000 + 2 000 000 + 1 200 000 + 1 200 000 + 6 000 000 +
   * 400 000 + 400 000 + 700 000 = 46 900 000, plus le solde des comptes de
   * gestion (débits des 70410000 et 70520000 · 7 000 000) · 53 900 000.
   * À-nouveaux 2026 · 6 000 000 + 2 000 000 + 27 400 000 = 35 400 000.
   *
   * 2026 · excédent = don 3 000 000 + prestations 1 500 000 − fournitures
   * 1 000 000 − dotation 1 200 000 = 2 300 000. Banque · 27 400 000 +
   * 800 000 + 3 000 000 − 250 000 = 30 950 000 ; caisse 150 000. Créance U1 ·
   * 2 000 000 − 800 000 + 1 500 000 = 2 700 000, dont 1 200 000 échus le
   * 15/04/2025 et 1 500 000 le 20/06/2026. Journal · 35 400 000 + 800 000 +
   * 3 000 000 + 1 500 000 + 900 000 + 250 000 + 100 000 + 4 700 000 +
   * 1 200 000 = 47 850 000 ; mouvements hors à-nouveaux 12 450 000. Soldes ·
   * 6 000 000 + 2 700 000 + 30 950 000 + 150 000 + 1 000 000 + 1 200 000 =
   * 42 000 000 = 30 000 000 + 4 700 000 + 1 900 000 + 900 000 + 3 000 000 +
   * 1 500 000.
   */
  const att: Attendus = {
    referentiel: 'SYCEBNL',
    n1,
    n,
    totauxBalanceN: [35_400_000, 35_400_000, 12_450_000, 12_450_000, 42_000_000, 42_000_000],
    totauxBalanceN1: [0, 0, 53_900_000, 53_900_000, 35_400_000, 35_400_000],
    comptesBalance: {
      [BQ]: [27_400_000, 0, 3_800_000, 250_000, 30_950_000, 0],
      [U1.numero]: [2_000_000, 0, 1_500_000, 800_000, 2_700_000, 0],
      '70410000': [0, 0, 0, 3_000_000, 0, 3_000_000],
      '13100000': [0, 4_700_000, 4_700_000, 0, 0, 0],
    },
    grandLivre: { numero: BQ, totalDebit: 31_200_000, totalCredit: 250_000, soldeFinal: 30_950_000 },
    journalN: 47_850_000,
    journalN1: 53_900_000,
    bilan: {
      // Parc · brut 6 000 000, amortissements 700 000 + 1 200 000.
      AL: { n: 4_100_000, n1: 5_300_000 },
      BD: { n: 2_700_000, n1: 2_000_000 },
      BW: { n: 31_100_000, n1: 27_400_000 },
      BZ: { n: 37_900_000, n1: 34_700_000 },
      CG: { n: 4_700_000, n1: 0 },
      CH: { n: 2_300_000, n1: 4_700_000 },
      DH: { n: 900_000, n1: 0 },
      DZ: { n: 37_900_000, n1: 34_700_000 },
    },
    resultat: { ref: 'XE', n: 2_300_000, n1: 4_700_000 },
    tresorerie: { ouverture: 'ZA', cloture: 'ZG', zaN: 27_400_000, zhN: 31_100_000, zhN1: 27_400_000 },
    notes: [
      // NOTE 9 · le solde 2 700 000 échoit tout entier à un an au plus de la clôture.
      { code: '9', lignes: [{ libelle: 'Clients-usagers', colonnes: { 'Année N': 2_700_000, 'Année N-1': 2_000_000, 'Variation en valeur': 700_000, 'Créances à un an au plus': 2_700_000 } }] },
      // NOTE 13 · banque 30 950 000 (27 400 000 en 2025), caisse 150 000 (vide au 31/12/2025).
      {
        code: '13',
        lignes: [
          { libelle: 'Banques locales', colonnes: { 'Année N': 30_950_000, 'Année N-1': 27_400_000, 'Variation en valeur': 3_550_000 } },
          { libelle: 'Caisse', colonnes: { 'Année N': 150_000, 'Année N-1': 0 } },
        ],
      },
      // NOTE 5E · 700 000 à l'ouverture, dotation 1 200 000, 1 900 000 à la clôture.
      {
        code: '5E',
        lignes: [{
          libelle: 'Matériel, mobilier et actifs biologiques',
          colonnes: {
            "A · Amortissements cumulés à l'ouverture": 700_000,
            "B · Augmentations : Dotations de l'exercice": 1_200_000,
            'E = A + B - C - D (Cumuls des amortissements à la clôture)': 1_900_000,
          },
        }],
      },
    ],
    immobilisationBilan: { ref: 'AL', brut: 6_000_000, amortissement: 1_900_000 },
    autresResultat: {
      RC: { n: 3_000_000, n1: 5_000_000 },
      RE: { n: 1_500_000, n1: 2_000_000 },
      XA: { n: 4_500_000, n1: 7_000_000 },
      TD: { n: 1_000_000, n1: 1_600_000 },
      TL: { n: 1_200_000, n1: 700_000 },
      XB: { n: 2_200_000, n1: 2_300_000 },
    },
    // Don 3 000 000 + encaissement de U1 800 000 − caisse dépensée 100 000.
    fluxOperationnels: 3_700_000,
    collectifClients: { numero: '41200000', solde: 2_700_000 },
    // Antériorité · ce qui RESTE dû de PF-001 (1 200 000) avant l'exercice, PF-002 en juin.
    ageeTous: [{ libelle: U1.libelle, parDate: { '2025-04-15': 1_200_000, '2026-06-20': 1_500_000 }, solde: 2_700_000 }],
    ageeTotalDebiteurs: 2_700_000,
    fournisseur: { libelle: F1.libelle, solde: 900_000, echeance: '2026-07-15' },
    // Ce qui reste dû, échéance par échéance · 1 200 000 de PF-001 (après l'encaissement de 800 000) et PF-002.
    relances: [{
      numero: U1.numero, tiers: 'Centre de santé Lumière', montantDu: 2_700_000, echeancePlusAncienne: '2025-04-15',
      lignes: [{ echeance: '2025-04-15', montant: 1_200_000 }, { echeance: '2026-06-20', montant: 1_500_000 }],
    }],
    tableauDeBord: { tresorerie: 31_100_000, produits: 4_500_000, charges: 2_200_000, resultat: 2_300_000 },
    immobilisation: { designation: 'Parc informatique', valeurOrigine: 6_000_000, cumulAmorti: 1_900_000, vnc: 4_100_000 },
    // Bilan 2025 · 5 300 000 + 2 000 000 + 27 400 000 = 34 700 000.
    bilanN1: { totalRef: 'BZ', total: 34_700_000, resultatRef: 'XE', resultat: 4_700_000 },
  };
  return { c, att };
}

// --- Les écrans, ouverts par leur menu ------------------------------------------------

const COLONNES_BALANCE = ['ouverture D', 'ouverture C', 'mouvements D', 'mouvements C', 'clôture D', 'clôture C'];

async function ecranTableauDeBord(page: Page, c: Client, att: Attendus) {
  await ouvrirParMenu(page, 'Tableau de bord', ['État', 'Tableau de bord']);
  await fenetre(page).getByText('TRÉSORERIE DISPONIBLE').first().waitFor({ timeout: 15_000 });
  // Le compteur (lib/compteur.ts, 280 ms) doit avoir fini sa course · on lit la valeur arrêtée.
  await page.waitForTimeout(1_200);
  const cartes = await page.evaluate((selecteur) => {
    const racine = document.querySelector(selecteur) ?? document.body;
    return Array.from(racine.querySelectorAll('.carte-indicateur')).map((el) => ({
      label: (el.children[0]?.textContent ?? '').trim(),
      valeur: (el.children[1]?.textContent ?? '').trim(),
    }));
  }, FENETRE);
  const lu = (label: string) => nombre(forme(cartes.find((x) => x.label === label)?.valeur));
  // Le serveur · la balance que l'écran lit, recalculée ici par la même définition (classe 5 hors 59, 6, 7, 6 à 8).
  const b = await c.lire('Balance (tableau de bord)', `/ecritures/balance?exerciceId=${att.n}`);
  let tresorerie = 0;
  let produits = 0;
  let charges = 0;
  let resultat = 0;
  for (const l of (b?.lignes ?? []) as Json[]) {
    if (l.typeCompte === 'TOTAL') continue;
    const horsCloture = l.solde - ((l.clotureDebit ?? 0) - (l.clotureCredit ?? 0));
    if (l.numero[0] === '5' && !l.numero.startsWith('59')) tresorerie += l.solde;
    if (l.numero[0] === '7') produits -= horsCloture;
    if (l.numero[0] === '6') charges += horsCloture;
    if ('678'.includes(l.numero[0])) resultat -= horsCloture;
  }
  confronter('trésorerie disponible', lu('TRÉSORERIE DISPONIBLE'), b ? tresorerie : null, att.tableauDeBord.tresorerie);
  confronter('produits', lu('PRODUITS'), b ? produits : null, att.tableauDeBord.produits);
  confronter('charges', lu('CHARGES'), b ? charges : null, att.tableauDeBord.charges);
  confronter('résultat provisoire', lu('RÉSULTAT PROVISOIRE'), b ? resultat : null, att.tableauDeBord.resultat);
}

async function ecranBalance(page: Page, c: Client, att: Attendus, exerciceId: string, totaux: number[], comptes: Record<string, number[]>) {
  await ouvrirParMenu(page, `Balance des comptes (${exerciceId === att.n ? '2026' : '2025'})`, ['État', 'Livres comptables', 'Balance des comptes']);
  await fenetre(page).getByText('Totaux généraux').first().waitFor({ timeout: 20_000 });
  const b = await c.lire('Balance', `/ecritures/balance?exerciceId=${exerciceId}`);
  const lignesApi: Json[] = b?.lignes ?? [];
  // L'écran : ouverture et clôture en solde net, mouvements du journal clôture comprise (JournalPage, mouvementsDuJournal).
  const parApi = (l: Json) => {
    const ouv = l.reportDebit - l.reportCredit;
    return [Math.max(ouv, 0), Math.max(-ouv, 0), l.mouvementDebit + (l.clotureDebit ?? 0), l.mouvementCredit + (l.clotureCredit ?? 0), Math.max(l.solde, 0), Math.max(-l.solde, 0)];
  };
  const totalApi = COLONNES_BALANCE.map((_, i) => lignesApi.reduce((s, l) => s + parApi(l)[i], 0));
  const pied = await ligne(page, 'Totaux généraux', 1);
  COLONNES_BALANCE.forEach((col, i) => confronter(`totaux généraux · ${col}`, pied ? ouZero(forme(pied[i + 2])) : null, b ? totalApi[i] : null, totaux[i]));
  for (const [numero, valeurs] of Object.entries(comptes)) {
    const l = await ligne(page, numero, 0);
    const api = lignesApi.find((x) => x.numero === numero);
    COLONNES_BALANCE.forEach((col, i) => confronter(`compte ${numero} · ${col}`, l ? ouZero(forme(l[i + 2])) : null, api ? parApi(api)[i] : null, valeurs[i]));
  }
  if (exerciceId !== att.n) return;

  // REGROUPER LES TIERS · chaque compte individuel fondu sur son collectif ;
  // les totaux ne changent pas (bulle de la case, JournalPage).
  const caseRegroupe = fenetre(page).getByLabel('Regrouper les tiers sur leur compte collectif');
  await caseRegroupe.check();
  await page.waitForLoadState('networkidle');
  await fenetre(page).getByText('compte(s) de tiers').first().waitFor({ timeout: 15_000 });
  const regroupee = await c.lire('Balance regroupée', `/ecritures/balance?exerciceId=${att.n}&regrouperTiers=1`);
  const lc = await ligne(page, att.collectifClients.numero, 0);
  const apiLc = (regroupee?.lignes ?? []).find((x: Json) => x.numero === att.collectifClients.numero);
  confronter(`balance regroupée · collectif ${att.collectifClients.numero} · clôture D`, lc ? ouZero(forme(lc[6])) : null, apiLc ? Math.max(apiLc.solde, 0) : null, att.collectifClients.solde);
  const piedRegroupe = await ligne(page, 'Totaux généraux', 1);
  const totalRegroupeApi = ((regroupee?.lignes ?? []) as Json[]).reduce((t, x) => t + Math.max(x.solde, 0), 0);
  confronter('balance regroupée · totaux généraux · clôture D', piedRegroupe ? ouZero(forme(piedRegroupe[6])) : null, regroupee ? totalRegroupeApi : null, totaux[4]);
  await caseRegroupe.uncheck();
  await page.waitForLoadState('networkidle');

  // LE DOUBLE-CLIC D'UNE LIGNE ouvre le grand livre du compte (CLAUDE.md, ligne FPM).
  const numero = att.grandLivre.numero;
  await fenetre(page)
    .locator('div[title="Double-cliquer pour ouvrir le grand livre du compte"]')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${numero}$`) }) })
    .first()
    .dblclick();
  await fenetre(page).getByText('Total mouvements · solde final').first().waitFor({ timeout: 20_000 });
  const piedGl = await lignesGrille(page, 'Total mouvements · solde final', 1);
  R.egal(`double-clic sur ${numero} · un seul compte au grand livre`, 'calcul à la main', 1, piedGl.length);
  const gl: Json[] = (await c.lire('Grand livre', `/ecritures/grand-livre?exerciceId=${att.n}`)) ?? [];
  confronter(`double-clic sur ${numero} · solde final du grand livre`, piedGl[0] ? nombre(forme(piedGl[0][4])) : null, gl.find((x) => x.compte?.numero === numero)?.soldeFinal, att.grandLivre.soldeFinal);
}

async function ecranGrandLivre(page: Page, c: Client, att: Attendus) {
  await ouvrirParMenu(page, 'Grand livre des comptes', ['État', 'Livres comptables', 'Grand livre des comptes']);
  // Le filtre de la fenêtre, pas le format d'export (premier « select » de la barre).
  const filtre = fenetre(page).locator('select').filter({ has: page.locator('option', { hasText: 'tous les comptes mouvementés' }) }).first();
  await filtre.waitFor({ timeout: 20_000 });
  await fenetre(page).getByText(/\d+ comptes? ·/).first().waitFor({ timeout: 20_000 });
  const id = c.plan.get(att.grandLivre.numero)?.id ?? '';
  await filtre.selectOption(id);
  // Pied d'un compte · [vide (col-span-3), libellé, débit, crédit, solde, lettre, contrepartie].
  const pied = await ligne(page, 'Total mouvements · solde final', 1);
  const gl: Json[] = (await c.lire('Grand livre', `/ecritures/grand-livre?exerciceId=${att.n}`)) ?? [];
  const s = gl.find((x) => x.compte?.numero === att.grandLivre.numero);
  confronter(`${att.grandLivre.numero} · total des débits`, pied ? ouZero(forme(pied[2])) : null, s?.totalDebit, att.grandLivre.totalDebit);
  confronter(`${att.grandLivre.numero} · total des crédits`, pied ? ouZero(forme(pied[3])) : null, s?.totalCredit, att.grandLivre.totalCredit);
  confronter(`${att.grandLivre.numero} · solde final`, pied ? nombre(forme(pied[4])) : null, s?.soldeFinal, att.grandLivre.soldeFinal);
}

async function ecranJournal(page: Page, c: Client, att: Attendus) {
  await ouvrirParMenu(page, 'Journal', ['État', 'Livres comptables', 'Journal']);
  await fenetre(page).getByText('Totaux de la période').first().waitFor({ timeout: 20_000 });
  // Pied du journal · [vide (col-span-5), « Totaux de la période », débit, crédit, vide].
  const pied = await ligne(page, 'Totaux de la période', 1);
  const j = await c.lire('Journal', `/ecritures?exerciceId=${att.n}`);
  confronter('totaux de la période · débit', pied ? nombre(forme(pied[2])) : null, j?.totaux?.debit, att.journalN);
  confronter('totaux de la période · crédit', pied ? nombre(forme(pied[3])) : null, j?.totaux?.credit, att.journalN);
}

/** Les trois onglets des états financiers · bilan, compte de résultat, flux. */
async function ecranEtatsFinanciers(page: Page, c: Client, att: Attendus, exerciceId: string) {
  const deux = exerciceId === att.n;
  await ouvrirParMenu(page, `États financiers (${deux ? '2026' : '2025'})`, ['État', 'États financiers', 'États financiers']);
  const base = att.referentiel === 'SYSCOHADA' ? '/etats-financiers-syscohada' : '/etats-financiers';
  await fenetre(page).getByText('LE BILAN EST ÉQUILIBRÉ').or(fenetre(page).getByText('DÉSÉQUILIBRE DÉTECTÉ')).first().waitFor({ timeout: 30_000 });
  const bilan = await c.lire('Bilan', `${base}/bilan?exerciceId=${exerciceId}`);
  const postes = new Map<string, Json>([...(bilan?.actif ?? []), ...(bilan?.passif ?? [])].map((l: Json) => [l.ref, l]));
  const colonnesNettes = (cellules: string[] | null) => (cellules ? cellules.slice(-2) : null);
  if (deux) {
    // Le poste d'immobilisation · BRUT et AMORT. ET DÉPREC. précèdent les deux colonnes nettes.
    const im = await ligne(page, att.immobilisationBilan.ref, 0);
    const posteIm = postes.get(att.immobilisationBilan.ref);
    confronter(`bilan ${att.immobilisationBilan.ref} · brut`, im ? nombre(forme(im[im.length - 4])) : null, posteIm?.brut, att.immobilisationBilan.brut);
    const amort = im ? nombre(forme(im[im.length - 3])) : null;
    confronter(`bilan ${att.immobilisationBilan.ref} · amortissements`, amort === null ? null : Math.abs(amort), posteIm?.amortissement, att.immobilisationBilan.amortissement);
    for (const [ref, v] of Object.entries(att.bilan)) {
      const l = colonnesNettes(await ligne(page, ref, 0));
      confronter(`bilan ${ref} · net N`, l ? nombre(forme(l[0])) : null, postes.get(ref)?.montant, v.n);
      confronter(`bilan ${ref} · net N-1`, l ? nombre(forme(l[1])) : null, postes.get(ref)?.montantN1, v.n1);
    }
  } else {
    const l = colonnesNettes(await ligne(page, att.bilanN1.totalRef, 0));
    confronter(`bilan ${att.bilanN1.totalRef} · net (exercice clos)`, l ? nombre(forme(l[0])) : null, postes.get(att.bilanN1.totalRef)?.montant, att.bilanN1.total);
    // PREMIER EXERCICE DU DOSSIER · aucune colonne N-1 · une absence, jamais un zéro (CLAUDE.md § 9 ter).
    R.egal(`bilan ${att.bilanN1.totalRef} · colonne N-1 sans exercice précédent · écran`, 'calcul à la main', '·', l ? l[1] : null);
    R.egal(`bilan ${att.bilanN1.totalRef} · colonne N-1 sans exercice précédent · serveur`, 'serveur', null, postes.get(att.bilanN1.totalRef)?.montantN1 ?? null);
  }

  await fenetre(page).getByRole('button', { name: 'COMPTE DE RÉSULTAT', exact: true }).click();
  const cr = await c.lire('Compte de résultat', `${base}/compte-de-resultat?exerciceId=${exerciceId}`);
  await fenetre(page).getByText("L'ÉTAT BOUCLE").or(fenetre(page).getByText('ÉCART DE')).first().waitFor({ timeout: 20_000 });
  const ref = deux ? att.resultat.ref : att.bilanN1.resultatRef;
  const lcr = await ligne(page, ref, 0);
  const apiN = att.referentiel === 'SYSCOHADA' ? cr?.lignes?.find((x: Json) => x.ref === ref)?.montant : cr?.resultatNet;
  const apiN1 = att.referentiel === 'SYSCOHADA' ? cr?.lignes?.find((x: Json) => x.ref === ref)?.montantN1 : cr?.resultatNetN1;
  const valeurs = lcr ? lcr.slice(-2) : null;
  confronter(`résultat net ${ref} · N`, valeurs ? nombre(forme(valeurs[0])) : null, apiN, deux ? att.resultat.n : att.bilanN1.resultat);
  if (deux) confronter(`résultat net ${ref} · N-1`, valeurs ? nombre(forme(valeurs[1])) : null, apiN1, att.resultat.n1);
  else R.egal(`résultat net ${ref} · colonne N-1 sans exercice précédent · écran`, 'calcul à la main', '·', valeurs ? valeurs[1] : null);
  if (!deux) return;
  // Les autres lignes · le SYSCOHADA les sert en liste (`lignes`), le SYCEBNL en postes et totaux.
  const totauxSycebnl: Record<string, [string, string]> = {
    XA: ['totalProduits', 'totalProduitsN1'],
    XB: ['totalCharges', 'totalChargesN1'],
    XC: ['resultatActivitesOrdinaires', 'resultatActivitesOrdinairesN1'],
    XD: ['resultatHao', 'resultatHaoN1'],
    XE: ['resultatNet', 'resultatNetN1'],
  };
  const posteCr = (r: string): { montant: number | null; montantN1: number | null } | null => {
    if (att.referentiel === 'SYSCOHADA') return cr?.lignes?.find((x: Json) => x.ref === r) ?? null;
    if (totauxSycebnl[r]) return { montant: cr?.[totauxSycebnl[r][0]] ?? null, montantN1: cr?.[totauxSycebnl[r][1]] ?? null };
    return [...(cr?.produits ?? []), ...(cr?.charges ?? []), cr?.produitsHao, cr?.chargesHao].find((x: Json) => x?.ref === r) ?? null;
  };
  for (const [r, v] of Object.entries(att.autresResultat)) {
    const l = await ligne(page, r, 0);
    const deuxDerniers = l ? l.slice(-2) : null;
    confronter(`compte de résultat ${r} · N`, deuxDerniers ? nombre(forme(deuxDerniers[0])) : null, posteCr(r)?.montant, v.n);
    confronter(`compte de résultat ${r} · N-1`, deuxDerniers ? nombre(forme(deuxDerniers[1])) : null, posteCr(r)?.montantN1, v.n1);
  }

  await fenetre(page).getByRole('button', { name: 'FLUX DE TRÉSORERIE', exact: true }).click();
  await fenetre(page).getByText('EXERCICE N', { exact: true }).first().waitFor({ timeout: 20_000 });
  const tft = await c.lire('Tableau des flux', `${base}/tableau-flux-tresorerie?exerciceId=${exerciceId}`);
  const parRef = (r: string) => (tft?.lignes ?? []).find((x: Json) => x.ref === r);
  const colonnesFlux = async (r: string) => {
    const l = await ligne(page, r, 0);
    // SYSCOHADA · REF | LIBELLÉS | N | N-1 | CLÉ ; SYCEBNL · REF | LIBELLÉ | N | N-1.
    return l ? [l[2], l[3]] : null;
  };
  const za = await colonnesFlux(att.tresorerie.ouverture);
  confronter(`flux ${att.tresorerie.ouverture} · trésorerie à l'ouverture`, za ? nombre(forme(za[0])) : null, parRef(att.tresorerie.ouverture)?.montant, att.tresorerie.zaN);
  const zh = await colonnesFlux(att.tresorerie.cloture);
  confronter(`flux ${att.tresorerie.cloture} · trésorerie de clôture N`, zh ? nombre(forme(zh[0])) : null, parRef(att.tresorerie.cloture)?.montant, att.tresorerie.zhN);
  confronter(`flux ${att.tresorerie.cloture} · trésorerie de clôture N-1`, zh ? nombre(forme(zh[1])) : null, parRef(att.tresorerie.cloture)?.montantN1, att.tresorerie.zhN1);
  const zb = await colonnesFlux('ZB');
  confronter('flux ZB · flux des activités opérationnelles', zb ? nombre(forme(zb[0])) : null, parRef('ZB')?.montant, att.fluxOperationnels);
  confronter('flux · contrôle, trésorerie par le bilan', nombre(forme(await texteApres(page, 'contrôle par le bilan :', 'bilan :'))), tft?.controle?.tresorerieClotureParBilan, att.tresorerie.zhN);
}

/** Le montant écrit juste après un libellé dans le texte de la fenêtre. */
async function texteApres(page: Page, ...libelles: string[]): Promise<string | undefined> {
  const texte = (await fenetre(page).textContent()) ?? '';
  for (const l of libelles) {
    const i = texte.lastIndexOf(l);
    if (i >= 0) return /^\s*(-?[\d   ]+,\d{2})/.exec(texte.slice(i + l.length))?.[1];
  }
  return undefined;
}

async function ecranNotes(page: Page, c: Client, att: Attendus) {
  await ouvrirParMenu(page, 'Notes annexes', ['État', 'États financiers', 'Notes annexes']);
  await fenetre(page).getByText('INTITULÉ', { exact: true }).first().waitFor({ timeout: 30_000 });
  const chemin = att.referentiel === 'SYSCOHADA' ? `/etats-financiers-syscohada/notes?exerciceId=${att.n}` : `/notes-annexes/associations?exerciceId=${att.n}`;
  const notes = await c.lire('Notes annexes', chemin);
  for (const n of att.notes) {
    R.ecran = `Notes annexes (NOTE ${n.code})`;
    // La fiche récapitulative · un bouton par code, NOTE | INTITULÉ | A ou N/A.
    const fiche = fenetre(page).locator('button').filter({ has: page.locator('span.font-mono', { hasText: new RegExp(`^${n.code}$`) }) }).first();
    await fiche.click();
    await fenetre(page).getByText(new RegExp(`^NOTE ${n.code} `)).first().waitFor({ timeout: 15_000 });
    const entetes = (await lignesGrille(page, 'LIBELLÉ', 0))[0] ?? [];
    const note = (notes?.notes ?? []).find((x: Json) => x.code === n.code);
    for (const attendue of n.lignes) {
      const l = await ligne(page, attendue.libelle, 0);
      const api = note?.lignes?.find((x: Json) => x.libelle === attendue.libelle);
      const valeurApi = (libelleColonne: string) => {
        const col = note?.colonnes?.find((x: Json) => x.libelle === libelleColonne);
        if (!col || !api) return null;
        if (col.type === 'EXERCICE_N') return api.montantN;
        if (col.type === 'EXERCICE_N1') return api.montantN1;
        if (col.type === 'VARIATION_VALEUR') return api.variationValeur;
        return api.valeurs?.[col.type] ?? null;
      };
      for (const [colonne, main] of Object.entries(attendue.colonnes)) {
        const i = entetes.indexOf(colonne);
        if (i <= 0) R.note(`NOTE ${n.code} · colonne « ${colonne} » introuvable à l'écran`);
        confronter(`${attendue.libelle} · ${colonne}`, l && i > 0 ? nombre(forme(l[i])) : null, valeurApi(colonne), main);
      }
      // LA PART NON VENTILÉE · le serveur la sert à part (`echeanceNonVentilee`,
      // « présenté à part, jamais fondu ») et la liasse l'écrit en commentaire
      // (export.service.ts) · l'écran doit la dire aussi, sans quoi les colonnes
      // d'échéance s'y lisent complètes.
      if (api?.echeanceNonVentilee !== undefined && api?.echeanceNonVentilee !== null) {
        const texte = (await fenetre(page).textContent()) ?? '';
        R.egal(`${attendue.libelle} · part non ventilée servie (${api.echeanceNonVentilee}) · dite à l'écran`, 'serveur', true, /non ventil/i.test(texte));
      }
      // Une ventilation par échéance doit refaire le solde de l'année · c'est la même créance.
      if (attendue.colonnes['Créances à un an au plus'] !== undefined && api?.valeurs) {
        const somme = (api.valeurs.ECHEANCE_1AN ?? 0) + (api.valeurs.ECHEANCE_2ANS ?? 0) + (api.valeurs.ECHEANCE_PLUS_2ANS ?? 0);
        R.montant(`${attendue.libelle} · somme des colonnes d'échéance = solde de l'année N (serveur)`, 'calcul à la main', attendue.colonnes['Année N'], somme);
      }
    }
  }
}

async function ecranBalanceAgee(page: Page, c: Client, att: Attendus) {
  await ouvrirParMenu(page, 'Balance âgée', ['État', 'Analyse des comptes', 'Balance âgée']);
  await fenetre(page).getByText('TIERS', { exact: true }).first().waitFor({ timeout: 20_000 });
  const entetes = (await lignesGrille(page, 'TIERS', 0))[0] ?? [];
  const date = await fenetre(page).locator('input[type=date]').first().inputValue();
  const api = await c.lire('Balance âgée', `/ecritures/balance-agee?exerciceId=${att.n}&dateReference=${date}&type=TOUS`);
  for (const t of att.ageeTous) {
    const l = await ligne(page, t.libelle, 0);
    const a = (api?.debiteurs ?? []).find((x: Json) => x.libelle === t.libelle);
    // Colonne par colonne, contre le serveur.
    (api?.tranches ?? []).forEach((tr: Json, i: number) =>
      confronter(`${t.libelle} · ${tr.libellePeriode}`, l ? ouZero(forme(l[i + 1])) : null, a?.montants?.[i] ?? null),
    );
    // Contre la main · ce qui reste dû, rangé par son échéance.
    const attendu = entetes.map(() => 0);
    for (const [echeance, m] of Object.entries(t.parDate)) {
      const i = colonneDeLaDate(entetes, echeance);
      if (i > 0) attendu[i] += m;
    }
    entetes.slice(1, -1).forEach((h, k) => {
      R.montant(`${t.libelle} · ${h} · écran = calcul à la main`, 'calcul à la main', attendu[k + 1], l ? ouZero(l[k + 1]) : null);
    });
    confronter(`${t.libelle} · solde`, l ? ouZero(forme(l[l.length - 1])) : null, a?.solde, t.solde);
  }
  const total = await ligne(page, 'Total débiteurs', 0);
  confronter('total débiteurs', total ? ouZero(forme(total[total.length - 1])) : null, api?.totaux?.debiteurs, att.ageeTotalDebiteurs);

  // LES DETTES FOURNISSEURS · le périmètre « Fournisseurs (40) » se lit
  // « une dette ancienne est un retard de paiement » (lecture servie) · la
  // dette doit être VENTILÉE dans la colonne de son échéance.
  await fenetre(page).locator('select').filter({ has: page.locator('option', { hasText: 'Fournisseurs (40)' }) }).first().selectOption('FOURNISSEURS');
  await page.waitForLoadState('networkidle');
  await fenetre(page).getByText(att.fournisseur.libelle).first().waitFor({ timeout: 15_000 });
  const apiF = await c.lire('Balance âgée fournisseurs', `/ecritures/balance-agee?exerciceId=${att.n}&dateReference=${date}&type=FOURNISSEURS`);
  const entetesF = (await lignesGrille(page, 'TIERS', 0))[0] ?? [];
  const lf = await ligne(page, att.fournisseur.libelle, 0);
  const iF = colonneDeLaDate(entetesF, att.fournisseur.echeance);
  const aF = [...(apiF?.debiteurs ?? []), ...(apiF?.crediteurs ?? [])].find((x: Json) => x.libelle === att.fournisseur.libelle);
  confronter(`${att.fournisseur.libelle} · solde (valeur absolue)`, lf ? Math.abs(ouZero(forme(lf[lf.length - 1])) ?? NaN) : null, aF ? Math.abs(aF.solde) : null, att.fournisseur.solde);
  R.montant(
    `${att.fournisseur.libelle} · dette rangée dans la colonne de son échéance (${entetesF[iF] ?? '?'}) · écran = calcul à la main`,
    'calcul à la main',
    att.fournisseur.solde,
    lf && iF > 0 ? Math.abs(ouZero(lf[iF]) ?? 0) : null,
  );
  const sensInverse = (await fenetre(page).getByText('Soldes en sens inverse').count()) > 0;
  R.egal(`${att.fournisseur.libelle} · une dette fournisseur n'est pas un « solde en sens inverse »`, 'calcul à la main', false, sensInverse);
}

async function ecranRelances(page: Page, c: Client, att: Attendus) {
  await ouvrirParMenu(page, 'Rappel et relevé', ['Traitement', 'Tiers et trésorerie', 'Rappel et relevé']);
  await fenetre(page).getByText('Montant dû', { exact: true }).first().waitFor({ timeout: 20_000 });
  await fenetre(page).getByText(/^\d+ tiers$/).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  const api: Json[] = (await c.lire('Relances', `/relances?exerciceId=${att.n}&type=RAPPEL`)) ?? [];
  const aujourdhui = jourDeKinshasa();
  for (const r of att.relances) {
    const l = await ligne(page, r.numero, 1);
    const a = api.find((x) => x.numero === r.numero);
    confronter(`${r.numero} · montant dû`, l ? nombre(forme(l[4])) : null, a?.montantDu, r.montantDu);
    // Le retard court de l'échéance la plus ancienne encore due jusqu'au jour de Kinshasa.
    const retardLu = l ? Number(/^(\d+) j$/.exec(l[5])?.[1] ?? NaN) : null;
    confronter(`${r.numero} · retard en jours`, retardLu !== null && !Number.isNaN(retardLu) ? retardLu : null, a?.retardMaxJours, joursEntre(r.echeancePlusAncienne, aujourdhui));
  }
  const pied = await ligne(page, `${att.relances.length} tiers`, 2);
  confronter('total dû', pied ? nombre(forme(pied[4])) : null, api.reduce((s, x) => s + x.montantDu, 0), att.relances.reduce((s, x) => s + x.montantDu, 0));

  // LE DÉTAIL DÉPLIÉ · ce que la lettre réclamera, ligne par ligne.
  for (const r of att.relances) await fenetre(page).locator('button').filter({ hasText: r.tiers }).first().click();
  const details = (await page.evaluate((selecteur) => {
    const racine = document.querySelector(selecteur) ?? document.body;
    return Array.from(racine.querySelectorAll('div'))
      .filter((el) => getComputedStyle(el).display === 'grid' && el.children.length === 7 && /^\d{4}-\d{2}-\d{2}$/.test((el.children[1].textContent ?? '').trim()))
      .map((el) => Array.from(el.children).map((e) => (e.textContent ?? '').trim()));
  }, FENETRE)) as string[][];
  const vus = details.map((d) => `${d[1]} : ${nombre(forme(d[4]))}`).sort();
  const servis = api.flatMap((p) => (p.lignes ?? []).map((l: Json) => `${l.echeance ?? l.date} : ${auCentime(Number(l.montant))}`)).sort();
  const aLaMain = att.relances.flatMap((r) => r.lignes.map((l) => `${l.echeance} : ${l.montant}`)).sort();
  R.egal('détail déplié · lignes (échéance : montant) · écran = serveur', 'serveur', servis, vus);
  R.egal('détail déplié · lignes (échéance : montant) · écran = calcul à la main', 'calcul à la main', aLaMain, vus);
}

async function ecranTva(page: Page, c: Client) {
  await ouvrirParMenu(page, 'Déclaration de TVA (septembre 2026)', ['Traitement', 'Déclarations et registres', 'Déclaration de TVA']);
  const champs = fenetre(page).locator('input[type=date]');
  await champs.nth(0).fill('2026-09-01');
  await champs.nth(1).fill('2026-09-30');
  await fenetre(page).getByRole('button', { name: 'Calculer', exact: true }).click();
  await fenetre(page).getByText('Total TVA collectée').first().waitFor({ timeout: 20_000 });
  const d = await c.lire('Déclaration de TVA', '/taux-tva/declaration?dateDebut=2026-09-01&dateFin=2026-09-30');
  // FV-004 · 3 000 000 × 16 % = 480 000 collectés ; FA-002 · 2 000 000 × 16 % = 320 000 déductibles ; prorata 100 %.
  confronter('TVA collectée', nombre(forme(await texteApres(page, 'Total TVA collectée :'))), d?.totalCollecte, 480_000);
  confronter('TVA déductible admise', nombre(forme(await texteApres(page, 'Total TVA déductible admise :'))), d?.totalDeductibleAdmise, 320_000);
  const ligneTaux = await ligne(page, 'TVA16', 0);
  confronter('TVA16 · net de la ligne', ligneTaux ? nombre(forme(ligneTaux[5])) : null, d?.lignes?.find((x: Json) => x.code === 'TVA16')?.net, 160_000);
  const net = await page.evaluate((selecteur) => {
    const racine = document.querySelector(selecteur) ?? document.body;
    const titre = Array.from(racine.querySelectorAll('div')).find((el) => /^(TVA NETTE À DÉCAISSER|CRÉDIT DE TVA À REPORTER)$/.test((el.textContent ?? '').trim()));
    return titre ? { sens: (titre.textContent ?? '').trim(), valeur: (titre.nextElementSibling?.textContent ?? '').trim() } : null;
  }, FENETRE);
  confronter('TVA nette à décaisser', nombre(forme(net?.valeur)), d ? Math.abs(d.net) : null, 160_000);
  R.egal('TVA · sens affiché', 'calcul à la main', 'TVA NETTE À DÉCAISSER', net?.sens ?? null);
}

async function ecranImmobilisations(page: Page, c: Client, att: Attendus) {
  await ouvrirParMenu(page, 'Immobilisations', ['Structure', 'Immobilisations']);
  await fenetre(page).getByText(att.immobilisation.designation).first().waitFor({ timeout: 20_000 });
  const lignes = await page.evaluate(
    ({ selecteur, designation }) => {
      const racine = document.querySelector(selecteur) ?? document.body;
      return Array.from(racine.querySelectorAll('div'))
        .filter((el) => getComputedStyle(el).display === 'grid' && (el.children[0]?.textContent ?? '').trim().startsWith(designation))
        .map((el) => Array.from(el.children).map((e) => (e.textContent ?? '').trim()));
    },
    { selecteur: FENETRE, designation: att.immobilisation.designation },
  );
  const l = lignes[0] ?? null;
  const api: Json[] = (await c.lire('Immobilisations', '/immobilisations')) ?? [];
  const im = api.find((x) => x.designation === att.immobilisation.designation);
  const cumul = im ? im.dotations.reduce((s: number, d: Json) => s + Number(d.montant), 0) : null;
  const deprecie = im ? im.depreciations.reduce((s: number, d: Json) => s + (d.sens === 'DOTATION' ? Number(d.montant) : -Number(d.montant)), 0) : 0;
  confronter(`${att.immobilisation.designation} · valeur d'origine`, l ? nombre(forme(l[2])) : null, im ? Number(im.valeurOrigine) : null, att.immobilisation.valeurOrigine);
  confronter(`${att.immobilisation.designation} · cumul amorti`, l ? nombre(forme(l[3])) : null, cumul, att.immobilisation.cumulAmorti);
  confronter(`${att.immobilisation.designation} · valeur nette comptable`, l ? nombre(forme(l[4])) : null, im && cumul !== null ? Number(im.valeurOrigine) - cumul - deprecie : null, att.immobilisation.vnc);
}

async function ecranBulletin(page: Page, c: Client, bulletinId: string | null) {
  await ouvrirParMenu(page, 'Paie du mois · bulletins de septembre 2026', ['Traitement', 'Clôture', 'Paie du mois']);
  const mois = fenetre(page).locator('input[type=month]').first();
  await mois.waitFor({ timeout: 20_000 });
  await mois.fill('2026-09');
  await fenetre(page).getByText('MBUYI').first().waitFor({ timeout: 20_000 });
  const api = await c.lire('Bulletins de septembre', '/personnel/bulletins?mois=2026-09');
  const b = (api?.bulletins ?? []).find((x: Json) => x.id === bulletinId) ?? null;
  const ligneListe = (await lignesTableau(page, 'MBUYI'))[0] ?? null;
  // Calcul à la main plus haut (monterSarl) · versé 1 500 000, IRPP 194 300, net 1 230 700.
  confronter('liste · total versé', ligneListe ? nombre(forme(ligneListe[2])) : null, b?.totalVerseFc, 1_500_000);
  confronter('liste · IRPP retenu', ligneListe ? nombre(forme(ligneListe[3])) : null, b?.irppFc, 194_300);
  confronter('liste · net à payer', ligneListe ? nombre(forme(ligneListe[4])) : null, b?.netAPayerFc, 1_230_700);
  const pied = (await lignesTableau(page, 'Total des 1 bulletin(s) émis · les annulés n’y entrent pas'))[0] ?? null;
  confronter('total des bulletins · net à payer', pied ? nombre(forme(pied[3])) : null, api?.totauxEmis?.netAPayerFc, 1_230_700);
  await fenetre(page).getByRole('button', { name: 'Ouvrir', exact: true }).first().click();
  await fenetre(page).getByText('Net à payer', { exact: true }).nth(1).waitFor({ timeout: 15_000 }).catch(() => undefined);
  const detail = await c.lire('Bulletin', `/personnel/bulletins/${bulletinId}`);
  const net = (await lignesTableau(page, 'Net à payer')).find((x) => x.length === 2) ?? null;
  const irpp = (await lignesTableau(page, 'Retenue IRPP')).find((x) => x.length === 2) ?? null;
  const cnss = (await page.evaluate((selecteur) => {
    const racine = document.querySelector(selecteur) ?? document.body;
    return Array.from(racine.querySelectorAll('tr'))
      .map((tr) => Array.from(tr.children).map((td) => (td.textContent ?? '').trim()))
      .filter((c) => c.length === 2 && c[0].startsWith('Retenue ') && c[0].includes('%'));
  }, FENETRE)) as string[][];
  confronter('bulletin ouvert · net à payer', net ? nombre(forme(net[1])) : null, detail?.netAPayerFc, 1_230_700);
  confronter('bulletin ouvert · retenue IRPP', irpp ? nombre(forme(irpp[1].replace(/^−\s*/, ''))) : null, detail?.irppFc, 194_300);
  confronter('bulletin ouvert · retenue CNSS du travailleur', cnss[0] ? nombre(forme(cnss[0][1].replace(/^−\s*/, ''))) : null, detail?.cotisationsTravailleurFc, 75_000);
}

// --- Le parcours -------------------------------------------------------------------

async function parcourirLesEcrans(page: Page, c: Client, att: Attendus, bulletinId: string | null) {
  formesFautives.length = 0;
  const pannes = surveiller(page);
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': adresseNeuve() });
  await seConnecter(page, c.email);
  R.ecran = 'connexion';
  // L'exercice de travail au démarrage · un seul exercice ouvert (2026), retenu d'office.
  const choisi = await page.locator('select[aria-label="Exercice de travail"]').inputValue().catch(() => null);
  R.egal('exercice de travail au démarrage = 2026 (seul ouvert)', 'calcul à la main', att.n, choisi);

  const ecrans: [string, () => Promise<void>][] = [
    ['Tableau de bord', () => ecranTableauDeBord(page, c, att)],
    ['Balance 2026', () => ecranBalance(page, c, att, att.n, att.totauxBalanceN, att.comptesBalance)],
    ['Grand livre', () => ecranGrandLivre(page, c, att)],
    ['Journal', () => ecranJournal(page, c, att)],
    ['États financiers 2026', () => ecranEtatsFinanciers(page, c, att, att.n)],
    ['Notes annexes', () => ecranNotes(page, c, att)],
    ['Balance âgée', () => ecranBalanceAgee(page, c, att)],
    ['Relances', () => ecranRelances(page, c, att)],
    ['Immobilisations', () => ecranImmobilisations(page, c, att)],
    ...(att.referentiel === 'SYSCOHADA'
      ? ([
          ['Déclaration de TVA', () => ecranTva(page, c)],
          ['Bulletin de paie', () => ecranBulletin(page, c, bulletinId)],
        ] as [string, () => Promise<void>][])
      : []),
  ];
  for (const [nom, fn] of ecrans) {
    try {
      await fn();
    } catch (e) {
      R.note(`écran « ${nom} » non lu jusqu'au bout · ${(e as Error).message.split('\n')[0]}`);
    }
  }

  // L'EXERCICE CLOS · la clôture traversée, relue à l'écran par le sélecteur d'exercice.
  try {
    await choisirExercice(page, att.n1);
    await ecranBalance(page, c, att, att.n1, att.totauxBalanceN1, {});
    await ecranEtatsFinanciers(page, c, att, att.n1);
    // LA LISTE DES IMMOBILISATIONS SOUS L'EXERCICE CLOS · relevée, pas jugée ·
    // l'écran additionne toutes les dotations du bien (ImmobilisationsPage, `vcn`).
    await ouvrirParMenu(page, 'Immobilisations (exercice 2025 choisi)', ['Structure', 'Immobilisations']);
    await fenetre(page).getByText(att.immobilisation.designation).first().waitFor({ timeout: 20_000 });
    const vnc = await page.evaluate(
      ({ selecteur, designation }) => {
        const racine = document.querySelector(selecteur) ?? document.body;
        const el = Array.from(racine.querySelectorAll('div')).find(
          (d) => getComputedStyle(d).display === 'grid' && (d.children[0]?.textContent ?? '').trim().startsWith(designation),
        );
        return el ? (el.children[4]?.textContent ?? '').trim() : null;
      },
      { selecteur: FENETRE, designation: att.immobilisation.designation },
    );
    R.note(`Immobilisations, exercice 2025 choisi · V.N.C. affichée « ${vnc} » pour ${att.immobilisation.designation} (bilan 2025 · poste ${att.immobilisationBilan.ref}, net N-1 ${att.bilan[att.immobilisationBilan.ref]?.n1})`);
  } catch (e) {
    R.note(`exercice 2025 non lu jusqu'au bout · ${(e as Error).message.split('\n')[0]}`);
  }

  R.ecran = 'forme des montants';
  R.egal('tous les montants lus ont deux décimales et des milliers à espace insécable', 'forme', [], [...new Set(formesFautives)].slice(0, 10));
  R.ecran = 'pannes';
  R.egal('aucune exception JavaScript ni réponse 5xx pendant le parcours', 'forme', [], pannes);
}

// --- Le test ---------------------------------------------------------------------

/*
 * UN SEUL TEST POUR LES DEUX DOSSIERS · Playwright relance son processus après
 * un test en échec, et le registre (tenu en mémoire) partirait avec lui. Les
 * écarts ne s'affirment qu'à la fin, une fois le fichier de résultat écrit.
 */
test('les écrans de chiffres affichent le montant du serveur et du calcul à la main · SARL puis association', async ({ page }) => {
  test.setTimeout(2_400_000);
  const sarl = await monterSarl();
  if (sarl) await parcourirLesEcrans(page, sarl.c, sarl.att, sarl.bulletinId);
  else R.note('dossier SARL non monté · ses écrans ne sont pas lus');
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear()).catch(() => undefined);
  const asso = await monterAssociation();
  if (asso) await parcourirLesEcrans(page, asso.c, asso.att, null);
  else R.note('dossier associatif non monté · ses écrans ne sont pas lus');

  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, JSON.stringify(R.bilan(), null, 2));
  const b = R.bilan();
  console.log(`\nSimulation des écrans · ${b.nombreControles} contrôles, ${b.concordances} concordances, ${b.nombreEcarts} écarts, ${b.nombreErreursHttp} erreurs HTTP · ${SORTIE}`);
  expect(sarl, 'dossier SARL monté par l’API').not.toBeNull();
  expect(asso, 'dossier associatif monté par l’API').not.toBeNull();
  expect.soft(b.erreursHttp.map((e) => `${e.dossier} · ${e.geste} · ${e.statut}`), 'erreurs HTTP du montage').toEqual([]);
  expect.soft(b.ecarts.map((x) => `${x.dossier} · ${x.ecran} · ${x.libelle}`), 'écarts (détail dans le fichier de résultat)').toEqual([]);
});
