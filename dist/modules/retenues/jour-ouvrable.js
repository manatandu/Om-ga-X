"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_JOUR_OUVRABLE = exports.RESERVE_ECHEANCES_SOCIALES = exports.JOURS_FERIES = void 0;
exports.jourFerie = jourFerie;
exports.estJourOuvrable = estJourOuvrable;
exports.reporterAuJourOuvrable = reporterAuJourOuvrable;
exports.echeanceDeReversement = echeanceDeReversement;
const DIMANCHE = 0;
const SAMEDI = 6;
const ENTREE_EN_VIGUEUR_DECRET_24_09 = new Date(Date.UTC(2024, 1, 17));
const ENTREE_EN_VIGUEUR_ORDONNANCE_23_042 = new Date(Date.UTC(2023, 2, 30));
exports.JOURS_FERIES = [
    { mois: 1, jour: 1, nom: 'Nouvel an' },
    { mois: 1, jour: 4, nom: "Journée des Martyrs de l'indépendance" },
    { mois: 1, jour: 16, nom: 'Journée du héros national Laurent Désiré Kabila' },
    { mois: 1, jour: 17, nom: 'Journée du héros national Patrice Emery Lumumba' },
    { mois: 4, jour: 6, nom: 'Journée du combat de Simon Kimbangu et de la conscience africaine' },
    { mois: 5, jour: 1, nom: 'Fête du travail' },
    { mois: 5, jour: 17, nom: 'Journée des Forces armées' },
    { mois: 6, jour: 30, nom: "Journée de l'indépendance" },
    { mois: 8, jour: 1, nom: 'Fête des parents' },
    { mois: 12, jour: 25, nom: 'Noël' },
];
function jourFerie(date) {
    if (date.getTime() < ENTREE_EN_VIGUEUR_ORDONNANCE_23_042.getTime())
        return null;
    const trouve = exports.JOURS_FERIES.find((f) => f.mois === date.getUTCMonth() + 1 && f.jour === date.getUTCDate());
    return trouve ? trouve.nom : null;
}
function estJourOuvrable(date, nature = 'DECLARATION') {
    if (date.getUTCDay() === DIMANCHE)
        return false;
    if (nature === 'DECLARATION' &&
        date.getUTCDay() === SAMEDI &&
        date.getTime() >= ENTREE_EN_VIGUEUR_DECRET_24_09.getTime()) {
        return false;
    }
    return jourFerie(date) === null;
}
function reporterAuJourOuvrable(echeance, nature = 'DECLARATION') {
    const reportee = new Date(echeance.getTime());
    while (!estJourOuvrable(reportee, nature)) {
        reportee.setUTCDate(reportee.getUTCDate() + 1);
    }
    return reportee;
}
function echeanceDeReversement(jours, annee, moisZeroBase, echeanceFiscale = true) {
    const brute = new Date(Date.UTC(annee, moisZeroBase + 1, jours));
    return echeanceFiscale ? reporterAuJourOuvrable(brute) : brute;
}
exports.RESERVE_ECHEANCES_SOCIALES = "Les échéances de la CNSS, de l'INPP et de l'ONEM ne sont PAS reportées · l'art. 110 bis, al. 2 ne vise que " +
    "le délai de la législation fiscale, et aucun texte du corpus ne reporte ces échéances (arrêté n° 146/2018, " +
    "art. 21 et 31 ; arrêté n° 028/2025, art. 2 et 3). Le délai de régularisation de cinq jours de l'arrêté " +
    "n° 146/2018 n'est pas un report.";
exports.RESERVE_JOUR_OUVRABLE = "REPORT DES ÉCHÉANCES · art. 110 bis, alinéa 2 de la loi de procédures fiscales : une échéance tombant un jour " +
    'non ouvrable est reportée au premier jour ouvrable qui suit. Cet état applique le report sur TROIS exclusions, ' +
    'chacune avec sa source et sa date. Le DIMANCHE, jour de repos hebdomadaire (Code du travail, art. 121, ' +
    'alinéa 2), de tout temps. Le SAMEDI, parce que les services publics travaillent « du lundi au vendredi » ' +
    '(décret n° 24/09 du 17 février 2024, art. 1er) et que la DÉCLARATION se dépose auprès des services de la ' +
    'DGI · à compter du 17 février 2024. Et les DIX JOURS FÉRIÉS LÉGAUX de l\u2019article 1er de l\u2019ordonnance ' +
    'n° 23-042 du 30 mars 2023 (1er, 4, 16 et 17 janvier, 6 avril, 1er et 17 mai, 30 juin, 1er août, 25 décembre) · ' +
    "à compter du 30 mars 2023. CINQ RÉSERVES. (1) La législation fiscale ne définit pas le « jour ouvrable » : " +
    'ces trois règles lui sont EMPRUNTÉES au droit du travail et au droit de la fonction publique. (2) Avant leurs ' +
    "dates d'effet, les textes antérieurs (ordonnance 14-010 du 14 mai 2014 pour les fériés, ordonnance 81-067 du " +
    "7 mai 1981 pour la discipline) ne sont pas au corpus du logiciel · une échéance plus ancienne ne porte que le " +
    'report du dimanche. (3) L\u2019article 2 de l\u2019ordonnance n° 23-042 dispose que le congé d\u2019un jour ' +
    "férié tombant un dimanche « est pris le jour précédent » · il fait RECULER un congé quand l'article 110 bis " +
    "fait AVANCER une échéance, et rien n'articule les deux. Le logiciel ne s'en sert pas et le dit. (4) Un " +
    "ministre peut fixer « des horaires de prestation spécifiques » pour les services spéciaux de son autorité " +
    "(décret n° 24/09, art. 2, alinéa 3), et l'Administration peut fixer l'échéance au jour ouvrable PRÉCÉDANT " +
    "l'échéance légale (art. 110 bis, alinéa 3) · deux actes qu'aucune comptabilité ne porte. (5) Le PAIEMENT ne se " +
    "fait pas à ces guichets : il s'effectue « auprès des seuls organismes ou agents habilités », en principe les " +
    'banques et autres établissements de crédit agréés, ou à la Banque Centrale du Congo (décret n° 20/019 du ' +
    '21 août 2020, art. 1er et 2 ; circulaire ministérielle n° 002 du 1er octobre 2020, III.2.2), dont le décret ' +
    "n° 24/09 ne fixe pas les jours. Pour une échéance de PUR PAIEMENT, sans dépôt de déclaration, comme les trois " +
    'acomptes provisionnels versés sur bordereau à la banque, le SAMEDI est tenu pour OUVRABLE, par décision de ' +
    "l'éditeur du 2026-10-04 qu'aucun texte lu ne fonde, et l'échéance n'est PAS reportée au lundi : le samedi " +
    '25 juillet 2026 reste le 25 juillet. Le ' +
    'dimanche et les jours fériés d\u2019un pur paiement restent reportés (art. 110 bis, alinéa 2). Le report au ' +
    "lundi 27 juillet 2026 annoncé par un communiqué de la DGI n'est pas suivi : son texte n'est pas au corpus, et " +
    "l'alinéa 3 ne permet à l'Administration que d'AVANCER une échéance.";
//# sourceMappingURL=jour-ouvrable.js.map