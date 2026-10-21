"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLES_DE_PIECES = exports.TABLES_DE_L_ARCHIVE = exports.TABLE_DU_DOSSIER = exports.TABLES_RESTITUEES = exports.ORDRE_PAR_MODELE = exports.ModeleSansBorne = exports.BORNES_PORTEES = void 0;
exports.borneDuModele = borneDuModele;
exports.ordreDuModele = ordreDuModele;
exports.colonnesDuModele = colonnesDuModele;
exports.fichierDeLaTable = fichierDeLaTable;
exports.fichierDuDocument = fichierDuDocument;
exports.fichierDeLaPieceVirement = fichierDeLaPieceVirement;
exports.fichierDeLaPiece = fichierDeLaPiece;
exports.fichierDeLExport = fichierDeLExport;
exports.fichierDeLImpression = fichierDeLImpression;
const client_1 = require("@prisma/client");
const modeles_cloisonnes_1 = require("../../../common/cloisonnement/modeles-cloisonnes");
const champs_audites_1 = require("../../../common/audit/champs-audites");
exports.BORNES_PORTEES = {
    BudgetSection: ['section'],
    CoursDevise: ['devise'],
    DepreciationImmobilisation: ['immobilisation'],
    DotationAmortissement: ['immobilisation'],
    EcheanceAbonnement: ['abonnement'],
    EcheanceReglement: ['modeleReglement'],
    ExecutionEngagement: ['engagement'],
    LigneAffectation: ['affectation'],
    LigneDevis: ['devis'],
    LigneEcriture: ['ecriture'],
    LigneFacture: ['facture'],
    LigneModeleSaisie: ['modele'],
    RapportBailleur: ['convention'],
    ReclassementImmobilisation: ['immobilisation'],
    TiersCompte: ['tiers'],
    TrancheFinancement: ['convention'],
    VentilationAnalytique: ['ligne', 'ecriture'],
};
class ModeleSansBorne extends Error {
    constructor(modele) {
        super(`Aucune borne de dossier déclarée pour ${modele}. Un modèle ajouté au schéma doit être ` +
            'classé dans BORNES_PORTEES ou porter un tenantId · le lire sans borne rendrait les ' +
            'lignes de tous les cabinets.');
        this.name = 'ModeleSansBorne';
    }
}
exports.ModeleSansBorne = ModeleSansBorne;
function borneDuModele(modele, tenantId) {
    if (modeles_cloisonnes_1.MODELES_CLOISONNES.has(modele))
        return { tenantId };
    const chemin = exports.BORNES_PORTEES[modele];
    if (!chemin)
        throw new ModeleSansBorne(modele);
    return chemin.reduceRight((interieur, relation) => ({ [relation]: interieur }), { tenantId });
}
exports.ORDRE_PAR_MODELE = {
    EvenementAudit: 'rang',
};
function ordreDuModele(modele) {
    return exports.ORDRE_PAR_MODELE[modele] ?? 'id';
}
function colonnesDuModele(modele) {
    const description = client_1.Prisma.dmmf.datamodel.models.find((m) => m.name === modele);
    if (!description)
        throw new ModeleSansBorne(modele);
    const exclues = (0, champs_audites_1.colonnesNonRestituables)(modele);
    return description.fields
        .filter((f) => (f.kind === 'scalar' && f.type !== 'Bytes') || f.kind === 'enum')
        .map((f) => f.name)
        .filter((n) => !exclues.has(n.toLowerCase()));
}
exports.TABLES_RESTITUEES = [
    ...[...modeles_cloisonnes_1.MODELES_CLOISONNES].sort(),
    ...[...modeles_cloisonnes_1.MODELES_PORTES_PAR_LEUR_PARENT].sort(),
];
exports.TABLE_DU_DOSSIER = 'Tenant';
exports.TABLES_DE_L_ARCHIVE = [exports.TABLE_DU_DOSSIER, ...exports.TABLES_RESTITUEES];
function fichierDeLaTable(modele) {
    return `tables/${modele.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}.csv`;
}
function fichierDuDocument(id, nomFichier) {
    return `documents-tiers/${id}-${nomFichier.replace(/[\\/]/g, '_')}`;
}
function fichierDeLaPieceVirement(id, nomFichier) {
    return `pieces-virements/${id}-${nomFichier.replace(/[\\/]/g, '_')}`;
}
exports.TABLES_DE_PIECES = [
    { modele: 'DocumentTiers', dossier: 'documents-tiers' },
    { modele: 'PieceVirementFonds', dossier: 'pieces-virements' },
    { modele: 'ExportEcritures', dossier: 'exports-ecritures' },
    {
        modele: 'ImpressionDifferee',
        dossier: 'impressions-differees',
        filtre: { etat: client_1.EtatImpressionDifferee.PRETE, fichierRetireLe: null },
        nomParDefaut: 'impression.xlsx',
    },
    { modele: 'PieceJointeEcriture', dossier: 'pieces-jointes/ecritures' },
    { modele: 'PieceJointeSection', dossier: 'pieces-jointes/sections' },
    { modele: 'PieceJointeImmobilisation', dossier: 'pieces-jointes/immobilisations' },
    { modele: 'PieceJointeSalarie', dossier: 'pieces-jointes/salaries' },
];
function fichierDeLaPiece(dossier, id, nomFichier) {
    return `${dossier}/${id}-${nomFichier.replace(/[\\/]/g, '_')}`;
}
function fichierDeLExport(id, nomFichier) {
    return fichierDeLaPiece('exports-ecritures', id, nomFichier);
}
function fichierDeLImpression(id, nomFichier) {
    return fichierDeLaPiece('impressions-differees', id, nomFichier);
}
//# sourceMappingURL=tables-restitution.js.map