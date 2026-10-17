"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jourUtc = void 0;
exports.moinsDeDixHuitAnsAu = moinsDeDixHuitAnsAu;
exports.motifRefusReprise = motifRefusReprise;
exports.joursDuConge = joursDuConge;
exports.dernierJourOuvrableAvant = dernierJourOuvrableAvant;
exports.compteurConges = compteurConges;
const decompte_final_1 = require("./decompte-final");
const jours_du_code_du_travail_1 = require("./jours-du-code-du-travail");
const remuneration_du_delai_1 = require("./remuneration-du-delai");
const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const iso = (d) => d.toISOString().slice(0, 10);
const jourUtc = (s) => {
    const m = JOUR.exec(s);
    if (!m)
        return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) || iso(d) !== s ? null : d;
};
exports.jourUtc = jourUtc;
const plusJours = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const moisCivil = (d) => iso(d).slice(0, 7);
const PERIODES_AU_PLUS = 50;
function moinsDeDixHuitAnsAu(date, dateNaissance, millesimeNaissance) {
    if (dateNaissance)
        return date.getTime() < (0, remuneration_du_delai_1.plusMois)(dateNaissance, 18 * 12).getTime();
    if (millesimeNaissance === null)
        return null;
    const ecart = date.getUTCFullYear() - millesimeNaissance;
    if (ecart > 18)
        return false;
    if (ecart < 18)
        return true;
    return null;
}
function motifRefusReprise(p) {
    const origine = (0, exports.jourUtc)(p.origine);
    const arrete = (0, exports.jourUtc)(p.arreteAu);
    if (!origine || !arrete)
        return 'La date de la reprise doit être écrite AAAA-MM-JJ.';
    if (arrete.getTime() < origine.getTime()) {
        return `La reprise est arrêtée avant l'entrée en service (${p.origine}) · rien n'était acquis.`;
    }
    if (!Number.isFinite(p.joursNesNonPris) || p.joursNesNonPris < 0 || Math.round(p.joursNesNonPris * 2) !== p.joursNesNonPris * 2) {
        return 'Les jours nés et non pris se déclarent en jours ou demi-jours, zéro compris.';
    }
    if (!Number.isInteger(p.moisEnCoursAccomplis) || p.moisEnCoursAccomplis < 0 || p.moisEnCoursAccomplis > 11) {
        return 'Les mois de service accomplis dans la période en cours vont de 0 à 11 · douze mois font une période révolue.';
    }
    let rang = 0;
    while ((0, remuneration_du_delai_1.plusMois)(origine, 12 * (rang + 1)).getTime() <= arrete.getTime())
        rang += 1;
    const debutPeriode = (0, remuneration_du_delai_1.plusMois)(origine, 12 * rang);
    let ecoules = 0;
    while (ecoules < 12 && plusJours((0, remuneration_du_delai_1.plusMois)(debutPeriode, ecoules + 1), -1).getTime() <= arrete.getTime())
        ecoules += 1;
    if (p.moisEnCoursAccomplis > ecoules) {
        return `La période annuelle en cours a commencé le ${iso(debutPeriode)} · au ${p.arreteAu}, ${ecoules} mois de service s'y sont écoulés, pas ${p.moisEnCoursAccomplis}.`;
    }
    if (p.source.trim().length < 3)
        return 'La source de la reprise est exigée (registre des congés, ancien logiciel, attestation…).';
    return null;
}
function joursDuConge(p) {
    const du = (0, exports.jourUtc)(p.du);
    const au = (0, exports.jourUtc)(p.au);
    if (!du || !au)
        return { refus: 'Les dates du congé doivent être écrites AAAA-MM-JJ.' };
    if (au.getTime() < du.getTime())
        return { refus: 'Le congé finit avant de commencer.' };
    if (au.getTime() - du.getTime() > 400 * 86_400_000)
        return { refus: 'Un congé de plus de quatre cents jours ne se pose pas · vérifiez les dates.' };
    let ouvrables = 0;
    let maladie = 0;
    for (let d = du; d.getTime() <= au.getTime(); d = plusJours(d, 1)) {
        if (!(0, jours_du_code_du_travail_1.estJourOuvrableDuCode)(d))
            continue;
        if (p.joursMaladie.has(iso(d)))
            maladie += 1;
        else
            ouvrables += 1;
    }
    if (!Number.isInteger(p.joursVoyage) || p.joursVoyage < 0)
        return { refus: 'Les jours de voyage se comptent en jours entiers, zéro compris.' };
    if (p.joursVoyage > ouvrables) {
        return { refus: `Le congé ne compte que ${ouvrables} jour(s) ouvrable(s) · ${p.joursVoyage} jour(s) de voyage ne s'en retranchent pas.` };
    }
    return { jours: ouvrables - p.joursVoyage, ouvrables, maladie };
}
function dernierJourOuvrableAvant(du) {
    const d = (0, exports.jourUtc)(du);
    if (!d)
        return null;
    for (let j = plusJours(d, -1), n = 0; n < 15; j = plusJours(j, -1), n += 1) {
        if ((0, jours_du_code_du_travail_1.estJourOuvrableDuCode)(j))
            return iso(j);
    }
    return null;
}
const recouvre = (a, du, au) => {
    const d = (0, exports.jourUtc)(du);
    const f = (0, exports.jourUtc)(au);
    if (!d || !f)
        return false;
    return d.getTime() <= a.au.getTime() && f.getTime() >= a.du.getTime();
};
function moisCivilsEntre(du, au) {
    const sortie = [];
    let curseur = new Date(Date.UTC(du.getUTCFullYear(), du.getUTCMonth(), 1));
    while (curseur.getTime() <= au.getTime()) {
        sortie.push(moisCivil(curseur));
        curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 1));
    }
    return sortie;
}
function compteurConges(f) {
    const origine = (0, exports.jourUtc)(f.origine);
    const aLa = (0, exports.jourUtc)(f.aLa);
    if (!origine || !aLa)
        return { refus: 'Dates du compteur illisibles.' };
    const fin = f.fin ? (0, exports.jourUtc)(f.fin) : null;
    const naissance = f.dateNaissance ? (0, exports.jourUtc)(f.dateNaissance) : null;
    const arrete = f.reprise ? (0, exports.jourUtc)(f.reprise.arreteAu) : null;
    if (f.reprise && !arrete)
        return { refus: 'Date de la reprise illisible.' };
    const payes = new Set(f.moisPayes);
    const signaux = [];
    const periodes = [];
    const limite = fin && fin.getTime() < aLa.getTime() ? fin : aLa;
    for (let rang = 0; rang < PERIODES_AU_PLUS; rang += 1) {
        const debutP = (0, remuneration_du_delai_1.plusMois)(origine, 12 * rang);
        if (debutP.getTime() > limite.getTime())
            break;
        const finP = plusJours((0, remuneration_du_delai_1.plusMois)(origine, 12 * (rang + 1)), -1);
        const revolue = finP.getTime() < aLa.getTime();
        const coupeeParLaFin = fin !== null && finP.getTime() > fin.getTime();
        if (arrete && finP.getTime() <= arrete.getTime()) {
            periodes.push({
                rang,
                du: iso(debutP),
                au: iso(finP),
                etat: 'REPRISE',
                mois: [],
                moisAcquis: 0,
                joursDeBase: null,
                joursDAnciennete: 0,
                joursAcquis: null,
            });
            continue;
        }
        const mois = [];
        let ageInconnu = false;
        for (let m = 0; m < 12; m += 1) {
            const du = (0, remuneration_du_delai_1.plusMois)(origine, 12 * rang + m);
            if (du.getTime() > limite.getTime())
                break;
            const au = plusJours((0, remuneration_du_delai_1.plusMois)(origine, 12 * rang + m + 1), -1);
            const ligne = (statut, jours, motif) => ({
                du: iso(du),
                au: iso(au),
                statut,
                jours,
                motif,
            });
            if (fin && au.getTime() > fin.getTime()) {
                mois.push(ligne('HORS_CONTRAT', 0, `Le service a pris fin le ${iso(fin)} · le mois n'est pas entier.`));
                continue;
            }
            if (au.getTime() >= aLa.getTime()) {
                mois.push(ligne('EN_COURS', 0, null));
                continue;
            }
            if (arrete && au.getTime() <= arrete.getTime()) {
                mois.push(ligne('REPRIS', 0, null));
                continue;
            }
            const partDu = arrete && du.getTime() <= arrete.getTime() ? plusJours(arrete, 1) : du;
            const sansBulletin = moisCivilsEntre(partDu, au).filter((mc) => !payes.has(mc));
            if (sansBulletin.length > 0) {
                mois.push(ligne('SANS_BULLETIN', 0, `Aucun bulletin émis pour ${sansBulletin.join(', ')}.`));
                continue;
            }
            const hors = f.joursHorsService.find((h) => recouvre({ du: partDu, au }, h.du, h.au));
            if (hors) {
                mois.push(ligne('NON_ENTIER', 0, `${hors.motif} (du ${hors.du} au ${hors.au}) · ce jour n'est pas un service au sens de l'article 141, alinéa 2.`));
                continue;
            }
            const mineur = moinsDeDixHuitAnsAu(du, naissance, f.millesimeNaissance);
            if (mineur === null) {
                ageInconnu = true;
                mois.push(ligne('AGE_INCONNU', null, "Ni la date de naissance ni le millésime ne disent si le travailleur avait moins de dix-huit ans."));
                continue;
            }
            mois.push(ligne('ACQUIS', mineur ? decompte_final_1.CONGE_JOURS_PAR_MOIS_MINEUR : decompte_final_1.CONGE_JOURS_PAR_MOIS_MAJEUR, null));
        }
        let moisDeclares = 0;
        let baseDeclaree = 0;
        if (arrete && f.reprise && debutP.getTime() <= arrete.getTime()) {
            moisDeclares = f.reprise.moisEnCoursAccomplis;
            if (moisDeclares > 0) {
                const mineur = moinsDeDixHuitAnsAu(arrete, naissance, f.millesimeNaissance);
                baseDeclaree = mineur === null ? null : moisDeclares * (mineur ? decompte_final_1.CONGE_JOURS_PAR_MOIS_MINEUR : decompte_final_1.CONGE_JOURS_PAR_MOIS_MAJEUR);
                if (mineur === null)
                    ageInconnu = true;
            }
        }
        const acquis = mois.filter((x) => x.statut === 'ACQUIS');
        const moisAcquis = acquis.length + moisDeclares;
        const joursDeBase = ageInconnu || baseDeclaree === null ? null : acquis.reduce((s, x) => s + (x.jours ?? 0), 0) + baseDeclaree;
        const joursDAnciennete = moisAcquis > 0 ? (0, decompte_final_1.trancheDAnciennete)(revolue && !coupeeParLaFin ? rang + 1 : rang) : 0;
        periodes.push({
            rang,
            du: iso(debutP),
            au: iso(finP),
            etat: coupeeParLaFin ? 'FIN_DE_SERVICE' : revolue ? 'NEE' : 'EN_COURS',
            mois,
            moisAcquis,
            joursDeBase,
            joursDAnciennete,
            joursAcquis: joursDeBase === null ? null : joursDeBase + joursDAnciennete,
        });
    }
    if (periodes.length === PERIODES_AU_PLUS) {
        return { refus: 'Le service compte plus de cinquante années · vérifiez la date d’entrée du contrat.' };
    }
    const nees = periodes.filter((p) => p.etat === 'NEE');
    const droitsNes = nees.some((p) => p.joursAcquis === null) ? null : (f.reprise?.joursNesNonPris ?? 0) + nees.reduce((s, p) => s + (p.joursAcquis ?? 0), 0);
    const congesApres = f.conges.filter((c) => !arrete || ((0, exports.jourUtc)(c.du)?.getTime() ?? 0) > arrete.getTime());
    const congesAvantReprise = f.conges.filter((c) => !congesApres.includes(c)).map((c) => c.id);
    const pris = congesApres.reduce((s, c) => s + c.jours, 0);
    const enCoursP = periodes.find((p) => p.etat === 'EN_COURS' || p.etat === 'FIN_DE_SERVICE') ?? null;
    if (droitsNes !== null) {
        const nes = [];
        if (f.reprise && arrete && f.reprise.joursNesNonPris > 0)
            nes.push({ neLe: arrete, jours: f.reprise.joursNesNonPris });
        for (const p of nees)
            nes.push({ neLe: plusJours((0, exports.jourUtc)(p.au), 1), jours: p.joursAcquis ?? 0 });
        let aConsommer = pris;
        for (const n of nes) {
            const consomme = Math.min(n.jours, aConsommer);
            aConsommer -= consomme;
            const reste = n.jours - consomme;
            if (reste > 0 && (0, remuneration_du_delai_1.plusMois)(n.neLe, 6).getTime() < aLa.getTime()) {
                signaux.push(`${reste} jour(s) de congé nés le ${iso(n.neLe)} ne sont pas pris six mois après · la prise effective ne peut dépasser de six mois la date prévue pour l'ouverture du congé (article 140, alinéa 4).`);
            }
        }
    }
    const sansBulletin = periodes.flatMap((p) => p.mois).filter((m) => m.statut === 'SANS_BULLETIN');
    if (sansBulletin.length > 0) {
        signaux.push(`${sansBulletin.length} mois de service sans bulletin émis ne sont pas comptés` +
            (f.reprise ? '.' : ' · si ces mois ont été payés hors d’OmegaX, déclarez la reprise des congés acquis.'));
    }
    if (periodes.some((p) => p.joursAcquis === null && p.etat !== 'REPRISE')) {
        signaux.push("L'âge du travailleur ne se dit pas sur un mois au moins · renseignez la date de naissance au registre.");
    }
    return {
        periodes,
        droitsNes,
        pris,
        solde: droitsNes === null ? null : droitsNes - pris,
        enCours: enCoursP ? enCoursP.joursAcquis : 0,
        signaux,
        congesAvantReprise,
    };
}
//# sourceMappingURL=conges-acquis.js.map