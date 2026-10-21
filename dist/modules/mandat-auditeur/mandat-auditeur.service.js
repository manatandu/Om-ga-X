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
exports.MandatAuditeurService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const regles_auditeur_1 = require("../controles/regles-auditeur");
const duree_mandat_1 = require("./duree-mandat");
let MandatAuditeurService = class MandatAuditeurService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async dossier(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { id: true, referentiel: true, formeJuridiqueSyscohada: true },
        });
    }
    async dureeProposee(tenantId, organe) {
        const t = await this.dossier(tenantId);
        const brute = (0, duree_mandat_1.dureeMandat)(t.referentiel, t.formeJuridiqueSyscohada, organe);
        return {
            ...brute,
            reductionPossible: t.referentiel === client_1.Referentiel.SYCEBNL && brute.exercices !== null,
            organeRefuse: (0, duree_mandat_1.motifRefusOrgane)(t.referentiel, t.formeJuridiqueSyscohada, organe),
            successionPossible: (0, duree_mandat_1.successionOuverte)(t.referentiel, t.formeJuridiqueSyscohada),
        };
    }
    async lister(tenantId) {
        const mandats = await this.prisma.mandatAuditeur.findMany({
            where: { tenantId },
            orderBy: [{ premierExercice: 'desc' }, { rang: 'desc' }],
        });
        const t = await this.dossier(tenantId);
        return {
            mandats: mandats.map((m) => ({
                ...m,
                dernierExerciceCouvert: (0, duree_mandat_1.dernierExerciceCouvert)(m.premierExercice, m.nombreExercices),
            })),
            referentiel: t.referentiel,
            fondementInscription: (0, duree_mandat_1.fondementInscription)(t.referentiel, t.formeJuridiqueSyscohada),
        };
    }
    async enregistrer(tenantId, dto) {
        const t = await this.dossier(tenantId);
        const rang = dto.rang ?? 1;
        if (!dto.inscriptionOrdre.trim()) {
            const fondement = (0, duree_mandat_1.fondementInscription)(t.referentiel, t.formeJuridiqueSyscohada);
            throw new common_1.BadRequestException(`La référence d’inscription au tableau de l’ordre est exigée · ${fondement.source}, ${fondement.texte}. ` +
                'OmegaX ne consulte aucun tableau et ne vérifie pas cette référence · il la conserve, parce que c’est ' +
                'elle qu’un réviseur demandera.');
        }
        const refusOrgane = (0, duree_mandat_1.motifRefusOrgane)(t.referentiel, t.formeJuridiqueSyscohada, dto.organeDesignation);
        if (refusOrgane)
            throw new common_1.BadRequestException(refusOrgane);
        const brute = (0, duree_mandat_1.dureeMandat)(t.referentiel, t.formeJuridiqueSyscohada, dto.organeDesignation);
        if (brute.mandatsMaximum !== null && rang > brute.mandatsMaximum) {
            throw new common_1.BadRequestException(`Un ${brute.mandatsMaximum + 1}e mandat consécutif n’est pas prévu · ${brute.source}, « l’auditeur ` +
                'est nommé pour trois (3) exercices renouvelables UNE FOIS ». Au-delà, c’est un autre auditeur ' +
                'que l’assemblée désigne.');
        }
        const origine = await this.origineDeLaSuccession(tenantId, t, dto);
        if (origine) {
            const refus = (0, duree_mandat_1.motifRefusSuccession)(dto.natureSuccession, origine, dto.premierExercice, dto.nombreExercices);
            if (refus)
                throw new common_1.BadRequestException(`Durée refusée · ${refus}. Valeur reçue : ${dto.nombreExercices}.`);
        }
        const refusDuree = origine ? null : (0, duree_mandat_1.motifRefusDuree)(t.referentiel, brute.exercices, dto.nombreExercices);
        if (refusDuree) {
            throw new common_1.BadRequestException(`La durée du mandat est de ${refusDuree} pour ce dossier · ${brute.source}` +
                (t.referentiel === client_1.Referentiel.SYCEBNL
                    ? ', ramenée à la durée d’existence de l’entité si elle est inférieure (SYCEBNL art. 21, seconde phrase)'
                    : '') +
                `. Valeur reçue : ${dto.nombreExercices}.`);
        }
        return this.prisma.mandatAuditeur.create({
            data: {
                tenantId,
                nom: dto.nom.trim(),
                inscriptionOrdre: dto.inscriptionOrdre.trim(),
                organeDesignation: dto.organeDesignation,
                dateDesignation: new Date(dto.dateDesignation),
                premierExercice: dto.premierExercice,
                nombreExercices: dto.nombreExercices,
                rang,
                mandatOrigineId: origine?.id ?? null,
                natureSuccession: origine ? dto.natureSuccession : null,
            },
        });
    }
    async origineDeLaSuccession(tenantId, t, dto) {
        if (!dto.mandatOrigineId && !dto.natureSuccession)
            return null;
        if (!dto.mandatOrigineId || !dto.natureSuccession) {
            throw new common_1.BadRequestException('Un remplacement ou un suppléant se déclare avec le mandat qu’il continue · les deux vont ensemble.');
        }
        if (!(0, duree_mandat_1.successionOuverte)(t.referentiel, t.formeJuridiqueSyscohada)) {
            throw new common_1.BadRequestException('Le remplacement (AUSCGIE art. 706) et le suppléant (art. 728) sont des règles de la société anonyme, ' +
                'que l’art. 853-3 rend applicables à la SAS · elles ne sont pas étendues à cette forme.');
        }
        const origine = await this.prisma.mandatAuditeur.findFirst({ where: { id: dto.mandatOrigineId, tenantId } });
        if (!origine)
            throw new common_1.BadRequestException('Mandat d’origine introuvable dans ce dossier.');
        return origine;
    }
    async refuserProrogation(tenantId, id, refus) {
        const mandat = await this.prisma.mandatAuditeur.findFirst({ where: { id, tenantId } });
        if (!mandat)
            throw new common_1.NotFoundException('Mandat introuvable');
        return this.prisma.mandatAuditeur.update({
            where: { id: mandat.id },
            data: { refusDeProrogation: refus },
        });
    }
    async clore(tenantId, id, dto) {
        const mandat = await this.prisma.mandatAuditeur.findFirst({ where: { id, tenantId } });
        if (!mandat)
            throw new common_1.NotFoundException('Mandat introuvable');
        if (!dto.motifFin.trim()) {
            throw new common_1.BadRequestException('Le motif de fin anticipée est exigé · sans lui, une révocation ne se distingue plus d’un ' +
                'remplacement ordinaire, et c’est précisément ce qu’un réviseur cherche à savoir.');
        }
        return this.prisma.mandatAuditeur.update({
            where: { id: mandat.id },
            data: { finAnticipeeLe: new Date(dto.finAnticipeeLe), motifFin: dto.motifFin.trim() },
        });
    }
    async obligation(tenantId) {
        const t = await this.dossier(tenantId);
        return (0, regles_auditeur_1.regleAuditeur)(t.referentiel, t.formeJuridiqueSyscohada);
    }
};
exports.MandatAuditeurService = MandatAuditeurService;
exports.MandatAuditeurService = MandatAuditeurService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MandatAuditeurService);
//# sourceMappingURL=mandat-auditeur.service.js.map