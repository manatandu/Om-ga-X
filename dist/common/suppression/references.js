"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referencesVers = referencesVers;
exports.libelleReference = libelleReference;
exports.refuserSiReferences = refuserSiReferences;
exports.reporterReferences = reporterReferences;
exports.identifiantsUtilises = identifiantsUtilises;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const modeles_cloisonnes_1 = require("../cloisonnement/modeles-cloisonnes");
const LIBELLES = {
    'LigneEcriture.compteId': "lignes d'écriture (compte mouvementé)",
    'LigneEcriture.tauxTvaId': "lignes d'écriture portant ce taux",
    'Lettrage.compteId': 'lettrages',
    'RapprochementBancaire.compteId': 'rapprochements bancaires',
    'Ecriture.journalId': 'écritures (journal mouvementé)',
    'Journal.compteTresorerieId': 'journaux de trésorerie',
    'TauxTva.compteCollecteId': 'taux de taxes (TVA collectée)',
    'TauxTva.compteDeductibleId': 'taux de taxes (TVA déductible)',
    'Compte.tauxTvaDefautId': 'comptes qui le proposent par défaut',
    'TiersCompte.compteId': 'rattachement à un tiers',
    'LigneModeleSaisie.compteId': 'modèles de saisie',
    'TiersCompte.tiersId': 'comptes rattachés',
    'Relance.tiersId': 'relances',
    'Consignation.tiersId': 'consignations',
    'DocumentTiers.tiersId': 'documents attachés (volet Documents de la fiche)',
    'PieceJointeSection.sectionId': 'documents joints (volet Documents de la section)',
    'PieceJointeImmobilisation.immobilisationId': 'documents joints (volet Documents de la fiche)',
    'PieceJointeSalarie.salarieId': 'documents joints (volet Documents de la fiche)',
    'AmortissementDerogatoire.exerciceId': 'amortissements dérogatoires',
    'AvanceSalaire.salarieId': 'avances et prêts au personnel',
    'RibTiers.tiersId': 'coordonnées bancaires (volet de la fiche)',
    'LigneOrdreVirement.tiersId': 'ordres de virement',
    'AbonnementCabinet.tiersId': 'abonnement OmegaX facturé à ce client (console de l’éditeur)',
    'OrdreVirement.journalId': 'ordres de virement',
    'LigneOrdreVirement.ecritureId': 'ordres de virement',
    'DemandeConfirmation.tiersId': 'demandes de confirmation',
    'ModeleSaisie.journalId': 'modèles de saisie',
    'Immobilisation.compteImmobilisationId': 'immobilisations',
    'Immobilisation.compteEnCoursId': 'immobilisations en cours',
    'FamilleImmobilisation.compteImmobilisationId': "familles d'immobilisations",
    'Facture.tiersId': 'factures',
    'Devis.tiersId': 'devis',
    'Cloture.journalId': 'clôtures de journal',
    'ImpressionJournal.journalId': 'impressions du journal',
    'ModeleSaisie.sequenceSaisieId': 'modèles de saisie',
    'ModeReglement.journalId': 'modes de règlement (journal proposé)',
    'Tiers.modeReglementId': 'tiers (mode habituel)',
    'LigneEcriture.modeReglementId': "lignes d'écriture portant ce mode",
    'ModeleReglement.modeReglementId': 'modèles de règlement',
    'EcheanceReglement.modeReglementId': 'échéances de modèles de règlement',
    'LieuLivraison.tiersId': 'lieux de livraison',
    'Tiers.modeleImpressionExtraitId': "tiers (modèle de l'extrait de compte)",
    'Tiers.modeleImpressionReglementId': "tiers (modèle de l'avis de règlement)",
    'Tiers.modeleImpressionRappelId': 'tiers (modèle du rappel)',
    'RibBanque.journalId': 'RIB bancaire rattaché (Structure > Banques)',
    'VentilationAnalytique.sectionId': 'ventilations analytiques',
    'LigneOdAnalytique.sectionId': "lignes d'OD analytique",
    'EngagementDepense.sectionId': 'engagements de dépense',
    'OdAnalytique.planId': 'OD analytiques',
    'CleRepartition.sectionSourceId': 'clés de répartition (section répartie)',
    'LigneCleRepartition.sectionCibleId': 'clés de répartition (section receveuse)',
    'CleRepartition.planId': 'clés de répartition',
    'CoutProductionDeclare.sectionId': 'données du coût de production',
    'LigneRepartitionAnalytiquePaie.sectionId': 'répartitions analytiques de la paie',
    'RepartitionAnalytiquePaie.planId': 'répartitions analytiques de la paie',
};
function relationsVers(cible, exclure) {
    const liens = [];
    for (const m of client_1.Prisma.dmmf.datamodel.models) {
        for (const f of m.fields) {
            if (f.kind !== 'object' || f.type !== cible)
                continue;
            const fk = f.relationFromFields ?? [];
            if (fk.length !== 1)
                continue;
            const cle = `${m.name}.${fk[0]}`;
            if (exclure.includes(cle))
                continue;
            liens.push({ modele: m.name, champ: fk[0], cloisonne: modeles_cloisonnes_1.MODELES_CLOISONNES.has(m.name) });
        }
    }
    return liens;
}
async function referencesVers(prisma, cible, id, tenantId, exclure = []) {
    const client = prisma;
    const refs = [];
    for (const lien of relationsVers(cible, exclure)) {
        const delegue = client[lien.modele.charAt(0).toLowerCase() + lien.modele.slice(1)];
        const where = { [lien.champ]: Array.isArray(id) ? { in: id } : id };
        if (lien.cloisonne)
            where.tenantId = tenantId;
        const nombre = await delegue.count({ where });
        if (nombre > 0)
            refs.push({ modele: lien.modele, champ: lien.champ, nombre });
    }
    return refs;
}
function libelleReference(r) {
    return `${LIBELLES[`${r.modele}.${r.champ}`] ?? r.modele} (${r.nombre})`;
}
function refuserSiReferences(objet, refs) {
    if (refs.length === 0)
        return;
    throw new common_1.ConflictException(`${objet} ne peut pas être supprimé · il est utilisé : ${refs.map(libelleReference).join(', ')}. ` +
        'Mettez-le en sommeil pour qu’il ne soit plus proposé.');
}
async function reporterReferences(prisma, cible, sourceId, cibleId, tenantId) {
    const client = prisma;
    const reportees = [];
    for (const lien of relationsVers(cible, [])) {
        const delegue = client[lien.modele.charAt(0).toLowerCase() + lien.modele.slice(1)];
        const where = { [lien.champ]: sourceId };
        if (lien.cloisonne)
            where.tenantId = tenantId;
        const { count } = await delegue.updateMany({ where, data: { [lien.champ]: cibleId } });
        if (count > 0)
            reportees.push({ modele: lien.modele, champ: lien.champ, nombre: count });
    }
    return reportees;
}
async function identifiantsUtilises(prisma, cible, ids, tenantId, exclure = []) {
    const utilises = new Set();
    if (ids.length === 0)
        return utilises;
    const client = prisma;
    const LOT = 10_000;
    let restants = [...new Set(ids)];
    for (const lien of relationsVers(cible, exclure)) {
        if (restants.length === 0)
            break;
        const delegue = client[lien.modele.charAt(0).toLowerCase() + lien.modele.slice(1)];
        for (let i = 0; i < restants.length; i += LOT) {
            const where = { [lien.champ]: { in: restants.slice(i, i + LOT) } };
            if (lien.cloisonne)
                where.tenantId = tenantId;
            const groupes = await delegue.groupBy({ by: [lien.champ], where });
            for (const g of groupes) {
                const v = g[lien.champ];
                if (v)
                    utilises.add(v);
            }
        }
        restants = restants.filter((id) => !utilises.has(id));
    }
    return utilises;
}
//# sourceMappingURL=references.js.map