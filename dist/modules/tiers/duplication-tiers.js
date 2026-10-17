"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copieDuTiers = copieDuTiers;
const COPIEES = ['qualite', 'adresse', 'boitePostale', 'ville', 'pays', 'telephone', 'email', 'contact'];
function copieDuTiers(t, decomptes) {
    const corps = { type: t.type, code: '', nom: t.nom };
    for (const c of COPIEES) {
        const v = t[c];
        if (v)
            corps[c] = v;
    }
    const nonRepris = [
        { champ: 'Code', motif: 'unique dans le dossier · à saisir' },
        { champ: 'Comptes', motif: 'le nouveau tiers ouvre les siens sous son collectif' },
    ];
    if (t.modeleReglement?.estActif)
        corps.modeleReglementId = t.modeleReglement.id;
    else if (t.modeleReglement)
        nonRepris.push({ champ: 'Modèle de règlement', motif: 'en sommeil' });
    if (t.modeleReglement?.estActif && t.validationAutomatiqueEcheances)
        corps.validationAutomatiqueEcheances = true;
    if (t.modeReglement?.estActif)
        corps.modeReglementId = t.modeReglement.id;
    else if (t.modeReglement)
        nonRepris.push({ champ: 'Mode de règlement', motif: 'en sommeil' });
    for (const c of ['modeleImpressionExtraitId', 'modeleImpressionReglementId', 'modeleImpressionRappelId']) {
        const v = t[c];
        if (v)
            corps[c] = v;
    }
    if (t.numeroImpot)
        nonRepris.push({ champ: 'Numéro Impôt', motif: 'identifiant propre à chaque contribuable' });
    if (decomptes.ribs > 0)
        nonRepris.push({ champ: 'Coordonnées bancaires', motif: 'un RIB recopié ferait payer le mauvais tiers' });
    if (decomptes.documents > 0)
        nonRepris.push({ champ: 'Documents', motif: 'pièces de l’autre tiers' });
    if (decomptes.lieux > 0)
        nonRepris.push({ champ: 'Lieux de livraison', motif: 'adresses de l’autre client' });
    if (t.celluleGroupeId)
        nonRepris.push({ champ: 'Cellule du groupe', motif: 'rattachement propre à ce tiers' });
    if (t.autoriseTvaDebits)
        nonRepris.push({ champ: 'Autorisation aux débits', motif: 'décision nominative du Directeur Général des Impôts' });
    if (t.horsRelance)
        nonRepris.push({ champ: 'Exclusion des relances', motif: 'motif propre à ce tiers' });
    return { origine: t.code, corps, nonRepris };
}
//# sourceMappingURL=duplication-tiers.js.map