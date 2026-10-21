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
exports.TestEcrituresJournalService = exports.PLAFOND_SELECTION_ISA_240 = void 0;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const test_ecritures_journal_1 = require("./test-ecritures-journal");
exports.PLAFOND_SELECTION_ISA_240 = 50_000;
let TestEcrituresJournalService = class TestEcrituresJournalService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async selection(tenantId, exerciceId, plafond = exports.PLAFOND_SELECTION_ISA_240) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        const auteurs = await this.prisma.user.findMany({
            where: { tenantId },
            select: { id: true, email: true, role: true },
        });
        const parId = new Map(auteurs.map((u) => [u.id, u]));
        const [comptes, mouvements] = await Promise.all([
            this.prisma.compte.findMany({ where: { tenantId }, select: { id: true, numero: true } }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: { tenantId, exerciceId, estGenereeParCloture: false, ...ecritures_de_situation_1.HORS_SITUATION } },
                _count: { _all: true },
            }),
        ]);
        const numeroDe = new Map(comptes.map((c) => [c.id, c.numero]));
        const mouvementsParCompte = new Map();
        for (const g of mouvements) {
            const n = numeroDe.get(g.compteId);
            if (n !== undefined)
                mouvementsParCompte.set(n, g._count._all);
        }
        const debutFinDePeriode = new Date(exercice.dateFin);
        debutFinDePeriode.setUTCDate(debutFinDePeriode.getUTCDate() - (test_ecritures_journal_1.SEUILS_ISA_240.joursFinDePeriode - 1));
        let totalEcritures = 0;
        let totalRetenues = 0;
        const parCritere = new Map();
        const selection = [];
        const retenir = (e) => {
            const montant = e.lignes.reduce((s, l) => s + Number(l.debit), 0);
            const auteur = parId.get(e.createdBy);
            const comptesRares = e.lignes
                .map((l) => l.compte.numero)
                .filter((n) => (mouvementsParCompte.get(n) ?? 0) <= test_ecritures_journal_1.SEUILS_ISA_240.mouvementsCompteRare);
            const criteres = [];
            if (e.date >= debutFinDePeriode && e.date <= exercice.dateFin)
                criteres.push('FIN_DE_PERIODE');
            if (e.createdAt > exercice.dateFin)
                criteres.push('SAISIE_APRES_CLOTURE');
            if (e.libelle.trim().length < test_ecritures_journal_1.SEUILS_ISA_240.longueurLibelleCourt || !e.reference?.trim()) {
                criteres.push('SANS_JUSTIFICATION');
            }
            if (!auteur || test_ecritures_journal_1.ROLES_NON_SAISISSEURS.includes(auteur.role))
                criteres.push('AUTEUR_INATTENDU');
            if (montant >= test_ecritures_journal_1.SEUILS_ISA_240.planckMontantRond &&
                Math.abs(montant % test_ecritures_journal_1.SEUILS_ISA_240.pasMontantRond) < 0.005) {
                criteres.push('MONTANT_ROND');
            }
            if (comptesRares.length > 0)
                criteres.push('COMPTE_RARE');
            return {
                id: e.id,
                date: e.date,
                journal: e.journal.code,
                numeroPiece: e.numeroPiece,
                reference: e.reference,
                libelle: e.libelle,
                montant,
                statut: e.statut,
                saisieLe: e.createdAt,
                saisiePar: auteur?.email ?? 'utilisateur retiré du dossier',
                roleAuteur: auteur?.role ?? null,
                valideeLe: e.valideeAt,
                valideePar: e.valideeBy ? (parId.get(e.valideeBy)?.email ?? 'utilisateur retiré du dossier') : null,
                joursEntreDateEtSaisie: Math.round((e.createdAt.getTime() - e.date.getTime()) / (24 * 3600 * 1000)),
                comptesRares,
                criteres,
            };
        };
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
            where: { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION },
            include: { lignes: { include: { compte: { select: { numero: true, intitule: true } } } }, journal: true },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
        }), (e) => {
            totalEcritures++;
            const r = retenir(e);
            if (r.criteres.length === 0)
                return;
            totalRetenues++;
            for (const c of r.criteres)
                parCritere.set(c, (parCritere.get(c) ?? 0) + 1);
            if (selection.length < plafond)
                selection.push(r);
        }, lecture_par_lots_1.LOT_ECRITURES);
        selection.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.numeroPiece ?? Number.MAX_SAFE_INTEGER) - (b.numeroPiece ?? Number.MAX_SAFE_INTEGER));
        return {
            exercice: { dateDebut: exercice.dateDebut, dateFin: exercice.dateFin, dateArreteComptes: exercice.dateArreteComptes },
            criteres: test_ecritures_journal_1.CRITERES_ISA_240,
            seuils: test_ecritures_journal_1.SEUILS_ISA_240,
            totalEcritures,
            totalRetenues,
            tronque: totalRetenues > selection.length,
            parCritere: test_ecritures_journal_1.CRITERES_ISA_240.map((c) => ({
                cle: c.cle,
                titre: c.titre,
                nombre: parCritere.get(c.cle) ?? 0,
            })),
            selection,
        };
    }
};
exports.TestEcrituresJournalService = TestEcrituresJournalService;
exports.TestEcrituresJournalService = TestEcrituresJournalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TestEcrituresJournalService);
//# sourceMappingURL=test-ecritures-journal.service.js.map