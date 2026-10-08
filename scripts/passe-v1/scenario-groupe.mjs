/**
 * SCÉNARIO GROUPE · une entité tenue en plusieurs dossiers (module groupe,
 * CLAUDE.md § 6 « Module groupe, COMMUN »), dans les DEUX référentiels,
 * exercices 2026 (N) et 2027 (N+1), clôtures comprises.
 *
 * Sources lues avant d'écrire un attendu ·
 *  · docs/pilote/guide-siege.md et guide-tresorier-cellule.md (les gestes) ;
 *  · SYCEBNL, Partie 2 ch. 3, fiche du COMPTE 58 (« Virements internes ·
 *    585 Virements de fonds » ; débité « par le crédit des comptes de
 *    trésorerie » chez l'émetteur, crédité « par le débit des comptes de
 *    trésorerie » chez le receveur) ;
 *  · AUDCIF Titre VII, fiche du COMPTE 18 (« 184 Comptes permanents bloqués,
 *    185 Comptes permanents non bloqués des établissements et succursales »,
 *    « les comptes de liaison sont égaux et de sens contraire dans les deux
 *    comptabilités », 184 à 187 « réservée aux opérations entre établissements
 *    d'une même entité ») ;
 *  · src/modules/groupe/ (agrégat, éliminations, liasse, supervision,
 *    canevas), plateforme.service.ts (plafond de cellules), tenant.service.ts
 *    (système figé), tiers.service.ts (rattachement d'un tiers à une cellule).
 *
 * Le PLAFOND DE CELLULES ne se pose que depuis la console de VMG Consulting
 * (`PATCH /plateforme/cabinets/:id/groupe`), réservée à l'opérateur de la
 * plateforme sous double authentification. Le drapeau d'opérateur ne
 * s'accorde par AUCUNE route (OperateurPlateformeGuard, « seul le bootstrap
 * OPERATEURS_PLATEFORME l'accorde »), et ce bootstrap ne lit qu'au démarrage
 * des comptes déjà existants · sur une base jetable neuve, le banc pose le
 * drapeau en base sur un compte d'opérateur créé à cette fin (le geste que le
 * démarrage aurait fait), puis passe par la VRAIE console, second facteur
 * TOTP compris. C'est le seul geste hors API du scénario, et il le dit.
 *
 * Tous les montants attendus sont calculés à la main en commentaire, à côté
 * de leur contrôle. Le banc ne contourne aucun refus.
 */
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import ExcelJS from 'exceljs';
import {
  BASE, Client, MOT_DE_PASSE, balance, cloturer, compte, ecriture, etape, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, validerJusqua,
} from './lib.mjs';
import { relireLiasse } from './parcours.mjs';

// --- Outils propres au scénario ----------------------------------------------

/** Base32 de la RFC 4648 · le secret que rend `double-authentification/initier`. */
function depuisBase32(texte) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let valeur = 0;
  const octets = [];
  for (const ch of texte.toUpperCase().replace(/[\s=-]/g, '')) {
    valeur = (valeur << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/** TOTP, RFC 6238 sur HOTP, RFC 4226 · HMAC-SHA1, pas de trente secondes, six chiffres (double-authentification.ts). */
function codeTotp(secret, instantMs) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(instantMs / 1000 / 30)));
  const hmac = createHmac('sha1', depuisBase32(secret)).update(message).digest();
  const decalage = hmac[hmac.length - 1] & 0x0f;
  return String((hmac.readUInt32BE(decalage) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/**
 * L'HEURE DU SERVEUR, lue sur l'en-tête Date · le serveur tourne sous
 * libfaketime (lancer.sh), et le code TOTP se calcule sur SON horloge.
 */
async function heureDuServeur() {
  const r = await fetch(`${BASE}/health`);
  return Date.parse(r.headers.get('date'));
}

/**
 * PROMOTION DE L'OPÉRATEUR EN BASE · voir l'en-tête. La chaîne de connexion
 * n'est jamais affichée ; une erreur ne rend que le code de sortie de psql.
 */
function promouvoirOperateur(email) {
  const url = process.env.PASSE_DATABASE_URL;
  if (!url) throw new Error('PASSE_DATABASE_URL absente · la promotion de l’opérateur ne peut pas se faire');
  try {
    const sortie = execFileSync('psql', [url, '-qtAc',
      `UPDATE users SET "estOperateurPlateforme" = true WHERE email = '${email.replace(/'/g, "''")}' RETURNING email`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return sortie.trim() === email;
  } catch (e) {
    throw new Error(`psql a échoué (code ${e.status ?? '?'})`);
  }
}

/** Un dossier dont la session est ouverte · plan, journaux, exercices chargés comme `nouveauDossier`. */
async function chargerDossier(c) {
  c.moi = await c.lire('Session du dossier', '/auth/me');
  c.tenantId = c.moi?.tenant?.id ?? null;
  await rechargerComptes(c);
  c.journaux = (await c.lire('Journaux', '/journaux')) ?? [];
  c.journal = (code) => c.journaux.find((j) => j.code === code);
  c.od = c.journal('OD') ?? c.journaux.find((j) => j.type === 'GENERAL');
  await rechargerExercices(c);
  return c;
}

/** Une connexion par l'écran de connexion · rend la réponse brute (statut, corps). */
async function seConnecter(R, email, motDePasse, nom) {
  const c = new Client(R);
  c.email = email;
  c.nom = nom;
  const r = await c.req('POST', '/auth/login', { email, motDePasse });
  return { c, r };
}

/**
 * UNE TENTATIVE QUI DOIT ÊTRE REFUSÉE · le refus est le résultat attendu, il
 * se consigne en contrôle (jamais en erreur HTTP), et la réponse est fouillée ·
 * aucune chaîne propre à un dossier d'ailleurs ne doit y paraître.
 */
async function tenter(R, c, libelle, methode, chemin, corps, fouille = [], refusAdmis = [400, 403, 404]) {
  const r = await c.req(methode, chemin, corps);
  const lu = refusAdmis.includes(r.statut) ? 'refusé' : `statut ${r.statut}`;
  R.egal(`${libelle} · refusé (${refusAdmis.join(' ou ')})`, 'refusé', lu);
  const texte = JSON.stringify(r.corps ?? '');
  if (fouille.length) R.egal(`${libelle} · réponse sans donnée d’un autre dossier`, [], fouille.filter((m) => texte.includes(m)));
  if (!refusAdmis.includes(r.statut)) R.note(`${libelle} · ${methode} ${chemin} · ${r.statut} · ${texte.slice(0, 300)}`);
  return r;
}

/**
 * UNE LECTURE PAR L'EXERCICE D'UN AUTRE DOSSIER · la garde de cloisonnement
 * rend inexistante la ligne d'un autre dossier (CLAUDE.md § 8) · un refus ou
 * une réponse VIDE sont deux formes admises de cette inexistence, une ligne
 * ou un marqueur de l'autre dossier ne l'est pas.
 */
async function rienDAilleurs(R, c, libelle, chemin, fouille) {
  const r = await c.req('GET', chemin);
  const texte = JSON.stringify(r.corps ?? '');
  const vide = r.statut === 200 && ['ecritures', 'lignes'].every((k) => !Array.isArray(r.corps?.[k]) || r.corps[k].length === 0);
  R.egal(`${libelle} · refusé ou vide`, true, [403, 404].includes(r.statut) || vide);
  R.egal(`${libelle} · réponse sans donnée d’un autre dossier`, [], fouille.filter((m) => texte.includes(m)));
}

/** La ligne d'un compte dans la balance agrégée. */
const ligneAgregat = (ag, numero) => (ag?.lignes ?? []).find((l) => l.numero === numero) ?? null;
/** Une élimination, retrouvée par dossier et compte. */
const elimination = (ag, dossier, numero) => (ag?.eliminations ?? []).find((e) => e.dossier === dossier && e.numero === numero) ?? null;

/** Une ligne d'un dossier dans la supervision. */
const ligneSupervision = (sup, id) => (sup?.cellules ?? []).find((l) => l.id === id) ?? null;

/**
 * Un exercice civil créé à la main dans un dossier (les cellules naissent sur
 * l'année du serveur). LES EXERCICES SE SUIVENT SANS INTERRUPTION (constat
 * G3, AUDCIF art. 34 ; SYCEBNL art. 16, 4°) · une cellule née en 2028 qui doit
 * tenir 2026 crée d'abord 2027, comme le refus du serveur le demande. Un
 * exercice déjà ouvert n'est pas recréé.
 */
async function ouvrirExercice(c, annee) {
  await rechargerExercices(c);
  if (c.exercices.has(String(annee))) return c.exercices.get(String(annee)).id;
  const annees = [...c.exercices.keys()].map(Number);
  const plusProcheApres = annees.filter((a) => a > annee).sort((a, b) => a - b)[0];
  const depart = plusProcheApres !== undefined ? plusProcheApres - 1 : annee;
  for (let a = depart; a >= annee; a--) {
    if (c.exercices.has(String(a))) continue;
    await c.geste(`Exercice ${a} · ${c.nom}`, 'POST', '/exercices', { dateDebut: `${a}-01-01`, dateFin: `${a}-12-31` });
    await rechargerExercices(c);
  }
  return c.exercices.get(String(annee))?.id ?? null;
}

/**
 * LE REPORT À-NOUVEAU D'UN COMPTE DANS LA FEUILLE « BALANCE N » DE LA LIASSE ·
 * colonne « Mouvements au <veille> » (débit, crédit), présentation du cabinet
 * (presentation-fpm.ts). Rend null si la feuille ou la ligne manque.
 */
function reportDansLaBalanceDeLaLiasse(wb, numero) {
  const ws = wb?.getWorksheet('BALANCE N');
  if (!ws) return null;
  let colonne = null;
  let ligneTrouvee = null;
  ws.eachRow((row) => {
    row.eachCell((cell, col) => {
      const v = cell.value;
      const texte = typeof v === 'string' ? v : (v?.richText ? v.richText.map((x) => x.text).join('') : '');
      if (colonne === null && /^Mouvements au \d\d\/\d\d\/\d\d$/.test(texte.trim())) colonne = col;
      if (String(v ?? '').trim() === numero && ligneTrouvee === null) ligneTrouvee = row;
    });
  });
  if (colonne === null || ligneTrouvee === null) return null;
  const n = (x) => (typeof x === 'number' ? x : (x === null || x === undefined || x === '' ? 0 : Number(x?.result ?? x)));
  return { debit: n(ligneTrouvee.getCell(colonne).value), credit: n(ligneTrouvee.getCell(colonne + 1).value) };
}

/** Un canevas rempli à partir du canevas officiel téléchargé · lignes [date, libellé, rubrique, encaissement, décaissement, trésorerie]. */
async function remplirCanevas(octets, lignes) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(octets);
  const ws = wb.getWorksheet('Journal de trésorerie');
  lignes.forEach(([date, libelle, rubrique, enc, dec, tresorerie], i) => {
    const row = ws.getRow(6 + i);
    row.getCell(1).value = new Date(`${date}T00:00:00Z`);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(2).value = libelle;
    row.getCell(3).value = rubrique;
    if (enc) row.getCell(4).value = enc;
    if (dec) row.getCell(5).value = dec;
    row.getCell(6).value = tresorerie;
    row.commit();
  });
  return Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
}

let compteurAdresses = 0;
const adresseTitulaire = (cle) => `passe-v1-groupe-${cle}-${Date.now()}-${compteurAdresses++}@exemple.cd`;

// --- La console de VMG Consulting ----------------------------------------------

/**
 * L'OPÉRATEUR DE LA PLATEFORME, second facteur actif · rend son client, ou
 * null si la console n'a pas pu s'ouvrir (le scénario le dit et continue).
 */
async function consoleVmg(R) {
  const op = await nouveauDossier(R, 'VMG Consulting · console du banc', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'console', exercice: ['2026-01-01', '2026-12-31'],
  });
  R.egal('Console · drapeau d’opérateur posé (geste du démarrage, voir l’en-tête)', true, promouvoirOperateur(op.email));
  // Sans second facteur, la console se ferme (OperateurPlateformeGuard).
  const sans = await op.req('GET', '/plateforme/cabinets');
  R.egal('Console · refusée sans double authentification (403)', 403, sans.statut);
  const init = await op.geste('Double authentification · initier', 'POST', '/auth/double-authentification/initier', {});
  if (!init?.secret) return null;
  const code = codeTotp(init.secret, await heureDuServeur());
  const act = await op.geste('Double authentification · activer', 'POST', '/auth/double-authentification/activer', { motDePasseActuel: MOT_DE_PASSE, code });
  R.egal('Console · huit codes de secours rendus une fois', 8, act?.codesSecours?.length ?? null);
  const avec = await op.req('GET', '/plateforme/cabinets');
  R.egal('Console · ouverte après la double authentification', 200, avec.statut);
  return avec.statut === 200 ? op : null;
}

// --- Le scénario -----------------------------------------------------------------

export default async function scenarioGroupe(registre) {
  registre.scenario = 'Groupe';
  const R = registre;

  const op = await etape(R, 'Console de VMG Consulting (opérateur, double authentification)', () => consoleVmg(R));
  if (!op) R.note('Groupe · console fermée · aucun plafond de cellules ne peut être posé, les créations de cellules seront refusées');

  const sycebnl = await etape(R, 'SYCEBNL · association siège et deux cellules', () => groupeSycebnl(R, op));
  await etape(R, 'SYCEBNL · variante sans virement interne · N et N+1, éliminations dans leur colonne', () => groupeSansVirement(R, op));
  await etape(R, 'SYSCOHADA · société siège et deux succursales', () => groupeSyscohada(R, op, sycebnl));
}

// ================================================================================
// SYCEBNL · Communauté Bethel, siège et deux cellules
// ================================================================================

const BQ = '52110000'; // « Banques locales · monnaie nationale » (semis SYCEBNL)
const CAISSE = '57100000'; // « Caisse · monnaie nationale »
const VIREMENT = '58500000'; // « Virements de fonds » (fiche du COMPTE 58)
const DIMES = '70440000'; // « Revenus liés à la générosité · zakat, dîme, quête et assimilées »
const ACCESSOIRES = '70700000'; // « Produits accessoires »
const DEPLACEMENTS = '61810000'; // « Voyages et déplacements »
const FORMATION = '63300000'; // « Frais de formation »
const AIDES = '65200000'; // « Subventions accordées par l'entité »

/** Les marqueurs de chaque dossier, écrits dans ses libellés · c'est par eux que le banc cherche une fuite. */
const MARQUE = { S: 'BETHEL-SIEGE-K3', A: 'BETHEL-NGAL-P8', B: 'BETHEL-KINT-W5', X: 'HORIZON-HORS-Z2' };

async function groupeSycebnl(R, op) {
  const S = await nouveauDossier(R, 'Passe groupe · Communauté Bethel (siège)', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'bethel', exercice: ['2026-01-01', '2026-12-31'],
  });
  const s26 = S.exercices.get('2026').id;
  const bqS = S.journal('BQ') ?? S.od;

  // --- 1 · Création des cellules par le siège ---------------------------------------
  // Sans plafond posé par la console, la création est refusée (plafondCellules
  // null, GroupeService.creerCellule).
  await tenter(R, S, 'SYCEBNL · création d’une cellule avant que la console ait ouvert le plafond', 'POST', '/groupe/cellules',
    { nom: 'Bethel · cellule refusée', emailAdmin: adresseTitulaire('refus') }, [], [400]);
  if (op) await op.geste('Console · plafond de deux cellules pour Bethel', 'PATCH', `/plateforme/cabinets/${S.tenantId}/groupe`, { plafondCellules: 2 });
  const me = await S.lire('Session du siège', '/auth/me');
  R.egal('SYCEBNL · le siège peut créer des cellules (/auth/me)', true, me?.tenant?.peutCreerCellules ?? null);

  const creer = async (cle, nom, jeu) => {
    const email = adresseTitulaire(cle);
    const r = await S.geste(`Création de la cellule ${nom}`, 'POST', '/groupe/cellules', { nom, emailAdmin: email, jeuEtatsFinanciersSycebnl: jeu });
    return r ? { id: r.tenant?.id, email, provisoire: r.motDePasseTemporaire, nom, tenant: r.tenant } : null;
  };
  // A · grande cellule autonome, Système normal (jeu des associations) ; B ·
  // petite cellule en Système minimal de trésorerie (guide du siège, § 1).
  const cA = await creer('ngaliema', 'Bethel · cellule Ngaliema', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS');
  const cB = await creer('kintambo', 'Bethel · cellule Kintambo', 'SYSTEME_MINIMAL_TRESORERIE');
  if (!cA || !cB) {
    R.note('SYCEBNL · cellules non créées · le reste du groupe SYCEBNL n’est pas joué');
    return null;
  }
  R.egal('SYCEBNL · la cellule A naît au référentiel du siège', 'SYCEBNL', cA.tenant?.referentiel ?? null);
  R.egal('SYCEBNL · la cellule B naît au référentiel du siège', 'SYCEBNL', cB.tenant?.referentiel ?? null);
  R.egal('SYCEBNL · la cellule B tient le jeu choisi par le siège (SMT)', 'SYSTEME_MINIMAL_TRESORERIE', cB.tenant?.jeuEtatsFinanciersSycebnl ?? null);
  R.egal('SYCEBNL · mot de passe provisoire rendu une fois', true, Boolean(cA.provisoire) && Boolean(cB.provisoire));
  await tenter(R, S, 'SYCEBNL · troisième cellule au-delà du plafond de deux', 'POST', '/groupe/cellules',
    { nom: 'Bethel · cellule de trop', emailAdmin: adresseTitulaire('trop') }, [], [400]);
  const liste = await S.lire('Cellules du siège', '/groupe/cellules');
  R.egal('SYCEBNL · cellules rattachées au siège', [cB.nom, cA.nom].sort(), (liste?.cellules ?? []).map((x) => x.nom).sort());
  R.egal('SYCEBNL · plus de création possible au plafond', false, liste?.peutCreerCellule ?? null);

  // --- 2 · Première connexion des titulaires (mot de passe provisoire) ---------------
  const premiereConnexion = async (cell) => {
    const { c, r } = await seConnecter(R, cell.email, cell.provisoire, cell.nom);
    R.egal(`${cell.nom} · connexion au mot de passe provisoire`, true, r.statut < 300);
    const moi = await c.lire('Session du titulaire', '/auth/me');
    R.egal(`${cell.nom} · le mot de passe est à changer`, true, moi?.doitChangerMotDePasse ?? null);
    // MotDePasseAChangerGuard ferme tout le serveur sauf trois routes de sortie.
    const ferme = await c.req('GET', '/comptes');
    R.egal(`${cell.nom} · serveur fermé tant que le mot de passe est provisoire (403)`, 403, ferme.statut);
    await c.geste(`${cell.nom} · choix de son mot de passe`, 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: cell.provisoire, nouveauMotDePasse: MOT_DE_PASSE });
    const apres = await c.lire('Session du titulaire après changement', '/auth/me');
    R.egal(`${cell.nom} · mot de passe définitif`, false, apres?.doitChangerMotDePasse ?? null);
    // L'ancien mot de passe ne sert plus · le siège ne connaît plus le nouveau.
    const ancien = await seConnecter(R, cell.email, cell.provisoire, cell.nom);
    R.egal(`${cell.nom} · le mot de passe provisoire ne rouvre plus le dossier`, true, ancien.r.statut >= 400);
    await chargerDossier(c);
    R.egal(`${cell.nom} · plan semé lisible (dossier né complet)`, true, c.comptes.size > 100);
    return c;
  };
  const A = await premiereConnexion(cA);
  const B = await premiereConnexion(cB);
  A.cellule = cA;
  B.cellule = cB;

  // Les cellules naissent sur l'année du SERVEUR (ExerciceService.
  // creerExerciceCourant · horloge du banc au 15 février 2028), pas sur
  // l'exercice du siège · leurs chiffres 2026 n'ont donc pas encore d'exercice.
  R.egal('SYCEBNL · la cellule A naît avec un seul exercice, celui de l’année du serveur (2028)', ['2028'], [...A.exercices.keys()]);

  // --- 3 · 2026 · siège ----------------------------------------------------------
  const ctx = {};
  await etape(R, 'SYCEBNL 2026 · opérations du siège', async () => {
    await ecriture(S, 'S1 dîmes et quêtes', s26, '2026-02-15', `Dîmes et quêtes ${MARQUE.S}`, [[BQ, 12_000_000, 0], [DIMES, 0, 12_000_000]], { journal: bqS });
    await ecriture(S, 'S2 virement à Ngaliema', s26, '2026-03-10', `Virement à Ngaliema ${MARQUE.S}`, [[VIREMENT, 3_000_000, 0], [BQ, 0, 3_000_000]], { journal: bqS });
    await ecriture(S, 'S3 virement à Kintambo', s26, '2026-04-05', `Virement à Kintambo ${MARQUE.S}`, [[VIREMENT, 1_000_000, 0], [BQ, 0, 1_000_000]], { journal: bqS });
    await validerJusqua(S, s26, '2026-12-31');
  });

  // Les cellules sans exercice sur la période · leurs chiffres MANQUERAIENT.
  await etape(R, 'SYCEBNL · cellules sans exercice 2026 · agrégat et liasse', async () => {
    const ag = await S.lire('Balance agrégée 2026 (cellules sans exercice)', `/groupe/balance-agregee?exerciceId=${s26}`);
    R.egal('Agrégat 2026 · cellules sans exercice nommées', [cA.nom, cB.nom].sort(), (ag?.cellulesSansExercice ?? []).map((x) => x.nom).sort());
    const l = await S.req('GET', `/groupe/liasse/excel?exerciceId=${s26}`);
    R.egal('Liasse 2026 refusée tant qu’une cellule n’a pas d’exercice sur la période', 400, l.statut);
    R.egal('Liasse 2026 · le refus nomme les cellules sans exercice', true, /sans exercice sur la période/.test(JSON.stringify(l.corps ?? '')));
    const sup = await S.lire('Supervision 2026 (cellules sans exercice)', `/groupe/supervision?exerciceId=${s26}`);
    R.egal('Supervision 2026 · cellule sans exercice jamais « prête »', false, ligneSupervision(sup, cA.id)?.prete ?? null);
  });

  const a26 = await ouvrirExercice(A, 2026);
  const a27 = await ouvrirExercice(A, 2027);
  const b26 = await ouvrirExercice(B, 2026);
  const b27 = await ouvrirExercice(B, 2027);
  ctx.a26 = a26;
  ctx.b26 = b26;
  const bqA = A.journal('BQ') ?? A.od;
  const caB = B.journal('CA') ?? B.od;

  // --- 4 · Opérations réciproques · un tiers rattaché à l'autre dossier ----------------
  await etape(R, 'SYCEBNL · tiers rattachés à une cellule du groupe', async () => {
    const dossiersS = await S.lire('Dossiers du groupe vus du siège', '/tiers/dossiers-du-groupe');
    R.egal('Siège · dossiers désignables comme cellule (identité seule)', [cB.nom, cA.nom].sort(), (dossiersS ?? []).map((d) => d.nom).sort());
    const dossiersA = await A.lire('Dossiers du groupe vus de Ngaliema', '/tiers/dossiers-du-groupe');
    R.egal('Cellule A · dossiers désignables (le siège et sa sœur)', [S.nom, cB.nom].sort(), (dossiersA ?? []).map((d) => d.nom).sort());
    const tS = await S.geste('Tiers « Cellule Ngaliema » au siège', 'POST', '/tiers', { type: 'CLIENT', code: 'CEL-NGAL', nom: 'Cellule Ngaliema', creerCompteIndividuel: true, celluleGroupeId: cA.id });
    const tA = await A.geste('Tiers « Siège Bethel » à Ngaliema', 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'SIEGE', nom: 'Siège Bethel', creerCompteIndividuel: true, celluleGroupeId: S.tenantId });
    await rechargerComptes(S);
    await rechargerComptes(A);
    ctx.c412 = tS?.compteIndividuel?.numero ?? null;
    ctx.c401 = tA?.compteIndividuel?.numero ?? null;
    R.egal('Siège · compte individuel du tiers-cellule sous le collectif 412 (clients-usagers)', true, Boolean(ctx.c412?.startsWith('412')));
    R.egal('Cellule A · compte individuel du tiers-siège sous le collectif 401', true, Boolean(ctx.c401?.startsWith('401')));
  });

  // --- 5 · 2026 · cellules et opération réciproque ------------------------------------
  await etape(R, 'SYCEBNL 2026 · opérations des cellules et refacturation interne', async () => {
    // Fiche du COMPTE 58 · le receveur débite la trésorerie par le crédit du 585.
    await ecriture(A, 'A1 virement reçu du siège', a26, '2026-03-12', `Virement reçu du siège ${MARQUE.A}`, [[BQ, 3_000_000, 0], [VIREMENT, 0, 3_000_000]], { journal: bqA });
    await ecriture(A, 'A2 quêtes', a26, '2026-05-20', `Quêtes ${MARQUE.A}`, [[BQ, 2_500_000, 0], [DIMES, 0, 2_500_000]], { journal: bqA });
    await ecriture(A, 'A3 déplacements', a26, '2026-07-15', `Déplacements ${MARQUE.A}`, [[DEPLACEMENTS, 400_000, 0], [BQ, 0, 400_000]], { journal: bqA });
    if (ctx.c401) await ecriture(A, 'A4 facture de formation du siège', a26, '2026-06-30', `Formation facturée par le siège ${MARQUE.A}`, [[FORMATION, 600_000, 0], [ctx.c401, 0, 600_000]]);
    if (ctx.c412) await ecriture(S, 'S4 refacturation de la formation à Ngaliema', s26, '2026-06-30', `Formation refacturée à Ngaliema ${MARQUE.S}`, [[ctx.c412, 600_000, 0], [ACCESSOIRES, 0, 600_000]]);
    await ecriture(B, 'B1 virement reçu du siège', b26, '2026-04-06', `Virement reçu du siège ${MARQUE.B}`, [[CAISSE, 1_000_000, 0], [VIREMENT, 0, 1_000_000]], { journal: caB });
    await ecriture(B, 'B2 dîmes', b26, '2026-06-14', `Dîmes ${MARQUE.B}`, [[CAISSE, 800_000, 0], [DIMES, 0, 800_000]], { journal: caB });
    await ecriture(B, 'B3 aides et secours', b26, '2026-09-09', `Aides et secours ${MARQUE.B}`, [[AIDES, 300_000, 0], [CAISSE, 0, 300_000]], { journal: caB });
    // Remontée de Kintambo au siège · l'émetteur débite le 585.
    await ecriture(B, 'B4 remontée au siège', b26, '2026-11-20', `Remontée au siège ${MARQUE.B}`, [[VIREMENT, 200_000, 0], [CAISSE, 0, 200_000]], { journal: caB });
    await ecriture(S, 'S5 remontée de Kintambo reçue', s26, '2026-11-22', `Remontée de Kintambo ${MARQUE.S}`, [[BQ, 200_000, 0], [VIREMENT, 0, 200_000]], { journal: bqS });
    // UN VIREMENT PASSÉ D'UN SEUL CÔTÉ · le siège envoie 500 000 le 28 décembre,
    // Ngaliema ne l'a pas encore saisi.
    await ecriture(S, 'S6 virement de fin d’année à Ngaliema', s26, '2026-12-28', `Virement de fin d'année à Ngaliema ${MARQUE.S}`, [[VIREMENT, 500_000, 0], [BQ, 0, 500_000]], { journal: bqS });
  });

  // --- 6 · Cloisonnement · le siège lit sans modifier ---------------------------------
  await etape(R, 'SYCEBNL · cloisonnement · le siège ne modifie pas une cellule', async () => {
    const bA = await balance(A, a26);
    const brA = await A.lire('Brouillard de Ngaliema', `/ecritures?exerciceId=${a26}`);
    const ecrituresA = Array.isArray(brA) ? brA : (brA?.ecritures ?? brA?.lignes ?? []);
    const uneA = ecrituresA.find((e) => String(e.libelle ?? '').includes('Quêtes'));
    R.egal('Cellule A · une écriture au brouillard à viser', true, Boolean(uneA?.id));
    const lignesHostiles = [{ compteId: compte(A, BQ), libelle: 'Écriture du siège', debit: 999_999, credit: 0 }, { compteId: compte(A, DIMES), libelle: 'Écriture du siège', debit: 0, credit: 999_999 }];
    await tenter(R, S, 'Siège → A · saisir une écriture dans l’exercice de la cellule', 'POST', '/ecritures',
      { exerciceId: a26, journalId: bqA.id, date: '2026-08-01', libelle: 'Écriture du siège', lignes: lignesHostiles }, [MARQUE.A]);
    if (uneA?.id) {
      await tenter(R, S, 'Siège → A · modifier une écriture de la cellule', 'PATCH', `/ecritures/${uneA.id}`, { libelle: 'Retouchée par le siège' }, [MARQUE.A]);
      await tenter(R, S, 'Siège → A · supprimer une écriture de la cellule', 'DELETE', `/ecritures/${uneA.id}`, undefined, [MARQUE.A]);
      await tenter(R, S, 'Siège → A · valider le brouillard de la cellule', 'POST', '/ecritures/valider', { ecritureIds: [uneA.id] }, [MARQUE.A], [400, 403, 404]);
    }
    await tenter(R, S, 'Siège → A · valider jusqu’au 31/12 dans l’exercice de la cellule', 'POST', '/ecritures/valider-jusqua', { exerciceId: a26, dateLimite: '2026-12-31' }, [MARQUE.A]);
    // Hors des routes du groupe, l'exercice d'une cellule n'existe pas pour le siège.
    await rienDAilleurs(R, S, 'Siège → A · lire le journal de la cellule hors des routes du groupe', `/ecritures?exerciceId=${a26}`, [MARQUE.A]);
    const apres = await balance(A, a26);
    R.egal('Cellule A · balance inchangée après les tentatives du siège', JSON.stringify([...bA.parNumero].map(([n, l]) => [n, l.solde])), JSON.stringify([...(apres?.parNumero ?? new Map())].map(([n, l]) => [n, l.solde])));
    const brApres = await A.lire('Brouillard de Ngaliema après tentatives', `/ecritures?exerciceId=${a26}`);
    const ecrituresApres = Array.isArray(brApres) ? brApres : (brApres?.ecritures ?? []);
    R.egal('Cellule A · l’écriture visée est toujours au brouillard, libellé intact', ['BROUILLARD', uneA?.libelle], [ecrituresApres.find((e) => e.id === uneA?.id)?.statut ?? null, ecrituresApres.find((e) => e.id === uneA?.id)?.libelle ?? null]);
  });

  for (const [c, ex] of [[A, a26], [B, b26], [S, s26]]) await validerJusqua(c, ex, '2026-12-31');

  // --- 7 · Le virement passé d'un seul côté ---------------------------------------------
  await etape(R, 'SYCEBNL 2026 · virement passé d’un seul côté', async () => {
    const ag = await S.lire('Balance agrégée 2026 (virement d’un seul côté)', `/groupe/balance-agregee?exerciceId=${s26}`);
    // Somme des 58 par dossier · siège 3 000 000 + 1 000 000 + 500 000 − 200 000
    // = 4 300 000 ; Ngaliema − 3 000 000 ; Kintambo − 1 000 000 + 200 000 =
    // − 800 000 · total + 500 000, le virement que Ngaliema n'a pas saisi.
    R.montant('Agrégat 2026 · écart des 58 (virement d’un seul côté)', 500_000, ag?.controles?.ecartLiaison);
    R.egal('Agrégat 2026 · 58 non neutralisés', false, ag?.controles?.liaisonNeutralisee ?? null);
    const sup = await S.lire('Supervision 2026 (virement d’un seul côté)', `/groupe/supervision?exerciceId=${s26}`);
    R.montant('Supervision · position 58 de Ngaliema', -3_000_000, ligneSupervision(sup, cA.id)?.solde58);
    const l = await S.req('GET', `/groupe/liasse/excel?exerciceId=${s26}`);
    R.egal('Liasse 2026 refusée sur un virement passé d’un seul côté', 400, l.statut);
    R.egal('Liasse 2026 · le refus donne l’écart exact des 58', true, /virements internes \(58\) non neutralisés \(écart 500000\.00\)/.test(JSON.stringify(l.corps ?? '')));
    // Ngaliema saisit le virement · l'agrégat se neutralise.
    await ecriture(A, 'A5 virement de fin d’année reçu du siège', a26, '2026-12-30', `Virement de fin d'année reçu ${MARQUE.A}`, [[BQ, 500_000, 0], [VIREMENT, 0, 500_000]], { journal: bqA });
    await validerJusqua(A, a26, '2026-12-31');
  });

  // --- 8 · Agrégat 2026, contrôle par contrôle ------------------------------------------
  await etape(R, 'SYCEBNL 2026 · balance agrégée, éliminations et supervision', async () => {
    const ag = await S.lire('Balance agrégée 2026', `/groupe/balance-agregee?exerciceId=${s26}`);
    R.egal('Agrégat 2026 · contrôles (équilibre, 58, réciprocités, éliminations, périodes)',
      { tousEquilibres: true, liaisonNeutralisee: true, reciprocitesEquilibrees: true, eliminationsSymetriques: true, periodesConcordantes: true, liaison18Neutralisee: null },
      ag ? { tousEquilibres: ag.controles.tousEquilibres, liaisonNeutralisee: ag.controles.liaisonNeutralisee, reciprocitesEquilibrees: ag.controles.reciprocitesEquilibrees, eliminationsSymetriques: ag.controles.eliminationsSymetriques, periodesConcordantes: ag.controles.periodesConcordantes, liaison18Neutralisee: ag.controles.liaison18Neutralisee } : null);
    // 521 · siège D 12 000 000 + 200 000, C 3 000 000 + 1 000 000 + 500 000 ;
    // Ngaliema D 3 000 000 + 2 500 000 + 500 000, C 400 000 ·
    // D 18 200 000, C 4 900 000, solde 13 300 000.
    R.montant('Agrégat 2026 · 521 débit', 18_200_000, ligneAgregat(ag, BQ)?.totalDebit);
    R.montant('Agrégat 2026 · 521 crédit', 4_900_000, ligneAgregat(ag, BQ)?.totalCredit);
    // 571 · Kintambo D 1 000 000 + 800 000, C 300 000 + 200 000 · solde 1 300 000.
    R.montant('Agrégat 2026 · 571 solde', 1_300_000, ligneAgregat(ag, CAISSE)?.solde);
    // 585 · D siège 4 500 000 + Kintambo 200 000 = 4 700 000 ; C siège 200 000 +
    // Ngaliema 3 500 000 + Kintambo 1 000 000 = 4 700 000 · neutralisé, pas éliminé.
    R.montant('Agrégat 2026 · 585 débit', 4_700_000, ligneAgregat(ag, VIREMENT)?.totalDebit);
    R.montant('Agrégat 2026 · 585 crédit', 4_700_000, ligneAgregat(ag, VIREMENT)?.totalCredit);
    // 7044 · 12 000 000 + 2 500 000 + 800 000.
    R.montant('Agrégat 2026 · 7044 crédit', 15_300_000, ligneAgregat(ag, DIMES)?.totalCredit);
    R.montant('Agrégat 2026 · 6181', 400_000, ligneAgregat(ag, DEPLACEMENTS)?.solde);
    R.montant('Agrégat 2026 · 652', 300_000, ligneAgregat(ag, AIDES)?.solde);
    // La refacturation interne SORT · ni le produit du siège, ni la charge de
    // Ngaliema, ni la créance, ni la dette (fondement-elimination.ts).
    R.egal('Agrégat 2026 · 707, 633, créance et dette internes absents de l’agrégat', [null, null, null, null],
      [ligneAgregat(ag, ACCESSOIRES), ligneAgregat(ag, FORMATION), ctx.c412 && ligneAgregat(ag, ctx.c412), ctx.c401 && ligneAgregat(ag, ctx.c401)].map((x) => (x ? x.solde : null)));
    // Totaux · D 18 200 000 + 1 800 000 + 4 700 000 + 400 000 + 300 000 = 25 400 000 ;
    // C 4 900 000 + 500 000 + 4 700 000 + 15 300 000 = 25 400 000.
    R.montant('Agrégat 2026 · total débit', 25_400_000, ag?.totaux?.debit);
    R.montant('Agrégat 2026 · total crédit', 25_400_000, ag?.totaux?.credit);
    // Éliminations, une par dossier et par compte.
    const eS412 = elimination(ag, S.nom, ctx.c412);
    const eS707 = elimination(ag, S.nom, ACCESSOIRES);
    const eA401 = elimination(ag, cA.nom, ctx.c401);
    const eA633 = elimination(ag, cA.nom, FORMATION);
    R.egal('Élimination 2026 · siège, créance sur Ngaliema · D 600 000', [600_000, 0, 'Créance ou dette réciproque', cA.nom], eS412 ? [eS412.debit, eS412.credit, eS412.motif, eS412.contrepartie] : null);
    R.egal('Élimination 2026 · siège, produit 707 · C 600 000', [0, 600_000, 'Charge ou produit réciproque', cA.nom], eS707 ? [eS707.debit, eS707.credit, eS707.motif, eS707.contrepartie] : null);
    R.egal('Élimination 2026 · Ngaliema, dette envers le siège · C 600 000', [0, 600_000, 'Créance ou dette réciproque', S.nom], eA401 ? [eA401.debit, eA401.credit, eA401.motif, eA401.contrepartie] : null);
    R.egal('Élimination 2026 · Ngaliema, charge 633 · D 600 000', [600_000, 0, 'Charge ou produit réciproque', S.nom], eA633 ? [eA633.debit, eA633.credit, eA633.motif, eA633.contrepartie] : null);
    R.egal('Éliminations 2026 · quatre lignes, toutes sur les mouvements (aucune part d’ouverture ni de clôture)', [4, 0],
      [ag?.eliminations?.length ?? null, (ag?.eliminations ?? []).reduce((s, e) => s + (e.horsMouvement?.reportDebit ?? 0) + (e.horsMouvement?.reportCredit ?? 0) + (e.horsMouvement?.clotureDebit ?? 0) + (e.horsMouvement?.clotureCredit ?? 0), 0)]);
    R.montant('Éliminations 2026 · total retiré au débit', 1_200_000, ag?.totauxEliminations?.debit);
    R.montant('Éliminations 2026 · total retiré au crédit', 1_200_000, ag?.totauxEliminations?.credit);
    // Le détail par dossier reste BRUT · agrégat = détail − éliminations.
    const brut707 = (ag?.detailParDossier ?? []).filter((d) => d.numero === ACCESSOIRES).reduce((s, d) => s + d.totalCredit, 0);
    R.montant('Agrégat 2026 · le détail par dossier garde le 707 brut du siège', 600_000, brut707);

    // Supervision · une ligne par cellule.
    const sup = await S.lire('Supervision 2026', `/groupe/supervision?exerciceId=${s26}`);
    const sA = ligneSupervision(sup, cA.id);
    const sB = ligneSupervision(sup, cB.id);
    // Ngaliema · 521 = 3 000 000 + 2 500 000 + 500 000 − 400 000 = 5 600 000 ;
    // 585 = − 3 500 000 ; cinq écritures, rien au brouillard.
    R.egal('Supervision 2026 · Ngaliema (écritures, brouillard, prête)', [5, 0, true, true], sA ? [sA.nbEcritures, sA.nbBrouillard, sA.equilibre, sA.prete] : null);
    R.montant('Supervision 2026 · Ngaliema · trésorerie', 5_600_000, sA?.tresorerie);
    R.montant('Supervision 2026 · Ngaliema · 58', -3_500_000, sA?.solde58);
    // Kintambo · 571 = 1 300 000 ; 585 = − 800 000 ; quatre écritures.
    R.egal('Supervision 2026 · Kintambo (écritures, brouillard, prête)', [4, 0, true, true], sB ? [sB.nbEcritures, sB.nbBrouillard, sB.equilibre, sB.prete] : null);
    R.montant('Supervision 2026 · Kintambo · trésorerie', 1_300_000, sB?.tresorerie);
    R.montant('Supervision 2026 · Kintambo · 58', -800_000, sB?.solde58);

    // La balance d'une cellule, en lecture, depuis le siège.
    const bc = await S.lire('Balance de Ngaliema lue par le siège', `/groupe/cellules/${cA.id}/balance?exerciceId=${a26}`);
    // Totaux de Ngaliema · D 6 000 000 (521) + 400 000 + 600 000 = 7 000 000 ;
    // C 400 000 (521) + 3 500 000 + 2 500 000 + 600 000 = 7 000 000.
    R.montant('Balance de Ngaliema lue par le siège · total débit', 7_000_000, bc?.totaux?.debit);
    R.montant('Balance de Ngaliema lue par le siège · total crédit', 7_000_000, bc?.totaux?.credit);

    // Le classeur de la balance agrégée · sa feuille « Balance agrégée » est
    // celle qui se réimporte (guide du siège, § 5.6).
    const xl = await S.lire('Balance agrégée 2026 (Excel)', `/groupe/balance-agregee/excel?exerciceId=${s26}`);
    if (xl?.contenu) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(xl.contenu);
      const ws = wb.getWorksheet('Balance agrégée');
      let d = 0;
      let c = 0;
      ws?.eachRow((row, i) => {
        if (i === 1) return;
        d += Number(row.getCell(3).value ?? 0);
        c += Number(row.getCell(4).value ?? 0);
      });
      R.montant('Balance agrégée (Excel) · somme des débits de la feuille réimportable', 25_400_000, d);
      R.montant('Balance agrégée (Excel) · somme des crédits de la feuille réimportable', 25_400_000, c);
      R.egal('Balance agrégée (Excel) · feuilles', ['Balance agrégée', 'Par dossier', 'Éliminations'], wb.worksheets.map((w) => w.name).filter((n) => n !== 'Contrôles'));
    }
  });

  // --- 9 · Cloisonnement · cellules et dossier hors groupe -----------------------------
  const X = await etape(R, 'SYCEBNL · cloisonnement · une cellule, puis un dossier hors groupe', () => cloisonnementSycebnl(R, { S, A, B, cA, cB, s26, a26, b26 }));

  // --- 10 · Canevas de trésorerie ---------------------------------------------------------
  await etape(R, 'SYCEBNL · canevas de trésorerie de Kintambo', () => canevas(R, { S, B, cB }));

  // --- 11 · Liasse 2026 -------------------------------------------------------------------
  await etape(R, 'SYCEBNL 2026 · liasse du groupe', async () => {
    // Bilan agrégé · trésorerie 13 300 000 + 1 300 000 = 14 600 000 à l'actif ;
    // au passif le seul résultat · siège 12 000 000 + 600 000 = 12 600 000,
    // Ngaliema 2 500 000 − 400 000 − 600 000 = 1 500 000, Kintambo 800 000 −
    // 300 000 = 500 000 · 14 600 000 (la refacturation interne se compense).
    await relireLiasse(S, R, 'Groupe SYCEBNL 2026', `/groupe/liasse/excel?exerciceId=${s26}`, { BZ: 14_600_000, DZ: 14_600_000 });
  });

  // --- 12 · Clôtures 2026 · cellules d'abord, siège en dernier (guide du siège, § 5.1) ----
  await etape(R, 'SYCEBNL · clôtures 2026', async () => {
    // LE BILAN INDIVIDUEL D'UN DOSSIER DU GROUPE · le 585 n'est soldé dans
    // AUCUN dossier (le virement sort chez l'un, entre chez l'autre), et le
    // poste BW du bilan des associations ne lit que 52, 53, 55 et 57 (SYCEBNL,
    // Partie 4 ch. 2, correspondance du bilan). Ngaliema · actif 5 600 000
    // (521) ; passif 1 500 000 (résultat) + 600 000 (dette envers le siège) =
    // 2 100 000 · les 3 500 000 du 585 ne sont lus nulle part.
    const bilanA = await A.lire('Bilan individuel de Ngaliema 2026', `/etats-financiers/bilan?exerciceId=${a26}`);
    R.egal('Ngaliema 2026 · bilan individuel (actif, passif) · le 585 hors de tout poste', [5_600_000, 2_100_000], bilanA ? [Number(bilanA.totalActif), Number(bilanA.totalPassif)] : null);
    // Guide du siège, § 5 · chaque dossier clôture, le siège en dernier.
    const clos = {
      A: R.egal('Clôture 2026 · Ngaliema (585 créditeur de 3 500 000, virements reçus du siège)', true, await cloturer(A, '2026')),
      B: R.egal('Clôture 2026 · Kintambo (SMT)', true, await cloturer(B, '2026')),
      S: R.egal('Clôture 2026 · siège (585 débiteur de 4 300 000, virements envoyés)', true, await cloturer(S, '2026')),
    };
    if (clos.A) {
      const bA27 = await balance(A, a27);
      R.montant('Ngaliema 2027 · à-nouveau 521', 5_600_000, solde(bA27, BQ));
      R.montant('Ngaliema 2027 · à-nouveau 585', -3_500_000, solde(bA27, VIREMENT));
      R.montant('Ngaliema 2027 · à-nouveau de la dette envers le siège', -600_000, ctx.c401 ? solde(bA27, ctx.c401) : null);
    } else {
      R.note('Ngaliema · 2026 non clôturé · le 585 que le guide impose aux virements entre dossiers n’est soldé dans aucun dossier, et la clôture refuse le bilan individuel (voir la variante sans virement)');
    }
    if (clos.B) {
      // Kintambo, Système minimal · sa trésorerie se lit sur toute la classe 5
      // (correspondance du SMT), 585 compris · 571 1 300 000, 585 − 800 000.
      const bB27 = await balance(B, b27);
      R.montant('Kintambo 2027 · à-nouveau 571', 1_300_000, solde(bB27, CAISSE));
      R.montant('Kintambo 2027 · à-nouveau 585', -800_000, solde(bB27, VIREMENT));
    }
    // Liasse 2026 régénérée après les clôtures passées · même bilan.
    await relireLiasse(S, R, 'Groupe SYCEBNL 2026 après les clôtures', `/groupe/liasse/excel?exerciceId=${s26}`, { BZ: 14_600_000, DZ: 14_600_000 });
  });

  await rechargerExercices(S);
  await rechargerExercices(A);
  const s27 = S.exercices.get('2027')?.id;
  if (!s27 || A.exercices.get('2026')?.statut !== 'CLOTURE') {
    R.note('SYCEBNL · siège ou Ngaliema non clôturé en 2026 · 2027 du groupe Bethel non joué (sans à-nouveau, l’agrégat 2027 ne voudrait rien dire) · voir la variante sans virement');
    return { S, A, B, cA, cB, X };
  }

  // --- 13 · 2027 -----------------------------------------------------------------------------
  await etape(R, 'SYCEBNL 2027 · opérations', async () => {
    // Ngaliema règle la formation au siège · un règlement interne n'élimine pas
    // la trésorerie, seulement la créance et la dette.
    if (ctx.c401) await ecriture(A, 'A6 règlement de la formation au siège', a27, '2027-02-10', `Règlement au siège ${MARQUE.A}`, [[ctx.c401, 600_000, 0], [BQ, 0, 600_000]], { journal: bqA });
    if (ctx.c412) await ecriture(S, 'S7 règlement reçu de Ngaliema', s27, '2027-02-12', `Règlement de Ngaliema ${MARQUE.S}`, [[BQ, 600_000, 0], [ctx.c412, 0, 600_000]], { journal: bqS });
    await ecriture(S, 'S8 virement à Ngaliema', s27, '2027-03-15', `Virement à Ngaliema ${MARQUE.S}`, [[VIREMENT, 1_000_000, 0], [BQ, 0, 1_000_000]], { journal: bqS });
    await ecriture(A, 'A7 virement reçu du siège', a27, '2027-03-16', `Virement reçu ${MARQUE.A}`, [[BQ, 1_000_000, 0], [VIREMENT, 0, 1_000_000]], { journal: bqA });
    await ecriture(S, 'S9 dîmes 2027', s27, '2027-04-20', `Dîmes ${MARQUE.S}`, [[BQ, 9_000_000, 0], [DIMES, 0, 9_000_000]], { journal: bqS });
    await ecriture(A, 'A8 quêtes 2027', a27, '2027-05-20', `Quêtes ${MARQUE.A}`, [[BQ, 1_800_000, 0], [DIMES, 0, 1_800_000]], { journal: bqA });
    await ecriture(A, 'A9 déplacements 2027', a27, '2027-06-15', `Déplacements ${MARQUE.A}`, [[DEPLACEMENTS, 300_000, 0], [BQ, 0, 300_000]], { journal: bqA });
    await ecriture(B, 'B5 dîmes 2027', b27, '2027-06-14', `Dîmes ${MARQUE.B}`, [[CAISSE, 600_000, 0], [DIMES, 0, 600_000]], { journal: caB });
    await ecriture(B, 'B6 aides 2027', b27, '2027-09-09', `Aides ${MARQUE.B}`, [[AIDES, 200_000, 0], [CAISSE, 0, 200_000]], { journal: caB });
    for (const [c, ex] of [[A, a27], [B, b27], [S, s27]]) await validerJusqua(c, ex, '2027-12-31');
  });

  await etape(R, 'SYCEBNL 2027 · chaque élimination dans sa colonne', async () => {
    const ag = await S.lire('Balance agrégée 2027', `/groupe/balance-agregee?exerciceId=${s27}`);
    R.egal('Agrégat 2027 · contrôles (équilibre, 58, réciprocités, éliminations)', [true, true, true, true],
      ag ? [ag.controles.tousEquilibres, ag.controles.liaisonNeutralisee, ag.controles.reciprocitesEquilibrees, ag.controles.eliminationsSymetriques] : null);
    // La créance du siège sur Ngaliema · reportée à l'à-nouveau (D 600 000),
    // réglée en février (C 600 000) · éliminée colonne par colonne.
    const eS = elimination(ag, S.nom, ctx.c412);
    const eA = elimination(ag, cA.nom, ctx.c401);
    R.egal('Élimination 2027 · créance du siège · D 600 000 dont à-nouveau 600 000, C 600 000 sur les mouvements', [600_000, 600_000, 600_000, 0],
      eS ? [eS.debit, eS.credit, eS.horsMouvement?.reportDebit, eS.horsMouvement?.reportCredit] : null);
    R.egal('Élimination 2027 · dette de Ngaliema · C 600 000 dont à-nouveau 600 000, D 600 000 sur les mouvements', [600_000, 600_000, 0, 600_000],
      eA ? [eA.debit, eA.credit, eA.horsMouvement?.reportDebit, eA.horsMouvement?.reportCredit] : null);
    R.egal('Agrégat 2027 · aucun avertissement d’ouverture non concordante', [], (ag?.avertissements ?? []).filter((a) => /OUVERTURE/.test(a)));
    // Colonne à-nouveau de l'agrégat · 521 = 7 700 000 (siège) + 5 600 000
    // (Ngaliema) ; 571 = 1 300 000 ; 585 D 4 300 000, C 3 500 000 + 800 000.
    R.montant('Agrégat 2027 · à-nouveau 521', 13_300_000, ligneAgregat(ag, BQ)?.reportDebit);
    R.montant('Agrégat 2027 · à-nouveau 585 débit', 4_300_000, ligneAgregat(ag, VIREMENT)?.reportDebit);
    R.montant('Agrégat 2027 · à-nouveau 585 crédit', 4_300_000, ligneAgregat(ag, VIREMENT)?.reportCredit);
    R.egal('Agrégat 2027 · créance et dette internes absentes (à-nouveau compris)', [null, null], [ctx.c412 && ligneAgregat(ag, ctx.c412), ctx.c401 && ligneAgregat(ag, ctx.c401)].map((x) => (x ? x.solde : null)));
    // Soldes 2027 · 521 = siège 7 700 000 + 600 000 − 1 000 000 + 9 000 000
    // = 16 300 000 ; Ngaliema 5 600 000 − 600 000 + 1 000 000 + 1 800 000 −
    // 300 000 = 7 500 000 · 23 800 000. 571 = 1 300 000 + 600 000 − 200 000.
    R.montant('Agrégat 2027 · 521 solde', 23_800_000, ligneAgregat(ag, BQ)?.solde);
    R.montant('Agrégat 2027 · 571 solde', 1_700_000, ligneAgregat(ag, CAISSE)?.solde);
    R.montant('Agrégat 2027 · 585 solde', 0, ligneAgregat(ag, VIREMENT)?.solde);
    // Résultats 2026 reportés · siège 12 600 000, Ngaliema 1 500 000,
    // Kintambo 500 000 · 14 600 000 au crédit du 13.
    const r13 = (ag?.lignes ?? []).filter((l) => l.numero.startsWith('13')).reduce((s, l) => s + l.solde, 0);
    R.montant('Agrégat 2027 · résultat 2026 reporté au 13', -14_600_000, r13);

    // La liasse · actif 23 800 000 + 1 700 000 = 25 500 000 ; passif 14 600 000
    // (résultat 2026 non affecté) + 2027 · 9 000 000 + 1 800 000 + 600 000 −
    // 300 000 − 200 000 = 10 900 000 · 25 500 000.
    const lu = await relireLiasse(S, R, 'Groupe SYCEBNL 2027', `/groupe/liasse/excel?exerciceId=${s27}`, { BZ: 25_500_000, DZ: 25_500_000 });
    // La colonne « Mouvements au 31/12/26 » de la balance de la liasse est
    // l'à-nouveau de la combinaison · 13 300 000 au 521, rien au compte du tiers-cellule.
    const rep = lu ? reportDansLaBalanceDeLaLiasse(lu.wb, BQ) : null;
    R.montant('Liasse 2027 · balance N · à-nouveau du 521 (combinaison)', 13_300_000, rep?.debit);
    R.egal('Liasse 2027 · balance N · aucune ligne pour la créance interne éliminée', null, lu && ctx.c412 ? reportDansLaBalanceDeLaLiasse(lu.wb, ctx.c412) : null);
  });

  await etape(R, 'SYCEBNL · clôtures 2027', async () => {
    R.egal('Clôture 2027 · Ngaliema', true, await cloturer(A, '2027'));
    R.egal('Clôture 2027 · Kintambo', true, await cloturer(B, '2027'));
    R.egal('Clôture 2027 · siège', true, await cloturer(S, '2027'));
    await relireLiasse(S, R, 'Groupe SYCEBNL 2027 après clôtures', `/groupe/liasse/excel?exerciceId=${s27}`, { BZ: 25_500_000, DZ: 25_500_000 });
  });
  return { S, A, B, cA, cB, X };
}

/**
 * LA VARIANTE SANS VIREMENT INTERNE · un siège et une cellule qui n'échangent
 * que par une refacturation, portée par des tiers rattachés à l'autre dossier
 * (412 au siège, 401 à la cellule) et JAMAIS par le 58 · elle sert deux
 * desseins. Prouver la cause du refus de clôture du groupe Bethel (ici, aucun
 * 585 ne reste, et les deux dossiers doivent se clôturer). Jouer N+1, que le
 * groupe Bethel ne peut atteindre · la créance et la dette internes reportées
 * à l'à-nouveau s'éliminent dans la colonne d'à-nouveau (audit final F41),
 * leur règlement dans celle des mouvements.
 */
async function groupeSansVirement(R, op) {
  const V = await nouveauDossier(R, 'Passe groupe · Fraternité Maranatha (siège)', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'maranatha', exercice: ['2026-01-01', '2026-12-31'],
  });
  const v26 = V.exercices.get('2026').id;
  if (op) await op.geste('Console · plafond d’une cellule pour Maranatha', 'PATCH', `/plateforme/cabinets/${V.tenantId}/groupe`, { plafondCellules: 1 });
  const email = adresseTitulaire('maranatha-matete');
  const cr = await V.geste('Création de la cellule Matete', 'POST', '/groupe/cellules', { nom: 'Maranatha · cellule Matete', emailAdmin: email, jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' });
  if (!cr) return R.note('Variante · cellule non créée');
  const { c: W } = await seConnecter(R, email, cr.motDePasseTemporaire, 'Maranatha · cellule Matete');
  await W.geste('Matete · choix de son mot de passe', 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: cr.motDePasseTemporaire, nouveauMotDePasse: MOT_DE_PASSE });
  await chargerDossier(W);
  const w26 = await ouvrirExercice(W, 2026);
  const w27 = await ouvrirExercice(W, 2027);
  const tV = await V.geste('Tiers « Cellule Matete » au siège', 'POST', '/tiers', { type: 'CLIENT', code: 'CEL-MATETE', nom: 'Cellule Matete', creerCompteIndividuel: true, celluleGroupeId: cr.tenant.id });
  const tW = await W.geste('Tiers « Siège Maranatha » à Matete', 'POST', '/tiers', { type: 'FOURNISSEUR', code: 'SIEGE', nom: 'Siège Maranatha', creerCompteIndividuel: true, celluleGroupeId: V.tenantId });
  await rechargerComptes(V);
  await rechargerComptes(W);
  const c412 = tV?.compteIndividuel?.numero;
  const c401 = tW?.compteIndividuel?.numero;
  if (!c412 || !c401) return R.note('Variante · tiers rattachés non créés');
  const bqV = V.journal('BQ') ?? V.od;
  const bqW = W.journal('BQ') ?? W.od;

  await ecriture(V, 'V1 dîmes', v26, '2026-02-15', 'Dîmes Maranatha', [[BQ, 5_000_000, 0], [DIMES, 0, 5_000_000]], { journal: bqV });
  await ecriture(V, 'V2 refacturation de la formation à Matete', v26, '2026-06-30', 'Formation refacturée à Matete', [[c412, 400_000, 0], [ACCESSOIRES, 0, 400_000]]);
  await ecriture(W, 'W1 quêtes', w26, '2026-05-20', 'Quêtes Matete', [[BQ, 1_000_000, 0], [DIMES, 0, 1_000_000]], { journal: bqW });
  await ecriture(W, 'W2 formation facturée par le siège', w26, '2026-06-30', 'Formation du siège', [[FORMATION, 400_000, 0], [c401, 0, 400_000]]);
  await validerJusqua(V, v26, '2026-12-31');
  await validerJusqua(W, w26, '2026-12-31');

  const ag26 = await V.lire('Balance agrégée Maranatha 2026', `/groupe/balance-agregee?exerciceId=${v26}`);
  // 521 · 5 000 000 + 1 000 000 ; 7044 · 6 000 000 ; 707, 633, 412, 401 éliminés.
  R.montant('Variante 2026 · agrégat 521', 6_000_000, ligneAgregat(ag26, BQ)?.solde);
  R.egal('Variante 2026 · quatre éliminations, symétriques', [4, true], ag26 ? [ag26.eliminations.length, ag26.controles.eliminationsSymetriques] : null);
  // Bilan agrégé · 6 000 000 de trésorerie contre 6 000 000 de résultat
  // (siège 5 000 000 + 400 000, Matete 1 000 000 − 400 000).
  await relireLiasse(V, R, 'Variante 2026', `/groupe/liasse/excel?exerciceId=${v26}`, { BZ: 6_000_000, DZ: 6_000_000 });

  // Sans 585, les bilans individuels s'équilibrent · siège 5 000 000 + 400 000
  // à l'actif contre 5 400 000 de résultat ; Matete 1 000 000 contre 400 000
  // de dette et 600 000 de résultat.
  R.egal('Variante · clôture 2026 de Matete (aucun 585)', true, await cloturer(W, '2026'));
  R.egal('Variante · clôture 2026 du siège (aucun 585)', true, await cloturer(V, '2026'));
  await rechargerExercices(V);
  const v27 = V.exercices.get('2027')?.id;
  if (!v27) return R.note('Variante · 2027 du siège absent');

  await ecriture(W, 'W3 règlement au siège', w27, '2027-02-10', 'Règlement au siège', [[c401, 400_000, 0], [BQ, 0, 400_000]], { journal: bqW });
  await ecriture(V, 'V3 règlement de Matete', v27, '2027-02-12', 'Règlement de Matete', [[BQ, 400_000, 0], [c412, 0, 400_000]], { journal: bqV });
  await ecriture(V, 'V4 dîmes 2027', v27, '2027-04-20', 'Dîmes Maranatha 2027', [[BQ, 2_000_000, 0], [DIMES, 0, 2_000_000]], { journal: bqV });
  await validerJusqua(V, v27, '2027-12-31');
  await validerJusqua(W, w27, '2027-12-31');

  const ag = await V.lire('Balance agrégée Maranatha 2027', `/groupe/balance-agregee?exerciceId=${v27}`);
  const eV = elimination(ag, V.nom, c412);
  const eW = elimination(ag, 'Maranatha · cellule Matete', c401);
  // La créance reportée (D 400 000 à l'à-nouveau) et son règlement (C 400 000
  // en mouvement) · chaque part sort de sa colonne.
  R.egal('Variante 2027 · élimination de la créance du siège · D 400 000 à l’à-nouveau, C 400 000 en mouvement', [400_000, 400_000, 400_000, 0],
    eV ? [eV.debit, eV.credit, eV.horsMouvement?.reportDebit, eV.horsMouvement?.reportCredit] : null);
  R.egal('Variante 2027 · élimination de la dette de Matete · C 400 000 à l’à-nouveau, D 400 000 en mouvement', [400_000, 400_000, 0, 400_000],
    eW ? [eW.debit, eW.credit, eW.horsMouvement?.reportDebit, eW.horsMouvement?.reportCredit] : null);
  R.egal('Variante 2027 · ouverture concordante (aucun avertissement d’ouverture)', [], (ag?.avertissements ?? []).filter((x) => /OUVERTURE/.test(x)));
  R.egal('Variante 2027 · créance et dette internes absentes de l’agrégat', [null, null], [ligneAgregat(ag, c412), ligneAgregat(ag, c401)].map((x) => (x ? x.solde : null)));
  // À-nouveau du 521 · 5 000 000 + 1 000 000 ; solde · 6 000 000 − 400 000 +
  // 400 000 + 2 000 000 = 8 000 000.
  R.montant('Variante 2027 · agrégat · à-nouveau 521', 6_000_000, ligneAgregat(ag, BQ)?.reportDebit);
  R.montant('Variante 2027 · agrégat · 521', 8_000_000, ligneAgregat(ag, BQ)?.solde);
  // Bilan 2027 · 8 000 000 de trésorerie contre 6 000 000 de résultat 2026
  // reporté et 2 000 000 de résultat 2027.
  const lu = await relireLiasse(V, R, 'Variante 2027', `/groupe/liasse/excel?exerciceId=${v27}`, { BZ: 8_000_000, DZ: 8_000_000 });
  const rep = lu ? reportDansLaBalanceDeLaLiasse(lu.wb, BQ) : null;
  R.montant('Variante 2027 · balance N de la liasse · à-nouveau du 521 (combinaison)', 6_000_000, rep?.debit);
  R.egal('Variante 2027 · balance N de la liasse · aucune ligne pour la créance interne', null, lu ? reportDansLaBalanceDeLaLiasse(lu.wb, c412) : null);
  R.egal('Variante · clôture 2027 de Matete', true, await cloturer(W, '2027'));
  R.egal('Variante · clôture 2027 du siège', true, await cloturer(V, '2027'));
  await relireLiasse(V, R, 'Variante 2027 après clôtures', `/groupe/liasse/excel?exerciceId=${v27}`, { BZ: 8_000_000, DZ: 8_000_000 });
}

/** Une cellule ne lit ni le siège ni sa sœur ; un dossier hors groupe ne lit rien du groupe. */
async function cloisonnementSycebnl(R, { S, A, B, cA, cB, s26, a26, b26 }) {
  const fouilleA = [MARQUE.S, MARQUE.B];
  const vues = await A.lire('Groupe vu de Ngaliema', '/groupe/cellules');
  R.egal('Ngaliema · aucune cellule sous elle, aucune création possible', [0, false], vues ? [vues.cellules.length, vues.peutCreerCellule] : null);
  await tenter(R, A, 'Ngaliema · créer une cellule', 'POST', '/groupe/cellules', { nom: 'Sous-cellule', emailAdmin: adresseTitulaire('sous') }, fouilleA, [400, 403]);
  await tenter(R, A, 'Ngaliema · balance agrégée', 'GET', `/groupe/balance-agregee?exerciceId=${a26}`, undefined, fouilleA);
  await tenter(R, A, 'Ngaliema · balance du siège par la route du groupe', 'GET', `/groupe/cellules/${S.tenantId}/balance?exerciceId=${s26}`, undefined, fouilleA);
  await tenter(R, A, 'Ngaliema · balance de Kintambo par la route du groupe', 'GET', `/groupe/cellules/${cB.id}/balance?exerciceId=${b26}`, undefined, fouilleA);
  await rienDAilleurs(R, A, 'Ngaliema · balance du siège par son exercice', `/ecritures/balance?exerciceId=${s26}`, fouilleA);
  await rienDAilleurs(R, A, 'Ngaliema · journal de Kintambo par son exercice', `/ecritures?exerciceId=${b26}`, fouilleA);
  await tenter(R, A, 'Ngaliema · canevas de Kintambo', 'GET', `/groupe/cellules/${cB.id}/canevas`, undefined, fouilleA);
  const supA = await A.req('GET', `/groupe/supervision?exerciceId=${a26}`);
  R.egal('Ngaliema · supervision · aucune cellule, rien du siège', [200, 0, []], [supA.statut, supA.corps?.cellules?.length ?? null, fouilleA.filter((m) => JSON.stringify(supA.corps ?? '').includes(m))]);
  const supB = await B.req('GET', `/groupe/cellules/${cA.id}/balance?exerciceId=${a26}`);
  R.egal('Kintambo · balance de sa sœur refusée', true, [403, 404].includes(supB.statut) && !JSON.stringify(supB.corps ?? '').includes(MARQUE.A));

  // Un dossier hors groupe · même référentiel, aucune lecture du groupe.
  const X = await nouveauDossier(R, 'Passe groupe · Association Horizon (hors groupe)', {
    referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'horizon', exercice: ['2026-01-01', '2026-12-31'],
  });
  const x26 = X.exercices.get('2026').id;
  await ecriture(X, 'X1 dons', x26, '2026-03-01', `Dons ${MARQUE.X}`, [[BQ, 700_000, 0], [DIMES, 0, 700_000]], { journal: X.journal('BQ') ?? X.od });
  const fouilleX = [MARQUE.S, MARQUE.A, MARQUE.B];
  await tenter(R, X, 'Hors groupe · balance de Ngaliema', 'GET', `/groupe/cellules/${cA.id}/balance?exerciceId=${a26}`, undefined, fouilleX);
  await tenter(R, X, 'Hors groupe · balance agrégée', 'GET', `/groupe/balance-agregee?exerciceId=${x26}`, undefined, fouilleX);
  await tenter(R, X, 'Hors groupe · balance agrégée sur l’exercice du siège', 'GET', `/groupe/balance-agregee?exerciceId=${s26}`, undefined, fouilleX);
  await tenter(R, X, 'Hors groupe · supervision sur l’exercice du siège', 'GET', `/groupe/supervision?exerciceId=${s26}`, undefined, fouilleX);
  await tenter(R, X, 'Hors groupe · canevas de Kintambo', 'GET', `/groupe/cellules/${cB.id}/canevas`, undefined, fouilleX);
  await tenter(R, X, 'Hors groupe · dépôt d’un canevas chez Kintambo', 'POST', `/groupe/cellules/${cB.id}/import-canevas`, { nomFichier: 'intrus.xlsx', contenuBase64: Buffer.from('intrus').toString('base64') }, fouilleX);
  await tenter(R, X, 'Hors groupe · créer une cellule (aucun plafond)', 'POST', '/groupe/cellules', { nom: 'Intruse', emailAdmin: adresseTitulaire('intruse') }, fouilleX, [400]);
  await tenter(R, X, 'Hors groupe · tiers rattaché à Ngaliema', 'POST', '/tiers', { type: 'CLIENT', code: 'INTRUS', nom: 'Ngaliema vue d’ailleurs', celluleGroupeId: cA.id }, fouilleX);
  await tenter(R, X, 'Hors groupe · liasse du groupe', 'GET', `/groupe/liasse/excel?exerciceId=${x26}`, undefined, fouilleX);
  const dossiersX = await X.lire('Dossiers du groupe vus d’Horizon', '/tiers/dossiers-du-groupe');
  R.egal('Hors groupe · aucun dossier du groupe désignable', [], dossiersX ?? null);
  // Rien n'a bougé chez Ngaliema.
  const bA = await balance(A, a26);
  R.montant('Ngaliema · 521 inchangé après les tentatives', 5_600_000, solde(bA, BQ));

  // L'EXERCICE QUI SUIT · une cellule naît sur l'année du serveur (ici 2028)
  // et ouvre ensuite l'exercice du siège (2026) · la même situation est jouée
  // sur Horizon, hors groupe, pour ne rien déranger · 2026 et 2028 ouverts,
  // 2027 jamais créé. AUDCIF art. 7 (l'exercice coïncide avec l'année civile)
  // et art. 34 (le bilan d'ouverture d'un exercice est le bilan de clôture de
  // l'exercice PRÉCÉDENT) · le report de 2026 va en 2027, qui naît à la clôture.
  await X.geste('Horizon · exercice 2028 (l’année du serveur)', 'POST', '/exercices', { dateDebut: '2028-01-01', dateFin: '2028-12-31' });
  await validerJusqua(X, x26, '2026-12-31');
  if (await cloturer(X, '2026')) {
    await rechargerExercices(X);
    R.egal('Horizon · la clôture de 2026 ouvre 2027, l’exercice qui suit', true, X.exercices.has('2027'));
    const x28 = X.exercices.get('2028')?.id;
    const b28 = x28 ? await balance(X, x28) : null;
    R.montant('Horizon · aucun à-nouveau de 2026 posé en 2028 (521)', 0, solde(b28, BQ));
  }
  return X;
}

/**
 * LE CANEVAS DE KINTAMBO · le guide du siège (§ 4) · télécharger, déposer, tout
 * ou rien, un même fichier compté une fois, lignes au brouillard.
 */
async function canevas(R, { S, B, cB }) {
  const tel = await S.lire('Canevas de Kintambo', `/groupe/cellules/${cB.id}/canevas`);
  if (!tel?.contenu) return;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(tel.contenu);
  const ws = wb.getWorksheet('Journal de trésorerie');
  R.egal('Canevas · marqueur et cellule au cartouche', ['OMEGAX-CANEVAS-V1', cB.nom], [ws?.getCell('A1').value ?? null, ws?.getCell('B2').value ?? null]);
  R.egal('Canevas · exercice du cartouche (exercice ouvert le plus récent de la cellule)', 'du 2028-01-01 au 2028-12-31', ws?.getCell('B3').value ?? null);

  // Dépôt de janvier 2028 · une ligne fausse (montant du mauvais côté) refuse TOUT.
  const faux = await remplirCanevas(tel.contenu, [
    ['2028-01-10', 'Dîmes du dimanche', 'Dîmes, quêtes et assimilées', 300_000, 0, 'Caisse'],
    ['2028-01-17', 'Achat de fournitures', 'Achats de biens et fournitures', 50_000, 0, 'Caisse'],
  ]);
  const r1 = await S.geste('Canevas de janvier 2028 · dépôt avec une ligne fausse', 'POST', `/groupe/cellules/${cB.id}/import-canevas`, { nomFichier: 'canevas-janvier-faux.xlsx', contenuBase64: faux });
  R.egal('Canevas · tout ou rien · une anomalie, ligne 7, rien importé', [false, 0, [7]], r1 ? [r1.importe, r1.lignesImportees, (r1.anomalies ?? []).map((a) => a.ligne)] : null);
  const juste = await remplirCanevas(tel.contenu, [
    ['2028-01-10', 'Dîmes du dimanche', 'Dîmes, quêtes et assimilées', 300_000, 0, 'Caisse'],
    ['2028-01-17', 'Achat de fournitures', 'Achats de biens et fournitures', 0, 50_000, 'Caisse'],
  ]);
  const r2 = await S.geste('Canevas de janvier 2028 · dépôt corrigé', 'POST', `/groupe/cellules/${cB.id}/import-canevas`, { nomFichier: 'canevas-janvier.xlsx', contenuBase64: juste });
  R.egal('Canevas · deux lignes importées au brouillard de la cellule', [true, 2, 'BROUILLARD'], r2 ? [r2.importe, r2.lignesImportees, r2.statut] : null);
  const r3 = await S.req('POST', `/groupe/cellules/${cB.id}/import-canevas`, { nomFichier: 'canevas-janvier.xlsx', contenuBase64: juste });
  R.egal('Canevas · le même fichier ne se compte pas deux fois', 400, r3.statut);
  await rechargerExercices(B);
  const b28 = B.exercices.get('2028')?.id;
  const b = b28 ? await balance(B, b28) : null;
  // 300 000 − 50 000 à la caisse de Kintambo, au brouillard de 2028.
  R.montant('Canevas · caisse de Kintambo en 2028 (brouillard compris)', 250_000, solde(b, CAISSE));

  // LE CANEVAS DE DÉCEMBRE 2026, déposé quand un exercice plus récent est
  // ouvert · le guide (§ 4, guide du trésorier « à la date convenue, chaque
  // mois ») attend qu'il entre dans l'exercice qu'il concerne. L'import ne
  // vise que l'exercice ouvert le PLUS RÉCENT de la cellule (exerciceOuvert,
  // orderBy dateDebut desc) · ici 2028, en pratique N+1 dès qu'il est ouvert,
  // ce qui est la règle entre le 1er janvier et l'arrêté de N (AUDCIF art. 23).
  const dec = await remplirCanevas(tel.contenu, [['2026-12-20', 'Quête de Noël', 'Dîmes, quêtes et assimilées', 150_000, 0, 'Caisse']]);
  const r4 = await S.req('POST', `/groupe/cellules/${cB.id}/import-canevas`, { nomFichier: 'canevas-decembre-2026.xlsx', contenuBase64: dec });
  R.egal('Canevas de décembre 2026 déposé avec 2027 et 2028 ouverts · importé dans l’exercice 2026 de la cellule', true, r4.corps?.importe === true);
  if (r4.corps?.importe !== true) R.note(`Canevas de décembre 2026 · ${r4.statut} · ${JSON.stringify(r4.corps).slice(0, 300)}`);
}

// ================================================================================
// SYSCOHADA · Kivu Négoce SARL, siège et deux succursales
// ================================================================================

const BQ_S = '52110000'; // « Banques en monnaie nationale » (semis SYSCOHADA)
const CAPITAL = '10130000'; // « Capital souscrit, appelé, versé, non amorti »
const BLOQUE = '18400000'; // « Comptes permanents bloqués des établissements et succursales »
const NON_BLOQUE = '18500000'; // « Comptes permanents non bloqués des établissements et succursales »
const SERVICES = '70610000'; // 706 Services vendus · « Dans la Région »
const LOYERS = '62220000'; // « Locations de bâtiments »
const MARQUE_T = { T: 'KIVU-SIEGE-R4', E1: 'KIVU-GOMA-H6', E2: 'KIVU-BUKAVU-J9' };

async function groupeSyscohada(R, op, sycebnl) {
  const T = await nouveauDossier(R, 'Passe groupe · Kivu Négoce SARL (siège)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'kivu', exercice: ['2026-01-01', '2026-12-31'],
  });
  const t26 = T.exercices.get('2026').id;
  const bqT = T.journal('BQ') ?? T.od;
  if (op) await op.geste('Console · plafond de deux succursales pour Kivu Négoce', 'PATCH', `/plateforme/cabinets/${T.tenantId}/groupe`, { plafondCellules: 2 });

  const creer = async (cle, nom) => {
    const email = adresseTitulaire(cle);
    const r = await T.geste(`Création de la succursale ${nom}`, 'POST', '/groupe/cellules', { nom, emailAdmin: email });
    if (!r) return null;
    const { c } = await seConnecter(R, email, r.motDePasseTemporaire, nom);
    await c.geste(`${nom} · choix de son mot de passe`, 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: r.motDePasseTemporaire, nouveauMotDePasse: MOT_DE_PASSE });
    await chargerDossier(c);
    c.cellule = { id: r.tenant?.id, nom };
    return c;
  };
  const E1 = await creer('goma', 'Kivu Négoce · succursale Goma');
  const E2 = await creer('bukavu', 'Kivu Négoce · succursale Bukavu');
  if (!E1 || !E2) {
    R.note('SYSCOHADA · succursales non créées · le reste du groupe SYSCOHADA n’est pas joué');
    return;
  }

  // --- Système imposé, puis figé (F172) --------------------------------------------------
  await etape(R, 'SYSCOHADA · système du siège imposé à la succursale, puis figé', async () => {
    R.egal('Succursale Goma · référentiel et système du siège', ['SYSCOHADA', 'NORMAL'], [E1.moi?.tenant?.referentiel ?? null, E1.moi?.tenant?.systemeComptableSyscohada ?? null]);
    const r1 = await E1.req('PATCH', '/dossier/systeme-syscohada', { systemeComptableSyscohada: 'MINIMAL_TRESORERIE' });
    R.egal('Succursale Goma · changer de système refusé (cellule)', [400, true], [r1.statut, /cellule/.test(JSON.stringify(r1.corps ?? ''))]);
    const r2 = await T.req('PATCH', '/dossier/systeme-syscohada', { systemeComptableSyscohada: 'MINIMAL_TRESORERIE' });
    R.egal('Siège Kivu · changer de système refusé (siège de deux cellules)', [400, true], [r2.statut, /siège de 2 cellule/.test(JSON.stringify(r2.corps ?? ''))]);
    const p = await E1.lire('Paramètres de Goma', '/dossier/parametres');
    R.egal('Succursale Goma · système inchangé', 'NORMAL', p?.systemeComptableSyscohada ?? null);
    // Le canevas de trésorerie est propre au SYCEBNL (filtre de route).
    await tenter(R, T, 'Siège Kivu · canevas de trésorerie (SYCEBNL seul)', 'GET', `/groupe/cellules/${E1.cellule.id}/canevas`, undefined, [], [403]);
    // Le siège SYSCOHADA ne lit pas une cellule de l'autre groupe.
    if (sycebnl?.cA) await tenter(R, T, 'Siège Kivu · balance d’une cellule du groupe Bethel', 'GET', `/groupe/cellules/${sycebnl.cA.id}/balance?exerciceId=${sycebnl.A?.exercices?.get('2026')?.id}`, undefined, [MARQUE.A, MARQUE.S]);
  });

  const e126 = await ouvrirExercice(E1, 2026);
  const e127 = await ouvrirExercice(E1, 2027);
  const e226 = await ouvrirExercice(E2, 2026);
  const e227 = await ouvrirExercice(E2, 2027);
  const bq1 = E1.journal('BQ') ?? E1.od;
  const bq2 = E2.journal('BQ') ?? E2.od;

  // --- 2026 -------------------------------------------------------------------------------
  // Fiche du COMPTE 18 · « au siège, un compte de liaison au nom de chaque
  // établissement […] dans l'établissement, un compte réfléchi au nom du
  // siège » ; « crédités […] par le débit des comptes concernés ; débités […]
  // par le crédit des comptes concernés ». La dotation permanente passe au 184
  // (bloqué), les remontées courantes au 185 (non bloqué).
  await etape(R, 'SYSCOHADA 2026 · opérations du siège et des succursales', async () => {
    await ecriture(T, 'T1 apport en capital', t26, '2026-01-05', `Apport en capital ${MARQUE_T.T}`, [[BQ_S, 20_000_000, 0], [CAPITAL, 0, 20_000_000]], { journal: bqT });
    await ecriture(T, 'T2 dotation permanente de Goma', t26, '2026-01-10', `Dotation permanente de Goma ${MARQUE_T.T}`, [[BLOQUE, 5_000_000, 0], [BQ_S, 0, 5_000_000]], { journal: bqT });
    await ecriture(E1, 'E1-1 dotation permanente reçue', e126, '2026-01-10', `Dotation du siège ${MARQUE_T.E1}`, [[BQ_S, 5_000_000, 0], [BLOQUE, 0, 5_000_000]], { journal: bq1 });
    await ecriture(T, 'T3 dotation permanente de Bukavu', t26, '2026-01-12', `Dotation permanente de Bukavu ${MARQUE_T.T}`, [[BLOQUE, 3_000_000, 0], [BQ_S, 0, 3_000_000]], { journal: bqT });
    await ecriture(E2, 'E2-1 dotation permanente reçue', e226, '2026-01-12', `Dotation du siège ${MARQUE_T.E2}`, [[BQ_S, 3_000_000, 0], [BLOQUE, 0, 3_000_000]], { journal: bq2 });
    await ecriture(T, 'T4 prestations du siège', t26, '2026-03-31', `Prestations ${MARQUE_T.T}`, [[BQ_S, 10_000_000, 0], [SERVICES, 0, 10_000_000]], { journal: bqT });
    await ecriture(T, 'T5 loyer du siège', t26, '2026-04-30', `Loyer ${MARQUE_T.T}`, [[LOYERS, 2_000_000, 0], [BQ_S, 0, 2_000_000]], { journal: bqT });
    await ecriture(E1, 'E1-2 prestations de Goma', e126, '2026-05-31', `Prestations ${MARQUE_T.E1}`, [[BQ_S, 8_000_000, 0], [SERVICES, 0, 8_000_000]], { journal: bq1 });
    await ecriture(E1, 'E1-3 loyer de Goma', e126, '2026-05-31', `Loyer ${MARQUE_T.E1}`, [[LOYERS, 1_200_000, 0], [BQ_S, 0, 1_200_000]], { journal: bq1 });
    await ecriture(E1, 'E1-4 remontée au siège', e126, '2026-06-30', `Remontée au siège ${MARQUE_T.E1}`, [[NON_BLOQUE, 4_000_000, 0], [BQ_S, 0, 4_000_000]], { journal: bq1 });
    await ecriture(T, 'T6 remontée de Goma reçue', t26, '2026-06-30', `Remontée de Goma ${MARQUE_T.T}`, [[BQ_S, 4_000_000, 0], [NON_BLOQUE, 0, 4_000_000]], { journal: bqT });
    await ecriture(E2, 'E2-2 prestations de Bukavu', e226, '2026-07-31', `Prestations ${MARQUE_T.E2}`, [[BQ_S, 3_000_000, 0], [SERVICES, 0, 3_000_000]], { journal: bq2 });
    await ecriture(E2, 'E2-3 loyer de Bukavu', e226, '2026-07-31', `Loyer ${MARQUE_T.E2}`, [[LOYERS, 600_000, 0], [BQ_S, 0, 600_000]], { journal: bq2 });
    await ecriture(E2, 'E2-4 remontée au siège', e226, '2026-09-30', `Remontée au siège ${MARQUE_T.E2}`, [[NON_BLOQUE, 1_500_000, 0], [BQ_S, 0, 1_500_000]], { journal: bq2 });
    await ecriture(T, 'T7 remontée de Bukavu reçue', t26, '2026-09-30', `Remontée de Bukavu ${MARQUE_T.T}`, [[BQ_S, 1_500_000, 0], [NON_BLOQUE, 0, 1_500_000]], { journal: bqT });
    // UNE REMONTÉE PASSÉE D'UN SEUL CÔTÉ · le siège enregistre 300 000 reçus de
    // Bukavu le 29 décembre, Bukavu ne l'a pas encore saisie.
    await ecriture(T, 'T8 remontée de fin d’année de Bukavu', t26, '2026-12-29', `Remontée de fin d'année ${MARQUE_T.T}`, [[BQ_S, 300_000, 0], [NON_BLOQUE, 0, 300_000]], { journal: bqT });
    for (const [c, ex] of [[T, t26], [E1, e126], [E2, e226]]) await validerJusqua(c, ex, '2026-12-31');
  });

  await etape(R, 'SYSCOHADA 2026 · liaison non nulle · la liasse est refusée', async () => {
    const ag = await T.lire('Balance agrégée Kivu 2026 (liaison boiteuse)', `/groupe/balance-agregee?exerciceId=${t26}`);
    // Siège · 184 D 8 000 000, 185 C 4 000 000 + 1 500 000 + 300 000 · + 2 200 000 ;
    // Goma · − 5 000 000 + 4 000 000 = − 1 000 000 ; Bukavu · − 3 000 000 +
    // 1 500 000 = − 1 500 000 · somme − 300 000.
    R.montant('Agrégat Kivu 2026 · écart des 184 à 187', -300_000, ag?.controles?.ecartLiaison18);
    R.egal('Agrégat Kivu 2026 · liaison non neutralisée · rien n’est retiré', [false, 0], [ag?.controles?.liaison18Neutralisee ?? null, ag?.eliminations?.length ?? null]);
    R.montant('Agrégat Kivu 2026 · le 185 reste dans l’agrégat (solde − 5 800 000 + 4 000 000 + 1 500 000)', -300_000, ligneAgregat(ag, NON_BLOQUE)?.solde);
    const l = await T.req('GET', `/groupe/liasse/excel?exerciceId=${t26}`);
    R.egal('Liasse Kivu 2026 refusée sur une liaison non nulle', 400, l.statut);
    R.egal('Liasse Kivu 2026 · le refus cite la fiche du COMPTE 18 et l’écart', true,
      /184 à 187\) non neutralisés \(écart -300000\.00/.test(JSON.stringify(l.corps ?? '')) && /fiche du COMPTE 18/.test(JSON.stringify(l.corps ?? '')));
    await ecriture(E2, 'E2-5 remontée de fin d’année', e226, '2026-12-29', `Remontée de fin d'année ${MARQUE_T.E2}`, [[NON_BLOQUE, 300_000, 0], [BQ_S, 0, 300_000]], { journal: bq2 });
    await validerJusqua(E2, e226, '2026-12-31');
  });

  await etape(R, 'SYSCOHADA 2026 · liaisons équilibrées · elles sortent de l’agrégat', async () => {
    const ag = await T.lire('Balance agrégée Kivu 2026', `/groupe/balance-agregee?exerciceId=${t26}`);
    R.egal('Agrégat Kivu 2026 · liaison neutralisée, éliminations symétriques', [0, true, true],
      ag ? [ag.controles.ecartLiaison18, ag.controles.liaison18Neutralisee, ag.controles.eliminationsSymetriques] : null);
    R.egal('Agrégat Kivu 2026 · 184 et 185 absents de l’agrégat', [null, null], [ligneAgregat(ag, BLOQUE), ligneAgregat(ag, NON_BLOQUE)].map((x) => (x ? x.solde : null)));
    // Les six lignes rendues, une par dossier et par compte.
    const att = [
      [T.nom, BLOQUE, 8_000_000, 0], [T.nom, NON_BLOQUE, 0, 5_800_000],
      [E1.nom, BLOQUE, 0, 5_000_000], [E1.nom, NON_BLOQUE, 4_000_000, 0],
      [E2.nom, BLOQUE, 0, 3_000_000], [E2.nom, NON_BLOQUE, 1_800_000, 0],
    ];
    for (const [d, n, deb, cre] of att) {
      const e = elimination(ag, d, n);
      R.egal(`Élimination Kivu 2026 · ${d} · ${n} · D ${deb} C ${cre}`, [deb, cre, 'Compte de liaison siège / établissement'], e ? [e.debit, e.credit, e.motif] : null);
    }
    // 8 000 000 + 4 000 000 + 1 800 000 = 13 800 000 ; 5 800 000 + 5 000 000 + 3 000 000.
    R.montant('Éliminations Kivu 2026 · débit', 13_800_000, ag?.totauxEliminations?.debit);
    R.montant('Éliminations Kivu 2026 · crédit', 13_800_000, ag?.totauxEliminations?.credit);
    // 521 · siège 20 000 000 − 5 000 000 − 3 000 000 + 10 000 000 − 2 000 000 +
    // 4 000 000 + 1 500 000 + 300 000 = 25 800 000 ; Goma 5 000 000 + 8 000 000
    // − 1 200 000 − 4 000 000 = 7 800 000 ; Bukavu 3 000 000 + 3 000 000 −
    // 600 000 − 1 500 000 − 300 000 = 3 600 000 · 37 200 000.
    R.montant('Agrégat Kivu 2026 · 521', 37_200_000, ligneAgregat(ag, BQ_S)?.solde);
    R.montant('Agrégat Kivu 2026 · 706', -21_000_000, ligneAgregat(ag, SERVICES)?.solde);
    R.montant('Agrégat Kivu 2026 · 6222', 3_800_000, ligneAgregat(ag, LOYERS)?.solde);
    R.montant('Agrégat Kivu 2026 · 1013', -20_000_000, ligneAgregat(ag, CAPITAL)?.solde);
    const dossiers = new Map((ag?.dossiers ?? []).map((d) => [d.nom, d.soldeLiaison18]));
    R.egal('Agrégat Kivu 2026 · liaison par dossier (siège, Goma, Bukavu)', [2_200_000, -1_000_000, -1_200_000], [dossiers.get(T.nom), dossiers.get(E1.nom), dossiers.get(E2.nom)]);
    const sup = await T.lire('Supervision Kivu 2026', `/groupe/supervision?exerciceId=${t26}`);
    R.egal('Supervision Kivu 2026 · liaison de Goma (compte réfléchi, non nul)', -1_000_000, ligneSupervision(sup, E1.cellule.id)?.soldeLiaison18 ?? null);
    // Résultat · 21 000 000 − 3 800 000 = 17 200 000 ; bilan 37 200 000 de
    // trésorerie contre 20 000 000 de capital et 17 200 000 de résultat.
    await relireLiasse(T, R, 'Groupe Kivu 2026', `/groupe/liasse/excel?exerciceId=${t26}`, {
      BZ: 37_200_000, DZ: 37_200_000, XI: 17_200_000, CJ: 17_200_000, ZH: 37_200_000,
    });
  });

  await etape(R, 'SYSCOHADA · clôtures 2026', async () => {
    R.egal('Clôture 2026 · Goma', true, await cloturer(E1, '2026'));
    R.egal('Clôture 2026 · Bukavu', true, await cloturer(E2, '2026'));
    R.egal('Clôture 2026 · siège Kivu', true, await cloturer(T, '2026'));
  });
  await rechargerExercices(T);
  const t27 = T.exercices.get('2027')?.id;
  if (!t27) return R.note('SYSCOHADA · le siège n’a pas d’exercice 2027 · 2027 non joué');

  await etape(R, 'SYSCOHADA 2027 · liaisons reportées, éliminées dans l’à-nouveau', async () => {
    await ecriture(E1, 'E1-5 remontée 2027', e127, '2027-03-31', `Remontée au siège ${MARQUE_T.E1}`, [[NON_BLOQUE, 2_000_000, 0], [BQ_S, 0, 2_000_000]], { journal: bq1 });
    await ecriture(T, 'T9 remontée 2027 reçue', t27, '2027-03-31', `Remontée de Goma ${MARQUE_T.T}`, [[BQ_S, 2_000_000, 0], [NON_BLOQUE, 0, 2_000_000]], { journal: bqT });
    await ecriture(E1, 'E1-6 prestations 2027', e127, '2027-05-31', `Prestations ${MARQUE_T.E1}`, [[BQ_S, 5_000_000, 0], [SERVICES, 0, 5_000_000]], { journal: bq1 });
    await ecriture(T, 'T10 prestations 2027', t27, '2027-06-30', `Prestations ${MARQUE_T.T}`, [[BQ_S, 6_000_000, 0], [SERVICES, 0, 6_000_000]], { journal: bqT });
    for (const [c, ex] of [[T, t27], [E1, e127], [E2, e227]]) await validerJusqua(c, ex, '2027-12-31');
    const ag = await T.lire('Balance agrégée Kivu 2027', `/groupe/balance-agregee?exerciceId=${t27}`);
    R.egal('Agrégat Kivu 2027 · liaison neutralisée, aucun avertissement d’ouverture', [true, []],
      ag ? [ag.controles.liaison18Neutralisee, (ag.avertissements ?? []).filter((a) => /OUVERTURE/.test(a))] : null);
    // Le 184 du siège · 8 000 000 à l'à-nouveau, aucun mouvement · tout dans la
    // colonne d'à-nouveau. Le 185 du siège · 5 800 000 à l'à-nouveau, 2 000 000
    // de mouvement.
    const t184 = elimination(ag, T.nom, BLOQUE);
    const t185 = elimination(ag, T.nom, NON_BLOQUE);
    const g185 = elimination(ag, E1.nom, NON_BLOQUE);
    R.egal('Élimination Kivu 2027 · siège 184 · D 8 000 000, tout à l’à-nouveau', [8_000_000, 0, 8_000_000], t184 ? [t184.debit, t184.credit, t184.horsMouvement?.reportDebit] : null);
    R.egal('Élimination Kivu 2027 · siège 185 · C 7 800 000 dont 5 800 000 à l’à-nouveau', [0, 7_800_000, 5_800_000], t185 ? [t185.debit, t185.credit, t185.horsMouvement?.reportCredit] : null);
    R.egal('Élimination Kivu 2027 · Goma 185 · D 6 000 000 dont 4 000 000 à l’à-nouveau', [6_000_000, 0, 4_000_000], g185 ? [g185.debit, g185.credit, g185.horsMouvement?.reportDebit] : null);
    // À-nouveau agrégé du 521 · 25 800 000 + 7 800 000 + 3 600 000.
    R.montant('Agrégat Kivu 2027 · à-nouveau 521', 37_200_000, ligneAgregat(ag, BQ_S)?.reportDebit);
    // 521 · 37 200 000 + 5 000 000 + 6 000 000 (les 2 000 000 remontés se compensent).
    R.montant('Agrégat Kivu 2027 · 521', 48_200_000, ligneAgregat(ag, BQ_S)?.solde);
    // Bilan · 48 200 000 de trésorerie, contre capital 20 000 000, résultat 2026
    // 17 200 000 (non affecté) et résultat 2027 11 000 000.
    const lu = await relireLiasse(T, R, 'Groupe Kivu 2027', `/groupe/liasse/excel?exerciceId=${t27}`, { BZ: 48_200_000, DZ: 48_200_000, ZH: 48_200_000 });
    const rep = lu ? reportDansLaBalanceDeLaLiasse(lu.wb, BQ_S) : null;
    R.montant('Liasse Kivu 2027 · balance N · à-nouveau du 521 (combinaison)', 37_200_000, rep?.debit);
    R.egal('Liasse Kivu 2027 · balance N · aucune ligne 184 (liaison éliminée)', null, lu ? reportDansLaBalanceDeLaLiasse(lu.wb, BLOQUE) : null);
  });

  await etape(R, 'SYSCOHADA · clôtures 2027', async () => {
    R.egal('Clôture 2027 · Goma', true, await cloturer(E1, '2027'));
    R.egal('Clôture 2027 · Bukavu', true, await cloturer(E2, '2027'));
    R.egal('Clôture 2027 · siège Kivu', true, await cloturer(T, '2027'));
  });
}

