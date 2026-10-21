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
exports.AccordCadreService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const conditions_ong_etrangere_1 = require("./conditions-ong-etrangere");
const effectif_registre_1 = require("../personnel/effectif-registre");
let AccordCadreService = class AccordCadreService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async dossier(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { id: true, formeJuridique: true, droitEtranger: true },
        });
    }
    async exigerPerimetre(tenantId) {
        const t = await this.dossier(tenantId);
        if (!(0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(t.formeJuridique, t.droitEtranger)) {
            throw new common_1.BadRequestException("L'accord-cadre avec le Ministère du Plan n'est exigé que d'une ORGANISATION NON GOUVERNEMENTALE de " +
                'DROIT ÉTRANGER · loi n° 004/2001, art. 37, sous-section II. Ce dossier ne l’est pas. Si c’en est une, ' +
                'corrigez la forme juridique et le drapeau « droit étranger » dans les paramètres du dossier ; sinon, ' +
                'aucun accord-cadre ne lui est demandé.');
        }
        return t;
    }
    async etat(tenantId, params = {}) {
        const t = await this.dossier(tenantId);
        const applicable = (0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(t.formeJuridique, t.droitEtranger);
        const reference = params.dateReference ? new Date(params.dateReference) : new Date();
        const accords = applicable
            ? await this.prisma.accordCadrePlan.findMany({ where: { tenantId }, orderBy: { dateSignature: 'desc' } })
            : [];
        const registre = applicable ? await (0, effectif_registre_1.effectifDuRegistre)(this.prisma, tenantId, reference) : null;
        return {
            applicable,
            modele: conditions_ong_etrangere_1.MODELE_KAHASHA,
            partMinimaleMainOeuvreLocale: conditions_ong_etrangere_1.PART_MAIN_OEUVRE_LOCALE_MINIMALE,
            accords: accords.map((a) => ({
                ...a,
                etat: (0, conditions_ong_etrangere_1.etatAccordCadre)({
                    dateSignature: a.dateSignature,
                    dureeAnnees: a.dureeAnnees,
                    taciteReconduction: a.taciteReconduction,
                    preavisMois: a.preavisMois,
                    denonceLe: a.denonceLe,
                    reference,
                }),
            })),
            propositionMainOeuvre: registre
                ? {
                    part: registre.partMainOeuvreNationale,
                    effectif: registre.effectif,
                    nationaux: registre.nationaux,
                    source: registre.source,
                    reserve: registre.reserve,
                }
                : null,
            dateReference: reference.toISOString().slice(0, 10),
        };
    }
    async enregistrer(tenantId, dto) {
        await this.exigerPerimetre(tenantId);
        if (!Number.isInteger(dto.dureeAnnees) || dto.dureeAnnees < 1) {
            throw new common_1.BadRequestException('La durée de l’accord, en années, est exigée · la loi n° 004/2001 n’en fixe aucune, et les dix ans ' +
                'souvent cités viennent de l’article IX du MODÈLE annexé au guide Kahasha. Recopiez celle de l’accord ' +
                'réellement signé.');
        }
        return this.prisma.accordCadrePlan.create({
            data: {
                tenantId,
                reference: dto.reference.trim(),
                dateSignature: new Date(dto.dateSignature),
                dureeAnnees: dto.dureeAnnees,
                taciteReconduction: dto.taciteReconduction ?? false,
                preavisMois: dto.preavisMois ?? null,
                representationRdc: dto.representationRdc?.trim() || null,
                attestationsBonneConduiteLe: dto.attestationsBonneConduiteLe
                    ? new Date(dto.attestationsBonneConduiteLe)
                    : null,
            },
        });
    }
    async declarerMainOeuvre(tenantId, id, dto) {
        await this.exigerPerimetre(tenantId);
        const accord = await this.prisma.accordCadrePlan.findFirst({ where: { id, tenantId } });
        if (!accord)
            throw new common_1.NotFoundException('Accord-cadre introuvable');
        if (!dto.source.trim()) {
            throw new common_1.BadRequestException('La source du relevé est exigée · registre du personnel, états de paie, déclaration ONEM. Le registre ' +
                'd’OmegaX propose cette part sans la substituer : c’est la source qu’un contrôleur demandera, pas le ' +
                'pourcentage.');
        }
        if (dto.part < 0 || dto.part > 100) {
            throw new common_1.BadRequestException('La part de main-d’œuvre locale est un pourcentage, entre 0 et 100.');
        }
        return this.prisma.accordCadrePlan.update({
            where: { id: accord.id },
            data: {
                partMainOeuvreLocale: dto.part,
                sourceMainOeuvre: dto.source.trim(),
                dateMainOeuvre: new Date(dto.date),
            },
        });
    }
    async denoncer(tenantId, id, dto) {
        await this.exigerPerimetre(tenantId);
        const accord = await this.prisma.accordCadrePlan.findFirst({ where: { id, tenantId } });
        if (!accord)
            throw new common_1.NotFoundException('Accord-cadre introuvable');
        if (!dto.motif.trim()) {
            throw new common_1.BadRequestException('Le motif de la dénonciation est exigé · sans lui, une dénonciation par le Gouvernement ne se distingue ' +
                'plus d’un retrait volontaire de l’ONG, et c’est précisément la distinction qui compte.');
        }
        return this.prisma.accordCadrePlan.update({
            where: { id: accord.id },
            data: { denonceLe: new Date(dto.denonceLe), motifDenonciation: dto.motif.trim() },
        });
    }
};
exports.AccordCadreService = AccordCadreService;
exports.AccordCadreService = AccordCadreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccordCadreService);
//# sourceMappingURL=accord-cadre.service.js.map