"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGLE_PIECES_ECRITURE = void 0;
exports.descriptionDeLEcriture = descriptionDeLEcriture;
exports.motifRefusDepotEcriture = motifRefusDepotEcriture;
exports.motifRefusRetraitEcriture = motifRefusRetraitEcriture;
exports.motifHorsPerimetreEcriture = motifHorsPerimetreEcriture;
exports.lireEcritureDesPieces = lireEcritureDesPieces;
exports.verrouillerEcriture = verrouillerEcriture;
exports.reporterLesPieces = reporterLesPieces;
exports.retoucherDescriptionDesPieces = retoucherDescriptionDesPieces;
exports.preparerLesPiecesADetacher = preparerLesPiecesADetacher;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const contexte_audit_1 = require("../../common/audit/contexte-audit");
const extension_perimetre_journaux_1 = require("../../common/perimetre/extension-perimetre-journaux");
function descriptionDeLEcriture(e) {
    const date = e.date.toISOString().slice(0, 10).split('-').reverse().join('/');
    const texte = `${e.journal.code} n° ${e.numeroPiece ?? 'sans numéro'} du ${date} · ${e.libelle}`;
    return Array.from(texte).slice(0, 190).join('');
}
function motifRefusDepotEcriture(e) {
    if (e.estANouveauProvisoire) {
        return ("L'à-nouveau provisoire se recalcule à chaque relance et disparaît à la clôture · une pièce ne s'y joint pas. " +
            "Joignez-la à l'écriture d'ouverture qui fait foi (report de clôture ou bilan d'ouverture importé).");
    }
    return null;
}
function motifRefusRetraitEcriture(e) {
    if (e.statut !== client_1.StatutEcriture.VALIDEE)
        return null;
    return (`Cette pièce justifie l'écriture ${e.journal.code} n° ${e.numeroPiece ?? 'sans numéro'}, validée · elle se conserve ` +
        "avec elle et ne se retire plus (AUDCIF art. 22, 2° et 7° ; art. 24). Une erreur de pièce se corrige en joignant la " +
        'bonne, dont le commentaire dit laquelle elle remplace.');
}
function motifHorsPerimetreEcriture(journal) {
    const autorises = (0, contexte_audit_1.acteurCourant)()?.journauxAutorises;
    if (!(0, extension_perimetre_journaux_1.journalHorsPerimetre)(journal.id, autorises))
        return null;
    const ou = journal.code ? `au journal ${journal.code}` : 'à une écriture retirée depuis (pièce détachée)';
    return (`Cette pièce est jointe ${ou}, hors de votre périmètre de saisie · joindre ou retirer la pièce d'une écriture est ` +
        "une saisie sur son journal. La consultation et le téléchargement restent ouverts ; l'administrateur du dossier " +
        'règle les journaux autorisés dans la fenêtre Utilisateurs.');
}
async function lireEcritureDesPieces(db, tenantId, ecritureId) {
    const e = await db.ecriture.findFirst({
        where: { id: ecritureId, tenantId },
        select: {
            statut: true,
            estANouveauProvisoire: true,
            numeroPiece: true,
            date: true,
            libelle: true,
            journalId: true,
            journal: { select: { code: true } },
        },
    });
    if (!e)
        return null;
    return {
        description: descriptionDeLEcriture(e),
        motifRefusDepot: motifRefusDepotEcriture(e),
        motifRefusRetrait: motifRefusRetraitEcriture(e),
        motifHorsPerimetre: motifHorsPerimetreEcriture({ id: e.journalId, code: e.journal.code }),
    };
}
async function verrouillerEcriture(db, tenantId, ecritureId) {
    await db.$queryRaw `SELECT "id", "statut" FROM "ecritures" WHERE "id" = ${ecritureId} AND "tenantId" = ${tenantId} FOR UPDATE`;
}
exports.REGLE_PIECES_ECRITURE = {
    objet: 'ECRITURE',
    designation: 'cette écriture',
    lireObjet: lireEcritureDesPieces,
    verrouiller: verrouillerEcriture,
    motifHorsPerimetreDetachee: () => motifHorsPerimetreEcriture({ id: null, code: null }),
};
const LOT_PIECES = 200;
const SANS_BINAIRE = { id: true, ecritureId: true, ecritureDecrite: true };
async function reporterLesPieces(tx, tenantId, ancienneId, nouvelleId) {
    await verrouillerEcriture(tx, tenantId, ancienneId);
    const nouvelle = await lireEcritureDesPieces(tx, tenantId, nouvelleId);
    if (!nouvelle) {
        throw new common_1.ConflictException("L'écriture qui remplace la pièce a été retirée pendant le geste · rien n'est modifié.");
    }
    let reportees = 0;
    for (;;) {
        const lot = await tx.pieceJointeEcriture.findMany({
            where: { tenantId, ecritureId: ancienneId },
            orderBy: { id: 'asc' },
            take: LOT_PIECES,
            select: { id: true, nomFichier: true },
        });
        if (lot.length === 0)
            return reportees;
        for (const p of lot) {
            try {
                await tx.pieceJointeEcriture.update({
                    where: { id: p.id },
                    data: { ecritureId: nouvelleId, ecritureDecrite: nouvelle.description },
                    select: SANS_BINAIRE,
                });
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    throw new common_1.ConflictException(`La pièce « ${p.nomFichier} » est déjà jointe à l'écriture qui remplace (même contenu) · rien n'est modifié. ` +
                        "Retirez l'un des deux exemplaires, puis relancez.");
                }
                throw e;
            }
            reportees++;
        }
    }
}
async function retoucherDescriptionDesPieces(tx, tenantId, ecritureId) {
    const nombre = await tx.pieceJointeEcriture.count({ where: { tenantId, ecritureId } });
    return nombre === 0 ? 0 : refaireLesDescriptions(tx, tenantId, ecritureId);
}
async function refaireLesDescriptions(tx, tenantId, ecritureId) {
    const e = await lireEcritureDesPieces(tx, tenantId, ecritureId);
    if (!e)
        return 0;
    let retouchees = 0;
    for (;;) {
        const lot = await tx.pieceJointeEcriture.findMany({
            where: { tenantId, ecritureId, NOT: { ecritureDecrite: e.description } },
            orderBy: { id: 'asc' },
            take: LOT_PIECES,
            select: { id: true },
        });
        if (lot.length === 0)
            return retouchees;
        for (const p of lot) {
            await tx.pieceJointeEcriture.update({ where: { id: p.id }, data: { ecritureDecrite: e.description }, select: SANS_BINAIRE });
            retouchees++;
        }
    }
}
async function preparerLesPiecesADetacher(tx, tenantId, ecritureId) {
    await verrouillerEcriture(tx, tenantId, ecritureId);
    const nombre = await tx.pieceJointeEcriture.count({ where: { tenantId, ecritureId } });
    if (nombre > 0)
        await refaireLesDescriptions(tx, tenantId, ecritureId);
    return nombre;
}
//# sourceMappingURL=pieces-jointes-ecriture.js.map