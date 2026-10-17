"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.racinesContrepartieAcquisition = racinesContrepartieAcquisition;
exports.contrepartieAcquisitionAdmise = contrepartieAcquisitionAdmise;
exports.motifRefusContrepartie = motifRefusContrepartie;
const client_1 = require("@prisma/client");
const TRESORERIE = ['52', '53', '55', '57'];
const FOURNISSEURS_INCORPORELS = {
    [client_1.Referentiel.SYSCOHADA]: ['4811', '4816', '4818', '4821'],
    [client_1.Referentiel.SYCEBNL]: ['4811', '48161', '48181', '4821'],
};
const FOURNISSEURS_CORPORELS = {
    [client_1.Referentiel.SYSCOHADA]: ['4812', '4816', '4818', '4822'],
    [client_1.Referentiel.SYCEBNL]: ['4812', '48162', '48182', '4822'],
};
const PROPRES = {
    [client_1.Referentiel.SYSCOHADA]: ['101', '102', '103', '104', '46', '72'],
    [client_1.Referentiel.SYCEBNL]: ['101', '102', '104', '162', '163', '164', '165', '167', '45'],
};
function racinesDeLaFiche(referentiel, compte, options) {
    const division = compte.slice(0, 2);
    const ajouts = [];
    const enCours = `${division}9`;
    const enCoursAdmis = referentiel === client_1.Referentiel.SYSCOHADA ? ['21', '22', '23', '24'] : ['23', '24'];
    if (enCoursAdmis.includes(division) && !compte.startsWith(enCours))
        ajouts.push(enCours);
    if (['21', '22', '23', '24'].includes(division))
        ajouts.push(division === '21' ? '251' : '252');
    if (division === '26' || division === '27')
        ajouts.push('4813');
    if (referentiel === client_1.Referentiel.SYSCOHADA) {
        if (options.typeComposant === client_1.TypeComposant.DEMANTELEMENT && !options.systemeMinimal)
            ajouts.push('1984');
        if (!compte.startsWith('2128'))
            ajouts.push('14');
        if (compte.startsWith('231') && !compte.startsWith('2316'))
            ajouts.push('841');
    }
    else {
        if (options.typeComposant === client_1.TypeComposant.DEMANTELEMENT && !options.systemeMinimal)
            ajouts.push('1984');
        ajouts.push('14');
        if (division === '20')
            ajouts.push(compte.startsWith('2011') ? '171' : '172');
        if (compte.startsWith('231') && !compte.startsWith('2316'))
            ajouts.push('8410');
        if (['21', '23', '24'].includes(division))
            ajouts.push('72');
    }
    return ajouts;
}
function racinesContrepartieAcquisition(referentiel, compteImmobilisation, options = {}) {
    const incorporel = compteImmobilisation.startsWith('21');
    const fournisseurs = incorporel ? [...FOURNISSEURS_INCORPORELS[referentiel]] : [...FOURNISSEURS_CORPORELS[referentiel]];
    if (referentiel === client_1.Referentiel.SYSCOHADA)
        fournisseurs.push(...(incorporel ? ['4041', '4046'] : ['4042', '4047']));
    return [
        ...PROPRES[referentiel],
        ...fournisseurs,
        ...TRESORERIE,
        ...racinesDeLaFiche(referentiel, compteImmobilisation, options),
    ];
}
function contrepartieAcquisitionAdmise(referentiel, compteImmobilisation, contrepartie, options = {}) {
    return racinesContrepartieAcquisition(referentiel, compteImmobilisation, options).some((r) => contrepartie.startsWith(r));
}
function motifRefusContrepartie(referentiel, compteImmobilisation, contrepartie, options = {}) {
    if (contrepartieAcquisitionAdmise(referentiel, compteImmobilisation, contrepartie, options))
        return null;
    if (referentiel === client_1.Referentiel.SYSCOHADA && compteImmobilisation.startsWith('2128') && contrepartie.startsWith('14')) {
        return ("Un droit d'exclusivité public reçu à titre gratuit n'entre pas à l'actif · « Par prudence, le Système " +
            "comptable OHADA considère que les droits publics acquis à titre gratuit ont une valeur nulle » (AUDCIF, " +
            'Titre VIII ch. 2 § 1.3.2).');
    }
    const division = compteImmobilisation.slice(0, 2);
    const fiche = referentiel === client_1.Referentiel.SYSCOHADA
        ? `AUDCIF, Titre VII, fiche du compte ${division}`
        : `SYCEBNL, Partie 2 ch. 3, fiche du compte ${division}`;
    const racines = racinesContrepartieAcquisition(referentiel, compteImmobilisation, options);
    return (`Le compte ${contrepartie} n'est pas une contrepartie d'acquisition admise pour un bien au ${compteImmobilisation} · ` +
        `${fiche}. Racines admises : ${racines.join(', ')}.`);
}
//# sourceMappingURL=contrepartie-acquisition.js.map