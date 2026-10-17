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
exports.SubventionRattacheeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const reprise_subvention_1 = require("./reprise-subvention");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const subvention_rattachee_1 = require("./subvention-rattachee");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const n = (v) => Number(v ?? 0);
const centimes = (x) => Math.round(x * 100) / 100;
const PLAFOND_LISTE = 500;
let SubventionRattacheeService = class SubventionRattacheeService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    async lister(tenantId, immobilisationId) {
        const [lignes, tenant] = await Promise.all([
            this.prisma.subventionImmobilisation.findMany({
                where: { tenantId, ...(immobilisationId ? { immobilisationId } : {}) },
                select: {
                    id: true,
                    montant: true,
                    dateOctroi: true,
                    reference: true,
                    dureeInalienabiliteAns: true,
                    motifSansVentilation: true,
                    immobilisation: { select: { id: true, numeroInventaire: true, designation: true } },
                    compteSubvention: { select: { id: true, numero: true, intitule: true } },
                    reductions: { select: { id: true, nature: true, montant: true, motif: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
                },
                orderBy: [{ dateOctroi: 'asc' }, { id: 'asc' }],
                take: PLAFOND_LISTE + 1,
            }),
            this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { referentiel: true, methodeDepreciationBienSubventionne: true },
            }),
        ]);
        const numeroPropose = (0, subvention_rattachee_1.contrepartieRemboursementProposee)(tenant.referentiel);
        const compteRemboursementPropose = numeroPropose
            ? await this.prisma.compte.findFirst({
                where: { tenantId, numero: numeroPropose, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
                select: { id: true, numero: true, intitule: true },
            })
            : null;
        return {
            subventions: lignes.slice(0, PLAFOND_LISTE),
            tronque: lignes.length > PLAFOND_LISTE,
            methodeDepreciation: tenant.methodeDepreciationBienSubventionne,
            contrepartieRemboursementProposee: numeroPropose,
            compteRemboursementPropose,
        };
    }
    async ventilation(tenantId, immobilisationId, montant) {
        const bien = await this.prisma.immobilisation.findFirst({
            where: { id: immobilisationId, tenantId },
            select: {
                id: true,
                designation: true,
                valeurOrigine: true,
                immobilisationPrincipaleId: true,
                composants: {
                    where: { statut: client_1.StatutImmobilisation.EN_SERVICE },
                    select: { id: true, designation: true, valeurOrigine: true },
                    orderBy: { createdAt: 'asc' },
                    take: 50,
                },
            },
        });
        if (!bien)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        if (bien.immobilisationPrincipaleId) {
            throw new common_1.BadRequestException("Ce bien est un composant · rattachez la subvention depuis l'immobilisation principale, qui la ventile.");
        }
        const biens = [
            { id: bien.id, designation: bien.designation, valeurOrigine: n(bien.valeurOrigine) },
            ...bien.composants.map((c) => ({ id: c.id, designation: c.designation, valeurOrigine: n(c.valeurOrigine) })),
        ];
        const parts = (0, subvention_rattachee_1.ventilerAuProrata)(montant, biens);
        return {
            lignes: biens.map((b, i) => ({ ...b, montant: parts[i].montant })),
            aDesComposants: bien.composants.length > 0,
        };
    }
    async octrois(tenantId, compteSubventionId) {
        const [compte, tenant] = await Promise.all([
            this.prisma.compte.findFirst({
                where: { id: compteSubventionId, tenantId },
                select: { id: true, numero: true, typeCompte: true },
            }),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
        ]);
        if (!compte)
            throw new common_1.BadRequestException('Compte de subvention introuvable pour ce dossier');
        const motifCompte = (0, subvention_rattachee_1.motifRefusCompteSubvention)(compte.numero, compte.typeCompte === client_1.TypeCompteDetailTotal.DETAIL);
        if (motifCompte)
            throw new common_1.BadRequestException(motifCompte);
        const filtre = { compteId: compte.id, credit: { gt: 0 }, ecriture: { tenantId, estGenereeParCloture: false, ...ecritures_de_situation_1.HORS_SITUATION } };
        const [lignes, credits, rattache, contreparties] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where: filtre,
                select: {
                    id: true,
                    credit: true,
                    libelle: true,
                    ecriture: { select: { id: true, date: true, libelle: true, reference: true, numeroPiece: true } },
                },
                orderBy: [{ ecriture: { date: 'desc' } }, { id: 'asc' }],
                take: PLAFOND_LISTE + 1,
            }),
            this.prisma.ligneEcriture.aggregate({ where: filtre, _sum: { credit: true } }),
            this.prisma.subventionImmobilisation.aggregate({ where: { tenantId, compteSubventionId: compte.id }, _sum: { montant: true } }),
            this.prisma.compte.findMany({
                where: { tenantId, numero: { in: [...subvention_rattachee_1.CONTREPARTIES_OCTROI_PROPOSEES[tenant.referentiel]] } },
                select: { id: true, numero: true, intitule: true },
                orderBy: { numero: 'asc' },
            }),
        ]);
        const credite = centimes(n(credits._sum.credit));
        const dejaRattache = centimes(n(rattache._sum.montant));
        return {
            octrois: lignes.slice(0, PLAFOND_LISTE).map((l) => ({
                ligneId: l.id,
                ecritureId: l.ecriture.id,
                date: l.ecriture.date,
                numeroPiece: l.ecriture.numeroPiece,
                reference: l.ecriture.reference,
                libelle: l.libelle || l.ecriture.libelle,
                montant: n(l.credit),
            })),
            tronque: lignes.length > PLAFOND_LISTE,
            credite,
            dejaRattache,
            resteARattacher: centimes(Math.max(0, credite - dejaRattache)),
            contrepartiesProposees: contreparties,
            autresTiersAdmis: tenant.referentiel === 'SYSCOHADA',
        };
    }
    async enregistrerOctroi(tenantId, userId, dto) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, jeuEtatsFinanciersSycebnl: true },
        });
        if (tenant.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT) {
            throw new common_1.BadRequestException('Les biens d’un projet de développement sont financés par les fonds du bailleur (162 à 164, SYCEBNL Partie 3 ch. 3) · aucune subvention d’investissement ne s’y inscrit.');
        }
        const [compte, contrepartie] = await Promise.all([
            this.prisma.compte.findFirst({ where: { id: dto.compteSubventionId, tenantId }, select: { id: true, numero: true, typeCompte: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteContrepartieId, tenantId }, select: { id: true, numero: true, typeCompte: true } }),
        ]);
        if (!compte)
            throw new common_1.BadRequestException('Compte de subvention introuvable pour ce dossier');
        if (!contrepartie)
            throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce dossier');
        const motif = (0, subvention_rattachee_1.motifRefusCompteSubvention)(compte.numero, compte.typeCompte === client_1.TypeCompteDetailTotal.DETAIL) ??
            (0, subvention_rattachee_1.motifRefusContrepartieOctroi)(tenant.referentiel, contrepartie.numero) ??
            (contrepartie.typeCompte === client_1.TypeCompteDetailTotal.DETAIL ? null : 'Choisissez un compte de détail, pas un compte de regroupement.');
        if (motif)
            throw new common_1.BadRequestException(motif);
        const montant = centimes(dto.montant);
        return this.ecritures.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.date,
            libelle: `Octroi de subvention d'investissement · ${dto.reference.trim()}`,
            reference: dto.reference.trim(),
            lignes: [
                { compteId: contrepartie.id, debit: montant, credit: 0 },
                { compteId: compte.id, debit: 0, credit: montant },
            ],
        });
    }
    async rattacher(tenantId, userId, dto) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, jeuEtatsFinanciersSycebnl: true },
        });
        const referentiel = tenant.referentiel;
        if (tenant.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT) {
            throw new common_1.BadRequestException('Les biens d’un projet de développement sont financés par les fonds du bailleur (162 à 164, SYCEBNL Partie 3 ch. 3) · aucune subvention ne s’y rattache.');
        }
        const compte = await this.prisma.compte.findFirst({
            where: { id: dto.compteSubventionId, tenantId },
            select: { id: true, numero: true, typeCompte: true },
        });
        if (!compte)
            throw new common_1.BadRequestException('Compte de subvention introuvable pour ce dossier');
        const motifCompte = (0, subvention_rattachee_1.motifRefusCompteSubvention)(compte.numero, compte.typeCompte === client_1.TypeCompteDetailTotal.DETAIL);
        if (motifCompte)
            throw new common_1.BadRequestException(motifCompte);
        const ids = dto.lignes.map((l) => l.immobilisationId);
        if (new Set(ids).size !== ids.length)
            throw new common_1.BadRequestException('Un même bien figure deux fois dans la ventilation.');
        const biens = await this.prisma.immobilisation.findMany({
            where: { tenantId, id: { in: ids } },
            select: {
                id: true,
                designation: true,
                valeurOrigine: true,
                statut: true,
                immobilisationPrincipaleId: true,
                _count: { select: { composants: { where: { statut: client_1.StatutImmobilisation.EN_SERVICE } } } },
                subventions: { select: { montant: true, compteSubventionId: true } },
                ecritureAcquisition: { select: { lignes: { select: { credit: true, compte: { select: { numero: true } } }, take: 50 } } },
            },
        });
        if (biens.length !== ids.length)
            throw new common_1.BadRequestException('Immobilisation introuvable pour ce dossier');
        const principaux = biens.filter((b) => !b.immobilisationPrincipaleId);
        const composantsRattaches = biens.filter((b) => b.immobilisationPrincipaleId).length;
        for (const b of biens) {
            const ligne = dto.lignes.find((l) => l.immobilisationId === b.id);
            if (b.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
                throw new common_1.BadRequestException(`« ${b.designation} » a quitté l'actif · aucune subvention ne s'y rattache plus.`);
            }
            if (b.subventions.some((s) => s.compteSubventionId === compte.id)) {
                throw new common_1.ConflictException(`« ${b.designation} » porte déjà une subvention sur ce compte.`);
            }
            const parFonds = (b.ecritureAcquisition?.lignes ?? []).some((l) => n(l.credit) > 0 && !!(0, reprise_subvention_1.fondsDuCompte)(referentiel, l.compte.numero));
            if (parFonds) {
                throw new common_1.BadRequestException(`« ${b.designation} » est entré par un fonds qui se reprend déjà · la subvention ne s'y rattache pas une seconde fois.`);
            }
            const dejaRattache = b.subventions.reduce((t, s) => t + n(s.montant), 0);
            if (centimes(dejaRattache + ligne.montant) > n(b.valeurOrigine)) {
                throw new common_1.BadRequestException(`Les subventions de « ${b.designation} » dépasseraient sa valeur d'entrée · la reprise suit « le rapport existant entre le montant de la subvention et la valeur d'entrée » (AUDCIF Titre VIII ch. 17 § 3.2).`);
            }
        }
        for (const p of principaux) {
            const motif = (0, subvention_rattachee_1.motifRefusSansVentilation)({
                principalAvecComposants: p._count.composants > 0,
                composantsRattaches,
                motif: dto.motifSansVentilation,
            });
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        const [credits, rattache] = await Promise.all([
            this.prisma.ligneEcriture.aggregate({
                where: { compteId: compte.id, ecriture: { tenantId, estGenereeParCloture: false, ...ecritures_de_situation_1.HORS_SITUATION } },
                _sum: { credit: true },
            }),
            this.prisma.subventionImmobilisation.aggregate({ where: { tenantId, compteSubventionId: compte.id }, _sum: { montant: true } }),
        ]);
        const total = centimes(n(rattache._sum.montant) + dto.lignes.reduce((t, l) => t + l.montant, 0));
        if (total > centimes(n(credits._sum.credit))) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} n'a été crédité que de ${n(credits._sum.credit).toFixed(2)} · on ne rattache pas aux biens plus de subvention que l'octroi passé au 14.`);
        }
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const crees = [];
                for (const l of dto.lignes) {
                    crees.push(await tx.subventionImmobilisation.create({
                        data: {
                            tenantId,
                            immobilisationId: l.immobilisationId,
                            compteSubventionId: compte.id,
                            montant: l.montant,
                            dateOctroi: new Date(dto.dateOctroi),
                            reference: dto.reference.trim(),
                            dureeInalienabiliteAns: dto.dureeInalienabiliteAns ?? null,
                            motifSansVentilation: composantsRattaches === 0 ? (dto.motifSansVentilation?.trim() || null) : null,
                            createdBy: userId,
                        },
                    }));
                }
                return crees;
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('Un de ces biens porte déjà une subvention sur ce compte.');
            }
            throw err;
        }
    }
    async declarerMethode(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { methodeDepreciationBienSubventionne: true },
        });
        if (tenant.methodeDepreciationBienSubventionne && tenant.methodeDepreciationBienSubventionne !== dto.methode) {
            throw new common_1.ConflictException('La méthode de dépréciation des biens subventionnés est déjà déclarée · elle se tient d’un exercice à l’autre, et un changement de méthode ne se fait pas depuis cette fenêtre.');
        }
        return this.prisma.tenant.update({
            where: { id: tenantId },
            data: { methodeDepreciationBienSubventionne: dto.methode },
            select: { methodeDepreciationBienSubventionne: true },
        });
    }
    async reduire(tenantId, userId, subventionId, dto) {
        const sub = await this.prisma.subventionImmobilisation.findFirst({
            where: { id: subventionId, tenantId },
            select: {
                id: true,
                montant: true,
                compteSubventionId: true,
                immobilisation: {
                    select: {
                        id: true,
                        designation: true,
                        reprisesSubvention: { select: { montant: true } },
                        subventions: { select: { montant: true, reductions: { select: { montant: true } } } },
                    },
                },
                reductions: { select: { montant: true } },
            },
        });
        if (!sub)
            throw new common_1.NotFoundException('Subvention rattachée introuvable');
        const [{ referentiel }, contrepartie] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteContrepartieId, tenantId }, select: { id: true, numero: true, typeCompte: true } }),
        ]);
        if (!contrepartie)
            throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce dossier');
        if (contrepartie.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL)
            throw new common_1.BadRequestException('Choisissez un compte de détail.');
        const motifContrepartie = (0, subvention_rattachee_1.motifRefusContrepartieReduction)(referentiel, dto.nature, contrepartie.numero);
        if (motifContrepartie)
            throw new common_1.BadRequestException(motifContrepartie);
        const immo = sub.immobilisation;
        const resteRattachement = centimes(n(sub.montant) - sub.reductions.reduce((t, r) => t + n(r.montant), 0));
        const soldeNonReprisBien = centimes(immo.subventions.reduce((t, s) => t + n(s.montant) - s.reductions.reduce((u, r) => u + n(r.montant), 0), 0) -
            immo.reprisesSubvention.reduce((t, r) => t + n(r.montant), 0));
        const motif = (0, subvention_rattachee_1.motifRefusReduction)({ montant: dto.montant, resteRattachement, soldeNonReprisBien });
        if (motif)
            throw new common_1.BadRequestException(motif);
        let compte6515Id;
        let compte799Id;
        if (dto.nature === 'NON_VERSEE') {
            const [c6515, c799] = await Promise.all([
                this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: subvention_rattachee_1.COMPTE_PERTES_AUTRES_DEBITEURS } }, select: { id: true } }),
                this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: subvention_rattachee_1.COMPTE_REPRISE_SUBVENTION } }, select: { id: true } }),
            ]);
            if (!c6515 || !c799) {
                throw new common_1.BadRequestException(`Comptes ${subvention_rattachee_1.COMPTE_PERTES_AUTRES_DEBITEURS} et ${subvention_rattachee_1.COMPTE_REPRISE_SUBVENTION} requis (AUDCIF Titre VIII ch. 17 § 4.7) · ouvrez-les avant de constater la subvention non versée.`);
            }
            compte6515Id = c6515.id;
            compte799Id = c799.id;
        }
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.date.slice(0, 10),
            libelle: `${dto.nature === 'REMBOURSEMENT' ? 'Subvention remboursable' : 'Subvention non versée'} · ${immo.designation}`.slice(0, 190),
            lignes: (0, subvention_rattachee_1.lignesReduction)({
                nature: dto.nature,
                montant: dto.montant,
                compte14Id: sub.compteSubventionId,
                contrepartieId: contrepartie.id,
                compte6515Id,
                compte799Id,
            }),
        });
        try {
            return await this.prisma.reductionSubventionImmobilisation.create({
                data: {
                    tenantId,
                    subventionId: sub.id,
                    exerciceId: dto.exerciceId,
                    nature: dto.nature,
                    montant: dto.montant,
                    motif: dto.motif.trim(),
                    compteContrepartieId: contrepartie.id,
                    ecritureId: ecriture.id,
                    createdBy: userId,
                },
            });
        }
        catch (err) {
            await this.ecritures.retirerCompensation(tenantId, ecriture.id);
            throw err;
        }
    }
};
exports.SubventionRattacheeService = SubventionRattacheeService;
exports.SubventionRattacheeService = SubventionRattacheeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], SubventionRattacheeService);
//# sourceMappingURL=subvention-rattachee.service.js.map