"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL = void 0;
exports.messageJournalDeSituation = messageJournalDeSituation;
exports.motifEcartJournalDeSituation = motifEcartJournalDeSituation;
exports.garderJournalDeSituation = garderJournalDeSituation;
exports.extensionJournalDeSituation = extensionJournalDeSituation;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const contexte_audit_1 = require("../audit/contexte-audit");
const contexte_cloisonnement_1 = require("../cloisonnement/contexte-cloisonnement");
exports.MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL = "Une écriture de situation ne vit que dans un journal de type Situation · elle n'enregistre aucune opération et " +
    "n'entre jamais au livre-journal (AUDCIF art. 19 ; art. 22, 1°). Passez l'opération dans un journal ordinaire.";
function messageJournalDeSituation(code) {
    return (`Le journal ${code} est un journal de situation · ses écritures n'entrent jamais au livre-journal et ne se ` +
        "valident pas (AUDCIF art. 19 ; art. 22, 1°). Seule la saisie y écrit · passez l'opération dans un journal ordinaire.");
}
const SITUATION = 'SITUATION';
const CREATIONS = ['create', 'createMany', 'createManyAndReturn'];
const MODIFICATIONS = ['update', 'updateMany', 'upsert'];
function journalDe(d) {
    if (!d)
        return undefined;
    if (d.journalId !== undefined)
        return d.journalId;
    return d.journal?.connect?.id;
}
function statutDe(d) {
    if (!d || d.statut === undefined)
        return undefined;
    return typeof d.statut === 'string' ? d.statut : d.statut?.set;
}
function motifEcartJournalDeSituation(journal, statut) {
    if (journal.situation && statut !== SITUATION)
        return messageJournalDeSituation(journal.code);
    if (!journal.situation && statut === SITUATION)
        return exports.MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL;
    return null;
}
function lecteurDe(base) {
    const tx = (0, contexte_audit_1.transactionAuditee)();
    const lisibleDansLaTransaction = (0, contexte_cloisonnement_1.raisonHorsCloisonnement)() !== undefined ||
        !!(0, contexte_audit_1.acteurCourant)()?.tenantId ||
        ((0, contexte_cloisonnement_1.perimetreCourant)()?.size ?? 0) > 0;
    const brut = base;
    return { lecteur: tx && lisibleDansLaTransaction ? tx : brut, base: brut };
}
function dossierNomme(d) {
    if (!d)
        return undefined;
    if (typeof d.tenantId === 'string')
        return d.tenantId;
    const connecte = d.tenant?.connect?.id;
    return typeof connecte === 'string' ? connecte : undefined;
}
async function journauxDe(l, demandes) {
    const parDossier = new Map();
    for (const d of demandes) {
        const ids = parDossier.get(d.tenantId) ?? new Set();
        ids.add(d.journalId);
        parDossier.set(d.tenantId, ids);
    }
    const resultat = new Map();
    for (const [tenantId, ids] of parDossier) {
        const where = tenantId ? { tenantId, id: { in: [...ids] } } : { id: { in: [...ids] } };
        const source = tenantId ? l.lecteur : l.base;
        const lus = await source.journal.findMany({ where, select: { id: true, code: true, type: true } });
        for (const j of lus)
            resultat.set(j.id, { situation: j.type === SITUATION, code: j.code });
    }
    return resultat;
}
async function garderCreations(l, donnees) {
    const demandes = [];
    for (const d of donnees) {
        const journalId = journalDe(d);
        if (journalId)
            demandes.push({ journalId, tenantId: dossierNomme(d) });
    }
    const journaux = await journauxDe(l, demandes);
    for (const d of donnees) {
        const id = journalDe(d);
        const journal = id ? journaux.get(id) : undefined;
        if (!journal)
            continue;
        const motif = motifEcartJournalDeSituation(journal, statutDe(d) ?? 'BROUILLARD');
        if (motif)
            throw new common_1.BadRequestException(motif);
    }
}
async function garderJournalDeSituation(base, contexte) {
    const { model, operation, args, query } = contexte;
    if (model !== 'Ecriture')
        return query(args);
    const a = args;
    const l = lecteurDe(base);
    if (CREATIONS.includes(operation)) {
        await garderCreations(l, Array.isArray(a.data) ? a.data : a.data ? [a.data] : []);
        return query(args);
    }
    if (MODIFICATIONS.includes(operation)) {
        if (operation === 'upsert' && a.create)
            await garderCreations(l, [a.create]);
        const donnee = (operation === 'upsert' ? a.update : a.data);
        const nouveauStatut = statutDe(donnee);
        const nouveauJournal = journalDe(donnee);
        if (nouveauStatut === undefined && nouveauJournal === undefined)
            return query(args);
        const select = { journalId: true, statut: true, tenantId: true };
        const groupes = operation === 'updateMany'
            ? await l.lecteur.ecriture.groupBy({
                by: ['journalId', 'statut', 'tenantId'],
                where: a.where,
            })
            : await l.lecteur.ecriture
                .findFirst({ where: a.where, select })
                .then((e) => (e ? [e] : []));
        const journaux = await journauxDe(l, groupes.map((g) => ({ journalId: nouveauJournal ?? g.journalId, tenantId: g.tenantId })));
        for (const g of groupes) {
            const journal = journaux.get(nouveauJournal ?? g.journalId);
            if (!journal)
                continue;
            const motif = motifEcartJournalDeSituation(journal, nouveauStatut ?? g.statut);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        return query(args);
    }
    return query(args);
}
function extensionJournalDeSituation(base) {
    return client_1.Prisma.defineExtension({
        name: 'journal-de-situation',
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    return garderJournalDeSituation(base, { model, operation, args, query });
                },
            },
        },
    });
}
//# sourceMappingURL=extension-journal-de-situation.js.map