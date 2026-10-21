"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lignesNoteStocks = lignesNoteStocks;
exports.motifQuantitesNote2 = motifQuantitesNote2;
exports.chargerCampagneStocks = chargerCampagneStocks;
const client_1 = require("@prisma/client");
const CENTIME = 0.005;
function estDepreciation(numero) {
    return numero.startsWith('39');
}
function montantLu(n) {
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
function lignesNoteStocks(comptes, campagne) {
    const lignes = [];
    const manques = [];
    const ligneDuCompte = (c) => ({
        reference: c.numero,
        designation: c.intitule,
        quantite: null,
        prixUnitaire: null,
        montant: c.montant,
    });
    for (const c of comptes) {
        const fiches = campagne ? campagne.fiches.filter((f) => f.compteNumero === c.numero) : [];
        if (estDepreciation(c.numero) || (fiches.length === 0 && Math.abs(c.montant) <= CENTIME)) {
            lignes.push(ligneDuCompte(c));
            continue;
        }
        if (fiches.length === 0) {
            lignes.push(ligneDuCompte(c));
            if (campagne)
                manques.push(`${c.numero}, aucune fiche dans la campagne`);
            continue;
        }
        const incompletes = fiches.filter((f) => f.quantiteComptee === null || f.valeurInventaire === null);
        if (incompletes.length > 0) {
            lignes.push(ligneDuCompte(c));
            manques.push(`${c.numero}, ${incompletes.length} fiche(s) non comptée(s) ou non valorisée(s)`);
            continue;
        }
        const totalFiches = fiches.reduce((s, f) => s + f.valeurInventaire, 0);
        if (Math.abs(totalFiches - c.montant) > CENTIME) {
            lignes.push(ligneDuCompte(c));
            manques.push(`${c.numero}, fiches à ${montantLu(totalFiches)} contre ${montantLu(c.montant)} au bilan (écart non régularisé)`);
            continue;
        }
        for (const f of fiches) {
            const quantite = f.quantiteComptee;
            const valeur = f.valeurInventaire;
            lignes.push({
                reference: c.numero,
                designation: f.uniteMesure ? `${f.designation} (${f.uniteMesure})` : f.designation,
                quantite,
                prixUnitaire: quantite !== 0 ? valeur / quantite : null,
                montant: valeur,
            });
        }
    }
    const source = campagne
        ? `Quantités et prix unitaires lus sur la campagne d'inventaire « ${campagne.libelle} » du ${campagne.dateInventaire.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.`
        : null;
    return { lignes, quantitesTenues: campagne !== null && manques.length === 0, manques, source };
}
function motifQuantitesNote2(note, suffixeSansCampagne) {
    if (note.source === null) {
        return ("Aucune campagne d'inventaire n'est enregistrée pour cet exercice : les colonnes Quantité et Prix unitaire " +
            `se servent depuis la fenêtre Inventaire physique, ou se complètent à la main sur l'état imprimé${suffixeSansCampagne}.`);
    }
    if (note.manques.length === 0)
        return '';
    return `Quantité et Prix unitaire non servis pour · ${note.manques.join(' ; ')}.`;
}
async function chargerCampagneStocks(prisma, tenantId, exerciceId) {
    const campagne = await prisma.campagneInventaire.findFirst({
        where: { tenantId, exerciceId, fiches: { some: { compte: { classe: client_1.ClasseCompte.CLASSE_3 } } } },
        orderBy: { dateInventaire: 'desc' },
        select: {
            libelle: true,
            dateInventaire: true,
            fiches: {
                select: {
                    designation: true,
                    uniteMesure: true,
                    quantiteComptee: true,
                    valeurInventaire: true,
                    compte: { select: { numero: true } },
                },
                orderBy: { designation: 'asc' },
            },
        },
    });
    if (!campagne)
        return null;
    return {
        libelle: campagne.libelle,
        dateInventaire: campagne.dateInventaire,
        fiches: campagne.fiches.map((f) => ({
            compteNumero: f.compte.numero,
            designation: f.designation,
            uniteMesure: f.uniteMesure,
            quantiteComptee: f.quantiteComptee === null ? null : Number(f.quantiteComptee),
            valeurInventaire: f.valeurInventaire === null ? null : Number(f.valeurInventaire),
        })),
    };
}
//# sourceMappingURL=stocks-depuis-inventaire.js.map