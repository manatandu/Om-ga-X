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
exports.GarnissageDemonstrationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const tiers_service_1 = require("../tiers/tiers.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const immobilisation_service_1 = require("../immobilisations/immobilisation.service");
const personnel_service_1 = require("../personnel/personnel.service");
const bulletin_paie_1 = require("../personnel/bulletin-paie");
const rapprochement_service_1 = require("../rapprochement/rapprochement.service");
const questionnaire_service_1 = require("../questionnaire/questionnaire.service");
const scenario_demonstration_1 = require("./scenario-demonstration");
let GarnissageDemonstrationService = class GarnissageDemonstrationService {
    constructor(prisma, tiers, ecritures, immobilisations, personnel, rapprochements, questionnaires) {
        this.prisma = prisma;
        this.tiers = tiers;
        this.ecritures = ecritures;
        this.immobilisations = immobilisations;
        this.personnel = personnel;
        this.rapprochements = rapprochements;
        this.questionnaires = questionnaires;
    }
    async garnir(tenantId, auteurId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const scenario = (0, scenario_demonstration_1.scenarioDemonstration)(tenant.referentiel);
        const exercice = await this.prisma.exercice.findFirst({
            where: { tenantId, statut: client_1.StatutExercice.OUVERT },
            orderBy: { dateDebut: 'desc' },
        });
        if (!exercice)
            throw new common_1.BadRequestException('Le dossier de démonstration n’a pas d’exercice ouvert.');
        const annee = exercice.dateDebut.toISOString().slice(0, 4);
        const journaux = await this.prisma.journal.findMany({ where: { tenantId }, select: { id: true, code: true, compteTresorerieId: true } });
        const journal = (code) => {
            const j = journaux.find((x) => x.code === code);
            if (!j)
                throw new common_1.BadRequestException(`Journal ${code} absent du dossier de démonstration.`);
            return j;
        };
        const banque = journal('BQ').compteTresorerieId;
        if (!banque)
            throw new common_1.BadRequestException('Le journal BQ n’a pas de compte de trésorerie.');
        const numeros = [...new Set(scenario.operations.flatMap((o) => o.lignes.flatMap((l) => ('nature' in l ? [l.nature] : []))))];
        const comptes = await this.prisma.compte.findMany({ where: { tenantId, numero: { in: numeros } }, select: { id: true, numero: true } });
        let crees = 0;
        const compteTiers = new Map();
        for (const t of scenario.tiers) {
            const deja = await this.prisma.tiers.findUnique({
                where: { tenantId_code: { tenantId, code: t.code } },
                select: { comptesRattaches: { where: { estPrincipal: true }, select: { compteId: true } } },
            });
            if (deja) {
                const principal = deja.comptesRattaches[0]?.compteId;
                if (!principal)
                    throw new common_1.BadRequestException(`Le tiers ${t.code} existe sans compte principal · la vitrine ne se complète pas.`);
                compteTiers.set(t.code, principal);
                continue;
            }
            const cree = await this.tiers.creer(tenantId, { code: t.code, nom: t.nom, type: t.type });
            if (!cree.compteIndividuel)
                throw new common_1.BadRequestException(`Le tiers ${t.code} n’a pas reçu de compte individuel.`);
            compteTiers.set(t.code, cree.compteIndividuel.id);
            crees++;
        }
        const compteDe = (l) => {
            if ('tresorerie' in l)
                return banque;
            if ('tiers' in l)
                return compteTiers.get(l.tiers);
            const c = comptes.find((x) => x.numero === l.nature);
            if (!c)
                throw new common_1.BadRequestException(`Le compte ${l.nature} n’existe pas dans le plan de ce dossier.`);
            return c.id;
        };
        const ids = [];
        for (const op of scenario.operations) {
            const date = `${annee}-${op.jour}`;
            const deja = await this.prisma.ecriture.findFirst({
                where: { tenantId, exerciceId: exercice.id, journalId: journal(op.journal).id, date: new Date(`${date}T00:00:00Z`), libelle: op.libelle },
                select: { id: true },
            });
            if (deja) {
                ids.push(deja.id);
                continue;
            }
            const e = await this.ecritures.creer(tenantId, auteurId, {
                exerciceId: exercice.id,
                journalId: journal(op.journal).id,
                date,
                libelle: op.libelle,
                reference: op.reference,
                lignes: op.lignes.map((l) => ({
                    compteId: compteDe(l),
                    libelle: op.libelle,
                    debit: l.sens === 'DEBIT' ? l.montant : 0,
                    credit: l.sens === 'CREDIT' ? l.montant : 0,
                })),
            });
            ids.push(e.id);
            crees++;
        }
        const ouverture = exercice.dateDebut.toISOString().slice(0, 10);
        const ctx = { tenantId, auteurId, exerciceId: exercice.id, annee, ouverture, banque, journalBanque: journal('BQ').id };
        const immos = await this.garnirImmobilisations(ctx, scenario);
        ids.push(...immos.ecritures);
        const ecartes = [];
        const paie = await this.garnirPersonnel(ctx, scenario, ecartes);
        const rapprochement = await this.garnirRapprochement(ctx, scenario, ids);
        const questionnaire = await this.garnirQuestionnaire(ctx, scenario);
        crees += immos.crees + paie.crees + rapprochement.crees + questionnaire.crees;
        await this.ecritures.valider(tenantId, auteurId, ids);
        return {
            tiers: scenario.tiers.length,
            ecritures: ids.length,
            immobilisations: scenario.immobilisations.length,
            bulletins: paie.bulletins,
            crees,
            ecartes,
        };
    }
    async garnirImmobilisations(ctx, scenario) {
        const familles = await this.prisma.familleImmobilisation.findMany({
            where: { tenantId: ctx.tenantId, code: { in: [...new Set(scenario.immobilisations.map((i) => i.famille))] } },
            select: { id: true, code: true },
        });
        const ecritures = [];
        let crees = 0;
        for (const i of scenario.immobilisations) {
            const deja = await this.prisma.immobilisation.findFirst({
                where: { tenantId: ctx.tenantId, designation: i.designation },
                select: { ecritureAcquisitionId: true },
            });
            if (deja) {
                if (deja.ecritureAcquisitionId)
                    ecritures.push(deja.ecritureAcquisitionId);
                continue;
            }
            const famille = familles.find((f) => f.code === i.famille);
            if (!famille)
                throw new common_1.BadRequestException(`La famille d'immobilisations ${i.famille} n'existe pas dans ce dossier.`);
            const date = `${ctx.annee}-${i.jour}`;
            const bien = await this.immobilisations.creer(ctx.tenantId, ctx.auteurId, {
                familleId: famille.id,
                designation: i.designation,
                numeroInventaire: i.numeroInventaire,
                dateAcquisition: date,
                dateMiseEnService: date,
                valeurOrigine: i.valeur,
                exerciceId: ctx.exerciceId,
                journalId: ctx.journalBanque,
                compteContrepartieId: ctx.banque,
            });
            if (bien.ecritureAcquisitionId)
                ecritures.push(bien.ecritureAcquisitionId);
            crees++;
        }
        return { ecritures, crees };
    }
    async garnirPersonnel(ctx, scenario, ecartes) {
        const s = scenario.salarie;
        let crees = 0;
        const existant = await this.prisma.salarie.findFirst({
            where: { tenantId: ctx.tenantId, matricule: s.matricule },
            select: { id: true },
        });
        let salarieId = existant?.id;
        if (!salarieId) {
            const cree = await this.personnel.creerSalarie(ctx.tenantId, ctx.auteurId, {
                matricule: s.matricule,
                nom: s.nom,
                prenoms: s.prenoms,
                sexe: s.sexe,
                nationalite: s.nationalite,
            });
            salarieId = cree.id;
            crees++;
        }
        const contrat = await this.prisma.contratTravail.findFirst({
            where: { tenantId: ctx.tenantId, salarieId },
            select: { id: true },
        });
        if (!contrat) {
            await this.personnel.creerContrat(ctx.tenantId, ctx.auteurId, salarieId, {
                type: s.type,
                dateEntreeEnVigueur: ctx.ouverture,
                natureTravail: s.natureTravail,
                periodiciteRemuneration: client_1.PeriodiciteRemuneration.MOIS,
                remunerationBase: s.remunerationMensuelleFc,
                deviseRemuneration: 'CDF',
            });
            crees++;
        }
        const moisDePaie = `${ctx.annee}-${s.moisBulletin}`;
        const emis = await this.prisma.bulletinPaie.findFirst({
            where: { tenantId: ctx.tenantId, salarieId, moisDePaie, statut: client_1.StatutBulletinPaie.EMIS },
            select: { id: true },
        });
        if (emis)
            return { crees, bulletins: 1 };
        const saisie = {
            moisDePaie,
            deviseStipulation: 'CDF',
            elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: s.remunerationMensuelleFc }],
            natureEmployeurInpp: 'PRIVE',
            effectif: 1,
            regimeSalarial: 'BAREME_ARTICLE_118',
            personnesACharge: 0,
        };
        const motifs = (0, bulletin_paie_1.motifsRefusEmission)(await this.personnel.simulerPaie(ctx.tenantId, salarieId, saisie));
        if (motifs.length > 0) {
            ecartes.push(`Bulletin de ${moisDePaie} non émis · ${motifs.join(' ')}`);
            return { crees, bulletins: 0 };
        }
        await this.personnel.emettreBulletin(ctx.tenantId, ctx.auteurId, salarieId, saisie);
        return { crees: crees + 1, bulletins: 1 };
    }
    async garnirRapprochement(ctx, scenario, ecrituresVitrine) {
        const dateReleve = `${ctx.annee}-${scenario.jourReleve}`;
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: {
                compteId: ctx.banque,
                ecritureId: { in: ecrituresVitrine },
                ecriture: { tenantId: ctx.tenantId, date: { lte: new Date(`${dateReleve}T00:00:00Z`) } },
            },
            select: { id: true, debit: true, credit: true },
        });
        let crees = 0;
        let r = await this.prisma.rapprochementBancaire.findFirst({
            where: { tenantId: ctx.tenantId, compteId: ctx.banque },
            select: { id: true, soldeDepartDeclare: true },
        });
        if (!r) {
            const solde = lignes.reduce((acc, l) => acc + Number(l.debit) - Number(l.credit), 0);
            r = await this.rapprochements.ouvrir(ctx.tenantId, ctx.auteurId, {
                compteId: ctx.banque,
                dateReleve,
                soldeReleve: Math.round(solde * 100) / 100,
            });
            crees++;
        }
        if (r.soldeDepartDeclare === null || r.soldeDepartDeclare === undefined) {
            await this.rapprochements.declarerDepart(ctx.tenantId, r.id, { soldeDepart: 0, dateDepart: ctx.ouverture });
        }
        if (lignes.length > 0)
            await this.rapprochements.pointer(ctx.tenantId, r.id, lignes.map((l) => l.id));
        return { crees };
    }
    async garnirQuestionnaire(ctx, scenario) {
        const deja = await this.prisma.questionnaireRevision.findFirst({
            where: { tenantId: ctx.tenantId, exerciceId: ctx.exerciceId, libelle: scenario.questionnaire },
            select: { id: true },
        });
        if (deja)
            return { crees: 0 };
        await this.questionnaires.creer(ctx.tenantId, ctx.auteurId, { exerciceId: ctx.exerciceId, libelle: scenario.questionnaire });
        return { crees: 1 };
    }
};
exports.GarnissageDemonstrationService = GarnissageDemonstrationService;
exports.GarnissageDemonstrationService = GarnissageDemonstrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tiers_service_1.TiersService,
        ecriture_service_1.EcritureService,
        immobilisation_service_1.ImmobilisationService,
        personnel_service_1.PersonnelService,
        rapprochement_service_1.RapprochementService,
        questionnaire_service_1.QuestionnaireService])
], GarnissageDemonstrationService);
//# sourceMappingURL=garnissage-demonstration.service.js.map