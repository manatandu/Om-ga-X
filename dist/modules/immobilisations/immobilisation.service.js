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
var ImmobilisationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmobilisationService = exports.COMPTES_CESSION_COURANTE = exports.REPRISE_DEPRECIATION_HAO = exports.REPRISE_DEPRECIATION_SORTIE = exports.COMPTES_SORTIE = void 0;
exports.natureImmobilisation = natureImmobilisation;
exports.planDuBien = planDuBien;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const mois_entre_1 = require("../../common/mois-entre");
const bareme_comptes_1 = require("./bareme-comptes");
const bareme_fiscal_1 = require("./bareme-fiscal");
const client_1 = require("@prisma/client");
const acquisition_prix_aleatoire_1 = require("./acquisition-prix-aleatoire");
const materiel_recupere_1 = require("./materiel-recupere");
const nature_sortie_1 = require("./nature-sortie");
const reserve_propriete_1 = require("./reserve-propriete");
const correspondance_smt_syscohada_1 = require("../etats-financiers-syscohada/correspondance-smt-syscohada");
const systeme_minimal_1 = require("../../common/systeme-minimal");
const famille_immobilisation_seed_1 = require("./famille-immobilisation-seed");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const legs_immobilisations_1 = require("./legs-immobilisations");
const ventilation_prix_global_1 = require("./ventilation-prix-global");
const incorporel_duree_non_limitee_1 = require("./incorporel-duree-non-limitee");
const plafond_reprise_depreciation_1 = require("./plafond-reprise-depreciation");
const reprise_subvention_1 = require("./reprise-subvention");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const couts_emprunt_incorpores_1 = require("./couts-emprunt-incorpores");
const reevaluation_bilan_1 = require("./reevaluation-bilan");
const reevaluation_suites_1 = require("./reevaluation-suites");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
const contrepartie_acquisition_1 = require("./contrepartie-acquisition");
const frais_developpement_1 = require("./frais-developpement");
const demantelement_1 = require("./demantelement");
const IMMEUBLES_DE_PLACEMENT = ['2281', '2315', '2325'];
const echeancier_location_acquisition_1 = require("./location-acquisition/echeancier-location-acquisition");
const nomenclature_location_acquisition_1 = require("./location-acquisition/nomenclature-location-acquisition");
const compte_du_bien_1 = require("./compte-du-bien");
const comptes_du_bien_1 = require("./comptes-du-bien");
const comptes_proposes_1 = require("../comptes/comptes-proposes");
const bareme_fiscal_2 = require("./bareme-fiscal");
const immobilisation_en_cours_1 = require("./immobilisation-en-cours");
const depreciation_en_cours_1 = require("./depreciation-en-cours");
const transfert_depreciation_en_cours_1 = require("./transfert-depreciation-en-cours");
const partie_remplacee_1 = require("./partie-remplacee");
const revision_plan_amortissement_1 = require("./revision-plan-amortissement");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const EPSILON = 0.005;
const CHAMPS_DEPRECIATION_TRANSFERT = {
    sens: true,
    nature: true,
    montant: true,
    montantImputeEcart: true,
    compteDepreciationId: true,
    compteDepreciation: { select: { numero: true } },
    compteContrepartie: { select: { numero: true } },
    exercice: { select: { dateFin: true } },
};
function versMouvementLu(d) {
    return {
        sens: d.sens,
        montant: Number(d.montant),
        compteDepreciationId: d.compteDepreciationId,
        numeroCompteDepreciation: d.compteDepreciation.numero,
        numeroContrepartie: d.compteContrepartie.numero,
        montantImputeEcart: Number(d.montantImputeEcart),
    };
}
function versDotation(d) {
    return { ...d, montant: Number(d.montant) };
}
function nombresLot15(immo) {
    const r = {};
    for (const cle of ['detteAleatoireInitiale', 'versementsDetteAleatoire', 'valeurMaterielRecupere']) {
        if (cle in immo)
            r[cle] = immo[cle] === null || immo[cle] === undefined ? null : Number(immo[cle]);
    }
    return r;
}
function versImmobilisation(immo) {
    return {
        ...immo,
        valeurOrigine: Number(immo.valeurOrigine),
        valeurResiduelle: Number(immo.valeurResiduelle),
        prixCession: immo.prixCession === null || immo.prixCession === undefined ? null : Number(immo.prixCession),
        ...nombresLot15(immo),
        dotations: (immo.dotations ?? []).map((d) => versDotation(d)),
        depreciations: (immo.depreciations ?? []).map((d) => {
            const dep = d;
            return { id: dep.id, sens: dep.sens, montant: Number(dep.montant), exerciceId: dep.exerciceId, indice: dep.indice, compteDepreciationId: dep.compteDepreciationId ?? null };
        }),
    };
}
const CODE_CONTRAINTE_UNIQUE = 'P2002';
function empreinteDuPlan(i) {
    return JSON.stringify([
        Number(i.valeurOrigine),
        Number(i.valeurResiduelle),
        i.dureeAmortissementAns,
        i.dateEffetRevisionPlan ? new Date(i.dateEffetRevisionPlan).getTime() : null,
        i.dureeResiduelleRevisee ?? null,
        Number(i.amortissementsReevaluation ?? 0),
        Number(i.reprisesAmortissement ?? 0),
        (i.dotations ?? []).map((d) => [d.id ?? d.exerciceId ?? null, Number(d.montant)]).sort(),
        (i.depreciations ?? []).map((d) => [d.id ?? null, d.sens ?? null, Number(d.montant)]).sort(),
    ]);
}
function estConflitUnicite(err) {
    return err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === CODE_CONTRAINTE_UNIQUE;
}
exports.COMPTES_SORTIE = {
    INCORPORELLE: { valeurComptable: '81100000', produitCession: '82100000' },
    CORPORELLE: { valeurComptable: '81200000', produitCession: '82200000' },
    FINANCIERE: { valeurComptable: '81600000', produitCession: '82600000' },
    DONS_LEGS_VENTE: { valeurComptable: '81800000', produitCession: '82800000' },
};
exports.REPRISE_DEPRECIATION_SORTIE = {
    [client_1.Referentiel.SYCEBNL]: {
        INCORPORELLE: '79130000',
        CORPORELLE: '79140000',
        FINANCIERE: '79720000',
        DONS_LEGS_VENTE: '79520000',
        USUFRUIT: '79510000',
    },
    [client_1.Referentiel.SYSCOHADA]: {
        INCORPORELLE: '79130000',
        CORPORELLE: '79140000',
        FINANCIERE: '79720000',
    },
};
exports.REPRISE_DEPRECIATION_HAO = '86300000';
exports.COMPTES_CESSION_COURANTE = {
    INCORPORELLE: { valeurComptable: '65410000', produitCession: '75410000' },
    CORPORELLE: { valeurComptable: '65420000', produitCession: '75420000' },
};
function natureImmobilisation(numeroCompte, referentiel) {
    if (referentiel === client_1.Referentiel.SYCEBNL && numeroCompte.startsWith('2011'))
        return 'USUFRUIT';
    if (referentiel === client_1.Referentiel.SYCEBNL && numeroCompte.startsWith('20'))
        return 'DONS_LEGS_VENTE';
    if (/^2[01]/.test(numeroCompte))
        return 'INCORPORELLE';
    if (/^2[67]/.test(numeroCompte))
        return 'FINANCIERE';
    return 'CORPORELLE';
}
function planDuBien(immo) {
    return {
        degressif: immo.modeAmortissement === client_1.ModeAmortissement.DEGRESSIF,
        revision: immo.dateEffetRevisionPlan && immo.dureeResiduelleRevisee
            ? { effet: immo.dateEffetRevisionPlan, dureeResiduelleAns: immo.dureeResiduelleRevisee }
            : null,
    };
}
let ImmobilisationService = ImmobilisationService_1 = class ImmobilisationService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async seedFamillesDefaut(tenantId, referentiel, client = this.prisma) {
        const familles = referentiel === client_1.Referentiel.SYSCOHADA ? famille_immobilisation_seed_1.FAMILLES_IMMOBILISATION_DEFAUT_SYSCOHADA : famille_immobilisation_seed_1.FAMILLES_IMMOBILISATION_DEFAUT;
        for (const f of familles) {
            const [compteImmo, compteAmort, compteDotation] = await Promise.all([
                client.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: f.numeroCompteImmobilisation } } }),
                client.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: f.numeroCompteAmortissement } } }),
                client.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: f.numeroCompteDotation } } }),
            ]);
            if (!compteImmo || !compteAmort || !compteDotation)
                continue;
            await client.familleImmobilisation.upsert({
                where: { tenantId_code: { tenantId, code: f.code } },
                update: {},
                create: {
                    tenantId,
                    code: f.code,
                    intitule: f.intitule,
                    compteImmobilisationId: compteImmo.id,
                    compteAmortissementId: compteAmort.id,
                    compteDotationId: compteDotation.id,
                    dureeAmortissementAns: f.dureeAmortissementAns,
                },
            });
        }
    }
    async listerFamilles(tenantId) {
        return this.prisma.familleImmobilisation.findMany({
            where: { tenantId },
            include: { compteImmobilisation: true, compteAmortissement: true, compteDotation: true },
            orderBy: { intitule: 'asc' },
        });
    }
    async compteDeSortie(tenantId, numero) {
        const compte = await this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero } } });
        if (!compte) {
            throw new common_1.BadRequestException(`Compte ${numero} introuvable pour ce dossier · nécessaire pour enregistrer la sortie de cette immobilisation.`);
        }
        return compte;
    }
    async regimeComptable(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, systemeComptableSyscohada: true, jeuEtatsFinanciersSycebnl: true },
        });
    }
    sansProrataTemporis(regime) {
        return (regime.referentiel === client_1.Referentiel.SYSCOHADA &&
            regime.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE &&
            !correspondance_smt_syscohada_1.AMORTISSEMENT_SMT.prorataTemporis);
    }
    async compteRepriseDepreciation(tenantId, referentiel, nature, compteContrepartieDotationId) {
        let numero;
        if (compteContrepartieDotationId) {
            const contrepartie = await this.prisma.compte.findFirst({
                where: { id: compteContrepartieDotationId, tenantId },
                select: { numero: true },
            });
            if (contrepartie?.numero.startsWith('85'))
                numero = exports.REPRISE_DEPRECIATION_HAO;
        }
        numero ??= exports.REPRISE_DEPRECIATION_SORTIE[referentiel][nature];
        if (!numero) {
            throw new common_1.BadRequestException(`Aucun compte de reprise de dépréciation n'est défini pour une immobilisation ${nature} au référentiel ${referentiel}.`);
        }
        return this.compteDeSortie(tenantId, numero);
    }
    async verifierComptesFamille(tenantId, dto) {
        const [compteImmo, compteAmort, compteDotation] = await Promise.all([
            this.prisma.compte.findFirst({ where: { id: dto.compteImmobilisationId, tenantId } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteAmortissementId, tenantId } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteDotationId, tenantId } }),
        ]);
        if (!compteImmo)
            throw new common_1.BadRequestException('Compte introuvable pour ce tenant (compteImmobilisationId)');
        if (!compteAmort)
            throw new common_1.BadRequestException('Compte introuvable pour ce tenant (compteAmortissementId)');
        if (!compteDotation)
            throw new common_1.BadRequestException('Compte introuvable pour ce tenant (compteDotationId)');
        if (compteImmo.classe !== 'CLASSE_2' || compteImmo.numero.startsWith('28') || compteImmo.numero.startsWith('29')) {
            throw new common_1.BadRequestException(`Le compte d'immobilisation ${compteImmo.numero} doit être un compte de classe 2, hors amortissements/dépréciations (20-27)`);
        }
        if (compteAmort.classe !== 'CLASSE_2' || !compteAmort.numero.startsWith('28')) {
            throw new common_1.BadRequestException(`Le compte d'amortissement ${compteAmort.numero} doit être un compte de classe 28`);
        }
        if (compteDotation.classe !== 'CLASSE_6' || !compteDotation.numero.startsWith('68')) {
            throw new common_1.BadRequestException(`Le compte de dotation ${compteDotation.numero} doit être un compte de dotations aux amortissements (68)`);
        }
        const { referentiel } = await this.regimeComptable(tenantId);
        if (!(0, comptes_du_bien_1.motifNonAmortissable)(compteImmo.numero, referentiel)) {
            const motif = (0, comptes_du_bien_1.motifRefusCompteAmortissement)(referentiel, compteImmo.numero, compteAmort.numero);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
    }
    listerLieux(tenantId) {
        return this.prisma.lieuBien.findMany({
            where: { tenantId },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, intitule: true, _count: { select: { immobilisations: true } } },
        });
    }
    async creerLieu(tenantId, dto) {
        const code = dto.code.trim().toUpperCase();
        try {
            return await this.prisma.lieuBien.create({ data: { tenantId, code, intitule: dto.intitule.trim() } });
        }
        catch (e) {
            if (e.code === CODE_CONTRAINTE_UNIQUE) {
                throw new common_1.ConflictException(`Un lieu de code ${code} existe déjà dans ce dossier.`);
            }
            throw e;
        }
    }
    async supprimerLieu(tenantId, id) {
        const lieu = await this.prisma.lieuBien.findFirst({
            where: { id, tenantId },
            select: { id: true, code: true, _count: { select: { immobilisations: true } } },
        });
        if (!lieu)
            throw new common_1.NotFoundException('Lieu introuvable');
        if (lieu._count.immobilisations > 0) {
            throw new common_1.BadRequestException(`Le lieu ${lieu.code} porte ${lieu._count.immobilisations} bien(s) · déplacez-les avant de le supprimer.`);
        }
        await this.prisma.lieuBien.delete({ where: { id } });
        return { supprime: true };
    }
    async affecterLieu(tenantId, id, lieuId) {
        const immo = await this.prisma.immobilisation.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!immo)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        if (lieuId)
            await this.lieuDuDossier(tenantId, lieuId);
        return this.prisma.immobilisation.update({
            where: { id },
            data: { lieuId },
            select: { id: true, lieuId: true },
        });
    }
    async mettreEnService(tenantId, userId, id, dto) {
        const immo = await this.prisma.immobilisation.findFirst({
            where: { id, tenantId },
            select: {
                id: true,
                designation: true,
                dateAcquisition: true,
                dateMiseEnService: true,
                statut: true,
                valeurOrigine: true,
                compteImmobilisationId: true,
                compteEnCoursId: true,
                compteImmobilisation: { select: { numero: true } },
                depreciations: { select: CHAMPS_DEPRECIATION_TRANSFERT },
            },
        });
        if (!immo)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        if (immo.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException("Ce bien est sorti de l'actif · il n'a plus de plan à ouvrir.");
        }
        if (immo.dateMiseEnService) {
            throw new common_1.ConflictException(`Ce bien est déjà mis en service le ${immo.dateMiseEnService.toISOString().slice(0, 10)} · la date ne se déplace pas, le plan en dépend.`);
        }
        const date = new Date(dto.date);
        if (Number.isNaN(date.getTime()))
            throw new common_1.BadRequestException('Date de mise en service illisible.');
        if (date < immo.dateAcquisition) {
            throw new common_1.BadRequestException(`La mise en service ne peut précéder l'acquisition (${immo.dateAcquisition.toISOString().slice(0, 10)}) · AUDCIF art. 45.`);
        }
        const incorporations = await this.prisma.coutEmpruntIncorpore.aggregate({
            where: { tenantId, immobilisationId: id },
            _max: { dateFin: true },
        });
        const refusIncorporation = (0, couts_emprunt_incorpores_1.motifRefusMiseEnServiceAvantIncorporation)(date, incorporations._max.dateFin ?? null);
        if (refusIncorporation)
            throw new common_1.BadRequestException(refusIncorporation);
        const reevaluation = await this.prisma.ligneReevaluationBilan.findFirst({
            where: { tenantId, immobilisationId: id, reevaluation: { dateReevaluation: { gte: date } } },
            select: { reevaluation: { select: { dateReevaluation: true } } },
        });
        if (reevaluation) {
            throw new common_1.BadRequestException(`Ce bien a été réévalué le ${reevaluation.reevaluation.dateReevaluation.toISOString().slice(0, 10)} alors qu'il n'était ` +
                'pas encore en service · sa mise en service se date après cette réévaluation (AUDCIF art. 63 ; Titre VIII ch. 28 § 3.2).');
        }
        const dernierTest = immo.compteEnCoursId ? (0, transfert_depreciation_en_cours_1.dernierTestDeClotureDepuis)(immo.depreciations, date) : null;
        let ecritureId = null;
        let transfert = null;
        let avertissement = null;
        if (immo.compteEnCoursId) {
            if (!dto.exerciceId || !dto.journalId) {
                throw new common_1.BadRequestException("Ce bien est inscrit en cours · indiquez l'exercice et le journal de l'écriture qui le vire à son compte définitif.");
            }
            const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
            if (!exercice)
                throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
            if (exercice.statut === client_1.StatutExercice.CLOTURE)
                throw new common_1.BadRequestException('Cet exercice est clôturé.');
            if (date < exercice.dateDebut || date > exercice.dateFin) {
                throw new common_1.BadRequestException("La date de mise en service doit se situer dans l'exercice indiqué.");
            }
            const montantEnCours = Number(immo.valeurOrigine);
            const preparation = await this.preparerTransfert(tenantId, immo, dto.compteDepreciationCibleId, { lectureSeule: !!dernierTest });
            if (preparation.etat === 'ABSTENTION')
                avertissement = preparation.motif;
            if (preparation.etat === 'A_PASSER') {
                if (dernierTest)
                    avertissement = (0, transfert_depreciation_en_cours_1.motifTransfertDiffere)(preparation.numeroSource, preparation.montant, dernierTest);
                else
                    transfert = preparation;
            }
            const ecriture = await this.ecritureService.creer(tenantId, userId, {
                exerciceId: exercice.id,
                journalId: dto.journalId,
                date: dto.date.slice(0, 10),
                libelle: `Mise en service · ${immo.designation}`.slice(0, 190),
                lignes: [
                    { compteId: immo.compteImmobilisationId, debit: montantEnCours, credit: 0 },
                    { compteId: immo.compteEnCoursId, debit: 0, credit: montantEnCours },
                ],
            });
            ecritureId = ecriture.id;
        }
        else if (immo.depreciations.length > 0) {
            const preparation = await this.preparerTransfert(tenantId, immo, undefined, { lectureSeule: true });
            if (preparation.etat !== 'SANS_OBJET') {
                avertissement =
                    preparation.etat === 'ABSTENTION'
                        ? preparation.motif
                        : `La dépréciation de ${preparation.montant.toFixed(2)} au ${preparation.numeroSource} reste à ce compte · ce bien n'était pas inscrit en cours, sa mise en service ne passe aucune écriture. Transférez-la depuis la fiche du bien.`;
            }
        }
        const ecrituresPassees = [];
        try {
            if (ecritureId)
                ecrituresPassees.push(ecritureId);
            if (transfert) {
                await this.ecrireTransfert(tenantId, userId, immo, transfert, {
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                    date: dto.date.slice(0, 10),
                }, ecrituresPassees);
            }
            const poser = (client) => client.immobilisation.update({
                where: { id, tenantId, dateMiseEnService: null },
                data: { dateMiseEnService: date, ...(ecritureId ? { ecritureMiseEnServiceId: ecritureId } : {}) },
                select: { id: true, dateMiseEnService: true, ecritureMiseEnServiceId: true },
            });
            const t = transfert;
            const misEnService = t
                ? await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                    const fiche = await poser(tx);
                    await this.enregistrerTransfert(tx, userId, id, dto.exerciceId, t, ecrituresPassees.slice(-2));
                    return fiche;
                })
                : await poser(this.prisma);
            return {
                ...misEnService,
                transfertDepreciation: transfert ? this.resumeTransfert(transfert) : null,
                avertissementDepreciation: avertissement,
            };
        }
        catch (err) {
            for (const e of [...ecrituresPassees].reverse())
                await this.annulerEcritureOrpheline(e);
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new common_1.ConflictException("Ce bien vient d'être mis en service depuis un autre poste · rechargez la liste.");
            }
            throw err;
        }
    }
    async propositionTransfertDepreciation(tenantId, id, compteDepreciationCibleId, date) {
        const immo = await this.chargerPourTransfert(tenantId, id);
        const preparation = await this.preparerTransfert(tenantId, immo, compteDepreciationCibleId, { lectureSeule: true });
        if (preparation.etat !== 'A_PASSER')
            return { ...preparation, candidats: [] };
        const reference = immo.dateMiseEnService ?? (date && !Number.isNaN(new Date(date).getTime()) ? new Date(date) : null);
        const dernierTest = reference ? (0, transfert_depreciation_en_cours_1.dernierTestDeClotureDepuis)(immo.depreciations, reference) : null;
        return {
            ...this.resumeTransfert(preparation),
            etat: preparation.etat,
            motif: preparation.motifCible,
            candidats: preparation.candidats,
            differe: dernierTest ? (0, transfert_depreciation_en_cours_1.motifTransfertDiffere)(preparation.numeroSource, preparation.montant, dernierTest) : null,
            auPlusTotApres: dernierTest ? dernierTest.toISOString().slice(0, 10) : null,
        };
    }
    async transfererDepreciation(tenantId, userId, id, dto) {
        const immo = await this.chargerPourTransfert(tenantId, id);
        if (immo.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException("Ce bien est sorti de l'actif · sa dépréciation est soldée avec lui.");
        }
        if (!immo.dateMiseEnService) {
            throw new common_1.BadRequestException("Ce bien n'est pas encore mis en service · le transfert se passe avec sa mise en service.");
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        if (exercice.statut === client_1.StatutExercice.CLOTURE)
            throw new common_1.BadRequestException('Cet exercice est clôturé.');
        if (immo.dateMiseEnService > exercice.dateFin) {
            throw new common_1.BadRequestException("Ce bien est mis en service après la fin de cet exercice · choisissez l'exercice de sa mise en service.");
        }
        const dateTransfert = immo.dateMiseEnService >= exercice.dateDebut ? immo.dateMiseEnService : exercice.dateDebut;
        const posterieureLe = (0, transfert_depreciation_en_cours_1.dernierTestDeClotureDepuis)(immo.depreciations, dateTransfert);
        const posterieure = posterieureLe ? { exercice: { dateFin: posterieureLe } } : null;
        if (posterieure) {
            throw new common_1.BadRequestException(`Une dépréciation de ce bien a été testée à la clôture du ${posterieure.exercice.dateFin.toISOString().slice(0, 10)}, au ` +
                `ou après le ${dateTransfert.toISOString().slice(0, 10)} · choisissez un exercice ouvert qui commence après cette ` +
                'clôture, le transfert est daté de son premier jour (AUDCIF art. 22, 4°).');
        }
        const preparation = await this.preparerTransfert(tenantId, immo, dto.compteDepreciationCibleId);
        if (preparation.etat === 'SANS_OBJET') {
            throw new common_1.BadRequestException("Aucune dépréciation de ce bien n'est portée par un compte 29x9 · rien à transférer.");
        }
        if (preparation.etat === 'ABSTENTION')
            throw new common_1.BadRequestException(preparation.motif);
        const ecrituresPassees = [];
        try {
            await this.ecrireTransfert(tenantId, userId, immo, preparation, {
                exerciceId: exercice.id,
                journalId: dto.journalId,
                date: dateTransfert.toISOString().slice(0, 10),
            }, ecrituresPassees);
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => this.enregistrerTransfert(tx, userId, id, exercice.id, preparation, ecrituresPassees));
            return { ...this.resumeTransfert(preparation), date: dateTransfert.toISOString().slice(0, 10) };
        }
        catch (err) {
            for (const e of [...ecrituresPassees].reverse())
                await this.annulerEcritureOrpheline(e);
            if (estConflitUnicite(err)) {
                throw new common_1.ConflictException('Un transfert de dépréciation est déjà enregistré pour ce bien sur cet exercice.');
            }
            throw err;
        }
    }
    async chargerPourTransfert(tenantId, id) {
        const immo = await this.prisma.immobilisation.findFirst({
            where: { id, tenantId },
            select: {
                id: true,
                designation: true,
                statut: true,
                dateMiseEnService: true,
                compteImmobilisation: { select: { numero: true } },
                depreciations: { select: CHAMPS_DEPRECIATION_TRANSFERT },
            },
        });
        if (!immo)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        return immo;
    }
    async preparerTransfert(tenantId, immo, compteDepreciationCibleId, opts = {}) {
        if (immo.depreciations.length === 0)
            return { etat: 'SANS_OBJET' };
        const mouvements = immo.depreciations.map(versMouvementLu);
        if ((0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: false, numeroCompteDefinitif: immo.compteImmobilisation.numero, mouvements }).etat === 'SANS_OBJET') {
            return { etat: 'SANS_OBJET' };
        }
        const regime = await this.regimeComptable(tenantId);
        const proposition = (0, transfert_depreciation_en_cours_1.propositionTransfert)({
            smt: (0, systeme_minimal_1.estSystemeMinimal)(regime),
            numeroCompteDefinitif: immo.compteImmobilisation.numero,
            mouvements,
        });
        if (proposition.etat !== 'A_PASSER')
            return proposition;
        const echouer = (motif) => {
            throw new common_1.BadRequestException(motif);
        };
        const [candidats, reprise, dotation] = await Promise.all([
            this.prisma.compte.findMany({
                where: { tenantId, numero: { startsWith: proposition.racineCible.slice(0, 3) }, typeCompte: client_1.TypeCompteDetailTotal.DETAIL },
                select: { id: true, numero: true, intitule: true },
                orderBy: { numero: 'asc' },
                take: 200,
            }),
            this.prisma.compte.findFirst({ where: { tenantId, numero: proposition.numeroReprise }, select: { id: true, numero: true } }),
            this.prisma.compte.findFirst({ where: { tenantId, numero: proposition.numeroDotation }, select: { id: true, numero: true } }),
        ]);
        const admissibles = candidats.filter((c) => (0, transfert_depreciation_en_cours_1.motifRefusCompteCible)(c.numero, proposition.racineCible) === null);
        let cible = null;
        let motifCible = null;
        if (compteDepreciationCibleId) {
            const choisi = await this.prisma.compte.findFirst({
                where: { id: compteDepreciationCibleId, tenantId },
                select: { id: true, numero: true, typeCompte: true },
            });
            if (!choisi)
                motifCible = 'Compte de dépréciation introuvable pour ce dossier.';
            else if (choisi.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL)
                motifCible = `Le compte ${choisi.numero} est un compte de regroupement · choisissez un compte de détail.`;
            else
                motifCible = (0, transfert_depreciation_en_cours_1.motifRefusCompteCible)(choisi.numero, proposition.racineCible);
            if (choisi && !motifCible)
                cible = choisi;
        }
        else {
            cible = (0, transfert_depreciation_en_cours_1.compteCiblePropose)(proposition.racineCible, admissibles);
            if (!cible) {
                motifCible =
                    admissibles.length === 0
                        ? `Le plan du dossier n'ouvre aucun compte ${proposition.racineCible} ni autre compte ${proposition.racineCible.slice(0, 3)} hors en-cours · ` +
                            'ouvrez-le dans Plan comptable, il reçoit la dépréciation du bien achevé.'
                        : `Plusieurs comptes ${proposition.racineCible.slice(0, 3)} peuvent recevoir la dépréciation du bien achevé · choisissez-le.`;
            }
        }
        const manque = motifCible ??
            (!reprise ? `Compte ${proposition.numeroReprise} absent du plan du dossier · il reçoit la reprise du transfert (fiche du compte 79).` : null) ??
            (!dotation ? `Compte ${proposition.numeroDotation} absent du plan du dossier · il porte la dotation du transfert (fiche du compte 69).` : null);
        if (manque && !opts.lectureSeule)
            echouer(`La dépréciation de ce bien en cours se transfère à sa mise en service · ${manque}`);
        return {
            etat: 'A_PASSER',
            montant: proposition.montant,
            niveau: proposition.niveau,
            source: { id: proposition.compteSourceId, numero: proposition.numeroSource },
            cible,
            reprise,
            dotation,
            numeroSource: proposition.numeroSource,
            motifCible: manque,
            candidats: admissibles,
        };
    }
    async ecrireTransfert(tenantId, userId, immo, t, ou, passees) {
        const reprise = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: ou.exerciceId,
            journalId: ou.journalId,
            date: ou.date,
            libelle: `Reprise de dépréciation à la mise en service · ${immo.designation}`.slice(0, 190),
            lignes: [
                { compteId: t.source.id, debit: t.montant, credit: 0 },
                { compteId: t.reprise.id, debit: 0, credit: t.montant },
            ],
        });
        passees.push(reprise.id);
        const dotation = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: ou.exerciceId,
            journalId: ou.journalId,
            date: ou.date,
            libelle: `Dotation de dépréciation du bien achevé · ${immo.designation}`.slice(0, 190),
            lignes: [
                { compteId: t.dotation.id, debit: t.montant, credit: 0 },
                { compteId: t.cible.id, debit: 0, credit: t.montant },
            ],
        });
        passees.push(dotation.id);
        return [reprise.id, dotation.id];
    }
    async enregistrerTransfert(tx, userId, immobilisationId, exerciceId, t, ecritures) {
        const [ecritureReprise, ecritureDotation] = ecritures.slice(-2);
        const indice = 'Transfert à la mise en service · la dépréciation constatée pendant les travaux est reprise sur le compte en cours ' +
            'et dotée de nouveau sur le bien achevé (décision de l’éditeur du 2026-10-04 ; fiches des comptes 29, 69 et 79).';
        await tx.depreciationImmobilisation.create({
            data: {
                immobilisationId,
                exerciceId,
                nature: client_1.NatureMouvementDepreciation.TRANSFERT_REPRISE,
                sens: client_1.SensDepreciation.REPRISE,
                montant: t.montant,
                compteDepreciationId: t.source.id,
                compteContrepartieId: t.reprise.id,
                indice,
                ecritureId: ecritureReprise,
                createdBy: userId,
            },
        });
        await tx.depreciationImmobilisation.create({
            data: {
                immobilisationId,
                exerciceId,
                nature: client_1.NatureMouvementDepreciation.TRANSFERT_DOTATION,
                sens: client_1.SensDepreciation.DOTATION,
                montant: t.montant,
                compteDepreciationId: t.cible.id,
                compteContrepartieId: t.dotation.id,
                indice,
                ecritureId: ecritureDotation,
                createdBy: userId,
            },
        });
    }
    resumeTransfert(t) {
        return {
            montant: t.montant,
            niveau: t.niveau,
            compteSource: t.source.numero,
            compteCible: t.cible?.numero ?? null,
            compteCibleId: t.cible?.id ?? null,
            compteReprise: t.reprise?.numero ?? null,
            compteDotation: t.dotation?.numero ?? null,
        };
    }
    async lieuDuDossier(tenantId, lieuId) {
        const lieu = await this.prisma.lieuBien.findFirst({ where: { id: lieuId, tenantId }, select: { id: true } });
        if (!lieu)
            throw new common_1.BadRequestException('Lieu introuvable pour ce dossier');
    }
    async verifierModeFamille(tenantId, mode, compteImmobilisationId, dureeAns) {
        if (mode !== client_1.ModeAmortissement.DEGRESSIF)
            return;
        const [regime, compte] = await Promise.all([
            this.regimeComptable(tenantId),
            this.prisma.compte.findFirst({ where: { id: compteImmobilisationId, tenantId }, select: { numero: true } }),
        ]);
        const refus = (0, revision_plan_amortissement_1.motifRefusModeDegressif)({ referentiel: regime.referentiel, numeroCompte: compte?.numero ?? '', dureeAns });
        if (refus)
            throw new common_1.BadRequestException(refus);
    }
    async creerFamille(tenantId, dto) {
        await this.verifierComptesFamille(tenantId, dto);
        await this.verifierModeFamille(tenantId, dto.modeAmortissement, dto.compteImmobilisationId, dto.dureeAmortissementAns);
        const existant = await this.prisma.familleImmobilisation.findUnique({
            where: { tenantId_code: { tenantId, code: dto.code } },
        });
        if (existant) {
            throw new common_1.ConflictException(`Une famille de code "${dto.code}" existe déjà pour ce tenant`);
        }
        return this.prisma.familleImmobilisation.create({ data: { ...dto, tenantId } });
    }
    async modifierFamille(tenantId, id, dto) {
        const famille = await this.prisma.familleImmobilisation.findFirst({ where: { id, tenantId } });
        if (!famille)
            throw new common_1.NotFoundException('Famille introuvable pour ce tenant');
        await this.verifierModeFamille(tenantId, famille.modeAmortissement, famille.compteImmobilisationId, dto.dureeAmortissementAns ?? famille.dureeAmortissementAns);
        return this.prisma.familleImmobilisation.update({ where: { id }, data: dto });
    }
    async lister(tenantId, statut) {
        const immobilisations = await this.prisma.immobilisation.findMany({
            where: { tenantId, ...(statut ? { statut } : {}) },
            include: {
                famille: true,
                lieu: { select: { id: true, code: true, intitule: true } },
                compteImmobilisation: true,
                compteEnCours: { select: { id: true, numero: true, intitule: true } },
                compteAmortissement: true,
                dotations: true,
                depreciations: true,
            },
            orderBy: { dateAcquisition: 'desc' },
        });
        return immobilisations.map(versImmobilisation);
    }
    async annulerEcritureOrpheline(ecritureId) {
        await this.prisma.ligneEcriture.deleteMany({ where: { ecritureId } });
        await this.prisma.ecriture.delete({ where: { id: ecritureId } });
    }
    async defaireSortie(tenantId, id, designation, ecritures, dotationId) {
        try {
            if (dotationId)
                await this.prisma.dotationAmortissement.delete({ where: { id: dotationId } });
            for (const ecritureId of [...ecritures].reverse())
                await this.annulerEcritureOrpheline(ecritureId);
            await this.prisma.immobilisation.updateMany({
                where: { id, tenantId },
                data: {
                    statut: client_1.StatutImmobilisation.EN_SERVICE,
                    dateSortie: null,
                    prixCession: null,
                    natureSortie: null,
                    referencePieceSortie: null,
                    datePieceSortie: null,
                    ecritureSortieId: null,
                    ecritureProduitCessionId: null,
                    ecritureSortieEcartReevaluationId: null,
                },
            });
        }
        catch {
            throw new common_1.InternalServerErrorException(`La sortie de « ${designation} » a échoué et n'a pas pu être entièrement défaite · vérifiez au journal ` +
                'les écritures de sortie de ce bien et son statut avant toute nouvelle tentative.');
        }
    }
    async sortDeLEcartALaSortie(tenantId, id, referentiel, dto) {
        const lignesReevaluation = await this.prisma.ligneReevaluationBilan.findMany({
            where: { tenantId, immobilisationId: id, ecart: { gt: 0 } },
            select: { id: true, compteEcart: true, ecart: true, provisionReprise: true, ecartImpute: true, ecartTransfere: true },
            orderBy: { id: 'asc' },
        });
        const vide = { lignes: [], passes: [], restitution: null };
        if (lignesReevaluation.length === 0)
            return vide;
        const ref = referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL';
        const passes = (0, reevaluation_suites_1.sortDesEcarts)({
            lignes: lignesReevaluation.map((l) => ({
                id: l.id,
                compteEcart: l.compteEcart,
                ecart: Number(l.ecart),
                provisionReprise: Number(l.provisionReprise),
                ecartImpute: Number(l.ecartImpute),
                ecartTransfere: Number(l.ecartTransfere),
            })),
        });
        if (passes.length === 0)
            return vide;
        const { reserve, reprise } = (0, reevaluation_suites_1.lignesSortDeLEcart)(passes);
        const lignes = [];
        let compteReserve = null;
        if (reserve.length > 0) {
            const reserveChoisie = dto.compteReserveEcartId
                ? await this.prisma.compte.findFirst({
                    where: { id: dto.compteReserveEcartId, tenantId },
                    select: { id: true, numero: true, estActif: true, typeCompte: true },
                })
                : null;
            if (dto.compteReserveEcartId && !reserveChoisie)
                throw new common_1.BadRequestException('Réserve introuvable pour ce dossier.');
            const total = reserve.reduce((t, r) => t + r.montant, 0);
            const refus = (0, reevaluation_suites_1.motifRefusCompteReserve)(reserveChoisie?.numero, ref);
            if (refus) {
                throw new common_1.BadRequestException(`Ce bien porte ${total.toFixed(2)} d'écart de réévaluation au 106 · ${refus}`);
            }
            const reserveRetenue = ref === 'SYCEBNL'
                ? await this.prisma.compte.findFirst({
                    where: { tenantId, numero: reevaluation_suites_1.COMPTE_RESERVE_SYCEBNL },
                    select: { id: true, numero: true, estActif: true, typeCompte: true },
                })
                : reserveChoisie;
            if (!reserveRetenue) {
                throw new common_1.BadRequestException(`Ce bien porte ${total.toFixed(2)} d'écart de réévaluation au 106 · le compte ${reevaluation_suites_1.COMPTE_RESERVE_SYCEBNL} Autres ` +
                    'réserves, qui le reçoit au SYCEBNL, n’est pas ouvert au plan du dossier · ouvrez-le dans Plan comptable.');
            }
            if (reserveRetenue.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL || !reserveRetenue.estActif) {
                throw new common_1.BadRequestException(ref === 'SYCEBNL'
                    ? `Ce bien porte ${total.toFixed(2)} d'écart de réévaluation au 106 · le compte ${reevaluation_suites_1.COMPTE_RESERVE_SYCEBNL} Autres ` +
                        'réserves, qui le reçoit au SYCEBNL, n’est pas un compte de détail actif · réactivez-le dans Plan comptable.'
                    : `Le compte ${reserveRetenue.numero} n'est pas un compte de détail actif · choisissez la réserve où l'écart s'inscrit.`);
            }
            compteReserve = { id: reserveRetenue.id, numero: reserveRetenue.numero };
            for (const r of reserve) {
                const compteEcart = await this.compteDeSortie(tenantId, r.compteEcart);
                lignes.push({ compteId: compteEcart.id, debit: r.montant, credit: 0 }, { compteId: compteReserve.id, debit: 0, credit: r.montant });
            }
        }
        if (reprise > 0) {
            const [c154, c861] = await Promise.all([
                this.compteDeSortie(tenantId, reevaluation_bilan_1.COMPTE_PROVISION_SPECIALE),
                this.compteDeSortie(tenantId, reevaluation_bilan_1.COMPTE_REPRISE_PROVISION_SPECIALE),
            ]);
            lignes.push({ compteId: c154.id, debit: reprise, credit: 0 }, { compteId: c861.id, debit: 0, credit: reprise });
        }
        const cession = dto.type === immobilisation_dto_1.TypeSortie.CESSION;
        return {
            lignes,
            passes,
            restitution: {
                transfereReserve: reserve.reduce((t, r) => Math.round((t + r.montant) * 100) / 100, 0),
                compteReserve: compteReserve?.numero ?? null,
                repris861: reprise,
                fiscal: cession && reserve.length > 0 && ref === 'SYSCOHADA'
                    ? 'Fiscalement, la loi n° 23/053 veut la réduction de la plus-value compensée par la réintégration du solde ' +
                        'de l’écart du bien cédé (art. 133, al. 3), et la plus-value de réévaluation devient imposable quand le bien ' +
                        'est aliéné (art. 19) · réintégration au résultat fiscal, non passée par OmegaX.'
                    : null,
            },
        };
    }
    async trouver(tenantId, id) {
        const immo = await this.prisma.immobilisation.findFirst({
            where: { id, tenantId },
            include: {
                famille: true,
                compteImmobilisation: true,
                compteEnCours: true,
                dotations: { orderBy: { exercice: { dateDebut: 'asc' } }, include: { exercice: true } },
                depreciations: {
                    orderBy: { exercice: { dateDebut: 'asc' } },
                    include: {
                        exercice: true,
                        compteDepreciation: { select: { numero: true } },
                        compteContrepartie: { select: { numero: true } },
                    },
                },
            },
        });
        if (!immo)
            throw new common_1.NotFoundException('Immobilisation introuvable pour ce tenant');
        return immo;
    }
    baseAmortissable(valeurOrigine, valeurResiduelle) {
        return Math.max(0, valeurOrigine - valeurResiduelle);
    }
    cumulDepreciation(depreciations) {
        return depreciations.reduce((total, d) => total + (d.sens === client_1.SensDepreciation.DOTATION ? d.montant : -d.montant), 0);
    }
    anneesEcoulees(dateMiseEnService, debutExercice) {
        const origine = new Date(Date.UTC(dateMiseEnService.getUTCFullYear(), dateMiseEnService.getUTCMonth(), 1));
        if (debutExercice <= origine)
            return 0;
        const mois = (debutExercice.getUTCFullYear() - origine.getUTCFullYear()) * 12 +
            (debutExercice.getUTCMonth() - origine.getUTCMonth());
        return Math.max(0, Math.floor(mois / 12));
    }
    verifierDecomposition(principal, referentiel) {
        if (principal.compteImmobilisation.numero.startsWith('2442')) {
            throw new common_1.BadRequestException(referentiel === client_1.Referentiel.SYCEBNL
                ? "Le matériel informatique ne figure pas dans la liste des immobilisations décomposables du SYCEBNL " +
                    '(Partie 2 ch. 3, règles générales de la classe 2), qui n’autorise la décomposition que pour les ' +
                    'bâtiments et autres ouvrages, les avions, les bateaux, les camions, les autocars, les bus, les ' +
                    'véhicules blindés de transport de fonds et certains matériels et outillages industriels, miniers, ' +
                    'agricoles, hospitaliers et pétroliers.'
                : "L'AUDCIF exclut nommément le matériel informatique de la décomposition (Titre VIII ch. 4 § 2), avec " +
                    'les véhicules de tourisme et les matériels et mobiliers, en raison de leur faible valeur ou de leur ' +
                    'durée d’utilisation courte. Le coût de leur remplacement est une charge de l’exercice.');
        }
    }
    verifierComposant(dto, principal, renouvellement, referentiel) {
        const sourceSecurite = referentiel === client_1.Referentiel.SYSCOHADA
            ? 'AUDCIF, Titre VIII ch. 14 § 1.2.3'
            : 'SYCEBNL, Partie 2 ch. 3, classe 2';
        if (dto.typeComposant === client_1.TypeComposant.REVISION_MAJEURE &&
            dto.dureeAmortissementAns >= principal.dureeAmortissementAns) {
            throw new common_1.BadRequestException(`Une révision majeure s'amortit sur l'intervalle qui sépare deux révisions, plus court que la durée de ` +
                `la structure (${principal.dureeAmortissementAns} ans ici) · AUDCIF, Titre VIII ch. 5 § 1. ` +
                "L'exemple officiel : un matériel de 190 000 000 sur six ans, révisé tous les deux ans pour " +
                '10 000 000, porte une structure amortie sur 180 000 000 en six ans et une révision amortie sur ' +
                '10 000 000 en DEUX ans. Un composant qui porterait la durée de la structure serait un morceau de la ' +
                'structure, pas une révision.');
        }
        if ((dto.valeurResiduelle ?? 0) > EPSILON && dto.dernierRenouvellement !== true) {
            throw new common_1.BadRequestException("Un composant identifié à l'origine ne porte pas de valeur résiduelle : il est prévu qu'il soit remplacé " +
                "avant la fin de l'utilisation de la structure (AUDCIF, Titre VIII ch. 4 § 3.3). Si celui-ci est le " +
                'DERNIER renouvellement avant la fin d’utilisation du bien principal, indiquez-le explicitement.');
        }
        if (dto.typeComposant === client_1.TypeComposant.PIECE_DE_SECURITE && !dto.dateMiseEnService) {
            throw new common_1.BadRequestException(`Une pièce de sécurité s'amortit dès l'acquisition, qu'elle serve ou non (${sourceSecurite}) · ` +
                "elle ne reste pas « non mise en service ». Indiquez sa date de début d'amortissement.");
        }
        if (dto.typeComposant === client_1.TypeComposant.PIECE_DE_SECURITE && renouvellement) {
            if (dto.dateAcquisition && new Date(dto.dateMiseEnService).getTime() !== new Date(dto.dateAcquisition).getTime()) {
                throw new common_1.BadRequestException("Une pièce de sécurité qui en remplace une autre s'amortit dès son acquisition, qu'elle serve ou non · " +
                    "sa date de mise en service est sa date d'acquisition. Une pièce qui ne s'amortit qu'à son " +
                    'intégration est une pièce de RECHANGE.');
            }
        }
        else if (dto.typeComposant === client_1.TypeComposant.PIECE_DE_SECURITE) {
            const debut = new Date(dto.dateMiseEnService);
            if (debut.getTime() !== principal.dateAcquisition.getTime()) {
                throw new common_1.BadRequestException("Une pièce de sécurité s'amortit à compter de l'acquisition de l'immobilisation principale, qu'elle " +
                    `serve ou non (${sourceSecurite}) : sa date de début est le ` +
                    `${principal.dateAcquisition.toISOString().slice(0, 10)}. Une pièce dont l'amortissement ne commence ` +
                    "qu'à son intégration est une pièce de RECHANGE, pas une pièce de sécurité.");
            }
        }
    }
    async contrepartiesAcquisition(tenantId, cible, typeComposant = null, retenus = false) {
        const dossier = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { referentiel: true, systemeComptableSyscohada: true, jeuEtatsFinanciersSycebnl: true },
        });
        let numeroBien = null;
        if (cible.compteImmobilisationId) {
            const compte = await this.prisma.compte.findFirst({
                where: { id: cible.compteImmobilisationId, tenantId },
                select: { numero: true },
            });
            numeroBien = compte?.numero ?? null;
        }
        else if (cible.familleId) {
            const famille = await this.prisma.familleImmobilisation.findFirst({
                where: { id: cible.familleId, tenantId },
                select: { compteImmobilisation: { select: { numero: true } } },
            });
            numeroBien = famille?.compteImmobilisation.numero ?? null;
        }
        if (!dossier || !numeroBien)
            throw new common_1.BadRequestException('Compte du bien introuvable pour ce dossier');
        const racines = (0, contrepartie_acquisition_1.racinesContrepartieAcquisition)(dossier.referentiel, numeroBien, {
            typeComposant,
            systemeMinimal: (0, systeme_minimal_1.estSystemeMinimal)(dossier),
        });
        const comptes = await this.prisma.compte.findMany({
            where: {
                tenantId,
                typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                estActif: true,
                OR: racines.map((r) => ({ numero: { startsWith: r } })),
            },
            select: { id: true, numero: true, intitule: true, estRetenu: true },
            orderBy: { numero: 'asc' },
        });
        const servis = retenus ? (await (0, comptes_proposes_1.comptesProposes)(this.prisma, tenantId, comptes)).proposes : comptes;
        return servis.map(({ estRetenu: _retenu, ...c }) => {
            const mode = (0, compte_du_bien_1.modeDuCompteDeContrepartie)(dossier.referentiel, c.numero, racines);
            return { ...c, mode, libelleMode: mode ? compte_du_bien_1.LIBELLES_MODE_ACQUISITION[mode] : null };
        });
    }
    async comptesFondsProjet(tenantId, retenus = false) {
        const regime = await this.regimeComptable(tenantId);
        const projet = regime.referentiel === client_1.Referentiel.SYCEBNL && regime.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT;
        if (!projet) {
            return { projet, comptes: [], enSommeil: 0, nonRetenus: 0, motifVide: (0, comptes_du_bien_1.motifListeFondsProjetVide)({ projet, nombre: 0, inactifs: 0 }) };
        }
        const plan = await this.prisma.compte.findMany({
            where: {
                tenantId,
                typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                OR: comptes_du_bien_1.RACINES_FONDS_PROJET.map((r) => ({ numero: { startsWith: r } })),
            },
            select: { id: true, numero: true, intitule: true, estActif: true, estRetenu: true },
            orderBy: { numero: 'asc' },
        });
        const fonds = plan.filter((c) => (0, comptes_du_bien_1.estCompteFondsProjet)(c.numero));
        const actifs = fonds.filter((c) => c.estActif);
        const { proposes, ecartes } = retenus
            ? await (0, comptes_proposes_1.comptesProposes)(this.prisma, tenantId, actifs)
            : { proposes: actifs, ecartes: 0 };
        return {
            projet,
            comptes: proposes.map((c) => ({ id: c.id, numero: c.numero, intitule: c.intitule })),
            enSommeil: fonds.length - actifs.length,
            nonRetenus: ecartes,
            motifVide: (0, comptes_du_bien_1.motifListeFondsProjetVide)({
                projet,
                nombre: proposes.length,
                inactifs: fonds.length - actifs.length,
                nonRetenus: ecartes,
            }),
        };
    }
    async comptesDuBien(tenantId, retenus = false) {
        const [{ referentiel }, plan, divisions] = await Promise.all([
            this.regimeComptable(tenantId),
            this.prisma.compte.findMany({
                where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
                select: { id: true, numero: true, intitule: true, estRetenu: true },
                orderBy: { numero: 'asc' },
            }),
            this.prisma.compte.findMany({
                where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.TOTAL, numero: { in: ['20', '21', '22', '23', '24'] } },
                select: { numero: true, intitule: true },
            }),
        ]);
        const intituleDivision = new Map(divisions.map((d) => [d.numero, d.intitule]));
        const numeros = plan.map((c) => c.numero);
        const parNumero = new Map(plan.map((c) => [c.numero, { id: c.id, numero: c.numero, intitule: c.intitule }]));
        const deBien = plan.filter((c) => (0, compte_du_bien_1.estCompteDeBien)(referentiel, c.numero));
        const servis = retenus ? (await (0, comptes_proposes_1.comptesProposes)(this.prisma, tenantId, deBien)).proposes : deBien;
        return servis
            .map((c) => {
            const nonAmortissable = (0, comptes_du_bien_1.motifNonAmortissable)(c.numero, referentiel);
            const suivants = (0, compte_du_bien_1.comptesSuivantLeBien)(referentiel, c.numero, numeros, !!nonAmortissable);
            const ref = referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL';
            const enCours = (0, immobilisation_en_cours_1.comptesEnCoursDuBien)(ref, c.numero, plan);
            const sansEnCours = (0, immobilisation_en_cours_1.motifSansEnCours)(ref, c.numero) ??
                (enCours.length === 0 ? `Aucun compte en cours de la division ${c.numero.slice(0, 2)} au plan du dossier · ouvrez-le avant d'inscrire le bien en cours.` : null);
            return {
                id: c.id,
                numero: c.numero,
                intitule: c.intitule,
                compteAmortissement: suivants.amortissement ? (parNumero.get(suivants.amortissement) ?? null) : null,
                compteDotation: suivants.dotation ? (parNumero.get(suivants.dotation) ?? null) : null,
                motifComptes: suivants.motif,
                motifNonAmortissable: nonAmortissable,
                sectionsBareme: (0, compte_du_bien_1.sectionsBaremeDuCompte)(c.numero),
                naturesBareme: (0, bareme_comptes_1.naturesDuCompte)(referentiel, c.numero),
                locationAcquisition: (0, nomenclature_location_acquisition_1.estCompteDeLocationAcquisition)(c.numero),
                estCompteEnCours: (0, immobilisation_en_cours_1.estCompteEnCours)(c.numero),
                comptesEnCours: sansEnCours ? [] : enCours,
                compteEnCoursProposeId: sansEnCours ? null : ((0, immobilisation_en_cours_1.compteEnCoursPropose)(ref, c.numero, enCours)?.id ?? null),
                motifSansEnCours: sansEnCours,
                division: { numero: c.numero.slice(0, 2), intitule: intituleDivision.get(c.numero.slice(0, 2)) ?? null },
            };
        });
    }
    async famillePourCompte(tenantId, compteImmobilisationId, dureeAmortissementAns, modeAmortissement, sansDuree = false) {
        const existante = await this.prisma.familleImmobilisation.findFirst({
            where: { tenantId, compteImmobilisationId, estActif: true },
            orderBy: { createdAt: 'asc' },
        });
        if (existante)
            return existante;
        const compte = await this.prisma.compte.findFirst({
            where: { id: compteImmobilisationId, tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
            select: { id: true, numero: true, intitule: true },
        });
        if (!compte)
            throw new common_1.BadRequestException('Compte du bien introuvable pour ce dossier');
        const { referentiel } = await this.regimeComptable(tenantId);
        if (!(0, compte_du_bien_1.estCompteDeBien)(referentiel, compte.numero)) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} ne porte pas un bien · choisissez un compte des divisions ` +
                `${referentiel === client_1.Referentiel.SYCEBNL ? '20 à 24' : '21 à 24'}.`);
        }
        const plan = await this.prisma.compte.findMany({
            where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
            select: { id: true, numero: true },
        });
        const nonAmortissable = !!(0, comptes_du_bien_1.motifNonAmortissable)(compte.numero, referentiel);
        const suivants = (0, compte_du_bien_1.comptesSuivantLeBien)(referentiel, compte.numero, plan.map((c) => c.numero), nonAmortissable);
        if (suivants.motif || !suivants.amortissement || !suivants.dotation) {
            throw new common_1.BadRequestException(suivants.motif ?? `Comptes du bien ${compte.numero} introuvables`);
        }
        if (!nonAmortissable && !sansDuree && (dureeAmortissementAns == null || dureeAmortissementAns < 1)) {
            throw new common_1.BadRequestException("Indiquez la durée d'amortissement du bien, en années.");
        }
        const id28 = plan.find((c) => c.numero === suivants.amortissement).id;
        const id68 = plan.find((c) => c.numero === suivants.dotation).id;
        const pris = await this.prisma.familleImmobilisation.count({
            where: { tenantId, code: { startsWith: compte.numero } },
        });
        return this.prisma.familleImmobilisation.create({
            data: {
                tenantId,
                code: pris ? `${compte.numero}-${pris + 1}` : compte.numero,
                intitule: compte.intitule,
                compteImmobilisationId: compte.id,
                compteAmortissementId: id28,
                compteDotationId: id68,
                dureeAmortissementAns: dureeAmortissementAns ?? 1,
                modeAmortissement: modeAmortissement ?? client_1.ModeAmortissement.LINEAIRE,
            },
        });
    }
    async seuilPetitMateriel(tenantId, date) {
        const jour = new Date(date);
        if (Number.isNaN(jour.getTime()))
            throw new common_1.BadRequestException('Date illisible');
        if (date.slice(0, 10) < '2026-01-01') {
            return { seuil: null, cours: null, dateCours: null, motif: 'Arrêté n° 014/2025 en vigueur au 1er janvier 2026 (art. 3).' };
        }
        const usd = await this.prisma.devise.findFirst({ where: { tenantId, code: 'USD' }, select: { id: true } });
        const cours = usd
            ? await this.prisma.coursDevise.findFirst({
                where: { deviseId: usd.id, date: { lte: jour } },
                orderBy: { date: 'desc' },
                select: { cours: true, date: true },
            })
            : null;
        if (!cours) {
            return { seuil: null, cours: null, dateCours: null, motif: 'Aucun cours de l’USD saisi à cette date ou avant (fenêtre Devises).' };
        }
        const valeur = Number(cours.cours);
        return { seuil: Math.round(500 * valeur * 100) / 100, cours: valeur, dateCours: cours.date, motif: null };
    }
    async lireContratLocationAcquisition(tenantId, dto) {
        const [{ referentiel }, compteBien] = await Promise.all([
            this.regimeComptable(tenantId),
            this.prisma.compte.findFirst({
                where: { id: dto.compteImmobilisationId, tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
                select: { id: true, numero: true },
            }),
        ]);
        if (!compteBien)
            throw new common_1.BadRequestException('Compte du bien introuvable pour ce dossier');
        const refusCompte = (0, nomenclature_location_acquisition_1.motifRefusNatureEtCompte)(referentiel, dto.nature, compteBien.numero);
        if (refusCompte)
            throw new common_1.BadRequestException(refusCompte);
        const contrat = {
            nature: dto.nature,
            datePriseEffet: new Date(dto.datePriseEffet),
            dureeMois: dto.dureeMois,
            periodicite: dto.periodicite,
            termeAEchoir: dto.termeAEchoir,
            loyer: dto.loyer,
            prixOption: dto.prixOption,
            optionRaisonnablementCertaine: dto.optionRaisonnablementCertaine,
            bienDeFaibleValeur: dto.bienDeFaibleValeur,
            tauxAnnuel: dto.tauxAnnuel ?? null,
            valeurContrat: dto.valeurContrat ?? null,
            garantieValeurResiduelle: dto.garantieValeurResiduelle ?? 0,
            loyerIndexe: !!dto.loyerIndexe,
            indiceLoyer: dto.indiceLoyer?.trim() || null,
            valeurIndiceCommencement: dto.valeurIndiceCommencement ?? null,
        };
        const refusContrat = (0, echeancier_location_acquisition_1.motifRefusContrat)(contrat);
        if (refusContrat)
            throw new common_1.BadRequestException(refusContrat);
        let echeancier;
        try {
            echeancier = (0, echeancier_location_acquisition_1.construireEcheancier)(contrat);
        }
        catch (err) {
            throw new common_1.BadRequestException(err.message);
        }
        const comptes = nomenclature_location_acquisition_1.COMPTES_LOCATION_ACQUISITION[referentiel][dto.nature];
        return { referentiel, compteBien, contrat, echeancier, comptes };
    }
    async simulerLocationAcquisition(tenantId, dto) {
        const { echeancier, comptes } = await this.lireContratLocationAcquisition(tenantId, dto);
        return { ...echeancier, comptes };
    }
    async creerEnLocationAcquisition(tenantId, userId, dto) {
        const { referentiel, compteBien, echeancier, comptes } = await this.lireContratLocationAcquisition(tenantId, dto);
        const compteDette = await this.prisma.compte.findFirst({
            where: { tenantId, numero: comptes.dette, estActif: true },
            select: { id: true },
        });
        if (!compteDette) {
            throw new common_1.BadRequestException(`Compte de dette ${comptes.dette} absent du plan du dossier · ouvrez-le avant l'entrée du bien.`);
        }
        if (dto.bailleurTiersId) {
            const bailleur = await this.prisma.tiers.findFirst({ where: { id: dto.bailleurTiersId, tenantId }, select: { id: true } });
            if (!bailleur)
                throw new common_1.BadRequestException('Bailleur introuvable pour ce dossier');
        }
        const coutsDirects = dto.coutsDirects ?? 0;
        const avantagesRecus = dto.avantagesRecus ?? 0;
        const netCouts = Math.round((coutsDirects - avantagesRecus) * 100) / 100;
        const lignesCredit = [{ compteId: compteDette.id, montant: echeancier.dette }];
        if (Math.abs(netCouts) > EPSILON) {
            if (!dto.compteContrepartieCoutsId) {
                throw new common_1.BadRequestException('Indiquez la contrepartie des coûts directs et des avantages reçus (trésorerie ou fournisseur d’investissement).');
            }
            const contrepartie = await this.prisma.compte.findFirst({
                where: { id: dto.compteContrepartieCoutsId, tenantId },
                select: { id: true, numero: true },
            });
            if (!contrepartie)
                throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce dossier');
            const motif = (0, contrepartie_acquisition_1.motifRefusContrepartie)(referentiel, compteBien.numero, contrepartie.numero, { typeComposant: null });
            if (motif)
                throw new common_1.BadRequestException(motif);
            lignesCredit.push({ compteId: contrepartie.id, montant: netCouts });
        }
        const valeurOrigine = Math.round((echeancier.dette + netCouts) * 100) / 100;
        if (!(valeurOrigine > 0)) {
            throw new common_1.BadRequestException('Les avantages reçus dépassent la dette et les coûts directs · le bien n’aurait aucune valeur (§ 2.1.5).');
        }
        const bien = await this.creer(tenantId, userId, {
            compteImmobilisationId: compteBien.id,
            designation: dto.designation,
            numeroInventaire: dto.numeroInventaire,
            lieuId: dto.lieuId,
            natureFiscaleCle: dto.natureFiscaleCle ?? null,
            dateAcquisition: dto.datePriseEffet,
            dateMiseEnService: dto.datePriseEffet,
            valeurOrigine,
            dureeAmortissementAns: dto.dureeAmortissementAns,
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
        }, { lignesCredit });
        try {
            await this.prisma.contratLocationAcquisition.create({
                data: {
                    tenantId,
                    immobilisationId: bien.id,
                    bailleurTiersId: dto.bailleurTiersId ?? null,
                    reference: dto.reference.trim() || null,
                    nature: dto.nature,
                    dateConclusion: new Date(dto.dateConclusion),
                    datePriseEffet: new Date(dto.datePriseEffet),
                    dureeMois: dto.dureeMois,
                    periodicite: dto.periodicite,
                    termeAEchoir: dto.termeAEchoir,
                    loyer: dto.loyer,
                    prixOption: dto.prixOption,
                    tauxAnnuel: dto.tauxAnnuel ?? null,
                    valeurContrat: dto.valeurContrat ?? null,
                    tauxPeriodique: echeancier.tauxPeriodique,
                    dette: echeancier.dette,
                    garantieValeurResiduelle: dto.garantieValeurResiduelle ?? 0,
                    loyerIndexe: !!dto.loyerIndexe,
                    indiceLoyer: dto.loyerIndexe ? dto.indiceLoyer?.trim() || null : null,
                    valeurIndiceCommencement: dto.loyerIndexe ? (dto.valeurIndiceCommencement ?? null) : null,
                    coutsDirects,
                    avantagesRecus,
                    optionRaisonnablementCertaine: dto.optionRaisonnablementCertaine,
                    bienDeFaibleValeur: dto.bienDeFaibleValeur,
                    createdBy: userId,
                },
            });
        }
        catch (err) {
            const cree = await this.prisma.immobilisation.findFirst({
                where: { id: bien.id, tenantId },
                select: { ecritureAcquisitionId: true },
            });
            await this.prisma.immobilisation.delete({ where: { id: bien.id } });
            if (cree?.ecritureAcquisitionId)
                await this.annulerEcritureOrpheline(cree.ecritureAcquisitionId);
            throw err;
        }
        return { immobilisation: bien, echeancier, comptes };
    }
    async dureeIncorporel(tenantId, dto) {
        const aucun = { dureeNonLimitee: false, justification: null, fondementDureeDixAns: null };
        if (!dto.compteImmobilisationId) {
            if (dto.dureeNonLimitee || dto.fondementDureeDixAns) {
                throw new common_1.BadRequestException("La durée d'un incorporel se déclare avec le compte du bien.");
            }
            return aucun;
        }
        const [regime, compte] = await Promise.all([
            this.regimeComptable(tenantId),
            this.prisma.compte.findFirst({ where: { id: dto.compteImmobilisationId, tenantId }, select: { numero: true } }),
        ]);
        if (!compte)
            return aucun;
        const referentiel = regime.referentiel;
        if (dto.fondementDureeDixAns) {
            if (dto.dureeNonLimitee)
                throw new common_1.BadRequestException("Un fonds commercial amorti dix ans n'a pas une durée non limitée.");
            const refus = (referentiel !== 'SYSCOHADA' ? 'Les dix ans du fonds commercial viennent du Titre VIII de l\'AUDCIF · SYSCOHADA seul.' : null) ??
                (0, incorporel_duree_non_limitee_1.motifRefusDureeDixAns)({
                    numeroCompte: compte.numero,
                    fondement: dto.fondementDureeDixAns,
                    dureeAns: dto.dureeAmortissementAns,
                    systemeMinimal: regime.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE,
                });
            if (refus)
                throw new common_1.BadRequestException(refus);
            return { ...aucun, fondementDureeDixAns: dto.fondementDureeDixAns };
        }
        const presume = !dto.dureeNonLimitee && referentiel === 'SYSCOHADA' && (0, incorporel_duree_non_limitee_1.estFondsCommercial)(compte.numero) && dto.dureeAmortissementAns == null;
        if (!dto.dureeNonLimitee && !presume)
            return aucun;
        const refus = (0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({
            referentiel,
            numeroCompte: compte.numero,
            justification: dto.justificationDureeNonLimitee,
            nomDeDomaine: dto.nomDeDomaine,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const justification = dto.justificationDureeNonLimitee?.trim() ||
            ((0, incorporel_duree_non_limitee_1.estFondsCommercial)(compte.numero) ? incorporel_duree_non_limitee_1.JUSTIFICATION_PRESUMEE_FONDS_COMMERCIAL : 'Nom de domaine · usage non limité dans le temps (AUDCIF Titre VIII ch. 2 § 3.2.2 c).');
        return { ...aucun, dureeNonLimitee: true, justification: justification.slice(0, 1000) };
    }
    async creer(tenantId, userId, dto, interne = {}) {
        const { famille, dateAcquisition, dateMiseEnService, compteEnCours, natureFiscaleCle, mode, principal, dureeIncorporel, reserveDePropriete, criteresRd, dateReunionCriteres, } = await this.preparerFiche(tenantId, dto, interne);
        const ecritureAcquisition = dto.repris || interne.ecritureExistante
            ? null
            : await this.ecritureService.creer(tenantId, userId, {
                exerciceId: dto.exerciceId,
                journalId: dto.journalId,
                date: dto.dateAcquisition,
                libelle: (interne.libelle ?? `Acquisition · ${dto.designation}`).slice(0, 190),
                lignes: [
                    { compteId: compteEnCours?.id ?? famille.compteImmobilisationId, debit: dto.valeurOrigine, credit: 0 },
                    ...(interne.lignesCredit
                        ? interne.lignesCredit
                            .filter((l) => Math.abs(l.montant) > EPSILON)
                            .map((l) => l.montant > 0
                            ? { compteId: l.compteId, debit: 0, credit: l.montant }
                            : { compteId: l.compteId, debit: -l.montant, credit: 0 })
                        : [{ compteId: dto.compteContrepartieId, debit: 0, credit: dto.valeurOrigine }]),
                ],
            });
        let immobilisation;
        try {
            immobilisation = await this.prisma.immobilisation.create({
                data: {
                    tenantId,
                    familleId: famille.id,
                    designation: dto.designation,
                    numeroInventaire: dto.numeroInventaire,
                    lieuId: dto.lieuId ?? null,
                    compteImmobilisationId: famille.compteImmobilisationId,
                    compteAmortissementId: famille.compteAmortissementId,
                    compteDotationId: famille.compteDotationId,
                    compteEnCoursId: compteEnCours?.id ?? null,
                    dateAcquisition,
                    dateMiseEnService,
                    natureFiscaleCle,
                    valeurOrigine: dto.valeurOrigine,
                    valeurResiduelle: dto.valeurResiduelle ?? 0,
                    dureeAmortissementAns: dto.dureeAmortissementAns ?? famille.dureeAmortissementAns,
                    amortissementAnterieur: dto.amortissementAnterieur ?? 0,
                    modeAmortissement: mode,
                    unitesOeuvrePrevues: mode === client_1.ModeAmortissement.UNITES_DOEUVRE ? dto.unitesOeuvrePrevues : null,
                    uniteOeuvreLibelle: mode === client_1.ModeAmortissement.UNITES_DOEUVRE ? (dto.uniteOeuvreLibelle?.trim() ?? null) : null,
                    ecritureAcquisitionId: interne.ecritureExistante?.ecritureId ?? ecritureAcquisition?.id ?? null,
                    ligneAcquisitionId: interne.ecritureExistante?.ligneId ?? null,
                    createdBy: userId,
                    immobilisationPrincipaleId: principal?.id ?? null,
                    typeComposant: principal ? (dto.typeComposant ?? client_1.TypeComposant.COMPOSANT) : null,
                    justificationDecomposition: principal ? (dto.justificationDecomposition ?? null) : null,
                    composantRemplaceId: interne.composantRemplaceId ?? null,
                    modaliteVentilation: interne.modaliteVentilation?.slice(0, 1000) ?? null,
                    dureeNonLimitee: dureeIncorporel.dureeNonLimitee,
                    justificationDureeNonLimitee: dureeIncorporel.justification,
                    fondementDureeDixAns: dureeIncorporel.fondementDureeDixAns,
                    reserveDePropriete,
                    ...(interne.acquisitionAleatoire
                        ? {
                            natureAcquisitionAleatoire: interne.acquisitionAleatoire.nature,
                            fondementValeurAleatoire: interne.acquisitionAleatoire.fondement,
                            sourceValeurAleatoire: interne.acquisitionAleatoire.source.slice(0, 1000),
                            detteAleatoireInitiale: interne.acquisitionAleatoire.detteInitiale,
                        }
                        : {}),
                    criteresFraisDeveloppement: criteresRd ?? undefined,
                    dateReunionCriteresDeveloppement: criteresRd ? dateReunionCriteres : null,
                    coutFuturDemantelement: dto.coutFuturDemantelement ?? null,
                    tauxActualisationDemantelementPourcent: dto.tauxActualisationDemantelementPourcent ?? null,
                },
                include: { dotations: true },
            });
        }
        catch (err) {
            if (ecritureAcquisition)
                await this.annulerEcritureOrpheline(ecritureAcquisition.id);
            throw err;
        }
        return versImmobilisation(immobilisation);
    }
    async preparerFiche(tenantId, dto, interne = {}) {
        if (!!dto.familleId === !!dto.compteImmobilisationId) {
            throw new common_1.BadRequestException('Indiquez le compte du bien.');
        }
        const dureeIncorporel = await this.dureeIncorporel(tenantId, dto);
        const famille = dto.familleId
            ? await this.prisma.familleImmobilisation.findFirst({ where: { id: dto.familleId, tenantId } })
            : await this.famillePourCompte(tenantId, dto.compteImmobilisationId, dto.dureeAmortissementAns, dto.modeAmortissement, dureeIncorporel.dureeNonLimitee);
        if (!famille)
            throw new common_1.BadRequestException('Famille introuvable pour ce tenant');
        if (!famille.estActif) {
            throw new common_1.BadRequestException(`La famille « ${famille.intitule} » est en sommeil · elle ne reçoit plus de bien. Réactivez-la, ou choisissez une autre famille.`);
        }
        const dateAcquisition = new Date(dto.dateAcquisition);
        const dateMiseEnService = dto.dateMiseEnService ? new Date(dto.dateMiseEnService) : null;
        if (dateMiseEnService && dateMiseEnService < dateAcquisition) {
            throw new common_1.BadRequestException("La date de mise en service ne peut pas précéder la date d'acquisition");
        }
        if (!dateMiseEnService && (dto.amortissementAnterieur ?? 0) > EPSILON) {
            throw new common_1.BadRequestException("Un bien déjà amorti a été mis en service · indiquez sa date de mise en service avec l'amortissement déjà pratiqué.");
        }
        let compteEnCours = null;
        if (dto.compteEnCoursId) {
            if (dateMiseEnService) {
                throw new common_1.BadRequestException("Un bien inscrit en cours n'est pas encore mis en service · laissez la date vide, elle se pose à l'achèvement.");
            }
            if (interne.lignesCredit) {
                throw new common_1.BadRequestException('Un bien pris en location-acquisition ne s’inscrit pas en cours.');
            }
            const [regimeEnCours, definitif, enCours] = await Promise.all([
                this.regimeComptable(tenantId),
                this.prisma.compte.findFirst({ where: { id: famille.compteImmobilisationId, tenantId }, select: { numero: true } }),
                this.prisma.compte.findFirst({
                    where: { id: dto.compteEnCoursId, tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
                    select: { id: true, numero: true },
                }),
            ]);
            if (!definitif)
                throw new common_1.BadRequestException('Compte du bien introuvable pour ce dossier');
            if (!enCours)
                throw new common_1.BadRequestException('Compte en cours introuvable pour ce dossier');
            const refusEnCours = (0, immobilisation_en_cours_1.motifRefusCompteEnCours)(regimeEnCours.referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL', definitif.numero, enCours.numero);
            if (refusEnCours)
                throw new common_1.BadRequestException(refusEnCours);
            compteEnCours = enCours;
        }
        const natureFiscaleCle = dto.natureFiscaleCle?.trim() || null;
        if (natureFiscaleCle && !(0, bareme_fiscal_2.natureDuBareme)(natureFiscaleCle)) {
            throw new common_1.BadRequestException(`Nature « ${natureFiscaleCle} » absente du barème de l'arrêté n° 013/CAB/MIN/FINANCES/2025 (art. 2).`);
        }
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: dto.exerciceId, tenantId },
            select: { dateDebut: true },
        });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        const ouverture = exercice.dateDebut.toISOString().slice(0, 10);
        const acquisAvantOuverture = dateAcquisition < exercice.dateDebut;
        let numeroContrepartie = null;
        if (dto.repris) {
            if (!acquisAvantOuverture) {
                throw new common_1.BadRequestException(`Un bien repris est un bien déjà porté au bilan d'ouverture, donc acquis avant le ${ouverture}. ` +
                    "Un bien acquis dans l'exercice s'enregistre avec son écriture d'acquisition.");
            }
        }
        else {
            if (acquisAvantOuverture) {
                throw new common_1.BadRequestException(`Acquis le ${dto.dateAcquisition.slice(0, 10)}, avant l'ouverture de l'exercice (${ouverture}). ` +
                    "Choisissez l'exercice de l'acquisition, ou, si le bien est déjà au bilan d'ouverture, déclarez-le " +
                    "« bien repris » · une écriture d'acquisition doublerait sa valeur brute au bilan.");
            }
            if ((dto.amortissementAnterieur ?? 0) > EPSILON) {
                throw new common_1.BadRequestException("Un amortissement déjà pratiqué ne vaut que pour un bien repris, déjà au bilan d'ouverture. Un bien " +
                    "acquis dans l'exercice n'a encore été amorti nulle part.");
            }
            if (interne.lignesCredit || interne.ecritureExistante) {
                if (!dto.journalId)
                    throw new common_1.BadRequestException("Indiquez le journal de l'écriture d'entrée du bien.");
            }
            else if (!dto.compteContrepartieId || !dto.journalId) {
                throw new common_1.BadRequestException("Indiquez le financement (compte de contrepartie) et le journal de l'écriture d'acquisition.");
            }
            if (!interne.lignesCredit && !interne.ecritureExistante) {
                const compteContrepartie = await this.prisma.compte.findFirst({
                    where: { id: dto.compteContrepartieId, tenantId },
                });
                if (!compteContrepartie)
                    throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce tenant');
                numeroContrepartie = compteContrepartie.numero;
                const [dossier, compteImmo] = await Promise.all([
                    this.regimeComptable(tenantId),
                    this.prisma.compte.findFirst({ where: { id: famille.compteImmobilisationId, tenantId }, select: { numero: true } }),
                ]);
                if (!compteImmo)
                    throw new common_1.BadRequestException("Compte d'immobilisation de la famille introuvable pour ce tenant");
                if (compteContrepartie.numero.startsWith('1984')) {
                    const refusSmt = (0, systeme_minimal_1.motifRefusProvisionSmt)(dossier);
                    if (refusSmt)
                        throw new common_1.BadRequestException(refusSmt);
                }
                const motif = (0, contrepartie_acquisition_1.motifRefusContrepartie)(dossier.referentiel, compteImmo.numero, compteContrepartie.numero, {
                    typeComposant: dto.immobilisationPrincipaleId ? (dto.typeComposant ?? client_1.TypeComposant.COMPOSANT) : null,
                    systemeMinimal: (0, systeme_minimal_1.estSystemeMinimal)(dossier),
                });
                if (motif)
                    throw new common_1.BadRequestException(motif);
                if (compteEnCours && (0, immobilisation_en_cours_1.estCompteEnCours)(compteContrepartie.numero)) {
                    throw new common_1.BadRequestException(`Le compte ${compteContrepartie.numero} est un compte en cours · un bien inscrit en cours ne se finance pas par un autre en-cours.`);
                }
            }
        }
        let principal = null;
        if (dto.immobilisationPrincipaleId) {
            principal = await this.prisma.immobilisation.findFirst({
                where: { id: dto.immobilisationPrincipaleId, tenantId },
                select: {
                    id: true,
                    dateAcquisition: true,
                    dureeAmortissementAns: true,
                    compteImmobilisation: { select: { numero: true, intitule: true } },
                },
            });
            if (!principal)
                throw new common_1.BadRequestException('Immobilisation principale introuvable pour ce tenant');
            const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { referentiel: true },
            });
            this.verifierDecomposition(principal, referentiel);
            this.verifierComposant({ ...dto, dureeAmortissementAns: dto.dureeAmortissementAns ?? famille.dureeAmortissementAns }, principal, !!interne.composantRemplaceId, referentiel);
            if (!dto.justificationDecomposition?.trim()) {
                throw new common_1.BadRequestException('Indiquez pourquoi ce bien est décomposable : durées d’utilité distinctes, caractère significatif du ' +
                    'coût, informations disponibles sur la durée de chaque élément. Les deux textes posent ces conditions ' +
                    'et aucun logiciel ne peut les vérifier à votre place.');
            }
        }
        else if (dto.typeComposant || dto.justificationDecomposition) {
            throw new common_1.BadRequestException('Un composant se rattache à une immobilisation principale · indiquez-la, ou laissez ces champs vides pour ' +
                'créer une immobilisation ordinaire.');
        }
        const baseAmortissable = this.baseAmortissable(dto.valeurOrigine, dto.valeurResiduelle ?? 0);
        if ((dto.amortissementAnterieur ?? 0) - baseAmortissable > EPSILON) {
            throw new common_1.BadRequestException(`L'amortissement antérieur (${(dto.amortissementAnterieur ?? 0).toFixed(2)}) dépasse la base ` +
                `amortissable du bien (${baseAmortissable.toFixed(2)}, soit la valeur d'origine diminuée de la valeur ` +
                'résiduelle) : un bien ne peut pas être amorti au-delà de ce qu’il y a à amortir.');
        }
        const mode = dto.modeAmortissement ?? famille.modeAmortissement ?? client_1.ModeAmortissement.LINEAIRE;
        const refus = ImmobilisationService_1.motifRefusUnitesOeuvre(mode, dto.unitesOeuvrePrevues, dto.uniteOeuvreLibelle);
        if (refus)
            throw new common_1.BadRequestException(refus);
        if (mode === client_1.ModeAmortissement.UNITES_DOEUVRE) {
            const regimeUo = await this.regimeComptable(tenantId);
            const refusSmt = (0, systeme_minimal_1.motifRefusAmortissementNonLineaireSmt)(regimeUo, "L'amortissement aux unités d'œuvre");
            if (refusSmt)
                throw new common_1.BadRequestException(refusSmt);
            const compteUo = await this.prisma.compte.findFirst({
                where: { id: famille.compteImmobilisationId, tenantId },
                select: { numero: true },
            });
            if (regimeUo.referentiel === client_1.Referentiel.SYCEBNL && compteUo?.numero.startsWith('2011')) {
                throw new common_1.BadRequestException("L'usufruit temporaire s'amortit sur la durée de la donation suivant le mode linéaire (SYCEBNL Partie 3 ch. 2 § 2.3) · les unités d'œuvre ne lui sont pas ouvertes.");
            }
        }
        if (mode === client_1.ModeAmortissement.DEGRESSIF) {
            const [regimeDeg, compteDeg] = await Promise.all([
                this.regimeComptable(tenantId),
                this.prisma.compte.findFirst({ where: { id: famille.compteImmobilisationId, tenantId }, select: { numero: true } }),
            ]);
            const refusDeg = (0, revision_plan_amortissement_1.motifRefusModeDegressif)({
                referentiel: regimeDeg.referentiel,
                numeroCompte: compteDeg?.numero ?? '',
                dureeAns: dto.dureeAmortissementAns ?? famille.dureeAmortissementAns,
            });
            if (refusDeg)
                throw new common_1.BadRequestException(refusDeg);
        }
        if (dto.lieuId)
            await this.lieuDuDossier(tenantId, dto.lieuId);
        const reserveDePropriete = dto.reserveDePropriete ?? (0, reserve_propriete_1.contrepartieAReserveDePropriete)(numeroContrepartie);
        const refusReserve = (0, reserve_propriete_1.motifRefusReserveDePropriete)({
            reserveDePropriete,
            leveeLe: null,
            dateAcquisition,
            numeroContrepartie,
        });
        if (refusReserve)
            throw new common_1.BadRequestException(refusReserve);
        const [regimeRd, compteRd] = await Promise.all([
            this.regimeComptable(tenantId),
            this.prisma.compte.findFirst({ where: { id: famille.compteImmobilisationId, tenantId }, select: { numero: true } }),
        ]);
        const dateReunionCriteres = dto.dateReunionCriteresDeveloppement ? new Date(dto.dateReunionCriteresDeveloppement) : null;
        const refusRd = (0, frais_developpement_1.motifRefusFraisDeveloppement)({
            referentiel: regimeRd.referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL',
            numeroCompte: compteRd?.numero ?? '',
            repris: !!dto.repris,
            criteres: dto.criteresFraisDeveloppement,
            dateReunion: dateReunionCriteres,
            dateInscription: dateAcquisition,
        });
        if (refusRd)
            throw new common_1.BadRequestException(refusRd);
        const criteresRd = (0, frais_developpement_1.criteresRetenus)(dto.criteresFraisDeveloppement);
        if (dto.coutFuturDemantelement != null || dto.tauxActualisationDemantelementPourcent != null) {
            const refusSmt = (0, systeme_minimal_1.motifRefusProvisionSmt)(regimeRd);
            if (refusSmt)
                throw new common_1.BadRequestException(refusSmt);
        }
        const parametresDemantelement = (0, demantelement_1.motifRefusParametresDemantelement)({
            estComposantDemantelement: !!principal && (dto.typeComposant ?? client_1.TypeComposant.COMPOSANT) === client_1.TypeComposant.DEMANTELEMENT,
            coutFutur: dto.coutFuturDemantelement ?? null,
            tauxPourcent: dto.tauxActualisationDemantelementPourcent ?? null,
            valeurOrigine: dto.valeurOrigine,
        });
        if (parametresDemantelement)
            throw new common_1.BadRequestException(parametresDemantelement);
        return {
            famille,
            dateAcquisition,
            dateMiseEnService,
            compteEnCours,
            natureFiscaleCle,
            mode,
            principal,
            dureeIncorporel,
            reserveDePropriete,
            criteresRd,
            dateReunionCriteres,
            numeroContrepartie,
        };
    }
    static reconstitutionRevisionMajeure(entree) {
        const { coutRevisionActuel, intervalleRevisionsAns } = entree;
        if (coutRevisionActuel <= 0 || intervalleRevisionsAns <= 0) {
            return {
                possible: false,
                motif: "La reconstitution demande le COÛT DE RÉVISION ACTUEL et l'INTERVALLE entre deux révisions · " +
                    "l'AUDCIF (Titre VIII ch. 5 § 1) estime la valeur nette « par référence au coût de révision actuel " +
                    'amorti », et l’amortissement d’un composant « révisions majeures » court sur la durée qui sépare ' +
                    'deux révisions. Aucun des deux ne se déduit d’une comptabilité.',
            };
        }
        const depart = entree.derniereRevisionRealiseeLe ?? entree.dateAcquisition;
        const MS_PAR_AN = 365.25 * 24 * 3600 * 1000;
        const anneesEcoulees = Math.max(0, (entree.dateReconstitution.getTime() - depart.getTime()) / MS_PAR_AN);
        if (anneesEcoulees >= intervalleRevisionsAns) {
            return {
                possible: false,
                motif: `Plus d'un intervalle s'est écoulé depuis le ${depart.toISOString().slice(0, 10)} ` +
                    `(${anneesEcoulees.toFixed(1)} ans pour un intervalle de ${intervalleRevisionsAns} ans). ` +
                    "L'estimation du ch. 5 § 1 se place AVANT toute révision · « comme si cette révision avait été " +
                    "réalisée à la date d'acquisition ». Au-delà, une révision a normalement eu lieu, et son coût réel " +
                    'est connu : indiquez la date de la dernière révision réalisée. À défaut, la valeur nette estimée ' +
                    "serait négative, et la prolonger par un modulo donnerait un chiffre plausible pour une révision dont " +
                    'personne ne sait si elle a eu lieu.',
            };
        }
        const amortissementEstime = coutRevisionActuel * (anneesEcoulees / intervalleRevisionsAns);
        return {
            possible: true,
            anneesEcoulees: Math.round(anneesEcoulees * 100) / 100,
            amortissementEstime: Math.round(amortissementEstime * 100) / 100,
            valeurNetteEstimee: Math.round((coutRevisionActuel - amortissementEstime) * 100) / 100,
        };
    }
    static motifRefusUnitesOeuvre(mode, unitesOeuvrePrevues, uniteOeuvreLibelle) {
        if (mode === client_1.ModeAmortissement.UNITES_DOEUVRE) {
            if (!unitesOeuvrePrevues || unitesOeuvrePrevues <= 0) {
                return ("Le mode aux unités d'œuvre exige le TOTAL D'UNITÉS PRÉVUES · c'est le dénominateur de la formule de " +
                    "l'AUDCIF (« AD = base amortissable × unités consommées / total d'unités prévues »), et le glossaire " +
                    "précise qu'il « est déterminé en fonction de la durée d'utilité de l'immobilisation ».");
            }
            if (!uniteOeuvreLibelle?.trim()) {
                return ("Nommer l'unité d'œuvre · kilomètres, heures de fonctionnement, pièces produites. Un total sans unité " +
                    'ne se vérifie pas, et le réviseur ne saura pas ce que compte le relevé.');
            }
            return null;
        }
        if (unitesOeuvrePrevues || uniteOeuvreLibelle?.trim()) {
            return ("Les unités d'œuvre ne se renseignent qu'avec le mode d'amortissement correspondant · les laisser sur un " +
                'plan linéaire ferait croire à un suivi qui ne sert à rien.');
        }
        return null;
    }
    static dotationUnitesOeuvre(baseAmortissable, consommees, prevues) {
        if (prevues <= 0 || consommees <= 0)
            return 0;
        return baseAmortissable * (consommees / prevues);
    }
    calculerDotation(valeurOrigine, valeurResiduelle, dureeAns, dateMiseEnService, dotationsAnterieures, exercice, amortissementAnterieur = 0, cumulDepreciation = 0, sansProrata = false, uniteOeuvre = null, plan = {}) {
        if (!dateMiseEnService)
            return 0;
        const base = this.baseAmortissable(valeurOrigine, valeurResiduelle);
        const cumulAnterieur = dotationsAnterieures.reduce((s, d) => s + d.montant, 0) + amortissementAnterieur;
        const reliquat = Math.max(0, base - cumulAnterieur - Math.max(0, cumulDepreciation));
        if (reliquat <= EPSILON)
            return 0;
        if (uniteOeuvre) {
            const denominateur = cumulDepreciation > EPSILON
                ? Math.max(0, uniteOeuvre.prevues - Math.max(0, uniteOeuvre.consommeesAnterieures))
                : uniteOeuvre.prevues;
            const numerateurBase = cumulDepreciation > EPSILON ? reliquat : base;
            return Math.min(ImmobilisationService_1.dotationUnitesOeuvre(numerateurBase, uniteOeuvre.consommees, denominateur), reliquat);
        }
        const revisionActive = !!plan.revision && exercice.dateDebut >= plan.revision.effet;
        const anneesRestantes = revisionActive
            ? plan.revision.dureeResiduelleAns - this.anneesEcoulees(plan.revision.effet, exercice.dateDebut)
            : dureeAns - this.anneesEcoulees(dateMiseEnService, exercice.dateDebut);
        let annuitePleine;
        const tauxDegressif = plan.degressif ? (0, revision_plan_amortissement_1.tauxDegressifLoi)(dureeAns) : null;
        if (tauxDegressif !== null) {
            const debutRestantes = revisionActive ? plan.revision.effet : dateMiseEnService;
            const dureeRestantes = revisionActive ? plan.revision.dureeResiduelleAns : dureeAns;
            const premierMois = new Date(Date.UTC(debutRestantes.getUTCFullYear(), debutRestantes.getUTCMonth(), 1));
            const ecoules = Math.max(0, (0, mois_entre_1.moisEntre)(premierMois, exercice.dateDebut) - 1) / 12;
            annuitePleine = (0, revision_plan_amortissement_1.annuiteDegressive)(reliquat, tauxDegressif, dureeRestantes - ecoules);
        }
        else if (cumulDepreciation > EPSILON || revisionActive) {
            annuitePleine = reliquat / Math.max(1, anneesRestantes);
        }
        else {
            annuitePleine = base / dureeAns;
        }
        const premiereAnnuite = dotationsAnterieures.length === 0 && amortissementAnterieur <= EPSILON;
        let montant;
        if (premiereAnnuite) {
            const premierJourMoisMES = new Date(Date.UTC(dateMiseEnService.getUTCFullYear(), dateMiseEnService.getUTCMonth(), 1));
            const debutProrata = premierJourMoisMES < exercice.dateDebut ? exercice.dateDebut : premierJourMoisMES;
            const mois = Math.max(0, (0, mois_entre_1.moisEntre)(debutProrata, exercice.dateFin));
            montant = mois <= 0 ? 0 : sansProrata ? annuitePleine : annuitePleine * (mois / 12);
        }
        else {
            const moisPeriode = Math.max(0, (0, mois_entre_1.moisEntre)(exercice.dateDebut, exercice.dateFin));
            montant = sansProrata ? annuitePleine : annuitePleine * (moisPeriode / 12);
        }
        return Math.min(montant, reliquat);
    }
    async tableauImmobilisations(tenantId, params = {}) {
        const arret = params.dateArret ? new Date(params.dateArret) : null;
        const immos = await this.prisma.immobilisation.findMany({
            where: {
                tenantId,
                ...(arret ? { dateAcquisition: { lte: arret } } : {}),
            },
            include: {
                compteImmobilisation: { select: { id: true, numero: true, intitule: true } },
                compteEnCours: { select: { id: true, numero: true, intitule: true } },
                dotations: {
                    select: { montant: true, exercice: { select: { dateFin: true } } },
                },
                depreciations: {
                    select: { sens: true, montant: true, exercice: { select: { dateFin: true } } },
                },
            },
            orderBy: [{ compteImmobilisation: { numero: 'asc' } }, { dateAcquisition: 'asc' }],
        });
        const arrondir = (x) => Math.round(x * 100) / 100;
        const groupes = new Map();
        const sortis = [];
        for (const immo of immos) {
            const cumulDotations = immo.dotations
                .filter((d) => !arret || d.exercice.dateFin <= arret)
                .reduce((t, d) => t + Number(d.montant), 0);
            const amortissements = arrondir(cumulDotations + (0, partie_remplacee_1.amortissementsHorsDotations)(immo));
            const depreciations = arrondir(this.cumulDepreciation(immo.depreciations
                .filter((d) => !arret || d.exercice.dateFin <= arret)
                .map((d) => ({ sens: d.sens, montant: Number(d.montant) }))));
            const brut = Number(immo.valeurOrigine);
            const inscrit = (0, immobilisation_en_cours_1.compteInscritChargeALaDate)(immo, arret ?? new Date());
            const cle = inscrit.id;
            const groupe = groupes.get(cle) ??
                {
                    numero: inscrit.numero,
                    intitule: inscrit.intitule,
                    lignes: [],
                    brut: 0,
                    amortissements: 0,
                    depreciations: 0,
                    net: 0,
                };
            const net = arrondir(brut - amortissements - depreciations);
            const ligne = {
                id: immo.id,
                designation: immo.designation,
                numeroInventaire: immo.numeroInventaire ?? '',
                dateAcquisition: immo.dateAcquisition.toISOString().slice(0, 10),
                dureeAns: immo.dureeAmortissementAns,
                valeurBrute: brut,
                amortissements,
                depreciations,
                valeurNette: net,
                statut: immo.statut,
                dateSortie: immo.dateSortie ? immo.dateSortie.toISOString().slice(0, 10) : null,
            };
            if (immo.dateSortie && (!arret || immo.dateSortie <= arret)) {
                sortis.push({ ...ligne, compte: inscrit.numero });
                continue;
            }
            groupe.lignes.push(ligne);
            groupe.brut = arrondir(groupe.brut + brut);
            groupe.amortissements = arrondir(groupe.amortissements + amortissements);
            groupe.depreciations = arrondir(groupe.depreciations + depreciations);
            groupe.net = arrondir(groupe.net + net);
            groupes.set(cle, groupe);
        }
        const listeGroupes = [...groupes.values()].sort((a, b) => a.numero.localeCompare(b.numero));
        return {
            dateArret: arret ? arret.toISOString().slice(0, 10) : null,
            groupes: listeGroupes,
            sortis,
            totaux: {
                brut: arrondir(listeGroupes.reduce((t, g) => t + g.brut, 0)),
                amortissements: arrondir(listeGroupes.reduce((t, g) => t + g.amortissements, 0)),
                depreciations: arrondir(listeGroupes.reduce((t, g) => t + g.depreciations, 0)),
                net: arrondir(listeGroupes.reduce((t, g) => t + g.net, 0)),
            },
        };
    }
    async tableauAmortissements(tenantId, exerciceId) {
        const regimeTableau = await this.regimeComptable(tenantId);
        const sansProrata = this.sansProrataTemporis(regimeTableau);
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        }));
        const immos = await this.prisma.immobilisation.findMany({
            where: {
                tenantId,
                dateAcquisition: { lte: exercice.dateFin },
                OR: [{ dateSortie: null }, { dateSortie: { gte: exercice.dateDebut } }],
            },
            include: {
                compteImmobilisation: { select: { id: true, numero: true, intitule: true } },
                compteEnCours: { select: { id: true, numero: true, intitule: true } },
                dotations: { select: { montant: true, exerciceId: true, exercice: { select: { dateFin: true } } } },
                depreciations: {
                    select: { sens: true, montant: true, exercice: { select: { dateFin: true } } },
                },
                consommationsUniteOeuvre: {
                    select: { exerciceId: true, unitesConsommees: true, exercice: { select: { dateFin: true } } },
                },
                lignesReevaluation: {
                    where: { ecart: { gt: 0 } },
                    select: {
                        coefficientRetenu: true,
                        brutAvant: true,
                        brutApres: true,
                        amortissementsAvant: true,
                        amortissementsApres: true,
                        reevaluation: { select: { dateReevaluation: true } },
                    },
                },
                ecritureSortieEcartReevaluation: {
                    select: { lignes: { select: { credit: true, compte: { select: { numero: true } } } } },
                },
            },
            orderBy: [{ compteImmobilisation: { numero: 'asc' } }, { dateAcquisition: 'asc' }],
        });
        const unBienReevalue = immos.some((i) => (i.lignesReevaluation ?? []).length > 0);
        const repriseAnnuelle = unBienReevalue
            ? await this.prisma.repriseProvisionReevaluation.findFirst({ where: { tenantId, exerciceId: exercice.id }, select: { detail: true } })
            : null;
        const repriseEcartParBien = new Map();
        for (const d of (Array.isArray(repriseAnnuelle?.detail) ? repriseAnnuelle.detail : [])) {
            if (!d?.immobilisationId)
                continue;
            repriseEcartParBien.set(d.immobilisationId, Math.round(((repriseEcartParBien.get(d.immobilisationId) ?? 0) + Number(d.montant ?? 0)) * 100) / 100);
        }
        const arrondir = (x) => Math.round(x * 100) / 100;
        const moisDeLExercice = [];
        for (let d = new Date(Date.UTC(exercice.dateDebut.getUTCFullYear(), exercice.dateDebut.getUTCMonth(), 1)); d <= exercice.dateFin; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
            moisDeLExercice.push({ annee: d.getUTCFullYear(), mois: d.getUTCMonth() });
        }
        const groupes = new Map();
        const unitesParImmo = new Map();
        for (const immo of immos) {
            if (immo.modeAmortissement !== client_1.ModeAmortissement.UNITES_DOEUVRE)
                continue;
            const cet = immo.consommationsUniteOeuvre.find((c) => c.exerciceId === exercice.id);
            unitesParImmo.set(immo.id, {
                prevues: Number(immo.unitesOeuvrePrevues ?? 0),
                consommees: Number(cet?.unitesConsommees ?? 0),
                consommeesAnterieures: immo.consommationsUniteOeuvre
                    .filter((c) => c.exercice.dateFin < exercice.dateFin && c.exerciceId !== exercice.id)
                    .reduce((t, c) => t + Number(c.unitesConsommees), 0),
            });
        }
        for (const immo of immos) {
            const dotationsAnterieures = immo.dotations.filter((d) => d.exercice.dateFin < exercice.dateFin);
            const vue = (0, reevaluation_suites_1.vueDeLExercice)((immo.lignesReevaluation ?? []).map((l) => ({
                dateReevaluation: l.reevaluation.dateReevaluation,
                coefficientRetenu: Number(l.coefficientRetenu),
                brutAvant: Number(l.brutAvant),
                brutApres: Number(l.brutApres),
                amortissementsAvant: Number(l.amortissementsAvant),
                amortissementsApres: Number(l.amortissementsApres),
            })), exercice);
            const cumulN1 = arrondir(dotationsAnterieures.reduce((t, d) => t + Number(d.montant), 0) +
                (0, partie_remplacee_1.amortissementsHorsDotations)(immo) -
                vue.ajustementCumulExercice -
                vue.cumulPosterieur);
            const valeurBruteALExercice = arrondir(Number(immo.valeurOrigine) - vue.brutPosterieur);
            const valeurResiduelleALExercice = Number(immo.valeurResiduelle) / vue.produitPosterieur;
            const dejaPassee = immo.dotations.find((d) => d.exerciceId === exercice.id);
            const sortiDansLExercice = !!immo.dateSortie && immo.dateSortie <= exercice.dateFin;
            const nonAmortissable = !!(0, comptes_du_bien_1.motifNonAmortissable)(immo.compteImmobilisation.numero, regimeTableau.referentiel) ||
                !!(0, comptes_du_bien_1.motifSansAmortissementProjet)(regimeTableau.jeuEtatsFinanciersSycebnl) ||
                immo.dureeNonLimitee;
            const dotation = dejaPassee
                ? Number(dejaPassee.montant)
                : sortiDansLExercice || nonAmortissable
                    ? 0
                    : this.calculerDotation(Number(immo.valeurOrigine), Number(immo.valeurResiduelle), immo.dureeAmortissementAns, (0, incorporel_duree_non_limitee_1.debutAmortissement)(immo), dotationsAnterieures.map((d) => ({ montant: Number(d.montant) })), exercice, (0, partie_remplacee_1.amortissementsHorsDotations)(immo), this.cumulDepreciation(immo.depreciations
                        .filter((d) => d.exercice.dateFin < exercice.dateFin)
                        .map((d) => ({ sens: d.sens, montant: Number(d.montant) }))), sansProrata, unitesParImmo.get(immo.id) ?? null, planDuBien(immo));
            const finService = immo.dateSortie && immo.dateSortie < exercice.dateFin ? immo.dateSortie : exercice.dateFin;
            const miseEnService = immo.dateMiseEnService;
            const servis = moisDeLExercice.map(({ annee, mois }) => {
                if (!miseEnService)
                    return false;
                const premierJour = new Date(Date.UTC(annee, mois, 1));
                const dernierJour = new Date(Date.UTC(annee, mois + 1, 0));
                const debutService = new Date(Date.UTC(miseEnService.getUTCFullYear(), miseEnService.getUTCMonth(), 1));
                return debutService <= dernierJour && premierJour <= finService;
            });
            const nbServis = servis.filter(Boolean).length;
            const parMois = moisDeLExercice.map(() => 0);
            if (nbServis > 0 && Math.abs(dotation) > EPSILON) {
                const mensualite = arrondir(dotation / nbServis);
                let cumul = 0;
                let dernierServi = -1;
                servis.forEach((sert, i) => {
                    if (!sert)
                        return;
                    parMois[i] = mensualite;
                    cumul = arrondir(cumul + mensualite);
                    dernierServi = i;
                });
                if (dernierServi >= 0)
                    parMois[dernierServi] = arrondir(parMois[dernierServi] + (dotation - cumul));
            }
            const cumulN = arrondir(cumulN1 + dotation + vue.ajustementCumulExercice);
            const depreciations = arrondir(this.cumulDepreciation(immo.depreciations
                .filter((d) => d.exercice.dateFin <= exercice.dateFin)
                .map((d) => ({ sens: d.sens, montant: Number(d.montant) }))));
            const net = arrondir(valeurBruteALExercice - cumulN - depreciations);
            const base = this.baseAmortissable(valeurBruteALExercice, valeurResiduelleALExercice);
            const inscrit = (0, immobilisation_en_cours_1.compteInscritChargeALaDate)(immo, exercice.dateFin);
            const cle = inscrit.id;
            const groupe = groupes.get(cle) ??
                {
                    numero: inscrit.numero,
                    intitule: inscrit.intitule,
                    lignes: [],
                    parMois: moisDeLExercice.map(() => 0),
                    dotation: 0,
                    cumulN1: 0,
                    cumulN: 0,
                    depreciations: 0,
                    net: 0,
                    ajustementReevaluation: 0,
                };
            const repriseSortie = immo.dateSortie && immo.dateSortie >= exercice.dateDebut && immo.dateSortie <= exercice.dateFin
                ? arrondir((immo.ecritureSortieEcartReevaluation?.lignes ?? [])
                    .filter((l) => l.compte.numero.startsWith('86'))
                    .reduce((t, l) => t + Number(l.credit), 0))
                : 0;
            const repriseEcart = arrondir((repriseEcartParBien.get(immo.id) ?? 0) + repriseSortie);
            groupe.lignes.push({
                id: immo.id,
                designation: immo.designation,
                dateAcquisition: immo.dateAcquisition.toISOString().slice(0, 10),
                valeurBrute: valeurBruteALExercice,
                taux: immo.dureeAmortissementAns > 0 ? arrondir(100 / immo.dureeAmortissementAns) : 0,
                base: arrondir(base),
                parMois,
                dotation: arrondir(dotation),
                cumulN1,
                cumulN,
                depreciations,
                valeurNette: net,
                dotationPassee: Boolean(dejaPassee) || sortiDansLExercice,
                sortiLe: sortiDansLExercice && immo.dateSortie ? immo.dateSortie.toISOString().slice(0, 10) : null,
                ajustementReevaluation: vue.ajustementCumulExercice,
                reevaluation: Math.abs(vue.produitAnterieur - 1) > 1e-9 || Math.abs(vue.ajustementCumulExercice) > EPSILON || repriseEcart > EPSILON
                    ? {
                        produitAnterieur: vue.produitAnterieur,
                        supplement: (0, reevaluation_suites_1.supplementDeLaDotation)(arrondir(dotation), (immo.lignesReevaluation ?? [])
                            .filter((l) => l.reevaluation.dateReevaluation < exercice.dateDebut)
                            .map((l) => Number(l.coefficientRetenu))),
                        repriseEcart,
                    }
                    : null,
            });
            parMois.forEach((m, i) => {
                groupe.parMois[i] = arrondir(groupe.parMois[i] + m);
            });
            groupe.dotation = arrondir(groupe.dotation + dotation);
            groupe.cumulN1 = arrondir(groupe.cumulN1 + cumulN1);
            groupe.cumulN = arrondir(groupe.cumulN + cumulN);
            groupe.depreciations = arrondir(groupe.depreciations + depreciations);
            groupe.net = arrondir(groupe.net + net);
            groupe.ajustementReevaluation = arrondir(groupe.ajustementReevaluation + vue.ajustementCumulExercice);
            groupes.set(cle, groupe);
        }
        const listeGroupes = [...groupes.values()].sort((a, b) => a.numero.localeCompare(b.numero));
        const NOMS_MOIS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juill.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
        return {
            exercice: {
                dateDebut: exercice.dateDebut.toISOString().slice(0, 10),
                dateFin: exercice.dateFin.toISOString().slice(0, 10),
            },
            mois: moisDeLExercice.map(({ annee, mois }) => ({ cle: `${annee}-${String(mois + 1).padStart(2, '0')}`, libelle: NOMS_MOIS[mois] })),
            groupes: listeGroupes,
            totaux: {
                parMois: moisDeLExercice.map((_, i) => arrondir(listeGroupes.reduce((t, g) => t + g.parMois[i], 0))),
                dotation: arrondir(listeGroupes.reduce((t, g) => t + g.dotation, 0)),
                cumulN1: arrondir(listeGroupes.reduce((t, g) => t + g.cumulN1, 0)),
                cumulN: arrondir(listeGroupes.reduce((t, g) => t + g.cumulN, 0)),
                depreciations: arrondir(listeGroupes.reduce((t, g) => t + g.depreciations, 0)),
                net: arrondir(listeGroupes.reduce((t, g) => t + g.net, 0)),
                ajustementReevaluation: arrondir(listeGroupes.reduce((t, g) => t + g.ajustementReevaluation, 0)),
                supplementReevaluation: arrondir(listeGroupes.reduce((t, g) => t + g.lignes.reduce((u, l) => u + (l.reevaluation?.supplement ?? 0), 0), 0)),
                repriseEcart: arrondir(listeGroupes.reduce((t, g) => t + g.lignes.reduce((u, l) => u + (l.reevaluation?.repriseEcart ?? 0), 0), 0)),
            },
        };
    }
    async unitesOeuvreDe(tenantId, immo, exerciceId, exerciceDateFin) {
        if (immo.modeAmortissement !== client_1.ModeAmortissement.UNITES_DOEUVRE)
            return null;
        const toutes = await this.prisma.consommationUniteOeuvre.findMany({
            where: { tenantId, immobilisationId: immo.id },
            include: { exercice: { select: { dateFin: true } } },
        });
        const cetExercice = toutes.find((c) => c.exerciceId === exerciceId);
        if (!cetExercice) {
            throw new common_1.BadRequestException("Aucune consommation d'unités d'œuvre saisie pour cet exercice · le mode aux unités d'œuvre calcule " +
                "l'annuité sur les unités CONSOMMÉES, et aucune comptabilité ne les porte. Saisissez le relevé " +
                "(compteur, carnet de bord, fiche de production) avant de passer la dotation. Supposer zéro ferait " +
                "passer un exercice sans relevé pour un exercice sans usage.");
        }
        const consommeesAnterieures = toutes
            .filter((c) => c.exercice.dateFin < exerciceDateFin && c.exerciceId !== exerciceId)
            .reduce((t, c) => t + Number(c.unitesConsommees), 0);
        return {
            prevues: Number(immo.unitesOeuvrePrevues ?? 0),
            consommees: Number(cetExercice.unitesConsommees),
            consommeesAnterieures,
        };
    }
    async saisirConsommation(tenantId, userId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        if (immo.modeAmortissement !== client_1.ModeAmortissement.UNITES_DOEUVRE) {
            throw new common_1.BadRequestException("Cette immobilisation n'est pas amortie aux unités d'œuvre · un relevé n'y changerait aucun calcul.");
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        const donnees = {
            unitesConsommees: dto.unitesConsommees,
            source: dto.source.trim(),
            saisiePar: userId,
        };
        return this.prisma.consommationUniteOeuvre.upsert({
            where: { immobilisationId_exerciceId: { immobilisationId: id, exerciceId: dto.exerciceId }, tenantId },
            create: { tenantId, immobilisationId: id, exerciceId: dto.exerciceId, ...donnees },
            update: donnees,
        });
    }
    async passerDotation(tenantId, userId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        if (immo.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException("Cette immobilisation n'est plus en service · aucune dotation possible");
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        const sansProrata = this.sansProrataTemporis(await this.regimeComptable(tenantId));
        const dejaPassee = await this.prisma.dotationAmortissement.findUnique({
            where: { immobilisationId_exerciceId: { immobilisationId: id, exerciceId: dto.exerciceId } },
        });
        if (dejaPassee) {
            throw new common_1.ConflictException('Une dotation a déjà été passée pour cette immobilisation sur cet exercice');
        }
        const reevalueApres = await this.prisma.ligneReevaluationBilan.findFirst({
            where: { tenantId, immobilisationId: id, reevaluation: { exercice: { dateFin: { gte: exercice.dateFin } } } },
            select: { id: true },
        });
        if (reevalueApres) {
            throw new common_1.BadRequestException("Ce bien a été réévalué à la clôture de cet exercice ou d'un exercice postérieur · la dotation de l'exercice " +
                'se passe avant la réévaluation, sur les valeurs anciennes (AUDCIF art. 63 ; Titre VIII ch. 28 § 3.2).');
        }
        if (!immo.dateMiseEnService) {
            throw new common_1.BadRequestException("Ce bien n'est pas encore mis en service · aucune dotation avant sa mise en service (AUDCIF art. 45). " +
                'Indiquez sa date de mise en service depuis la liste des biens.');
        }
        const regimeDotation = await this.regimeComptable(tenantId);
        const nonAmortissable = (0, comptes_du_bien_1.motifSansAmortissementProjet)(regimeDotation.jeuEtatsFinanciersSycebnl) ??
            (0, comptes_du_bien_1.motifNonAmortissable)(immo.compteImmobilisation.numero, regimeDotation.referentiel) ??
            (immo.dureeNonLimitee ? incorporel_duree_non_limitee_1.MOTIF_NON_AMORTI : null);
        if (nonAmortissable)
            throw new common_1.BadRequestException(nonAmortissable);
        const uniteOeuvre = await this.unitesOeuvreDe(tenantId, immo, dto.exerciceId, exercice.dateFin);
        const montant = this.calculerDotation(Number(immo.valeurOrigine), Number(immo.valeurResiduelle), immo.dureeAmortissementAns, (0, incorporel_duree_non_limitee_1.debutAmortissement)(immo), immo.dotations.map((d) => ({ montant: Number(d.montant) })), exercice, (0, partie_remplacee_1.amortissementsHorsDotations)(immo), this.cumulDepreciation(immo.depreciations
            .filter((d) => d.exercice.dateFin < exercice.dateFin)
            .map((d) => ({ sens: d.sens, montant: Number(d.montant) }))), sansProrata, uniteOeuvre, planDuBien(immo));
        if (montant <= EPSILON) {
            throw new common_1.BadRequestException('Aucun montant à doter · le bien est déjà entièrement amorti ou hors période');
        }
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: exercice.dateFin.toISOString().slice(0, 10),
            libelle: `Dotation aux amortissements · ${immo.designation}`,
            lignes: [
                { compteId: immo.compteDotationId, debit: montant, credit: 0 },
                { compteId: immo.compteAmortissementId, debit: 0, credit: montant },
            ],
        });
        const empreinte = empreinteDuPlan(immo);
        try {
            const dotation = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.$queryRaw `SELECT id FROM "immobilisations" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
                const relue = await tx.immobilisation.findFirst({ where: { id, tenantId }, include: { dotations: true, depreciations: true } });
                if (!relue || empreinteDuPlan(relue) !== empreinte) {
                    throw new common_1.ConflictException('La fiche du bien a changé pendant le calcul de la dotation (un traitement annulé ou passé entre-temps) · rien ' +
                        "n'est passé. Relancez la dotation.");
                }
                return tx.dotationAmortissement.create({
                    data: { immobilisationId: id, exerciceId: dto.exerciceId, montant, ecritureId: ecriture.id },
                });
            });
            return versDotation(dotation);
        }
        catch (err) {
            if (estConflitUnicite(err)) {
                await this.annulerEcritureOrpheline(ecriture.id);
                throw new common_1.ConflictException('Une dotation a déjà été passée pour cette immobilisation sur cet exercice');
            }
            if (err instanceof common_1.ConflictException)
                await this.annulerEcritureOrpheline(ecriture.id);
            throw err;
        }
    }
    async plafondReprise(tenantId, id, exerciceId) {
        const immo = await this.trouver(tenantId, id);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        const valeurs = await this.plafondRepriseDe(tenantId, immo, exercice);
        return { ...valeurs, plafond: (0, plafond_reprise_depreciation_1.plafondRepriseDepreciation)(valeurs) };
    }
    async plafondRepriseDe(tenantId, immo, exercice) {
        const jusquA = (d) => d.exercice.dateFin <= exercice.dateFin;
        const cumulDepreciation = this.cumulDepreciation(immo.depreciations.filter(jusquA).map((d) => ({ sens: d.sens, montant: Number(d.montant) })));
        const valeurOrigine = Number(immo.valeurOrigine);
        const horsDotations = (0, partie_remplacee_1.amortissementsHorsDotations)(immo);
        const regime = await this.regimeComptable(tenantId);
        const sansDotation = !!(0, comptes_du_bien_1.motifSansAmortissementProjet)(regime.jeuEtatsFinanciersSycebnl) ||
            !!(0, comptes_du_bien_1.motifNonAmortissable)(immo.compteImmobilisation.numero, regime.referentiel) ||
            immo.dureeNonLimitee ||
            (immo.modeAmortissement !== client_1.ModeAmortissement.UNITES_DOEUVRE && !(immo.dureeAmortissementAns > 0));
        if (sansDotation) {
            const nette = valeurOrigine - horsDotations - immo.dotations.filter(jusquA).reduce((t, d) => t + Number(d.montant), 0);
            return { cumulDepreciation, valeurNette: nette - cumulDepreciation, valeurSansDepreciation: nette };
        }
        const sansProrata = this.sansProrataTemporis(regime);
        const plan = planDuBien(immo);
        const consommations = immo.modeAmortissement === client_1.ModeAmortissement.UNITES_DOEUVRE
            ? await this.prisma.consommationUniteOeuvre.findMany({ where: { tenantId, immobilisationId: immo.id } })
            : [];
        const unites = (exerciceId) => {
            if (immo.modeAmortissement !== client_1.ModeAmortissement.UNITES_DOEUVRE)
                return null;
            const ligne = consommations.find((c) => c.exerciceId === exerciceId);
            return { prevues: Number(immo.unitesOeuvrePrevues ?? 0), consommees: Number(ligne?.unitesConsommees ?? 0), consommeesAnterieures: 0 };
        };
        const dotationsPassees = immo.dotations.filter(jusquA);
        let cumulAmorti = horsDotations + dotationsPassees.reduce((t, d) => t + Number(d.montant), 0);
        if (!dotationsPassees.some((d) => d.exerciceId === exercice.id)) {
            cumulAmorti += this.calculerDotation(valeurOrigine, Number(immo.valeurResiduelle), immo.dureeAmortissementAns, (0, incorporel_duree_non_limitee_1.debutAmortissement)(immo), immo.dotations.filter((d) => d.exercice.dateFin < exercice.dateFin).map((d) => ({ montant: Number(d.montant) })), exercice, horsDotations, this.cumulDepreciation(immo.depreciations
                .filter((d) => d.exercice.dateFin < exercice.dateFin)
                .map((d) => ({ sens: d.sens, montant: Number(d.montant) }))), sansProrata, immo.modeAmortissement === client_1.ModeAmortissement.UNITES_DOEUVRE
                ? await this.unitesOeuvreDe(tenantId, immo, exercice.id, exercice.dateFin)
                : null, plan);
        }
        const exercices = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { lte: exercice.dateFin } },
            orderBy: { dateDebut: 'asc' },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        const rejouees = [];
        for (const e of exercices) {
            const m = this.calculerDotation(valeurOrigine, Number(immo.valeurResiduelle), immo.dureeAmortissementAns, (0, incorporel_duree_non_limitee_1.debutAmortissement)(immo), rejouees, e, horsDotations, 0, sansProrata, unites(e.id), plan);
            if (m > EPSILON)
                rejouees.push({ montant: m });
        }
        const valeurSansDepreciation = valeurOrigine - horsDotations - rejouees.reduce((t, d) => t + d.montant, 0);
        return { cumulDepreciation, valeurNette: valeurOrigine - cumulAmorti - cumulDepreciation, valeurSansDepreciation };
    }
    async enregistrerDepreciation(tenantId, userId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        if (immo.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException("Cette immobilisation n'est plus en service · aucune dépréciation possible");
        }
        if (dto.sens === client_1.SensDepreciation.DOTATION) {
            const refusSmt = (0, systeme_minimal_1.motifRefusDepreciationSmt)(await this.regimeComptable(tenantId));
            if (refusSmt)
                throw new common_1.BadRequestException(refusSmt);
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        const [compte29, contrepartie] = await Promise.all([
            this.prisma.compte.findFirst({ where: { id: dto.compteDepreciationId, tenantId } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteContrepartieId, tenantId } }),
        ]);
        if (!compte29)
            throw new common_1.BadRequestException('Compte de dépréciation introuvable pour ce tenant');
        if (!contrepartie)
            throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce tenant');
        if (!compte29.numero.startsWith('29')) {
            throw new common_1.BadRequestException("La dépréciation d'une immobilisation s'inscrit au compte 29. Le compte 39 est celui des stocks, le 49 " +
                'celui des tiers et le 59 celui de la trésorerie.');
        }
        const { referentiel } = await this.regimeComptable(tenantId);
        const refusCompte = (0, comptes_du_bien_1.motifRefusCompteDepreciation)(referentiel, immo.compteImmobilisation.numero, compte29.numero) ??
            (0, comptes_du_bien_1.motifRefusContrepartieDepreciation)(referentiel, dto.sens, contrepartie.numero) ??
            (0, comptes_du_bien_1.motifRefusDepreciationDivision20)(referentiel, immo.compteImmobilisation.numero, dto.sens, compte29.numero, contrepartie.numero);
        if (refusCompte)
            throw new common_1.BadRequestException(refusCompte);
        const cumuls29 = (0, depreciation_en_cours_1.cumulsParCompte29)(immo.depreciations.map((d) => ({ sens: d.sens, montant: Number(d.montant), compteDepreciationId: d.compteDepreciationId })));
        const numeros29 = new Map(immo.depreciations.flatMap((d) => (d.compteDepreciation ? [[d.compteDepreciationId, d.compteDepreciation.numero]] : [])));
        const refusCompteDuBien = (0, depreciation_en_cours_1.motifRefusCompte29DuBien)({
            syscohada: referentiel === client_1.Referentiel.SYSCOHADA,
            compteChoisi: { id: compte29.id, numero: compte29.numero },
            cumuls: cumuls29,
            numeros: numeros29,
            inscritEnCours: !!immo.compteEnCoursId && (0, immobilisation_en_cours_1.compteInscritALaDate)(immo, exercice.dateFin) === immo.compteEnCoursId,
        });
        if (refusCompteDuBien)
            throw new common_1.BadRequestException(refusCompteDuBien);
        const cumul = this.cumulDepreciation(immo.depreciations.map((d) => ({ sens: d.sens, montant: Number(d.montant) })));
        const reevaluations = await this.prisma.ligneReevaluationBilan.findMany({
            where: { tenantId, immobilisationId: id, ecart: { gt: 0 } },
            select: { id: true, ecart: true, ecartImpute: true, compteEcart: true, reevaluation: { select: { exercice: { select: { dateFin: true } } } } },
            orderBy: { reevaluation: { dateReevaluation: 'asc' } },
        });
        if (reevaluations.length > 0 && dto.sens === client_1.SensDepreciation.REPRISE) {
            throw new common_1.BadRequestException("Ce bien a été réévalué · la reprise de sa dépréciation n'est pas réglée par le texte (AUDCIF Titre VIII ch. 12 " +
                '§ 2.4.2 et § 2.5), et OmegaX ne la calcule pas. Passez-la hors module, avec sa justification.');
        }
        if (dto.sens === client_1.SensDepreciation.DOTATION && reevaluations.some((r) => r.reevaluation.exercice.dateFin >= exercice.dateFin)) {
            throw new common_1.BadRequestException("Ce bien a été réévalué à la clôture de cet exercice, à sa valeur actuelle (AUDCIF art. 63) · une perte de " +
                'valeur à la même date contredirait cette valeur. La dépréciation se constate AVANT la réévaluation, qui ' +
                'garde alors le bien à sa valeur nette (ch. 28 § 4.2.3).');
        }
        if (dto.sens === client_1.SensDepreciation.REPRISE) {
            const valeurs = await this.plafondRepriseDe(tenantId, immo, exercice);
            const refusReprise = (0, plafond_reprise_depreciation_1.motifRefusRepriseDepreciation)({ montant: dto.montant, ...valeurs });
            if (refusReprise)
                throw new common_1.BadRequestException(refusReprise);
        }
        if (dto.sens === client_1.SensDepreciation.DOTATION) {
            const cumulAmorti = immo.dotations.reduce((t, d) => t + Number(d.montant), 0) + (0, partie_remplacee_1.amortissementsHorsDotations)(immo);
            const valeurNette = Number(immo.valeurOrigine) - cumulAmorti - cumul;
            if (dto.montant > valeurNette + EPSILON) {
                throw new common_1.BadRequestException(`La dépréciation ne peut pas dépasser la valeur comptable nette du bien (${Math.max(0, valeurNette).toFixed(2)})`);
            }
        }
        const dotation = dto.sens === client_1.SensDepreciation.DOTATION;
        const imputation = dotation
            ? (0, reevaluation_bilan_1.imputationSurEcart)(dto.montant, ((0, reevaluation_bilan_1.natureReevaluable)(immo.compteImmobilisation.numero, referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL') === 'CORPORELLE' ? reevaluations : []).map((r) => ({ id: r.id, compteEcart: r.compteEcart ?? '', reste: Number(r.ecart) - Number(r.ecartImpute) })))
            : { parEcart: [], enCharge: dto.montant };
        const comptesEcart = imputation.parEcart.length
            ? await this.prisma.compte.findMany({
                where: { tenantId, numero: { in: [...new Set(imputation.parEcart.map((e) => e.compteEcart))] } },
                select: { id: true, numero: true },
            })
            : [];
        const absent = imputation.parEcart.find((e) => !comptesEcart.some((c) => c.numero === e.compteEcart));
        if (absent)
            throw new common_1.BadRequestException(`Compte ${absent.compteEcart} absent du plan du dossier · il porte l'écart de réévaluation du bien.`);
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: exercice.dateFin.toISOString().slice(0, 10),
            libelle: `${dotation ? 'Dotation' : 'Reprise'} de dépréciation · ${immo.designation}`,
            lignes: dotation
                ? [
                    ...imputation.parEcart.map((e) => ({ compteId: comptesEcart.find((c) => c.numero === e.compteEcart).id, debit: e.montant, credit: 0 })),
                    ...(imputation.enCharge > EPSILON ? [{ compteId: contrepartie.id, debit: imputation.enCharge, credit: 0 }] : []),
                    { compteId: compte29.id, debit: 0, credit: dto.montant },
                ]
                : [
                    { compteId: compte29.id, debit: dto.montant, credit: 0 },
                    { compteId: contrepartie.id, debit: 0, credit: dto.montant },
                ],
        });
        try {
            const imputeTotal = Math.round(imputation.parEcart.reduce((t, e) => t + e.montant, 0) * 100) / 100;
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const cree = await tx.depreciationImmobilisation.create({
                    data: {
                        immobilisationId: id,
                        exerciceId: dto.exerciceId,
                        sens: dto.sens,
                        montant: dto.montant,
                        montantImputeEcart: imputeTotal,
                        compteDepreciationId: compte29.id,
                        compteContrepartieId: contrepartie.id,
                        indice: dto.indice,
                        ecritureId: ecriture.id,
                        createdBy: userId,
                    },
                });
                for (const e of imputation.parEcart) {
                    await tx.ligneReevaluationBilan.update({ where: { id: e.id }, data: { ecartImpute: { increment: e.montant } } });
                }
                return cree;
            });
        }
        catch (err) {
            if (estConflitUnicite(err)) {
                await this.annulerEcritureOrpheline(ecriture.id);
                throw new common_1.ConflictException('Une dépréciation a déjà été enregistrée pour cette immobilisation sur cet exercice');
            }
            throw err;
        }
    }
    async estimerRevisionMajeure(tenantId, id, entree) {
        const immo = await this.trouver(tenantId, id);
        const dejaIdentifie = await this.prisma.immobilisation.count({
            where: { tenantId, immobilisationPrincipaleId: id, typeComposant: client_1.TypeComposant.REVISION_MAJEURE },
        });
        if (dejaIdentifie > 0) {
            throw new common_1.BadRequestException("Ce bien porte déjà un composant « révisions majeures » · l'estimation du ch. 5 § 1 ne vise que le cas " +
                "où le composant « n'a pas été comptabilisé séparément ou spécifiquement identifié lors de la " +
                'comptabilisation initiale ». Ici il l’a été, et sa valeur nette se lit, elle ne s’estime pas.');
        }
        const resultat = ImmobilisationService_1.reconstitutionRevisionMajeure({
            coutRevisionActuel: entree.coutRevisionActuel,
            intervalleRevisionsAns: entree.intervalleRevisionsAns,
            dateAcquisition: immo.dateAcquisition,
            dateReconstitution: new Date(entree.dateReconstitution),
            derniereRevisionRealiseeLe: entree.derniereRevisionRealiseeLe
                ? new Date(entree.derniereRevisionRealiseeLe)
                : null,
        });
        return {
            immobilisation: { id: immo.id, designation: immo.designation, dateAcquisition: immo.dateAcquisition },
            ...resultat,
            fondement: 'AUDCIF, Titre VIII ch. 5 § 1 · « Lorsque le composant "Révisions majeures" n’a pas été comptabilisé ' +
                'séparément ou spécifiquement identifié lors de la comptabilisation initiale […], sa valeur nette ' +
                'comptable PEUT ÊTRE ESTIMÉE par référence au "coût de révision actuel amorti", comme si cette révision ' +
                'avait été réalisée à la date d’acquisition de l’immobilisation ou d’achèvement de sa production. »',
            suite: 'OmegaX ne poste rien · la ventilation de la valeur brute entre la structure et le composant reconstitué ' +
                'est une décision du cabinet. Une fois décidée, créez le composant « révisions majeures » rattaché à ce ' +
                'bien, amorti sur l’intervalle qui sépare deux révisions, et réduisez d’autant la structure. Et rappelez ' +
                'la règle qui rend l’opération nécessaire : aucune provision pour grosses réparations ne peut être ' +
                'comptabilisée (ch. 5 § 1, et ch. 18 § 4.11.2) · la voie est le composant, ou la charge de l’exercice.',
        };
    }
    async renouveler(tenantId, userId, composantId, dto) {
        const ancien = await this.trouver(tenantId, composantId);
        if (!ancien.immobilisationPrincipaleId) {
            throw new common_1.BadRequestException("Ce bien n'est pas un composant · le renouvellement d'un composant suppose une immobilisation principale " +
                'à laquelle rattacher le remplaçant (AUDCIF, Titre VIII ch. 4 § 4.1). Pour un bien autonome, utilisez ' +
                'la sortie puis une nouvelle acquisition.');
        }
        if (ancien.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException('Ce composant est déjà sorti · il ne se renouvelle plus.');
        }
        const refusEnCours = (0, immobilisation_en_cours_1.motifRefusTantQueEnCours)(ancien, new Date(dto.dateRenouvellement), 'son renouvellement');
        if (refusEnCours)
            throw new common_1.BadRequestException(refusEnCours);
        const remplacant = await this.creer(tenantId, userId, {
            familleId: ancien.familleId,
            designation: dto.designation,
            dateAcquisition: dto.dateRenouvellement,
            dateMiseEnService: dto.dateRenouvellement,
            valeurOrigine: dto.coutRenouvellement,
            valeurResiduelle: dto.valeurResiduelle ?? 0,
            dureeAmortissementAns: dto.dureeAmortissementAns,
            compteContrepartieId: dto.compteContrepartieId,
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            immobilisationPrincipaleId: ancien.immobilisationPrincipaleId,
            typeComposant: ancien.typeComposant ?? undefined,
            justificationDecomposition: ancien.justificationDecomposition ??
                `Renouvellement du composant « ${ancien.designation} » (AUDCIF, Titre VIII ch. 4 § 4.1)`,
            dernierRenouvellement: dto.dernierRenouvellement,
        }, { composantRemplaceId: composantId });
        try {
            await this.sortir(tenantId, userId, composantId, {
                dateSortie: dto.dateRenouvellement,
                type: immobilisation_dto_1.TypeSortie.MISE_HORS_SERVICE,
                exerciceId: dto.exerciceId,
                journalId: dto.journalId,
                cessionCourante: dto.cessionCourante,
                compteReserveEcartId: dto.compteReserveEcartId,
            });
        }
        catch (err) {
            await this.retirerRemplacant(tenantId, remplacant.id, dto.designation);
            throw err;
        }
        return remplacant;
    }
    async retirerRemplacant(tenantId, id, designation) {
        try {
            const cree = await this.prisma.immobilisation.findFirst({
                where: { id, tenantId },
                select: { ecritureAcquisitionId: true },
            });
            await this.prisma.immobilisation.deleteMany({ where: { id, tenantId } });
            if (cree?.ecritureAcquisitionId)
                await this.annulerEcritureOrpheline(cree.ecritureAcquisitionId);
        }
        catch {
            throw new common_1.InternalServerErrorException(`Le renouvellement a échoué et le remplaçant « ${designation} » n'a pas pu être retiré · vérifiez la ` +
                'fiche et son écriture d’acquisition avant toute nouvelle tentative.');
        }
    }
    async reclasser(tenantId, userId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        if (immo.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException("Un bien sorti ne se reclasse pas · le reclassement est un changement d'UTILISATION (ch. 10 § 2.4), et " +
                "un bien cédé ou mis hors service n'a plus d'utilisation.");
        }
        const dateReclassement = new Date(dto.dateReclassement);
        if ((0, immobilisation_en_cours_1.compteInscritALaDate)(immo, dateReclassement) !== immo.compteImmobilisationId) {
            throw new common_1.BadRequestException(immo.dateMiseEnService
                ? `Ce bien était encore inscrit en cours à cette date · il n'est mis en service que le ${immo.dateMiseEnService
                    .toISOString()
                    .slice(0, 10)}, et un reclassement ne peut la précéder.`
                : "Ce bien est inscrit en cours · il n'a pas encore d'utilisation à changer. Mettez-le en service d'abord, puis reclassez-le.");
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        if (dateReclassement < exercice.dateDebut || dateReclassement > exercice.dateFin) {
            throw new common_1.BadRequestException("La date de reclassement doit se situer dans l'exercice indiqué");
        }
        if (dateReclassement < immo.dateAcquisition) {
            throw new common_1.BadRequestException("La date de reclassement ne peut pas précéder l'acquisition du bien");
        }
        if (!dto.motif.trim()) {
            throw new common_1.BadRequestException("Le motif du reclassement est obligatoire · le § 1.2 du ch. 10 qualifie un immeuble de placement par " +
                "l'USAGE, que nul solde ne porte, et le § 4.2 en fait une information de Notes annexes.");
        }
        const nouvelleFamille = await this.prisma.familleImmobilisation.findFirst({
            where: { id: dto.nouvelleFamilleId, tenantId },
            include: { compteImmobilisation: true, compteAmortissement: true },
        });
        if (!nouvelleFamille)
            throw new common_1.BadRequestException('Famille de destination introuvable pour ce tenant');
        if (nouvelleFamille.compteImmobilisationId === immo.compteImmobilisationId) {
            throw new common_1.BadRequestException(`Le bien est déjà porté au compte ${immo.compteImmobilisation.numero} · un reclassement qui ne change ` +
                "pas de compte n'a rien à virer, et laisserait au grand livre une écriture nulle que personne ne " +
                'saurait relire.');
        }
        const regime = await this.regimeComptable(tenantId);
        const natureAvant = natureImmobilisation(immo.compteImmobilisation.numero, regime.referentiel);
        const natureApres = natureImmobilisation(nouvelleFamille.compteImmobilisation.numero, regime.referentiel);
        if (natureAvant !== natureApres) {
            throw new common_1.BadRequestException(`Le reclassement ne change pas la NATURE du bien (${natureAvant} vers ${natureApres}) · un changement ` +
                "d'utilisation déplace un bien entre catégories du bilan, il ne le transforme pas. Les comptes " +
                "d'amortissement et de dotation sont éclatés par nature, et le franchir imputerait les dotations " +
                'suivantes à un poste qui ne correspond plus à celui de l’actif.');
        }
        const criteresReclassement = (0, frais_developpement_1.estFraisDeveloppement)(regime.referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL', nouvelleFamille.compteImmobilisation.numero) &&
            !immo.compteImmobilisation.numero.startsWith('211');
        if (criteresReclassement) {
            const refusRd = (0, frais_developpement_1.motifRefusFraisDeveloppement)({
                referentiel: 'SYSCOHADA',
                numeroCompte: nouvelleFamille.compteImmobilisation.numero,
                repris: false,
                criteres: dto.criteresFraisDeveloppement,
                dateReunion: dto.dateReunionCriteresDeveloppement ? new Date(dto.dateReunionCriteresDeveloppement) : null,
                dateInscription: immo.dateAcquisition,
            });
            if (refusRd)
                throw new common_1.BadRequestException(refusRd);
        }
        else if (dto.criteresFraisDeveloppement || dto.dateReunionCriteresDeveloppement) {
            throw new common_1.BadRequestException("Les six critères des frais de développement ne se déclarent qu'au virement d'un bien vers le compte 211 du SYSCOHADA.");
        }
        const cumulAmorti = immo.dotations.reduce((s, d) => s + Number(d.montant), 0) + (0, partie_remplacee_1.amortissementsHorsDotations)(immo);
        const cumulDepreciation = this.cumulDepreciation(immo.depreciations.map((d) => ({ sens: d.sens, montant: Number(d.montant) })));
        const porteurReclassement = (0, transfert_depreciation_en_cours_1.porteurDeLaDepreciation)(immo.depreciations.map((d) => ({ sens: d.sens, montant: Number(d.montant), compteDepreciationId: d.compteDepreciationId, compteContrepartieId: d.compteContrepartieId })));
        let nouveauCompteDepreciation = null;
        if (cumulDepreciation > EPSILON) {
            if (!dto.nouveauCompteDepreciationId) {
                throw new common_1.BadRequestException('Ce bien porte une dépréciation : indiquez le compte 29 de destination. Il n’est pas déduit du nouveau ' +
                    'compte d’immobilisation, le module ne connaissant pas la subdivision que le dossier a ouverte · un ' +
                    '29 deviné serait un compte faux dans une balance juste.');
            }
            const compte29 = await this.prisma.compte.findFirst({
                where: { id: dto.nouveauCompteDepreciationId, tenantId },
            });
            if (!compte29)
                throw new common_1.BadRequestException('Compte de dépréciation introuvable pour ce tenant');
            if (!compte29.numero.startsWith('29')) {
                throw new common_1.BadRequestException(`Le compte ${compte29.numero} n’est pas un compte de dépréciation d’immobilisation · les deux plans ` +
                    'écrivent le préfixe 29 (39 pour les stocks, 49 pour les tiers, 59 pour la trésorerie).');
            }
            nouveauCompteDepreciation = compte29;
        }
        const lignes = [
            { compteId: nouvelleFamille.compteImmobilisationId, debit: Number(immo.valeurOrigine), credit: 0 },
            { compteId: immo.compteImmobilisationId, debit: 0, credit: Number(immo.valeurOrigine) },
        ];
        if (cumulAmorti > EPSILON) {
            lignes.push({ compteId: immo.compteAmortissementId, debit: cumulAmorti, credit: 0 });
            lignes.push({ compteId: nouvelleFamille.compteAmortissementId, debit: 0, credit: cumulAmorti });
        }
        if (cumulDepreciation > EPSILON && porteurReclassement && nouveauCompteDepreciation) {
            lignes.push({ compteId: porteurReclassement.compteDepreciationId, debit: cumulDepreciation, credit: 0 });
            lignes.push({ compteId: nouveauCompteDepreciation.id, debit: 0, credit: cumulDepreciation });
        }
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: dto.dateReclassement,
            libelle: `Reclassement · ${immo.designation}`,
            lignes,
        });
        const immobilisation = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const miseAJour = await tx.immobilisation.update({
                where: { id },
                data: {
                    familleId: nouvelleFamille.id,
                    compteImmobilisationId: nouvelleFamille.compteImmobilisationId,
                    compteAmortissementId: nouvelleFamille.compteAmortissementId,
                    compteDotationId: nouvelleFamille.compteDotationId,
                    ...(criteresReclassement
                        ? {
                            criteresFraisDeveloppement: (0, frais_developpement_1.criteresRetenus)(dto.criteresFraisDeveloppement) ?? undefined,
                            dateReunionCriteresDeveloppement: new Date(dto.dateReunionCriteresDeveloppement),
                        }
                        : {}),
                },
                include: { compteImmobilisation: true, compteAmortissement: true, compteDotation: true },
            });
            if (nouveauCompteDepreciation) {
                await tx.depreciationImmobilisation.updateMany({
                    where: { immobilisationId: id },
                    data: { compteDepreciationId: nouveauCompteDepreciation.id },
                });
            }
            await tx.reclassementImmobilisation.create({
                data: {
                    immobilisationId: id,
                    exerciceId: dto.exerciceId,
                    dateReclassement,
                    motif: dto.motif.trim(),
                    ancienCompteImmobilisationId: immo.compteImmobilisationId,
                    nouveauCompteImmobilisationId: nouvelleFamille.compteImmobilisationId,
                    ecritureId: ecriture.id,
                    createdBy: userId,
                },
            });
            return miseAJour;
        });
        return {
            immobilisation,
            ecriture,
            vire: {
                valeurOrigine: Number(immo.valeurOrigine),
                cumulAmortissement: cumulAmorti,
                cumulDepreciation,
            },
        };
    }
    async echanger(tenantId, userId, id, dto) {
        const ancien = await this.trouver(tenantId, id);
        if (ancien.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException('Le bien donné en échange est déjà sorti.');
        }
        const valeur = Math.round((dto.prixDeReprise + dto.soulte) * 100) / 100;
        if (!(valeur > 0)) {
            throw new common_1.BadRequestException("La soulte reçue dépasse le prix de reprise · le bien reçu n'aurait aucune valeur.");
        }
        const [{ referentiel }, compteRecu, fournisseur, creance] = await Promise.all([
            this.regimeComptable(tenantId),
            this.prisma.compte.findFirst({ where: { id: dto.compteImmobilisationId, tenantId }, select: { numero: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteFournisseurId, tenantId }, select: { numero: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteCreanceId, tenantId }, select: { numero: true } }),
        ]);
        if (!compteRecu || !fournisseur || !creance)
            throw new common_1.BadRequestException('Compte introuvable pour ce dossier');
        if (IMMEUBLES_DE_PLACEMENT.some((r) => compteRecu.numero.startsWith(r))) {
            throw new common_1.BadRequestException("Un immeuble de placement reçu en échange s'évalue à « la valeur comptable de l'actif remis » (AUDCIF " +
                'Titre VIII ch. 10 § 2.1.2.2), règle que ce module ne sert pas · passez la sortie et l’acquisition séparément.');
        }
        const racines = (0, contrepartie_acquisition_1.racinesContrepartieAcquisition)(referentiel, compteRecu.numero);
        if ((0, compte_du_bien_1.modeDuCompteDeContrepartie)(referentiel, fournisseur.numero, racines) !== 'ACHAT_A_CREDIT') {
            throw new common_1.BadRequestException(`Le compte ${fournisseur.numero} n'est pas un fournisseur d'investissement · le nouveau bien se porte au crédit du 481 ` +
                '(Guide d’application SYSCOHADA, Partie 1 ch. 5 § 4.5).');
        }
        const creanceAttendue = dto.cessionCourante ? '414' : '485';
        if (!creance.numero.startsWith(creanceAttendue)) {
            throw new common_1.BadRequestException(`La reprise de l'ancien bien naît au ${creanceAttendue} (Créances sur cessions d'immobilisations` +
                `${dto.cessionCourante ? ', cession courante' : ''}), pas au ${creance.numero}.`);
        }
        const libelle = `Échange contre ${ancien.designation}`.slice(0, 180);
        const nouveau = await this.creer(tenantId, userId, {
            compteImmobilisationId: dto.compteImmobilisationId,
            designation: dto.designation,
            numeroInventaire: dto.numeroInventaire,
            lieuId: dto.lieuId,
            natureFiscaleCle: dto.natureFiscaleCle ?? null,
            dateAcquisition: dto.dateEchange,
            dateMiseEnService: dto.dateMiseEnService ?? null,
            valeurOrigine: valeur,
            dureeAmortissementAns: dto.dureeAmortissementAns,
            compteContrepartieId: dto.compteFournisseurId,
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
        });
        try {
            const sortie = await this.sortir(tenantId, userId, id, {
                dateSortie: dto.dateEchange,
                type: immobilisation_dto_1.TypeSortie.CESSION,
                exerciceId: dto.exerciceId,
                journalId: dto.journalId,
                prixCession: dto.prixDeReprise,
                compteContrepartieId: dto.compteCreanceId,
                cessionCourante: !!dto.cessionCourante,
                natureSortie: 'ECHANGE',
                compteReserveEcartId: dto.compteReserveEcartId,
            }, { depuisEchange: true });
            return { nouveau, sortie, libelle, valeurOrigine: valeur };
        }
        catch (err) {
            const cree = await this.prisma.immobilisation.findFirst({
                where: { id: nouveau.id, tenantId },
                select: { ecritureAcquisitionId: true },
            });
            await this.prisma.immobilisation.delete({ where: { id: nouveau.id } });
            if (cree?.ecritureAcquisitionId)
                await this.annulerEcritureOrpheline(cree.ecritureAcquisitionId);
            throw err;
        }
    }
    async sortir(tenantId, userId, id, dto, opts = {}) {
        const immo = await this.trouver(tenantId, id);
        if (immo.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException('Cette immobilisation est déjà sortie');
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        const dateSortie = new Date(dto.dateSortie);
        if (immo.dateMiseEnService && dateSortie < immo.dateMiseEnService) {
            throw new common_1.BadRequestException('La date de sortie ne peut pas précéder la date de mise en service');
        }
        if (dateSortie < immo.dateAcquisition) {
            throw new common_1.BadRequestException("La date de sortie ne peut pas précéder la date d'acquisition");
        }
        const composantsEnService = await this.prisma.immobilisation.findMany({
            where: { tenantId, immobilisationPrincipaleId: id, statut: client_1.StatutImmobilisation.EN_SERVICE },
            select: { designation: true },
        });
        if (composantsEnService.length > 0) {
            throw new common_1.BadRequestException(`Ce bien porte encore ${composantsEnService.length} composant(s) en service (` +
                `${composantsEnService.map((c) => c.designation).join(', ')}) · sortez-les d'abord, chacun avec sa ` +
                'valeur nette, puis le bien principal.');
        }
        if (immo.degressifFiscal) {
            const d = await this.prisma.amortissementDerogatoire.findMany({ where: { tenantId, immobilisationId: id }, select: { dotation: true, reprise: true } });
            const cumul = Math.round(d.reduce((s, x) => s + Number(x.dotation) - Number(x.reprise), 0) * 100) / 100;
            if (cumul > 0) {
                throw new common_1.BadRequestException(`Ce bien porte ${cumul.toFixed(2)} d'amortissement dérogatoire au 151 · reprenez-le d'abord (D/151, C/861) depuis son plan fiscal, puis sortez le bien.`);
            }
        }
        if (dateSortie < exercice.dateDebut || dateSortie > exercice.dateFin) {
            throw new common_1.BadRequestException("La date de sortie doit se situer dans l'exercice indiqué");
        }
        if (dto.type === immobilisation_dto_1.TypeSortie.CESSION && (dto.prixCession === undefined || !dto.compteContrepartieId)) {
            throw new common_1.BadRequestException('Une cession nécessite un prix et un compte de contrepartie (trésorerie ou tiers)');
        }
        const regime = await this.regimeComptable(tenantId);
        const { referentiel } = regime;
        const nature = natureImmobilisation(immo.compteImmobilisation.numero, referentiel);
        if (nature === 'USUFRUIT' && dto.type === immobilisation_dto_1.TypeSortie.CESSION) {
            throw new common_1.BadRequestException("Un usufruit temporaire n'est pas cédé · il est rétrocédé au donateur au terme de la donation " +
                '(D 280 / C 2011, SYCEBNL Partie 3 ch. 2 § 2.3.2). Sortez-le en mise hors service.');
        }
        const datePieceSortie = dto.datePieceSortie ? new Date(dto.datePieceSortie) : null;
        if (dto.natureSortie) {
            const refusNature = (0, nature_sortie_1.motifRefusNatureSortie)({
                nature: dto.natureSortie,
                type: dto.type,
                projetDeveloppement: regime.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT,
                usufruit: nature === 'USUFRUIT',
                depuisEchange: !!opts.depuisEchange,
            });
            if (refusNature)
                throw new common_1.BadRequestException(refusNature);
        }
        if (dto.referencePieceSortie !== undefined || dto.datePieceSortie !== undefined) {
            const refusPiece = (0, nature_sortie_1.motifRefusPieceSortie)(dto.referencePieceSortie, datePieceSortie);
            if (refusPiece)
                throw new common_1.BadRequestException(refusPiece);
        }
        const referencePiece = dto.referencePieceSortie?.trim() || undefined;
        let comptes = nature === 'USUFRUIT' ? null : exports.COMPTES_SORTIE[nature];
        if (dto.cessionCourante) {
            if (referentiel !== client_1.Referentiel.SYSCOHADA) {
                throw new common_1.BadRequestException("La cession courante impute la sortie aux comptes 654 et 754, qui portent au plan SYCEBNL les dons en " +
                    "nature courants reçus à distribuer. Sur un dossier SYCEBNL, une cession se comptabilise en hors " +
                    'activités ordinaires (comptes 81 et 82).');
            }
            const courants = exports.COMPTES_CESSION_COURANTE[nature];
            if (!courants) {
                throw new common_1.BadRequestException("Les comptes 654 et 754 n'ont que deux subdivisions, incorporelles et corporelles : une immobilisation " +
                    'financière se cède en hors activités ordinaires (comptes 816 et 826), quelle que soit la fréquence ' +
                    'des cessions.');
            }
            comptes = courants;
        }
        if (dto.type === immobilisation_dto_1.TypeSortie.CESSION && dto.compteContrepartieId && referentiel === client_1.Referentiel.SYSCOHADA) {
            const contrepartieCession = await this.prisma.compte.findFirst({
                where: { id: dto.compteContrepartieId, tenantId },
                select: { numero: true },
            });
            if (!contrepartieCession)
                throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce tenant');
            const refus = (0, comptes_du_bien_1.motifRefusContrepartieCession)(referentiel, !!dto.cessionCourante, contrepartieCession.numero);
            if (refus)
                throw new common_1.BadRequestException(refus);
        }
        let cumulAmorti = immo.dotations.reduce((s, d) => s + Number(d.montant), 0) + (0, partie_remplacee_1.amortissementsHorsDotations)(immo);
        const dejaDoteCetExercice = immo.dotations.some((d) => d.exerciceId === dto.exerciceId);
        const montantComplement = dejaDoteCetExercice || !immo.dateMiseEnService ||
            (0, comptes_du_bien_1.motifNonAmortissable)(immo.compteImmobilisation.numero, referentiel) ||
            (0, comptes_du_bien_1.motifSansAmortissementProjet)(regime.jeuEtatsFinanciersSycebnl) ||
            immo.dureeNonLimitee
            ? 0
            : this.calculerDotation(Number(immo.valeurOrigine), Number(immo.valeurResiduelle), immo.dureeAmortissementAns, (0, incorporel_duree_non_limitee_1.debutAmortissement)(immo), immo.dotations.map((d) => ({ montant: Number(d.montant) })), { dateDebut: exercice.dateDebut, dateFin: dateSortie }, (0, partie_remplacee_1.amortissementsHorsDotations)(immo), this.cumulDepreciation(immo.depreciations
                .filter((d) => d.exercice.dateFin < exercice.dateFin)
                .map((d) => ({ sens: d.sens, montant: Number(d.montant) }))), this.sansProrataTemporis(regime), await this.unitesOeuvreDe(tenantId, immo, dto.exerciceId, dateSortie), planDuBien(immo));
        if (montantComplement > EPSILON)
            cumulAmorti += montantComplement;
        const cumulDepreciation = this.cumulDepreciation(immo.depreciations.map((d) => ({ sens: d.sens, montant: Number(d.montant) })));
        const porteur = (0, transfert_depreciation_en_cours_1.porteurDeLaDepreciation)(immo.depreciations.map((d) => ({ sens: d.sens, montant: Number(d.montant), compteDepreciationId: d.compteDepreciationId, compteContrepartieId: d.compteContrepartieId })));
        const compteDepreciationSortie = porteur?.compteDepreciationId ?? null;
        const valeurComptableNette = Math.max(0, Number(immo.valeurOrigine) - cumulAmorti);
        const projet = regime.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT;
        const compteFonds = dto.compteFondsProjetId
            ? await this.prisma.compte.findFirst({
                where: { id: dto.compteFondsProjetId, tenantId },
                select: { id: true, numero: true, estActif: true },
            })
            : null;
        if (dto.compteFondsProjetId && !compteFonds)
            throw new common_1.BadRequestException('Compte de fonds introuvable pour ce dossier');
        const refusProjet = (0, comptes_du_bien_1.motifRefusSortieProjet)({
            projet,
            numeroCompteFonds: compteFonds?.numero ?? null,
            cumulAmorti,
            cumulDepreciation,
            compteFondsEnSommeil: compteFonds ? compteFonds.estActif === false : false,
        });
        if (refusProjet)
            throw new common_1.BadRequestException(refusProjet);
        const valeurRecuperee = dto.valeurMaterielRecupere ?? 0;
        let compteStockRecupere = null;
        if (valeurRecuperee > 0 || dto.compteStockRecupereId) {
            compteStockRecupere = dto.compteStockRecupereId
                ? await this.prisma.compte.findFirst({
                    where: { id: dto.compteStockRecupereId, tenantId },
                    select: { id: true, numero: true },
                })
                : null;
            if (dto.compteStockRecupereId && !compteStockRecupere) {
                throw new common_1.BadRequestException('Compte de stock introuvable pour ce dossier');
            }
            const refusRecupere = (0, materiel_recupere_1.motifRefusMaterielRecupere)({
                referentiel,
                cession: dto.type === immobilisation_dto_1.TypeSortie.CESSION,
                projetDeveloppement: projet,
                numeroCompteBien: (0, immobilisation_en_cours_1.compteInscritChargeALaDate)(immo, dateSortie).numero,
                numeroCompteStock: compteStockRecupere?.numero ?? null,
                valeur: valeurRecuperee,
                valeurNetteComptable: valeurComptableNette,
                source: dto.sourceMaterielRecupere,
            });
            if (refusRecupere)
                throw new common_1.BadRequestException(refusRecupere);
        }
        const valeurAu81 = Math.round((valeurComptableNette - valeurRecuperee) * 100) / 100;
        const lignesSortie = [
            { compteId: (0, immobilisation_en_cours_1.compteInscritALaDate)(immo, dateSortie), debit: 0, credit: Number(immo.valeurOrigine) },
        ];
        if (projet && compteFonds) {
            lignesSortie.push({ compteId: compteFonds.id, debit: Number(immo.valeurOrigine), credit: 0 });
        }
        if (!projet && cumulAmorti > EPSILON) {
            lignesSortie.push({ compteId: immo.compteAmortissementId, debit: cumulAmorti, credit: 0 });
        }
        if (!projet && cumulDepreciation > EPSILON && compteDepreciationSortie) {
            const compteReprise = await this.compteRepriseDepreciation(tenantId, referentiel, nature, porteur?.compteContrepartieDotationId ?? null);
            lignesSortie.push({ compteId: compteDepreciationSortie, debit: cumulDepreciation, credit: 0 });
            lignesSortie.push({ compteId: compteReprise.id, debit: 0, credit: cumulDepreciation });
        }
        if (!projet && valeurComptableNette > EPSILON && !comptes) {
            throw new common_1.BadRequestException(`L'usufruit garde une valeur nette de ${valeurComptableNette.toFixed(2)} à cette date · la rétrocession ` +
                "se fait au terme de la donation, l'usufruit entièrement amorti (SYCEBNL Partie 3 ch. 2 § 2.3.2). " +
                "Vérifiez la durée d'amortissement ou la date de sortie ; une dépréciation qui subsiste se reprend " +
                "d'abord (D 2901 / C 7951), et la dernière annuité amortit alors le reste.");
        }
        if (compteStockRecupere && valeurRecuperee > 0) {
            lignesSortie.push({ compteId: compteStockRecupere.id, debit: valeurRecuperee, credit: 0 });
        }
        if (!projet && valeurAu81 > EPSILON && comptes) {
            const compteVNC = await this.compteDeSortie(tenantId, comptes.valeurComptable);
            lignesSortie.push({ compteId: compteVNC.id, debit: valeurAu81, credit: 0 });
        }
        const compteProduit = comptes && dto.type === immobilisation_dto_1.TypeSortie.CESSION && dto.prixCession && dto.compteContrepartieId
            ? await this.compteDeSortie(tenantId, comptes.produitCession)
            : null;
        const sortEcart = await this.sortDeLEcartALaSortie(tenantId, id, referentiel, dto);
        const statutFinal = dto.type === immobilisation_dto_1.TypeSortie.CESSION ? client_1.StatutImmobilisation.CEDEE : client_1.StatutImmobilisation.MISE_HORS_SERVICE;
        const verrou = await this.prisma.immobilisation.updateMany({
            where: { id, tenantId, statut: client_1.StatutImmobilisation.EN_SERVICE },
            data: {
                statut: statutFinal,
                dateSortie,
                prixCession: dto.prixCession,
                natureSortie: dto.natureSortie ?? null,
                referencePieceSortie: referencePiece ?? null,
                datePieceSortie,
            },
        });
        if (verrou.count === 0) {
            throw new common_1.ConflictException('Cette immobilisation vient déjà d\'être sortie par une autre opération');
        }
        const ecrituresPosees = [];
        let dotationPoseeId = null;
        try {
            if (montantComplement > EPSILON) {
                const ecritureComplement = await this.ecritureService.creer(tenantId, userId, {
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                    date: dto.dateSortie,
                    libelle: `Dotation complémentaire (sortie) · ${immo.designation}`,
                    reference: referencePiece,
                    lignes: [
                        { compteId: immo.compteDotationId, debit: montantComplement, credit: 0 },
                        { compteId: immo.compteAmortissementId, debit: 0, credit: montantComplement },
                    ],
                });
                ecrituresPosees.push(ecritureComplement.id);
                try {
                    const dotation = await this.prisma.dotationAmortissement.create({
                        data: { immobilisationId: id, exerciceId: dto.exerciceId, montant: montantComplement, ecritureId: ecritureComplement.id },
                    });
                    dotationPoseeId = dotation.id;
                }
                catch (err) {
                    if (estConflitUnicite(err)) {
                        throw new common_1.ConflictException('Une dotation a été passée entre-temps pour cette immobilisation sur cet exercice · réessayez la sortie');
                    }
                    throw err;
                }
            }
            const ecritureSortie = await this.ecritureService.creer(tenantId, userId, {
                exerciceId: dto.exerciceId,
                journalId: dto.journalId,
                date: dto.dateSortie,
                libelle: (0, nature_sortie_1.libelleSortie)({ projet, type: dto.type, nature: dto.natureSortie, designation: immo.designation }),
                reference: referencePiece,
                lignes: lignesSortie,
            });
            ecrituresPosees.push(ecritureSortie.id);
            let ecritureProduitId = null;
            if (compteProduit && dto.prixCession && dto.compteContrepartieId) {
                const ecritureProduit = await this.ecritureService.creer(tenantId, userId, {
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                    date: dto.dateSortie,
                    libelle: `Produit de cession · ${immo.designation}`,
                    reference: referencePiece,
                    lignes: [
                        { compteId: dto.compteContrepartieId, debit: dto.prixCession, credit: 0 },
                        { compteId: compteProduit.id, debit: 0, credit: dto.prixCession },
                    ],
                });
                ecrituresPosees.push(ecritureProduit.id);
                ecritureProduitId = ecritureProduit.id;
            }
            let ecritureEcartId = null;
            if (sortEcart.lignes.length > 0) {
                const ecritureEcart = await this.ecritureService.creer(tenantId, userId, {
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                    date: dto.dateSortie,
                    libelle: `Écart de réévaluation du bien sorti · ${immo.designation}`.slice(0, 200),
                    reference: referencePiece,
                    lignes: sortEcart.lignes,
                });
                ecrituresPosees.push(ecritureEcart.id);
                ecritureEcartId = ecritureEcart.id;
            }
            const poserLaSortie = async (tx) => {
                for (const s of sortEcart.passes) {
                    await tx.ligneReevaluationBilan.update({
                        where: { id: s.ligneId },
                        data: s.traitement === 'RESERVE'
                            ? { ecartTransfere: { increment: s.montant } }
                            : { provisionReprise: { increment: s.montant } },
                    });
                }
                return tx.immobilisation.update({
                    where: { id },
                    data: {
                        ecritureSortieId: ecritureSortie.id,
                        ecritureProduitCessionId: ecritureProduitId,
                        ecritureSortieEcartReevaluationId: ecritureEcartId,
                        ...(compteStockRecupere && valeurRecuperee > 0
                            ? { valeurMaterielRecupere: valeurRecuperee, sourceMaterielRecupere: dto.sourceMaterielRecupere.trim().slice(0, 1000) }
                            : {}),
                    },
                    include: { dotations: true },
                });
            };
            const immobilisation = sortEcart.passes.length > 0 ? await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, poserLaSortie) : await poserLaSortie(this.prisma);
            return {
                ...versImmobilisation(immobilisation),
                ecartReevaluation: sortEcart.lignes.length > 0 ? sortEcart.restitution : null,
            };
        }
        catch (err) {
            await this.defaireSortie(tenantId, id, immo.designation, ecrituresPosees, dotationPoseeId);
            throw err;
        }
    }
    async baremeFiscal(tenantId) {
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        return (0, bareme_fiscal_1.baremeFiscal)().map((n) => ({ ...n, ...(0, bareme_comptes_1.comptesDeLaNature)(referentiel, n.cle) }));
    }
    async recevoirLegs(tenantId, userId, dto) {
        const [{ referentiel }, fonds, dettes] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteFondsId, tenantId }, select: { id: true, numero: true } }),
            dto.compteDettesId
                ? this.prisma.compte.findFirst({ where: { id: dto.compteDettesId, tenantId }, select: { id: true, numero: true } })
                : Promise.resolve(null),
        ]);
        if (!fonds)
            throw new common_1.BadRequestException('Compte du fonds introuvable pour ce dossier');
        if (dto.compteDettesId && !dettes)
            throw new common_1.BadRequestException('Compte des dettes introuvable pour ce dossier');
        const motif = (0, legs_immobilisations_1.motifRefusLegs)({
            referentiel: referentiel,
            numeroFonds: fonds.numero,
            numeroDettes: dettes?.numero ?? null,
            dettes: dto.dettes,
            valeurs: dto.biens.map((b) => b.valeurOrigine),
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        for (const b of dto.biens) {
            const compte = await this.prisma.compte.findFirst({ where: { id: b.compteImmobilisationId, tenantId }, select: { numero: true } });
            if (!compte)
                throw new common_1.BadRequestException(`Compte du bien « ${b.designation} » introuvable pour ce dossier`);
            const refus = (0, contrepartie_acquisition_1.motifRefusContrepartie)(referentiel, compte.numero, fonds.numero);
            if (refus)
                throw new common_1.BadRequestException(`« ${b.designation} » · ${refus}`);
        }
        const parts = (0, legs_immobilisations_1.repartirDettesLegs)(dto.biens.map((b) => b.valeurOrigine), dto.dettes);
        const crees = [];
        try {
            for (const [i, b] of dto.biens.entries()) {
                const part = parts[i];
                const lignesCredit = [
                    ...(part > 0 && dettes ? [{ compteId: dettes.id, montant: part }] : []),
                    { compteId: fonds.id, montant: Math.round((b.valeurOrigine - part) * 100) / 100 },
                ];
                const immo = await this.creer(tenantId, userId, {
                    compteImmobilisationId: b.compteImmobilisationId,
                    designation: b.designation,
                    dateAcquisition: dto.dateActe,
                    dateMiseEnService: b.dateMiseEnService,
                    natureFiscaleCle: b.natureFiscaleCle,
                    valeurOrigine: b.valeurOrigine,
                    dureeAmortissementAns: b.dureeAmortissementAns,
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                }, { lignesCredit, libelle: `Legs ${dto.referenceActe.trim()} · ${b.designation}` });
                crees.push({ id: immo.id, ecritureAcquisitionId: immo.ecritureAcquisitionId ?? null });
            }
        }
        catch (err) {
            for (const c of [...crees].reverse()) {
                await this.prisma.immobilisation.delete({ where: { id: c.id } });
                if (c.ecritureAcquisitionId)
                    await this.annulerEcritureOrpheline(c.ecritureAcquisitionId);
            }
            throw err;
        }
        return {
            biens: crees.map((c, i) => ({ id: c.id, dettes: parts[i], fonds: Math.round((dto.biens[i].valeurOrigine - parts[i]) * 100) / 100 })),
        };
    }
    async acquerirAPrixGlobal(tenantId, userId, dto) {
        const [{ referentiel }, contrepartie] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteContrepartieId, tenantId }, select: { id: true, numero: true } }),
        ]);
        if (!contrepartie)
            throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce dossier');
        const comptesBiens = await Promise.all(dto.biens.map((b) => this.prisma.compte.findFirst({ where: { id: b.compteImmobilisationId, tenantId }, select: { id: true, numero: true } })));
        comptesBiens.forEach((c, i) => {
            if (!c)
                throw new common_1.BadRequestException(`Compte du bien « ${dto.biens[i].designation} » introuvable pour ce dossier`);
        });
        const numeros = comptesBiens.map((c) => c.numero);
        const reference = dto.referenceActe.trim();
        const aCreer = [];
        let lignesStock = [];
        let modalite;
        if (dto.nature === 'ENSEMBLE') {
            if (!dto.fondement)
                throw new common_1.BadRequestException('Indiquez la méthode de ventilation retenue (AUDCIF art. 38).');
            if ((dto.stocks?.length ?? 0) > 0)
                throw new common_1.BadRequestException("Des stocks ne se reprennent qu'avec un fonds de commerce.");
            if (dto.dureeFondsCommercialAns != null) {
                throw new common_1.BadRequestException("La durée du fonds commercial ne se déclare qu'avec un fonds de commerce.");
            }
            if (dto.fondement !== 'ACTE' && !dto.sourceValeurs?.trim()) {
                throw new common_1.BadRequestException("Indiquez d'où viennent les valeurs retenues · la modalité est mentionnée aux Notes annexes (AUDCIF art. 38).");
            }
            const v = (0, ventilation_prix_global_1.ventilerPrixGlobal)({
                prix: dto.prix,
                fondement: dto.fondement,
                elements: dto.biens.map((b, i) => ({ numeroCompte: numeros[i], montant: b.montant ?? null, parDifference: !!b.parDifference })),
                motifSansComparaison: dto.motifSansComparaison,
            });
            if ('motif' in v)
                throw new common_1.BadRequestException(v.motif);
            dto.biens.forEach((b, i) => aCreer.push({ compteImmobilisationId: b.compteImmobilisationId, numero: numeros[i], designation: b.designation, montant: v.montants[i], dureeAmortissementAns: b.dureeAmortissementAns, dateMiseEnService: b.dateMiseEnService }));
            modalite =
                `Prix global ${dto.prix.toFixed(2)} (${reference}) ventilé · ${ventilation_prix_global_1.LIBELLE_FONDEMENT[dto.fondement]}` +
                    (dto.sourceValeurs?.trim() ? ` · source : ${dto.sourceValeurs.trim()}` : '') +
                    (dto.motifSansComparaison?.trim() ? ` · sans comparaison : ${dto.motifSansComparaison.trim()}` : '');
        }
        else {
            if (dto.biens.some((b) => b.parDifference || !(Number(b.montant) > 0))) {
                throw new common_1.BadRequestException("Chaque élément séparable du fonds porte sa valeur · le reste va au fonds commercial (AUDCIF Titre VIII ch. 2 § 7.2.1).");
            }
            const comptesStocks = await Promise.all((dto.stocks ?? []).map((st) => this.prisma.compte.findFirst({ where: { id: st.compteId, tenantId }, select: { id: true, numero: true } })));
            if (comptesStocks.some((c) => !c))
                throw new common_1.BadRequestException('Compte de stock introuvable pour ce dossier');
            const v = (0, ventilation_prix_global_1.ventilerFondsDeCommerce)({
                referentiel: referentiel,
                prix: dto.prix,
                elements: dto.biens.map((b, i) => ({ numeroCompte: numeros[i], montant: Number(b.montant) })),
                stocks: (dto.stocks ?? []).map((st, i) => ({ numeroCompte: comptesStocks[i].numero, montant: st.montant })),
            });
            if ('motif' in v)
                throw new common_1.BadRequestException(v.motif);
            dto.biens.forEach((b, i) => aCreer.push({ compteImmobilisationId: b.compteImmobilisationId, numero: numeros[i], designation: b.designation, montant: Number(b.montant), dureeAmortissementAns: b.dureeAmortissementAns, dateMiseEnService: b.dateMiseEnService }));
            if (!(v.fondsCommercial > 0) && dto.dureeFondsCommercialAns != null) {
                throw new common_1.BadRequestException("Les éléments séparables et les stocks épuisent le prix · aucun fonds commercial ne s'inscrit, sa durée ne se déclare pas (AUDCIF Titre VIII ch. 2 § 7.2.1).");
            }
            if (v.fondsCommercial > 0) {
                const compte215 = await this.prisma.compte.findFirst({
                    where: { tenantId, numero: '21500000', typeCompte: client_1.TypeCompteDetailTotal.DETAIL },
                    select: { id: true },
                });
                if (!compte215)
                    throw new common_1.BadRequestException('Le compte 21500000 Fonds commercial est absent du plan du dossier.');
                aCreer.push({ compteImmobilisationId: compte215.id, numero: '21500000', designation: `Fonds commercial · ${reference}`, montant: v.fondsCommercial, dureeAmortissementAns: dto.dureeFondsCommercialAns });
            }
            lignesStock = (dto.stocks ?? []).map((st) => ({ compteId: st.compteId, montant: st.montant }));
            modalite =
                `Fonds de commerce ${dto.prix.toFixed(2)} (${reference}) · éléments séparables à leur valeur, stocks ` +
                    `${lignesStock.reduce((t, l) => t + l.montant, 0).toFixed(2)}, reliquat ${v.fondsCommercial.toFixed(2)} au fonds commercial (AUDCIF Titre VIII ch. 2 § 7.2.1)`;
        }
        for (const b of aCreer) {
            const refus = (0, contrepartie_acquisition_1.motifRefusContrepartie)(referentiel, b.numero, contrepartie.numero);
            if (refus)
                throw new common_1.BadRequestException(`« ${b.designation} » · ${refus}`);
        }
        const porteurStocks = aCreer.length - 1;
        const totalStocks = Math.round(lignesStock.reduce((t, l) => t + l.montant, 0) * 100) / 100;
        const crees = [];
        try {
            for (const [i, b] of aCreer.entries()) {
                const avecStocks = i === porteurStocks && totalStocks > 0;
                const immo = await this.creer(tenantId, userId, {
                    compteImmobilisationId: b.compteImmobilisationId,
                    designation: b.designation,
                    dateAcquisition: dto.dateAcquisition,
                    dateMiseEnService: b.dateMiseEnService,
                    valeurOrigine: b.montant,
                    dureeAmortissementAns: b.dureeAmortissementAns,
                    exerciceId: dto.exerciceId,
                    journalId: dto.journalId,
                    ...(avecStocks ? {} : { compteContrepartieId: contrepartie.id }),
                }, {
                    libelle: `Prix global ${reference} · ${b.designation}`,
                    modaliteVentilation: modalite,
                    ...(avecStocks
                        ? {
                            lignesCredit: [
                                { compteId: contrepartie.id, montant: Math.round((b.montant + totalStocks) * 100) / 100 },
                                ...lignesStock.map((l) => ({ compteId: l.compteId, montant: -l.montant })),
                            ],
                        }
                        : {}),
                });
                crees.push({ id: immo.id, ecritureAcquisitionId: immo.ecritureAcquisitionId ?? null });
            }
        }
        catch (err) {
            for (const c of [...crees].reverse()) {
                await this.prisma.immobilisation.delete({ where: { id: c.id } });
                if (c.ecritureAcquisitionId)
                    await this.annulerEcritureOrpheline(c.ecritureAcquisitionId);
            }
            throw err;
        }
        return {
            modalite,
            biens: crees.map((c, i) => ({ id: c.id, designation: aCreer[i].designation, montant: aCreer[i].montant })),
            stocks: totalStocks,
        };
    }
    async remplacerPartieNonIdentifiee(tenantId, userId, structureId, dto) {
        const structure = await this.prisma.immobilisation.findFirst({
            where: { id: structureId, tenantId },
            include: {
                dotations: { include: { exercice: { select: { dateDebut: true } } } },
                depreciations: true,
                derogatoires: true,
                compteImmobilisation: { select: { numero: true, intitule: true } },
                ecritureAcquisition: { include: { lignes: { include: { compte: { select: { numero: true } } } } } },
                _count: { select: { subventions: true } },
            },
        });
        if (!structure)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        const [{ referentiel }, exercice] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { dateDebut: true, dateFin: true } }),
        ]);
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const refusEnCours = (0, immobilisation_en_cours_1.motifRefusTantQueEnCours)(structure, new Date(dto.dateRenouvellement), 'le remplacement d’une partie');
        if (refusEnCours)
            throw new common_1.BadRequestException(refusEnCours);
        this.verifierDecomposition(structure, referentiel);
        const n = (x) => Number(x ?? 0);
        const financeeParUnFonds = structure._count.subventions > 0 ||
            (structure.ecritureAcquisition?.lignes ?? []).some((l) => n(l.credit) > 0 && !!(0, reprise_subvention_1.fondsDuCompte)(referentiel, l.compte.numero));
        const cumulOuverture = structure.dotations.filter((d) => d.exercice.dateDebut < exercice.dateDebut).reduce((t, d) => t + n(d.montant), 0) +
            (0, partie_remplacee_1.amortissementsHorsDotations)(structure);
        const detache = (0, partie_remplacee_1.detacherPartieRemplacee)({
            valeurOrigine: n(structure.valeurOrigine),
            valeurResiduelle: n(structure.valeurResiduelle),
            cumulOuverture,
            estComposant: !!structure.immobilisationPrincipaleId,
            modeLineaire: structure.modeAmortissement === client_1.ModeAmortissement.LINEAIRE,
            cumulDepreciation: this.cumulDepreciation(structure.depreciations.map((d) => ({ sens: d.sens, montant: n(d.montant) }))),
            degressifOuDerogatoire: structure.degressifFiscal || structure.derogatoires.length > 0,
            financeeParUnFonds,
            dotationDejaPassee: structure.dotations.some((d) => d.exercice.dateDebut >= exercice.dateDebut),
            enService: structure.statut === client_1.StatutImmobilisation.EN_SERVICE,
        }, { valeurEstimee: dto.valeurOrigineEstimee, methode: dto.methodeEstimation, source: dto.sourceEstimation });
        if ('motif' in detache)
            throw new common_1.BadRequestException(detache.motif);
        const partie = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.immobilisation.update({
                where: { id: structure.id },
                data: {
                    valeurOrigine: { decrement: detache.valeurPartie },
                    amortissementsDetaches: { increment: detache.amortissementsPartie },
                },
            });
            return tx.immobilisation.create({
                data: {
                    tenantId,
                    familleId: structure.familleId,
                    designation: dto.designationPartie.trim(),
                    lieuId: structure.lieuId,
                    compteImmobilisationId: structure.compteImmobilisationId,
                    compteAmortissementId: structure.compteAmortissementId,
                    compteDotationId: structure.compteDotationId,
                    compteEnCoursId: structure.compteEnCoursId,
                    dateAcquisition: structure.dateAcquisition,
                    dateMiseEnService: structure.dateMiseEnService,
                    natureFiscaleCle: structure.natureFiscaleCle,
                    valeurOrigine: detache.valeurPartie,
                    valeurResiduelle: 0,
                    dureeAmortissementAns: structure.dureeAmortissementAns,
                    amortissementAnterieur: detache.amortissementsPartie,
                    modeAmortissement: client_1.ModeAmortissement.LINEAIRE,
                    createdBy: userId,
                    immobilisationPrincipaleId: structure.id,
                    typeComposant: client_1.TypeComposant.COMPOSANT,
                    justificationDecomposition: dto.justificationDecomposition.trim(),
                    methodeEstimationPartie: dto.methodeEstimation,
                    sourceEstimationPartie: dto.sourceEstimation.trim(),
                },
            });
        });
        try {
            const remplacant = await this.renouveler(tenantId, userId, partie.id, dto);
            return { partie: { id: partie.id, valeurOrigine: detache.valeurPartie, amortissements: detache.amortissementsPartie }, remplacant, avertissement: detache.avertissement };
        }
        catch (err) {
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                await tx.immobilisation.delete({ where: { id: partie.id } });
                await tx.immobilisation.update({
                    where: { id: structure.id },
                    data: {
                        valeurOrigine: { increment: detache.valeurPartie },
                        amortissementsDetaches: { decrement: detache.amortissementsPartie },
                    },
                });
            });
            throw err;
        }
    }
    async declarerDureeLimitee(tenantId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        const dateDecision = new Date(dto.dateDecision);
        const refus = (0, incorporel_duree_non_limitee_1.motifRefusBascule)({
            dureeNonLimitee: immo.dureeNonLimitee,
            enService: immo.statut === client_1.StatutImmobilisation.EN_SERVICE,
            dateDecision,
            debutPossible: immo.dateMiseEnService,
            dureeResiduelleAns: dto.dureeResiduelleAns,
            testDepreciation: dto.testDepreciation,
            motif: dto.motif,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const regime = await this.regimeComptable(tenantId);
        if (dto.fondementDureeDixAns) {
            const refusDix = (0, incorporel_duree_non_limitee_1.motifRefusDureeDixAns)({
                numeroCompte: immo.compteImmobilisation.numero,
                fondement: dto.fondementDureeDixAns,
                dureeAns: dto.dureeResiduelleAns,
                systemeMinimal: regime.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE,
            });
            if (refusDix)
                throw new common_1.BadRequestException(refusDix);
        }
        const exercice = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { lte: dateDecision }, dateFin: { gte: dateDecision } },
            select: { statut: true },
        });
        if (exercice?.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("La décision tombe dans un exercice clôturé · sa dotation ne se passerait plus. Datez-la dans un exercice ouvert.");
        }
        return this.prisma.immobilisation.update({
            where: { id: immo.id },
            data: {
                dureeNonLimitee: false,
                dateDebutAmortissement: dateDecision,
                dureeAmortissementAns: dto.dureeResiduelleAns,
                motifDureeLimitee: dto.motif.trim().slice(0, 1000),
                testDepreciationBascule: dto.testDepreciation.trim().slice(0, 1000),
                fondementDureeDixAns: dto.fondementDureeDixAns ?? null,
            },
            select: { id: true, dateDebutAmortissement: true, dureeAmortissementAns: true },
        });
    }
    async reviserPlan(tenantId, userId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        const dateDecision = new Date(dto.dateDecision);
        const exercice = await this.prisma.exercice.findFirst({
            where: { tenantId, dateDebut: { lte: dateDecision }, dateFin: { gte: dateDecision } },
        });
        if (!exercice)
            throw new common_1.BadRequestException("Aucun exercice du dossier ne couvre la date de la décision.");
        const regime = await this.regimeComptable(tenantId);
        const debut = (0, incorporel_duree_non_limitee_1.debutAmortissement)(immo);
        const refus = (0, revision_plan_amortissement_1.motifRefusRevision)({
            enService: immo.statut === client_1.StatutImmobilisation.EN_SERVICE,
            debutAmortissement: debut,
            dureeNonLimitee: immo.dureeNonLimitee,
            nonAmortissable: (0, comptes_du_bien_1.motifSansAmortissementProjet)(regime.jeuEtatsFinanciersSycebnl) ??
                (0, comptes_du_bien_1.motifNonAmortissable)(immo.compteImmobilisation.numero, regime.referentiel),
            uniteOeuvre: immo.modeAmortissement === client_1.ModeAmortissement.UNITES_DOEUVRE,
            degressifFiscal: immo.degressifFiscal,
            ouvertureExercice: exercice.dateDebut,
            exerciceClos: exercice.statut === client_1.StatutExercice.CLOTURE,
            dotationDeLExercicePassee: immo.dotations.some((d) => d.exerciceId === exercice.id),
            nature: dto.nature,
            nouvelleDureeAns: dto.nouvelleDureeAns,
            motif: dto.motif,
            degressifDureeTotale: immo.modeAmortissement === client_1.ModeAmortissement.DEGRESSIF && debut
                ? dto.nature === 'PROSPECTIVE'
                    ? this.anneesEcoulees(debut, exercice.dateDebut) + dto.nouvelleDureeAns
                    : dto.nouvelleDureeAns
                : null,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        if (dto.nature !== 'PROSPECTIVE' && Number(immo.amortissementsReevaluation ?? 0) !== 0) {
            throw new common_1.BadRequestException('Ce bien a été réévalué · la révision rétroactive rejouerait le plan passé sur une valeur qui n’était pas la ' +
                'sienne (AUDCIF Titre VIII ch. 28 § 4.2.2). Seule la révision prospective reste ouverte.');
        }
        const arrondir = (x) => Math.round(x * 100) / 100;
        const motif = dto.motif.trim().slice(0, 1000);
        const dureeAvantAns = immo.dureeAmortissementAns;
        if (dto.nature === 'PROSPECTIVE') {
            const dureeTotale = this.anneesEcoulees(debut, exercice.dateDebut) + dto.nouvelleDureeAns;
            return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const revision = await tx.revisionPlanAmortissement.create({
                    data: {
                        tenantId, immobilisationId: immo.id, exerciceId: exercice.id, nature: client_1.NatureRevisionPlan.PROSPECTIVE,
                        dateDecision, dureeAvantAns, dureeApresAns: dto.nouvelleDureeAns, motif, createdBy: userId,
                    },
                });
                await tx.immobilisation.update({
                    where: { id: immo.id },
                    data: {
                        dateEffetRevisionPlan: exercice.dateDebut,
                        dureeResiduelleRevisee: dto.nouvelleDureeAns,
                        dureeAmortissementAns: dureeTotale,
                    },
                });
                return { id: revision.id, nature: revision.nature, dureeAmortissementAns: dureeTotale, montantReprise: null };
            });
        }
        if (!dto.journalId)
            throw new common_1.BadRequestException("Indiquez le journal de l'écriture de reprise au 798.");
        const sansProrata = this.sansProrataTemporis(regime);
        const anterieures = immo.dotations.filter((d) => d.exercice.dateFin < exercice.dateDebut);
        let cumulRejoue = 0;
        const rejouees = [];
        for (const d of anterieures) {
            const m = this.calculerDotation(Number(immo.valeurOrigine), Number(immo.valeurResiduelle), dto.nouvelleDureeAns, debut, rejouees, d.exercice, 0, 0, sansProrata, null);
            rejouees.push({ montant: m });
            cumulRejoue += m;
        }
        cumulRejoue = arrondir(cumulRejoue);
        const cumulActuel = arrondir(anterieures.reduce((t, d) => t + Number(d.montant), 0) + (0, partie_remplacee_1.amortissementsHorsDotations)(immo));
        const refusRetro = (0, revision_plan_amortissement_1.motifRefusRetroactive)({
            cumulActuel,
            cumulRejoue,
            amortissementAnterieur: Number(immo.amortissementAnterieur),
            partieDetachee: Number(immo.amortissementsDetaches),
            cumulDepreciation: this.cumulDepreciation(immo.depreciations.map((d) => ({ sens: d.sens, montant: Number(d.montant) }))),
            lineaire: immo.modeAmortissement === client_1.ModeAmortissement.LINEAIRE,
        });
        if (refusRetro)
            throw new common_1.BadRequestException(refusRetro);
        const montant = arrondir(cumulActuel - cumulRejoue);
        const compte798 = await this.prisma.compte.findFirst({ where: { tenantId, numero: '79800000' }, select: { id: true } });
        if (!compte798)
            throw new common_1.BadRequestException("Le compte 79800000 « Reprises d'amortissements » n'est pas ouvert dans ce dossier.");
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: exercice.id,
            journalId: dto.journalId,
            date: dto.dateDecision.slice(0, 10),
            libelle: `Révision du plan d'amortissement · ${immo.designation}`,
            lignes: [
                { compteId: immo.compteAmortissementId, debit: montant, credit: 0 },
                { compteId: compte798.id, debit: 0, credit: montant },
            ],
        });
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const revision = await tx.revisionPlanAmortissement.create({
                    data: {
                        tenantId, immobilisationId: immo.id, exerciceId: exercice.id, nature: client_1.NatureRevisionPlan.RETROACTIVE,
                        dateDecision, dureeAvantAns, dureeApresAns: dto.nouvelleDureeAns, motif, montantReprise: montant,
                        ecritureId: ecriture.id, createdBy: userId,
                    },
                });
                await tx.immobilisation.update({
                    where: { id: immo.id },
                    data: {
                        dureeAmortissementAns: dto.nouvelleDureeAns,
                        reprisesAmortissement: { increment: montant },
                        dateEffetRevisionPlan: null,
                        dureeResiduelleRevisee: null,
                    },
                });
                return { id: revision.id, nature: revision.nature, dureeAmortissementAns: dto.nouvelleDureeAns, montantReprise: montant };
            });
        }
        catch (err) {
            await this.annulerEcritureOrpheline(ecriture.id);
            throw err;
        }
    }
    async revisionsPlan(tenantId, id) {
        await this.trouver(tenantId, id);
        const revisions = await this.prisma.revisionPlanAmortissement.findMany({
            where: { tenantId, immobilisationId: id },
            orderBy: { dateDecision: 'desc' },
            take: 200,
        });
        return revisions.map((r) => ({
            id: r.id,
            nature: r.nature,
            dateDecision: r.dateDecision,
            dureeAvantAns: r.dureeAvantAns,
            dureeApresAns: r.dureeApresAns,
            motif: r.motif,
            montantReprise: r.montantReprise === null ? null : Number(r.montantReprise),
            ecritureId: r.ecritureId,
        }));
    }
    async incorporerCoutsEmprunt(tenantId, userId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        const [exercice, regime] = await Promise.all([
            this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } }),
            this.regimeComptable(tenantId),
        ]);
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        if (exercice.statut === client_1.StatutExercice.CLOTURE)
            throw new common_1.BadRequestException('Cet exercice est clôturé.');
        const referentiel = regime.referentiel === client_1.Referentiel.SYSCOHADA ? 'SYSCOHADA' : 'SYCEBNL';
        const saisie = {
            referentiel,
            numeroBien: immo.compteImmobilisation.numero,
            enService: immo.statut === client_1.StatutImmobilisation.EN_SERVICE,
            aDesDotations: immo.dotations.length > 0,
            dateMiseEnService: immo.dateMiseEnService,
            nature: dto.nature,
            debutPreparation: new Date(dto.debutPreparation),
            finPreparation: new Date(dto.finPreparation),
            justificationPeriodeCourte: dto.justificationPeriodeCourte,
            dateDebut: new Date(dto.dateDebut),
            dateFin: new Date(dto.dateFin),
            exercice,
            base: dto.base,
            tauxPourcent: dto.tauxPourcent,
            produitsPlacement: dto.produitsPlacement ?? 0,
        };
        const motif = (0, couts_emprunt_incorpores_1.motifRefusIncorporation)(saisie);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const mois = (0, mois_entre_1.moisEntre)(saisie.dateDebut, saisie.dateFin);
        const montant = (0, couts_emprunt_incorpores_1.montantIncorporable)({ base: dto.base, tauxPourcent: dto.tauxPourcent, mois, produitsPlacement: saisie.produitsPlacement });
        const filtreCouts = {
            ecriture: { tenantId, exerciceId: exercice.id, estSoldeDesComptesDeGestion: false, ...ecritures_de_situation_1.HORS_SITUATION },
            OR: [{ compte: { numero: { startsWith: '671' } } }, { compte: { numero: { startsWith: '672' } } }],
        };
        const [couts, deja, compteCredit] = await Promise.all([
            this.prisma.ligneEcriture.aggregate({ where: filtreCouts, _sum: { debit: true, credit: true } }),
            this.prisma.coutEmpruntIncorpore.aggregate({ where: { tenantId, exerciceId: exercice.id }, _sum: { montant: true } }),
            this.prisma.compte.findUnique({
                where: { tenantId_numero: { tenantId, numero: (0, couts_emprunt_incorpores_1.compteCreditIncorporation)(referentiel, immo.compteImmobilisation.numero) } },
            }),
        ]);
        const plafond = (0, couts_emprunt_incorpores_1.motifRefusPlafond)({
            montant,
            coutsSupportes: Number(couts._sum.debit ?? 0) - Number(couts._sum.credit ?? 0),
            dejaIncorpores: Number(deja._sum.montant ?? 0),
        });
        if (plafond)
            throw new common_1.BadRequestException(plafond);
        if (!compteCredit) {
            throw new common_1.BadRequestException(`Le compte ${(0, couts_emprunt_incorpores_1.compteCreditIncorporation)(referentiel, immo.compteImmobilisation.numero)} n'existe pas au plan du dossier · ouvrez-le avant d'incorporer.`);
        }
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: exercice.id,
            journalId: dto.journalId,
            date: dto.dateFin.slice(0, 10),
            libelle: `Coûts d'emprunt incorporés · ${immo.designation}`,
            lignes: [
                { compteId: (0, immobilisation_en_cours_1.compteInscritALaDate)(immo, saisie.dateFin), debit: montant, credit: 0 },
                { compteId: compteCredit.id, debit: 0, credit: montant },
            ],
        });
        try {
            return await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const ligne = await tx.coutEmpruntIncorpore.create({
                    data: {
                        tenantId,
                        immobilisationId: id,
                        exerciceId: exercice.id,
                        nature: dto.nature,
                        debutPreparation: saisie.debutPreparation,
                        finPreparation: saisie.finPreparation,
                        justificationPeriodeCourte: dto.justificationPeriodeCourte?.trim() || null,
                        dateDebut: saisie.dateDebut,
                        dateFin: saisie.dateFin,
                        mois,
                        base: dto.base,
                        tauxPourcent: dto.tauxPourcent,
                        produitsPlacement: saisie.produitsPlacement,
                        montant,
                        ecritureId: ecriture.id,
                        createdBy: userId,
                    },
                });
                await tx.immobilisation.update({ where: { id }, data: { valeurOrigine: { increment: montant } } });
                return { ...ligne, montant };
            });
        }
        catch (err) {
            await this.annulerEcritureOrpheline(ecriture.id);
            throw err;
        }
    }
    async coutsEmpruntIncorpores(tenantId, exerciceId) {
        const lignes = await this.prisma.coutEmpruntIncorpore.findMany({
            where: { tenantId, exerciceId },
            include: { immobilisation: { select: { id: true, designation: true } } },
            orderBy: [{ dateFin: 'asc' }, { id: 'asc' }],
            take: 501,
        });
        const servies = lignes.slice(0, 500);
        const total = await this.prisma.coutEmpruntIncorpore.aggregate({ where: { tenantId, exerciceId }, _sum: { montant: true } });
        return {
            lignes: servies.map((l) => ({
                id: l.id,
                immobilisation: l.immobilisation,
                nature: l.nature,
                dateDebut: l.dateDebut,
                dateFin: l.dateFin,
                mois: l.mois,
                base: Number(l.base),
                tauxPourcent: Number(l.tauxPourcent),
                produitsPlacement: Number(l.produitsPlacement),
                montant: Number(l.montant),
                justificationPeriodeCourte: l.justificationPeriodeCourte,
            })),
            total: Number(total._sum.montant ?? 0),
            tronque: lignes.length > 500,
        };
    }
    async acquerirAPrixAleatoire(tenantId, userId, dto) {
        const [{ referentiel }, compteBien, compteDette, compteComptant] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteImmobilisationId, tenantId }, select: { id: true, numero: true } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteDetteId, tenantId }, select: { id: true, numero: true } }),
            dto.compteComptantId
                ? this.prisma.compte.findFirst({ where: { id: dto.compteComptantId, tenantId }, select: { id: true, numero: true } })
                : Promise.resolve(null),
        ]);
        if (!compteBien)
            throw new common_1.BadRequestException('Compte du bien introuvable pour ce dossier');
        if (!compteDette)
            throw new common_1.BadRequestException('Compte de la dette introuvable pour ce dossier');
        if (dto.compteComptantId && !compteComptant)
            throw new common_1.BadRequestException('Compte de trésorerie introuvable pour ce dossier');
        const comptant = dto.comptant ?? 0;
        const motif = (0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({
            referentiel,
            nature: dto.nature,
            numeroCompteBien: compteBien.numero,
            numeroCompteDette: compteDette.numero,
            comptant,
            numeroCompteComptant: compteComptant?.numero ?? null,
            valeur: dto.valeurOrigine,
            fondement: dto.fondement,
            source: dto.sourceValeur,
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        const lignesCredit = (0, acquisition_prix_aleatoire_1.lignesCreditAleatoire)({
            valeur: dto.valeurOrigine,
            comptant,
            compteDetteId: compteDette.id,
            compteComptantId: compteComptant?.id ?? null,
        });
        const detteInitiale = lignesCredit.at(-1).montant;
        return this.creer(tenantId, userId, {
            compteImmobilisationId: compteBien.id,
            designation: dto.designation,
            dateAcquisition: dto.dateAcquisition,
            dateMiseEnService: dto.dateMiseEnService,
            valeurOrigine: dto.valeurOrigine,
            dureeAmortissementAns: dto.dureeAmortissementAns,
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
        }, {
            lignesCredit,
            libelle: `${dto.nature === 'RENTE_VIAGERE' ? 'Acquisition en viager' : 'Acquisition contre redevances'} · ${dto.designation}`,
            acquisitionAleatoire: {
                nature: dto.nature,
                fondement: dto.fondement,
                source: `${acquisition_prix_aleatoire_1.LIBELLE_FONDEMENT_ALEATOIRE[dto.fondement]} · ${dto.sourceValeur.trim()}`,
                detteInitiale,
            },
        });
    }
    async solderDetteAleatoire(tenantId, userId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        const nature = immo.natureAcquisitionAleatoire;
        if (!nature || immo.detteAleatoireInitiale === null) {
            throw new common_1.BadRequestException("Ce bien n'a pas été acquis en viager ni contre redevances · il n'a pas de dette aléatoire à solder.");
        }
        if (immo.ecritureSoldeDetteAleatoireId) {
            throw new common_1.BadRequestException('La dette de ce bien est déjà soldée · le solde ne se passe qu’une fois.');
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        if (exercice.statut === client_1.StatutExercice.CLOTURE)
            throw new common_1.BadRequestException('Cet exercice est clôturé.');
        const date = new Date(dto.date);
        if (date < exercice.dateDebut || date > exercice.dateFin) {
            throw new common_1.BadRequestException("La date du solde doit se situer dans l'exercice indiqué.");
        }
        if (date < immo.dateAcquisition)
            throw new common_1.BadRequestException("Le solde ne peut pas précéder l'acquisition du bien.");
        const solde = (0, acquisition_prix_aleatoire_1.soldeDetteAleatoire)({
            nature,
            detteInitiale: Number(immo.detteAleatoireInitiale),
            versementsCumules: dto.versementsCumules,
        });
        if ('motif' in solde)
            throw new common_1.BadRequestException(solde.motif);
        const racine = acquisition_prix_aleatoire_1.COMPTES_PRIX_ALEATOIRE[nature].dette;
        const ligneDette = immo.ecritureAcquisitionId
            ? await this.prisma.ligneEcriture.findFirst({
                where: {
                    ecritureId: immo.ecritureAcquisitionId,
                    ecriture: { tenantId },
                    credit: { gt: 0 },
                    compte: { tenantId, numero: { startsWith: racine } },
                },
                select: { compteId: true, compte: { select: { numero: true } } },
            })
            : null;
        if (!ligneDette) {
            throw new common_1.BadRequestException(`L'écriture d'acquisition de ce bien ne crédite plus aucun ${racine} · la dette à solder est introuvable.`);
        }
        if (solde.debiteLaDette) {
            const cumul = await this.prisma.ligneEcriture.aggregate({
                where: {
                    compteId: ligneDette.compteId,
                    ecriture: { tenantId, date: { lte: date }, estGenereeParCloture: false, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION },
                },
                _sum: { debit: true, credit: true },
            });
            const refusSolde = (0, acquisition_prix_aleatoire_1.motifRefusExtinctionAuDelaDuSolde)({
                montant: solde.montant,
                soldeCrediteur: Number(cumul._sum.credit ?? 0) - Number(cumul._sum.debit ?? 0),
                numeroCompteDette: ligneDette.compte.numero,
            });
            if (refusSolde)
                throw new common_1.BadRequestException(refusSolde);
        }
        const contrepartie = await this.compteDeSortie(tenantId, solde.compteContrepartie.padEnd(8, '0'));
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: exercice.id,
            journalId: dto.journalId,
            date: dto.date.slice(0, 10),
            libelle: `${nature === 'RENTE_VIAGERE' ? 'Extinction de la rente viagère' : 'Écart sur redevances'} · ${immo.designation}`.slice(0, 190),
            lignes: solde.debiteLaDette
                ? [
                    { compteId: ligneDette.compteId, debit: solde.montant, credit: 0 },
                    { compteId: contrepartie.id, debit: 0, credit: solde.montant },
                ]
                : [
                    { compteId: contrepartie.id, debit: solde.montant, credit: 0 },
                    { compteId: ligneDette.compteId, debit: 0, credit: solde.montant },
                ],
        });
        try {
            const immobilisation = await this.prisma.immobilisation.update({
                where: { id, AND: [{ ecritureSoldeDetteAleatoireId: null }] },
                data: {
                    ecritureSoldeDetteAleatoireId: ecriture.id,
                    versementsDetteAleatoire: dto.versementsCumules,
                    sourceVersementsDette: dto.sourceVersements.trim().slice(0, 1000),
                    dateSoldeDetteAleatoire: date,
                },
                include: { dotations: true },
            });
            return { ...versImmobilisation(immobilisation), solde: { cas: solde.cas, montant: solde.montant } };
        }
        catch (err) {
            await this.annulerEcritureOrpheline(ecriture.id);
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new common_1.ConflictException('La dette de ce bien vient d’être soldée par une autre opération.');
            }
            throw err;
        }
    }
    async declarerReservePropriete(tenantId, id, dto) {
        const immo = await this.trouver(tenantId, id);
        if (immo.statut !== client_1.StatutImmobilisation.EN_SERVICE) {
            throw new common_1.BadRequestException('Ce bien est sorti · sa réserve de propriété ne se déclare plus.');
        }
        const leveeLe = dto.leveeLe ? new Date(dto.leveeLe) : null;
        const ligne4816 = immo.ecritureAcquisitionId
            ? await this.prisma.ligneEcriture.findFirst({
                where: {
                    ecritureId: immo.ecritureAcquisitionId,
                    ecriture: { tenantId },
                    credit: { gt: 0 },
                    compte: { tenantId, numero: { startsWith: reserve_propriete_1.RACINE_DETTE_RESERVE_PROPRIETE } },
                },
                select: { compte: { select: { numero: true } } },
            })
            : null;
        const refus = (0, reserve_propriete_1.motifRefusReserveDePropriete)({
            reserveDePropriete: dto.reserveDePropriete,
            leveeLe,
            dateAcquisition: immo.dateAcquisition,
            numeroContrepartie: ligne4816?.compte.numero ?? null,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const exercicesClos = await this.prisma.exercice.findMany({
            where: { tenantId, statut: client_1.StatutExercice.CLOTURE, dateFin: { gte: immo.dateAcquisition } },
            orderBy: { dateFin: 'asc' },
            take: 50,
            select: { dateFin: true },
        });
        const refusClos = (0, reserve_propriete_1.motifRefusReserveSurExerciceClos)(immo, { reserveDePropriete: dto.reserveDePropriete, reserveProprieteLeveeLe: dto.reserveDePropriete ? leveeLe : null }, exercicesClos);
        if (refusClos)
            throw new common_1.BadRequestException(refusClos);
        const immobilisation = await this.prisma.immobilisation.update({
            where: { id },
            data: { reserveDePropriete: dto.reserveDePropriete, reserveProprieteLeveeLe: dto.reserveDePropriete ? leveeLe : null },
            include: { dotations: true },
        });
        return versImmobilisation(immobilisation);
    }
    async biensSousReserveDePropriete(tenantId, exerciceId) {
        const [exercice, { referentiel }] = await Promise.all([
            this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateFin: true } }),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
        ]);
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const date = exercice.dateFin;
        const frappes = {
            reserveDePropriete: true,
            dateAcquisition: { lte: date },
            AND: [
                { OR: [{ dateSortie: null }, { dateSortie: { gt: date } }] },
                { OR: [{ reserveProprieteLeveeLe: null }, { reserveProprieteLeveeLe: { gt: date } }] },
            ],
        };
        const [lignes, total, nombre] = await Promise.all([
            this.prisma.immobilisation.findMany({
                where: { tenantId, ...frappes },
                orderBy: { dateAcquisition: 'asc' },
                take: 501,
                select: {
                    id: true,
                    designation: true,
                    dateAcquisition: true,
                    dateSortie: true,
                    valeurOrigine: true,
                    reserveDePropriete: true,
                    reserveProprieteLeveeLe: true,
                    compteImmobilisationId: true,
                    compteEnCoursId: true,
                    dateMiseEnService: true,
                    compteImmobilisation: { select: { id: true, numero: true } },
                    compteEnCours: { select: { id: true, numero: true } },
                },
            }),
            this.prisma.immobilisation.aggregate({ where: { tenantId, ...frappes }, _sum: { valeurOrigine: true } }),
            this.prisma.immobilisation.count({ where: { tenantId, ...frappes } }),
        ]);
        return {
            source: (0, reserve_propriete_1.sourceReserveDePropriete)(referentiel),
            date: date.toISOString().slice(0, 10),
            biens: lignes
                .slice(0, 500)
                .filter((b) => (0, reserve_propriete_1.frappeDeReserveALaDate)(b, date))
                .map((b) => ({
                id: b.id,
                designation: b.designation,
                compte: (0, immobilisation_en_cours_1.compteInscritChargeALaDate)(b, date).numero,
                dateAcquisition: b.dateAcquisition,
                valeurOrigine: Number(b.valeurOrigine),
            })),
            total: Number(total._sum.valeurOrigine ?? 0),
            nombre,
            tronque: lignes.length > 500,
        };
    }
    async comptesMaterielRecupere(tenantId) {
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const stock = (0, materiel_recupere_1.compteStockRecupere)(referentiel);
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, numero: { startsWith: stock.racine }, typeCompte: client_1.TypeCompteDetailTotal.DETAIL },
            orderBy: { numero: 'asc' },
            take: 50,
            select: { id: true, numero: true, intitule: true },
        });
        return { ...stock, comptes };
    }
};
exports.ImmobilisationService = ImmobilisationService;
exports.ImmobilisationService = ImmobilisationService = ImmobilisationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], ImmobilisationService);
//# sourceMappingURL=immobilisation.service.js.map