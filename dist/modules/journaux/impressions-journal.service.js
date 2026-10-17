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
exports.ImpressionsJournalService = exports.PLAFOND_IMPRESSIONS_LISTEES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const impressions_journal_1 = require("./impressions-journal");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
exports.PLAFOND_IMPRESSIONS_LISTEES = 200;
const jour = (d) => d.toISOString().slice(0, 10);
let ImpressionsJournalService = class ImpressionsJournalService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async imprimer(tenantId, userId, dto) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: dto.exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        const journalId = dto.journalId ?? null;
        if (journalId) {
            const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true, code: true, type: true } });
            if (!journal)
                throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
            if ((0, ecritures_de_situation_1.estJournalDeSituation)(journal)) {
                return { numero: null, imprimeAt: null, nombreEcritures: null, motif: (0, ecritures_de_situation_1.motifImpressionDeSituationNonNumerotee)(journal.code) };
            }
        }
        const periode = (0, impressions_journal_1.periodeCouverte)(exercice, dto);
        const nombreEcritures = await this.prisma.ecriture.count({
            where: (0, ecriture_service_1.perimetreJournal)(tenantId, {
                exerciceId: exercice.id,
                ...(journalId ? { journalId } : {}),
                dateDebut: jour(periode.dateDebut),
                dateFin: jour(periode.dateFin),
            }),
        });
        if (nombreEcritures > ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE) {
            throw new common_1.BadRequestException(`Le journal de cette période porte ${nombreEcritures.toLocaleString('fr-FR')} pièces, au-delà de ce que la fenêtre ` +
                `affiche (${ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE.toLocaleString('fr-FR')}) · son impression n'en montrerait qu'une partie. ` +
                "Exportez-le en Excel · l'export le rend en entier et s'enregistre comme impression.");
        }
        if (nombreEcritures === 0) {
            return {
                numero: null,
                imprimeAt: null,
                nombreEcritures,
                motif: "Aucune pièce dans le journal de cette période · l'impression n'est pas enregistrée.",
            };
        }
        return (0, impressions_journal_1.enregistrerImpression)(this.prisma, {
            tenantId,
            exerciceId: exercice.id,
            journalId,
            dateDebut: periode.dateDebut,
            dateFin: periode.dateFin,
            forme: client_1.FormeImpressionJournal.IMPRESSION,
            nombreEcritures,
            imprimePar: userId,
        });
    }
    async lister(tenantId, exerciceId) {
        const [impressions, total] = await Promise.all([
            this.prisma.impressionJournal.findMany({
                where: { tenantId, exerciceId },
                orderBy: { numero: 'desc' },
                take: exports.PLAFOND_IMPRESSIONS_LISTEES,
                include: { journal: { select: { code: true } } },
            }),
            this.prisma.impressionJournal.count({ where: { tenantId, exerciceId } }),
        ]);
        const auteurs = await this.prisma.user.findMany({
            where: { tenantId, id: { in: [...new Set(impressions.map((i) => i.imprimePar))] } },
            select: { id: true, email: true },
        });
        const courriel = new Map(auteurs.map((u) => [u.id, u.email]));
        return {
            impressions: impressions.map((i) => ({
                id: i.id,
                numero: i.numero,
                journal: i.journal?.code ?? null,
                dateDebut: i.dateDebut,
                dateFin: i.dateFin,
                forme: i.forme,
                nombreEcritures: i.nombreEcritures,
                imprimeAt: i.imprimeAt,
                imprimePar: courriel.get(i.imprimePar) ?? 'utilisateur retiré du dossier',
            })),
            total,
            tronque: total > impressions.length,
        };
    }
};
exports.ImpressionsJournalService = ImpressionsJournalService;
exports.ImpressionsJournalService = ImpressionsJournalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ImpressionsJournalService);
//# sourceMappingURL=impressions-journal.service.js.map