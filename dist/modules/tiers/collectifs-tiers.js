"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIFS_TIERS = exports.PANOPLIES_TIERS = void 0;
exports.panoplieDuTiers = panoplieDuTiers;
exports.numeroCollectif = numeroCollectif;
exports.racineCollectif = racineCollectif;
exports.prochainNumeroIndividuel = prochainNumeroIndividuel;
exports.numeroIndividuelAligne = numeroIndividuelAligne;
exports.rangSousRacine = rangSousRacine;
exports.motifRefusNumeroChoisi = motifRefusNumeroChoisi;
exports.regrouperSurCollectifs = regrouperSurCollectifs;
const client_1 = require("@prisma/client");
const p = (role, collectif, libelle) => ({ role, collectif, libelle });
const PANOPLIE_FOURNISSEUR = [
    p('PRINCIPAL', '40110000', null),
    p('FACTURES_NON_PARVENUES', '40810000', 'factures non parvenues'),
    p('AVANCES_VERSEES', '40910000', 'avances et acomptes versés'),
];
exports.PANOPLIES_TIERS = {
    [client_1.Referentiel.SYCEBNL]: {
        [client_1.TypeTiers.FOURNISSEUR]: PANOPLIE_FOURNISSEUR,
        [client_1.TypeTiers.ADHERENT]: [
            p('PRINCIPAL', '41100000', null),
            p('A_ETABLIR', '41810000', 'appels de fonds à établir'),
            p('AVANCES_RECUES', '41910000', 'avances reçues'),
            p('LITIGIEUSES_OU_DOUTEUSES', '41610000', 'cotisations litigieuses ou douteuses'),
        ],
        [client_1.TypeTiers.CLIENT]: [
            p('PRINCIPAL', '41200000', null),
            p('A_ETABLIR', '41820000', 'factures à établir'),
            p('AVANCES_RECUES', '41920000', 'avances et acomptes reçus'),
            p('LITIGIEUSES_OU_DOUTEUSES', '41620000', 'créances litigieuses ou douteuses'),
        ],
    },
    [client_1.Referentiel.SYSCOHADA]: {
        [client_1.TypeTiers.FOURNISSEUR]: PANOPLIE_FOURNISSEUR,
        [client_1.TypeTiers.CLIENT]: [
            p('PRINCIPAL', '41110000', null),
            p('A_ETABLIR', '41810000', 'factures à établir'),
            p('AVANCES_RECUES', '41910000', 'avances et acomptes reçus'),
            p('LITIGIEUSES', '41610000', 'créances litigieuses'),
            p('DOUTEUSES', '41620000', 'créances douteuses'),
        ],
    },
};
function panoplieDuTiers(referentiel, type) {
    return exports.PANOPLIES_TIERS[referentiel][type] ?? [];
}
exports.COLLECTIFS_TIERS = {
    [client_1.Referentiel.SYCEBNL]: principaux(client_1.Referentiel.SYCEBNL),
    [client_1.Referentiel.SYSCOHADA]: principaux(client_1.Referentiel.SYSCOHADA),
};
function principaux(referentiel) {
    const sortie = {};
    for (const [type, panoplie] of Object.entries(exports.PANOPLIES_TIERS[referentiel])) {
        if (panoplie?.[0])
            sortie[type] = panoplie[0].collectif;
    }
    return sortie;
}
function numeroCollectif(referentiel, type) {
    return exports.COLLECTIFS_TIERS[referentiel][type] ?? null;
}
function racineCollectif(numero) {
    return numero.replace(/0+$/, '');
}
function prochainNumeroIndividuel(racine, longueur, existants) {
    const largeur = longueur - racine.length;
    if (largeur < 1)
        return null;
    const pris = new Set(existants.filter((n) => n.length === longueur && n.startsWith(racine)));
    const max = 10 ** largeur - 1;
    for (let i = 1; i <= max; i++) {
        const numero = racine + String(i).padStart(largeur, '0');
        if (!pris.has(numero))
            return numero;
    }
    return null;
}
function numeroIndividuelAligne(racine, longueur, rang, existants) {
    const largeur = longueur - racine.length;
    if (rang !== null && largeur >= 1 && rang >= 1 && rang < 10 ** largeur) {
        const numero = racine + String(rang).padStart(largeur, '0');
        if (!existants.includes(numero))
            return numero;
    }
    return prochainNumeroIndividuel(racine, longueur, existants);
}
function rangSousRacine(numero, racine) {
    if (!numero.startsWith(racine) || numero.length <= racine.length)
        return null;
    const rang = Number(numero.slice(racine.length));
    return Number.isInteger(rang) && rang >= 1 ? rang : null;
}
function motifRefusNumeroChoisi(numero, collectif, longueur, referentiel) {
    const racine = racineCollectif(collectif);
    if (!/^\d+$/.test(numero)) {
        const source = referentiel === client_1.Referentiel.SYCEBNL
            ? 'SYCEBNL, Partie 2 ch. 2, section 1'
            : 'AUDCIF art. 18 et Titre VII';
        return (`Le numéro de compte « ${numero} » ne doit porter que des chiffres · la codification des comptes est décimale ` +
            `(${source}). Le code du tiers l'identifie déjà.`);
    }
    if (!numero.startsWith(racine)) {
        return (`Le numéro ${numero} ne commence pas par ${racine}, racine du collectif ${collectif} de ce type de tiers · ` +
            'le compte d\'un tiers est une subdivision de son collectif.');
    }
    if (numero.length !== longueur) {
        return (`Le numéro ${numero} compte ${numero.length} chiffres, et les comptes de ce dossier en comptent ${longueur} ` +
            '(Structure > Paramètres du dossier).');
    }
    if (rangSousRacine(numero, racine) === null) {
        return `Le numéro ${numero} ne se distingue pas du collectif ${collectif} · ajoutez un rang après ${racine}.`;
    }
    return null;
}
function regrouperSurCollectifs(lignes, collectifDe) {
    const sortie = new Map();
    const CHAMPS = ['totalDebit', 'totalCredit', 'reportDebit', 'reportCredit', 'mouvementDebit', 'mouvementCredit', 'solde'];
    for (const l of lignes) {
        const collectif = collectifDe.get(l.compteId);
        const cle = collectif?.id ?? l.compteId;
        const existant = sortie.get(cle);
        if (!existant) {
            sortie.set(cle, collectif
                ? { ...l, compteId: collectif.id, numero: collectif.numero, intitule: collectif.intitule, regroupe: 1 }
                : { ...l, regroupe: 0 });
            continue;
        }
        for (const c of CHAMPS)
            existant[c] += l[c];
        if (collectif)
            existant.regroupe += 1;
    }
    return [...sortie.values()].sort((a, b) => a.numero.localeCompare(b.numero));
}
//# sourceMappingURL=collectifs-tiers.js.map