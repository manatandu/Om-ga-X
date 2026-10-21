"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reserveReductionInpp = exports.FRACTION_MAXIMALE_REDUCTION_INPP = exports.TAXATION_D_OFFICE_INPP = exports.MAJORATION_RETARD_INPP = exports.RESERVE_IMPUTATION_INPP_ONEM = exports.RACINE_CHARGE_ONEM = exports.RACINE_CHARGE_INPP = exports.ECHEANCES_TRIMESTRIELLES_INPP = exports.ORDONNANCE_84_186 = void 0;
exports.echeanceTrimestrielleInpp = echeanceTrimestrielleInpp;
exports.prochaineEcheanceInpp = prochaineEcheanceInpp;
exports.ventilerInppOnem = ventilerInppOnem;
exports.lignesEcheancierInppOnem = lignesEcheancierInppOnem;
exports.mentionNonVentilee = mentionNonVentilee;
exports.motifRefusReductionInpp = motifRefusReductionInpp;
const echeance_1 = require("../../common/echeance");
const inpp_onem_du_4428_1 = require("./inpp-onem-du-4428");
exports.ORDONNANCE_84_186 = "ordonnance n° 84/186 du 15 octobre 1984 fixant les modalités de paiement de la cotisation due par les employeurs à l'INPP";
exports.ECHEANCES_TRIMESTRIELLES_INPP = [
    { trimestre: 1, moisZeroBase: 3, jour: 30, anneeSuivante: false },
    { trimestre: 2, moisZeroBase: 6, jour: 31, anneeSuivante: false },
    { trimestre: 3, moisZeroBase: 9, jour: 31, anneeSuivante: false },
    { trimestre: 4, moisZeroBase: 0, jour: 31, anneeSuivante: true },
];
function echeanceTrimestrielleInpp(annee, moisZeroBase) {
    const mois = new Date(Date.UTC(annee, moisZeroBase, 1));
    const e = exports.ECHEANCES_TRIMESTRIELLES_INPP[Math.floor(mois.getUTCMonth() / 3)];
    return new Date(Date.UTC(mois.getUTCFullYear() + (e.anneeSuivante ? 1 : 0), e.moisZeroBase, e.jour));
}
function prochaineEcheanceInpp(reference) {
    for (let annee = reference.getUTCFullYear() - 1; annee <= reference.getUTCFullYear() + 1; annee++) {
        for (let mois = 0; mois < 12; mois += 3) {
            const echeance = echeanceTrimestrielleInpp(annee, mois);
            if (!(0, echeance_1.echeanceDepassee)(echeance, reference))
                return echeance;
        }
    }
    return echeanceTrimestrielleInpp(reference.getUTCFullYear() + 1, 0);
}
exports.RACINE_CHARGE_INPP = '6415';
exports.RACINE_CHARGE_ONEM = '6413';
const centimes = (v) => Math.round(v * 100) / 100;
const nombre = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
function ventilerInppOnem(montant, numeroCompte, chargesDeLEcriture) {
    if (numeroCompte.startsWith('4334'))
        return [{ part: 'INPP', montant }];
    if (numeroCompte.startsWith('4335'))
        return [{ part: 'ONEM', montant }];
    if (!numeroCompte.startsWith(inpp_onem_du_4428_1.RACINE_4428))
        return [{ part: 'NON_VENTILEE', montant }];
    const solde = (racine) => (chargesDeLEcriture ?? [])
        .filter((c) => c.compte?.numero?.startsWith(racine))
        .reduce((s, c) => s + nombre(c.debit) - nombre(c.credit), 0);
    const inpp = solde(exports.RACINE_CHARGE_INPP);
    const onem = solde(exports.RACINE_CHARGE_ONEM);
    const total = inpp + onem;
    const proportion = Math.abs(total) < 0.005 ? NaN : inpp / total;
    if (!Number.isFinite(proportion) || proportion < 0 || proportion > 1)
        return [{ part: 'NON_VENTILEE', montant }];
    const partInpp = centimes(montant * proportion);
    return [
        { part: 'ONEM', montant: centimes(montant - partInpp) },
        { part: 'INPP', montant: partInpp },
    ].filter((p) => Math.abs(p.montant) >= 0.005);
}
function lignesEcheancierInppOnem(mois, prochaineOnem, prochaineInpp) {
    const ligne = (part, periodicite, date, dela) => {
        const siennes = mois.filter((m) => dela(m) && m.echeance.getTime() <= date.getTime());
        return {
            part,
            periodicite,
            date,
            montantDu: centimes(siennes.reduce((s, m) => s + m.solde, 0)),
            moisEnRetard: new Set(siennes.filter((m) => m.enRetard).map((m) => m.mois)).size,
        };
    };
    return [
        ligne('ONEM', 'MENSUELLE', prochaineOnem, (m) => m.part === 'ONEM'),
        ligne('INPP', 'TRIMESTRIELLE', prochaineInpp, (m) => m.part !== 'ONEM'),
    ];
}
exports.RESERVE_IMPUTATION_INPP_ONEM = "Un reversement au 4428 ne dit pas s'il acquitte l'INPP ou l'ONEM. Le registre l'impute d'abord sur la dette échue, en commençant par l'échéance la plus ancienne, puis sur celles qui échoient ensuite · ordre emprunté par analogie au Code civil, Livre III, art. 154, qui vise les dettes envers un même créancier, alors que l'INPP et l'ONEM sont deux organismes. Le registre ne lit ni le bordereau qui dit à qui le versement est allé, ni l'intérêt que vous aviez à acquitter l'une plutôt que l'autre ; il lit l'ancienneté à l'échéance, et non à la naissance de la dette. Si votre versement visait une autre dette, la répartition affichée n'est pas la vôtre.";
function mentionNonVentilee(montantFc) {
    if (Math.abs(montantFc) < 0.005)
        return null;
    return (`INPP ET ONEM NON VENTILÉS · ${montantFc.toFixed(2)} FC portés à la dette de l'INPP et de l'ONEM ne se partagent pas entre les deux · leur écriture ne porte ni la charge de l'INPP (6415) ni celle de l'ONEM (6413). ` +
        "Ils sont datés à l'échéance trimestrielle de l'INPP, la plus tardive des deux, et aucun retard n'est affirmé avant elle. Passez la charge dans la même écriture pour que l'ONEM soit daté au 15 du mois suivant.");
}
exports.MAJORATION_RETARD_INPP = "MAJORATION DE RETARD · l'employeur qui ne verse pas aux échéances verse, en même temps que la cotisation, « une majoration du montant de celle-ci égale à 0,5 pour mille par jour de retard », à partir de la date où la cotisation devait être versée (ordonnance n° 84/186, art. 4). Le montant est un acte de l'INPP · ce registre ne le chiffre pas.";
exports.TAXATION_D_OFFICE_INPP = "TAXATION D'OFFICE · l'employeur qui ne produit pas la déclaration des rémunérations s'expose, après mise en demeure, à une taxation d'office calculée sur le salaire minimum légal le plus élevé (ordonnance n° 84/186, art. 6) ; à défaut de paiement, à une exécution forcée après une mise en demeure restée sans suite pendant trente jours (art. 7). Actes de l'INPP, jamais calculés ici.";
exports.FRACTION_MAXIMALE_REDUCTION_INPP = 0.25;
function motifRefusReductionInpp(tauxPourCent, reductionPoints) {
    if (!Number.isFinite(reductionPoints) || reductionPoints <= 0) {
        return 'La réduction du taux INPP déclarée doit être un nombre de points strictement positif.';
    }
    const plafond = tauxPourCent * exports.FRACTION_MAXIMALE_REDUCTION_INPP;
    if (reductionPoints - plafond > 1e-9) {
        return (`La réduction du taux INPP déclarée (${reductionPoints} point(s)) dépasse le quart du taux applicable (${tauxPourCent} %, soit ${centimes(plafond * 1000) / 1000} point(s) au plus) · ` +
            "« en aucun cas, la réduction accordée ne pourra être supérieure au quart du taux de la cotisation » (ordonnance n° 84/186, art. 1er, al. 2). Vérifiez l'acte qui l'accorde.");
    }
    return null;
}
const reserveReductionInpp = (reductionPoints, reference, tauxBareme) => `RÉDUCTION DÉCLARÉE · taux du barème ${tauxBareme} %, réduit de ${reductionPoints} point(s) par l'acte « ${reference} » (ordonnance n° 84/186, art. 1er, al. 2 · employeur qui assure lui-même la formation de son personnel, réduction au plus du quart du taux).`;
exports.reserveReductionInpp = reserveReductionInpp;
//# sourceMappingURL=inpp-trimestriel.js.map