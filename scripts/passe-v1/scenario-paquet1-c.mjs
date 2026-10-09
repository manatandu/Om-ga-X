/**
 * SCÉNARIO PAQUET 1 · LIGNE C (paie, fiscal, cloisonnement), docs/plan-version-1.md § 7.
 *
 * Chaque point est joué sur des dossiers neufs, par l'API du serveur compilé.
 * Chaque contrôle exprime le comportement JUSTE · contre `main` (avant
 * correction), il sort en écart ; après correction, il concorde. Aucun point
 * de cette ligne ne touche la clôture.
 *
 * PAQUET1_C_POINTS=C3,C4 ne joue que les points nommés (tous par défaut).
 *
 * Les montants attendus sont calculés à la main en commentaire, à côté de
 * leur contrôle ; aucun numéro de compte n'est deviné (`compte()` lève si le
 * plan semé ne l'a pas).
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cloturer, compte, ecriture, etape, nouveauDossier, validerJusqua } from './lib.mjs';

const BQ = '52110000';
const POINTS = (process.env.PAQUET1_C_POINTS ?? 'C3,C4,C1,C2,S1,S2,S3,S4,S5,S6,S7').split(',').map((s) => s.trim()).filter(Boolean);

/** Le message d'une réponse, quelle que soit sa forme. */
const messageDe = (r) => {
  const c = r?.corps;
  if (!c || typeof c !== 'object' || c.contenu) return '';
  return String(Array.isArray(c.message) ? c.message.join(' ') : (c.message ?? ''));
};

// ==============================================================================
// C3 · UN IDENTIFIANT D'UN AUTRE DOSSIER EST INTROUVABLE (404)
// ==============================================================================
//
// CLAUDE.md § 8, cloisonnement · la garde « rend inexistante la ligne lue d'un
// autre dossier ». Un exercice (ou un compte, un journal) d'un autre dossier,
// nommé dans l'adresse d'une route, désigne donc une ressource qui n'existe
// pas pour la session · 404 « introuvable ». La passe V1 n° 2 (constat C3)
// lisait 400 (grand livre, contrôles) ou 200 VIDE (liste, balance, export du
// journal) · aucune fuite, une réponse fausse · « rien dans cet exercice »
// pour un exercice que le serveur n'a pas pu lire.
//
// TOUTES LES ROUTES QUI PORTENT UN `exerciceId` EN REQUÊTE OU EN CHEMIN sont
// jouées, recensées dans les métadonnées des contrôleurs du serveur compilé
// de `main` (e31f4de, 151 routes). Chacune deux fois, avec la session de A ·
// l'exercice de B (attendu 404 « introuvable »), puis le sien (témoin, qui ne
// doit jamais être dit introuvable). Une route refusée au témoin par 403
// (référentiel ou rôle) ne s'applique pas à ce dossier et est sautée, nommée.
// Les autres paramètres de chemin reçoivent un identifiant aléatoire · le
// refus attendu est celui de l'EXERCICE, qui passe avant (le témoin, lui,
// peut rendre 404 pour cet identifiant, jamais « exercice introuvable »).

const ROUTES_EXERCICE = [
  ['GET', '/affectation-resultat/exercice/:exerciceId', 'param'],
  ['GET', '/analytique/od', 'query'],
  ['GET', '/analytique/sections/:sectionId/budget', 'query'],
  ['GET', '/analytique/etats/balance', 'query'],
  ['GET', '/analytique/etats/grand-livre', 'query'],
  ['GET', '/analytique/etats/controle-cumuls', 'query'],
  ['GET', '/analytique/etats/budgetaire', 'query'],
  ['GET', '/analytique/engagements', 'query'],
  ['GET', '/analytique/engagements/ecritures-rattachables', 'query'],
  ['GET', '/comptabilite-gestion/comportements', 'query'],
  ['GET', '/comptabilite-gestion/seuil-rentabilite', 'query'],
  ['GET', '/comptabilite-gestion/cles', 'query'],
  ['GET', '/comptabilite-gestion/couts-production', 'query'],
  ['GET', '/circularisation', 'query'],
  ['GET', '/ecritures', 'query'],
  ['GET', '/ecritures/brouillard', 'query'],
  ['GET', '/ecritures/balance', 'query'],
  ['GET', '/ecritures/echeancier', 'query'],
  ['GET', '/ecritures/balance-agee', 'query'],
  ['GET', '/ecritures/justificatif-solde/:compteId', 'query'],
  ['GET', '/ecritures/balance-auxiliaire', 'query'],
  ['GET', '/ecritures/grand-livre/:compteId', 'query'],
  ['GET', '/ecritures/grand-livre', 'query'],
  ['GET', '/consolidation/perimetre', 'query'],
  ['GET', '/consolidation/cumul', 'query'],
  ['GET', '/consolidation/etats', 'query'],
  ['GET', '/controles', 'query'],
  ['GET', '/controles/caisse', 'query'],
  ['GET', '/controles/evolution-mensuelle', 'query'],
  ['GET', '/controles/dossier-revision', 'query'],
  ['GET', '/creances-douteuses', 'query'],
  ['GET', '/creances-douteuses/comptes', 'query'],
  ['GET', '/creances-douteuses/:id/revue', 'query'],
  ['GET', '/creances-douteuses/:id/lettrage-416', 'query'],
  ['GET', '/devises/provision-ouverture', 'query'],
  ['GET', '/devises/reevaluation/liste', 'query'],
  ['GET', '/documents-obligatoires/livre-inventaire', 'query'],
  ['GET', '/documents-obligatoires/livre-inventaire/conformite', 'query'],
  ['GET', '/documents-obligatoires/rapport-activite', 'query'],
  ['GET', '/documents-obligatoires/rapport-activite/conformite', 'query'],
  ['GET', '/etats-financiers/bilan', 'query'],
  ['GET', '/etats-financiers/compte-de-resultat', 'query'],
  ['GET', '/etats-financiers/tableau-flux-tresorerie', 'query'],
  ['GET', '/etats-financiers/projet/bilan', 'query'],
  ['GET', '/etats-financiers/projet/compte-exploitation', 'query'],
  ['GET', '/etats-financiers/projet/emplois-ressources', 'query'],
  ['GET', '/etats-financiers/projet/execution-budgetaire', 'query'],
  ['GET', '/etats-financiers/projet/reconciliation-tresorerie', 'query'],
  ['GET', '/etats-financiers/projet/note-bailleur', 'query'],
  ['GET', '/etats-financiers/smt/bilan', 'query'],
  ['GET', '/etats-financiers/smt/compte-de-resultat', 'query'],
  ['GET', '/etats-financiers/smt/journal-tresorerie', 'query'],
  ['GET', '/etats-financiers/smt/notes', 'query'],
  ['GET', '/etats-financiers/smt/eligibilite', 'query'],
  ['GET', '/etats-financiers-syscohada/bilan', 'query'],
  ['GET', '/etats-financiers-syscohada/compte-de-resultat', 'query'],
  ['GET', '/etats-financiers-syscohada/tableau-flux-tresorerie', 'query'],
  ['GET', '/etats-financiers-syscohada/notes', 'query'],
  ['GET', '/etats-financiers-syscohada/smt/bilan', 'query'],
  ['GET', '/etats-financiers-syscohada/smt/compte-de-resultat', 'query'],
  ['GET', '/etats-financiers-syscohada/smt/journal-tresorerie', 'query'],
  ['GET', '/etats-financiers-syscohada/smt/notes', 'query'],
  ['GET', '/etats-financiers-syscohada/smt/eligibilite', 'query'],
  ['GET', '/exports/journal', 'query'],
  ['GET', '/exports/grand-livre', 'query'],
  ['GET', '/exports/grand-livre-tiers', 'query'],
  ['GET', '/exports/balance-auxiliaire', 'query'],
  ['GET', '/exports/grand-livre/:compteId', 'query'],
  ['GET', '/exports/balance', 'query'],
  ['GET', '/exports/balance-agee', 'query'],
  ['GET', '/exports/justificatif-solde/:compteId', 'query'],
  ['GET', '/exports/tableau-amortissements', 'query'],
  ['GET', '/exports/etats-financiers/liasse-complete', 'query'],
  ['GET', '/exports/etats-financiers/bilan', 'query'],
  ['GET', '/exports/etats-financiers/compte-de-resultat', 'query'],
  ['GET', '/exports/etats-financiers/tableau-flux-tresorerie', 'query'],
  ['GET', '/exports/etats-financiers/projet/bilan', 'query'],
  ['GET', '/exports/etats-financiers/projet/compte-exploitation', 'query'],
  ['GET', '/exports/etats-financiers/projet/note-bailleur', 'query'],
  ['GET', '/exports/etats-financiers/projet/emplois-ressources', 'query'],
  ['GET', '/exports/etats-financiers/projet/execution-budgetaire', 'query'],
  ['GET', '/exports/etats-financiers/projet/reconciliation-tresorerie', 'query'],
  ['GET', '/exports/etats-financiers/smt/bilan', 'query'],
  ['GET', '/exports/etats-financiers/smt/compte-de-resultat', 'query'],
  ['GET', '/exports/etats-financiers/smt/journal-tresorerie', 'query'],
  ['GET', '/exports/etats-financiers/smt/notes', 'query'],
  ['GET', '/exports/etats-financiers/smt/eligibilite', 'query'],
  ['GET', '/exports/notes-annexes/associations', 'query'],
  ['GET', '/exports/registre-donateurs', 'query'],
  ['GET', '/exports/test-ecritures-journal', 'query'],
  ['GET', '/exports/livre-inventaire', 'query'],
  ['GET', '/exports/rapport-activite', 'query'],
  ['GET', '/exports/notes-annexes/projet', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/liasse-complete', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/bilan', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/compte-de-resultat', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/tableau-flux-tresorerie', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/notes-annexes', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/smt/bilan', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/smt/compte-de-resultat', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/smt/journal-tresorerie', 'query'],
  ['GET', '/exports/etats-financiers-syscohada/smt/notes', 'query'],
  ['GET', '/faiblesses', 'query'],
  ['GET', '/fiscalite/exercices/:exerciceId/propositions-retraitements', 'param'],
  ['GET', '/fiscalite/resultat-fiscal', 'query'],
  ['POST', '/fiscalite/exercices/:exerciceId/retraitements', 'param'],
  ['GET', '/fiscalite/exercices/:exerciceId/ecriture-impot', 'param'],
  ['POST', '/fiscalite/exercices/:exerciceId/ecriture-impot', 'param'],
  ['POST', '/fiscalite/exercices/:exerciceId/ecriture-impot/annuler', 'param'],
  ['PATCH', '/fiscalite/exercices/:exerciceId/dossier', 'param'],
  ['GET', '/groupe/supervision', 'query'],
  ['GET', '/groupe/cellules/:celluleId/balance', 'query'],
  ['GET', '/groupe/balance-agregee', 'query'],
  ['GET', '/groupe/liasse/excel', 'query'],
  ['GET', '/groupe/balance-agregee/excel', 'query'],
  ['GET', '/ifrs', 'query'],
  ['GET', '/ifrs/consolide', 'query'],
  ['DELETE', '/ifrs/effet-change/:exerciceId', 'param'],
  ['GET', '/immobilisations/tableau-amortissements', 'query'],
  ['GET', '/immobilisations/:id/demantelement', 'query'],
  ['GET', '/immobilisations/:id/plafond-reprise-depreciation', 'query'],
  ['GET', '/immobilisations/reserve-de-propriete', 'query'],
  ['GET', '/immobilisations/couts-emprunt-incorpores', 'query'],
  ['GET', '/immobilisations/location-acquisition/contrats', 'query'],
  ['GET', '/immobilisations/location-acquisition/contrats/:id/cloture', 'query'],
  ['GET', '/immobilisations/reevaluation-bilan', 'query'],
  ['GET', '/immobilisations/reevaluation-bilan/reprise-provision', 'query'],
  ['GET', '/immobilisations/reevaluation-bilan/note', 'query'],
  ['GET', '/immobilisations/reevaluation-bilan/declaration-speciale', 'query'],
  ['GET', '/immobilisations/:id/reprise-subvention', 'query'],
  ['GET', '/immobilisations/reprises-subvention', 'query'],
  ['GET', '/inventaire', 'query'],
  ['GET', '/inventaire/resume/:exerciceId', 'param'],
  ['GET', '/journaux/saisie', 'query'],
  ['GET', '/journaux/palmares-comptes', 'query'],
  ['GET', '/journaux/analyse', 'query'],
  ['GET', '/monnaie-fonctionnelle/balance/:exerciceId', 'param'],
  ['GET', '/notes-annexes/associations', 'query'],
  ['GET', '/notes-annexes/projet', 'query'],
  ['GET', '/provisions', 'query'],
  ['POST', '/provisions/:exerciceId', 'param'],
  ['GET', '/provisions/variation/:exerciceId', 'param'],
  ['GET', '/questionnaire-revision', 'query'],
  ['GET', '/regularisations', 'query'],
  ['GET', '/registre-donateurs/rapport-conformite', 'query'],
  ['GET', '/reglements/echeances', 'query'],
  ['GET', '/relances', 'query'],
  ['GET', '/relances/releve/:compteId', 'query'],
  ['GET', '/retenues/registre', 'query'],
  ['GET', '/retenues/echeancier', 'query'],
  ['GET', '/stocks/variation/:exerciceId', 'param'],
];

/** Ce qu'une route exige en plus de l'exercice pour que le témoin se lise. */
const EN_PLUS = {
  '/exports/grand-livre-tiers': 'type=FOURNISSEURS',
  '/exports/balance-auxiliaire': 'type=FOURNISSEURS',
  '/reglements/echeances': 'sens=FOURNISSEUR',
};

/** Un corps VALIDE pour les routes d'écriture · le refus attendu est celui de l'exercice, pas celui du corps. */
const CORPS = {
  'POST /fiscalite/exercices/:exerciceId/retraitements': { code: 'AMENDES_PENALITES', sens: 'REINTEGRATION', montant: 1000 },
  'POST /fiscalite/exercices/:exerciceId/ecriture-impot': {},
  'POST /fiscalite/exercices/:exerciceId/ecriture-impot/annuler': { motif: 'Annulation du banc paquet 1' },
  'PATCH /fiscalite/exercices/:exerciceId/dossier': { acomptesVerses: 5000 },
  'POST /provisions/:exerciceId': { objet: 'Litige du banc paquet 1', nature: 'LITIGE', justificationObligation: 'Assignation reçue (banc)' },
};

/** Une adresse jouable · l'exercice à sa place, les autres identifiants aléatoires. */
function adresse(chemin, ou, exerciceId) {
  let a = chemin.replace(':exerciceId', exerciceId).replace(/:[A-Za-z]+/g, () => randomUUID());
  const extra = EN_PLUS[chemin];
  const q = [ou === 'query' ? `exerciceId=${exerciceId}` : null, extra].filter(Boolean).join('&');
  if (q) a += `?${q}`;
  return a;
}

async function paireDeDossiers(R, referentiel, options, cle) {
  const A = await nouveauDossier(R, `Paquet 1 C3 · A ${referentiel}`, { referentiel, ...options, cle: `${cle}-a`, exercice: ['2026-01-01', '2026-12-31'] });
  const B = await nouveauDossier(R, `Paquet 1 C3 · B ${referentiel}`, { referentiel, ...options, cle: `${cle}-b`, exercice: ['2026-01-01', '2026-12-31'] });
  const capital = referentiel === 'SYSCOHADA' ? '10130000' : '10210000';
  for (const d of [A, B]) {
    if (referentiel === 'SYSCOHADA') await d.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    const n = d.exercices.get('2026').id;
    // Une pièce validée et une au brouillard · un état vide ne prouverait rien.
    await ecriture(d, 'Apport', n, '2026-01-02', 'Apport initial', [[BQ, 1_000_000, 0], [capital, 0, 1_000_000]]);
    await validerJusqua(d, n, '2026-12-31');
    await ecriture(d, 'Pièce au brouillard', n, '2026-02-02', 'Pièce au brouillard', [[BQ, 50_000, 0], [capital, 0, 50_000]]);
  }
  return { A, B, nA: A.exercices.get('2026').id, nB: B.exercices.get('2026').id };
}

async function pointC3(R) {
  R.scenario = 'paquet1-c · C3';
  for (const [referentiel, options] of [['SYSCOHADA', { systeme: 'NORMAL' }], ['SYCEBNL', { jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }]]) {
    await etape(R, `C3 · ${referentiel} · chaque route qui porte un exercice`, async () => {
      const { A, B, nA, nB } = await paireDeDossiers(R, referentiel, options, `p1c-c3-${referentiel.toLowerCase()}`);
      const sautees = [];
      for (const [methode, chemin, ou] of ROUTES_EXERCICE) {
        const cle = `${methode} ${chemin}`;
        const corps = CORPS[cle];
        const temoin = await A.req(methode, adresse(chemin, ou, nA), corps);
        if (temoin.statut === 403) {
          sautees.push(cle);
          continue;
        }
        const croise = await A.req(methode, adresse(chemin, ou, nB), corps);
        if (chemin === '/groupe/cellules/:celluleId/balance') {
          // L'exercice y est celui d'une CELLULE, pas du dossier de la
          // session · la route ne le juge qu'en format, et le service refuse
          // la cellule inconnue du groupe (404 nommé) avant de chercher
          // l'exercice dans la cellule. Ici la cellule est aléatoire.
          R.egal(`C3 · ${referentiel} · ${cle} · cellule hors du groupe refusée (404)`, 404, croise.statut);
          continue;
        }
        R.egal(`C3 · ${referentiel} · ${cle} · l'exercice de B est introuvable (404)`, 'refus 404 introuvable',
          croise.statut === 404 && /introuvable/i.test(messageDe(croise)) ? 'refus 404 introuvable' : `statut ${croise.statut} · ${messageDe(croise).slice(0, 90)}`);
        R.egal(`C3 · ${referentiel} · ${cle} · témoin · son propre exercice n'est jamais dit introuvable`, true,
          !(temoin.statut === 404 && /exercice introuvable/i.test(messageDe(temoin))));
      }
      R.note(`C3 · ${referentiel} · ${sautees.length} route(s) sautées, refusées au témoin par 403 (autre référentiel ou rôle) · ${sautees.join(' ; ')}`);

      // B N'A PAS BOUGÉ · les routes d'écriture jouées avec l'exercice de B.
      const provisionsB = await B.lire('Provisions de B', `/provisions?exerciceId=${nB}`);
      R.egal(`C3 · ${referentiel} · B · aucune provision créée par A`, 0, (Array.isArray(provisionsB) ? provisionsB : (provisionsB?.provisions ?? provisionsB?.lignes ?? [])).length);
      if (referentiel === 'SYSCOHADA') {
        const rfB = await B.lire('Résultat fiscal de B', `/fiscalite/resultat-fiscal?exerciceId=${nB}`);
        R.egal(`C3 · ${referentiel} · B · aucun retraitement ni acompte posé par A`, [0, 0], [(rfB?.retraitements ?? []).length, Number(rfB?.acomptesVerses ?? 0)]);
      }

      // LE COMPTE D'UN AUTRE DOSSIER, nommé dans l'adresse (l'exercice est
      // celui de A) · grand livre, justificatif de solde, relevé.
      const bqA = compte(A, BQ);
      const bqB = compte(B, BQ);
      for (const chemin of [
        '/ecritures/grand-livre/:compteId',
        '/ecritures/justificatif-solde/:compteId',
        '/exports/grand-livre/:compteId',
        '/exports/justificatif-solde/:compteId',
        '/relances/releve/:compteId',
      ]) {
        const croise = await A.req('GET', `${chemin.replace(':compteId', bqB)}?exerciceId=${nA}`);
        R.egal(`C3 · ${referentiel} · GET ${chemin} · le compte de B est introuvable (404)`, 'refus 404 introuvable',
          croise.statut === 404 && /introuvable/i.test(messageDe(croise)) ? 'refus 404 introuvable' : `statut ${croise.statut} · ${messageDe(croise).slice(0, 90)}`);
        const temoin = await A.req('GET', `${chemin.replace(':compteId', bqA)}?exerciceId=${nA}`);
        R.egal(`C3 · ${referentiel} · GET ${chemin} · témoin · son propre compte n'est pas dit introuvable`, true,
          !(temoin.statut === 404 && /introuvable/i.test(messageDe(temoin))));
      }

      // LE JOURNAL D'UN AUTRE DOSSIER, en filtre (l'exercice est celui de A)
      // · liste, brouillard, export du journal.
      const jA = A.od.id;
      const jB = B.od.id;
      for (const chemin of ['/ecritures', '/ecritures/brouillard', '/exports/journal']) {
        const croise = await A.req('GET', `${chemin}?exerciceId=${nA}&journalId=${jB}`);
        R.egal(`C3 · ${referentiel} · GET ${chemin} · le journal de B est introuvable (404)`, 'refus 404 introuvable',
          croise.statut === 404 && /introuvable/i.test(messageDe(croise)) ? 'refus 404 introuvable' : `statut ${croise.statut} · ${messageDe(croise).slice(0, 90)}`);
        const temoin = await A.req('GET', `${chemin}?exerciceId=${nA}&journalId=${jA}`);
        R.egal(`C3 · ${referentiel} · GET ${chemin} · témoin · son propre journal se lit (200)`, 200, temoin.statut);
      }
      // Les modèles de saisie se filtrent par le même journal · celui de B
      // rendait les modèles « tous journaux » comme s'il était du dossier.
      const modelesB = await A.req('GET', `/modeles-saisie?journalId=${jB}`);
      R.egal(`C3 · ${referentiel} · GET /modeles-saisie · le journal de B est introuvable (404)`, 'refus 404 introuvable',
        modelesB.statut === 404 && /introuvable/i.test(messageDe(modelesB)) ? 'refus 404 introuvable' : `statut ${modelesB.statut} · ${messageDe(modelesB).slice(0, 90)}`);
      const modelesA = await A.req('GET', `/modeles-saisie?journalId=${jA}`);
      R.egal(`C3 · ${referentiel} · GET /modeles-saisie · témoin · son propre journal se lit (200)`, 200, modelesA.statut);
      // Sans exercice, le journal de B en filtre de la liste (exercice facultatif).
      const sansExercice = await A.req('GET', `/ecritures?journalId=${jB}`);
      R.egal(`C3 · ${referentiel} · GET /ecritures sans exercice · le journal de B est introuvable (404)`, 404, sansExercice.statut);

      // LA VALIDATION PAR LOT · l'exercice de B, puis le journal de B.
      const vj = await A.req('POST', '/ecritures/valider-jusqua', { exerciceId: nB, dateLimite: '2026-12-31' });
      R.egal(`C3 · ${referentiel} · POST /ecritures/valider-jusqua · l'exercice de B est introuvable (404)`, 404, vj.statut);
      const vjj = await A.req('POST', '/ecritures/valider-jusqua', { exerciceId: nA, journalId: jB, dateLimite: '2026-12-31' });
      R.egal(`C3 · ${referentiel} · POST /ecritures/valider-jusqua · le journal de B est introuvable (404)`, 404, vjj.statut);
      const brouillardB = await B.lire('Brouillard de B', `/ecritures/brouillard?exerciceId=${nB}`);
      R.egal(`C3 · ${referentiel} · B · sa pièce au brouillard y est toujours`, 1, (brouillardB?.ecritures ?? brouillardB?.lignes ?? []).length);
    });

    // À TRAVERS UNE CLÔTURE (CLAUDE.md § 10) · le porteur juge l'appartenance
    // au dossier, jamais le statut · l'exercice CLÔTURÉ du dossier et celui
    // qui naît de la clôture ne sont jamais dits introuvables, sur toutes les
    // lectures du tableau (les routes d'écriture ont le même porteur).
    await etape(R, `C3 · ${referentiel} · à travers une clôture`, async () => {
      const C = await nouveauDossier(R, `Paquet 1 C3 · C ${referentiel}`, { referentiel, ...options, cle: `p1c-c3-cloture-${referentiel.toLowerCase()}`, exercice: ['2026-01-01', '2026-12-31'] });
      if (referentiel === 'SYSCOHADA') await C.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
      const capital = referentiel === 'SYSCOHADA' ? '10130000' : '10210000';
      const n = C.exercices.get('2026').id;
      await ecriture(C, 'Apport', n, '2026-01-02', 'Apport initial', [[BQ, 1_000_000, 0], [capital, 0, 1_000_000]]);
      await validerJusqua(C, n, '2026-12-31');
      const clos = await cloturer(C, '2026');
      R.egal(`C3 · ${referentiel} · clôture · 2026 clôturé, 2027 ouvert`, ['CLOTURE', true],
        [C.exercices.get('2026')?.statut ?? null, Boolean(C.exercices.get('2027')?.id)]);
      if (!clos) return;
      const n1 = C.exercices.get('2027').id;
      for (const [annee, id] of [['2026 clôturé', n], ['2027', n1]]) {
        const ditsIntrouvables = [];
        let lues = 0;
        for (const [methode, chemin, ou] of ROUTES_EXERCICE) {
          if (methode !== 'GET' || chemin === '/groupe/cellules/:celluleId/balance') continue;
          const r = await C.req(methode, adresse(chemin, ou, id));
          if (r.statut === 403) continue;
          lues += 1;
          if (r.statut === 404 && /exercice introuvable/i.test(messageDe(r))) ditsIntrouvables.push(chemin);
        }
        R.egal(`C3 · ${referentiel} · exercice ${annee} du dossier · aucune lecture ne le dit introuvable (${lues} routes)`, [], ditsIntrouvables);
      }
      // Son solde de banque se lit des deux côtés de la clôture (1 000 000 à
      // la main · l'apport, reporté à nouveau en 2027).
      const bq = compte(C, BQ);
      for (const [annee, id] of [['2026', n], ['2027', n1]]) {
        const gl = await C.lire(`Grand livre BQ ${annee}`, `/ecritures/grand-livre/${bq}?exerciceId=${id}`);
        R.egal(`C3 · ${referentiel} · grand livre BQ ${annee} · solde 1 000 000`, 1_000_000,
          gl?.soldeFinal === undefined ? null : Math.round(Number(gl.soldeFinal) * 100) / 100);
      }
    });
  }
}

// ==============================================================================
// C4 · L'OBSERVATION « SOCIÉTÉ UNIPERSONNELLE » NE SE SERT QU'À UNE SOCIÉTÉ
// DÉCLARÉE UNIPERSONNELLE
// ==============================================================================
//
// Loi n° 23/053, art. 3 (SA, SARL, SAS imposables à l'IS « même
// unipersonnelles ») et art. 63, al. 2, 1° (l'associé unique d'une SARL,
// l'actionnaire unique d'une SA ou d'une SAS « lorsque cet associé ou cet
// actionnaire est une personne physique » · IRPP). L'observation ne concerne
// donc qu'une société À ASSOCIÉ UNIQUE PERSONNE PHYSIQUE. Le dossier porte
// deux faits · `associeUniqueSas` (AUSCGIE art. 853-2, la SASU, propre à la
// SAS) et `associeUniquePersonneMorale` (art. 201 al. 4 et 5, tous les titres
// détenus par un seul associé personne morale). Aucun fait ne dit qu'une SARL
// ou une SA est unipersonnelle à associé personne physique · depuis le premier
// tour de relecture (constat 2, point S2), l'observation leur est servie SOUS
// CONDITION, dite (« ne vaut que si la société n'a qu'un associé ou
// actionnaire, personne physique »), comme à la SAS dont l'unicité n'est pas
// encore dite ; rien seulement sur un « non » déclaré ou un associé unique
// déclaré personne morale.

const marqueObservation = (rf) => (rf?.observations ?? []).some((o) => o.includes('art. 63, al. 2, 1°'));
const conditionDite = (rf) =>
  (rf?.observations ?? []).some((o) => o.includes('art. 63, al. 2, 1°') && o.includes("ne vaut que s'il est une personne physique"));
const conditionUniciteDite = (rf) =>
  (rf?.observations ?? []).some((o) => o.includes('art. 63, al. 2, 1°') && o.includes("ne vaut que si la société n'a qu'un associé ou actionnaire, personne physique"));

async function pointC4(R) {
  R.scenario = 'paquet1-c · C4';
  await etape(R, 'C4 · observation de la société unipersonnelle, forme par forme', async () => {
    const dossier = async (forme, cle) => {
      const c = await nouveauDossier(R, `Paquet 1 C4 · ${forme}`, { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle, exercice: ['2026-01-01', '2026-12-31'] });
      await c.geste(`Forme ${forme}`, 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: forme });
      const n = c.exercices.get('2026').id;
      return { c, lire: async () => c.lire('Résultat fiscal', `/fiscalite/resultat-fiscal?exerciceId=${n}`) };
    };
    const identite = (d, corps) => d.c.geste(`Identité ${JSON.stringify(corps)}`, 'PATCH', '/dossier/identite', corps);

    const sarl = await dossier('SOCIETE_RESPONSABILITE_LIMITEE', 'p1c-c4-sarl');
    const sarlSansFait = await sarl.lire();
    R.egal('C4 · SARL, aucun fait déclaré · observation servie sous la condition d’unicité, dite (constat 2)', [true, true], [marqueObservation(sarlSansFait), conditionUniciteDite(sarlSansFait)]);
    await identite(sarl, { associeUniquePersonneMorale: 'OUI' });
    R.egal('C4 · SARL à associé unique PERSONNE MORALE (art. 201 al. 4) · observation non servie (art. 63 vise la personne physique)', false, marqueObservation(await sarl.lire()));

    const sa = await dossier('SOCIETE_ANONYME', 'p1c-c4-sa');
    const saSansFait = await sa.lire();
    R.egal('C4 · SA, aucun fait déclaré · observation servie sous la condition d’unicité, dite (constat 2)', [true, true], [marqueObservation(saSansFait), conditionUniciteDite(saSansFait)]);

    const sas = await dossier('SOCIETE_PAR_ACTIONS_SIMPLIFIEE', 'p1c-c4-sas');
    const sasNonDit = await sas.lire();
    R.egal('C4 · SAS, associé unique pas encore dit · observation servie sous la condition d’unicité, dite (constat 2)', [true, true], [marqueObservation(sasNonDit), conditionUniciteDite(sasNonDit)]);
    await identite(sas, { associeUniqueSas: 'NON' });
    R.egal('C4 · SAS déclarée pluripersonnelle · observation non servie', false, marqueObservation(await sas.lire()));
    await identite(sas, { associeUniqueSas: 'OUI' });
    const sasuNatureNonDite = await sas.lire();
    R.egal('C4 · SASU déclarée (art. 853-2), nature de l’associé pas encore dite · observation servie', true, marqueObservation(sasuNatureNonDite));
    R.egal('C4 · SASU, nature de l’associé pas encore dite · la condition « personne physique » est dite', true, conditionDite(sasuNatureNonDite));
    await identite(sas, { associeUniquePersonneMorale: 'NON' });
    const sasuPhysique = await sas.lire();
    R.egal('C4 · SASU, associé unique déclaré non personne morale · observation servie', true, marqueObservation(sasuPhysique));
    R.egal('C4 · SASU à associé personne physique · aucune condition à dire', false, conditionDite(sasuPhysique));
    await identite(sas, { associeUniquePersonneMorale: 'OUI' });
    R.egal('C4 · SASU à associé unique PERSONNE MORALE · observation non servie', false, marqueObservation(await sas.lire()));
  });
}

// ==============================================================================
// C1 · LE PLAFOND DE L'ART. 69, 1 AU CENTIME
// ==============================================================================
//
// Loi n° 23/053, art. 69, 1 · les allocations familiales « réellement
// accordées aux employés dans la mesure où elles ne dépassent pas les taux
// légaux » (PLAFOND · seul l'excédent est repris). Taux légal · colonne 19
// de l'annexe du décret n° 25/22 applicable en 2026, 796,30 FC par jour et par
// enfant, × 26 (art. 7) × 3 enfants = 62 111,40 FC. Le flottant le calculait
// 62 111,399999999994 · une allocation de 62 111,40 FC, EXACTEMENT le taux
// légal, laissait « seul l'excédent de 0.00 FC est imposable » et un
// imposable de 7,3e-12 FC. Attendu · entièrement immunisée, imposable 0, base
// fiscale brute 1 000 000 (le salaire seul).
//
// Une allocation de 62 111,45 FC · excédent 0,05 FC, imposable 0,05, base
// 1 000 000,05. Deux lignes de 20 000,10 et 42 111,30 (62 111,40 en tout) ·
// toutes deux immunisées (le taux légal se consomme ligne à ligne, au centime).

async function pointC1(R) {
  R.scenario = 'paquet1-c · C1';
  await etape(R, 'C1 · plafond des allocations familiales au centime', async () => {
    const c = await nouveauDossier(R, 'Paquet 1 C1 · Lualaba Services SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1c-c1', exercice: ['2026-01-01', '2026-12-31'] });
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    const base = { moisDePaie: '2026-03', natureEmployeurInpp: 'PRIVE', effectif: 7, regimeSalarial: 'BAREME_ARTICLE_118', enfantsBeneficiairesAllocations: 3 };
    const salaire = { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 1_000_000 };
    const alloc = (montantFc, libelle = 'Allocations familiales') => ({ nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle, montantFc });
    const sortsDes = (s) => (s?.assiettes?.sortsFiscaux ?? []).filter((x) => /Allocations/.test(x.libelle));

    const exact = await c.geste('Simulation · allocation égale au taux légal', 'POST', '/personnel/simulation', { ...base, elements: [salaire, alloc(62_111.40)] });
    const [e1] = sortsDes(exact);
    R.egal('C1 · allocation de 62 111,40 = taux légal · imposable exactement 0', 0, e1?.imposableFc ?? null);
    R.egal('C1 · allocation de 62 111,40 · le motif dit l’allocation entièrement immunisée', true, /entièrement immunisée/.test(e1?.motif ?? ''));
    R.egal('C1 · allocation de 62 111,40 · le motif ne parle d’aucun excédent', false, /excédent de/.test(e1?.motif ?? ''));
    R.egal('C1 · allocation de 62 111,40 · base fiscale brute = 1 000 000 exactement', 1_000_000, exact?.assiettes?.assietteFiscaleBruteFc ?? null);

    const plus = await c.geste('Simulation · allocation au-delà du taux légal', 'POST', '/personnel/simulation', { ...base, elements: [salaire, alloc(62_111.45)] });
    const [p1] = sortsDes(plus);
    R.egal('C1 · allocation de 62 111,45 · imposable 0,05 au centime', 0.05, p1?.imposableFc ?? null);
    R.egal('C1 · allocation de 62 111,45 · le motif dit l’excédent de 0.05 FC', true, (p1?.motif ?? '').includes("Seul l'excédent de 0.05 FC est imposable."));
    R.egal('C1 · allocation de 62 111,45 · base fiscale brute = 1 000 000,05', 1_000_000.05, plus?.assiettes?.assietteFiscaleBruteFc ?? null);

    const deux = await c.geste('Simulation · deux lignes d’allocations', 'POST', '/personnel/simulation', { ...base, elements: [salaire, alloc(20_000.10, 'Allocations (1)'), alloc(42_111.30, 'Allocations (2)')] });
    const lignes = sortsDes(deux);
    R.egal('C1 · deux lignes (20 000,10 + 42 111,30) · imposables [0, 0]', [0, 0], lignes.map((x) => x.imposableFc));
    R.egal('C1 · deux lignes · aucun motif « excédent de 0.00 FC »', false, lignes.some((x) => (x.motif ?? '').includes('excédent de 0.00')));
    R.egal('C1 · deux lignes · base fiscale brute = 1 000 000 exactement', 1_000_000, deux?.assiettes?.assietteFiscaleBruteFc ?? null);
  });
}

// ==============================================================================
// C2 · L'ABSTENTION DES ALLOCATIONS DIT CE QUI MANQUE, EN FRANÇAIS
// ==============================================================================
//
// L'explication de l'abstention (taux légal de l'art. 69, 1 non chiffrable)
// renvoyait l'utilisateur à « RESOLUTION_TAUX_LEGAL_ALLOCATIONS », un nom de
// constante du code. Attendu · aucun nom interne, la phrase dit ce qui manque
// (le nombre d'enfants bénéficiaires, ou un mois qu'aucun barème du SMIG ne
// couvre) et quoi faire (le renseigner, ou saisir le taux légal du mois).

const NOM_INTERNE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;

async function pointC2(R) {
  R.scenario = 'paquet1-c · C2';
  await etape(R, 'C2 · abstention des allocations familiales', async () => {
    const c = await nouveauDossier(R, 'Paquet 1 C2 · Kwilu Agro SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1c-c2', exercice: ['2026-01-01', '2026-12-31'] });
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    const elements = [
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 1_000_000 },
      { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations familiales', montantFc: 50_000 },
    ];
    const base = { natureEmployeurInpp: 'PRIVE', effectif: 7, regimeSalarial: 'BAREME_ARTICLE_118', elements };

    const sansEnfants = await c.geste('Simulation · enfants bénéficiaires non renseignés', 'POST', '/personnel/simulation', { ...base, moisDePaie: '2026-03' });
    const a1 = (sansEnfants?.assiettes?.abstentions ?? []).find((a) => /Allocations/.test(a.libelle));
    R.egal('C2 · enfants non renseignés · une abstention sur les allocations', true, Boolean(a1));
    R.egal('C2 · enfants non renseignés · aucun nom interne du code dans l’explication', null, (a1?.explication ?? '').match(NOM_INTERNE)?.[0] ?? null);
    R.egal('C2 · enfants non renseignés · l’explication dit ce qui manque (le nombre d’enfants bénéficiaires)', true, /nombre d.enfants bénéficiaires/i.test(a1?.explication ?? ''));
    R.egal('C2 · enfants non renseignés · l’explication dit quoi faire (renseignez)', true, /renseignez/i.test(a1?.explication ?? ''));

    const moisSansBareme = await c.geste('Simulation · mois qu’aucun barème ne couvre', 'POST', '/personnel/simulation', { ...base, moisDePaie: '2019-03', enfantsBeneficiairesAllocations: 2 });
    const a2 = (moisSansBareme?.assiettes?.abstentions ?? []).find((a) => /Allocations/.test(a.libelle));
    R.egal('C2 · mois 2019-03 · une abstention sur les allocations', true, Boolean(a2));
    R.egal('C2 · mois 2019-03 · aucun nom interne du code dans l’explication', null, (a2?.explication ?? '').match(NOM_INTERNE)?.[0] ?? null);
    R.egal('C2 · mois 2019-03 · l’explication dit quoi faire (saisissez le taux légal du mois)', true, /saisissez le taux légal/i.test(a2?.explication ?? ''));
    R.egal('C2 · mois 2019-03 · l’explication ne demande pas les enfants, déjà renseignés', false, /renseignez le nombre d.enfants/i.test(a2?.explication ?? ''));
  });
}

// ==============================================================================
// S1 · PREMIER TOUR DE RELECTURE, CONSTAT 1 · LES SEUILS DE LA PAIE AU CENTIME
// ==============================================================================
//
// Jumeau de C1. Loi n° 23/053, art. 69, 8, a) · le logement est immunisé
// « pour autant que l'indemnité de logement ne dépasse 30 % de la
// rémunération » · à 30 % EXACTEMENT, la condition est remplie. Salaire de
// 131 072,30 FC, logement de 39 321,69 FC (30 % exactement) · le flottant
// calculait le plafond à 39 321,689999999995 et imposait le logement ENTIER.
// Au-dessus · salaire de 131 072,33 FC (30 % = 39 321,699 FC), logement de
// 39 321,70 FC · condition non remplie, et le motif ne doit pas afficher un
// plafond arrondi égal au total (« 39321.70 » contre « 39321.70 »).
//
// Deux autres seuils du même défaut. (a) Le plancher de la CNSS (décret
// n° 18/041, art. 8 ; loi n° 16/009, art. 13, « en aucun cas ») · cinq lignes
// dont la somme vaut EXACTEMENT 21 500 × 26 = 559 000 FC s'additionnaient à
// 558 999,9999999999 · « ASSIETTE SOUS LE PLANCHER », CNSS, impôt et net non
// chiffrés. (b) Le minimum de la classe (décret n° 25/22 ; Code du travail,
// art. 37) · grille du cabinet au SMIG de 21 500,01 FC, classe 12 (tension
// 488) · 104 920,05 × 26 = 2 727 921,30 FC, que le flottant rendait
// 2 727 921,3000000003 · un contrat EXACTEMENT au minimum était dit non
// conforme. Un centime de moins, il ne l'est pas.

async function pointS1(R) {
  R.scenario = 'paquet1-c · S1';
  await etape(R, 'S1 · seuils de la paie comparés au centime', async () => {
    const c = await nouveauDossier(R, 'Paquet 1 S1 · Tshopo Bois SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1c-s1', exercice: ['2026-01-01', '2026-12-31'] });
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    const base = { moisDePaie: '2026-03', natureEmployeurInpp: 'PRIVE', effectif: 7, regimeSalarial: 'BAREME_ARTICLE_118' };
    const salaire = (montantFc, libelle = 'Salaire de base') => ({ nature: 'SALAIRE_OU_TRAITEMENT', libelle, montantFc });
    const logement = (montantFc) => ({ nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Indemnité de logement', montantFc });
    const sortLogement = (s) => (s?.assiettes?.sortsFiscaux ?? []).find((x) => /logement/i.test(x.libelle)) ?? null;

    const exact = await c.geste('Simulation · logement à 30 % exactement', 'POST', '/personnel/simulation', { ...base, elements: [salaire(131_072.30), logement(39_321.69)] });
    R.egal('S1 · logement de 39 321,69 sur 131 072,30 (30 % exactement) · imposable 0', 0, sortLogement(exact)?.imposableFc ?? null);
    R.egal('S1 · logement à 30 % exactement · base fiscale brute = le salaire seul, 131 072,30', 131_072.3, exact?.assiettes?.assietteFiscaleBruteFc ?? null);
    R.egal('S1 · logement à 30 % exactement · le motif dit la condition remplie', true, /condition est remplie/.test(sortLogement(exact)?.motif ?? ''));

    const dessus = await c.geste('Simulation · logement au-dessus de 30 %', 'POST', '/personnel/simulation', { ...base, elements: [salaire(131_072.33), logement(39_321.70)] });
    R.egal('S1 · logement de 39 321,70 sur 131 072,33 (30 % = 39 321,699) · imposable en entier', 39_321.7, sortLogement(dessus)?.imposableFc ?? null);
    R.egal('S1 · logement au-dessus · le motif dit le plafond exact, 39321.699, jamais arrondi au total', true, (sortLogement(dessus)?.motif ?? '').includes('39321.699'));

    const parts = [157_287.52, 117_823.56, 116_773.59, 45_556.48, 121_558.85];
    const cinq = await c.geste('Simulation · cinq lignes égales au SMIG du mois', 'POST', '/personnel/simulation', { ...base, elements: parts.map((m, i) => salaire(m, `Élément ${i + 1}`)) });
    const pl = cinq?.cotisations?.plancherCnss ?? null;
    // `??` lirait le `null` attendu comme une absence · on lit la clé.
    const lu = (o, cle) => (o && cle in o ? o[cle] : 'absent');
    R.egal('S1 · cinq lignes = 559 000 · plancher de la CNSS non appliqué et sans message', [false, null], [lu(pl, 'applique'), lu(pl, 'message')]);
    R.egal('S1 · cinq lignes = 559 000 · base de la CNSS chiffrée', true, typeof pl?.baseFc === 'number');
    R.egal('S1 · cinq lignes = 559 000 · quote-part ouvrière chiffrée', null, lu(cinq?.cotisations, 'quotePartOuvriereNonChiffree'));

    const v = await c.geste('Version SMIG du cabinet au 01/01/2027 (21 500,01)', 'POST', '/personnel/baremes', {
      bareme: 'SMIG', aPartirDu: '2027-01-01', reference: 'Arrêté ministériel fictif du banc portant ajustement du SMIG (décret n° 25/21, art. 10 et 11)', valeurs: { smigJournalierFc: 21_500.01 },
    });
    R.egal('S1 · version SMIG du cabinet enregistrée', true, Boolean(v?.version?.id));
    const contrats = [['MBOMBO', 2_727_921.30], ['LIKOFO', 2_727_921.29]];
    for (const [nom, remunerationBase] of contrats) {
      const s = await c.geste(`Salarié ${nom}`, 'POST', '/personnel/salaries', { nom, sexe: 'MASCULIN', nationalite: 'congolaise', lieuNaissance: 'Kisangani' });
      if (!s) continue;
      await c.geste(`Contrat ${nom}`, 'POST', `/personnel/salaries/${s.id}/contrats`, {
        type: 'DUREE_INDETERMINEE', lieuExecution: 'Kisangani', dateEntreeEnVigueur: '2026-01-01', natureTravail: 'Agent de maîtrise',
        classeProfessionnelle: 12, periodiciteRemuneration: 'MOIS', remunerationBase, deviseRemuneration: 'CDF',
      });
    }
    const conf = await c.lire('Confrontation du registre', '/personnel/confrontation');
    const fiche = (nom) => (conf?.fiches ?? []).find((f) => f.salarie === nom)?.remunerationMinimale ?? null;
    R.egal('S1 · MBOMBO, 2 727 921,30 au minimum exact de la classe 12 · [conforme, manque]', [true, null], [fiche('MBOMBO')?.conforme ?? 'absent', fiche('MBOMBO')?.manqueFc ?? null]);
    R.egal('S1 · LIKOFO, un centime sous le minimum · [conforme, manque]', [false, 0.01], [fiche('LIKOFO')?.conforme ?? 'absent', fiche('LIKOFO')?.manqueFc ?? null]);
  });
}

// ==============================================================================
// S2 · PREMIER TOUR DE RELECTURE, CONSTAT 2 · L'UNICITÉ NON DÉCLARÉE N'EST PAS UN « NON »
// ==============================================================================
//
// Loi n° 23/053, art. 63, al. 2, 1° · « l'associé unique d'une société à
// responsabilité limitée ou […] l'actionnaire unique d'une société anonyme ou
// d'une société par action simplifiée, lorsque cet associé ou cet actionnaire
// est une personne physique ». AUSCGIE art. 309, al. 2 (SARL instituée « par
// une personne physique ou morale ») et art. 385, al. 2 (SA « ne comprendre
// qu'un seul actionnaire »). Le dossier ne déclare l'unicité que de la SAS ·
// pour une SARL ou une SA, et pour une SAS dont l'unicité n'est pas encore
// dite, C4 lisait le silence comme un « non » et ne servait RIEN · la SARL à
// associé unique personne physique, que l'article nomme le premier, perdait
// l'observation sans un mot. Attendu · l'observation, avec sa condition
// (« ne vaut que si la société n'a qu'un associé ou actionnaire, personne
// physique ») ; rien seulement sur l'unicité déclarée « non » (SAS) ou sur un
// associé unique déclaré personne morale. Aucun fait créé.

async function pointS2(R) {
  R.scenario = 'paquet1-c · S2';
  await etape(R, 'S2 · unicité non déclarée ou non déclarable', async () => {
    const dossier = async (forme, cle) => {
      const c = await nouveauDossier(R, `Paquet 1 S2 · ${forme}`, { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle, exercice: ['2026-01-01', '2026-12-31'] });
      await c.geste(`Forme ${forme}`, 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: forme });
      const n = c.exercices.get('2026').id;
      return { c, lire: async () => c.lire('Résultat fiscal', `/fiscalite/resultat-fiscal?exerciceId=${n}`) };
    };
    const identite = (d, corps) => d.c.geste(`Identité ${JSON.stringify(corps)}`, 'PATCH', '/dossier/identite', corps);
    const verdict = (rf) => [marqueObservation(rf), conditionUniciteDite(rf)];

    const sarl = await dossier('SOCIETE_RESPONSABILITE_LIMITEE', 'p1c-s2-sarl');
    R.egal('S2 · SARL, unicité non déclarable · [observation, condition d’unicité dite]', [true, true], verdict(await sarl.lire()));
    await identite(sarl, { associeUniquePersonneMorale: 'NON' });
    R.egal('S2 · SARL, associé unique personne morale « non » · [observation, condition d’unicité dite]', [true, true], verdict(await sarl.lire()));
    await identite(sarl, { associeUniquePersonneMorale: 'OUI' });
    R.egal('S2 · SARL, associé unique déclaré personne morale · rien', [false, false], verdict(await sarl.lire()));

    const sa = await dossier('SOCIETE_ANONYME', 'p1c-s2-sa');
    R.egal('S2 · SA, unicité non déclarable · [observation, condition d’unicité dite]', [true, true], verdict(await sa.lire()));
    await identite(sa, { associeUniquePersonneMorale: 'OUI' });
    R.egal('S2 · SA, actionnaire unique déclaré personne morale · rien', [false, false], verdict(await sa.lire()));

    const sas = await dossier('SOCIETE_PAR_ACTIONS_SIMPLIFIEE', 'p1c-s2-sas');
    R.egal('S2 · SAS, unicité pas encore dite · [observation, condition d’unicité dite]', [true, true], verdict(await sas.lire()));
    await identite(sas, { associeUniqueSas: 'NON' });
    R.egal('S2 · SAS, unicité déclarée « non » · rien', [false, false], verdict(await sas.lire()));
    await identite(sas, { associeUniqueSas: 'OUI', associeUniquePersonneMorale: 'NON' });
    R.egal('S2 · SASU, associé personne physique · [observation, aucune condition]', [true, false], verdict(await sas.lire()));
  });
}

// ==============================================================================
// S3 · PREMIER TOUR DE RELECTURE, CONSTAT 3 · UN MONTANT DE PAIE EST AU CENTIME
// ==============================================================================
//
// Le montant d'un élément de paie (`ElementPaieDto.montantFc`) n'avait aucune
// borne de décimales, quand les autres montants de la paie en ont deux (base
// gardée en Decimal 18,2). Une allocation de 50 000,005 FC sous un taux légal
// de 62 111,40 FC (3 enfants, 2026-03) rendait, depuis l'arrondi de C1, une
// part immunisée de 50 000,01 et une part IMPOSABLE de −0,01 FC. Attendu ·
// refus nommé (400) d'un montant au-delà du centime ; au centime, part
// imposable jamais négative.

async function pointS3(R) {
  R.scenario = 'paquet1-c · S3';
  await etape(R, 'S3 · montant d’un élément de paie au centime', async () => {
    const c = await nouveauDossier(R, 'Paquet 1 S3 · Sankuru Pêche SARL', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1c-s3', exercice: ['2026-01-01', '2026-12-31'] });
    await c.geste('Forme SARL', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
    await c.geste('Activation du module de paie', 'PATCH', '/dossier/modules', { modulesActives: ['PAIE'] });
    const base = { moisDePaie: '2026-03', natureEmployeurInpp: 'PRIVE', effectif: 7, regimeSalarial: 'BAREME_ARTICLE_118', enfantsBeneficiairesAllocations: 3 };
    const elements = (alloc) => [
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: 1_000_000 },
      { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations familiales', montantFc: alloc },
    ];
    const millieme = await c.req('POST', '/personnel/simulation', { ...base, elements: elements(50_000.005) });
    const sort = (millieme.corps?.assiettes?.sortsFiscaux ?? []).find((x) => /Allocations/.test(x.libelle));
    R.egal('S3 · allocation de 50 000,005 FC · refusée (400), jamais une part imposable', [400, null], [millieme.statut, sort?.imposableFc ?? null]);
    R.egal('S3 · le refus dit le centime, en français', true, JSON.stringify(millieme.corps ?? '').includes('au centime (deux décimales au plus)'));
    const centime = await c.geste('Simulation · allocation au centime', 'POST', '/personnel/simulation', { ...base, elements: elements(50_000.01) });
    const s2 = (centime?.assiettes?.sortsFiscaux ?? []).find((x) => /Allocations/.test(x.libelle));
    R.egal('S3 · allocation de 50 000,01 FC · admise, imposable 0', 0, s2?.imposableFc ?? null);
  });
}

// ==============================================================================
// S4 · PREMIER TOUR DE RELECTURE, CONSTAT 4 · LE COMPTE EN FILTRE D'UN AUTRE DOSSIER
// ==============================================================================
//
// Même règle que l'exercice et le journal (C3) · un `compteId` de filtre que
// le dossier ne porte pas est INTROUVABLE (404), jamais une liste vide en 200
// lue comme « aucun rapprochement » ou « aucune relance sur ce compte ».
// Illisible, il est refusé (400). Routes · `GET /rapprochements?compteId=` et
// `GET /relances/historique?compteId=`.

async function pointS4(R) {
  R.scenario = 'paquet1-c · S4';
  await etape(R, 'S4 · le compte en filtre, du dossier ou introuvable', async () => {
    const { A, B } = await paireDeDossiers(R, 'SYSCOHADA', { systeme: 'NORMAL' }, 'p1c-s4');
    const bqA = compte(A, BQ);
    const bqB = compte(B, BQ);
    await A.geste('Rapprochement de A sur sa banque', 'POST', '/rapprochements', { compteId: bqA, dateReleve: '2026-01-31', soldeReleve: 1_000_000 });
    for (const chemin of ['/rapprochements', '/relances/historique']) {
      const croise = await A.req('GET', `${chemin}?compteId=${bqB}`);
      R.egal(`S4 · GET ${chemin} · le compte de B est introuvable (404)`, 'refus 404 introuvable',
        croise.statut === 404 && /introuvable/i.test(messageDe(croise)) ? 'refus 404 introuvable' : `statut ${croise.statut} · ${JSON.stringify(croise.corps).slice(0, 90)}`);
      const illisible = await A.req('GET', `${chemin}?compteId=abc`);
      R.egal(`S4 · GET ${chemin} · un compte illisible est refusé (400)`, 400, illisible.statut);
      const temoin = await A.req('GET', `${chemin}?compteId=${bqA}`);
      R.egal(`S4 · GET ${chemin} · témoin · son propre compte se lit (200)`, 200, temoin.statut);
      const sansFiltre = await A.req('GET', chemin);
      R.egal(`S4 · GET ${chemin} · témoin · sans filtre, la liste se lit (200)`, 200, sansFiltre.statut);
    }
    const rapprochementsA = await A.lire('Rapprochements de A sur sa banque', `/rapprochements?compteId=${bqA}`);
    R.egal('S4 · le filtre du dossier rend le rapprochement de A', 1, Array.isArray(rapprochementsA) ? rapprochementsA.length : null);
  });
}

// ==============================================================================
// S5 · PREMIER TOUR DE RELECTURE, CONSTAT 5 · L'EXERCICE PORTÉ PAR UN DTO DE REQUÊTE
// ==============================================================================
//
// `GET /registre-donateurs` lit un `@Query()` entier (`FiltreRegistreDto`),
// dont l'`exerciceId` échappait au recensement d'`exercice-requis.spec.ts`.
// La ROUTE est déjà juste (le service rend 404, `@IsUUID` 400) · ce point le
// prouve sur vraie base, des deux côtés ; le défaut corrigé est l'aveuglement
// du garde-fou, qui ne l'aurait pas vu régresser.

async function pointS5(R) {
  R.scenario = 'paquet1-c · S5';
  await etape(R, 'S5 · registre des donateurs filtré par un exercice', async () => {
    const { A, nA, nB } = await paireDeDossiers(R, 'SYCEBNL', { jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }, 'p1c-s5');
    const croise = await A.req('GET', `/registre-donateurs?exerciceId=${nB}`);
    R.egal('S5 · GET /registre-donateurs · l’exercice de B est introuvable (404)', 'refus 404 introuvable',
      croise.statut === 404 && /introuvable/i.test(messageDe(croise)) ? 'refus 404 introuvable' : `statut ${croise.statut} · ${JSON.stringify(croise.corps).slice(0, 90)}`);
    const illisible = await A.req('GET', '/registre-donateurs?exerciceId=abc');
    R.egal('S5 · GET /registre-donateurs · un exercice illisible est refusé (400)', 400, illisible.statut);
    const temoin = await A.req('GET', `/registre-donateurs?exerciceId=${nA}`);
    R.egal('S5 · GET /registre-donateurs · témoin · son propre exercice se lit (200)', 200, temoin.statut);
  });
}

// ==============================================================================
// S6 · PREMIER TOUR DE RELECTURE, CONSTAT 6 · L'EXERCICE D'UN CORPS, ET LE RELEVÉ R1
// ==============================================================================
//
// (a) Un `exerciceId` de CORPS d'un autre dossier (`POST /ecritures`,
// `POST /ecritures/imputation-ouverture`) est REFUSÉ et RIEN n'est écrit,
// dans aucun des deux dossiers · lu en base, pas sur la balance de A, qui ne
// verrait pas une écriture de A rattachée à l'exercice de B. Le statut (400
// « Exercice introuvable pour ce tenant ») est noté, non jugé · relevé R2.
//
// (b) Relevé R1 · sur `main`, `POST /provisions/:exerciceId` avec l'exercice
// de B créait une provision dans A rattachée à l'exercice de B. La clé
// étrangère (RESTRICT) enferme alors B · l'arrêt à la dissolution sans
// liquidation (AUSCGIE art. 201 al. 4) retire l'exercice postérieur vide
// (`exercice.service.ts`, `tx.exercice.delete`), et la provision du voisin le
// retient. La purge PRÉPARÉE dans la fiche (`PURGE_R1`, la même requête) est
// jouée ici sur la base JETABLE du banc, jamais ailleurs · elle doit rendre la
// main à B.

/** La base JETABLE du banc · la chaîne n'est jamais affichée, une erreur ne rend que le code de psql. */
function psql(sql) {
  const url = process.env.PASSE_DATABASE_URL;
  if (!url) throw new Error('PASSE_DATABASE_URL absente · la lecture en base ne peut pas se faire');
  try {
    return execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qtAc', sql], { encoding: 'utf8' }).trim();
  } catch (e) {
    throw new Error(`psql a échoué (code ${e.status ?? '?'})`);
  }
}

const CROISEES_R1 =
  'SELECT count(*) FROM provisions_risques_charges p JOIN exercices e ON e.id = p."exerciceId" WHERE e."tenantId" <> p."tenantId"';
/** La purge de la fiche (relevé R1), en une transaction · elle rend le nombre restant. */
const PURGE_R1 =
  'BEGIN; DELETE FROM provisions_risques_charges p USING exercices e WHERE e.id = p."exerciceId" AND e."tenantId" <> p."tenantId"; COMMIT; ' +
  CROISEES_R1;

async function pointS6(R) {
  R.scenario = 'paquet1-c · S6';
  await etape(R, 'S6 · (a) un exercice de corps d’un autre dossier, refusé sans rien écrire', async () => {
    const { A, B, nA, nB } = await paireDeDossiers(R, 'SYSCOHADA', { systeme: 'NORMAL' }, 'p1c-s6a');
    const compter = () => ({
      deA: Number(psql(`SELECT count(*) FROM ecritures WHERE "tenantId" = '${A.tenantId}'`)),
      surB: Number(psql(`SELECT count(*) FROM ecritures WHERE "exerciceId" = '${nB}'`)),
    });
    const avant = compter();
    const capital = '10130000';
    const corpsEcriture = (exerciceId) => ({
      exerciceId,
      journalId: A.od.id,
      date: '2026-03-03',
      libelle: 'Écriture sur l’exercice d’un autre dossier',
      lignes: [
        { compteId: compte(A, BQ), libelle: 'S6', debit: 10_000, credit: 0 },
        { compteId: compte(A, capital), libelle: 'S6', debit: 0, credit: 10_000 },
      ],
    });
    const croise = await A.req('POST', '/ecritures', corpsEcriture(nB));
    R.egal('S6 · POST /ecritures · l’exercice de B en corps est refusé (introuvable)', 'refus introuvable',
      croise.statut >= 400 && croise.statut < 500 && /introuvable/i.test(messageDe(croise)) ? 'refus introuvable' : `statut ${croise.statut} · ${JSON.stringify(croise.corps).slice(0, 90)}`);
    R.note(`S6 · POST /ecritures · statut du refus · ${croise.statut} · ${messageDe(croise)}`);
    const imputation = await A.req('POST', '/ecritures/imputation-ouverture', {
      exerciceId: nB,
      journalId: A.od.id,
      motif: 'CORRECTION_ERREUR_SIGNIFICATIVE',
      justification: 'Banc paquet 1 · S6',
      compteReportANouveauId: compte(A, '12100000'),
      compteContrepartieId: compte(A, BQ),
      montant: -10_000,
    });
    R.egal('S6 · POST /ecritures/imputation-ouverture · l’exercice de B en corps est refusé (introuvable)', 'refus introuvable',
      imputation.statut >= 400 && imputation.statut < 500 && /introuvable/i.test(messageDe(imputation)) ? 'refus introuvable' : `statut ${imputation.statut} · ${JSON.stringify(imputation.corps).slice(0, 90)}`);
    R.note(`S6 · POST /ecritures/imputation-ouverture · statut du refus · ${imputation.statut} · ${messageDe(imputation)}`);
    const apres = compter();
    R.egal('S6 · rien n’est écrit dans A (écritures du dossier en base)', avant.deA, apres.deA);
    R.egal('S6 · rien n’est rattaché à l’exercice de B (écritures en base)', avant.surB, apres.surB);
    const temoin = await A.req('POST', '/ecritures', corpsEcriture(nA));
    R.egal('S6 · témoin · la même écriture sur l’exercice de A passe (201)', 201, temoin.statut);
  });

  await etape(R, 'S6 · (b) relevé R1 · la provision croisée enferme le voisin, la purge le libère', async () => {
    const { A, B, nB } = await paireDeDossiers(R, 'SYSCOHADA', { systeme: 'NORMAL' }, 'p1c-s6b');
    await B.geste('Exercice 2027 de B (vide)', 'POST', '/exercices', { dateDebut: '2027-01-01', dateFin: '2027-12-31' });
    const exercicesB = (await B.lire('Exercices de B', '/exercices')) ?? [];
    const nB2027 = exercicesB.find((e) => e.dateDebut.startsWith('2027'))?.id;
    if (!nB2027) throw new Error('exercice 2027 de B non créé');
    const provision = await A.req('POST', `/provisions/${nB2027}`, CORPS['POST /provisions/:exerciceId']);
    R.egal('S6 · R1 · une provision sur l’exercice de B est refusée (404)', 404, provision.statut);
    const croisees = Number(psql(CROISEES_R1));
    R.egal('S6 · R1 · aucune provision rattachée à l’exercice d’un autre dossier', 0, croisees);
    // B · associé unique personne morale, dissolution au 30/09/2026 · l'arrêt
    // retire l'exercice 2027 vide (AUSCGIE art. 201 al. 4).
    await validerJusqua(B, nB, '2026-09-30');
    await B.geste('Faits · associé unique personne morale, dissolution au 30/09/2026', 'PATCH', '/dossier/identite', {
      dateDissolution: '2026-09-30', associeUniquePersonneMorale: 'OUI',
    });
    const arret = await B.req('POST', `/exercices/${nB}/arreter-a-la-dissolution`, {});
    R.egal('S6 · R1 · l’arrêt à la dissolution de B passe (exercice 2027 vide retiré)', 'arrêt passé',
      arret.statut < 300 ? 'arrêt passé' : `statut ${arret.statut} · ${JSON.stringify(arret.corps).slice(0, 120)}`);
    // La purge préparée (fiche, relevé R1), jouée ici sur la base jetable.
    const restantes = Number(psql(PURGE_R1));
    R.egal('S6 · R1 · après la purge préparée, aucune provision croisée', 0, restantes);
    if (arret.statut >= 300) {
      const second = await B.req('POST', `/exercices/${nB}/arreter-a-la-dissolution`, {});
      R.egal('S6 · R1 · après la purge, l’arrêt de B passe', 'arrêt passé',
        second.statut < 300 ? 'arrêt passé' : `statut ${second.statut} · ${JSON.stringify(second.corps).slice(0, 120)}`);
    } else {
      R.egal('S6 · R1 · après la purge, l’arrêt de B passe', 'arrêt passé', 'arrêt passé');
    }
    const finaux = (await B.lire('Exercices de B après l’arrêt', '/exercices')) ?? [];
    R.egal('S6 · R1 · B · l’exercice 2026 finit le 30/09/2026, 2027 est retiré',
      ['2026-09-30'], finaux.map((e) => String(e.dateFin).slice(0, 10)).sort());
  });
}

// ==============================================================================
// S7 · PREMIER TOUR DE RELECTURE, CONSTAT 7 · LE CHAMP NOMMÉ OÙ IL EST, RÉPONDU HORS DISSOLUTION
// ==============================================================================
//
// Une SASU déclarée dont la nature de l'associé n'est pas dite reçoit
// l'observation de l'art. 63, al. 2, 1° sous condition. Le complément disait
// de répondre dans « identité du dossier » · le champ vit dans Paramètres du
// dossier, section Immatriculation, « Associé unique personne morale » (le
// libellé de l'écran, relu par le spec client du constat), et la réponse vaut
// HORS DE TOUTE DISSOLUTION. Le dossier ne déclare aucune dissolution · la
// réponse « non » est reçue, la dissolution reste vide, et la condition tombe.

async function pointS7(R) {
  R.scenario = 'paquet1-c · S7';
  await etape(R, 'S7 · SASU sans dissolution · le champ nommé, la réponse reçue', async () => {
    const c = await nouveauDossier(R, 'Paquet 1 S7 · SASU', { referentiel: 'SYSCOHADA', systeme: 'NORMAL', cle: 'p1c-s7', exercice: ['2026-01-01', '2026-12-31'] });
    await c.geste('Forme SAS', 'PATCH', '/dossier/forme-syscohada', { formeJuridiqueSyscohada: 'SOCIETE_PAR_ACTIONS_SIMPLIFIEE' });
    const n = c.exercices.get('2026').id;
    const lire = () => c.lire('Résultat fiscal', `/fiscalite/resultat-fiscal?exerciceId=${n}`);
    await c.geste('SASU déclarée', 'PATCH', '/dossier/identite', { associeUniqueSas: 'OUI' });
    const avant = await lire();
    const complement = (avant?.observations ?? []).find((o) => o.includes('art. 63, al. 2, 1°') && o.includes("ne vaut que s'il est une personne physique")) ?? '';
    R.egal('S7 · le complément nomme le champ où il est (Paramètres du dossier, section Immatriculation, « Associé unique personne morale »)', true,
      complement.includes('Paramètres du dossier, section Immatriculation, « Associé unique personne morale »'));
    R.egal('S7 · le complément dit que la réponse vaut hors de toute dissolution', true, complement.includes('hors de toute dissolution'));
    const reponse = await c.req('PATCH', '/dossier/identite', { associeUniquePersonneMorale: 'NON' });
    R.egal('S7 · « non » est reçu sans aucune dissolution déclarée', true, reponse.statut < 300);
    const params = await c.lire('Paramètres du dossier', '/dossier/parametres');
    R.egal('S7 · la dissolution reste vide', null, params ? (params.dateDissolution ?? null) : 'paramètres non lus');
    const apres = await lire();
    R.egal('S7 · associé unique personne physique · [observation, aucune condition]', [true, false],
      [marqueObservation(apres), conditionDite(apres)]);
  });
}

export default async function scenarioPaquet1C(registre) {
  const table = { C3: pointC3, C4: pointC4, C1: pointC1, C2: pointC2, S1: pointS1, S2: pointS2, S3: pointS3, S4: pointS4, S5: pointS5, S6: pointS6, S7: pointS7 };
  for (const p of POINTS) {
    const fn = table[p];
    if (!fn) continue;
    console.log(`\n--- ${p} ---`);
    try {
      await fn(registre);
    } catch (e) {
      registre.scenario = `paquet1-c · ${p}`;
      registre.note(`${p} interrompu · ${e.stack ?? e.message}`);
    }
  }
}
