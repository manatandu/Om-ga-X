"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_COUPURES = exports.PLAFOND_LIGNES_PAIEMENT = exports.MODES_PAIEMENT = void 0;
exports.motifRefusJournalDuPaiement = motifRefusJournalDuPaiement;
exports.motifRefusCoupures = motifRefusCoupures;
exports.billetage = billetage;
exports.billetageDuPaiement = billetageDuPaiement;
exports.echeanceArticle99 = echeanceArticle99;
exports.resteAPayer = resteAPayer;
exports.motifRefusReferencesCheques = motifRefusReferencesCheques;
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
exports.MODES_PAIEMENT = {
    VIREMENT: { libelle: 'Virement', caisse: false },
    CHEQUE: { libelle: 'Chèque', caisse: false },
    ESPECES: { libelle: 'Espèces', caisse: true },
};
exports.PLAFOND_LIGNES_PAIEMENT = 500;
exports.PLAFOND_COUPURES = 20;
const centimes = (n) => Math.round(n * 100);
const auCentime = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
function motifRefusJournalDuPaiement(mode, journal, deviseDuRib) {
    if (!journal)
        return 'Journal introuvable pour ce dossier.';
    if (journal.type !== 'TRESORERIE') {
        return `Le journal ${journal.code} n'est pas un journal de banque ou de caisse · un salaire versé crédite un compte de trésorerie (fiche du compte 42).`;
    }
    if (!journal.estActif)
        return `Le journal ${journal.code} est en sommeil · réactivez-le avant d'y payer des salaires.`;
    if (!journal.compteTresorerie)
        return `Le journal ${journal.code} n'a pas de compte de trésorerie · rattachez-lui son compte dans Journaux.`;
    const caisse = journal.compteTresorerie.numero.startsWith('57');
    if (exports.MODES_PAIEMENT[mode].caisse && !caisse) {
        return `Un paiement en espèces sort d'une caisse (compte 57, « paiement effectué en espèces ») · le journal ${journal.code} porte le compte ${journal.compteTresorerie.numero}.`;
    }
    if (!exports.MODES_PAIEMENT[mode].caisse && caisse) {
        return `Un ${exports.MODES_PAIEMENT[mode].libelle.toLowerCase()} ne sort pas d'une caisse · le journal ${journal.code} porte le compte ${journal.compteTresorerie.numero}, choisissez un journal de banque.`;
    }
    const devise = (deviseDuRib ?? '').trim().toUpperCase();
    if (devise && devise !== monnaie_de_tenue_1.MONNAIE_DE_TENUE) {
        return `Le journal ${journal.code} est tenu en ${devise} · les nets des bulletins sont en ${monnaie_de_tenue_1.MONNAIE_DE_TENUE}. Payez depuis un compte en ${monnaie_de_tenue_1.MONNAIE_DE_TENUE}, ou passez le paiement à la main avec le montant en devise et le cours.`;
    }
    return null;
}
function motifRefusCoupures(coupures) {
    if (coupures.length === 0)
        return 'Déclarez au moins une coupure pour ventiler les espèces.';
    if (coupures.length > exports.PLAFOND_COUPURES)
        return `Au plus ${exports.PLAFOND_COUPURES} coupures.`;
    for (const c of coupures) {
        if (!Number.isFinite(c) || c <= 0)
            return 'Une coupure est une valeur faciale strictement positive.';
        if (!auCentime(c))
            return `La coupure ${c} n'est pas au centime.`;
    }
    if (new Set(coupures.map(centimes)).size !== coupures.length)
        return 'Une coupure est déclarée deux fois.';
    return null;
}
function billetage(montant, coupures) {
    let reste = centimes(montant);
    const detail = [];
    for (const valeur of [...coupures].sort((a, b) => b - a)) {
        const v = centimes(valeur);
        const nombre = Math.floor(reste / v);
        if (nombre > 0) {
            detail.push({ valeur, nombre });
            reste -= nombre * v;
        }
    }
    return { detail, reste: reste / 100 };
}
function billetageDuPaiement(lignes, coupures) {
    const triees = [...coupures].sort((a, b) => b - a);
    const parSalarie = lignes.map((l) => ({ salarieId: l.salarieId, nomComplet: l.nomComplet, montant: l.montant, ...billetage(l.montant, triees) }));
    const totaux = triees
        .map((valeur) => ({ valeur, nombre: parSalarie.reduce((n, p) => n + (p.detail.find((d) => d.valeur === valeur)?.nombre ?? 0), 0) }))
        .filter((t) => t.nombre > 0);
    const resteTotal = parSalarie.reduce((n, p) => n + centimes(p.reste), 0) / 100;
    return { coupures: triees, parSalarie, totaux, resteTotal };
}
function echeanceArticle99(mois) {
    const [a, m] = mois.split('-').map(Number);
    const fin = Date.UTC(a, m, 0);
    return new Date(fin + 6 * 86_400_000).toISOString().slice(0, 10);
}
function resteAPayer(b) {
    const ecart = centimes(b.netAPayer) - centimes(b.dejaPayeAutres);
    return ecart >= 0 ? { montant: ecart / 100, tropPaye: 0 } : { montant: 0, tropPaye: -ecart / 100 };
}
function motifRefusReferencesCheques(references) {
    const manquants = references.filter((r) => !(r.reference ?? '').trim()).map((r) => r.nomComplet);
    if (manquants.length)
        return `Le numéro du chèque manque pour ${manquants.join(', ')} · un chèque se rapproche du relevé par son numéro.`;
    const vus = new Map();
    for (const r of references) {
        const n = r.reference.trim().toUpperCase();
        const deja = vus.get(n);
        if (deja)
            return `Le chèque n° ${r.reference.trim()} est donné à ${deja} et à ${r.nomComplet}.`;
        vus.set(n, r.nomComplet);
    }
    return null;
}
//# sourceMappingURL=paiement-salaires.js.map