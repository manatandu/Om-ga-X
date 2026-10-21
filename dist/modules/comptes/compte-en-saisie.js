"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_OPTION_FERMEE = void 0;
exports.collectifDeTiers = collectifDeTiers;
exports.motifRefusCompteEnSaisie = motifRefusCompteEnSaisie;
const client_1 = require("@prisma/client");
const collectifs_tiers_1 = require("../tiers/collectifs-tiers");
exports.MOTIF_OPTION_FERMEE = "La création d'un compte pendant la saisie n'est pas ouverte dans ce dossier · l'administrateur l'ouvre dans " +
    'Paramètres du dossier, ou personnalise le compte dans Plan comptable.';
function collectifDeTiers(referentiel, numeroDuPlan) {
    for (const panoplie of Object.values(collectifs_tiers_1.PANOPLIES_TIERS[referentiel])) {
        for (const c of panoplie ?? [])
            if (c.collectif === numeroDuPlan)
                return c.collectif;
    }
    return null;
}
function motifRefusCompteEnSaisie(p) {
    if (!/^\d+$/.test(p.numero))
        return 'Le numéro de compte se compose de chiffres seuls.';
    if (p.existe) {
        return (`Le compte ${p.numero} existe déjà dans ce dossier · choisissez-le dans la liste ; s'il n'y est pas, ` +
            "l'administrateur le personnalise dans Plan comptable.");
    }
    if (p.numero.length > p.longueurCompte) {
        return (`Le numéro ${p.numero} dépasse la longueur des comptes de ce dossier (${p.longueurCompte} chiffres) · ` +
            'Structure > Paramètres du dossier.');
    }
    if (p.numeroDuPlan === null) {
        return (`Le numéro ${p.numero} ne subdivise aucun compte d'imputation du plan · un compte créé en saisie s'ouvre ` +
            "sous un compte d'imputation du plan officiel (tapez son numéro suivi du rang voulu).");
    }
    if (p.compteDuPlan === null) {
        return `Le compte du plan ${p.numeroDuPlan}, que ce numéro subdiviserait, n'existe plus dans ce dossier · Plan comptable.`;
    }
    if (p.compteDuPlan.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
        return `Le compte du plan ${p.numeroDuPlan} n'est pas un compte d'imputation dans ce dossier · Plan comptable.`;
    }
    if (!p.compteDuPlan.estActif) {
        return (`Le compte du plan ${p.numeroDuPlan} est en sommeil · l'administrateur le réactive dans Plan comptable avant ` +
            "qu'un sous-compte s'ouvre sous lui.");
    }
    const collectif = collectifDeTiers(p.referentiel, p.numeroDuPlan);
    if (collectif) {
        return (`Le numéro ${p.numero} se rangerait sous le collectif ${collectif} des tiers · le compte d'un tiers naît avec ` +
            'sa fiche (Structure > Plan tiers), qui le rattache à son collectif.');
    }
    return null;
}
//# sourceMappingURL=compte-en-saisie.js.map