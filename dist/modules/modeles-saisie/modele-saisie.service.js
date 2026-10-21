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
exports.ModeleSaisieService = void 0;
const comptes_proposes_1 = require("../comptes/comptes-proposes");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const diagnostic_tiers_1 = require("./diagnostic-tiers");
const fonctions_modele_1 = require("./fonctions-modele");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
let ModeleSaisieService = class ModeleSaisieService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId, journalId, inclureInactifs = false) {
        const typeDuJournal = journalId
            ? (await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { type: true } }))?.type
            : undefined;
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const modeles = await this.prisma.modeleSaisie.findMany({
            where: {
                tenantId,
                ...(inclureInactifs ? {} : { estActif: true }),
                ...(journalId
                    ? {
                        OR: [
                            { journalId },
                            { journalId: null, typeJournal: null },
                            ...(typeDuJournal ? [{ journalId: null, typeJournal: typeDuJournal }] : []),
                        ],
                    }
                    : {}),
            },
            include: {
                journal: { select: { id: true, code: true, intitule: true } },
                sequenceSaisie: { select: { id: true, numero: true, intitule: true } },
                lignes: {
                    orderBy: { ordre: 'asc' },
                    include: { compte: { select: { id: true, numero: true, intitule: true } } },
                },
            },
            orderBy: { intitule: 'asc' },
        });
        return modeles.map((m) => ({
            id: m.id,
            intitule: m.intitule,
            journalId: m.journalId,
            typeJournal: m.typeJournal,
            journalCode: m.journal?.code ?? null,
            journalIntitule: m.journal?.intitule ?? null,
            sequenceSaisieId: m.sequenceSaisieId,
            sequenceNumero: m.sequenceSaisie?.numero ?? null,
            sequenceIntitule: m.sequenceSaisie?.intitule ?? null,
            estActif: m.estActif,
            lignes: m.lignes.map((l) => ({
                ordre: l.ordre,
                compteId: l.compteId,
                compteNumero: l.compte.numero,
                compteIntitule: l.compte.intitule,
                sens: l.sens,
                libelle: l.libelle,
                montant: l.montant === null ? null : Number(l.montant),
                fonction: l.fonction,
                tauxTvaId: l.tauxTvaId,
            })),
            avertissements: (0, diagnostic_tiers_1.diagnostiquerTiers)(m.lignes.map((l) => ({ numero: l.compte.numero, sens: l.sens })), tenant.referentiel),
        }));
    }
    async creer(tenantId, userId, dto) {
        await this.verifierLignes(tenantId, dto.lignes);
        if (dto.journalId)
            await this.verifierJournal(tenantId, dto.journalId);
        if (dto.sequenceSaisieId)
            await this.verifierSequence(tenantId, dto.sequenceSaisieId);
        const modele = await this.prisma.modeleSaisie.create({
            data: {
                tenantId,
                intitule: dto.intitule.trim(),
                journalId: dto.journalId ?? null,
                typeJournal: dto.journalId ? null : (dto.typeJournal ?? null),
                sequenceSaisieId: dto.sequenceSaisieId ?? null,
                createdBy: userId,
                lignes: { create: dto.lignes.map((l, ordre) => this.versLigne(l, ordre)) },
            },
            select: { id: true },
        });
        return { ...modele, avertissements: await this.avertissementsDuModele(tenantId, modele.id) };
    }
    async modifier(tenantId, modeleId, dto) {
        const existant = await this.prisma.modeleSaisie.findFirst({ where: { id: modeleId, tenantId } });
        if (!existant)
            throw new common_1.NotFoundException('Modèle de saisie introuvable');
        if (dto.lignes)
            await this.verifierLignes(tenantId, dto.lignes);
        if (dto.journalId)
            await this.verifierJournal(tenantId, dto.journalId);
        if (dto.sequenceSaisieId)
            await this.verifierSequence(tenantId, dto.sequenceSaisieId);
        const modifie = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (dto.lignes) {
                await tx.ligneModeleSaisie.deleteMany({ where: { modeleId } });
                await tx.ligneModeleSaisie.createMany({
                    data: dto.lignes.map((l, ordre) => ({ modeleId, ...this.versLigne(l, ordre) })),
                });
            }
            return tx.modeleSaisie.update({
                where: { id: modeleId },
                data: {
                    ...(dto.intitule !== undefined ? { intitule: dto.intitule.trim() } : {}),
                    ...(dto.journalId !== undefined ? { journalId: dto.journalId } : {}),
                    ...(dto.typeJournal !== undefined ? { typeJournal: dto.typeJournal } : {}),
                    ...(dto.sequenceSaisieId !== undefined ? { sequenceSaisieId: dto.sequenceSaisieId } : {}),
                    ...(dto.estActif !== undefined ? { estActif: dto.estActif } : {}),
                },
                select: { id: true },
            });
        });
        return { ...modifie, avertissements: await this.avertissementsDuModele(tenantId, modeleId) };
    }
    async supprimer(tenantId, modeleId) {
        const existant = await this.prisma.modeleSaisie.findFirst({ where: { id: modeleId, tenantId } });
        if (!existant)
            throw new common_1.NotFoundException('Modèle de saisie introuvable');
        await this.prisma.modeleSaisie.delete({ where: { id: modeleId } });
        return { supprime: true };
    }
    async avertissementsDuModele(tenantId, modeleId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const lignes = await this.prisma.ligneModeleSaisie.findMany({
            where: { modeleId, modele: { tenantId } },
            select: { sens: true, compte: { select: { numero: true } } },
        });
        return (0, diagnostic_tiers_1.diagnostiquerTiers)(lignes.map((l) => ({ numero: l.compte.numero, sens: l.sens })), tenant.referentiel);
    }
    versLigne(l, ordre) {
        return {
            ordre,
            compteId: l.compteId,
            sens: l.sens,
            libelle: l.libelle?.trim() || null,
            montant: l.montant === undefined ? null : new client_1.Prisma.Decimal(l.montant),
            fonction: l.fonction ?? 'SAISIR',
            tauxTvaId: l.tauxTvaId ?? null,
        };
    }
    async verifierSequence(tenantId, sequenceSaisieId) {
        const sequence = await this.prisma.sequenceSaisie.findFirst({ where: { id: sequenceSaisieId, tenantId }, select: { id: true } });
        if (!sequence)
            throw new common_1.NotFoundException('Séquence de saisie introuvable pour ce dossier.');
    }
    async verifierJournal(tenantId, journalId) {
        const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId } });
        if (!journal)
            throw new common_1.BadRequestException('Journal introuvable dans ce dossier');
    }
    async verifierLignes(tenantId, lignes) {
        const ids = [...new Set(lignes.map((l) => l.compteId))];
        const comptes = await this.prisma.compte.findMany({
            where: { id: { in: ids }, tenantId },
            select: { id: true, numero: true, typeCompte: true },
        });
        const manquants = ids.filter((id) => !comptes.some((c) => c.id === id));
        if (manquants.length)
            throw new common_1.BadRequestException('Un compte du modèle est introuvable dans ce dossier');
        const totaux = comptes.filter((c) => c.typeCompte === 'TOTAL').map((c) => c.numero);
        if (totaux.length) {
            throw new common_1.BadRequestException(`Un modèle ne peut pas viser un compte de totalisation : ${totaux.join(', ')}. ` +
                "Choisissez un compte d'imputation.");
        }
        const motifPersonnalise = (0, comptes_proposes_1.motifComptesNonPersonnalises)(await (0, comptes_proposes_1.comptesNonPersonnalises)(this.prisma, tenantId, ids), 'un modèle de saisie');
        if (motifPersonnalise)
            throw new common_1.BadRequestException(motifPersonnalise);
        const refusFonctions = (0, fonctions_modele_1.motifRefusFonctions)(lignes);
        if (refusFonctions)
            throw new common_1.BadRequestException(refusFonctions);
        const taux = [...new Set(lignes.map((l) => l.tauxTvaId).filter((t) => !!t))];
        if (taux.length) {
            const trouves = await this.prisma.tauxTva.count({ where: { id: { in: taux }, tenantId } });
            if (trouves !== taux.length)
                throw new common_1.BadRequestException('Un taux de taxe du modèle est introuvable dans ce dossier');
        }
        const aDebit = lignes.some((l) => l.sens === client_1.SensModeleSaisie.DEBIT);
        const aCredit = lignes.some((l) => l.sens === client_1.SensModeleSaisie.CREDIT);
        if (!aDebit || !aCredit) {
            throw new common_1.BadRequestException('Un modèle doit poser au moins un débit et un crédit.');
        }
    }
};
exports.ModeleSaisieService = ModeleSaisieService;
exports.ModeleSaisieService = ModeleSaisieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ModeleSaisieService);
//# sourceMappingURL=modele-saisie.service.js.map