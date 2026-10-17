"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceEnCours = serviceEnCours;
function serviceEnCours(contrats) {
    if (contrats.length === 0)
        return null;
    const tries = [...contrats].sort((a, b) => a.dateEntreeEnVigueur.getTime() - b.dateEntreeEnVigueur.getTime());
    let groupe = [tries[0]];
    for (const c of tries.slice(1)) {
        const precedent = groupe[groupe.length - 1];
        const lendemain = precedent.dateFin ? precedent.dateFin.getTime() + 86_400_000 : null;
        const continu = c.renouvelleDeId === precedent.id || lendemain === null || c.dateEntreeEnVigueur.getTime() <= lendemain;
        groupe = continu ? [...groupe, c] : [c];
    }
    const dernier = groupe[groupe.length - 1];
    const finOuverte = groupe.some((c) => c.dateFin === null);
    return { origine: groupe[0].dateEntreeEnVigueur, fin: finOuverte ? null : dernier.dateFin, contrats: groupe };
}
//# sourceMappingURL=service-du-salarie.js.map