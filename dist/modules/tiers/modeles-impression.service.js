"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelesImpressionService = void 0;
exports.modeleDuDossierPourLaZone = modeleDuDossierPourLaZone;
exports.cadresDesTiers = cadresDesTiers;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const references_1 = require("../../common/suppression/references");
const modeles_impression_1 = require("./modeles-impression");
async function modeleDuDossierPourLaZone(prisma, tenantId, id, nature) {
    const modele = await prisma.modeleImpressionTiers.findFirst({ where: { id, tenantId }, select: { id: true, intitule: true, nature: true } });
    if (!modele)
        throw new common_1.NotFoundException("Modèle d'impression introuvable pour ce dossier.");
    const motif = (0, modeles_impression_1.motifRefusAttribution)(nature, modele);
    if (motif)
        throw new common_1.BadRequestException(motif);
    return modele;
}
async function cadresDesTiers(prisma, tenantId, tiersIds, nature, contexte, cadreParDefaut) {
    const cadres = new Map();
    const ids = [...new Set(tiersIds)];
    if (!ids.length)
        return cadres;
    const tiers = await prisma.tiers.findMany({
        where: { tenantId, id: { in: ids } },
        select: {
            id: true,
            nom: true,
            code: true,
            qualite: true,
            contact: true,
            adresse: true,
            boitePostale: true,
            ville: true,
            pays: true,
            modeleImpressionExtraitId: true,
            modeleImpressionReglementId: true,
            modeleImpressionRappelId: true,
        },
    });
    const colonne = modeles_impression_1.COLONNE_DU_TIERS[nature];
    if (cadreParDefaut !== undefined) {
        for (const t of tiers)
            cadres.set(t.id, (0, modeles_impression_1.cadreDuModele)({ intitule: null, texte: cadreParDefaut }, t, contexte));
    }
    const avecModele = tiers.filter((t) => t[colonne]);
    if (!avecModele.length)
        return cadres;
    const modeles = new Map((await prisma.modeleImpressionTiers.findMany({
        where: { tenantId, nature, id: { in: [...new Set(avecModele.map((t) => t[colonne]))] } },
        select: { id: true, intitule: true, texte: true },
    })).map((m) => [m.id, m]));
    for (const t of avecModele) {
        const modele = modeles.get(t[colonne]);
        if (modele)
            cadres.set(t.id, (0, modeles_impression_1.cadreDuModele)(modele, t, contexte));
    }
    return cadres;
}
let ModelesImpressionService = class ModelesImpressionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const [modeles, extraits, reglements, rappels] = await Promise.all([
            this.prisma.modeleImpressionTiers.findMany({
                where: { tenantId },
                orderBy: [{ nature: 'asc' }, { intitule: 'asc' }],
                take: modeles_impression_1.PLAFOND_MODELES_IMPRESSION,
                select: { id: true, nature: true, intitule: true, texte: true },
            }),
            this.prisma.tiers.groupBy({ by: ['modeleImpressionExtraitId'], where: { tenantId, modeleImpressionExtraitId: { not: null } }, _count: { _all: true } }),
            this.prisma.tiers.groupBy({ by: ['modeleImpressionReglementId'], where: { tenantId, modeleImpressionReglementId: { not: null } }, _count: { _all: true } }),
            this.prisma.tiers.groupBy({ by: ['modeleImpressionRappelId'], where: { tenantId, modeleImpressionRappelId: { not: null } }, _count: { _all: true } }),
        ]);
        const usages = new Map();
        for (const g of extraits)
            usages.set(g.modeleImpressionExtraitId, g._count._all);
        for (const g of reglements)
            usages.set(g.modeleImpressionReglementId, g._count._all);
        for (const g of rappels)
            usages.set(g.modeleImpressionRappelId, g._count._all);
        return modeles.map((m) => ({ ...m, nombreTiers: usages.get(m.id) ?? 0 }));
    }
    async creer(tenantId, userId, dto) {
        const intitule = (0, modeles_impression_1.intituleDuModele)(dto.intitule);
        const motifTexte = (0, modeles_impression_1.motifRefusTexteModele)(dto.texte);
        if (motifTexte)
            throw new common_1.BadRequestException(motifTexte);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`modeles-impression:${tenantId}`}))`;
                const nombre = await tx.modeleImpressionTiers.count({ where: { tenantId } });
                if (nombre >= modeles_impression_1.PLAFOND_MODELES_IMPRESSION) {
                    throw new common_1.BadRequestException(`Le dossier tient déjà ${modeles_impression_1.PLAFOND_MODELES_IMPRESSION} modèles d'impression · supprimez un modèle qu'aucun tiers n'emploie.`);
                }
                const autres = await tx.modeleImpressionTiers.findMany({ where: { tenantId, nature: dto.nature }, select: { id: true, intitule: true } });
                const motif = (0, modeles_impression_1.motifRefusIntituleModele)(intitule, autres, null);
                if (motif)
                    throw new common_1.BadRequestException(motif);
                return tx.modeleImpressionTiers.create({
                    data: { tenantId, nature: dto.nature, intitule, texte: dto.texte, createdBy: userId },
                    select: { id: true, nature: true, intitule: true, texte: true },
                });
            });
        }
        catch (e) {
            throw this.dejaPris(e, intitule);
        }
    }
    async modifier(tenantId, id, dto) {
        const existant = await this.prisma.modeleImpressionTiers.findFirst({ where: { id, tenantId }, select: { id: true, nature: true } });
        if (!existant)
            throw new common_1.NotFoundException("Modèle d'impression introuvable pour ce dossier.");
        if (dto.texte !== undefined) {
            const motifTexte = (0, modeles_impression_1.motifRefusTexteModele)(dto.texte);
            if (motifTexte)
                throw new common_1.BadRequestException(motifTexte);
        }
        const intitule = dto.intitule === undefined ? undefined : (0, modeles_impression_1.intituleDuModele)(dto.intitule);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                if (intitule !== undefined) {
                    await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`modeles-impression:${tenantId}`}))`;
                    const autres = await tx.modeleImpressionTiers.findMany({
                        where: { tenantId, nature: existant.nature },
                        select: { id: true, intitule: true },
                    });
                    const motif = (0, modeles_impression_1.motifRefusIntituleModele)(intitule, autres, existant.id);
                    if (motif)
                        throw new common_1.BadRequestException(motif);
                }
                return tx.modeleImpressionTiers.update({
                    where: { id: existant.id },
                    data: {
                        ...(intitule !== undefined ? { intitule } : {}),
                        ...(dto.texte !== undefined ? { texte: dto.texte } : {}),
                    },
                    select: { id: true, nature: true, intitule: true, texte: true },
                });
            });
        }
        catch (e) {
            throw this.dejaPris(e, intitule ?? '');
        }
    }
    async supprimer(tenantId, id) {
        const existant = await this.prisma.modeleImpressionTiers.findFirst({ where: { id, tenantId }, select: { id: true, intitule: true } });
        if (!existant)
            throw new common_1.NotFoundException("Modèle d'impression introuvable pour ce dossier.");
        const sujet = `Le modèle d'impression « ${existant.intitule} »`;
        const refuserSiChoisi = async () => {
            const refs = await (0, references_1.referencesVers)(this.prisma, 'ModeleImpressionTiers', existant.id, tenantId);
            if (refs.length) {
                throw new common_1.ConflictException(`${sujet} ne peut pas être supprimé · il est choisi : ${refs.map(references_1.libelleReference).join(', ')}. ` +
                    "Choisissez un autre modèle, ou aucun, sur la fiche de ces tiers d'abord.");
            }
        };
        await refuserSiChoisi();
        try {
            await this.prisma.modeleImpressionTiers.delete({ where: { id: existant.id } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                await refuserSiChoisi();
                throw new common_1.ConflictException(`${sujet} vient d’être choisi par un tiers · changez d'abord sa fiche.`);
            }
            throw e;
        }
        return { supprime: true };
    }
    dejaPris(e, intitule) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return new common_1.ConflictException(`Le dossier a déjà un modèle « ${intitule} » pour ce document.`);
        }
        return e;
    }
};
exports.ModelesImpressionService = ModelesImpressionService;
exports.ModelesImpressionService = ModelesImpressionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ModelesImpressionService);
//# sourceMappingURL=modeles-impression.service.js.map