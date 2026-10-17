"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGLE_MOIS_ENTAME = exports.plusMois = exports.JOURS_DU_MOIS_REMUNERES = void 0;
exports.debutDuDelai = debutDuDelai;
exports.remunerationDuDelai = remunerationDuDelai;
const jours_du_code_du_travail_1 = require("./jours-du-code-du-travail");
exports.JOURS_DU_MOIS_REMUNERES = 26;
const JOURS_AU_PLUS = 3_660;
const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const ENTREE_EN_VIGUEUR_ORDONNANCE_23_042 = '2023-03-30';
const iso = (d) => d.toISOString().slice(0, 10);
const jourUtc = (s) => {
    const m = JOUR.exec(s);
    if (!m)
        return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) || iso(d) !== s ? null : d;
};
const plusJours = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const plusMois = (d, n) => {
    const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, Math.min(d.getUTCDate(), dernier)));
};
exports.plusMois = plusMois;
function debutDuDelai(dateNotification) {
    if (!dateNotification) {
        return {
            refus: "La date de notification n'est pas déclarée · l'indemnité est la rémunération du délai (art. 63, al. 3), jours fériés compris (art. 93), et les fériés du délai ne se placent pas sans elle.",
        };
    }
    const notification = jourUtc(dateNotification.slice(0, 10));
    if (!notification)
        return { refus: 'La date de notification doit être écrite AAAA-MM-JJ.' };
    const du = iso(plusJours(notification, 1));
    if (du < ENTREE_EN_VIGUEUR_ORDONNANCE_23_042) {
        return {
            refus: "Le délai commence avant le 30 mars 2023 · la liste des jours fériés antérieure à l'ordonnance n° 23-042 n'est pas au corpus, et la rémunération du délai ne se chiffre pas sans elle.",
        };
    }
    return { du };
}
function joursDuDelai(delai, joursOuvrables) {
    const debut = jourUtc(delai.du);
    if (!debut)
        return { refus: 'Le premier jour du délai est illisible.' };
    const fin = delai.auExclu ? jourUtc(delai.auExclu) : null;
    const jours = [];
    let ouvrables = 0;
    for (let i = 0, d = debut;; i += 1, d = plusJours(debut, i)) {
        if (i > JOURS_AU_PLUS)
            return { refus: 'Le délai dépasse dix ans de calendrier · il ne se place pas.' };
        if (fin ? d.getTime() >= fin.getTime() : ouvrables >= joursOuvrables)
            break;
        const nature = (0, jours_du_code_du_travail_1.natureDuJour)(d);
        jours.push({ date: d, nature, ouvrablesAvant: ouvrables });
        if (nature === 'OUVRABLE')
            ouvrables += 1;
    }
    return jours;
}
exports.REGLE_MOIS_ENTAME = "MOIS ENTAMÉ · les mois entiers du délai se paient au salaire du mois, le mois entamé à 1/26 du salaire mensuel par jour payable, " +
    "du lundi au samedi, jours fériés compris, le dimanche exclu (Code du travail, art. 63, al. 3 ; art. 93 ; art. 7, point 9 ; art. 121, al. 2 ; " +
    "arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, art. 1er, mentions 5 et 6, tout salaire, mensuel compris, se payant par jours payés). " +
    "La conversion d'un mois en vingt-six jours est celle du décret n° 25/22, art. 7, appliquée par analogie de la loi la plus proche · " +
    "vingt-six jours payables rendent un mois plein.";
function remunerationDuDelai(p) {
    const jours = joursDuDelai(p.delai, p.joursOuvrables);
    if ('refus' in jours)
        return jours;
    const total = jours.reduce((n, j) => n + (j.nature === 'OUVRABLE' ? 1 : 0), 0);
    const deDate = p.delai.auExclu !== null;
    const de = Math.max(0, p.de);
    const a = Math.min(p.a, deDate ? total : p.joursOuvrables);
    const poids = jours.map((j) => {
        if (j.nature === 'DIMANCHE')
            return 0;
        if (j.nature === 'OUVRABLE')
            return Math.max(0, Math.min(j.ouvrablesAvant + 1, a) - Math.max(j.ouvrablesAvant, de));
        const dansLaFenetre = de <= j.ouvrablesAvant && (j.ouvrablesAvant < a || (deDate && a >= total));
        return dansLaFenetre ? 1 : 0;
    });
    const retenus = jours.map((j, i) => ({ ...j, poids: poids[i] })).filter((j) => j.poids > 0);
    const joursRemuneres = retenus.reduce((n, j) => n + j.poids, 0);
    const joursFeriesRemuneres = retenus.filter((j) => j.nature !== 'OUVRABLE').length;
    const du = retenus.length ? iso(retenus[0].date) : null;
    const au = retenus.length ? iso(retenus[retenus.length - 1].date) : null;
    const moyenne = Math.max(0, p.moyenneMensuelleFc);
    if (p.mensuelleFc !== null) {
        const pleins = retenus.filter((j) => j.poids === 1);
        const debutDeLaFenetre = () => {
            if (de <= 0)
                return jourUtc(p.delai.du);
            const rang = Math.ceil(de);
            const exclu = jours.find((j) => j.nature === 'OUVRABLE' && j.ouvrablesAvant === rang - 1);
            return exclu ? plusJours(exclu.date, 1) : null;
        };
        const debut = debutDeLaFenetre();
        let moisEntiers = 0;
        let entame = joursRemuneres;
        if (debut && pleins.length > 0) {
            const finCalendaire = deDate && a >= total && p.delai.auExclu ? plusJours(jourUtc(p.delai.auExclu), -1) : pleins[pleins.length - 1].date;
            while (plusJours((0, exports.plusMois)(debut, moisEntiers + 1), -1).getTime() <= finCalendaire.getTime())
                moisEntiers += 1;
            const finDesMois = (0, exports.plusMois)(debut, moisEntiers);
            entame = retenus
                .filter((j) => j.date.getTime() < debut.getTime() || j.date.getTime() >= finDesMois.getTime())
                .reduce((n, j) => n + j.poids, 0);
        }
        const parMois = p.mensuelleFc + moyenne;
        const montantFc = moisEntiers * parMois + (entame * parMois) / exports.JOURS_DU_MOIS_REMUNERES;
        return {
            joursRemuneres,
            joursFeriesRemuneres,
            moisEntiers,
            joursDuMoisEntame: entame,
            montantFc,
            du,
            au,
            explication: `Délai rémunéré du ${du ?? '?'} au ${au ?? '?'} · ${moisEntiers} mois entier(s) × (salaire mensuel + moyenne de l'art. 66, al. 3)` +
                (entame > 0 ? ` et ${entame} jour(s) du mois entamé × (salaire mensuel + moyenne) ÷ ${exports.JOURS_DU_MOIS_REMUNERES}` : '') +
                ` · jours fériés compris (art. 93), dont ${joursFeriesRemuneres} férié(s) ou samedi(s) portant le congé d'un férié du dimanche.` +
                (entame > 0 ? ` ${exports.REGLE_MOIS_ENTAME}` : ''),
        };
    }
    const parJour = p.journaliereFc + moyenne / exports.JOURS_DU_MOIS_REMUNERES;
    return {
        joursRemuneres,
        joursFeriesRemuneres,
        moisEntiers: null,
        joursDuMoisEntame: null,
        montantFc: joursRemuneres * parJour,
        du,
        au,
        explication: `Délai rémunéré du ${du ?? '?'} au ${au ?? '?'} · ${joursRemuneres} jour(s) du lundi au samedi, ` +
            `jours fériés compris (art. 93), dont ${joursFeriesRemuneres} férié(s) ou samedi(s) portant le congé d'un férié du dimanche, ` +
            `× (taux journalier + moyenne de l'art. 66, al. 3 ramenée au jour par ${exports.JOURS_DU_MOIS_REMUNERES}, décret n° 25/22, art. 7, par analogie).`,
    };
}
//# sourceMappingURL=remuneration-du-delai.js.map