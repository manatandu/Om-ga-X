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
import { randomUUID } from 'node:crypto';
import { cloturer, compte, ecriture, etape, nouveauDossier, validerJusqua } from './lib.mjs';

const BQ = '52110000';
const POINTS = (process.env.PAQUET1_C_POINTS ?? 'C3,C4,C1,C2').split(',').map((s) => s.trim()).filter(Boolean);

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
// ou une SA est unipersonnelle à associé personne physique · l'observation ne
// leur est pas servie (« pas encore dit » n'est pas « oui »).

const marqueObservation = (rf) => (rf?.observations ?? []).some((o) => o.includes('art. 63, al. 2, 1°'));
const conditionDite = (rf) =>
  (rf?.observations ?? []).some((o) => o.includes('art. 63, al. 2, 1°') && o.includes("nature de l'associé unique n'est pas déclarée"));

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
    R.egal('C4 · SARL, aucun fait déclaré · observation non servie', false, marqueObservation(await sarl.lire()));
    await identite(sarl, { associeUniquePersonneMorale: 'OUI' });
    R.egal('C4 · SARL à associé unique PERSONNE MORALE (art. 201 al. 4) · observation non servie (art. 63 vise la personne physique)', false, marqueObservation(await sarl.lire()));

    const sa = await dossier('SOCIETE_ANONYME', 'p1c-c4-sa');
    R.egal('C4 · SA, aucun fait déclaré · observation non servie', false, marqueObservation(await sa.lire()));

    const sas = await dossier('SOCIETE_PAR_ACTIONS_SIMPLIFIEE', 'p1c-c4-sas');
    R.egal('C4 · SAS, associé unique pas encore dit · observation non servie', false, marqueObservation(await sas.lire()));
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

export default async function scenarioPaquet1C(registre) {
  const table = { C3: pointC3, C4: pointC4, C1: pointC1, C2: pointC2 };
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
