"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_HORS_PERIMETRE = void 0;
exports.journalHorsPerimetre = journalHorsPerimetre;
exports.garderPerimetreJournaux = garderPerimetreJournaux;
exports.extensionPerimetreJournaux = extensionPerimetreJournaux;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const contexte_audit_1 = require("../audit/contexte-audit");
function journalHorsPerimetre(journalId, autorises) {
    if (!autorises)
        return false;
    return !journalId || !autorises.includes(journalId);
}
exports.MESSAGE_HORS_PERIMETRE = "Ce journal n'est pas dans votre périmètre de saisie · l'administrateur du dossier a restreint vos écritures aux journaux cochés dans la fenêtre Utilisateurs.";
const CREATIONS = ['create', 'createMany', 'createManyAndReturn'];
const MODIFICATIONS = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
function journalDeLaDonnee(data) {
    const d = data;
    if (!d)
        return undefined;
    if (d.journalId !== undefined)
        return d.journalId;
    return d.journal?.connect?.id;
}
const CHAMPS_HORS_SAISIE = new Set(['lettre', 'lettrageId', 'lettrage', 'rapprochementId', 'rapprochement', 'ligneReleveId', 'ligneReleve']);
function toucheLaSaisie(data) {
    if (!data || typeof data !== 'object')
        return false;
    return Object.keys(data).some((k) => !CHAMPS_HORS_SAISIE.has(k));
}
function ecritureDeLaDonnee(data) {
    const d = data;
    return d?.ecritureId ?? d?.ecriture?.connect?.id;
}
async function garderLignes(base, operation, a, autorises) {
    const verifierEcritures = async (ids) => {
        const connus = ids.filter((x) => !!x);
        if (connus.length === 0)
            return;
        const e = (await base.ecriture.findMany({ where: { id: { in: connus } }, select: { journalId: true } }));
        if (e.some((x) => journalHorsPerimetre(x.journalId, autorises)))
            throw new common_1.ForbiddenException(exports.MESSAGE_HORS_PERIMETRE);
    };
    if (CREATIONS.includes(operation)) {
        const donnees = Array.isArray(a.data) ? a.data : [a.data];
        await verifierEcritures(donnees.map(ecritureDeLaDonnee));
        return;
    }
    if (!MODIFICATIONS.includes(operation))
        return;
    const donnee = operation === 'upsert' ? a.update : a.data;
    const suppression = operation === 'delete' || operation === 'deleteMany';
    if (!suppression && !toucheLaSaisie(donnee) && !(operation === 'upsert' && a.create))
        return;
    await verifierEcritures([ecritureDeLaDonnee(donnee), operation === 'upsert' ? ecritureDeLaDonnee(a.create) : undefined]);
    const visees = (await base.ligneEcriture.findMany({
        where: a.where,
        select: { ecriture: { select: { journalId: true } } },
    }));
    if (visees.some((l) => journalHorsPerimetre(l.ecriture.journalId, autorises))) {
        throw new common_1.ForbiddenException(exports.MESSAGE_HORS_PERIMETRE);
    }
}
async function garderPerimetreJournaux(base, contexte) {
    const { model, operation, args, query } = contexte;
    if (model !== 'Ecriture' && model !== 'LigneEcriture')
        return query(args);
    const autorises = (0, contexte_audit_1.acteurCourant)()?.journauxAutorises;
    if (!autorises)
        return query(args);
    if (model === 'LigneEcriture') {
        await garderLignes(base, operation, args, autorises);
        return query(args);
    }
    const a = args;
    if (CREATIONS.includes(operation)) {
        const donnees = Array.isArray(a.data) ? a.data : [a.data];
        if (donnees.some((d) => journalHorsPerimetre(journalDeLaDonnee(d), autorises))) {
            throw new common_1.ForbiddenException(exports.MESSAGE_HORS_PERIMETRE);
        }
        return query(args);
    }
    if (MODIFICATIONS.includes(operation)) {
        const nouveau = journalDeLaDonnee(operation === 'upsert' ? a.update : a.data);
        if (nouveau !== undefined && journalHorsPerimetre(nouveau, autorises)) {
            throw new common_1.ForbiddenException(exports.MESSAGE_HORS_PERIMETRE);
        }
        if (operation === 'upsert' && journalHorsPerimetre(journalDeLaDonnee(a.create), autorises)) {
            throw new common_1.ForbiddenException(exports.MESSAGE_HORS_PERIMETRE);
        }
        const visees = (await base.ecriture.findMany({ where: a.where, select: { journalId: true } }));
        if (visees.some((e) => journalHorsPerimetre(e.journalId, autorises))) {
            throw new common_1.ForbiddenException(exports.MESSAGE_HORS_PERIMETRE);
        }
        return query(args);
    }
    return query(args);
}
function extensionPerimetreJournaux(base) {
    return client_1.Prisma.defineExtension({
        name: 'perimetre-journaux',
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    return garderPerimetreJournaux(base, { model, operation, args, query });
                },
            },
        },
    });
}
//# sourceMappingURL=extension-perimetre-journaux.js.map