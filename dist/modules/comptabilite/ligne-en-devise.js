"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.porteUneDevise = porteUneDevise;
exports.contrevaleur = contrevaleur;
exports.contrevaleurAdmise = contrevaleurAdmise;
exports.motifRefusLigneEnDevise = motifRefusLigneEnDevise;
exports.coursDeLaLigne = coursDeLaLigne;
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const TOLERANCE = 0.01;
const DEMI_UNITE_DU_COURS = 0.5e-6;
function porteUneDevise(l) {
    return (l.deviseId ?? null) !== null || (l.montantDevise ?? null) !== null || (l.coursApplique ?? null) !== null;
}
function montantEnTenue(l) {
    return Math.abs(Number(l.debit ?? 0) - Number(l.credit ?? 0));
}
function contrevaleur(montantDevise, cours) {
    return Math.round(montantDevise * cours * 100) / 100;
}
function contrevaleurAdmise(montantDevise, cours, francs) {
    return Math.abs(contrevaleur(montantDevise, cours) - francs) <= TOLERANCE + montantDevise * DEMI_UNITE_DU_COURS;
}
function motifRefusLigneEnDevise(l, devise) {
    if (!porteUneDevise(l))
        return null;
    if (!l.deviseId)
        return 'Une ligne qui porte un montant en devise ou un cours nomme aussi sa devise.';
    if (!devise)
        return 'Devise introuvable pour ce dossier.';
    if (devise.code.toUpperCase() === monnaie_de_tenue_1.MONNAIE_DE_TENUE) {
        return `${monnaie_de_tenue_1.MONNAIE_DE_TENUE} est la monnaie de tenue · une ligne en francs ne porte ni devise ni cours.`;
    }
    const m = l.montantDevise ?? null;
    if (m === null || !Number.isFinite(Number(m)) || Number(m) <= 0) {
        return `La ligne en ${devise.code} porte son montant en devise, positif · le sens est celui de la ligne.`;
    }
    const francs = montantEnTenue(l);
    if (francs <= 0)
        return `La ligne en ${devise.code} porte aussi son montant en monnaie de tenue.`;
    const c = l.coursApplique ?? null;
    if (c !== null) {
        if (!Number.isFinite(Number(c)) || Number(c) <= 0)
            return `Le cours de la ligne en ${devise.code} doit être positif.`;
        const attendu = contrevaleur(Number(m), Number(c));
        if (!contrevaleurAdmise(Number(m), Number(c), francs)) {
            return (`${Number(m)} ${devise.code} au cours de ${Number(c)} font ${attendu} ${monnaie_de_tenue_1.MONNAIE_DE_TENUE}, ` +
                `et la ligne porte ${francs}. Le montant d'une ligne en devise est sa contrevaleur au cours appliqué (AUDCIF art. 52).`);
        }
    }
    return null;
}
function coursDeLaLigne(l) {
    if (!l.deviseId || !l.montantDevise)
        return undefined;
    if (l.coursApplique !== null && l.coursApplique !== undefined)
        return Number(l.coursApplique);
    return Math.round((montantEnTenue(l) / Number(l.montantDevise)) * 1e6) / 1e6;
}
//# sourceMappingURL=ligne-en-devise.js.map