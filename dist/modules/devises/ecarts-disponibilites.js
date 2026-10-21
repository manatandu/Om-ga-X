"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVERTISSEMENT_INTEGRALE = exports.LIBELLE_INTEGRALE = exports.MOTIF_PARTAGE_IMPOSSIBLE = exports.RACINES_CHANGE_DISPONIBILITES = exports.RACINES_DISPONIBILITES = void 0;
exports.estDisponibilite = estDisponibilite;
exports.partagerLignesDEcarts = partagerLignesDEcarts;
exports.ecartsDisponibilitesEnregistres = ecartsDisponibilitesEnregistres;
exports.ventilerEcartPasse = ventilerEcartPasse;
exports.motifRefusVentilationDeclaree = motifRefusVentilationDeclaree;
exports.RACINES_DISPONIBILITES = /^(52|53|55|57|58)/;
function estDisponibilite(numero) {
    return exports.RACINES_DISPONIBILITES.test(numero);
}
exports.RACINES_CHANGE_DISPONIBILITES = { perte: '676', gain: '776' };
function estContrepartieDeDisponibilite(numero) {
    return numero.startsWith(exports.RACINES_CHANGE_DISPONIBILITES.perte) || numero.startsWith(exports.RACINES_CHANGE_DISPONIBILITES.gain);
}
const EPSILON = 0.005;
const solde = (lignes) => lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0);
exports.MOTIF_PARTAGE_IMPOSSIBLE = "L'écriture des écarts de cette réévaluation ne se sépare pas en deux parts équilibrées · d'un côté les disponibilités " +
    "et leur 676 ou 776 (écart réalisé, AUDCIF art. 57, jamais contre-passé), de l'autre les créances et dettes et leur 478 " +
    "ou 479 (écart de conversion, art. 54, contre-passé à l'ouverture) · elle a été passée sous une règle antérieure ou " +
    "retouchée. Demandez la contre-passation INTÉGRALE (Devises, « Contre-passation intégrale ») · toute l'écriture est " +
    "contre-passée, comme avant A5 bis, et le libellé le dit ; la réévaluation suivante mesure alors la banque et la caisse " +
    'depuis leur coût historique.';
function partagerLignesDEcarts(lignes) {
    const realisees = lignes.filter((l) => estDisponibilite(l.compteNumero) || estContrepartieDeDisponibilite(l.compteNumero));
    const aContrePasser = lignes.filter((l) => !realisees.includes(l));
    const desequilibre = Math.abs(solde(realisees)) > EPSILON || Math.abs(solde(aContrePasser)) > EPSILON;
    return {
        aContrePasser,
        realisees,
        motifRefus: desequilibre ? exports.MOTIF_PARTAGE_IMPOSSIBLE : null,
    };
}
function ecartsDisponibilitesEnregistres(valeur) {
    if (!Array.isArray(valeur))
        return null;
    const sortie = [];
    for (const e of valeur) {
        if (!e || typeof e !== 'object')
            return null;
        const { compteId, deviseId, ecart } = e;
        if (typeof compteId !== 'string' || typeof deviseId !== 'string' || typeof ecart !== 'number' || !Number.isFinite(ecart))
            return null;
        sortie.push({ compteId, deviseId, ecart });
    }
    return sortie;
}
exports.LIBELLE_INTEGRALE = {
    EXERCICE_SUIVANT_ANCIEN_REGIME: 'exercice suivant réévalué sous l’ancien régime',
    PARTAGE_IMPOSSIBLE: 'écriture des écarts qui ne se partage pas',
};
exports.AVERTISSEMENT_INTEGRALE = {
    EXERCICE_SUIVANT_ANCIEN_REGIME: "Contre-passation INTÉGRALE, banque et caisse comprises · l'exercice suivant a été réévalué avant A5 bis, depuis le coût " +
        "historique de la banque et de la caisse ; leur garder l'écart de cette réévaluation le compterait deux fois. Le total de " +
        "l'exercice suivant est juste ; l'écart réalisé (AUDCIF art. 57) y paraît contre-passé puis repassé.",
    PARTAGE_IMPOSSIBLE: "Contre-passation INTÉGRALE demandée, banque et caisse comprises · l'écriture des écarts ne se partage pas. La " +
        "réévaluation suivante mesure la banque et la caisse depuis leur coût historique · le total est juste ; l'écart réalisé " +
        '(AUDCIF art. 57) paraît contre-passé puis repassé.',
};
const centimes = (x) => Math.round(x * 100) / 100;
function ventilerEcartPasse(compteId, passe, sommes, cours) {
    if (Math.abs(passe) < EPSILON)
        return [];
    const vivantes = sommes.filter((s) => Math.abs(s.devise) >= EPSILON || Math.abs(s.francs) >= EPSILON);
    if (vivantes.length === 0)
        return null;
    if (vivantes.length === 1)
        return [{ compteId, deviseId: vivantes[0].deviseId, ecart: centimes(passe) }];
    const recalcules = [];
    for (const s of vivantes) {
        const c = cours(s.deviseId);
        if (c === null)
            return null;
        recalcules.push({ compteId, deviseId: s.deviseId, ecart: centimes(centimes(s.devise * c) - s.francs) });
    }
    const somme = recalcules.reduce((t, e) => t + e.ecart, 0);
    if (Math.abs(somme - passe) > EPSILON)
        return null;
    return recalcules.filter((e) => Math.abs(e.ecart) >= EPSILON);
}
function motifRefusVentilationDeclaree(passeParCompte, ventilation, devisesDuDossier, source, sommesLues) {
    if (!source || source.trim().length < 3)
        return 'La source de la ventilation est obligatoire (pièce, relevé, calcul du cabinet).';
    if (passeParCompte.size === 0)
        return "Cette réévaluation n'a passé aucun écart sur une banque ou une caisse · il n'y a rien à ventiler.";
    const vues = new Set();
    const parCompte = new Map();
    for (const v of ventilation) {
        if (!passeParCompte.has(v.compteId))
            return "Un compte de la ventilation n'est pas une disponibilité réévaluée par cette écriture.";
        if (!devisesDuDossier.has(v.deviseId))
            return 'Une devise de la ventilation est introuvable pour ce dossier.';
        if (typeof v.ecart !== 'number' || !Number.isFinite(v.ecart))
            return 'Chaque écart se déclare en francs, montant signé (perte en négatif).';
        const cle = `${v.compteId}|${v.deviseId}`;
        if (vues.has(cle))
            return 'Une même devise est déclarée deux fois sur le même compte.';
        vues.add(cle);
        if (sommesLues) {
            const lue = vivantes(sommesLues.get(v.compteId) ?? []).find((x) => x.deviseId === v.deviseId);
            if (!lue)
                return "Une devise de la ventilation n'a pas été lue par la réévaluation sur ce compte · elle n'a reçu aucun écart.";
            const motif = motifMontantHorsBornes(lue, v.ecart);
            if (motif)
                return motif;
        }
        parCompte.set(v.compteId, (parCompte.get(v.compteId) ?? 0) + v.ecart);
    }
    if (sommesLues) {
        for (const compteId of passeParCompte.keys()) {
            for (const lue of vivantes(sommesLues.get(compteId) ?? [])) {
                if (!vues.has(`${compteId}|${lue.deviseId}`)) {
                    return 'Chaque devise lue par la réévaluation sur la banque ou la caisse se déclare, zéro compris.';
                }
            }
        }
    }
    for (const [compteId, passe] of passeParCompte) {
        const declare = parCompte.get(compteId);
        if (declare === undefined)
            return 'Chaque banque ou caisse de l’écriture doit être ventilée.';
        if (Math.abs(centimes(declare) - centimes(passe)) > EPSILON) {
            return `La ventilation d'un compte (${centimes(declare).toFixed(2)}) ne rend pas la ligne passée sur lui (${centimes(passe).toFixed(2)}).`;
        }
    }
    return null;
}
function vivantes(sommes) {
    return sommes.filter((s) => Math.abs(s.devise) >= EPSILON || Math.abs(s.francs) >= EPSILON);
}
function motifMontantHorsBornes(lue, ecart) {
    const valeur = centimes(lue.francs + ecart);
    if (Math.abs(lue.devise) < EPSILON) {
        return Math.abs(valeur) > EPSILON
            ? "Une devise soldée en devise valait zéro à la réévaluation · son écart est l'opposé de ses francs " +
                `(${centimes(-lue.francs).toFixed(2)}).`
            : null;
    }
    const memeSigne = lue.devise > 0 ? valeur > EPSILON : valeur < -EPSILON;
    return memeSigne
        ? null
        : "Un écart déclaré rendrait à une devise une valeur de signe contraire à son montant en devise · le cours d'une " +
            'monnaie est positif.';
}
//# sourceMappingURL=ecarts-disponibilites.js.map