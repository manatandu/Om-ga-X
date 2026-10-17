"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENTION_RELECTURE = exports.PiecesDistinctes = exports.COLONNES_SUPPRIMEES = exports.COLONNES_ECHANGE = exports.FEUILLE_EXPORT = exports.FEUILLE_SUPPRIMEES = exports.FEUILLE_ECRITURES = void 0;
exports.ordonnerLignes = ordonnerLignes;
exports.empreinteEcriture = empreinteEcriture;
exports.pieceDuFichier = pieceDuFichier;
exports.mouvementDe = mouvementDe;
exports.libelleMouvement = libelleMouvement;
exports.nomFichierExport = nomFichierExport;
exports.empreinteFichier = empreinteFichier;
exports.motifExportVide = motifExportVide;
exports.motifHorsPlafond = motifHorsPlafond;
exports.motifEnvoiNonRelu = motifEnvoiNonRelu;
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
exports.FEUILLE_ECRITURES = 'Écritures';
exports.FEUILLE_SUPPRIMEES = 'Supprimées';
exports.FEUILLE_EXPORT = 'Export';
exports.COLONNES_ECHANGE = [
    { header: 'Date', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Code journal', key: 'journal', width: 10 },
    { header: 'N° de pièce', key: 'piece', width: 14 },
    { header: 'Référence', key: 'reference', width: 16 },
    { header: 'Numéro de compte', key: 'compte', width: 14 },
    { header: 'Libellé', key: 'libelle', width: 36 },
    { header: 'Débit', key: 'debit', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Crédit', key: 'credit', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Montant en devise', key: 'montantDevise', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Devise', key: 'devise', width: 8 },
    { header: 'Cours', key: 'cours', width: 12, style: { numFmt: '0.000000' } },
    { header: 'Échéance', key: 'echeance', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Jour de valeur', key: 'jourValeur', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Statut', key: 'statut', width: 11 },
    { header: 'Mouvement', key: 'mouvement', width: 34 },
    { header: "Identifiant de l'écriture", key: 'identifiant', width: 38 },
];
exports.COLONNES_SUPPRIMEES = [
    { header: "Identifiant de l'écriture", key: 'identifiant', width: 38 },
    { header: 'Date', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Code journal', key: 'journal', width: 10 },
    { header: 'N° de pièce', key: 'piece', width: 14 },
    { header: 'Libellé', key: 'libelle', width: 36 },
    { header: "Envoyée à l'export n°", key: 'envoyee', width: 14 },
];
const jourIso = (d) => (d ? d.toISOString().slice(0, 10) : null);
function contenuDeLaLigne(l) {
    return [l.compte, l.libelle ?? null, l.debit, l.credit, l.devise, l.montantDevise, l.cours, l.echeance];
}
function ordonnerLignes(lignes) {
    return lignes
        .map((l) => ({ l, sens: Number(l.debit) !== 0 ? 0 : 1, cle: JSON.stringify(contenuDeLaLigne(l)) }))
        .sort((a, b) => a.sens - b.sens || (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0))
        .map((x) => x.l);
}
function empreinteEcriture(e) {
    const contenu = {
        date: jourIso(e.date),
        dateValeur: jourIso(e.dateValeur),
        journal: e.journal,
        numeroPiece: e.numeroPiece,
        reference: e.reference ?? null,
        libelle: e.libelle,
        statut: e.statut,
        lignes: ordonnerLignes(e.lignes).map(contenuDeLaLigne),
    };
    return (0, crypto_1.createHash)('sha256').update(JSON.stringify(contenu)).digest('hex');
}
function pieceDuFichier(numeroPiece, id) {
    return numeroPiece !== null && numeroPiece !== undefined ? String(numeroPiece) : `sans n° · ${id.slice(0, 8)}`;
}
class PiecesDistinctes {
    constructor() {
        this.jour = '';
        this.prises = new Map();
    }
    piece(e) {
        const jour = e.date.toISOString().slice(0, 10);
        if (jour !== this.jour) {
            this.jour = jour;
            this.prises = new Map();
        }
        const brute = pieceDuFichier(e.numeroPiece, e.id);
        const cle = `${e.journal}|${brute}`;
        const deja = this.prises.get(cle);
        if (deja === undefined || deja === e.id) {
            this.prises.set(cle, e.id);
            return brute;
        }
        return `${brute} · ${e.id.slice(0, 8)}`;
    }
}
exports.PiecesDistinctes = PiecesDistinctes;
function mouvementDe(entree, empreinteActuelle) {
    if (!entree)
        return 'NOUVELLE';
    return entree.empreinte === empreinteActuelle ? 'RENVOYEE' : 'MODIFIEE';
}
function libelleMouvement(m, entree, statutActuel) {
    if (m === 'NOUVELLE' || !entree)
        return 'Nouvelle';
    if (m === 'MODIFIEE') {
        const validee = entree.statutExporte === client_1.StatutEcriture.BROUILLARD && statutActuel === client_1.StatutEcriture.VALIDEE ? ' · validée depuis' : '';
        return `Modifiée · remplace l'envoi n° ${entree.numeroExport}${validee}`;
    }
    return `Déjà envoyée au n° ${entree.numeroExport}`;
}
function nomFichierExport(numero, jour) {
    return `ecritures-export-${String(numero).padStart(4, '0')}-${jour.toISOString().slice(0, 10)}.xlsx`;
}
function empreinteFichier(contenu) {
    return (0, crypto_1.createHash)('sha256').update(contenu).digest('hex');
}
function motifExportVide(dernierNumero) {
    return dernierNumero === null
        ? "Aucune écriture à exporter · le dossier n'a encore rien qui puisse partir."
        : `Aucune modification depuis l'export n° ${dernierNumero} · rien n'est parti, aucun numéro n'est pris.`;
}
function motifHorsPlafond(e, plafond) {
    const piece = e.numeroPiece === null ? 'sans numéro' : `n° ${e.numeroPiece}`;
    const jour = e.date.toISOString().slice(0, 10).split('-').reverse().join('/');
    return (`La pièce ${piece} du journal ${e.journal}, du ${jour}, porte ${e.lignes.toLocaleString('fr-FR')} lignes, ` +
        `au-delà du plafond de ${plafond.toLocaleString('fr-FR')} lignes d'un export · une écriture ne se coupe pas, ` +
        "et aucun export ne peut la porter. Rien n'est parti, aucun numéro n'est pris · les pièces qui la suivent " +
        'attendent derrière elle.');
}
exports.MENTION_RELECTURE = "La feuille « Écritures » se relit par Fichier > Importer des données, type Écritures, seulement si toutes ses " +
    "pièces sont « Nouvelle » et la feuille « Supprimées » vide · un envoi qui remplace ou retire une pièce est refusé " +
    "par l'import, sa relecture complète viendra avec les échanges du cabinet.";
const ENTETE_MOUVEMENT = exports.COLONNES_ECHANGE.find((c) => c.key === 'mouvement').header;
const MOUVEMENT_RELU = libelleMouvement('NOUVELLE', undefined, client_1.StatutEcriture.VALIDEE);
function motifEnvoiNonRelu(colonnes, lignes, lignesSupprimees) {
    const motifs = [];
    const i = colonnes.findIndex((c) => c.trim() === ENTETE_MOUVEMENT);
    if (i >= 0) {
        const autres = lignes.map((l, rang) => ({ rang, m: (l[i] ?? '').trim() })).filter((x) => x.m !== '' && x.m !== MOUVEMENT_RELU);
        if (autres.length > 0) {
            motifs.push(`${autres.length} ligne${autres.length > 1 ? 's' : ''} de la colonne « ${ENTETE_MOUVEMENT} » ` +
                `remplace${autres.length > 1 ? 'nt' : ''} ou renvoie${autres.length > 1 ? 'nt' : ''} une pièce déjà envoyée ` +
                `(première à la ligne ${autres[0].rang + 2} · « ${autres[0].m} ») · l'import ${autres.length > 1 ? 'les' : 'la'} ` +
                'créerait une seconde fois');
        }
    }
    if (lignesSupprimees > 0) {
        motifs.push(`la feuille « ${exports.FEUILLE_SUPPRIMEES} » nomme ${lignesSupprimees} pièce${lignesSupprimees > 1 ? 's' : ''} retirée` +
            `${lignesSupprimees > 1 ? 's' : ''} depuis leur envoi · l'import ne sait pas retirer une pièce`);
    }
    if (motifs.length === 0)
        return null;
    return (`Ce fichier est un export des modifications que l'import ne sait pas relire · ${motifs.join(' ; ')}. ` +
        "Rien n'est importé. La relecture d'un tel envoi viendra avec les échanges du cabinet ; d'ici là, " +
        'portez ces modifications à la main dans le dossier qui reçoit.');
}
//# sourceMappingURL=export-modifications.js.map