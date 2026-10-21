"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENVOIS_PLAN_SYSCOHADA = void 0;
exports.renvoisDuPlanSyscohada = renvoisDuPlanSyscohada;
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
exports.RENVOIS_PLAN_SYSCOHADA = {
    1: "Pièces, barres, lingots, louis d'or et autres métaux précieux (argent, diamant…) acquis et que l'entité a l'intention de conserver de manière durable.",
    2: 'Le terme « associés » englobe les « actionnaires » et les « membres ».',
    3: 'Créer des sous-comptes distinguant les immobilisations corporelles des incorporelles.',
    4: "Pièces, barres, louis d'or et autres métaux précieux (argent, diamant…) acquis en vue d'une cession à court terme. Ils jouent donc le rôle d'instruments de trésorerie.",
    5: "À l'exception des achats effectués avec les entités du groupe.",
    6: "L'entité peut créer des sous-comptes pour les frais accessoires : douane, fret, assurance sur achats, commissions, courtages sur achats, frais de transit, et autres frais accessoires.",
    7: "À l'exclusion des ventes faites à des entités du groupe.",
    8: "À inscrire au compte 706 si ces produits correspondent à une activité principale de l'entité.",
    9: "En cas d'offre publique d'échange (OPE) ou d'achat (OPA) notamment.",
    10: "Cas de révision de plan d'amortissement.",
};
const MARQUEUR = /\[(\d+)\]/;
function renvoisDuPlanSyscohada() {
    const resultat = [];
    for (const ligne of compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA) {
        const m = MARQUEUR.exec(ligne.intitule);
        if (!m)
            continue;
        const renvoi = Number(m[1]);
        const texte = exports.RENVOIS_PLAN_SYSCOHADA[renvoi];
        if (texte)
            resultat.push({ numero: ligne.numero, renvoi, texte });
    }
    return resultat;
}
//# sourceMappingURL=renvois-plan-syscohada.js.map