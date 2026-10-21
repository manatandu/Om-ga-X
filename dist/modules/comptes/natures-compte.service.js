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
exports.NaturesCompteService = void 0;
exports.naturesDuDossier = naturesDuDossier;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const natures_compte_1 = require("./natures-compte");
async function naturesDuDossier(prisma, tenantId) {
    const client = prisma;
    let lignes = await client.natureCompte.findMany({ where: { tenantId } });
    const manquantes = natures_compte_1.NATURES_PAR_DEFAUT.filter((d) => !lignes.some((l) => l.nature === d.nature));
    if (manquantes.length > 0) {
        await client.natureCompte.createMany({
            data: manquantes.map((d) => ({
                tenantId,
                nature: d.nature,
                fourchettes: d.fourchettes,
                modeReportANouveau: d.modeReportANouveau,
                lettrable: d.lettrable,
            })),
            skipDuplicates: true,
        });
        lignes = await client.natureCompte.findMany({ where: { tenantId } });
    }
    const ordre = natures_compte_1.NATURES_PAR_DEFAUT.map((d) => d.nature);
    return lignes
        .map((l) => ({ nature: l.nature, fourchettes: (0, natures_compte_1.lireFourchettes)(l.fourchettes), modeReportANouveau: l.modeReportANouveau, lettrable: l.lettrable }))
        .sort((a, b) => ordre.indexOf(a.nature) - ordre.indexOf(b.nature));
}
let NaturesCompteService = class NaturesCompteService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId) {
        const natures = await naturesDuDossier(this.prisma, tenantId);
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId },
            select: { id: true, numero: true, intitule: true, typeCompte: true, modeReportANouveau: true },
            orderBy: { numero: 'asc' },
        });
        return {
            natures: natures.map((n) => ({ ...n, libelle: natures_compte_1.LIBELLES_NATURE[n.nature] })),
            incoherences: (0, natures_compte_1.incoherencesDeReport)(comptes, natures),
        };
    }
    async modifier(tenantId, nature, dto) {
        if (!Object.values(client_1.NatureCompteType).includes(nature))
            throw new common_1.BadRequestException('Nature de compte inconnue.');
        const natures = await naturesDuDossier(this.prisma, tenantId);
        if (dto.fourchettes) {
            const fourchettes = dto.fourchettes.map((f) => ({ du: String(f.du ?? '').trim(), au: String(f.au ?? '').trim() }));
            const refus = (0, natures_compte_1.motifRefusFourchettes)(nature, fourchettes, natures);
            if (refus)
                throw new common_1.BadRequestException(refus);
            dto = { ...dto, fourchettes };
        }
        await this.prisma.natureCompte.update({
            where: { tenantId_nature: { tenantId, nature } },
            data: {
                ...(dto.fourchettes ? { fourchettes: dto.fourchettes } : {}),
                ...(dto.modeReportANouveau ? { modeReportANouveau: dto.modeReportANouveau } : {}),
                ...(dto.lettrable !== undefined ? { lettrable: dto.lettrable } : {}),
            },
        });
        return this.lister(tenantId);
    }
    async aligner(tenantId, compteIds) {
        const { incoherences } = await this.lister(tenantId);
        const cibles = incoherences.filter((c) => !compteIds || compteIds.includes(c.id));
        for (const c of cibles) {
            await this.prisma.compte.update({ where: { id: c.id }, data: { modeReportANouveau: c.modeAttendu } });
        }
        return { alignes: cibles.length, ...(await this.lister(tenantId)) };
    }
    async natureDuNumero(tenantId, numero) {
        return (0, natures_compte_1.natureDe)(numero, await naturesDuDossier(this.prisma, tenantId));
    }
};
exports.NaturesCompteService = NaturesCompteService;
exports.NaturesCompteService = NaturesCompteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NaturesCompteService);
//# sourceMappingURL=natures-compte.service.js.map