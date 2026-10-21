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
exports.ReevaluationBilanService = exports.PLAFOND_PERIMETRE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
const partie_remplacee_1 = require("./partie-remplacee");
const comptes_du_bien_1 = require("./comptes-du-bien");
const immobilisation_en_cours_1 = require("./immobilisation-en-cours");
const reevaluation_bilan_1 = require("./reevaluation-bilan");
const reevaluation_suites_1 = require("./reevaluation-suites");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_notes_syscohada_1_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada-1");
const correspondance_notes_associations_1 = require("../notes-annexes/correspondance-notes-associations");
const comptes_proposes_1 = require("../comptes/comptes-proposes");
const EPSILON = 0.005;
const n = (v) => Number(v ?? 0);
const centimes = (x) => Math.round(x * 100) / 100;
exports.PLAFOND_PERIMETRE = 500;
const DIVISIONS_REEVALUABLES = ['22', '23', '24', '26', '27'];
const DIVISIONS_RECUES_A_VENDRE_SYCEBNL = ['202', '203', '204', '205'];
let ReevaluationBilanService = class ReevaluationBilanService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    async exerciceDuDossier(tenantId, exerciceId) {
        return (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } }));
    }
    async perimetre(tenantId, exerciceId) {
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, jeuEtatsFinanciersSycebnl: true },
        });
        const ouvertureSuivante = new Date(exercice.dateFin.getTime() + 24 * 3600 * 1000);
        const divisions = tenant.referentiel === client_1.Referentiel.SYCEBNL ? [...DIVISIONS_REEVALUABLES, ...DIVISIONS_RECUES_A_VENDRE_SYCEBNL] : DIVISIONS_REEVALUABLES;
        const biens = await this.prisma.immobilisation.findMany({
            where: {
                tenantId,
                dateAcquisition: { lte: exercice.dateFin },
                AND: [
                    { OR: [{ statut: client_1.StatutImmobilisation.EN_SERVICE }, { dateSortie: { gt: exercice.dateFin } }] },
                    { OR: divisions.map((d) => ({ compteImmobilisation: { numero: { startsWith: d } } })) },
                ],
            },
            include: {
                compteImmobilisation: { select: { numero: true, intitule: true } },
                compteEnCours: { select: { id: true, numero: true, intitule: true } },
                dotations: { select: { montant: true, exerciceId: true, exercice: { select: { dateFin: true } } } },
                depreciations: { select: { sens: true, montant: true } },
                lignesReevaluation: {
                    where: { reevaluation: { exercice: { dateFin: { lt: exercice.dateFin } } } },
                    select: { coefficientRetenu: true, reevaluation: { select: { dateReevaluation: true } } },
                },
            },
            orderBy: [{ compteImmobilisation: { numero: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
            take: exports.PLAFOND_PERIMETRE + 1,
        });
        const lus = biens.slice(0, exports.PLAFOND_PERIMETRE).map((b) => {
            const cumulAmortissements = centimes(b.dotations.reduce((t, d) => t + n(d.montant), 0) + (0, partie_remplacee_1.amortissementsHorsDotations)(b));
            const cumulDepreciation = centimes(b.depreciations.reduce((t, d) => t + (d.sens === client_1.SensDepreciation.DOTATION ? n(d.montant) : -n(d.montant)), 0));
            const valeurOrigine = n(b.valeurOrigine);
            const valeurResiduelle = n(b.valeurResiduelle);
            const valeurNette = centimes(valeurOrigine - cumulAmortissements - cumulDepreciation);
            const amortissable = !(0, comptes_du_bien_1.motifSansAmortissementProjet)(tenant.jeuEtatsFinanciersSycebnl) &&
                !(0, comptes_du_bien_1.motifNonAmortissable)(b.compteImmobilisation.numero, tenant.referentiel) &&
                !b.dureeNonLimitee;
            const planCommence = b.dotations.length > 0 || n(b.amortissementAnterieur) > EPSILON;
            const enCoursALaDate = (0, immobilisation_en_cours_1.compteInscritALaDate)(b, exercice.dateFin) !== b.compteImmobilisationId;
            const compteInscrit = enCoursALaDate && b.compteEnCours ? b.compteEnCours : b.compteImmobilisation;
            const recuAVendre = (0, reevaluation_bilan_1.estBienRecuDestineALaVente)(b.compteImmobilisation.numero, tenant.referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL');
            const dotationManquante = !recuAVendre &&
                amortissable &&
                !!b.dateMiseEnService &&
                b.dateMiseEnService <= exercice.dateFin &&
                !b.dotations.some((d) => d.exerciceId === exercice.id) &&
                valeurNette - valeurResiduelle > EPSILON &&
                cumulDepreciation <= EPSILON;
            const dotationPosterieure = b.dotations.some((d) => d.exercice.dateFin > exercice.dateFin);
            const bien = {
                id: b.id,
                designation: b.designation,
                numeroCompte: compteInscrit.numero,
                valeurOrigine,
                valeurResiduelle,
                cumulAmortissements,
                cumulDepreciation,
                amortissable,
                lineaire: b.modeAmortissement === client_1.ModeAmortissement.LINEAIRE,
                planCommence,
                coefficientsAnterieurs: [...(b.lignesReevaluation ?? [])]
                    .sort((x, y) => x.reevaluation.dateReevaluation.getTime() - y.reevaluation.dateReevaluation.getTime())
                    .map((l) => n(l.coefficientRetenu)),
                anneesRestantes: planCommence
                    ? (0, reevaluation_bilan_1.anneesRestantes)({
                        dureeAns: b.dureeAmortissementAns,
                        valeurOrigine,
                        valeurResiduelle,
                        valeurNette,
                        revision: b.dateEffetRevisionPlan && b.dureeResiduelleRevisee
                            ? { effet: b.dateEffetRevisionPlan, dureeResiduelleAns: b.dureeResiduelleRevisee }
                            : null,
                        ouvertureSuivante,
                    })
                    : null,
            };
            const sortiApres = b.statut !== client_1.StatutImmobilisation.EN_SERVICE;
            const bloquant = sortiApres
                ? `Bien sorti le ${b.dateSortie ? b.dateSortie.toISOString().slice(0, 10) : '?'}, après la clôture · il était à ` +
                    "l'actif à la date de la réévaluation (AUDCIF art. 62 et 63) et sa sortie a été calculée sur les valeurs " +
                    'anciennes. La réévaluation se fait avant la sortie.'
                : b.degressifFiscal
                    ? "Bien sous option dégressive fiscale · l'amortissement dérogatoire se calcule sur la valeur d'origine, " +
                        'et la loi n° 23/053 (art. 134) ne réévalue que les amortissements « effectivement et définitivement ' +
                        'admis en déduction » · OmegaX ne recalcule pas le dérogatoire sur une valeur réévaluée.'
                    : dotationPosterieure
                        ? "Une dotation d'un exercice postérieur est déjà passée sur la valeur ancienne."
                        : dotationManquante
                            ? "Dotation de l'exercice non passée · elle se passe avant la réévaluation, sur les valeurs anciennes " +
                                '(AUDCIF art. 63 ; ch. 28 § 3.2).'
                            : null;
            return {
                ...bien,
                compteIntitule: compteInscrit.intitule,
                enCours: enCoursALaDate,
                nature: (0, reevaluation_bilan_1.natureReevaluable)(b.compteImmobilisation.numero, tenant.referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL'),
                valeurNette,
                dureeAmortissementAns: b.dureeAmortissementAns,
                modeAmortissement: b.modeAmortissement,
                bloquant,
                motifGarde: recuAVendre
                    ? 'RECU_DESTINE_A_LA_VENTE'
                    : (0, reevaluation_bilan_1.estElementMonetaire)(compteInscrit.numero)
                        ? 'ELEMENT_MONETAIRE'
                        : cumulDepreciation > EPSILON
                            ? 'DEPRECIE'
                            : valeurNette <= EPSILON
                                ? 'VALEUR_NETTE_NULLE'
                                : null,
            };
        });
        const reevaluation = await this.prisma.reevaluationBilan.findFirst({
            where: { tenantId, exerciceId },
            include: {
                lignes: {
                    include: { immobilisation: { select: { id: true, designation: true, numeroInventaire: true } } },
                    orderBy: { id: 'asc' },
                },
            },
        });
        return {
            referentiel: tenant.referentiel,
            dateReevaluation: exercice.dateFin,
            exerciceClos: exercice.statut === client_1.StatutExercice.CLOTURE,
            biens: lus,
            tronque: biens.length > exports.PLAFOND_PERIMETRE,
            reevaluation,
        };
    }
    async reevaluer(tenantId, userId, dto) {
        const exercice = await this.exerciceDuDossier(tenantId, dto.exerciceId);
        if (exercice.statut === client_1.StatutExercice.CLOTURE)
            throw new common_1.BadRequestException('Cet exercice est clôturé.');
        const decision = dto.decision?.trim();
        const traitementFiscal = dto.traitementFiscal?.trim();
        const methodeEvaluation = dto.methodeEvaluation?.trim();
        if (!decision || !traitementFiscal || !methodeEvaluation) {
            throw new common_1.BadRequestException('La décision des organes de gestion, la méthode et le traitement fiscal de l’écart sont exigés (AUDCIF art. 35 ; ' +
                'ch. 28 § 1.2 et § 8).');
        }
        if (dto.type === 'LIBRE' && !dto.methodeLibre) {
            throw new common_1.BadRequestException('Choisissez la méthode de la réévaluation libre · ajustement du brut et des amortissements, ou élimination ' +
                'des amortissements (ch. 28 § 4.3.1).');
        }
        if (dto.type === 'LEGALE' && dto.methodeLibre) {
            throw new common_1.BadRequestException('La réévaluation légale ajuste la valeur brute et les amortissements au coefficient (ch. 28 § 4.2.1.1) · aucune autre méthode.');
        }
        if (dto.neutraliteFiscale && dto.type !== 'LEGALE') {
            throw new common_1.BadRequestException("La provision spéciale de réévaluation (154) ne s'écrit que pour une réévaluation légale (ch. 28 § 4.2.4.1) · " +
                'la réévaluation libre crédite le 1062.');
        }
        const categories = dto.type === 'LEGALE' ? (dto.categories ?? []) : [];
        if (dto.type === 'LEGALE') {
            if (categories.length === 0) {
                throw new common_1.BadRequestException('Déclarez au moins une catégorie, son coefficient et sa source · le coefficient est fixé par arrêté du Ministre ' +
                    'des Finances (loi n° 23/053, art. 129), OmegaX n’en connaît aucun.');
            }
            const cles = new Set();
            for (const c of categories) {
                if (!c.cle.trim() || !c.libelle.trim() || !c.source.trim()) {
                    throw new common_1.BadRequestException('Chaque catégorie porte un nom, un coefficient et la source du coefficient.');
                }
                if (cles.has(c.cle))
                    throw new common_1.BadRequestException(`La catégorie « ${c.libelle} » est déclarée deux fois.`);
                cles.add(c.cle);
            }
        }
        const existante = await this.prisma.reevaluationBilan.findFirst({ where: { tenantId, exerciceId: exercice.id }, select: { id: true } });
        if (existante)
            throw new common_1.ConflictException('Une réévaluation est déjà enregistrée pour cet exercice.');
        const perimetre = await this.perimetre(tenantId, exercice.id);
        if (perimetre.tronque) {
            throw new common_1.BadRequestException(`Le périmètre dépasse ${exports.PLAFOND_PERIMETRE} biens · l'opération ne se fait pas en partie (art. 62), et elle ne ` +
                'se fait pas ici au-delà de ce nombre.');
        }
        if (perimetre.biens.length === 0) {
            throw new common_1.BadRequestException('Aucune immobilisation corporelle ou financière en service à la clôture · rien à réévaluer.');
        }
        const bloquants = perimetre.biens.filter((b) => b.bloquant);
        if (bloquants.length > 0) {
            throw new common_1.BadRequestException('Réévaluation impossible tant que ces biens ne sont pas en ordre · ' +
                bloquants
                    .slice(0, 10)
                    .map((b) => `« ${b.designation} » · ${b.bloquant}`)
                    .join(' ; '));
        }
        const parBien = new Map();
        for (const l of dto.lignes) {
            if (parBien.has(l.immobilisationId))
                throw new common_1.BadRequestException('Un bien figure deux fois dans la réévaluation.');
            parBien.set(l.immobilisationId, l);
        }
        const idsPerimetre = new Set(perimetre.biens.map((b) => b.id));
        const manquants = perimetre.biens.filter((b) => !parBien.has(b.id));
        if (manquants.length > 0) {
            throw new common_1.BadRequestException('Toute réévaluation partielle est interdite (AUDCIF art. 62 ; loi n° 23/053, art. 130) · il manque ' +
                manquants
                    .slice(0, 10)
                    .map((b) => `« ${b.designation} »`)
                    .join(', ') +
                (manquants.length > 10 ? ` et ${manquants.length - 10} autre(s)` : '') +
                '.');
        }
        if (dto.lignes.some((l) => !idsPerimetre.has(l.immobilisationId))) {
            throw new common_1.BadRequestException('Un bien de la saisie n’est pas une immobilisation corporelle ou financière de ce dossier en service à la clôture.');
        }
        const referentiel = perimetre.referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL';
        const coefficients = Object.fromEntries(categories.map((c) => [c.cle, c.coefficient]));
        const operation = {
            referentiel,
            type: dto.type,
            methodeLibre: dto.type === 'LIBRE' ? (dto.methodeLibre ?? null) : null,
            neutraliteFiscale: !!dto.neutraliteFiscale,
            coefficients,
            bases: Object.fromEntries(categories.map((c) => [c.cle, c.base ?? null])),
        };
        const resultats = [];
        const refus = [];
        for (const b of perimetre.biens) {
            const saisie = parBien.get(b.id);
            const r = (0, reevaluation_bilan_1.reevaluerBien)(b, saisie, operation);
            if ('refus' in r)
                refus.push(r.refus);
            else
                resultats.push({ bien: b, r, saisie });
        }
        if (refus.length > 0)
            throw new common_1.BadRequestException(refus.slice(0, 5).join(' '));
        const totalEcart = centimes(resultats.reduce((t, x) => t + x.r.ecart, 0));
        if (totalEcart <= EPSILON) {
            throw new common_1.BadRequestException('Aucun écart de réévaluation · les valeurs retenues égalent les valeurs nettes, rien à constater.');
        }
        const numerosEcart = [...new Set(resultats.map((x) => x.r.compteEcart).filter((c) => !!c))];
        const comptesEcart = await this.prisma.compte.findMany({ where: { tenantId, numero: { in: numerosEcart } }, select: { id: true, numero: true } });
        const absents = numerosEcart.filter((num) => !comptesEcart.some((c) => c.numero === num));
        if (absents.length > 0) {
            throw new common_1.BadRequestException(`Compte ${absents.join(', ')} absent du plan du dossier · ouvrez-le avant de réévaluer.`);
        }
        const fiches = await this.prisma.immobilisation.findMany({
            where: { tenantId, id: { in: resultats.map((x) => x.bien.id) } },
            select: { id: true, compteImmobilisationId: true, compteEnCoursId: true, dateMiseEnService: true, compteAmortissementId: true },
        });
        const methode = operation.methodeLibre === 'ELIMINATION' ? 'ELIMINATION' : 'AJUSTEMENT';
        const lignes = [];
        for (const { bien, r } of resultats) {
            const fiche = fiches.find((f) => f.id === bien.id);
            for (const l of (0, reevaluation_bilan_1.lignesBien)(r, methode)) {
                const compteId = l.role === 'BIEN'
                    ? (0, immobilisation_en_cours_1.compteInscritALaDate)(fiche, exercice.dateFin)
                    : l.role === 'AMORTISSEMENT'
                        ? fiche.compteAmortissementId
                        : comptesEcart.find((c) => c.numero === r.compteEcart).id;
                lignes.push({ compteId, libelle: `Réévaluation · ${bien.designation}`.slice(0, 200), debit: l.debit, credit: l.credit });
            }
        }
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: exercice.id,
            journalId: dto.journalId,
            date: exercice.dateFin.toISOString().slice(0, 10),
            libelle: dto.type === 'LEGALE' ? 'Réévaluation légale des immobilisations' : 'Réévaluation libre des immobilisations',
            lignes,
        });
        const ouvertureSuivante = new Date(exercice.dateFin.getTime() + 24 * 3600 * 1000);
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const reevaluation = await tx.reevaluationBilan.create({
                    data: {
                        tenantId,
                        exerciceId: exercice.id,
                        type: dto.type,
                        methodeLibre: operation.methodeLibre ?? null,
                        neutraliteFiscale: operation.neutraliteFiscale,
                        dateReevaluation: exercice.dateFin,
                        decision: decision.slice(0, 500),
                        traitementFiscal: traitementFiscal.slice(0, 1000),
                        methodeEvaluation: methodeEvaluation.slice(0, 2000),
                        categories: categories.map((c) => ({
                            cle: c.cle,
                            libelle: c.libelle.trim(),
                            coefficient: c.coefficient,
                            base: c.base ?? null,
                            source: c.source.trim(),
                        })),
                        totalEcart,
                        ecritureId: ecriture.id,
                        createdBy: userId,
                    },
                });
                await tx.ligneReevaluationBilan.createMany({
                    data: resultats.map(({ bien, r, saisie }) => ({
                        tenantId,
                        reevaluationId: reevaluation.id,
                        immobilisationId: bien.id,
                        categorie: dto.type === 'LEGALE' ? (saisie.categorie ?? null) : null,
                        coefficient: r.coefficient,
                        valeurActuelle: saisie.valeurActuelle ?? null,
                        coefficientRetenu: r.coefficientRetenu,
                        brutAvant: bien.valeurOrigine,
                        amortissementsAvant: bien.cumulAmortissements,
                        valeurNetteAvant: r.valeurNetteAvant,
                        brutApres: r.brutApres,
                        amortissementsApres: r.amortissementsApres,
                        valeurReevaluee: r.valeurReevaluee,
                        ecart: r.ecart,
                        compteEcart: r.compteEcart,
                        droitDeReprise: referentiel === 'SYCEBNL' ? (saisie.droitDeReprise ?? null) : null,
                        motifNonReevalue: r.motifNonReevalue,
                        valeurResiduelleAvant: bien.valeurResiduelle,
                    })),
                });
                for (const { bien, r } of resultats) {
                    if (r.ecart <= EPSILON)
                        continue;
                    const elimine = methode === 'ELIMINATION' && r.amortissementsApres === 0 && r.deltaAmortissements < -EPSILON;
                    await tx.immobilisation.update({
                        where: { id: bien.id },
                        data: {
                            valeurOrigine: r.brutApres,
                            valeurResiduelle: r.valeurResiduelleApres,
                            amortissementsReevaluation: { increment: r.deltaAmortissements },
                            ...(elimine ? { dateEffetRevisionPlan: ouvertureSuivante, dureeResiduelleRevisee: bien.anneesRestantes } : {}),
                        },
                    });
                    if (elimine) {
                        await tx.revisionPlanAmortissement.create({
                            data: {
                                tenantId,
                                immobilisationId: bien.id,
                                exerciceId: exercice.id,
                                nature: client_1.NatureRevisionPlan.PROSPECTIVE,
                                dateDecision: exercice.dateFin,
                                dureeAvantAns: bien.dureeAmortissementAns,
                                dureeApresAns: bien.anneesRestantes,
                                motif: 'Réévaluation libre, méthode 2 (AUDCIF Titre VIII ch. 28 § 4.3.1 et § 4.3.2) · la valeur nette réévaluée ' +
                                    'devient la valeur brute, amortie sur les annuités restantes à compter de l’ouverture de l’exercice suivant.',
                                reevaluationBilanId: reevaluation.id,
                                createdBy: userId,
                            },
                        });
                    }
                }
                return { id: reevaluation.id, totalEcart, ecritureId: ecriture.id, biens: resultats.map((x) => x.r) };
            });
        }
        catch (err) {
            await this.prisma.ligneEcriture.deleteMany({ where: { ecritureId: ecriture.id } });
            await this.prisma.ecriture.delete({ where: { id: ecriture.id } });
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('Une réévaluation est déjà enregistrée pour cet exercice.');
            }
            throw err;
        }
    }
    async propositionRepriseProvision(tenantId, exerciceId) {
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const lignes = await this.prisma.ligneReevaluationBilan.findMany({
            where: {
                tenantId,
                compteEcart: { startsWith: '154' },
                reevaluation: { exercice: { dateFin: { lt: exercice.dateFin } } },
            },
            include: {
                immobilisation: {
                    select: {
                        id: true,
                        designation: true,
                        statut: true,
                        dateSortie: true,
                        dotations: { where: { exerciceId: exercice.id }, select: { montant: true } },
                        lignesReevaluation: {
                            where: { reevaluation: { exercice: { dateFin: { lt: exercice.dateFin } } } },
                            select: {
                                id: true,
                                coefficientRetenu: true,
                                compteEcart: true,
                                ecart: true,
                                provisionReprise: true,
                                reevaluation: { select: { dateReevaluation: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { id: 'asc' },
            take: exports.PLAFOND_PERIMETRE + 1,
        });
        const deja = await this.prisma.repriseProvisionReevaluation.findFirst({ where: { tenantId, exerciceId: exercice.id } });
        const sortiALaCloture = (l) => l.immobilisation.statut !== client_1.StatutImmobilisation.EN_SERVICE &&
            (!l.immobilisation.dateSortie || l.immobilisation.dateSortie <= exercice.dateFin);
        const lues = lignes.slice(0, exports.PLAFOND_PERIMETRE);
        const sortis = lues.filter(sortiALaCloture).map((l) => ({
            ligneId: l.id,
            immobilisation: { id: l.immobilisation.id, designation: l.immobilisation.designation },
            resteProvision: centimes(n(l.ecart) - n(l.provisionReprise)),
            motif: 'Bien sorti · la reprise annuelle ne vise que les éléments d’actif réévalués (AUDCIF Titre VIII ch. 28 § 4.2.4.2) ; ' +
                'le reste de la provision se reprend au 861 à la sortie du bien, quelle qu’elle soit (fiche du compte 15 ; loi ' +
                'n° 23/053, art. 132 al. 1er et 133 al. 3).',
        }));
        const servies = lues.filter((l) => !sortiALaCloture(l)).map((l) => {
            const reste = centimes(n(l.ecart) - n(l.provisionReprise));
            const dotation = l.immobilisation.dotations[0] ? n(l.immobilisation.dotations[0].montant) : null;
            const chaine = [...l.immobilisation.lignesReevaluation]
                .sort((x, y) => x.reevaluation.dateReevaluation.getTime() - y.reevaluation.dateReevaluation.getTime())
                .map((x) => ({
                id: x.id,
                coefficientRetenu: n(x.coefficientRetenu),
                resteProvision: centimes(n(x.ecart) - n(x.provisionReprise)),
                provisionSpeciale: !!x.compteEcart?.startsWith('154'),
            }));
            const part = (0, reevaluation_bilan_1.partsDuSupplement)(dotation ?? 0, chaine).find((p) => p.id === l.id);
            if (!part)
                throw new Error(`Réévaluation ${l.id} absente de la chaîne de son bien.`);
            const montant = dotation === null ? 0 : part.montant;
            return {
                ligneId: l.id,
                immobilisation: { id: l.immobilisation.id, designation: l.immobilisation.designation },
                coefficientRetenu: n(l.coefficientRetenu),
                produitPosterieur: part.produitPosterieur,
                dotation,
                resteProvision: reste,
                montant,
                motif: reste <= EPSILON
                    ? 'Provision entièrement reprise.'
                    : dotation === null
                        ? "Dotation de l'exercice non passée · le supplément se lit sur elle."
                        : null,
            };
        });
        return {
            lignes: servies,
            sortis,
            total: centimes(servies.reduce((t, l) => t + l.montant, 0)),
            tronque: lignes.length > exports.PLAFOND_PERIMETRE,
            dejaPassee: deja ? { id: deja.id, montant: n(deja.montant), ecritureId: deja.ecritureId } : null,
        };
    }
    async passerRepriseProvision(tenantId, userId, dto) {
        const exercice = await this.exerciceDuDossier(tenantId, dto.exerciceId);
        if (exercice.statut === client_1.StatutExercice.CLOTURE)
            throw new common_1.BadRequestException('Cet exercice est clôturé.');
        const proposition = await this.propositionRepriseProvision(tenantId, exercice.id);
        if (proposition.dejaPassee)
            throw new common_1.ConflictException('La reprise de la provision spéciale est déjà passée pour cet exercice.');
        if (proposition.tronque)
            throw new common_1.BadRequestException(`Plus de ${exports.PLAFOND_PERIMETRE} biens portent la provision · la reprise ne se fait pas en partie.`);
        const retenues = proposition.lignes.filter((l) => l.montant > EPSILON);
        if (retenues.length === 0)
            throw new common_1.BadRequestException('Aucun supplément de dotation à reprendre sur cet exercice.');
        const [c154, c861] = await Promise.all([
            this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: reevaluation_bilan_1.COMPTE_PROVISION_SPECIALE } } }),
            this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: reevaluation_bilan_1.COMPTE_REPRISE_PROVISION_SPECIALE } } }),
        ]);
        if (!c154 || !c861) {
            throw new common_1.BadRequestException(`Les comptes ${reevaluation_bilan_1.COMPTE_PROVISION_SPECIALE} et ${reevaluation_bilan_1.COMPTE_REPRISE_PROVISION_SPECIALE} sont exigés au plan du dossier.`);
        }
        const total = centimes(retenues.reduce((t, l) => t + l.montant, 0));
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: exercice.id,
            journalId: dto.journalId,
            date: exercice.dateFin.toISOString().slice(0, 10),
            libelle: 'Reprise de la provision spéciale de réévaluation',
            lignes: [
                { compteId: c154.id, debit: total, credit: 0 },
                { compteId: c861.id, debit: 0, credit: total },
            ],
        });
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const reprise = await tx.repriseProvisionReevaluation.create({
                    data: {
                        tenantId,
                        exerciceId: exercice.id,
                        montant: total,
                        detail: retenues.map((l) => ({
                            ligneId: l.ligneId,
                            immobilisationId: l.immobilisation.id,
                            dotation: l.dotation,
                            coefficientRetenu: l.coefficientRetenu,
                            produitPosterieur: l.produitPosterieur,
                            montant: l.montant,
                        })),
                        ecritureId: ecriture.id,
                        createdBy: userId,
                    },
                });
                for (const l of retenues) {
                    await tx.ligneReevaluationBilan.update({ where: { id: l.ligneId }, data: { provisionReprise: { increment: l.montant } } });
                }
                return { id: reprise.id, montant: total, ecritureId: ecriture.id };
            });
        }
        catch (err) {
            await this.prisma.ligneEcriture.deleteMany({ where: { ecritureId: ecriture.id } });
            await this.prisma.ecriture.delete({ where: { id: ecriture.id } });
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('La reprise de la provision spéciale est déjà passée pour cet exercice.');
            }
            throw err;
        }
    }
    async noteDuJeu(tenantId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, jeuEtatsFinanciersSycebnl: true, systemeComptableSyscohada: true, nom: true },
        });
        const syscohada = tenant.referentiel === client_1.Referentiel.SYSCOHADA;
        const codeNote = syscohada
            ? tenant.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
                ? null
                : '3E'
            : tenant.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS
                ? '5H'
                : null;
        const rubriques = (syscohada ? correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1 : correspondance_notes_associations_1.NOTES_ASSOCIATIONS).find((x) => x.code === (syscohada ? '3A' : '5B'))?.rubriques ?? [];
        return { tenant, syscohada, codeNote, rubriques };
    }
    async noteReevaluations(tenantId, exerciceId) {
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const { tenant, syscohada, codeNote, rubriques } = await this.noteDuJeu(tenantId);
        if (!codeNote) {
            return {
                referentiel: tenant.referentiel,
                codeNote: null,
                motifSansObjet: syscohada
                    ? 'Le Système minimal de trésorerie n’a pas de note des réévaluations (AUDCIF Titre X).'
                    : 'Ce jeu d’états du SYCEBNL n’a pas de note des réévaluations (Partie 4 · seule la NOTE 5H des associations la porte).',
                reevaluations: [],
                postes: [],
                sortis: [],
                total: null,
                tronque: false,
            };
        }
        const reevaluations = await this.prisma.reevaluationBilan.findMany({
            where: { tenantId, dateReevaluation: { lte: exercice.dateFin } },
            select: {
                id: true,
                type: true,
                methodeLibre: true,
                neutraliteFiscale: true,
                dateReevaluation: true,
                decision: true,
                traitementFiscal: true,
                methodeEvaluation: true,
                totalEcart: true,
            },
            orderBy: { dateReevaluation: 'asc' },
            take: exports.PLAFOND_PERIMETRE,
        });
        const lignes = await this.prisma.ligneReevaluationBilan.findMany({
            where: {
                tenantId,
                ecart: { gt: 0 },
                reevaluation: { dateReevaluation: { lte: exercice.dateFin } },
                immobilisation: { OR: [{ dateSortie: null }, { dateSortie: { gte: exercice.dateDebut } }] },
            },
            select: {
                id: true,
                brutAvant: true,
                valeurReevaluee: true,
                ecart: true,
                compteEcart: true,
                coefficientRetenu: true,
                reevaluation: { select: { dateReevaluation: true } },
                immobilisation: {
                    select: {
                        id: true,
                        designation: true,
                        dateSortie: true,
                        natureSortie: true,
                        compteImmobilisation: { select: { numero: true } },
                        dotations: { where: { exerciceId: exercice.id }, select: { montant: true } },
                        ecritureSortieEcartReevaluation: {
                            select: { lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } } } },
                        },
                    },
                },
            },
            orderBy: [{ immobilisationId: 'asc' }, { id: 'asc' }],
            take: exports.PLAFOND_PERIMETRE + 1,
        });
        const reprise = await this.prisma.repriseProvisionReevaluation.findFirst({
            where: { tenantId, exerciceId: exercice.id },
            select: { detail: true },
        });
        const repriseParBien = new Map();
        for (const d of (Array.isArray(reprise?.detail) ? reprise.detail : [])) {
            if (d?.immobilisationId)
                repriseParBien.set(d.immobilisationId, centimes((repriseParBien.get(d.immobilisationId) ?? 0) + n(d.montant)));
        }
        const lues = lignes.slice(0, exports.PLAFOND_PERIMETRE);
        const parBien = new Map();
        for (const l of lues)
            parBien.set(l.immobilisation.id, [...(parBien.get(l.immobilisation.id) ?? []), l]);
        const postes = new Map();
        const sortis = [];
        for (const chaine of parBien.values()) {
            const tri = [...chaine].sort((a, b) => a.reevaluation.dateReevaluation.getTime() - b.reevaluation.dateReevaluation.getTime());
            const bien = tri[0].immobilisation;
            const anterieurs = tri.filter((l) => l.reevaluation.dateReevaluation < exercice.dateDebut).map((l) => n(l.coefficientRetenu));
            const dotation = bien.dotations[0] ? n(bien.dotations[0].montant) : 0;
            const sortiDansLExercice = !!bien.dateSortie && bien.dateSortie >= exercice.dateDebut && bien.dateSortie <= exercice.dateFin;
            const lignesSortie = sortiDansLExercice ? (bien.ecritureSortieEcartReevaluation?.lignes ?? []) : [];
            const reprise861Sortie = centimes(lignesSortie.filter((x) => x.compte.numero.startsWith('86')).reduce((t, x) => t + n(x.credit), 0));
            const transfere = centimes(lignesSortie.filter((x) => x.compte.numero.startsWith('106')).reduce((t, x) => t + n(x.debit), 0));
            if (sortiDansLExercice && bien.dateSortie) {
                sortis.push({
                    immobilisationId: bien.id,
                    designation: bien.designation,
                    dateSortie: bien.dateSortie.toISOString().slice(0, 10),
                    nature: bien.natureSortie ?? null,
                    transfereReserve: transfere,
                    reprise861: reprise861Sortie,
                });
            }
            const libelle = (0, reevaluation_suites_1.posteDuBien)(bien.compteImmobilisation.numero, rubriques, etats_financiers_communs_1.correspond);
            const p = postes.get(libelle) ?? {
                poste: libelle,
                biens: 0,
                coutHistorique: 0,
                valeurReevaluee: 0,
                ecart106: 0,
                provision154: 0,
                amortissementsSupplementaires: 0,
                repriseExercice: 0,
            };
            p.biens += 1;
            p.coutHistorique = centimes(p.coutHistorique + n(tri[0].brutAvant));
            p.valeurReevaluee = centimes(p.valeurReevaluee + n(tri[tri.length - 1].valeurReevaluee));
            for (const l of tri) {
                if (l.compteEcart?.startsWith('154'))
                    p.provision154 = centimes(p.provision154 + n(l.ecart));
                else if (l.compteEcart?.startsWith('106'))
                    p.ecart106 = centimes(p.ecart106 + n(l.ecart));
            }
            p.amortissementsSupplementaires = centimes(p.amortissementsSupplementaires + (0, reevaluation_suites_1.supplementDeLaDotation)(dotation, anterieurs));
            p.repriseExercice = centimes(p.repriseExercice + (repriseParBien.get(bien.id) ?? 0) + reprise861Sortie);
            postes.set(libelle, p);
        }
        const liste = [...postes.values()];
        const somme = (k) => centimes(liste.reduce((t, p) => t + p[k], 0));
        return {
            referentiel: tenant.referentiel,
            codeNote,
            motifSansObjet: null,
            reevaluations: reevaluations.map((r) => ({
                id: r.id,
                type: r.type,
                methodeLibre: r.methodeLibre,
                neutraliteFiscale: r.neutraliteFiscale,
                dateReevaluation: r.dateReevaluation.toISOString().slice(0, 10),
                decision: r.decision,
                traitementFiscal: r.traitementFiscal,
                methodeEvaluation: r.methodeEvaluation,
                totalEcart: n(r.totalEcart),
            })),
            postes: liste,
            sortis,
            total: liste.length
                ? {
                    biens: somme('biens'),
                    coutHistorique: somme('coutHistorique'),
                    valeurReevaluee: somme('valeurReevaluee'),
                    ecart106: somme('ecart106'),
                    provision154: somme('provision154'),
                    amortissementsSupplementaires: somme('amortissementsSupplementaires'),
                    repriseExercice: somme('repriseExercice'),
                }
                : null,
            tronque: lignes.length > exports.PLAFOND_PERIMETRE,
        };
    }
    async declarationSpeciale(tenantId, exerciceId) {
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const { tenant, rubriques } = await this.noteDuJeu(tenantId);
        const mentions = {
            echeance: 'Dépôt au plus tard le 30 avril (loi n° 23/053, art. 136).',
            modele: 'Le modèle des imprimés du Conseil Permanent de la Comptabilité au Congo (art. 137) n’est pas au corpus · ' +
                'cette édition en rassemble les éléments par catégorie d’immobilisations, elle n’est pas l’imprimé.',
            depot: 'OmegaX ne dépose rien et ne sait pas si la déclaration l’a été · l’astreinte de l’art. 138 n’est jamais calculée.',
        };
        const bornes = { dateDebut: exercice.dateDebut.toISOString().slice(0, 10), dateFin: exercice.dateFin.toISOString().slice(0, 10) };
        const reevaluation = await this.prisma.reevaluationBilan.findFirst({
            where: { tenantId, exerciceId: exercice.id },
            include: {
                lignes: {
                    include: {
                        immobilisation: {
                            select: { id: true, designation: true, numeroInventaire: true, dateAcquisition: true, compteImmobilisation: { select: { numero: true } } },
                        },
                    },
                    orderBy: { id: 'asc' },
                },
            },
        });
        if (!reevaluation)
            return { dossier: tenant.nom, exercice: bornes, reevaluation: null, categories: [], total: null, mentions };
        const declarees = (Array.isArray(reevaluation.categories) ? reevaluation.categories : []);
        const parCategorie = new Map();
        for (const l of reevaluation.lignes) {
            const decl = reevaluation.type === client_1.TypeReevaluation.LEGALE ? declarees.find((c) => c.cle === l.categorie) : undefined;
            const poste = (0, reevaluation_suites_1.posteDuBien)(l.immobilisation.compteImmobilisation.numero, rubriques, etats_financiers_communs_1.correspond);
            const cle = decl ? `categorie:${decl.cle}` : `poste:${poste}`;
            const g = parCategorie.get(cle) ?? {
                cle,
                libelle: decl ? decl.libelle : poste,
                coefficient: decl ? n(decl.coefficient) : null,
                source: decl ? decl.source : null,
                lignes: [],
            };
            g.lignes.push({
                immobilisationId: l.immobilisation.id,
                designation: l.immobilisation.designation,
                numeroInventaire: l.immobilisation.numeroInventaire ?? null,
                compte: l.immobilisation.compteImmobilisation.numero,
                dateAcquisition: l.immobilisation.dateAcquisition.toISOString().slice(0, 10),
                brutAvant: n(l.brutAvant),
                amortissementsAvant: n(l.amortissementsAvant),
                valeurNetteAvant: n(l.valeurNetteAvant),
                coefficient: l.coefficient === null ? null : n(l.coefficient),
                coefficientRetenu: n(l.coefficientRetenu),
                valeurActuelle: l.valeurActuelle === null ? null : n(l.valeurActuelle),
                valeurReevaluee: n(l.valeurReevaluee),
                brutApres: n(l.brutApres),
                amortissementsApres: n(l.amortissementsApres),
                ecart: n(l.ecart),
                compteEcart: l.compteEcart,
                motifNonReevalue: l.motifNonReevalue,
            });
            parCategorie.set(cle, g);
        }
        const totaux = (ls) => ({
            brutAvant: centimes(ls.reduce((t, x) => t + x.brutAvant, 0)),
            amortissementsAvant: centimes(ls.reduce((t, x) => t + x.amortissementsAvant, 0)),
            valeurNetteAvant: centimes(ls.reduce((t, x) => t + x.valeurNetteAvant, 0)),
            valeurReevaluee: centimes(ls.reduce((t, x) => t + x.valeurReevaluee, 0)),
            brutApres: centimes(ls.reduce((t, x) => t + x.brutApres, 0)),
            amortissementsApres: centimes(ls.reduce((t, x) => t + x.amortissementsApres, 0)),
            ecart: centimes(ls.reduce((t, x) => t + x.ecart, 0)),
        });
        const categories = [...parCategorie.values()].map((g) => ({ ...g, total: totaux(g.lignes) }));
        return {
            dossier: tenant.nom,
            exercice: bornes,
            reevaluation: {
                id: reevaluation.id,
                type: reevaluation.type,
                methodeLibre: reevaluation.methodeLibre,
                neutraliteFiscale: reevaluation.neutraliteFiscale,
                dateReevaluation: reevaluation.dateReevaluation.toISOString().slice(0, 10),
                decision: reevaluation.decision,
                traitementFiscal: reevaluation.traitementFiscal,
                methodeEvaluation: reevaluation.methodeEvaluation,
                totalEcart: n(reevaluation.totalEcart),
            },
            categories,
            total: totaux(categories.flatMap((c) => c.lignes)),
            mentions,
        };
    }
    async comptesReserve(tenantId, retenus = false) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        if (tenant.referentiel !== client_1.Referentiel.SYSCOHADA) {
            const c = await this.prisma.compte.findFirst({
                where: { tenantId, numero: reevaluation_suites_1.COMPTE_RESERVE_SYCEBNL },
                select: { id: true, numero: true, intitule: true, estActif: true, typeCompte: true },
            });
            const utilisable = !!c && c.estActif && c.typeCompte === client_1.TypeCompteDetailTotal.DETAIL;
            return {
                comptes: utilisable ? [{ id: c.id, numero: c.numero, intitule: c.intitule }] : [],
                nonRetenus: 0,
                impose: true,
                motifVide: utilisable
                    ? null
                    : `Le compte ${reevaluation_suites_1.COMPTE_RESERVE_SYCEBNL} Autres réserves, qui reçoit l’écart au SYCEBNL, n’est pas ouvert ou pas actif au plan · ouvrez-le dans Plan comptable.`,
            };
        }
        const plan = await this.prisma.compte.findMany({
            where: {
                tenantId,
                estActif: true,
                typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                OR: reevaluation_suites_1.RACINES_RESERVE_NON_DISTRIBUABLE.map((r) => ({ numero: { startsWith: r } })),
            },
            select: { id: true, numero: true, intitule: true, estRetenu: true },
            orderBy: { numero: 'asc' },
        });
        const { proposes, ecartes } = retenus ? await (0, comptes_proposes_1.comptesProposes)(this.prisma, tenantId, plan) : { proposes: plan, ecartes: 0 };
        return {
            comptes: proposes.map((c) => ({ id: c.id, numero: c.numero, intitule: c.intitule })),
            nonRetenus: ecartes,
            impose: false,
            motifVide: proposes.length > 0
                ? null
                : ecartes > 0
                    ? 'Aucune réserve sous 111, 112 ou 1138 n’est personnalisée · personnalisez-la dans Plan comptable.'
                    : 'Aucune réserve sous 111, 112 ou 1138 n’est ouverte au plan · ouvrez-la dans Plan comptable.',
        };
    }
    async ecartALaSortie(tenantId, immobilisationId) {
        const [tenant, bien] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.immobilisation.findFirst({ where: { id: immobilisationId, tenantId }, select: { id: true } }),
        ]);
        if (!bien)
            throw new common_1.BadRequestException('Immobilisation introuvable pour ce dossier.');
        const lignes = await this.prisma.ligneReevaluationBilan.findMany({
            where: { tenantId, immobilisationId, ecart: { gt: 0 } },
            select: { id: true, compteEcart: true, ecart: true, provisionReprise: true, ecartImpute: true, ecartTransfere: true },
            orderBy: { id: 'asc' },
        });
        const lues = lignes.map((l) => ({
            id: l.id,
            compteEcart: l.compteEcart,
            ecart: n(l.ecart),
            provisionReprise: n(l.provisionReprise),
            ecartImpute: n(l.ecartImpute),
            ecartTransfere: n(l.ecartTransfere),
        }));
        return { referentiel: tenant.referentiel, sorts: (0, reevaluation_suites_1.sortDesEcarts)({ lignes: lues }) };
    }
};
exports.ReevaluationBilanService = ReevaluationBilanService;
exports.ReevaluationBilanService = ReevaluationBilanService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], ReevaluationBilanService);
//# sourceMappingURL=reevaluation-bilan.service.js.map