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
exports.RepriseSubventionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const comptes_du_bien_1 = require("./comptes-du-bien");
const reprise_subvention_1 = require("./reprise-subvention");
const partie_remplacee_1 = require("./partie-remplacee");
const n = (v) => Number(v ?? 0);
const centimes = (x) => Math.round(x * 100) / 100;
let RepriseSubventionService = class RepriseSubventionService {
    constructor(prisma, ecritures) {
        this.prisma = prisma;
        this.ecritures = ecritures;
    }
    async lister(tenantId, exerciceId) {
        const PLAFOND = 200;
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const racines = reprise_subvention_1.FONDS_REPRIS[referentiel].map((f) => f.racine);
        const biens = await this.prisma.immobilisation.findMany({
            where: {
                tenantId,
                OR: [
                    {
                        ecritureAcquisition: {
                            lignes: { some: { credit: { gt: 0 }, OR: racines.map((r) => ({ compte: { numero: { startsWith: r } } })) } },
                        },
                    },
                    { subventions: { some: {} } },
                ],
            },
            select: { id: true },
            orderBy: { dateAcquisition: 'asc' },
            take: PLAFOND + 1,
        });
        const retenus = biens.slice(0, PLAFOND);
        const propositions = [];
        for (const b of retenus)
            propositions.push({ id: b.id, ...(await this.proposer(tenantId, b.id, exerciceId)) });
        return { biens: propositions, tronque: biens.length > PLAFOND };
    }
    async proposer(tenantId, immobilisationId, exerciceId, dureeInalienabiliteAns) {
        const immo = await this.prisma.immobilisation.findFirst({
            where: { id: immobilisationId, tenantId },
            select: {
                id: true,
                designation: true,
                valeurOrigine: true,
                statut: true,
                dateSortie: true,
                ecritureAcquisitionId: true,
                amortissementAnterieur: true,
                amortissementsDetaches: true,
                reprisesAmortissement: true,
                amortissementsReevaluation: true,
                dureeNonLimitee: true,
                degressifFiscal: true,
                compteImmobilisation: { select: { numero: true } },
                dotations: { select: { montant: true, exerciceId: true, exercice: { select: { dateDebut: true } } } },
                depreciations: { select: { sens: true, montant: true, exerciceId: true, exercice: { select: { dateDebut: true } } } },
                derogatoires: { select: { nature: true, dotation: true, reprise: true, exerciceId: true, exercice: { select: { dateDebut: true } } } },
                reprisesSubvention: { select: { exerciceId: true, montant: true, nature: true } },
                subventions: {
                    select: {
                        compteSubventionId: true,
                        montant: true,
                        dureeInalienabiliteAns: true,
                        compteSubvention: { select: { numero: true } },
                        reductions: { select: { montant: true, exercice: { select: { dateDebut: true } } } },
                    },
                },
            },
        });
        if (!immo)
            throw new common_1.NotFoundException('Immobilisation introuvable');
        const [exercice, { referentiel, methodeDepreciationBienSubventionne }] = await Promise.all([
            this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } }),
            this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { referentiel: true, methodeDepreciationBienSubventionne: true },
            }),
        ]);
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const lignesAcquisition = immo.ecritureAcquisitionId
            ? await this.prisma.ligneEcriture.findMany({
                where: { ecritureId: immo.ecritureAcquisitionId, ecriture: { tenantId } },
                select: { compteId: true, credit: true, debit: true, compte: { select: { numero: true } } },
                take: 50,
            })
            : [];
        const avecFonds = lignesAcquisition
            .map((l) => ({ l, fonds: (0, reprise_subvention_1.fondsDuCompte)(referentiel, l.compte.numero) }))
            .filter((x) => !!x.fonds);
        const rattachees = immo.subventions ?? [];
        const vide = (motif) => ({ subvention: 0, cumulRepris: 0, montant: 0, nature: 'EXERCICE', motif, comptes14: [], fonds: null, designation: immo.designation, dateFin: exercice.dateFin, dateSortie: immo.dateSortie });
        if (avecFonds.length > 0 && rattachees.length > 0) {
            return vide("Le bien est entré par un fonds et porte aussi une subvention rattachée · la reprise ne se propose pas, elle se passe à la main.");
        }
        const regles = new Set(avecFonds.map((x) => x.fonds.regle));
        if (regles.size > 1) {
            return vide("L'acquisition porte plusieurs natures de fonds · la reprise ne se propose pas, elle se passe à la main.");
        }
        const fonds = rattachees.length > 0 ? reprise_subvention_1.FONDS_REPRIS[referentiel][0] : (avecFonds[0]?.fonds ?? null);
        const parCompte = new Map();
        for (const { l } of avecFonds) {
            const m = n(l.credit) - n(l.debit);
            const c = parCompte.get(l.compteId) ?? { numero: l.compte.numero, montant: 0 };
            c.montant = centimes(c.montant + m);
            parCompte.set(l.compteId, c);
        }
        let reductions = 0;
        for (const r of rattachees) {
            const red = centimes(r.reductions.filter((x) => x.exercice.dateDebut <= exercice.dateDebut).reduce((t, x) => t + n(x.montant), 0));
            reductions = centimes(reductions + red);
            const c = parCompte.get(r.compteSubventionId) ?? { numero: r.compteSubvention.numero, montant: 0 };
            c.montant = centimes(c.montant + n(r.montant) - red);
            parCompte.set(r.compteSubventionId, c);
        }
        const subvention = centimes(rattachees.length > 0
            ? rattachees.reduce((t, r) => t + n(r.montant), 0)
            : [...parCompte.values()].reduce((t, c) => t + c.montant, 0));
        if (subvention <= 0) {
            return vide("Ce bien n'est pas entré par un fonds qui se reprend (subvention, don ou legs, usufruit).");
        }
        const dureeInalienabilite = dureeInalienabiliteAns ?? rattachees.find((r) => r.dureeInalienabiliteAns)?.dureeInalienabiliteAns ?? null;
        const sorti = immo.statut !== client_1.StatutImmobilisation.EN_SERVICE &&
            !!immo.dateSortie &&
            immo.dateSortie >= exercice.dateDebut &&
            immo.dateSortie <= exercice.dateFin;
        const cumulRepris = centimes(immo.reprisesSubvention.reduce((t, r) => t + n(r.montant), 0));
        const avant = (x) => x.exerciceId !== exerciceId && x.exercice.dateDebut < exercice.dateDebut;
        const dotationExercice = immo.dotations.find((d) => d.exerciceId === exerciceId);
        const derogatoires = immo.derogatoires ?? [];
        const derogatoireExercice = derogatoires.find((d) => d.exerciceId === exerciceId && d.nature === 'EXERCICE');
        const resteAAmortirOuverture = centimes(n(immo.valeurOrigine) -
            (0, partie_remplacee_1.amortissementsHorsDotations)(immo) -
            immo.dotations.filter(avant).reduce((t, d) => t + n(d.montant), 0) -
            derogatoires.filter(avant).reduce((t, d) => t + n(d.dotation) - n(d.reprise), 0) -
            immo.depreciations.filter(avant).reduce((t, d) => t + (d.sens === 'DOTATION' ? n(d.montant) : -n(d.montant)), 0));
        const proposition = (0, reprise_subvention_1.proposerReprise)({
            subvention,
            valeurOrigine: n(immo.valeurOrigine),
            amortissable: !(0, comptes_du_bien_1.motifNonAmortissable)(immo.compteImmobilisation.numero, referentiel) && !immo.dureeNonLimitee,
            dotationExercice: dotationExercice ? n(dotationExercice.montant) : null,
            cumulRepris,
            sorti,
            dureeInalienabiliteAns: dureeInalienabilite,
            regle: fonds?.regle,
            depreciationExercice: centimes(immo.depreciations.filter((d) => d.exerciceId === exerciceId && d.sens === 'DOTATION').reduce((t, d) => t + n(d.montant), 0)),
            reductions,
            resteAAmortirOuverture,
            derogatoireNetExercice: derogatoireExercice ? centimes(n(derogatoireExercice.dotation) - n(derogatoireExercice.reprise)) : 0,
            exercicesRepris: immo.reprisesSubvention.filter((r) => r.nature === 'EXERCICE' && r.exerciceId !== exerciceId).length,
            methodeDepreciation: methodeDepreciationBienSubventionne ?? null,
        });
        const derogatoireAttendu = fonds?.regle === 'SUBVENTION' && immo.degressifFiscal && !sorti && !!dotationExercice && !derogatoireExercice;
        const dejaPassee = immo.reprisesSubvention.some((r) => r.exerciceId === exerciceId);
        const sortiAvant = immo.statut !== client_1.StatutImmobilisation.EN_SERVICE && !sorti;
        const motif = dejaPassee
            ? 'La reprise de cet exercice est déjà passée.'
            : sortiAvant
                ? 'Le bien est sorti avant cet exercice.'
                : derogatoireAttendu
                    ? "Passez d'abord l'amortissement dérogatoire de l'exercice · la reprise suit la dotation globale (AUDCIF Titre VIII ch. 17 § 3.2)."
                    : proposition.motif;
        return {
            subvention,
            cumulRepris,
            montant: motif ? 0 : proposition.montant,
            nature: proposition.nature,
            motif,
            reserve: proposition.reserve ?? null,
            reductions,
            comptes14: [...parCompte.entries()].filter(([, c]) => c.montant > 0).map(([compteId, c]) => ({ compteId, ...c })),
            fonds,
            designation: immo.designation,
            dateFin: exercice.dateFin,
            dateSortie: immo.dateSortie,
        };
    }
    async passer(tenantId, userId, immobilisationId, dto) {
        const p = await this.proposer(tenantId, immobilisationId, dto.exerciceId, dto.dureeInalienabiliteAns);
        if (p.motif)
            throw new common_1.BadRequestException(p.motif);
        if (!(p.montant > 0))
            throw new common_1.BadRequestException('Rien à reprendre pour cet exercice.');
        const compteReprise = p.fonds.compteReprise;
        const c799 = await this.prisma.compte.findUnique({
            where: { tenantId_numero: { tenantId, numero: compteReprise } },
            select: { id: true },
        });
        if (!c799)
            throw new common_1.BadRequestException(`Compte ${compteReprise} absent du plan du dossier · ouvrez-le avant la reprise.`);
        const debits = [];
        let reparti = 0;
        p.comptes14.forEach((c, i) => {
            const base = p.comptes14.reduce((t, x) => t + x.montant, 0);
            const part = i === p.comptes14.length - 1 ? centimes(p.montant - reparti) : centimes((p.montant * c.montant) / base);
            reparti = centimes(reparti + part);
            if (part > 0)
                debits.push({ compteId: c.compteId, debit: part, credit: 0 });
        });
        const date = (p.nature === 'SORTIE' && p.dateSortie ? p.dateSortie : p.dateFin).toISOString().slice(0, 10);
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date,
            libelle: `${p.fonds.libelle} · ${p.designation}`.slice(0, 190),
            lignes: [...debits, { compteId: c799.id, debit: 0, credit: p.montant }],
        });
        try {
            return await this.prisma.repriseSubventionImmobilisation.create({
                data: {
                    tenantId,
                    immobilisationId,
                    exerciceId: dto.exerciceId,
                    nature: p.nature,
                    montant: p.montant,
                    ecritureId: ecriture.id,
                    createdBy: userId,
                },
            });
        }
        catch (err) {
            await this.ecritures.retirerCompensation(tenantId, ecriture.id);
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('La reprise de cet exercice est déjà passée.');
            }
            throw err;
        }
    }
};
exports.RepriseSubventionService = RepriseSubventionService;
exports.RepriseSubventionService = RepriseSubventionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], RepriseSubventionService);
//# sourceMappingURL=reprise-subvention.service.js.map