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
exports.SelectionsEditionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma.service");
const selections_edition_1 = require("./selections-edition");
let SelectionsEditionService = class SelectionsEditionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async lister(tenantId, edition) {
        const [lues, total] = await Promise.all([
            this.prisma.selectionEdition.findMany({
                where: { tenantId, edition },
                orderBy: { nom: 'asc' },
                take: selections_edition_1.PLAFOND_SELECTIONS,
                select: { id: true, edition: true, nom: true, criteres: true, creePar: true, creeLe: true, modifieLe: true },
            }),
            this.prisma.selectionEdition.count({ where: { tenantId, edition } }),
        ]);
        const journalIds = [...new Set(lues.map((s) => s.criteres.journalId).filter((x) => typeof x === 'string'))];
        const journaux = journalIds.length
            ? await this.prisma.journal.findMany({ where: { tenantId, id: { in: journalIds } }, select: { id: true } })
            : [];
        const presents = new Set(journaux.map((j) => j.id));
        const auteurs = await this.prisma.user.findMany({
            where: { tenantId, id: { in: [...new Set(lues.map((s) => s.creePar))] } },
            select: { id: true, email: true },
        });
        const courriel = new Map(auteurs.map((u) => [u.id, u.email]));
        return {
            selections: lues.map((s) => {
                const journalId = s.criteres.journalId;
                return {
                    ...s,
                    creePar: courriel.get(s.creePar) ?? 'utilisateur retiré du dossier',
                    journalIntrouvable: typeof journalId === 'string' && !presents.has(journalId),
                };
            }),
            total,
            tronque: total > lues.length,
        };
    }
    async creer(tenantId, userId, edition, nomBrut, brut) {
        const nom = (0, selections_edition_1.nomOuMotif)(nomBrut);
        if ('motif' in nom)
            throw new common_1.BadRequestException(nom.motif);
        const criteres = await this.criteresDuDossier(tenantId, edition, brut);
        try {
            return await this.prisma.selectionEdition.create({
                data: { tenantId, edition, nom: nom.nom, criteres, creePar: userId },
                select: { id: true, edition: true, nom: true, criteres: true },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Une sélection de cette édition porte déjà le nom « ${nom.nom} » · remplacez-la ou choisissez un autre nom.`);
            }
            throw e;
        }
    }
    async remplacer(tenantId, id, brut) {
        const existante = await this.prisma.selectionEdition.findFirst({ where: { id, tenantId }, select: { id: true, edition: true } });
        if (!existante)
            throw new common_1.NotFoundException('Sélection introuvable pour ce dossier.');
        const criteres = await this.criteresDuDossier(tenantId, existante.edition, brut);
        return this.prisma.selectionEdition.update({
            where: { id: existante.id },
            data: { criteres, modifieLe: new Date() },
            select: { id: true, edition: true, nom: true, criteres: true },
        });
    }
    async supprimer(tenantId, id) {
        const existante = await this.prisma.selectionEdition.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!existante)
            throw new common_1.NotFoundException('Sélection introuvable pour ce dossier.');
        await this.prisma.selectionEdition.delete({ where: { id: existante.id } });
        return { supprimee: true };
    }
    async criteresDuDossier(tenantId, edition, brut) {
        const lu = (0, selections_edition_1.criteresSelectionOuMotif)(edition, brut);
        if ('motif' in lu)
            throw new common_1.BadRequestException(lu.motif);
        const journalId = lu.criteres.journalId;
        if (typeof journalId === 'string') {
            const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true } });
            if (!journal)
                throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
        }
        return lu.criteres;
    }
};
exports.SelectionsEditionService = SelectionsEditionService;
exports.SelectionsEditionService = SelectionsEditionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SelectionsEditionService);
//# sourceMappingURL=selections-edition.service.js.map