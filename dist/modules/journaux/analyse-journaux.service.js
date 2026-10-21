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
exports.AnalyseJournauxService = void 0;
const common_1 = require("@nestjs/common");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const client_1 = require("@prisma/client");
const etat_journaux_saisie_1 = require("./etat-journaux-saisie");
const numerotation_piece_1 = require("./numerotation-piece");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const prisma_service_1 = require("../../common/prisma.service");
const sequence_pieces_1 = require("./sequence-pieces");
let AnalyseJournauxService = class AnalyseJournauxService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async palmaresComptes(tenantId, params) {
        const limite = Math.min(Math.max(params.limite ?? 25, 1), 200);
        const [comptes, groupes] = await Promise.all([
            this.prisma.compte.findMany({
                where: {
                    tenantId,
                    typeCompte: { not: client_1.TypeCompteDetailTotal.TOTAL },
                    ...(params.classe ? { numero: { startsWith: params.classe } } : {}),
                },
                select: { id: true, numero: true, intitule: true, classe: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: {
                    ecriture: {
                        tenantId,
                        exerciceId: params.exerciceId,
                        estGenereeParCloture: false,
                        ...(0, ecritures_de_situation_1.filtreDuStatut)(params.inclureBrouillard === true),
                    },
                },
                _sum: { debit: true, credit: true },
                _count: { _all: true },
            }),
        ]);
        const parCompte = new Map(comptes.map((c) => [c.id, c]));
        const brutes = groupes
            .filter((g) => parCompte.has(g.compteId))
            .map((g) => {
            const c = parCompte.get(g.compteId);
            const debit = Number(g._sum.debit ?? 0);
            const credit = Number(g._sum.credit ?? 0);
            return {
                compteId: c.id,
                numero: c.numero,
                intitule: c.intitule,
                classe: String(c.classe),
                mouvement: debit + credit,
                debit,
                credit,
                solde: debit - credit,
                nombreLignes: g._count._all,
            };
        })
            .filter((l) => l.mouvement > 0.005)
            .sort((a, b) => b.mouvement - a.mouvement || a.numero.localeCompare(b.numero));
        const mouvementTotal = brutes.reduce((t, l) => t + l.mouvement, 0);
        let cumul = 0;
        const lignes = brutes.slice(0, limite).map((l) => {
            const part = mouvementTotal > 0.005 ? (l.mouvement / mouvementTotal) * 100 : 0;
            cumul += part;
            return { ...l, part, partCumulee: cumul };
        });
        return {
            lignes,
            total: { mouvement: mouvementTotal, comptes: brutes.length },
            tronque: brutes.length > lignes.length,
        };
    }
    async analyseJournaux(tenantId, params) {
        const journaux = await this.prisma.journal.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
        const parJournal = new Map();
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
            where: { tenantId, exerciceId: params.exerciceId },
            select: {
                id: true,
                journalId: true,
                date: true,
                numeroPiece: true,
                statut: true,
                estGenereeParCloture: true,
                lignes: { select: { debit: true, credit: true } },
            },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
        }), (e) => {
            let c = parJournal.get(e.journalId);
            if (!c) {
                c = {
                    nombre: 0,
                    lignes: 0,
                    debit: 0,
                    credit: 0,
                    enBrouillard: 0,
                    deCloture: 0,
                    premiere: null,
                    derniere: null,
                    numeros: [],
                    numerosParMois: new Map(),
                };
                parJournal.set(e.journalId, c);
            }
            c.nombre++;
            c.lignes += e.lignes.length;
            for (const l of e.lignes) {
                c.debit += Number(l.debit);
                c.credit += Number(l.credit);
            }
            if (e.statut === client_1.StatutEcriture.BROUILLARD)
                c.enBrouillard++;
            if (e.estGenereeParCloture)
                c.deCloture++;
            if (!c.premiere || e.date < c.premiere)
                c.premiere = e.date;
            if (!c.derniere || e.date > c.derniere)
                c.derniere = e.date;
            if (e.numeroPiece !== null) {
                c.numeros.push(e.numeroPiece);
                const cle = `${e.date.getUTCFullYear()}-${e.date.getUTCMonth()}`;
                const duMois = c.numerosParMois.get(cle) ?? [];
                duMois.push(e.numeroPiece);
                c.numerosParMois.set(cle, duMois);
            }
        }, lecture_par_lots_1.LOT_ECRITURES);
        const jumeau = await this.exerciceJumeauDeLArret(tenantId, params.exerciceId);
        const ailleurs = new Map();
        if (jumeau) {
            await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
                where: { tenantId, exerciceId: jumeau.id, numeroPiece: { not: null } },
                select: { id: true, journalId: true, date: true, numeroPiece: true },
                ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
            }), (e) => {
                const a = ailleurs.get(e.journalId) ?? { numeros: new Set(), parMois: new Map() };
                a.numeros.add(e.numeroPiece);
                const cle = `${e.date.getUTCFullYear()}-${e.date.getUTCMonth()}`;
                const m = a.parMois.get(cle) ?? new Set();
                m.add(e.numeroPiece);
                a.parMois.set(cle, m);
                ailleurs.set(e.journalId, a);
            }, lecture_par_lots_1.LOT_ECRITURES);
        }
        const explicationArret = jumeau
            ? `Numéros portés par l'exercice ${jumeau.role === 'LIQUIDATION' ? 'de liquidation' : 'arrêté à la dissolution'} du ${jumeau.dateDebut.toISOString().slice(0, 10)} au ${jumeau.dateFin.toISOString().slice(0, 10)} · les écritures datées après la dissolution y ont suivi leur date avec leur numéro (AUDCIF art. 22 et 59 ; décision par la loi du 2026-10-07, quatrième lot, point 1). Ce ne sont pas des pièces supprimées.`
            : '';
        const lignes = journaux.map((j) => {
            const c = parJournal.get(j.id);
            const perimetre = (0, sequence_pieces_1.perimetreDeLaSequence)((0, numerotation_piece_1.modeEffectif)(j));
            let rattaches = 0;
            let trous = [];
            let manquants = null;
            if (perimetre === 'JOURNAL_EXERCICE') {
                const lus = (0, sequence_pieces_1.trousHorsNumerosRattaches)((0, sequence_pieces_1.trousDeLaSequence)(c?.numeros ?? []), ailleurs.get(j.id)?.numeros ?? []);
                trous = lus.trous;
                rattaches = lus.rattaches;
                manquants = (0, sequence_pieces_1.compterManquants)(trous);
            }
            else if (perimetre === 'JOURNAL_MOIS') {
                for (const [mois, numeros] of (c?.numerosParMois ?? new Map()).entries()) {
                    const lus = (0, sequence_pieces_1.trousHorsNumerosRattaches)((0, sequence_pieces_1.trousDeLaSequence)(numeros), ailleurs.get(j.id)?.parMois.get(mois) ?? []);
                    trous.push(...lus.trous);
                    rattaches += lus.rattaches;
                }
                manquants = (0, sequence_pieces_1.compterManquants)(trous);
            }
            const jour = (d) => (d ? d.toISOString().slice(0, 10) : null);
            return {
                journalId: j.id,
                code: j.code,
                intitule: j.intitule,
                type: String(j.type),
                numerotation: j.numerotation,
                nombreEcritures: c?.nombre ?? 0,
                nombreLignes: c?.lignes ?? 0,
                debit: c?.debit ?? 0,
                credit: c?.credit ?? 0,
                enBrouillard: c?.enBrouillard ?? 0,
                deCloture: c?.deCloture ?? 0,
                premiereDate: jour(c?.premiere),
                derniereDate: jour(c?.derniere),
                sequence: {
                    perimetre,
                    explication: sequence_pieces_1.EXPLICATION_PERIMETRE[perimetre],
                    manquants,
                    trous,
                    ...(rattaches > 0 ? { rattachesALArret: { nombre: rattaches, explication: explicationArret } } : {}),
                },
            };
        });
        const journauxFichier = (0, numerotation_piece_1.journauxDeLaSequenceDuFichier)(journaux);
        const numerosDossier = journauxFichier.flatMap((j) => parJournal.get(j.id)?.numeros ?? []);
        const lusDossier = (0, sequence_pieces_1.trousHorsNumerosRattaches)(journauxFichier.length > 0 ? (0, sequence_pieces_1.trousDeLaSequence)(numerosDossier) : [], journauxFichier.flatMap((j) => [...(ailleurs.get(j.id)?.numeros ?? [])]));
        const trousDossier = lusDossier.trous;
        return {
            lignes,
            sequenceDuDossier: {
                applicable: journauxFichier.length > 0,
                explication: journauxFichier.length > 0
                    ? `Numérotation continue sur le fichier pour ${journauxFichier.map((j) => j.code).join(', ')} : la séquence court sur ces journaux ensemble, et c'est le seul niveau où ses trous ont un sens.`
                    : "Aucun journal de ce dossier n'est en numérotation continue sur le fichier : il n'y a pas de séquence au niveau du dossier.",
                manquants: (0, sequence_pieces_1.compterManquants)(trousDossier),
                trous: trousDossier,
                ...(lusDossier.rattaches > 0 ? { rattachesALArret: { nombre: lusDossier.rattaches, explication: explicationArret } } : {}),
            },
        };
    }
    async exerciceJumeauDeLArret(tenantId, exerciceId) {
        const [exercice, dossier] = await Promise.all([
            this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateDebut: true, dateFin: true } }),
            this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { dateDissolution: true } }),
        ]);
        const d = dossier?.dateDissolution ?? null;
        if (!exercice || !d)
            return null;
        const lendemain = new Date(d.getTime() + 86_400_000);
        if (exercice.dateFin.getTime() === d.getTime()) {
            const l = await this.prisma.exercice.findFirst({ where: { tenantId, dateDebut: lendemain }, select: { id: true, dateDebut: true, dateFin: true } });
            return l ? { ...l, role: 'LIQUIDATION' } : null;
        }
        if (exercice.dateDebut.getTime() === lendemain.getTime()) {
            const a = await this.prisma.exercice.findFirst({ where: { tenantId, dateFin: d }, select: { id: true, dateDebut: true, dateFin: true } });
            return a ? { ...a, role: 'ARRETE' } : null;
        }
        return null;
    }
    async grilleSaisie(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable');
        const [journaux, comptages, clotures, impressions] = await Promise.all([
            this.prisma.journal.findMany({
                where: { tenantId },
                orderBy: { code: 'asc' },
                select: { id: true, code: true, intitule: true, type: true, estActif: true },
            }),
            this.prisma.ecriture.groupBy({
                by: ['journalId', 'date', 'statut', 'estANouveauProvisoire'],
                where: { tenantId, exerciceId },
                _count: { _all: true },
                _max: { valideeAt: true },
            }),
            this.prisma.cloture.findMany({
                where: { tenantId, annuleeAt: null },
                select: { granularite: true, journalId: true, dateLimite: true },
            }),
            this.prisma.impressionJournal.findMany({
                where: { tenantId, exerciceId },
                select: { journalId: true, dateDebut: true, dateFin: true, imprimeAt: true },
            }),
        ]);
        const mois = (0, etat_journaux_saisie_1.moisDeLExercice)(exercice.dateDebut, exercice.dateFin);
        const grille = (0, etat_journaux_saisie_1.grilleJournauxSaisie)(journaux, mois, comptages.map((c) => ({
            journalId: c.journalId,
            date: c.date,
            statut: c.statut,
            estANouveauProvisoire: c.estANouveauProvisoire,
            nombre: c._count._all,
            derniereValidation: c._max?.valideeAt ?? null,
        })), clotures, exercice.statut === client_1.StatutExercice.CLOTURE, impressions);
        return {
            mois: mois.map((m) => m.debut.slice(0, 7)),
            journaux: journaux.map((j, i) => ({ ...j, cases: grille[i].cases })),
        };
    }
};
exports.AnalyseJournauxService = AnalyseJournauxService;
exports.AnalyseJournauxService = AnalyseJournauxService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyseJournauxService);
//# sourceMappingURL=analyse-journaux.service.js.map