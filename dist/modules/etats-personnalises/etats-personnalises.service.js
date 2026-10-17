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
exports.EtatsPersonnalisesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const moteur_etat_personnalise_1 = require("./moteur-etat-personnalise");
let EtatsPersonnalisesService = class EtatsPersonnalisesService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    lister(tenantId) {
        return this.prisma.etatPersonnalise.findMany({ where: { tenantId }, orderBy: { nom: 'asc' } });
    }
    verifier(dto) {
        const lignes = dto.lignes.map((l) => ({
            cle: l.cle.trim().toUpperCase(),
            libelle: l.libelle.trim(),
            racines: l.racines?.trim() || undefined,
            mesure: l.mesure,
            sens: l.sens,
            total: l.total?.trim().toUpperCase() || undefined,
        }));
        const motif = (0, moteur_etat_personnalise_1.motifRefusDefinition)(lignes);
        if (motif)
            throw new common_1.BadRequestException(motif);
        return lignes;
    }
    async doublon(p, nom) {
        try {
            return await p;
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Un état « ${nom} » existe déjà dans ce dossier.`);
            }
            throw e;
        }
    }
    creer(tenantId, dto) {
        const lignes = this.verifier(dto);
        return this.doublon(this.prisma.etatPersonnalise.create({ data: { tenantId, nom: dto.nom.trim(), lignes: lignes } }), dto.nom.trim());
    }
    async modifier(tenantId, id, dto) {
        await this.lire(tenantId, id);
        const lignes = this.verifier(dto);
        return this.doublon(this.prisma.etatPersonnalise.update({ where: { id }, data: { nom: dto.nom.trim(), lignes: lignes } }), dto.nom.trim());
    }
    async supprimer(tenantId, id) {
        await this.lire(tenantId, id);
        await this.prisma.etatPersonnalise.delete({ where: { id } });
        return { supprime: true };
    }
    async lire(tenantId, id) {
        const e = await this.prisma.etatPersonnalise.findFirst({ where: { id, tenantId } });
        if (!e)
            throw new common_1.NotFoundException('État introuvable');
        return e;
    }
    async calculer(tenantId, id, exerciceIds, inclureBrouillard) {
        const etat = await this.lire(tenantId, id);
        const lignes = etat.lignes;
        const motif = (0, moteur_etat_personnalise_1.motifRefusDefinition)(lignes);
        if (motif)
            throw new common_1.BadRequestException(`Définition à corriger · ${motif}`);
        const ids = [...new Set(exerciceIds)].filter(Boolean);
        if (ids.length === 0)
            throw new common_1.BadRequestException('Choisissez au moins un exercice.');
        if (ids.length > moteur_etat_personnalise_1.PLAFOND_EXERCICES)
            throw new common_1.BadRequestException(`Au plus ${moteur_etat_personnalise_1.PLAFOND_EXERCICES} exercices côte à côte.`);
        const exercices = await this.prisma.exercice.findMany({
            where: { tenantId, id: { in: ids } },
            orderBy: { dateDebut: 'asc' },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (exercices.length !== ids.length)
            throw new common_1.NotFoundException('Exercice introuvable dans ce dossier.');
        const colonnes = await Promise.all(exercices.map(async (ex) => ({
            exerciceId: ex.id,
            dateDebut: ex.dateDebut,
            dateFin: ex.dateFin,
            valeurs: (0, moteur_etat_personnalise_1.calculerColonne)(lignes, (await this.ecritures.balance(tenantId, ex.id, inclureBrouillard)).lignes),
        })));
        return { etat: { id: etat.id, nom: etat.nom, lignes }, inclureBrouillard, colonnes };
    }
};
exports.EtatsPersonnalisesService = EtatsPersonnalisesService;
exports.EtatsPersonnalisesService = EtatsPersonnalisesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], EtatsPersonnalisesService);
//# sourceMappingURL=etats-personnalises.service.js.map