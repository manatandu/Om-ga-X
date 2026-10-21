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
exports.ManuelProceduresService = exports.SQUELETTE_MANUEL = void 0;
exports.sourceManuel = sourceManuel;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
exports.SQUELETTE_MANUEL = [
    { cle: 'organisation', titre: 'Organisation générale et comptable de l’entité', texte: '' },
    { cle: 'plan-comptes', titre: 'Plan comptable particulier, livres et supports de traitement', texte: '' },
    { cle: 'etats-sortie', titre: 'États de sortie', texte: '' },
    {
        cle: 'travaux-etats-financiers',
        titre: 'Organisation des travaux d’élaboration et de présentation des états financiers',
        texte: '',
    },
    {
        cle: 'classement-archivage',
        titre: 'Système de classement et d’archivage des documents et pièces comptables',
        texte: '',
    },
    { cle: 'instruction-inventaire', titre: 'Modèle d’instruction d’inventaire', texte: '' },
    {
        cle: 'procedures-controle-interne',
        titre: 'Description des procédures comptables et de contrôle interne',
        texte: '',
    },
];
function sourceManuel(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? "AUDCIF art. 16 al. 1 et art. 17, 3°, rendus applicables aux entités à but non lucratif par l'art. 3 du " +
            "SYCEBNL, qui ne les exclut pas ; et art. 16, 2) du SYCEBNL lui-même, qui exige « la mise en place de " +
            'procédures nécessaires à une organisation comptable permettant un contrôle interne fiable et le contrôle ' +
            'externe »'
        : 'AUDCIF art. 16 al. 1 (établissement du manuel) et art. 17, 3° (classement des pièces dans l’ordre qu’il définit)';
}
let ManuelProceduresService = class ManuelProceduresService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const versions = await this.prisma.manuelProcedures.findMany({
            where: { tenantId },
            orderBy: { version: 'desc' },
        });
        return versions.map((v) => ({ ...v, sections: v.sections }));
    }
    async conformite(tenantId) {
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const versions = await this.lister(tenantId);
        const enVigueur = versions[0] ?? null;
        const sectionsVides = enVigueur
            ? enVigueur.sections.filter((s) => !s.texte.trim()).map((s) => s.titre)
            : [];
        return {
            source: sourceManuel(referentiel),
            existe: enVigueur !== null,
            versionEnVigueur: enVigueur?.version ?? null,
            dateApplication: enVigueur?.dateApplication ?? null,
            nombreVersions: versions.length,
            sectionsVides,
            classementRenseigne: enVigueur
                ? enVigueur.sections.some((s) => s.cle === 'classement-archivage' && s.texte.trim().length > 0)
                : false,
        };
    }
    async enregistrer(tenantId, userId, dto) {
        if (dto.sections.length === 0) {
            throw new common_1.BadRequestException('Un manuel sans aucune section ne décrit rien');
        }
        const cles = dto.sections.map((s) => s.cle);
        if (new Set(cles).size !== cles.length) {
            throw new common_1.BadRequestException('Deux sections portent la même clé · chaque section doit être identifiable');
        }
        const derniere = await this.prisma.manuelProcedures.findFirst({
            where: { tenantId },
            orderBy: { version: 'desc' },
            select: { version: true },
        });
        return this.prisma.manuelProcedures.create({
            data: {
                tenantId,
                version: (derniere?.version ?? 0) + 1,
                dateApplication: new Date(dto.dateApplication),
                sections: dto.sections,
                createdBy: userId,
            },
        });
    }
};
exports.ManuelProceduresService = ManuelProceduresService;
exports.ManuelProceduresService = ManuelProceduresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ManuelProceduresService);
//# sourceMappingURL=manuel-procedures.service.js.map