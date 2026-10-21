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
exports.ConstitutionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const catalogue_constitution_1 = require("./catalogue-constitution");
let ConstitutionService = class ConstitutionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async parcours(tenantId) {
        const t = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: {
                formeJuridique: true,
                droitEtranger: true,
                actePersonnaliteJuridique: true,
                dateActePersonnalite: true,
                numeroEnregistrementSecteur: true,
                certificatEnregistrementPlan: true,
            },
        });
        const champs = (0, catalogue_constitution_1.champsIdentificationDeLaForme)(t.formeJuridique, t.droitEtranger);
        const enregistrement = {
            champ: `Enregistrement au ministère du secteur (${t.droitEtranger ? 'art. 31' : 'art. 36'})`,
            valeur: t.numeroEnregistrementSecteur,
        };
        const detenu = {
            ...(champs.enregistrementSecteur
                ? { 'avis-tutelle': enregistrement, 'avis-enregistrement-secteur': enregistrement }
                : {}),
            'personnalite-juridique': {
                champ: t.droitEtranger ? 'Décret d’autorisation' : 'Acte accordant la personnalité juridique',
                valeur: t.actePersonnaliteJuridique,
            },
            ...(champs.certificatPlan
                ? {
                    'enregistrement-plan': {
                        champ: 'Certificat d’enregistrement du Ministère du Plan',
                        valeur: t.certificatEnregistrementPlan,
                    },
                }
                : {}),
        };
        const etapes = (0, catalogue_constitution_1.parcoursConstitution)(t.formeJuridique, t.droitEtranger).map((e) => {
            const d = detenu[e.cle];
            return {
                ...e,
                produitDetenu: d ? { ...d, renseigne: Boolean(d.valeur) } : null,
                motifSansProduit: d
                    ? null
                    : e.cle === 'conditions-ong-etrangere'
                        ? 'Tenu dans la fenêtre Accord-cadre'
                        : 'Aucun champ du dossier ne porte cet acte',
            };
        });
        const pieces = (0, catalogue_constitution_1.piecesDuParcours)(t.formeJuridique, t.droitEtranger);
        return {
            etapes,
            horsParcours: (0, catalogue_constitution_1.motifHorsParcours)(t.formeJuridique),
            champsPortes: champs,
            formeJuridique: t.formeJuridique,
            droitEtranger: t.droitEtranger,
            dateActePersonnalite: t.dateActePersonnalite,
            parFondement: {
                LOI: pieces.filter((p) => p.fondement === 'LOI').length,
                PRATIQUE_ADMINISTRATIVE: pieces.filter((p) => p.fondement === 'PRATIQUE_ADMINISTRATIVE').length,
                USAGE_SANS_BASE_LEGALE: pieces.filter((p) => p.fondement === 'USAGE_SANS_BASE_LEGALE').length,
            },
        };
    }
};
exports.ConstitutionService = ConstitutionService;
exports.ConstitutionService = ConstitutionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConstitutionService);
//# sourceMappingURL=constitution.service.js.map