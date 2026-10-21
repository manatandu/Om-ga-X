"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELAI_PAIEMENT_JOURS = exports.CODE_DOSSIER_SUPPLEMENTAIRE = exports.JOURS_ESSAI = void 0;
exports.ajouterJours = ajouterJours;
exports.finEssaiDepuis = finEssaiDepuis;
exports.premierePeriodeFacturable = premierePeriodeFacturable;
exports.verdictPeriode = verdictPeriode;
exports.numeroFactureSuivant = numeroFactureSuivant;
exports.finPeriodeCouverte = finPeriodeCouverte;
exports.expirationInitiale = expirationInitiale;
exports.expirationApresPaiement = expirationApresPaiement;
exports.joursDepuis = joursDepuis;
exports.JOURS_ESSAI = 30;
exports.CODE_DOSSIER_SUPPLEMENTAIRE = 'DOSSIER_SUPPLEMENTAIRE';
function ajouterJours(jour, n) {
    const d = new Date(`${jour}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
function finEssaiDepuis(debut) {
    return ajouterJours(debut, exports.JOURS_ESSAI);
}
const moisIndex = (p) => Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1;
const periodeDe = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
function premierePeriodeFacturable(debut, finEssai) {
    let i = moisIndex(debut.slice(0, 7));
    if (debut.slice(8, 10) !== '01')
        i += 1;
    if (finEssai) {
        while (`${periodeDe(i)}-01` < finEssai)
            i += 1;
    }
    return periodeDe(i);
}
function prixDe(f, p) {
    return p === 'ANNUELLE' ? f.prixAnnuelUsd : f.prixMensuelUsd;
}
function verdictPeriode(a, periode) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode))
        return { du: false, motif: `Période illisible · ${periode}.` };
    if (!a.actif)
        return { du: false, motif: 'Abonnement suspendu.' };
    const premiere = premierePeriodeFacturable(a.debut, a.finEssai);
    if (moisIndex(periode) < moisIndex(premiere)) {
        return {
            du: false,
            motif: a.finEssai && `${periode}-01` < a.finEssai ? `En essai jusqu'au ${a.finEssai}.` : `Première période facturable · ${premiere}.`,
        };
    }
    if (a.periodicite === 'ANNUELLE' && (moisIndex(periode) - moisIndex(premiere)) % 12 !== 0) {
        return { du: false, motif: `Abonnement annuel · prochaine échéance en ${periodeDe(moisIndex(premiere) + Math.ceil((moisIndex(periode) - moisIndex(premiere)) / 12) * 12)}.` };
    }
    const suffixe = a.periodicite === 'ANNUELLE' ? `année à compter de ${periode}` : periode;
    const lignes = [];
    const manquants = [];
    const ajouter = (f, quantite) => {
        const prix = prixDe(f, a.periodicite);
        if (prix === null)
            manquants.push(f.libelle);
        else
            lignes.push({ designation: `Abonnement OmegaX · ${f.libelle} · ${suffixe}`, quantite, prixUnitaireUsd: prix });
    };
    ajouter(a.formule, 1);
    for (const o of a.options) {
        if (o.code === exports.CODE_DOSSIER_SUPPLEMENTAIRE)
            continue;
        ajouter(o, 1);
    }
    if (a.dossiersSupplementaires > 0) {
        const supp = a.options.find((o) => o.code === exports.CODE_DOSSIER_SUPPLEMENTAIRE);
        if (!supp)
            manquants.push('dossier supplémentaire (option non souscrite)');
        else
            ajouter(supp, a.dossiersSupplementaires);
    }
    if (manquants.length) {
        return { du: false, motif: `Prix ${a.periodicite === 'ANNUELLE' ? 'annuel' : 'mensuel'} non fixé · ${manquants.join(', ')}.` };
    }
    const totalUsd = Math.round(lignes.reduce((s, l) => s + l.quantite * l.prixUnitaireUsd, 0) * 100) / 100;
    return { du: true, lignes, totalUsd };
}
function numeroFactureSuivant(annee, existants) {
    const prefixe = `VMG-${annee}-`;
    const max = existants
        .filter((n) => n.startsWith(prefixe))
        .map((n) => Number.parseInt(n.slice(prefixe.length), 10))
        .filter(Number.isInteger)
        .reduce((a, b) => Math.max(a, b), 0);
    return `${prefixe}${String(max + 1).padStart(4, '0')}`;
}
exports.DELAI_PAIEMENT_JOURS = 15;
function finPeriodeCouverte(periode, periodicite) {
    const i = moisIndex(periode) + (periodicite === 'ANNUELLE' ? 12 : 1);
    return ajouterJours(`${periodeDe(i)}-01`, -1);
}
function expirationInitiale(debut, finEssai) {
    return ajouterJours(finEssai ?? debut, exports.DELAI_PAIEMENT_JOURS);
}
function expirationApresPaiement(periode, periodicite, actuelle) {
    const nouvelle = ajouterJours(finPeriodeCouverte(periode, periodicite), exports.DELAI_PAIEMENT_JOURS);
    return actuelle && actuelle > nouvelle ? actuelle : nouvelle;
}
function joursDepuis(emiseLe, aujourdhui) {
    return Math.round((Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${emiseLe}T00:00:00Z`)) / 86_400_000);
}
//# sourceMappingURL=facturation-abonnements.js.map