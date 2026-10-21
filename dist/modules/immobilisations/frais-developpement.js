"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRITERES_FRAIS_DEVELOPPEMENT = void 0;
exports.estFraisDeveloppement = estFraisDeveloppement;
exports.motifRefusFraisDeveloppement = motifRefusFraisDeveloppement;
exports.criteresRetenus = criteresRetenus;
exports.CRITERES_FRAIS_DEVELOPPEMENT = [
    {
        cle: 'FAISABILITE_TECHNIQUE',
        rang: 1,
        libelle: "la faisabilité technique nécessaire à l'achèvement de l'immobilisation incorporelle en vue de sa mise en service ou de sa vente",
    },
    {
        cle: 'INTENTION',
        rang: 2,
        libelle: "son intention d'achever l'immobilisation incorporelle et de l'utiliser ou de la vendre",
    },
    { cle: 'CAPACITE', rang: 3, libelle: "sa capacité à utiliser ou à vendre l'immobilisation incorporelle" },
    {
        cle: 'AVANTAGES_ECONOMIQUES',
        rang: 4,
        libelle: "la façon dont l'immobilisation incorporelle générera des avantages économiques futurs probables",
    },
    {
        cle: 'RESSOURCES',
        rang: 5,
        libelle: "la disponibilité de ressources techniques, financières et autres, appropriées pour achever le développement et utiliser ou vendre l'immobilisation incorporelle",
    },
    {
        cle: 'EVALUATION_FIABLE',
        rang: 6,
        libelle: "sa capacité à évaluer de manière fiable les dépenses attribuables à l'immobilisation incorporelle au cours de son développement",
    },
];
const SOURCE = 'AUDCIF, Titre VIII ch. 1 § 2.1.1 et fiche du compte 211';
function estFraisDeveloppement(referentiel, numeroCompte) {
    return referentiel === 'SYSCOHADA' && numeroCompte.startsWith('211');
}
function motifRefusFraisDeveloppement(i) {
    const concerne = estFraisDeveloppement(i.referentiel, i.numeroCompte);
    const declares = i.criteres ?? {};
    const donnes = Object.values(declares).some((v) => typeof v === 'string' && v.trim());
    if (!concerne) {
        if (donnes || i.dateReunion) {
            return i.referentiel === 'SYCEBNL'
                ? "Les six critères des frais de développement ne visent que le compte 211 du SYSCOHADA · le plan SYCEBNL n'ouvre aucun 211."
                : 'Les six critères des frais de développement ne visent que le compte 211.';
        }
        return null;
    }
    if (i.repris && !donnes && !i.dateReunion)
        return null;
    for (const c of exports.CRITERES_FRAIS_DEVELOPPEMENT) {
        const j = declares[c.cle];
        if (typeof j !== 'string' || !j.trim()) {
            return (`Critère ${c.rang} non démontré · ${c.libelle}. Les six critères sont exigés simultanément ; « à défaut, ces ` +
                `dépenses constituent des charges » (${SOURCE}). Justifiez chacun par écrit, ou laissez la dépense en charges.`);
        }
    }
    if (!i.dateReunion) {
        return ("Indiquez la date à partir de laquelle les six critères sont réunis · les frais ne s'immobilisent qu'à compter " +
            "de cette date (AUDCIF, Titre VIII ch. 1 § 3.1).");
    }
    if (!i.repris && i.dateInscription < i.dateReunion) {
        return (`Inscription datée avant la réunion des six critères (${i.dateReunion.toISOString().slice(0, 10)}) · « les ` +
            'dépenses comptabilisées en charges antérieurement à la date d\'activation ne peuvent plus être activées » ' +
            '(AUDCIF, Titre VIII ch. 1 § 3.1).');
    }
    return null;
}
function criteresRetenus(criteres) {
    if (!criteres)
        return null;
    const sortie = {};
    for (const c of exports.CRITERES_FRAIS_DEVELOPPEMENT) {
        const j = criteres[c.cle];
        if (typeof j === 'string' && j.trim())
            sortie[c.cle] = j.trim().slice(0, 1000);
    }
    return Object.keys(sortie).length ? sortie : null;
}
//# sourceMappingURL=frais-developpement.js.map