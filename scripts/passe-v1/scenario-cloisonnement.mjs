/**
 * SCÉNARIO 4 · CLOISONNEMENT ENTRE SOCIÉTÉS (demande de Manasse, deuxième
 * passe). Trois dossiers nés par l'inscription · A et B, deux SARL au
 * SYSCOHADA, C, une association au SYCEBNL · avec DÉLIBÉRÉMENT les mêmes
 * numéros de comptes, les mêmes noms et codes de tiers, les mêmes références
 * de pièces, le même numéro de facture, et des montants voisins (base plus
 * 101, 202 ou 303). Seuls un MARQUEUR dans les libellés (ALPHA-QX19,
 * BETA-ZK47, GAMMA-MW83), les montants et les identifiants distinguent les
 * dossiers · c'est par eux que le banc cherche une fuite.
 *
 * 1. Opérations entrelacées et EN PARALLÈLE (Promise.all), puis balance,
 *    grand livre et états de CHAQUE dossier contre son seul attendu.
 * 2. Numérotation des pièces continue par dossier et par journal.
 * 3. Avec la session de A, chaque geste sur les identifiants réels de B ·
 *    refus 403 ou 404 attendu, jamais 2xx ni 5xx, réponse sans donnée de B,
 *    et B relu ensuite par sa propre session · rien n'a bougé.
 * 4. Listes, recherches, exports, journal d'audit et restitution de A · aucune
 *    chaîne propre à B.
 * 5. Clôtures de A, B et C lancées ensemble · à-nouveaux de chacun.
 * 6. Utilisateurs de A (comptable, lecture seule) · aucune voie vers B, pas
 *    d'invitation de B par A, et les changements de rôle ou désactivations
 *    dans A ne touchent rien dans B.
 *
 * Le banc ne contourne rien · une tentative refusée est le résultat attendu,
 * elle se consigne en contrôle (pas en erreur HTTP). Attendus calculés à la
 * main · README.md, section « Cloisonnement ».
 */
import {
  Client, MOT_DE_PASSE, aplatir, balance, cloturer, compte, ecriture, etape, lettrer, lignesDuCompte, nouveauDossier,
  rechargerExercices, solde, tiers, validerJusqua, auCentime,
} from './lib.mjs';
import { entreesZip } from './parcours.mjs';

const BQ = '52110000';
const LOYER = '62220000';
const ELEC = '60520000';
const VENTES = '70110000';

/**
 * Les trois dossiers · marqueur, écart ajouté à chaque montant de base,
 * référentiel. A et C restent en francs entiers ; B porte 47 centimes, si bien
 * qu'aucune somme des montants de A ne peut reproduire un montant de B · la
 * fouille d'une fuite cherche donc des chaînes que seul B écrit.
 */
const DOSSIERS = {
  A: { nom: 'Cloison Alpha SARL', marque: 'ALPHA-QX19', ecart: 101, referentiel: 'SYSCOHADA', capital: '10130000' },
  B: { nom: 'Cloison Beta SARL', marque: 'BETA-ZK47', ecart: 202.47, referentiel: 'SYSCOHADA', capital: '10130000' },
  C: { nom: 'Cloison Gamma Association', marque: 'GAMMA-MW83', ecart: 303, referentiel: 'SYCEBNL', capital: '10210000' },
};
const MOIS_ELEC = [['2026-01-31', 'janvier'], ['2026-02-28', 'février'], ['2026-03-31', 'mars'], ['2026-04-30', 'avril']];

/** Les montants d'un dossier · calculés à la main (README). */
function montants(e) {
  const ht = auCentime(2_000_000 + e);
  const tva = auCentime(ht * 0.16);
  const apport = auCentime(10_000_000 + e);
  const loyer = auCentime(1_000_000 + e);
  const elec = auCentime(75_000 + e);
  return { apport, loyer, elec, ht, tva, ttc: auCentime(ht + tva), banque: auCentime(apport - loyer - 4 * elec), piege: auCentime(50_000 + e) };
}

/** Une tentative de A sur ce qui appartient à B · le refus est le résultat attendu. */
async function tenter(R, cA, libelle, methode, chemin, corps, fouille, refusAdmis = [403, 404]) {
  const r = await cA.req(methode, chemin, corps);
  const lu = refusAdmis.includes(r.statut) ? `refus ${refusAdmis.join(' ou ')}` : `statut ${r.statut}`;
  R.egal(`A → B · ${libelle} · refusé`, `refus ${refusAdmis.join(' ou ')}`, lu);
  // Un classeur ou une archive se fouille OUVERT · ses octets en JSON ne
  // laisseraient voir aucune chaîne.
  const texte = await texteDe(r.corps);
  R.egal(`A → B · ${libelle} · réponse sans donnée de B`, [], fouille.filter((m) => texte.includes(m)));
  if (!refusAdmis.includes(r.statut)) {
    const resume = r.corps?.contenu ? `classeur de ${r.corps.octets} octets` : texte.slice(0, 300);
    R.note(`A → B · ${libelle} · ${methode} ${chemin} · ${r.statut} · ${resume}`);
  }
  return r;
}

/** Ce qu'un artefact de A laisse lire, en texte · JSON, classeur ou archive. */
async function texteDe(r) {
  if (r === undefined || r === null) return '';
  if (r.contenu) {
    try {
      const entrees = await entreesZip(r.contenu);
      return [...entrees.values()].map((b) => b.toString('utf8')).join('\n');
    } catch {
      return r.contenu.toString('utf8');
    }
  }
  return JSON.stringify(r);
}

/** Une liste servie nue ou sous une clé · le banc ne présume pas de la forme. */
function liste(corps, ...cles) {
  if (Array.isArray(corps)) return corps;
  for (const cle of cles) if (Array.isArray(corps?.[cle])) return corps[cle];
  return [];
}

/** Une photographie de B par sa propre session · ce qui ne doit pas bouger. */
async function photographie(cB, ex) {
  const ordonne = (o) => JSON.stringify(o, (cle, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
  const lire = async (chemin) => (await cB.req('GET', chemin)).corps;
  const parId = (x, y) => String(x.id).localeCompare(String(y.id));
  const b = await balance(cB, ex);
  return {
    balance: ordonne([...(b?.parNumero ?? new Map()).entries()].map(([n, l]) => [n, l.solde]).sort()),
    ecritures: ordonne(liste(await lire(`/ecritures?exerciceId=${ex}`), 'ecritures').map((e) => ({
      id: e.id, statut: e.statut, libelle: e.libelle, numeroPiece: e.numeroPiece, date: e.date, updatedAt: e.updatedAt ?? null,
      lignes: (e.lignes ?? []).map((l) => [l.compteId, String(l.debit), String(l.credit), l.lettrageId ?? null, l.rapprochementId ?? null]),
    })).sort(parId)),
    tiers: ordonne(liste(await lire('/tiers'), 'tiers', 'lignes').map((t) => ({ id: t.id, code: t.code, nom: t.nom, estEnSommeil: t.estEnSommeil ?? null, updatedAt: t.updatedAt ?? null })).sort(parId)),
    comptes: ordonne(liste(await lire('/comptes'), 'comptes').filter((x) => [BQ, LOYER, ELEC, VENTES, '24410000'].includes(x.numero) || x.numero.startsWith('4011') || x.numero.startsWith('4111'))
      .map((x) => ({ id: x.id, numero: x.numero, intitule: x.intitule, estEnSommeil: x.estEnSommeil ?? null })).sort(parId)),
    factures: ordonne(liste(await lire('/facturation'), 'factures', 'lignes').map((f) => ({ id: f.id, statut: f.statut ?? null, numeroSerie: f.numeroSerie, ecritureId: f.ecritureId ?? null, annuleeLe: f.annuleeLe ?? null })).sort(parId)),
    immobilisations: ordonne(liste(await lire('/immobilisations'), 'immobilisations', 'lignes').map((x) => ({ id: x.id, statut: x.statut ?? null, valeurOrigine: String(x.valeurOrigine ?? ''), lieuId: x.lieuId ?? null, dateSortie: x.dateSortie ?? null })).sort(parId)),
    exercices: ordonne(liste(await lire('/exercices'), 'exercices').map((e) => ({ id: e.id, statut: e.statut, dateArreteComptes: e.dateArreteComptes ?? null })).sort(parId)),
    rapprochements: ordonne(liste(await lire('/rapprochements'), 'rapprochements').map((r) => ({ id: r.id, statut: r.statut, soldeReleve: String(r.soldeReleve), dateDepart: r.dateDepart ?? null, soldeDepartDeclare: r.soldeDepartDeclare ?? null, clotureAt: r.clotureAt ?? null })).sort(parId)),
    bulletins: ordonne(liste(await lire('/personnel/bulletins'), 'bulletins', 'lignes').map((x) => ({ id: x.id, statut: x.statut ?? null, annuleLe: x.annuleLe ?? null, remisLe: x.remisLe ?? null })).sort(parId)),
    utilisateurs: ordonne(liste(await lire('/utilisateurs'), 'utilisateurs').map((u) => ({ id: u.id, email: u.email, role: u.role, estActif: u.estActif })).sort(parId)),
  };
}

/** Un utilisateur connecté par sa propre adresse · mot de passe provisoire changé. */
async function connecter(R, email, motDePasse, nouveau) {
  const u = new Client(R);
  const r = await u.req('POST', '/auth/login', { email, motDePasse });
  if (r.statut >= 400) return { client: u, statut: r.statut, corps: r.corps };
  const moi = (await u.req('GET', '/auth/me')).corps;
  if (moi?.doitChangerMotDePasse && nouveau) {
    await u.req('POST', '/auth/changer-mot-de-passe', { motDePasseActuel: motDePasse, nouveauMotDePasse: nouveau });
    const u2 = new Client(R);
    const r2 = await u2.req('POST', '/auth/login', { email, motDePasse: nouveau });
    const moi2 = (await u2.req('GET', '/auth/me')).corps;
    return { client: u2, statut: r2.statut, moi: moi2 };
  }
  return { client: u, statut: r.statut, moi };
}

export async function scenarioCloisonnement(registre) {
  registre.scenario = 'Cloisonnement';
  const R = registre;

  // --- Trois dossiers nés ensemble -----------------------------------------
  const cles = Object.keys(DOSSIERS);
  const clients = await Promise.all(cles.map((cle) => nouveauDossier(R, DOSSIERS[cle].nom, {
    referentiel: DOSSIERS[cle].referentiel,
    ...(DOSSIERS[cle].referentiel === 'SYSCOHADA' ? { systeme: 'NORMAL' } : { jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }),
    cle: `cloison-${cle.toLowerCase()}`, exercice: ['2026-01-01', '2026-12-31'],
  })));
  const D = Object.fromEntries(cles.map((cle, i) => [cle, { ...DOSSIERS[cle], c: clients[i], m: montants(DOSSIERS[cle].ecart), pieces: [] }]));
  const tous = (fn) => Promise.all(cles.map((cle) => fn(D[cle], cle)));
  const ex = (d) => d.c.exercices.get('2026')?.id;
  /** Une pièce passée par le banc · son journal et sa date, pour la numérotation attendue. */
  const compter = (d, code, date) => d.pieces.push({ code, date });

  await etape(R, 'Cloisonnement · paramètres et tiers homonymes, en parallèle', () => tous(async (d) => {
    if (d.referentiel === 'SYSCOHADA') {
      await d.c.geste('Forme juridique SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
      await d.c.geste('Assujettissement à la TVA', 'PATCH', '/dossier/regime', { assujettiTva: true, reponseAssujettissementTva: 'OUI', venteBiensServices: 'OUI' });
    }
    d.frs = await tiers(d.c, 'FOURNISSEUR', 'FRS-COMMUN', 'Fournisseur Commun');
    d.cli = await tiers(d.c, 'CLIENT', 'CLI-COMMUN', 'Client Commun');
    if (d === D.B) d.exclusif = await d.c.geste('Tiers exclusif de B', 'POST', '/tiers', { type: 'AUTRE', code: 'BETA-EXCL', nom: 'Tiers Exclusif Beta', creerCompteIndividuel: false });
    R.egal(`${d.nom} · compte individuel du fournisseur homonyme`, '40110001', d.frs?.numero ?? null);
  }));

  // --- 1. Opérations entrelacées --------------------------------------------
  await etape(R, 'Cloisonnement · opérations entrelacées en parallèle', async () => {
    await tous(async (d) => {
      d.apport = await ecriture(d.c, 'Apport initial', ex(d), '2026-01-02', `Apport initial ${d.marque}`, [[BQ, d.m.apport, 0], [d.capital, 0, d.m.apport]], { journal: d.c.od, reference: 'REF-0000' });
      if (d.apport) compter(d, 'OD', '2026-01-02');
    });
    await tous(async (d) => {
      d.loyer = await ecriture(d.c, 'Loyer de janvier', ex(d), '2026-01-10', `Loyer janvier ${d.marque}`, [[LOYER, d.m.loyer, 0], [d.frs.numero, 0, d.m.loyer]], { journal: d.c.journal('ACH'), reference: 'REF-0001' });
      if (d.loyer) compter(d, 'ACH', '2026-01-10');
    });
    await tous(async (d) => {
      d.reglement = await ecriture(d.c, 'Règlement du loyer', ex(d), '2026-01-20', `Règlement loyer ${d.marque}`, [[d.frs.numero, d.m.loyer, 0], [BQ, 0, d.m.loyer]], { journal: d.c.journal('BQ'), reference: 'REF-0001' });
      if (d.reglement) compter(d, 'BQ', '2026-01-20');
    });
    await tous(async (d) => {
      const idFrs = d.c.comptes.get(d.frs.numero)?.id;
      const l1 = d.loyer?.lignes?.find((l) => l.compteId === idFrs)?.id;
      const l2 = d.reglement?.lignes?.find((l) => l.compteId === idFrs)?.id;
      if (l1 && l2) await lettrer(d.c, d.frs.numero, [l1, l2]);
      d.lignesFrs = [l1, l2];
    });
    // Quatre factures d'électricité par dossier, les trois dossiers en même temps.
    await tous(async (d) => {
      for (const [i, [date, mois]] of MOIS_ELEC.entries()) {
        const e = await ecriture(d.c, `Électricité ${mois}`, ex(d), date, `Électricité ${mois} ${d.marque}`, [[ELEC, d.m.elec, 0], [BQ, 0, d.m.elec]], { journal: d.c.journal('BQ'), reference: `REF-E0${i + 1}` });
        if (e) compter(d, 'BQ', date);
      }
    });
    // La même facture FV-0001 chez A et chez B, au même client homonyme.
    await tous(async (d) => {
      if (d.referentiel !== 'SYSCOHADA') return;
      const taux = (await d.c.lire('Taux de TVA', '/taux-tva')) ?? [];
      const t16 = taux.find((t) => t.code === 'TVA16');
      d.facture = await d.c.geste('Facture FV-0001', 'POST', '/facturation', {
        sens: 'VENTE', numeroSerie: 'FV-0001', dateFacture: '2026-02-15', tiersId: d.cli.id, contrepartieAdresse: 'Kinshasa, Gombe', autresImpotsEtTaxes: 0,
        lignes: [{ designation: `Ciment ${d.marque}`, quantite: 1, prixUnitaire: d.m.ht, montantHT: d.m.ht, imposable: true, tauxTvaId: t16?.id, tauxApplique: 16, montantTva: d.m.tva }],
      });
      if (d.facture) {
        const cp = await d.c.geste('Comptabilisation de FV-0001', 'POST', `/facturation/${d.facture.id}/comptabiliser`, { journalId: d.c.journal('VEN').id, compteGestionId: compte(d.c, VENTES) });
        if (cp) compter(d, 'VEN', '2026-02-15');
        d.ecritureFacture = cp?.ecritureId ?? null;
      }
    });
    await tous((d) => validerJusqua(d.c, ex(d), '2026-12-31'));
  });

  await etape(R, 'Cloisonnement · chaque dossier contre son seul attendu', () => tous(async (d) => {
    const n = ex(d);
    const b = await balance(d.c, n);
    const sarl = d.referentiel === 'SYSCOHADA';
    const resultat = auCentime(sarl ? d.m.ht - d.m.loyer - 4 * d.m.elec : -(d.m.loyer + 4 * d.m.elec));
    R.montant(`${d.nom} · balance équilibrée`, 0, b ? b.totalDebit - b.totalCredit : null);
    R.montant(`${d.nom} · banque 52110000`, d.m.banque, solde(b, BQ));
    R.montant(`${d.nom} · loyer 62220000`, d.m.loyer, solde(b, LOYER));
    R.montant(`${d.nom} · électricité 60520000`, auCentime(4 * d.m.elec), solde(b, ELEC));
    R.montant(`${d.nom} · fournisseur homonyme 40110001`, 0, solde(b, d.frs.numero));
    R.montant(`${d.nom} · apport ${d.capital}`, -d.m.apport, solde(b, d.capital));
    if (sarl) {
      R.montant(`${d.nom} · client homonyme ${d.cli.numero}`, d.m.ttc, solde(b, d.cli.numero));
      R.montant(`${d.nom} · ventes 70110000`, -d.m.ht, solde(b, VENTES));
      R.montant(`${d.nom} · TVA facturée 4431`, -d.m.tva, solde(b, '4431'));
    }
    R.montant(`${d.nom} · résultat (classes 6 à 8)`, resultat, -(solde(b, '6') + solde(b, '7') + solde(b, '8')));
    const gl = await lignesDuCompte(d.c, BQ, n);
    R.montant(`${d.nom} · grand livre 52110000 · six lignes`, 6, gl.length);
    R.montant(`${d.nom} · grand livre 52110000 · solde`, d.m.banque, gl.reduce((t, l) => t + Number(l.debit ?? 0) - Number(l.credit ?? 0), 0));
    const autres = Object.values(DOSSIERS).filter((x) => x.marque !== d.marque).map((x) => x.marque);
    R.egal(`${d.nom} · grand livre 52110000 · aucun libellé d’un autre dossier`, [], gl.map((l) => String(l.libelle ?? '')).filter((t) => autres.some((m) => t.includes(m))));
    if (sarl) {
      const bil = aplatir(await d.c.lire('Bilan', `/etats-financiers-syscohada/bilan?exerciceId=${n}`));
      const total = auCentime(d.m.banque + d.m.ttc);  // le bien de B n'existe pas encore à ce stade
      R.montant(`${d.nom} · bilan · total actif (BZ)`, total, bil.BZ?.n);
      R.montant(`${d.nom} · bilan · total passif (DZ)`, total, bil.DZ?.n);
      const cr = aplatir(await d.c.lire('Compte de résultat', `/etats-financiers-syscohada/compte-de-resultat?exerciceId=${n}`));
      R.montant(`${d.nom} · compte de résultat · résultat net (XI)`, resultat, cr.XI?.n);
    } else {
      const bil = await d.c.lire('Bilan', `/etats-financiers/bilan?exerciceId=${n}`);
      R.montant(`${d.nom} · bilan · total actif`, d.m.banque, bil?.totalActif);
      R.montant(`${d.nom} · bilan · total passif`, d.m.banque, bil?.totalPassif);
      const cr = await d.c.lire('Compte de résultat', `/etats-financiers/compte-de-resultat?exerciceId=${n}`);
      R.montant(`${d.nom} · compte de résultat · résultat net`, resultat, cr?.resultatNet);
    }
    // --- 2. Numérotation des pièces, continue par journal (par mois pour un
    // journal en numérotation MENSUELLE, celle que le semis donne à la banque) ---
    const liste = (await d.c.lire('Écritures de 2026', `/ecritures?exerciceId=${n}`))?.ecritures ?? [];
    const modes = new Map(((await d.c.lire('Journaux', '/journaux')) ?? []).map((j) => [j.code, j.numerotation]));
    const sequence = (code, date) => (modes.get(code) === 'MENSUELLE' ? `${code} ${String(date).slice(0, 7)}` : code);
    const attendu = new Map();
    for (const p of d.pieces) attendu.set(sequence(p.code, p.date), (attendu.get(sequence(p.code, p.date)) ?? 0) + 1);
    for (const [seq, nombre] of attendu) {
      const numeros = liste.filter((e) => sequence(e.journal?.code, e.date) === seq).map((e) => Number(e.numeroPiece)).sort((x, y) => x - y);
      R.egal(`${d.nom} · séquence ${seq} · pièces numérotées 1 à ${nombre}, sans saut ni doublon`, Array.from({ length: nombre }, (_, i) => i + 1), numeros);
    }
  }));

  // --- 3. Ce que B possède, et les tentatives de A ----------------------------
  const A = D.A;
  const B = D.B;
  const nA = ex(A);
  const nB = ex(B);
  await etape(R, 'Cloisonnement · objets propres à B (bien, rapprochement, bulletin, pièce au brouillard)', async () => {
    B.immo = await B.c.geste('Bien de B', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(B.c, '24410000'), designation: `Ordinateur ${B.marque}`, dateAcquisition: '2026-02-01', dateMiseEnService: '2026-02-01',
      valeurOrigine: 1_200_202.47, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(B.c, '48120000'), exerciceId: nB, journalId: B.c.od.id,
    });
    B.rapprochement = await B.c.geste('Rapprochement de B ouvert', 'POST', '/rapprochements', { compteId: compte(B.c, BQ), dateReleve: '2026-06-30', soldeReleve: 0 });
    const s = await B.c.geste('Salarié de B', 'POST', '/personnel/salaries', { nom: `OKAPI ${B.marque}`, sexe: 'FEMININ', nationalite: 'congolaise' });
    B.salarie = s;
    if (s) {
      await B.c.geste('Contrat du salarié de B', 'POST', `/personnel/salaries/${s.id}/contrats`, {
        type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01', natureTravail: 'Magasinière', classeProfessionnelle: 7,
        periodiciteRemuneration: 'MOIS', remunerationBase: 2_000_202.47, deviseRemuneration: 'CDF',
      });
      B.bulletin = await B.c.geste('Bulletin de janvier du salarié de B', 'POST', `/personnel/salaries/${s.id}/bulletins`, {
        moisDePaie: '2026-01', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 2_000_202.47 }],
        natureEmployeurInpp: 'PRIVE', effectif: 1, regimeSalarial: 'BAREME_ARTICLE_118',
      });
    }
    B.piege = await ecriture(B.c, 'Pièce au brouillard de B', nB, '2026-05-15', `Pièce au brouillard ${B.marque}`, [[LOYER, B.m.piege, 0], [B.frs.numero, 0, B.m.piege]], { journal: B.c.journal('ACH'), reference: 'REF-0001' });
    A.piege = await ecriture(A.c, 'Pièce au brouillard de A', nA, '2026-05-15', `Pièce au brouillard ${A.marque}`, [[LOYER, A.m.piege, 0], [A.frs.numero, 0, A.m.piege]], { journal: A.c.journal('ACH'), reference: 'REF-0001' });
  });

  /** Tout ce qui est propre à B · marqueur, nom, adresse, identifiants, montants. */
  const fouilleB = () => [
    B.marque, B.nom, B.c.email, B.c.tenantId, nB, B.c.moi?.id, B.facture?.id, B.immo?.id, B.rapprochement?.id, B.salarie?.id, B.bulletin?.id,
    B.piege?.id, B.apport?.id, B.loyer?.id, B.reglement?.id, B.frs?.id, B.cli?.id, B.exclusif?.id, B.frs?.compteId, B.cli?.compteId,
    'Tiers Exclusif Beta', '1000202.47', '75202.47', '2000202.47', '10000202.47', '1200202.47', '50202.47', '8699190.12', '2320234.87', '699190.12',
  ].filter(Boolean).map(String);

  let photoAvant = null;
  await etape(R, 'Cloisonnement · tentatives de A sur les identifiants réels de B', async () => {
    photoAvant = await photographie(B.c, nB);
    const f = fouilleB();
    const ligneFrsB = B.lignesFrs?.[0];
    const lettreB = ((await B.c.lire('Lettrage du fournisseur de B', `/comptes/${B.frs.compteId}/lettrage`))?.lignes ?? []).find((l) => l.id === ligneFrsB);
    const odA = A.c.od.id;
    // Lectures
    await tenter(R, A.c, 'lire le grand livre de B', 'GET', `/ecritures/grand-livre/${compte(B.c, BQ)}?exerciceId=${nB}`, undefined, f);
    await tenter(R, A.c, 'lister les écritures de l’exercice de B', 'GET', `/ecritures?exerciceId=${nB}`, undefined, f);
    await tenter(R, A.c, 'lire la balance de l’exercice de B', 'GET', `/ecritures/balance?exerciceId=${nB}`, undefined, f);
    await tenter(R, A.c, 'lire le bilan de B', 'GET', `/etats-financiers-syscohada/bilan?exerciceId=${nB}`, undefined, f);
    await tenter(R, A.c, 'exporter le journal de B', 'GET', `/exports/journal?exerciceId=${nB}`, undefined, f);
    await tenter(R, A.c, 'lire le tiers de B', 'GET', `/tiers/${B.exclusif?.id}`, undefined, f);
    await tenter(R, A.c, 'lire le lettrage du compte de B', 'GET', `/comptes/${B.frs.compteId}/lettrage`, undefined, f);
    await tenter(R, A.c, 'lire le rapprochement de B', 'GET', `/rapprochements/${B.rapprochement?.id}`, undefined, f);
    await tenter(R, A.c, 'lire le bulletin de B', 'GET', `/personnel/bulletins/${B.bulletin?.id}`, undefined, f);
    await tenter(R, A.c, 'lire les contrôles de l’exercice de B', 'GET', `/controles?exerciceId=${nB}`, undefined, f);
    // Écritures et lignes
    await tenter(R, A.c, 'modifier la pièce au brouillard de B', 'PATCH', `/ecritures/${B.piege?.id}`, { libelle: 'Pièce détournée' }, f);
    await tenter(R, A.c, 'valider la pièce au brouillard de B', 'POST', '/ecritures/valider', { ecritureIds: [B.piege?.id] }, f, [400, 403, 404]);
    await tenter(R, A.c, 'supprimer la pièce au brouillard de B', 'DELETE', `/ecritures/${B.piege?.id}`, undefined, f);
    await tenter(R, A.c, 'corriger une écriture validée de B', 'POST', `/ecritures/${B.loyer?.id}/correction`, { date: '2026-06-30', motifCorrection: 'Correction détournée' }, f);
    // Lettrage
    if (lettreB?.lettre) await tenter(R, A.c, 'délettrer le fournisseur de B', 'DELETE', `/comptes/${B.frs.compteId}/lettrage/${lettreB.lettre}`, undefined, f);
    else R.note('Lettre du groupe du fournisseur de B introuvable · tentative de délettrage non jouée');
    await tenter(R, A.c, 'lettrer les lignes de B sur le compte de B', 'POST', `/comptes/${B.frs.compteId}/lettrage`, { ligneIds: B.lignesFrs }, f);
    await tenter(R, A.c, 'lettrer les lignes de B sur le compte homonyme de A', 'POST', `/comptes/${A.frs.compteId}/lettrage`, { ligneIds: B.lignesFrs }, f, [400, 403, 404]);
    // Comptes et tiers
    await tenter(R, A.c, 'renommer le compte 62220000 de B', 'PATCH', `/comptes/${compte(B.c, LOYER)}`, { intitule: 'Compte détourné' }, f);
    await tenter(R, A.c, 'supprimer le compte 62220000 de B', 'DELETE', `/comptes/${compte(B.c, LOYER)}`, undefined, f);
    await tenter(R, A.c, 'renommer le tiers exclusif de B', 'PATCH', `/tiers/${B.exclusif?.id}`, { nom: 'Tiers détourné' }, f);
    await tenter(R, A.c, 'supprimer le tiers exclusif de B', 'DELETE', `/tiers/${B.exclusif?.id}`, undefined, f);
    // Facture
    await tenter(R, A.c, 'supprimer la facture FV-0001 de B', 'DELETE', `/facturation/${B.facture?.id}`, undefined, f);
    await tenter(R, A.c, 'émettre une note de crédit sur la facture de B', 'POST', `/facturation/${B.facture?.id}/note-de-credit`, { numeroSerie: 'NC-0001', dateNote: '2026-06-30' }, f);
    await tenter(R, A.c, 'comptabiliser la facture de B dans A', 'POST', `/facturation/${B.facture?.id}/comptabiliser`, { journalId: A.c.journal('VEN').id, compteGestionId: compte(A.c, VENTES) }, f);
    // Exercice
    await tenter(R, A.c, 'clôturer l’exercice de B', 'POST', `/exercices/${nB}/cloturer`, {}, f);
    await tenter(R, A.c, 'arrêter les comptes de B', 'POST', `/exercices/${nB}/arrete-comptes`, { dateArreteComptes: '2027-03-31' }, f);
    // Immobilisation
    await tenter(R, A.c, 'doter le bien de B', 'POST', `/immobilisations/${B.immo?.id}/dotation`, { exerciceId: nA, journalId: odA }, f);
    await tenter(R, A.c, 'céder le bien de B', 'POST', `/immobilisations/${B.immo?.id}/sortie`, {
      dateSortie: '2026-06-30', type: 'CESSION', exerciceId: nA, journalId: odA, prixCession: 1, compteContrepartieId: compte(A.c, BQ),
      natureSortie: 'VENTE', referencePieceSortie: 'DETOURNE-1', datePieceSortie: '2026-06-30',
    }, f);
    // Rapprochement
    const ligneBqB = B.reglement?.lignes?.find((l) => l.compteId === compte(B.c, BQ))?.id;
    await tenter(R, A.c, 'pointer une ligne de B dans le rapprochement de B', 'POST', `/rapprochements/${B.rapprochement?.id}/pointer`, { ligneIds: [ligneBqB] }, f);
    await tenter(R, A.c, 'déclarer le départ du rapprochement de B', 'PATCH', `/rapprochements/${B.rapprochement?.id}/depart`, { soldeDepart: 0, dateDepart: '2026-01-01' }, f);
    await tenter(R, A.c, 'clôturer le rapprochement de B', 'POST', `/rapprochements/${B.rapprochement?.id}/cloturer`, undefined, f);
    await tenter(R, A.c, 'annuler le rapprochement de B', 'DELETE', `/rapprochements/${B.rapprochement?.id}`, undefined, f);
    await tenter(R, A.c, 'rouvrir le rapprochement de B', 'POST', `/rapprochements/${B.rapprochement?.id}/rouvrir`, { motif: 'Réouverture détournée' }, f, [400, 403, 404]);
    // Bulletin
    await tenter(R, A.c, 'annuler le bulletin de B', 'POST', `/personnel/bulletins/${B.bulletin?.id}/annulation`, { motif: 'Annulation détournée' }, f);
    await tenter(R, A.c, 'déclarer la remise du bulletin de B', 'POST', `/personnel/bulletins/${B.bulletin?.id}/remise`, { remisLe: '2026-02-05' }, f);
    // Utilisateur
    await tenter(R, A.c, 'rétrograder l’administrateur de B', 'PATCH', `/utilisateurs/${B.c.moi?.id}`, { role: 'LECTURE_SEULE' }, f);
    await tenter(R, A.c, 'désactiver l’administrateur de B', 'PATCH', `/utilisateurs/${B.c.moi?.id}`, { estActif: false }, f);
    await tenter(R, A.c, 'réinitialiser le mot de passe de l’administrateur de B', 'POST', `/utilisateurs/${B.c.moi?.id}/reinitialiser-mot-de-passe`, { motDePasseProvisoire: 'Detourne-2026-provisoire!' }, f);
    await tenter(R, A.c, 'restreindre les journaux de l’administrateur de B', 'PUT', `/utilisateurs/${B.c.moi?.id}/journaux`, { restreindre: true, journaux: [] }, f);
    // Identifiants de B glissés dans un geste propre à A
    await tenter(R, A.c, 'écriture de A sur les comptes de B', 'POST', '/ecritures', {
      exerciceId: nA, journalId: odA, date: '2026-06-30', libelle: 'Écriture croisée',
      lignes: [{ compteId: compte(B.c, LOYER), debit: 1_000, credit: 0 }, { compteId: compte(B.c, BQ), debit: 0, credit: 1_000 }],
    }, f, [400, 403, 404]);
    await tenter(R, A.c, 'règlement dans A de la facture de B', 'POST', '/reglements', {
      sens: 'CLIENT', exerciceId: nA, journalId: A.c.journal('BQ').id, date: '2026-06-30',
      reglements: [{ compteId: B.cli.compteId, ligneIds: [B.ecritureFacture ? (await B.c.lire('Lignes du client de B', `/comptes/${B.cli.compteId}/lettrage?nonLettreesSeulement=true`))?.lignes?.[0]?.id : B.lignesFrs?.[0]].filter(Boolean) }],
    }, f, [400, 403, 404]);
    await tenter(R, A.c, 'facture de A au tiers de B', 'POST', '/facturation', {
      sens: 'VENTE', numeroSerie: 'FV-9999', dateFacture: '2026-06-30', tiersId: B.cli.id, contrepartieAdresse: 'Kinshasa', autresImpotsEtTaxes: 0,
      lignes: [{ designation: 'Croisée', quantite: 1, prixUnitaire: 1_000, montantHT: 1_000, imposable: false, montantTva: 0 }],
    }, f, [400, 403, 404]);
    await tenter(R, A.c, 'rapprochement de A sur la banque de B', 'POST', '/rapprochements', { compteId: compte(B.c, BQ), dateReleve: '2026-06-30', soldeReleve: 0 }, f, [400, 403, 404]);
    await tenter(R, A.c, 'bien de A sur le compte de B', 'POST', '/immobilisations', {
      compteImmobilisationId: compte(B.c, '24410000'), designation: 'Bien croisé', dateAcquisition: '2026-02-01', dateMiseEnService: '2026-02-01',
      valeurOrigine: 1_000, dureeAmortissementAns: 4, modeAmortissement: 'LINEAIRE', compteContrepartieId: compte(A.c, '48120000'), exerciceId: nA, journalId: odA,
    }, f, [400, 403, 404]);
    await tenter(R, A.c, 'créance douteuse de A sur le client de B', 'POST', '/creances-douteuses', {
      motif: 'Reclassement croisé', pieces: [{ nature: 'Mise en demeure', reference: 'MED-X', date: '2026-06-30' }],
      exerciceId: nA, journalId: odA, date: '2026-06-30', compteCreanceId: B.cli.compteId, nature: 'DOUTEUSE', montant: 1_000,
    }, f, [400, 403, 404]);

    const photoApres = await photographie(B.c, nB);
    for (const cle of Object.keys(photoAvant)) R.egal(`B relu par sa session après les tentatives · ${cle} inchangé`, photoAvant[cle], photoApres[cle]);
    const bA = await balance(A.c, nA);
    R.montant('A après ses tentatives · banque inchangée (aucune écriture croisée)', A.m.banque, solde(bA, BQ));
    R.montant('A après ses tentatives · aucun bien ni immobilisation croisée (24410000)', 0, solde(bA, '2441'));
  });

  // --- 4. Rien de B dans ce que A lit et exporte -------------------------------
  await etape(R, 'Cloisonnement · listes, recherches, exports, audit et restitution de A', async () => {
    const f = fouilleB();
    const artefacts = [
      ['liste des écritures', `/ecritures?exerciceId=${nA}`, A.marque],
      ['recherche par libellé « Loyer »', `/ecritures?exerciceId=${nA}&recherche=Loyer`, A.marque],
      ['recherche par référence REF-0001', `/ecritures?exerciceId=${nA}&reference=REF-0001`, A.marque],
      ['recherche par le montant du loyer de B', `/ecritures?exerciceId=${nA}&montant=1000202.47`, null],
      ['balance', `/ecritures/balance?exerciceId=${nA}`, '8699596'],
      ['plan des tiers', '/tiers', 'Fournisseur Commun'],
      ['plan des comptes', '/comptes', LOYER],
      ['factures', '/facturation', 'FV-0001'],
      ['immobilisations', '/immobilisations', null],
      ['rapprochements', '/rapprochements', null],
      ['salariés', '/personnel/salaries', null],
      ['bulletins', '/personnel/bulletins', null],
      ['utilisateurs', '/utilisateurs', A.c.email],
      ['journal d’audit', '/journal-audit', A.c.tenantId],
      ['contrôles', `/controles?exerciceId=${nA}`, null],
      ['export du journal', `/exports/journal?exerciceId=${nA}`, A.marque],
      ['export du grand livre', `/exports/grand-livre?exerciceId=${nA}`, A.marque],
      ['export de la balance', `/exports/balance?exerciceId=${nA}`, '8699596'],
      ['liasse Excel', `/exports/etats-financiers-syscohada/liasse-complete?exerciceId=${nA}`, '8699596'],
      ['restitution du dossier', '/restitution/archive', A.marque],
    ];
    for (const [nom, chemin, temoin] of artefacts) {
      const r = await A.c.lire(`A · ${nom}`, chemin);
      const texte = await texteDe(r);
      if (temoin) R.egal(`A · ${nom} · porte bien les données de A (témoin « ${temoin.slice(0, 20)} »)`, true, texte.includes(temoin));
      R.egal(`A · ${nom} · aucune chaîne propre à B`, [], f.filter((m) => texte.includes(m)));
    }
    const rech = await A.c.lire('A · recherche par le montant du loyer de B', `/ecritures?exerciceId=${nA}&montant=1000202.47`);
    R.montant('A · recherche par le montant du loyer de B · aucune écriture', 0, rech?.total);
  });

  // --- 6. Utilisateurs ------------------------------------------------------------
  await etape(R, 'Cloisonnement · utilisateurs de A et de B', async () => {
    const f = fouilleB();
    const suffixe = `${Date.now()}`;
    const comptables = {};
    for (const [cle, role] of [['comptable', 'COMPTABLE'], ['lecture', 'LECTURE_SEULE']]) {
      const email = `cloison-a-${cle}-${suffixe}@exemple.cd`;
      const u = await A.c.geste(`Utilisateur ${cle} de A`, 'POST', '/utilisateurs', { email, motDePasse: 'Provisoire-A-2026!x', role });
      const s = await connecter(R, email, 'Provisoire-A-2026!x', `Nouveau-A-${cle}-2026!x`);
      R.egal(`Utilisateur ${cle} de A · connecté à A et à A seul`, A.c.tenantId, s.moi?.tenant?.id ?? null);
      comptables[cle] = { id: u?.id, email, client: s.client };
      if (s.client) await tenter(R, s.client, `utilisateur ${cle} de A · lire le tiers exclusif de B`, 'GET', `/tiers/${B.exclusif?.id}`, undefined, f);
      const d = await s.client.req('POST', '/auth/login', { email, motDePasse: `Nouveau-A-${cle}-2026!x`, tenantId: B.c.tenantId });
      const moi = d.statut < 400 ? (await s.client.req('GET', '/auth/me')).corps : null;
      R.egal(`Utilisateur ${cle} de A · une connexion qui nomme le dossier B ne mène pas à B`, true, d.statut >= 400 || moi?.tenant?.id === A.c.tenantId);
    }
    const invit = await A.c.req('POST', '/utilisateurs', { email: B.c.email, motDePasse: 'Provisoire-X-2026!x', role: 'COMPTABLE' });
    R.egal('A invite l’adresse de l’administrateur de B · refusé', true, invit.statut >= 400 && invit.statut < 500);
    R.egal('A invite l’adresse de l’administrateur de B · le refus ne dit rien de B', [], f.filter((m) => m !== B.c.email && JSON.stringify(invit.corps ?? '').includes(m)));
    const relogB = await connecter(R, B.c.email, MOT_DE_PASSE);
    R.egal('L’administrateur de B se connecte toujours à B', B.c.tenantId, relogB.moi?.tenant?.id ?? null);
    R.egal('L’administrateur de B garde son rôle', 'ADMIN_CABINET', relogB.moi?.role ?? null);
    const usersAvant = (await B.c.req('GET', '/utilisateurs')).corps;
    const compB = await B.c.geste('Utilisateur comptable de B', 'POST', '/utilisateurs', { email: `cloison-b-comptable-${suffixe}@exemple.cd`, motDePasse: 'Provisoire-B-2026!x', role: 'COMPTABLE' });
    const sB = await connecter(R, `cloison-b-comptable-${suffixe}@exemple.cd`, 'Provisoire-B-2026!x', 'Nouveau-B-comptable-2026!x');
    R.egal('Comptable de B · connecté à B', B.c.tenantId, sB.moi?.tenant?.id ?? null);
    const usersB1 = (await B.c.req('GET', '/utilisateurs')).corps;
    // Changements dans A
    await A.c.geste('Rôle du comptable de A abaissé', 'PATCH', `/utilisateurs/${comptables.comptable.id}`, { role: 'LECTURE_SEULE' });
    await A.c.geste('Utilisateur lecture seule de A désactivé', 'PATCH', `/utilisateurs/${comptables.lecture.id}`, { estActif: false });
    const meA = await comptables.comptable.client.req('GET', '/auth/me');
    R.egal('Comptable de A après le changement de rôle · sa session est fermée (révocation)', 401, meA.statut);
    const usersA = liste((await A.c.req('GET', '/utilisateurs')).corps, 'utilisateurs');
    R.egal('A · l’utilisateur désactivé l’est', false, usersA.find((u) => u.id === comptables.lecture.id)?.estActif ?? null);
    const reconnexion = await new Client(R).req('POST', '/auth/login', { email: comptables.lecture.email, motDePasse: 'Nouveau-A-lecture-2026!x' });
    R.egal('A · l’utilisateur désactivé ne se connecte plus', true, reconnexion.statut >= 400);
    // Rien dans B
    const meB = await B.c.req('GET', '/auth/me');
    R.egal('B · la session de l’administrateur reste ouverte', [200, 'ADMIN_CABINET'], [meB.statut, meB.corps?.role ?? null]);
    const meBc = await sB.client.req('GET', '/auth/me');
    R.egal('B · la session du comptable de B reste ouverte', [200, 'COMPTABLE'], [meBc.statut, meBc.corps?.role ?? null]);
    const usersB2 = (await B.c.req('GET', '/utilisateurs')).corps;
    const vue = (l) => JSON.stringify(liste(l, 'utilisateurs').map((u) => [u.id, u.email, u.role, u.estActif]).sort());
    R.egal('B · ses utilisateurs inchangés par les gestes de A', vue(usersB1), vue(usersB2));
    R.egal('B · la liste des utilisateurs de B ne compte que ses deux utilisateurs', 2, liste(usersB2, 'utilisateurs').length);
    void usersAvant;
    void compB;
  });

  // --- 5. Clôtures simultanées -----------------------------------------------
  await etape(R, 'Cloisonnement · B range ses objets, puis clôtures de A, B et C en même temps', async () => {
    if (B.piege) await B.c.geste('B retire sa pièce au brouillard', 'DELETE', `/ecritures/${B.piege.id}`);
    if (A.piege) await A.c.geste('A retire sa pièce au brouillard', 'DELETE', `/ecritures/${A.piege.id}`);
    if (B.bulletin) await B.c.geste('B annule son bulletin', 'POST', `/personnel/bulletins/${B.bulletin.id}/annulation`, { motif: 'Bulletin d’essai du banc' });
    if (B.rapprochement) await B.c.geste('B annule son rapprochement', 'DELETE', `/rapprochements/${B.rapprochement.id}`);
    // Le bien de B est entré au brouillard avec son écriture d'acquisition · la
    // clôture ne lit que le livre-journal, chacun valide d'abord.
    await tous((d) => validerJusqua(d.c, ex(d), '2026-12-31'));
    const issues = await tous((d) => cloturer(d.c, '2026'));
    for (const [i, cle] of cles.entries()) R.egal(`${D[cle].nom} · clôture 2026 lancée en même temps que les autres · aboutie`, true, issues[i]);
    await tous(async (d) => {
      await rechargerExercices(d.c);
      const n1 = d.c.exercices.get('2027')?.id;
      if (!n1) return R.note(`${d.nom} · 2027 absent après la clôture`);
      const b = await balance(d.c, n1);
      const sarl = d.referentiel === 'SYSCOHADA';
      const resultat = auCentime(sarl ? d.m.ht - d.m.loyer - 4 * d.m.elec : -(d.m.loyer + 4 * d.m.elec));
      R.montant(`${d.nom} · 2027 · à-nouveau banque`, d.m.banque, solde(b, BQ));
      R.montant(`${d.nom} · 2027 · à-nouveau résultat 2026 au 13`, -resultat, solde(b, '13'));
      R.montant(`${d.nom} · 2027 · à-nouveau apport`, -d.m.apport, solde(b, d.capital));
      if (sarl) R.montant(`${d.nom} · 2027 · à-nouveau client homonyme`, d.m.ttc, solde(b, d.cli.numero));
      if (d === B) {
        R.montant(`${d.nom} · 2027 · à-nouveau du bien de B`, 1_200_202.47, solde(b, '2441'));
        R.montant(`${d.nom} · 2027 · à-nouveau du fournisseur d’investissement`, -1_200_202.47, solde(b, '4812'));
      }
      if (d === A) R.montant(`${d.nom} · 2027 · aucun bien (celui de B n’a pas traversé)`, 0, solde(b, '2441'));
      R.montant(`${d.nom} · 2027 · balance d’ouverture équilibrée`, 0, b ? b.totalDebit - b.totalCredit : null);
    });
  });
}
