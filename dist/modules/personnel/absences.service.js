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
exports.AbsencesService = void 0;
exports.informationsDeLArret = informationsDeLArret;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const bulletin_paie_1 = require("./bulletin-paie");
const absences_1 = require("./absences");
const remuneration_du_delai_1 = require("./remuneration-du-delai");
const absences_lecture_1 = require("./absences-lecture");
const client_1 = require("@prisma/client");
function informationsDeLArret(nature, debutSuspension, du, au) {
    const sixMois = (0, remuneration_du_delai_1.plusMois)(debutSuspension, 6);
    if (au.getTime() < sixMois.getTime())
        return [];
    const le = (0, absences_1.iso)(sixMois);
    const depuis = debutSuspension.getTime() < du.getTime() ? ` (suspension continue depuis le ${(0, absences_1.iso)(debutSuspension)})` : '';
    if (nature === 'MALADIE_OU_ACCIDENT') {
        return [
            `Six mois ininterrompus d'incapacité au ${le}${depuis} · l'employeur peut notifier la résiliation, avec une indemnité égale au préavis (Code du travail, art. 60, a).`,
        ];
    }
    if (nature === 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE') {
        return [
            `Les deux tiers dus par l'employeur s'arrêtent au ${le}, après six mois${depuis} (Code du travail, art. 106) ; l'indemnité journalière de la Caisse continue jusqu'à la guérison ou jusqu'à la rente qui la remplace (arrêté n° 146/2018, art. 87, 88 et 166).`,
        ];
    }
    return [];
}
let AbsencesService = class AbsencesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    catalogue() {
        return {
            natures: Object.entries(absences_1.NATURES_ABSENCE).map(([cle, d]) => ({ cle, ...d })),
            evenements: Object.entries(absences_1.EVENEMENTS_CIRCONSTANCE).map(([cle, e]) => ({ cle, ...e })),
        };
    }
    async lister(tenantId, salarieId) {
        await this.salarie(tenantId, salarieId);
        const [lignes, total] = await Promise.all([
            this.prisma.absenceSalarie.findMany({
                where: { tenantId, salarieId },
                orderBy: { du: 'desc' },
                take: absences_lecture_1.PLAFOND_ABSENCES_SALARIE,
                include: { indemnitesCaisse: { orderBy: { mois: 'asc' }, take: 120 } },
            }),
            this.prisma.absenceSalarie.count({ where: { tenantId, salarieId } }),
        ]);
        const debuts = (0, absences_1.debutsDesSuspensions)(await (0, absences_lecture_1.absencesDuSalarie)(this.prisma, tenantId, salarieId));
        return {
            absences: lignes.map((a) => {
                const jours = (0, absences_1.joursDeLAbsence)({ du: (0, absences_1.iso)(a.du), au: (0, absences_1.iso)(a.au), demiJourneeDebut: a.demiJourneeDebut, demiJourneeFin: a.demiJourneeFin });
                const debut = debuts.get(a.id);
                const def = absences_1.NATURES_ABSENCE[a.nature];
                return {
                    id: a.id,
                    nature: a.nature,
                    libelle: def.libelle,
                    fondement: def.fondement,
                    regime: def.regime,
                    du: (0, absences_1.iso)(a.du),
                    au: (0, absences_1.iso)(a.au),
                    demiJourneeDebut: a.demiJourneeDebut,
                    demiJourneeFin: a.demiJourneeFin,
                    evenement: a.evenement,
                    piece: a.piece,
                    observation: a.observation,
                    joursOuvrables: 'refus' in jours ? null : (0, absences_1.joursOuvrables)(jours),
                    joursCalendaires: 'refus' in jours ? null : jours.length,
                    annuleLe: a.annuleLe,
                    motifAnnulation: a.motifAnnulation,
                    creePar: a.creePar,
                    debutSuspension: a.annuleLe ? null : (debut ?? (0, absences_1.iso)(a.du)),
                    informations: a.annuleLe ? [] : informationsDeLArret(a.nature, debut ? new Date(`${debut}T00:00:00.000Z`) : a.du, a.du, a.au),
                    indemnitesCaisse: a.indemnitesCaisse.map((i) => ({
                        id: i.id,
                        mois: i.mois,
                        montant: Number(i.montant),
                        traitement: i.traitement,
                        piece: i.piece,
                        annuleLe: i.annuleLe,
                        motifAnnulation: i.motifAnnulation,
                    })),
                };
            }),
            total,
            tronque: total > lignes.length,
        };
    }
    async creer(tenantId, userEmail, salarieId, dto) {
        const salarie = await this.salarie(tenantId, salarieId);
        const du = (0, absences_1.jourUtc)(dto.du.slice(0, 10));
        const au = (0, absences_1.jourUtc)(dto.au.slice(0, 10));
        if (!du || !au)
            throw new common_1.BadRequestException("Les dates de l'absence se lisent AAAA-MM-JJ.");
        const couvre = salarie.contrats.some((c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= au.getTime()));
        if (!couvre)
            throw new common_1.BadRequestException("Aucun contrat ne couvre l'absence du début à la fin · une absence suspend ou interrompt un contrat en cours.");
        const autres = await (0, absences_lecture_1.absencesDuSalarie)(this.prisma, tenantId, salarieId);
        const absence = {
            id: '',
            nature: dto.nature,
            du: (0, absences_1.iso)(du),
            au: (0, absences_1.iso)(au),
            demiJourneeDebut: dto.demiJourneeDebut === true,
            demiJourneeFin: dto.demiJourneeFin === true,
            evenement: dto.evenement ?? null,
            piece: dto.piece?.trim() || null,
        };
        const refus = (0, absences_1.motifRefusAbsence)(absence, autres);
        if (refus)
            throw new common_1.BadRequestException(refus);
        if (!absences_1.NATURES_ABSENCE[dto.nature].maladie) {
            const conge = await this.prisma.congeSalarie.findFirst({
                where: { tenantId, salarieId, annuleLe: null, du: { lte: au }, au: { gte: du } },
                select: { du: true, au: true },
            });
            if (conge) {
                throw new common_1.BadRequestException(`L'absence chevauche le congé du ${(0, absences_1.iso)(conge.du)} au ${(0, absences_1.iso)(conge.au)} · seule la maladie survenue pendant un congé s'y déclare (Code du travail, art. 141, al. 4).`);
            }
        }
        const cree = await this.prisma.absenceSalarie.create({
            data: {
                tenantId,
                salarieId,
                nature: dto.nature,
                du,
                au,
                demiJourneeDebut: absence.demiJourneeDebut,
                demiJourneeFin: absence.demiJourneeFin,
                evenement: dto.nature === 'CONGE_DE_CIRCONSTANCE' ? (dto.evenement ?? null) : null,
                piece: absence.piece,
                observation: dto.observation?.trim() || null,
                creePar: userEmail,
            },
            select: { id: true },
        });
        return { id: cree.id };
    }
    async annuler(tenantId, userEmail, id, motif) {
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const a = await tx.absenceSalarie.findFirst({ where: { id, tenantId }, select: { id: true, annuleLe: true } });
            if (!a)
                throw new common_1.NotFoundException('Absence introuvable dans ce dossier.');
            if (a.annuleLe)
                throw new common_1.BadRequestException('Cette absence est déjà annulée.');
            await tx.absenceSalarie.update({ where: { id: a.id }, data: { annuleLe: new Date(), annulePar: userEmail, motifAnnulation: motif.trim() } });
            return { annule: true };
        });
    }
    async duMois(tenantId, salarieId, mois, moyenneBrute) {
        if (!(0, bulletin_paie_1.moisValide)(mois))
            throw new common_1.BadRequestException('Le mois de paie se lit AAAA-MM.');
        let moyenne = null;
        if (moyenneBrute !== undefined && moyenneBrute.trim() !== '') {
            moyenne = Number(moyenneBrute.replace(',', '.'));
            if (!Number.isFinite(moyenne) || moyenne < 0)
                throw new common_1.BadRequestException("La moyenne mensuelle de l'art. 66 est un montant positif ou nul.");
        }
        const salarie = await this.salarie(tenantId, salarieId);
        const absences = await (0, absences_lecture_1.absencesDuSalarie)(this.prisma, tenantId, salarieId);
        const indemnites = await this.prisma.indemniteCaisseAbsence.findMany({
            where: { tenantId, mois, annuleLe: null, absenceId: { in: absences.map((a) => a.id) } },
            select: { absenceId: true, montant: true, traitement: true },
        });
        const subrogees = new Set(indemnites.filter((i) => i.traitement === 'SUBROGATION').map((i) => i.absenceId));
        const deductionsParAbsence = new Map();
        for (const i of indemnites.filter((x) => x.traitement === 'DEDUITE')) {
            deductionsParAbsence.set(i.absenceId, (deductionsParAbsence.get(i.absenceId) ?? 0) + Number(i.montant));
        }
        const aRecevoirDeLaCaisse = indemnites.filter((i) => i.traitement === 'SUBROGATION').reduce((n, i) => n + Number(i.montant), 0);
        const subrogationsPartielles = new Map();
        for (const i of indemnites.filter((x) => x.traitement === 'SUBROGATION_PARTIELLE')) {
            subrogationsPartielles.set(i.absenceId, (subrogationsPartielles.get(i.absenceId) ?? 0) + Number(i.montant));
        }
        const jours = (0, absences_1.joursOuvrablesDuMois)(absences, mois, subrogees);
        const contrat = (0, bulletin_paie_1.contratCouvrantLeMois)(salarie.contrats, mois);
        const salaireMensuel = contrat && contrat.periodiciteRemuneration === 'MOIS' && contrat.remunerationBase !== null ? Number(contrat.remunerationBase) : null;
        const conges = await (0, absences_lecture_1.congesPayesDuMois)(this.prisma, tenantId, salarieId, mois, absences);
        const proposition = (0, absences_1.propositionDuMois)({
            jours,
            salaireMensuel,
            moyenneMensuelleArticle66: moyenne,
            deductionsParAbsence,
            aRecevoirDeLaCaisse,
            subrogationsPartielles,
            conges,
            mois,
        });
        const duMois = absences.filter((a) => a.au.slice(0, 7) >= mois && a.du.slice(0, 7) <= mois);
        return {
            mois,
            devise: contrat?.deviseRemuneration ?? null,
            salaireMensuel,
            absences: duMois.map((a) => {
                const siens = jours.filter((j) => j.absenceId === a.id);
                return {
                    id: a.id,
                    nature: a.nature,
                    libelle: absences_1.NATURES_ABSENCE[a.nature].libelle,
                    du: a.du,
                    au: a.au,
                    joursDuMois: siens.reduce((n, j) => n + j.poids, 0),
                    regimes: [...new Set(siens.map((j) => j.regime))],
                };
            }),
            conges: conges.map((c) => ({
                id: c.id,
                du: c.du,
                au: c.au,
                joursDeConge: c.joursDeConge,
                ouvrablesDuMois: c.ouvrablesDuMois,
                moisDePaie: c.moisDePaie,
                portePar: c.portePar,
            })),
            proposition,
        };
    }
    async declarerIndemniteCaisse(tenantId, userEmail, absenceId, dto) {
        try {
            return await this.declarerIndemniteCaisseLue(tenantId, userEmail, absenceId, dto);
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException("Une indemnité de la Caisse est déjà déclarée sur cet arrêt pour ce mois · annulez-la d'abord.");
            }
            throw e;
        }
    }
    async declarerIndemniteCaisseLue(tenantId, userEmail, absenceId, dto) {
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const a = await tx.absenceSalarie.findFirst({
                where: { id: absenceId, tenantId },
                select: { id: true, nature: true, du: true, au: true, annuleLe: true },
            });
            if (!a)
                throw new common_1.NotFoundException('Arrêt introuvable dans ce dossier.');
            if (a.annuleLe)
                throw new common_1.BadRequestException('Cet arrêt est annulé.');
            const deja = await tx.indemniteCaisseAbsence.findFirst({ where: { tenantId, absenceId, mois: dto.mois, annuleLe: null }, select: { id: true } });
            const refus = (0, absences_1.motifRefusIndemniteCaisse)({
                nature: a.nature,
                du: (0, absences_1.iso)(a.du),
                au: (0, absences_1.iso)(a.au),
                mois: dto.mois,
                montant: dto.montant,
                traitement: dto.traitement,
                piece: dto.piece,
                dejaDeclareCeMois: deja !== null,
            });
            if (refus)
                throw new common_1.BadRequestException(refus);
            return tx.indemniteCaisseAbsence.create({
                data: {
                    tenantId,
                    absenceId,
                    mois: dto.mois,
                    montant: new client_1.Prisma.Decimal(dto.montant),
                    traitement: dto.traitement,
                    piece: dto.piece.trim(),
                    creePar: userEmail,
                },
                select: { id: true },
            });
        });
    }
    async annulerIndemniteCaisse(tenantId, userEmail, id, motif) {
        const i = await this.prisma.indemniteCaisseAbsence.findFirst({ where: { id, tenantId }, select: { id: true, annuleLe: true } });
        if (!i)
            throw new common_1.NotFoundException('Indemnité introuvable dans ce dossier.');
        if (i.annuleLe)
            throw new common_1.BadRequestException('Cette indemnité est déjà annulée.');
        await this.prisma.indemniteCaisseAbsence.update({ where: { id: i.id }, data: { annuleLe: new Date(), annulePar: userEmail, motifAnnulation: motif.trim() } });
        return { annule: true };
    }
    async salarie(tenantId, salarieId) {
        const s = await this.prisma.salarie.findFirst({
            where: { id: salarieId, tenantId },
            select: {
                id: true,
                contrats: {
                    select: {
                        id: true,
                        dateEntreeEnVigueur: true,
                        dateFin: true,
                        renouvelleDeId: true,
                        remunerationBase: true,
                        periodiciteRemuneration: true,
                        deviseRemuneration: true,
                    },
                },
            },
        });
        if (!s)
            throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
        return s;
    }
};
exports.AbsencesService = AbsencesService;
exports.AbsencesService = AbsencesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AbsencesService);
//# sourceMappingURL=absences.service.js.map