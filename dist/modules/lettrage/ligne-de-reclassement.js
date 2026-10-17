"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_LETTRAGE_PERTE_AVEC_TVA = exports.MOTIF_LETTRAGE_RECLASSEMENT = void 0;
exports.lignesDuCompteClientReclasse = lignesDuCompteClientReclasse;
exports.lignesReclasseesDuCompte = lignesReclasseesDuCompte;
exports.reportsDuReclassementParIdentifiants = reportsDuReclassementParIdentifiants;
exports.lignesDeLaPerteAvecTva = lignesDeLaPerteAvecTva;
exports.refuserLignesDuCompteClientReclasse = refuserLignesDuCompteClientReclasse;
exports.lignesMisesDeCote = lignesMisesDeCote;
exports.messageMiseDeCote = messageMiseDeCote;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
exports.MOTIF_LETTRAGE_RECLASSEMENT = "Ne lettrez pas la facture avec le reclassement · cette ligne est le crédit du compte du client par le reclassement d'une " +
    "créance douteuse ou litigieuse au 416, et le reclassement ne lettre pas ce compte. Lettrée, le calcul de la TVA la lirait " +
    "comme un encaissement (décret n° 011/42, art. 57), et la TVA d'une prestation de services deviendrait exigible sans " +
    "qu'aucun prix ne soit perçu (O.-L. n° 10/001, art. 25, 2°) ; figé ensuite par une clôture, le groupe ne se déferait plus " +
    "et le reclassement ne s'annulerait plus. La créance se suit dans « Créances douteuses ou litigieuses » ; le traitement de " +
    'sa TVA se déclare par le cabinet lui-même pour l’instant.';
const RECLASSEMENT_EN_VIGUEUR = { annuleeLe: null };
async function lignesDuCompteClientReclasse(db, tenantId, ligneIds) {
    if (ligneIds.length === 0)
        return new Set();
    const lues = (await db.ligneEcriture.findMany({
        where: { id: { in: [...ligneIds] }, ecriture: { tenantId, creanceDouteuseReclassement: { is: RECLASSEMENT_EN_VIGUEUR } } },
        select: { id: true, compteId: true, ecriture: { select: { creanceDouteuseReclassement: { select: { compteCreanceId: true } } } } },
    }));
    return new Set(lues.filter((l) => l.ecriture?.creanceDouteuseReclassement != null && l.ecriture.creanceDouteuseReclassement.compteCreanceId === l.compteId).map((l) => l.id));
}
async function lignesReclasseesDuCompte(db, tenantId, compteId) {
    const lues = (await db.ligneEcriture.findMany({
        where: {
            compteId,
            lettrageId: null,
            ecriture: { tenantId, creanceDouteuseReclassement: { is: { ...RECLASSEMENT_EN_VIGUEUR, compteCreanceId: compteId } } },
        },
        select: { id: true, compteId: true, ecriture: { select: { creanceDouteuseReclassement: { select: { compteCreanceId: true } } } } },
    }));
    const reclassees = new Set(lues
        .filter((l) => l.ecriture?.creanceDouteuseReclassement != null && l.ecriture.creanceDouteuseReclassement.compteCreanceId === compteId)
        .map((l) => l.id));
    const ouverts = (await db.ligneEcriture.findMany({
        where: { compteId, lettrageId: null, libelle: { startsWith: PREFIXE_REPORT_DETAIL }, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION } },
        select: SELECT_LIGNE_DE_REPORT,
    }));
    for (const id of await reportsDuReclassement(db, tenantId, ouverts))
        reclassees.add(id);
    return reclassees;
}
const PREFIXE_REPORT_DETAIL = 'RAN détail ';
const PREFIXE_REPORT = /^RAN détail \S+ · /;
const SELECT_LIGNE_DE_REPORT = { id: true, compteId: true, debit: true, credit: true, dateEcheance: true, libelle: true };
function libelleDOrigine(libelle) {
    let s = libelle;
    while (PREFIXE_REPORT.test(s))
        s = s.replace(PREFIXE_REPORT, '');
    return s;
}
function cle(compteId, debit, credit, echeance, libelle) {
    return [compteId, Math.round(Number(debit) * 100), Math.round(Number(credit) * 100), echeance?.getTime() ?? '', libelle].join('|');
}
async function reportsDuReclassement(db, tenantId, candidates) {
    const reports = candidates.filter((c) => typeof c.libelle === 'string' && PREFIXE_REPORT.test(c.libelle));
    if (reports.length === 0)
        return new Set();
    const comptes = [...new Set(reports.map((r) => r.compteId))];
    const origines = (await db.ligneEcriture.findMany({
        where: { compteId: { in: comptes }, ecriture: { tenantId, creanceDouteuseReclassement: { is: RECLASSEMENT_EN_VIGUEUR } } },
        select: { ...SELECT_LIGNE_DE_REPORT, ecriture: { select: { libelle: true, creanceDouteuseReclassement: { select: { compteCreanceId: true } } } } },
    }));
    const cles = new Set(origines
        .filter((o) => o.ecriture?.creanceDouteuseReclassement != null && o.ecriture.creanceDouteuseReclassement.compteCreanceId === o.compteId)
        .map((o) => cle(o.compteId, o.debit, o.credit, o.dateEcheance, o.libelle ?? o.ecriture?.libelle ?? '')));
    if (cles.size === 0)
        return new Set();
    return new Set(reports.filter((r) => cles.has(cle(r.compteId, r.debit, r.credit, r.dateEcheance, libelleDOrigine(r.libelle)))).map((r) => r.id));
}
async function reportsDuReclassementParIdentifiants(db, tenantId, ligneIds) {
    if (ligneIds.length === 0)
        return new Set();
    const lues = (await db.ligneEcriture.findMany({
        where: { id: { in: [...ligneIds] }, libelle: { startsWith: PREFIXE_REPORT_DETAIL }, ecriture: { tenantId } },
        select: SELECT_LIGNE_DE_REPORT,
    }));
    return reportsDuReclassement(db, tenantId, lues);
}
exports.MOTIF_LETTRAGE_PERTE_AVEC_TVA = "Ne lettrez pas cette ligne avec une facture · elle appartient à la perte d'une créance irrécouvrable qui récupère la TVA " +
    '(retour au compte du client, perte, ou leurs négatifs), que le module lettre lui-même. Rapprochée de la facture, elle serait ' +
    'lue par le calcul de la TVA comme un encaissement (décret n° 011/42, art. 57).';
const SELECT_LIAISON_PERTE = {
    mouvementCreanceDouteuse: { select: { ecriturePerteId: true, creance: { select: { compteCreanceId: true } } } },
    mouvementCreanceDouteusePerte: { select: { creance: { select: { compteCreanceId: true } } } },
};
function compteDeLaPerte(e) {
    if (!e)
        return null;
    if (e.mouvementCreanceDouteuse?.ecriturePerteId != null && e.mouvementCreanceDouteuse.creance)
        return e.mouvementCreanceDouteuse.creance.compteCreanceId;
    if (e.mouvementCreanceDouteusePerte?.creance)
        return e.mouvementCreanceDouteusePerte.creance.compteCreanceId;
    return null;
}
async function lignesDeLaPerteAvecTva(db, tenantId, ligneIds) {
    if (ligneIds.length === 0)
        return new Set();
    const liee = { OR: [{ mouvementCreanceDouteuse: { is: { ecriturePerteId: { not: null } } } }, { mouvementCreanceDouteusePerte: { isNot: null } }] };
    const lues = (await db.ligneEcriture.findMany({
        where: { id: { in: [...ligneIds] }, ecriture: { tenantId, OR: [liee, { corrigeEcriture: { is: liee } }] } },
        select: { id: true, compteId: true, ecriture: { select: { ...SELECT_LIAISON_PERTE, corrigeEcriture: { select: SELECT_LIAISON_PERTE } } } },
    }));
    return new Set(lues.filter((l) => (compteDeLaPerte(l.ecriture) ?? compteDeLaPerte(l.ecriture?.corrigeEcriture)) === l.compteId).map((l) => l.id));
}
async function refuserLignesDuCompteClientReclasse(db, tenantId, ligneIds, dejaDuGroupe = []) {
    const toutes = [...new Set([...ligneIds, ...dejaDuGroupe])];
    const tenues = await lignesDuCompteClientReclasse(db, tenantId, toutes);
    if (tenues.size > 0)
        throw new common_1.BadRequestException(exports.MOTIF_LETTRAGE_RECLASSEMENT);
    const reports = await reportsDuReclassementParIdentifiants(db, tenantId, toutes);
    if (reports.size > 0)
        throw new common_1.BadRequestException(exports.MOTIF_LETTRAGE_RECLASSEMENT);
    const pertes = await lignesDeLaPerteAvecTva(db, tenantId, toutes);
    if (pertes.size > 0)
        throw new common_1.BadRequestException(exports.MOTIF_LETTRAGE_PERTE_AVEC_TVA);
}
function lignesMisesDeCote(lignes, reclassees) {
    const rs = lignes.filter((l) => reclassees.has(l.id));
    return { ecartees: new Set(rs.map((r) => r.id)), passesParMontantSuspendues: rs.length > 0 };
}
function messageMiseDeCote(nombre, suspendues) {
    if (!suspendues)
        return null;
    return (`Un reclassement en créance douteuse ou litigieuse est ouvert sur ce compte, et rien ne dit quelles factures il a ` +
        `reclassées · aucun rapprochement par montant n'est fait (${nombre} ligne(s) laissée(s) ouverte(s)), seuls ceux par ` +
        `référence de pièce le sont. Lettrez le reste à la main, sans jamais lettrer une facture avec le reclassement.`);
}
//# sourceMappingURL=ligne-de-reclassement.js.map