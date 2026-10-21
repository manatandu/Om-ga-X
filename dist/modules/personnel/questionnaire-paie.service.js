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
exports.QuestionnairePaieService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const bulletin_paie_1 = require("./bulletin-paie");
let QuestionnairePaieService = class QuestionnairePaieService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lire(tenantId, salarieId, mois) {
        if (mois !== undefined && !(0, bulletin_paie_1.moisValide)(mois))
            throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { effectifPermanent: true, numeroAffiliationCnssEmployeur: true },
        });
        if (!salarieId)
            return { dossier, salarie: null };
        const s = await this.prisma.salarie.findFirst({
            where: { id: salarieId, tenantId },
            select: {
                id: true,
                nom: true,
                prenoms: true,
                numeroAffiliationCnss: true,
                modePaiement: true,
                contrats: {
                    take: 200,
                    orderBy: { dateEntreeEnVigueur: 'desc' },
                    select: {
                        id: true,
                        type: true,
                        dateEntreeEnVigueur: true,
                        dateFin: true,
                        classeProfessionnelle: true,
                        periodiciteRemuneration: true,
                        deviseRemuneration: true,
                    },
                },
            },
        });
        if (!s)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        const contrat = mois ? (0, bulletin_paie_1.contratCouvrantLeMois)(s.contrats, mois) : (s.contrats.find((c) => c.dateFin === null) ?? null);
        return {
            dossier,
            salarie: {
                id: s.id,
                nomComplet: [s.nom, s.prenoms].filter(Boolean).join(' '),
                numeroAffiliationCnss: s.numeroAffiliationCnss,
                modePaiement: s.modePaiement,
                contrat: contrat
                    ? {
                        id: contrat.id,
                        type: contrat.type,
                        classeProfessionnelle: contrat.classeProfessionnelle,
                        periodiciteRemuneration: contrat.periodiciteRemuneration,
                        deviseRemuneration: contrat.deviseRemuneration,
                    }
                    : null,
            },
        };
    }
};
exports.QuestionnairePaieService = QuestionnairePaieService;
exports.QuestionnairePaieService = QuestionnairePaieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuestionnairePaieService);
//# sourceMappingURL=questionnaire-paie.service.js.map