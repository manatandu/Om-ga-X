"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLES_NON_SAISISSEURS = exports.CRITERES_ISA_240 = exports.SEUILS_ISA_240 = void 0;
const client_1 = require("@prisma/client");
exports.SEUILS_ISA_240 = {
    joursFinDePeriode: 7,
    longueurLibelleCourt: 12,
    pasMontantRond: 1_000_000,
    planckMontantRond: 1_000_000,
    mouvementsCompteRare: 2,
};
exports.CRITERES_ISA_240 = [
    {
        cle: 'FIN_DE_PERIODE',
        source: 'ISA 240, § 33 a) ii) · exigence',
        titre: 'Écritures de fin de période',
        citation: "sélectionner des écritures de journal et d'autres ajustements effectués à la fin de la période",
        mesure: `écritures datées des ${exports.SEUILS_ISA_240.joursFinDePeriode} derniers jours de l'exercice`,
    },
    {
        cle: 'SAISIE_APRES_CLOTURE',
        source: 'ISA 240, § A44 c)',
        titre: 'Saisies après la date de clôture',
        citation: 'inscrites en fin de période ou après la date de clôture',
        mesure: "écritures dont la date de SAISIE est postérieure au dernier jour de l'exercice · " +
            "l'écart entre la date comptable et la date de saisie est ce que l'AUDCIF art. 22, 4° " +
            'appelle la date de valeur, « mentionnée distinctement »',
    },
    {
        cle: 'SANS_JUSTIFICATION',
        source: 'ISA 240, § A44 c)',
        titre: 'Peu ou pas de justification',
        citation: 'avec peu ou pas de justification ou de description',
        mesure: `libellé vide ou de moins de ${exports.SEUILS_ISA_240.longueurLibelleCourt} caractères, ` +
            'ou écriture sans référence de pièce justificative',
    },
    {
        cle: 'AUTEUR_INATTENDU',
        source: 'ISA 240, § A44 b)',
        titre: "Passées par une personne qui n'est pas censée en passer",
        citation: "passées par des personnes qui ne sont pas censées enregistrer d'écritures",
        mesure: "écritures dont l'auteur n'a pas le rôle Comptable · un administrateur du cabinet peut " +
            "techniquement saisir, et c'est précisément le cas que la norme nomme",
    },
    {
        cle: 'MONTANT_ROND',
        source: 'ISA 240, § A44 e)',
        titre: 'Chiffres ronds',
        citation: 'comportant des chiffres ronds ou qui se terminent invariablement par les mêmes chiffres',
        mesure: `écritures d'au moins ${exports.SEUILS_ISA_240.planckMontantRond.toLocaleString('fr-FR')} dont le total ` +
            `est exactement multiple de ${exports.SEUILS_ISA_240.pasMontantRond.toLocaleString('fr-FR')}`,
    },
    {
        cle: 'COMPTE_RARE',
        source: 'ISA 240, § A44 a)',
        titre: 'Comptes rarement utilisés',
        citation: 'enregistrées dans des comptes sans lien entre eux, inhabituels ou rarement utilisés',
        mesure: `écritures touchant un compte mouvementé au plus ${exports.SEUILS_ISA_240.mouvementsCompteRare} fois ` +
            "sur l'exercice · le « sans lien entre eux » relève du jugement, pas de la requête",
    },
];
exports.ROLES_NON_SAISISSEURS = [
    client_1.RoleUtilisateur.ADMIN_CABINET,
    client_1.RoleUtilisateur.LECTURE_SEULE,
];
//# sourceMappingURL=test-ecritures-journal.js.map