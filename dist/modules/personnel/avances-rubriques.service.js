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
exports.AvancesRubriquesService = exports.PLAFOND_LISTES_PAIE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const modeles_bulletin_1 = require("./modeles-bulletin");
const rubriques_paie_1 = require("./rubriques-paie");
const avances_salaire_1 = require("./avances-salaire");
exports.PLAFOND_LISTES_PAIE = 500;
let AvancesRubriquesService = class AvancesRubriquesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listerRubriques(tenantId) {
        const [rubriques, total] = await Promise.all([
            this.prisma.rubriquePaie.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, take: exports.PLAFOND_LISTES_PAIE }),
            this.prisma.rubriquePaie.count({ where: { tenantId } }),
        ]);
        return {
            rubriques,
            naturesPermises: rubriques_paie_1.NATURES_DES_RUBRIQUES,
            total,
            plafond: exports.PLAFOND_LISTES_PAIE,
            tronque: total > rubriques.length,
        };
    }
    async creerRubrique(tenantId, dto) {
        const refus = (0, rubriques_paie_1.motifRefusRubrique)(dto);
        if (refus)
            throw new common_1.BadRequestException(refus);
        try {
            return await this.prisma.rubriquePaie.create({
                data: { tenantId, code: dto.code.trim().toUpperCase(), libelle: dto.libelle.trim(), nature: dto.nature, fondement: dto.fondement.trim() },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Le code ${dto.code.trim().toUpperCase()} est déjà pris dans ce dossier.`);
            }
            throw e;
        }
    }
    async modifierRubrique(tenantId, id, dto) {
        const r = await this.prisma.rubriquePaie.findFirst({ where: { id, tenantId } });
        if (!r)
            throw new common_1.NotFoundException('Rubrique introuvable dans ce dossier.');
        const refus = (0, rubriques_paie_1.motifRefusRubrique)({ code: r.code, nature: r.nature, libelle: dto.libelle ?? r.libelle, fondement: dto.fondement ?? r.fondement });
        if (refus)
            throw new common_1.BadRequestException(refus);
        return this.prisma.rubriquePaie.update({
            where: { id: r.id },
            data: {
                ...(dto.libelle !== undefined ? { libelle: dto.libelle.trim() } : {}),
                ...(dto.fondement !== undefined ? { fondement: dto.fondement.trim() } : {}),
                ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
            },
        });
    }
    async listerModeles(tenantId) {
        const [modeles, total] = await Promise.all([
            this.prisma.modeleBulletin.findMany({ where: { tenantId }, orderBy: { nom: 'asc' }, take: exports.PLAFOND_LISTES_PAIE }),
            this.prisma.modeleBulletin.count({ where: { tenantId } }),
        ]);
        return { modeles, total, plafond: exports.PLAFOND_LISTES_PAIE, tronque: total > modeles.length };
    }
    async creerModele(tenantId, creePar, dto) {
        const rubriques = await this.prisma.rubriquePaie.findMany({
            where: { tenantId },
            select: { id: true, nature: true, actif: true },
        });
        const refus = (0, modeles_bulletin_1.motifRefusModele)(dto, rubriques);
        if (refus)
            throw new common_1.BadRequestException(refus);
        const nom = dto.nom.trim();
        try {
            return await this.prisma.modeleBulletin.create({
                data: {
                    tenantId,
                    nom,
                    categorie: dto.categorie?.trim() || null,
                    deviseStipulation: dto.deviseStipulation,
                    lignes: (0, modeles_bulletin_1.normaliserLignes)(dto.lignes, rubriques),
                    creePar,
                },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Un modèle nommé « ${nom} » existe déjà dans ce dossier.`);
            }
            throw e;
        }
    }
    async supprimerModele(tenantId, id) {
        const m = await this.prisma.modeleBulletin.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!m)
            throw new common_1.NotFoundException('Modèle introuvable dans ce dossier.');
        await this.prisma.modeleBulletin.delete({ where: { id: m.id } });
        return { supprime: true };
    }
    async listerAvances(tenantId, salarieId) {
        const [avances, total] = await Promise.all([
            this.prisma.avanceSalaire.findMany({
                where: { tenantId, ...(salarieId ? { salarieId } : {}) },
                orderBy: [{ dateOctroi: 'desc' }, { id: 'desc' }],
                take: exports.PLAFOND_LISTES_PAIE,
                include: {
                    salarie: { select: { nom: true, postNom: true, prenoms: true, matricule: true } },
                    retenues: { select: { montantFc: true, bulletin: { select: { numero: true, moisDePaie: true, statut: true } } } },
                },
            }),
            this.prisma.avanceSalaire.count({ where: { tenantId, ...(salarieId ? { salarieId } : {}) } }),
        ]);
        const lignes = avances.map((a) => {
            const retenues = a.retenues.map((r) => ({
                montantFc: Number(r.montantFc),
                numero: r.bulletin.numero,
                moisDePaie: r.bulletin.moisDePaie,
                bulletinAnnule: r.bulletin.statut !== client_1.StatutBulletinPaie.EMIS,
            }));
            return {
                id: a.id,
                salarieId: a.salarieId,
                salarie: [a.salarie.nom, a.salarie.postNom, a.salarie.prenoms].filter(Boolean).join(' '),
                matricule: a.salarie.matricule,
                type: a.type,
                categoriePret: a.categoriePret,
                littera: avances_salaire_1.LITTERA_ARTICLE_112[a.type],
                compte: (0, avances_salaire_1.compteDeLAvance)(a.type, a.categoriePret ?? null),
                dateOctroi: a.dateOctroi,
                montantFc: Number(a.montantFc),
                retenueMensuelleFc: a.retenueMensuelleFc === null ? null : Number(a.retenueMensuelleFc),
                objet: a.objet,
                pieceJustificative: a.pieceJustificative,
                referenceActe: a.referenceActe,
                greffe: a.greffe,
                destinataire: a.destinataire,
                dateFin: a.dateFin,
                retenues,
                soldeFc: (0, avances_salaire_1.soldeAvance)(Number(a.montantFc), retenues),
            };
        });
        return { avances: lignes, total, plafond: exports.PLAFOND_LISTES_PAIE, tronque: total > lignes.length };
    }
    async creerAvance(tenantId, email, salarieId, dto) {
        const salarie = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
        if (!salarie)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        const refus = (0, avances_salaire_1.motifRefusAvance)(dto);
        if (refus)
            throw new common_1.BadRequestException(refus);
        return this.prisma.avanceSalaire.create({
            data: {
                tenantId,
                salarieId,
                type: dto.type,
                categoriePret: dto.type === 'PRET' ? dto.categoriePret : null,
                dateOctroi: new Date(dto.dateOctroi),
                montantFc: dto.montantFc,
                retenueMensuelleFc: dto.retenueMensuelleFc ?? null,
                objet: dto.objet.trim(),
                pieceJustificative: dto.pieceJustificative.trim(),
                referenceActe: dto.type === 'SAISIE_ARRET' ? dto.referenceActe.trim() : null,
                greffe: dto.type === 'SAISIE_ARRET' ? dto.greffe.trim() : null,
                destinataire: dto.type === 'SAISIE_ARRET' ? dto.destinataire.trim() : null,
                creePar: email,
            },
        });
    }
    async terminerSaisie(tenantId, id, dto) {
        const a = await this.prisma.avanceSalaire.findFirst({
            where: { id, tenantId },
            select: { id: true, type: true, dateOctroi: true, dateFin: true },
        });
        if (!a)
            throw new common_1.NotFoundException('Saisie introuvable dans ce dossier.');
        const dateFin = new Date(dto.dateFin);
        const refus = (0, avances_salaire_1.motifRefusFinSaisie)({ type: a.type, dateOctroi: a.dateOctroi, dateFin: a.dateFin }, dateFin);
        if (refus)
            throw new common_1.BadRequestException(refus);
        return this.prisma.avanceSalaire.update({ where: { id: a.id }, data: { dateFin } });
    }
    async supprimerAvance(tenantId, id) {
        const a = await this.prisma.avanceSalaire.findFirst({ where: { id, tenantId }, include: { _count: { select: { retenues: true } } } });
        if (!a)
            throw new common_1.NotFoundException('Avance introuvable dans ce dossier.');
        if (a._count.retenues > 0) {
            throw new common_1.ConflictException(`Cette avance porte ${a._count.retenues} retenue(s) de bulletin · elle ne se supprime plus. Annulez les bulletins si les retenues sont fausses.`);
        }
        await this.prisma.avanceSalaire.delete({ where: { id: a.id } });
        return { supprime: true };
    }
};
exports.AvancesRubriquesService = AvancesRubriquesService;
exports.AvancesRubriquesService = AvancesRubriquesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AvancesRubriquesService);
//# sourceMappingURL=avances-rubriques.service.js.map