#!/usr/bin/env node
/**
 * REJEU DE LA LIGNE « DÉCISIONS PAR LA LOI DU 2026-10-07, SECOND LOT » sur une
 * VRAIE base, par l'API du serveur compilé, à travers une clôture (CLAUDE.md,
 * § 10 · aucune ligne n'est intégrée sans ce scénario).
 *
 * Cas joués · (A) groupe de deux factures de composition différente (biens et
 * prestation), réglé en deux fois, la prestation échue, liquidations entre les
 * paiements, clôture de 2026 ; (B) le même, imputation DÉCLARÉE par le client
 * (Code civil, Livre III, art. 151) puis retirée ; (C) le même à cheval de la
 * clôture, observé ; (D) impayé d'adhérent sous l'encaissement (SYCEBNL, D7),
 * à travers la clôture ; (E) règlement fournisseur aux parts déclarées. Le C09
 * se rejoue par `rejeu-is.mjs`. PREMIÈRE RELECTURE (2026-10-07) · (F) B1, factures
 * de N impayées payées en N+1 par un groupe de leurs à-nouveaux ; (G) B2,
 * imputation déclarée en N+1 sur un groupe prolongé ; (H) M1, inscription en
 * négatif dans un groupe ; (B) pièce postérieure au paiement refusée ; (D) M8,
 * créance née sous l'APPEL, dossier passé à l'encaissement ; (I) M9, créance
 * reclassée dans un exercice clos, corrigée par le résultat. SECOND TOUR
 * (2026-10-07) · (J) B-1, le report d'un paiement de N lettré en N+1 avec le
 * report de sa facture n'est jamais compté deux fois, la porte refuse une
 * déclaration posée sur lui (art. 151) et sur un paiement d'un exercice
 * clôturé (M-a) ; (Gbis) B-1, les trois reports lettrés avec le paiement de
 * N+1 ; (K) B-2, la porte admet l'imputation que le moteur admet ; (M) M-b,
 * un groupe qui porte un avoir · la porte refuse, la fenêtre le dit.
 *
 * Chaque montant attendu est calculé à la main dans son commentaire. Ce script
 * NE CORRIGE RIEN · il relève, et dit ATTENDU contre OBTENU.
 *
 * Usage (serveur compilé démarré contre une base JETABLE, INSCRIPTION_PUBLIQUE=true) :
 *   OMEGAX_API=http://localhost:8133 node scripts/cas-chiffres/rejeu-decisions-loi-3.mjs [sortie.json]
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.OMEGAX_API ?? 'http://localhost:8133';
const MOT_DE_PASSE = 'MotDePasse-decisions-3-2026!';
let compteurAdresse = 1;
const releves = [];
let ecarts = 0;

class Client {
  constructor() {
    const n = (Date.now() + compteurAdresse++ * 7919) % 16_777_216;
    this.adresse = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
    this.cookie = '';
    this.csrf = '';
  }

  async req(methode, chemin, corps) {
    const r = await fetch(BASE + chemin, {
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
    if (r.statut >= 400) throw new Error(`${methode} ${chemin} · ${r.statut} · ${JSON.stringify(r.corps).slice(0, 800)}`);
    return r.corps;
  }
}

function relever(cas, quoi, attendu, obtenu) {
  const egal = typeof attendu === 'number' ? Math.abs(attendu - Number(obtenu)) < 0.005 : JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!egal) ecarts++;
  releves.push({ cas, quoi, attendu, obtenu, egal });
  console.log(`${egal ? 'OK   ' : 'ÉCART'} [${cas}] ${quoi} · attendu ${JSON.stringify(attendu)} · obtenu ${JSON.stringify(obtenu)}`);
}

async function dossier(nom, referentiel) {
  const c = new Client();
  await c.ok('POST', '/auth/register', {
    nomEntite: nom,
    referentiel,
    ...(referentiel === 'SYSCOHADA' ? { systemeComptableSyscohada: 'NORMAL' } : { jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }),
    email: `decisions3-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`,
    motDePasse: MOT_DE_PASSE,
    dateDebutExercice: '2026-01-01',
    dateFinExercice: '2026-12-31',
  });
  const comptes = await c.ok('GET', '/comptes?typeCompte=DETAIL');
  c.comptes = new Map(comptes.map((x) => [x.numero, x]));
  const journaux = await c.ok('GET', '/journaux');
  c.od = journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL');
  c.bq = journaux.find((j) => j.type === 'TRESORERIE' && j.compteTresorerieId) ?? c.od;
  const exercices = await c.ok('GET', '/exercices');
  c.ex26 = exercices.find((e) => e.dateDebut.startsWith('2026')).id;
  const e27 = await c.ok('POST', '/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
  c.ex27 = e27.id;
  return c;
}

const compte = (c, numero) => {
  const x = c.comptes.get(numero);
  if (!x) throw new Error(`Compte ${numero} absent du plan semé`);
  return x;
};

/** Une écriture · lignes [numéro, débit, crédit, options]. Rend les identifiants des lignes, dans l'ordre donné. */
async function ecriture(c, exerciceId, journal, date, libelle, lignes) {
  const e = await c.ok('POST', '/ecritures', {
    exerciceId,
    journalId: journal.id,
    date,
    libelle,
    lignes: lignes.map(([numero, debit, credit, o = {}]) => ({ compteId: compte(c, numero).id, libelle: o.libelle ?? libelle, debit, credit, ...o.extra })),
  });
  // Retrouvée par (compte, débit, crédit) · la lecture ne garantit pas l'ordre.
  return lignes.map(([numero, debit, credit]) => e.lignes.find((l) => l.compteId === compte(c, numero).id && Number(l.debit) === debit && Number(l.credit) === credit).id);
}

const valider = (c, exerciceId, dateLimite) => c.ok('POST', '/ecritures/valider-jusqua', { exerciceId, dateLimite });
const declaration = (c, debut, fin) => c.ok('GET', `/taux-tva/declaration?dateDebut=${debut}&dateFin=${fin}`);
const liquider = (c, exerciceId, debut, fin) => c.ok('POST', '/taux-tva/declaration/comptabiliser', { exerciceId, dateDebut: debut, dateFin: fin });

/** Le compte client rendu lettrable s'il ne l'est pas (le semis le laisse au choix de la nature). */
async function lettrable(c, numero) {
  const x = compte(c, numero);
  if (x.lettrable) return;
  await c.ok('PATCH', `/comptes/${x.id}`, { lettrable: true });
}

/**
 * Les deux factures · G, vente de BIENS du 5 janvier (500 000 HT, TVA 80 000,
 * exigible à la livraison), échéance au 31 mars ; S, PRESTATION du 10 janvier
 * (1 000 000 HT, TVA 160 000, exigible à l'encaissement), échéance au
 * 31 janvier. Rend les lignes au client.
 */
async function deuxFactures(c, exerciceId, dates = { g: '2026-01-05', s: '2026-01-10', echeanceG: '2026-03-31', echeanceS: '2026-01-31' }) {
  const taux = (await c.ok('GET', '/taux-tva')).find((t) => Number(t.taux) === 16);
  const tva = [...c.comptes.values()].find((x) => x.id === taux.compteCollecteId).numero;
  await lettrable(c, '41110000');
  const [g] = await ecriture(c, exerciceId, c.od, dates.g, 'Facture G (biens)', [
    ['41110000', 580_000, 0, { extra: { dateEcheance: dates.echeanceG } }],
    ['70110000', 0, 500_000],
    [tva, 0, 80_000, { extra: { tauxTvaId: taux.id } }],
  ]);
  const [s] = await ecriture(c, exerciceId, c.od, dates.s, 'Facture S (prestation)', [
    ['41110000', 1_160_000, 0, { extra: { dateEcheance: dates.echeanceS } }],
    ['70610000', 0, 1_000_000],
    [tva, 0, 160_000, { extra: { tauxTvaId: taux.id } }],
  ]);
  return { g, s };
}

async function paiement(c, exerciceId, date, montant) {
  const [ligne] = await ecriture(c, exerciceId, c.bq, date, `Paiement client ${date}`, [
    ['41110000', 0, montant],
    ['52110000', montant, 0],
  ]);
  return ligne;
}

async function groupeDe(c, ligneId) {
  const lignes = await c.ok('GET', `/comptes/${compte(c, '41110000').id}/lettrage`);
  const liste = Array.isArray(lignes) ? lignes : lignes.lignes ?? [];
  return liste.find((l) => l.id === ligneId)?.lettrageId ?? null;
}

/**
 * CAS A · imputation LÉGALE (art. 154), à travers la clôture.
 * P1, 1 000 000 le 15 février · S est ÉCHUE (31 janvier), G ne l'est pas
 * (31 mars) · S d'abord, bien que G soit plus ancienne · S reçoit 1 000 000 ·
 * TVA de février = 1 000 000 × 160 000 / 1 160 000 = 137 931,03 (la règle de
 * `main`, fraction cumulée, rendait (1 160 000 - 740 000) / 1 160 000 ×
 * 160 000 = 57 931,03). P2, 740 000 le 15 mars · S reçoit son reste,
 * 160 000 · TVA de mars = 160 000 × 160 000 / 1 160 000 = 22 068,97 ; G, 580 000,
 * n'ajoute rien (biens, déclarés en janvier). Total S = 160 000.
 */
async function casA() {
  const c = await dossier('Cas A imputation légale', 'SYSCOHADA');
  const { g, s } = await deuxFactures(c, c.ex26);
  await valider(c, c.ex26, '2026-01-31');
  const jan = await declaration(c, '2026-01-01', '2026-01-31');
  relever('A', 'janvier · TVA collectée (G, biens, à la livraison)', 80_000, jan.totalCollecte);
  await liquider(c, c.ex26, '2026-01-01', '2026-01-31');
  const p1 = await paiement(c, c.ex26, '2026-02-15', 1_000_000);
  await valider(c, c.ex26, '2026-02-28');
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [g, s, p1], autoriserPartiel: true });
  const fev = await declaration(c, '2026-02-01', '2026-02-28');
  relever('A', 'février · TVA de S imputée (art. 154, l’échue d’abord)', 137_931.03, fev.totalCollecte);
  relever('A', 'février · fondement de l’imputation', 'LEGALE', fev.imputationsDesPaiements?.[0]?.fondement);
  relever('A', 'février · aucun groupe lu en bloc', 0, (fev.groupesImputationIndeterminee ?? []).length);
  await liquider(c, c.ex26, '2026-02-01', '2026-02-28');
  const p2 = await paiement(c, c.ex26, '2026-03-15', 740_000);
  await valider(c, c.ex26, '2026-03-31');
  const groupe = await groupeDe(c, p1);
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage/${groupe}/completer`, { ligneIds: [p2] });
  const mars = await declaration(c, '2026-03-01', '2026-03-31');
  relever('A', 'mars · reste de S (160 000 encaissés)', 22_068.97, mars.totalCollecte);
  await liquider(c, c.ex26, '2026-03-01', '2026-03-31');
  // CLÔTURE · tout validé, puis clôture annuelle de 2026.
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('A', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const fevApres = await declaration(c, '2026-02-01', '2026-02-28');
  relever('A', 'février relu après la clôture · inchangé', 137_931.03, fevApres.totalCollecte);
  const marsApres = await declaration(c, '2026-03-01', '2026-03-31');
  relever('A', 'mars relu après la clôture · inchangé', 22_068.97, marsApres.totalCollecte);
  const jan27 = await declaration(c, '2027-01-01', '2027-01-31');
  relever('A', 'janvier 2027 · rien de plus', 0, jan27.totalCollecte);
}

/**
 * CAS B · imputation DÉCLARÉE par le client (art. 151), puis retirée.
 * P1 déclaré · 580 000 sur G, 420 000 sur S · TVA de février = 420 000 ×
 * 160 000 / 1 160 000 = 57 931,03. Retirée, l'art. 154 revient · 137 931,03.
 */
async function casB() {
  const c = await dossier('Cas B imputation déclarée', 'SYSCOHADA');
  const { g, s } = await deuxFactures(c, c.ex26);
  const p1 = await paiement(c, c.ex26, '2026-02-15', 1_000_000);
  // Avant le lettrage · refus nommé (« Lettrez-les d'abord »).
  await valider(c, c.ex26, '2026-02-28');
  const avant = await c.req('POST', '/imputations-paiements', {
    ligneReglementId: p1,
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'OV 2026-007',
    factures: [{ ligneFactureId: g, montant: 580_000 }, { ligneFactureId: s, montant: 420_000 }],
  });
  relever('B', 'déclaration sur un paiement non lettré · refus nommé', 400, avant.statut);
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [g, s, p1], autoriserPartiel: true });
  // M3 · « lorsqu'il paye » (art. 151) · une pièce du 20 février pour un paiement du 15 est refusée.
  const posterieure = await c.req('POST', '/imputations-paiements', {
    ligneReglementId: p1,
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'Lettre du 20 février',
    pieceDate: '2026-02-20',
    factures: [{ ligneFactureId: g, montant: 580_000 }, { ligneFactureId: s, montant: 420_000 }],
  });
  relever('B', 'pièce postérieure au paiement · refusée', 400, posterieure.statut);
  await c.ok('POST', '/imputations-paiements', {
    ligneReglementId: p1,
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'OV 2026-007',
    pieceDate: '2026-02-15',
    factures: [{ ligneFactureId: g, montant: 580_000 }, { ligneFactureId: s, montant: 420_000 }],
  });
  const fev = await declaration(c, '2026-02-01', '2026-02-28');
  relever('B', 'février · imputation déclarée (420 000 sur S)', 57_931.03, fev.totalCollecte);
  relever('B', 'février · fondement', 'DECLAREE', fev.imputationsDesPaiements?.[0]?.fondement);
  const groupe = await c.ok('GET', `/imputations-paiements/groupe/${p1}`);
  relever('B', 'groupe lu · part déclarée sur S', 420_000, groupe.factures.find((f) => f.id === s)?.imputations?.[0]?.montant);
  const audit = await c.ok('GET', '/journal-audit?entite=ImputationPaiement');
  relever('B', 'journal d’audit · deux parts déclarées, deux événements', 2, audit.total);
  await c.ok('POST', `/imputations-paiements/${p1}/retirer`, { motif: 'Ordre de virement relu · aucune facture citée' });
  const audit2 = await c.ok('GET', '/journal-audit?entite=ImputationPaiement');
  relever('B', 'journal d’audit · le retrait ajoute un événement par part', 4, audit2.total);
  const fev2 = await declaration(c, '2026-02-01', '2026-02-28');
  relever('B', 'février · déclaration retirée, l’art. 154 revient', 137_931.03, fev2.totalCollecte);
}

/**
 * CAS C · le même groupe À CHEVAL de la clôture. Factures de décembre 2026 (G
 * le 5, échéance 31 mars 2027 ; S le 10, échéance 31 décembre), P1 de
 * 1 000 000 le 20 décembre, décembre liquidé, clôture, P2 de 740 000 le
 * 15 janvier 2027 lettré avec les à-nouveaux. Le 20 décembre, AUCUNE des deux
 * n'est échue · la plus ancienne, G, est payée d'abord (580 000), S reçoit
 * 420 000 · décembre = 80 000 (G, biens, à la livraison) + 420 000 × 160 000 /
 * 1 160 000 = 57 931,03, soit 137 931,03. Le 15 janvier 2027, P2 paie le reste
 * de S, 740 000 · 740 000 × 160 000 / 1 160 000 = 102 068,97. Total S =
 * 57 931,03 + 102 068,97 = 160 000. (La première écriture de ce cas attendait
 * S échue au 20 décembre · erreur du calcul à la main, relevée au rejeu.)
 */
async function casC() {
  const c = await dossier('Cas C à cheval', 'SYSCOHADA');
  const { g, s } = await deuxFactures(c, c.ex26, { g: '2026-12-05', s: '2026-12-10', echeanceG: '2027-03-31', echeanceS: '2026-12-31' });
  const p1 = await paiement(c, c.ex26, '2026-12-20', 1_000_000);
  await valider(c, c.ex26, '2026-12-31');
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [g, s, p1], autoriserPartiel: true });
  const dec = await declaration(c, '2026-12-01', '2026-12-31');
  relever('C', 'décembre 2026 · G 80 000 à la livraison + S imputée 57 931,03', 137_931.03, dec.totalCollecte);
  await liquider(c, c.ex26, '2026-12-01', '2026-12-31');
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('C', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const p2 = await paiement(c, c.ex27, '2027-01-15', 740_000);
  await valider(c, c.ex27, '2027-01-31');
  const lignes = await c.ok('GET', `/comptes/${compte(c, '41110000').id}/lettrage?nonLettreesSeulement=true`);
  const liste = (Array.isArray(lignes) ? lignes : lignes.lignes ?? []).filter((l) => l.exerciceId === c.ex27 || (l.date ?? '').startsWith('2027'));
  const debit = liste.filter((l) => Number(l.debit) > 0).map((l) => l.id);
  const lettre = await c.req('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [...debit, p2], autoriserPartiel: true });
  relever('C', 'lettrage de P2 avec les à-nouveaux de 2027', 'posé', lettre.statut < 400 ? 'posé' : `refusé ${lettre.statut} ${JSON.stringify(lettre.corps).slice(0, 300)}`);
  const jan = await declaration(c, '2027-01-01', '2027-01-31');
  relever('C', 'janvier 2027 · reste de S (740 000 encaissés)', 102_068.97, jan.totalCollecte);
  relever('C', 'janvier 2027 · aucun groupe lu en bloc', 0, (jan.groupesImputationIndeterminee ?? []).length);
}

/**
 * CAS D · D7 et M8 (SYCEBNL) · sous l'APPEL, un chèque impayé de 100 000
 * (4131) est reclassé au 4161 · c'est une créance (§ 5.4.2.1). Le dossier
 * passe ensuite à l'ENCAISSEMENT · la méthode qui juge est celle du JOUR DU
 * RECLASSEMENT (figée au geste) · la perte au 6512 PASSE et le contrôle se
 * TAIT, en 2026 et en 2027 après la clôture ; un nouveau reclassement d'un
 * 4131 est refusé (méthode d'aujourd'hui). Avant la relecture, la perte était
 * refusée et le contrôle signalait une créance qui existait.
 */
async function casD() {
  const c = await dossier('Cas D impayé adhérent', 'SYCEBNL');
  await c.ok('PATCH', '/dossier/methode-cotisations', { methodeCotisations: 'APPEL' });
  const [impaye] = await ecriture(c, c.ex26, c.od, '2026-02-01', 'Chèque impayé adhérent', [
    ['41310000', 100_000, 0],
    ['52110000', 0, 100_000],
  ]);
  const [autre] = await ecriture(c, c.ex26, c.od, '2026-02-02', 'Second chèque impayé', [
    ['41310000', 50_000, 0],
    ['52110000', 0, 50_000],
  ]);
  void impaye;
  void autre;
  await valider(c, c.ex26, '2026-02-28');
  const reclasse = await c.ok('POST', '/creances-douteuses', {
    exerciceId: c.ex26,
    journalId: c.od.id,
    date: '2026-03-01',
    compteCreanceId: compte(c, '41310000').id,
    nature: 'DOUTEUSE',
    montant: 100_000,
    motif: 'Chèque revenu impayé, adhérent injoignable',
    pieces: [{ nature: 'Avis de la banque', reference: 'AV-2026-031' }],
  });
  await c.ok('PATCH', '/dossier/methode-cotisations', { methodeCotisations: 'ENCAISSEMENT' });
  const perte = await c.req('POST', `/creances-douteuses/${reclasse.id}/perte`, {
    exerciceId: c.ex26,
    journalId: c.od.id,
    date: '2026-06-30',
    montant: 100_000,
    motif: 'Irrécouvrable',
    pieces: [{ nature: 'Procès-verbal', reference: 'PV-1' }],
  });
  relever('D', 'M8 · perte au 6512 d’une créance née sous l’APPEL · admise malgré l’encaissement d’aujourd’hui', 'admise', perte.statut < 400 ? 'admise' : `refusée ${perte.statut}`);
  const second = await c.req('POST', '/creances-douteuses', {
    exerciceId: c.ex26,
    journalId: c.od.id,
    date: '2026-03-02',
    compteCreanceId: compte(c, '41310000').id,
    nature: 'DOUTEUSE',
    montant: 50_000,
    motif: 'Second impayé',
    pieces: [{ nature: 'Avis de la banque', reference: 'AV-2026-032' }],
  });
  relever('D', 'reclassement d’un 4131 sous l’encaissement · refusé', 400, second.statut);
  const ctl26 = await c.ok('GET', `/controles?exerciceId=${c.ex26}`);
  const trouve = (r) => (r.anomalies ?? []).find((x) => x.code === 'CREANCE_ADHERENT_RECLASSEE_SOUS_ENCAISSEMENT');
  relever('D', 'M8 · 2026 · la créance née sous l’APPEL n’est pas signalée', null, trouve(ctl26)?.gravite ?? null);
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('D', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const ctl27 = await c.ok('GET', `/controles?exerciceId=${c.ex27}`);
  relever('D', 'M8 · 2027 · toujours rien de signalé', null, trouve(ctl27)?.gravite ?? null);
}

/** Les deux factures de décembre 2026 de la relecture · S, prestation taxée ; X, sans taxe. */
async function prestationEtSansTaxe(c, dates) {
  const taux = (await c.ok('GET', '/taux-tva')).find((t) => Number(t.taux) === 16);
  const tva = [...c.comptes.values()].find((x) => x.id === taux.compteCollecteId).numero;
  await lettrable(c, '41110000');
  const [s] = await ecriture(c, c.ex26, c.od, dates.s, 'Facture S (prestation)', [
    ['41110000', 1_160_000, 0],
    ['70610000', 0, 1_000_000],
    [tva, 0, 160_000, { extra: { tauxTvaId: taux.id } }],
  ]);
  const [x] = await ecriture(c, c.ex26, c.od, dates.x, 'Facture X (sans taxe)', [
    ['41110000', 1_000_000, 0],
    ['70110000', 0, 1_000_000],
  ]);
  return { s, x };
}

/** Les lignes d'à-nouveau de 2027 au débit du 41110000 · rendues avec leur montant. */
async function aNouveauxDebiteurs2027(c) {
  const lignes = await c.ok('GET', `/comptes/${compte(c, '41110000').id}/lettrage?nonLettreesSeulement=true`);
  return (Array.isArray(lignes) ? lignes : lignes.lignes ?? []).filter((l) => (l.date ?? '').startsWith('2027') && Number(l.debit) > 0);
}

/**
 * CAS F · B1 · S (prestation, 1 160 000 TTC, taxe 160 000) le 5 décembre 2026,
 * X (sans taxe, 1 000 000) le 10 décembre, AUCUN paiement en 2026, clôture.
 * P de 1 160 000 le 15 janvier 2027, lettré avec les deux à-nouveaux. Art. 154 ·
 * les deux sont échues (sans échéance, dès leur facture), la plus ancienne par
 * la date de la FACTURE (S, 5 décembre, et non le 1er janvier de l'à-nouveau)
 * reçoit tout · janvier 2027 = 1 160 000 × 160 000 / 1 160 000 = 160 000. Avant
 * la relecture · 22 068,97 (le groupe reconstruit sans identité, fraction de
 * `main`, en silence).
 */
async function casF() {
  const c = await dossier('Cas F B1 sans paiement en N', 'SYSCOHADA');
  await prestationEtSansTaxe(c, { s: '2026-12-05', x: '2026-12-10' });
  await valider(c, c.ex26, '2026-12-31');
  const dec = await declaration(c, '2026-12-01', '2026-12-31');
  relever('F', 'décembre 2026 · S impayée, rien d’exigible', 0, dec.totalCollecte);
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('F', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const p = await paiement(c, c.ex27, '2027-01-15', 1_160_000);
  await valider(c, c.ex27, '2027-01-31');
  const reports = await aNouveauxDebiteurs2027(c);
  relever('F', 'deux à-nouveaux débiteurs en 2027', 2, reports.length);
  const lettre = await c.req('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [...reports.map((l) => l.id), p], autoriserPartiel: true });
  relever('F', 'lettrage de P avec les deux à-nouveaux', 'posé', lettre.statut < 400 ? 'posé' : `refusé ${lettre.statut} ${JSON.stringify(lettre.corps).slice(0, 300)}`);
  const jan = await declaration(c, '2027-01-01', '2027-01-31');
  relever('F', 'janvier 2027 · S, la plus ancienne par la date de la facture, reçoit tout', 160_000, jan.totalCollecte);
  relever('F', 'janvier 2027 · aucun groupe lu en bloc', 0, (jan.groupesImputationIndeterminee ?? []).length);
}

/**
 * CAS G · B2 · F1 (prestation, 1 160 000, taxe 160 000) le 10 décembre 2026, X
 * (sans taxe, 1 000 000) le 12 décembre ; R1 de 500 000 le 20 décembre,
 * lettré avec F1 et X (partiel). Art. 154 · F1, la plus ancienne, reçoit
 * 500 000 · décembre = 500 000 × 160 000 / 1 160 000 = 68 965,52. Clôture.
 * R2 de 1 000 000 le 15 janvier 2027, lettré avec les deux à-nouveaux, que le
 * client DÉCLARE payer X (art. 151, sur le report de X, seule ligne que la
 * route admet) · janvier 2027 = 0. Avant la relecture · 91 034,48 (la part
 * déclarée tombait en « non retenue »).
 */
async function casG() {
  const c = await dossier('Cas G B2 déclaration en N+1', 'SYSCOHADA');
  const { s: f1, x } = await prestationEtSansTaxe(c, { s: '2026-12-10', x: '2026-12-12' });
  const r1 = await paiement(c, c.ex26, '2026-12-20', 500_000);
  await valider(c, c.ex26, '2026-12-31');
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [f1, x, r1], autoriserPartiel: true });
  const dec = await declaration(c, '2026-12-01', '2026-12-31');
  relever('G', 'décembre 2026 · R1 paie F1, la plus ancienne', 68_965.52, dec.totalCollecte);
  await liquider(c, c.ex26, '2026-12-01', '2026-12-31');
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('G', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const r2 = await paiement(c, c.ex27, '2027-01-15', 1_000_000);
  await valider(c, c.ex27, '2027-01-31');
  const reports = await aNouveauxDebiteurs2027(c);
  const lettre = await c.req('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [...reports.map((l) => l.id), r2], autoriserPartiel: true });
  relever('G', 'lettrage de R2 avec les à-nouveaux', 'posé', lettre.statut < 400 ? 'posé' : `refusé ${lettre.statut} ${JSON.stringify(lettre.corps).slice(0, 300)}`);
  const groupe = await c.ok('GET', `/imputations-paiements/groupe/${r2}`);
  const factureX = groupe.factures.find((f) => Number(f.montant) === 1_000_000);
  relever('G', 'groupe servi · X se désigne par son report', true, !!factureX?.ligneADesigner && factureX.reportee === true);
  await c.ok('POST', '/imputations-paiements', {
    ligneReglementId: r2,
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'Lettre du client, paiement de X',
    pieceDate: '2027-01-15',
    factures: [{ ligneFactureId: factureX.ligneADesigner, montant: 1_000_000 }],
  });
  const jan = await declaration(c, '2027-01-01', '2027-01-31');
  relever('G', 'janvier 2027 · R2 déclaré sur X · rien d’exigible', 0, jan.totalCollecte);
  const nonRetenu = (jan.imputationsDesPaiements ?? []).reduce((t, g) => t + Number(g.declareNonRetenu ?? 0), 0);
  relever('G', 'janvier 2027 · aucune part déclarée non retenue', 0, nonRetenu);
}

/**
 * CAS H · M1 · G (biens, 580 000, échue au 31 mars) et S (prestation,
 * 1 160 000, échue au 31 janvier) en janvier 2026. P1 de 500 000 le
 * 15 février, ERRONÉ, corrigé par inscription en négatif le 10 mars (AUDCIF
 * art. 20, al. 2) ; P2 de 500 000 le 15 mars. Le groupe réunit G, S, P1, son
 * négatif et P2. Le négatif s'annule avec P1 · février = 0 ; mars · P2 paie
 * S, seule échue au 15 mars, d'abord · 500 000 × 160 000 / 1 160 000 =
 * 68 965,52. Avant la relecture, le négatif était lu comme une facture et la
 * taxe se datait en février. (Au premier rejeu, P2 au 20 avril · G était
 * alors échue elle aussi, la plus ancienne payée d'abord, 0 en avril · le
 * moteur avait raison, le calcul à la main non.)
 */
async function casH() {
  const c = await dossier('Cas H inscription en négatif', 'SYSCOHADA');
  const { g, s } = await deuxFactures(c, c.ex26);
  const e1 = await c.ok('POST', '/ecritures', {
    exerciceId: c.ex26,
    journalId: c.bq.id,
    date: '2026-02-15',
    libelle: 'Paiement P1 erroné',
    lignes: [
      { compteId: compte(c, '41110000').id, libelle: 'P1', debit: 0, credit: 500_000 },
      { compteId: compte(c, '52110000').id, libelle: 'P1', debit: 500_000, credit: 0 },
    ],
  });
  const p1 = e1.lignes.find((l) => l.compteId === compte(c, '41110000').id).id;
  await valider(c, c.ex26, '2026-02-28');
  await c.ok('POST', `/ecritures/${e1.id}/correction`, { date: '2026-03-10', motifCorrection: 'Paiement saisi sur le mauvais client' });
  const p2 = await paiement(c, c.ex26, '2026-03-15', 500_000);
  await valider(c, c.ex26, '2026-03-31');
  const lignes = await c.ok('GET', `/comptes/${compte(c, '41110000').id}/lettrage`);
  const negatif = (Array.isArray(lignes) ? lignes : lignes.lignes ?? []).find((l) => Number(l.credit) === -500_000 || Number(l.debit) === -500_000);
  relever('H', 'l’inscription en négatif est au 41110000', true, !!negatif);
  const lettre = await c.req('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [g, s, p1, negatif?.id, p2].filter(Boolean), autoriserPartiel: true });
  relever('H', 'lettrage du groupe avec le négatif', 'posé', lettre.statut < 400 ? 'posé' : `refusé ${lettre.statut} ${JSON.stringify(lettre.corps).slice(0, 300)}`);
  const fev = await declaration(c, '2026-02-01', '2026-02-28');
  relever('H', 'février · le paiement annulé ne rend rien exigible', 0, fev.totalCollecte);
  const avr = await declaration(c, '2026-03-01', '2026-03-31');
  relever('H', 'mars · P2 paie S, seule échue, d’abord', 68_965.52, avr.totalCollecte);
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('H', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const avrApres = await declaration(c, '2026-03-01', '2026-03-31');
  relever('H', 'mars relu après la clôture · inchangé', 68_965.52, avrApres.totalCollecte);
}

/**
 * CAS I · M9 (SYCEBNL) · aucune méthode des cotisations déclarée · un chèque
 * d'adhérent de 120 000 (4131) revient impayé le 1er février 2026 et se
 * reclasse au 4161 le 1er mars (admis, avec avertissement) ; la revue de 2026
 * le déprécie de 30 000 (D 6594 / C 4912). Le dossier déclare ensuite
 * l'ENCAISSEMENT · le contrôle signale la créance (aucune méthode au
 * reclassement). Clôture de 2026. En 2027, le cabinet passe et valide la
 * correction par le résultat (cadre conceptuel § 3.3.1.2.4) · C 4161 120 000,
 * D 4912 30 000, D 701 90 000 (le produit constaté à tort à la remise, compte
 * choisi par le cabinet). Une correction au mauvais montant est refusée ; la
 * bonne est désignée · la créance sort du module · contrôle muet en 2027,
 * rapprochement nul (416 et 491 soldés au livre-journal et au module), perte
 * refusée, clôture de 2027 acceptée.
 */
async function casI() {
  const c = await dossier('Cas I correction par le résultat', 'SYCEBNL');
  await ecriture(c, c.ex26, c.od, '2026-02-01', 'Chèque impayé adhérent', [
    ['41310000', 120_000, 0],
    ['52110000', 0, 120_000],
  ]);
  await valider(c, c.ex26, '2026-02-28');
  const creance = await c.ok('POST', '/creances-douteuses', {
    exerciceId: c.ex26,
    journalId: c.od.id,
    date: '2026-03-01',
    compteCreanceId: compte(c, '41310000').id,
    nature: 'DOUTEUSE',
    montant: 120_000,
    motif: 'Chèque revenu impayé, adhérent injoignable',
    pieces: [{ nature: 'Avis de la banque', reference: 'AV-2026-041' }],
  });
  await c.ok('POST', `/creances-douteuses/${creance.id}/revue`, {
    exerciceId: c.ex26,
    journalId: c.od.id,
    depreciationNecessaire: 30_000,
    motif: 'Relance sans réponse',
    pieces: [{ nature: 'Lettre de relance', reference: 'R-12' }],
  });
  await c.ok('PATCH', '/dossier/methode-cotisations', { methodeCotisations: 'ENCAISSEMENT' });
  const trouve = (r) => (r.anomalies ?? []).find((x) => x.code === 'CREANCE_ADHERENT_RECLASSEE_SOUS_ENCAISSEMENT');
  const ctl26 = await c.ok('GET', `/controles?exerciceId=${c.ex26}`);
  relever('I', '2026 · créance sans méthode au reclassement, dossier à l’encaissement · signalée', 'INFORMATION', trouve(ctl26)?.gravite);
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('I', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const liste = await c.ok('GET', `/creances-douteuses?exerciceId=${c.ex27}`);
  const cd = liste.creances.find((x) => x.id === creance.id);
  relever('I', '2027 · « Corriger par le résultat » offert', true, cd?.correctionOfferte);
  const n491 = cd.compte491.numero;
  const n416 = cd.compte416.numero;
  const produit = [...c.comptes.values()].find((x) => x.numero.startsWith('701'))?.numero;
  const faux = await c.ok('POST', '/ecritures', {
    exerciceId: c.ex27,
    journalId: c.od.id,
    date: '2027-03-30',
    libelle: 'Correction erronée',
    lignes: [
      { compteId: compte(c, n416).id, libelle: 'x', debit: 0, credit: 100_000 },
      { compteId: compte(c, produit).id, libelle: 'x', debit: 100_000, credit: 0 },
    ],
  });
  const juste = await c.ok('POST', '/ecritures', {
    exerciceId: c.ex27,
    journalId: c.od.id,
    date: '2027-03-31',
    libelle: 'Correction de l’impayé de 2026 par le résultat',
    lignes: [
      { compteId: compte(c, n416).id, libelle: 'Impayé 2026', debit: 0, credit: 120_000 },
      { compteId: compte(c, n491).id, libelle: 'Impayé 2026', debit: 30_000, credit: 0 },
      { compteId: compte(c, produit).id, libelle: 'Impayé 2026', debit: 90_000, credit: 0 },
    ],
  });
  await valider(c, c.ex27, '2027-03-31');
  const candidates = await c.ok('GET', `/creances-douteuses/${creance.id}/correction-resultat`);
  const servie = candidates.ecritures.find((e) => e.id === juste.id);
  relever('I', 'candidate servie · 120 000 au 416, 30 000 au 491, 30 000 en place', [120_000, 30_000, 30_000], servie ? [servie.credit416, servie.debit491, servie.depreciationEnPlace] : null);
  const refus = await c.req('POST', `/creances-douteuses/${creance.id}/correction-resultat`, { ecritureId: faux.id, motif: 'Correction de l’impayé de 2026' });
  relever('I', 'correction au mauvais montant · refusée', 400, refus.statut);
  await c.ok('POST', `/creances-douteuses/${creance.id}/correction-resultat`, { ecritureId: juste.id, motif: 'Cotisation à l’encaissement · le chèque impayé n’a jamais été encaissé' });
  const audit = await c.ok('GET', '/journal-audit?entite=CreanceDouteuse');
  relever('I', 'journal d’audit · la désignation est un événement', true, (audit.total ?? 0) >= 2);
  const ctl27 = await c.ok('GET', `/controles?exerciceId=${c.ex27}`);
  relever('I', '2027 · contrôle muet après la correction', null, trouve(ctl27)?.gravite ?? null);
  const liste27 = await c.ok('GET', `/creances-douteuses?exerciceId=${c.ex27}`);
  const r = liste27.rapprochement;
  relever('I', '2027 · rapprochement · 416 et module à zéro', [0, 0], [r.solde416, r.resteModule]);
  relever('I', '2027 · rapprochement · 491, module et hors module à zéro', [0, 0, 0], [r.solde491, r.depreciationModule, r.horsModule491]);
  const perte = await c.req('POST', `/creances-douteuses/${creance.id}/perte`, {
    exerciceId: c.ex27,
    journalId: c.od.id,
    date: '2027-04-30',
    montant: 1,
    motif: 'x',
    pieces: [{ nature: 'PV', reference: '1' }],
  });
  relever('I', 'perte sur la créance corrigée · refusée', 400, perte.statut);
  await valider(c, c.ex27, '2027-12-31');
  const cl27 = await c.req('POST', `/exercices/${c.ex27}/cloturer`, {});
  relever('I', 'clôture de 2027', 'acceptée', cl27.statut < 400 ? 'acceptée' : `refusée ${cl27.statut} ${JSON.stringify(cl27.corps).slice(0, 300)}`);
}

/**
 * CAS E · jumeau 3 · le dossier qui paie son fournisseur déclare la part de
 * chaque facture (art. 151) dans le Règlement des tiers. F1, PRESTATION achetée
 * le 5 janvier (1 000 000 HT, TVA 160 000, déductible à l'encaissement du
 * prestataire, décret art. 96) ; F2, MARCHANDISES le 10 janvier (500 000 HT,
 * TVA 80 000, déductible à la facture). Règlement de 1 000 000 le 15 février,
 * parts déclarées · 580 000 sur F2, 420 000 sur F1 · déduction de février =
 * 420 000 × 160 000 / 1 160 000 = 57 931,03 (l'art. 154 seul, F1 la plus
 * ancienne d'abord, rendrait 137 931,03). Puis la clôture · février relu
 * inchangé.
 */
async function casE() {
  const c = await dossier('Cas E règlement imputé', 'SYSCOHADA');
  const taux = (await c.ok('GET', '/taux-tva')).find((t) => Number(t.taux) === 16);
  const tva = [...c.comptes.values()].find((x) => x.id === taux.compteDeductibleId).numero;
  await lettrable(c, '40110000');
  const [, , f1] = await ecriture(c, c.ex26, c.od, '2026-01-05', 'Facture F1 (prestation achetée)', [
    ['60570000', 1_000_000, 0],
    [tva, 160_000, 0, { extra: { tauxTvaId: taux.id } }],
    ['40110000', 0, 1_160_000],
  ]);
  const [, , f2] = await ecriture(c, c.ex26, c.od, '2026-01-10', 'Facture F2 (marchandises)', [
    ['60110000', 500_000, 0],
    [tva, 80_000, 0, { extra: { tauxTvaId: taux.id } }],
    ['40110000', 0, 580_000],
  ]);
  await valider(c, c.ex26, '2026-01-31');
  const r = await c.ok('POST', '/reglements', {
    sens: 'FOURNISSEUR',
    exerciceId: c.ex26,
    journalId: c.bq.id,
    date: '2026-02-15',
    reglements: [
      {
        compteId: compte(c, '40110000').id,
        ligneIds: [f1, f2],
        montant: 1_000_000,
        imputation: [{ ligneId: f2, montant: 580_000 }, { ligneId: f1, montant: 420_000 }],
        // M6 · sans ordre de virement, la pièce qui a notifié l'imputation au fournisseur (art. 151).
        pieceImputation: 'Lettre au fournisseur du 15 février',
      },
    ],
  });
  relever('E', 'une pièce, deux lettrages (un par facture)', 2, r.reglements[0].lettre.split(', ').length);
  await valider(c, c.ex26, '2026-02-28');
  const fev = await declaration(c, '2026-02-01', '2026-02-28');
  relever('E', 'février · déduction de F1 à sa part déclarée', 57_931.03, fev.totalDeductible);
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('E', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const fevApres = await declaration(c, '2026-02-01', '2026-02-28');
  relever('E', 'février relu après la clôture · inchangé', 57_931.03, fevApres.totalDeductible);
}

/**
 * Les lignes d'À-NOUVEAU de 2027 au 41110000, datées du premier jour · au débit
 * (reports de factures) et au crédit (reports de paiements). Les pièces de
 * 2027 elles-mêmes n'en sont pas.
 */
async function aNouveaux2027(c) {
  const lignes = await c.ok('GET', `/comptes/${compte(c, '41110000').id}/lettrage?nonLettreesSeulement=true`);
  const ouvertes = (Array.isArray(lignes) ? lignes : lignes.lignes ?? []).filter((l) => (l.date ?? '').startsWith('2027-01-01'));
  return { debiteurs: ouvertes.filter((l) => Number(l.debit) > 0).map((l) => l.id), crediteurs: ouvertes.filter((l) => Number(l.credit) > 0).map((l) => l.id) };
}

/**
 * Une prestation · TTC au client, HT au 70610000, taxe au compte dit (à défaut
 * celui du taux, le 44310000 du semis). Deux factures dont la taxe est sur
 * deux comptes différents (4432 et 4431) sont de composition différente · le
 * groupe s'IMPUTE (art. 151 à 154), jamais lu par `fractionsDuGroupe`.
 */
async function prestation(c, exerciceId, date, libelle, ttc, taxe, compteTaxe = null) {
  const taux = (await c.ok('GET', '/taux-tva')).find((t) => Number(t.taux) === 16);
  const tva = compteTaxe ?? [...c.comptes.values()].find((x) => x.id === taux.compteCollecteId).numero;
  await lettrable(c, '41110000');
  const [ligne] = await ecriture(c, exerciceId, c.od, date, libelle, [
    ['41110000', ttc, 0],
    ['70610000', 0, ttc - taxe],
    [tva, 0, taxe, { extra: { tauxTvaId: taux.id } }],
  ]);
  return ligne;
}

/**
 * CAS J · SECOND TOUR, B-1 · F1 (prestation, 1 160 000 TTC, taxe 160 000 au
 * 4432) le 5 décembre 2026 ; P0 de 400 000 le 20 décembre, lettré avec F1 (partiel).
 * Décembre · 400 000 × 160 000 / 1 160 000 = 55 172,41. Clôture (reports de
 * F1 et de P0). F2 (prestation, 580 000 TTC, taxe 80 000 au 4431 · autre
 * composition) le 10 janvier 2027 ; P de 500 000 le 15 février, lettré avec
 * les DEUX reports et F2. Art. 154 · F1 et F2 échues, F1 la plus ancienne
 * (reste 760 000) reçoit les 500 000 · février = 500 000 × 160 000 /
 * 1 160 000 = 68 965,52 ; F2 rien. Avant le second tour · 88 275,86 (P0
 * compté deux fois), et le groupe dit deux fois. Puis la porte · une
 * déclaration posée sur le REPORT de P0 est refusée (art. 151), le paiement
 * d'origine nommé ; une déclaration sur P0 lui-même, d'un exercice
 * clôturé, aussi (M-a).
 */
async function casJ() {
  const c = await dossier('Cas J report d’un paiement de N', 'SYSCOHADA');
  const f1 = await prestation(c, c.ex26, '2026-12-05', 'Facture F1', 1_160_000, 160_000, '44320000');
  const p0 = await paiement(c, c.ex26, '2026-12-20', 400_000);
  await valider(c, c.ex26, '2026-12-31');
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [f1, p0], autoriserPartiel: true });
  const dec = await declaration(c, '2026-12-01', '2026-12-31');
  relever('J', 'décembre 2026 · P0 paie F1', 55_172.41, dec.totalCollecte);
  await liquider(c, c.ex26, '2026-12-01', '2026-12-31');
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('J', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const f2 = await prestation(c, c.ex27, '2027-01-10', 'Facture F2', 580_000, 80_000, '44310000');
  const p = await paiement(c, c.ex27, '2027-02-15', 500_000);
  await valider(c, c.ex27, '2027-02-28');
  const { debiteurs, crediteurs } = await aNouveaux2027(c);
  relever('J', 'deux reports en 2027 (F1 au débit, P0 au crédit)', [1, 1], [debiteurs.length, crediteurs.length]);
  const lettre = await c.req('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [...debiteurs, ...crediteurs, f2, p], autoriserPartiel: true });
  relever('J', 'lettrage des deux reports avec F2 et P', 'posé', lettre.statut < 400 ? 'posé' : `refusé ${lettre.statut} ${JSON.stringify(lettre.corps).slice(0, 300)}`);
  const jan = await declaration(c, '2027-01-01', '2027-01-31');
  relever('J', 'janvier 2027 · rien d’encaissé', 0, jan.totalCollecte);
  const fev = await declaration(c, '2027-02-01', '2027-02-28');
  relever('J', 'février 2027 · P paie F1, la plus ancienne · P0 jamais compté deux fois', 68_965.52, fev.totalCollecte);
  relever('J', 'février 2027 · le groupe dit UNE fois', 1, (fev.imputationsDesPaiements ?? []).length);
  const surReport = await c.req('POST', '/imputations-paiements', {
    ligneReglementId: crediteurs[0],
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'Lettre du client',
    pieceDate: '2027-01-01',
    factures: [{ ligneFactureId: f2, montant: 400_000 }],
  });
  relever('J', 'déclaration sur le REPORT de P0 · refusée, le paiement d’origine nommé', 'refusée, origine nommée',
    surReport.statut === 400 && /report à nouveau d’un paiement[^·]*du 20\/12\/2026/.test(surReport.corps?.message ?? '') ? 'refusée, origine nommée' : `${surReport.statut} ${JSON.stringify(surReport.corps).slice(0, 300)}`);
  const surP0 = await c.req('POST', '/imputations-paiements', {
    ligneReglementId: p0,
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'Lettre du client',
    pieceDate: '2026-12-20',
    factures: [{ ligneFactureId: f1, montant: 400_000 }],
  });
  relever('J', 'M-a · déclaration sur P0 (exercice clôturé) · refusée', 'refusée, exercice clôturé',
    surP0.statut === 400 && /exercice clôturé/.test(surP0.corps?.message ?? '') ? 'refusée, exercice clôturé' : `${surP0.statut} ${JSON.stringify(surP0.corps).slice(0, 300)}`);
  const groupe = await c.ok('GET', `/imputations-paiements/groupe/${p}`);
  relever('J', 'fenêtre · le report de P0 n’est pas un paiement du groupe', false, groupe.paiements.some((x) => x.id === crediteurs[0]));
  relever('J', 'fenêtre · F1 reçoit P0 (400 000) puis P (500 000)', [400_000, 500_000],
    (groupe.factures.find((f) => Number(f.montant) === 1_160_000)?.imputations ?? []).map((x) => Number(x.montant)));
}

/**
 * CAS G BIS · SECOND TOUR, B-1 · F1 (prestation, 1 160 000, taxe 160 000 au
 * 4432) le 10 décembre 2026 et R1 de 500 000 le 20 décembre, lettrés (partiel) ; X
 * (prestation, 1 160 000, taxe 160 000 au 4431 · autre composition) le
 * 12 décembre, laissée ouverte. Décembre · R1 paie F1 · 68 965,52. Clôture ·
 * reports de F1, X et R1. R2 de 1 000 000 le 15 janvier 2027, lettré avec les
 * TROIS reports (celui de R1 compris). Art. 154 · F1 (reste 660 000) d'abord,
 * puis X 340 000 · janvier = 660 000 × 160 000 / 1 160 000 + 340 000 ×
 * 160 000 / 1 160 000 = 91 034,48 + 46 896,55 = 137 931,03. Avant le second
 * tour · le report de R1 payait F1 une seconde fois au 1er janvier, X
 * recevait 840 000 · 206 896,55.
 */
async function casGbis() {
  const c = await dossier('Cas G bis report du paiement lettré en N+1', 'SYSCOHADA');
  const f1 = await prestation(c, c.ex26, '2026-12-10', 'Facture F1', 1_160_000, 160_000, '44320000');
  await prestation(c, c.ex26, '2026-12-12', 'Facture X', 1_160_000, 160_000, '44310000');
  const r1 = await paiement(c, c.ex26, '2026-12-20', 500_000);
  await valider(c, c.ex26, '2026-12-31');
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [f1, r1], autoriserPartiel: true });
  const dec = await declaration(c, '2026-12-01', '2026-12-31');
  relever('Gbis', 'décembre 2026 · R1 paie F1', 68_965.52, dec.totalCollecte);
  await liquider(c, c.ex26, '2026-12-01', '2026-12-31');
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('Gbis', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const r2 = await paiement(c, c.ex27, '2027-01-15', 1_000_000);
  await valider(c, c.ex27, '2027-01-31');
  const an = await aNouveaux2027(c);
  const reports = [...an.debiteurs, ...an.crediteurs];
  relever('Gbis', 'trois reports en 2027 (F1, X, R1)', 3, reports.length);
  const lettre = await c.req('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [...reports, r2], autoriserPartiel: true });
  relever('Gbis', 'lettrage de R2 avec les trois reports', 'posé', lettre.statut < 400 ? 'posé' : `refusé ${lettre.statut} ${JSON.stringify(lettre.corps).slice(0, 300)}`);
  const jan = await declaration(c, '2027-01-01', '2027-01-31');
  relever('Gbis', 'janvier 2027 · F1 660 000 puis X 340 000 · R1 jamais compté deux fois', 137_931.03, jan.totalCollecte);
  relever('Gbis', 'janvier 2027 · aucun groupe lu en bloc', 0, (jan.groupesImputationIndeterminee ?? []).length);
}

/**
 * CAS K · SECOND TOUR, B-2 · la porte lit le groupe comme le moteur. S
 * (prestation, 1 160 000, taxe 160 000) le 5 décembre 2026 et X (sans taxe,
 * 1 000 000) le 10 décembre, impayées ; clôture. P1 de 600 000 le 15 janvier
 * 2027 et P2 de 1 000 000 le 15 février, lettrés avec les deux reports. Le
 * client déclare que P2 paie X en entier · ADMISE (P1 a payé S, la plus
 * ancienne, pour le moteur ; la porte lisait les reports au prorata et
 * refusait « 722 222,22 après 277 777,78 »). Janvier · P1 paie S ·
 * 600 000 × 160 000 / 1 160 000 = 82 758,62. Février · P2 paie X · 0.
 */
async function casK() {
  const c = await dossier('Cas K borne de la porte', 'SYSCOHADA');
  await prestationEtSansTaxe(c, { s: '2026-12-05', x: '2026-12-10' });
  await valider(c, c.ex26, '2026-12-31');
  const cl = await c.req('POST', `/exercices/${c.ex26}/cloturer`, {});
  relever('K', 'clôture de 2026', 'acceptée', cl.statut < 400 ? 'acceptée' : `refusée ${cl.statut} ${JSON.stringify(cl.corps).slice(0, 300)}`);
  const p1 = await paiement(c, c.ex27, '2027-01-15', 600_000);
  const p2 = await paiement(c, c.ex27, '2027-02-15', 1_000_000);
  await valider(c, c.ex27, '2027-02-28');
  const reports = await aNouveauxDebiteurs2027(c);
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [...reports.map((l) => l.id), p1, p2], autoriserPartiel: true });
  const groupe = await c.ok('GET', `/imputations-paiements/groupe/${p2}`);
  const x = groupe.factures.find((f) => Number(f.montant) === 1_000_000);
  const d = await c.req('POST', '/imputations-paiements', {
    ligneReglementId: p2,
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'Ordre de virement, paiement de X',
    pieceDate: '2027-02-15',
    factures: [{ ligneFactureId: x?.ligneADesigner, montant: 1_000_000 }],
  });
  relever('K', 'P2 déclaré sur X pour 1 000 000 · admise', 'admise', d.statut < 400 ? 'admise' : `refusée ${d.statut} ${JSON.stringify(d.corps).slice(0, 300)}`);
  const jan = await declaration(c, '2027-01-01', '2027-01-31');
  relever('K', 'janvier 2027 · P1 paie S, la plus ancienne', 82_758.62, jan.totalCollecte);
  const fev = await declaration(c, '2027-02-01', '2027-02-28');
  relever('K', 'février 2027 · P2 paie X (sans taxe)', 0, fev.totalCollecte);
}

/**
 * CAS M · SECOND TOUR, M-b · un groupe qui porte un AVOIR se lit en bloc
 * (décret n° 011/42, art. 126) · A (prestation, 1 160 000) le 5 janvier
 * 2026, B (prestation, 580 000, taxe au 4431) le 10 janvier, un avoir de
 * 116 000 sur A le 20 janvier, R de 500 000 le 15 février, tous lettrés. La
 * porte refuse une déclaration de R sur B, la fenêtre le dit, par le même
 * motif.
 */
async function casM() {
  const c = await dossier('Cas M avoir dans le groupe', 'SYSCOHADA');
  const taux = (await c.ok('GET', '/taux-tva')).find((t) => Number(t.taux) === 16);
  const tva = [...c.comptes.values()].find((x) => x.id === taux.compteCollecteId).numero;
  const a = await prestation(c, c.ex26, '2026-01-05', 'Facture A', 1_160_000, 160_000, '44320000');
  const b = await prestation(c, c.ex26, '2026-01-10', 'Facture B', 580_000, 80_000, '44310000');
  const [av] = await ecriture(c, c.ex26, c.od, '2026-01-20', 'Avoir sur A', [
    ['41110000', 0, 116_000],
    ['70610000', 100_000, 0],
    [tva, 16_000, 0, { extra: { tauxTvaId: taux.id } }],
  ]);
  const r = await paiement(c, c.ex26, '2026-02-15', 500_000);
  await valider(c, c.ex26, '2026-02-28');
  await c.ok('POST', `/comptes/${compte(c, '41110000').id}/lettrage`, { ligneIds: [a, b, av, r], autoriserPartiel: true });
  const d = await c.req('POST', '/imputations-paiements', {
    ligneReglementId: r,
    fondement: 'DECLARATION_DU_DEBITEUR',
    pieceReference: 'Lettre du client',
    pieceDate: '2026-02-15',
    factures: [{ ligneFactureId: b, montant: 500_000 }],
  });
  relever('M', 'porte · groupe avec avoir · refusée par le motif du moteur', 'refusée, lu en bloc',
    d.statut === 400 && /lit ce groupe en bloc \(un avoir dans le groupe\)/.test(d.corps?.message ?? '') ? 'refusée, lu en bloc' : `${d.statut} ${JSON.stringify(d.corps).slice(0, 300)}`);
  const groupe = await c.ok('GET', `/imputations-paiements/groupe/${r}`);
  relever('M', 'fenêtre · le même motif', true, /lit ce groupe en bloc \(un avoir dans le groupe\)/.test(groupe.nonServi ?? ''));
  const fev = await declaration(c, '2026-02-01', '2026-02-28');
  relever('M', 'février · le groupe nommé en bloc', 'un avoir dans le groupe', (fev.groupesImputationIndeterminee ?? [])[0]?.motif ?? null);
}

const sortie = process.argv[2];
for (const [nom, cas] of [['A', casA], ['B', casB], ['C', casC], ['D', casD], ['E', casE], ['F', casF], ['G', casG], ['H', casH], ['I', casI], ['J', casJ], ['Gbis', casGbis], ['K', casK], ['M', casM]].filter(([n]) => !process.env.CAS || process.env.CAS.includes(n))) {
  try {
    await cas();
  } catch (e) {
    ecarts++;
    releves.push({ cas: nom, erreur: String(e?.message ?? e) });
    console.log(`ERREUR [${nom}] ${e?.message ?? e}`);
  }
}
console.log(`\n${releves.length} relevé(s), ${ecarts} écart(s) ou erreur(s).`);
if (sortie) writeFileSync(sortie, JSON.stringify(releves, null, 2));
process.exit(0);
