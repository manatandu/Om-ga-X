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
exports.SimulationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const comparabilite_exercices_1 = require("../etats-financiers/comparabilite-exercices");
const simulateur_budgetaire_1 = require("./simulateur-budgetaire");
let SimulationsService = class SimulationsService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    lister(tenantId) {
        return this.prisma.simulationBudgetaire.findMany({
            where: { tenantId },
            orderBy: { nom: 'asc' },
            include: {
                exerciceReference: { select: { dateDebut: true, dateFin: true } },
                exerciceCible: { select: { dateDebut: true, dateFin: true } },
            },
        });
    }
    async verifier(tenantId, dto) {
        const refus = (0, simulateur_budgetaire_1.motifRefusSimulation)({ croissanceProduitsPct: dto.croissanceProduitsPct, variations: dto.variations }, { orangePct: dto.seuilOrangePct, rougePct: dto.seuilRougePct });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const [ref, cible] = await Promise.all([
            this.prisma.exercice.findFirst({ where: { id: dto.exerciceReferenceId, tenantId } }),
            this.prisma.exercice.findFirst({ where: { id: dto.exerciceCibleId, tenantId } }),
        ]);
        if (!ref || !cible)
            throw new common_1.NotFoundException('Exercice introuvable dans ce dossier.');
        if (cible.dateDebut <= ref.dateDebut) {
            throw new common_1.BadRequestException("L'exercice simulé suit l'exercice de référence · simuler une année sur elle-même ou sur une année passée ne compare rien.");
        }
    }
    donnees(dto, tenantId, auteur) {
        return {
            tenantId,
            nom: dto.nom.trim(),
            exerciceReferenceId: dto.exerciceReferenceId,
            exerciceCibleId: dto.exerciceCibleId,
            hypotheses: { croissanceProduitsPct: dto.croissanceProduitsPct, variations: dto.variations },
            seuilOrangePct: dto.seuilOrangePct,
            seuilRougePct: dto.seuilRougePct,
            creePar: auteur,
        };
    }
    conflit(e, nom) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new common_1.ConflictException(`Une simulation « ${nom.trim()} » existe déjà.`);
        }
        throw e;
    }
    async creer(tenantId, auteur, dto) {
        await this.verifier(tenantId, dto);
        try {
            return await this.prisma.simulationBudgetaire.create({ data: this.donnees(dto, tenantId, auteur) });
        }
        catch (e) {
            this.conflit(e, dto.nom);
        }
    }
    async modifier(tenantId, auteur, id, dto) {
        const s = await this.prisma.simulationBudgetaire.findFirst({ where: { id, tenantId } });
        if (!s)
            throw new common_1.NotFoundException('Simulation introuvable dans ce dossier.');
        await this.verifier(tenantId, dto);
        try {
            return await this.prisma.simulationBudgetaire.update({ where: { id: s.id }, data: this.donnees(dto, tenantId, auteur) });
        }
        catch (e) {
            this.conflit(e, dto.nom);
        }
    }
    async supprimer(tenantId, id) {
        const s = await this.prisma.simulationBudgetaire.findFirst({ where: { id, tenantId } });
        if (!s)
            throw new common_1.NotFoundException('Simulation introuvable dans ce dossier.');
        await this.prisma.simulationBudgetaire.delete({ where: { id: s.id } });
        return { supprime: true };
    }
    async calculer(tenantId, id, options = {}) {
        const s = await this.prisma.simulationBudgetaire.findFirst({
            where: { id, tenantId },
            include: { exerciceReference: true, exerciceCible: true },
        });
        if (!s)
            throw new common_1.NotFoundException('Simulation introuvable dans ce dossier.');
        const cible = s.exerciceCible;
        let arrete = options.arreteAu ? new Date(`${options.arreteAu}T23:59:59.999Z`) : new Date();
        if (Number.isNaN(arrete.getTime()))
            throw new common_1.BadRequestException("La date d'arrêté est une date (AAAA-MM-JJ).");
        if (arrete > cible.dateFin)
            arrete = cible.dateFin;
        const avantDebut = arrete < cible.dateDebut;
        const brouillard = options.inclureBrouillard ?? true;
        const [balRef, balCible, totaux] = await Promise.all([
            this.ecritures.balance(tenantId, s.exerciceReferenceId, brouillard),
            avantDebut ? Promise.resolve(null) : this.ecritures.balance(tenantId, s.exerciceCibleId, brouillard, arrete),
            this.prisma.compte.findMany({
                where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.TOTAL, numero: { in: [...'0123456789'].flatMap((d) => [`6${d}`, `7${d}`]) } },
                select: { numero: true, intitule: true },
            }),
        ]);
        const prorata = avantDebut ? 0 : (0, simulateur_budgetaire_1.prorataTemporis)(cible.dateDebut, cible.dateFin, arrete);
        const resultat = (0, simulateur_budgetaire_1.simuler)({
            reference: (0, simulateur_budgetaire_1.montantsParRacine)(balRef.lignes),
            realise: balCible ? (0, simulateur_budgetaire_1.montantsParRacine)(balCible.lignes) : null,
            intitules: new Map(totaux.map((c) => [c.numero, c.intitule])),
            hypotheses: s.hypotheses,
            seuils: { orangePct: Number(s.seuilOrangePct), rougePct: Number(s.seuilRougePct) },
            prorata,
        });
        const moisRef = (0, comparabilite_exercices_1.moisCouverts)(s.exerciceReference);
        const moisCible = (0, comparabilite_exercices_1.moisCouverts)(cible);
        const reserves = [];
        if (moisRef !== moisCible) {
            reserves.push(`L'exercice de référence couvre ${moisRef} mois et l'exercice simulé ${moisCible} · le prévu reprend le réalisé tel quel, sans l'adapter à la durée. Ajustez les taux en conséquence.`);
        }
        return {
            simulation: { id: s.id, nom: s.nom, hypotheses: s.hypotheses, seuils: { orangePct: Number(s.seuilOrangePct), rougePct: Number(s.seuilRougePct) } },
            arreteAu: avantDebut ? null : arrete.toISOString().slice(0, 10),
            prorata,
            reserves,
            ...resultat,
        };
    }
};
exports.SimulationsService = SimulationsService;
exports.SimulationsService = SimulationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], SimulationsService);
//# sourceMappingURL=simulations.service.js.map