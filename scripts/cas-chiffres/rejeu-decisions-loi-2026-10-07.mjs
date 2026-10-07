#!/usr/bin/env node
/**
 * REJEU DES DÉCISIONS PAR LA LOI DU 2026-10-07 · docs/decisions-par-la-loi-2026-10-07.md.
 *
 * Sur une VRAIE base jetable, par l'API du serveur compilé (CLAUDE.md § 10,
 * « aucune ligne n'est intégrée sans un scénario sur vraie base qui traverse
 * une clôture »). Le point 2 (dissolution) est sorti de cette ligne
 * (`docs/dissolution-a-reprendre.md`) · il n'est pas rejoué ici.
 *  S1 · SA minière du portefeuille · exercice 2025, résultat PROVISOIRE puis
 *       clos (clôture traversée, 2026 ouvert par elle), quote-part ABSENTE
 *       (montant non calculé) puis DÉCLARÉE (montant), dates du dividende hors
 *       ordre refusées puis déclarées, PV au Secrétariat Général du
 *       Portefeuille, fiche R2 (ZK 00, ZQ proposé) ;
 *  S2 · SA sans mandat de commissaire enregistré · procès-verbal de la LPF
 *       art. 13 bis servi « à confirmer » (AUSCGIE art. 694 et 702) ;
 *  S3 · SNC du portefeuille sans commissaire · documents seize jours francs
 *       avant le 31 mars, procès-verbal non présenté et sa raison dite ;
 *  S4 · SARL à associé unique personne morale · procédure collective admise,
 *       liquidation amiable et nomination d'un liquidateur refusées.
 *
 * Ce script ne corrige rien · il relève, et chaque attendu calculé à la main
 * est confronté à ce qu'OmegaX rend (« OK » ou « ÉCART »).
 *
 *   OMEGAX_API=http://localhost:8131 node scripts/cas-chiffres/rejeu-decisions-loi-2026-10-07.mjs [sortie.json]
 */
import { writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';

const BASE = process.env.OMEGAX_API ?? 'http://localhost:8131';
const MOT_DE_PASSE = 'MotDePasse-decisions-2026!';
let compteurAdresse = 1;
const constats = [];

function constater(cas, quoi, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  constats.push({ cas, quoi, attendu, obtenu, ok });
  console.log(`${ok ? 'OK    ' : 'ÉCART '} ${cas} · ${quoi} · attendu ${JSON.stringify(attendu)} · obtenu ${JSON.stringify(obtenu)}`);
}

class Client {
  constructor() {
    const n = (Date.now() + compteurAdresse++ * 7919) % 16_777_216;
    this.adresse = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
    this.cookie = '';
    this.csrf = '';
  }

  entetes(methode, avecCorps) {
    return {
      'X-Forwarded-For': this.adresse,
      ...(avecCorps ? { 'Content-Type': 'application/json' } : {}),
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...(this.csrf && methode !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
    };
  }

  async req(methode, chemin, corps) {
    const r = await fetch(BASE + chemin, {
      method: methode,
      headers: this.entetes(methode, corps !== undefined),
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const kv = c.split(';')[0];
      if (kv.startsWith('__session=')) this.cookie = kv;
    }
    const texte = await r.text();
    let json;
    try {
      json = texte ? JSON.parse(texte) : undefined;
    } catch {
      json = texte;
    }
    if (json && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    return { statut: r.status, corps: json };
  }

  async ok(methode, chemin, corps) {
    const r = await this.req(methode, chemin, corps);
    if (r.statut >= 400) throw new Error(`${methode} ${chemin} · ${r.statut} · ${JSON.stringify(r.corps).slice(0, 600)}`);
    return r.corps;
  }

  /** Un refus attendu · rend son statut et son motif. */
  async refus(methode, chemin, corps) {
    const r = await this.req(methode, chemin, corps);
    return { statut: r.statut, message: r.corps?.message ?? r.corps };
  }

  async classeur(chemin) {
    const r = await fetch(BASE + chemin, { headers: this.entetes('GET', false) });
    if (r.status >= 400) throw new Error(`GET ${chemin} · ${r.status} · ${(await r.text()).slice(0, 400)}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
    return wb;
  }
}

async function dossier(nom, forme, premierExercice) {
  const c = new Client();
  await c.ok('POST', '/auth/register', {
    nomEntite: nom,
    referentiel: 'SYSCOHADA',
    systemeComptableSyscohada: 'NORMAL',
    email: `decisions-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`,
    motDePasse: MOT_DE_PASSE,
    ...(premierExercice ? { dateDebutExercice: premierExercice[0], dateFinExercice: premierExercice[1] } : {}),
  });
  if (forme) await c.ok('PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: forme });
  const comptes = await c.ok('GET', '/comptes?typeCompte=DETAIL');
  c.comptes = new Map(comptes.map((x) => [x.numero, x.id]));
  const journaux = await c.ok('GET', '/journaux');
  c.od = journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL');
  await relireExercices(c);
  return c;
}

async function relireExercices(c) {
  const exercices = await c.ok('GET', '/exercices');
  c.exercices = new Map(exercices.map((e) => [e.dateDebut.slice(0, 10), e]));
  return exercices;
}

async function ecriture(c, exerciceId, date, libelle, lignes) {
  const e = await c.ok('POST', '/ecritures', {
    exerciceId,
    journalId: c.od.id,
    date,
    libelle,
    lignes: lignes.map(([numero, debit, credit]) => {
      const compteId = c.comptes.get(numero);
      if (!compteId) throw new Error(`Compte ${numero} absent du plan semé`);
      return { compteId, libelle, debit, credit };
    }),
  });
  return e.id;
}

async function venteEtCharges(c, exerciceId, date, ca, charges) {
  await ecriture(c, exerciceId, date, "Chiffre d'affaires", [['52110000', ca, 0], ['70110000', 0, ca]]);
  for (const [numero, montant] of charges) {
    await ecriture(c, exerciceId, date, `Charge ${numero}`, [[numero, montant, 0], ['52110000', 0, montant]]);
  }
}

const valider = (c, exerciceId, dateLimite) => c.ok('POST', '/ecritures/valider-jusqua', { exerciceId, dateLimite });
const planning = (c, exerciceId) => c.ok('GET', `/exercices/${exerciceId}/planning-cloture`);
const jalon = (p, debutLibelle) => p.jalons.find((j) => j.libelle.startsWith(debutLibelle));
const jour = (iso) => (iso ? String(iso).slice(0, 10) : null);

/** Solde d'un compte dans la balance (débit moins crédit, toutes colonnes). */
async function soldeBalance(c, exerciceId, numero) {
  const b = await c.ok('GET', `/ecritures/balance?exerciceId=${exerciceId}`);
  const lignes = Array.isArray(b) ? b : (b.lignes ?? b.comptes ?? []);
  const l = lignes.find((x) => x.numero === numero);
  if (!l) return null;
  if (typeof l.solde === 'number') return l.solde;
  const d = (l.reportDebit ?? 0) + (l.mouvementDebit ?? l.debit ?? 0);
  const cr = (l.reportCredit ?? 0) + (l.mouvementCredit ?? l.credit ?? 0);
  return Math.round((d - cr) * 100) / 100;
}

// --- S1 · SA minière du portefeuille -----------------------------------------
async function s1() {
  const cas = 'S1';
  const c = await dossier('Scénario minier SA', 'SOCIETE_ANONYME', ['2025-01-01', '2025-12-31']);
  const n = c.exercices.get('2025-01-01').id;
  await c.ok('PATCH', '/dossier/identite', { entreprisePortefeuilleEtat: 'OUI' });
  // Secteur « pas encore dit » · l'affectation invite à le déclarer.
  let p = await planning(c, n);
  constater(cas, 'secteur minier non déclaré · invitation', true, jalon(p, 'Affectation des résultats')?.detail.includes('SECTEUR MINIER NON DÉCLARÉ'));
  const sansSource = await c.refus('PATCH', '/dossier/identite', { portefeuilleSecteurMinier: 'OUI', quotePartEtatCapital: 60 });
  constater(cas, 'quote-part sans source · refusée', 400, sansSource.statut);
  const sourceSeule = await c.refus('PATCH', '/dossier/identite', { portefeuilleSecteurMinier: 'OUI', sourceQuotePartEtat: 'Statuts' });
  constater(cas, 'source sans quote-part · refusée', 400, sourceSeule.statut);
  await c.ok('PATCH', '/dossier/identite', { portefeuilleSecteurMinier: 'OUI' });

  // Résultat PROVISOIRE (exercice ouvert) · d'abord une perte, puis un bénéfice.
  await ecriture(c, n, '2025-03-31', 'Charge', [['60410000', 5_000_000, 0], ['52110000', 0, 5_000_000]]);
  await valider(c, n, '2025-12-31');
  p = await planning(c, n);
  let d = jalon(p, 'Déclaration du dividende prioritaire');
  constater(cas, 'perte provisoire · montant en attente du résultat', true, d?.montantEnAttente === true && d?.montant === null);
  constater(cas, 'perte provisoire · le 15 mai reste l’échéance', '2026-05-15', jour(d?.echeance));
  constater(cas, 'perte provisoire · passé le 15 mai sans déclaration, en retard', true, d?.enRetard);

  await venteEtCharges(c, n, '2025-06-30', 50_000_000, [['60410000', 25_000_000]]);
  await valider(c, n, '2025-12-31');
  p = await planning(c, n);
  d = jalon(p, 'Déclaration du dividende prioritaire');
  // Bénéfice provisoire 50 000 000 - 5 000 000 - 25 000 000 = 20 000 000 ; quote-part absente.
  constater(cas, 'quote-part absente · montant non calculé (null)', null, d?.montant);
  constater(cas, 'quote-part absente · le détail le dit', true, d?.detail.includes('Montant non calculé'));
  await c.ok('PATCH', '/dossier/identite', { quotePartEtatCapital: 60, sourceQuotePartEtat: 'Statuts, art. 6' });
  p = await planning(c, n);
  d = jalon(p, 'Déclaration du dividende prioritaire');
  constater(cas, 'quote-part déclarée · 20 000 000 × 60 %, provisoire', [12_000_000, true], [d?.montant, d?.montantProvisoire === true]);
  constater(cas, 'le montant est dit comme une lecture, AUSCGIE art. 143 et 144 rappelés', true, d?.detail.includes('lecture de l’arrêté') && d?.detail.includes('dividende fictif (art. 144)'));
  const pv = jalon(p, 'Procès-verbal à l’Administration des recettes non fiscales');
  constater(cas, 'PV · Secrétariat Général du Portefeuille et CA dits', true, pv?.detail.includes('Secrétariat Général du Portefeuille') && pv?.detail.includes('conseil d’administration'));

  // CLÔTURE TRAVERSÉE · le bénéfice se lit avant le solde des comptes de gestion.
  await c.ok('POST', `/exercices/${n}/cloturer`, {});
  await relireExercices(c);
  constater(cas, 'exercice 2026 ouvert par la clôture', 'OUVERT', c.exercices.get('2026-01-01')?.statut);
  p = await planning(c, n);
  d = jalon(p, 'Déclaration du dividende prioritaire');
  constater(cas, 'après la clôture · 12 000 000, plus provisoire', [12_000_000, false], [d?.montant, d?.montantProvisoire === true]);
  // Report à nouveau du 2026 · le 13 de 2025 (20 000 000) y arrive.
  const n1 = c.exercices.get('2026-01-01').id;
  constater(cas, 'report du 52 dans 2026 (50 000 000 - 30 000 000)', 20_000_000, await soldeBalance(c, n1, '52110000'));

  // Dates hors ordre refusées, puis déclarées.
  const noteAvant = await c.refus('POST', `/exercices/${n}/dates-portefeuille`, {
    dateDeclarationDividendeEtat: '2026-05-10',
    dateNotePerceptionDividende: '2026-05-09',
  });
  constater(cas, 'note de perception avant la déclaration · refusée', 400, noteAvant.statut);
  const paiementAvant = await c.refus('POST', `/exercices/${n}/dates-portefeuille`, {
    dateNotePerceptionDividende: '2026-05-20',
    datePaiementDividendeEtat: '2026-05-19',
  });
  constater(cas, 'paiement avant la note · refusé', 400, paiementAvant.statut);
  await c.ok('POST', `/exercices/${n}/dates-portefeuille`, {
    dateDeclarationDividendeEtat: '2026-05-10',
    dateNotePerceptionDividende: '2026-05-20',
    datePaiementDividendeEtat: '2026-05-30',
  });
  p = await planning(c, n);
  d = jalon(p, 'Déclaration du dividende prioritaire');
  const pay = jalon(p, 'Paiement du dividende prioritaire');
  constater(cas, 'déclaration levée', true, d?.observation?.satisfait);
  constater(cas, 'paiement · huit jours de la note du 20 mai', '2026-05-28', jour(pay?.echeance));
  constater(cas, 'paiement tardif · levé et dit hors délai', true, pay?.observation?.horsDelai === true);

  const wb = await c.classeur(`/exports/etats-financiers-syscohada/liasse-complete?exerciceId=${n}`);
  const cases = [];
  wb.getWorksheet('Fiche R2').eachRow((row) => {
    if (['ZK', 'ZQ'].includes(row.getCell(1).value)) cases.push(`${row.getCell(1).value} = ${row.getCell(7).value}`);
  });
  constater(cas, 'fiche R2 · ZK 00 proposé en clair', true, cases[0]?.includes('la NOTE 36 donne 00'));
  constater(cas, 'fiche R2 · ZQ public proposé (60 %)', true, cases[1]?.includes('contrôle public proposé'));
  // SA sans mandat · le procès-verbal fiscal est servi « à confirmer ».
  const ech = await c.ok('GET', `/retenues/echeancier?exerciceId=${n}`);
  constater(cas, 'SA · PV de la LPF art. 13 bis « à confirmer »', true, ech.echeances.some((e) => e.cle === 'procesVerbalAssemblee' && e.echeance.includes('à confirmer')));
  return { fiche: cases, dividende: { declaration: d, paiement: pay } };
}

// --- S2 · SA ordinaire, sans mandat de commissaire enregistré ----------------
async function s2() {
  const cas = 'S2';
  const c = await dossier('Scénario SA sans mandat', 'SOCIETE_ANONYME');
  const n = c.exercices.get('2026-01-01').id;
  const sansMandat = await c.ok('GET', `/retenues/echeancier?exerciceId=${n}`);
  const pv = sansMandat.echeances.find((e) => e.cle === 'procesVerbalAssemblee');
  constater(cas, 'SA sans mandat · PV servi', true, !!pv);
  constater(cas, 'SA sans mandat · « à confirmer · mandat de commissaire non enregistré »', true, pv?.echeance.includes('à confirmer · mandat de commissaire non enregistré'));
  constater(
    cas,
    'SA sans mandat · aucun avertissement d’absence',
    false,
    sansMandat.avertissements.some((a) => a.startsWith('Procès-verbal de l’assemblée à l’Administration des impôts non présenté comme dû')),
  );
  return { pv };
}

// --- S3 · SNC du portefeuille, sans commissaire ------------------------------
async function s3() {
  const cas = 'S3';
  const c = await dossier('Scénario SNC portefeuille', 'SOCIETE_NOM_COLLECTIF');
  const n = c.exercices.get('2026-01-01').id;
  await c.ok('PATCH', '/dossier/identite', { entreprisePortefeuilleEtat: 'OUI' });
  const p = await planning(c, n);
  const documents = p.jalons.find((j) => j.etape === 13);
  constater(cas, 'documents · seize jours francs avant le 31 mars 2027', '2027-03-15', jour(documents?.echeance));
  constater(cas, 'mention de l’autre lecture', true, documents?.detail.includes('un jour plus tard si le délai n’est pas franc'));
  const ech = await c.ok('GET', `/retenues/echeancier?exerciceId=${n}`);
  constater(cas, 'PV LPF art. 13 bis · non présenté sans commissaire', false, ech.echeances.some((e) => e.cle === 'procesVerbalAssemblee'));
  constater(
    cas,
    'PV LPF art. 13 bis · la raison est dite',
    true,
    ech.avertissements.some((a) => a.startsWith('Procès-verbal de l’assemblée à l’Administration des impôts non présenté comme dû')),
  );
  const dividende = await c.refus('POST', `/exercices/${n}/dates-portefeuille`, { dateDeclarationDividendeEtat: '2026-05-10' });
  constater(cas, 'dates du dividende · refusées hors secteur minier', 400, dividende.statut);
  return { documents, echeancier: ech };
}

// --- S4 · associé unique personne morale, procédure collective ---------------
async function s4() {
  const cas = 'S4';
  const c = await dossier('Scénario associé unique PM', 'SOCIETE_RESPONSABILITE_LIMITEE');
  const amiable = await c.refus('PATCH', '/dossier/identite', {
    dateDissolution: '2026-05-31',
    associeUniquePersonneMorale: 'OUI',
    regimeLiquidation: 'AMIABLE_STATUTAIRE',
  });
  constater(cas, 'liquidation amiable refusée (art. 201 al. 4)', 400, amiable.statut);
  await c.ok('PATCH', '/dossier/identite', {
    dateDissolution: '2026-05-31',
    associeUniquePersonneMorale: 'OUI',
    regimeLiquidation: 'PROCEDURE_COLLECTIVE',
  });
  const params = await c.ok('GET', '/dossier/parametres');
  constater(cas, 'procédure collective admise', 'PROCEDURE_COLLECTIVE', params.regimeLiquidation);
  const nomination = await c.refus('PATCH', '/dossier/identite', { dateNominationLiquidateur: '2026-06-01' });
  constater(cas, 'nomination d’un liquidateur refusée', 400, nomination.statut);
  return { regime: params.regimeLiquidation };
}

const sortie = {};
for (const [nom, fn] of [['S1', s1], ['S2', s2], ['S3', s3], ['S4', s4]]) {
  try {
    sortie[nom] = await fn();
  } catch (e) {
    console.log(`ÉCHEC ${nom} · ${e.message}`);
    sortie[nom] = { echec: e.message };
    constats.push({ cas: nom, quoi: 'exécution', ok: false, obtenu: e.message });
  }
}
sortie.constats = constats;
const ecarts = constats.filter((x) => !x.ok).length;
console.log(`\n${constats.length} constats, ${ecarts} écart(s).`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(sortie, null, 2));
process.exit(ecarts === 0 ? 0 : 1);
