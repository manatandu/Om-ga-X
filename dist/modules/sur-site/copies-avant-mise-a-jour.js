"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVANT_MISE_A_JOUR_A_GARDER_PAR_DEFAUT = exports.MOTIF_AVANT_MISE_A_JOUR_CHIFFRE = exports.MOTIF_AVANT_MISE_A_JOUR = exports.SUFFIXE_PROVISOIRE = void 0;
exports.horodatageCopie = horodatageCopie;
exports.nomCopieAvantMiseAJour = nomCopieAvantMiseAJour;
exports.provisoiresAvantMiseAJour = provisoiresAvantMiseAJour;
exports.avantMiseAJourAGarder = avantMiseAJourAGarder;
exports.lireRepere = lireRepere;
exports.planMiseAJour = planMiseAJour;
exports.etatDeLaBaseAuRefus = etatDeLaBaseAuRefus;
exports.repereApresCopie = repereApresCopie;
exports.repereApresReprise = repereApresReprise;
exports.repereApresMigration = repereApresMigration;
exports.copiesProtegees = copiesProtegees;
exports.copiesAvantMiseAJourARetirer = copiesAvantMiseAJourARetirer;
exports.SUFFIXE_PROVISOIRE = '.partiel';
function horodatageCopie(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
exports.MOTIF_AVANT_MISE_A_JOUR = /^omegax-(\d{8}-\d{6})-avant-mise-a-jour-([0-9A-Za-z]{1,12})\.dump$/;
exports.MOTIF_AVANT_MISE_A_JOUR_CHIFFRE = /^omegax-(\d{8}-\d{6})-avant-mise-a-jour-([0-9A-Za-z]{1,12})\.dump\.chiffre$/;
const MOTIF_AVANT_MISE_A_JOUR_PROVISOIRE = /^omegax-(\d{8}-\d{6})-avant-mise-a-jour-([0-9A-Za-z]{1,12})\.dump\.partiel$/;
function nomCopieAvantMiseAJour(d, versionDeLaBase) {
    const v = String(versionDeLaBase ?? '')
        .replace(/[^0-9A-Za-z]/g, '')
        .slice(0, 12);
    return `omegax-${horodatageCopie(d)}-avant-mise-a-jour-${v || 'inconnue'}.dump`;
}
function provisoiresAvantMiseAJour(noms) {
    return noms.filter((n) => MOTIF_AVANT_MISE_A_JOUR_PROVISOIRE.test(n));
}
exports.AVANT_MISE_A_JOUR_A_GARDER_PAR_DEFAUT = 5;
function avantMiseAJourAGarder(env) {
    const g = Number.parseInt(env.SAUVEGARDES_AVANT_MISE_A_JOUR_A_GARDER ?? '', 10);
    return Number.isInteger(g) && g > 0 ? g : exports.AVANT_MISE_A_JOUR_A_GARDER_PAR_DEFAUT;
}
function lireRepere(texte) {
    if (texte === null)
        return null;
    let brut;
    try {
        brut = JSON.parse(texte.replace(/^\uFEFF/, ''));
    }
    catch {
        return { commit: null };
    }
    if (!brut || typeof brut !== 'object')
        return { commit: null };
    const o = brut;
    const commit = typeof o.commit === 'string' && o.commit ? o.commit : typeof o.date === 'string' && o.date ? o.date : null;
    const r = { commit };
    const e = o.enCours;
    if (e && typeof e === 'object' && typeof e.vers === 'string' && typeof e.copie === 'string' && exports.MOTIF_AVANT_MISE_A_JOUR.test(e.copie)) {
        r.enCours = { vers: e.vers, copie: e.copie };
    }
    if (Array.isArray(o.nonAbouties)) {
        const n = o.nonAbouties.filter((x) => typeof x === 'string' && exports.MOTIF_AVANT_MISE_A_JOUR.test(x));
        if (n.length)
            r.nonAbouties = n;
    }
    return r;
}
function planMiseAJour(repere, version, copieExiste) {
    if (!repere)
        return { action: 'PREMIER_DEMARRAGE' };
    if (repere.commit === version)
        return { action: 'AUCUNE' };
    if (repere.enCours && copieExiste(repere.enCours.copie))
        return { action: 'REPRENDRE', copie: repere.enCours.copie };
    return { action: 'COPIER', versionDeLaBase: repere.commit, copiePerdue: repere.enCours?.copie ?? null };
}
function etatDeLaBaseAuRefus(plan) {
    return plan.action === 'REPRENDRE'
        ? `Mise à jour arrêtée avant les migrations · une migration précédente n’a pas abouti et la base peut être à moitié migrée ; la copie ${plan.copie}, faite avant elle, est conservée.`
        : 'Mise à jour arrêtée avant la copie et les migrations · la base n’a pas été modifiée.';
}
function repereApresCopie(repere, version, copie) {
    return { commit: repere?.commit ?? null, enCours: { vers: version, copie }, ...(repere?.nonAbouties ? { nonAbouties: repere.nonAbouties } : {}) };
}
function repereApresReprise(repere, version) {
    return { ...repere, enCours: { vers: version, copie: repere.enCours.copie } };
}
function repereApresMigration(repere, version) {
    const nonAbouties = [...(repere?.nonAbouties ?? [])];
    const e = repere?.enCours;
    if (e && e.vers !== version && !nonAbouties.includes(e.copie))
        nonAbouties.push(e.copie);
    return nonAbouties.length ? { commit: version, nonAbouties } : { commit: version };
}
function copiesProtegees(avant, apres) {
    return [...new Set([...(avant?.enCours ? [avant.enCours.copie] : []), ...(apres.nonAbouties ?? [])])];
}
function copiesAvantMiseAJourARetirer(noms, garder, protegees = [], motif = exports.MOTIF_AVANT_MISE_A_JOUR) {
    return noms
        .filter((n) => motif.test(n))
        .sort()
        .reverse()
        .slice(Math.max(1, garder))
        .filter((n) => !protegees.includes(n));
}
//# sourceMappingURL=copies-avant-mise-a-jour.js.map