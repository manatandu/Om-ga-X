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
var ImpressionDiffereeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpressionDiffereeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../../common/prisma.service");
const transaction_journalisee_1 = require("../../../common/audit/transaction-journalisee");
const export_service_1 = require("../export.service");
const export_fpm_service_1 = require("../export-fpm.service");
const fichier_en_memoire_1 = require("../fichier-en-memoire");
const pagination_par_numero_1 = require("../pagination-par-numero");
const impressions_journal_1 = require("../../journaux/impressions-journal");
const impression_differee_1 = require("./impression-differee");
const RESUME = {
    id: true,
    numero: true,
    nature: true,
    libelle: true,
    etat: true,
    demandeLe: true,
    demandePar: true,
    commenceLe: true,
    produitLe: true,
    motifEchec: true,
    nomFichier: true,
    taille: true,
    empreinte: true,
    fichierRetireLe: true,
};
const DELAI_RANGEMENT_MS = 120_000;
function lectureRendue(rendu) {
    if (typeof rendu !== 'object' || rendu === null || !('lecture' in rendu))
        return undefined;
    const l = rendu.lecture;
    return l?.instantLecture instanceof Date && typeof l.nombreEcritures === 'number'
        ? { instantLecture: l.instantLecture, nombreEcritures: l.nombreEcritures }
        : undefined;
}
let ImpressionDiffereeService = ImpressionDiffereeService_1 = class ImpressionDiffereeService {
    constructor(prisma, exportService, exportFpm) {
        this.prisma = prisma;
        this.exportService = exportService;
        this.exportFpm = exportFpm;
        this.logger = new common_1.Logger(ImpressionDiffereeService_1.name);
    }
    async demander(tenantId, userId, nature, brut) {
        const lu = (0, impression_differee_1.criteresOuMotif)(nature, brut);
        if ('motif' in lu)
            throw new common_1.BadRequestException(lu.motif);
        const { criteres } = lu;
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: criteres.exerciceId, tenantId },
            select: { dateDebut: true, dateFin: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException("Exercice introuvable pour ce dossier.");
        let journal = null;
        if (nature === client_1.NatureImpressionDifferee.JOURNAL && criteres.journalId) {
            journal = await this.prisma.journal.findFirst({
                where: { id: criteres.journalId, tenantId },
                select: { code: true },
            });
            if (!journal)
                throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
        }
        const libelle = (0, impression_differee_1.libelleDemande)(nature, criteres, exercice, journal);
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`impressions-differees:${tenantId}`}))`;
            const max = await tx.impressionDifferee.aggregate({ where: { tenantId }, _max: { numero: true } });
            return tx.impressionDifferee.create({
                data: {
                    tenantId,
                    numero: (max._max.numero ?? 0) + 1,
                    nature,
                    criteres: criteres,
                    libelle,
                    demandePar: userId,
                },
                select: RESUME,
            });
        });
    }
    async traiter(tenantId) {
        await this.declarerInterrompues(tenantId);
        const prise = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`impressions-differees:${tenantId}`}))`;
            const enCours = await tx.impressionDifferee.count({ where: { tenantId, etat: client_1.EtatImpressionDifferee.EN_COURS } });
            if (enCours > 0)
                return null;
            const suivante = await tx.impressionDifferee.findFirst({
                where: { tenantId, etat: client_1.EtatImpressionDifferee.EN_ATTENTE },
                orderBy: { numero: 'asc' },
                select: { id: true, nature: true, criteres: true, demandePar: true },
            });
            if (!suivante)
                return null;
            const commenceLe = new Date();
            await tx.impressionDifferee.update({
                where: { id: suivante.id },
                data: { etat: client_1.EtatImpressionDifferee.EN_COURS, commenceLe },
            });
            return { ...suivante, commenceLe };
        });
        let traitee = null;
        if (prise) {
            let resultat;
            const relus = (0, impression_differee_1.criteresOuMotif)(prise.nature, objetOuVide(prise.criteres));
            const criteres = 'criteres' in relus ? relus.criteres : null;
            try {
                if (!criteres)
                    throw new common_1.BadRequestException(`Critères de la demande illisibles · ${'motif' in relus ? relus.motif : ''}`);
                let lecture;
                const { nomFichier, contenu } = await (0, fichier_en_memoire_1.produireEnMemoire)(async (ouvrir) => {
                    const rendu = await this.produire(tenantId, prise.nature, criteres, ouvrir);
                    lecture = lectureRendue(rendu);
                    return rendu;
                });
                resultat = { etat: 'PRETE', nomFichier, contenu, lecture };
            }
            catch (erreur) {
                if (!(erreur instanceof common_1.HttpException)) {
                    this.logger.error(`Impression différée ${prise.id} · production en échec`, erreur instanceof Error ? erreur.stack : String(erreur));
                }
                resultat = { etat: 'ECHOUEE', motif: (0, impression_differee_1.motifEchecDe)(erreur) };
            }
            try {
                traitee = await this.ranger(tenantId, { ...prise, criteres }, resultat);
            }
            catch (erreur) {
                this.logger.error(`Impression différée ${prise.id} · le résultat n'a pas pu être rangé`, erreur instanceof Error ? erreur.stack : String(erreur));
                traitee = await this.ranger(tenantId, { ...prise, criteres }, { etat: 'ECHOUEE', motif: impression_differee_1.MOTIF_NON_RANGEE });
            }
        }
        const enAttente = await this.prisma.impressionDifferee.count({ where: { tenantId, etat: client_1.EtatImpressionDifferee.EN_ATTENTE } });
        return { traitee, enAttente };
    }
    async lister(tenantId, avant) {
        const [lusEtSurplus, total, enAttente] = await Promise.all([
            this.prisma.impressionDifferee.findMany({
                where: { tenantId, ...(avant !== undefined ? { numero: { lt: avant } } : {}) },
                orderBy: { numero: 'desc' },
                take: impression_differee_1.PLAFOND_IMPRESSIONS_LISTEES + 1,
                select: RESUME,
            }),
            this.prisma.impressionDifferee.count({ where: { tenantId } }),
            this.prisma.impressionDifferee.count({ where: { tenantId, etat: client_1.EtatImpressionDifferee.EN_ATTENTE } }),
        ]);
        const { page: lues, plusAnciensAvant } = (0, pagination_par_numero_1.pageDeNumeros)(lusEtSurplus, impression_differee_1.PLAFOND_IMPRESSIONS_LISTEES);
        const auteurs = await this.prisma.user.findMany({
            where: { tenantId, id: { in: [...new Set(lues.map((d) => d.demandePar))] } },
            select: { id: true, email: true },
        });
        const courriel = new Map(auteurs.map((u) => [u.id, u.email]));
        const maintenant = new Date();
        return {
            impressions: lues.map((d) => ({
                ...d,
                demandePar: courriel.get(d.demandePar) ?? 'utilisateur retiré du dossier',
                interrompue: (0, impression_differee_1.estInterrompue)(d.etat, d.commenceLe, maintenant),
            })),
            total,
            tronque: total > lues.length,
            plusAnciensAvant,
            enAttente,
        };
    }
    async fichier(tenantId, id) {
        const d = await this.prisma.impressionDifferee.findFirst({
            where: { id, tenantId },
            select: { numero: true, etat: true, nomFichier: true, contenu: true, fichierRetireLe: true },
        });
        if (!d)
            throw new common_1.NotFoundException('Impression introuvable pour ce dossier.');
        if (d.etat !== client_1.EtatImpressionDifferee.PRETE) {
            throw new common_1.ConflictException(`L'impression n° ${d.numero} n'est pas prête · aucun fichier à télécharger.`);
        }
        if (!d.contenu || !d.nomFichier) {
            throw new common_1.ConflictException(`Le fichier de l'impression n° ${d.numero} a été retiré · demandez l'édition de nouveau.`);
        }
        return { nomFichier: d.nomFichier, contenu: d.contenu };
    }
    async retirerFichier(tenantId, id) {
        const d = await this.prisma.impressionDifferee.findFirst({
            where: { id, tenantId },
            select: { id: true, numero: true, etat: true, fichierRetireLe: true },
        });
        if (!d)
            throw new common_1.NotFoundException('Impression introuvable pour ce dossier.');
        if (d.etat !== client_1.EtatImpressionDifferee.PRETE) {
            throw new common_1.ConflictException(`L'impression n° ${d.numero} n'a pas de fichier à retirer.`);
        }
        if (d.fichierRetireLe)
            throw new common_1.ConflictException(`Le fichier de l'impression n° ${d.numero} est déjà retiré.`);
        return this.prisma.impressionDifferee.update({
            where: { id: d.id },
            data: { contenu: null, fichierRetireLe: new Date() },
            select: RESUME,
        });
    }
    produire(tenantId, nature, criteres, ouvrir) {
        if (nature === client_1.NatureImpressionDifferee.JOURNAL) {
            return this.exportService.journalExcelEnFlux(tenantId, filtresDuJournal(criteres), ouvrir);
        }
        if (nature === client_1.NatureImpressionDifferee.GRAND_LIVRE) {
            const c = criteres;
            return c.format === 'plat'
                ? this.exportService.grandLivreCompletExcelEnFlux(tenantId, c.exerciceId, ouvrir)
                : this.exportFpm.grandLivreEnFlux(tenantId, c.exerciceId, ouvrir);
        }
        const c = criteres;
        return this.exportFpm.balanceGeneraleEnFlux(tenantId, c.exerciceId, c.grandsLivres, ouvrir);
    }
    async ranger(tenantId, prise, resultat) {
        const { id, commenceLe } = prise;
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const [ligne] = await tx.$queryRaw `
          SELECT "etat"::text AS "etat", "commenceLe" FROM "impressions_differees"
          WHERE "id" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
            if (!ligne || ligne.etat !== client_1.EtatImpressionDifferee.EN_COURS || ligne.commenceLe?.getTime() !== commenceLe.getTime()) {
                this.logger.warn(`Impression différée ${id} · production finie après son interruption déclarée, rien n'est rangé.`);
                return tx.impressionDifferee.findFirst({ where: { id, tenantId }, select: RESUME });
            }
            const rangee = await tx.impressionDifferee.update({
                where: { id },
                data: resultat.etat === 'PRETE'
                    ? {
                        etat: client_1.EtatImpressionDifferee.PRETE,
                        produitLe: new Date(),
                        nomFichier: resultat.nomFichier,
                        taille: resultat.contenu.length,
                        empreinte: (0, node_crypto_1.createHash)('sha256').update(resultat.contenu).digest('hex'),
                        contenu: resultat.contenu,
                    }
                    : { etat: client_1.EtatImpressionDifferee.ECHOUEE, produitLe: new Date(), motifEchec: resultat.motif },
                select: RESUME,
            });
            if (resultat.etat === 'PRETE' && prise.nature === client_1.NatureImpressionDifferee.JOURNAL && prise.criteres) {
                const impression = await this.exportService.impressionDuJournal(tx, tenantId, filtresDuJournal(prise.criteres), prise.demandePar, resultat.lecture ?? { instantLecture: prise.commenceLe });
                if (impression)
                    await (0, impressions_journal_1.enregistrerImpressionDans)(tx, impression);
            }
            return rangee;
        }, { timeout: DELAI_RANGEMENT_MS, maxWait: 10_000 });
    }
    async declarerInterrompues(tenantId) {
        const limite = new Date(Date.now() - impression_differee_1.DELAI_PRODUCTION_MS);
        const anciennes = await this.prisma.impressionDifferee.findMany({
            where: { tenantId, etat: client_1.EtatImpressionDifferee.EN_COURS, commenceLe: { lt: limite } },
            orderBy: { numero: 'asc' },
            take: impression_differee_1.PLAFOND_IMPRESSIONS_LISTEES,
            select: { id: true, commenceLe: true },
        });
        for (const a of anciennes) {
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const [ligne] = await tx.$queryRaw `
          SELECT "etat"::text AS "etat", "commenceLe" FROM "impressions_differees"
          WHERE "id" = ${a.id} AND "tenantId" = ${tenantId} FOR UPDATE`;
                if (!ligne || ligne.etat !== client_1.EtatImpressionDifferee.EN_COURS || ligne.commenceLe?.getTime() !== a.commenceLe?.getTime())
                    return;
                await tx.impressionDifferee.update({
                    where: { id: a.id },
                    data: { etat: client_1.EtatImpressionDifferee.ECHOUEE, produitLe: new Date(), motifEchec: impression_differee_1.MOTIF_INTERROMPUE },
                });
            });
        }
    }
};
exports.ImpressionDiffereeService = ImpressionDiffereeService;
exports.ImpressionDiffereeService = ImpressionDiffereeService = ImpressionDiffereeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        export_service_1.ExportService,
        export_fpm_service_1.ExportFpmService])
], ImpressionDiffereeService);
function filtresDuJournal(c) {
    return {
        exerciceId: c.exerciceId,
        journalId: c.journalId ?? undefined,
        dateDebut: c.dateDebut ?? undefined,
        dateFin: c.dateFin ?? undefined,
        inclureBrouillard: c.inclureBrouillard,
    };
}
function objetOuVide(valeur) {
    return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur) ? valeur : {};
}
//# sourceMappingURL=impression-differee.service.js.map