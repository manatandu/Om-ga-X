/**
 * SCÉNARIO « PLATEFORME » · la console de l'éditeur et des modules divers
 * qu'aucune simulation n'avait encore touchés.
 *
 * CINQ PARTIES, chacune sur son dossier, chacune avec ses sources lues ·
 *  1. CONSOLE (`src/modules/plateforme/`, `src/modules/licence/`, CLAUDE.md,
 *     paragraphes « Abonnements des cabinets », « La licence suit
 *     l'abonnement », « Factures et licences par courriel », « Dossiers de
 *     démonstration », « Le dossier de l'éditeur ne se coupe jamais ») ·
 *     opérateur et double authentification (RFC 6238, calculée ici sur
 *     l'horloge du serveur), désignation du dossier de l'éditeur, cabinets
 *     clients, formules et prix en dollars SAISIS, essai de trente jours,
 *     factures de période au cours du jour, TVA selon l'assujettissement de
 *     l'éditeur, encaissements qui prolongent la licence (quinze jours),
 *     échéance jamais reculée, courrier en file, refus documentés, vitrines.
 *     Ce sont des CONVENTIONS D'OMEGAX que le code déclare comme telles
 *     (aucun texte ne fixe un abonnement) · l'attendu est calculé depuis ces
 *     conventions écrites, jamais depuis la réponse.
 *  2. MONNAIE FONCTIONNELLE (CLAUDE.md « M2 », `balance-fonctionnelle.service.ts`)
 *     · second jeu sans valeur légale (loi n° 23/053 art. 141, 1° ; AUDCIF
 *     art. 17, 1° pour la tenue en francs), ligne à ligne au cours en vigueur
 *     à la date de l'écriture, écart de conversion sur sa ligne, N et N+1.
 *  3. ÉTATS PERSONNALISÉS ET SIMULATEUR (définitions d'OmegaX, dites dans le
 *     code · `moteur-etat-personnalise.ts`, `simulateur-budgetaire.ts`).
 *  4. ANALYTIQUE (CLAUDE.md « Rubriques budgétaires », « Saisie par pièce, OD
 *     analytiques », « Budgets ») sur un projet SYCEBNL, N et N+1.
 *  5. NATURES DE COMPTE (point 14), CATALOGUE DES OPÉRATIONS SPÉCIFIQUES
 *     (Guide SYCEBNL, Application 8) et CONVENTIONS DE FINANCEMENT (SYCEBNL,
 *     cadre conceptuel § 5.4.2.4).
 *
 * LE DRAPEAU D'OPÉRATEUR · il ne s'accorde qu'au démarrage du serveur
 * (`OPERATEURS_PLATEFORME`), aux comptes qui existent déjà, et aucune route ne
 * le pose (CLAUDE.md § 8). Le dossier de l'éditeur naît pendant le banc, après
 * le démarrage · le banc pose donc le drapeau en base, par `psql`, sur SA base
 * jetable seulement (`PASSE_DATABASE_URL`), et le dit en note. Tout le reste
 * passe par l'API.
 *
 * Un refus ATTENDU se lit par `c.req` et se contrôle (statut, motif) · il
 * n'est pas une erreur HTTP du banc. Un geste juste refusé passe par
 * `c.geste` et reste consigné.
 */
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import {
  BASE, Client, MOT_DE_PASSE, auCentime, balance, cloturer, compte, ecriture, etape, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, validerJusqua,
} from './lib.mjs';

// --- Outils propres au scénario --------------------------------------------

/** Un refus ATTENDU · statut et, s'il est donné, un fragment du motif. */
async function refusAttendu(c, R, libelle, methode, chemin, corps, statut = 400, fragment = null) {
  const r = await c.req(methode, chemin, corps);
  R.egal(`${libelle} · refusé (${statut})`, statut, r.statut);
  if (fragment && r.statut >= 400) {
    R.egal(`${libelle} · le motif cite « ${fragment} »`, true, JSON.stringify(r.corps ?? '').includes(fragment));
  }
  if (r.statut < 400) R.note(`${libelle} · ACCEPTÉ alors qu'un refus était attendu · ${JSON.stringify(r.corps).slice(0, 300)}`);
  return r;
}

/**
 * TOTP, RFC 6238 sur RFC 4226 · HMAC-SHA1 du compteur (pas de trente
 * secondes) sur huit octets gros-boutistes, troncature dynamique (§ 5.3),
 * six chiffres. Le secret est en base 32 (RFC 4648, alphabet standard).
 * Écrit ici sans importer le code du serveur · le banc éprouve l'application
 * d'authentification qu'un opérateur emploierait.
 */
function depuisBase32(texte) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let valeur = 0;
  const octets = [];
  for (const ch of texte.toUpperCase().replace(/[\s=-]/g, '')) {
    const i = alphabet.indexOf(ch);
    if (i < 0) throw new Error('Secret TOTP illisible');
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}
function codeTotp(secret, instantMs) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(instantMs / 1000 / 30)));
  const h = createHmac('sha1', depuisBase32(secret)).update(message).digest();
  const o = h[h.length - 1] & 0x0f;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/**
 * L'HEURE DU SERVEUR · il tourne sous libfaketime (15 février 2028), et un
 * code TOTP se calcule sur SON horloge, pas sur celle du banc. L'en-tête
 * `Date` d'une réponse la porte à la seconde · le pas de trente secondes et
 * la tolérance d'un pas de part et d'autre suffisent largement.
 */
async function heureServeur() {
  const r = await fetch(`${BASE}/health`);
  return Date.parse(r.headers.get('date'));
}

/**
 * Le drapeau d'opérateur, posé en base sur la SEULE base jetable du banc (voir
 * l'en-tête). La chaîne de connexion n'est jamais affichée.
 */
function poserDrapeauOperateur(email) {
  const url = process.env.PASSE_DATABASE_URL;
  if (!url) throw new Error('PASSE_DATABASE_URL absente · le drapeau d’opérateur ne peut être posé');
  const sortie = execFileSync('psql', [url, '-qtAc', `UPDATE users SET "estOperateurPlateforme" = true WHERE email = '${email.replace(/'/g, "''")}' RETURNING email`], { encoding: 'utf8' });
  return sortie.trim() === email;
}

/** Un client qui se connecte à un dossier existant · rend le client ou null. */
async function connecter(R, email, motDePasse, libelle) {
  const c = new Client(R);
  c.email = email;
  const r = await c.req('POST', '/auth/login', { email, motDePasse });
  if (r.statut >= 400) {
    R.erreurHttp(libelle, 'POST', '/auth/login', r.statut, r.corps);
    return null;
  }
  c.moi = (await c.req('GET', '/auth/me')).corps;
  return c;
}

const jour = (d) => (d ? String(d).slice(0, 10) : null);
/** Somme des lignes d'une facture lue par `/facturation` · HT et taxe. */
const totauxFacture = (f) => ({
  ht: auCentime((f?.lignes ?? []).reduce((s, l) => s + Number(l.montantHT ?? 0), 0)),
  tva: auCentime((f?.lignes ?? []).reduce((s, l) => s + Number(l.montantTva ?? 0), 0)),
});
/**
 * Un prix en dollars converti au cours du jour, comme la paie convertit un
 * salaire (`personnel/conversion-usd.ts`, règle déclarée · arrondi au CENTIME
 * SUPÉRIEUR dès qu'une fraction reste). Ici les produits sont entiers.
 */
const enFrancs = (usd, cours) => Math.ceil(Math.round(usd * cours * 100 * 1e6) / 1e6) / 100;

export default async function scenarioPlateforme(registre) {
  registre.scenario = 'Plateforme';
  const R = registre;
  const ctx = {};

  // ===========================================================================
  // PARTIE 1 · LA CONSOLE DE L'ÉDITEUR
  // ===========================================================================
  const ed = await nouveauDossier(R, 'Passe V1 · VMG Consulting (éditeur)', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'editeur', exercice: ['2027-01-01', '2027-12-31'],
  });

  await etape(R, 'Console · opérateur et double authentification', async () => {
    // Sans le drapeau · réservé à l'opérateur (`OperateurPlateformeGuard`).
    await refusAttendu(ed, R, 'Console sans le drapeau d’opérateur', 'GET', '/plateforme/cabinets', undefined, 403, 'opérateur');
    const pose = poserDrapeauOperateur(ed.email);
    R.note(`Drapeau estOperateurPlateforme posé par psql sur la base jetable du banc (${pose ? 'une ligne' : 'AUCUNE ligne'}) · aucune route ne l'accorde (CLAUDE.md § 8)`);
    // Avec le drapeau, sans second facteur · la console l'exige.
    await refusAttendu(ed, R, 'Console sans double authentification', 'GET', '/plateforme/cabinets', undefined, 403, 'double authentification');
    const init = await ed.geste('Double authentification · clé à enregistrer', 'POST', '/auth/double-authentification/initier', {});
    if (!init?.secret) return;
    R.egal('Double authentification · lien otpauth à trente secondes, six chiffres', true, /period=30/.test(init.uri ?? '') && /digits=6/.test(init.uri ?? ''));
    // Le mot de passe actuel est exigé (OWASP ASVS 5.0, 7.5.1) · un faux est refusé.
    await refusAttendu(ed, R, 'Activation avec un mot de passe faux', 'POST', '/auth/double-authentification/activer',
      { motDePasseActuel: 'Pas-le-bon-mot-de-passe-1', code: codeTotp(init.secret, await heureServeur()) }, 401);
    const act = await ed.geste('Double authentification · activation', 'POST', '/auth/double-authentification/activer', {
      motDePasseActuel: MOT_DE_PASSE, code: codeTotp(init.secret, await heureServeur()),
    });
    // Huit codes de secours, montrés une fois (NOMBRE_CODES_SECOURS).
    R.egal('Double authentification · huit codes de secours rendus', 8, act?.codesSecours?.length ?? null);
    ctx.secret = init.secret;
  });

  await etape(R, 'Console · dossier de l’éditeur et refus qui le protègent', async () => {
    const liste = await ed.lire('Console · cabinets', '/plateforme/cabinets');
    R.egal('Console · ouverte à l’opérateur au second facteur', true, Array.isArray(liste?.cabinets));
    const d = await ed.geste('Désignation du dossier de l’éditeur', 'POST', `/plateforme/cabinets/${ed.tenantId}/dossier-editeur`, {});
    // La désignation pose PROPRIETAIRE, ACTIVE, sans échéance (plateforme.service.ts).
    R.egal('Éditeur · licence PROPRIETAIRE', 'PROPRIETAIRE', d?.type ?? null);
    R.egal('Éditeur · aucune échéance', null, d?.dateExpiration ?? null);
    await refusAttendu(ed, R, 'Seconde désignation du même dossier', 'POST', `/plateforme/cabinets/${ed.tenantId}/dossier-editeur`, {}, 400, 'déjà celui de l’éditeur');
    // La licence de l'éditeur ne se suspend, ne s'échoit ni ne change de type.
    await refusAttendu(ed, R, 'Suspension de la licence de l’éditeur', 'PATCH', `/plateforme/cabinets/${ed.tenantId}/licence`, { statut: 'SUSPENDUE' }, 400, 'celui de l’éditeur');
    await refusAttendu(ed, R, 'Échéance posée sur la licence de l’éditeur', 'PATCH', `/plateforme/cabinets/${ed.tenantId}/licence`, { dateExpiration: '2027-12-31' }, 400, 'celui de l’éditeur');
  });

  await etape(R, 'Console · deux cabinets clients créés depuis la console', async () => {
    const sfx = Date.now();
    ctx.alphaEmail = `passe-v1-alpha-${sfx}@exemple.cd`;
    const a = await ed.geste('Création du cabinet Alpha', 'POST', '/plateforme/cabinets', {
      nomEntite: 'Passe V1 · Cabinet Alpha Conseil', emailAdmin: ctx.alphaEmail, referentiel: 'SYCEBNL',
      dateDebutExercice: '2027-01-01', dateFinExercice: '2027-12-31',
    });
    ctx.alpha = a?.tenant?.id;
    ctx.alphaMdp = a?.motDePasseTemporaire;
    // Mot de passe GÉNÉRÉ, seize caractères base64url (randomBytes(12)).
    R.egal('Alpha · mot de passe provisoire de seize caractères', 16, ctx.alphaMdp?.length ?? null);
    const b = await ed.geste('Création du cabinet Beta', 'POST', '/plateforme/cabinets', {
      nomEntite: 'Passe V1 · Cabinet Beta Audit', emailAdmin: `passe-v1-beta-${sfx}@exemple.cd`, referentiel: 'SYSCOHADA',
      systemeComptableSyscohada: 'NORMAL', dateDebutExercice: '2027-01-01', dateFinExercice: '2027-12-31',
    });
    ctx.beta = b?.tenant?.id;
    const liste = await ed.lire('Console · cabinets', '/plateforme/cabinets');
    const la = liste?.cabinets?.find((x) => x.id === ctx.alpha);
    R.egal('Alpha · licence ABONNEMENT par défaut', 'ABONNEMENT', la?.licence?.type ?? null);
    // Attribuer le type PROPRIETAIRE depuis la console est refusé · un second
    // dossier incoupable ne se verrait nulle part.
    await refusAttendu(ed, R, 'Type PROPRIETAIRE attribué à un client', 'PATCH', `/plateforme/cabinets/${ctx.alpha}/licence`, { type: 'PROPRIETAIRE' }, 400, 'ne s’attribue pas depuis la console');
    await refusAttendu(ed, R, 'Désignation d’un second éditeur', 'POST', `/plateforme/cabinets/${ctx.beta}/dossier-editeur`, {}, 400, 'Il n’y en a qu’un');
    // Une échéance null est refusée (FacultatifNonNul) · elle aurait posé 1970.
    await refusAttendu(ed, R, 'Échéance null sur une licence client', 'PATCH', `/plateforme/cabinets/${ctx.alpha}/licence`, { dateExpiration: null }, 400);
  });

  await etape(R, 'Console · formules, prix en dollars, tiers facturés, abonnements', async () => {
    const f = await ed.lire('Formules', '/plateforme/formules');
    // La grille du 2026-09-26 · trois formules, trois options, AUCUN prix posé.
    R.egal('Formules · six lignes de la grille', 6, f?.length ?? null);
    R.egal('Formules · aucun prix posé d’office', true, (f ?? []).every((x) => x.prixMensuelUsd === null && x.prixAnnuelUsd === null));
    // Les prix sont SAISIS par l'opérateur · ceux du banc, en dollars.
    await ed.geste('Prix Standard', 'PATCH', '/plateforme/formules/STANDARD', { prixMensuelUsd: 50, prixAnnuelUsd: 500 });
    await refusAttendu(ed, R, 'Prix négatif', 'PATCH', '/plateforme/formules/ESSENTIEL', { prixMensuelUsd: -5, prixAnnuelUsd: null }, 400, 'positif');
    // Les clients facturés sont des tiers DU DOSSIER DE L'ÉDITEUR.
    const ta = await ed.geste('Tiers Alpha', 'POST', '/tiers', { type: 'CLIENT', code: 'CLI-ALPHA', nom: 'Cabinet Alpha Conseil', email: 'facturation@alpha.exemple.cd', creerCompteIndividuel: true });
    const tb = await ed.geste('Tiers Beta', 'POST', '/tiers', { type: 'CLIENT', code: 'CLI-BETA', nom: 'Cabinet Beta Audit', creerCompteIndividuel: true });
    ctx.tiersAlpha = ta?.id;
    ctx.tiersBeta = tb?.id;
    await refusAttendu(ed, R, 'L’éditeur abonné à lui-même', 'POST', '/plateforme/abonnements', {
      cabinetId: ed.tenantId, formuleCode: 'STANDARD', options: [], dossiersSupplementaires: 0, periodicite: 'MENSUELLE', debut: '2027-10-01', essai: true, tiersId: ctx.tiersAlpha,
    }, 400, 'ne s’abonne pas à lui-même');
    // ALPHA · Standard mensuel + option Groupe (sans prix pour l'instant), essai
    // de trente jours à partir du 1er octobre 2027.
    await ed.geste('Abonnement Alpha', 'POST', '/plateforme/abonnements', {
      cabinetId: ctx.alpha, formuleCode: 'STANDARD', options: ['GROUPE'], dossiersSupplementaires: 0, periodicite: 'MENSUELLE', debut: '2027-10-01', essai: true, tiersId: ctx.tiersAlpha,
    });
    // BETA · Standard annuel, sans essai, à partir du 1er novembre 2027.
    await ed.geste('Abonnement Beta', 'POST', '/plateforme/abonnements', {
      cabinetId: ctx.beta, formuleCode: 'STANDARD', options: [], dossiersSupplementaires: 0, periodicite: 'ANNUELLE', debut: '2027-11-01', essai: false, tiersId: ctx.tiersBeta,
    });
    const l = await ed.lire('Abonnements', '/plateforme/abonnements');
    const aa = l?.abonnements?.find((x) => x.cabinetId === ctx.alpha);
    const ab = l?.abonnements?.find((x) => x.cabinetId === ctx.beta);
    ctx.abAlpha = aa?.id;
    ctx.abBeta = ab?.id;
    // finEssai = début + 30 jours (JOURS_ESSAI) · 2027-10-01 + 30 = 2027-10-31.
    R.egal('Alpha · fin de l’essai au 31 octobre 2027', '2027-10-31', aa?.finEssai ?? null);
    // Échéance initiale = fin de l'essai + 15 jours (DELAI_PAIEMENT_JOURS) · 2027-11-15.
    R.egal('Alpha · licence échue au 15 novembre 2027 (essai + quinze jours)', '2027-11-15', aa?.echeanceLicence ?? null);
    // Sans essai · début + 15 jours · 2027-11-01 + 15 = 2027-11-16.
    R.egal('Beta · licence échue au 16 novembre 2027 (début + quinze jours)', '2027-11-16', ab?.echeanceLicence ?? null);
    R.egal('Beta · aucun essai', null, ab?.finEssai ?? null);
  });

  await etape(R, 'Alpha · première connexion, mot de passe provisoire, licence échue', async () => {
    const al = await connecter(R, ctx.alphaEmail, ctx.alphaMdp, 'Connexion Alpha (mot de passe provisoire)');
    if (!al) return;
    // `MotDePasseAChangerGuard` ferme le serveur tant que le provisoire n'est
    // pas remplacé (CLAUDE.md § 8).
    await refusAttendu(al, R, 'Alpha · lecture avant le changement du mot de passe provisoire', 'GET', '/comptes', undefined, 403);
    const nouveau = 'Alpha-passe-v1-2028-nouveau!';
    await al.geste('Alpha · changement du mot de passe provisoire', 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: ctx.alphaMdp, nouveauMotDePasse: nouveau });
    ctx.alphaMdp = nouveau;
    // Licence échue au 15/11/2027, serveur au 15/02/2028 · « Abonnement expiré »
    // (LicenceService, ABONNEMENT dont l'échéance est passée).
    await refusAttendu(al, R, 'Alpha · accès coupé par l’échéance de l’abonnement', 'GET', '/comptes', undefined, 403, 'Abonnement expiré');
    ctx.alphaClient = al;
  });

  await etape(R, 'Console · facturation des périodes, au cours du jour', async () => {
    const devises = (await ed.lire('Devises de l’éditeur', '/devises')) ?? [];
    const usd = devises.find((d) => d.code === 'USD') ?? (await ed.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    // Les cours du banc (données saisies, comme le ferait le cabinet).
    for (const [date, cours] of [['2027-10-05', 2_880], ['2027-11-02', 2_900], ['2027-12-01', 2_950], ['2028-01-03', 2_980], ['2028-02-01', 3_000]]) {
      await ed.geste(`Cours USD du ${date}`, 'POST', `/devises/${usd?.id}/cours`, { date, cours, source: 'Banque centrale du Congo (banc passe V1)' });
    }
    const facturer = (periode, dateFacture, extra = {}) => ed.geste(`Facturation ${periode}`, 'POST', '/plateforme/abonnements/facturer', { periode, dateFacture, ...extra });
    const de = (r, cab) => r?.resultats?.find((x) => x.cabinet === cab);

    // OCTOBRE 2027 · Alpha en essai, Beta pas encore commencé.
    const oct = await facturer('2027-10', '2027-10-05');
    R.egal('2027-10 · Alpha en essai (non dû)', 'NON_DU', de(oct, 'Passe V1 · Cabinet Alpha Conseil')?.statut ?? null);
    R.egal('2027-10 · motif · en essai jusqu’au 31 octobre', true, /En essai jusqu'au 2027-10-31/.test(de(oct, 'Passe V1 · Cabinet Alpha Conseil')?.motif ?? ''));
    R.egal('2027-10 · Beta · première période facturable 2027-11', true, /2027-11/.test(de(oct, 'Passe V1 · Cabinet Beta Audit')?.motif ?? ''));

    // NOVEMBRE 2027 · l'option Groupe n'a pas de prix · Alpha refusée EN ENTIER
    // (une facture amputée d'une option se lirait comme complète) ; Beta facturée
    // à l'année, 500 USD au cours de 2 900 = 1 450 000 FC, éditeur non assujetti.
    const nov = await facturer('2027-11', '2027-11-02');
    R.egal('2027-11 · Alpha refusée faute de prix de l’option Groupe', 'NON_DU', de(nov, 'Passe V1 · Cabinet Alpha Conseil')?.statut ?? null);
    R.egal('2027-11 · motif · prix mensuel non fixé de l’option Groupe', true, /Prix mensuel non fixé · Option groupe/.test(de(nov, 'Passe V1 · Cabinet Alpha Conseil')?.motif ?? ''));
    R.egal('2027-11 · Beta facturée', 'FACTURE', de(nov, 'Passe V1 · Cabinet Beta Audit')?.statut ?? null);
    R.egal('2027-11 · Beta · première pièce de la série VMG-2027', 'VMG-2027-0001', de(nov, 'Passe V1 · Cabinet Beta Audit')?.numero ?? null);
    R.montant('2027-11 · Beta · total en dollars (annuel)', 500, de(nov, 'Passe V1 · Cabinet Beta Audit')?.totalUsd);
    R.montant('2027-11 · cours retenu, celui du jour de la facture', 2_900, nov?.cours);

    // Le prix de l'option Groupe est fixé · Alpha se facture, Beta ne se refacture pas.
    await ed.geste('Prix de l’option Groupe', 'PATCH', '/plateforme/formules/GROUPE', { prixMensuelUsd: 20, prixAnnuelUsd: null });
    const nov2 = await facturer('2027-11', '2027-11-02');
    R.egal('2027-11 (relance) · Alpha facturée', 'FACTURE', de(nov2, 'Passe V1 · Cabinet Alpha Conseil')?.statut ?? null);
    R.egal('2027-11 (relance) · Alpha · VMG-2027-0002', 'VMG-2027-0002', de(nov2, 'Passe V1 · Cabinet Alpha Conseil')?.numero ?? null);
    // 50 USD (Standard) + 20 USD (Groupe) = 70 USD.
    R.montant('2027-11 · Alpha · total en dollars', 70, de(nov2, 'Passe V1 · Cabinet Alpha Conseil')?.totalUsd);
    R.egal('2027-11 (relance) · Beta déjà facturée, rien en double', 'DEJA_FACTURE', de(nov2, 'Passe V1 · Cabinet Beta Audit')?.statut ?? null);

    // Le cours d'un autre jour n'est jamais repris · une date sans cours arrête tout.
    await refusAttendu(ed, R, 'Facturation à une date sans cours du dollar', 'POST', '/plateforme/abonnements/facturer', { periode: '2027-12', dateFacture: '2027-12-02' }, 400, 'Le cours d’un autre jour n’est jamais repris');

    // L'éditeur devient ASSUJETTI · le taux est exigé, puis appliqué.
    await ed.geste('Éditeur assujetti à la TVA', 'PATCH', '/dossier/regime', { assujettiTva: true, reponseAssujettissementTva: 'OUI', venteBiensServices: 'OUI' });
    const taux = (await ed.lire('Taux de TVA de l’éditeur', '/taux-tva')) ?? [];
    const tva16 = taux.find((t) => t.code === 'TVA16');
    ctx.tva16 = tva16;
    await refusAttendu(ed, R, 'Facturation d’un éditeur assujetti sans taux', 'POST', '/plateforme/abonnements/facturer', { periode: '2027-12', dateFacture: '2027-12-01' }, 400, 'choisissez le taux');
    const dec = await facturer('2027-12', '2027-12-01', { tauxTvaId: tva16?.id });
    R.egal('2027-12 · Alpha · VMG-2027-0003', 'VMG-2027-0003', de(dec, 'Passe V1 · Cabinet Alpha Conseil')?.numero ?? null);
    R.egal('2027-12 · facturation dite assujettie', true, dec?.assujetti ?? null);
    // Beta annuel · la prochaine échéance est douze mois après 2027-11.
    R.egal('2027-12 · Beta annuelle · prochaine échéance 2028-11', true, /2028-11/.test(de(dec, 'Passe V1 · Cabinet Beta Audit')?.motif ?? ''));

    // Beta suspendu · ne se facture plus.
    await ed.geste('Suspension de l’abonnement Beta', 'PATCH', `/plateforme/abonnements/${ctx.abBeta}`, { actif: false });
    const jan = await facturer('2028-01', '2028-01-03', { tauxTvaId: tva16?.id });
    R.egal('2028-01 · Alpha · nouvelle année, série VMG-2028 à 0001', 'VMG-2028-0001', de(jan, 'Passe V1 · Cabinet Alpha Conseil')?.numero ?? null);
    R.egal('2028-01 · Beta suspendue', true, /suspendu/.test(de(jan, 'Passe V1 · Cabinet Beta Audit')?.motif ?? ''));
    // Février · avec l'envoi par courriel demandé (file, jamais « envoyé » sans messagerie).
    const fev = await facturer('2028-02', '2028-02-01', { tauxTvaId: tva16?.id, envoyer: true });
    R.egal('2028-02 · Alpha · VMG-2028-0002', 'VMG-2028-0002', de(fev, 'Passe V1 · Cabinet Alpha Conseil')?.numero ?? null);
    R.egal('2028-02 · courriel de la facture mis en file, sans transport', 'Courriel en file (SANS_TRANSPORT)', de(fev, 'Passe V1 · Cabinet Alpha Conseil')?.courriel ?? null);
  });

  await etape(R, 'Console · pièces émises dans le dossier de l’éditeur', async () => {
    const lf = await ed.lire('Factures de l’éditeur', '/facturation?sens=VENTE&du=2027-10-01&au=2028-02-29');
    const piece = (n) => lf?.factures?.find((f) => f.numeroSerie === n);
    // Beta 2027-11 · 500 USD × 2 900 = 1 450 000 FC, non assujetti, aucune taxe.
    R.montant('VMG-2027-0001 · HT (500 USD × 2 900)', enFrancs(500, 2_900), totauxFacture(piece('VMG-2027-0001')).ht);
    R.montant('VMG-2027-0001 · aucune TVA (éditeur non assujetti au 2 novembre)', 0, totauxFacture(piece('VMG-2027-0001')).tva);
    // Alpha 2027-11 · (50 + 20) × 2 900 = 145 000 + 58 000 = 203 000 FC, sans TVA.
    R.montant('VMG-2027-0002 · HT (70 USD × 2 900)', enFrancs(50, 2_900) + enFrancs(20, 2_900), totauxFacture(piece('VMG-2027-0002')).ht);
    R.montant('VMG-2027-0002 · aucune TVA', 0, totauxFacture(piece('VMG-2027-0002')).tva);
    // Alpha 2027-12 · 50 × 2 950 = 147 500 ; 20 × 2 950 = 59 000 ; HT 206 500 ;
    // TVA 16 % ligne à ligne · 23 600 + 9 440 = 33 040.
    R.montant('VMG-2027-0003 · HT (70 USD × 2 950)', 206_500, totauxFacture(piece('VMG-2027-0003')).ht);
    R.montant('VMG-2027-0003 · TVA à 16 %', 33_040, totauxFacture(piece('VMG-2027-0003')).tva);
    // Alpha 2028-01 · 149 000 + 59 600 = 208 600 ; TVA 23 840 + 9 536 = 33 376.
    R.montant('VMG-2028-0001 · HT (70 USD × 2 980)', 208_600, totauxFacture(piece('VMG-2028-0001')).ht);
    R.montant('VMG-2028-0001 · TVA à 16 %', 33_376, totauxFacture(piece('VMG-2028-0001')).tva);
    // Alpha 2028-02 · 150 000 + 60 000 = 210 000 ; TVA 24 000 + 9 600 = 33 600.
    R.montant('VMG-2028-0002 · HT (70 USD × 3 000)', 210_000, totauxFacture(piece('VMG-2028-0002')).ht);
    R.montant('VMG-2028-0002 · TVA à 16 %', 33_600, totauxFacture(piece('VMG-2028-0002')).tva);
    R.egal('VMG-2028-0002 · client recopié', 'Cabinet Alpha Conseil', piece('VMG-2028-0002')?.tiers?.nom ?? null);
  });

  await etape(R, 'Console · encaissements, échéance de la licence, jamais reculée', async () => {
    const l = await ed.lire('Abonnements', '/plateforme/abonnements');
    const fa = (cab, periode) => l?.abonnements?.find((x) => x.cabinetId === cab)?.factures?.find((f) => f.periode === periode);
    const payer = (f, date) => ed.geste(`Encaissement ${f?.numero} au ${date}`, 'PATCH', `/plateforme/abonnements/factures/${f?.id}/payee`, { payeeLe: date });
    // Refus · encaissement dans le futur (aujourd'hui = 15/02/2028 à Kinshasa),
    // puis antérieur à la facture (VMG-2028-0002 du 01/02/2028).
    await refusAttendu(ed, R, 'Encaissement déclaré dans le futur', 'PATCH', `/plateforme/abonnements/factures/${fa(ctx.alpha, '2028-02')?.id}/payee`, { payeeLe: '2028-02-20' }, 400, 'dans le futur');
    await refusAttendu(ed, R, 'Encaissement antérieur à la facture', 'PATCH', `/plateforme/abonnements/factures/${fa(ctx.alpha, '2028-02')?.id}/payee`, { payeeLe: '2028-01-31' }, 400, 'précéder la facture');
    // Alpha 2027-11 payée le 20/11 · fin de la période 2027-11-30 + 15 = 2027-12-15.
    let r = await payer(fa(ctx.alpha, '2027-11'), '2027-11-20');
    R.egal('Alpha · après le paiement de 2027-11 · échéance 2027-12-15', '2027-12-15', r?.echeanceLicence ?? null);
    await refusAttendu(ed, R, 'Second encaissement de la même facture', 'PATCH', `/plateforme/abonnements/factures/${fa(ctx.alpha, '2027-11')?.id}/payee`, { payeeLe: '2027-11-21' }, 400, 'déjà déclarée payée');
    // 2027-12 payée le 10/12 · 2027-12-31 + 15 = 2028-01-15.
    r = await payer(fa(ctx.alpha, '2027-12'), '2027-12-10');
    R.egal('Alpha · après le paiement de 2027-12 · échéance 2028-01-15', '2028-01-15', r?.echeanceLicence ?? null);
    const al = ctx.alphaClient;
    if (al) await refusAttendu(al, R, 'Alpha · toujours coupée au 15/02/2028 (échéance 2028-01-15)', 'GET', '/comptes', undefined, 403, 'Abonnement expiré');
    // 2028-02 payée le 13/02 AVANT 2028-01 · 2028 est bissextile, fin de février
    // le 29 · 2028-02-29 + 15 = 2028-03-15.
    r = await payer(fa(ctx.alpha, '2028-02'), '2028-02-13');
    R.egal('Alpha · après le paiement de 2028-02 · échéance 2028-03-15', '2028-03-15', r?.echeanceLicence ?? null);
    // 2028-01 payée ensuite · 2028-01-31 + 15 = 2028-02-15, plus tôt · JAMAIS RECULÉE.
    r = await payer(fa(ctx.alpha, '2028-01'), '2028-02-14');
    R.egal('Alpha · paiement tardif d’une période plus ancienne · échéance gardée au 2028-03-15', '2028-03-15', r?.echeanceLicence ?? null);
    // Beta, annuelle 2027-11 payée le 25/11 · douze mois couverts jusqu'au
    // 2028-10-31, + 15 = 2028-11-15.
    r = await payer(fa(ctx.beta, '2027-11'), '2027-11-25');
    R.egal('Beta · après le paiement de l’année · échéance 2028-11-15', '2028-11-15', r?.echeanceLicence ?? null);
    if (al) {
      const ok = await al.req('GET', '/comptes');
      R.egal('Alpha · accès rouvert par le paiement (échéance 2028-03-15)', 200, ok.statut);
    }
    const liste = await ed.lire('Console · cabinets', '/plateforme/cabinets');
    const la = liste?.cabinets?.find((x) => x.id === ctx.alpha);
    R.egal('Alpha · licence en base au 2028-03-15', '2028-03-15', jour(la?.licence?.dateExpiration));
  });

  await etape(R, 'Console · courrier de l’éditeur et licence sur site', async () => {
    const l = await ed.lire('Abonnements', '/plateforme/abonnements');
    const f = l?.abonnements?.find((x) => x.cabinetId === ctx.alpha)?.factures?.find((x) => x.periode === '2027-12');
    const env = await ed.geste('Envoi de VMG-2027-0003 par courriel', 'POST', `/plateforme/abonnements/factures/${f?.id}/envoyer`, {});
    // Aucune messagerie posée sur le banc · « en file », SANS_TRANSPORT, jamais « envoyé ».
    R.egal('VMG-2027-0003 · courriel mis en file sans transport', 'SANS_TRANSPORT', env?.statut ?? null);
    // Beta n'a pas d'adresse · refus nommé, rien n'est mis en file.
    const fb = l?.abonnements?.find((x) => x.cabinetId === ctx.beta)?.factures?.find((x) => x.periode === '2027-11');
    await refusAttendu(ed, R, 'Envoi à un client sans adresse', 'POST', `/plateforme/abonnements/factures/${fb?.id}/envoyer`, {}, 400, 'n’a pas d’adresse de courriel');
    const file = await ed.lire('File du courrier', '/courrier');
    const messages = file?.messages ?? [];
    // Deux factures · février (envoi groupé de la facturation) et décembre
    // (envoi à l'unité), à l'adresse de la fiche du tiers facturé.
    const factures = messages.filter((m) => m.origine === 'FACTURE_ABONNEMENT');
    R.egal('Courrier · deux factures d’abonnement en file, sans transport', ['SANS_TRANSPORT', 'SANS_TRANSPORT'], factures.map((m) => m.statut));
    R.egal('Courrier · adressées à la fiche du tiers Alpha', true, factures.length > 0 && factures.every((m) => m.destinataire === 'facturation@alpha.exemple.cd'));
    // L'activation du second facteur avertit le titulaire HORS de la session,
    // par la même file, sans aucun secret (CLAUDE.md § 8).
    const avis = messages.filter((m) => m.origine === 'DOUBLE_AUTHENTIFICATION');
    R.egal('Courrier · avis d’activation du second facteur au titulaire', [ed.email], avis.map((m) => m.destinataire));
    R.egal('Courrier · l’avis ne porte pas la clé TOTP', false, Boolean(ctx.secret) && JSON.stringify(avis).includes(ctx.secret));
    // La licence sur site se signe avec la clé PRIVÉE de VMG, absente du banc ·
    // refus nommé, rien n'est enregistré, donc rien à mettre en file.
    await refusAttendu(ed, R, 'Licence sur site sans clé privée posée', 'POST', '/plateforme/licences-sur-site', {
      titulaire: 'Cabinet Alpha Conseil', empreinteMachine: 'a'.repeat(64), finMaintenance: '2029-02-15', expiration: null, dossiersMax: 3,
    }, 400, 'clé privée');
  });

  await etape(R, 'Console · dossiers de démonstration', async () => {
    const sfx = Date.now();
    const mdp = 'Vitrine-passe-v1-2028!';
    const assoc = { email: `passe-v1-vitrine-asso-${sfx}@exemple.cd`, motDePasse: mdp, referentiel: 'SYCEBNL' };
    const sarl = { email: `passe-v1-vitrine-sarl-${sfx}@exemple.cd`, motDePasse: mdp, referentiel: 'SYSCOHADA' };
    const va = await ed.geste('Vitrine association', 'POST', '/plateforme/dossier-demonstration', assoc);
    // LA SARL · « OUVRIR » DEUX FOIS. Le second clic arrive pendant le
    // garnissage du premier · la vitrine est alors marquée sans écriture
    // validée encore (la validation vient EN DERNIER), et la route la lit
    // comme une vitrine INTERROMPUE à compléter (audit final F174). La règle ·
    // la complétion « ne recrée rien de ce qui existe », une seule vitrine par
    // référentiel · le résultat doit être celui d'un seul garnissage.
    const premierClic = ed.req('POST', '/plateforme/dossier-demonstration', sarl);
    const sonde = new Client(R);
    let marquee = false;
    let nee = false;
    for (let i = 0; i < 200 && !marquee; i++) {
      await new Promise((ok) => setTimeout(ok, 100));
      if (!nee) {
        // La vitrine NÉE se voit à la console (même transaction que son compte).
        const l = await ed.req('GET', '/plateforme/cabinets');
        nee = (l.corps?.cabinets ?? []).some((x) => x.nom === 'Kivu Négoce SARL (démonstration)');
        if (nee) await sonde.req('POST', '/auth/login', { email: sarl.email, motDePasse: mdp });
        continue;
      }
      // MARQUÉE quand ses cinq modules optionnels sont posés (marquage).
      const p = await sonde.req('GET', '/dossier/parametres');
      marquee = p.statut === 200 && (p.corps?.modulesActives ?? []).length === 5;
    }
    R.note(`Vitrine SARL · second « Ouvrir » ${marquee ? 'envoyé pendant le garnissage du premier' : 'envoyé sans avoir vu le marquage (sonde muette)'}`);
    const secondClic = await ed.req('POST', '/plateforme/dossier-demonstration', { ...sarl, email: `passe-v1-vitrine-sarl2-${sfx}@exemple.cd` });
    const r1 = await premierClic;
    if (r1.statut >= 400) R.erreurHttp('Vitrine SARL · premier clic', 'POST', '/plateforme/dossier-demonstration', r1.statut, r1.corps);
    if (secondClic.statut >= 500) R.erreurHttp('Vitrine SARL · second clic pendant le garnissage', 'POST', '/plateforme/dossier-demonstration', secondClic.statut, secondClic.corps);
    R.note(`Vitrine SARL · premier clic · ${r1.statut} ; second clic · ${secondClic.statut} · ${JSON.stringify(secondClic.corps).slice(0, 200)}`);
    // Aucun des deux clics n'est une panne · l'un crée, l'autre complète ou se
    // refuse en nommant la vitrine existante.
    R.egal('Vitrine SARL · aucun des deux clics ne tombe en erreur serveur', [true, true], [r1.statut < 500, secondClic.statut < 500]);
    const vs = r1.statut < 400 ? r1.corps : null;
    // scenario-demonstration.ts · quatre tiers, neuf opérations et deux biens
    // payés comptant · onze écritures validées par vitrine.
    R.egal('Vitrine association · quatre tiers', 4, va?.garni?.tiers ?? null);
    R.egal('Vitrine association · onze écritures (neuf opérations, deux acquisitions)', 11, va?.garni?.ecritures ?? null);
    R.egal('Vitrine association · créée, pas reprise', false, va?.repris ?? null);
    R.egal('Vitrine SARL · le premier clic la crée (pas une reprise)', false, vs?.repris ?? null);
    // Une seconde vitrine du même référentiel est refusée en nommant la première.
    await refusAttendu(ed, R, 'Seconde vitrine association', 'POST', '/plateforme/dossier-demonstration',
      { email: `passe-v1-vitrine-asso2-${sfx}@exemple.cd`, motDePasse: mdp, referentiel: 'SYCEBNL' }, 400, 'Un dossier de démonstration existe déjà');

    // OUVERTURE · le mot de passe choisi ouvre la vitrine sans changement forcé
    // (`doitChangerMotDePasse` faux), tous modules activés.
    const verifier = async (nom, cfg, attendus) => {
      const v = await connecter(R, cfg.email, cfg.motDePasse, `Connexion à la vitrine ${nom}`);
      if (!v) return;
      const ex = (await v.lire(`Vitrine ${nom} · exercices`, '/exercices')) ?? [];
      const n = ex[0]?.id;
      // Exercice courant au jour du serveur · 2028.
      R.egal(`Vitrine ${nom} · exercice courant 2028`, '2028', ex[0]?.dateDebut?.slice(0, 4) ?? null);
      const p = await v.lire(`Vitrine ${nom} · paramètres`, '/dossier/parametres');
      R.egal(`Vitrine ${nom} · cinq modules optionnels activés`, 5, p?.modulesActives?.length ?? null);
      // UN SEUL GARNISSAGE · onze écritures, toutes validées, quatre tiers.
      const le = await v.lire(`Vitrine ${nom} · écritures`, `/ecritures?exerciceId=${n}`);
      R.egal(`Vitrine ${nom} · onze écritures au journal, aucune en double`, 11, le?.total ?? null);
      const vues = new Map();
      for (const e of le?.ecritures ?? []) vues.set(`${jour(e.date)} ${e.libelle}`, [...(vues.get(`${jour(e.date)} ${e.libelle}`) ?? []), e.statut]);
      const doubles = [...vues].filter(([, st]) => st.length > 1).map(([k, st]) => `${k} (${st.join(', ')})`);
      if (doubles.length) R.note(`Vitrine ${nom} · écritures en double · ${doubles.join(' ; ')}`);
      R.egal(`Vitrine ${nom} · toutes validées`, true, (le?.ecritures ?? []).length > 0 && (le?.ecritures ?? []).every((e) => e.statut === 'VALIDEE'));
      const lt = (await v.lire(`Vitrine ${nom} · tiers`, '/tiers')) ?? [];
      R.egal(`Vitrine ${nom} · quatre tiers`, 4, Array.isArray(lt) ? lt.length : (lt?.tiers?.length ?? null));
      const b = await balance(v, n);
      for (const [lib, racine, montant] of attendus) R.montant(`Vitrine ${nom} · ${lib}`, montant, solde(b, racine));
      R.montant(`Vitrine ${nom} · balance équilibrée`, 0, b ? b.totalDebit - b.totalCredit : null);
    };
    // ASSOCIATION · banque 2 500 000 + 120 000 − 450 000 + 1 000 000 − 1 200 000
    // − 600 000 = 1 370 000 ; dons 7041 2 500 000 + 1 000 000 = 3 500 000 ;
    // cotisations 701 2 × 120 000 ; achats 601 450 000 + 300 000 ; salaires 800 000.
    await verifier('association', assoc, [
      ['banque', '52', 1_370_000], ['dons 7041', '7041', -3_500_000], ['cotisations 701', '701', -240_000],
      ['achats 601', '601', 750_000], ['salaires 6611', '6611', 800_000], ['rémunérations dues 422', '422', -800_000],
    ]);
    // SARL · banque 4 200 000 − 3 000 000 + 1 000 000 − 800 000 − 500 000 = 900 000 ;
    // ventes 701 4 200 000 + 2 000 000 ; services 706 1 500 000 ; achats 601
    // 3 000 000 + 600 000 ; Hôtel du Lac 1 500 000 + 2 000 000 − 1 000 000.
    await verifier('SARL', sarl, [
      ['banque', '52', 900_000], ['ventes 701', '701', -6_200_000], ['services 706', '706', -1_500_000],
      ['achats 601', '601', 3_600_000], ['salaires 6611', '6611', 900_000], ['clients 411', '411', 2_500_000],
    ]);
  });

  /**
   * LA RACINE DE LA PANNE DES VITRINES, ÉPROUVÉE À PART · le journal du
   * serveur dit « Maillon d'audit NON écrit dans la transaction ·
   * Ecriture.create · Unique constraint failed on (tenantId, rang) » quand deux
   * garnissages écrivent dans le même dossier. Est-ce propre à la vitrine, ou
   * deux saisies simultanées dans un même dossier suffisent-elles ? Six
   * écritures envoyées ensemble dans un dossier neuf · la règle écrite
   * (`prisma-retry.util.ts`, `avecRetrySerialisable`) · un conflit se rejoue,
   * et l'échec final rend un message, « jamais un 500 brut ».
   */
  await etape(R, 'Sonde · six saisies simultanées dans un même dossier', async () => {
    const e = await nouveauDossier(R, 'Passe V1 · Epsilon (sonde de concurrence)', {
      referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'epsilon', exercice: ['2026-01-01', '2026-12-31'],
    });
    const en = e.exercices.get('2026')?.id;
    const corps = (i) => ({
      exerciceId: en, journalId: (e.journal('BQ') ?? e.od).id, date: `2026-03-${String(10 + i).padStart(2, '0')}`, libelle: `Saisie simultanée ${i}`,
      lignes: [{ compteId: compte(e, '60520000'), libelle: 'x', debit: 1_000 * (i + 1), credit: 0 }, { compteId: compte(e, '52110000'), libelle: 'x', debit: 0, credit: 1_000 * (i + 1) }],
    });
    const reponses = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => e.req('POST', '/ecritures', corps(i))));
    const statuts = reponses.map((r) => r.statut);
    R.note(`Sonde de concurrence · statuts des six saisies simultanées · ${statuts.join(', ')}`);
    R.egal('Sonde · aucune des six saisies simultanées ne tombe en erreur serveur', 0, statuts.filter((s) => s >= 500).length);
    for (const r of reponses) if (r.statut >= 500) R.erreurHttp('Sonde · saisie simultanée', 'POST', '/ecritures', r.statut, r.corps);
    // Ce qui est passé est au journal, ni plus ni moins (1 000 × (i + 1) par saisie admise).
    const b = await balance(e, en);
    const admis = reponses.reduce((s, r, i) => s + (r.statut < 400 ? 1_000 * (i + 1) : 0), 0);
    R.montant('Sonde · le 6052 porte exactement les saisies admises', admis, solde(b, '6052'));
  });

  // ===========================================================================
  // PARTIE 2 ET 3 · MONNAIE FONCTIONNELLE, ÉTATS PERSONNALISÉS, SIMULATEUR
  // (un dossier SYSCOHADA tenu en francs, qui vit en dollars)
  // ===========================================================================
  const g = await nouveauDossier(R, 'Passe V1 · Gamma Négoce SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'gamma', exercice: ['2026-01-01', '2026-12-31'],
  });
  const gn = g.exercices.get('2026')?.id;
  const gbq = g.journal('BQ') ?? g.od;

  await etape(R, 'Gamma · devise et monnaie fonctionnelle déclarée', async () => {
    await g.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    // Sans monnaie fonctionnelle, le second jeu se refuse.
    await refusAttendu(g, R, 'Second jeu sans monnaie fonctionnelle', 'GET', `/monnaie-fonctionnelle/balance/${gn}`, undefined, 400, 'Aucune monnaie fonctionnelle');
    // Le franc n'est pas une monnaie fonctionnelle (il est la monnaie de tenue).
    await refusAttendu(g, R, 'Monnaie fonctionnelle CDF', 'PATCH', '/dossier/coordonnees', { deviseFonctionnelle: 'CDF' }, 400, 'monnaie de tenue');
    const devises = (await g.lire('Devises', '/devises')) ?? [];
    ctx.gUsd = devises.find((d) => d.code === 'USD') ?? (await g.geste('Devise USD', 'POST', '/devises', { code: 'USD', intitule: 'Dollar américain' }));
    const p = await g.geste('Monnaie fonctionnelle USD', 'PATCH', '/dossier/coordonnees', { deviseFonctionnelle: 'USD' });
    R.egal('Gamma · monnaie fonctionnelle USD', 'USD', p?.deviseFonctionnelle ?? null);
    // Cours du banc · le 1er janvier 2026 est VOLONTAIREMENT omis d'abord.
    for (const [date, cours] of [['2026-03-01', 2_850], ['2026-06-30', 2_900], ['2026-12-31', 2_950], ['2027-07-01', 3_000]]) {
      await g.geste(`Cours USD du ${date}`, 'POST', `/devises/${ctx.gUsd?.id}/cours`, { date, cours, source: 'Banque centrale du Congo (banc passe V1)' });
    }
  });

  const usd = (montant, cours) => ({ deviseId: ctx.gUsd?.id, montantDevise: montant, coursApplique: cours });
  await etape(R, 'Gamma · écritures 2026 en francs et en dollars', async () => {
    await ecriture(g, 'G1 · apport en capital', gn, '2026-01-05', 'Apport en capital', [['52110000', 28_000_000, 0], ['10130000', 0, 28_000_000]], { journal: gbq });
    await ecriture(g, 'G2 · achat payé en dollars', gn, '2026-02-10', 'Achat de marchandises payé 1 000 USD', [['60110000', 2_800_000, 0], ['52150000', 0, 2_800_000, usd(1_000, 2_800)]], { journal: gbq });
    // La banque a appliqué 2 860, la table du dossier dit 2 850 au 15 mars.
    await ecriture(g, 'G3 · vente encaissée en dollars', gn, '2026-03-15', 'Vente encaissée 1 500 USD', [['52150000', 4_290_000, 0, usd(1_500, 2_860)], ['70110000', 0, 4_290_000]], { journal: gbq });
    await ecriture(g, 'G4 · vente en francs', gn, '2026-04-20', 'Vente au comptant', [['52110000', 6_000_000, 0], ['70110000', 0, 6_000_000]], { journal: gbq });
    await ecriture(g, 'G5 · remise accordée', gn, '2026-05-10', 'Remise accordée sur ventes', [['70190000', 500_000, 0], ['52110000', 0, 500_000]], { journal: gbq });
    await ecriture(g, 'G6 · loyer', gn, '2026-07-10', 'Loyer du dépôt', [['62220000', 1_450_000, 0], ['52110000', 0, 1_450_000]], { journal: gbq });
    await ecriture(g, 'G7 · électricité', gn, '2026-09-15', 'Électricité', [['60520000', 580_000, 0], ['52110000', 0, 580_000]], { journal: gbq });
    await validerJusqua(g, gn, '2026-12-31');
  });

  await etape(R, 'Gamma · second jeu 2026 · refus d’un cours postérieur, puis conversion ligne à ligne', async () => {
    // G1 (05/01) et G2 (10/02) précèdent le premier cours saisi (01/03) · le
    // jeu s'arrête plutôt que de prendre le cours POSTÉRIEUR.
    const r = await refusAttendu(g, R, 'Second jeu avec des écritures antérieures à tout cours', 'GET', `/monnaie-fonctionnelle/balance/${gn}`, undefined, 400, 'Aucun cours USD connu à 2 date(s)');
    R.egal('Second jeu · les deux dates sans cours sont nommées', true, /2026-01-05, 2026-02-10/.test(JSON.stringify(r.corps ?? '')));
    await g.geste('Cours USD du 2026-01-01', 'POST', `/devises/${ctx.gUsd?.id}/cours`, { date: '2026-01-01', cours: 2_800, source: 'Banque centrale du Congo (banc passe V1)' });
    const fb = await g.lire('Second jeu 2026', `/monnaie-fonctionnelle/balance/${gn}`);
    const L = (n) => fb?.lignes?.find((l) => l.numero === n);
    R.egal('Second jeu 2026 · mention « SANS VALEUR LÉGALE »', true, /SANS VALEUR LÉGALE/.test(fb?.mention ?? ''));
    R.egal('Second jeu 2026 · aucune ouverture (premier exercice)', 'AUCUNE', fb?.origine?.ouverture ?? null);
    // Cours en vigueur · 2 800 du 01/01 au 28/02, 2 850 du 01/03 au 29/06,
    // 2 900 du 30/06 au 30/12.
    // 5211 · débit 28 000 000 / 2 800 + 6 000 000 / 2 850 = 10 000 + 2 105,263158 ;
    // crédit 500 000 / 2 850 + 1 450 000 / 2 900 + 580 000 / 2 900 = 175,438596 + 500 + 200.
    R.montant('Second jeu 2026 · 5211 débit', 10_000 + 6_000_000 / 2_850, L('52110000')?.debit);
    R.montant('Second jeu 2026 · 5211 crédit', 500_000 / 2_850 + 500 + 200, L('52110000')?.credit);
    // 5215 · lignes déjà en dollars, prises à leur montant d'origine · 1 500 et 1 000.
    R.montant('Second jeu 2026 · 5215 débit (1 500 USD exacts)', 1_500, L('52150000')?.debit);
    R.montant('Second jeu 2026 · 5215 crédit (1 000 USD exacts)', 1_000, L('52150000')?.credit);
    R.montant('Second jeu 2026 · 1013 crédit', 10_000, L('10130000')?.credit);
    // 6011 · 2 800 000 / 2 800 · la ligne de francs de G2 au cours de SA date.
    R.montant('Second jeu 2026 · 6011 débit', 1_000, L('60110000')?.debit);
    // 7011 · 4 290 000 / 2 850 (pas 2 860, le cours de la banque n'est pas celui
    // de la table) + 6 000 000 / 2 850.
    R.montant('Second jeu 2026 · 7011 crédit', 4_290_000 / 2_850 + 6_000_000 / 2_850, L('70110000')?.credit);
    R.montant('Second jeu 2026 · 7019 débit', 500_000 / 2_850, L('70190000')?.debit);
    R.montant('Second jeu 2026 · 6222 débit', 500, L('62220000')?.debit);
    R.montant('Second jeu 2026 · 6052 débit', 200, L('60520000')?.debit);
    const debit = 10_000 + 6_000_000 / 2_850 + 1_500 + 1_000 + 500_000 / 2_850 + 500 + 200;
    const credit = 500_000 / 2_850 + 700 + 1_000 + 10_000 + 10_290_000 / 2_850;
    R.montant('Second jeu 2026 · total débit', debit, fb?.totaux?.debit);
    R.montant('Second jeu 2026 · total crédit', credit, fb?.totaux?.credit);
    // L'écart vient de G3 seul · 1 500 exacts au débit contre 4 290 000 / 2 850
    // = 1 505,263158 au crédit · −5,26, montré, jamais absorbé.
    R.montant('Second jeu 2026 · écart de conversion (G3 seule)', 1_500 - 4_290_000 / 2_850, fb?.totaux?.ecartDeConversion);
    // L'écart a SA ligne (les totaux), jamais un compte de bouclage · chaque
    // ligne du jeu est un compte du plan semé, et la somme des soldes rend
    // exactement l'écart montré.
    R.egal('Second jeu 2026 · aucune ligne hors du plan (pas de compte de bouclage)', [], (fb?.lignes ?? []).filter((l) => !g.comptes.has(l.numero)).map((l) => l.numero));
    // Un tableau imprimé s'additionne · le total d'une colonne est la somme des
    // montants affichés de cette colonne (au centime), sans quoi le lecteur ne
    // retrouve pas l'écart en faisant la somme.
    R.montant('Second jeu 2026 · total débit = somme des débits affichés', (fb?.lignes ?? []).reduce((s, l) => s + Number(l.debit), 0), fb?.totaux?.debit);
    R.montant('Second jeu 2026 · total crédit = somme des crédits affichés', (fb?.lignes ?? []).reduce((s, l) => s + Number(l.credit), 0), fb?.totaux?.credit);
    R.egal('Second jeu 2026 · deux lignes exactes, les autres converties', 2, fb?.origine?.lignesExactes ?? null);
    R.egal('Second jeu 2026 · sept écritures converties', 7, fb?.origine?.ecritures ?? null);
  });

  await etape(R, 'Gamma · natures de compte (point 14)', async () => {
    const lu = await g.lire('Natures de compte', '/natures-compte');
    const N = (code) => lu?.natures?.find((x) => x.nature === code);
    R.egal('Natures · sept, pas une de plus', 7, lu?.natures?.length ?? null);
    // Les défauts annoncés · CLAUDE.md point 14 et `NATURES_PAR_DEFAUT` ·
    // confrontés au PLAN SEMÉ du dossier · chaque compte de détail de la
    // fourchette porte-t-il le mode de report de sa nature ?
    for (const [nature, racine] of [['STOCK', '3'], ['CLIENT', '41'], ['FOURNISSEUR', '40'], ['BANQUE', '52'], ['CAISSE', '57'], ['CHARGE', '6'], ['PRODUIT', '7']]) {
      const modes = [...new Set(g.plan.filter((x) => x.typeCompte !== 'TOTAL' && x.numero.startsWith(racine)).map((x) => x.modeReportANouveau))];
      R.egal(`Nature ${nature} · mode de report du plan semé (${racine})`, modes.length === 1 ? modes[0] : modes, N(nature)?.modeReportANouveau ?? null);
    }
    R.egal('Natures · tiers lettrables, le reste non', [true, true, false, false, false, false, false],
      ['CLIENT', 'FOURNISSEUR', 'STOCK', 'BANQUE', 'CAISSE', 'CHARGE', 'PRODUIT'].map((n) => N(n)?.lettrable ?? null));
    R.egal('Natures · aucune incohérence sur un plan neuf', 0, lu?.incoherences?.length ?? null);
    // Une fourchette qui chevauche une autre nature est refusée (40, 41 dans « 3 à 4 »).
    await refusAttendu(g, R, 'Fourchette Stock qui chevauche les tiers', 'PATCH', '/natures-compte/STOCK', { fourchettes: [{ du: '3', au: '4' }] }, 400);
    // Un compte créé hérite des défauts de SA nature · Banque · SOLDE, non lettrable.
    const cr = await g.geste('Compte 52190000 créé', 'POST', '/comptes', { numero: '52190000', intitule: 'Banque de passage (banc)' });
    R.egal('Compte créé sous la nature Banque · report SOLDE', 'SOLDE', cr?.modeReportANouveau ?? null);
    R.egal('Compte créé sous la nature Banque · non lettrable', false, cr?.lettrable ?? null);
    // La nature Fournisseurs passe en report SOLDE · le compte créé ensuite le suit,
    // les comptes existants deviennent des incohérences LISTÉES, jamais corrigées d'office.
    const avant = g.plan.filter((x) => x.typeCompte !== 'TOTAL' && x.numero.startsWith('40')).length;
    const m = await g.geste('Nature Fournisseurs en report SOLDE', 'PATCH', '/natures-compte/FOURNISSEUR', { modeReportANouveau: 'SOLDE' });
    R.egal('Fournisseurs en SOLDE · chaque compte 40 de détail listé incohérent', avant, (m?.incoherences ?? []).filter((x) => x.nature === 'FOURNISSEUR').length);
    const al = await g.geste('Aligner un seul compte (40110000)', 'POST', '/natures-compte/aligner', { compteIds: [compte(g, '40110000')] });
    R.egal('Alignement demandé · un compte', 1, al?.alignes ?? null);
    R.egal('Après alignement · un compte 40 de moins à aligner', avant - 1, (al?.incoherences ?? []).filter((x) => x.nature === 'FOURNISSEUR').length);
    // Retour au défaut · la nature, puis le compte aligné, reviennent au DÉTAIL.
    await g.geste('Nature Fournisseurs rendue au DÉTAIL', 'PATCH', '/natures-compte/FOURNISSEUR', { modeReportANouveau: 'DETAIL' });
    const fin = await g.geste('Aligner le compte rendu incohérent', 'POST', '/natures-compte/aligner', { compteIds: [compte(g, '40110000')] });
    R.egal('Natures rendues · plus aucune incohérence', 0, fin?.incoherences?.length ?? null);
    await rechargerComptes(g);
  });

  await etape(R, 'Gamma · clôture 2026 et exercice 2027', async () => {
    await cloturer(g, '2026');
  });
  const gn1 = g.exercices.get('2027')?.id;

  await etape(R, 'Gamma · écritures 2027 et second jeu N+1', async () => {
    if (!gn1) {
      R.note('Gamma · 2027 absent · la clôture de 2026 n’a pas abouti');
      return;
    }
    await ecriture(g, 'G8 · achat 2027', gn1, '2027-02-01', 'Achat de marchandises', [['60110000', 2_950_000, 0], ['52110000', 0, 2_950_000]], { journal: gbq });
    await ecriture(g, 'G9 · vente 2027', gn1, '2027-03-10', 'Vente au comptant', [['52110000', 8_850_000, 0], ['70110000', 0, 8_850_000]], { journal: gbq });
    await ecriture(g, 'G10 · loyer 2027', gn1, '2027-04-15', 'Loyer du dépôt', [['62220000', 790_000, 0], ['52110000', 0, 790_000]], { journal: gbq });
    await ecriture(g, 'G11 · vente en dollars 2027', gn1, '2027-08-05', 'Vente encaissée 2 000 USD', [['52150000', 6_000_000, 0, usd(2_000, 3_000)], ['70110000', 0, 6_000_000]], { journal: gbq });
    await validerJusqua(g, gn1, '2027-12-31');
    const b = await balance(g, gn1);
    // Résultat en francs de 2026 · 10 290 000 − 500 000 − 2 800 000 − 1 450 000
    // − 580 000 = 4 960 000, reporté au 131 (bénéfice).
    R.montant('2027 · à-nouveau du résultat 2026 au 131', -4_960_000, solde(b, '131'));
    const fb = await g.lire('Second jeu 2027', `/monnaie-fonctionnelle/balance/${gn1}`);
    const L = (n) => fb?.lignes?.find((l) => l.numero === n);
    R.egal('Second jeu 2027 · ouverture = clôture du même jeu en 2026', 'EXERCICE_PRECEDENT', fb?.origine?.ouverture ?? null);
    // Ouverture · solde 2026 du 5211 en dollars = 10 000 + 6 000 000/2 850 −
    // 500 000/2 850 − 700 = 11 229,824561 ; 5215 · 500 ; 1013 · 10 000 ;
    // résultat 2026 du jeu · 10 290 000/2 850 − (1 000 + 500 000/2 850 + 500 + 200)
    // = 1 735,087719, porté au 131 que la clôture en francs a mouvementé.
    const ouv5211 = 10_000 + 6_000_000 / 2_850 - 500_000 / 2_850 - 700;
    const resultat2026 = 10_290_000 / 2_850 - (1_000 + 500_000 / 2_850 + 500 + 200);
    R.montant('Second jeu 2027 · ouverture 5211', ouv5211, L('52110000')?.ouvertureDebit);
    R.montant('Second jeu 2027 · ouverture 5215', 500, L('52150000')?.ouvertureDebit);
    R.montant('Second jeu 2027 · ouverture 131 (résultat 2026 du jeu)', resultat2026, L('13100000')?.ouvertureCredit);
    // 2027 · 2 950 000/2 950 = 1 000 ; 8 850 000/2 950 = 3 000 ; 790 000/2 950 =
    // 267,79661 (cours du 31/12/2026, en vigueur jusqu'au 30/06/2027) ; G11 au
    // cours du 01/07/2027 · 6 000 000/3 000 = 2 000 et 2 000 USD exacts.
    R.montant('Second jeu 2027 · 5211 solde', ouv5211 + 3_000 - 1_000 - 790_000 / 2_950, L('52110000')?.solde);
    R.montant('Second jeu 2027 · 5215 solde (500 + 2 000)', 2_500, L('52150000')?.solde);
    R.montant('Second jeu 2027 · 7011 crédit', 5_000, L('70110000')?.credit);
    R.montant('Second jeu 2027 · 6222 débit', 790_000 / 2_950, L('62220000')?.debit);
    // L'écart d'ouverture est celui de 2026 · −5,26 ; aucun écart nouveau (G11 est
    // convertie au cours même de sa ligne en dollars).
    R.montant('Second jeu 2027 · écart repris à l’ouverture', 1_500 - 4_290_000 / 2_850, fb?.totaux?.dontOuverture);
    R.montant('Second jeu 2027 · écart de conversion total', 1_500 - 4_290_000 / 2_850, fb?.totaux?.ecartDeConversion);
  });

  await etape(R, 'Gamma · états personnalisés (point 20)', async () => {
    if (!gn1) return;
    const lignes = [
      // Le moins EXCLUT · « 70 -7019 » = les ventes sauf les remises accordées (7019, SYSCOHADA).
      { cle: 'CA', libelle: 'Chiffre d’affaires brut', racines: '70 -7019', mesure: 'MOUVEMENT', sens: 'CREDIT' },
      { cle: 'RRR', libelle: 'Remises accordées', racines: '7019', mesure: 'MOUVEMENT', sens: 'DEBIT' },
      { cle: 'ACH', libelle: 'Achats et services extérieurs', racines: '60 62', mesure: 'MOUVEMENT', sens: 'DEBIT' },
      { cle: 'MARGE', libelle: 'Marge', total: 'CA-RRR-ACH' },
      { cle: 'CASOLDE', libelle: 'Ventes lues au solde', racines: '70 -7019', mesure: 'SOLDE', sens: 'CREDIT' },
      { cle: 'TRESO', libelle: 'Trésorerie', racines: '52', mesure: 'SOLDE', sens: 'DEBIT' },
      { cle: 'CAP', libelle: 'Capital et résultat', racines: '10 13', mesure: 'SOLDE', sens: 'CREDIT' },
    ];
    await refusAttendu(g, R, 'État · un total qui cite une ligne suivante', 'POST', '/etats-personnalises', { nom: 'Refusé', lignes: [{ cle: 'T', libelle: 'Total', total: 'A' }, { cle: 'A', libelle: 'A', racines: '70', mesure: 'MOUVEMENT', sens: 'CREDIT' }] }, 400, 'PRÉCÉDENTE');
    await refusAttendu(g, R, 'État · une racine citée deux fois', 'POST', '/etats-personnalises', { nom: 'Refusé', lignes: [{ cle: 'A', libelle: 'A', racines: '70 -70', mesure: 'MOUVEMENT', sens: 'CREDIT' }] }, 400, 'citée deux fois');
    await refusAttendu(g, R, 'État · aucune racine incluse', 'POST', '/etats-personnalises', { nom: 'Refusé', lignes: [{ cle: 'A', libelle: 'A', racines: '-7019', mesure: 'MOUVEMENT', sens: 'DEBIT' }] }, 400, 'au moins une racine incluse');
    const e = await g.geste('État personnalisé', 'POST', '/etats-personnalises', { nom: 'Tableau de gestion Gamma', lignes });
    const calc = await g.lire('État personnalisé · calcul', `/etats-personnalises/${e?.id}/calcul?exercices=${gn},${gn1}`);
    const col = (ex) => calc?.colonnes?.find((x) => x.exerciceId === ex)?.valeurs ?? {};
    const a = col(gn);
    const b = col(gn1);
    // 2026 · ventes 4 290 000 + 6 000 000 ; remise 500 000 ; achats 2 800 000 +
    // 580 000 + loyer 1 450 000 ; marge 10 290 000 − 500 000 − 4 830 000.
    R.montant('État 2026 · CA (70 sauf 7019)', 10_290_000, a.CA);
    R.montant('État 2026 · remises', 500_000, a.RRR);
    R.montant('État 2026 · achats et services', 4_830_000, a.ACH);
    R.montant('État 2026 · marge (total de lignes précédentes)', 4_960_000, a.MARGE);
    // Exercice CLOS · la clôture solde les comptes de gestion, le SOLDE vaut zéro
    // · c'est pourquoi la gestion se lit en MOUVEMENT.
    R.montant('État 2026 · ventes lues au solde sur un exercice clos', 0, a.CASOLDE);
    // Trésorerie au 31/12/2026 · 5211 31 470 000 + 5215 1 490 000.
    R.montant('État 2026 · trésorerie au solde', 32_960_000, a.TRESO);
    // Capital 28 000 000 + résultat 4 960 000 porté au 131 par la clôture.
    R.montant('État 2026 · capital et résultat (clôture comprise)', 32_960_000, a.CAP);
    // 2027 · ventes 8 850 000 + 6 000 000 ; achats 2 950 000 + 790 000.
    R.montant('État 2027 · CA', 14_850_000, b.CA);
    R.montant('État 2027 · remises', 0, b.RRR);
    R.montant('État 2027 · achats et services', 3_740_000, b.ACH);
    R.montant('État 2027 · marge', 11_110_000, b.MARGE);
    R.montant('État 2027 · ventes au solde (exercice ouvert)', 14_850_000, b.CASOLDE);
    // 5211 · 31 470 000 − 2 950 000 + 8 850 000 − 790 000 ; 5215 · 1 490 000 + 6 000 000.
    R.montant('État 2027 · trésorerie au solde', 44_070_000, b.TRESO);
    R.montant('État 2027 · capital et résultat 2026 reporté', 32_960_000, b.CAP);
  });

  await etape(R, 'Gamma · simulateur budgétaire (priorité 6)', async () => {
    if (!gn1) return;
    await refusAttendu(g, R, 'Simulation · seuil orange au-dessus du rouge', 'POST', '/simulations-budgetaires', {
      nom: 'Refusée', exerciceReferenceId: gn, exerciceCibleId: gn1, croissanceProduitsPct: 20, variations: {}, seuilOrangePct: 15, seuilRougePct: 5,
    }, 400, 'l’orange strictement sous le rouge');
    const s = await g.geste('Simulation 2027', 'POST', '/simulations-budgetaires', {
      nom: 'Budget 2027 Gamma', exerciceReferenceId: gn, exerciceCibleId: gn1, croissanceProduitsPct: 20, variations: { 60: 10 }, seuilOrangePct: 5, seuilRougePct: 15,
    });
    const r = await g.lire('Simulation · calcul au 30 juin 2027', `/simulations-budgetaires/${s?.id}/calcul?arreteAu=2027-06-30`);
    const L = (x) => r?.lignes?.find((l) => l.racine === x);
    // Prorata en JOURS de calendrier · du 1er janvier au 30 juin 2027 = 181 jours sur 365.
    const prorata = 181 / 365;
    R.montant('Simulation · prorata (181/365, ×10 000)', Math.round(prorata * 10_000), Math.round((r?.prorata ?? NaN) * 10_000));
    const arr = (x) => Math.round(x * 100) / 100;
    // Référence 2026 en MOUVEMENT · 60 = 2 800 000 + 580 000 ; 62 = 1 450 000 ;
    // 70 = 10 290 000 − 500 000 (la remise 7019 diminue sa ligne).
    const lignes = {
      60: { ref: 3_380_000, taux: 10, realise: 2_950_000, nature: 'CHARGE' },
      62: { ref: 1_450_000, taux: 0, realise: 790_000, nature: 'CHARGE' },
      70: { ref: 9_790_000, taux: 20, realise: 8_850_000, nature: 'PRODUIT' },
    };
    const prevus = {};
    for (const [racine, d] of Object.entries(lignes)) {
      const annuel = arr(d.ref * (1 + d.taux / 100));
      const adate = arr(annuel * prorata);
      prevus[racine] = adate;
      R.montant(`Simulation · ${racine} · référence 2026`, d.ref, L(racine)?.reference);
      R.montant(`Simulation · ${racine} · prévu annuel`, annuel, L(racine)?.prevuAnnuel);
      R.montant(`Simulation · ${racine} · prévu au 30 juin`, adate, L(racine)?.prevuADate);
      R.montant(`Simulation · ${racine} · réalisé au 30 juin`, d.realise, L(racine)?.realise);
      // Seul l'écart DÉFAVORABLE colore · charge au-dessus, produit en dessous.
      const ecart = ((d.nature === 'PRODUIT' ? adate - d.realise : d.realise - adate) / Math.abs(adate)) * 100;
      const jauge = ecart <= 5 ? 'VERT' : ecart <= 15 ? 'ORANGE' : 'ROUGE';
      R.montant(`Simulation · ${racine} · écart défavorable en %`, arr(ecart), L(racine)?.ecartDefavorablePct);
      R.egal(`Simulation · ${racine} · jauge`, jauge, L(racine)?.jauge ?? null);
    }
    R.egal('Simulation · 60 · intitulé lu au plan du dossier', g.comptes.get('60')?.intitule ?? '?', L('60')?.intitule ?? null);
    R.montant('Simulation · résultat des activités ordinaires prévu au 30 juin', arr(prevus[70] - prevus[60] - prevus[62]), r?.totaux?.prevuADate?.resultatActivitesOrdinaires);
    R.montant('Simulation · résultat réalisé au 30 juin (8 850 000 − 2 950 000 − 790 000)', 5_110_000, r?.totaux?.realise?.resultatActivitesOrdinaires);
    R.egal('Simulation · jauge du résultat (au-dessus du prévu)', 'VERT', r?.totaux?.jaugeResultat ?? null);
  });

  // ===========================================================================
  // PARTIE 4 ET 5 · PROJET SYCEBNL · CONVENTIONS, CATALOGUE, ANALYTIQUE
  // ===========================================================================
  const d = await nouveauDossier(R, 'Passe V1 · Projet Delta Assainissement', {
    referentiel: 'SYCEBNL', jeu: 'PROJETS_DEVELOPPEMENT', cle: 'delta', exercice: ['2026-01-01', '2026-12-31'],
  });
  const dn = d.exercices.get('2026')?.id;
  const dbq = d.journal('BQ') ?? d.od;

  await etape(R, 'Delta · bailleur et conventions de financement (§ 5.4.2.4)', async () => {
    const bailleur = await d.geste('Bailleur', 'POST', '/bailleurs', { code: 'BMF', nom: 'Banque mondiale (fictif)' });
    ctx.bailleur = bailleur?.id;
    const base = { bailleurId: bailleur?.id, dateDebut: '2026-01-01', dateFin: '2027-12-31' };
    const c1 = await d.geste('Convention ferme et signée', 'POST', '/conventions-financement', {
      ...base, reference: 'CONV-2026-01', objet: 'Assainissement de Delta, phase 1', ecritSigne: true, signataire: 'Directeur pays (fictif)',
      dateSignature: '2026-01-10', montantAccorde: 100_000_000, caractere: 'FERME_INCONDITIONNEL',
    });
    ctx.c1 = c1?.id;
    await refusAttendu(d, R, 'Convention en double (même référence)', 'POST', '/conventions-financement', {
      ...base, reference: 'CONV-2026-01', objet: 'Doublon', montantAccorde: 1, caractere: 'FERME_INCONDITIONNEL',
    }, 400, 'doubleraient le montant accordé');
    await refusAttendu(d, R, 'Engagement conditionnel sans ses conditions', 'POST', '/conventions-financement', {
      ...base, reference: 'CONV-2026-02', objet: 'Phase 2', montantAccorde: 50_000_000, caractere: 'CONDITIONNEL',
    }, 400, 'CONDITIONNEL doit dire à quoi');
    await refusAttendu(d, R, 'Écrit signé sans signataire', 'POST', '/conventions-financement', {
      ...base, reference: 'CONV-2026-04', objet: 'Phase 4', ecritSigne: true, montantAccorde: 5_000_000, caractere: 'FERME_INCONDITIONNEL',
    }, 400);
    const c2 = await d.geste('Convention conditionnelle', 'POST', '/conventions-financement', {
      ...base, reference: 'CONV-2026-02', objet: 'Phase 2', montantAccorde: 50_000_000, caractere: 'CONDITIONNEL',
      conditions: 'Atteinte des indicateurs de la phase 1 (fictif)',
    });
    const c3 = await d.geste('Convention ferme non signée', 'POST', '/conventions-financement', {
      ...base, reference: 'CONV-2026-03', objet: 'Appui institutionnel', montantAccorde: 20_000_000, caractere: 'FERME_INCONDITIONNEL',
    });
    ctx.c3 = c3?.id;
    // Tranches de la convention ferme · 60 000 000 puis 40 000 000 ; une
    // troisième dépasserait le montant accordé.
    const t1 = await d.geste('Tranche 1', 'POST', `/conventions-financement/${c1?.id}/tranches`, { numero: 1, libelle: 'Première tranche', montant: 60_000_000, datePrevue: '2026-02-01' });
    await d.geste('Tranche 2', 'POST', `/conventions-financement/${c1?.id}/tranches`, { numero: 2, libelle: 'Seconde tranche', montant: 40_000_000, datePrevue: '2027-02-01' });
    await refusAttendu(d, R, 'Tranche au-delà du montant accordé', 'POST', `/conventions-financement/${c1?.id}/tranches`, { numero: 3, libelle: 'De trop', montant: 1_000, datePrevue: '2027-06-01' }, 400, 'dépasserait le montant accordé');
    await d.geste('Encaissement de la tranche 1', 'PATCH', `/conventions-financement/${c1?.id}/tranches/${t1?.id}/encaissement`, { dateEncaissement: '2026-02-05', montantEncaisse: 60_000_000 });
    await refusAttendu(d, R, 'Tranche encaissée deux fois', 'PATCH', `/conventions-financement/${c1?.id}/tranches/${t1?.id}/encaissement`, { dateEncaissement: '2026-02-06', montantEncaisse: 1 }, 400, 'déjà encaissée');
    const r1 = await d.geste('Rapport financier', 'POST', `/conventions-financement/${c1?.id}/rapports`, { intitule: 'Rapport financier semestriel', nature: 'FINANCIER', dateEcheance: '2026-06-30' });
    await d.geste('Rapport financier transmis', 'PATCH', `/conventions-financement/${c1?.id}/rapports/${r1?.id}/transmission`, { dateTransmission: '2026-07-10' });
    await d.geste('Rapport narratif', 'POST', `/conventions-financement/${c1?.id}/rapports`, { intitule: 'Rapport narratif final', nature: 'NARRATIF', dateEcheance: '2027-12-31' });

    const liste = (await d.lire('Conventions', '/conventions-financement')) ?? [];
    const C = (ref) => liste.find((x) => x.reference === ref);
    // § 5.4.2.4 · créance à recevoir SI ferme ET inconditionnel ET écrit signé.
    R.egal('CONV-2026-01 · ferme, signée · créance à recevoir', 'CREANCE_A_RECEVOIR', C('CONV-2026-01')?.traitement ?? null);
    R.egal('CONV-2026-02 · conditionnelle · mention aux Notes annexes', 'MENTION_NOTES_ANNEXES', C('CONV-2026-02')?.traitement ?? null);
    R.egal('CONV-2026-03 · ferme sans écrit signé · non comptabilisée', 'MENTION_NOTES_ANNEXES', C('CONV-2026-03')?.traitement ?? null);
    R.montant('CONV-2026-01 · encaissé', 60_000_000, C('CONV-2026-01')?.montantEncaisse);
    R.montant('CONV-2026-01 · reste à recevoir (100 − 60 millions)', 40_000_000, C('CONV-2026-01')?.resteARecevoir);
    // Au 15/02/2028 · fin le 31/12/2027 et toujours EN COURS · échue ; la
    // tranche 2 prévue le 01/02/2027 n'est pas encaissée ; le narratif du
    // 31/12/2027 n'est pas transmis.
    R.egal('CONV-2026-01 · échue et toujours en cours', true, C('CONV-2026-01')?.expiree ?? null);
    R.egal('CONV-2026-01 · tranche 2 en retard, tranche 1 non', [false, true], (C('CONV-2026-01')?.tranches ?? []).map((t) => t.enRetard));
    R.egal('CONV-2026-01 · rapport financier transmis, narratif en retard', [false, true], (C('CONV-2026-01')?.rapports ?? []).map((x) => x.enRetard));
    const cr = (await d.lire('Créances à recevoir', '/conventions-financement/creances-a-recevoir')) ?? [];
    R.egal('Créances à recevoir · la seule convention ferme et signée', ['CONV-2026-01'], cr.map((x) => x.reference));
    R.montant('Créances à recevoir · reste de CONV-2026-01', 40_000_000, cr[0]?.resteARecevoir);
    const mentions = (await d.lire('Mentions aux Notes annexes', '/conventions-financement/mentions-notes-annexes')) ?? [];
    R.egal('Notes annexes · la convention conditionnelle est mentionnée avec ses conditions', true,
      mentions.some((m) => m.includes('CONV-2026-02') && m.includes('Atteinte des indicateurs de la phase 1')));
    // La convention ferme NON SIGNÉE est dite « Mention en Notes annexes » par
    // la liste (et l'écran, ConventionsFinancementPage) · la route des mentions,
    // seule source de ces mentions, devrait donc la porter.
    R.egal('Notes annexes · la convention que la liste dit « mention en Notes annexes » (ferme, non signée) y figure', true, mentions.some((m) => m.includes('CONV-2026-03')));
    await refusAttendu(d, R, 'Résiliation sans motif', 'PATCH', `/conventions-financement/${c3?.id}/cloture`, { statut: 'RESILIEE' }, 400, 'motif de résiliation');
    await d.geste('Résiliation motivée', 'PATCH', `/conventions-financement/${c3?.id}/cloture`, { statut: 'RESILIEE', motif: 'Retrait du financeur (fictif)' });
    const apres = (await d.lire('Conventions', '/conventions-financement')) ?? [];
    R.montant('CONV-2026-03 résiliée · plus rien à recevoir', 0, apres.find((x) => x.reference === 'CONV-2026-03')?.resteARecevoir);
    ctx.c2 = c2?.id;
  });

  await etape(R, 'Delta · nomenclature budgétaire, rubriques emboîtées, budgets', async () => {
    const plan = await d.geste('Plan budgétaire', 'POST', '/analytique/plans', { code: 'NOMB', intitule: 'Nomenclature budgétaire du projet', classesVentilees: '6', gererBudgets: true });
    ctx.plan = plan?.id;
    const S = {};
    for (const [code, intitule, type, extra] of [
      ['1', 'Personnel', 'TOTAL'], ['11', 'Rémunérations', 'TOTAL'], ['111', 'Salaires', 'DETAIL'], ['112', 'Primes', 'DETAIL'], ['12', 'Charges sociales', 'DETAIL'],
      ['2', 'Fonctionnement', 'TOTAL'], ['21', 'Fournitures', 'DETAIL'], ['22', 'Missions', 'DETAIL'],
      ['23', 'Atelier de lancement', 'DETAIL', { dateDebut: '2026-01-01', dateFin: '2026-12-31' }],
    ]) {
      const s = await d.geste(`Section ${code}`, 'POST', `/analytique/plans/${plan?.id}/sections`, { code, intitule, type, ...(extra ?? {}) });
      S[code] = s?.id;
    }
    ctx.S = S;
    await refusAttendu(d, R, 'Budget posé sur une rubrique (section Total)', 'POST', `/analytique/sections/${S['11']}/budget`, { exerciceId: dn, montantAnnuel: 1_000_000 }, 400, 'Total ne se dote pas');
    for (const [code, montant] of [['111', 12_000_000], ['112', 2_400_000], ['12', 1_800_000], ['21', 3_000_000], ['22', 1_200_000]]) {
      await d.geste(`Budget 2026 ${code}`, 'POST', `/analytique/sections/${S[code]}/budget`, { exerciceId: dn, montantAnnuel: montant });
    }
    // Mars de la section 21 porté à 500 000 · l'annuelle suit la somme des mois
    // · 11 × 250 000 + 500 000 = 3 250 000.
    const b21 = await d.geste('Budget de mars de la section 21', 'PATCH', `/analytique/sections/${S['21']}/budget`, { exerciceId: dn, mois: 3, montant: 500_000 });
    R.montant('Budget 21 · annuel = somme des mois après la retouche de mars', 3_250_000, b21?.annuel);
    const b111 = await d.lire('Budget 111', `/analytique/sections/${S['111']}/budget?exerciceId=${dn}`);
    R.egal('Budget 111 · douze mois', 12, b111?.mensuel?.length ?? null);
    R.montant('Budget 111 · un douzième par mois (12 000 000 / 12)', 1_000_000, b111?.mensuel?.find((m) => m.mois === 7)?.montant);
  });

  await etape(R, 'Delta · catalogue des opérations spécifiques (Guide, Application 8)', async () => {
    const cat = await d.lire('Catalogue', '/operations-specifiques');
    R.egal('Catalogue · jeu du dossier', 'PROJETS', cat?.jeu ?? null);
    R.egal('Catalogue · l’opération B19 des projets est servie', true, (cat?.operations ?? []).some((o) => o.code === 'B19'));
    // App. 8 · virement global, clé 80 % investissement · ici la tranche 1 de
    // 60 000 000 · 162 = 60 000 000 × 0,8 = 48 000 000 ; 462 = le complément.
    const params = { codeModele: 'B19-DECAISSEMENT', parametres: { virement: 60_000_000, partInvestissement: 0.8 } };
    const p0 = await d.geste('Proposition B19 sans choix de banque', 'POST', '/operations-specifiques/proposition', params);
    R.egal('Proposition · la banque reste à choisir (plusieurs comptes 52)', true, (p0?.lignes ?? []).some((l) => l.choixRequis?.racine === '52'));
    await refusAttendu(d, R, 'Application sans compte de banque choisi', 'POST', '/operations-specifiques/application', { ...params, exerciceId: dn, journalId: dbq.id, date: '2026-02-05' }, 400, 'Un compte reste à choisir');
    const p = await d.geste('Proposition B19', 'POST', '/operations-specifiques/proposition', { ...params, comptesChoisis: { 52: '52110000' } });
    const pl = (n) => p?.lignes?.find((l) => l.numero === n);
    R.montant('B19 · 5211 au débit', 60_000_000, pl('52110000')?.debit);
    R.montant('B19 · 162 au crédit (80 %)', 48_000_000, pl('16200000')?.credit);
    R.montant('B19 · 462 au crédit (complément)', 12_000_000, pl('46200000')?.credit);
    R.egal('B19 · équilibrée', true, p?.equilibree ?? null);
    const e = await d.geste('Application B19 · décaissement du bailleur', 'POST', '/operations-specifiques/application', {
      ...params, comptesChoisis: { 52: '52110000' }, exerciceId: dn, journalId: dbq.id, date: '2026-02-05', reference: 'CONV-2026-01/T1',
    });
    R.egal('B19 · écriture enregistrée (trois lignes)', 3, e?.lignes?.length ?? null);
    // Un modèle qui relève d'un module est refusé, le module nommé.
    await refusAttendu(d, R, 'Modèle B15-REPRISE renvoyé au module des immobilisations', 'POST', '/operations-specifiques/proposition', { codeModele: 'B15-REPRISE', parametres: {} }, 400, 'Immobilisations');
    await refusAttendu(d, R, 'Modèle de cotisation douteuse renvoyé au module des créances', 'POST', '/operations-specifiques/proposition', { codeModele: 'B6-COTISATION-DOUTEUSE', parametres: { montant: 1 } }, 400, 'Créances douteuses ou litigieuses');
  });

  await etape(R, 'Delta · charges 2026 ventilées, OD analytique, neutralisation', async () => {
    const S = ctx.S ?? {};
    const v = (...paires) => ({ ventilations: paires.map(([code, montant]) => ({ sectionId: S[code], debit: montant })) });
    await ecriture(d, 'D1 · salaires de mars', dn, '2026-03-31', 'Salaires de mars', [['66110000', 3_000_000, 0, v(['111', 3_000_000])], ['52110000', 0, 3_000_000]], { journal: dbq });
    await ecriture(d, 'D2 · charges sociales de mars', dn, '2026-03-31', 'Charges sociales de mars', [['66410000', 450_000, 0, v(['12', 450_000])], ['52110000', 0, 450_000]], { journal: dbq });
    await ecriture(d, 'D3 · fournitures de bureau', dn, '2026-04-15', 'Fournitures de bureau', [['60550000', 800_000, 0, v(['21', 800_000])], ['52110000', 0, 800_000]], { journal: dbq });
    // Une dépense partagée entre deux sections · 400 000 de missions, 100 000 d'atelier.
    await ecriture(d, 'D4 · missions et atelier', dn, '2026-05-20', 'Missions et atelier de lancement', [['61810000', 500_000, 0, v(['22', 400_000], ['23', 100_000])], ['52110000', 0, 500_000]], { journal: dbq });
    await ecriture(d, 'D5 · achats partagés', dn, '2026-06-10', 'Achats de biens', [['60110000', 1_000_000, 0, v(['21', 600_000], ['112', 400_000])], ['52110000', 0, 1_000_000]], { journal: dbq });
    // Une ventilation incomplète est refusée (une ligne se ventile en entier ou pas).
    const inc = await d.req('POST', '/ecritures', {
      exerciceId: dn, journalId: dbq.id, date: '2026-06-11', libelle: 'Ventilation incomplète',
      lignes: [{ compteId: compte(d, '60110000'), libelle: 'x', debit: 100_000, credit: 0, ventilations: [{ sectionId: S['21'], debit: 60_000 }] }, { compteId: compte(d, '52110000'), libelle: 'x', debit: 0, credit: 100_000 }],
    });
    R.egal('Ventilation incomplète refusée (400)', 400, inc.statut);
    // OD ANALYTIQUE · 200 000 des fournitures passent aux missions, sur le même compte.
    await refusAttendu(d, R, 'OD analytique déséquilibrée', 'POST', '/analytique/od', {
      exerciceId: dn, planId: ctx.plan, compteId: compte(d, '60550000'), date: '2026-06-30', libelle: 'Reclassement',
      lignes: [{ sectionId: S['22'], debit: 200_000 }, { sectionId: S['21'], credit: 150_000 }],
    }, 400, 'ne s\'équilibre pas');
    await refusAttendu(d, R, 'OD analytique sur une rubrique', 'POST', '/analytique/od', {
      exerciceId: dn, planId: ctx.plan, compteId: compte(d, '60550000'), date: '2026-06-30', libelle: 'Reclassement',
      lignes: [{ sectionId: S['2'], debit: 200_000 }, { sectionId: S['21'], credit: 200_000 }],
    }, 400, 'rubrique');
    await refusAttendu(d, R, 'OD analytique sur un compte de classe non ventilée', 'POST', '/analytique/od', {
      exerciceId: dn, planId: ctx.plan, compteId: compte(d, '52110000'), date: '2026-06-30', libelle: 'Reclassement',
      lignes: [{ sectionId: S['22'], debit: 200_000 }, { sectionId: S['21'], credit: 200_000 }],
    }, 400);
    await d.geste('OD analytique · fournitures vers missions', 'POST', '/analytique/od', {
      exerciceId: dn, planId: ctx.plan, compteId: compte(d, '60550000'), date: '2026-06-30', libelle: 'Reclassement des fournitures de mission',
      lignes: [{ sectionId: S['22'], debit: 200_000 }, { sectionId: S['21'], credit: 200_000 }],
    });
    // Guide App. 8 · les fonds d'administration sont repris AU FUR ET À MESURE de
    // l'engagement · 3 000 000 + 450 000 + 800 000 + 500 000 + 1 000 000 = 5 750 000.
    const tr = await d.geste('Application B19 · transfert des fonds d’administration', 'POST', '/operations-specifiques/application', {
      codeModele: 'B19-TRANSFERT-ADMINISTRATION', parametres: { chargesEngagees: 5_750_000 }, exerciceId: dn, journalId: d.od.id, date: '2026-12-31',
    });
    R.egal('Transfert B19 · enregistré', true, Boolean(tr?.id));
    await validerJusqua(d, dn, '2026-12-31');
    const b = await balance(d, dn);
    R.montant('Delta 2026 · 162 (fonds d’investissement)', -48_000_000, solde(b, '162'));
    R.montant('Delta 2026 · 462 (12 000 000 − 5 750 000)', -6_250_000, solde(b, '462'));
    R.montant('Delta 2026 · 702 (neutralisation)', -5_750_000, solde(b, '702'));
    R.montant('Delta 2026 · banque (60 000 000 − 5 750 000)', 54_250_000, solde(b, '5211'));
  });

  await etape(R, 'Delta · balance analytique, état budgétaire, contrôle des cumuls', async () => {
    const S = ctx.S ?? {};
    const bal = await d.lire('Balance analytique 2026', `/analytique/etats/balance?planId=${ctx.plan}&exerciceId=${dn}`);
    const BL = (code) => bal?.lignes?.find((l) => l.code === code);
    // Réalisé par feuille · 111 3 000 000 ; 112 400 000 ; 12 450 000 ; 21 800 000
    // + 600 000 au débit et 200 000 au crédit (OD) ; 22 400 000 + 200 000 ; 23 100 000.
    R.montant('Balance analytique · 21 débit', 1_400_000, BL('21')?.debit);
    R.montant('Balance analytique · 21 crédit (OD)', 200_000, BL('21')?.credit);
    R.montant('Balance analytique · 22 débit (ventilation + OD)', 600_000, BL('22')?.debit);
    // Rubriques emboîtées · 11 = 111 + 112 ; 1 = 111 + 112 + 12 ; 2 = 21 + 22 + 23.
    R.montant('Balance analytique · rubrique 11', 3_400_000, BL('11')?.debit);
    R.montant('Balance analytique · rubrique 1 (111 emboîtée dans 11 et 1)', 3_850_000, BL('1')?.debit);
    R.montant('Balance analytique · rubrique 2 (débit)', 2_100_000, BL('2')?.debit);
    // Total général sur les FEUILLES seules · 5 950 000 au débit, 200 000 au crédit.
    R.montant('Balance analytique · total débit (feuilles seules)', 5_950_000, bal?.totaux?.debit);
    R.montant('Balance analytique · total crédit', 200_000, bal?.totaux?.credit);

    const eb = await d.lire('État budgétaire 2026', `/analytique/etats/budgetaire?planId=${ctx.plan}&exerciceId=${dn}`);
    const EL = (code) => eb?.lignes?.find((l) => l.code === code);
    R.montant('État budgétaire · 111 budget', 12_000_000, EL('111')?.budget);
    R.montant('État budgétaire · 21 budget (après la retouche de mars)', 3_250_000, EL('21')?.budget);
    R.montant('État budgétaire · 21 réalisé (1 400 000 − 200 000)', 1_200_000, EL('21')?.realise);
    R.montant('État budgétaire · rubrique 11 · budget 12 000 000 + 2 400 000', 14_400_000, EL('11')?.budget);
    R.montant('État budgétaire · rubrique 1 · budget', 16_200_000, EL('1')?.budget);
    R.montant('État budgétaire · rubrique 1 · réalisé', 3_850_000, EL('1')?.realise);
    R.montant('État budgétaire · rubrique 2 · budget (21 + 22)', 4_450_000, EL('2')?.budget);
    R.montant('État budgétaire · rubrique 2 · réalisé (1 200 000 + 600 000 + 100 000)', 1_900_000, EL('2')?.realise);
    R.egal('État budgétaire · la feuille 23 mouvementée non dotée est hors budget', true, EL('23')?.horsBudget ?? null);
    R.egal('État budgétaire · une rubrique n’est jamais hors budget', false, EL('2')?.horsBudget ?? null);
    // Total général · feuilles seules · budget 12 000 000 + 2 400 000 + 1 800 000
    // + 3 250 000 + 1 200 000 ; réalisé 3 000 000 + 400 000 + 450 000 + 1 200 000
    // + 600 000 + 100 000.
    R.montant('État budgétaire · total budget (feuilles seules)', 20_650_000, eb?.totaux?.budget);
    R.montant('État budgétaire · total réalisé (feuilles seules)', 5_750_000, eb?.totaux?.realise);
    // Mois de mars · budgets mensuels 1 000 000 + 200 000 + 150 000 + 500 000 +
    // 100 000 ; réalisé · salaires et charges sociales du 31 mars.
    const em = await d.lire('État budgétaire de mars 2026', `/analytique/etats/budgetaire?planId=${ctx.plan}&exerciceId=${dn}&mois=3`);
    R.montant('État budgétaire de mars · budget', 1_950_000, em?.totaux?.budget);
    R.montant('État budgétaire de mars · réalisé', 3_450_000, em?.totaux?.realise);
    R.montant('État budgétaire de mars · 21 (mois retouché)', 500_000, em?.lignes?.find((l) => l.code === '21')?.budget);

    const cc = (await d.lire('Contrôle des cumuls', `/analytique/etats/controle-cumuls?exerciceId=${dn}&planId=${ctx.plan}`)) ?? [];
    const c0 = Array.isArray(cc) ? cc.find((x) => x.planId === ctx.plan) : null;
    // Classe 6 au grand livre · 5 750 000 au débit, entièrement ventilés · l'OD
    // ne compte pas ici (équilibrée, elle ne change rien aux cumuls).
    R.montant('Contrôle des cumuls · mouvements généraux (classe 6)', 5_750_000, c0?.mouvementsGenerauxDebit);
    R.montant('Contrôle des cumuls · mouvements analytiques', 5_750_000, c0?.mouvementsAnalytiquesDebit);
    R.montant('Contrôle des cumuls · écart', 0, c0?.ecartDebit);
    R.egal('Contrôle des cumuls · aucune ligne sans répartition', 0, c0?.nombreSansRepartition ?? null);
  });

  await etape(R, 'Delta · clôture 2026, report des budgets, 2027', async () => {
    await cloturer(d, '2026');
    const dn1 = d.exercices.get('2027')?.id;
    if (!dn1) {
      R.note('Delta · 2027 absent · la clôture de 2026 n’a pas abouti');
      return;
    }
    const S = ctx.S ?? {};
    // Exercice clos · ni budget ni OD analytique ne se corrigent plus.
    await refusAttendu(d, R, 'Budget retouché sur l’exercice clos', 'POST', `/analytique/sections/${S['111']}/budget`, { exerciceId: dn, montantAnnuel: 1 }, 400);
    await refusAttendu(d, R, 'OD analytique sur l’exercice clos', 'POST', '/analytique/od', {
      exerciceId: dn, planId: ctx.plan, compteId: compte(d, '60550000'), date: '2026-12-31', libelle: 'Trop tard',
      lignes: [{ sectionId: S['22'], debit: 1 }, { sectionId: S['21'], credit: 1 }],
    }, 400, 'clôturé');
    // Report des budgets sur 2027 · cinq sections dotées × (annuelle + douze
    // mois) = 65 lignes ; la section 23, dont la convention finit le 31/12/2026,
    // est close et ne se reporte pas.
    const rep = await d.geste('Report des budgets 2026 sur 2027', 'POST', `/exercices/${dn}/reporter-budgets`, {});
    R.egal('Report des budgets · 65 lignes reportées', 65, rep?.reportes ?? null);
    R.egal('Report des budgets · une section close (23)', 1, rep?.sectionsCloses ?? null);
    const rep2 = await d.geste('Second report des budgets', 'POST', `/exercices/${dn}/reporter-budgets`, {});
    R.egal('Second report · rien n’est écrasé', 0, rep2?.reportes ?? null);
    await ecriture(d, 'D6 · salaires de février 2027', dn1, '2027-02-28', 'Salaires de février', [['66110000', 1_000_000, 0, { ventilations: [{ sectionId: S['111'], debit: 1_000_000 }] }], ['52110000', 0, 1_000_000]], { journal: dbq });
    const eb = await d.lire('État budgétaire 2027', `/analytique/etats/budgetaire?planId=${ctx.plan}&exerciceId=${dn1}`);
    R.montant('État budgétaire 2027 · budget reporté', 20_650_000, eb?.totaux?.budget);
    R.montant('État budgétaire 2027 · réalisé', 1_000_000, eb?.totaux?.realise);
    R.montant('État budgétaire 2027 · 21 reporté avec la retouche de mars', 3_250_000, eb?.lignes?.find((l) => l.code === '21')?.budget);
    const b = await balance(d, dn1);
    R.montant('Delta 2027 · à-nouveau de la banque moins février', 53_250_000, solde(b, '5211'));
    R.montant('Delta 2027 · à-nouveau du 162', -48_000_000, solde(b, '162'));
    await rechargerExercices(d);
  });
}
