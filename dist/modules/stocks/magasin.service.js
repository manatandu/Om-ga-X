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
exports.MagasinService = void 0;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const boni_mali_inventaire_1 = require("./boni-mali-inventaire");
const valorisation_stocks_1 = require("./valorisation-stocks");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
let MagasinService = class MagasinService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async modeDuDossier(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, methodeInventaireStocks: true },
        });
    }
    async listerArticles(tenantId) {
        const [articles, dossier] = await Promise.all([
            this.prisma.articleStock.findMany({
                where: { tenantId },
                include: {
                    compte: { select: { numero: true, intitule: true } },
                    _count: { select: { mouvements: { where: { annuleLe: null } } } },
                },
                orderBy: { code: 'asc' },
            }),
            this.modeDuDossier(tenantId),
        ]);
        return {
            referentiel: dossier.referentiel,
            modeInventaire: dossier.methodeInventaireStocks,
            reserve: dossier.methodeInventaireStocks === null
                ? "Ce dossier n'a pas déclaré son mode de tenue des stocks. Le magasin fonctionne, mais " +
                    "ni le boni ni le mali d'inventaire ne pourront être proposés : les deux textes les " +
                    "bornent à l'inventaire PERMANENT. Le mode se déclare dans les paramètres du dossier."
                : null,
            articles: articles.map((a) => ({
                id: a.id,
                code: a.code,
                designation: a.designation,
                uniteMesure: a.uniteMesure,
                methodeValorisation: a.methodeValorisation,
                actif: a.actif,
                compte: a.compte,
                nombreMouvements: a._count.mouvements,
            })),
        };
    }
    async creerArticle(tenantId, userId, dto) {
        const dossier = await this.modeDuDossier(tenantId);
        const compte = await this.prisma.compte.findFirst({
            where: { id: dto.compteId, tenantId },
            select: { id: true, numero: true, intitule: true, classe: true, typeCompte: true },
        });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable dans ce dossier.');
        if (compte.classe !== client_1.ClasseCompte.CLASSE_3) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} n'est pas un compte de stock (classe 3). Une fiche de stock ` +
                'se rapproche du solde de son compte : rattachée ailleurs, elle se rapprocherait de ' +
                "quelque chose qui n'est pas un stock.");
        }
        if (compte.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} est un en-tête de division, pas un compte d'imputation. Il ne ` +
                "reçoit jamais d'écriture : la régularisation d'inventaire serait refusée à la saisie, " +
                'après que le magasin a été compté.');
        }
        if (dossier.methodeInventaireStocks !== null &&
            !(0, valorisation_stocks_1.methodeCompatible)(dto.methodeValorisation, dossier.methodeInventaireStocks)) {
            throw new common_1.BadRequestException(`La méthode ${dto.methodeValorisation} ne va pas avec un inventaire ` +
                `${dossier.methodeInventaireStocks}. Le glossaire de l'AUDCIF (Titre VI) les apparie : ` +
                'le P.E.P.S. et le C.M.P.A.C.E. valorisent CHAQUE SORTIE, ce qu\'un inventaire ' +
                'intermittent ne connaît pas ; le coût moyen de période de stockage valorise le STOCK ' +
                "FINAL, ce qui ne dit rien des sorties d'un inventaire permanent.");
        }
        return this.prisma.articleStock.create({
            data: {
                tenantId,
                compteId: compte.id,
                code: dto.code.trim(),
                designation: dto.designation.trim(),
                uniteMesure: dto.uniteMesure.trim(),
                methodeValorisation: dto.methodeValorisation,
                createdBy: userId,
            },
        });
    }
    async ficheDeStock(tenantId, articleId) {
        const article = await this.prisma.articleStock.findFirst({
            where: { id: articleId, tenantId },
            include: { compte: { select: { numero: true, intitule: true } } },
        });
        if (!article)
            throw new common_1.NotFoundException('Article introuvable dans ce dossier.');
        const mouvements = await this.prisma.mouvementStock.findMany({
            where: { tenantId, articleId },
            orderBy: [{ date: 'asc' }, { ordre: 'asc' }],
            select: {
                id: true,
                date: true,
                ordre: true,
                sens: true,
                quantite: true,
                cout: true,
                piece: true,
                libelle: true,
                ecritureId: true,
                annuleLe: true,
                motifAnnulation: true,
            },
        });
        const actifs = mouvements.filter((m) => m.annuleLe === null);
        const bruts = actifs.map((m) => ({
            ordre: m.ordre,
            date: m.date.toISOString().slice(0, 10),
            sens: m.sens === client_1.SensMouvementStock.ENTREE ? 'ENTREE' : 'SORTIE',
            quantite: Number(m.quantite),
            cout: m.cout === null ? null : Number(m.cout),
        }));
        const valorisation = (0, valorisation_stocks_1.valoriser)(bruts, article.methodeValorisation);
        const parOrdre = new Map(valorisation.mouvements.map((m) => [m.ordre, m]));
        const dossier = await this.modeDuDossier(tenantId);
        return {
            article: {
                id: article.id,
                code: article.code,
                designation: article.designation,
                uniteMesure: article.uniteMesure,
                methodeValorisation: article.methodeValorisation,
                compte: article.compte,
            },
            modeInventaire: dossier.methodeInventaireStocks,
            referentiel: dossier.referentiel,
            lignes: mouvements.map((m) => {
                const v = parOrdre.get(m.ordre);
                return {
                    id: m.id,
                    date: m.date.toISOString().slice(0, 10),
                    ordre: m.ordre,
                    sens: m.sens,
                    piece: m.piece,
                    libelle: m.libelle,
                    quantite: Number(m.quantite),
                    valeur: v?.valeur ?? null,
                    coutUnitaire: v ? v.valeur / Number(m.quantite) : null,
                    quantiteApres: v?.quantiteApres ?? null,
                    valeurApres: v?.valeurApres ?? null,
                    ecritureId: m.ecritureId,
                    ecritureManquante: m.annuleLe === null &&
                        dossier.methodeInventaireStocks === client_1.MethodeInventaireStocks.PERMANENT &&
                        m.ecritureId === null,
                    annuleLe: m.annuleLe ? m.annuleLe.toISOString().slice(0, 10) : null,
                    motifAnnulation: m.motifAnnulation,
                    ecritureACorriger: m.annuleLe !== null && m.ecritureId !== null,
                };
            }),
            totaux: {
                quantiteFinale: valorisation.quantiteFinale,
                valeurFinale: valorisation.valeurFinale,
                totalEntrees: valorisation.totalEntrees,
                totalSorties: valorisation.totalSorties,
                quantiteEntree: bruts.filter((m) => m.sens === 'ENTREE').reduce((s, m) => s + m.quantite, 0),
                quantiteSortie: bruts.filter((m) => m.sens === 'SORTIE').reduce((s, m) => s + m.quantite, 0),
            },
            refus: valorisation.refus,
        };
    }
    async enregistrerMouvement(tenantId, userId, articleId, dto) {
        const article = await this.prisma.articleStock.findFirst({
            where: { id: articleId, tenantId },
            select: { id: true, actif: true, code: true },
        });
        if (!article)
            throw new common_1.NotFoundException('Article introuvable dans ce dossier.');
        if (!article.actif) {
            throw new common_1.BadRequestException(`L'article ${article.code} est retiré du magasin : il ne reçoit plus de mouvement. Ses ` +
                "mouvements passés restent lisibles, ils font partie de la piste d'audit.");
        }
        if (dto.sens === client_1.SensMouvementStock.SORTIE && dto.cout !== undefined && dto.cout !== null) {
            throw new common_1.BadRequestException("La valeur d'une sortie se CALCULE, elle ne se saisit pas. Les trois méthodes admises " +
                'reposent sur « un correct raccordement des sorties aux entrées » (AUDCIF Titre VI) : ' +
                'un coût imposé à la main rompt ce raccordement, et le stock cesse d\'être la ' +
                "différence de ce qui est entré et de ce qui est sorti.");
        }
        if (dto.sens === client_1.SensMouvementStock.ENTREE && !(Number(dto.cout) > 0)) {
            throw new common_1.BadRequestException("Une entrée porte son coût d'acquisition · prix d'achat, droits de douane et taxes non " +
                'récupérables, transport et manutention, rabais et remises déduits (AUDCIF Titre VII ' +
                'ch. 3). Sans lui, aucune sortie ultérieure ne peut être valorisée.');
        }
        if (dto.ecritureId) {
            const ecriture = await this.prisma.ecriture.findFirst({
                where: { id: dto.ecritureId, tenantId },
                select: { id: true, statut: true, numeroPiece: true },
            });
            if (!ecriture) {
                throw new common_1.BadRequestException("L'écriture indiquée n'existe pas dans ce dossier.");
            }
            if (ecriture.statut === client_1.StatutEcriture.SITUATION) {
                throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSimulationNonRattachable)(`n° ${ecriture.numeroPiece ?? '·'}`, 'un mouvement de stock'));
            }
        }
        const dernier = await this.prisma.mouvementStock.aggregate({
            where: { tenantId, articleId },
            _max: { ordre: true },
        });
        const ordre = (dernier._max.ordre ?? 0) + 1;
        const refus = await this.nouvellesSortiesImpossibles(tenantId, articleId, (existants) => [
            ...existants,
            {
                ordre,
                date: dto.date.slice(0, 10),
                sens: dto.sens === client_1.SensMouvementStock.ENTREE ? 'ENTREE' : 'SORTIE',
                quantite: dto.quantite,
                cout: dto.sens === client_1.SensMouvementStock.ENTREE ? Number(dto.cout) : null,
            },
        ]);
        if (refus) {
            throw new common_1.BadRequestException(refus.ordre === ordre ? refus.explication : `Ce mouvement rendrait impossible ${refus.designation} · ${refus.explication}`);
        }
        return this.prisma.mouvementStock.create({
            data: {
                tenantId,
                articleId,
                date: new Date(dto.date),
                ordre,
                sens: dto.sens,
                quantite: dto.quantite,
                cout: dto.sens === client_1.SensMouvementStock.ENTREE ? dto.cout : null,
                piece: dto.piece.trim(),
                libelle: dto.libelle?.trim() || null,
                ecritureId: dto.ecritureId ?? null,
                createdBy: userId,
            },
        });
    }
    async nouvellesSortiesImpossibles(tenantId, articleId, changer) {
        const existants = await this.prisma.mouvementStock.findMany({
            where: { tenantId, articleId, annuleLe: null },
            select: { ordre: true, date: true, sens: true, quantite: true, cout: true, piece: true },
        });
        const bruts = existants.map((m) => ({
            ordre: m.ordre,
            date: m.date.toISOString().slice(0, 10),
            sens: m.sens === client_1.SensMouvementStock.ENTREE ? 'ENTREE' : 'SORTIE',
            quantite: Number(m.quantite),
            cout: m.cout === null ? null : Number(m.cout),
        }));
        const avant = new Set((0, valorisation_stocks_1.sortiesAuDelaDuStock)(bruts).map((r) => r.ordre));
        const nouveau = (0, valorisation_stocks_1.sortiesAuDelaDuStock)(changer(bruts)).find((r) => !avant.has(r.ordre));
        if (!nouveau)
            return null;
        const visee = existants.find((m) => m.ordre === nouveau.ordre);
        return {
            ordre: nouveau.ordre,
            explication: nouveau.explication,
            designation: visee
                ? `la sortie du ${visee.date.toISOString().slice(0, 10)} (pièce ${visee.piece})`
                : 'une sortie déjà enregistrée',
        };
    }
    async annulerMouvement(tenantId, userId, articleId, mouvementId, dto) {
        const motif = dto.motif?.trim();
        if (!motif)
            throw new common_1.BadRequestException("L'annulation d'un mouvement porte son motif.");
        const m = await this.prisma.mouvementStock.findFirst({
            where: { id: mouvementId, tenantId, articleId },
            select: { id: true, ordre: true, date: true, annuleLe: true, ecritureId: true },
        });
        if (!m)
            throw new common_1.NotFoundException('Mouvement introuvable dans ce dossier.');
        if (m.annuleLe)
            throw new common_1.ConflictException('Ce mouvement est déjà annulé.');
        const cloture = await this.prisma.exercice.findFirst({
            where: { tenantId, statut: client_1.StatutExercice.CLOTURE, dateDebut: { lte: m.date }, dateFin: { gte: m.date } },
            select: { dateFin: true },
        });
        if (cloture) {
            throw new common_1.BadRequestException(`Ce mouvement est daté dans un exercice clôturé (au ${cloture.dateFin.toISOString().slice(0, 10)}) · ` +
                "l'annuler revaloriserait les sorties d'un exercice arrêté. La correction se passe sur l'exercice ouvert.");
        }
        const refus = await this.nouvellesSortiesImpossibles(tenantId, articleId, (existants) => existants.filter((e) => e.ordre !== m.ordre));
        if (refus) {
            throw new common_1.BadRequestException(`Annuler ce mouvement rendrait impossible ${refus.designation} · ${refus.explication}`);
        }
        const { count } = await this.prisma.mouvementStock.updateMany({
            where: { id: m.id, tenantId, annuleLe: null },
            data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: motif },
        });
        if (count === 0)
            throw new common_1.ConflictException('Ce mouvement vient d’être annulé.');
        return {
            id: m.id,
            annule: true,
            ecritureACorriger: m.ecritureId !== null,
        };
    }
    async confronter(tenantId, comptages, dateComptage) {
        const dossier = await this.modeDuDossier(tenantId);
        if (dossier.methodeInventaireStocks === null) {
            return {
                modeInventaire: null,
                referentiel: dossier.referentiel,
                reserve: "Ce dossier n'a pas déclaré son mode de tenue des stocks. Le boni et le mali " +
                    "d'inventaire n'existent qu'en inventaire PERMANENT · les deux textes les bornent dans " +
                    'la phrase qui les pose. Déclarez le mode dans les paramètres du dossier.',
                confrontation: null,
            };
        }
        const parArticle = new Map(comptages.map((c) => [c.articleId, c]));
        const articles = await this.prisma.articleStock.findMany({
            where: { tenantId, actif: true, id: { in: [...parArticle.keys()] } },
            include: {
                compte: { select: { numero: true, intitule: true } },
                mouvements: {
                    where: { date: { lte: new Date(dateComptage) }, annuleLe: null },
                    orderBy: [{ date: 'asc' }, { ordre: 'asc' }],
                },
            },
        });
        const aConfronter = articles.map((a) => {
            const comptage = parArticle.get(a.id);
            return {
                articleId: a.id,
                code: a.code,
                designation: a.designation,
                uniteMesure: a.uniteMesure,
                compteNumero: a.compte.numero,
                compteIntitule: a.compte.intitule,
                methode: a.methodeValorisation,
                mouvements: a.mouvements.map((m) => ({
                    ordre: m.ordre,
                    date: m.date.toISOString().slice(0, 10),
                    sens: m.sens === client_1.SensMouvementStock.ENTREE ? 'ENTREE' : 'SORTIE',
                    quantite: Number(m.quantite),
                    cout: m.cout === null ? null : Number(m.cout),
                })),
                quantitePhysique: comptage?.quantitePhysique ?? null,
                coutUnitaireBoni: comptage?.coutUnitaireBoni ?? null,
                sourceCoutBoni: comptage?.sourceCoutBoni ?? null,
            };
        });
        const confrontation = (0, boni_mali_inventaire_1.confronterInventaire)(aConfronter, dossier.referentiel, dossier.methodeInventaireStocks);
        return {
            modeInventaire: dossier.methodeInventaireStocks,
            referentiel: dossier.referentiel,
            reserve: null,
            confrontation: {
                ...confrontation,
                lignes: (0, boni_mali_inventaire_1.lignesDeLaRegularisation)(confrontation.differences),
            },
        };
    }
    async enregistrerRegularisation(tenantId, userId, dto) {
        const etat = await this.confronter(tenantId, dto.comptages, dto.dateComptage);
        if (!etat.confrontation) {
            throw new common_1.BadRequestException(etat.reserve ?? 'Aucune régularisation à enregistrer.');
        }
        const lignes = etat.confrontation.lignes;
        if (lignes.length === 0) {
            throw new common_1.BadRequestException("Aucune différence d'inventaire à régulariser : le magasin et le comptage concordent, ou " +
                "aucun article comptable n'a pu être confronté. L'écriture serait vide.");
        }
        const journal = await this.prisma.journal.findFirst({
            where: { id: dto.journalId, tenantId },
            select: { id: true },
        });
        if (!journal)
            throw new common_1.BadRequestException('Journal introuvable dans ce dossier.');
        const numeros = [...new Set(lignes.map((l) => l.compte))];
        const comptes = await this.prisma.compte.findMany({
            where: {
                tenantId,
                numero: { in: [...numeros, ...numeros.map((n) => n.padEnd(8, '0'))] },
            },
            select: { id: true, numero: true },
        });
        const parNumero = new Map(comptes.map((c) => [c.numero, c]));
        const manquants = numeros.filter((n) => !parNumero.has(n) && !parNumero.has(n.padEnd(8, '0')));
        if (manquants.length) {
            throw new common_1.BadRequestException(`Ces comptes ne sont pas ouverts en imputation dans ce dossier : ${manquants.join(', ')}. ` +
                "Ouvrez-les au plan comptable avant de passer la régularisation d'inventaire.");
        }
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.date,
            libelle: dto.libelle?.trim() || "Régularisation des différences d'inventaire",
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
        try {
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                for (const d of etat.confrontation.differences) {
                    const dernier = await tx.mouvementStock.aggregate({
                        where: { tenantId, articleId: d.articleId },
                        _max: { ordre: true },
                    });
                    await tx.mouvementStock.create({
                        data: {
                            tenantId,
                            articleId: d.articleId,
                            date: new Date(dto.dateComptage),
                            ordre: (dernier._max.ordre ?? 0) + 1,
                            sens: d.sens === 'BONI' ? client_1.SensMouvementStock.ENTREE : client_1.SensMouvementStock.SORTIE,
                            quantite: Math.abs(d.ecartQuantite),
                            cout: d.sens === 'BONI' ? d.montant : null,
                            piece: dto.reference?.trim() || `Inventaire du ${dto.dateComptage.slice(0, 10)}`,
                            libelle: `${d.sens === 'BONI' ? 'Boni' : 'Mali'} d'inventaire`,
                            ecritureId: ecriture.id,
                            createdBy: userId,
                        },
                    });
                }
            });
        }
        catch (err) {
            await this.prisma.ligneEcriture.deleteMany({ where: { ecritureId: ecriture.id } });
            await this.prisma.ecriture.delete({ where: { id: ecriture.id } });
            throw err;
        }
        return ecriture;
    }
};
exports.MagasinService = MagasinService;
exports.MagasinService = MagasinService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], MagasinService);
//# sourceMappingURL=magasin.service.js.map