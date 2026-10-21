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
exports.ComptabilisationPaieService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const bulletin_paie_1 = require("./bulletin-paie");
const comptabilisation_paie_1 = require("./comptabilisation-paie");
const repartitions_analytiques_paie_service_1 = require("./repartitions-analytiques-paie.service");
const ventilation_analytique_paie_1 = require("./ventilation-analytique-paie");
let ComptabilisationPaieService = class ComptabilisationPaieService {
    constructor(prisma, ecritures, repartitions) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.repartitions = repartitions;
    }
    verifierMois(mois) {
        if (!(0, bulletin_paie_1.moisValide)(mois))
            throw new common_1.BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
    }
    async proposition(tenantId, mois) {
        this.verifierMois(mois);
        const [tenant, bulletins] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.bulletinPaie.findMany({
                where: { tenantId, moisDePaie: mois },
                orderBy: { numero: 'asc' },
                select: {
                    id: true,
                    numero: true,
                    nomComplet: true,
                    salarieId: true,
                    statut: true,
                    ecritureId: true,
                    netAPayerFc: true,
                    entree: true,
                    calcul: true,
                    ecritureNegatifId: true,
                },
                take: 5_000,
            }),
        ]);
        const idsOrigine = [
            ...new Set(bulletins.filter((b) => b.statut === 'ANNULE' && b.ecritureId).map((b) => b.ecritureId)),
        ];
        const origines = idsOrigine.length
            ? await this.prisma.ecriture.findMany({
                where: { tenantId, id: { in: idsOrigine } },
                select: {
                    id: true,
                    numeroPiece: true,
                    lignes: {
                        select: {
                            debit: true,
                            credit: true,
                            compte: { select: { numero: true, intitule: true } },
                            ventilations: { select: { planId: true, sectionId: true, debit: true, credit: true } },
                        },
                    },
                },
            })
            : [];
        const origineDe = new Map(origines.map((e) => [
            e.id,
            {
                ecritureId: e.id,
                numeroPiece: e.numeroPiece === null || e.numeroPiece === undefined ? null : String(e.numeroPiece),
                lignes: (e.lignes ?? []).map((l) => ({
                    compte: l.compte.numero,
                    intitule: l.compte.intitule,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                    ventilations: (l.ventilations ?? []).map((v) => ({
                        planId: v.planId,
                        sectionId: v.sectionId,
                        montant: Number(l.debit) !== 0 ? Number(v.debit) : Number(v.credit),
                    })),
                })),
            },
        ]));
        const lus = bulletins.map((b) => ({
            id: b.id,
            numero: b.numero,
            nomComplet: b.nomComplet,
            statut: b.statut,
            ecritureId: b.ecritureId,
            netAPayerFc: Number(b.netAPayerFc),
            entree: b.entree,
            calcul: b.calcul,
            ecritureNegatifId: b.ecritureNegatifId,
            origine: b.statut === 'ANNULE' && b.ecritureId ? (origineDe.get(b.ecritureId) ?? null) : null,
        }));
        const proposition = (0, comptabilisation_paie_1.propositionPaieDuMois)(mois, tenant.referentiel, lus);
        const ids = [
            ...new Set([
                ...[...proposition.dejaPasses, ...proposition.annulesApresPassation].map((b) => b.ecritureId),
                ...proposition.annulesApresPassation.flatMap((b) => (b.ecritureNegatifId ? [b.ecritureNegatifId] : [])),
            ]),
        ];
        const pieces = ids.length
            ? await this.prisma.ecriture.findMany({
                where: { tenantId, id: { in: ids } },
                select: { id: true, numeroPiece: true, date: true, statut: true },
            })
            : [];
        const salarieDe = new Map(bulletins.map((b) => [b.id, b.salarieId]));
        const aPasser = lus
            .filter((b) => proposition.aPasser.some((a) => a.id === b.id))
            .map((b) => ({ ...b, salarieId: salarieDe.get(b.id) }));
        const reprises = proposition.reprises.flatMap((r) => {
            const origine = origineDe.get(r.ecritureId);
            if (!origine)
                return [];
            return [
                {
                    mode: r.mode,
                    origine,
                    bulletins: lus.filter((b) => r.bulletinIds.includes(b.id)),
                    portes: lus.filter((b) => b.ecritureId === r.ecritureId).map((b) => ({ ...b, salarieId: salarieDe.get(b.id) })),
                },
            ];
        });
        const ventilation = await this.ventilation(tenantId, mois, tenant.referentiel, proposition.lignes, aPasser, reprises);
        return { ...proposition, pieces, ventilation };
    }
    async ventilation(tenantId, mois, referentiel, lignes, aPasser, reprises = []) {
        const vide = { parLigne: lignes.map(() => []), nonVentilees: [], reserves: [], obligatoires: [] };
        if (lignes.length === 0)
            return vide;
        const salaries = [...aPasser.map((b) => b.salarieId), ...reprises.flatMap((r) => (r.portes ?? []).map((b) => b.salarieId))];
        const lu = await this.repartitions.pourLaPassation(tenantId, mois, [...new Set(salaries)]);
        if (!lu) {
            return {
                ...vide,
                reserves: [
                    'VENTILATION NON PROPOSÉE · les plans analytiques actifs ou les répartitions en vigueur ce mois dépassent la borne de lecture · les lignes ' +
                        "partent sans ventilation, à reprendre ligne à ligne (Ventilation d'une ligne).",
                ],
            };
        }
        if (lu.plans.length === 0)
            return vide;
        const v = (0, ventilation_analytique_paie_1.ventilerLaPaie)({ mois, referentiel, lignes, bulletins: aPasser, plans: lu.plans, sections: lu.sections, versions: lu.versions, reprises });
        return { ...v, obligatoires: lu.obligatoires };
    }
    async comptabiliser(tenantId, userId, mois, dto) {
        const p = await this.proposition(tenantId, mois);
        if (p.refus.length > 0) {
            throw new common_1.BadRequestException({
                message: `La paie de ${mois} n'est pas passée · ${p.refus.length} bulletin(s) refusé(s).`,
                motifs: p.refus.map((r) => `n° ${r.numero} · ${r.nomComplet} · ${r.motifs.join(' ')}`),
            });
        }
        if ((p.aPasser.length === 0 && p.negatifsAPasser.length === 0) || p.lignes.length === 0) {
            throw new common_1.BadRequestException(`Aucun bulletin émis à passer pour ${mois}.`);
        }
        if (!p.equilibree) {
            throw new common_1.BadRequestException(p.reserves[p.reserves.length - 1] ?? "L'écriture de paie ne s'équilibre pas.");
        }
        if (p.negatifsAPasser.length > 0 && dto.inscrireNegatifs !== true) {
            throw new common_1.BadRequestException(`La paie de ${mois} reprend en négatif le(s) bulletin(s) n° ${p.negatifsAPasser.map((b) => b.numero).join(', ')}, ` +
                "annulé(s) après passation · confirmez la reprise (« Reprendre en négatif les bulletins annulés »). Si ce négatif " +
                "a déjà été inscrit à la main, contre-passez d'abord cette écriture (Corriger, inscription en négatif), puis " +
                'passez la paie ici · la reprise ne doit compter qu’une fois.');
        }
        const [journal, exercice] = await Promise.all([
            this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId }, select: { id: true } }),
            this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { dateDebut: true } }),
        ]);
        if (!journal)
            throw new common_1.BadRequestException('Journal introuvable dans ce dossier.');
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable dans ce dossier.');
        const date = new Date(dto.date);
        for (const b of p.negatifsAPasser) {
            const origine = p.pieces.find((x) => x.id === b.ecritureId);
            if (origine && date < origine.date) {
                throw new common_1.BadRequestException(`La reprise en négatif du bulletin n° ${b.numero} ne peut précéder l'écriture qui l'a passé (pièce n° ` +
                    `${origine.numeroPiece ?? '·'} du ${origine.date.toISOString().slice(0, 10)}) · datez la passation au plus tôt ce jour-là.`);
            }
        }
        const finDuMois = new Date(`${(0, comptabilisation_paie_1.dernierJourDuMois)(mois)}T00:00:00.000Z`);
        const dateValeur = finDuMois < exercice.dateDebut ? finDuMois : null;
        const numeros = [...new Set(p.lignes.map((l) => l.compte))];
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, numero: { in: numeros } },
            select: { id: true, numero: true, typeCompte: true },
        });
        const parNumero = new Map(comptes.map((c) => [c.numero, c]));
        const manquants = numeros.filter((n) => parNumero.get(n)?.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL);
        if (manquants.length) {
            throw new common_1.BadRequestException(`Ces comptes ne sont pas ouverts en imputation dans ce dossier : ${manquants.join(', ')}. ` +
                'Ouvrez-les au plan comptable avant de passer la paie.');
        }
        const bloquantes = p.ventilation.nonVentilees.filter((n) => p.ventilation.obligatoires.includes(n.planCode));
        if (bloquantes.length > 0) {
            const issues = [...new Set(bloquantes.map((n) => (0, ventilation_analytique_paie_1.issueDeLaCause)(n.cause)))];
            throw new common_1.BadRequestException({
                message: `La paie de ${mois} n'est pas passée · le(s) plan(s) ${[...new Set(bloquantes.map((n) => n.planCode))].join(', ')} ` +
                    `exige(nt) la ventilation, et ${bloquantes.length} ligne(s) partiraient sans elle. ${issues.join(' ')}`,
                motifs: bloquantes.map((n) => `${n.compte} · ${n.intitule} · plan ${n.planCode} · ${n.motif}`),
            });
        }
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.date,
            libelle: dto.libelle?.trim() || `Paie du mois ${mois}`,
            reference: `Bulletins n° ${p.aPasser.map((b) => b.numero).join(', ')}`.slice(0, 190),
            lignes: p.lignes.map((l, i) => {
                const ventilations = (p.ventilation.parLigne[i] ?? []).map((v) => ({
                    sectionId: v.sectionId,
                    ...(l.sens === 'DEBIT' ? { debit: v.montantFc } : { credit: v.montantFc }),
                }));
                return {
                    compteId: parNumero.get(l.compte).id,
                    libelle: `${l.intitule} · paie ${mois}`,
                    ...(l.sens === 'DEBIT' ? { debit: l.montantFc } : { credit: l.montantFc }),
                    ...(ventilations.length ? { ventilations } : {}),
                };
            }),
        });
        const ids = p.aPasser.map((b) => b.id);
        const idsRepris = p.negatifsAPasser.map((b) => b.id);
        const lies = ids.length
            ? await this.prisma.bulletinPaie.updateMany({
                where: { tenantId, id: { in: ids }, ecritureId: null, statut: 'EMIS' },
                data: { ecritureId: ecriture.id },
            })
            : { count: 0 };
        const repris = idsRepris.length
            ? await this.prisma.bulletinPaie.updateMany({
                where: { tenantId, id: { in: idsRepris }, statut: 'ANNULE', ecritureNegatifId: null },
                data: { ecritureNegatifId: ecriture.id },
            })
            : { count: 0 };
        let echecDateValeur = null;
        if (dateValeur && lies.count === ids.length && repris.count === idsRepris.length) {
            await this.prisma.ecriture.update({ where: { id: ecriture.id }, data: { dateValeur } }).catch((e) => {
                echecDateValeur = e ?? new Error('Date de valeur non posée.');
            });
        }
        if (lies.count !== ids.length || repris.count !== idsRepris.length || echecDateValeur) {
            await this.ecritures.retirerCompensation(tenantId, ecriture.id, async (tx) => {
                await tx.bulletinPaie.updateMany({ where: { tenantId, ecritureId: ecriture.id }, data: { ecritureId: null } });
                await tx.bulletinPaie.updateMany({ where: { tenantId, ecritureNegatifId: ecriture.id }, data: { ecritureNegatifId: null } });
            });
            if (echecDateValeur)
                throw echecDateValeur;
            throw new common_1.ConflictException(`La paie de ${mois} a changé pendant la passation (un bulletin passé ou annulé entre-temps). ` +
                "Rien n'est enregistré · relisez la proposition et recommencez.");
        }
        return { ecriture, bulletins: p.aPasser, reprisEnNegatif: p.negatifsAPasser, dateValeur };
    }
    async annulerComptabilisation(tenantId, ecritureId) {
        const ecriture = await this.prisma.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { id: true } });
        if (!ecriture)
            throw new common_1.NotFoundException('Écriture introuvable dans ce dossier.');
        const porte = await this.prisma.bulletinPaie.count({
            where: { tenantId, OR: [{ ecritureId }, { ecritureNegatifId: ecritureId }] },
        });
        if (porte === 0)
            throw new common_1.BadRequestException("Cette écriture ne passe aucun bulletin de paie.");
        await this.ecritures.supprimer(tenantId, ecritureId, {
            detenteur: ecriture_service_1.DETENTEUR_PAIE_DU_MOIS,
            liberer: async (tx) => {
                await tx.bulletinPaie.updateMany({ where: { tenantId, ecritureId }, data: { ecritureId: null } });
                await tx.bulletinPaie.updateMany({ where: { tenantId, ecritureNegatifId: ecritureId }, data: { ecritureNegatifId: null } });
            },
        });
        return { annule: true, bulletinsLiberes: porte };
    }
};
exports.ComptabilisationPaieService = ComptabilisationPaieService;
exports.ComptabilisationPaieService = ComptabilisationPaieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        repartitions_analytiques_paie_service_1.RepartitionsAnalytiquesPaieService])
], ComptabilisationPaieService);
//# sourceMappingURL=comptabilisation-paie.service.js.map