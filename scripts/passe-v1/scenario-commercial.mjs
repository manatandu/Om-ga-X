/**
 * SCÉNARIO « COMMERCIAL » · gestion commerciale, magasin et trésorerie avancée,
 * sur une SARL SYSCOHADA (système normal, assujettie à la TVA, inventaire
 * PERMANENT), exercices 2026 (N, clôturé) et 2027 (N+1), plus un dossier
 * SYCEBNL pour les refus de périmètre et le rôle d'emballage qui diverge.
 *
 * Ce qui est joué, et les sources lues pour chaque attendu ·
 *  - devis · AUDCG art. 241 à 246 (compétence `audcg-acte-uniforme`,
 *    livre 8) · offre ferme, acceptation dans le délai, acceptation tardive,
 *    rejet substantiel puis contre-proposition chaînée, réponse non
 *    substantielle, silence au-delà du délai, révocation, refus SYCEBNL ;
 *  - facturation · décret n° 23/10, art. 26 (dix mentions dues par un document
 *    en tenant lieu), LPF art. 97 bis (750 000 FC par omission, personne
 *    morale), décret n° 011/42 art. 127 (note de crédit), O.-L. n° 10/001
 *    art. 56 et décret art. 134 (état détaillé), fiches des comptes 40 et 41
 *    (écriture d'une facture) ;
 *  - emballages · AUDCIF Titre VII, fiches des comptes 40 (4094) et 41 (4194),
 *    trois dénouements, refus du matériel conservé par le client ;
 *  - magasin · AUDCIF Titre VII compte 603 et fiche du compte 31 (inventaire
 *    permanent), glossaire (P.E.P.S., C.M.P.A.C.E., dernière sortie à la
 *    valeur restante), boni et mali au 6031 ;
 *  - trésorerie · ISO 13616 (IBAN, modulo 97), Code civil Livre III art. 151
 *    à 154 (imputation des paiements), règles d'OmegaX sur les ordres de
 *    virement, les lots et les relances (CLAUDE.md, paragraphes dédiés) ;
 *  - TVA du mois · O.-L. n° 10/001 art. 25 (biens à la livraison, services à
 *    l'encaissement), décret n° 011/42 art. 126 (avoir sur vente reporté au
 *    mois suivant), taux 16 %.
 *
 * Chaque montant attendu est calculé à la main, le calcul en commentaire.
 * Un refus ATTENDU se lit par `c.req` et se contrôle (statut, motif) · il n'est
 * pas une erreur HTTP du banc. Un geste juste refusé passe par `c.geste` et
 * reste consigné.
 */
import {
  auCentime, balance, cloturer, compte, ecriture, etape, lettrer, nouveauDossier,
  rechargerComptes, rechargerExercices, solde, validerJusqua,
} from './lib.mjs';

// --- Comptes du plan SYSCOHADA semé (relus dans compte-seed-syscohada.ts) ---
const BQ = '52110000'; // Banques en monnaie nationale
const VENTES = '70110000'; // 701 Ventes de marchandises, Dans la Région
const SERVICES = '70610000'; // 706 Services vendus, Dans la Région
const ACHATS = '60110000'; // 601 Achats de marchandises, Dans la Région
const HONORAIRES = '63240000'; // Honoraires des professions réglementées
const TVA_VENTES = '44310000'; // TVA facturée sur ventes
const TVA_PRESTATIONS = '44320000'; // TVA facturée sur prestations de services
const TVA_ACHATS = '44520000'; // TVA récupérable sur achats
const TVA_SERVICES = '44540000'; // TVA récupérable sur services extérieurs
const STOCK_A = '31110000'; // Marchandises A1
const STOCK_B = '31120000'; // Marchandises A2
const VARIATION = '60310000'; // Variations des stocks de marchandises
const CREANCE_CONS = '40940000'; // Fournisseurs, créances pour emballages et matériels à rendre
const DETTE_CONS = '41940000'; // Clients, dettes pour emballages et matériels consignés
const ACHAT_EMB = '60820000'; // Emballages récupérables non identifiables
const MALI_EMB = '62240000'; // Malis sur emballages
const BONI_EMB = '70740000'; // Bonis sur reprises et cessions d'emballages
const MATERIEL_EMB = '24300000'; // Matériel d'emballage récupérable et identifiable

/** Un montant au centime, pour un attendu calculé en flottant. */
const c2 = auCentime;

/**
 * UN IBAN AVEC SA CLÉ · ISO 13616, « structure, puis contrôle modulo 97 sur le
 * compte replacé en tête ». La clé se calcule sur le BBAN suivi du pays et de
 * « 00 », lettres converties (A = 10), 98 moins le reste.
 */
function ibanAvecCle(pays, bban) {
  const conv = (s) => [...s].map((ch) => (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch)).join('');
  let r = 0;
  for (const d of conv(bban + pays + '00')) r = (r * 10 + Number(d)) % 97;
  return `${pays}${String(98 - r).padStart(2, '0')}${bban}`;
}

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

/** Un tiers avec son compte individuel et ses coordonnées (numéro impôt, adresse, courriel). */
async function tiersComplet(c, type, code, nom, extra = {}) {
  const t = await c.geste(`Tiers ${code}`, 'POST', '/tiers', { type, code, nom, creerCompteIndividuel: true, ...extra });
  if (!t) return null;
  await rechargerComptes(c);
  return { id: t.id, compteId: t.compteIndividuel?.id, numero: t.compteIndividuel?.numero, nom };
}

/** Les lignes d'une écriture, cumulées par numéro de compte · { numero → { debit, credit } }. */
async function lignesParCompte(c, exerciceId, reference, ecritureId) {
  const r = await c.lire(`Écriture ${reference}`, `/ecritures?exerciceId=${exerciceId}&reference=${encodeURIComponent(reference)}`);
  const e = (r?.ecritures ?? []).find((x) => x.id === ecritureId) ?? null;
  const m = {};
  for (const l of e?.lignes ?? []) {
    const n = l.compte?.numero ?? l.compteId;
    m[n] = m[n] ?? { debit: 0, credit: 0 };
    m[n].debit = c2(m[n].debit + Number(l.debit));
    m[n].credit = c2(m[n].credit + Number(l.credit));
  }
  return m;
}

/** Les lignes d'un compte de tiers (interrogation et lettrage), toutes ou ouvertes. */
async function lignesDuTiers(c, t, ouvertes = false) {
  if (!t?.compteId) return { lignes: [], totaux: { debit: 0, credit: 0 } };
  return (await c.lire(`Lignes de ${t.nom}`, `/comptes/${t.compteId}/lettrage${ouvertes ? '?nonLettreesSeulement=true' : ''}`)) ?? { lignes: [], totaux: { debit: 0, credit: 0 } };
}

/** La ligne d'un tiers retrouvée par la référence de sa pièce et son sens. */
async function ligneDuTiers(c, t, reference, sens = 'debit') {
  const { lignes } = await lignesDuTiers(c, t);
  return lignes.find((l) => l.reference === reference && Number(l[sens]) > 0) ?? null;
}

/** Le numéro d'un compte à partir de son identifiant, dans le plan relu. */
const numeroDe = (c, id) => c.plan.find((x) => x.id === id)?.numero ?? id;

export default async function scenarioCommercial(registre) {
  registre.scenario = 'commercial';
  const R = registre;
  const c = await nouveauDossier(R, 'Passe commercial · Comptoir du Fleuve SARL', {
    referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'commercial', exercice: ['2026-01-01', '2026-12-31'],
  });
  const n = c.exercices.get('2026').id;
  const bq = c.journal('BQ');
  const od = c.od;
  const ven = c.journal('VEN');
  const ach = c.journal('ACH');
  const ctx = {};

  await etape(R, 'Paramètres · module commercial, forme, TVA, inventaire permanent, identité', async () => {
    // La gestion commerciale est un module OPTIONNEL · un dossier neuf part sans lui.
    const m = await c.geste('Activation du module de gestion commerciale', 'PATCH', '/dossier/modules', { modulesActives: ['GESTION_COMMERCIALE'] });
    R.egal('module de gestion commerciale actif', true, JSON.stringify(m ?? {}).includes('GESTION_COMMERCIALE'));
    await c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Assujettissement à la TVA', 'PATCH', '/dossier/regime', { assujettiTva: true, reponseAssujettissementTva: 'OUI', venteBiensServices: 'OUI' });
    await c.geste('Inventaire permanent', 'PATCH', '/dossier/methode-inventaire-stocks', { methodeInventaireStocks: 'PERMANENT' });
    // AUSCGIE art. 17 et décret n° 23/10 art. 26 a) · adresse, capital et n° impôt de l'émetteur.
    await c.geste('Coordonnées du dossier', 'PATCH', '/dossier/coordonnees', { adresse: 'Avenue du Commerce 12, Gombe', ville: 'Kinshasa', capitalSocial: 50_000_000 });
    await c.geste('Identité légale du dossier', 'PATCH', '/dossier/identite', { numeroImpot: 'A2600001Z', rccm: 'CD/KIN/RCCM/26-B-01234' });
    const taux = (await c.lire('Taux de TVA', '/taux-tva')) ?? [];
    ctx.tva16 = taux.find((t) => t.code === 'TVA16');
    R.egal('taux de TVA à 16 % semé', true, Boolean(ctx.tva16));
  });

  await etape(R, 'Reprise · bilan d’ouverture importé au 1er janvier 2026', async () => {
    const lignes = [[BQ, 'Banque', 50_000_000, 0], ['10130000', 'Capital', 0, 50_000_000]];
    const csv = ['Compte;Intitule;Debit;Credit', ...lignes.map((l) => l.join(';'))].join('\n');
    await c.geste('Import du bilan d’ouverture', 'POST', '/import/executer', {
      type: 'BALANCE', nomFichier: 'ouverture-2026.csv', contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
      mapping: { numero: 'Compte', intitule: 'Intitule', debit: 'Debit', credit: 'Credit' },
      exerciceId: n, dateOperation: '2026-01-01', bilanDOuverture: true, separateur: ';',
    });
    await validerJusqua(c, n, '2026-01-01');
  });

  // --- Tiers -----------------------------------------------------------------
  const C1 = await tiersComplet(c, 'CLIENT', 'C1', 'Brasserie du Fleuve', { numeroImpot: 'A0700001B', adresse: 'Boulevard du 30 Juin 45', ville: 'Kinshasa', email: 'compta@brasserie-fleuve.cd' });
  const C2 = await tiersComplet(c, 'CLIENT', 'C2', 'Hôtel du Fleuve', { numeroImpot: 'A0700002C', adresse: 'Avenue des Aviateurs 3', ville: 'Kinshasa' });
  // C3 · ni numéro impôt (mention art. 26 b) manquante), un courriel pour montrer
  // que l'exclusion des relances retient même une lettre qui pouvait partir.
  const C3 = await tiersComplet(c, 'CLIENT', 'C3', 'Quincaillerie Kasa', { adresse: 'Marché central, cellule 14', ville: 'Kinshasa', email: 'kasa@exemple.cd' });
  const F1 = await tiersComplet(c, 'FOURNISSEUR', 'F1', 'Grossiste de Matadi', { numeroImpot: 'A0800001D', adresse: 'Route de Matadi km 12', ville: 'Kinshasa' });
  // F2 · sans numéro impôt · l'état détaillé (décret art. 134) le dit incomplet.
  const F2 = await tiersComplet(c, 'FOURNISSEUR', 'F2', 'Cabinet juridique Lumbu', { adresse: 'Avenue Kasa-Vubu 210', ville: 'Kinshasa' });
  const F3 = await tiersComplet(c, 'FOURNISSEUR', 'F3', 'Emballages du Congo', { numeroImpot: 'A0800003F', adresse: 'Limete industriel', ville: 'Kinshasa' });

  /**
   * UNE FACTURE PAR LE MODULE, PUIS SON ÉCRITURE. `lignes` · [désignation,
   * quantité, prix unitaire] ; le HT d'une ligne est quantité × prix, la TVA
   * 16 % du HT (O.-L. n° 10/001, taux de droit commun, semé en TVA16).
   */
  const facture = async (geste, { sens, numero, date, tiers, lignes, compteGestion, journal, autresImpots = 0, exerciceId = n }) => {
    const corpsLignes = lignes.map(([designation, quantite, prixUnitaire]) => {
      const ht = c2(quantite * prixUnitaire);
      return { designation, quantite, prixUnitaire, montantHT: ht, imposable: true, tauxTvaId: ctx.tva16?.id, tauxApplique: 16, montantTva: c2(ht * 0.16) };
    });
    const f = await c.geste(geste, 'POST', '/facturation', {
      sens, numeroSerie: numero, dateFacture: date, ...(sens === 'ACHAT' ? { dateReception: date } : {}),
      tiersId: tiers?.id, ...(autresImpots === null ? {} : { autresImpotsEtTaxes: autresImpots }), lignes: corpsLignes,
    });
    if (!f) return null;
    const cp = await c.geste(`${geste} · comptabilisation`, 'POST', `/facturation/${f.id}/comptabiliser`, { journalId: journal.id, compteGestionId: compte(c, compteGestion) });
    const ht = c2(corpsLignes.reduce((s, l) => s + l.montantHT, 0));
    const tva = c2(corpsLignes.reduce((s, l) => s + l.montantTva, 0));
    return { id: f.id, enregistrement: f, ecritureId: cp?.ecritureId ?? null, ht, tva, ttc: c2(ht + tva), numero, exerciceId };
  };

  /** Contrôle l'écriture d'une facture contre les lignes attendues · [numéro, débit, crédit]. */
  const controlerEcriture = async (libelle, f, attendues) => {
    if (!f?.ecritureId) return R.note(`${libelle} · écriture absente, non contrôlée`);
    const m = await lignesParCompte(c, f.exerciceId, f.numero, f.ecritureId);
    for (const [numero, d, cr] of attendues) {
      R.montant(`${libelle} · ${numero} au débit`, d, m[numero]?.debit ?? 0);
      R.montant(`${libelle} · ${numero} au crédit`, cr, m[numero]?.credit ?? 0);
    }
    R.egal(`${libelle} · nombre de comptes mouvementés`, attendues.length, Object.keys(m).length);
  };

  // --- Modèles de règlement ----------------------------------------------------
  await etape(R, 'Modèles de règlement · échéancier simulé', async () => {
    const m1 = await c.geste('Modèle « 30 jours fin de mois »', 'POST', '/modeles-reglement', { intitule: '30 jours fin de mois', delaiJours: 30, echeance: 'FIN_DE_MOIS' });
    if (m1) {
      // Facture du 15/02 · fin de mois 28/02/2026, plus 30 jours · 30/03/2026.
      const e = await c.geste('Échéancier du modèle 30 jours fin de mois', 'POST', `/modeles-reglement/${m1.id}/calculer`, { dateFacture: '2026-02-15', montantTotal: 10_440_000 });
      R.egal('modèle 30 j fin de mois · une échéance', 1, e?.length);
      R.egal('modèle 30 j fin de mois · date d’échéance', '2026-03-30', String(e?.[0]?.dateEcheance ?? '').slice(0, 10));
      R.montant('modèle 30 j fin de mois · montant', 10_440_000, e?.[0]?.montant);
    }
    const m2 = await c.geste('Modèle « acompte 30 % et solde à 60 jours »', 'POST', '/modeles-reglement', { intitule: 'Acompte 30 % et solde 60 jours', delaiJours: 60, echeance: 'NET' });
    if (m2) {
      await c.geste('Échéance 1 · 30 % comptant', 'POST', `/modeles-reglement/${m2.id}/echeances`, { ordre: 1, type: 'POURCENTAGE', valeur: 30, delaiJours: 0, echeance: 'NET' });
      await refusAttendu(c, R, 'Échéance en pourcentage portant le total au-delà de 100 %', 'POST', `/modeles-reglement/${m2.id}/echeances`, { ordre: 2, type: 'POURCENTAGE', valeur: 80, delaiJours: 30, echeance: 'NET' }, 400, '100 %');
      await c.geste('Échéance 2 · équilibre à 60 jours', 'POST', `/modeles-reglement/${m2.id}/echeances`, { ordre: 3, type: 'EQUILIBRE', delaiJours: 60, echeance: 'NET' });
      // L'Équilibre reçoit le reste et se place en dernier (audit final F149).
      await refusAttendu(c, R, 'Échéance placée après l’Équilibre', 'POST', `/modeles-reglement/${m2.id}/echeances`, { ordre: 4, type: 'MONTANT', valeur: 1_000, delaiJours: 90, echeance: 'NET' }, 400, 'Équilibre');
      // 30 % de 10 440 000 = 3 132 000 le 15/02 ; le reste 7 308 000 au 15/02 + 60 j = 16/04/2026.
      const e = await c.geste('Échéancier du modèle acompte et solde', 'POST', `/modeles-reglement/${m2.id}/calculer`, { dateFacture: '2026-02-15', montantTotal: 10_440_000 });
      R.montant('modèle acompte · première échéance (30 %)', 3_132_000, e?.[0]?.montant);
      R.egal('modèle acompte · date de la première échéance', '2026-02-15', String(e?.[0]?.dateEcheance ?? '').slice(0, 10));
      R.montant('modèle acompte · échéance d’équilibre (le reste)', 7_308_000, e?.[1]?.montant);
      R.egal('modèle acompte · date de l’équilibre', '2026-04-16', String(e?.[1]?.dateEcheance ?? '').slice(0, 10));
      if (C1) await c.geste('Modèle de règlement rattaché à C1', 'PATCH', `/tiers/${C1.id}`, { modeleReglementId: m2.id });
    }
  });

  // --- Banque et RIB -----------------------------------------------------------
  const IBAN_DOSSIER = ibanAvecCle('CD', '00011000010000012345678');
  const IBAN_F1 = 'GB82WEST12345698765432'; // exemple de l'ISO 13616, clé juste
  const IBAN_F2 = ibanAvecCle('CD', '00022000020000098765432');
  const fausser = (iban) => iban.slice(0, -1) + String((Number(iban.slice(-1)) + 1) % 10);
  await etape(R, 'Banque du dossier et RIB des tiers · IBAN contrôlé', async () => {
    const banque = await c.geste('Banque Rawbank', 'POST', '/banques', { intitule: 'Rawbank', ville: 'Kinshasa' });
    if (banque) {
      await refusAttendu(c, R, 'RIB du dossier à IBAN faux (modulo 97)', 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW-CDF', iban: fausser(IBAN_DOSSIER), devise: 'CDF', journalId: bq?.id }, 400, 'IBAN');
      ctx.ribDossier = await c.geste('RIB du dossier rattaché au journal BQ', 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW-CDF', iban: IBAN_DOSSIER, devise: 'CDF', journalId: bq?.id });
      // Un journal qui porte une caisse (57) n'est pas un journal de banque.
      await refusAttendu(c, R, 'RIB rattaché au journal de caisse', 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW-CA', numeroCompte: '99999', journalId: c.journal('CA')?.id }, 400, 'caisse');
      // Un second journal de banque, tenu en dollars (52150000 « Banques en devises »).
      ctx.bqd = await c.geste('Journal BQD (banque en devises)', 'POST', '/journaux', { code: 'BQD', intitule: 'Banque en dollars', type: 'TRESORERIE', compteTresorerieId: compte(c, '52150000') });
      if (ctx.bqd) await c.geste('RIB en dollars rattaché au journal BQD', 'POST', `/banques/${banque.id}/ribs`, { abrege: 'RAW-USD', iban: ibanAvecCle('CD', '00011000010000099999999'), devise: 'USD', journalId: ctx.bqd.id });
    }
    await refusAttendu(c, R, 'RIB de F1 à IBAN faux', 'POST', `/tiers/${F1?.id}/ribs`, { banque: 'Rawbank', iban: fausser(IBAN_F1) }, 400, 'IBAN');
    const r1 = await c.geste('RIB de F1 (IBAN)', 'POST', `/tiers/${F1?.id}/ribs`, { banque: 'Rawbank', titulaire: 'Grossiste de Matadi SARL', iban: IBAN_F1 });
    R.egal('RIB de F1 · premier RIB principal d’office', true, r1?.estPrincipal);
    await c.geste('Second RIB de F1 (numéro national)', 'POST', `/tiers/${F1?.id}/ribs`, { banque: 'Equity BCDC', numeroCompte: '00011-01234-5678901-23', estPrincipal: false });
    const ribs = (await c.lire('RIB de F1', `/tiers/${F1?.id}/ribs`)) ?? [];
    const liste = Array.isArray(ribs) ? ribs : (ribs.ribs ?? []);
    R.egal('RIB de F1 · deux RIB, un seul principal', [2, 1], [liste.length, liste.filter((x) => x.estPrincipal).length]);
    R.egal('RIB de F1 · le principal reste le premier (IBAN)', IBAN_F1, liste.find((x) => x.estPrincipal)?.iban?.replace(/\s/g, ''));
    await refusAttendu(c, R, 'RIB de F3 sans IBAN ni numéro de compte', 'POST', `/tiers/${F3?.id}/ribs`, { banque: 'TMB' }, 400, 'IBAN ni numéro');
    await c.geste('RIB de F3 (numéro national seul)', 'POST', `/tiers/${F3?.id}/ribs`, { banque: 'TMB', codeBanque: '00017', codeGuichet: '01000', numeroCompte: '12345678901', cle: '45' });
  });

  // --- Devis (AUDCG art. 241 à 246) --------------------------------------------
  await etape(R, 'Devis · offre, acceptation, caducité, contre-proposition, révocation', async () => {
    const ligne = (designation, q, pu) => ({ designation, quantite: q, prixUnitaire: pu, montantHT: q * pu });
    const devis = (numero, date, extra) => c.geste(`Devis ${numero}`, 'POST', '/commercial/devis', {
      numero, dateEmission: date, nature: 'MARCHANDISES', tiersId: C1?.id, lignes: [ligne('Ciment gris 50 kg', 100, 20_000)], ...extra,
    });
    // D1 · OFFRE FERME · délai déterminé ET déclarée irrévocable (art. 242) · non révocable.
    ctx.d1 = await devis('DV-001', '2026-02-01', { delaiJours: 15, declareeIrrevocable: true });
    R.egal('D1 · qualifiée d’offre (art. 241)', true, ctx.d1?.qualification?.estUneOffre);
    R.montant('D1 · total hors taxes (100 × 20 000, art. 263)', 2_000_000, ctx.d1?.totalHT);
    R.egal('D1 · délai + irrévocable · non révocable (art. 242)', false, ctx.d1?.revocabilite?.revocable);
    R.egal('D1 · mentions de l’art. 17 AUSCGIE recopiées (le dossier émet)', true, ctx.d1?.mentionsSocieteEmetteur !== null && ctx.d1?.mentionsSocieteEmetteur !== undefined);
    await refusAttendu(c, R, 'D1 · révocation d’une offre ferme', 'PATCH', `/commercial/devis/${ctx.d1?.id}/revocation`, { revoqueLe: '2026-02-05', motifRevocation: 'Hausse du prix du ciment' }, 400, 'art. 242');
    // L'acquiescement parvient le 10/02, avant le 16/02 (01/02 + 15 j, art. 246) · contrat formé (art. 244).
    const r1 = await c.geste('D1 · acceptation dans le délai', 'PATCH', `/commercial/devis/${ctx.d1?.id}/reponse`, { natureReponse: 'ACCEPTATION', dateReponse: '2026-02-10' });
    R.egal('D1 · état ACCEPTÉ (art. 244)', 'ACCEPTE', r1?.etat?.etat);
    R.egal('D1 · date limite d’acceptation 16/02/2026 (art. 246)', '2026-02-16', String(r1?.etat?.dateLimite ?? '').slice(0, 10));
    await refusAttendu(c, R, 'D1 · contre-proposition sur une offre acceptée', 'POST', '/commercial/devis', {
      numero: 'DV-001-CP', dateEmission: '2026-02-12', nature: 'MARCHANDISES', tiersId: C1?.id, contrePropositionDeId: ctx.d1?.id, lignes: [ligne('Ciment gris 50 kg', 80, 20_000)],
    }, 400, 'art. 245');

    // D2 · délai 10 jours (limite 11/03), acceptation parvenue le 20/03 · TARDIVE, l'offre est caduque (art. 243).
    ctx.d2 = await devis('DV-002', '2026-03-01', { delaiJours: 10 });
    const r2 = await c.geste('D2 · acceptation tardive', 'PATCH', `/commercial/devis/${ctx.d2?.id}/reponse`, { natureReponse: 'ACCEPTATION', dateReponse: '2026-03-20' });
    R.egal('D2 · acceptation après le délai · CADUC, aucun contrat (art. 243 et 244)', 'CADUC', r2?.etat?.etat);

    // D3 · réponse à modification SUBSTANTIELLE · rejet et contre-proposition (art. 245, al. 1).
    ctx.d3 = await devis('DV-003', '2026-04-01', { delaiJours: 30 });
    const r3 = await c.geste('D3 · réponse modifiant substantiellement', 'PATCH', `/commercial/devis/${ctx.d3?.id}/reponse`, {
      natureReponse: 'MODIFICATION_SUBSTANTIELLE', dateReponse: '2026-04-10', detailReponse: 'Le client ne prend que 60 sacs, à 18 000 le sac, livrés franco.',
    });
    R.egal('D3 · état CONTRE-PROPOSITION (art. 245, premier alinéa)', 'CONTRE_PROPOSITION', r3?.etat?.etat);
    ctx.cp = await c.geste('D3 · contre-proposition chaînée', 'POST', '/commercial/devis', {
      numero: 'DV-003-CP', dateEmission: '2026-04-12', nature: 'MARCHANDISES', tiersId: C1?.id, delaiJours: 8,
      contrePropositionDeId: ctx.d3?.id, lignes: [ligne('Ciment gris 50 kg (livré franco)', 60, 18_000)],
    });
    R.egal('contre-proposition · émetteur INVERSÉ (le client offre désormais)', 'CLIENT', ctx.cp?.emetteur);
    R.egal('contre-proposition · aucune mention de société recopiée (offre reçue)', null, ctx.cp?.mentionsSocieteEmetteur ?? null);
    R.montant('contre-proposition · total hors taxes (60 × 18 000)', 1_080_000, ctx.cp?.totalHT);
    await refusAttendu(c, R, 'D3 · seconde contre-proposition', 'POST', '/commercial/devis', {
      numero: 'DV-003-CP2', dateEmission: '2026-04-13', nature: 'MARCHANDISES', tiersId: C1?.id, contrePropositionDeId: ctx.d3?.id, lignes: [ligne('Ciment', 50, 18_000)],
    }, 400, 'déjà donné lieu');
    const rcp = await c.geste('Contre-proposition · acceptée par le dossier', 'PATCH', `/commercial/devis/${ctx.cp?.id}/reponse`, { natureReponse: 'ACCEPTATION', dateReponse: '2026-04-15' });
    R.egal('contre-proposition · état ACCEPTÉ', 'ACCEPTE', rcp?.etat?.etat);

    // D4 · réponse à modification NON substantielle · acceptation (art. 245, al. 2), motif écrit exigé.
    ctx.d4 = await devis('DV-004', '2026-05-02', { delaiJours: 20 });
    await refusAttendu(c, R, 'D4 · modification non substantielle sans la dire', 'PATCH', `/commercial/devis/${ctx.d4?.id}/reponse`, { natureReponse: 'MODIFICATION_NON_SUBSTANTIELLE', dateReponse: '2026-05-10' }, 400, 'art. 245');
    const r4 = await c.geste('D4 · réponse non substantielle', 'PATCH', `/commercial/devis/${ctx.d4?.id}/reponse`, {
      natureReponse: 'MODIFICATION_NON_SUBSTANTIELLE', dateReponse: '2026-05-10', detailReponse: 'Livraison demandée le matin, conditionnement sur palettes.',
    });
    R.egal('D4 · non substantielle · ACCEPTÉ (art. 245, second alinéa)', 'ACCEPTE', r4?.etat?.etat);

    // D5 · aucune réponse · le silence ne vaut rien (art. 243), réponse antérieure à l'offre refusée.
    ctx.d5 = await devis('DV-005', '2026-05-03', { delaiJours: 20 });
    await refusAttendu(c, R, 'D5 · réponse datée avant l’émission de l’offre', 'PATCH', `/commercial/devis/${ctx.d5?.id}/reponse`, { natureReponse: 'ACCEPTATION', dateReponse: '2026-05-01' }, 400, 'avant');

    // D6 · « irrévocable » SANS délai · l'art. 242 exige les deux · révocable, révoquée.
    ctx.d6 = await devis('DV-006', '2026-05-04', { declareeIrrevocable: true });
    R.egal('D6 · irrévocable sans délai · révocable (art. 242)', true, ctx.d6?.revocabilite?.revocable);
    const r6 = await c.geste('D6 · révocation', 'PATCH', `/commercial/devis/${ctx.d6?.id}/revocation`, { revoqueLe: '2026-05-08', motifRevocation: 'Rupture de stock chez le fournisseur' });
    R.egal('D6 · état RÉVOQUÉ', 'REVOQUE', r6?.etat?.etat);
    await refusAttendu(c, R, 'D6 · acceptation parvenue après la révocation', 'PATCH', `/commercial/devis/${ctx.d6?.id}/reponse`, { natureReponse: 'ACCEPTATION', dateReponse: '2026-05-09' }, 400, 'art. 242');

    // D7 · refus · l'offre prend fin quand son rejet parvient (art. 242).
    ctx.d7 = await devis('DV-007', '2026-05-05', { delaiJours: 15 });
    const r7 = await c.geste('D7 · refus', 'PATCH', `/commercial/devis/${ctx.d7?.id}/reponse`, { natureReponse: 'REFUS', dateReponse: '2026-05-07' });
    R.egal('D7 · état REFUSÉ', 'REFUSE', r7?.etat?.etat);

    // D8 · prestation de services · hors du Livre 8 (art. 234, 235 b)), volonté d'être lié non exprimée.
    const d8 = await c.geste('Devis DV-008 (services, sans volonté d’être lié)', 'POST', '/commercial/devis', {
      numero: 'DV-008', dateEmission: '2026-05-06', nature: 'SERVICES', tiersId: C2?.id, volonteDEtreLie: false, lignes: [ligne('Étude de rayonnage', 1, 300_000)],
    });
    R.egal('D8 · services · hors du Livre 8', false, d8?.perimetre?.regiParLeLivre8);
    R.egal('D8 · sans volonté d’être lié · pas une offre (art. 241)', false, d8?.qualification?.estUneOffre);

    // ÉTATS À DEUX DATES · le 10/05, D5 court encore (limite 23/05) ; le 01/06 il est
    // CADUC sans réponse, ni accepté ni refusé (art. 243, « le silence ou l'inaction »).
    const lu10 = await c.lire('Devis au 10/05/2026', '/commercial/devis?dateReference=2026-05-10');
    const lu01 = await c.lire('Devis au 01/06/2026', '/commercial/devis?dateReference=2026-06-01');
    const etat = (l, d) => (l?.devis ?? []).find((x) => x.id === d?.id)?.etat?.etat;
    R.egal('D5 au 10/05 · délai en cours', 'EN_ATTENTE', etat(lu10, ctx.d5));
    R.egal('D5 au 01/06 · délai écoulé sans réponse · CADUC', 'CADUC', etat(lu01, ctx.d5));
    const d5lu = (lu01?.devis ?? []).find((x) => x.id === ctx.d5?.id);
    R.egal('D5 au 01/06 · relu, et aucune réponse n’est inventée par le calendrier', [true, null], [Boolean(d5lu), d5lu?.natureReponse ?? null]);
    // Une offre déjà acceptée ne se révoque plus (art. 242, « avant que celui-ci n'ait exprimé son acceptation »).
    await refusAttendu(c, R, 'D4 · révocation après l’acceptation', 'PATCH', `/commercial/devis/${ctx.d4?.id}/revocation`, { revoqueLe: '2026-05-20', motifRevocation: 'Essai' }, 400, 'déjà parvenue');
    R.egal('D6 au 01/06 · révoqué', 'REVOQUE', etat(lu01, ctx.d6));
    R.egal('liste des devis · neuf devis émis ou reçus', 9, lu01?.total);
    await refusAttendu(c, R, 'Liste des devis sur une période illisible', 'GET', '/commercial/devis?du=2026-13-45', undefined, 400);
  });

  // --- Magasin · articles -------------------------------------------------------
  await etape(R, 'Magasin · articles en P.E.P.S. et en C.M.P.A.C.E.', async () => {
    await refusAttendu(c, R, 'Article rattaché à un compte de charge', 'POST', '/magasin/articles', { compteId: compte(c, ACHATS), code: 'X', designation: 'X', uniteMesure: 'u', methodeValorisation: 'PEPS' }, 400, 'classe 3');
    await refusAttendu(c, R, 'Article au coût moyen de période en inventaire permanent', 'POST', '/magasin/articles', { compteId: compte(c, STOCK_A), code: 'Y', designation: 'Y', uniteMesure: 'u', methodeValorisation: 'CMP_PERIODE_STOCKAGE' }, 400, 'PERMANENT');
    ctx.artA = await c.geste('Article A · ciment (P.E.P.S.)', 'POST', '/magasin/articles', { compteId: compte(c, STOCK_A), code: 'ART-A', designation: 'Ciment gris 50 kg', uniteMesure: 'sac', methodeValorisation: 'PEPS' });
    ctx.artB = await c.geste('Article B · fer à béton (C.M.P.A.C.E.)', 'POST', '/magasin/articles', { compteId: compte(c, STOCK_B), code: 'ART-B', designation: 'Fer à béton 12 mm', uniteMesure: 'barre', methodeValorisation: 'CMPACE' });
    // Le code d'article est unique au dossier (schéma, @@unique([tenantId, code])) · un
    // doublon se refuse par un message nommé (400 ou 409), jamais par une erreur serveur.
    const doublon = await c.req('POST', '/magasin/articles', { compteId: compte(c, STOCK_A), code: 'ART-A', designation: 'Ciment (doublon)', uniteMesure: 'sac', methodeValorisation: 'PEPS' });
    R.egal('Article au code déjà pris · refus nommé (400 ou 409), pas une erreur serveur', true, doublon.statut === 400 || doublon.statut === 409);
    if (doublon.statut >= 500) R.note(`Article au code déjà pris · ${doublon.statut} · ${JSON.stringify(doublon.corps).slice(0, 300)}`);
  });

  /**
   * UN MOUVEMENT DE MAGASIN ET SON ÉCRITURE · inventaire PERMANENT, fiche du
   * compte 31 · entrée D 31 / C 6031, sortie D 6031 / C 31. Le montant de la
   * sortie est celui calculé À LA MAIN par la méthode de l'article, et la
   * fiche le recalcule (contrôlé ensuite).
   */
  const mouvement = async (art, compteStock, exerciceId, date, sens, quantite, valeur, piece) => {
    if (!art) return null;
    const e = await ecriture(c, `Écriture du mouvement ${piece}`, exerciceId, date, `${sens === 'ENTREE' ? 'Entrée' : 'Sortie'} magasin ${piece}`,
      sens === 'ENTREE' ? [[compteStock, valeur, 0], [VARIATION, 0, valeur]] : [[VARIATION, valeur, 0], [compteStock, 0, valeur]], { reference: piece });
    return c.geste(`Mouvement ${piece}`, 'POST', `/magasin/articles/${art.id}/mouvements`, {
      date, sens, quantite, ...(sens === 'ENTREE' ? { cout: valeur } : {}), piece, ecritureId: e?.id,
    });
  };

  /** Une consignation, l'écriture d'ouverture passée par le banc et rattachée. */
  const consigner = async (code, t, sens, nature, designation, date, montant, exerciceId = n) => {
    const r = await c.geste(`Consignation ${code}`, 'POST', '/emballages/consignations', { tiersId: t?.id, sens, nature, designation, quantite: 10, dateConsignation: date, montant });
    if (!r) return null;
    // Fiches des comptes 40 et 41 · ÉMISE, D client / C 4194 ; REÇUE, D 4094 / C fournisseur.
    const attendu = sens === 'EMISE' ? [[t.numero, 'DEBIT'], ['4194', 'CREDIT']] : [['4094', 'DEBIT'], [t.numero, 'CREDIT']];
    const lu = (r.proposition?.lignes ?? []).map((l) => [l.compte, l.sens, l.montant]);
    R.egal(`${code} · écriture d'ouverture proposée`, attendu.map(([a, s]) => [a, s, montant]), lu);
    const lignes = sens === 'EMISE' ? [[t.numero, montant, 0], [DETTE_CONS, 0, montant]] : [[CREANCE_CONS, montant, 0], [t.numero, 0, montant]];
    const e = await ecriture(c, `Écriture d’ouverture ${code}`, exerciceId, date, `Consignation ${designation}`, lignes, { reference: code });
    if (e) await c.geste(`${code} · rattachement de l’ouverture`, 'POST', `/emballages/consignations/${r.consignation.id}/ecritures/ouverture`, { ecritureId: e.id });
    return { id: r.consignation.id, t, sens, montant, code, ecritureId: e?.id ?? null };
  };

  /** Le dénouement au registre, l'écriture attendue passée par le banc et rattachée. */
  const denouer = async (cons, mode, date, lignesAttendues, exerciceId = n, prixDeReprise = undefined) => {
    if (!cons) return null;
    const r = await c.geste(`${cons.code} · dénouement ${mode}`, 'POST', `/emballages/consignations/${cons.id}/denouement`, {
      mode, dateDenouement: date, ...(prixDeReprise !== undefined ? { prixDeReprise } : {}),
    });
    if (!r) return null;
    const lu = (r.proposition?.lignes ?? []).map((l) => [l.compte, l.sens, l.montant]);
    const attendu = lignesAttendues.map(([num, d, cr]) => [num.length === 8 && !num.startsWith(cons.t.numero.slice(0, 4)) ? num.replace(/0+$/, '') : num, d > 0 ? 'DEBIT' : 'CREDIT', d > 0 ? d : cr]);
    R.egal(`${cons.code} · écriture de dénouement proposée (${mode})`, attendu, lu);
    const e = await ecriture(c, `Écriture de dénouement ${cons.code}`, exerciceId, date, `Dénouement ${cons.code}`, lignesAttendues, { reference: `${cons.code}-D` });
    if (e) await c.geste(`${cons.code} · rattachement du dénouement`, 'POST', `/emballages/consignations/${cons.id}/ecritures/denouement`, { ecritureId: e.id });
    return e;
  };

  // --- Février 2026 --------------------------------------------------------------
  await etape(R, '2026 · février · achats, ventes, entrées et sorties de magasin, consignations', async () => {
    // A1 · 200 sacs × 20 000 = 4 000 000 HT, TVA 640 000, TTC 4 640 000.
    ctx.a1 = await facture('Facture d’achat FA-001', { sens: 'ACHAT', numero: 'FA-001', date: '2026-02-02', tiers: F1, lignes: [['Ciment gris 50 kg', 200, 20_000]], compteGestion: ACHATS, journal: ach });
    await controlerEcriture('FA-001', ctx.a1, [[ACHATS, 4_000_000, 0], [TVA_ACHATS, 640_000, 0], [F1.numero, 0, 4_640_000]]);
    await mouvement(ctx.artA, STOCK_A, n, '2026-02-02', 'ENTREE', 200, 4_000_000, 'BE-A1');
    // A2 · 100 sacs × 22 000 = 2 200 000 (TVA 352 000) + 100 barres × 20 000 = 2 000 000
    // (TVA 320 000) · HT 4 200 000, TVA 672 000, TTC 4 872 000 ; un seul compte de charge.
    ctx.a2 = await facture('Facture d’achat FA-002', { sens: 'ACHAT', numero: 'FA-002', date: '2026-02-05', tiers: F1, lignes: [['Ciment gris 50 kg', 100, 22_000], ['Fer à béton 12 mm', 100, 20_000]], compteGestion: ACHATS, journal: ach });
    await controlerEcriture('FA-002', ctx.a2, [[ACHATS, 4_200_000, 0], [TVA_ACHATS, 672_000, 0], [F1.numero, 0, 4_872_000]]);
    await mouvement(ctx.artA, STOCK_A, n, '2026-02-05', 'ENTREE', 100, 2_200_000, 'BE-A2');
    await mouvement(ctx.artB, STOCK_B, n, '2026-02-05', 'ENTREE', 100, 2_000_000, 'BE-B1');
    // A3, A4 · honoraires (63) · TVA récupérable routée au 4454 (services extérieurs).
    ctx.a3 = await facture('Facture d’achat HO-101', { sens: 'ACHAT', numero: 'HO-101', date: '2026-02-10', tiers: F2, lignes: [['Assistance juridique · contrats', 1, 1_500_000]], compteGestion: HONORAIRES, journal: ach });
    await controlerEcriture('HO-101', ctx.a3, [[HONORAIRES, 1_500_000, 0], [TVA_SERVICES, 240_000, 0], [F2.numero, 0, 1_740_000]]);
    await refusAttendu(c, R, 'Facture d’achat reçue à une date à venir', 'POST', '/facturation', {
      sens: 'ACHAT', numeroSerie: 'HO-999', dateFacture: '2026-02-11', dateReception: '2028-03-01', tiersId: F2?.id, autresImpotsEtTaxes: 0,
      lignes: [{ designation: 'Consultation', quantite: 1, prixUnitaire: 100_000, montantHT: 100_000, imposable: true, tauxTvaId: ctx.tva16?.id, tauxApplique: 16, montantTva: 16_000 }],
    }, 400);
    ctx.a4 = await facture('Facture d’achat HO-102', { sens: 'ACHAT', numero: 'HO-102', date: '2026-02-12', tiers: F2, lignes: [['Consultation fiscale', 1, 500_000]], compteGestion: HONORAIRES, journal: ach });
    // V1 · 450 sacs × 20 000 = 9 000 000 HT, TVA 1 440 000, TTC 10 440 000 · toutes mentions servies.
    ctx.v1 = await facture('Facture de vente FV-001', { sens: 'VENTE', numero: 'FV-001', date: '2026-02-15', tiers: C1, lignes: [['Ciment gris 50 kg', 450, 20_000]], compteGestion: VENTES, journal: ven });
    R.egal('FV-001 · mentions de l’art. 26 du décret n° 23/10 toutes servies', true, ctx.v1?.enregistrement?.mentions?.conforme);
    R.egal('FV-001 · texte applicable à la date de la pièce', 'art. 26 du décret n° 23/10', ctx.v1?.enregistrement?.mentions?.texteApplicable?.article);
    R.egal('FV-001 · le numéro du dispositif électronique et le QR hors de portée (document en tenant lieu)', 2, ctx.v1?.enregistrement?.mentions?.horsDePortee?.length);
    R.montant('FV-001 · total TTC de la pièce', 10_440_000, ctx.v1?.enregistrement?.totaux?.montantTTC);
    await controlerEcriture('FV-001', ctx.v1, [[C1.numero, 10_440_000, 0], [VENTES, 0, 9_000_000], [TVA_VENTES, 0, 1_440_000]]);
    // Sortie P.E.P.S. de 150 sacs · couche du 02/02 à 20 000 · 3 000 000.
    await mouvement(ctx.artA, STOCK_A, n, '2026-02-15', 'SORTIE', 150, 3_000_000, 'BS-A1');
    ctx.ce1 = await consigner('CE1', C1, 'EMISE', 'EMBALLAGE', 'Casiers de 24 bouteilles', '2026-02-15', 500_000);
    ctx.cr1 = await consigner('CR1', F3, 'RECUE', 'EMBALLAGE', 'Palettes Europe', '2026-02-20', 600_000);
    await validerJusqua(c, n, '2026-02-28');

    // ÉTAT DÉTAILLÉ DE FÉVRIER (art. 56, décret art. 134) · les achats seuls,
    // ligne à ligne · FA-001 (1), FA-002 (2), HO-101 (1), HO-102 (1) · HT
    // 4 000 000 + 4 200 000 + 1 500 000 + 500 000 = 10 200 000 ; TVA 640 000 +
    // 672 000 + 240 000 + 80 000 = 1 632 000 ; TTC 11 832 000. F2 n'a pas de
    // numéro impôt · ses deux lignes sont incomplètes.
    const etat = await c.lire('État détaillé de février 2026', '/facturation/etat-detaille?periode=2026-02');
    R.egal('état détaillé 02/2026 · cinq lignes d’achat', 5, etat?.lignes?.length);
    R.montant('état détaillé 02/2026 · total HT', 10_200_000, etat?.totalHT);
    R.montant('état détaillé 02/2026 · total TVA', 1_632_000, etat?.totalTva);
    R.montant('état détaillé 02/2026 · total TTC', 11_832_000, etat?.totalTTC);
    R.egal('état détaillé 02/2026 · lignes incomplètes (numéro impôt de F2)', ['HO-101', 'HO-102'], (etat?.incompletudes ?? []).map((x) => x.numeroFacture).sort());
    R.egal('état détaillé 02/2026 · dit incomplet', false, etat?.complet);
    R.egal('état détaillé 02/2026 · volet importations déclaré non couvert', false, etat?.voletImportations?.couvert);
  });

  /** Déclaration du mois, puis liquidation (comptabilisation) et validation. */
  const tvaDuMois = async (mois, attendus, liquider = true) => {
    const [a, m] = mois.split('-').map(Number);
    const debut = `${mois}-01`;
    const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    const d = await c.lire(`Déclaration de TVA ${mois}`, `/taux-tva/declaration?dateDebut=${debut}&dateFin=${fin}`);
    for (const [cle, val] of Object.entries(attendus)) R.montant(`TVA ${mois} · ${cle}`, val, d?.[cle]);
    if (liquider) {
      await c.geste(`Liquidation de la TVA ${mois}`, 'POST', '/taux-tva/declaration/comptabiliser', { exerciceId: n, dateDebut: debut, dateFin: fin, date: fin });
      await validerJusqua(c, n, fin);
    }
    return d;
  };

  // FÉVRIER · collectée FV-001 1 440 000 (livraison de biens, art. 25, 1°) ;
  // déductible FA-001 640 000 + FA-002 672 000 = 1 312 000 (biens, à la
  // facture) ; HO-101 et HO-102 sont des services non payés · rien ;
  // net 1 440 000 − 1 312 000 = 128 000.
  await etape(R, '2026 · TVA de février', () => tvaDuMois('2026-02', { totalCollecte: 1_440_000, totalDeductibleAdmise: 1_312_000, net: 128_000 }));

  // --- Mars 2026 --------------------------------------------------------------
  await etape(R, '2026 · mars · facture incomplète, règlement imputé avec ordre de virement', async () => {
    ctx.ce2 = await consigner('CE2', C1, 'EMISE', 'EMBALLAGE', 'Bouteilles consignées', '2026-03-01', 300_000);
    ctx.cr2 = await consigner('CR2', F3, 'RECUE', 'EMBALLAGE', 'Fûts métalliques', '2026-03-05', 200_000);
    // V2 · 40 barres × 75 000 = 3 000 000 HT, TVA 480 000, TTC 3 480 000 · C3 sans numéro
    // impôt (art. 26 b)) et les autres impôts et taxes NON RÉPONDUS (art. 26 j), « le cas
    // échéant ») · deux mentions manquent, 750 000 FC PAR omission (LPF art. 97 bis).
    ctx.v2 = await facture('Facture de vente FV-002 (mentions incomplètes)', { sens: 'VENTE', numero: 'FV-002', date: '2026-03-10', tiers: C3, lignes: [['Fer à béton 12 mm', 40, 75_000]], compteGestion: VENTES, journal: ven, autresImpots: null });
    const mts = ctx.v2?.enregistrement?.mentions;
    R.egal('FV-002 · non conforme', false, mts?.conforme);
    R.egal('FV-002 · mentions manquantes', ['AUTRES_IMPOTS_ET_TAXES', 'IDENTITE_CLIENT'], (mts?.manquantes ?? []).map((x) => x.cle).sort());
    R.montant('FV-002 · amende unitaire par omission (personne morale, art. 97 bis)', 750_000, mts?.amendeUnitaire);
    await controlerEcriture('FV-002', ctx.v2, [[C3.numero, 3_480_000, 0], [VENTES, 0, 3_000_000], [TVA_VENTES, 0, 480_000]]);
    // Sortie C.M.P.A.C.E. de 40 barres · coût moyen 2 000 000 / 100 = 20 000 · 800 000.
    await mouvement(ctx.artB, STOCK_B, n, '2026-03-10', 'SORTIE', 40, 800_000, 'BS-B1');
    ctx.ce3 = await consigner('CE3', C3, 'EMISE', 'EMBALLAGE', 'Casiers de bière', '2026-03-10', 400_000);
    // ÉCRITURE DEPUIS UNE FACTURE · rien n'est deviné, rien n'est passé deux fois.
    await refusAttendu(c, R, 'FV-001 · seconde comptabilisation', 'POST', `/facturation/${ctx.v1?.id}/comptabiliser`, { journalId: ven.id, compteGestionId: compte(c, VENTES) }, 400, 'déjà liée');
    const f9 = await c.geste('Facture FV-009 portant d’autres impôts et taxes', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'FV-009', dateFacture: '2026-03-20', tiersId: C1?.id, autresImpotsEtTaxes: 10_000,
      lignes: [{ designation: 'Ciment gris 50 kg', quantite: 5, prixUnitaire: 20_000, montantHT: 100_000, imposable: true, tauxTvaId: ctx.tva16?.id, tauxApplique: 16, montantTva: 16_000 }],
    });
    if (f9) {
      await refusAttendu(c, R, 'FV-009 · vente passée au journal des achats', 'POST', `/facturation/${f9.id}/comptabiliser`, { journalId: ach.id, compteGestionId: compte(c, VENTES) }, 400, 'journal de ventes');
      await refusAttendu(c, R, 'FV-009 · vente passée sur un compte de charge', 'POST', `/facturation/${f9.id}/comptabiliser`, { journalId: ven.id, compteGestionId: compte(c, ACHATS) }, 400, 'classe 7');
      await refusAttendu(c, R, 'FV-009 · autres impôts et taxes, écriture à la main', 'POST', `/facturation/${f9.id}/comptabiliser`, { journalId: ven.id, compteGestionId: compte(c, VENTES) }, 400, 'autres impôts');
      const sup = await c.geste('FV-009 · suppression (jamais passée au journal)', 'DELETE', `/facturation/${f9.id}`);
      R.egal('FV-009 · supprimée', true, sup?.supprimee);
    }

    const lA1 = await ligneDuTiers(c, F1, 'FA-001', 'credit');
    const lA2 = await ligneDuTiers(c, F1, 'FA-002', 'credit');
    const lA3 = await ligneDuTiers(c, F2, 'HO-101', 'credit');
    const lA4 = await ligneDuTiers(c, F2, 'HO-102', 'credit');
    ctx.lA3 = lA3;
    ctx.lA4 = lA4;
    const corps = {
      sens: 'FOURNISSEUR', exerciceId: n, journalId: bq?.id, date: '2026-03-15', ordreVirement: true,
      reglements: [
        { compteId: F1?.compteId, ligneIds: [lA1?.id, lA2?.id].filter(Boolean) },
        // Code civil, Livre III, art. 151 · le dossier qui paie déclare ce qu'il
        // acquitte · HO-102 en entier (580 000), HO-101 pour 870 000 · 1 450 000.
        { compteId: F2?.compteId, ligneIds: [lA3?.id, lA4?.id].filter(Boolean), montant: 1_450_000, imputation: [{ ligneId: lA4?.id, montant: 580_000 }, { ligneId: lA3?.id, montant: 870_000 }] },
      ],
    };
    // TOUT SE VÉRIFIE AVANT LA PREMIÈRE PIÈCE · F2 n'a pas encore de RIB principal ·
    // l'ordre est refusé et AUCUNE pièce ne passe, pas même celle de F1.
    await refusAttendu(c, R, 'Règlement avec ordre de virement · F2 sans RIB', 'POST', '/reglements', corps, 400, 'RIB principal');
    const ouvertesF1 = (await lignesDuTiers(c, F1, true)).lignes.filter((l) => Number(l.credit) > 0);
    R.egal('après le refus · les deux factures de F1 restent ouvertes (aucune pièce passée)', 2, ouvertesF1.length);
    await c.geste('RIB de F2 (IBAN)', 'POST', `/tiers/${F2?.id}/ribs`, { banque: 'Rawbank', iban: IBAN_F2 });
    // L'IMPUTATION DU DOSSIER QUI PAIE (art. 151) · les refus, avant toute pièce.
    const regF2 = (imputation, extra = {}) => ({ sens: 'FOURNISSEUR', exerciceId: n, journalId: bq?.id, date: '2026-03-15', ...extra, reglements: [{ compteId: F2?.compteId, ligneIds: [lA3?.id, lA4?.id], montant: 1_450_000, imputation }] });
    await refusAttendu(c, R, 'Imputation dont la somme diffère du montant réglé', 'POST', '/reglements', regF2([{ ligneId: lA4?.id, montant: 580_000 }, { ligneId: lA3?.id, montant: 800_000 }], { ordreVirement: true }), 400, 'diffère');
    await refusAttendu(c, R, 'Imputation dont une part dépasse le dû', 'POST', '/reglements', regF2([{ ligneId: lA4?.id, montant: 600_000 }, { ligneId: lA3?.id, montant: 850_000 }], { ordreVirement: true }), 400, 'dépasse');
    await refusAttendu(c, R, 'Imputation ni imprimée sur un ordre ni notifiée par une pièce', 'POST', '/reglements', regF2([{ ligneId: lA4?.id, montant: 580_000 }, { ligneId: lA3?.id, montant: 870_000 }]), 400, 'art. 151');
    await refusAttendu(c, R, 'Imputation désignée par le cabinet côté client', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n, journalId: bq?.id, date: '2026-03-15', reglements: [{ compteId: C1?.compteId, ligneIds: [(await ligneDuTiers(c, C1, 'FV-001', 'debit'))?.id], montant: 1_000_000, imputation: [{ ligneId: (await ligneDuTiers(c, C1, 'FV-001', 'debit'))?.id, montant: 1_000_000 }] }],
    }, 400, 'Côté client');
    const reg = await c.geste('Règlement des fournisseurs du 15/03 avec ordre de virement', 'POST', '/reglements', corps);
    ctx.ordre1 = reg?.ordre;
    // F1 · 4 640 000 + 4 872 000 = 9 512 000 ; F2 · 1 450 000 ; total 10 962 000.
    R.montant('ordre n° 1 · total', 10_962_000, reg?.ordre?.total);
    R.egal('ordre n° 1 · numéro', 1, reg?.ordre?.numero);
    if (ctx.ordre1) {
      const o = await c.lire('Ordre n° 1', `/ordres-virement/${ctx.ordre1.id}`);
      R.egal('ordre n° 1 · en attente d’impression', 'A_IMPRIMER', o?.statut);
      R.egal('ordre n° 1 · deux bénéficiaires', 2, o?.lignes?.length);
      const lF1 = (o?.lignes ?? []).find((l) => l.tiersId === F1?.id);
      const lF2 = (o?.lignes ?? []).find((l) => l.tiersId === F2?.id);
      R.montant('ordre n° 1 · F1', 9_512_000, lF1?.montant);
      R.egal('ordre n° 1 · F1 · coordonnées du RIB principal (IBAN)', true, String(lF1?.coordonnees ?? '').replace(/\s/g, '').includes(IBAN_F1));
      R.montant('ordre n° 1 · F2', 1_450_000, lF2?.montant);
      const imp = String(lF2?.imputationDeclaree ?? '').replace(/\s/g, '');
      R.egal('ordre n° 1 · F2 · l’imputation déclarée est imprimée (art. 151)', true, imp.includes('580000,00') && imp.includes('870000,00'));
      R.egal('ordre n° 1 · donneur · RIB du journal BQ', true, String(o?.donneurCoordonnees ?? '').replace(/\s/g, '').includes(IBAN_DOSSIER));
      const i1 = await c.geste('Ordre n° 1 · impression', 'POST', `/ordres-virement/${ctx.ordre1.id}/impression`);
      R.egal('ordre n° 1 · imprimé', ['IMPRIME', 1], [i1?.statut, i1?.nombreImpressions]);
      const i2 = await c.geste('Ordre n° 1 · réimpression (duplicata)', 'POST', `/ordres-virement/${ctx.ordre1.id}/impression`);
      R.egal('ordre n° 1 · duplicata · état inchangé, compteur à deux', ['IMPRIME', 2], [i2?.statut, i2?.nombreImpressions]);
    }
    // Chaque part lettrée avec SA facture · HO-102 soldée, HO-101 en partiel.
    const lf2 = (await lignesDuTiers(c, F2)).lignes;
    const ho101 = lf2.find((l) => l.reference === 'HO-101');
    const ho102 = lf2.find((l) => l.reference === 'HO-102');
    R.egal('F2 · HO-102 lettrée (soldée par sa part)', true, Boolean(ho102?.lettre));
    R.egal('F2 · HO-101 en lettrage partiel (870 000 sur 1 740 000)', [null, true], [ho101?.lettre ?? null, Boolean(ho101?.lettrageId)]);

    // C1 paie FV-001 en entier le 31/03.
    const lV1 = await ligneDuTiers(c, C1, 'FV-001', 'debit');
    await c.geste('Encaissement de FV-001', 'POST', '/reglements', { sens: 'CLIENT', exerciceId: n, journalId: bq?.id, date: '2026-03-31', reglements: [{ compteId: C1?.compteId, ligneIds: [lV1?.id] }] });
    await validerJusqua(c, n, '2026-03-31');
  });

  // MARS · collectée FV-002 480 000 ; déductible · HO-102 payée en entier
  // (80 000) et HO-101 pour 870 000 sur 1 740 000 TTC · 240 000 × 870 000 /
  // 1 740 000 = 120 000 (services, à l'encaissement, art. 25, 2° ; décret
  // art. 96) · 200 000 ; net 280 000.
  await etape(R, '2026 · TVA de mars', () => tvaDuMois('2026-03', { totalCollecte: 480_000, totalDeductibleAdmise: 200_000, net: 280_000 }));

  // --- Avril 2026 -------------------------------------------------------------
  await etape(R, '2026 · avril · note de crédit, sortie à cheval sur deux couches, refus du magasin', async () => {
    ctx.ce4 = await consigner('CE4', C1, 'EMISE', 'MATERIEL', 'Citerne inox 5 000 litres', '2026-04-01', 1_000_000);
    ctx.cr3 = await consigner('CR3', F3, 'RECUE', 'EMBALLAGE', 'Caisses en bois', '2026-04-05', 350_000);
    // V3 · 40 sacs × 25 000 = 1 000 000 HT, TVA 160 000, TTC 1 160 000.
    ctx.v3 = await facture('Facture de vente FV-003', { sens: 'VENTE', numero: 'FV-003', date: '2026-04-20', tiers: C1, lignes: [['Ciment gris 50 kg', 40, 25_000]], compteGestion: VENTES, journal: ven });
    // Sortie P.E.P.S. de 80 sacs le 20/04 · reste de la couche du 02/02 (200 − 150 = 50 à
    // 20 000 = 1 000 000) puis 30 de la couche du 05/02 à 22 000 (660 000) · 1 660 000.
    await mouvement(ctx.artA, STOCK_A, n, '2026-04-20', 'SORTIE', 80, 1_660_000, 'BS-A2');
    // NOTE DE CRÉDIT (décret n° 011/42, art. 127) · elle annule et remplace FV-003.
    await refusAttendu(c, R, 'Note de crédit antérieure à la facture qu’elle annule', 'POST', `/facturation/${ctx.v3?.id}/note-de-credit`, { numeroSerie: 'AV-000', dateNote: '2026-04-19' }, 400, 'antérieure');
    const nc = await c.geste('Note de crédit AV-001 annulant FV-003', 'POST', `/facturation/${ctx.v3?.id}/note-de-credit`, { numeroSerie: 'AV-001', dateNote: '2026-04-25' });
    R.montant('AV-001 · reprend la facture entière (TTC)', 1_160_000, nc?.totaux?.montantTTC);
    await refusAttendu(c, R, 'Seconde note de crédit sur FV-003', 'POST', `/facturation/${ctx.v3?.id}/note-de-credit`, { numeroSerie: 'AV-002', dateNote: '2026-04-26' }, 400, 'déjà annulée');
    if (nc) {
      const cp = await c.geste('AV-001 · comptabilisation', 'POST', `/facturation/${nc.id}/comptabiliser`, { journalId: ven.id, compteGestionId: compte(c, VENTES) });
      // L'inverse exact de FV-003 · D 701 1 000 000, D 4431 160 000 / C client 1 160 000.
      await controlerEcriture('AV-001', { ecritureId: cp?.ecritureId, numero: 'AV-001', exerciceId: n }, [[C1.numero, 0, 1_160_000], [VENTES, 1_000_000, 0], [TVA_VENTES, 160_000, 0]]);
    }
    await refusAttendu(c, R, 'Suppression de FV-003 (annulée et passée au journal)', 'DELETE', `/facturation/${ctx.v3?.id}`, undefined, 400);
    const liste = await c.lire('Facturier d’avril', '/facturation?du=2026-04-01&au=2026-04-30');
    const fv3 = (liste?.factures ?? []).find((f) => f.id === ctx.v3?.id);
    R.egal('FV-003 · barrée par la note (art. 127)', [true, 'AV-001'], [fv3?.barree, fv3?.noteDeCredit?.numeroSerie]);
    // La facture et sa note se lettrent entre elles.
    const lV3 = await ligneDuTiers(c, C1, 'FV-003', 'debit');
    const lAv = await ligneDuTiers(c, C1, 'AV-001', 'credit');
    if (lV3 && lAv) await lettrer(c, C1.numero, [lV3.id, lAv.id]);
    // LE MAGASIN NE DESCEND JAMAIS SOUS ZÉRO · 70 sacs en stock (300 − 150 − 80).
    await refusAttendu(c, R, 'Sortie de 100 sacs pour 70 en stock', 'POST', `/magasin/articles/${ctx.artA?.id}/mouvements`, { date: '2026-05-01', sens: 'SORTIE', quantite: 100, piece: 'BS-A9' }, 400, 'ne descend pas sous zéro');
    // Une sortie ne porte jamais son coût, elle le calcule.
    await refusAttendu(c, R, 'Sortie saisie avec un coût', 'POST', `/magasin/articles/${ctx.artA?.id}/mouvements`, { date: '2026-05-01', sens: 'SORTIE', quantite: 10, cout: 200_000, piece: 'BS-A8' }, 400, 'se CALCULE');
    // Annuler l'entrée du 05/02 rendrait impossible la sortie de 80 du 20/04 (50 en stock).
    const fiche = await c.lire('Fiche de l’article A', `/magasin/articles/${ctx.artA?.id}/fiche`);
    const e2 = (fiche?.lignes ?? []).find((l) => l.piece === 'BE-A2');
    await refusAttendu(c, R, 'Annulation de l’entrée qui servait une sortie', 'POST', `/magasin/articles/${ctx.artA?.id}/mouvements/${e2?.id}/annulation`, { motif: 'Essai' }, 400, 'rendrait impossible');
    await validerJusqua(c, n, '2026-04-30');
  });

  // AVRIL · collectée FV-003 160 000 ; l'avoir AV-001 (débit du 4431) est
  // CONSTATÉ en avril et inscrit en déduction du MOIS SUIVANT (décret n° 011/42,
  // art. 126) · net d'avril 160 000.
  await etape(R, '2026 · TVA d’avril', () => tvaDuMois('2026-04', { totalCollecte: 160_000, avoirsCollecteConstates: 160_000, totalDeductibleAdmise: 0, net: 160_000 }));

  // --- Mai 2026 ---------------------------------------------------------------
  await etape(R, '2026 · mai · prestation et vente au même client, paiement partiel, imputation déclarée', async () => {
    ctx.cr4 = await consigner('CR4', F3, 'RECUE', 'MATERIEL', 'Rayonnage métallique', '2026-05-05', 800_000);
    // S1 · prestation (706) 1 000 000, TVA 160 000 routée au 4432, TTC 1 160 000.
    ctx.s1 = await facture('Facture de prestation FP-001', { sens: 'VENTE', numero: 'FP-001', date: '2026-05-05', tiers: C2, lignes: [['Entreposage frigorifique · mai', 1, 1_000_000]], compteGestion: SERVICES, journal: ven });
    await controlerEcriture('FP-001', ctx.s1, [[C2.numero, 1_160_000, 0], [SERVICES, 0, 1_000_000], [TVA_PRESTATIONS, 0, 160_000]]);
    // S2 · vente (701) 29 × 20 000 = 580 000, TVA 92 800, TTC 672 800.
    ctx.s2 = await facture('Facture de vente FV-004', { sens: 'VENTE', numero: 'FV-004', date: '2026-05-06', tiers: C2, lignes: [['Ciment blanc', 29, 20_000]], compteGestion: VENTES, journal: ven });
    // Une entrée erronée (10 sacs à 250 000), annulée avec son motif.
    const e3 = await c.geste('Mouvement BE-A9 (erroné)', 'POST', `/magasin/articles/${ctx.artA?.id}/mouvements`, { date: '2026-05-10', sens: 'ENTREE', quantite: 10, cout: 250_000, piece: 'BE-A9' });
    if (e3) {
      const an = await c.geste('Annulation de BE-A9', 'POST', `/magasin/articles/${ctx.artA?.id}/mouvements/${e3.id}/annulation`, { motif: 'Bon d’entrée saisi deux fois' });
      R.egal('BE-A9 · annulé, aucune écriture à corriger', [true, false], [an?.annule, an?.ecritureACorriger]);
    }
    // Encaissement partiel de 1 160 000 sur FP-001 et FV-004 (1 832 800 dus).
    const lS1 = await ligneDuTiers(c, C2, 'FP-001', 'debit');
    const lS2 = await ligneDuTiers(c, C2, 'FV-004', 'debit');
    ctx.lS1 = lS1;
    ctx.lS2 = lS2;
    const reg = await c.geste('Encaissement partiel de C2', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: n, journalId: bq?.id, date: '2026-05-20', reglements: [{ compteId: C2?.compteId, ligneIds: [lS1?.id, lS2?.id], montant: 1_160_000 }],
    });
    R.egal('encaissement partiel de C2 · l’imputation légale est dite (art. 154)', true, (reg?.avertissements ?? []).some((a) => a.includes('art. 154')));
    R.egal('encaissement partiel de C2 · partiel', true, reg?.reglements?.[0]?.partiel);
    const lc2 = (await lignesDuTiers(c, C2)).lignes;
    ctx.lPaiementC2 = lc2.find((l) => String(l.date).slice(0, 10) === '2026-05-20' && Number(l.credit) === 1_160_000);
    await denouer(ctx.cr2, 'RESTITUTION', '2026-05-31', [[F3.numero, 200_000, 0], [CREANCE_CONS, 0, 200_000]]);
    await validerJusqua(c, n, '2026-05-31');
    const lCr2 = await ligneDuTiers(c, F3, 'CR2', 'credit');
    const lCr2d = await ligneDuTiers(c, F3, 'CR2-D', 'debit');
    if (lCr2 && lCr2d) await lettrer(c, F3.numero, [lCr2.id, lCr2d.id]);
  });

  // MAI · AVANT LA DÉCLARATION D'IMPUTATION · l'art. 154 impute le paiement du
  // 20/05 sur la dette ÉCHUE la plus ANCIENNE · FP-001 (05/05) avant FV-004
  // (06/05), toutes deux échues (sans échéance, dès leur facture) · FP-001
  // reçoit 1 160 000, sa taxe entière (160 000) devient exigible. Collectée ·
  // FV-004 92 800 (biens, à la facture) + 160 000 = 252 800 ; l'avoir d'avril
  // (160 000) est inscrit en déduction (art. 126).
  await etape(R, '2026 · TVA de mai avant l’imputation déclarée', () => tvaDuMois('2026-05', { totalCollecte: 252_800, recuperationArt52: 160_000 }, false));

  await etape(R, '2026 · imputation déclarée du paiement de C2 (art. 151 et 153)', async () => {
    const base = { ligneReglementId: ctx.lPaiementC2?.id, factures: [{ ligneFactureId: ctx.lS2?.id, montant: 672_800 }, { ligneFactureId: ctx.lS1?.id, montant: 487_200 }] };
    // Art. 151 · le débiteur déclare « lorsqu'il paye » · une pièce du 25/05 est postérieure.
    await refusAttendu(c, R, 'Déclaration du débiteur postérieure au paiement', 'POST', '/imputations-paiements', { ...base, fondement: 'DECLARATION_DU_DEBITEUR', pieceReference: 'Lettre du client', pieceDate: '2026-05-25' }, 400, 'art. 151');
    // Art. 153 · la quittance constate ce que le créancier « a reçu » · jamais avant le paiement.
    await refusAttendu(c, R, 'Quittance antérieure au paiement', 'POST', '/imputations-paiements', { ...base, fondement: 'QUITTANCE_ACCEPTEE', pieceReference: 'Quittance Q-0520', pieceDate: '2026-05-19', preuveAcceptation: 'Quittance contresignée' }, 400, 'art. 153');
    await refusAttendu(c, R, 'Quittance sans preuve de son acceptation', 'POST', '/imputations-paiements', { ...base, fondement: 'QUITTANCE_ACCEPTEE', pieceReference: 'Quittance Q-0521', pieceDate: '2026-05-21' }, 400, 'acceptation');
    const ok = await c.geste('Imputation déclarée · quittance acceptée', 'POST', '/imputations-paiements', {
      ...base, fondement: 'QUITTANCE_ACCEPTEE', pieceReference: 'Quittance Q-0521', pieceDate: '2026-05-21', preuveAcceptation: 'Quittance Q-0521 contresignée par le client le 22/05/2026',
    });
    R.egal('imputation déclarée · deux parts enregistrées', 2, ok?.imputations?.length);
    const g = await c.lire('Groupe du paiement de C2', `/imputations-paiements/groupe/${ctx.lPaiementC2?.id}`);
    R.egal('groupe du paiement · servi (deux factures, un paiement, non lu en bloc)', [2, 1, null], [g?.factures?.length, g?.paiements?.length, g?.nonServi ?? null]);
    ctx.declarationC2 = base;
  });

  // MAI · APRÈS LA DÉCLARATION · FV-004 reçoit 672 800 (sa taxe était déjà
  // exigible à la facture), FP-001 reçoit 487 200 · taxe exigible 160 000 ×
  // 487 200 / 1 160 000 = 67 200. Collectée 92 800 + 67 200 = 160 000 ;
  // récupération de l'avoir 160 000 ; net 0.
  await etape(R, '2026 · TVA de mai après l’imputation déclarée', () => tvaDuMois('2026-05', { totalCollecte: 160_000, recuperationArt52: 160_000, net: 0 }));

  // --- Juin à septembre 2026 -----------------------------------------------------
  await etape(R, '2026 · juin et juillet · achats, partiel sans parts (art. 154), ordre annulé', async () => {
    // A5 · 50 sacs × 24 000 = 1 200 000, TVA 192 000, TTC 1 392 000.
    ctx.a5 = await facture('Facture d’achat FA-005', { sens: 'ACHAT', numero: 'FA-005', date: '2026-06-05', tiers: F1, lignes: [['Ciment gris 50 kg', 50, 24_000]], compteGestion: ACHATS, journal: ach });
    await mouvement(ctx.artA, STOCK_A, n, '2026-06-05', 'ENTREE', 50, 1_200_000, 'BE-A3');
    // A6 · 30 barres × 23 000 = 690 000, TVA 110 400, TTC 800 400.
    ctx.a6 = await facture('Facture d’achat FA-006', { sens: 'ACHAT', numero: 'FA-006', date: '2026-06-08', tiers: F1, lignes: [['Fer à béton 12 mm', 30, 23_000]], compteGestion: ACHATS, journal: ach });
    await mouvement(ctx.artB, STOCK_B, n, '2026-06-08', 'ENTREE', 30, 690_000, 'BE-B2');
    // A7 · 5 sacs × 20 000 = 100 000, TVA 16 000 · commande annulée avant livraison,
    // NOTE DE CRÉDIT REÇUE du fournisseur le 25/06 (décret n° 011/42, art. 127).
    ctx.a7 = await facture('Facture d’achat FA-007', { sens: 'ACHAT', numero: 'FA-007', date: '2026-06-20', tiers: F1, lignes: [['Ciment gris 50 kg', 5, 20_000]], compteGestion: ACHATS, journal: ach });
    const ncf = ctx.a7 && (await c.geste('Note de crédit reçue AVF-001', 'POST', `/facturation/${ctx.a7.id}/note-de-credit`, { numeroSerie: 'AVF-001', dateNote: '2026-06-25', dateReception: '2026-06-25' }));
    if (ncf) {
      const cp = await c.geste('AVF-001 · comptabilisation', 'POST', `/facturation/${ncf.id}/comptabiliser`, { journalId: ach.id, compteGestionId: compte(c, ACHATS) });
      // L'inverse de FA-007 · D F1 116 000 / C 601 100 000 / C 4452 16 000 (reprise de la déduction).
      await controlerEcriture('AVF-001', { ecritureId: cp?.ecritureId, numero: 'AVF-001', exerciceId: n }, [[F1.numero, 116_000, 0], [ACHATS, 0, 100_000], [TVA_ACHATS, 0, 16_000]]);
      const lA7 = await ligneDuTiers(c, F1, 'FA-007', 'credit');
      const lNc = await ligneDuTiers(c, F1, 'AVF-001', 'debit');
      if (lA7 && lNc) await lettrer(c, F1.numero, [lA7.id, lNc.id]);
    }
    // Restitution des casiers de CE1 · D 4194 / C client, puis lettrage avec l'ouverture.
    await denouer(ctx.ce1, 'RESTITUTION', '2026-06-30', [[DETTE_CONS, 500_000, 0], [C1.numero, 0, 500_000]]);
    const lCe1 = await ligneDuTiers(c, C1, 'CE1', 'debit');
    const lCe1d = await ligneDuTiers(c, C1, 'CE1-D', 'credit');
    if (lCe1 && lCe1d) await lettrer(c, C1.numero, [lCe1.id, lCe1d.id]);
    await validerJusqua(c, n, '2026-06-30');
    // ÉTAT DÉTAILLÉ DE JUIN · FA-005 et FA-006 · HT 1 200 000 + 690 000 = 1 890 000,
    // TVA 192 000 + 110 400 = 302 400 ; FA-007, barrée par une note DU MOIS, sort des
    // lignes et des totaux et se montre à part.
    const etat = await c.lire('État détaillé de juin 2026', '/facturation/etat-detaille?periode=2026-06');
    R.egal('état détaillé 06/2026 · deux lignes, une facture barrée écartée des totaux', [2, ['FA-007', true]], [etat?.lignes?.length, [etat?.facturesAnnulees?.[0]?.numeroFacture, etat?.facturesAnnulees?.[0]?.ecarteeDesTotaux]]);
    R.montant('état détaillé 06/2026 · total HT', 1_890_000, etat?.totalHT);
    R.montant('état détaillé 06/2026 · total TVA', 302_400, etat?.totalTva);
    await refusAttendu(c, R, 'État détaillé sur une période illisible', 'GET', '/facturation/etat-detaille?periode=2026-13', undefined, 400, 'AAAA-MM');
    // JUIN (lu, non liquidé) · déductible 192 000 + 110 400 + 16 000 − 16 000 (l'avoir
    // fournisseur reprend la déduction à sa constatation, décret art. 127) = 302 400.
    await tvaDuMois('2026-06', { totalCollecte: 0, totalDeductibleAdmise: 302_400 }, false);
    // LA LIQUIDATION DE MAI GARDE CE QU'ELLE A DÉCLARÉ · retirer l'imputation déclarée
    // rend l'art. 154 · FP-001 reçoit 1 160 000, sa taxe exigible passe de 67 200 à
    // 160 000 · les 92 800 d'écart sont portés au premier jour non liquidé (01/06).
    if (ctx.lPaiementC2) {
      const ret = await c.geste('Retrait de l’imputation déclarée du paiement de C2', 'POST', `/imputations-paiements/${ctx.lPaiementC2.id}/retirer`, { motif: 'Quittance contestée par le client' });
      R.egal('retrait · deux parts retirées, effet porté au 01/06', [2, '2026-06-01'], [ret?.retirees, String(ret?.liquidation?.premierJourLibre ?? '').slice(0, 10)]);
      R.montant('retrait · collecte portée au premier jour non liquidé', 92_800, ret?.liquidation?.collecte);
      await tvaDuMois('2026-06', { totalCollecte: 92_800 }, false);
      const re = await c.geste('Nouvelle déclaration de l’imputation (quittance acceptée)', 'POST', '/imputations-paiements', {
        ...ctx.declarationC2, fondement: 'QUITTANCE_ACCEPTEE', pieceReference: 'Quittance Q-0521', pieceDate: '2026-05-21', preuveAcceptation: 'Quittance Q-0521 contresignée par le client le 22/05/2026',
      });
      R.montant('nouvelle déclaration · collecte reprise au premier jour non liquidé', -92_800, re?.liquidation?.collecte);
      await tvaDuMois('2026-06', { totalCollecte: 0 }, false);
    }
    // PARTIEL SUR DEUX FACTURES SANS PARTS · 1 500 000 sur 2 192 400 dus (1 392 000 +
    // 800 400) · l'art. 154 l'impute, et c'est dit.
    const lA5 = await ligneDuTiers(c, F1, 'FA-005', 'credit');
    const lA6 = await ligneDuTiers(c, F1, 'FA-006', 'credit');
    ctx.lA5 = lA5;
    ctx.lA6 = lA6;
    const reg = await c.geste('Règlement partiel de F1 avec ordre de virement', 'POST', '/reglements', {
      sens: 'FOURNISSEUR', exerciceId: n, journalId: bq?.id, date: '2026-07-10', ordreVirement: true,
      reglements: [{ compteId: F1?.compteId, ligneIds: [lA5?.id, lA6?.id], montant: 1_500_000 }],
    });
    R.egal('partiel sans parts · imputation légale dite (art. 154)', true, (reg?.avertissements ?? []).some((a) => a.includes('art. 154')));
    R.egal('ordre n° 2 · numéro continu', 2, reg?.ordre?.numero);
    R.montant('ordre n° 2 · total', 1_500_000, reg?.ordre?.total);
    if (reg?.ordre) {
      await refusAttendu(c, R, 'Annulation de l’ordre n° 2 sans motif', 'POST', `/ordres-virement/${reg.ordre.id}/annulation`, { motif: '' }, 400);
      const an = await c.geste('Annulation de l’ordre n° 2', 'POST', `/ordres-virement/${reg.ordre.id}/annulation`, { motif: 'Virement rejeté par la banque, réglé par chèque' });
      R.egal('ordre n° 2 · annulé avec son motif', ['ANNULE', 'Virement rejeté par la banque, réglé par chèque'], [an?.statut, an?.motifAnnulation]);
      await refusAttendu(c, R, 'Impression d’un ordre annulé', 'POST', `/ordres-virement/${reg.ordre.id}/impression`, undefined, 400, 'annulé');
      await refusAttendu(c, R, 'Seconde annulation de l’ordre n° 2', 'POST', `/ordres-virement/${reg.ordre.id}/annulation`, { motif: 'Encore' }, 400, 'déjà annulé');
      // Les pièces libérées ne sont pas défaites · le règlement reste au journal.
      const lf1 = (await lignesDuTiers(c, F1)).lignes;
      R.egal('après l’annulation de l’ordre · la pièce du 10/07 reste au compte de F1', true, lf1.some((l) => String(l.date).slice(0, 10) === '2026-07-10' && Number(l.debit) === 1_500_000));
    }
    // Conservation des bouteilles de CE2 (emballage) · D 4194 / C 7074.
    await denouer(ctx.ce2, 'CONSERVATION', '2026-07-31', [[DETTE_CONS, 300_000, 0], [BONI_EMB, 0, 300_000]]);
    // Conservation de la citerne de CE4 (MATÉRIEL) · une CESSION, refusée ici.
    const p = await c.lire('CE4 · proposition de conservation', `/emballages/consignations/${ctx.ce4?.id}/denouement?mode=CONSERVATION`);
    R.egal('CE4 · conservation d’un matériel · refus « cession d’immobilisation »', 'CESSION_IMMOBILISATION_HORS_MODULE', p?.refus?.motif);
    await refusAttendu(c, R, 'CE4 · dénouement par conservation d’un matériel', 'POST', `/emballages/consignations/${ctx.ce4?.id}/denouement`, { mode: 'CONSERVATION', dateDenouement: '2026-07-31' }, 400, 'CESSION');
    // Une consignation saisie à tort se retire tant que rien ne la tient · une écriture qui
    // ne passe pas ce qu'elle propose ne s'y rattache pas.
    const ce5 = await c.geste('Consignation CE5 (saisie à tort)', 'POST', '/emballages/consignations', { tiersId: C2?.id, sens: 'EMISE', nature: 'EMBALLAGE', designation: 'Seaux', quantite: 5, dateConsignation: '2026-07-15', montant: 50_000 });
    if (ce5) {
      await refusAttendu(c, R, 'CE5 · rattachement d’une écriture qui passe autre chose', 'POST', `/emballages/consignations/${ce5.consignation.id}/ecritures/ouverture`, { ecritureId: ctx.ce1?.ecritureId }, 400, 'il lui manque');
      const sup = await c.geste('CE5 · retrait de la consignation', 'DELETE', `/emballages/consignations/${ce5.consignation.id}`);
      R.egal('CE5 · retirée du registre', true, sup?.supprimee);
    }
    await refusAttendu(c, R, 'CE4 · retrait d’une consignation rattachée à son écriture', 'DELETE', `/emballages/consignations/${ctx.ce4?.id}`, undefined, 400, 'rattachée');
    await refusAttendu(c, R, 'CE1 · détachement d’une écriture validée', 'DELETE', `/emballages/consignations/${ctx.ce1?.id}/ecritures/ouverture`, undefined, 400, 'validée');
    // DONNEUR EN MONNAIE DE TENUE · un règlement sur le journal dont le RIB est tenu en USD est refusé.
    const lHo101 = await ligneDuTiers(c, F2, 'HO-101', 'credit');
    if (ctx.bqd) {
      await refusAttendu(c, R, 'Règlement en francs avec ordre sur le journal au RIB en dollars', 'POST', '/reglements', {
        sens: 'FOURNISSEUR', exerciceId: n, journalId: ctx.bqd.id, date: '2026-07-20', ordreVirement: true, reglements: [{ compteId: F2?.compteId, ligneIds: [lHo101?.id], montant: 870_000 }],
      }, 400, 'USD');
    }
    await validerJusqua(c, n, '2026-07-31');
  });

  await etape(R, '2026 · août · lot de virements récurrents', async () => {
    await refusAttendu(c, R, 'Lot portant un compte client', 'POST', '/lots-virement', { nom: 'Lot faux', journalId: bq?.id, lignes: [{ compteId: C1?.compteId, montant: 100_000 }] }, 400, 'fournisseur réglable');
    await refusAttendu(c, R, 'Lot portant le 4091 (avances versées)', 'POST', '/lots-virement', { nom: 'Lot faux', journalId: bq?.id, lignes: [{ compteId: compte(c, '40910000'), montant: 100_000 }] }, 400, 'fournisseur réglable');
    await refusAttendu(c, R, 'Lot portant deux fois le même fournisseur', 'POST', '/lots-virement', { nom: 'Lot faux', journalId: bq?.id, lignes: [{ compteId: F1?.compteId, montant: 100_000 }, { compteId: F1?.compteId, montant: 50_000 }] }, 400, 'qu’une fois');
    const lot = await c.geste('Lot « Fournisseurs du mois »', 'POST', '/lots-virement', { nom: 'Fournisseurs du mois', journalId: bq?.id, lignes: [{ compteId: F1?.compteId, montant: 250_000 }, { compteId: F3?.compteId, montant: 200_000 }] });
    if (lot) await c.geste('Lot · montant de F1 porté à 300 000', 'PATCH', `/lots-virement/${lot.id}`, { nom: 'Fournisseurs réguliers', journalId: bq?.id, lignes: [{ compteId: F1?.compteId, montant: 300_000 }, { compteId: F3?.compteId, montant: 200_000 }] });
    const lots = (await c.lire('Lots de virement', '/lots-virement')) ?? [];
    R.egal('lot relu · nom et montants habituels', ['Fournisseurs réguliers', [300_000, 200_000]], [lots[0]?.nom, (lots[0]?.lignes ?? []).map((l) => l.montant)]);
    // LE LOT PRÉSÉLECTIONNE, il ne paie rien · « plus anciennes d'abord jusqu'au
    // montant habituel, dernière en partiel ». F1 · le groupe partiel FA-005 / FA-006
    // (reste 692 400) reçoit 300 000. F3 · ouvertes CR1 (20/02, 600 000), CR3, CR4 ·
    // la plus ancienne, CR1, reçoit 200 000 en partiel.
    const lCr1 = await ligneDuTiers(c, F3, 'CR1', 'credit');
    ctx.lCr1 = lCr1;
    const reg = await c.geste('Règlement du lot du 10/08 avec ordre de virement', 'POST', '/reglements', {
      sens: 'FOURNISSEUR', exerciceId: n, journalId: bq?.id, date: '2026-08-10', ordreVirement: true,
      reglements: [
        { compteId: F1?.compteId, ligneIds: [ctx.lA5?.id, ctx.lA6?.id], montant: 300_000 },
        { compteId: F3?.compteId, ligneIds: [lCr1?.id], montant: 200_000 },
      ],
    });
    R.egal('ordre n° 3 · numéro continu (l’annulé garde le sien)', 3, reg?.ordre?.numero);
    R.montant('ordre n° 3 · total du lot', 500_000, reg?.ordre?.total);
    if (reg?.ordre) {
      const o = await c.geste('Ordre n° 3 · impression', 'POST', `/ordres-virement/${reg.ordre.id}/impression`);
      R.egal('ordre n° 3 · F3 payé sur son RIB national', true, (o?.lignes ?? []).some((l) => l.tiersId === F3?.id && String(l.coordonnees).includes('12345678901')));
    }
    const ordres = await c.lire('Liste des ordres', '/ordres-virement');
    R.egal('ordres · trois au total, aucun à imprimer', [3, 0], [ordres?.total, ordres?.enAttenteImpression]);
    const annules = await c.lire('Ordres annulés', '/ordres-virement?statut=ANNULE');
    R.egal('ordres · filtre par état · un annulé', [1, 2], [annules?.total, annules?.ordres?.[0]?.numero]);
    await refusAttendu(c, R, 'Ordres · état inconnu', 'GET', '/ordres-virement?statut=PERDU', undefined, 400);
    const tmp = await c.geste('Lot temporaire', 'POST', '/lots-virement', { nom: 'Lot temporaire', lignes: [{ compteId: F3?.compteId, montant: 10_000 }] });
    if (tmp) {
      const sup = await c.geste('Lot temporaire · suppression', 'DELETE', `/lots-virement/${tmp.id}`);
      R.egal('lot temporaire supprimé · un seul lot reste', [true, 1], [sup?.supprime, ((await c.lire('Lots après suppression', '/lots-virement')) ?? []).length]);
    }
    // Conservation des palettes de CR1 (emballage reçu) · D 6082 / C 4094.
    await denouer(ctx.cr1, 'CONSERVATION', '2026-08-31', [[ACHAT_EMB, 600_000, 0], [CREANCE_CONS, 0, 600_000]]);
    await validerJusqua(c, n, '2026-08-31');
  });

  await etape(R, '2026 · septembre · sorties, reprise sous le prix de consignation, matériel conservé', async () => {
    // Sortie P.E.P.S. de 60 sacs · couche du 05/02 (reste 70 à 22 000) · 1 320 000.
    await mouvement(ctx.artA, STOCK_A, n, '2026-09-15', 'SORTIE', 60, 1_320_000, 'BS-A3');
    // Sortie C.M.P.A.C.E. de 50 barres · après l'entrée du 08/06, 60 + 30 = 90 barres pour
    // 1 200 000 + 690 000 = 1 890 000, coût moyen 21 000 · 1 050 000.
    await mouvement(ctx.artB, STOCK_B, n, '2026-09-20', 'SORTIE', 50, 1_050_000, 'BS-B2');
    await refusAttendu(c, R, 'CE3 · reprise sans prix de reprise', 'POST', `/emballages/consignations/${ctx.ce3?.id}/denouement`, { mode: 'REPRISE_PRIX_INFERIEUR', dateDenouement: '2026-09-30' }, 400, 'PRIX REPRIS');
    await refusAttendu(c, R, 'CE3 · reprise au prix de consignation (non inférieur)', 'POST', `/emballages/consignations/${ctx.ce3?.id}/denouement`, { mode: 'REPRISE_PRIX_INFERIEUR', dateDenouement: '2026-09-30', prixDeReprise: 400_000 }, 400, 'INFÉRIEUR');
    // Fiche du compte 41 · D 4194 400 000 / C client 250 000 (le prix repris) / C 7074 150 000.
    await denouer(ctx.ce3, 'REPRISE_PRIX_INFERIEUR', '2026-09-30', [[DETTE_CONS, 400_000, 0], [C3.numero, 0, 250_000], [BONI_EMB, 0, 150_000]], n, 250_000);
    // Fiche du compte 40 · le matériel reçu et conservé · D 24 (proposé 243) / C 4094.
    await denouer(ctx.cr4, 'CONSERVATION', '2026-09-30', [[MATERIEL_EMB, 800_000, 0], [CREANCE_CONS, 0, 800_000]]);
    await validerJusqua(c, n, '2026-09-30');
  });

  // --- Relances (octobre 2026) ------------------------------------------------------
  await etape(R, '2026 · relances au 15/10 · niveaux, exclusion, file de courrier', async () => {
    const niveaux = (await c.lire('Niveaux de relance', '/relances/niveaux')) ?? [];
    const niv = (k) => niveaux.find((x) => x.niveau === k);
    R.egal('niveaux livrés · avis préventif à −7, rappels à 15 et 45 jours', [['PREVENTIVE', -7], ['RAPPEL', 15], ['RAPPEL', 45]], [1, 2, 3].map((k) => [niv(k)?.type, niv(k)?.joursApresEcheance]));
    await refusAttendu(c, R, 'Exclusion de C3 sans motif', 'PATCH', `/relances/tiers/${C3?.id}/hors-relance`, { horsRelance: true }, 400, 'motif');
    const ex = await c.geste('Exclusion de C3 (litige)', 'PATCH', `/relances/tiers/${C3?.id}/hors-relance`, { horsRelance: true, motif: 'Litige sur la livraison de mars, dossier chez l’avocat' });
    R.egal('C3 · exclu, date posée par le serveur', [true, true], [ex?.horsRelance, Boolean(ex?.horsRelanceDepuis)]);
    // POSITIONS AU 15/10 (état RAPPEL) · lignes non lettrées des comptes 411 ·
    // C1 · CE2 300 000 (01/03) + CE4 1 000 000 (01/04) = 1 300 000, retard 228 j
    //   (01/03 au 15/10) · niveau suggéré 3 (seuil 45 atteint, rien d'envoyé) ;
    // C2 · 1 160 000 + 672 800 − 1 160 000 = 672 800, retard 163 j (05/05) · 3 ;
    // C3 · 3 480 000 + 400 000 − 250 000 = 3 630 000, retard 219 j, EXCLU ·
    //   la position reste rendue, sans suggestion.
    const pos = (await c.lire('Positions à relancer au 15/10', `/relances?exerciceId=${n}&type=RAPPEL&dateReference=2026-10-15`)) ?? [];
    const p = (t) => pos.find((x) => x.compteId === t?.compteId);
    R.montant('relances · C1 · dû', 1_300_000, p(C1)?.montantDu);
    R.egal('relances · C1 · retard et niveau suggéré', [228, 3], [p(C1)?.retardMaxJours, p(C1)?.niveauSuggere]);
    R.montant('relances · C2 · dû', 672_800, p(C2)?.montantDu);
    R.egal('relances · C2 · retard et niveau suggéré', [163, 3], [p(C2)?.retardMaxJours, p(C2)?.niveauSuggere]);
    R.montant('relances · C3 · dû (exclu mais montré)', 3_630_000, p(C3)?.montantDu);
    R.egal('relances · C3 · exclu, aucune suggestion', [true, null, 219], [p(C3)?.horsRelance, p(C3)?.niveauSuggere ?? null, p(C3)?.retardMaxJours]);
    const comptes = [C1?.compteId, C2?.compteId, C3?.compteId];
    await refusAttendu(c, R, 'Émission nommant deux fois le même compte', 'POST', '/relances/emettre', { exerciceId: n, compteIds: [C1?.compteId, C1?.compteId], niveauId: niv(2)?.id, dateReference: '2026-10-15' }, 400, 'deux fois');
    const e1 = await c.geste('Émission du premier rappel', 'POST', '/relances/emettre', { exerciceId: n, compteIds: comptes, niveauId: niv(2)?.id, dateReference: '2026-10-15' });
    // Deux lettres · C1 a un courriel (mise en file), C2 n'en a pas (lettre non remise) ;
    // C3 sauté, exclu.
    R.egal('premier rappel · émises, en file, non remises, exclues', [2, 1, 1, 1], [e1?.emises, e1?.misesEnFile, e1?.nonRemises, e1?.exclues?.length]);
    R.egal('premier rappel · montants des lettres', [672_800, 1_300_000], (e1?.lettres ?? []).map((l) => l.montant).sort((a, b) => a - b));
    const e2 = await c.geste('Seconde émission le même jour', 'POST', '/relances/emettre', { exerciceId: n, compteIds: [C1?.compteId, C2?.compteId], niveauId: niv(2)?.id, dateReference: '2026-10-15' });
    // La lettre de C1 est en file · pas réécrite ; C2 n'en avait aucune · réécrite.
    R.egal('seconde émission · C1 déjà en file, C2 réémis', [1, 1], [e2?.emises, e2?.dejaEmises?.length]);
    const e3 = await c.geste('Avis préventif à C1', 'POST', '/relances/emettre', { exerciceId: n, compteIds: [C1?.compteId], niveauId: niv(1)?.id, dateReference: '2026-10-15' });
    R.egal('avis préventif · rien à réclamer avant échéance · sans objet', [0, 1], [e3?.emises, e3?.sansObjet?.length]);
    const pos2 = (await c.lire('Positions après l’émission', `/relances?exerciceId=${n}&type=RAPPEL&dateReference=2026-10-15`)) ?? [];
    const q1 = pos2.find((x) => x.compteId === C1?.compteId);
    R.egal('C1 · dernière relance de niveau 2, suggestion du niveau 3', [2, 3], [q1?.derniereRelance?.niveau, q1?.niveauSuggere]);
    const file = await c.lire('File de courrier', '/courrier');
    const lettres = (file?.messages ?? []).filter((m) => m.origine === 'RELANCE');
    R.egal('courrier · une lettre de relance en file, au courriel de C1', [1, 'compta@brasserie-fleuve.cd'], [lettres.length, lettres[0]?.destinataire]);
    R.egal('courrier · jamais dite envoyée', true, lettres.every((m) => ['SANS_TRANSPORT', 'EN_ATTENTE'].includes(m.statut)));
    const h = await c.lire('Historique des rappels', '/relances/historique');
    // Trois relances · C1 1 300 000, C2 672 800 deux fois.
    R.egal('historique · trois relances', 3, h?.total);
    R.montant('historique · montant total relancé', 2_645_600, h?.montantTotal);
    const rel = await c.lire('Relevé du compte de C2', `/relances/releve/${C2?.compteId}?exerciceId=${n}`);
    R.montant('relevé de C2 · tout ce qui est dû, sans gradation', 672_800, rel?.position?.montantDu ?? rel?.montantDu);
    const lev = await c.geste('Levée de l’exclusion de C3', 'PATCH', `/relances/tiers/${C3?.id}/hors-relance`, { horsRelance: false });
    R.egal('C3 · exclusion levée, motif et date effacés', [false, null, null], [lev?.horsRelance, lev?.motifHorsRelance ?? null, lev?.horsRelanceDepuis ?? null]);
  });

  // --- Inventaire et clôture de 2026 ---------------------------------------------------
  await etape(R, '2026 · inventaire physique au 31/12 · boni et mali', async () => {
    // Boni en P.E.P.S. · aucune source ne dit à quelle couche le rattacher · le coût est RÉCLAMÉ.
    const sansCout = await c.geste('Confrontation · boni P.E.P.S. sans coût', 'POST', '/magasin/inventaire/confrontation', { dateComptage: '2026-12-31', comptages: [{ articleId: ctx.artA?.id, quantitePhysique: 70 }] });
    R.egal('boni P.E.P.S. sans coût fourni · refus nommé', 'COUT_DU_BONI_NON_FOURNI', sansCout?.confrontation?.refus?.[0]?.motif);
    const avecCout = await c.geste('Confrontation · boni P.E.P.S. avec son coût', 'POST', '/magasin/inventaire/confrontation', { dateComptage: '2026-12-31', comptages: [{ articleId: ctx.artA?.id, quantitePhysique: 70, coutUnitaireBoni: 24_000, sourceCoutBoni: 'Dernière facture FA-005' }] });
    // Stock comptable 60 sacs · boni 10 × 24 000 = 240 000 (lecture seule).
    R.montant('boni P.E.P.S. avec coût · 10 sacs à 24 000', 240_000, avecCout?.confrontation?.totalBoni);
    // LA CONFRONTATION RÉELLE · ART-A · couches 10 sacs à 22 000 + 50 à 24 000 (60 sacs,
    // 1 420 000), comptés 45 · mali de 15 sacs, en P.E.P.S. les plus anciennes ·
    // 10 × 22 000 + 5 × 24 000 = 340 000. ART-B · 40 barres pour 840 000 (coût
    // moyen 21 000), comptées 43 · boni de 3 au coût moyen · 63 000.
    const comptages = [{ articleId: ctx.artA?.id, quantitePhysique: 45 }, { articleId: ctx.artB?.id, quantitePhysique: 43 }];
    const conf = await c.geste('Confrontation de l’inventaire au 31/12', 'POST', '/magasin/inventaire/confrontation', { dateComptage: '2026-12-31', comptages });
    R.montant('confrontation · total des malis', 340_000, conf?.confrontation?.totalMali);
    R.montant('confrontation · total des bonis', 63_000, conf?.confrontation?.totalBoni);
    const reg = await c.geste('Régularisation de l’inventaire', 'POST', '/magasin/inventaire/regularisation', { dateComptage: '2026-12-31', comptages, exerciceId: n, journalId: od.id, date: '2026-12-31', reference: 'INV-2026' });
    const m = {};
    for (const l of reg?.lignes ?? []) {
      const num = numeroDe(c, l.compteId);
      m[num] = m[num] ?? { d: 0, c: 0 };
      m[num].d += Number(l.debit);
      m[num].c += Number(l.credit);
    }
    // Fiche du compte 603 · mali · D 6031 / C 31 ; boni · D 31 / C 6031.
    R.egal('régularisation · écriture au 603', { [STOCK_A]: [0, 340_000], [STOCK_B]: [63_000, 0], [VARIATION]: [340_000, 63_000] },
      Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [c2(v.d), c2(v.c)]])));
    // LE MAGASIN SUIT L'ÉCRITURE (audit final F35) · la même confrontation ne repropose rien.
    const conf2 = await c.geste('Seconde confrontation des mêmes comptages', 'POST', '/magasin/inventaire/confrontation', { dateComptage: '2026-12-31', comptages });
    R.egal('seconde confrontation · aucune différence, deux articles concordants', [0, 2], [conf2?.confrontation?.differences?.length, conf2?.confrontation?.sansDifference?.length]);
    await refusAttendu(c, R, 'Seconde régularisation des mêmes comptages', 'POST', '/magasin/inventaire/regularisation', { dateComptage: '2026-12-31', comptages, exerciceId: n, journalId: od.id, date: '2026-12-31' }, 400, 'Aucune différence');
    const fa = await c.lire('Fiche de l’article A après inventaire', `/magasin/articles/${ctx.artA?.id}/fiche`);
    R.egal('fiche A · 45 sacs pour 1 080 000 (45 × 24 000)', [45, 1_080_000], [fa?.totaux?.quantiteFinale, c2(fa?.totaux?.valeurFinale)]);
    R.egal('fiche A · le mouvement annulé reste sur la fiche, hors valorisation', true, (fa?.lignes ?? []).some((l) => l.piece === 'BE-A9' && l.annuleLe && l.valeur === null));
    // Huit mouvements · 4 entrées (dont l'annulée), 3 sorties, le mali · tous liés à leur écriture sauf l'annulé.
    R.egal('fiche A · huit mouvements, aucune écriture manquante (inventaire permanent)', [8, []], [fa?.lignes?.length, (fa?.lignes ?? []).filter((l) => l.ecritureManquante).map((l) => l.piece)]);
    const fb = await c.lire('Fiche de l’article B après inventaire', `/magasin/articles/${ctx.artB?.id}/fiche`);
    R.egal('fiche B · 43 barres pour 903 000 (43 × 21 000)', [43, 903_000], [fb?.totaux?.quantiteFinale, c2(fb?.totaux?.valeurFinale)]);
    // Inventaire permanent · aucune variation à passer à la clôture.
    const v = await c.lire('Variation des stocks 2026', `/stocks/variation/${n}`);
    R.egal('variation de clôture · inventaire permanent, rien à proposer', ['PERMANENT', null], [v?.methode, v?.proposition ?? null]);
    await refusAttendu(c, R, 'Variation de clôture en inventaire permanent', 'POST', '/stocks/variation', { exerciceId: n, journalId: od.id, date: '2026-12-31' }, 400, 'PERMANENT');
    await validerJusqua(c, n, '2026-12-31');
  });

  await etape(R, '2026 · soldes avant clôture', async () => {
    await rechargerComptes(c);
    const b = await balance(c, n);
    R.montant('2026 · balance équilibrée', 0, b ? b.totalDebit - b.totalCredit : null);
    const att = {
      // 4 000 000 + 2 200 000 + 1 200 000 − 3 000 000 − 1 660 000 − 1 320 000 − 340 000.
      [STOCK_A]: 1_080_000,
      // 2 000 000 − 800 000 + 690 000 − 1 050 000 + 63 000.
      [STOCK_B]: 903_000,
      // − (variation des deux stocks) · −(1 080 000 + 903 000).
      [VARIATION]: -1_983_000,
      // 600 000 + 200 000 + 350 000 + 800 000 − 200 000 − 600 000 − 800 000 · CR3 en attente.
      [CREANCE_CONS]: 350_000,
      // −(500 000 + 300 000 + 400 000 + 1 000 000) + 500 000 + 300 000 + 400 000 · CE4 en attente.
      [DETTE_CONS]: -1_000_000,
      [BONI_EMB]: -450_000, // 300 000 (CE2) + 150 000 (CE3)
      [ACHAT_EMB]: 600_000, // CR1 conservé
      [MATERIEL_EMB]: 800_000, // CR4 conservé
      [MALI_EMB]: 0,
      // 50 000 000 − 9 512 000 − 1 450 000 + 10 440 000 + 1 160 000 − 1 500 000 − 500 000.
      [BQ]: 48_638_000,
    };
    for (const [racine, m] of Object.entries(att)) R.montant(`2026 · solde ${racine}`, m, solde(b, racine));
    // Par tiers (compte individuel) ·
    // C1 · 10 440 000 + 500 000 + 300 000 + 1 000 000 + 1 160 000 − 10 440 000 − 1 160 000 − 500 000.
    // C2 · 1 160 000 + 672 800 − 1 160 000 ; C3 · 3 480 000 + 400 000 − 250 000.
    // F1 · −(4 640 000 + 4 872 000 + 1 392 000 + 800 400) + 9 512 000 + 1 500 000 + 300 000.
    // F2 · −(1 740 000 + 580 000) + 1 450 000 ; F3 · −1 950 000 + 200 000 + 200 000.
    for (const [t, attendu] of [[C1, 1_300_000], [C2, 672_800], [C3, 3_630_000], [F1, -392_400], [F2, -870_000], [F3, -1_550_000]]) {
      const tt = (await lignesDuTiers(c, t)).totaux;
      R.montant(`2026 · solde du compte de ${t?.nom}`, attendu, tt ? tt.debit - tt.credit : null);
    }
    const reg = await c.lire('Registre des consignations', '/emballages/consignations');
    // En attente · CE4 (dette de 1 000 000) et CR3 (créance de 350 000), jamais additionnées.
    R.egal('registre · deux consignations en attente', 2, reg?.enAttente?.nombre);
    R.montant('registre · dettes émises en attente (4194)', 1_000_000, reg?.enAttente?.detteEmise);
    R.montant('registre · créances reçues en attente (4094)', 350_000, reg?.enAttente?.creanceRecue);
    R.egal('registre · huit consignations, chaque dénouement rattaché à son écriture', [8, []], [reg?.consignations?.length, (reg?.consignations ?? []).filter((x) => x.etat !== 'EN_COURS' && !x.ecritureDenouementId).map((x) => x.designation)]);
  });

  const clos = await etape(R, 'Clôture 2026', () => cloturer(c, '2026'));
  await rechargerExercices(c);
  const n1 = c.exercices.get('2027')?.id;
  if (!clos || !n1) {
    R.note('commercial · 2027 non joué · la clôture de 2026 n’a pas abouti ou l’exercice 2027 manque');
  } else {
    await etape(R, '2027 · à-nouveaux, reprise d’emballages, dernière sortie au coût moyen', async () => {
      const b0 = await balance(c, n1);
      R.montant('2027 · à-nouveau · stock A', 1_080_000, solde(b0, STOCK_A));
      R.montant('2027 · à-nouveau · stock B', 903_000, solde(b0, STOCK_B));
      R.montant('2027 · à-nouveau · 4094 en attente', 350_000, solde(b0, CREANCE_CONS));
      R.montant('2027 · à-nouveau · 4194 en attente', -1_000_000, solde(b0, DETTE_CONS));
      // Reprise des caisses de CR3 à 300 000 · fiche du compte 40 · D fournisseur
      // 300 000 + D 6224 50 000 / C 4094 350 000.
      await denouer(ctx.cr3, 'REPRISE_PRIX_INFERIEUR', '2027-02-28', [[F3.numero, 300_000, 0], [MALI_EMB, 50_000, 0], [CREANCE_CONS, 0, 350_000]], n1, 300_000);
      // ART-B · entrée de 4 barres pour 100 000 · 47 barres pour 1 003 000 · puis 20 au
      // coût moyen · 1 003 000 × 20 / 47 = 426 808,5106… (écriture au centime 426 808,51),
      // puis la DERNIÈRE sortie (27) prend la VALEUR RESTANTE · 1 003 000 − 426 808,5106…
      // = 576 191,4893… (écriture 576 191,49), jamais 27 × coût moyen.
      const be3 = await mouvement(ctx.artB, STOCK_B, n1, '2027-01-10', 'ENTREE', 4, 100_000, 'BE-B3');
      // UN MOUVEMENT RETIENT SON ÉCRITURE · au brouillard, elle ne se supprime pas depuis le journal.
      if (be3?.ecritureId) await refusAttendu(c, R, 'Suppression de l’écriture d’une entrée de magasin', 'DELETE', `/ecritures/${be3.ecritureId}`, undefined, 400);
      await mouvement(ctx.artB, STOCK_B, n1, '2027-01-20', 'SORTIE', 20, 426_808.51, 'BS-B3');
      await mouvement(ctx.artB, STOCK_B, n1, '2027-02-10', 'SORTIE', 27, 576_191.49, 'BS-B4');
      const fb = await c.lire('Fiche de l’article B en 2027', `/magasin/articles/${ctx.artB?.id}/fiche`);
      const ligne = (piece) => (fb?.lignes ?? []).find((l) => l.piece === piece);
      R.montant('fiche B · sortie BS-B3 au coût moyen (au centime)', 426_808.51, ligne('BS-B3')?.valeur);
      R.montant('fiche B · dernière sortie BS-B4 à la valeur restante (au centime)', 576_191.49, ligne('BS-B4')?.valeur);
      R.egal('fiche B · magasin vide, valeur exactement nulle', [0, 0], [fb?.totaux?.quantiteFinale, fb?.totaux?.valeurFinale]);
      // Entrées 2 000 000 + 690 000 + 63 000 (boni) + 100 000 = 2 853 000 · égalité
      // des sorties et des entrées en valeur quand tout est sorti (glossaire).
      R.montant('fiche B · total des sorties égal au total des entrées', 2_853_000, fb?.totaux?.totalSorties);
      const s1 = (fb?.lignes ?? []).find((l) => l.piece === 'BS-B1');
      await refusAttendu(c, R, 'Annulation d’un mouvement d’un exercice clôturé', 'POST', `/magasin/articles/${ctx.artB?.id}/mouvements/${s1?.id}/annulation`, { motif: 'Correction tardive' }, 400, 'clôturé');
      await validerJusqua(c, n1, '2027-02-28');
      const b = await balance(c, n1);
      R.montant('2027 · solde du stock B après la dernière sortie', 0, solde(b, STOCK_B));
      R.montant('2027 · 4094 soldé après la reprise de CR3', 0, solde(b, CREANCE_CONS));
      R.montant('2027 · mali sur emballages (CR3)', 50_000, solde(b, MALI_EMB));
      // UNE ÉCRITURE LIÉE À UN MOUVEMENT DOIT PASSER CE QUE LE MAGASIN VALORISE · fiche du
      // compte 31, « crédité, à chaque sortie de stock (biens interchangeables selon
      // P.E.P.S. ou C.M.P.), par le débit du 6031 ». La sortie de 5 sacs du 01/03/2027 vaut
      // en P.E.P.S. 5 × 24 000 = 120 000 ; l'écriture liée n'en passe que 100 000. Le
      // module de consignation REFUSE une écriture qui ne passe pas sa proposition (« il
      // lui manque ») · même attente ici, sans quoi le 31 et la fiche divergent sans un mot.
      const fausse = await ecriture(c, 'Écriture de sortie au mauvais montant', n1, '2027-03-01', 'Sortie magasin BS-A4', [[VARIATION, 100_000, 0], [STOCK_A, 0, 100_000]], { reference: 'BS-A4' });
      const lien = await c.req('POST', `/magasin/articles/${ctx.artA?.id}/mouvements`, { date: '2027-03-01', sens: 'SORTIE', quantite: 5, piece: 'BS-A4', ecritureId: fausse?.id });
      R.egal('sortie liée à une écriture de 100 000 pour une valorisation P.E.P.S. de 120 000 · refusée', true, lien.statut >= 400);
      // Une écriture qui ne touche même pas le compte de stock de l'article (le dénouement de CR3).
      const autre = (await lignesDuTiers(c, F3)).lignes.find((l) => l.reference === 'CR3-D');
      const lien2 = autre && (await c.req('POST', `/magasin/articles/${ctx.artA?.id}/mouvements`, { date: '2027-03-02', sens: 'SORTIE', quantite: 2, piece: 'BS-A5', ecritureId: (await c.lire('Écriture CR3-D', `/ecritures?exerciceId=${n1}&reference=CR3-D`))?.ecritures?.[0]?.id }));
      R.egal('sortie liée à une écriture qui ne touche ni le 31 ni le 6031 · refusée', true, Boolean(lien2) && lien2.statut >= 400);
      await validerJusqua(c, n1, '2027-03-31');
      const fa27 = await c.lire('Fiche de l’article A en 2027', `/magasin/articles/${ctx.artA?.id}/fiche`);
      const b27 = await balance(c, n1);
      const ecart = c2(solde(b27, STOCK_A) - (fa27?.totaux?.valeurFinale ?? 0));
      if (ecart !== 0) {
        // La fiche et le compte divergent · un contrôle doit le dire (inventaire permanent
        // « vérifié en deux dimensions »).
        const ctl = await c.lire('Contrôles 2027', `/controles?exerciceId=${n1}`);
        // Un contrôle de stock (son code) ou une occurrence qui nomme le compte 31110000.
        const vues = (ctl?.anomalies ?? []).filter((a) => /STOCK|MAGASIN|FICHE/.test(a.code ?? '') || (a.occurrences ?? []).some((o) => String(o.reference ?? '').startsWith(STOCK_A)));
        for (const a of vues) R.note(`contrôle 2027 qui nomme ${STOCK_A} ou le magasin · ${a.code} · ${a.libelle} · ${JSON.stringify(a.occurrences ?? []).slice(0, 300)}`);
        const vu = vues.length > 0;
        R.egal(`fiche A (${fa27?.totaux?.valeurFinale}) et compte ${STOCK_A} (${solde(b27, STOCK_A)}) divergent de ${ecart} · un contrôle le signale`, true, vu);
      }
      const reg = await c.lire('Registre des consignations en 2027', '/emballages/consignations');
      R.egal('registre 2027 · une seule consignation en attente (CE4)', [1, 1_000_000, 0], [reg?.enAttente?.nombre, reg?.enAttente?.detteEmise, reg?.enAttente?.creanceRecue]);
    });
  }

  // --- Dossier SYCEBNL · refus et rôle d'emballage divergent ----------------------
  await etape(R, 'SYCEBNL · devis refusés, consignation au 707', async () => {
    const a = await nouveauDossier(R, 'Passe commercial · Association des Riverains', {
      referentiel: 'SYCEBNL', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', cle: 'commercial-asso', exercice: ['2026-01-01', '2026-12-31'],
    });
    const na = a.exercices.get('2026').id;
    await a.geste('Activation du module de gestion commerciale (SYCEBNL)', 'PATCH', '/dossier/modules', { modulesActives: ['GESTION_COMMERCIALE'] });
    // Loi n° 004/2001, art. 1er · l'association n'est pas commerçante · le Livre 8 de
    // l'AUDCG (art. 234) ne la vise pas · route fermée au serveur (ReferentielGuard).
    await refusAttendu(a, R, 'SYCEBNL · liste des devis', 'GET', '/commercial/devis', undefined, 403);
    await refusAttendu(a, R, 'SYCEBNL · émission d’un devis', 'POST', '/commercial/devis', { numero: 'DV-1', dateEmission: '2026-03-01', nature: 'MARCHANDISES', clientNom: 'Client', lignes: [{ designation: 'X', quantite: 1, prixUnitaire: 1, montantHT: 1 }] }, 403);
    const u = await tiersComplet(a, 'CLIENT', 'U1', 'Restaurant du Port');
    const r = await a.geste('SYCEBNL · consignation émise', 'POST', '/emballages/consignations', { tiersId: u?.id, sens: 'EMISE', nature: 'EMBALLAGE', designation: 'Bonbonnes', quantite: 5, dateConsignation: '2026-03-01', montant: 100_000 });
    if (r && u) {
      const e = await ecriture(a, 'SYCEBNL · écriture d’ouverture', na, '2026-03-01', 'Consignation bonbonnes', [[u.numero, 100_000, 0], [DETTE_CONS, 0, 100_000]], { reference: 'CU-1' });
      if (e) await a.geste('SYCEBNL · rattachement de l’ouverture', 'POST', `/emballages/consignations/${r.consignation.id}/ecritures/ouverture`, { ecritureId: e.id });
      // UN NUMÉRO, DEUX SENS · le SYCEBNL dénoue au crédit du « compte 707 PRODUITS
      // ACCESSOIRES » (sans subdivision), là où l'AUDCIF écrit le 7074.
      const d = await a.geste('SYCEBNL · conservation par le client', 'POST', `/emballages/consignations/${r.consignation.id}/denouement`, { mode: 'CONSERVATION', dateDenouement: '2026-06-30' });
      R.egal('SYCEBNL · conservation proposée au 707 (et non au 7074)', [['4194', 'DEBIT', 100_000], ['707', 'CREDIT', 100_000]], (d?.proposition?.lignes ?? []).map((l) => [l.compte, l.sens, l.montant]));
      const e2 = await ecriture(a, 'SYCEBNL · écriture de conservation', na, '2026-06-30', 'Conservation bonbonnes', [[DETTE_CONS, 100_000, 0], ['70700000', 0, 100_000]], { reference: 'CU-1-D' });
      if (e2) await a.geste('SYCEBNL · rattachement du dénouement', 'POST', `/emballages/consignations/${r.consignation.id}/ecritures/denouement`, { ecritureId: e2.id });
      const lu = await a.lire('SYCEBNL · registre', '/emballages/consignations');
      R.egal('SYCEBNL · consignation dénouée et rattachée', ['CONSERVEE', true], [lu?.consignations?.[0]?.etat, Boolean(lu?.consignations?.[0]?.ecritureDenouementId)]);
    }
  });
}
