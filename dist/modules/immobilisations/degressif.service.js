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
exports.DegressifService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const systeme_minimal_1 = require("../../common/systeme-minimal");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const amortissement_degressif_1 = require("./amortissement-degressif");
const bareme_fiscal_1 = require("./bareme-fiscal");
const n = (d) => Number(d ?? 0);
let DegressifService = class DegressifService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    async immo(tenantId, id) {
        const immo = await this.prisma.immobilisation.findFirst({
            where: { id, tenantId },
            include: {
                compteImmobilisation: { select: { numero: true } },
                dotations: { select: { exerciceId: true, montant: true } },
                derogatoires: true,
            },
        });
        if (!immo)
            throw new common_1.NotFoundException('Immobilisation introuvable pour ce dossier.');
        return immo;
    }
    cumul(derogatoires) {
        return Math.round(derogatoires.reduce((s, d) => s + n(d.dotation) - n(d.reprise), 0) * 100) / 100;
    }
    async plan(tenantId, immo) {
        const exercices = await this.prisma.exercice.findMany({
            where: { tenantId },
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
            orderBy: { dateDebut: 'asc' },
        });
        const plan = (0, amortissement_degressif_1.planFiscalDegressif)({
            base: Math.max(0, n(immo.valeurOrigine) - n(immo.valeurResiduelle)),
            dureeFiscaleAns: immo.dureeFiscaleAns ?? 0,
            dateMiseEnService: immo.dateMiseEnService,
            exercices,
            exceptionnel: immo.amortissementExceptionnel,
        });
        return { exercices, plan };
    }
    natureBareme(cle) {
        const nature = cle ? (0, bareme_fiscal_1.natureDuBareme)(cle) : undefined;
        return nature ? { cle: nature.cle, designation: nature.designation, dureeAns: nature.dureeAns } : null;
    }
    async planFiscal(tenantId, id) {
        const immo = await this.immo(tenantId, id);
        const regimeAnterieur = (0, amortissement_degressif_1.motifRegimeAnterieurDegressif)(immo.dateMiseEnService);
        const natureBareme = this.natureBareme(immo.natureFiscaleCle);
        if (!immo.degressifFiscal) {
            return { degressifFiscal: false, categories: amortissement_degressif_1.CATEGORIES_ARTICLE_31, lignes: [], cumulDerogatoire: 0, regimeAnterieur, natureBareme };
        }
        const { exercices, plan } = regimeAnterieur ? { exercices: [], plan: [] } : await this.plan(tenantId, immo);
        const lignes = plan.map((l) => {
            const e = exercices.find((x) => x.id === l.exerciceId);
            const comptable = immo.dotations.find((d) => d.exerciceId === l.exerciceId);
            const passe = immo.derogatoires.find((d) => d.exerciceId === l.exerciceId && d.nature === client_1.NatureDerogatoire.EXERCICE);
            return {
                exerciceId: l.exerciceId,
                dateDebut: e.dateDebut,
                dateFin: e.dateFin,
                valeurResiduelleDebut: l.valeurResiduelleDebut,
                annuiteFiscale: l.annuite,
                mode: l.mode,
                dotationComptable: comptable ? n(comptable.montant) : null,
                derogatoire: passe
                    ? { dotation: n(passe.dotation), reprise: n(passe.reprise), excedentAReintegrer: n(passe.excedentAReintegrer) }
                    : null,
            };
        });
        return {
            degressifFiscal: true,
            amortissementExceptionnel: immo.amortissementExceptionnel,
            prorataExport: immo.amortissementExceptionnel && immo.chiffreAffairesTotalHt != null && n(immo.chiffreAffairesTotalHt) > 0
                ? Math.round((n(immo.chiffreAffairesExportHt) / n(immo.chiffreAffairesTotalHt)) * 10000) / 10000
                : null,
            sourceChiffreAffairesExport: immo.sourceChiffreAffairesExport,
            categorie: immo.categorieDegressif,
            dureeFiscaleAns: immo.dureeFiscaleAns,
            coefficient: (0, amortissement_degressif_1.coefficientDegressif)(immo.dureeFiscaleAns ?? 0),
            categories: amortissement_degressif_1.CATEGORIES_ARTICLE_31,
            lignes,
            cumulDerogatoire: this.cumul(immo.derogatoires),
            regimeAnterieur,
            natureBareme,
            avertissements: (0, amortissement_degressif_1.avertissementsDureeFiscale)({ natureFiscaleCle: immo.natureFiscaleCle, dureeFiscaleAns: immo.dureeFiscaleAns }),
        };
    }
    async opter(tenantId, id, dto) {
        const immo = await this.immo(tenantId, id);
        if (immo.degressifFiscal)
            throw new common_1.ConflictException('Le dégressif fiscal est déjà retenu pour ce bien.');
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, formeJuridiqueSyscohada: true, systemeComptableSyscohada: true },
        });
        const refusSmt = (0, systeme_minimal_1.motifRefusAmortissementNonLineaireSmt)(tenant, 'Le dégressif fiscal et son amortissement dérogatoire');
        if (refusSmt)
            throw new common_1.BadRequestException(refusSmt);
        const refus = (0, amortissement_degressif_1.motifRefusOptionDegressif)({
            referentiel: tenant.referentiel,
            personnePhysique: !!tenant.formeJuridiqueSyscohada && correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(tenant.formeJuridiqueSyscohada),
            numeroCompteImmobilisation: immo.compteImmobilisation.numero,
            categorie: dto.categorie,
            bienNeuf: dto.bienNeuf,
            dureeFiscaleAns: dto.dureeFiscaleAns,
            amortissementAnterieur: n(immo.amortissementAnterieur),
            dotationsPassees: immo.dotations.length,
            dateMiseEnService: immo.dateMiseEnService,
            exceptionnel: dto.exceptionnel
                ? {
                    activiteIndustrielle: dto.activiteIndustrielle,
                    chiffreAffairesExportHt: dto.chiffreAffairesExportHt,
                    chiffreAffairesTotalHt: dto.chiffreAffairesTotalHt,
                    source: dto.sourceChiffreAffaires,
                }
                : null,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const retenu = await this.prisma.immobilisation.update({
            where: { id: immo.id },
            data: {
                degressifFiscal: true,
                categorieDegressif: dto.categorie,
                dureeFiscaleAns: dto.dureeFiscaleAns,
                optionDegressifLe: new Date(),
                ...(dto.exceptionnel
                    ? {
                        amortissementExceptionnel: true,
                        chiffreAffairesExportHt: dto.chiffreAffairesExportHt,
                        chiffreAffairesTotalHt: dto.chiffreAffairesTotalHt,
                        sourceChiffreAffairesExport: dto.sourceChiffreAffaires.trim(),
                    }
                    : {}),
            },
            select: { id: true, degressifFiscal: true, categorieDegressif: true, dureeFiscaleAns: true, amortissementExceptionnel: true },
        });
        return { ...retenu, avertissements: (0, amortissement_degressif_1.avertissementsDureeFiscale)({ natureFiscaleCle: immo.natureFiscaleCle, dureeFiscaleAns: dto.dureeFiscaleAns }) };
    }
    async enregistrer(tenantId, ecritureId, creer, dejaPasse) {
        try {
            return await creer();
        }
        catch (err) {
            if (ecritureId)
                await this.ecritures.retirerCompensation(tenantId, ecritureId);
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
                throw new common_1.ConflictException(dejaPasse);
            throw err;
        }
    }
    async compte(tenantId, numero) {
        const c = await this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero } }, select: { id: true } });
        if (!c)
            throw new common_1.BadRequestException(`Compte ${numero} introuvable dans le plan du dossier.`);
        return c.id;
    }
    async passer(tenantId, userId, id, dto) {
        const immo = await this.immo(tenantId, id);
        if (!immo.degressifFiscal)
            throw new common_1.BadRequestException("Ce bien n'a pas l'option du dégressif fiscal.");
        if (!immo.dateMiseEnService) {
            throw new common_1.BadRequestException("Ce bien n'est pas encore mis en service · aucun dérogatoire avant sa mise en service (loi n° 23/053, art. 34). Indiquez sa date de mise en service depuis la liste des biens.");
        }
        const regime = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, systemeComptableSyscohada: true },
        });
        const refusSmt = (0, systeme_minimal_1.motifRefusAmortissementNonLineaireSmt)(regime, 'Un nouvel amortissement dérogatoire');
        if (refusSmt)
            throw new common_1.BadRequestException(refusSmt);
        const anterieur = (0, amortissement_degressif_1.motifRegimeAnterieurDegressif)(immo.dateMiseEnService);
        if (anterieur)
            throw new common_1.BadRequestException(anterieur);
        const { plan } = await this.plan(tenantId, immo);
        const rang = plan.findIndex((l) => l.exerciceId === dto.exerciceId);
        if (rang < 0)
            throw new common_1.BadRequestException("Cet exercice n'est pas dans le plan fiscal du bien.");
        const passes = immo.derogatoires.filter((d) => d.nature === client_1.NatureDerogatoire.EXERCICE);
        if (passes.some((d) => d.exerciceId === dto.exerciceId)) {
            throw new common_1.ConflictException('Le dérogatoire de cet exercice est déjà passé.');
        }
        const manquant = plan.slice(0, rang).find((l) => !passes.some((d) => d.exerciceId === l.exerciceId));
        if (manquant) {
            throw new common_1.BadRequestException("Le dérogatoire d'un exercice antérieur du plan n'est pas passé · les exercices se traitent dans l'ordre.");
        }
        const comptable = immo.dotations.find((d) => d.exerciceId === dto.exerciceId);
        if (!comptable) {
            throw new common_1.BadRequestException("Passez d'abord la dotation comptable de l'exercice · le dérogatoire est l'écart entre l'annuité fiscale et elle.");
        }
        const annuite = plan[rang].annuite;
        const d = (0, amortissement_degressif_1.derogatoireDeLExercice)(annuite, n(comptable.montant), this.cumul(immo.derogatoires));
        const exercice = await this.prisma.exercice.findFirstOrThrow({ where: { id: dto.exerciceId, tenantId } });
        let ecritureId = null;
        if (d.dotation > 0 || d.reprise > 0) {
            const c151 = await this.compte(tenantId, amortissement_degressif_1.COMPTES_DEROGATOIRE.amortissementsDerogatoires);
            const contrepartie = await this.compte(tenantId, d.dotation > 0 ? amortissement_degressif_1.COMPTES_DEROGATOIRE.dotationsHao : amortissement_degressif_1.COMPTES_DEROGATOIRE.reprisesHao);
            const montant = d.dotation > 0 ? d.dotation : d.reprise;
            const ecriture = await this.ecritures.creer(tenantId, userId, {
                exerciceId: dto.exerciceId,
                journalId: dto.journalId,
                date: exercice.dateFin.toISOString().slice(0, 10),
                libelle: `${d.dotation > 0 ? 'Dotation' : 'Reprise'} amortissement dérogatoire · ${immo.designation}`.slice(0, 190),
                lignes: d.dotation > 0
                    ? [
                        { compteId: contrepartie, debit: montant, credit: 0 },
                        { compteId: c151, debit: 0, credit: montant },
                    ]
                    : [
                        { compteId: c151, debit: montant, credit: 0 },
                        { compteId: contrepartie, debit: 0, credit: montant },
                    ],
            });
            ecritureId = ecriture.id;
        }
        return this.enregistrer(tenantId, ecritureId, () => this.prisma.amortissementDerogatoire.create({
            data: {
                tenantId,
                immobilisationId: immo.id,
                exerciceId: dto.exerciceId,
                nature: client_1.NatureDerogatoire.EXERCICE,
                annuiteFiscale: annuite,
                dotationComptable: n(comptable.montant),
                dotation: d.dotation,
                reprise: d.reprise,
                excedentAReintegrer: d.excedentAReintegrer,
                ecritureId,
            },
        }), 'Le dérogatoire de cet exercice est déjà passé.');
    }
    async solder(tenantId, userId, id, dto) {
        const immo = await this.immo(tenantId, id);
        const cumul = this.cumul(immo.derogatoires);
        if (!(cumul > 0))
            throw new common_1.BadRequestException("Aucun amortissement dérogatoire n'est à reprendre sur ce bien.");
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: exercice.dateFin.toISOString().slice(0, 10),
            libelle: `Reprise du solde de l'amortissement dérogatoire · ${immo.designation}`.slice(0, 190),
            lignes: [
                { compteId: await this.compte(tenantId, amortissement_degressif_1.COMPTES_DEROGATOIRE.amortissementsDerogatoires), debit: cumul, credit: 0 },
                { compteId: await this.compte(tenantId, amortissement_degressif_1.COMPTES_DEROGATOIRE.reprisesHao), debit: 0, credit: cumul },
            ],
        });
        return this.enregistrer(tenantId, ecriture.id, () => this.prisma.amortissementDerogatoire.create({
            data: {
                tenantId,
                immobilisationId: immo.id,
                exerciceId: dto.exerciceId,
                nature: client_1.NatureDerogatoire.SOLDE_SORTIE,
                annuiteFiscale: 0,
                dotationComptable: 0,
                dotation: 0,
                reprise: cumul,
                excedentAReintegrer: 0,
                ecritureId: ecriture.id,
            },
        }), 'Le solde du dérogatoire de ce bien est déjà repris sur cet exercice.');
    }
};
exports.DegressifService = DegressifService;
exports.DegressifService = DegressifService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], DegressifService);
//# sourceMappingURL=degressif.service.js.map