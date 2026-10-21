"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErreurMaillonDansTransaction = void 0;
exports.selectPreImage = selectPreImage;
exports.ajouterMaillon = ajouterMaillon;
exports.intercepterEcriture = intercepterEcriture;
exports.extensionAudit = extensionAudit;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const contexte_audit_1 = require("./contexte-audit");
const champs_audites_1 = require("./champs-audites");
const empreinte_audit_1 = require("./empreinte-audit");
const journal = new common_1.Logger('JournalAudit');
const ACTIONS = {
    create: 'CREATION',
    createMany: 'CREATION',
    createManyAndReturn: 'CREATION',
    update: 'MODIFICATION',
    updateMany: 'MODIFICATION',
    upsert: 'MODIFICATION',
    delete: 'SUPPRESSION',
    deleteMany: 'SUPPRESSION',
};
const selectsPreImage = new Map();
function selectPreImage(model) {
    const connu = selectsPreImage.get(model);
    if (connu)
        return connu;
    const champs = client_1.Prisma.dmmf.datamodel.models.find((m) => m.name === model)?.fields ?? [];
    const binaires = champs.some((f) => f.kind === 'scalar' && f.type === 'Bytes');
    const resultat = binaires
        ? {
            select: Object.fromEntries(champs
                .filter((f) => (f.kind === 'scalar' && f.type !== 'Bytes') || f.kind === 'enum')
                .map((f) => [f.name, true])),
        }
        : {};
    selectsPreImage.set(model, resultat);
    return resultat;
}
async function ajouterMaillon(base, evenement) {
    return base.$transaction((tx) => ecrireMaillon(tx, evenement, false));
}
async function ecrireMaillon(tx, evenement, lectureBrute) {
    {
        const cle = evenement.tenantId ?? 'plateforme';
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${cle}))`;
        const precedent = lectureBrute
            ? ((await tx.$queryRaw `
            SELECT rang, empreinte FROM evenements_audit
            WHERE "tenantId" IS NOT DISTINCT FROM ${evenement.tenantId}::text
            ORDER BY rang DESC LIMIT 1`)[0] ?? null)
            : await tx.evenementAudit.findFirst({
                where: { tenantId: evenement.tenantId },
                orderBy: { rang: 'desc' },
                select: { rang: true, empreinte: true },
            });
        const rang = (precedent?.rang ?? 0) + 1;
        const empreintePrecedente = precedent?.empreinte ?? empreinte_audit_1.EMPREINTE_ORIGINE;
        const horodatage = new Date();
        const empreinte = (0, empreinte_audit_1.calculerEmpreinte)({ ...evenement, rang, horodatage, empreintePrecedente });
        await tx.evenementAudit.create({
            data: {
                tenantId: evenement.tenantId,
                rang,
                horodatage,
                acteurId: evenement.acteurId,
                acteurEmail: evenement.acteurEmail,
                adresseIp: evenement.adresseIp,
                action: evenement.action,
                entite: evenement.entite,
                entiteId: evenement.entiteId,
                avant: (evenement.avant ?? client_1.Prisma.DbNull),
                apres: (evenement.apres ?? client_1.Prisma.DbNull),
                empreintePrecedente,
                empreinte,
            },
        });
        return { rang, empreinte };
    }
}
class ErreurMaillonDansTransaction extends Error {
    constructor(model, operation, cause) {
        super(`Maillon d'audit NON écrit dans la transaction · ${model}.${operation} · ${cause instanceof Error ? cause.message : cause}`);
        this.cause = cause;
    }
}
exports.ErreurMaillonDansTransaction = ErreurMaillonDansTransaction;
function identifiant(resultat, args) {
    const r = resultat;
    if (r && typeof r === 'object' && typeof r.id === 'string')
        return r.id;
    const w = args?.where;
    if (w && typeof w.id === 'string')
        return w.id;
    return null;
}
function dossier(model, avant, apres, secours) {
    if (model === 'Tenant') {
        for (const source of [apres, avant]) {
            const s = source;
            if (s && typeof s === 'object' && typeof s.id === 'string')
                return s.id;
        }
    }
    for (const source of [apres, avant]) {
        const s = source;
        if (s && typeof s === 'object' && typeof s.tenantId === 'string')
            return s.tenantId;
    }
    return secours;
}
async function intercepterEcriture(base, contexte) {
    const { model, operation, args, query } = contexte;
    const action = ACTIONS[operation];
    if (!action || !champs_audites_1.MODELES_AUDITES.has(model))
        return query(args);
    const a = args;
    let avant = null;
    const cible = ['update', 'delete', 'upsert'].includes(operation);
    if (cible && a.where) {
        try {
            avant = await base[model.charAt(0).toLowerCase() + model.slice(1)].findFirst({ where: a.where, ...selectPreImage(model) });
        }
        catch {
            avant = null;
        }
    }
    const resultat = await query(args);
    try {
        const acteur = (0, contexte_audit_1.acteurCourant)();
        const exclues = (0, champs_audites_1.colonnesExclues)(model);
        const apres = ['delete', 'deleteMany'].includes(operation) ? null : resultat;
        const estMasse = ['createMany', 'createManyAndReturn', 'updateMany', 'deleteMany'].includes(operation);
        const evenement = {
            tenantId: dossier(model, avant, apres, acteur?.tenantId ?? null),
            acteurId: acteur?.acteurId ?? null,
            acteurEmail: acteur?.acteurEmail ?? contexte_audit_1.ACTEUR_SYSTEME,
            adresseIp: acteur?.adresseIp ?? null,
            action,
            entite: model,
            entiteId: estMasse ? null : identifiant(resultat, a),
            avant: (0, champs_audites_1.masquer)(avant, exclues),
            apres: estMasse
                ? (0, champs_audites_1.masquer)({ operation, filtre: a.where ?? null, resultat }, exclues)
                : (0, champs_audites_1.masquer)(apres, exclues),
        };
        const tx = (0, contexte_audit_1.transactionAuditee)();
        if (tx) {
            await ecrireMaillon(tx, evenement, true).catch((erreur) => {
                throw new ErreurMaillonDansTransaction(model, operation, erreur);
            });
        }
        else {
            await ajouterMaillon(base, evenement);
        }
    }
    catch (erreur) {
        if (erreur instanceof ErreurMaillonDansTransaction)
            throw erreur;
        journal.error(`Maillon d'audit NON écrit · ${model}.${operation} · ${erreur instanceof Error ? erreur.message : erreur}`);
    }
    return resultat;
}
function extensionAudit(base) {
    return client_1.Prisma.defineExtension({
        name: 'journal-audit',
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    return intercepterEcriture(base, { model, operation, args, query });
                },
            },
        },
    });
}
//# sourceMappingURL=extension-audit.js.map