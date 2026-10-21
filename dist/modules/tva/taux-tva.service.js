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
var TauxTvaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TauxTvaService = exports.MOTIF_GROUPE_TROP_LONG = exports.MOTIF_A_NOUVEAU_AMBIGU = exports.SELECT_LIGNE_D_ORIGINE = void 0;
exports.repartirAuCentime = repartirAuCentime;
const common_1 = require("@nestjs/common");
const references_1 = require("../../common/suppression/references");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const prisma_service_1 = require("../../common/prisma.service");
const taux_tva_seed_1 = require("./taux-tva-seed");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const paires_a_cheval_1 = require("../lettrage/paires-a-cheval");
const creances_douteuses_1 = require("../creances-douteuses/creances-douteuses");
const periode_autorisation_debits_1 = require("../tiers/periode-autorisation-debits");
const imputation_paiements_1 = require("./imputation-paiements");
const EPSILON = 0.005;
const RACINE_COLLECTEE = '443';
const RACINE_RECUPERABLE = '445';
const FILTRE_LIGNES_D_AVOIR = {
    OR: [
        { debit: { gt: 0 }, compte: { numero: { startsWith: RACINE_COLLECTEE } } },
        { credit: { gt: 0 }, compte: { numero: { startsWith: RACINE_RECUPERABLE } } },
    ],
};
exports.SELECT_LIGNE_D_ORIGINE = {
    id: true,
    compteId: true,
    libelle: true,
    dateEcheance: true,
    deviseId: true,
    montantDevise: true,
    debit: true,
    credit: true,
    lettrageId: true,
    ecriture: {
        select: {
            id: true,
            libelle: true,
            date: true,
            createdAt: true,
            numeroPiece: true,
            statut: true,
            estANouveauProvisoire: true,
            estGenereeParCloture: true,
            corrigeEcritureId: true,
            _count: { select: { lignes: { where: FILTRE_LIGNES_D_AVOIR } } },
        },
    },
};
const PLAFOND_ORIGINES = 1000;
const TOURS_DE_LECTURE = 64;
const NATURE_COLLECTEE_SYSCOHADA = [
    ['4431', 'BIENS'],
    ['4432', 'SERVICES'],
    ['4433', 'SERVICES'],
    ['4434', 'BIENS'],
];
const NATURE_RECUPERABLE_SYSCOHADA = [
    ['4452', 'BIENS'],
    ['4453', 'SERVICES'],
    ['4454', 'SERVICES'],
];
const NATURE_CONTREPARTIE_PRODUITS_SYSCOHADA = [
    ['701', 'BIENS'],
    ['702', 'BIENS'],
    ['703', 'BIENS'],
    ['704', 'BIENS'],
    ['705', 'SERVICES'],
    ['706', 'SERVICES'],
    ['707', 'INDETERMINEE'],
    ['7072', 'SERVICES'],
    ['7073', 'SERVICES'],
    ['7074', 'BIENS'],
    ['7075', 'SERVICES'],
    ['7076', 'SERVICES'],
    ['7077', 'SERVICES'],
    ['72', 'BIENS'],
];
const NATURE_CONTREPARTIE_CHARGES = [
    ['60', 'BIENS'],
    ['6051', 'SERVICES'],
    ['6052', 'SERVICES'],
    ['6053', 'SERVICES'],
    ['6057', 'SERVICES'],
    ['6058', 'INDETERMINEE'],
    ['61', 'SERVICES'],
    ['62', 'SERVICES'],
    ['6234', 'BIENS'],
    ['63', 'SERVICES'],
    ['2', 'INDETERMINEE'],
];
const NATURE_CONTREPARTIE_CHARGES_SYCEBNL = [
    ['601', 'INDETERMINEE'],
];
const RACINES_HORS_DENOMINATEUR_COMMUNES = [
    '72',
    '7582',
    '799',
];
const RACINES_HORS_DENOMINATEUR_SYSCOHADA = ['754'];
const EXCLUSIONS_ART_41 = [
    ['6383', '6383 Réceptions'],
    ['6384', '6384 Missions'],
    ['6181', '6181 Voyages et déplacements'],
];
const EXCLUSIONS_ART_41_A_VERIFIER = [
    [
        '6276',
        '6276 Cadeaux à la clientèle (art. 41, 7° · sauf objets publicitaires dont la valeur unitaire est inférieure à ' +
            '10 000,00 FC, décret n° 011/42 art. 107)',
    ],
    ['6140', '6140 Transports du personnel (art. 42, 2° · sauf contrat permanent de transport du personnel)'],
    ['6042', '6042 Matières combustibles (art. 41, 3°, 3° bis et 3° ter · produits pétroliers, exceptions et limite de 50 %)'],
];
function repartirAuCentime(total, bruts, ratio) {
    const rendu = new Map();
    let somme = 0;
    let plusLourd = null;
    for (const [compteId, brut] of bruts) {
        const part = Math.round(brut * ratio * 100) / 100;
        rendu.set(compteId, part);
        somme += part;
        if (plusLourd === null || Math.abs(brut) > Math.abs(bruts.get(plusLourd)))
            plusLourd = compteId;
    }
    const reste = Math.round((total - somme) * 100) / 100;
    if (Math.abs(reste) > 0.01 * (bruts.size + 1)) {
        throw new Error(`Répartition de la TVA déductible incohérente · ${reste} d'écart entre la déclaration et ses comptes.`);
    }
    if (plusLourd !== null && Math.abs(reste) > 0)
        rendu.set(plusLourd, Math.round((rendu.get(plusLourd) + reste) * 100) / 100);
    return rendu;
}
exports.MOTIF_A_NOUVEAU_AMBIGU = 'plusieurs à-nouveaux candidats, rapprochement non fait';
exports.MOTIF_GROUPE_TROP_LONG = `groupe de lettrage de plus de ${500} lignes, rapprochement non fait`;
const PLAFOND_LIGNES_GROUPE = 500;
let TauxTvaService = TauxTvaService_1 = class TauxTvaService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    async seedTauxDefaut(tenantId, referentiel, client = this.prisma) {
        for (const t of (0, taux_tva_seed_1.tauxTvaDefaut)(referentiel)) {
            const compteCollecte = t.numeroCompteCollecte
                ? await client.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: t.numeroCompteCollecte } } })
                : null;
            const compteDeductible = t.numeroCompteDeductible
                ? await client.compte.findUnique({ where: { tenantId_numero: { tenantId, numero: t.numeroCompteDeductible } } })
                : null;
            await client.tauxTva.upsert({
                where: { tenantId_code: { tenantId, code: t.code } },
                update: {},
                create: {
                    tenantId,
                    code: t.code,
                    intitule: t.intitule,
                    taux: t.taux,
                    compteCollecteId: compteCollecte?.id,
                    compteDeductibleId: compteDeductible?.id,
                },
            });
        }
    }
    async lister(tenantId, actifsSeuls) {
        return this.prisma.tauxTva.findMany({
            where: { tenantId, ...(actifsSeuls ? { estActif: true } : {}) },
            include: { compteCollecte: true, compteDeductible: true },
            orderBy: { taux: 'desc' },
        });
    }
    async trouver(tenantId, id) {
        const taux = await this.prisma.tauxTva.findFirst({ where: { id, tenantId } });
        if (!taux) {
            throw new common_1.NotFoundException('Taux de TVA introuvable pour ce tenant');
        }
        return taux;
    }
    async verifierComptes(tenantId, dto) {
        for (const compteId of [dto.compteCollecteId, dto.compteDeductibleId]) {
            if (!compteId)
                continue;
            const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
            if (!compte) {
                throw new common_1.NotFoundException('Compte introuvable pour ce tenant');
            }
        }
    }
    async creer(tenantId, dto) {
        const existant = await this.prisma.tauxTva.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
        if (existant) {
            throw new common_1.ConflictException(`Le taux de TVA ${dto.code} existe déjà pour ce tenant`);
        }
        await this.verifierComptes(tenantId, dto);
        return this.prisma.tauxTva.create({ data: { ...dto, tenantId } });
    }
    async supprimer(tenantId, id) {
        const taux = await this.prisma.tauxTva.findFirst({ where: { id, tenantId } });
        if (!taux)
            throw new common_1.NotFoundException('Taux introuvable pour ce dossier.');
        (0, references_1.refuserSiReferences)(`Le taux ${taux.code}`, await (0, references_1.referencesVers)(this.prisma, 'TauxTva', taux.id, tenantId));
        await this.prisma.tauxTva.delete({ where: { id: taux.id } });
        return { supprime: true };
    }
    async modifier(tenantId, id, dto) {
        const actuel = await this.trouver(tenantId, id);
        if (dto.taux !== undefined && Number(dto.taux) !== Number(actuel.taux)) {
            const [lignesEcriture, lignesFacture] = await Promise.all([
                this.prisma.ligneEcriture.count({ where: { tauxTvaId: id, ecriture: { tenantId } } }),
                this.prisma.ligneFacture.count({ where: { tauxTvaId: id, facture: { tenantId } } }),
            ]);
            if (lignesEcriture + lignesFacture > 0) {
                throw new common_1.ConflictException(`Le taux ${actuel.code} porte déjà ${lignesEcriture} ligne(s) d'écriture et ${lignesFacture} ligne(s) de facture · ` +
                    'changer son pourcentage réécrirait les prorata et les pièces des périodes passées. Créez un nouveau taux et ' +
                    'mettez celui-ci en sommeil.');
            }
        }
        await this.verifierComptes(tenantId, dto);
        return this.prisma.tauxTva.update({ where: { id }, data: dto });
    }
    static c(n) {
        return Math.round(n * 100) / 100;
    }
    racinesHorsDenominateur(referentiel) {
        return referentiel === client_1.Referentiel.SYSCOHADA
            ? [...RACINES_HORS_DENOMINATEUR_COMMUNES, ...RACINES_HORS_DENOMINATEUR_SYSCOHADA]
            : [...RACINES_HORS_DENOMINATEUR_COMMUNES];
    }
    async calculerProrata(tenantId, dateDebut, dateFin) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const racinesExclues = this.racinesHorsDenominateur(tenant?.referentiel);
        const filtreExclusions = racinesExclues.map((r) => ({ numero: { startsWith: r } }));
        let numerateur = 0;
        const ecrituresTauxZero = new Set();
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ligneEcriture.findMany({
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
            where: {
                tauxTvaId: { not: null },
                compte: { numero: { startsWith: RACINE_COLLECTEE } },
                ecriture: { tenantId, statut: client_1.StatutEcriture.VALIDEE, date: { gte: dateDebut, lte: dateFin } },
            },
            select: {
                id: true,
                credit: true,
                ecritureId: true,
                compte: { select: { numero: true } },
                tauxTva: { select: { taux: true } },
            },
        }), (l) => {
            if (this.estLivraisonASoiMeme(tenant?.referentiel, l.compte.numero))
                return;
            const taux = Number(l.tauxTva?.taux ?? 0);
            if (taux <= EPSILON) {
                ecrituresTauxZero.add(l.ecritureId);
                return;
            }
            numerateur += Number(l.credit) / (taux / 100);
        });
        if (ecrituresTauxZero.size > 0) {
            const agg = await this.prisma.ligneEcriture.aggregate({
                where: {
                    compte: {
                        tenantId,
                        classe: client_1.ClasseCompte.CLASSE_7,
                        ...(filtreExclusions.length > 0 ? { NOT: filtreExclusions } : {}),
                    },
                    ecritureId: { in: [...ecrituresTauxZero] },
                },
                _sum: { credit: true },
            });
            numerateur += Number(agg._sum.credit ?? 0);
        }
        const recettesDeLaPeriode = {
            tenantId,
            statut: client_1.StatutEcriture.VALIDEE,
            date: { gte: dateDebut, lte: dateFin },
            estSoldeDesComptesDeGestion: false,
        };
        const [recettesAgg, exclusAgg, nonQualifieesAgg] = await Promise.all([
            this.prisma.ligneEcriture.aggregate({
                where: {
                    compte: { tenantId, classe: client_1.ClasseCompte.CLASSE_7 },
                    ecriture: recettesDeLaPeriode,
                },
                _sum: { credit: true },
            }),
            filtreExclusions.length === 0
                ? Promise.resolve({ _sum: { credit: 0 } })
                : this.prisma.ligneEcriture.aggregate({
                    where: {
                        compte: { tenantId, classe: client_1.ClasseCompte.CLASSE_7, OR: filtreExclusions },
                        ecriture: recettesDeLaPeriode,
                    },
                    _sum: { credit: true },
                }),
            this.prisma.ligneEcriture.aggregate({
                where: {
                    compte: {
                        tenantId,
                        classe: client_1.ClasseCompte.CLASSE_7,
                        ...(filtreExclusions.length > 0 ? { NOT: filtreExclusions } : {}),
                    },
                    ecriture: {
                        ...recettesDeLaPeriode,
                        lignes: { none: { tauxTvaId: { not: null }, compte: { numero: { startsWith: RACINE_COLLECTEE } } } },
                    },
                },
                _sum: { credit: true },
            }),
        ]);
        numerateur = TauxTvaService_1.c(numerateur);
        const recettesClasse7 = Number(recettesAgg._sum.credit ?? 0);
        const recettesExclues = Number(exclusAgg._sum.credit ?? 0);
        const recettesNonQualifiees = TauxTvaService_1.c(Number(nonQualifieesAgg._sum.credit ?? 0));
        const denominateur = TauxTvaService_1.c(recettesClasse7 - recettesExclues);
        const pourcentage = denominateur <= EPSILON
            ? 100
            : Math.min(100, Math.ceil(Math.round(((numerateur * 100) / denominateur) * 1e6) / 1e6));
        return {
            numerateur,
            denominateur,
            pourcentage,
            recettesClasse7,
            recettesExclues,
            recettesNonQualifiees,
            racinesExclues,
            mentionDenominateur: `Dénominateur : recettes de classe 7 (${recettesClasse7.toLocaleString('fr-FR')}) moins ` +
                `${recettesExclues.toLocaleString('fr-FR')} de recettes que l'article 43 en exclut (comptes ` +
                `${racinesExclues.join(', ')} · cessions d'actif immobilisé, subventions d'équipement, indemnités ` +
                "d'assurance, livraisons à soi-même). Les DÉBOURS, exclus eux aussi par l'article 43, n'ont de compte " +
                'dédié dans aucun des deux plans · s\'il y en a, les retrancher à la main.' +
                (recettesNonQualifiees > EPSILON
                    ? ` ${recettesNonQualifiees.toLocaleString('fr-FR')} de ces recettes ne portent AUCUNE ligne de TVA : ` +
                        "elles ne comptent qu'au dénominateur. L'article 43 met les EXPORTATIONS au numérateur, mais une " +
                        "vente au taux zéro n'est reconnue que si sa ligne de TVA existe · si ces recettes en comprennent, " +
                        'le prorata est sous-évalué.'
                    : ''),
        };
    }
    estLivraisonASoiMeme(referentiel, numeroCompte) {
        return referentiel === client_1.Referentiel.SYSCOHADA && numeroCompte.startsWith('4434');
    }
    async prorataApplicable(tenantId, dateDebut, dateFin) {
        const anneePrecedente = dateDebut.getUTCFullYear() - 1;
        const provisoire = await this.calculerProrata(tenantId, new Date(Date.UTC(anneePrecedente, 0, 1)), new Date(Date.UTC(anneePrecedente, 11, 31, 23, 59, 59, 999)));
        if (provisoire.denominateur > EPSILON) {
            return {
                ...provisoire,
                base: 'ANNEE_PRECEDENTE',
                anneeReference: anneePrecedente,
                mention: `Prorata provisoire de ${provisoire.pourcentage} %, calculé sur les recettes de ${anneePrecedente} ` +
                    "(article 45). Il s'applique à toutes les déclarations de l'année, et sera arrêté définitivement au plus " +
                    'tard le 31 mars suivant, avec régularisation des déductions déjà opérées.',
            };
        }
        const estime = await this.calculerProrata(tenantId, dateDebut, dateFin);
        return {
            ...estime,
            base: 'ESTIMATION_PERIODE',
            anneeReference: null,
            mention: `Aucune recette n'a été enregistrée en ${anneePrecedente} : le prorata provisoire ne peut pas être calculé ` +
                `sur l'année précédente comme le veut l'article 45. Celui appliqué ici (${estime.pourcentage} %) est une ` +
                'ESTIMATION sur la période déclarée, à régulariser lors de l’arrêté définitif du 31 mars.',
        };
    }
    async prorataDefinitif(tenantId, annee) {
        const debutAnnee = new Date(Date.UTC(annee, 0, 1));
        const finAnnee = new Date(Date.UTC(annee, 11, 31, 23, 59, 59, 999));
        const definitif = await this.calculerProrata(tenantId, debutAnnee, finAnnee);
        const brutAnnee = await this.tvaDeductibleBrute(tenantId, debutAnnee, finAnnee);
        const liquidations = await this.prisma.liquidationTva.findMany({
            where: { tenantId, dateDebut: { gte: debutAnnee }, dateFin: { lte: finAnnee } },
            orderBy: { dateDebut: 'asc' },
        });
        const periodes = [];
        let brutCouvert = 0;
        let admiseAppliquee = 0;
        for (const l of liquidations) {
            const brut = await this.tvaDeductibleBrute(tenantId, l.dateDebut, l.dateFin);
            const pourcentage = Number(l.prorataApplique);
            const deduite = TauxTvaService_1.c(brut * (pourcentage / 100));
            brutCouvert = TauxTvaService_1.c(brutCouvert + brut);
            admiseAppliquee = TauxTvaService_1.c(admiseAppliquee + deduite);
            periodes.push({
                dateDebut: l.dateDebut.toISOString().slice(0, 10),
                dateFin: l.dateFin.toISOString().slice(0, 10),
                pourcentageApplique: pourcentage,
                tvaDeductibleBrute: brut,
                deduite,
            });
        }
        const admiseDefinitive = TauxTvaService_1.c(brutCouvert * (definitif.pourcentage / 100));
        const regularisation = TauxTvaService_1.c(admiseDefinitive - admiseAppliquee);
        const pourcentageApplique = brutCouvert > EPSILON ? TauxTvaService_1.c((admiseAppliquee / brutCouvert) * 100) : 0;
        const tvaDeductibleNonLiquidee = TauxTvaService_1.c(brutAnnee - brutCouvert);
        const echeance = liquidations.length === 0
            ? `Aucune liquidation de TVA n'est comptabilisée pour ${annee} : aucune déduction opérée n'est tracée, ` +
                `et la régularisation de l'article 45 ne peut donc pas être chiffrée. Le prorata définitif ` +
                `${annee} ressort à ${definitif.pourcentage} % ; la TVA déductible brute de l'année est de ` +
                `${brutAnnee.toLocaleString('fr-FR')} CDF. À arrêter au plus tard le 31 mars ${annee + 1} (article 45).`
            : `À arrêter au plus tard le 31 mars ${annee + 1} (article 45). Régularisation calculée sur les ` +
                `${liquidations.length} période(s) réellement liquidée(s) et sur le prorata effectivement appliqué à ` +
                `chacune` +
                (tvaDeductibleNonLiquidee > EPSILON
                    ? `. ${tvaDeductibleNonLiquidee.toLocaleString('fr-FR')} CDF de TVA déductible de ${annee} ne sont ` +
                        "couverts par aucune liquidation : aucune déduction n'y a été opérée, ils ne sont donc pas " +
                        'régularisés ici.'
                    : '.');
        return {
            annee,
            definitif,
            pourcentageApplique,
            tvaDeductibleBrute: brutCouvert,
            tvaDeductibleBruteAnnee: brutAnnee,
            tvaDeductibleNonLiquidee,
            periodes,
            admiseDefinitive,
            admiseAppliquee,
            regularisation,
            sens: Math.abs(regularisation) <= EPSILON
                ? 'AUCUNE'
                : regularisation > 0
                    ? 'DEDUCTION_COMPLEMENTAIRE'
                    : 'REVERSEMENT',
            echeance,
        };
    }
    async tvaDeductibleBrute(tenantId, dateDebut, dateFin) {
        const comptes = (await this.prisma.compte.findMany({
            where: { tenantId, numero: { startsWith: RACINE_RECUPERABLE } },
            select: { id: true },
        })).map((c) => c.id);
        if (comptes.length === 0)
            return 0;
        const agg = await this.prisma.ligneEcriture.aggregate({
            where: {
                compteId: { in: comptes },
                ecriture: { tenantId, statut: client_1.StatutEcriture.VALIDEE, date: { gte: dateDebut, lte: dateFin } },
            },
            _sum: { debit: true, credit: true },
        });
        return TauxTvaService_1.c(Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0));
    }
    async tvaAuBrouillard(tenantId, idsTaux, dateDebut, dateFin) {
        if (idsTaux.length === 0)
            return { collecte: 0, deductible: 0, ecritures: 0 };
        const auBrouillard = { tenantId, statut: client_1.StatutEcriture.BROUILLARD, date: { gte: dateDebut, lte: dateFin } };
        const [collecte, deductible, ecritures] = await Promise.all([
            this.prisma.ligneEcriture.aggregate({
                where: { tauxTvaId: { in: idsTaux }, compte: { numero: { startsWith: RACINE_COLLECTEE } }, ecriture: auBrouillard },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ligneEcriture.aggregate({
                where: { tauxTvaId: { in: idsTaux }, compte: { numero: { startsWith: RACINE_RECUPERABLE } }, ecriture: auBrouillard },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ecriture.count({
                where: {
                    tenantId,
                    statut: client_1.StatutEcriture.BROUILLARD,
                    date: { gte: dateDebut, lte: dateFin },
                    lignes: { some: { tauxTvaId: { in: idsTaux } } },
                },
            }),
        ]);
        return {
            collecte: TauxTvaService_1.c(Number(collecte._sum.credit ?? 0) - Number(collecte._sum.debit ?? 0)),
            deductible: TauxTvaService_1.c(Number(deductible._sum.debit ?? 0) - Number(deductible._sum.credit ?? 0)),
            ecritures,
        };
    }
    exigibilite(ligne, lignesTiers, dateEcriture, nonLettre = { creance: 0, immediat: 0 }, partLettreeImposee) {
        const avecLettrage = lignesTiers.filter((l) => l.lettrage);
        if (avecLettrage.length === 0) {
            if (nonLettre.creance <= EPSILON)
                return [{ date: dateEcriture, fraction: 1 }];
            const total = nonLettre.creance + nonLettre.immediat;
            const fraction = Math.min(1, Math.max(0, nonLettre.immediat / total));
            if (fraction <= EPSILON)
                return [{ date: null, fraction: 1 }];
            return [
                { date: dateEcriture, fraction },
                { date: null, fraction: 1 - fraction },
            ];
        }
        const lettre = avecLettrage.reduce((t, l) => t + Math.abs(Number(l.debit) - Number(l.credit)), 0);
        const totalFacture = lettre + nonLettre.creance + nonLettre.immediat;
        const partLettree = partLettreeImposee ?? TauxTvaService_1.datesDuGroupeDeMain(avecLettrage, dateEcriture);
        if (totalFacture <= lettre + EPSILON)
            return partLettree;
        const k = lettre / totalFacture;
        const tranches = partLettree
            .filter((t) => t.date)
            .map((t) => ({ date: t.date, fraction: t.fraction * k }));
        if (nonLettre.immediat > EPSILON)
            tranches.push({ date: dateEcriture, fraction: nonLettre.immediat / totalFacture });
        const date = tranches.reduce((t, x) => t + x.fraction, 0);
        if (1 - date > EPSILON)
            tranches.push({ date: null, fraction: 1 - date });
        return tranches;
    }
    static datesDuGroupeDeMain(avecLettrage, dateEcriture) {
        const groupeLu = avecLettrage[0].lettrage;
        const nettes = groupeLu.lignes ? TauxTvaService_1.neutraliserLesNegatifs(groupeLu.lignes) : null;
        if (nettes && nettes.length !== groupeLu.lignes.length) {
            const ids = new Set(nettes.map((x) => x.id).filter(Boolean));
            const propres = avecLettrage.map((l) => l.id).filter((id) => !!id);
            if (propres.length > 0 && propres.every((id) => !ids.has(id)))
                return [{ date: null, fraction: 1 }];
        }
        const groupe = nettes && nettes.length !== groupeLu.lignes.length ? { ...groupeLu, lignes: nettes } : groupeLu;
        if (!nettes && groupeLu.lignes) {
            const sensF = avecLettrage.reduce((t, l) => t + (Number(l.debit) - Number(l.credit)), 0);
            const cent = (x) => Math.round(Number(x ?? 0) * 100);
            const propres = groupeLu.lignes.filter((x) => cent(x.debit) >= 0 && cent(x.credit) >= 0);
            const engageF = avecLettrage.reduce((t, l) => t + Math.abs(Number(l.debit) - Number(l.credit)), 0);
            if (engageF <= EPSILON)
                return [{ date: null, fraction: 1 }];
            const ordre = [...TauxTvaService_1.reglementsDuGroupe(propres, sensF)].sort((a, b) => a.date.getTime() - b.date.getTime());
            const tranches = [];
            let regle = 0;
            for (const r of ordre) {
                const part = Math.min(r.montant, engageF - regle);
                if (part <= EPSILON)
                    break;
                regle += part;
                tranches.push({ date: r.date, fraction: part / engageF });
            }
            if (regle < engageF - EPSILON)
                tranches.push({ date: null, fraction: 1 - regle / engageF });
            return tranches;
        }
        const sensFacture = avecLettrage.reduce((t, l) => t + (Number(l.debit) - Number(l.credit)), 0);
        const dateReglement = TauxTvaService_1.dateDernierReglement(groupe.lignes, sensFacture);
        const engage = avecLettrage.reduce((t, l) => t + Math.abs(Number(l.debit) - Number(l.credit)), 0);
        const reglements = TauxTvaService_1.reglementsDuGroupe(groupe.lignes, sensFacture);
        const factures = (groupe.lignes ?? []).reduce((t, g) => {
            const sens = Number(g.debit) - Number(g.credit);
            return Math.abs(sens) > EPSILON && sens > 0 === sensFacture > 0 ? t + Math.abs(sens) : t;
        }, 0);
        const seule = engage > EPSILON && factures <= engage + EPSILON;
        const avecAvoir = (groupe.lignes ?? []).some((g) => {
            const sens = Number(g.debit) - Number(g.credit);
            const avoirs = g.ecriture?._count?.lignes ?? 0;
            return Math.abs(sens) > EPSILON && sens > 0 !== sensFacture > 0 && avoirs > 0;
        });
        if (seule && !avecAvoir && reglements.length > 0) {
            const ordre = [...reglements].sort((a, b) => a.date.getTime() - b.date.getTime());
            const tranches = [];
            let regle = 0;
            for (const r of ordre) {
                const part = Math.min(r.montant, engage - regle);
                if (part <= EPSILON)
                    break;
                regle += part;
                tranches.push({ date: r.date, fraction: part / engage });
            }
            if (groupe.statut === 'SOLDE' && regle < engage - EPSILON && tranches.length > 0) {
                tranches[tranches.length - 1].fraction += (engage - regle) / engage;
                regle = engage;
            }
            if (tranches.length === 0)
                return [{ date: null, fraction: 1 }];
            if (regle < engage - EPSILON)
                tranches.push({ date: null, fraction: 1 - regle / engage });
            return tranches;
        }
        if (groupe.statut === 'SOLDE') {
            return [{ date: dateReglement ?? dateEcriture, fraction: 1 }];
        }
        const reste = Math.abs(Number(groupe.solde));
        if (engage <= EPSILON)
            return [{ date: null, fraction: 1 }];
        const fraction = Math.min(1, Math.max(0, (engage - reste) / engage));
        if (fraction <= EPSILON)
            return [{ date: null, fraction: 1 }];
        return [
            { date: dateReglement ?? dateEcriture, fraction },
            { date: null, fraction: 1 - fraction },
        ];
    }
    static groupeAPlusieursFactures(lignesTiers) {
        const avecLettrage = lignesTiers.filter((l) => l.lettrage);
        if (avecLettrage.length === 0)
            return null;
        const groupe = avecLettrage[0].lettrage;
        const id = groupe.id;
        if (!id || avecLettrage.some((l) => l.lettrage.id !== id))
            return null;
        const sensFacture = avecLettrage.reduce((t, l) => t + (Number(l.debit) - Number(l.credit)), 0);
        if (Math.abs(sensFacture) <= EPSILON)
            return null;
        const engage = avecLettrage.reduce((t, l) => t + Math.abs(Number(l.debit) - Number(l.credit)), 0);
        const factures = (groupe.lignes ?? []).reduce((t, g) => {
            const sens = Number(g.debit) - Number(g.credit);
            return Math.abs(sens) > EPSILON && sens > 0 === sensFacture > 0 ? t + Math.abs(sens) : t;
        }, 0);
        const avecReport = (groupe.lignes ?? []).some((g) => {
            const sens = Number(g.debit) - Number(g.credit);
            return Math.abs(sens) > EPSILON && !!(g.ecriture?.estGenereeParCloture || g.ecriture?.estANouveauProvisoire);
        });
        if (factures <= engage + EPSILON && !avecReport)
            return null;
        return { id, groupe, sensFacture, engage };
    }
    static facturesDuGroupe(lignes, sensFacture) {
        const rendu = new Map();
        for (const g of lignes ?? []) {
            const sens = Number(g.debit) - Number(g.credit);
            if (Math.abs(sens) <= EPSILON || sens > 0 !== sensFacture > 0)
                continue;
            const id = g.ecriture?.id;
            if (!id)
                return null;
            rendu.set(id, (rendu.get(id) ?? 0) + Math.abs(sens));
        }
        return rendu;
    }
    static fractionsDuGroupe(reglements, totalFactures, solde) {
        if (totalFactures <= EPSILON)
            return [{ date: null, fraction: 1 }];
        const ordre = [...reglements].sort((a, b) => a.date.getTime() - b.date.getTime());
        const tranches = [];
        let regle = 0;
        for (const r of ordre) {
            const part = Math.min(r.montant, totalFactures - regle);
            if (part <= EPSILON)
                break;
            regle += part;
            tranches.push({ date: r.date, fraction: part / totalFactures });
        }
        if (solde && regle < totalFactures - EPSILON && tranches.length > 0) {
            tranches[tranches.length - 1].fraction += (totalFactures - regle) / totalFactures;
            regle = totalFactures;
        }
        if (tranches.length === 0)
            return [{ date: null, fraction: 1 }];
        if (regle < totalFactures - EPSILON)
            tranches.push({ date: null, fraction: 1 - regle / totalFactures });
        return tranches;
    }
    static neutraliserLesNegatifs(lignes) {
        const toutes = [...(lignes ?? [])];
        const centimes = (x) => Math.round(Number(x ?? 0) * 100);
        const negative = (x) => centimes(x.debit) < 0 || centimes(x.credit) < 0;
        const negatives = toutes.filter(negative);
        if (negatives.length === 0)
            return toutes;
        const retirees = new Set();
        for (const n of negatives) {
            const annule = (x) => !retirees.has(x) &&
                !negative(x) &&
                (x.compteId ?? null) === (n.compteId ?? null) &&
                centimes(x.debit) === -centimes(n.debit) &&
                centimes(x.credit) === -centimes(n.credit);
            const corrigee = n.ecriture?.corrigeEcritureId ?? null;
            const partenaire = (corrigee ? toutes.find((x) => annule(x) && x.ecriture?.id === corrigee) : undefined) ?? toutes.find(annule);
            if (!partenaire)
                return null;
            retirees.add(n);
            retirees.add(partenaire);
        }
        return toutes.filter((x) => !retirees.has(x));
    }
    static lectureDuGroupe(traduit, sensFacture) {
        const neutralisees = TauxTvaService_1.neutraliserLesNegatifs(traduit.lignes);
        const lignes = neutralisees ?? [...(traduit.lignes ?? [])];
        const factures = TauxTvaService_1.facturesDuGroupe(lignes, sensFacture);
        const avecAvoir = lignes.some((g) => {
            const sens = Number(g.debit) - Number(g.credit);
            const avoirs = g.ecriture?._count?.lignes ?? 0;
            return Math.abs(sens) > EPSILON && sens > 0 !== sensFacture > 0 && avoirs > 0;
        });
        const aNouveauSansFacture = lignes.some((g) => {
            const sens = Number(g.debit) - Number(g.credit);
            return Math.abs(sens) > EPSILON && sens > 0 === sensFacture > 0 && !!(g.ecriture?.estGenereeParCloture || g.ecriture?.estANouveauProvisoire);
        });
        const motifEnBloc = traduit.motifLecture
            ? traduit.motifLecture
            : !neutralisees
                ? 'une inscription en négatif dans le groupe sans la ligne qu’elle annule'
                : avecAvoir
                    ? 'un avoir dans le groupe'
                    : !factures
                        ? 'une ligne du groupe sans écriture lisible'
                        : aNouveauSansFacture
                            ? 'une ligne d’à-nouveau du groupe dont la facture n’est pas retrouvée'
                            : null;
        return { lignes, factures, avecAvoir, motifEnBloc };
    }
    static imputerLeGroupe(groupe, sensFacture, factures, declarees = new Map(), periode) {
        const dettes = [];
        const ecritureDeLaDette = new Map();
        const paiements = [];
        const libelles = [];
        (groupe.lignes ?? []).forEach((g, i) => {
            const sens = Number(g.debit) - Number(g.credit);
            if (Math.abs(sens) <= EPSILON || !g.ecriture)
                return;
            const id = g.id ?? `ligne-${i}`;
            if (sens > 0 === sensFacture > 0) {
                if (!g.ecriture.id)
                    return;
                dettes.push({ id, dateFacture: g.ecriture.date, dateEcheance: g.dateEcheance ?? null, montant: Math.abs(sens) });
                ecritureDeLaDette.set(id, g.ecriture.id);
                if (g.ecriture.libelle && !libelles.includes(g.ecriture.libelle))
                    libelles.push(g.ecriture.libelle);
            }
            else {
                paiements.push({ id, date: g.ecriture.date, montant: Math.abs(sens) });
            }
        });
        const declareesPlates = paiements.flatMap((p) => (declarees.get(p.id) ?? []).map((d) => ({ paiementId: p.id, detteId: groupe.reportsVers?.get(d.detteId) ?? d.detteId, montant: d.montant })));
        const resultat = (0, imputation_paiements_1.imputerPaiements)(dettes, paiements, declareesPlates);
        const parEcriture = new Map();
        let declare = 0;
        let legal = 0;
        for (const d of dettes) {
            const e = ecritureDeLaDette.get(d.id);
            const parts = resultat.parDette.get(d.id) ?? [];
            for (const x of parts) {
                if (periode && (x.date < periode.debut || x.date > periode.fin))
                    continue;
                if (x.fondement === 'DECLAREE')
                    declare += x.montant;
                else
                    legal += x.montant;
            }
            parEcriture.set(e, [...(parEcriture.get(e) ?? []), ...parts.map((x) => ({ date: x.date, montant: x.montant }))]);
            const recu = parts.reduce((t, x) => t + x.montant, 0);
            const derniere = paiements.reduce((t, p) => (!t || p.date > t ? p.date : t), null);
            if (groupe.statut === 'SOLDE' && derniere && d.montant - recu > EPSILON) {
                parEcriture.get(e).push({ date: derniere, montant: d.montant - recu });
            }
        }
        return {
            libelles,
            fondement: declare > EPSILON ? (legal > EPSILON ? 'DECLAREE_EN_PARTIE' : 'DECLAREE') : 'LEGALE',
            declareNonRetenu: TauxTvaService_1.c(resultat.declareesRamenees
                .filter((x) => {
                const date = paiements.find((p) => p.id === x.paiementId)?.date;
                return !periode || (date !== undefined && date >= periode.debut && date <= periode.fin);
            })
                .reduce((t, x) => t + x.declare - x.retenu, 0)),
            partLettreeDe: (ecritureId) => {
                const engage = factures.get(ecritureId) ?? 0;
                if (engage <= EPSILON)
                    return [{ date: null, fraction: 1 }];
                const parts = [...(parEcriture.get(ecritureId) ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime());
                const tranches = [];
                let regle = 0;
                for (const x of parts) {
                    const part = Math.min(x.montant, engage - regle);
                    if (part <= EPSILON)
                        continue;
                    regle += part;
                    tranches.push({ date: x.date, fraction: part / engage });
                }
                if (regle < engage - EPSILON)
                    tranches.push({ date: null, fraction: 1 - regle / engage });
                return tranches.length > 0 ? tranches : [{ date: null, fraction: 1 }];
            },
        };
    }
    async imputerLesPaiementsNonRattaches(tenantId, paiements) {
        const resultat = new Map();
        const PLAFOND_FACTURES_OUVERTES = 200;
        const parCompte = new Map();
        for (const p of paiements) {
            const cle = `${p.compteId}|${p.ecriture.exerciceId}`;
            parCompte.set(cle, [...(parCompte.get(cle) ?? []), p]);
        }
        for (const lesPaiements of parCompte.values()) {
            const { compteId, compte, ecriture } = lesPaiements[0];
            const auClient = compte.numero.startsWith('41');
            if (!auClient && !compte.numero.startsWith('40')) {
                for (const p of lesPaiements)
                    resultat.set(p.id, { imputationNonDite: 'compte ni client (41) ni fournisseur (40)' });
                continue;
            }
            const derniere = lesPaiements.reduce((t, p) => (p.ecriture.date > t ? p.ecriture.date : t), lesPaiements[0].ecriture.date);
            const ouvertes = await this.prisma.ligneEcriture.findMany({
                where: {
                    compteId,
                    lettrageId: null,
                    id: { notIn: lesPaiements.map((p) => p.id) },
                    ...(auClient ? { debit: { gt: 0 } } : { credit: { gt: 0 } }),
                    ecriture: { tenantId, statut: client_1.StatutEcriture.VALIDEE, exerciceId: ecriture.exerciceId, date: { lte: derniere } },
                },
                select: {
                    id: true,
                    compteId: true,
                    debit: true,
                    credit: true,
                    deviseId: true,
                    montantDevise: true,
                    dateEcheance: true,
                    libelle: true,
                    ecriture: { select: { date: true, libelle: true, estGenereeParCloture: true, estANouveauProvisoire: true } },
                },
                orderBy: { id: 'asc' },
                take: PLAFOND_FACTURES_OUVERTES + 1,
            });
            if (ouvertes.length > PLAFOND_FACTURES_OUVERTES) {
                for (const p of lesPaiements)
                    resultat.set(p.id, { imputationNonDite: `plus de ${PLAFOND_FACTURES_OUVERTES} factures ouvertes sur le compte` });
                continue;
            }
            const reports = ouvertes.filter((l) => l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire);
            const origines = await this.chercherOrigines(tenantId, reports);
            const dettes = ouvertes
                .map((l) => ({ l, montant: TauxTvaService_1.c(Math.abs(Number(l.debit) - Number(l.credit))) }))
                .filter((x) => x.montant > EPSILON)
                .map((x) => ({
                id: x.l.id,
                dateFacture: origines.get(x.l.id)?.ecriture.date ?? x.l.ecriture.date,
                dateEcheance: x.l.dateEcheance ?? null,
                montant: x.montant,
            }));
            const nomDe = new Map(ouvertes.map((l) => [
                l.id,
                {
                    facture: (l.ecriture.estGenereeParCloture ? l.libelle || l.ecriture.libelle : l.ecriture.libelle || l.libelle) || 'facture sans libellé',
                    date: origines.get(l.id)?.ecriture.date ?? l.ecriture.date,
                },
            ]));
            const imputation = (0, imputation_paiements_1.imputerPaiements)(dettes, lesPaiements.map((p) => ({ id: p.id, date: p.ecriture.date, montant: TauxTvaService_1.c(Math.abs(Number(p.debit) - Number(p.credit))) })));
            const parPaiement = new Map();
            for (const [detteId, parts] of imputation.parDette) {
                const nom = nomDe.get(detteId);
                for (const x of parts) {
                    parPaiement.set(x.paiementId, [
                        ...(parPaiement.get(x.paiementId) ?? []),
                        { facture: nom.facture, date: nom.date.toISOString().slice(0, 10), montant: x.montant },
                    ]);
                }
            }
            for (const p of lesPaiements) {
                const avance = imputation.nonImpute.filter((x) => x.paiementId === p.id).reduce((t, x) => t + x.montant, 0);
                resultat.set(p.id, {
                    imputation: parPaiement.get(p.id) ?? [],
                    ...(avance > EPSILON ? { avance: TauxTvaService_1.c(avance) } : {}),
                });
            }
        }
        return resultat;
    }
    static repartirLibresEntreLignes(libres, capacites) {
        const reste = capacites.map((c) => Math.max(0, TauxTvaService_1.c(c)));
        const rendu = capacites.map(() => []);
        for (const x of libres) {
            const total = reste.reduce((t, c) => t + c, 0);
            if (total <= EPSILON || x.montant <= EPSILON)
                continue;
            const aRepartir = TauxTvaService_1.c(Math.min(x.montant, total));
            let cumul = 0;
            let plusLourde = 0;
            const parts = reste.map((c, i) => {
                if (c > reste[plusLourde])
                    plusLourde = i;
                const p = TauxTvaService_1.c(Math.min(c, (aRepartir * c) / total));
                cumul = TauxTvaService_1.c(cumul + p);
                return p;
            });
            parts[plusLourde] = TauxTvaService_1.c(parts[plusLourde] + aRepartir - cumul);
            parts.forEach((p, i) => {
                if (p <= EPSILON)
                    return;
                reste[i] = TauxTvaService_1.c(reste[i] - p);
                rendu[i].push({ date: x.date, montant: p, origine: x.origine });
            });
        }
        return rendu;
    }
    static declareParAncienMoteur(lignesTiers, montant, dateEcriture, liquidation, ecritureSaisieLe) {
        const T = liquidation.createdAt;
        if (ecritureSaisieLe && ecritureSaisieLe > T)
            return 0;
        const vues = lignesTiers.filter((x) => x.lettrage && (!x.lettrage.createdAt || x.lettrage.createdAt <= T));
        let date = dateEcriture;
        let fraction = 1;
        if (vues.length > 0) {
            const groupe = vues[0].lettrage;
            const sensFacture = vues.reduce((t, x) => t + (Number(x.debit) - Number(x.credit)), 0);
            const engage = vues.reduce((t, x) => t + Math.abs(Number(x.debit) - Number(x.credit)), 0);
            let factures = 0;
            let paye = 0;
            let dernier = null;
            for (const g of groupe.lignes ?? []) {
                const cree = g.ecriture?.createdAt;
                if (cree && cree > T)
                    continue;
                const sens = Number(g.debit) - Number(g.credit);
                if (Math.abs(sens) <= EPSILON)
                    continue;
                if (sens > 0 === sensFacture > 0) {
                    factures += Math.abs(sens);
                    continue;
                }
                paye += Math.abs(sens);
                const d = g.ecriture?.date;
                if (d && (!dernier || d > dernier))
                    dernier = d;
            }
            const reste = Math.max(0, factures - paye);
            date = dernier ?? dateEcriture;
            if (reste > EPSILON) {
                if (engage <= EPSILON)
                    return 0;
                fraction = Math.min(1, Math.max(0, (engage - reste) / engage));
                if (fraction <= EPSILON)
                    return 0;
            }
        }
        const dansLaLiquidation = liquidation.dateDebut <= date && date <= liquidation.dateFin;
        return dansLaLiquidation ? TauxTvaService_1.c(montant * fraction) : 0;
    }
    static reglementsDuGroupe(lignes, sensFacture) {
        if (!lignes || lignes.length === 0 || Math.abs(sensFacture) <= EPSILON)
            return [];
        const reglements = [];
        for (const l of lignes) {
            const sens = Number(l.debit) - Number(l.credit);
            if (Math.abs(sens) <= EPSILON)
                continue;
            if (sens > 0 === sensFacture > 0)
                continue;
            const date = l.ecriture?.date;
            if (!date)
                continue;
            reglements.push({ date, montant: Math.abs(sens) });
        }
        return reglements;
    }
    static rattachementTardif(date, valideeLe, liquidations, depuis, options = {}) {
        const couvrante = (d) => liquidations.find((l) => l.dateDebut <= d && d <= l.dateFin);
        const l0 = couvrante(date);
        if (!l0 || !valideeLe)
            return { date, tardive: false, ancienMoteur: false, dansUnTrou: false };
        const luApres = TauxTvaService_1.instantVu(l0).getTime() >= valideeLe.getTime();
        if (luApres && (!options.negatif || l0.regleTardifs))
            return { date, tardive: false, ancienMoteur: false, dansUnTrou: false };
        const r = TauxTvaService_1.premierJourVuApres(TauxTvaService_1.lendemainUtc(l0.dateFin), valideeLe, liquidations, depuis);
        return { date: r.date, tardive: true, ancienMoteur: r.ancienMoteur || (luApres && !l0.regleTardifs), dansUnTrou: TauxTvaService_1.dansUnTrou(r.date, liquidations) };
    }
    static recuperationTardive(date, valideeLe, liquidations) {
        if (!valideeLe)
            return null;
        const suivante = [...liquidations]
            .filter((l) => l.dateDebut.getTime() > date.getTime())
            .sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())[0];
        if (!suivante || TauxTvaService_1.instantVu(suivante).getTime() >= valideeLe.getTime())
            return null;
        const r = TauxTvaService_1.premierJourVuApres(TauxTvaService_1.lendemainUtc(suivante.dateFin), valideeLe, liquidations);
        return { date: r.date, ancienMoteur: r.ancienMoteur, dansUnTrou: TauxTvaService_1.dansUnTrou(r.date, liquidations) };
    }
    static horsDelaiArt37(constatation, portee) {
        return portee.getTime() > Date.UTC(constatation.getUTCFullYear() + 1, 11, 31);
    }
    static perteQuiAnnuleLaTaxe(lignes) {
        let le = null;
        let impayeTtc = 0;
        for (const x of lignes) {
            for (const des of x.creancesDouteusesDesignees ?? []) {
                for (const m of des.creance?.mouvements ?? []) {
                    const detail = Array.isArray(m.detailTva) ? m.detailTva : [];
                    const f = detail.find((y) => y?.designationId === des.id);
                    if (!f || !(Number(f.tvaAnnulable ?? 0) > EPSILON))
                        continue;
                    impayeTtc = TauxTvaService_1.c(impayeTtc + Number(f.impayeTtc ?? 0));
                    if (!le || m.date.getTime() < le.getTime())
                        le = m.date;
                }
            }
        }
        return le ? { le, impayeTtc } : null;
    }
    static partAnnuleeParLaPerte(perte, taxeDeLaLigne, ttcFacture) {
        if (!(ttcFacture > EPSILON))
            return taxeDeLaLigne;
        return TauxTvaService_1.c(Math.min(taxeDeLaLigne, (perte.impayeTtc * taxeDeLaLigne) / ttcFacture));
    }
    static bornerParLaPerte(libres, dejaDeclare, taxeDeLaLigne, partAnnulee, perteLe) {
        const plafond = TauxTvaService_1.c(Math.max(0, taxeDeLaLigne - partAnnulee));
        let admis = TauxTvaService_1.c(dejaDeclare);
        const admises = [];
        const ecartees = [];
        for (const x of [...libres].sort((a, b) => a.origine.getTime() - b.origine.getTime() || a.date.getTime() - b.date.getTime())) {
            if (x.origine.getTime() <= perteLe.getTime()) {
                admis = TauxTvaService_1.c(admis + x.montant);
                admises.push(x);
                continue;
            }
            const garde = TauxTvaService_1.c(Math.min(x.montant, Math.max(0, plafond - admis)));
            admis = TauxTvaService_1.c(admis + garde);
            if (garde > EPSILON)
                admises.push({ ...x, montant: garde });
            const ecarte = TauxTvaService_1.c(x.montant - garde);
            if (ecarte > EPSILON)
                ecartees.push({ ...x, montant: ecarte });
        }
        return { admises, ecartees };
    }
    static lendemainUtc(d) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
    }
    static instantVu(l) {
        return l.instantLecture ?? l.createdAt;
    }
    static dansUnTrou(date, liquidations) {
        if (liquidations.some((l) => l.dateDebut <= date && date <= l.dateFin))
            return false;
        return liquidations.some((l) => l.dateDebut.getTime() > date.getTime());
    }
    static premierJourVuApres(depart, valideeLe, liquidations, depuis) {
        let x = depuis && depuis.getTime() > depart.getTime() ? depuis : depart;
        let ancienMoteur = false;
        for (let garde = 0; garde <= liquidations.length; garde++) {
            const l = liquidations.find((y) => y.dateDebut <= x && x <= y.dateFin);
            if (!l)
                return { date: x, ancienMoteur };
            const luApres = TauxTvaService_1.instantVu(l).getTime() >= valideeLe.getTime();
            if (luApres && l.regleTardifs)
                return { date: x, ancienMoteur };
            if (luApres)
                ancienMoteur = true;
            x = TauxTvaService_1.lendemainUtc(l.dateFin);
        }
        return { date: x, ancienMoteur };
    }
    static repartirEncaissement(p) {
        const liquidations = [...p.liquidations].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
        const couvrante = (d) => liquidations.find((l) => l.dateDebut <= d && d <= l.dateFin);
        const lendemain = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
        const premierJourLibre = (d) => {
            let x = lendemain(d);
            for (let l = couvrante(x); l; l = couvrante(x))
                x = lendemain(l.dateFin);
            return x;
        };
        const dansL = (l, d) => l.dateDebut <= d && d <= l.dateFin;
        const parLiquidation = new Map();
        for (const l of liquidations) {
            let declare;
            if (l.figee) {
                declare = Number(l.figee[p.ligneId] ?? 0);
            }
            else {
                declare = p.declareParAncienMoteur(l);
            }
            parLiquidation.set(l.id, TauxTvaService_1.c(declare));
        }
        const totalTranches = p.tranches.reduce((s, t) => s + t.montant, 0);
        const totalDeclare = [...parLiquidation.values()].reduce((s, v) => s + v, 0);
        let plafond = TauxTvaService_1.c(totalTranches - totalDeclare);
        let report = 0;
        const evenements = [];
        for (const t of p.tranches) {
            if (!couvrante(t.date))
                evenements.push({ date: t.date, montant: t.montant, origine: t.date });
        }
        for (const l of liquidations)
            evenements.push({ date: l.dateDebut, liquidation: l });
        const ordonner = () => evenements.sort((a, b) => a.date.getTime() - b.date.getTime() || ('liquidation' in a ? -1 : 1));
        ordonner();
        const libres = [];
        while (evenements.length > 0) {
            const e = evenements.shift();
            if ('liquidation' in e) {
                const attendu = p.tranches.filter((t) => dansL(e.liquidation, t.date)).reduce((s, t) => s + t.montant, 0);
                report = TauxTvaService_1.c(report + attendu - (parLiquidation.get(e.liquidation.id) ?? 0));
                if (report > EPSILON) {
                    evenements.push({ date: premierJourLibre(e.liquidation.dateFin), montant: report, origine: e.liquidation.dateFin });
                    report = 0;
                    ordonner();
                }
                continue;
            }
            const du = TauxTvaService_1.c(e.montant + report);
            if (du <= EPSILON) {
                report = du;
                continue;
            }
            report = 0;
            const part = TauxTvaService_1.c(Math.min(du, plafond));
            if (part <= EPSILON)
                continue;
            plafond = TauxTvaService_1.c(plafond - part);
            libres.push({ date: e.date, montant: part, origine: e.origine });
        }
        return { parLiquidation, libres };
    }
    async prolongerParLesANouveaux(tenantId, lignes, signalerAmbigu = () => undefined) {
        if (lignes.length === 0)
            return lignes;
        const groupeDe = (l) => {
            const groupes = l.ecriture.lignes
                .filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_4 && x.lettrage)
                .map((x) => x.lettrage);
            const ids = new Set(groupes.map((g) => g.id));
            return groupes.length > 0 && ids.size === 1 && groupes[0].id && groupes[0].statut === 'PARTIEL' ? groupes[0] : null;
        };
        const comptes = new Set();
        for (const l of lignes)
            for (const g of groupeDe(l)?.lignes ?? [])
                if (g.compteId)
                    comptes.add(g.compteId);
        if (comptes.size === 0)
            return lignes;
        const aNouveau = await this.prisma.ecriture.findFirst({ where: { tenantId, OR: paires_a_cheval_1.ECRITURE_D_A_NOUVEAU }, select: { id: true } });
        if (!aNouveau)
            return lignes;
        const parCompte = new Map();
        const selectLigne = {
            id: true,
            compteId: true,
            libelle: true,
            dateEcheance: true,
            deviseId: true,
            montantDevise: true,
            debit: true,
            credit: true,
        };
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ligneEcriture.findMany({
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
            where: { compteId: { in: [...comptes] }, ecriture: { tenantId, OR: paires_a_cheval_1.ECRITURE_D_A_NOUVEAU } },
            select: {
                ...selectLigne,
                ecriture: { select: { id: true, date: true, exerciceId: true } },
                lettrage: {
                    select: {
                        id: true,
                        statut: true,
                        solde: true,
                        lignes: {
                            select: {
                                ...selectLigne,
                                ecriture: {
                                    select: {
                                        id: true,
                                        libelle: true,
                                        date: true,
                                        createdAt: true,
                                        estANouveauProvisoire: true,
                                        estGenereeParCloture: true,
                                        corrigeEcritureId: true,
                                        _count: { select: { lignes: { where: FILTRE_LIGNES_D_AVOIR } } },
                                    },
                                },
                            },
                            take: PLAFOND_LIGNES_GROUPE + 1,
                        },
                    },
                },
            },
        }), (a) => parCompte.set(a.compteId, [...(parCompte.get(a.compteId) ?? []), a]));
        const centimes = (x) => Math.round(Number(x ?? 0) * 100);
        const memeLigne = (x, a) => {
            const libelle = x.libelle ?? x.ecriture?.libelle ?? '';
            return (!!x.ecriture &&
                a.ecriture.date > x.ecriture.date &&
                centimes(a.debit) === centimes(x.debit) &&
                centimes(a.credit) === centimes(x.credit) &&
                (a.deviseId ?? null) === (x.deviseId ?? null) &&
                (a.montantDevise == null ? null : centimes(a.montantDevise)) === (x.montantDevise == null ? null : centimes(x.montantDevise)) &&
                (a.dateEcheance?.getTime() ?? null) === (x.dateEcheance?.getTime() ?? null) &&
                libelle !== '' &&
                (a.libelle ?? '').endsWith(libelle));
        };
        const nombreExercices = await this.prisma.exercice.count({ where: { tenantId } });
        const JAMAIS_VUE = new Date(8.64e15);
        const prolonges = new Map();
        const prolonger = (g) => {
            const reports = new Set();
            const vers = new Map();
            const traitees = new Set();
            const vus = new Set([g.id]);
            const origine = new Set(g.lignes ?? []);
            const reunies = [...(g.lignes ?? [])];
            let front = [...(g.lignes ?? [])];
            for (let tour = 0; tour <= nombreExercices && front.length > 0; tour++) {
                const suivantes = [];
                for (const x of front) {
                    if (traitees.has(x))
                        continue;
                    traitees.add(x);
                    if (!x.compteId)
                        continue;
                    const candidates = (parCompte.get(x.compteId) ?? []).filter((a) => a.id !== x.id && !reports.has(a.id) && memeLigne(x, a));
                    if (candidates.length === 0)
                        continue;
                    const premier = candidates.reduce((m, a) => (a.ecriture.date < m.ecriture.date ? a : m));
                    const memeExercice = candidates.filter((a) => a.ecriture.exerciceId === premier.ecriture.exerciceId);
                    if (memeExercice.length > 1)
                        return memeExercice.some((a) => a.lettrage) ? 'AMBIGU' : null;
                    reports.add(premier.id);
                    if (x.id)
                        vers.set(premier.id, x.id);
                    const suivant = premier.lettrage;
                    if (suivant && (suivant.lignes?.length ?? 0) > PLAFOND_LIGNES_GROUPE)
                        return 'TROP_LONG';
                    if (suivant?.id && !vus.has(suivant.id)) {
                        vus.add(suivant.id);
                        suivantes.push(...(suivant.lignes ?? []));
                    }
                    else if (!suivant) {
                        suivantes.push(premier);
                    }
                }
                reunies.push(...suivantes.filter((x) => !reunies.includes(x)));
                front = suivantes;
            }
            if (reports.size === 0)
                return null;
            const lignesReunies = reunies
                .filter((x) => !(x.id && reports.has(x.id)))
                .map((x) => (origine.has(x) || !x.ecriture ? x : { ...x, ecriture: { ...x.ecriture, createdAt: JAMAIS_VUE } }));
            const sensDe = (x) => Number(x.debit) - Number(x.credit);
            const premiere = (g.lignes ?? []).find((x) => Math.abs(sensDe(x)) > EPSILON);
            if (!premiere)
                return null;
            const debiteur = (g.lignes ?? []).reduce((t, x) => t + sensDe(x), 0) >= 0;
            const net = lignesReunies.reduce((t, x) => t + sensDe(x), 0);
            const reste = Math.abs(net) <= EPSILON ? 0 : net;
            const reportsVers = new Map();
            for (const [report, cible] of vers) {
                let v = cible;
                for (let i = 0; i <= nombreExercices && vers.has(v); i++)
                    v = vers.get(v);
                reportsVers.set(report, v);
            }
            return {
                ...g,
                statut: Math.abs(reste) <= EPSILON || reste > 0 !== debiteur ? 'SOLDE' : 'PARTIEL',
                solde: reste,
                lignes: lignesReunies,
                reportsVers,
            };
        };
        return lignes.map((l) => {
            const g = groupeDe(l);
            if (!g)
                return l;
            if (!prolonges.has(g.id))
                prolonges.set(g.id, prolonger(g));
            const p = prolonges.get(g.id);
            if (p === 'AMBIGU')
                signalerAmbigu(l, exports.MOTIF_A_NOUVEAU_AMBIGU);
            if (p === 'TROP_LONG')
                signalerAmbigu(l, exports.MOTIF_GROUPE_TROP_LONG);
            if (!p || p === 'AMBIGU' || p === 'TROP_LONG')
                return l;
            return {
                ...l,
                ecriture: {
                    ...l.ecriture,
                    lignes: l.ecriture.lignes.map((x) => (x.lettrage?.id === g.id ? { ...x, lettrage: p } : x)),
                },
            };
        });
    }
    async traduireLesReports(tenantId, groupe, sensFacture, connues = new Map()) {
        const estReport = (x) => !!(x.ecriture?.estGenereeParCloture || x.ecriture?.estANouveauProvisoire);
        const sensDe = (x) => Number(x.debit) - Number(x.credit);
        const dansLeSensFacture = (x) => sensDe(x) > 0 === sensFacture > 0;
        const depart = (groupe.lignes ?? []);
        const avecMontant = depart.filter((x) => x.id && x.ecriture && Math.abs(sensDe(x)) > EPSILON);
        if (avecMontant.length === 0)
            return groupe;
        if (!avecMontant.some(estReport)) {
            const plusTot = avecMontant.reduce((m, x) => (x.ecriture.date < m ? x.ecriture.date : m), avecMontant[0].ecriture.date);
            const suite = await this.prisma.ecriture.findFirst({ where: { tenantId, OR: paires_a_cheval_1.ECRITURE_D_A_NOUVEAU, date: { gt: plusTot } }, select: { id: true } });
            if (!suite)
                return groupe;
        }
        const toutes = new Map();
        for (const x of depart)
            if (x.id && !toutes.has(x.id))
                toutes.set(x.id, x);
        const apportees = new Set();
        const groupesLus = new Set(groupe.id ? [groupe.id] : []);
        const origineDe = new Map();
        const paiementsSansOrigine = new Set();
        const versArriere = new Set();
        const versAvant = new Set();
        let motifLecture = null;
        const TROP_LONG = `un groupe de la chaîne des reports dépasse ${PLAFOND_LIGNES_GROUPE} lignes ou ${PLAFOND_ORIGINES} candidates`;
        const apporterLeGroupe = async (lettrageId) => {
            if (groupesLus.has(lettrageId))
                return true;
            groupesLus.add(lettrageId);
            const lues = (await this.prisma.ligneEcriture.findMany({
                where: { lettrageId, ecriture: { tenantId } },
                select: exports.SELECT_LIGNE_D_ORIGINE,
                orderBy: { id: 'asc' },
                take: PLAFOND_LIGNES_GROUPE + 1,
            }));
            if (lues.length > PLAFOND_LIGNES_GROUPE)
                return false;
            for (const y of lues) {
                if (toutes.has(y.id))
                    continue;
                toutes.set(y.id, y);
                apportees.add(y.id);
            }
            return true;
        };
        for (let tour = 0; tour < TOURS_DE_LECTURE && !motifLecture; tour++) {
            const taille = toutes.size;
            const groupes = groupesLus.size;
            const reports = [...toutes.values()].filter((x) => x.id && x.ecriture && estReport(x) && Math.abs(sensDe(x)) > EPSILON && !versArriere.has(x.id));
            for (const r of reports)
                versArriere.add(r.id);
            if (reports.length > 0) {
                const trouvees = new Map();
                for (const r of reports) {
                    const c = connues.get(r.id);
                    if (c)
                        trouvees.set(r.id, c);
                }
                const aChercher = reports.filter((r) => !trouvees.has(r.id));
                for (const [id, o] of await this.chercherOrigines(tenantId, aChercher))
                    trouvees.set(id, o);
                for (const r of reports) {
                    const o = trouvees.get(r.id);
                    if (!o) {
                        if (!dansLeSensFacture(r))
                            paiementsSansOrigine.add(r.id);
                        continue;
                    }
                    origineDe.set(r.id, o.id);
                    if (o.lettrageId) {
                        if (!(await apporterLeGroupe(o.lettrageId))) {
                            motifLecture = TROP_LONG;
                            break;
                        }
                    }
                    else if (dansLeSensFacture(r) && !toutes.has(o.id)) {
                        toutes.set(o.id, o);
                        apportees.add(o.id);
                    }
                }
            }
            if (motifLecture)
                break;
            const pieces = [...toutes.values()].filter((x) => x.id && x.ecriture && !estReport(x) && Math.abs(sensDe(x)) > EPSILON && !versAvant.has(x.id));
            for (const x of pieces)
                versAvant.add(x.id);
            if (pieces.length > 0) {
                const suites = await this.chercherReports(tenantId, pieces);
                if (!suites) {
                    motifLecture = TROP_LONG;
                    break;
                }
                for (const [pieceId, reportsDeLaPiece] of suites) {
                    for (const a of reportsDeLaPiece) {
                        origineDe.set(a.id, pieceId);
                        if (a.lettrageId && !(await apporterLeGroupe(a.lettrageId))) {
                            motifLecture = TROP_LONG;
                            break;
                        }
                    }
                    if (motifLecture)
                        break;
                }
            }
            if (!motifLecture && toutes.size > PLAFOND_LIGNES_GROUPE)
                motifLecture = TROP_LONG;
            if (toutes.size === taille && groupesLus.size === groupes)
                break;
        }
        for (const id of [...paiementsSansOrigine])
            if (origineDe.has(id))
                paiementsSansOrigine.delete(id);
        if (!motifLecture && paiementsSansOrigine.size > 0) {
            motifLecture = 'une ligne d’à-nouveau du groupe dont le paiement d’origine n’est pas retrouvé';
        }
        if (motifLecture)
            return { ...groupe, motifLecture };
        if (origineDe.size === 0 && apportees.size === 0)
            return groupe;
        const retire = (x) => !!x.id && estReport(x) && origineDe.has(x.id) && toutes.has(origineDe.get(x.id));
        const vers = new Map(groupe.reportsVers ?? []);
        const paiementsReportes = new Map();
        for (const x of toutes.values()) {
            if (!retire(x))
                continue;
            if (dansLeSensFacture(x))
                vers.set(x.id, origineDe.get(x.id));
            else
                paiementsReportes.set(x.id, origineDe.get(x.id));
        }
        const JAMAIS_VUE = new Date(8.64e15);
        const avecInstant = (y, instant) => ({ ...y, ecriture: { ...y.ecriture, createdAt: instant } });
        const lignes = [];
        const posees = new Set();
        for (const x of depart) {
            if (!x.id) {
                lignes.push(x);
                continue;
            }
            if (retire(x)) {
                const o = origineDe.get(x.id);
                if (!posees.has(o) && apportees.has(o)) {
                    posees.add(o);
                    lignes.push(avecInstant(toutes.get(o), x.ecriture?.createdAt));
                }
                continue;
            }
            if (posees.has(x.id))
                continue;
            posees.add(x.id);
            lignes.push(x);
        }
        for (const [id, y] of toutes) {
            if (posees.has(id) || retire(y))
                continue;
            posees.add(id);
            lignes.push(apportees.has(id) ? avecInstant(y, JAMAIS_VUE) : y);
        }
        const net = lignes.reduce((t, x) => t + sensDe(x), 0);
        const reste = Math.abs(net) <= EPSILON ? 0 : net;
        return {
            ...groupe,
            statut: Math.abs(reste) <= EPSILON || reste > 0 !== sensFacture > 0 ? 'SOLDE' : 'PARTIEL',
            solde: reste,
            lignes,
            reportsVers: vers,
            paiementsReportes,
            motifLecture: null,
        };
    }
    async chercherOrigines(tenantId, reports) {
        const rendues = new Map();
        if (reports.length === 0)
            return rendues;
        const centimes = (x) => Math.round(Number(x ?? 0) * 100);
        const parCompte = new Map();
        for (const r of reports)
            if (r.compteId)
                parCompte.set(r.compteId, [...(parCompte.get(r.compteId) ?? []), r]);
        const candidatesDe = new Map();
        const dateDe = new Map();
        for (const [compteId, siens] of parCompte) {
            const plusTard = siens.reduce((m, r) => (r.ecriture.date > m ? r.ecriture.date : m), siens[0].ecriture.date);
            const lues = (await this.prisma.ligneEcriture.findMany({
                where: {
                    compteId,
                    ecriture: { tenantId, statut: client_1.StatutEcriture.VALIDEE, NOT: { OR: paires_a_cheval_1.ECRITURE_D_A_NOUVEAU }, date: { lt: plusTard } },
                    OR: siens.map((r) => ({ debit: Number(r.debit), credit: Number(r.credit) })),
                },
                select: exports.SELECT_LIGNE_D_ORIGINE,
                orderBy: { id: 'asc' },
                take: PLAFOND_ORIGINES + 1,
            }));
            if (lues.length > PLAFOND_ORIGINES)
                continue;
            for (const r of siens) {
                dateDe.set(r.id, r.ecriture.date.getTime());
                candidatesDe.set(r.id, lues.filter((o) => {
                    const libelle = o.libelle || o.ecriture.libelle || '';
                    return (o.ecriture.date < r.ecriture.date &&
                        centimes(o.debit) === centimes(r.debit) &&
                        centimes(o.credit) === centimes(r.credit) &&
                        (o.deviseId ?? null) === (r.deviseId ?? null) &&
                        (o.montantDevise == null ? null : centimes(o.montantDevise)) === (r.montantDevise == null ? null : centimes(r.montantDevise)) &&
                        (o.dateEcheance?.getTime() ?? null) === (r.dateEcheance?.getTime() ?? null) &&
                        libelle !== '' &&
                        (r.libelle ?? '').endsWith(libelle));
                }));
            }
        }
        const revendications = new Map();
        for (const [id, cs] of candidatesDe) {
            for (const o of cs) {
                const cle = `${o.id}|${dateDe.get(id)}`;
                revendications.set(cle, (revendications.get(cle) ?? 0) + 1);
            }
        }
        for (const [id, cs] of candidatesDe) {
            if (cs.length === 1 && revendications.get(`${cs[0].id}|${dateDe.get(id)}`) === 1)
                rendues.set(id, cs[0]);
        }
        return rendues;
    }
    async chercherReports(tenantId, pieces) {
        const rendus = new Map();
        const centimes = (x) => Math.round(Number(x ?? 0) * 100);
        const libelleDe = (x) => x.libelle || x.ecriture.libelle || '';
        const parCompte = new Map();
        for (const x of pieces)
            if (x.compteId && libelleDe(x) !== '')
                parCompte.set(x.compteId, [...(parCompte.get(x.compteId) ?? []), x]);
        const candidats = [];
        for (const [compteId, siennes] of parCompte) {
            const plusTot = siennes.reduce((m, x) => (x.ecriture.date < m ? x.ecriture.date : m), siennes[0].ecriture.date);
            const lues = (await this.prisma.ligneEcriture.findMany({
                where: {
                    compteId,
                    ecriture: { tenantId, OR: paires_a_cheval_1.ECRITURE_D_A_NOUVEAU, date: { gt: plusTot } },
                    OR: siennes.map((x) => ({ debit: Number(x.debit), credit: Number(x.credit) })),
                },
                select: exports.SELECT_LIGNE_D_ORIGINE,
                orderBy: { id: 'asc' },
                take: PLAFOND_ORIGINES + 1,
            }));
            if (lues.length > PLAFOND_ORIGINES)
                return null;
            for (const a of lues) {
                const reporte = siennes.some((x) => a.ecriture.date > x.ecriture.date &&
                    centimes(a.debit) === centimes(x.debit) &&
                    centimes(a.credit) === centimes(x.credit) &&
                    (a.deviseId ?? null) === (x.deviseId ?? null) &&
                    (a.montantDevise == null ? null : centimes(a.montantDevise)) === (x.montantDevise == null ? null : centimes(x.montantDevise)) &&
                    (a.dateEcheance?.getTime() ?? null) === (x.dateEcheance?.getTime() ?? null) &&
                    (a.libelle ?? '').endsWith(libelleDe(x)));
                if (reporte)
                    candidats.push(a);
            }
        }
        if (candidats.length === 0)
            return rendus;
        const confirmees = await this.chercherOrigines(tenantId, candidats);
        const ids = new Set(pieces.map((x) => x.id));
        for (const a of candidats) {
            const o = confirmees.get(a.id);
            if (o && ids.has(o.id))
                rendus.set(o.id, [...(rendus.get(o.id) ?? []), a]);
        }
        return rendus;
    }
    async relierAuxANouveaux(tenantId, lignes, signalerAmbigu = () => undefined, origines = new Map()) {
        if (lignes.length === 0)
            return lignes;
        const centimes = (x) => Math.round(Number(x ?? 0) * 100);
        const estCollecteDe = (l) => l.compte.numero.startsWith(RACINE_COLLECTEE);
        const creanceDe = (l) => {
            const collecte = estCollecteDe(l);
            const creances = l.ecriture.lignes.filter((x) => {
                const numero = x.compte?.numero ?? '';
                const sens = collecte ? Number(x.debit) - Number(x.credit) : Number(x.credit) - Number(x.debit);
                return (x.compte?.classe === client_1.ClasseCompte.CLASSE_4 &&
                    !x.lettrage &&
                    sens > EPSILON &&
                    !numero.startsWith('44') &&
                    !numero.startsWith(collecte ? '419' : '409'));
            });
            return creances.length === 1 ? creances[0] : null;
        };
        const comptes = [...new Set(lignes.map(creanceDe).filter((c) => c).map((c) => c.compteId))];
        if (comptes.length === 0)
            return lignes;
        const parCompte = new Map();
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ligneEcriture.findMany({
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
            where: { compteId: { in: comptes }, ecriture: { tenantId, OR: paires_a_cheval_1.ECRITURE_D_A_NOUVEAU } },
            select: {
                id: true,
                compteId: true,
                debit: true,
                credit: true,
                deviseId: true,
                montantDevise: true,
                dateEcheance: true,
                libelle: true,
                ecriture: { select: { date: true, exerciceId: true } },
                lettrage: {
                    select: {
                        id: true,
                        statut: true,
                        solde: true,
                        soldeAt: true,
                        createdAt: true,
                        lignes: {
                            select: {
                                id: true,
                                compteId: true,
                                libelle: true,
                                dateEcheance: true,
                                deviseId: true,
                                montantDevise: true,
                                debit: true,
                                credit: true,
                                ecriture: {
                                    select: {
                                        id: true,
                                        libelle: true,
                                        date: true,
                                        createdAt: true,
                                        estANouveauProvisoire: true,
                                        estGenereeParCloture: true,
                                        corrigeEcritureId: true,
                                        _count: { select: { lignes: { where: FILTRE_LIGNES_D_AVOIR } } },
                                    },
                                },
                            },
                            take: PLAFOND_LIGNES_GROUPE + 1,
                        },
                    },
                },
            },
        }), (a) => parCompte.set(a.compteId, [...(parCompte.get(a.compteId) ?? []), a]));
        const candidatsDe = (l) => {
            const c = creanceDe(l);
            if (!c)
                return null;
            const libelle = c.libelle ?? l.ecriture.libelle;
            return (parCompte.get(c.compteId) ?? []).filter((a) => a.ecriture.date > l.ecriture.date &&
                centimes(a.debit) === centimes(c.debit) &&
                centimes(a.credit) === centimes(c.credit) &&
                (a.deviseId ?? null) === (c.deviseId ?? null) &&
                (a.montantDevise === null || a.montantDevise === undefined ? null : centimes(a.montantDevise)) ===
                    (c.montantDevise === null || c.montantDevise === undefined ? null : centimes(c.montantDevise)) &&
                (a.dateEcheance?.getTime() ?? null) === (c.dateEcheance?.getTime() ?? null) &&
                (a.libelle ?? '').endsWith(libelle));
        };
        const revendications = new Map();
        const candidats = new Map();
        for (const l of lignes) {
            const cs = candidatsDe(l);
            if (!cs)
                continue;
            candidats.set(l, cs);
            for (const a of cs)
                revendications.set(a.id, (revendications.get(a.id) ?? 0) + 1);
        }
        return lignes.map((l) => {
            const c = creanceDe(l);
            if (!c)
                return l;
            const sensFacture = Number(c.debit) - Number(c.credit);
            const engage = Math.abs(sensFacture);
            let cs = candidats.get(l) ?? [];
            const parExercice = new Map();
            for (const a of cs)
                parExercice.set(a.ecriture.exerciceId, (parExercice.get(a.ecriture.exerciceId) ?? 0) + 1);
            if ([...parExercice.values()].some((n) => n > 1) || cs.some((a) => (revendications.get(a.id) ?? 0) > 1)) {
                if (cs.some((a) => a.lettrage))
                    signalerAmbigu(l, exports.MOTIF_A_NOUVEAU_AMBIGU);
                cs = [];
            }
            if (cs.some((a) => (a.lettrage?.lignes.length ?? 0) > PLAFOND_LIGNES_GROUPE)) {
                signalerAmbigu(l, exports.MOTIF_GROUPE_TROP_LONG);
                cs = [];
            }
            const lettrees = cs.filter((a) => a.lettrage);
            if (lettrees.length === 1) {
                const g = lettrees[0].lettrage;
                const ecritureDeL = l.ecriture;
                if (ecritureDeL.id) {
                    origines.set(lettrees[0].id, {
                        id: c.id,
                        compteId: c.compteId,
                        libelle: c.libelle,
                        dateEcheance: c.dateEcheance,
                        deviseId: c.deviseId,
                        montantDevise: c.montantDevise,
                        debit: c.debit,
                        credit: c.credit,
                        lettrageId: null,
                        ecriture: {
                            id: ecritureDeL.id,
                            libelle: ecritureDeL.libelle,
                            date: ecritureDeL.date,
                            createdAt: ecritureDeL.createdAt,
                            estANouveauProvisoire: false,
                            estGenereeParCloture: false,
                            _count: { lignes: 0 },
                        },
                    });
                }
                const groupeReel = { id: g.id, statut: g.statut, solde: g.solde, soldeAt: g.soldeAt, createdAt: new Date(8.64e15), lignes: g.lignes };
                return {
                    ...l,
                    ecriture: { ...l.ecriture, lignes: l.ecriture.lignes.map((x) => (x === c ? { ...x, lettrage: groupeReel } : x)) },
                };
            }
            if (lettrees.some((a) => (0, creances_douteuses_1.partageSonLettrage)({ debit: a.debit, credit: a.credit, lettrage: a.lettrage })))
                return l;
            const reglements = [
                ...cs.flatMap((a) => (a.lettrage?.lignes ?? []).filter((g) => {
                    const sens = Number(g.debit) - Number(g.credit);
                    const aNouveau = g.ecriture.estANouveauProvisoire || g.ecriture.estGenereeParCloture;
                    return Math.abs(sens) > EPSILON && sens > 0 !== sensFacture > 0 && !aNouveau;
                })),
            ];
            if (reglements.length === 0)
                return l;
            const paye = reglements.reduce((t, g) => t + Math.abs(Number(g.debit) - Number(g.credit)), 0);
            const reste = Math.max(0, engage - paye);
            const groupe = {
                statut: reste <= EPSILON ? 'SOLDE' : 'PARTIEL',
                solde: sensFacture > 0 ? reste : -reste,
                soldeAt: null,
                createdAt: new Date(8.64e15),
                lignes: [{ debit: c.debit, credit: c.credit, ecriture: { date: l.ecriture.date } }, ...reglements],
            };
            return {
                ...l,
                ecriture: { ...l.ecriture, lignes: l.ecriture.lignes.map((x) => (x === c ? { ...x, lettrage: groupe } : x)) },
            };
        });
    }
    static dateDernierReglement(lignes, sensFacture) {
        if (!lignes || lignes.length === 0 || Math.abs(sensFacture) <= EPSILON)
            return null;
        let plusRecent = null;
        for (const l of lignes) {
            const sens = Number(l.debit) - Number(l.credit);
            if (Math.abs(sens) <= EPSILON)
                continue;
            if (sens > 0 === sensFacture > 0)
                continue;
            const date = l.ecriture?.date;
            if (!date)
                continue;
            if (!plusRecent || date > plusRecent)
                plusRecent = date;
        }
        return plusRecent;
    }
    static tranchesAuxDebits(lignesTiers, dateDebit) {
        const auDebit = [{ date: dateDebit, fraction: 1 }];
        const avecLettrage = lignesTiers.filter((l) => l.lettrage);
        if (avecLettrage.length !== 1)
            return auDebit;
        const facture = avecLettrage[0];
        const sensFacture = Number(facture.debit) - Number(facture.credit);
        const engage = Math.abs(sensFacture);
        const lignesGroupe = facture.lettrage.lignes ?? [];
        if (engage <= EPSILON || lignesGroupe.length === 0)
            return auDebit;
        let memeSens = 0;
        const anterieurs = [];
        for (const g of lignesGroupe) {
            const sens = Number(g.debit) - Number(g.credit);
            if (Math.abs(sens) <= EPSILON)
                continue;
            if (sens > 0 === sensFacture > 0) {
                memeSens += Math.abs(sens);
                continue;
            }
            const date = g.ecriture?.date;
            if (date && date.getTime() < dateDebit.getTime())
                anterieurs.push({ date, montant: Math.abs(sens) });
        }
        if (memeSens > engage + EPSILON || anterieurs.length === 0)
            return auDebit;
        anterieurs.sort((a, b) => a.date.getTime() - b.date.getTime());
        const tranches = [];
        let regle = 0;
        for (const a of anterieurs) {
            const part = Math.min(a.montant, engage - regle);
            if (part <= EPSILON)
                break;
            regle += part;
            tranches.push({ date: a.date, fraction: part / engage, auPaiement: true });
        }
        const reste = 1 - regle / engage;
        if (reste > EPSILON)
            tranches.push({ date: dateDebit, fraction: reste });
        return tranches;
    }
    static estAuxDebits(base, nature, estCollecte, regimeLigne, fournisseurAutorise) {
        return base === 'DATE_ECRITURE' && nature === 'SERVICES' && (estCollecte ? regimeLigne === 'DEBITS' : fournisseurAutorise);
    }
    static tranchesAuxDebitsImputees(parts, dateDebit) {
        const tranches = [];
        let avant = 0;
        for (const p of parts) {
            if (!p.date || p.date.getTime() >= dateDebit.getTime() || p.fraction <= EPSILON)
                continue;
            const part = Math.min(p.fraction, 1 - avant);
            if (part <= EPSILON)
                continue;
            avant += part;
            tranches.push({ date: p.date, fraction: part, auPaiement: true });
        }
        const reste = 1 - avant;
        if (reste > EPSILON)
            tranches.push({ date: dateDebit, fraction: reste });
        return tranches.length > 0 ? tranches : [{ date: dateDebit, fraction: 1 }];
    }
    static montantsDesTranches(montant, tranches) {
        if (tranches.length === 1)
            return [TauxTvaService_1.c(montant * tranches[0].fraction)];
        const total = tranches.reduce((t, x) => t + x.fraction, 0);
        const montants = [];
        let cumul = 0;
        tranches.forEach((t, i) => {
            if (i === tranches.length - 1 && Math.abs(total - 1) <= EPSILON) {
                montants.push(TauxTvaService_1.c(montant - cumul));
            }
            else {
                const m = TauxTvaService_1.c(montant * t.fraction);
                cumul = TauxTvaService_1.c(cumul + m);
                montants.push(m);
            }
        });
        return montants;
    }
    natureOperation(referentiel, numeroCompte, estCollecte, contreparties = []) {
        const estSyscohada = referentiel === client_1.Referentiel.SYSCOHADA;
        let vue = null;
        for (const numero of contreparties) {
            const nature = TauxTvaService_1.natureContrepartie(numero, estCollecte, estSyscohada);
            if (nature === 'INDETERMINEE')
                return 'INDETERMINEE';
            if (vue && vue !== nature)
                return 'INDETERMINEE';
            vue = nature;
        }
        if (vue)
            return vue;
        if (!estSyscohada)
            return 'INDETERMINEE';
        const table = estCollecte ? NATURE_COLLECTEE_SYSCOHADA : NATURE_RECUPERABLE_SYSCOHADA;
        for (const [racine, nature] of table) {
            if (numeroCompte.startsWith(racine))
                return nature;
        }
        return 'INDETERMINEE';
    }
    static natureContrepartie(numero, estCollecte, estSyscohada) {
        if (estCollecte && !estSyscohada)
            return 'INDETERMINEE';
        if (estCollecte)
            return TauxTvaService_1.plusLongue(NATURE_CONTREPARTIE_PRODUITS_SYSCOHADA, numero).nature;
        const commune = TauxTvaService_1.plusLongue(NATURE_CONTREPARTIE_CHARGES, numero);
        if (estSyscohada)
            return commune.nature;
        const propre = TauxTvaService_1.plusLongue(NATURE_CONTREPARTIE_CHARGES_SYCEBNL, numero);
        return propre.longueur >= commune.longueur ? propre.nature : commune.nature;
    }
    static plusLongue(table, numero) {
        let nature = 'INDETERMINEE';
        let longueur = -1;
        for (const [racine, n] of table) {
            if (numero.startsWith(racine) && racine.length > longueur) {
                nature = n;
                longueur = racine.length;
            }
        }
        return { nature, longueur };
    }
    static fournisseurAuxDebits(lignesTiers, dateOperation) {
        let rattaches = 0;
        let reference = null;
        let referenceManquante = false;
        let refuse = false;
        const nonDatee = [];
        const horsPeriode = [];
        const noms = [];
        for (const l of lignesTiers) {
            const tiers = l.compte?.tiersCompte?.tiers;
            if (!tiers)
                continue;
            rattaches += 1;
            const nom = TauxTvaService_1.nomDuTiers(tiers);
            if (!noms.includes(nom))
                noms.push(nom);
            const situation = (0, periode_autorisation_debits_1.situationAutorisationDebits)(tiers, dateOperation);
            if (situation === 'NON_AUTORISE') {
                refuse = true;
                continue;
            }
            if (situation === 'AVANT_EFFET' || situation === 'REVOQUEE') {
                refuse = true;
                if (!horsPeriode.includes(nom))
                    horsPeriode.push(nom);
                continue;
            }
            if (situation === 'AUTORISE_NON_DATE' && !nonDatee.includes(nom))
                nonDatee.push(nom);
            if (!tiers.referenceAutorisationDebits)
                referenceManquante = true;
            else
                reference = reference ?? tiers.referenceAutorisationDebits;
        }
        if (rattaches === 0 || refuse)
            return { autorise: false, reference: null, nonDatee: [], horsPeriode, noms };
        return { autorise: true, reference: referenceManquante ? null : reference, nonDatee, horsPeriode: [], noms };
    }
    static nomDuTiers(tiers) {
        const code = tiers.code?.trim();
        const nom = tiers.nom?.trim();
        if (code && nom)
            return `${code} ${nom}`;
        return nom || code || 'tiers sans nom';
    }
    static mentionDebitsLueSurLaFacture(facture) {
        return facture?.sens === client_1.SensFacture.ACHAT && facture.mentionTvaDebits === true;
    }
    baseExigibilite(referentiel, regime, numeroCompte, estCollecte, fournisseurAuxDebits, contreparties = []) {
        const nature = this.natureOperation(referentiel, numeroCompte, estCollecte, contreparties);
        if (nature === 'BIENS')
            return { base: 'DATE_ECRITURE', nature };
        if (nature === 'SERVICES') {
            if (estCollecte)
                return { base: regime === 'DEBITS' ? 'DATE_ECRITURE' : 'ENCAISSEMENT', nature };
            return { base: fournisseurAuxDebits ? 'DATE_ECRITURE' : 'ENCAISSEMENT', nature };
        }
        return { base: regime === 'ENCAISSEMENTS' ? 'ENCAISSEMENT' : 'DATE_ECRITURE', nature };
    }
    async taxeDesFactures(tenantId, ecritureIds) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { referentiel: true, regimeExigibiliteTva: true, dateAutorisationDebitsTva: true },
        });
        const regime = tenant?.regimeExigibiliteTva ?? 'LIVRAISONS';
        const dateAutorisation = tenant?.dateAutorisationDebitsTva ?? null;
        const [ecritures, ancienne] = await Promise.all([
            ecritureIds.length === 0
                ? Promise.resolve([])
                : this.prisma.ecriture.findMany({
                    where: { tenantId, id: { in: [...ecritureIds] }, statut: client_1.StatutEcriture.VALIDEE },
                    take: ecritureIds.length,
                    select: {
                        id: true,
                        date: true,
                        lignes: {
                            select: {
                                id: true,
                                compteId: true,
                                debit: true,
                                credit: true,
                                tauxTvaId: true,
                                compte: { select: { numero: true, classe: true } },
                            },
                        },
                    },
                }),
            this.prisma.liquidationTva.findFirst({ where: { tenantId, tvaEncaissementFigee: { equals: client_1.Prisma.AnyNull } }, select: { id: true } }),
        ]);
        const factures = new Map();
        for (const e of ecritures) {
            const contreparties = e.lignes.filter((x) => x.compte.classe === client_1.ClasseCompte.CLASSE_7).map((x) => x.compte.numero);
            let ttc = 0;
            for (const x of e.lignes) {
                const sens = Number(x.debit) - Number(x.credit);
                if (sens <= EPSILON)
                    continue;
                if (x.compte.classe === client_1.ClasseCompte.CLASSE_5 || (x.compte.classe === client_1.ClasseCompte.CLASSE_4 && !x.compte.numero.startsWith('44')))
                    ttc += sens;
            }
            const regimeLigne = regime === 'DEBITS' && dateAutorisation && e.date < dateAutorisation ? 'LIVRAISONS' : regime;
            const lignesTva = [];
            for (const x of e.lignes) {
                if (!x.tauxTvaId || !x.compte.numero.startsWith(RACINE_COLLECTEE) || Number(x.credit) <= EPSILON)
                    continue;
                const { base, nature } = this.baseExigibilite(tenant?.referentiel, regimeLigne, x.compte.numero, true, false, contreparties);
                lignesTva.push({ ligneId: x.id, compteId: x.compteId, numero: x.compte.numero, tauxTvaId: x.tauxTvaId, tva: TauxTvaService_1.c(Number(x.credit)), base, nature });
            }
            factures.set(e.id, { ttc: TauxTvaService_1.c(ttc), lignesTva });
        }
        return { factures, ancienMoteur: ancienne !== null };
    }
    creditReportable(precedente) {
        if (!precedente)
            return { montant: 0, origine: null };
        const net = Number(precedente.net);
        if (net >= -EPSILON)
            return { montant: 0, origine: null };
        return {
            montant: TauxTvaService_1.c(-net),
            origine: {
                id: precedente.id,
                dateDebut: precedente.dateDebut.toISOString().slice(0, 10),
                dateFin: precedente.dateFin.toISOString().slice(0, 10),
                ecritureId: precedente.ecritureId,
            },
        };
    }
    partExclueArt41(lignesCharge) {
        const rien = { exclue: 0, aVerifier: 0, lisible: false };
        let total = 0;
        let exclue = 0;
        let aVerifier = 0;
        for (const c of lignesCharge) {
            const montant = Number(c.debit) - Number(c.credit);
            if (montant <= EPSILON)
                continue;
            total += montant;
            if (EXCLUSIONS_ART_41.some(([racine]) => c.compte.numero.startsWith(racine)))
                exclue += montant;
            else if (EXCLUSIONS_ART_41_A_VERIFIER.some(([racine]) => c.compte.numero.startsWith(racine)))
                aVerifier += montant;
        }
        if (total <= EPSILON)
            return rien;
        return { exclue: exclue / total, aVerifier: aVerifier / total, lisible: true };
    }
    async declaration(tenantId, dateDebut, dateFin, options = {}) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        const regime = tenant?.regimeExigibiliteTva ?? 'LIVRAISONS';
        const dateAutorisationDossier = tenant?.dateAutorisationDebitsTva ?? null;
        const regimeALaDate = (date) => regime === 'DEBITS' && dateAutorisationDossier && date < dateAutorisationDossier ? 'LIVRAISONS' : regime;
        const referentiel = tenant?.referentiel;
        const taux = await this.prisma.tauxTva.findMany({ where: { tenantId }, orderBy: { taux: 'desc' } });
        const dejaLiquidee = await this.liquidationChevauchante(tenantId, dateDebut, dateFin);
        const liquidationsLues = (await this.prisma.liquidationTva.findMany({
            where: { tenantId },
            select: { id: true, dateDebut: true, dateFin: true, createdAt: true, tvaEncaissementFigee: true, regleTardifs: true, instantLecture: true },
            orderBy: { dateDebut: 'asc' },
        })).map((l) => ({
            id: l.id,
            dateDebut: l.dateDebut,
            dateFin: l.dateFin,
            createdAt: l.createdAt,
            figee: l.tvaEncaissementFigee ?? null,
            regleTardifs: l.regleTardifs === true,
            instantLecture: l.instantLecture ?? null,
        }));
        const liquidationExacte = liquidationsLues.find((l) => l.dateDebut.getTime() === dateDebut.getTime() && l.dateFin.getTime() === dateFin.getTime()) ?? null;
        const modificationsDeGroupe = new Map();
        const suppressionsParCompte = new Map();
        const anciennes = liquidationsLues.filter((l) => !l.figee);
        if (anciennes.length > 0) {
            const depuis = new Date(Math.min(...anciennes.map((l) => l.createdAt.getTime())));
            await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.evenementAudit.findMany({
                ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
                where: { tenantId, entite: 'Lettrage', action: { in: ['MODIFICATION', 'SUPPRESSION'] }, horodatage: { gt: depuis } },
                select: { id: true, action: true, entiteId: true, horodatage: true, avant: true, apres: true },
            }), (e) => {
                const avant = (e.avant ?? null);
                const apres = (e.apres ?? null);
                if (e.action === 'SUPPRESSION') {
                    if (!avant?.compteId)
                        return;
                    const liste = suppressionsParCompte.get(avant.compteId) ?? [];
                    liste.push({ le: e.horodatage, creeLe: avant.createdAt ? new Date(avant.createdAt) : null });
                    suppressionsParCompte.set(avant.compteId, liste);
                    return;
                }
                const groupeId = e.entiteId ?? apres?.filtre?.id ?? null;
                if (!groupeId)
                    return;
                if (avant && apres && 'solde' in apres && Number(avant.solde) === Number(apres.solde))
                    return;
                modificationsDeGroupe.set(groupeId, [...(modificationsDeGroupe.get(groupeId) ?? []), e.horodatage]);
            });
        }
        const PLAFOND_INCERTAINES = 100;
        const reconstitutionsIncertaines = [];
        let reconstitutionsIncertainesTotal = 0;
        const incertainesVues = new Set();
        const figeEncaissement = {};
        const recouvrementsParLigne = new Map();
        const filtreRecouvrement = {
            type: client_1.TypeMouvementCreanceDouteuse.RECOUVREMENT,
            annuleeLe: null,
            ecriture: { statut: client_1.StatutEcriture.VALIDEE },
        };
        const designationsLues = [];
        const designationsParCreance = new Map();
        const PLAFOND_RECOUVREMENTS = 500;
        let recouvrementsTronques = false;
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.factureCreanceDouteuse.findMany({
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
            where: { tenantId, retireeLe: null, creance: { annuleeLe: null } },
            select: {
                id: true,
                ligneEcritureId: true,
                montant: true,
                ligneEcriture: { select: { dateEcheance: true, ecriture: { select: { date: true } } } },
                creance: {
                    select: {
                        id: true,
                        montant: true,
                        dateReclassement: true,
                        compteCreance: { select: { numero: true, intitule: true } },
                        mouvements: { where: filtreRecouvrement, select: { date: true, montant: true }, orderBy: { date: 'asc' }, take: PLAFOND_RECOUVREMENTS },
                    },
                },
            },
        }), (f) => {
            const reclasse = Number(f.creance.montant);
            if (reclasse <= EPSILON)
                return;
            if (f.creance.mouvements.length >= PLAFOND_RECOUVREMENTS)
                recouvrementsTronques = true;
            const lue = {
                designationId: f.id,
                ligneEcritureId: f.ligneEcritureId,
                montant: Number(f.montant),
                creanceId: f.creance.id,
                compte: `${f.creance.compteCreance.numero} ${f.creance.compteCreance.intitule}`,
                dateReclassement: f.creance.dateReclassement.toISOString().slice(0, 10),
                reclasse,
                dateFacture: f.ligneEcriture.ecriture.date,
                dateEcheance: f.ligneEcriture.dateEcheance ?? null,
                mouvements: f.creance.mouvements.map((m) => ({ date: m.date, montant: Number(m.montant) })),
                recouvrements: [],
            };
            designationsLues.push(lue);
            designationsParCreance.set(lue.creanceId, [...(designationsParCreance.get(lue.creanceId) ?? []), lue]);
        });
        for (const designations of designationsParCreance.values()) {
            const { reclasse, mouvements } = designations[0];
            const designe = Math.min(reclasse, designations.reduce((t, d) => t + d.montant, 0));
            const resultat = (0, imputation_paiements_1.imputerPaiements)(designations.map((d) => ({ id: d.designationId, dateFacture: d.dateFacture, dateEcheance: d.dateEcheance, montant: d.montant })), mouvements.map((m, i) => ({ id: `recouvrement-${i}`, date: m.date, montant: TauxTvaService_1.c((m.montant * designe) / reclasse) })));
            for (const d of designations) {
                d.recouvrements = (resultat.parDette.get(d.designationId) ?? []).map((x) => ({ date: x.date, montant: x.montant }));
                if (d.recouvrements.length > 0)
                    recouvrementsParLigne.set(d.ligneEcritureId, [...(recouvrementsParLigne.get(d.ligneEcritureId) ?? []), ...d.recouvrements]);
            }
        }
        const lignesRattachees = new Set();
        const lignesPartagees = new Set();
        const PLAFOND_SANS_FACTURE = 200;
        const filtreCreanceRecouvree = {
            annuleeLe: null,
            mouvements: { some: { ...filtreRecouvrement, date: { gte: dateDebut, lte: dateFin } } },
        };
        const [creancesRecouvrees, creancesRecouvreesTotal] = await Promise.all([
            this.prisma.creanceDouteuse.findMany({
                where: { tenantId, ...filtreCreanceRecouvree },
                orderBy: { dateReclassement: 'asc' },
                take: PLAFOND_SANS_FACTURE,
                select: {
                    id: true,
                    dateReclassement: true,
                    montant: true,
                    compteCreance: { select: { numero: true, intitule: true } },
                    factures: { where: { retireeLe: null }, select: { montant: true }, take: 200 },
                    mouvements: {
                        where: { ...filtreRecouvrement, date: { gte: dateDebut, lte: dateFin } },
                        select: { montant: true },
                        take: PLAFOND_RECOUVREMENTS,
                    },
                },
            }),
            this.prisma.creanceDouteuse.count({ where: { tenantId, ...filtreCreanceRecouvree } }),
        ]);
        const sansFacture = new Map();
        for (const c of creancesRecouvrees) {
            const reclasse = Number(c.montant);
            const designe = c.factures.reduce((t, f) => t + Number(f.montant), 0);
            const recouvre = TauxTvaService_1.c(c.mouvements.reduce((t, m) => t + Number(m.montant), 0));
            const nonDesigne = reclasse > EPSILON ? TauxTvaService_1.c((recouvre * Math.max(0, reclasse - designe)) / reclasse) : 0;
            sansFacture.set(c.id, {
                creanceId: c.id,
                compte: `${c.compteCreance.numero} ${c.compteCreance.intitule}`,
                dateReclassement: c.dateReclassement.toISOString().slice(0, 10),
                recouvre,
                recouvreSansFacture: nonDesigne,
                motifs: nonDesigne > EPSILON ? [creances_douteuses_1.MOTIF_SANS_FACTURE_DESIGNEE] : [],
            });
        }
        const derniereLiquidation = await this.prisma.liquidationTva.findFirst({
            where: { tenantId, dateFin: { lt: dateDebut } },
            orderBy: { dateFin: 'desc' },
            include: { ecriture: { select: { id: true, libelle: true } } },
        });
        const lire = (curseur) => this.prisma.ligneEcriture.findMany({
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
            where: {
                tauxTvaId: { in: taux.map((t) => t.id) },
                compte: {
                    OR: [{ numero: { startsWith: RACINE_COLLECTEE } }, { numero: { startsWith: RACINE_RECUPERABLE } }],
                },
                ecriture: {
                    tenantId,
                    statut: client_1.StatutEcriture.VALIDEE,
                    OR: [
                        { date: { lte: dateFin } },
                        { lignes: { some: { lettrage: { lignes: { some: { ecriture: { date: { lte: dateFin } } } } } } } },
                        { corrigeEcriture: { is: { date: { lte: dateFin } } } },
                    ],
                    ...(options.instantLecture
                        ? {
                            AND: [
                                {
                                    OR: [
                                        { valideeAt: { lte: options.instantLecture } },
                                        { valideeAt: null, createdAt: { lte: options.instantLecture } },
                                    ],
                                },
                            ],
                        }
                        : {}),
                },
            },
            select: {
                id: true,
                tauxTvaId: true,
                compteId: true,
                debit: true,
                credit: true,
                compte: { select: { numero: true } },
                ecriture: {
                    select: {
                        id: true,
                        date: true,
                        libelle: true,
                        createdAt: true,
                        valideeAt: true,
                        facture: { select: { nature: true, sens: true, mentionTvaDebits: true, dateFacture: true, dateReception: true } },
                        recuperationTvaCreance: { select: { id: true, annuleeLe: true } },
                        mouvementCreanceDouteusePerte: { select: { id: true } },
                        numeroPiece: true,
                        corrigeEcriture: { select: { numeroPiece: true, date: true, valideeAt: true, createdAt: true } },
                        lignes: {
                            where: {
                                OR: [
                                    { compte: { classe: client_1.ClasseCompte.CLASSE_4 }, lettrageId: { not: null } },
                                    { compte: { classe: client_1.ClasseCompte.CLASSE_4, tiersCompte: { isNot: null } } },
                                    { compte: { classe: client_1.ClasseCompte.CLASSE_4, NOT: { numero: { startsWith: '44' } } } },
                                    { compte: { classe: client_1.ClasseCompte.CLASSE_5 } },
                                    { compte: { classe: client_1.ClasseCompte.CLASSE_6 } },
                                    { compte: { classe: client_1.ClasseCompte.CLASSE_7 } },
                                    { compte: { classe: client_1.ClasseCompte.CLASSE_2 } },
                                ],
                            },
                            select: {
                                id: true,
                                debit: true,
                                credit: true,
                                compteId: true,
                                deviseId: true,
                                montantDevise: true,
                                dateEcheance: true,
                                libelle: true,
                                creancesDouteusesDesignees: {
                                    where: { retireeLe: null },
                                    select: {
                                        id: true,
                                        creance: {
                                            select: {
                                                mouvements: {
                                                    where: {
                                                        type: client_1.TypeMouvementCreanceDouteuse.PERTE,
                                                        annuleeLe: null,
                                                        ecriturePerteId: { not: null },
                                                        montantTvaAnnulee: { gt: 0 },
                                                    },
                                                    select: { date: true, detailTva: true },
                                                    orderBy: { date: 'asc' },
                                                    take: 20,
                                                },
                                            },
                                        },
                                    },
                                },
                                compte: {
                                    select: {
                                        numero: true,
                                        classe: true,
                                        tiersCompte: {
                                            select: {
                                                tiers: {
                                                    select: {
                                                        code: true,
                                                        nom: true,
                                                        autoriseTvaDebits: true,
                                                        referenceAutorisationDebits: true,
                                                        dateEffetAutorisationDebits: true,
                                                        dateRevocationAutorisationDebits: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                lettrage: {
                                    select: {
                                        id: true,
                                        statut: true,
                                        solde: true,
                                        soldeAt: true,
                                        createdAt: true,
                                        lignes: {
                                            select: {
                                                id: true,
                                                compteId: true,
                                                libelle: true,
                                                dateEcheance: true,
                                                deviseId: true,
                                                montantDevise: true,
                                                debit: true,
                                                credit: true,
                                                ecriture: {
                                                    select: {
                                                        id: true,
                                                        libelle: true,
                                                        estANouveauProvisoire: true,
                                                        estGenereeParCloture: true,
                                                        corrigeEcritureId: true,
                                                        date: true,
                                                        createdAt: true,
                                                        _count: { select: { lignes: { where: FILTRE_LIGNES_D_AVOIR } } },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        const tvaAuBrouillard = await this.tvaAuBrouillard(tenantId, taux.map((t) => t.id), dateDebut, dateFin);
        const parTaux = new Map();
        for (const t of taux)
            parTaux.set(t.id, { collecte: 0, deductible: 0, attente: 0, avoir: 0, recuperation: 0 });
        const parTauxCompte = new Map();
        const suivi = (tauxId, compteId) => {
            let m = parTauxCompte.get(tauxId);
            if (!m)
                parTauxCompte.set(tauxId, (m = new Map()));
            let v = m.get(compteId);
            if (!v)
                m.set(compteId, (v = { collecte: 0, deductible: 0, recuperation: 0 }));
            return v;
        };
        let montantIndetermine = 0;
        let deductionServicesDiffere = 0;
        let deductionServicesDebits = 0;
        let deductionServicesDebitsSansReference = 0;
        let deductionServicesDebitsMentionLue = 0;
        let deductionServicesDiffereMentionLue = 0;
        let collecteServicesDebits = 0;
        let deductionServicesHorsPeriode = 0;
        let deductionServicesHorsPeriodeMentionLue = 0;
        let deductionServicesDebitsNonDatee = 0;
        let deductionServicesDebitsFactureSansMention = 0;
        const fournisseursHorsPeriode = new Set();
        const fournisseursMentionSansFiche = new Set();
        const fournisseursNonDates = new Set();
        const fournisseursFactureSansMention = new Set();
        let deductionServicesPaiementAnterieur = 0;
        let collecteServicesPaiementAnterieur = 0;
        let collecteServicesAvantAutorisation = 0;
        let tvaExclueArt41 = 0;
        let tvaAVerifierArt41 = 0;
        let tvaNatureDepenseIllisible = 0;
        let tvaDeductibleDechue = 0;
        let avoirsCollecteNonImputes = 0;
        let avoirsSansNoteDeCredit = 0;
        const PLAFOND_REPRISES_AVOIRS = 200;
        const reprisesAvoirsCorriges = [];
        let reprisesAvoirsCorrigesTotal = 0;
        let reprisesAvoirsCorrigesMontant = 0;
        const PLAFOND_NEGATIFS_FACTURES = 200;
        const negatifsDeFactures = [];
        let negatifsDeFacturesTotal = 0;
        let negatifsDeFacturesMontant = 0;
        let negatifsNonPortesTotal = 0;
        let negatifsNonPortesMontant = 0;
        const PLAFOND_RATTACHEMENTS_TARDIFS = 200;
        const rattachementsTardifs = [];
        let rattachementsTardifsTotal = 0;
        let rattachementsTardifsMontant = 0;
        let rattachementsAncienMoteurTotal = 0;
        let rattachementsAncienMoteurMontant = 0;
        let rattachementsDansUnTrouTotal = 0;
        let rattachementsHorsDelaiTotal = 0;
        let rattachementsHorsDelaiMontant = 0;
        let taxeAnnuleeParUnePerte = 0;
        let attenteAnnuleeParUnePerte = 0;
        const negatifsOrphelins = new Set();
        let tvaBiensDateeALaFacture = 0;
        let tvaLivraisonSoiMeme = 0;
        let tvaLocationVente = 0;
        const acomptesImputes = [];
        let acomptesImputesTotal = 0;
        let tvaAcomptesImputes = 0;
        let attenteImputationIndeterminee = 0;
        const groupesImputationIndeterminee = [];
        let groupesImputationIndetermineeTotal = 0;
        const imputationsDesPaiements = [];
        let imputationsDesPaiementsTotal = 0;
        const declareesParPaiement = new Map();
        const rapprochementsANouveauAbandonnes = [];
        let rapprochementsANouveauAbandonnesTotal = 0;
        const ambigusVus = new Set();
        const limiteDecheance = new Date(Date.UTC(dateFin.getUTCFullYear() - 1, 0, 1));
        const debutReportAvoirs = derniereLiquidation?.dateDebut ?? null;
        if (taux.length > 0) {
            const aRelier = [];
            const membresParGroupe = new Map();
            const membresAuxDebitsParGroupe = new Map();
            const facturesParGroupe = new Map();
            const aProlonger = [];
            const tardivesVues = new Set();
            const nommerTardif = (l, dateOrigine, rattacheeAu, nature, montant, drapeaux = {}) => {
                const cle = `${l.id}|${nature}|${rattacheeAu.getTime()}`;
                if (tardivesVues.has(cle))
                    return;
                tardivesVues.add(cle);
                rattachementsTardifsTotal++;
                rattachementsTardifsMontant = TauxTvaService_1.c(rattachementsTardifsMontant + montant);
                if (drapeaux.ancienMoteur) {
                    rattachementsAncienMoteurTotal++;
                    rattachementsAncienMoteurMontant = TauxTvaService_1.c(rattachementsAncienMoteurMontant + montant);
                }
                if (drapeaux.dansUnTrou)
                    rattachementsDansUnTrouTotal++;
                if (drapeaux.horsDelaiArt37) {
                    rattachementsHorsDelaiTotal++;
                    rattachementsHorsDelaiMontant = TauxTvaService_1.c(rattachementsHorsDelaiMontant + Math.abs(montant));
                }
                if (rattachementsTardifs.length < PLAFOND_RATTACHEMENTS_TARDIFS) {
                    rattachementsTardifs.push({
                        piece: l.ecriture.numeroPiece ?? null,
                        libelle: l.ecriture.libelle,
                        dateOrigine: dateOrigine.toISOString().slice(0, 10),
                        rattacheeAu: rattacheeAu.toISOString().slice(0, 10),
                        nature,
                        montant: TauxTvaService_1.c(montant),
                        ...(drapeaux.ancienMoteur ? { ancienMoteur: true } : {}),
                        ...(drapeaux.dansUnTrou ? { dansUnTrou: true } : {}),
                        ...(drapeaux.horsDelaiArt37 ? { horsDelaiArt37: true } : {}),
                    });
                }
            };
            const traiter = (l, relie, impose, prolonge = false) => {
                const cumul = l.tauxTvaId ? parTaux.get(l.tauxTvaId) : undefined;
                if (!cumul)
                    return;
                const estCollecte = l.compte.numero.startsWith(RACINE_COLLECTEE);
                const dateEcriture = l.ecriture.date;
                const regimeLigne = estCollecte ? regimeALaDate(dateEcriture) : regime;
                const dansLaPeriode = dateEcriture >= dateDebut && dateEcriture <= dateFin;
                const valideeLe = l.ecriture.valideeAt ?? l.ecriture.createdAt ?? null;
                const avoir = estCollecte ? Number(l.debit) : Number(l.credit);
                const negatifDAvoir = avoir < -EPSILON;
                if (avoir > EPSILON || negatifDAvoir) {
                    if (!estCollecte) {
                        const r = TauxTvaService_1.rattachementTardif(dateEcriture, valideeLe, liquidationsLues, null, { negatif: negatifDAvoir });
                        if (r.date >= dateDebut && r.date <= dateFin) {
                            cumul.deductible = TauxTvaService_1.c(cumul.deductible - avoir);
                            const v = suivi(l.tauxTvaId, l.compteId);
                            v.deductible = TauxTvaService_1.c(v.deductible - avoir);
                            if (r.tardive)
                                nommerTardif(l, dateEcriture, r.date, 'AVOIR_FOURNISSEUR', -avoir, r);
                        }
                        return;
                    }
                    const recuperationCreance = l.ecriture.recuperationTvaCreance;
                    const perteAvecTva = l.ecriture.mouvementCreanceDouteusePerte;
                    const justifie = l.ecriture.facture?.nature === client_1.NatureFacture.NOTE_DE_CREDIT || !!recuperationCreance || !!perteAvecTva || negatifDAvoir;
                    const compteIci = dansLaPeriode || (dateEcriture < dateDebut && !!debutReportAvoirs && dateEcriture >= debutReportAvoirs);
                    const recuperationTard = TauxTvaService_1.recuperationTardive(dateEcriture, valideeLe, liquidationsLues);
                    if (recuperationTard) {
                        if (dansLaPeriode)
                            cumul.avoir = TauxTvaService_1.c(cumul.avoir + avoir);
                        if (recuperationTard.date >= dateDebut && recuperationTard.date <= dateFin) {
                            if (!justifie)
                                avoirsSansNoteDeCredit = TauxTvaService_1.c(avoirsSansNoteDeCredit + avoir);
                            cumul.recuperation = TauxTvaService_1.c(cumul.recuperation + avoir);
                            const v = suivi(l.tauxTvaId, l.compteId);
                            v.recuperation = TauxTvaService_1.c(v.recuperation + avoir);
                            nommerTardif(l, dateEcriture, recuperationTard.date, 'AVOIR_SUR_VENTE', avoir, {
                                ...recuperationTard,
                                horsDelaiArt37: TauxTvaService_1.horsDelaiArt37(dateEcriture, recuperationTard.date),
                            });
                        }
                        return;
                    }
                    if (compteIci && !justifie)
                        avoirsSansNoteDeCredit = TauxTvaService_1.c(avoirsSansNoteDeCredit + avoir);
                    if (negatifDAvoir) {
                        const pese = dansLaPeriode
                            ? 'CONSTATEE_ICI'
                            : dateEcriture < dateDebut && !debutReportAvoirs
                                ? 'NON_IMPUTEE'
                                : dateEcriture < dateDebut && !!debutReportAvoirs && dateEcriture >= debutReportAvoirs
                                    ? 'DEDUCTION_REPRISE_ICI'
                                    : null;
                        if (pese) {
                            reprisesAvoirsCorrigesTotal += 1;
                            reprisesAvoirsCorrigesMontant = TauxTvaService_1.c(reprisesAvoirsCorrigesMontant - avoir);
                            if (reprisesAvoirsCorriges.length < PLAFOND_REPRISES_AVOIRS) {
                                const e = l.ecriture;
                                reprisesAvoirsCorriges.push({
                                    piece: e.numeroPiece ?? null,
                                    date: dateEcriture.toISOString().slice(0, 10),
                                    avoirCorrige: e.corrigeEcriture
                                        ? { piece: e.corrigeEcriture.numeroPiece, date: e.corrigeEcriture.date.toISOString().slice(0, 10) }
                                        : null,
                                    montant: TauxTvaService_1.c(-avoir),
                                    pese,
                                });
                            }
                        }
                    }
                    if (dansLaPeriode)
                        cumul.avoir = TauxTvaService_1.c(cumul.avoir + avoir);
                    else if (dateEcriture < dateDebut) {
                        if (!debutReportAvoirs) {
                            avoirsCollecteNonImputes = TauxTvaService_1.c(avoirsCollecteNonImputes + avoir);
                        }
                        else if (dateEcriture >= debutReportAvoirs) {
                            cumul.recuperation = TauxTvaService_1.c(cumul.recuperation + avoir);
                            const v = suivi(l.tauxTvaId, l.compteId);
                            v.recuperation = TauxTvaService_1.c(v.recuperation + avoir);
                        }
                    }
                    return;
                }
                const negatifDeFacture = estCollecte ? Number(l.credit) < -EPSILON : Number(l.debit) < -EPSILON;
                if (negatifDeFacture) {
                    const x = TauxTvaService_1.c(estCollecte ? -Number(l.credit) : -Number(l.debit));
                    const e = l.ecriture;
                    const dateFacture = e.corrigeEcriture?.date ?? dateEcriture;
                    const contrepartiesNegatif = l.ecriture.lignes
                        .filter((x) => estCollecte
                        ? x.compte?.classe === client_1.ClasseCompte.CLASSE_7
                        : x.compte?.classe === client_1.ClasseCompte.CLASSE_6 || x.compte?.classe === client_1.ClasseCompte.CLASSE_2)
                        .map((x) => x.compte?.numero)
                        .filter((n) => Boolean(n));
                    const fournisseurNegatif = estCollecte
                        ? { autorise: false }
                        : TauxTvaService_1.fournisseurAuxDebits(l.ecriture.lignes.filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_4), dateFacture);
                    const { base: baseNegatif } = this.baseExigibilite(referentiel, estCollecte ? regimeALaDate(dateFacture) : regime, l.compte.numero, estCollecte, fournisseurNegatif.autorise, contrepartiesNegatif);
                    const nommer = (pese, porte = true) => {
                        if (porte) {
                            negatifsDeFacturesTotal++;
                            negatifsDeFacturesMontant = TauxTvaService_1.c(negatifsDeFacturesMontant + x);
                        }
                        else {
                            negatifsNonPortesTotal++;
                            negatifsNonPortesMontant = TauxTvaService_1.c(negatifsNonPortesMontant + x);
                        }
                        if (negatifsDeFactures.length < PLAFOND_NEGATIFS_FACTURES) {
                            negatifsDeFactures.push({
                                piece: e.numeroPiece ?? null,
                                date: dateEcriture.toISOString().slice(0, 10),
                                factureCorrigee: e.corrigeEcriture
                                    ? { piece: e.corrigeEcriture.numeroPiece, date: e.corrigeEcriture.date.toISOString().slice(0, 10) }
                                    : null,
                                sens: estCollecte ? 'VENTE' : 'ACHAT',
                                montant: x,
                                pese,
                            });
                        }
                    };
                    const dans = (d) => d >= dateDebut && d <= dateFin;
                    const valideeFacture = e.corrigeEcriture?.valideeAt ?? e.corrigeEcriture?.createdAt ?? null;
                    const portageFacture = () => TauxTvaService_1.rattachementTardif(dateFacture, valideeFacture, liquidationsLues);
                    if (baseNegatif === 'ENCAISSEMENT') {
                        if (estCollecte && dans(dateFacture)) {
                            cumul.attente = TauxTvaService_1.c(cumul.attente - x);
                            nommer('RETIREE_DE_L_ATTENTE');
                        }
                        else if (!estCollecte && dansLaPeriode) {
                            nommer('ACHAT_A_L_ENCAISSEMENT_NON_REPRIS', false);
                        }
                        return;
                    }
                    const r = TauxTvaService_1.rattachementTardif(dateFacture, valideeLe, liquidationsLues, dateEcriture, { negatif: true });
                    if (!estCollecte) {
                        const pf = portageFacture();
                        if (dateFacture < new Date(Date.UTC(pf.date.getUTCFullYear() - 1, 0, 1))) {
                            if (dans(r.date))
                                nommer('DEDUCTION_DECHUE_RIEN_A_REPRENDRE', false);
                            return;
                        }
                    }
                    if (!r.tardive && r.date < dateDebut) {
                        if (dansLaPeriode && !liquidationsLues.some((q) => q.dateDebut <= dateFacture && dateFacture <= q.dateFin)) {
                            nommer('PESE_SUR_UNE_PERIODE_NON_LIQUIDEE', false);
                        }
                        return;
                    }
                    if (!dans(r.date))
                        return;
                    const v = suivi(l.tauxTvaId, l.compteId);
                    if (estCollecte) {
                        const compense = r.tardive && (() => {
                            const pf = portageFacture();
                            return pf.tardive && dans(pf.date);
                        })();
                        if (r.tardive && !compense) {
                            cumul.recuperation = TauxTvaService_1.c(cumul.recuperation + x);
                            v.recuperation = TauxTvaService_1.c(v.recuperation + x);
                            nommerTardif(l, dateFacture, r.date, 'NEGATIF_DE_VENTE', -x, { ...r, horsDelaiArt37: TauxTvaService_1.horsDelaiArt37(dateEcriture, r.date) });
                        }
                        else {
                            cumul.collecte = TauxTvaService_1.c(cumul.collecte - x);
                            v.collecte = TauxTvaService_1.c(v.collecte - x);
                            if (r.tardive)
                                nommerTardif(l, dateFacture, r.date, 'NEGATIF_DE_VENTE', -x, r);
                        }
                        nommer(r.tardive && !compense ? 'REPRISE_ICI' : 'ANNULEE_ICI');
                        return;
                    }
                    const part = this.partExclueArt41(l.ecriture.lignes
                        .filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_6)
                        .map((x) => ({ debit: -Number(x.debit), credit: -Number(x.credit), compte: x.compte })));
                    const repris = TauxTvaService_1.c(x - x * part.exclue);
                    cumul.deductible = TauxTvaService_1.c(cumul.deductible - repris);
                    v.deductible = TauxTvaService_1.c(v.deductible - repris);
                    if (r.tardive)
                        nommerTardif(l, dateFacture, r.date, 'NEGATIF_D_ACHAT', -repris, r);
                    nommer(r.tardive ? 'REPRISE_ICI' : 'ANNULEE_ICI');
                    return;
                }
                const montant = estCollecte ? Number(l.credit) : Number(l.debit);
                if (montant <= EPSILON)
                    return;
                const lignesTiers = l.ecriture.lignes.filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_4 && x.lettrage);
                const lignesCharge = l.ecriture.lignes.filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_6);
                const fournisseur = estCollecte
                    ? { autorise: false, reference: null, nonDatee: [], horsPeriode: [], noms: [] }
                    : TauxTvaService_1.fournisseurAuxDebits(l.ecriture.lignes.filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_4), dateEcriture);
                const contreparties = l.ecriture.lignes
                    .filter((x) => estCollecte
                    ? x.compte?.classe === client_1.ClasseCompte.CLASSE_7
                    : x.compte?.classe === client_1.ClasseCompte.CLASSE_6 || x.compte?.classe === client_1.ClasseCompte.CLASSE_2)
                    .map((x) => x.compte?.numero)
                    .filter((n) => Boolean(n));
                const { base, nature } = this.baseExigibilite(referentiel, regimeLigne, l.compte.numero, estCollecte, fournisseur.autorise, contreparties);
                const nonLettre = { creance: 0, immediat: 0 };
                let avanceImputee = 0;
                let ttcFacture = 0;
                for (const x of l.ecriture.lignes) {
                    const classe = x.compte?.classe;
                    const numero = x.compte?.numero ?? '';
                    const sens = estCollecte ? Number(x.debit) - Number(x.credit) : Number(x.credit) - Number(x.debit);
                    if (sens <= EPSILON)
                        continue;
                    if (classe === client_1.ClasseCompte.CLASSE_5 || (classe === client_1.ClasseCompte.CLASSE_4 && !numero.startsWith('44')))
                        ttcFacture += sens;
                    if (classe === client_1.ClasseCompte.CLASSE_5) {
                        nonLettre.immediat += sens;
                    }
                    else if (classe === client_1.ClasseCompte.CLASSE_4 && !x.lettrage && !numero.startsWith('44')) {
                        if (numero.startsWith(estCollecte ? '419' : '409')) {
                            nonLettre.immediat += sens;
                            avanceImputee += sens;
                        }
                        else
                            nonLettre.creance += sens;
                    }
                }
                if (base === 'ENCAISSEMENT' && !relie && lignesTiers.length === 0 && nonLettre.creance > EPSILON) {
                    aRelier.push(l);
                    return;
                }
                if (impose === undefined &&
                    !prolonge &&
                    base === 'ENCAISSEMENT' &&
                    lignesTiers.some((x) => x.lettrage?.statut === 'PARTIEL')) {
                    aProlonger.push(l);
                    return;
                }
                const groupeMulti = impose === undefined ? TauxTvaService_1.groupeAPlusieursFactures(lignesTiers) : null;
                if (groupeMulti) {
                    const ecritureId = l.ecriture.id;
                    if (ecritureId) {
                        let factures = facturesParGroupe.get(groupeMulti.id);
                        if (!factures)
                            facturesParGroupe.set(groupeMulti.id, (factures = new Map()));
                        let f = factures.get(ecritureId);
                        if (!f)
                            factures.set(ecritureId, (f = { engage: groupeMulti.engage, enc: new Map(), art41: null, horsRegle: false }));
                        if (nonLettre.creance > EPSILON || nonLettre.immediat > EPSILON)
                            f.horsRegle = true;
                        if (base === 'ENCAISSEMENT') {
                            const cle = `${l.tauxTvaId}|${l.compteId}`;
                            f.enc.set(cle, (f.enc.get(cle) ?? 0) + montant);
                            if (!estCollecte) {
                                const part = this.partExclueArt41(lignesCharge);
                                const signature = `${part.exclue.toFixed(6)}|${part.aVerifier.toFixed(6)}|${part.lisible}`;
                                if (f.art41 !== null && f.art41 !== signature)
                                    f.horsRegle = true;
                                f.art41 = signature;
                            }
                        }
                    }
                    if (base === 'ENCAISSEMENT') {
                        const membres = membresParGroupe.get(groupeMulti.id) ?? [];
                        membres.push({ l, relie, prolonge, montant, dateEcriture });
                        membresParGroupe.set(groupeMulti.id, membres);
                        return;
                    }
                    if (TauxTvaService_1.estAuxDebits(base, nature, estCollecte, regimeLigne, fournisseur.autorise)) {
                        const membres = membresAuxDebitsParGroupe.get(groupeMulti.id) ?? [];
                        membres.push({ l, relie, prolonge, montant, dateEcriture });
                        membresAuxDebitsParGroupe.set(groupeMulti.id, membres);
                        return;
                    }
                }
                if (nature === 'INDETERMINEE' && dansLaPeriode)
                    montantIndetermine += montant;
                if (dansLaPeriode && nature === 'BIENS' && base === 'DATE_ECRITURE') {
                    if (estCollecte && (l.compte.numero.startsWith('4434') || contreparties.some((n) => n.startsWith('72')))) {
                        tvaLivraisonSoiMeme += montant;
                    }
                    else if (!estCollecte && contreparties.some((n) => n.startsWith('6234'))) {
                        tvaLocationVente += montant;
                    }
                    else {
                        tvaBiensDateeALaFacture += montant;
                    }
                }
                if (dansLaPeriode && base === 'ENCAISSEMENT' && avanceImputee > EPSILON && ttcFacture > EPSILON) {
                    const tva = TauxTvaService_1.c((montant * Math.min(avanceImputee, ttcFacture)) / ttcFacture);
                    tvaAcomptesImputes = TauxTvaService_1.c(tvaAcomptesImputes + tva);
                    acomptesImputesTotal++;
                    if (acomptesImputes.length < PLAFOND_INCERTAINES) {
                        acomptesImputes.push({ facture: l.ecriture.libelle, date: dateEcriture.toISOString().slice(0, 10), tva, collecte: estCollecte });
                    }
                }
                if (estCollecte && nature === 'SERVICES' && regimeLigne === 'DEBITS' && dansLaPeriode) {
                    collecteServicesDebits += montant;
                }
                if (estCollecte && nature === 'SERVICES' && regime === 'DEBITS' && regimeLigne !== 'DEBITS' && dansLaPeriode) {
                    collecteServicesAvantAutorisation += montant;
                }
                if (!estCollecte && nature === 'SERVICES' && dansLaPeriode) {
                    const mentionLue = TauxTvaService_1.mentionDebitsLueSurLaFacture(l.ecriture.facture);
                    if (base === 'ENCAISSEMENT' && fournisseur.horsPeriode.length > 0) {
                        deductionServicesHorsPeriode += montant;
                        for (const n of fournisseur.horsPeriode)
                            fournisseursHorsPeriode.add(n);
                        if (mentionLue)
                            deductionServicesHorsPeriodeMentionLue += montant;
                    }
                    else if (base === 'ENCAISSEMENT') {
                        deductionServicesDiffere += montant;
                        if (mentionLue) {
                            deductionServicesDiffereMentionLue += montant;
                            for (const n of fournisseur.noms)
                                fournisseursMentionSansFiche.add(n);
                        }
                    }
                    else {
                        deductionServicesDebits += montant;
                        if (!fournisseur.reference)
                            deductionServicesDebitsSansReference += montant;
                        if (mentionLue)
                            deductionServicesDebitsMentionLue += montant;
                        if (fournisseur.nonDatee.length > 0) {
                            deductionServicesDebitsNonDatee += montant;
                            for (const n of fournisseur.nonDatee)
                                fournisseursNonDates.add(n);
                        }
                        const facture = l.ecriture.facture;
                        if (facture?.sens === client_1.SensFacture.ACHAT && facture.mentionTvaDebits !== true) {
                            deductionServicesDebitsFactureSansMention += montant;
                            for (const n of fournisseur.noms)
                                fournisseursFactureSansMention.add(n);
                        }
                    }
                }
                const auxDebits = TauxTvaService_1.estAuxDebits(base, nature, estCollecte, regimeLigne, fournisseur.autorise);
                let tranches = impose && impose !== 'MAIN' && 'tranches' in impose
                    ? impose.tranches
                    : base === 'DATE_ECRITURE'
                        ? auxDebits
                            ? impose && impose !== 'MAIN' && 'auDebit' in impose
                                ? impose.auDebit
                                : TauxTvaService_1.tranchesAuxDebits(lignesTiers, dateEcriture)
                            : [{ date: dateEcriture, fraction: 1 }]
                        : this.exigibilite(l, lignesTiers, l.ecriture.date, nonLettre, impose && impose !== 'MAIN' && 'partLettree' in impose ? impose.partLettree : undefined);
                const designees = l.ecriture.lignes.filter((x) => {
                    if (!recouvrementsParLigne.has(x.id))
                        return false;
                    if ((0, creances_douteuses_1.partageSonLettrage)(x)) {
                        lignesPartagees.add(x.id);
                        return false;
                    }
                    return true;
                });
                for (const x of designees)
                    lignesRattachees.add(x.id);
                if (base === 'ENCAISSEMENT' && designees.length > 0) {
                    const ttc = l.ecriture.lignes.reduce((t, x) => {
                        const numero = x.compte?.numero ?? '';
                        const sens = estCollecte ? Number(x.debit) - Number(x.credit) : Number(x.credit) - Number(x.debit);
                        const tiersOuTresorerie = (x.compte?.classe === client_1.ClasseCompte.CLASSE_4 && !numero.startsWith('44')) || x.compte?.classe === client_1.ClasseCompte.CLASSE_5;
                        return tiersOuTresorerie && sens > EPSILON ? t + sens : t;
                    }, 0);
                    let disponible = tranches.filter((t) => !t.date).reduce((t, x) => t + x.fraction, 0);
                    const recouvrements = designees.flatMap((x) => recouvrementsParLigne.get(x.id) ?? []).sort((a, b) => a.date.getTime() - b.date.getTime());
                    if (ttc > EPSILON && disponible > EPSILON) {
                        const datees = tranches.filter((t) => t.date);
                        for (const r of recouvrements) {
                            const f = Math.min(r.montant / ttc, disponible);
                            if (f <= EPSILON)
                                continue;
                            disponible -= f;
                            datees.push({ date: r.date, fraction: f });
                        }
                        tranches = disponible > EPSILON ? [...datees, { date: null, fraction: disponible }] : datees;
                    }
                }
                const montants = TauxTvaService_1.montantsDesTranches(montant, tranches);
                const perteAnnule = estCollecte && base === 'ENCAISSEMENT' ? TauxTvaService_1.perteQuiAnnuleLaTaxe(l.ecriture.lignes) : null;
                if (estCollecte && base === 'ENCAISSEMENT' && dansLaPeriode) {
                    let enAttente = tranches.reduce((t, x, i) => (x.date ? t : t + montants[i]), 0);
                    if (perteAnnule) {
                        const annulee = Math.min(enAttente, TauxTvaService_1.partAnnuleeParLaPerte(perteAnnule, montant, ttcFacture));
                        enAttente = TauxTvaService_1.c(enAttente - annulee);
                        attenteAnnuleeParUnePerte = TauxTvaService_1.c(attenteAnnuleeParUnePerte + annulee);
                    }
                    cumul.attente = TauxTvaService_1.c(cumul.attente + enAttente);
                    if (impose === 'MAIN')
                        attenteImputationIndeterminee = TauxTvaService_1.c(attenteImputationIndeterminee + enAttente);
                }
                const factureRecue = !estCollecte && base === 'DATE_ECRITURE' && l.ecriture.facture?.sens === client_1.SensFacture.ACHAT && l.ecriture.facture.dateReception
                    ? l.ecriture.facture
                    : null;
                let aImputer;
                if (base === 'ENCAISSEMENT') {
                    const datees = tranches
                        .map((t, i) => ({ date: t.date, montant: montants[i] }))
                        .filter((t) => !!t.date && t.montant > EPSILON);
                    if (!estCollecte) {
                        for (const t of datees) {
                            if (t.date < limiteDecheance)
                                tvaDeductibleDechue = TauxTvaService_1.c(tvaDeductibleDechue + t.montant);
                        }
                    }
                    const repartition = impose && impose !== 'MAIN' && 'repartition' in impose ? impose.repartition : TauxTvaService_1.repartirEncaissement({
                        ligneId: l.id,
                        montant,
                        dateEcriture,
                        tranches: datees,
                        liquidations: liquidationsLues,
                        declareParAncienMoteur: (liq) => TauxTvaService_1.declareParAncienMoteur(lignesTiers, montant, dateEcriture, liq, l.ecriture.createdAt),
                    });
                    for (const liq of anciennes) {
                        const T = liq.createdAt;
                        const saisie = l.ecriture.createdAt;
                        if (dateEcriture > liq.dateFin || (saisie && saisie > T))
                            continue;
                        const groupeTouche = lignesTiers.some((x) => {
                            const g = x.lettrage;
                            if (!g?.id || (g.createdAt && g.createdAt > T))
                                return false;
                            return (modificationsDeGroupe.get(g.id) ?? []).some((d) => d > T);
                        });
                        const groupeSupprime = l.ecriture.lignes.some((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_4 &&
                            (suppressionsParCompte.get(x.compteId) ?? []).some((sup) => sup.le > T && (!sup.creeLe || sup.creeLe <= T)));
                        if (!groupeTouche && !groupeSupprime)
                            continue;
                        const cle = `${l.id}|${liq.id}`;
                        if (incertainesVues.has(cle))
                            continue;
                        incertainesVues.add(cle);
                        reconstitutionsIncertainesTotal++;
                        if (reconstitutionsIncertaines.length < PLAFOND_INCERTAINES) {
                            reconstitutionsIncertaines.push({
                                facture: l.ecriture.libelle,
                                dateDebut: liq.dateDebut.toISOString().slice(0, 10),
                                dateFin: liq.dateFin.toISOString().slice(0, 10),
                                montantReconstitue: repartition.parLiquidation.get(liq.id) ?? 0,
                            });
                        }
                    }
                    let libres = repartition.libres;
                    if (perteAnnule && !liquidationExacte) {
                        const partAnnulee = TauxTvaService_1.partAnnuleeParLaPerte(perteAnnule, montant, ttcFacture);
                        const dejaDeclare = [...repartition.parLiquidation.values()].reduce((t, v) => t + v, 0);
                        const borne = TauxTvaService_1.bornerParLaPerte(repartition.libres, dejaDeclare, montant, partAnnulee, perteAnnule.le);
                        libres = borne.admises;
                        for (const x of borne.ecartees) {
                            if (x.date >= dateDebut && x.date <= dateFin)
                                taxeAnnuleeParUnePerte = TauxTvaService_1.c(taxeAnnuleeParUnePerte + x.montant);
                        }
                    }
                    const parts = liquidationExacte
                        ? [{ date: dateDebut, montant: repartition.parLiquidation.get(liquidationExacte.id) ?? 0, origine: dateDebut }]
                        : libres.filter((x) => x.date >= dateDebut && x.date <= dateFin);
                    aImputer = [];
                    if (lignesTiers.some((x) => x.lettrage?.lignes && TauxTvaService_1.neutraliserLesNegatifs(x.lettrage.lignes) === null)) {
                        negatifsOrphelins.add(l.id);
                    }
                    for (const x of parts) {
                        if (x.montant <= EPSILON)
                            continue;
                        if (!estCollecte && !liquidationExacte && x.origine < limiteDecheance)
                            continue;
                        if (!liquidationExacte)
                            figeEncaissement[l.id] = TauxTvaService_1.c((figeEncaissement[l.id] ?? 0) + x.montant);
                        aImputer.push({ date: x.date, exigible: x.montant, reparti: true });
                    }
                }
                else {
                    aImputer = tranches.map((t, i) => ({ date: t.date, exigible: montants[i], auPaiement: t.auPaiement }));
                }
                aImputer.forEach(({ date: dateExigible, exigible, auPaiement, reparti }) => {
                    let date = dateExigible;
                    if (!reparti) {
                        const dateDuDelai = date && factureRecue && !auPaiement && factureRecue.dateFacture < date ? factureRecue.dateFacture : date;
                        if (!estCollecte && dateDuDelai && dateDuDelai < limiteDecheance) {
                            tvaDeductibleDechue = TauxTvaService_1.c(tvaDeductibleDechue + exigible);
                            return;
                        }
                        if (date) {
                            const r = TauxTvaService_1.rattachementTardif(date, valideeLe, liquidationsLues);
                            if (r.tardive && r.date >= dateDebut && r.date <= dateFin) {
                                nommerTardif(l, date, r.date, estCollecte ? 'COLLECTE' : 'DEDUCTION', exigible, r);
                            }
                            date = r.date;
                        }
                    }
                    if (!date || date < dateDebut || date > dateFin)
                        return;
                    if (auPaiement) {
                        if (estCollecte)
                            collecteServicesPaiementAnterieur = TauxTvaService_1.c(collecteServicesPaiementAnterieur + exigible);
                        else
                            deductionServicesPaiementAnterieur = TauxTvaService_1.c(deductionServicesPaiementAnterieur + exigible);
                    }
                    if (estCollecte) {
                        cumul.collecte = TauxTvaService_1.c(cumul.collecte + exigible);
                        const v = suivi(l.tauxTvaId, l.compteId);
                        v.collecte = TauxTvaService_1.c(v.collecte + exigible);
                        return;
                    }
                    const part = this.partExclueArt41(lignesCharge);
                    const exclu = TauxTvaService_1.c(exigible * part.exclue);
                    if (exclu > EPSILON)
                        tvaExclueArt41 = TauxTvaService_1.c(tvaExclueArt41 + exclu);
                    if (part.aVerifier > 0) {
                        tvaAVerifierArt41 = TauxTvaService_1.c(tvaAVerifierArt41 + exigible * part.aVerifier);
                    }
                    if (!part.lisible)
                        tvaNatureDepenseIllisible = TauxTvaService_1.c(tvaNatureDepenseIllisible + exigible);
                    cumul.deductible = TauxTvaService_1.c(cumul.deductible + exigible - exclu);
                    const v = suivi(l.tauxTvaId, l.compteId);
                    v.deductible = TauxTvaService_1.c(v.deductible + exigible - exclu);
                });
            };
            await (0, lecture_par_lots_1.lireParLots)(lire, (l) => traiter(l, false), lecture_par_lots_1.LOT_ECRITURES);
            const signalerAmbigu = (l, motif) => {
                if (ambigusVus.has(l.id))
                    return;
                ambigusVus.add(l.id);
                rapprochementsANouveauAbandonnesTotal++;
                if (rapprochementsANouveauAbandonnes.length < PLAFOND_INCERTAINES) {
                    const estCollecte = l.compte.numero.startsWith(RACINE_COLLECTEE);
                    rapprochementsANouveauAbandonnes.push({
                        facture: l.ecriture.libelle,
                        date: l.ecriture.date.toISOString().slice(0, 10),
                        tva: TauxTvaService_1.c(Number(estCollecte ? l.credit : l.debit)),
                        motif,
                    });
                }
            };
            const originesConnues = new Map();
            for (const l of await this.relierAuxANouveaux(tenantId, aRelier, signalerAmbigu, originesConnues))
                traiter(l, true);
            for (const l of await this.prolongerParLesANouveaux(tenantId, aProlonger, signalerAmbigu))
                traiter(l, false, undefined, true);
            const premierDe = (membres) => TauxTvaService_1.groupeAPlusieursFactures(membres[0].l.ecriture.lignes.filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_4 && x.lettrage));
            const groupesTraduits = new Map();
            for (const [groupeId, membres] of [...membresParGroupe, ...membresAuxDebitsParGroupe]) {
                if (groupesTraduits.has(groupeId))
                    continue;
                const premier = premierDe(membres);
                groupesTraduits.set(groupeId, {
                    premier,
                    groupe: await this.traduireLesReports(tenantId, premier.groupe, premier.sensFacture, originesConnues),
                });
            }
            const cleDuGroupeLu = new Map();
            for (const [groupeId, { groupe }] of groupesTraduits) {
                const ids = (groupe.lignes ?? []).map((x) => x.id);
                if (ids.length === 0 || ids.some((id) => !id))
                    continue;
                const signature = [...new Set(ids)].sort().join('|');
                const deja = cleDuGroupeLu.get(signature);
                if (!deja) {
                    cleDuGroupeLu.set(signature, groupeId);
                    continue;
                }
                for (const carte of [membresParGroupe, membresAuxDebitsParGroupe]) {
                    const membres = carte.get(groupeId);
                    if (!membres)
                        continue;
                    carte.set(deja, [...(carte.get(deja) ?? []), ...membres]);
                    carte.delete(groupeId);
                }
                const decrites = facturesParGroupe.get(groupeId);
                if (decrites) {
                    const cible = facturesParGroupe.get(deja) ?? new Map();
                    for (const [ecritureId, f] of decrites)
                        if (!cible.has(ecritureId))
                            cible.set(ecritureId, f);
                    facturesParGroupe.set(deja, cible);
                    facturesParGroupe.delete(groupeId);
                }
            }
            const lignesDesGroupes = [
                ...new Set([...groupesTraduits.values()].flatMap(({ groupe }) => (groupe.lignes ?? []).map((g) => g.id).filter((id) => !!id))),
            ];
            for (let i = 0; i < lignesDesGroupes.length; i += lecture_par_lots_1.LOT_ECRITURES) {
                const tranche = lignesDesGroupes.slice(i, i + lecture_par_lots_1.LOT_ECRITURES);
                const declarees = await this.prisma.imputationPaiement.findMany({
                    where: { tenantId, retireeLe: null, ligneReglementId: { in: tranche } },
                    select: { ligneReglementId: true, ligneFactureId: true, montant: true },
                    orderBy: { id: 'asc' },
                    take: tranche.length * 200,
                });
                for (const d of declarees) {
                    declareesParPaiement.set(d.ligneReglementId, [
                        ...(declareesParPaiement.get(d.ligneReglementId) ?? []),
                        { detteId: d.ligneFactureId, montant: Number(d.montant) },
                    ]);
                }
            }
            const lireLeGroupe = (groupeId) => {
                const { premier, groupe: traduit } = groupesTraduits.get(groupeId);
                const lu = TauxTvaService_1.lectureDuGroupe(traduit, premier.sensFacture);
                const groupe = { ...traduit, lignes: lu.lignes };
                const reglements = TauxTvaService_1.reglementsDuGroupe(groupe.lignes, premier.sensFacture);
                const declarationsNonLues = lu.motifEnBloc
                    ? TauxTvaService_1.c((groupe.lignes ?? [])
                        .filter((g) => g.id &&
                        g.ecriture &&
                        g.ecriture.date >= dateDebut &&
                        g.ecriture.date <= dateFin &&
                        Number(g.debit) - Number(g.credit) > 0 !== premier.sensFacture > 0)
                        .reduce((t, g) => t + (declareesParPaiement.get(g.id) ?? []).reduce((s, d) => s + d.montant, 0), 0))
                    : 0;
                return { premier, groupe, factures: lu.factures, avecAvoir: lu.avecAvoir, motifEnBloc: lu.motifEnBloc, reglements, declarationsNonLues };
            };
            for (const [groupeId, membres] of membresAuxDebitsParGroupe) {
                const { premier, groupe, factures, motifEnBloc, reglements, declarationsNonLues } = lireLeGroupe(groupeId);
                const debitLePlusTardif = membres.reduce((t, m) => (m.dateEcriture > t ? m.dateEcriture : t), membres[0].dateEcriture);
                const enJeu = reglements
                    .filter((r) => r.date < debitLePlusTardif && r.date >= dateDebut && r.date <= dateFin)
                    .reduce((t, r) => t + r.montant, 0);
                if (motifEnBloc) {
                    if (enJeu > EPSILON) {
                        groupesImputationIndetermineeTotal++;
                        if (groupesImputationIndeterminee.length < PLAFOND_INCERTAINES) {
                            groupesImputationIndeterminee.push({
                                factures: [...new Set(membres.map((m) => m.l.ecriture.libelle))],
                                encaisse: TauxTvaService_1.c(enJeu),
                                motif: `régime des débits, taxe datée au débit · ${motifEnBloc}`,
                                ...(declarationsNonLues > EPSILON ? { declarationsNonLues } : {}),
                            });
                        }
                    }
                    for (const m of membres)
                        traiter(m.l, m.relie, { auDebit: [{ date: m.dateEcriture, fraction: 1 }] }, m.prolonge);
                    continue;
                }
                const imputation = TauxTvaService_1.imputerLeGroupe(groupe, premier.sensFacture, factures, declareesParPaiement, {
                    debut: dateDebut,
                    fin: dateFin,
                });
                for (const m of membres) {
                    const parts = imputation.partLettreeDe(m.l.ecriture.id ?? '');
                    traiter(m.l, m.relie, { auDebit: TauxTvaService_1.tranchesAuxDebitsImputees(parts, m.dateEcriture) }, m.prolonge);
                }
                if (enJeu > EPSILON) {
                    imputationsDesPaiementsTotal++;
                    if (imputationsDesPaiements.length < PLAFOND_INCERTAINES) {
                        imputationsDesPaiements.push({
                            factures: imputation.libelles,
                            encaisse: TauxTvaService_1.c(enJeu),
                            fondement: imputation.fondement,
                            ...(imputation.declareNonRetenu > EPSILON ? { declareNonRetenu: imputation.declareNonRetenu } : {}),
                        });
                    }
                }
            }
            for (const [groupeId, membres] of membresParGroupe) {
                const { premier, groupe, factures, avecAvoir, motifEnBloc, reglements, declarationsNonLues } = lireLeGroupe(groupeId);
                const decrites = facturesParGroupe.get(groupeId) ?? new Map();
                const memeComposition = (a, b) => {
                    if (a.art41 !== b.art41 || a.enc.size !== b.enc.size)
                        return false;
                    const tolerance = 0.02 / Math.max(EPSILON, Math.min(a.engage, b.engage));
                    for (const [cle, m] of a.enc) {
                        const n = b.enc.get(cle);
                        if (n === undefined || Math.abs(m / a.engage - n / b.engage) > tolerance)
                            return false;
                    }
                    return true;
                };
                const lues = factures ? [...factures].map(([id, montant]) => ({ montant, f: decrites.get(id) })) : [];
                const uniforme = !!factures &&
                    !avecAvoir &&
                    lues.length > 1 &&
                    lues.every((x) => x.f && !x.f.horsRegle && Math.abs(x.f.engage - x.montant) <= 0.01 && memeComposition(lues[0].f, x.f)) &&
                    [...decrites.keys()].every((id) => factures.has(id));
                const percu = reglements.filter((r) => r.date >= dateDebut && r.date <= dateFin).reduce((t, r) => t + r.montant, 0);
                if (!uniforme && motifEnBloc) {
                    if (percu > EPSILON) {
                        groupesImputationIndetermineeTotal++;
                        if (groupesImputationIndeterminee.length < PLAFOND_INCERTAINES) {
                            groupesImputationIndeterminee.push({
                                factures: [...new Set(membres.map((m) => m.l.ecriture.libelle))],
                                encaisse: TauxTvaService_1.c(percu),
                                motif: motifEnBloc,
                                ...(declarationsNonLues > EPSILON ? { declarationsNonLues } : {}),
                            });
                        }
                    }
                    for (const m of membres)
                        traiter(m.l, m.relie, 'MAIN', m.prolonge);
                    continue;
                }
                if (!uniforme) {
                    const imputation = TauxTvaService_1.imputerLeGroupe(groupe, premier.sensFacture, factures, declareesParPaiement, {
                        debut: dateDebut,
                        fin: dateFin,
                    });
                    for (const m of membres) {
                        traiter(m.l, m.relie, { partLettree: imputation.partLettreeDe(m.l.ecriture.id ?? '') }, m.prolonge);
                    }
                    if (percu > EPSILON) {
                        imputationsDesPaiementsTotal++;
                        if (imputationsDesPaiements.length < PLAFOND_INCERTAINES) {
                            imputationsDesPaiements.push({
                                factures: imputation.libelles,
                                encaisse: TauxTvaService_1.c(percu),
                                fondement: imputation.fondement,
                                ...(imputation.declareNonRetenu > EPSILON ? { declareNonRetenu: imputation.declareNonRetenu } : {}),
                            });
                        }
                    }
                    continue;
                }
                const totalFactures = [...factures.values()].reduce((t, v) => t + v, 0);
                const fractions = TauxTvaService_1.fractionsDuGroupe(reglements, totalFactures, groupe.statut === 'SOLDE');
                const parCle = new Map();
                for (const m of membres) {
                    const cle = `${m.l.tauxTvaId}|${m.l.compteId}`;
                    parCle.set(cle, [...(parCle.get(cle) ?? []), m]);
                }
                for (const [cle, lignesCle] of parCle) {
                    const montantsDuGroupe = TauxTvaService_1.montantsDesTranches(lignesCle.reduce((t, m) => t + m.montant, 0), fractions);
                    const datees = [];
                    fractions.forEach((t, j) => {
                        if (t.date && montantsDuGroupe[j] > EPSILON)
                            datees.push({ date: t.date, montant: montantsDuGroupe[j] });
                    });
                    const declareParLigne = lignesCle.map((m) => {
                        const tiers = m.l.ecriture.lignes.filter((x) => x.compte?.classe === client_1.ClasseCompte.CLASSE_4 && x.lettrage);
                        const rendu = new Map();
                        for (const liq of liquidationsLues) {
                            rendu.set(liq.id, TauxTvaService_1.c(liq.figee
                                ? Number(liq.figee[m.l.id] ?? 0)
                                : TauxTvaService_1.declareParAncienMoteur(tiers, m.montant, m.dateEcriture, liq, m.l.ecriture.createdAt)));
                        }
                        return rendu;
                    });
                    const cleGroupe = `groupe:${groupeId}:${cle}`;
                    const repartitionGroupe = TauxTvaService_1.repartirEncaissement({
                        ligneId: cleGroupe,
                        montant: lignesCle.reduce((t, m) => t + m.montant, 0),
                        dateEcriture: lignesCle[0].dateEcriture,
                        tranches: datees,
                        liquidations: liquidationsLues.map((liq) => ({
                            ...liq,
                            figee: liq.figee ? { [cleGroupe]: declareParLigne.reduce((t, d) => t + (d.get(liq.id) ?? 0), 0) } : null,
                        })),
                        declareParAncienMoteur: (liq) => declareParLigne.reduce((t, d) => t + (d.get(liq.id) ?? 0), 0),
                    });
                    const capacites = lignesCle.map((m, i) => m.montant - [...declareParLigne[i].values()].reduce((t, v) => t + v, 0));
                    const libresParLigne = TauxTvaService_1.repartirLibresEntreLignes(repartitionGroupe.libres, capacites);
                    lignesCle.forEach((m, i) => traiter(m.l, m.relie, { tranches: fractions, repartition: { parLiquidation: declareParLigne[i], libres: libresParLigne[i] } }, m.prolonge));
                }
            }
        }
        const horsListe = new Set();
        for (const d of designationsLues) {
            if (lignesRattachees.has(d.ligneEcritureId))
                continue;
            const dansPeriode = d.recouvrements.filter((r) => r.date >= dateDebut && r.date <= dateFin).reduce((t, r) => t + r.montant, 0);
            if (dansPeriode <= EPSILON)
                continue;
            if (!sansFacture.has(d.creanceId)) {
                horsListe.add(d.creanceId);
                sansFacture.set(d.creanceId, { creanceId: d.creanceId, compte: d.compte, dateReclassement: d.dateReclassement, recouvre: 0, recouvreSansFacture: 0, motifs: [] });
            }
            const e = sansFacture.get(d.creanceId);
            if (horsListe.has(d.creanceId))
                e.recouvre = TauxTvaService_1.c(e.recouvre + dansPeriode);
            e.recouvreSansFacture = TauxTvaService_1.c(e.recouvreSansFacture + dansPeriode);
            const motif = lignesPartagees.has(d.ligneEcritureId) ? creances_douteuses_1.MOTIF_LETTRAGE_PARTAGE : creances_douteuses_1.MOTIF_SANS_LIGNE_DE_TVA;
            if (!e.motifs.includes(motif))
                e.motifs.push(motif);
            sansFacture.set(d.creanceId, e);
        }
        const recouvrementsSansFactureDesignee = [...sansFacture.values()].filter((c) => c.recouvreSansFacture > EPSILON);
        const filtreARelettrer = {
            aRelettrerDepuis: { not: null },
            lettrageId: null,
            ecriture: { tenantId, statut: client_1.StatutEcriture.VALIDEE, date: { lte: dateFin }, exercice: { statut: client_1.StatutExercice.OUVERT } },
            OR: [
                { compte: { numero: { startsWith: '41' } }, credit: { gt: 0 } },
                { compte: { numero: { startsWith: '40' } }, debit: { gt: 0 } },
                { NOT: [{ compte: { numero: { startsWith: '41' } } }, { compte: { numero: { startsWith: '40' } } }] },
            ],
        };
        const lusARelettrer = (await this.prisma.ligneEcriture.findMany({
            where: filtreARelettrer,
            select: {
                id: true,
                compteId: true,
                aRelettrerDepuis: true,
                lettrageId: true,
                debit: true,
                credit: true,
                compte: { select: { numero: true } },
                ecriture: { select: { date: true, exerciceId: true } },
            },
            orderBy: { id: 'asc' },
            take: PLAFOND_SANS_FACTURE + 1,
        }))
            .filter((l) => l.aRelettrerDepuis && !l.lettrageId && l.ecriture?.date && l.ecriture.date <= dateFin)
            .filter((l) => {
            const sens = Number(l.debit) - Number(l.credit);
            if (l.compte.numero.startsWith('41'))
                return sens < -EPSILON;
            if (l.compte.numero.startsWith('40'))
                return sens > EPSILON;
            return true;
        });
        const paiementsARelettrerTotal = lusARelettrer.length;
        const retenusARelettrer = lusARelettrer.slice(0, PLAFOND_SANS_FACTURE);
        const imputationsNonRattachees = await this.imputerLesPaiementsNonRattaches(tenantId, retenusARelettrer);
        const paiementsARelettrer = retenusARelettrer.map((l) => ({
            compte: l.compte.numero,
            date: l.ecriture.date.toISOString().slice(0, 10),
            montant: TauxTvaService_1.c(Math.abs(Number(l.debit) - Number(l.credit))),
            dansLaPeriode: l.ecriture.date >= dateDebut,
            ...(imputationsNonRattachees.get(l.id) ?? {}),
        }));
        const recouvrementsSansFactureTronque = recouvrementsTronques || creancesRecouvreesTotal > PLAFOND_SANS_FACTURE;
        const lignes = [];
        let enAttente = 0;
        for (const t of taux) {
            const cumul = parTaux.get(t.id);
            enAttente = TauxTvaService_1.c(enAttente + cumul.attente);
            if (cumul.collecte === 0 &&
                cumul.deductible === 0 &&
                cumul.attente === 0 &&
                cumul.avoir === 0 &&
                cumul.recuperation === 0) {
                continue;
            }
            lignes.push({
                tauxId: t.id,
                code: t.code,
                intitule: t.intitule,
                taux: Number(t.taux),
                compteCollecteId: t.compteCollecteId,
                compteDeductibleId: t.compteDeductibleId,
                totalCollecte: cumul.collecte,
                totalDeductible: cumul.deductible,
                enAttente: cumul.attente,
                avoirsCollecteConstates: cumul.avoir,
                recuperationArt52: cumul.recuperation,
                net: TauxTvaService_1.c(cumul.collecte - cumul.deductible - cumul.recuperation),
                parCompte: [...(parTauxCompte.get(t.id) ?? new Map())].map(([compteId, v]) => ({
                    compteId,
                    collecte: v.collecte,
                    deductible: v.deductible,
                    recuperation: v.recuperation,
                })),
            });
        }
        const totalCollecte = TauxTvaService_1.c(lignes.reduce((s, l) => s + l.totalCollecte, 0));
        const totalDeductible = TauxTvaService_1.c(lignes.reduce((s, l) => s + l.totalDeductible, 0));
        const avoirsCollecteConstates = TauxTvaService_1.c(lignes.reduce((s, l) => s + l.avoirsCollecteConstates, 0));
        const recuperationArt52 = TauxTvaService_1.c(lignes.reduce((s, l) => s + l.recuperationArt52, 0));
        const prorata = await this.prorataApplicable(tenantId, dateDebut, dateFin);
        const totalDeductibleAdmise = TauxTvaService_1.c(totalDeductible * (prorata.pourcentage / 100));
        const netAvantImputation = TauxTvaService_1.c(totalCollecte - totalDeductibleAdmise - recuperationArt52);
        const credit = this.creditReportable(derniereLiquidation);
        const creditImpute = TauxTvaService_1.c(Math.min(credit.montant, Math.max(0, netAvantImputation)));
        const net = TauxTvaService_1.c(netAvantImputation - credit.montant);
        return {
            dateDebut,
            dateFin,
            regimeExigibilite: regime,
            mentionExigibilite: this.mentionExigibilite({
                regime,
                referentiel,
                montantIndetermine: TauxTvaService_1.c(montantIndetermine),
                deductionServicesDiffere: TauxTvaService_1.c(deductionServicesDiffere),
                deductionServicesDebits: TauxTvaService_1.c(deductionServicesDebits),
                deductionServicesDebitsSansReference: TauxTvaService_1.c(deductionServicesDebitsSansReference),
                deductionServicesDebitsMentionLue: TauxTvaService_1.c(deductionServicesDebitsMentionLue),
                deductionServicesDiffereMentionLue: TauxTvaService_1.c(deductionServicesDiffereMentionLue),
                collecteServicesDebits: TauxTvaService_1.c(collecteServicesDebits),
                deductionServicesHorsPeriode: TauxTvaService_1.c(deductionServicesHorsPeriode),
                deductionServicesHorsPeriodeMentionLue: TauxTvaService_1.c(deductionServicesHorsPeriodeMentionLue),
                deductionServicesDebitsNonDatee: TauxTvaService_1.c(deductionServicesDebitsNonDatee),
                deductionServicesDebitsFactureSansMention: TauxTvaService_1.c(deductionServicesDebitsFactureSansMention),
                deductionServicesPaiementAnterieur,
                collecteServicesPaiementAnterieur,
                collecteServicesAvantAutorisation: TauxTvaService_1.c(collecteServicesAvantAutorisation),
                autorisationDossierNonDatee: regime === 'DEBITS' && !dateAutorisationDossier,
                fournisseursHorsPeriode: [...fournisseursHorsPeriode],
                fournisseursMentionSansFiche: [...fournisseursMentionSansFiche],
                fournisseursNonDates: [...fournisseursNonDates],
                fournisseursFactureSansMention: [...fournisseursFactureSansMention],
                creditAnterieur: credit.montant,
                creditImpute,
                avoirsCollecteConstates,
                recuperationArt52,
                avoirsCollecteNonImputes,
                avoirsSansNoteDeCredit,
                reprisesAvoirsCorrigesMontant,
                reprisesAvoirsCorrigesTotal,
                negatifsDeFacturesTotal,
                negatifsDeFacturesMontant,
                negatifsDeFacturesRepris: negatifsDeFactures.some((x) => x.pese === 'REPRISE_ICI'),
                negatifsNonPortesTotal,
                negatifsNonPortesMontant,
                rattachementsTardifsTotal,
                rattachementsTardifsMontant,
                rattachementsAncienMoteurTotal,
                rattachementsAncienMoteurMontant,
                rattachementsDansUnTrouTotal,
                rattachementsHorsDelaiTotal,
                rattachementsHorsDelaiMontant,
                taxeAnnuleeParUnePerte,
                attenteAnnuleeParUnePerte,
                negatifsOrphelinsDansUnGroupe: negatifsOrphelins.size,
                tvaExclueArt41,
                tvaAVerifierArt41,
                tvaNatureDepenseIllisible,
                tvaDeductibleDechue,
                recettesNonQualifiees: prorata.recettesNonQualifiees,
                tvaAuBrouillard,
                recouvrementsSansFactureDesignee,
                reconstitutionsIncertaines,
                reconstitutionsIncertainesTotal,
                paiementsARelettrer,
                paiementsARelettrerTotal,
                groupesImputationIndeterminee,
                groupesImputationIndetermineeTotal,
                attenteImputationIndeterminee,
                imputationsDesPaiements,
                imputationsDesPaiementsTotal,
                rapprochementsANouveauAbandonnes,
                rapprochementsANouveauAbandonnesTotal,
                tvaBiensDateeALaFacture: TauxTvaService_1.c(tvaBiensDateeALaFacture),
                tvaLivraisonSoiMeme: TauxTvaService_1.c(tvaLivraisonSoiMeme),
                tvaLocationVente: TauxTvaService_1.c(tvaLocationVente),
                acomptesImputes,
                acomptesImputesTotal,
                tvaAcomptesImputes,
            }),
            tvaAuBrouillard,
            tvaEnAttenteEncaissement: enAttente,
            tvaEnAttenteImputationIndeterminee: attenteImputationIndeterminee,
            groupesImputationIndeterminee,
            groupesImputationIndetermineeTotal,
            imputationsDesPaiements,
            imputationsDesPaiementsTotal,
            rapprochementsANouveauAbandonnes,
            rapprochementsANouveauAbandonnesTotal,
            lignes,
            prorata,
            totalCollecte,
            totalDeductible,
            totalDeductibleAdmise,
            avoirsCollecteConstates,
            recuperationArt52,
            avoirsCollecteNonImputes,
            avoirsSansNoteDeCredit,
            reprisesAvoirsCorriges,
            reprisesAvoirsCorrigesTotal,
            reprisesAvoirsCorrigesTronque: reprisesAvoirsCorrigesTotal > reprisesAvoirsCorriges.length,
            negatifsDeFactures,
            negatifsDeFacturesTotal,
            negatifsDeFacturesTronque: negatifsDeFacturesTotal + negatifsNonPortesTotal > negatifsDeFactures.length,
            rattachementsTardifs,
            rattachementsTardifsTotal,
            rattachementsTardifsTronque: rattachementsTardifsTotal > rattachementsTardifs.length,
            negatifsNonPortesTotal,
            negatifsNonPortesMontant,
            rattachementsAncienMoteurTotal,
            rattachementsAncienMoteurMontant,
            rattachementsDansUnTrouTotal,
            rattachementsHorsDelaiTotal,
            rattachementsHorsDelaiMontant,
            taxeAnnuleeParUnePerte,
            attenteAnnuleeParUnePerte,
            negatifsOrphelinsDansUnGroupe: negatifsOrphelins.size,
            tvaExclueArt41,
            tvaAVerifierArt41,
            tvaNatureDepenseIllisible,
            tvaDeductibleDechue,
            figeEncaissement,
            recouvrementsSansFactureDesignee,
            creancesRecouvreesTotal,
            recouvrementsSansFactureTronque,
            reconstitutionsIncertaines,
            reconstitutionsIncertainesTotal,
            paiementsARelettrer,
            paiementsARelettrerTotal,
            netAvantImputation,
            creditAnterieur: credit.montant,
            creditAnterieurOrigine: credit.origine,
            creditImpute,
            net,
            sens: net >= 0 ? 'A_PAYER' : 'CREDIT',
            liquidation: dejaLiquidee
                ? {
                    faite: true,
                    id: dejaLiquidee.id,
                    dateDebut: dejaLiquidee.dateDebut.toISOString().slice(0, 10),
                    dateFin: dejaLiquidee.dateFin.toISOString().slice(0, 10),
                    ecritureId: dejaLiquidee.ecriture.id,
                    libelleEcriture: dejaLiquidee.ecriture.libelle,
                    memePeriode: dejaLiquidee.dateDebut.getTime() === dateDebut.getTime() &&
                        dejaLiquidee.dateFin.getTime() === dateFin.getTime(),
                }
                : { faite: false },
        };
    }
    mentionExigibilite(e) {
        const { regime, referentiel } = e;
        const fc = (n) => n.toLocaleString('fr-FR');
        const jjmmDe = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
        const nommes = (noms) => noms.length <= 8 ? noms.join(', ') : `${noms.slice(0, 8).join(', ')} et ${noms.length - 8} autre(s)`;
        const brouillard = e.tvaAuBrouillard;
        const sansFacture = e.recouvrementsSansFactureDesignee ?? [];
        const phraseSansFacture = sansFacture.length === 0
            ? []
            : [
                'RECOUVREMENT DE CRÉANCE DOUTEUSE SANS FACTURE DÉSIGNÉE · ' +
                    sansFacture
                        .slice(0, 8)
                        .map((c) => `compte ${c.compte}, créance reclassée le ${c.dateReclassement}, ${fc(c.recouvre)} CDF recouvrés dont ` +
                        `${fc(c.recouvreSansFacture)} CDF sans facture désignée` +
                        (c.motifs && c.motifs.length > 0 ? ` (${c.motifs.join(' ; ')})` : ''))
                        .join(' ; ') +
                    (sansFacture.length > 8 ? ` ; et ${sansFacture.length - 8} autre(s)` : '') +
                    '. Le recouvrement est l’encaissement de la facture reprise (O.-L. n° 10/001, art. 25, 2° ; décret ' +
                    'n° 011/42, art. 57) · si elle porte une prestation de services, TVA à déclarer par le cabinet faute de ' +
                    'facture désignée. Issue · désigner les factures de la créance (Créances douteuses ou litigieuses).',
            ];
        const incertaines = e.reconstitutionsIncertaines ?? [];
        const phraseIncertaines = incertaines.length === 0
            ? []
            : [
                'RECONSTITUTION INCERTAINE · ' +
                    incertaines
                        .slice(0, 8)
                        .map((r) => `reconstitution incertaine pour la facture « ${r.facture} », liquidation du ${r.dateDebut} au ${r.dateFin} ` +
                        `(${fc(r.montantReconstitue)} CDF reconstitués), à vérifier contre la déclaration déposée`)
                        .join(' ; ') +
                    ((e.reconstitutionsIncertainesTotal ?? incertaines.length) > 8
                        ? ` ; et ${(e.reconstitutionsIncertainesTotal ?? incertaines.length) - 8} autre(s)`
                        : '') +
                    '. Un lettrage modifié ou défait après une liquidation antérieure à cette version (journal d’audit) · ce que ' +
                    'l’ancien moteur a lu ne se reconstitue pas avec certitude.',
            ];
        const aRelettrer = e.paiementsARelettrer ?? [];
        const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
        const phraseARelettrer = aRelettrer.length === 0
            ? []
            : [
                'PAIEMENT NON RATTACHÉ À SA FACTURE · ' +
                    aRelettrer
                        .slice(0, 8)
                        .map((p) => {
                        const imputation = (p.imputation ?? [])
                            .map((x) => `« ${x.facture} » du ${jjmm(x.date)} pour ${fc(x.montant)} CDF`)
                            .join(', ');
                        const dit = p.imputationNonDite
                            ? `, imputation non dite (${p.imputationNonDite})`
                            : (imputation ? `, imputé par l’art. 154 sur ${imputation}` : ', aucune facture ouverte à sa date') +
                                ((p.avance ?? 0) > EPSILON ? `, dont ${fc(p.avance)} CDF d’avance` : '');
                        const verbe = p.compte.startsWith('40') ? 'versé' : 'encaissé';
                        return `compte ${p.compte}, paiement ${verbe} le ${jjmm(p.date)} (${fc(p.montant)} CDF)${p.dansLaPeriode ? '' : ', antérieur à la période'}${dit}`;
                    })
                        .join(' ; ') +
                    ((e.paiementsARelettrerTotal ?? aRelettrer.length) > 8 ? ` ; et ${(e.paiementsARelettrerTotal ?? aRelettrer.length) - 8} autre(s)` : '') +
                    '. Délettré par la clôture de l’exercice précédent (sa ligne d’à-nouveau provisoire a disparu sans équivalent) · ' +
                    'un paiement non lettré reste une perception (décret n° 011/42, art. 57) · s’il règle une prestation de services, ' +
                    'la TVA est devenue exigible à cette date (O.-L. n° 10/001, art. 25, 2°), collectée au 41, déductible au 40 (art. 37 ' +
                    'al. 1 ; décret art. 96), sauf si la déclaration de sa facture l’a déjà comptée (taxe lue à la facture). Sans ' +
                    'déclaration du débiteur (le client au 41, le dossier au 40 · Code civil, Livre III, art. 151), il paie les ' +
                    'factures échues ouvertes du compte, la plus ancienne d’abord, au prorata à date égale (art. 154) · l’imputation ' +
                    'est dite ci-dessus ; une avance sans facture rend exigible à sa date la taxe d’un acompte sur prestation ' +
                    '(art. 25, 2°, « acomptes ou avances »). OmegaX ne chiffre pas ici la taxe qui en découle · issue, relettrer ' +
                    'le paiement avec la facture que l’imputation désigne, ou avec celles que le débiteur a désignées en déclarant ' +
                    'ensuite son imputation (Lettrage, pré-lettrage) · la tranche sera alors datée du jour du paiement.',
            ];
        const indetermines = e.groupesImputationIndeterminee ?? [];
        const totalIndetermines = e.groupesImputationIndetermineeTotal ?? indetermines.length;
        const phraseIndetermines = indetermines.length === 0
            ? []
            : [
                'GROUPE DE LETTRAGE LU EN BLOC · ' +
                    indetermines
                        .slice(0, 8)
                        .map((g) => `factures « ${g.factures.join(' », « ')} », ${fc(g.encaisse)} CDF perçus sur la période (${g.motif})`)
                        .join(' ; ') +
                    (totalIndetermines > 8 ? ` ; et ${totalIndetermines - 8} autre(s)` : '') +
                    '. Chaque somme perçue rend exigible la taxe de ce qu’elle paie (O.-L. n° 10/001, art. 25, 2° ; ' +
                    'décret n° 011/42, art. 57) ; ici, le groupe porte une pièce qui n’est pas une dette à payer (un avoir ' +
                    'annule une facture) ou une ligne dont la dette ne se lit pas · OmegaX n’impute pas les sommes perçues et ' +
                    'garde la fraction cumulée du groupe, qui peut retarder la taxe' +
                    ((e.attenteImputationIndeterminee ?? 0) > EPSILON
                        ? ` ; ${fc(e.attenteImputationIndeterminee)} CDF de la TVA restée en attente portent sur ces groupes`
                        : '') +
                    '. Issue · lettrer l’avoir avec sa seule facture, ou chaque facture avec le règlement qui la paie, ou ' +
                    'déclarer la part exigible pièce par pièce.',
            ];
        const imputes = e.imputationsDesPaiements ?? [];
        const totalImputes = e.imputationsDesPaiementsTotal ?? imputes.length;
        const fondement = (f) => f === 'LEGALE'
            ? 'imputation légale, Code civil, Livre III, art. 154'
            : f === 'DECLAREE'
                ? 'imputation déclarée, art. 151 ou 153'
                : 'imputation déclarée en partie (art. 151 ou 153), légale pour le reste (art. 154)';
        const phraseImputes = imputes.length === 0
            ? []
            : [
                'IMPUTATION DES PAIEMENTS · ' +
                    imputes
                        .slice(0, 8)
                        .map((g) => `factures « ${g.factures.join(' », « ')} », ${fc(g.encaisse)} CDF perçus sur la période (${fondement(g.fondement)})`)
                        .join(' ; ') +
                    (totalImputes > 8 ? ` ; et ${totalImputes - 8} autre(s)` : '') +
                    '. Lectures d’OmegaX · « la plus ancienne » se lit à la date de la facture (l’échéance la plus ancienne ' +
                    'est l’autre lecture) ; une avance antérieure à toute facture s’impute sur la première qui naît, à la date ' +
                    'de l’avance ; ni intérêt, ni pénalité, ni sûreté ne sont lus, les dettes étant tenues pour d’égale nature ' +
                    '(« le plus d’intérêt d’acquitter » non lu) ; le prorata se fait sur ce qui reste dû de chaque facture ; une ' +
                    'imputation convenue après le paiement et une compensation (Code civil, Livre III, art. 189) ne sont pas lues.',
            ];
        const nonRetenus = imputes.filter((g) => (g.declareNonRetenu ?? 0) > EPSILON);
        const phraseNonRetenus = nonRetenus.length === 0
            ? []
            : [
                'IMPUTATION DÉCLARÉE NON RETENUE · ' +
                    nonRetenus.map((g) => `factures « ${g.factures.join(' », « ')} », ${fc(g.declareNonRetenu)} CDF`).join(' ; ') +
                    ' · déclarés au-delà de ce que la facture laissait à payer, ou sur une facture sortie du groupe · imputés par ' +
                    'l’art. 154, à vérifier contre la pièce de la déclaration.',
            ];
        const acomptes = e.acomptesImputes ?? [];
        const totalAcomptes = e.acomptesImputesTotal ?? acomptes.length;
        const phrasesDates = [];
        if (acomptes.length > 0) {
            phrasesDates.push(`ACOMPTE IMPUTÉ SANS SA DATE · ${fc(e.tvaAcomptesImputes ?? 0)} CDF de TVA sur des prestations imputées sur ` +
                'une avance non lettrée (419 à la vente, 409 à l’achat) sont datés de la facture · ' +
                acomptes
                    .slice(0, 8)
                    .map((a) => `« ${a.facture} » du ${jjmmDe(a.date)}, ${fc(a.tva)} CDF${a.collecte ? '' : ' déduits'}`)
                    .join(' ; ') +
                (totalAcomptes > 8 ? ` ; et ${totalAcomptes - 8} autre(s)` : '') +
                '. La taxe d’un acompte sur prestation est exigible « au moment de l’encaissement du prix, des acomptes ou ' +
                'avances » (O.-L. n° 10/001, art. 25, 2° ; décret n° 011/42, art. 57), donc au mois où l’avance a été ' +
                'perçue (ou versée, chez le fournisseur, art. 37 al. 1), antérieur à la facture et que l’écriture ne porte ' +
                'pas · déclarée ici, elle l’est au plus tard. Issue · lettrer la ligne d’avance de la facture avec ' +
                'l’encaissement de l’acompte, OmegaX datant alors la taxe du jour de l’acompte, ou la déclarer au mois de ' +
                'l’acompte (la facture d’acompte est due, art. 58).');
        }
        if ((e.tvaBiensDateeALaFacture ?? 0) > EPSILON) {
            phrasesDates.push(`LIVRAISON DATÉE À SA FACTURE · ${fc(e.tvaBiensDateeALaFacture)} CDF de TVA sur des livraisons de biens sont ` +
                'datés à l’écriture de la facture · le fait générateur est la livraison (O.-L. n° 10/001, art. 24, 1°), le ' +
                'transfert du pouvoir de disposer du bien comme propriétaire (art. 6 ; décret n° 011/42, art. 52), et aucune ' +
                'date de livraison n’est saisie. Une livraison antérieure à sa facture rend la taxe exigible au mois de la ' +
                'livraison, et c’est elle qui ouvre le délai de l’art. 37 al. 2 · à reprendre pièce par pièce.');
        }
        if ((e.tvaLivraisonSoiMeme ?? 0) > EPSILON) {
            phrasesDates.push(`LIVRAISON À SOI-MÊME DATÉE À SON ÉCRITURE · ${fc(e.tvaLivraisonSoiMeme)} CDF de TVA sur une production ` +
                'livrée à soi-même sont datés à l’écriture de production immobilisée · le fait générateur est « la première ' +
                'utilisation ou la première mise en service » (O.-L. n° 10/001, art. 24, 8° ; décret n° 011/42, art. 52), ' +
                'et la date d’exécution pour une prestation à soi-même (décret, art. 52) · à vérifier contre la mise en service.');
        }
        if ((e.tvaLocationVente ?? 0) > EPSILON) {
            phrasesDates.push(`LOCATION-VENTE DATÉE À CHAQUE ÉCRITURE · ${fc(e.tvaLocationVente)} CDF de TVA d’amont portés au 6234 sont ` +
                'datés à l’écriture qui les porte · la location-vente est une LIVRAISON de biens (O.-L. n° 10/001, art. 6 ; ' +
                'décret n° 011/42, art. 10), exclue des décomptes successifs (art. 24, 9°) · la taxe entière est exigible ' +
                'chez le fournisseur à la livraison (art. 25, 1° ; décret, art. 52), échéance par échéance seulement dans ' +
                'l’habitat social (art. 25, 7°). Une taxe portée échéance par échéance est déduite plus tard que sa ' +
                'naissance, et le délai de l’art. 37 al. 2 court de la livraison.');
        }
        const abandonnes = e.rapprochementsANouveauAbandonnes ?? [];
        const totalAbandonnes = e.rapprochementsANouveauAbandonnesTotal ?? abandonnes.length;
        const phraseAbandonnes = abandonnes.length === 0
            ? []
            : [
                'RAPPROCHEMENT PAR L’À-NOUVEAU NON FAIT · ' +
                    abandonnes
                        .slice(0, 8)
                        .map((a) => `facture « ${a.facture} » du ${jjmmDe(a.date)}, ${fc(a.tva)} CDF de TVA (${a.motif})`)
                        .join(' ; ') +
                    (totalAbandonnes > 8 ? ` ; et ${totalAbandonnes - 8} autre(s)` : '') +
                    '. Un règlement lettré avec une ligne d’à-nouveau est l’encaissement de la facture qu’elle reporte ' +
                    '(O.-L. n° 10/001, art. 25, 2° ; décret n° 011/42, art. 57), mais plusieurs reports peuvent être celui ' +
                    'de cette facture · OmegaX n’en choisit aucun, et sa taxe reste en attente. Issue · déclarer la part ' +
                    'exigible pièce par pièce, ou distinguer les reports (libellé, échéance).',
            ];
        const phrases = [
            ...phraseAbandonnes,
            ...phraseIndetermines,
            ...phraseImputes,
            ...phraseNonRetenus,
            ...phrasesDates,
            ...phraseARelettrer,
            ...phraseIncertaines,
            ...phraseSansFacture,
            ...(brouillard && brouillard.ecritures > 0
                ? [
                    `TVA RESTÉE AU BROUILLARD, HORS DE CETTE DÉCLARATION · ${brouillard.ecritures} écriture(s) datée(s) de la ` +
                        `période portent ${fc(brouillard.collecte)} CDF de TVA facturée et ${fc(brouillard.deductible)} CDF de ` +
                        'TVA récupérable. Une écriture au brouillard n’est pas entrée au livre-journal (AUDCIF art. 22, 2°) · ' +
                        'validez-la avant de déclarer, ou la taxe de la période sera fausse de ce montant.',
                ]
                : []),
            "Exigibilité datée OPÉRATION PAR OPÉRATION (article 25 de l'ordonnance-loi n° 10/001) : les LIVRAISONS DE " +
                'BIENS au fait générateur, la livraison (art. 24, 1° et 25, 1°), les PRESTATIONS DE SERVICES et TRAVAUX ' +
                'IMMOBILIERS, dont la taxe naît à l’exécution (art. 24, 2°), à ' +
                "l'encaissement du prix, des acomptes ou avances (art. 25, 2°). La nature est lue à la CONTREPARTIE de " +
                'l’écriture, que les art. 6 et 8 qualifient (701 à 704 ventes de biens, 705/706 travaux et services, 7072 ' +
                'commissions, 7073 locations, 7076 redevances ; 60 achats, 6051/6052/6053 eau, électricité et énergies, ' +
                '6057 études, 61 à 63 transports et services extérieurs), et non au numéro du compte de TVA, qui suit la ' +
                'nomenclature comptable et non la loi fiscale. La date de l’encaissement est celle ' +
                'de l’ÉCRITURE DE RÈGLEMENT du groupe de lettrage, jamais celle du lettrage lui-même, chaque règlement pour ' +
                'sa part · le décret n° 011/42, art. 57, place l’encaissement à la remise des espèces, à la REMISE du ' +
                'chèque, à l’inscription au CRÉDIT DU COMPTE DU FOURNISSEUR pour un virement ou un ordre de paiement, et au ' +
                'paiement effectif du débiteur en cas d’affacturage · un règlement écrit à la date du relevé (chèque) ou, ' +
                'côté déduction, à la date du débit de l’acheteur (virement) peut décaler la taxe d’une période, réserve à ' +
                'vérifier pièce par pièce en fin de mois ; une créance ou une dette NON LETTRÉE n’est pas un encaissement, ' +
                'sa taxe reste en attente jusqu’au lettrage de son règlement, seul ce qui est réglé dans l’écriture même ' +
                '(trésorerie, avance imputée) l’étant à sa date. Une période liquidée garde ce qu’elle a déclaré · un ' +
                'règlement lettré après sa liquidation est repris au premier jour non liquidé. DEUX RÉSERVES DU MÊME DÉCRET NE SONT PAS APPLIQUÉES ICI, et elles jouent en sens contraire : ' +
                'une fourniture sous CONTRAT D’ABONNEMENT à décomptes proportionnels à la consommation est exigible à ' +
                'l’expiration de la période, et non à l’encaissement (art. 55) ; un paiement par EFFET DE COMMERCE est ' +
                'encaissé « à la date de l’échéance de la traite, même si elle a été remise à l’escompte » (art. 57, ' +
                'alinéa 2), quand OmegaX retient la date de l’écriture qui solde le tiers, c’est-à-dire l’acceptation. ' +
                'À reprendre pièce par pièce si le dossier connaît l’un ou l’autre. Ne sont pas lues non plus la vente sous ' +
                'CONDITION SUSPENSIVE, dont le fait générateur et l’exigibilité interviennent « au moment de la réalisation de ' +
                'cette condition » (décret n° 011/42, art. 53), ni la vente sous CONDITION RÉSOLUTOIRE, « dès la conclusion du ' +
                'contrat » (art. 54) · OmegaX date à l’écriture.',
        ];
        if (regime === 'DEBITS') {
            phrases.push("Ce dossier est autorisé à acquitter la taxe d'après les DÉBITS (art. 26, sur décision du Directeur " +
                "Général des Impôts) : sa TVA sur services et travaux est exigible à l'inscription au débit du compte " +
                'du client, donc à la date de la facture. Cette autorisation ne change rien aux ventes de biens, déjà ' +
                'exigibles au fait générateur, la livraison (datée à la facture, voir plus haut), ni à la TVA ' +
                'déductible, qui se juge chez le fournisseur.');
            if (e.autorisationDossierNonDatee) {
                phrases.push("AUTORISATION DU DOSSIER NON DATÉE · le régime des débits est appliqué à toute la période, faute de la " +
                    "date de la décision du Directeur Général des Impôts (décret n° 011/42, art. 58 et 59) · saisissez-la " +
                    'dans les paramètres du dossier.');
            }
            if (e.collecteServicesAvantAutorisation > EPSILON) {
                phrases.push(`AVANT L'AUTORISATION · ${fc(e.collecteServicesAvantAutorisation)} CDF de TVA collectée sur services et ` +
                    "travaux portent sur des opérations antérieures à l'autorisation du dossier · elles restent au droit " +
                    "commun, exigibles à l'encaissement (O.-L. n° 10/001, art. 25, 2°, et art. 26).");
            }
        }
        if (e.collecteServicesDebits > EPSILON) {
            phrases.push(`ENCAISSEMENT ANTÉRIEUR AU DÉBIT, NON VÉRIFIÉ · ${fc(e.collecteServicesDebits)} CDF de TVA collectée sur ` +
                'services et travaux sont datés de la FACTURE, au titre de l’autorisation de l’article 26. Son ' +
                'alinéa 3 y met une réserve impérative : « Elle ne dispense pas le redevable de s’acquitter de la taxe ' +
                'sur la valeur ajoutée au moment de l’encaissement du prix ou de l’acompte si celui-ci intervient avant ' +
                'les débits. » L’exigibilité est alors le PREMIER des deux événements. OmegaX NE PEUT PAS l’établir : ' +
                'une avance sur marché, un acompte à la commande ou un dépôt de garantie imputable s’enregistrent en ' +
                'avance reçue (compte 419), sans ligne de taxe et sans rattachement à la facture qui suivra · rien dans ' +
                'l’écriture ne les relie. Ce montant est donc daté AU PLUS TARD, jamais au plus tôt, et l’écart se ' +
                'redresse contre le dossier · à reprendre acompte par acompte avant dépôt.' +
                (e.collecteServicesPaiementAnterieur > EPSILON
                    ? ` Dont ${fc(e.collecteServicesPaiementAnterieur)} CDF déclarés sur cette période à la date d’un ` +
                        'RÈGLEMENT LETTRÉ à la facture et antérieur à elle, et non à la date de la facture (décret n° 011/42, ' +
                        'art. 62) · ce règlement-là, OmegaX le voit.'
                    : ''));
        }
        else if (e.collecteServicesPaiementAnterieur > EPSILON) {
            phrases.push(`ENCAISSEMENT ANTÉRIEUR AU DÉBIT · ${fc(e.collecteServicesPaiementAnterieur)} CDF de TVA collectée sur ` +
                'services et travaux sont déclarés sur cette période à la date d’un RÈGLEMENT LETTRÉ à une facture qui ' +
                'lui est postérieure : l’autorisation « ne dispense pas le redevable de s’acquitter de la taxe au moment ' +
                'de l’encaissement du prix ou de l’acompte si celui-ci est antérieur au débit » (décret n° 011/42, ' +
                'art. 62 ; O.-L. n° 10/001, art. 26 al. 3).');
        }
        if (e.montantIndetermine > EPSILON) {
            phrases.push(`REPLI DÉCLARÉ sur ${fc(e.montantIndetermine)} CDF de la période : ` +
                (referentiel === client_1.Referentiel.SYSCOHADA
                    ? 'ces lignes sont portées sur des comptes de TVA dont le numéro ne dit pas la nature de ' +
                        "l'opération (4435 factures à établir, 4451 immobilisations, 4455 factures non parvenues…). "
                    : 'le plan SYCEBNL ne subdivise ni le 443 ni le 445, aucune nature n’y est lisible. ') +
                `Elles sont datées selon le paramètre du dossier (${regime}), qui est un REPLI et non la règle · ` +
                'à vérifier opération par opération avant dépôt.');
        }
        if (e.deductionServicesDiffere > EPSILON) {
            const mentionLue = e.deductionServicesDiffereMentionLue;
            phrases.push(`DÉDUCTION SUR SERVICES · ${fc(e.deductionServicesDiffere)} CDF de TVA d'amont facturée ` +
                "sur la période sont déduits au PAIEMENT du fournisseur : l'article 37 al. 1 fait naître le droit à " +
                "déduction « lorsque la taxe devient exigible chez l'assujetti », et le décret n° 011/42, art. 96, " +
                'précise qu’il s’agit du FOURNISSEUR. AUCUNE AUTORISATION D’ACQUITTER D’APRÈS LES DÉBITS N’EST ' +
                'RENSEIGNÉE sur la fiche des tiers de ces factures · ce qui ne veut PAS dire qu’il n’y en a pas. La ' +
                'mention « Autorisation d’acquitter la TVA d’après les débits » se lit sur la facture (décret art. 60), ' +
                'et la date de la déduction suit la fiche du fournisseur, qui porte l’autorisation et la référence de ' +
                'la décision (art. 26) : tant que la fiche ne la porte pas, OmegaX ne PEUT pas avancer la déduction, ' +
                'et s’en tient au droit commun. Chez un fournisseur autorisé (art. 26), la taxe est exigible dès la ' +
                'facture et la déduction naît plus tôt · à vérifier facture par facture avant dépôt.' +
                (mentionLue > EPSILON
                    ? ` Dont ${fc(mentionLue)} CDF sur une facture d’achat enregistrée qui PORTE la mention : portez ` +
                        'l’autorisation et sa référence sur la fiche du fournisseur, la déduction naîtra alors à la ' +
                        'facture (décret art. 61 et 96).' +
                        (e.fournisseursMentionSansFiche.length > 0
                            ? ` Fiche(s) à reprendre, le droit commun étant gardé d’ici là : ${nommes(e.fournisseursMentionSansFiche)}.`
                            : '')
                    : ''));
        }
        if (e.deductionServicesDebits > EPSILON) {
            const nonLue = TauxTvaService_1.c(e.deductionServicesDebits - e.deductionServicesDebitsMentionLue);
            phrases.push(`FOURNISSEURS AUTORISÉS AUX DÉBITS · ${fc(e.deductionServicesDebits)} CDF de TVA d’amont sur services et ` +
                'travaux sont déduits DÈS LA FACTURE, et non au paiement : ces fournisseurs sont renseignés comme ' +
                'autorisés à acquitter la TVA d’après les débits (art. 26, sur décision du Directeur Général des ' +
                'Impôts), leur taxe est donc exigible « par l’inscription de la somme au débit du compte du client » ' +
                '(décret n° 011/42, art. 61) et le droit à déduction du client naît à cette date (article 37 al. 1, ' +
                'décret art. 96). L’autorisation est appliquée TELLE QU’ELLE A ÉTÉ SAISIE sur la fiche du tiers · elle ' +
                'se prouve par la mention portée sur la facture (décret art. 60), qu’OmegaX lit sur la facture d’achat ' +
                'enregistrée et rattachée à l’écriture. ' +
                (nonLue > EPSILON
                    ? `${fc(nonLue)} CDF ne reposent sur aucune facture d’achat enregistrée où la mention soit cochée · ` +
                        'elle est à vérifier sur la pièce du fournisseur avant dépôt.'
                    : 'Chacune de ces écritures est rattachée à une facture d’achat enregistrée qui la porte.'));
        }
        if (e.deductionServicesDebitsSansReference > EPSILON) {
            phrases.push(`AUTORISATION AUX DÉBITS SANS RÉFÉRENCE · ${fc(e.deductionServicesDebitsSansReference)} CDF de cette ` +
                'déduction anticipée reposent sur un tiers coché « autorisé aux débits » dont la RÉFÉRENCE de la ' +
                'décision n’est pas saisie. L’autorisation est délivrée « sur décision du Directeur Général des Impôts ' +
                'ou son délégué en province » (art. 26), sur demande adressée par simple lettre (décret art. 58) : sans ' +
                'cette référence, l’anticipation ne s’appuie sur aucune pièce nommée · à documenter avant dépôt.');
        }
        if (e.deductionServicesDebitsFactureSansMention > EPSILON) {
            phrases.push(`FACTURE ENREGISTRÉE SANS LA MENTION DES DÉBITS · ${fc(e.deductionServicesDebitsFactureSansMention)} CDF de ` +
                'cette déduction anticipée reposent sur une facture d’achat enregistrée où la mention « Autorisation ' +
                'd’acquitter la TVA d’après les débits » n’est PAS cochée, alors qu’elle « doit figurer sur toutes les ' +
                'factures délivrées par le prestataire de services ou l’entrepreneur de travaux » autorisé (décret ' +
                'n° 011/42, art. 60). L’anticipation est gardée, la fiche du fournisseur datant la déduction ; la preuve ' +
                `manque sur la pièce · à vérifier sur l’original, ou à faire rectifier par : ${nommes(e.fournisseursFactureSansMention)}.`);
        }
        if (e.deductionServicesDebitsNonDatee > EPSILON) {
            phrases.push(`AUTORISATION AUX DÉBITS NON DATÉE · ${fc(e.deductionServicesDebitsNonDatee)} CDF de cette déduction ` +
                'anticipée reposent sur une fiche autorisée SANS date d’effet. L’anticipation est gardée, mais rien ne ' +
                'dit que la décision (ou le silence de dix jours qui « vaut autorisation », décret n° 011/42, art. 59) ' +
                'précède ces factures · une déduction avancée avant l’exigibilité chez le fournisseur (art. 37 al. 1, ' +
                `décret art. 96) se redresse. Date d’effet à porter sur la fiche de : ${nommes(e.fournisseursNonDates)}.`);
        }
        if (e.deductionServicesHorsPeriode > EPSILON) {
            phrases.push(`HORS DE LA PÉRIODE D’AUTORISATION · ${fc(e.deductionServicesHorsPeriode)} CDF de TVA d’amont sur services ` +
                'et travaux sont déduits au PAIEMENT, selon le droit commun : la fiche du fournisseur le dit autorisé aux ' +
                'débits, mais la facture précède la date d’effet de la décision (décret n° 011/42, art. 59) ou suit le ' +
                'retour au droit commun (O.-L. n° 10/001, art. 26 al. 2 ; décret art. 63).' +
                (e.deductionServicesHorsPeriodeMentionLue > EPSILON
                    ? ` Dont ${fc(e.deductionServicesHorsPeriodeMentionLue)} CDF sur une facture d’achat enregistrée qui ` +
                        'PORTE pourtant la mention de l’art. 60 · la période saisie sur la fiche est à confronter à la pièce.'
                    : '') +
                ` Fournisseur(s) : ${nommes(e.fournisseursHorsPeriode)}.`);
        }
        if (e.deductionServicesPaiementAnterieur > EPSILON) {
            phrases.push(`RÈGLEMENT ANTÉRIEUR AU DÉBIT · ${fc(e.deductionServicesPaiementAnterieur)} CDF de TVA d’amont due à des ` +
                'fournisseurs autorisés aux débits sont déduits à la date d’un RÈGLEMENT LETTRÉ à leur facture et ' +
                'antérieur à elle, et non à la date de la facture : l’autorisation « ne dispense pas le redevable de ' +
                's’acquitter de la taxe au moment de l’encaissement du prix ou de l’acompte si celui-ci est antérieur au ' +
                'débit » (décret n° 011/42, art. 62), et le droit à déduction naît à cette exigibilité chez le ' +
                'fournisseur (O.-L. n° 10/001, art. 37 al. 1 ; décret art. 96).');
        }
        if (e.tvaExclueArt41 > EPSILON) {
            phrases.push(`EXCLUSIONS DE L’ARTICLE 41 · ${fc(e.tvaExclueArt41)} CDF de TVA d’amont sont ÉCARTÉS de la déduction : ` +
                'l’article 41, 1° dispose que « n’ouvre pas droit à déduction, la taxe ayant grevé […] les dépenses de ' +
                'logement, d’hébergement, de restauration, de réception, de spectacles, de location de véhicules de ' +
                'tourisme et de transport de personnes ». Sont reconnues les charges portées aux comptes ' +
                `${EXCLUSIONS_ART_41.map(([, libelle]) => libelle).join(', ')}. Le même point réserve les ` +
                'dépenses supportées, AU TITRE DE LEUR ACTIVITÉ IMPOSABLE, par les professionnels du tourisme, de la ' +
                'restauration et du spectacle : OmegaX ne connaît pas le secteur d’activité du dossier et n’applique ' +
                'donc pas cette exception · si elle vous concerne, réintégrez ce montant.');
        }
        if (e.tvaAVerifierArt41 > EPSILON) {
            phrases.push(`À VÉRIFIER, ARTICLES 41 ET 42 · ${fc(e.tvaAVerifierArt41)} CDF de TVA d’amont portent sur des charges ` +
                `que la loi vise SOUS CONDITION (${EXCLUSIONS_ART_41_A_VERIFIER.map(([, l]) => l).join(' ; ')}). ` +
                'La condition ne se lit ni au compte ni au montant GLOBAL d’une ligne d’écriture, qui est tout ce que ' +
                'cette déclaration lit. Pour les CADEAUX, le décret n° 011/42, art. 107, chiffre pourtant le seuil : est ' +
                'de faible valeur « le bien dont la valeur unitaire est inférieure à 10.000,00 Francs congolais », le ' +
                'Ministre des Finances étant habilité à réajuster ce montant. La valeur unitaire EST saisie sur la ' +
                'facture (prix unitaire et quantité) · elle ne l’est pas sur l’écriture, et c’est la facture qu’il faut ' +
                'reprendre. Pour les TRANSPORTS, la condition tient à l’existence d’un contrat permanent, donnée ' +
                'juridique qu’aucune écriture ne porte. Ces montants restent DÉDUITS · à trancher pièce par pièce avant ' +
                'dépôt.');
        }
        if (e.tvaNatureDepenseIllisible > EPSILON) {
            phrases.push(`NATURE DE LA DÉPENSE NON LISIBLE · ${fc(e.tvaNatureDepenseIllisible)} CDF de TVA d’amont sont portés par ` +
                'des écritures sans contrepartie de charge de classe 6 (immobilisations, ou plan qui agrège ses charges ' +
                'externes). L’article 42, 1° exclut la taxe « sur les véhicules ou engins, quelle que soit leur nature, ' +
                'conçus ou aménagés pour le transport des personnes, constituant des immobilisations ainsi que […] leur ' +
                'location, leurs pièces détachées et accessoires », et l’article 41, 3° les produits pétroliers : ni ' +
                'l’un ni l’autre ne se lit sur un numéro de compte (un 245 porte aussi bien un camion qu’un 4x4 de ' +
                'direction). Ces montants restent DÉDUITS · à vérifier sur pièce.');
        }
        if (e.avoirsCollecteConstates > EPSILON) {
            phrases.push(`AVOIRS SUR VENTES CONSTATÉS · ${fc(e.avoirsCollecteConstates)} CDF de TVA ont été portés au DÉBIT d’un ` +
                'compte 443 sur la période. L’article 52 permet d’en récupérer le montant « par voie d’imputation sur ' +
                'l’impôt dû pour les opérations faites ultérieurement », et le décret n° 011/42, art. 126, le situe : ' +
                '« elle est inscrite dans les déductions afférentes à la déclaration du ou des mois SUIVANTS celui de ' +
                'la constatation ». Ce montant ne minore donc PAS la collecte de cette déclaration · il sera inscrit en ' +
                'déduction de la suivante, une fois celle-ci liquidée. La récupération suppose que la note de crédit ou ' +
                'la facture nouvelle ait été ÉTABLIE ET ENVOYÉE au client, et la facture initiale barrée et conservée ' +
                '(décret art. 127). OmegaX voit la note quand elle est émise par sa facturation et rattachée à ' +
                'l’écriture ; il ne voit pas une note émise ailleurs, ni son ENVOI au client.');
        }
        if (e.avoirsSansNoteDeCredit > EPSILON) {
            phrases.push(`AVOIRS SANS NOTE DE CRÉDIT · ${fc(e.avoirsSansNoteDeCredit)} CDF de TVA sur avoirs, constatés ou imputés ` +
                'sur cette déclaration, ne sont justifiés par aucune note de crédit rattachée à leur écriture. « Pour les ' +
                'opérations annulées ou résiliées, la récupération de la taxe acquittée est subordonnée à l’établissement ' +
                'et à l’envoi au client d’une facture nouvelle ou note de crédit annulant et remplaçant la facture ' +
                'initiale » (article 52, alinéa 2). Ces montants restent comptés · si la note a été émise hors d’OmegaX, ' +
                'la tenir à disposition ; sinon, l’émettre depuis la fenêtre Facturation avant de récupérer la taxe.');
        }
        if (e.reprisesAvoirsCorrigesTotal > 0) {
            phrases.push(`REPRISE D’AVOIRS CORRIGÉS · ${e.reprisesAvoirsCorrigesTotal} inscription(s) en négatif d’avoirs sur ventes ` +
                `reprennent ${fc(e.reprisesAvoirsCorrigesMontant)} CDF de taxe sur cette déclaration (détail ligne à ligne, ` +
                '`reprisesAvoirsCorriges`) · l’avoir corrigé cesse d’être récupéré (article 52 ; AUDCIF art. 20, al. 2). ' +
                'Une période déjà liquidée garde ce qu’elle a déclaré ; la reprise pèse sur la période où le négatif est inscrit ' +
                'ou sur celle qui la suit.');
        }
        if ((e.negatifsDeFacturesTotal ?? 0) > 0) {
            phrases.push(`FACTURES ANNULÉES PAR INSCRIPTION EN NÉGATIF · ${e.negatifsDeFacturesTotal} négatif(s) de vente ou d’achat portent ` +
                `${fc(e.negatifsDeFacturesMontant ?? 0)} CDF de taxe sur cette déclaration (détail ligne à ligne, \`negatifsDeFactures\`) · ` +
                'lus au signe près, à la date de la facture corrigée (O.-L. n° 10/001, art. 25 ; AUDCIF art. 20, al. 2). ' +
                (e.negatifsDeFacturesRepris
                    ? 'La taxe d’une vente dont la période était déjà liquidée est récupérée ici, en déduction (article 52, al. 1 ; ' +
                        'décret n° 011/42, art. 126) · si la facture initiale a été remise au client, la récupération exige la ' +
                        'facture nouvelle ou la note de crédit (article 52, al. 2), qu’OmegaX ne voit pas sur une inscription en négatif.'
                    : 'Une période déjà liquidée garde ce qu’elle a déclaré ; la reprise pèse sur le premier jour non liquidé.'));
        }
        if ((e.rattachementsTardifsTotal ?? 0) > 0) {
            phrases.push(`LIGNES VALIDÉES APRÈS LA LIQUIDATION DE LEUR PÉRIODE · ${e.rattachementsTardifsTotal} ligne(s) de TVA, ` +
                `${fc(e.rattachementsTardifsMontant ?? 0)} CDF au total, sont rattachées à cette déclaration, premier jour non ` +
                'liquidé, avec leur date d’origine (détail, `rattachementsTardifs`) · aucune déclaration déjà liquidée ne les ' +
                'avait lues (AUDCIF art. 22, 4° ; O.-L. n° 10/001, art. 25 et 37, al. 2 ; décret n° 011/42, art. 126). ' +
                'La taxe d’une période déjà déclarée, portée en retard, peut appeler les pénalités de la loi n° 004/2003 · ' +
                'à apprécier par le cabinet.');
        }
        if ((e.rattachementsAncienMoteurTotal ?? 0) > 0) {
            phrases.push(`LIQUIDATIONS D’AVANT LA RÈGLE DES LIGNES TARDIVES · ${e.rattachementsAncienMoteurTotal} de ces ligne(s), ` +
                `${fc(e.rattachementsAncienMoteurMontant ?? 0)} CDF, ont été lues par une liquidation passée avant que les lignes ` +
                'validées tard et les inscriptions en négatif ne soient reprises (`ancienMoteur` au détail) · celle-ci ne les a pas ' +
                'déclarées, et elles sont portées ici · à vérifier contre la déclaration déposée, si le cabinet les y a portées à la main.');
        }
        if ((e.rattachementsDansUnTrouTotal ?? 0) > 0) {
            phrases.push(`PÉRIODE JAMAIS LIQUIDÉE ENTRE DEUX LIQUIDATIONS · ${e.rattachementsDansUnTrouTotal} ligne(s) validée(s) tard sont ` +
                'rattachées à une période qu’aucune liquidation ne couvre alors qu’une période plus récente est liquidée ' +
                '(`dansUnTrou` au détail) · liquidez cette période, ou vérifiez qu’elle a été déclarée hors d’OmegaX.');
        }
        if ((e.rattachementsHorsDelaiTotal ?? 0) > 0) {
            phrases.push(`RÉCUPÉRATIONS PORTÉES HORS DU DÉLAI · ${e.rattachementsHorsDelaiTotal} récupération(s) d’avoirs sur ventes ou de ` +
                `ventes annulées, ${fc(e.rattachementsHorsDelaiMontant ?? 0)} CDF, sont portées après le 31 décembre de l’année qui ` +
                'suit leur constatation (`horsDelaiArt37` au détail) · décret n° 011/42, art. 126, qui renvoie à l’O.-L. n° 10/001, ' +
                'art. 37, al. 2. OmegaX les porte et le dit · leur admission est à apprécier par le cabinet.');
        }
        if ((e.negatifsNonPortesTotal ?? 0) > 0) {
            phrases.push(`NÉGATIFS DE FACTURES NOMMÉS SANS PESER ICI · ${e.negatifsNonPortesTotal} inscription(s) en négatif, ` +
                `${fc(e.negatifsNonPortesMontant ?? 0)} CDF de taxe, ne pèsent pas sur cette déclaration (détail \`negatifsDeFactures\`) · ` +
                'PESE_SUR_UNE_PERIODE_NON_LIQUIDEE, la facture appartient à une période qu’aucune liquidation d’OmegaX ne couvre, où ' +
                'le négatif est porté (si cette période a été déclarée hors d’OmegaX, la reprise est au cabinet) ; ' +
                'ACHAT_A_L_ENCAISSEMENT_NON_REPRIS, la déduction d’un achat de services se prend au règlement du fournisseur ' +
                '(art. 25, 2°), OmegaX ne la reprend pas · si elle a été déduite, la reprise est au cabinet ; ' +
                'DEDUCTION_DECHUE_RIEN_A_REPRENDRE, la déduction d’origine était déchue (art. 37, al. 2), rien n’est repris.');
        }
        if ((e.negatifsOrphelinsDansUnGroupe ?? 0) > 0) {
            phrases.push(`NÉGATIF SANS SA LIGNE DANS UN GROUPE DE LETTRAGE · ${e.negatifsOrphelinsDansUnGroupe} facture(s) à l’encaissement ` +
                'sont lettrées dans un groupe qui porte une inscription en négatif sans la ligne qu’elle annule · elle ne règle ' +
                'rien (décret n° 011/42, art. 57), seuls les règlements réels du groupe datent la taxe. Lettrez le négatif avec la ' +
                'ligne qu’il annule.');
        }
        if ((e.attenteAnnuleeParUnePerte ?? 0) > EPSILON) {
            phrases.push(`TAXE ANNULÉE PAR UNE PERTE, HORS DE L’ATTENTE · ${fc(e.attenteAnnuleeParUnePerte ?? 0)} CDF de taxe à l’encaissement de ` +
                'factures de la période ont été annulés par la perte qui récupère la TVA (O.-L. n° 10/001, art. 25, 2° et art. 52) · ' +
                'ils ne sont plus comptés en attente, aucun encaissement ne les rendra exigibles.');
        }
        if ((e.taxeAnnuleeParUnePerte ?? 0) > EPSILON) {
            phrases.push(`TAXE ANNULÉE PAR UNE PERTE · ${fc(e.taxeAnnuleeParUnePerte ?? 0)} CDF de taxe à l’encaissement de factures dont la ` +
                'perte qui récupère la TVA a annulé la taxe ne sont pas rendus exigibles par un lettrage postérieur à la perte · ' +
                'aucun prix n’a été perçu (décret n° 011/42, art. 57 ; O.-L. n° 10/001, art. 25, 2°). Délettrez le groupe, qui ne ' +
                'règle rien.');
        }
        if (e.recuperationArt52 < -EPSILON) {
            phrases.push(`RÉCUPÉRATION NÉGATIVE · ${fc(-e.recuperationArt52)} CDF d’avoirs corrigés après leur constatation sont REPRIS ici ` +
                '(article 52, décret art. 126) · la liquidation les porte au débit du compte de TVA facturée.');
        }
        if (e.recuperationArt52 > EPSILON) {
            phrases.push(`RÉCUPÉRATION SUR VENTES ANNULÉES · ${fc(e.recuperationArt52)} CDF d’avoirs constatés avant cette période ` +
                'sont inscrits ici en DÉDUCTION (article 52, décret art. 126). Le prorata de l’article 43 ne leur est ' +
                'pas appliqué : il limite la déduction de la taxe ayant grevé les achats, alors que celle-ci est la ' +
                'taxe du redevable lui-même, qui lui revient.');
        }
        if (e.avoirsCollecteNonImputes > EPSILON) {
            phrases.push(`AVOIRS ANTÉRIEURS NON IMPUTÉS · ${fc(e.avoirsCollecteNonImputes)} CDF de TVA sur avoirs ont été constatés ` +
                'avant cette période, mais aucune liquidation comptabilisée ne permet de savoir dans quelle déclaration ' +
                'ils ont déjà pu être imputés. OmegaX ne les impute donc pas d’office · ils restent récupérables par ' +
                'imputation (article 52), à porter à la main après vérification des déclarations déjà déposées.');
        }
        if (e.tvaDeductibleDechue > EPSILON) {
            phrases.push(`DÉLAI DE DÉDUCTION EXPIRÉ · ${fc(e.tvaDeductibleDechue)} CDF de TVA d’amont sont devenus exigibles avant ` +
                'le 1er janvier de l’année précédant cette déclaration. « Le droit à déduction est exercé jusqu’au ' +
                '31 décembre de l’année qui suit celle au cours de laquelle la taxe est devenue exigible. A ' +
                'l’expiration de ce délai, la taxe sur la valeur ajoutée non déduite est acquise définitivement au ' +
                'Trésor public » (article 37, alinéa 2). Ces montants n’entrent dans aucune déclaration d’ici · ' +
                's’ils n’ont pas été déduits en leur temps, ils sont perdus.');
        }
        if (e.recettesNonQualifiees > EPSILON) {
            phrases.push(`PRORATA · ${fc(e.recettesNonQualifiees)} CDF de recettes de classe 7 ne portent AUCUNE ligne de TVA : ` +
                'elles pèsent au dénominateur et n’entrent pas au numérateur. L’article 43 met pourtant au numérateur ' +
                '« les recettes afférentes aux opérations ouvrant droit à déduction […] Y COMPRIS LES EXPORTATIONS et ' +
                'opérations assimilées » : une vente à l’export, taxée à 0 %, n’est reconnue que si sa ligne de TVA au ' +
                'taux zéro existe. Si ces recettes en comprennent, le prorata est SOUS-ÉVALUÉ et la déduction avec lui.');
        }
        if (e.creditAnterieur > EPSILON) {
            phrases.push(`CRÉDIT DE TVA REPORTÉ · ${fc(e.creditAnterieur)} CDF issus de la dernière liquidation ` +
                `sont imputés sur la taxe de cette période à hauteur de ${fc(e.creditImpute)} CDF ` +
                "(article 63 : l'excédent « constitue un crédit d'impôt imputable sur la taxe exigible du ou des mois " +
                'suivants jusqu’à l’épuisement »). Le solde éventuel reste reportable · l’article 63 ferme le ' +
                'remboursement, hors les cas de l’article 64.');
        }
        return phrases.join(' ');
    }
    async comptabiliserLiquidation(tenantId, userId, dto) {
        const dateDebut = new Date(dto.dateDebut);
        const dateFin = new Date(dto.dateFin);
        const chevauchante = await this.liquidationChevauchante(tenantId, dateDebut, dateFin);
        if (chevauchante) {
            const jour = (d) => d.toLocaleDateString('fr-FR');
            throw new common_1.BadRequestException(`Une liquidation couvre déjà tout ou partie de cette période (du ${jour(chevauchante.dateDebut)} au ` +
                `${jour(chevauchante.dateFin)}, écriture « ${chevauchante.ecriture.libelle} »). La comptabiliser une ` +
                'seconde fois porterait le double de la dette sur le compte 444. Supprimez la liquidation existante ' +
                'si elle est erronée, ou choisissez une période non encore liquidée.');
        }
        const instantLecture = new Date();
        const decl = await this.declaration(tenantId, dateDebut, dateFin, { instantLecture });
        if (decl.tvaAuBrouillard.ecritures > 0) {
            const b = decl.tvaAuBrouillard;
            throw new common_1.BadRequestException(`${b.ecritures} écriture(s) de la période portent encore de la TVA au brouillard ` +
                `(${b.collecte.toLocaleString('fr-FR')} CDF facturée, ${b.deductible.toLocaleString('fr-FR')} CDF ` +
                'récupérable). Validez-les ou supprimez-les avant de liquider · une fois la période liquidée, une ' +
                'ligne validée ensuite ne serait reprise par aucune déclaration (AUDCIF art. 22, 2°).');
        }
        const recuperationArt52 = decl.recuperationArt52;
        if (Math.abs(decl.totalCollecte) <= EPSILON &&
            Math.abs(decl.totalDeductibleAdmise) <= EPSILON &&
            Math.abs(recuperationArt52) <= EPSILON) {
            throw new common_1.BadRequestException('Aucun mouvement de TVA sur cette période · rien à comptabiliser.');
        }
        const ratio = decl.prorata.pourcentage / 100;
        const parCompteCollecte = new Map();
        const parCompteDeductible = new Map();
        const parCompteRecuperation = new Map();
        const deductiblesBruts = new Map();
        for (const l of decl.lignes) {
            for (const pc of l.parCompte) {
                if (Math.abs(pc.collecte) > EPSILON)
                    parCompteCollecte.set(pc.compteId, TauxTvaService_1.c((parCompteCollecte.get(pc.compteId) ?? 0) + pc.collecte));
                if (Math.abs(pc.recuperation) > EPSILON) {
                    parCompteRecuperation.set(pc.compteId, TauxTvaService_1.c((parCompteRecuperation.get(pc.compteId) ?? 0) + pc.recuperation));
                }
                if (Math.abs(pc.deductible) > EPSILON)
                    deductiblesBruts.set(pc.compteId, (deductiblesBruts.get(pc.compteId) ?? 0) + pc.deductible);
            }
        }
        for (const [compteId, montant] of repartirAuCentime(decl.totalDeductibleAdmise, deductiblesBruts, ratio)) {
            parCompteDeductible.set(compteId, montant);
        }
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const estSyscohada = tenant?.referentiel === client_1.Referentiel.SYSCOHADA;
        const chercherCompte = async (numero, intitule) => {
            const c = await this.prisma.compte.findFirst({ where: { tenantId, numero } });
            if (!c) {
                throw new common_1.BadRequestException(`Compte ${numero} (${intitule}) introuvable pour ce dossier · nécessaire pour comptabiliser la liquidation.`);
            }
            return c;
        };
        const compteTvaDue = await chercherCompte('44410000', estSyscohada ? 'État, TVA due' : 'État, TVA due ou crédit de TVA');
        const compteCreditTva = estSyscohada
            ? await chercherCompte('44490000', 'État, crédit de TVA à reporter')
            : compteTvaDue;
        const lignesEcriture = [];
        for (const [compteId, montant] of parCompteCollecte) {
            if (Math.abs(montant) <= EPSILON)
                continue;
            lignesEcriture.push(montant > 0
                ? { compteId, debit: montant, credit: 0, libelle: 'Liquidation TVA · solde TVA collectée' }
                : { compteId, debit: 0, credit: -montant, libelle: 'Liquidation TVA · ventes annulées par inscription en négatif' });
        }
        for (const [compteId, montant] of parCompteDeductible) {
            if (Math.abs(montant) <= EPSILON)
                continue;
            lignesEcriture.push(montant > 0
                ? { compteId, debit: 0, credit: montant, libelle: 'Liquidation TVA · solde TVA déductible admise' }
                : { compteId, debit: -montant, credit: 0, libelle: 'Liquidation TVA · reprise de déduction sur avoir' });
        }
        for (const [compteId, montant] of parCompteRecuperation) {
            lignesEcriture.push(montant > 0
                ? { compteId, debit: 0, credit: montant, libelle: 'Récupération TVA sur ventes annulées, résiliées ou impayées (art. 52)' }
                : { compteId, debit: -montant, credit: 0, libelle: 'Reprise d’une récupération de TVA annulée (art. 52)' });
        }
        const netPeriode = decl.netAvantImputation;
        if (netPeriode > EPSILON) {
            if (decl.creditImpute > EPSILON) {
                lignesEcriture.push({
                    compteId: compteCreditTva.id,
                    debit: 0,
                    credit: decl.creditImpute,
                    libelle: 'Imputation du crédit de TVA reporté (art. 63)',
                });
            }
            const restantDu = TauxTvaService_1.c(netPeriode - decl.creditImpute);
            if (restantDu > EPSILON) {
                lignesEcriture.push({ compteId: compteTvaDue.id, debit: 0, credit: restantDu, libelle: 'TVA due' });
            }
        }
        else if (netPeriode < -EPSILON) {
            lignesEcriture.push({
                compteId: compteCreditTva.id,
                debit: -netPeriode,
                credit: 0,
                libelle: 'Crédit de TVA à reporter',
            });
        }
        if (lignesEcriture.length < 2) {
            throw new common_1.BadRequestException('Rien à comptabiliser sur cette période.');
        }
        const journal = (await this.prisma.journal.findFirst({ where: { tenantId, code: 'OD' } })) ??
            (await this.prisma.journal.findFirst({ where: { tenantId, type: client_1.TypeJournal.GENERAL } }));
        if (!journal) {
            throw new common_1.BadRequestException("Aucun journal de type Général disponible pour enregistrer la liquidation TVA (journal 'OD' attendu).");
        }
        const date = dto.date ? new Date(dto.date) : dateFin;
        const ecriture = await this.ecritureService.creer(tenantId, userId, {
            exerciceId: dto.exerciceId,
            journalId: journal.id,
            date: date.toISOString(),
            libelle: `Liquidation TVA · période du ${dto.dateDebut} au ${dto.dateFin}`,
            lignes: lignesEcriture,
        });
        try {
            await this.prisma.liquidationTva.create({
                data: {
                    tenantId,
                    dateDebut,
                    dateFin,
                    ecritureId: ecriture.id,
                    net: decl.net,
                    prorataApplique: decl.prorata.pourcentage,
                    tvaEncaissementFigee: decl.figeEncaissement ?? {},
                    regleTardifs: true,
                    instantLecture,
                    createdBy: userId,
                },
            });
        }
        catch (e) {
            await this.ecritureService.retirerCompensation(tenantId, ecriture.id);
            throw e;
        }
        const { figeEncaissement, ...declaration } = decl;
        return { ecriture, declaration };
    }
    async liquidationChevauchante(tenantId, dateDebut, dateFin) {
        return this.prisma.liquidationTva.findFirst({
            where: { tenantId, dateDebut: { lte: dateFin }, dateFin: { gte: dateDebut } },
            include: { ecriture: { select: { id: true, libelle: true, date: true } } },
            orderBy: { dateDebut: 'asc' },
        });
    }
    async listerLiquidations(tenantId) {
        const liquidations = await this.prisma.liquidationTva.findMany({
            where: { tenantId },
            include: { ecriture: { select: { id: true, libelle: true, date: true, numeroPiece: true } } },
            orderBy: { dateDebut: 'desc' },
        });
        return liquidations.map((l) => ({
            id: l.id,
            dateDebut: l.dateDebut.toISOString().slice(0, 10),
            dateFin: l.dateFin.toISOString().slice(0, 10),
            net: Number(l.net),
            prorataApplique: Number(l.prorataApplique),
            ecriture: l.ecriture,
            createdAt: l.createdAt,
        }));
    }
    async annulerLiquidation(tenantId, id) {
        const liquidation = await this.prisma.liquidationTva.findFirst({ where: { id, tenantId } });
        if (!liquidation) {
            throw new common_1.BadRequestException('Liquidation introuvable pour ce dossier.');
        }
        const posterieure = await this.prisma.liquidationTva.findFirst({
            where: { tenantId, dateDebut: { gt: liquidation.dateFin } },
            orderBy: { dateDebut: 'desc' },
            select: { dateDebut: true, dateFin: true, ecriture: { select: { statut: true } } },
        });
        if (posterieure) {
            const jour = (d) => d.toISOString().slice(0, 10);
            if (posterieure.ecriture?.statut === client_1.StatutEcriture.VALIDEE) {
                throw new common_1.BadRequestException(`La liquidation du ${jour(posterieure.dateDebut)} au ${jour(posterieure.dateFin)} est postérieure et son écriture est ` +
                    'validée · elle ne s’annule plus (AUDCIF art. 22, 2°), et celle-ci ne s’annule donc plus non plus · une ligne ' +
                    'oubliée ou validée tard est reprise, nommée, par la déclaration de la première période non liquidée ; une erreur ' +
                    'de la liquidation se corrige par une écriture de la période en cours, jamais en défaisant une liquidation antérieure.');
            }
            throw new common_1.BadRequestException(`La liquidation du ${jour(posterieure.dateDebut)} au ${jour(posterieure.dateFin)} est postérieure · annulez d'abord la plus ` +
                'récente, une à une · une liquidation annulée puis refaite derrière une autre tiendrait pour déclarées des lignes que ' +
                'la suivante a déjà reprises.');
        }
        await this.ecritureService.supprimer(tenantId, liquidation.ecritureId, {
            detenteur: ecriture_service_1.DETENTEUR_LIQUIDATION_TVA,
            liberer: (tx) => tx.liquidationTva.delete({ where: { id: liquidation.id } }),
        });
        return { supprime: true, ecritureId: liquidation.ecritureId };
    }
};
exports.TauxTvaService = TauxTvaService;
exports.TauxTvaService = TauxTvaService = TauxTvaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], TauxTvaService);
//# sourceMappingURL=taux-tva.service.js.map