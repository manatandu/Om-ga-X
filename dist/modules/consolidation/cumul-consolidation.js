"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefusConsolidation = exports.POSTES_DE_RESULTAT = exports.LIBELLE_POSTE = exports.FAMILLES_PROVISION_CHANGE = exports.DUREE_ECART_NON_DETERMINABLE_ANNEES = void 0;
exports.motifRefusEcartEvaluation = motifRefusEcartEvaluation;
exports.cumulerConsolidation = cumulerConsolidation;
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
const mois_entre_1 = require("../../common/mois-entre");
const correspondance_tft_syscohada_1 = require("../etats-financiers-syscohada/correspondance-tft-syscohada");
exports.DUREE_ECART_NON_DETERMINABLE_ANNEES = 10;
exports.FAMILLES_PROVISION_CHANGE = [
    { provision: '194', dotation: '6971', reprise: '7971', nature: 'opérations financières, risque à long terme' },
    { provision: '4991', dotation: '6591', reprise: '7591', nature: 'opérations d’exploitation, risque à court terme' },
    { provision: '4997', dotation: '6791', reprise: '7791', nature: 'opérations financières, risque à court terme' },
];
exports.LIBELLE_POSTE = {
    ECART_ACQUISITION: 'Écart d’acquisition',
    AMORTISSEMENT_ECART_ACQUISITION: 'Amortissements de l’écart d’acquisition',
    DEPRECIATION_ECART_ACQUISITION: 'Dépréciations de l’écart d’acquisition',
    ECART_ACQUISITION_NEGATIF: 'Écart d’acquisition négatif',
    DOTATION_ECART_ACQUISITION: 'Dotations aux amortissements et dépréciations de l’écart d’acquisition',
    REPRISE_ECART_ACQUISITION_NEGATIF: 'Écart d’acquisition négatif rapporté au résultat',
    TITRES_MIS_EN_EQUIVALENCE: 'Titres mis en équivalence',
    QUOTE_PART_RESULTAT_ME: 'Quote-part dans les résultats des entités mises en équivalence',
    PROVISION_ME_NEGATIVE: 'Provision · quote-part négative d’une entité mise en équivalence',
    CAPITAL: 'Capital (entité consolidante)',
    PRIMES_CONSOLIDANTE: 'Primes liées au capital (entité consolidante)',
    ECARTS_REEVALUATION_CONSOLIDANTE: 'Écarts de réévaluation (entité consolidante)',
    RESERVES_GROUPE: 'Réserves consolidées',
    INTERETS_MINORITAIRES: 'Intérêts minoritaires (hors résultat)',
    RESULTAT_DEJA_CONSTATE: 'Résultat déjà porté au compte 13 dans les comptes individuels',
    ELIMINATION_RESULTATS_INTERNES: 'Élimination des résultats internes inclus dans les actifs (art. 86, 4°)',
    ECARTS_EVALUATION_RESULTAT: 'Écarts d’évaluation rapportés au résultat (amortis ou réalisés)',
    IMPOTS_DIFFERES_ACTIF: 'Actifs d’impôts différés',
    IMPOTS_DIFFERES_PASSIF: 'Passifs d’impôts différés',
    IMPOTS_DIFFERES_RESULTAT: 'Impôts différés (charge ou produit de l’exercice)',
    ECARTS_CONVERSION_INDIVIDUELS_RESULTAT: 'Pertes et gains de change latents constatés (478 et 479 retraités)',
    ECARTS_CONVERSION: 'Écarts de conversion (part du groupe)',
};
exports.POSTES_DE_RESULTAT = new Set([
    'DOTATION_ECART_ACQUISITION',
    'REPRISE_ECART_ACQUISITION_NEGATIF',
    'QUOTE_PART_RESULTAT_ME',
    'RESULTAT_DEJA_CONSTATE',
    'ELIMINATION_RESULTATS_INTERNES',
    'ECARTS_EVALUATION_RESULTAT',
    'IMPOTS_DIFFERES_RESULTAT',
    'ECARTS_CONVERSION_INDIVIDUELS_RESULTAT',
]);
const AJUSTEMENT_RESERVES = '§AJUSTEMENT_RESERVES';
const ECART_CONVERSION_ENTITE = '§ECART_CONVERSION';
class RefusConsolidation extends Error {
}
exports.RefusConsolidation = RefusConsolidation;
const r2 = (x) => Math.round(x * 100) / 100 || 0;
const PREFIXES_CP_HORS_RESULTAT = ['10', '11', '12'];
const estCpHorsResultat = (n) => n === AJUSTEMENT_RESERVES || PREFIXES_CP_HORS_RESULTAT.some((p) => n.startsWith(p)) || (0, resultat_de_l_exercice_1.estResultatEnInstanceDAffectation)(n);
const estResultat13 = (n) => (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(n);
const estGestion = (n) => /^[678]/.test(n) || exports.POSTES_DE_RESULTAT.has(n);
function moisEcoules(entree, date) {
    return Math.max(0, (0, mois_entre_1.moisEntre)(entree, date));
}
function planEcart(montantAbs, duree, entree, date) {
    if (date.getTime() < Date.UTC(entree.getUTCFullYear(), entree.getUTCMonth(), 1))
        return 0;
    const n = duree * 12;
    return r2((montantAbs * Math.min(moisEcoules(entree, date), n)) / n);
}
function motifRefusEcartEvaluation(ev, dateEntree) {
    const classe = ev.compte[0];
    if (!(classe === '2' || classe === '3' || /^1[6-9]/.test(ev.compte))) {
        return (`Écart d’évaluation « ${ev.libelle} » au compte ${ev.compte} · il s’affecte à un élément IDENTIFIABLE, une immobilisation (2), un stock (3) ` +
            'ou un passif externe (16 à 19), jamais aux capitaux propres.');
    }
    if (!(Math.abs(ev.montant) > 0.005))
        return `Écart d’évaluation « ${ev.libelle} » sans montant.`;
    if (ev.mode === 'AMORTISSABLE' && (classe !== '2' || !(Number(ev.dureeAnnees) > 0) || !ev.compteAmortissement?.startsWith('28'))) {
        return (`Écart d’évaluation « ${ev.libelle} » amortissable · il faut une immobilisation (classe 2), la durée d’utilité restant à courir à ` +
            'l’entrée, et le compte 28 qui porte son amortissement.');
    }
    if (ev.mode === 'REALISE' && (!ev.dateRealisation || (dateEntree && ev.dateRealisation.getTime() < dateEntree.getTime()))) {
        return `Écart d’évaluation « ${ev.libelle} » réalisé · la date de réalisation manque ou précède l’entrée.`;
    }
    return null;
}
function restantEcart(ev, s, entree, date) {
    if (ev.mode === 'NON_AMORTISSABLE')
        return s;
    if (ev.mode === 'REALISE')
        return date.getTime() >= ev.dateRealisation.getTime() ? 0 : s;
    return r2(s - Math.sign(s) * planEcart(Math.abs(s), ev.dureeAnnees, entree, date));
}
function cumulerConsolidation(exercice, entites, acquisitions, reciproques, resultatsInternes = [], fiscalites = [], conversions = [], monnaies) {
    const avertissements = [];
    const obstaclesFlux = [];
    const cours = new Map();
    const conversionsCalculees = [];
    const conversionsIncompletes = [];
    if (monnaies) {
        const presentation = monnaies.presentation.trim().toUpperCase();
        entites = entites.map((e) => {
            if (e.estConsolidante)
                return e;
            const d = monnaies.entites.find((x) => x.entiteId === e.id);
            const monnaie = d?.monnaie?.trim().toUpperCase();
            if (!monnaie) {
                const motif = `« ${e.nom} » n’a pas déclaré la monnaie de sa balance · OmegaX ne sait pas si elle est à convertir (art. 87, D4C ch. XII-4).`;
                conversionsIncompletes.push(motif);
                obstaclesFlux.push(motif);
                return e;
            }
            if (monnaie === presentation)
                return e;
            if (d.hyperinflation) {
                throw new RefusConsolidation(`« ${e.nom} » a une monnaie fonctionnelle hyperinflationniste · ses états se retraitent d’abord par un indice général des prix ` +
                    '(D4C ch. XII-4 § 4), ce que cette version ne fait pas.');
            }
            const C = Number(d.coursCloture);
            const M = Number(d.coursProduitsCharges);
            const H = d.capitauxPropresHistoriques;
            if (!(C > 0) || !(M > 0) || H == null) {
                throw new RefusConsolidation(`« ${e.nom} » tient sa balance en ${monnaie} et les états sont présentés en ${presentation} · il faut son cours de clôture, le cours ` +
                    'de ses charges et produits (moyen ou de clôture) et ses capitaux propres au cours historique (D4C ch. XII-4 § 3).');
            }
            cours.set(e.id, { cloture: C, pc: M, entree: d.coursEntree != null && d.coursEntree > 0 ? d.coursEntree : null });
            if (!e.balance)
                return e;
            const estCp = (n) => /^1[0-2]/.test(n) || (0, resultat_de_l_exercice_1.estResultatEnInstanceDAffectation)(n);
            const auCoursPc = (n) => estResultat13(n) || /^[678]/.test(n);
            const conv = (v, k) => (v == null ? v : r2(v * k));
            const lignes = e.balance.map((l) => {
                const k = auCoursPc(l.numero) ? M : C;
                return { ...l, solde: r2(l.solde * k), mouvementDebit: conv(l.mouvementDebit, k), mouvementCredit: conv(l.mouvementCredit, k) };
            });
            const cpAuCoursDeCloture = lignes.filter((l) => estCp(l.numero)).reduce((s, l) => s + l.solde, 0);
            const ajustement = r2(-H - cpAuCoursDeCloture);
            const ecart = r2(-(lignes.reduce((s, l) => s + l.solde, 0) + ajustement));
            lignes.push({ numero: AJUSTEMENT_RESERVES, intitule: 'Capitaux propres au cours historique', solde: ajustement, mouvementDebit: 0, mouvementCredit: 0 }, { numero: ECART_CONVERSION_ENTITE, intitule: 'Écart de conversion', solde: ecart, mouvementDebit: 0, mouvementCredit: 0 });
            conversionsCalculees.push({ entite: e.nom, monnaie, coursCloture: C, coursProduitsCharges: M, ecartConversion: -ecart });
            obstaclesFlux.push(`« ${e.nom} » est convertie de ${monnaie} en ${presentation} · l’incidence des variations de cours des devises (G, D4C ch. XII-8 § 4) ` +
                'n’est pas séparée par cette version, et ses flux mêleraient deux cours.');
            return { ...e, balance: lignes };
        });
    }
    const parId = new Map(entites.map((e) => [e.id, e]));
    const consolidante = entites.find((e) => e.estConsolidante);
    if (!consolidante)
        throw new RefusConsolidation('Aucune entité consolidante.');
    const nomDe = (id) => parId.get(id)?.nom ?? id;
    const fraction = new Map();
    for (const e of entites) {
        if (!e.balance) {
            throw new RefusConsolidation(`La balance de « ${e.nom} » manque · une entité retenue ne se consolide pas sans ses comptes.`);
        }
        const ecart = r2(e.balance.reduce((s, l) => s + l.solde, 0));
        if (Math.abs(ecart) > 0.005) {
            throw new RefusConsolidation(`La balance de « ${e.nom} » n’est pas équilibrée (écart de ${ecart}).`);
        }
        if (e.estConsolidante || e.methode === 'IG')
            fraction.set(e.id, 1);
        else if (e.methode === 'IP') {
            const detentrices = acquisitions.filter((a) => a.detenueId === e.id);
            if (detentrices.length !== 1) {
                throw new RefusConsolidation(`« ${e.nom} » est intégrée proportionnellement et a ${detentrices.length} détentrices déclarées · l’art. 81 parle de « la fraction ` +
                    'représentative des intérêts » de l’entité détentrice, et aucun texte lu ne dit laquelle retenir quand il y en a plusieurs.');
            }
            fraction.set(e.id, detentrices[0].pctCapital / 100);
        }
        if ((e.estConsolidante || e.methode !== 'ME') && e.balance.some((l) => /^14/.test(l.numero) && Math.abs(l.solde) > 0.005)) {
            avertissements.push(`« ${e.nom} » porte des subventions d’investissement (14) · présentées sur leur ligne propre, hors capitaux propres (D4C ch. XII-8 § 2) ; ` +
                'le ch. XII-3 § 2 les reclasse en produits constatés d’avance, sans incidence sur le résultat ni impôt différé.');
        }
    }
    const mouvements = new Map();
    const comptes = new Map();
    const intitules = new Map();
    const conversionMe = new Map();
    const ajouter = (entiteId, cle, montant) => {
        const m = comptes.get(entiteId);
        m.set(cle, r2((m.get(cle) ?? 0) + montant));
    };
    for (const e of entites) {
        if (e.methode === 'ME' && !e.estConsolidante)
            continue;
        const f = fraction.get(e.id);
        const m = new Map();
        comptes.set(e.id, m);
        let sansMouvements = false;
        for (const l of e.balance) {
            m.set(l.numero, r2((m.get(l.numero) ?? 0) + l.solde * f));
            if (!intitules.has(l.numero) || e.estConsolidante)
                intitules.set(l.numero, l.intitule);
            if (l.mouvementDebit == null || l.mouvementCredit == null) {
                sansMouvements = true;
                continue;
            }
            const mv = mouvements.get(l.numero) ?? { debit: 0, credit: 0 };
            mv.debit = r2(mv.debit + l.mouvementDebit * f);
            mv.credit = r2(mv.credit + l.mouvementCredit * f);
            mouvements.set(l.numero, mv);
            if (!e.estConsolidante && /^10[1-5]/.test(l.numero) && (Math.abs(l.mouvementDebit) > 0.005 || Math.abs(l.mouvementCredit) > 0.005)) {
                obstaclesFlux.push(`Le capital de « ${e.nom} » a bougé dans l’exercice (compte ${l.numero}) · la part des minoritaires dans ce flux n’est pas séparée.`);
            }
        }
        if (sansMouvements) {
            obstaclesFlux.push(`La balance de « ${e.nom} » ne porte pas les mouvements de l’exercice · importez-la à six colonnes (report, mouvements, solde).`);
        }
        if (e.balance.some((l) => estResultat13(l.numero) && Math.abs(l.solde) > 0.005)) {
            obstaclesFlux.push(`La balance de « ${e.nom} » est arrêtée APRÈS clôture (résultat au compte 13) · la capacité d’autofinancement ne se calcule pas sans ses charges et produits.`);
        }
    }
    const integree = (id) => comptes.has(id);
    const lireCp = (b) => {
        let cp = 0;
        let res = 0;
        for (const l of b) {
            if (estCpHorsResultat(l.numero))
                cp -= l.solde;
            else if (estResultat13(l.numero) || estGestion(l.numero))
                res -= l.solde;
        }
        return { cp: r2(cp), res: r2(res) };
    };
    const fisc = new Map(fiscalites.map((f) => [f.entiteId, f]));
    const taux = (id) => {
        const t = fisc.get(id)?.tauxImpot;
        return t == null ? null : t / 100;
    };
    const tauxOuverture = (id) => {
        const t = fisc.get(id)?.tauxImpotOuverture;
        return t == null ? null : t / 100;
    };
    const reportVariableNonJoue = new Set();
    const reajustementTaux = (id, t, baseOuverture) => {
        if (Math.abs(baseOuverture) <= 0.005)
            return 0;
        const tOuv = tauxOuverture(id);
        if (tOuv == null) {
            reportVariableNonJoue.add(nomDe(id));
            return 0;
        }
        return r2((t - tOuv) * baseOuverture);
    };
    const impotsDifferesIncomplets = [];
    const retraitementsNonJoues = [];
    const poserImpotDiffere = (id, soldeCloture) => {
        if (Math.abs(soldeCloture) <= 0.005)
            return;
        ajouter(id, soldeCloture > 0 ? 'IMPOTS_DIFFERES_ACTIF' : 'IMPOTS_DIFFERES_PASSIF', soldeCloture);
    };
    const ecarts = [];
    const ecartsEvaluation = [];
    let ecartsEvaluationStocksResultat = 0;
    let dividendesRecusMe = 0;
    const veilleOuverture = new Date(exercice.dateDebut.getTime() - 86_400_000);
    const depreciationsTitresVues = new Set();
    for (const a of acquisitions) {
        if (!parId.get(a.detenueId) || !integree(a.detentriceId) || depreciationsTitresVues.has(a.detentriceId))
            continue;
        depreciationsTitresVues.add(a.detentriceId);
        const portes = [...(comptes.get(a.detentriceId) ?? new Map())].filter(([cle, solde]) => /^296[123]/.test(cle) && Math.abs(solde) > 0.005);
        if (portes.length) {
            retraitementsNonJoues.push(`« ${nomDe(a.detentriceId)} » porte une dépréciation de titres de participation (${portes.map(([c]) => c).join(', ')}) · ` +
                'celle des titres consolidés, et sa dotation, s’éliminent en totalité (D4C ch. XII-5 § 5 et § 6), ce que cette version ne joue pas.');
        }
    }
    for (const a of acquisitions) {
        const detenue = parId.get(a.detenueId);
        const detentrice = parId.get(a.detentriceId);
        if (!detenue || !detentrice)
            continue;
        if (!integree(a.detentriceId) || fraction.get(a.detentriceId) !== 1) {
            throw new RefusConsolidation(`« ${detentrice.nom} » détient « ${detenue.nom} » sans être intégrée globalement · les titres d’une entité intégrée ` +
                'proportionnellement ou mise en équivalence ne se substituent pas par ce moteur.');
        }
        if (a.dateEntree.getTime() > exercice.dateDebut.getTime()) {
            throw new RefusConsolidation(`« ${detenue.nom} » est entrée dans le périmètre en cours d’exercice · la part du résultat antérieure à l’entrée ` +
                '(art. 82) ne se lit pas dans une balance annuelle, et cette tranche ne la sépare pas.');
        }
        const soldeTitres = comptes.get(a.detentriceId).get(a.compteTitres) ?? 0;
        if (soldeTitres + 0.005 < a.coutAcquisition) {
            avertissements.push(`Le compte ${a.compteTitres} de « ${detentrice.nom} » porte ${soldeTitres} quand le coût déclaré des titres de ` +
                `« ${detenue.nom} » est ${a.coutAcquisition} · vérifiez le compte ou le coût.`);
        }
        const d = a.pctCapital / 100;
        const evs = a.ecartsEvaluation ?? [];
        let reestimation = 0;
        if (evs.length > 0) {
            if (cours.has(a.detenueId)) {
                throw new RefusConsolidation(`Écart d’évaluation déclaré sur « ${detenue.nom} », entité convertie · sa conversion au cours de clôture (D4C ch. XII-4 § 3) n’est pas servie par cette version.`);
            }
            if (detenue.methode === 'ME') {
                throw new RefusConsolidation(`Écart d’évaluation déclaré sur « ${detenue.nom} », mise en équivalence · ses comptes n’étant pas repris, il n’y a pas d’écart d’évaluation (D4C ch. XII-6 § 3).`);
            }
            const t = taux(a.detenueId);
            if (t == null) {
                throw new RefusConsolidation(`Écart d’évaluation sur « ${detenue.nom} » sans taux d’impôt déclaré pour elle · tous les écarts d’évaluation donnent lieu à imposition ` +
                    'différée (D4C ch. XII-6 § 1), au taux en vigueur à la clôture (ch. XII-3 § 3).');
            }
            const f = fraction.get(a.detenueId);
            for (const ev of evs) {
                const refus = motifRefusEcartEvaluation(ev, a.dateEntree);
                if (refus)
                    throw new RefusConsolidation(refus);
                const classe = ev.compte[0];
                const passif = classe === '1';
                const s = passif ? -ev.montant : ev.montant;
                reestimation += s * (1 - t);
                const rOuv = restantEcart(ev, s, a.dateEntree, veilleOuverture);
                const rClo = restantEcart(ev, s, a.dateEntree, exercice.dateFin);
                const D = a.detenueId;
                if (ev.mode === 'AMORTISSABLE') {
                    ajouter(D, ev.compte, r2(f * s));
                    ajouter(D, ev.compteAmortissement, -r2(f * (s - rClo)));
                }
                else {
                    ajouter(D, ev.compte, r2(f * rClo));
                }
                const resultatEcart = r2(f * (rOuv - rClo));
                ajouter(D, 'ECARTS_EVALUATION_RESULTAT', resultatEcart);
                if (classe === '3')
                    ecartsEvaluationStocksResultat += resultatEcart;
                const ajustEv = reajustementTaux(D, t, f * rOuv);
                ajouter(D, AJUSTEMENT_RESERVES, -r2(f * rOuv * (1 - t)) - ajustEv);
                poserImpotDiffere(D, -r2(t * f * rClo));
                ajouter(D, 'IMPOTS_DIFFERES_RESULTAT', -r2(t * resultatEcart) + ajustEv);
                ecartsEvaluation.push({
                    detenue: detenue.nom,
                    libelle: ev.libelle,
                    compte: ev.compte,
                    montantEntree: ev.montant,
                    restantOuverture: passif ? -rOuv : rOuv,
                    restantCloture: passif ? -rClo : rClo,
                    tauxImpot: t * 100,
                    impotDiffereCloture: -r2(t * f * rClo),
                });
            }
        }
        const quotePart = r2(d * (a.capitauxPropresEntree + reestimation));
        const ecart = r2(a.coutAcquisition - quotePart);
        if (ecart < -0.005 && a.modeDureeEcart === 'NON_DETERMINABLE') {
            throw new RefusConsolidation(`L’écart d’acquisition sur « ${detenue.nom} » est négatif (${ecart}) · il est rapporté au résultat sur une durée reflétant les ` +
                'hypothèses et objectifs de l’acquisition (D4C ch. XII-6 § 4), à déclarer en durée limitée · les dix ans ne visent que l’écart positif.');
        }
        if (ecart < -0.005) {
            avertissements.push(`Écart d’acquisition négatif sur « ${detenue.nom} » · avant de porter ce profit au résultat, l’acquéreur revérifie l’identification ` +
                'des actifs acquis et des passifs repris (D4C ch. XII-6 § 4).');
        }
        const duree = a.modeDureeEcart === 'NON_DETERMINABLE' ? exports.DUREE_ECART_NON_DETERMINABLE_ANNEES : (a.dureeEcartAnnees ?? 0);
        if (Math.abs(ecart) > 0.005 && !(duree > 0)) {
            throw new RefusConsolidation(`L’écart d’acquisition sur « ${detenue.nom} » n’a pas de durée · l’art. 82 le rapporte au résultat selon un plan ` +
                'd’amortissement. Durée d’utilité, ou dix ans si elle n’est pas déterminable de façon fiable (ch. XII-6 § 4).');
        }
        const amortOuv = duree > 0 ? planEcart(Math.abs(ecart), duree, a.dateEntree, veilleOuverture) : 0;
        const amortClo = duree > 0 ? planEcart(Math.abs(ecart), duree, a.dateEntree, exercice.dateFin) : 0;
        const depOuv = r2(a.depreciationEcartOuverture ?? 0);
        const depClo = r2(a.depreciationEcartCloture ?? 0);
        if (depClo + 0.005 < depOuv) {
            throw new RefusConsolidation(`La dépréciation de l’écart sur « ${detenue.nom} » baisse · elle n’est jamais reprise (ch. XII-6 § 4).`);
        }
        if (ecart < 0 && (depOuv > 0 || depClo > 0)) {
            throw new RefusConsolidation(`Un écart d’acquisition négatif ne se déprécie pas (« ${detenue.nom} »).`);
        }
        const cv = cours.get(a.detenueId);
        if (cv && Math.abs(ecart) > 0.005 && cv.entree == null) {
            throw new RefusConsolidation(`L’écart d’acquisition sur « ${detenue.nom} », entité convertie, se convertit au cours de clôture (D4C ch. XII-4 § 3) · déclarez le cours à la date d’entrée.`);
        }
        const rc = cv && cv.entree ? cv.cloture / cv.entree : 1;
        const rp = cv && cv.entree ? cv.pc / cv.entree : 1;
        ecarts.push({
            detentrice: detentrice.nom,
            detenue: detenue.nom,
            methode: detenue.methode,
            coutAcquisition: a.coutAcquisition,
            quotePartCapitauxPropresEntree: quotePart,
            ecart,
            dureeAnnees: duree,
            amortissementCumuleOuverture: amortOuv,
            amortissementCumuleCloture: amortClo,
            dotationExercice: r2(amortClo - amortOuv + (depClo - depOuv)),
            depreciationCumuleeCloture: depClo,
        });
        const H = a.detentriceId;
        ajouter(H, a.compteTitres, -a.coutAcquisition);
        const ligneTitres = detentrice.balance?.find((l) => l.numero === a.compteTitres);
        if (ligneTitres && (Math.abs(ligneTitres.mouvementDebit ?? 0) > 0.005 || Math.abs(ligneTitres.mouvementCredit ?? 0) > 0.005)) {
            obstaclesFlux.push(`Le compte ${a.compteTitres} de « ${detentrice.nom} » a bougé dans l’exercice · un achat ou une cession de titres de « ${detenue.nom} » ` +
                'change le pourcentage, ce que ce moteur ne traite pas.');
        }
        if (detenue.methode === 'IG' || detenue.methode === 'IP') {
            ajouter(H, AJUSTEMENT_RESERVES, quotePart);
            if (ecart >= 0) {
                const dot = r2(amortClo - amortOuv + depClo - depOuv);
                const [b, am, dp, dt] = [r2(ecart * rc), r2(amortClo * rc), r2(depClo * rc), r2(dot * rp)];
                ajouter(H, 'ECART_ACQUISITION', b);
                ajouter(H, 'AMORTISSEMENT_ECART_ACQUISITION', -am);
                ajouter(H, 'DEPRECIATION_ECART_ACQUISITION', -dp);
                ajouter(H, 'DOTATION_ECART_ACQUISITION', dt);
                ajouter(H, AJUSTEMENT_RESERVES, r2(amortOuv + depOuv));
                if (cv)
                    ajouter(H, ECART_CONVERSION_ENTITE, -r2(b - am - dp + dt - (ecart - amortClo - depClo + dot)));
            }
            else {
                const rep_ = r2(amortClo - amortOuv);
                const [net, rpr] = [r2((ecart + amortClo) * rc), r2(rep_ * rp)];
                ajouter(H, 'ECART_ACQUISITION_NEGATIF', net);
                ajouter(H, 'REPRISE_ECART_ACQUISITION_NEGATIF', -rpr);
                ajouter(H, AJUSTEMENT_RESERVES, -amortOuv);
                if (cv)
                    ajouter(H, ECART_CONVERSION_ENTITE, -r2(net - rpr - (ecart + amortClo - rep_)));
            }
        }
        else {
            if (ecart < 0) {
                throw new RefusConsolidation(`Écart d’acquisition négatif sur « ${detenue.nom} », mise en équivalence · le D4C ne traite que l’écart positif d’une entité mise en équivalence.`);
            }
            const { cp, res } = lireCp(detenue.balance);
            const ecDetenue = -r2(detenue.balance.filter((l) => l.numero === ECART_CONVERSION_ENTITE).reduce((s, l) => s + l.solde, 0));
            const quotePartResultat = r2(d * res);
            const netEcartHist = r2(ecart - amortClo - depClo);
            const dotationHist = r2(amortClo - amortOuv + depClo - depOuv);
            const valeur = r2(d * (cp + res + ecDetenue) + r2(netEcartHist * rc));
            const dotation = r2(dotationHist * rp);
            const partResultat = r2(quotePartResultat - dotation);
            if (valeur >= 0) {
                ajouter(H, 'TITRES_MIS_EN_EQUIVALENCE', valeur);
            }
            else if (a.obligationNonDesengagement) {
                ajouter(H, 'PROVISION_ME_NEGATIVE', valeur);
            }
            else {
                avertissements.push(`Quote-part négative de « ${detenue.nom} » (${valeur}) retenue pour une valeur nulle (ch. XII-5 § 6) · ` +
                    'si la détentrice a l’obligation ou l’intention de ne pas se désengager, déclarez-le, la partie négative passe en provision.');
            }
            const valeurRetenue = valeur >= 0 || a.obligationNonDesengagement ? valeur : 0;
            ajouter(H, 'QUOTE_PART_RESULTAT_ME', -quotePartResultat);
            ajouter(H, 'DOTATION_ECART_ACQUISITION', dotation);
            const partConversion = cv && valeurRetenue === valeur ? r2(d * ecDetenue + netEcartHist * (rc - 1) + dotationHist * (rp - 1)) : 0;
            if (partConversion !== 0) {
                ajouter(H, ECART_CONVERSION_ENTITE, -partConversion);
                conversionMe.set(H, r2((conversionMe.get(H) ?? 0) + partConversion));
            }
            ajouter(H, AJUSTEMENT_RESERVES, -r2(valeurRetenue - a.coutAcquisition - partResultat - partConversion));
        }
        if (a.dividendesExercice == null) {
            retraitementsNonJoues.push(`Dividendes reçus de « ${detenue.nom} » par « ${detentrice.nom} » non déclarés · zéro est une réponse, l’absence n’en est pas une (D4C ch. XII-5 § 4).`);
        }
        const div = r2(a.dividendesExercice ?? 0);
        if (div > 0 && detenue.methode === 'ME')
            dividendesRecusMe += div;
        if (div > 0) {
            if (!a.compteDividendes) {
                throw new RefusConsolidation(`Dividendes de « ${detenue.nom} » déclarés sans le compte qui les porte chez « ${detentrice.nom} ».`);
            }
            if (!a.compteDividendes.startsWith('772')) {
                avertissements.push(`Dividendes de « ${detenue.nom} » lus au compte ${a.compteDividendes}, hors du 772 « Revenus de participations ».`);
            }
            ajouter(H, a.compteDividendes, div);
            ajouter(H, AJUSTEMENT_RESERVES, -div);
        }
    }
    for (const ri of resultatsInternes) {
        for (const id of [ri.vendeuseId, ri.acheteuseId]) {
            const e = parId.get(id);
            if (!e)
                throw new RefusConsolidation(`Résultat interne « ${ri.libelle} » · une des deux entités n’est pas retenue.`);
            if (!integree(id)) {
                throw new RefusConsolidation(`Résultat interne « ${ri.libelle} » avec « ${e.nom} », mise en équivalence · son élimination se fait sur les titres mis en ` +
                    'équivalence (D4C ch. XII-5 § 6), que cette tranche ne traite pas.');
            }
        }
        if (ri.vendeuseId === ri.acheteuseId) {
            throw new RefusConsolidation(`Résultat interne « ${ri.libelle} » · la vendeuse et l’acheteuse sont la même entité, rien n’est interne au groupe.`);
        }
        if (!Number.isFinite(ri.margeCloture) || !Number.isFinite(ri.margeOuverture)) {
            throw new RefusConsolidation(`Résultat interne « ${ri.libelle} » · la marge d’ouverture et celle de clôture se déclarent toutes deux.`);
        }
        const classeAttendue = ri.nature === 'STOCK' ? '3' : '2';
        if (!ri.compteActif.startsWith(classeAttendue)) {
            throw new RefusConsolidation(`Résultat interne « ${ri.libelle} » · ${ri.nature === 'STOCK' ? 'un stock' : 'une immobilisation'} s’inscrit en classe ${classeAttendue}, pas au compte ${ri.compteActif}.`);
        }
        const facteur = Math.min(fraction.get(ri.vendeuseId), fraction.get(ri.acheteuseId));
        const cloture = r2(ri.margeCloture * facteur);
        const ouverture = r2(ri.margeOuverture * facteur);
        const soldeActif = comptes.get(ri.acheteuseId).get(ri.compteActif) ?? 0;
        if (soldeActif + 0.005 < cloture) {
            throw new RefusConsolidation(`Résultat interne « ${ri.libelle} » · ${cloture} à éliminer excède le solde du compte ${ri.compteActif} de « ${nomDe(ri.acheteuseId)} » (${soldeActif}).`);
        }
        if (ri.nature === 'IMMOBILISATION') {
            retraitementsNonJoues.push(`Cession interne d’immobilisation « ${ri.libelle} » · la marge est retranchée du compte ${ri.compteActif} en valeur nette ; ` +
                'la valeur brute et les amortissements cumulés du cédant ne sont pas reconstitués, ni la dotation corrigée (D4C ch. XII-3 § 2).');
        }
        ajouter(ri.vendeuseId, 'ELIMINATION_RESULTATS_INTERNES', r2(cloture - ouverture));
        ajouter(ri.vendeuseId, AJUSTEMENT_RESERVES, ouverture);
        ajouter(ri.vendeuseId, ri.compteActif, -cloture);
        const t = taux(ri.vendeuseId);
        if (t == null) {
            impotsDifferesIncomplets.push(`Résultat interne « ${ri.libelle} » · aucun taux d’impôt déclaré pour « ${nomDe(ri.vendeuseId)} », l’impôt différé sur la marge éliminée n’est pas calculé.`);
        }
        else {
            const ajustRi = reajustementTaux(ri.vendeuseId, t, ouverture);
            poserImpotDiffere(ri.vendeuseId, r2(t * cloture));
            ajouter(ri.vendeuseId, 'IMPOTS_DIFFERES_RESULTAT', -r2(t * (cloture - ouverture)) - ajustRi);
            ajouter(ri.vendeuseId, AJUSTEMENT_RESERVES, -r2(t * ouverture) + ajustRi);
        }
    }
    for (const [id, m] of comptes) {
        let c15 = 0;
        let d851 = 0;
        let s861 = 0;
        const cles = [];
        for (const [cle, solde] of m) {
            if (cle.startsWith('15'))
                c15 += solde;
            else if (cle.startsWith('851'))
                d851 += solde;
            else if (cle.startsWith('861'))
                s861 += solde;
            else
                continue;
            cles.push(cle);
        }
        if (cles.every((c) => Math.abs(m.get(c) ?? 0) <= 0.005))
            continue;
        for (const c of cles) {
            m.set(c, 0);
            mouvements.delete(c);
        }
        ajouter(id, AJUSTEMENT_RESERVES, r2(c15 + d851 + s861));
        const t = taux(id);
        if (t == null) {
            impotsDifferesIncomplets.push(`« ${nomDe(id)} » · aucun taux d’impôt déclaré, l’impôt différé sur ses provisions réglementées contre-passées n’est pas calculé.`);
        }
        else {
            const ajustPr = reajustementTaux(id, t, c15 + d851 + s861);
            poserImpotDiffere(id, r2(t * c15));
            ajouter(id, 'IMPOTS_DIFFERES_RESULTAT', r2(t * (d851 + s861)) - ajustPr);
            ajouter(id, AJUSTEMENT_RESERVES, -r2(t * (c15 + d851 + s861)) + ajustPr);
        }
    }
    for (const cv of conversions) {
        const m = comptes.get(cv.entiteId);
        if (!m)
            continue;
        const f = fraction.get(cv.entiteId);
        let X = 0;
        let Y = 0;
        for (const [cle, solde] of m) {
            if (cle.startsWith('478'))
                X += solde;
            else if (cle.startsWith('479'))
                Y -= solde;
            else
                continue;
            m.set(cle, 0);
            mouvements.delete(cle);
        }
        let P = 0;
        let D = 0;
        let R = 0;
        const retirer = (prefixe, montant, sens, quoi, suivreMouvements) => {
            if (montant <= 0.005)
                return;
            const cle = [...m.keys()].sort().find((k) => k.startsWith(prefixe) && sens * (m.get(k) ?? 0) + 0.005 >= montant);
            if (!cle) {
                throw new RefusConsolidation(`« ${nomDe(cv.entiteId)} » · ${quoi} de ${montant} déclarée, et aucun compte ${prefixe} de sa balance ne la porte.`);
            }
            ajouter(cv.entiteId, cle, -sens * montant);
            const mv = suivreMouvements ? mouvements.get(cle) : undefined;
            if (mv) {
                if (sens === 1)
                    mv.debit = r2(Math.max(0, mv.debit - montant));
                else
                    mv.credit = r2(Math.max(0, mv.credit - montant));
            }
        };
        for (const p of cv.provisions) {
            const fam = exports.FAMILLES_PROVISION_CHANGE.find((x) => p.compteProvision.startsWith(x.provision));
            if (!fam) {
                throw new RefusConsolidation(`« ${nomDe(cv.entiteId)} » · la provision pour pertes de change se loge au 194, au 4991 ou au 4997 (Titre VIII ch. 22 § 2.3), pas au ${p.compteProvision}.`);
            }
            if (p.cloture < 0 || p.dotation < 0 || p.reprise < 0 || p.cloture - p.dotation + p.reprise < -0.005) {
                throw new RefusConsolidation(`« ${nomDe(cv.entiteId)} » · provision ${p.compteProvision} · clôture, dotation et reprise se déclarent positives, et la provision d’ouverture qu’elles donnent (clôture − dotation + reprise) ne peut être négative.`);
            }
            const c = r2(f * p.cloture);
            const d = r2(f * p.dotation);
            const rp = r2(f * p.reprise);
            retirer(p.compteProvision, c, -1, 'provision pour pertes de change', false);
            retirer(fam.dotation, d, 1, 'dotation', true);
            retirer(fam.reprise, rp, -1, 'reprise', true);
            P += c;
            D += d;
            R += rp;
        }
        const X1 = r2(f * cv.actifN1);
        const Y1 = r2(f * cv.passifN1);
        ajouter(cv.entiteId, 'ECARTS_CONVERSION_INDIVIDUELS_RESULTAT', r2(X - Y - (X1 - Y1)));
        ajouter(cv.entiteId, AJUSTEMENT_RESERVES, r2(X1 - Y1 - (P - D + R)));
    }
    for (const id of comptes.keys()) {
        const e = parId.get(id);
        const fi = fisc.get(id);
        if (!fi || fi.idaOuverture == null || fi.idaCloture == null || fi.idpOuverture == null || fi.idpCloture == null) {
            impotsDifferesIncomplets.push(`« ${e.nom} » n’a pas déclaré les impôts différés de ses comptes individuels (décalages temporaires, déficits reportables, art. 92) · zéro est une réponse, l’absence n’en est pas une.`);
            continue;
        }
        for (const v of [fi.idaOuverture, fi.idaCloture, fi.idpOuverture, fi.idpCloture]) {
            if (v < 0)
                throw new RefusConsolidation(`« ${e.nom} » · un impôt différé se déclare en montant positif, son sens est celui de la colonne.`);
        }
        if ((fi.idaCloture > 0.005 || fi.idaOuverture > 0.005) && !fi.justificationIda?.trim()) {
            throw new RefusConsolidation(`« ${e.nom} » déclare un impôt différé actif sans dire pourquoi son imputation est probable · il n’est comptabilisé que s’il est « probable que la ` +
                'différence s’inversera dans un avenir prévisible et qu’un bénéfice imposable existera » (D4C ch. XII-3 § 3).');
        }
        const f = fraction.get(id);
        poserImpotDiffere(id, r2(f * fi.idaCloture));
        poserImpotDiffere(id, -r2(f * fi.idpCloture));
        ajouter(id, 'IMPOTS_DIFFERES_RESULTAT', r2(-f * (fi.idaCloture - fi.idaOuverture) + f * (fi.idpCloture - fi.idpOuverture)));
        ajouter(id, AJUSTEMENT_RESERVES, r2(-f * fi.idaOuverture + f * fi.idpOuverture));
    }
    let capital = 0;
    let primes = 0;
    let ecartsReevaluation = 0;
    let reservesGroupe = 0;
    let ecartsConversion = 0;
    let ecartsConversionMinoritaires = 0;
    let ecartsConversionMe = 0;
    let resultatGroupe = 0;
    let imHorsResultat = 0;
    let resultatMinoritaires = 0;
    const agregat = new Map();
    for (const [id, m] of comptes) {
        const e = parId.get(id);
        let cpCapital = 0;
        let cpPrimes = 0;
        let cpReevaluation = 0;
        let cpAutres = 0;
        let ec = 0;
        let res = 0;
        for (const [cle, solde] of m) {
            if (cle === ECART_CONVERSION_ENTITE)
                ec -= solde;
            else if (estCpHorsResultat(cle)) {
                if (cle.startsWith('105'))
                    cpPrimes -= solde;
                else if (cle.startsWith('106'))
                    cpReevaluation -= solde;
                else if (cle.startsWith('10'))
                    cpCapital -= solde;
                else
                    cpAutres -= solde;
            }
            else if (estResultat13(cle) || estGestion(cle))
                res -= solde;
        }
        const g = e.estConsolidante ? 1 : e.pctInteret / 100 / fraction.get(id);
        if (e.estConsolidante) {
            capital += cpCapital;
            primes += cpPrimes;
            ecartsReevaluation += cpReevaluation;
            reservesGroupe += cpAutres;
        }
        else {
            const cp = cpCapital + cpPrimes + cpReevaluation + cpAutres;
            reservesGroupe += g * cp;
            imHorsResultat += (1 - g) * cp;
        }
        ecartsConversion += g * ec;
        imHorsResultat += (1 - g) * ec;
        ecartsConversionMinoritaires += (1 - g) * ec;
        ecartsConversionMe += conversionMe.get(id) ?? 0;
        resultatGroupe += g * res;
        resultatMinoritaires += (1 - g) * res;
        for (const [cle, solde] of m) {
            if (estCpHorsResultat(cle) || cle === ECART_CONVERSION_ENTITE)
                continue;
            const k = estResultat13(cle) ? 'RESULTAT_DEJA_CONSTATE' : cle;
            agregat.set(k, r2((agregat.get(k) ?? 0) + solde));
        }
    }
    for (const o of reciproques) {
        for (const id of [o.entiteAId, o.entiteBId]) {
            const e = parId.get(id);
            if (!e)
                throw new RefusConsolidation(`Opération réciproque « ${o.libelle} » · une des deux entités n’est pas retenue.`);
            if (!integree(id)) {
                throw new RefusConsolidation(`Opération réciproque « ${o.libelle} » avec « ${e.nom} », mise en équivalence · ses comptes ne sont pas cumulés, il n’y a rien à éliminer (art. 86, 6°).`);
            }
        }
        for (const compte of [o.compteA, o.compteB]) {
            const postes = (0, correspondance_tft_syscohada_1.postesLisantEnMouvement)(compte);
            if (postes.length) {
                obstaclesFlux.push(`Opération réciproque « ${o.libelle} » sur le compte ${compte} · le tableau des flux le lit en mouvements (${postes.join(', ')}), ` +
                    'et l’élimination ne porte que sur le solde · ses flux intragroupe de l’exercice y resteraient.');
            }
        }
        const facteur = Math.min(fraction.get(o.entiteAId), fraction.get(o.entiteBId));
        const m = r2(o.montant * facteur);
        const sA = comptes.get(o.entiteAId).get(o.compteA) ?? 0;
        const sB = comptes.get(o.entiteBId).get(o.compteB) ?? 0;
        if (Math.sign(sA) === Math.sign(sB) || sA === 0 || sB === 0) {
            throw new RefusConsolidation(`Opération réciproque « ${o.libelle} » · les comptes ${o.compteA} de « ${nomDe(o.entiteAId)} » et ${o.compteB} de ` +
                `« ${nomDe(o.entiteBId)} » doivent être de sens contraire, et non nuls.`);
        }
        if (Math.abs(sA) + 0.005 < m || Math.abs(sB) + 0.005 < m) {
            throw new RefusConsolidation(`Opération réciproque « ${o.libelle} » · ${m} à éliminer excède le solde de l’un des deux comptes. La procédure de ` +
                'confirmation de solde (ch. XII-3 § 2) doit d’abord rapprocher les deux montants.');
        }
        agregat.set(o.compteA, r2((agregat.get(o.compteA) ?? 0) - Math.sign(sA) * m));
        agregat.set(o.compteB, r2((agregat.get(o.compteB) ?? 0) - Math.sign(sB) * m));
    }
    capital = r2(capital);
    primes = r2(primes);
    ecartsReevaluation = r2(ecartsReevaluation);
    reservesGroupe = r2(reservesGroupe);
    ecartsConversion = r2(ecartsConversion);
    ecartsConversionMinoritaires = r2(ecartsConversionMinoritaires);
    ecartsConversionMe = r2(ecartsConversionMe);
    imHorsResultat = r2(imHorsResultat);
    resultatGroupe = r2(resultatGroupe);
    resultatMinoritaires = r2(resultatMinoritaires);
    agregat.set('CAPITAL', -capital);
    agregat.set('PRIMES_CONSOLIDANTE', -primes);
    agregat.set('ECARTS_REEVALUATION_CONSOLIDANTE', -ecartsReevaluation);
    agregat.set('RESERVES_GROUPE', -reservesGroupe);
    agregat.set('ECARTS_CONVERSION', -ecartsConversion);
    agregat.set('INTERETS_MINORITAIRES', -imHorsResultat);
    const lignes = [...agregat.entries()]
        .filter(([, s]) => Math.abs(s) > 0.005)
        .map(([cle, solde]) => {
        const poste = cle in exports.LIBELLE_POSTE;
        return { cle, solde, poste, intitule: poste ? exports.LIBELLE_POSTE[cle] : (intitules.get(cle) ?? cle) };
    })
        .sort((a, b) => Number(a.poste) - Number(b.poste) || a.cle.localeCompare(b.cle));
    const equilibre = r2(lignes.reduce((s, l) => s + l.solde, 0));
    const resultatEnsemble = r2(-lignes.filter((l) => estResultat13(l.cle) || estGestion(l.cle)).reduce((s, l) => s + l.solde, 0));
    if (reportVariableNonJoue.size) {
        avertissements.push(`Report variable (D4C ch. XII-3 § 3) · aucun taux d’impôt de la consolidation N-1 pour ${[...reportVariableNonJoue].join(', ')} · ` +
            'l’impôt différé d’ouverture est évalué au taux de clôture, et l’effet d’un éventuel changement de taux n’est pas porté au résultat.');
    }
    return {
        retraitementsNonJoues,
        lignes,
        capitauxPropres: {
            capital,
            primes,
            ecartsReevaluation,
            reservesGroupe,
            ecartsConversion,
            ecartsConversionMinoritaires,
            ecartsConversionMe,
            resultatGroupe,
            interetsMinoritairesHorsResultat: imHorsResultat,
            resultatMinoritaires,
            resultatEnsemble,
        },
        ecarts,
        avertissements,
        equilibre,
        mouvements: [...mouvements.entries()]
            .map(([cle, m]) => ({ cle, intitule: intitules.get(cle) ?? cle, ...m }))
            .sort((a, b) => a.cle.localeCompare(b.cle)),
        obstaclesFlux,
        dividendesRecusMe: r2(dividendesRecusMe),
        ecartsEvaluationStocksResultat: r2(ecartsEvaluationStocksResultat),
        ecartsEvaluation,
        impotsDifferesIncomplets,
        conversions: conversionsCalculees,
        conversionsIncompletes,
    };
}
//# sourceMappingURL=cumul-consolidation.js.map