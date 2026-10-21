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
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const variation_stocks_1 = require("./variation-stocks");
let StockService = class StockService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async proposer(tenantId, exerciceId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, methodeInventaireStocks: true },
        });
        if (tenant.methodeInventaireStocks === null) {
            return {
                methode: null,
                referentiel: tenant.referentiel,
                reserve: "Ce dossier n'a pas déclaré son mode de tenue des stocks. Les deux textes laissent le " +
                    "choix à l'entité · « la comptabilisation des stocks repose sur la tenue soit d'un " +
                    "inventaire permanent, soit d'un inventaire intermittent » (AUDCIF Titre VII ch. 3 " +
                    'section 3 · SYCEBNL Partie 2 ch. 3 section 3). OmegaX ne le devine pas : le déclarer ' +
                    'dans les paramètres du dossier ouvre cette fenêtre.',
                proposition: null,
            };
        }
        if (tenant.methodeInventaireStocks === client_1.MethodeInventaireStocks.PERMANENT) {
            return {
                methode: tenant.methodeInventaireStocks,
                referentiel: tenant.referentiel,
                reserve: 'Ce dossier tient un inventaire PERMANENT : chaque entrée et chaque sortie de stock ' +
                    'passent déjà par le compte de variation, en continu. Il n’y a donc AUCUNE écriture ' +
                    "de variation à passer à la clôture · en passer une compterait la variation deux fois, " +
                    "et l'écriture s'équilibrerait. Ce qui reste dû à la clôture est le rapprochement de " +
                    "l'inventaire physique avec l'inventaire comptable, et la régularisation des différences " +
                    "constatées en plus ou en moins · le module d'inventaire physique le porte.",
                proposition: null,
            };
        }
        const [comptes, balance, fiches] = await Promise.all([
            this.prisma.compte.findMany({
                where: { tenantId, classe: client_1.ClasseCompte.CLASSE_3, typeCompte: client_1.TypeCompteDetailTotal.DETAIL },
                select: { id: true, numero: true, intitule: true },
                orderBy: { numero: 'asc' },
            }),
            this.ecritureService.balance(tenantId, exerciceId),
            this.stockFinalParCompte(tenantId, exerciceId),
        ]);
        const soldes = new Map(balance.lignes.map((l) => [l.compteId, l.solde]));
        const aVarier = comptes.map((c) => {
            const compte = fiches.get(c.id);
            return {
                numero: c.numero,
                intitule: c.intitule,
                soldeInitial: soldes.get(c.id) ?? 0,
                stockFinal: compte?.valeur ?? null,
                source: compte?.source ?? '',
            };
        });
        const proposition = (0, variation_stocks_1.proposerVariations)(aVarier, tenant.referentiel);
        const lignes = (0, variation_stocks_1.lignesDeLEcriture)(proposition);
        return {
            methode: tenant.methodeInventaireStocks,
            referentiel: tenant.referentiel,
            reserve: null,
            proposition: {
                ...proposition,
                lignes,
                totaux: (0, variation_stocks_1.totaux)(lignes),
                comptes: comptes.map((c) => ({ id: c.id, numero: c.numero, intitule: c.intitule })),
            },
        };
    }
    async stockFinalParCompte(tenantId, exerciceId) {
        const campagne = await this.prisma.campagneInventaire.findFirst({
            where: { tenantId, exerciceId },
            orderBy: { dateInventaire: 'desc' },
            select: { id: true, libelle: true, dateInventaire: true },
        });
        const parCompte = new Map();
        if (!campagne)
            return parCompte;
        const fiches = await this.prisma.ficheInventaire.findMany({
            where: { tenantId, campagneId: campagne.id },
            select: { compteId: true, valeurInventaire: true },
        });
        const incomplets = new Set();
        for (const f of fiches) {
            if (f.valeurInventaire === null) {
                incomplets.add(f.compteId);
                continue;
            }
            const actuel = parCompte.get(f.compteId);
            const valeur = Number(f.valeurInventaire) + (actuel?.valeur ?? 0);
            parCompte.set(f.compteId, {
                valeur,
                source: `${campagne.libelle} du ${campagne.dateInventaire.toISOString().slice(0, 10)}`,
            });
        }
        for (const compteId of incomplets)
            parCompte.delete(compteId);
        return parCompte;
    }
    async enregistrer(tenantId, userId, dto) {
        const etat = await this.proposer(tenantId, dto.exerciceId);
        if (!etat.proposition) {
            throw new common_1.BadRequestException(etat.reserve ?? 'Aucune variation de stocks à enregistrer.');
        }
        const lignes = etat.proposition.lignes;
        if (lignes.length === 0) {
            throw new common_1.BadRequestException("Aucune variation à passer : aucun compte de stock de ce dossier n'a de stock final " +
                "constaté, ou tous sont restés sans mouvement. L'écriture serait vide.");
        }
        const journal = await this.prisma.journal.findFirst({
            where: { id: dto.journalId, tenantId },
            select: { id: true },
        });
        if (!journal)
            throw new common_1.BadRequestException('Journal introuvable dans ce dossier');
        const numerosDemandes = [...new Set(lignes.flatMap((l) => [l.compte, l.compte.padEnd(8, '0')]))];
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, numero: { in: numerosDemandes } },
            select: { id: true, numero: true, typeCompte: true },
        });
        const parNumero = new Map(comptes.map((c) => [c.numero, c]));
        const manquants = lignes
            .map((l) => l.compte)
            .filter((numero) => !parNumero.has(numero) && !parNumero.has(numero.padEnd(8, '0')));
        if (manquants.length) {
            throw new common_1.BadRequestException(`Ces comptes ne sont pas ouverts en imputation dans ce dossier : ${[
                ...new Set(manquants),
            ].join(', ')}. Ouvrez-les au plan comptable avant de passer la variation.`);
        }
        return this.ecritureService.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.date,
            libelle: dto.libelle?.trim() || 'Variation des stocks · inventaire intermittent',
            reference: dto.reference,
            lignes: lignes.map((l) => {
                const compte = parNumero.get(l.compte) ?? parNumero.get(l.compte.padEnd(8, '0'));
                return {
                    compteId: compte.id,
                    libelle: l.libelle,
                    ...(l.sens === 'DEBIT' ? { debit: l.montant } : { credit: l.montant }),
                };
            }),
        });
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], StockService);
//# sourceMappingURL=stock.service.js.map