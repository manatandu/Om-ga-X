"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremiersSelon = exports.Collecte = exports.LOT_ECRITURES = exports.LOT_LECTURE = void 0;
exports.lireParLots = lireParLots;
exports.pageApres = pageApres;
exports.idApres = idApres;
exports.apresLaCle = apresLaCle;
exports.LOT_LECTURE = 5000;
exports.LOT_ECRITURES = 500;
async function lireParLots(charger, traiter, taille = exports.LOT_LECTURE) {
    let curseur;
    for (;;) {
        const lot = await charger(curseur);
        for (const element of lot)
            traiter(element);
        if (lot.length < taille)
            return;
        curseur = lot[lot.length - 1].id;
    }
}
function pageApres(curseur, taille) {
    return {
        orderBy: { id: 'asc' },
        take: taille,
        ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
    };
}
function idApres(curseur) {
    return curseur ? { id: { gt: curseur } } : {};
}
function apresLaCle(cles) {
    if (cles.length === 0 || cles[cles.length - 1].champ !== 'id') {
        throw new Error("apresLaCle · l'ordre doit finir par l'identifiant, qui le rend total.");
    }
    const liste = cles;
    const branches = [];
    for (let i = 0; i < liste.length; i++) {
        const c = liste[i];
        if (c.valeur === null)
            continue;
        const plusGrand = c.nullable
            ? { OR: [{ [c.champ]: { gt: c.valeur } }, { [c.champ]: null }] }
            : { [c.champ]: { gt: c.valeur } };
        branches.push({ AND: [...liste.slice(0, i).map((p) => ({ [p.champ]: p.valeur })), plusGrand] });
    }
    return { OR: branches };
}
class Collecte {
    constructor(plafond) {
        this.plafond = plafond;
        this.elements = [];
        this.nombre = 0;
    }
    ajouter(element) {
        this.nombre++;
        if (this.elements.length < this.plafond)
            this.elements.push(element);
    }
    get tronquee() {
        return this.nombre > this.elements.length;
    }
}
exports.Collecte = Collecte;
class PremiersSelon {
    constructor(capacite, ordre) {
        this.capacite = capacite;
        this.ordre = ordre;
        this.tas = [];
        this.nombre = 0;
    }
    ajouter(element) {
        this.nombre++;
        this.tas.push(element);
        if (this.tas.length >= 2 * this.capacite)
            this.retailler();
    }
    retailler() {
        this.tas.sort(this.ordre);
        this.tas.length = Math.min(this.tas.length, this.capacite);
    }
    elements() {
        this.retailler();
        return this.tas;
    }
    get tronquee() {
        return this.nombre > this.capacite;
    }
}
exports.PremiersSelon = PremiersSelon;
//# sourceMappingURL=lecture-par-lots.js.map