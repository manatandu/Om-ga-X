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
exports.CompteService = void 0;
exports.estLettrableParDefaut = estLettrableParDefaut;
const renvois_plan_syscohada_1 = require("./renvois-plan-syscohada");
const common_1 = require("@nestjs/common");
const references_1 = require("../../common/suppression/references");
const prisma_service_1 = require("../../common/prisma.service");
const bailleur_referentiel_1 = require("../../common/bailleur-referentiel");
const fonds_contrepartie_etat_1 = require("./fonds-contrepartie-etat");
const client_1 = require("@prisma/client");
const compte_seed_1 = require("./compte-seed");
const catalogue_retraitements_1 = require("../fiscalite/catalogue-retraitements");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
const compte_en_saisie_1 = require("./compte-en-saisie");
const natures_compte_service_1 = require("./natures-compte.service");
const natures_compte_1 = require("./natures-compte");
const classe_du_numero_1 = require("./classe-du-numero");
const comptes_de_passage_1 = require("../virements-fonds/comptes-de-passage");
const routage_tva_1 = require("../tva/routage-tva");
const comptes_proposes_1 = require("./comptes-proposes");
const subdivisions_du_plan_1 = require("./subdivisions-du-plan");
function estLettrableParDefaut(numero) {
    return numero.startsWith('4') || numero.startsWith('58');
}
let CompteService = class CompteService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async seedPlan(tenantId, referentiel, client = this.prisma) {
        const plan = referentiel === client_1.Referentiel.SYSCOHADA ? compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA : compte_seed_1.PLAN_COMPTES_SYCEBNL;
        await client.compte.createMany({
            data: plan.map((c) => ({
                ...c,
                tenantId,
                lettrable: c.typeCompte === 'TOTAL' ? false : estLettrableParDefaut(c.numero),
                estRetenu: referentiel === client_1.Referentiel.SYSCOHADA && routage_tva_1.COMPTES_DE_TAXE_ROUTES_SYSCOHADA.includes(c.numero),
            })),
            skipDuplicates: true,
        });
        await (0, comptes_de_passage_1.assurerComptesDePassage)(client, tenantId);
    }
    async renvoisDuPlan(tenantId) {
        const dossier = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
        return dossier?.referentiel === client_1.Referentiel.SYSCOHADA ? (0, renvois_plan_syscohada_1.renvoisDuPlanSyscohada)() : [];
    }
    async lister(tenantId, filtres) {
        const where = {
            tenantId,
            ...(filtres.classe ? { classe: filtres.classe } : {}),
            ...(filtres.actifsSeuls ? { estActif: true } : {}),
            ...(filtres.typeCompte ? { typeCompte: filtres.typeCompte } : {}),
            ...(filtres.recherche
                ? {
                    OR: [
                        { numero: { contains: filtres.recherche } },
                        { intitule: { contains: filtres.recherche, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const [comptes, natures] = await Promise.all([
            this.prisma.compte.findMany({ where, orderBy: { numero: 'asc' } }),
            (0, natures_compte_service_1.naturesDuDossier)(this.prisma, tenantId),
        ]);
        const utilises = filtres.retenus || filtres.usage ? await (0, comptes_proposes_1.comptesUtilises)(this.prisma, tenantId, comptes.map((c) => c.id)) : null;
        const plan = filtres.usage
            ? await (async () => {
                const filtree = !!(filtres.classe || filtres.recherche || filtres.actifsSeuls || filtres.typeCompte);
                const [dossier, tous, journaux] = await Promise.all([
                    this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
                    filtree
                        ? this.prisma.compte.findMany({ where: { tenantId }, select: { numero: true, typeCompte: true, estActif: true } })
                        : Promise.resolve(comptes),
                    this.prisma.journal.findMany({
                        where: { tenantId, type: client_1.TypeJournal.TRESORERIE, estActif: true, compteTresorerieId: { not: null } },
                        select: { compteTresorerieId: true },
                    }),
                ]);
                return {
                    referentiel: dossier.referentiel,
                    subdivises: (0, subdivisions_du_plan_1.comptesDuPlanSubdivises)(dossier.referentiel, tous),
                    tenusParUnJournal: new Set(journaux.map((j) => j.compteTresorerieId)),
                };
            })()
            : null;
        return comptes
            .filter((c) => !filtres.retenus || (0, comptes_proposes_1.estPropose)(c, utilises))
            .map((c) => {
            const n = (0, natures_compte_1.natureDe)(c.numero, natures);
            return {
                ...c,
                nature: n ? natures_compte_1.LIBELLES_NATURE[n.nature] : null,
                ...(utilises ? { utilise: utilises.has(c.id) } : {}),
                ...(plan
                    ? {
                        duPlan: (0, subdivisions_du_plan_1.estCompteSeme)(plan.referentiel, c.numero),
                        subdivise: plan.subdivises.has(c.numero) && !plan.tenusParUnJournal.has(c.id),
                    }
                    : {}),
            };
        });
    }
    async creer(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
        if (dto.numero.length > tenant.longueurCompte) {
            throw new common_1.BadRequestException(`Le numéro de compte "${dto.numero}" dépasse la longueur autorisée pour ce dossier (${tenant.longueurCompte} chiffres) · voir Structure > Paramètres du dossier.`);
        }
        this.verifierCodeRetraitement(dto.codeRetraitementFiscal);
        const classe = (0, classe_du_numero_1.classeDuNumero)(dto.numero);
        if (!classe) {
            throw new common_1.BadRequestException(`Le compte ${dto.numero} ne commence pas par un chiffre de classe (1 à 9) · la classe d'un compte est le ` +
                'premier chiffre de son numéro.');
        }
        if (dto.classe && dto.classe !== classe) {
            throw new common_1.BadRequestException(`Le compte ${dto.numero} est de la classe ${classe.slice(-1)}, que donne son premier chiffre · la classe ` +
                `${dto.classe.slice(-1)} indiquée le rangerait ailleurs dans les états.`);
        }
        const existant = await this.prisma.compte.findUnique({
            where: { tenantId_numero: { tenantId, numero: dto.numero } },
        });
        if (existant) {
            throw new common_1.ConflictException(`Le compte ${dto.numero} existe déjà pour ce tenant`);
        }
        const nature = (0, natures_compte_1.natureDe)(dto.numero, await (0, natures_compte_service_1.naturesDuDossier)(this.prisma, tenantId));
        const numeroDuPlan = (0, subdivisions_du_plan_1.compteSemeSubdivise)(tenant.referentiel, dto.numero);
        const duPlan = numeroDuPlan
            ? await this.prisma.compte.findUnique({
                where: { tenantId_numero: { tenantId, numero: numeroDuPlan } },
                select: {
                    id: true,
                    lettrable: true,
                    modeReportANouveau: true,
                    tauxTvaDefautId: true,
                    comportementGestion: true,
                    partVariableGestionPct: true,
                    codeRetraitementFiscal: true,
                },
            })
            : null;
        if (duPlan && dto.codeRetraitementFiscal === undefined)
            this.verifierCodeRetraitement(duPlan.codeRetraitementFiscal);
        return this.prisma.compte.create({
            data: {
                ...dto,
                classe,
                tenantId,
                lettrable: dto.lettrable ?? duPlan?.lettrable ?? nature?.lettrable ?? estLettrableParDefaut(dto.numero),
                ...(dto.modeReportANouveau ?? duPlan?.modeReportANouveau ?? nature?.modeReportANouveau
                    ? { modeReportANouveau: dto.modeReportANouveau ?? duPlan?.modeReportANouveau ?? nature?.modeReportANouveau }
                    : {}),
                ...(duPlan
                    ? {
                        tauxTvaDefautId: dto.tauxTvaDefautId !== undefined ? dto.tauxTvaDefautId : duPlan.tauxTvaDefautId,
                        comportementGestion: duPlan.comportementGestion,
                        partVariableGestionPct: duPlan.partVariableGestionPct,
                        codeRetraitementFiscal: dto.codeRetraitementFiscal !== undefined ? dto.codeRetraitementFiscal : duPlan.codeRetraitementFiscal,
                    }
                    : {}),
            },
        });
    }
    async propositionEnSaisie(tenantId, numero) {
        const n = (numero ?? '').trim();
        const { motif, compteDuPlan } = await this.jugerCompteEnSaisie(tenantId, n);
        return {
            numero: n,
            intitule: compteDuPlan?.intitule ?? '',
            compteDuPlan: compteDuPlan ? { numero: compteDuPlan.numero, intitule: compteDuPlan.intitule } : null,
            motif,
        };
    }
    async creerEnSaisie(tenantId, dto) {
        const numero = dto.numero.trim();
        const intitule = dto.intitule.trim();
        if (!intitule)
            throw new common_1.BadRequestException("L'intitulé du compte est obligatoire.");
        const { motif, optionFermee } = await this.jugerCompteEnSaisie(tenantId, numero);
        if (optionFermee)
            throw new common_1.ForbiddenException(compte_en_saisie_1.MOTIF_OPTION_FERMEE);
        if (motif)
            throw new common_1.BadRequestException(motif);
        try {
            return await this.creer(tenantId, { numero, intitule, typeCompte: client_1.TypeCompteDetailTotal.DETAIL });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Le compte ${numero} vient d'être créé dans ce dossier · choisissez-le dans la liste.`);
            }
            throw e;
        }
    }
    async jugerCompteEnSaisie(tenantId, numero) {
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, longueurCompte: true, creationCompteEnSaisie: true },
        });
        if (!dossier.creationCompteEnSaisie)
            return { motif: compte_en_saisie_1.MOTIF_OPTION_FERMEE, optionFermee: true, compteDuPlan: null };
        const numeroDuPlan = /^\d+$/.test(numero) ? (0, subdivisions_du_plan_1.compteSemeSubdivise)(dossier.referentiel, numero) : null;
        const [existant, compteDuPlan] = await Promise.all([
            /^\d+$/.test(numero)
                ? this.prisma.compte.findUnique({ where: { tenantId_numero: { tenantId, numero } }, select: { id: true } })
                : Promise.resolve(null),
            numeroDuPlan
                ? this.prisma.compte.findUnique({
                    where: { tenantId_numero: { tenantId, numero: numeroDuPlan } },
                    select: { numero: true, intitule: true, typeCompte: true, estActif: true },
                })
                : Promise.resolve(null),
        ]);
        const motif = (0, compte_en_saisie_1.motifRefusCompteEnSaisie)({
            referentiel: dossier.referentiel,
            numero,
            longueurCompte: dossier.longueurCompte,
            existe: existant !== null,
            numeroDuPlan,
            compteDuPlan,
        });
        return { motif, optionFermee: false, compteDuPlan };
    }
    async sousComptePropose(tenantId, compteId) {
        const [dossier, compte] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true, longueurCompte: true } }),
            this.prisma.compte.findFirst({ where: { id: compteId, tenantId }, select: { numero: true, intitule: true, typeCompte: true, estActif: true } }),
        ]);
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        if (!compte.estActif) {
            return {
                numero: null,
                intitule: compte.intitule,
                motif: `Le compte ${compte.numero} est en sommeil · réactivez-le dans le plan comptable avant d'ouvrir un sous-compte sous lui.`,
            };
        }
        const racine = (0, subdivisions_du_plan_1.racineDuCompteSeme)(dossier.referentiel, compte.numero);
        if (racine === null || compte.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
            return {
                numero: null,
                intitule: compte.intitule,
                motif: `Le compte ${compte.numero} n'est pas un compte d'imputation du plan · un sous-compte s'ouvre sous un ` +
                    "compte d'imputation du plan officiel.",
            };
        }
        const existants = await this.prisma.compte.findMany({
            where: { tenantId, numero: { startsWith: racine } },
            select: { numero: true },
        });
        const numero = (0, subdivisions_du_plan_1.sousComptePropose)(dossier.referentiel, compte.numero, dossier.longueurCompte, existants.map((c) => c.numero));
        return {
            numero,
            intitule: compte.intitule,
            motif: numero
                ? null
                : `Plus aucun numéro libre sous le compte ${compte.numero} à ${dossier.longueurCompte} chiffres · allongez ` +
                    'les numéros de compte (Structure > Paramètres du dossier).',
        };
    }
    verifierCodeRetraitement(code) {
        if (code === undefined || code === null || code === '')
            return;
        if (!catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS.some((d) => d.code === code)) {
            throw new common_1.BadRequestException(`Code de retraitement fiscal inconnu : ${code}. Voir le catalogue de la fenêtre Fiscalité.`);
        }
    }
    async supprimer(tenantId, compteId) {
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        const sousComptes = await this.prisma.compte.count({
            where: { tenantId, numero: { startsWith: compte.numero }, id: { not: compte.id } },
        });
        if (sousComptes > 0) {
            throw new common_1.ConflictException(`Le compte ${compte.numero} regroupe ${sousComptes} sous-compte(s) · supprimez-les d'abord ou mettez-le en sommeil.`);
        }
        (0, references_1.refuserSiReferences)(`Le compte ${compte.numero}`, await (0, references_1.referencesVers)(this.prisma, 'Compte', compte.id, tenantId));
        await this.prisma.compte.delete({ where: { id: compte.id } });
        return { supprime: true };
    }
    async neRetenirQueLesUtilises(tenantId) {
        const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const gardes = referentiel === client_1.Referentiel.SYSCOHADA ? new Set(routage_tva_1.COMPTES_DE_TAXE_ROUTES_SYSCOHADA) : new Set();
        const { count } = await this.prisma.compte.updateMany({
            where: { tenantId, estRetenu: true, numero: { in: (0, subdivisions_du_plan_1.numerosSemes)(referentiel).filter((n) => !gardes.has(n)) } },
            data: { estRetenu: false },
        });
        return { comptesDesretenus: count };
    }
    async modifier(tenantId, compteId, dto) {
        this.verifierCodeRetraitement(dto.codeRetraitementFiscal);
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
        if (!compte) {
            throw new common_1.NotFoundException('Compte introuvable pour ce tenant');
        }
        if (dto.typeCompte === client_1.TypeCompteDetailTotal.TOTAL && compte.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL) {
            const aDesMouvements = await this.prisma.ligneEcriture.findFirst({ where: { compteId } });
            if (aDesMouvements) {
                throw new common_1.BadRequestException(`Le compte ${compte.numero} a déjà des écritures · impossible de le basculer en compte Total`);
            }
        }
        await (0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(this.prisma, tenantId, dto.bailleurId);
        if (dto.bailleurId) {
            const bailleur = await this.prisma.bailleur.findFirst({ where: { id: dto.bailleurId, tenantId } });
            if (!bailleur) {
                throw new common_1.BadRequestException("Bailleur introuvable pour ce tenant");
            }
        }
        const porteEtat = dto.porteFondsContrepartieEtat ?? compte.porteFondsContrepartieEtat;
        if (porteEtat && (dto.porteFondsContrepartieEtat !== undefined || dto.bailleurId || dto.typeCompte)) {
            const dossier = await this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { referentiel: true, jeuEtatsFinanciersSycebnl: true },
            });
            const motif = (0, fonds_contrepartie_etat_1.motifRefusFondsContrepartieEtat)({
                referentiel: dossier.referentiel,
                jeu: dossier.jeuEtatsFinanciersSycebnl,
                numero: compte.numero,
                typeCompte: dto.typeCompte ?? compte.typeCompte,
                bailleurId: dto.bailleurId !== undefined ? dto.bailleurId : compte.bailleurId,
            });
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        return this.prisma.compte.update({ where: { id: compteId }, data: dto });
    }
};
exports.CompteService = CompteService;
exports.CompteService = CompteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompteService);
//# sourceMappingURL=compte.service.js.map