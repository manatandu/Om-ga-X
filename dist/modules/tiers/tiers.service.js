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
exports.TiersService = exports.TRANCHE_PANOPLIES = void 0;
const comptes_proposes_1 = require("../comptes/comptes-proposes");
const common_1 = require("@nestjs/common");
const references_1 = require("../../common/suppression/references");
const fusion_tiers_1 = require("./fusion-tiers");
const qualite_tiers_1 = require("./qualite-tiers");
const lieux_livraison_1 = require("./lieux-livraison");
const duplication_tiers_1 = require("./duplication-tiers");
const collectifs_tiers_1 = require("./collectifs-tiers");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const date_effacable_1 = require("../tenant/date-effacable");
const periode_autorisation_debits_1 = require("./periode-autorisation-debits");
const modes_reglement_service_1 = require("../reglements/modes-reglement.service");
const reference_retiree_1 = require("./reference-retiree");
const modeles_impression_service_1 = require("./modeles-impression.service");
const echeancier_modele_1 = require("./echeancier-modele");
const TYPES_A_PANOPLIE = [client_1.TypeTiers.FOURNISSEUR, client_1.TypeTiers.CLIENT, client_1.TypeTiers.ADHERENT];
exports.TRANCHE_PANOPLIES = 100;
function conflitDeNumeroNomme(e, numeroChoisi) {
    const retiree = (0, reference_retiree_1.conflitSiReferenceRetiree)(e);
    if (retiree !== e)
        throw retiree;
    if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const cible = JSON.stringify(e.meta?.target ?? '');
        throw new common_1.ConflictException(!cible.includes('numero')
            ? "Ce tiers vient d'être créé par une autre saisie · relancez la demande."
            : numeroChoisi
                ? `Le ${numeroChoisi}, ou un numéro de sa panoplie, vient d'être ouvert par une autre saisie · relancez, ou choisissez un autre numéro.`
                : "Un numéro de compte de la panoplie vient d'être ouvert par une autre saisie · relancez la demande.");
    }
    throw e;
}
let TiersService = class TiersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async trouver(tenantId, tiersId) {
        const tiers = await this.prisma.tiers.findFirst({
            where: { id: tiersId, tenantId },
            include: {
                modeleReglement: true,
                modeReglement: { select: { id: true, code: true, intitule: true, nature: true, estActif: true } },
                comptesRattaches: { include: { compte: true }, orderBy: { createdAt: 'asc' } },
            },
        });
        if (!tiers) {
            throw new common_1.NotFoundException('Tiers introuvable pour ce tenant');
        }
        return tiers;
    }
    async lister(tenantId, filtres) {
        const where = {
            tenantId,
            ...(filtres.type ? { type: filtres.type } : {}),
            ...(filtres.actifsSeuls ? { estActif: true } : {}),
            ...(filtres.recherche
                ? {
                    OR: [
                        { code: { contains: filtres.recherche, mode: 'insensitive' } },
                        { nom: { contains: filtres.recherche, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        return this.prisma.tiers.findMany({
            where,
            include: {
                modeleReglement: true,
                modeReglement: { select: { id: true, code: true, intitule: true, nature: true, estActif: true } },
                comptesRattaches: { include: { compte: true }, orderBy: { createdAt: 'asc' } },
            },
            orderBy: { code: 'asc' },
        });
    }
    async obtenir(tenantId, tiersId) {
        return this.trouver(tenantId, tiersId);
    }
    async creer(tenantId, dto) {
        await this.refuserAdherentHorsSycebnl(tenantId, dto.type);
        const existant = await this.prisma.tiers.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
        if (existant) {
            throw new common_1.ConflictException(`Le tiers ${dto.code} existe déjà pour ce tenant`);
        }
        if (dto.modeleReglementId) {
            await this.trouverModeleReglement(tenantId, dto.modeleReglementId);
        }
        if (dto.modeReglementId)
            await (0, modes_reglement_service_1.modeDuDossier)(this.prisma, tenantId, dto.modeReglementId);
        await this.verifierModelesImpression(tenantId, dto);
        if (dto.celluleGroupeId) {
            await this.exigerMemeGroupe(tenantId, dto.celluleGroupeId);
        }
        const { creerCompteIndividuel, numeroCompte, dateEffetAutorisationDebits, dateRevocationAutorisationDebits, qualite, ...reste } = dto;
        if (numeroCompte !== undefined && creerCompteIndividuel === false) {
            throw new common_1.BadRequestException("Un numéro de compte choisi suppose d'ouvrir les comptes du tiers · cochez « Ouvrir ses comptes », ou laissez le numéro vide.");
        }
        const periode = {
            dateEffetAutorisationDebits: (0, date_effacable_1.dateSaisieOuEffacement)(dateEffetAutorisationDebits),
            dateRevocationAutorisationDebits: (0, date_effacable_1.dateSaisieOuEffacement)(dateRevocationAutorisationDebits),
        };
        const motif = (0, periode_autorisation_debits_1.motifRefusPeriodeAutorisationDebits)(periode.dateEffetAutorisationDebits, periode.dateRevocationAutorisationDebits);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const qualiteLue = (0, qualite_tiers_1.normaliserQualite)(qualite);
        const donnees = { ...reste, ...periode, ...(qualiteLue ? { qualite: qualiteLue } : {}) };
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const tiers = await tx.tiers.create({ data: { ...donnees, tenantId } });
            const panoplie = creerCompteIndividuel === false
                ? null
                : await this.poserPanoplie(tx, tenantId, tiers, { silencieux: true, numeroPrincipal: numeroCompte });
            return { ...tiers, compteIndividuel: panoplie?.principal ?? null, panoplie };
        }).catch((e) => conflitDeNumeroNomme(e, numeroCompte));
    }
    async duplication(tenantId, tiersId) {
        const t = await this.trouver(tenantId, tiersId);
        const [ribs, documents, lieux] = await Promise.all([
            this.prisma.ribTiers.count({ where: { tenantId, tiersId } }),
            this.prisma.documentTiers.count({ where: { tenantId, tiersId } }),
            this.prisma.lieuLivraison.count({ where: { tenantId, tiersId } }),
        ]);
        return (0, duplication_tiers_1.copieDuTiers)({
            ...t,
            modeleReglement: t.modeleReglement ? { id: t.modeleReglement.id, estActif: t.modeleReglement.estActif } : null,
            modeReglement: t.modeReglement ? { id: t.modeReglement.id, estActif: t.modeReglement.estActif } : null,
        }, { ribs, documents, lieux });
    }
    async numeroPropose(tenantId, type) {
        await this.refuserAdherentHorsSycebnl(tenantId, type);
        const { referentiel, longueurCompte } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, longueurCompte: true },
        });
        const panoplie = (0, collectifs_tiers_1.panoplieDuTiers)(referentiel, type);
        if (panoplie.length === 0) {
            return {
                numero: null,
                collectif: null,
                longueur: longueurCompte,
                motif: "Ce type de tiers n'a pas de compte collectif proposé · son compte se rattache à la main.",
            };
        }
        const collectif = panoplie[0].collectif;
        const compteCollectif = await this.prisma.compte.findFirst({
            where: { tenantId, numero: collectif },
            select: { estActif: true },
        });
        if (!compteCollectif?.estActif) {
            return {
                numero: null,
                collectif,
                longueur: longueurCompte,
                motif: `Le compte collectif ${collectif} n'existe pas ou est en sommeil dans ce dossier.`,
            };
        }
        const racine = (0, collectifs_tiers_1.racineCollectif)(collectif);
        const existants = await this.prisma.compte.findMany({
            where: { tenantId, numero: { startsWith: racine } },
            select: { numero: true },
        });
        const numero = (0, collectifs_tiers_1.prochainNumeroIndividuel)(racine, longueurCompte, [collectif, ...existants.map((c) => c.numero)]);
        return {
            numero,
            collectif,
            longueur: longueurCompte,
            motif: numero
                ? null
                : `Plus aucun numéro libre sous le collectif ${collectif} à ${longueurCompte} chiffres · allongez les numéros ` +
                    'de compte (Structure > Paramètres du dossier).',
        };
    }
    async completerPanoplie(tenantId, tiersId) {
        const tiers = await this.trouver(tenantId, tiersId);
        const resultat = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => this.poserPanoplie(tx, tenantId, tiers, { silencieux: false })).catch(conflitDeNumeroNomme);
        return resultat;
    }
    async completerPanoplies(tenantId, apres) {
        const tranche = await this.prisma.tiers.findMany({
            where: { tenantId, type: { in: TYPES_A_PANOPLIE }, estActif: true, ...(apres ? { id: { gt: apres } } : {}) },
            select: { id: true, type: true, nom: true, code: true },
            orderBy: { id: 'asc' },
            take: exports.TRANCHE_PANOPLIES,
        });
        let comptesCrees = 0;
        const impossibles = [];
        const horsRang = [];
        for (const tiers of tranche) {
            let r;
            try {
                r = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => this.poserPanoplie(tx, tenantId, tiers, { silencieux: true }));
            }
            catch (e) {
                let motif = 'Échec imprévu · relancez la complétion de ce tiers depuis sa fiche.';
                try {
                    conflitDeNumeroNomme(e);
                }
                catch (nomme) {
                    if (nomme instanceof common_1.HttpException)
                        motif = nomme.message;
                }
                impossibles.push({ tiers: tiers.code, collectif: '', motif });
                continue;
            }
            if (!r)
                continue;
            comptesCrees += r.crees.length;
            for (const i of r.impossibles)
                impossibles.push({ tiers: tiers.code, ...i });
            for (const h of r.horsRang)
                horsRang.push({ tiers: tiers.code, numero: h.numero });
        }
        const suivant = tranche.length === exports.TRANCHE_PANOPLIES ? tranche[tranche.length - 1].id : null;
        return { tiersLus: tranche.length, comptesCrees, impossibles, horsRang, suivant };
    }
    async poserPanoplie(tx, tenantId, tiers, options) {
        const { referentiel, longueurCompte } = await tx.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, longueurCompte: true },
        });
        const panoplie = (0, collectifs_tiers_1.panoplieDuTiers)(referentiel, tiers.type);
        if (panoplie.length === 0) {
            if (options.silencieux && options.numeroPrincipal === undefined)
                return null;
            throw new common_1.BadRequestException('Ce type de tiers n\'a pas de compte collectif proposé · un salarié passe par le 422 de la paie, un tiers « autre » ' +
                'peut être débiteur ou créditeur. Rattachez son compte à la main.');
        }
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`panoplie:${tenantId}`}))`;
        const rattaches = await tx.tiersCompte.findMany({
            where: { tiersId: tiers.id },
            select: { id: true, estPrincipal: true, compte: { select: { numero: true } } },
        });
        if (options.numeroPrincipal !== undefined) {
            const motif = (0, collectifs_tiers_1.motifRefusNumeroChoisi)(options.numeroPrincipal, panoplie[0].collectif, longueurCompte, referentiel);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        const resultat = { principal: null, crees: [], dejaPresents: 0, impossibles: [], horsRang: [] };
        let rang = null;
        const principalSurCollectif = rattaches.find((r) => r.estPrincipal && r.compte.numero === panoplie[0].collectif);
        const principalExistant = principalSurCollectif ? undefined : rattaches.find((r) => r.estPrincipal);
        if (principalExistant)
            rang = (0, collectifs_tiers_1.rangSousRacine)(principalExistant.compte.numero, (0, collectifs_tiers_1.racineCollectif)(panoplie[0].collectif));
        for (const role of panoplie) {
            const racine = (0, collectifs_tiers_1.racineCollectif)(role.collectif);
            const tenu = role.role === 'PRINCIPAL'
                ? !!principalExistant
                : rattaches.some((r) => r.compte.numero.startsWith(racine) && r.compte.numero !== role.collectif);
            if (tenu) {
                resultat.dejaPresents += 1;
                continue;
            }
            const collectif = await tx.compte.findFirst({ where: { tenantId, numero: role.collectif } });
            if (!collectif || !collectif.estActif) {
                const motif = `Le compte collectif ${role.collectif} n'existe pas ou est en sommeil dans ce dossier.`;
                if (role.role === 'PRINCIPAL' && options.numeroPrincipal !== undefined)
                    throw new common_1.BadRequestException(motif);
                resultat.impossibles.push({ collectif: role.collectif, motif });
                continue;
            }
            const existants = await tx.compte.findMany({
                where: { tenantId, numero: { startsWith: racine } },
                select: { id: true, numero: true },
            });
            const choisi = role.role === 'PRINCIPAL' ? options.numeroPrincipal : undefined;
            const pris = choisi !== undefined ? existants.find((c) => c.numero === choisi) : undefined;
            if (pris) {
                const tenuParUnTiers = await tx.tiersCompte.findUnique({ where: { compteId: pris.id }, select: { id: true } });
                throw new common_1.ConflictException(`Le compte ${choisi} existe déjà dans ce dossier · choisissez un autre numéro, ou laissez celui qu'OmegaX propose.` +
                    (tenuParUnTiers
                        ? ''
                        : ' S\'il est le compte de ce tiers, créez le tiers sans « Ouvrir ses comptes », rattachez-lui ce compte comme ' +
                            'principal, puis complétez ses comptes depuis sa fiche · ses sous-comptes prendront son rang.'));
            }
            const numero = choisi ??
                (0, collectifs_tiers_1.numeroIndividuelAligne)(racine, longueurCompte, rang, [role.collectif, ...existants.map((c) => c.numero)]);
            if (!numero) {
                resultat.impossibles.push({
                    collectif: role.collectif,
                    motif: `Plus aucun numéro libre sous le collectif ${role.collectif} à ${longueurCompte} chiffres · allongez les numéros ` +
                        'de compte (Structure > Paramètres du dossier) ou rattachez un compte à la main.',
                });
                continue;
            }
            const compte = await tx.compte.create({
                data: {
                    tenantId,
                    numero,
                    intitule: role.libelle ? `${tiers.nom} · ${role.libelle}` : tiers.nom,
                    classe: collectif.classe,
                    typeCompte: collectif.typeCompte,
                    modeReportANouveau: collectif.modeReportANouveau,
                    lettrable: collectif.lettrable,
                    collectifId: collectif.id,
                },
            });
            const principal = role.role === 'PRINCIPAL';
            if (principal && principalSurCollectif) {
                await tx.tiersCompte.update({ where: { id: principalSurCollectif.id }, data: { estPrincipal: false } });
            }
            await tx.tiersCompte.create({ data: { tiersId: tiers.id, compteId: compte.id, estPrincipal: principal } });
            if (principal) {
                resultat.principal = { id: compte.id, numero: compte.numero, collectif: collectif.numero };
                rang = (0, collectifs_tiers_1.rangSousRacine)(compte.numero, racine);
            }
            else if (rang !== null && (0, collectifs_tiers_1.rangSousRacine)(compte.numero, racine) !== rang) {
                resultat.horsRang.push({ collectif: collectif.numero, numero: compte.numero });
            }
            resultat.crees.push({ role: role.role, numero: compte.numero, collectif: collectif.numero });
        }
        if (!options.silencieux && resultat.crees.length === 0 && resultat.impossibles.length > 0) {
            throw new common_1.BadRequestException(resultat.impossibles.map((i) => i.motif).join(' '));
        }
        if (options.numeroPrincipal !== undefined && resultat.principal?.numero !== options.numeroPrincipal) {
            const motifs = resultat.impossibles.map((i) => i.motif).join(' ');
            throw new common_1.BadRequestException(motifs || `Le compte ${options.numeroPrincipal} n'a pas été ouvert · ce tiers a déjà un compte principal.`);
        }
        return resultat;
    }
    async refuserAdherentHorsSycebnl(tenantId, type) {
        if (type !== client_1.TypeTiers.ADHERENT)
            return;
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        if (tenant.referentiel !== client_1.Referentiel.SYCEBNL) {
            throw new common_1.BadRequestException("Le type « adhérent » relève du compte 411 du SYCEBNL, qui distingue les membres cotisants des " +
                'clients-usagers. Le plan SYSCOHADA ne porte que des clients : utilisez le type « client ».');
        }
    }
    async supprimer(tenantId, tiersId) {
        const tiers = await this.prisma.tiers.findFirst({
            where: { id: tiersId, tenantId },
            include: { comptesRattaches: { select: { compteId: true } } },
        });
        if (!tiers)
            throw new common_1.NotFoundException('Tiers introuvable pour ce dossier.');
        const comptes = tiers.comptesRattaches.map((r) => r.compteId);
        const mouvements = comptes.length
            ? await this.prisma.ligneEcriture.count({ where: { compteId: { in: comptes }, ecriture: { tenantId } } })
            : 0;
        if (mouvements > 0) {
            throw new common_1.ConflictException(`Le tiers ${tiers.code} ne peut pas être supprimé · ses comptes sont mouvementés (${mouvements} ligne(s)). ` +
                'Mettez-le en sommeil pour qu’il ne soit plus proposé.');
        }
        (0, references_1.refuserSiReferences)(`Le tiers ${tiers.code}`, await (0, references_1.referencesVers)(this.prisma, 'Tiers', tiers.id, tenantId, ['TiersCompte.tiersId', 'RibTiers.tiersId', 'LieuLivraison.tiersId']));
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.ribTiers.deleteMany({ where: { tenantId, tiersId: tiers.id } });
            await tx.lieuLivraison.deleteMany({ where: { tenantId, tiersId: tiers.id } });
            await tx.tiersCompte.deleteMany({ where: { tiersId: tiers.id } });
            await tx.tiers.delete({ where: { id: tiers.id } });
        });
        return { supprime: true };
    }
    async fusionner(tenantId, sourceId, cibleId) {
        const [source, cible] = await Promise.all([
            this.prisma.tiers.findFirst({ where: { id: sourceId, tenantId } }),
            this.prisma.tiers.findFirst({ where: { id: cibleId, tenantId }, include: { comptesRattaches: true } }),
        ]);
        if (!source || !cible)
            throw new common_1.NotFoundException('Tiers introuvable pour ce dossier.');
        const refus = (0, fusion_tiers_1.motifRefusFusionTiers)(source, cible);
        if (refus)
            throw new common_1.BadRequestException(refus);
        const reportees = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (cible.comptesRattaches.some((r) => r.estPrincipal)) {
                await tx.tiersCompte.updateMany({ where: { tiersId: source.id }, data: { estPrincipal: false } });
            }
            if ((await tx.ribTiers.count({ where: { tenantId, tiersId: cible.id, estPrincipal: true } })) > 0) {
                await tx.ribTiers.updateMany({ where: { tenantId, tiersId: source.id }, data: { estPrincipal: false } });
            }
            for (const id of [source.id, cible.id].sort()) {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`lieux-livraison:${tenantId}:${id}`}))`;
            }
            if ((await tx.lieuLivraison.count({ where: { tenantId, tiersId: cible.id, estPrincipal: true } })) > 0) {
                await tx.lieuLivraison.updateMany({ where: { tenantId, tiersId: source.id }, data: { estPrincipal: false } });
            }
            const conserves = (await tx.lieuLivraison.findMany({ where: { tenantId, tiersId: cible.id }, select: { intitule: true } })).map((l) => l.intitule);
            const duDoublon = await tx.lieuLivraison.findMany({ where: { tenantId, tiersId: source.id }, select: { id: true, intitule: true } });
            for (const [id, intitule] of (0, lieux_livraison_1.renommagesALaFusion)(conserves, duDoublon, source.code)) {
                await tx.lieuLivraison.update({ where: { id }, data: { intitule } });
            }
            const detenues = await tx.documentTiers.findMany({
                where: { tenantId, tiersId: cible.id },
                select: { empreinte: true },
            });
            if (detenues.length) {
                await tx.documentTiers.deleteMany({
                    where: { tenantId, tiersId: source.id, empreinte: { in: detenues.map((d) => d.empreinte) } },
                });
            }
            const r = await (0, references_1.reporterReferences)(tx, 'Tiers', source.id, cible.id, tenantId);
            const complement = (0, fusion_tiers_1.coordonneesAComblement)(source, cible);
            if (Object.keys(complement).length)
                await tx.tiers.update({ where: { id: cible.id }, data: complement });
            await tx.tiers.delete({ where: { id: source.id } });
            return r;
        });
        return {
            fusionne: true,
            conserve: cible.code,
            supprime: source.code,
            reporte: reportees.map(references_1.libelleReference),
        };
    }
    async modifier(tenantId, tiersId, dto) {
        await this.trouver(tenantId, tiersId);
        if (dto.modeleReglementId) {
            await this.trouverModeleReglement(tenantId, dto.modeleReglementId);
        }
        if (dto.modeReglementId)
            await (0, modes_reglement_service_1.modeDuDossier)(this.prisma, tenantId, dto.modeReglementId);
        await this.verifierModelesImpression(tenantId, dto);
        if (dto.celluleGroupeId) {
            await this.exigerMemeGroupe(tenantId, dto.celluleGroupeId);
        }
        const { dateEffetAutorisationDebits, dateRevocationAutorisationDebits, qualite, ...reste } = dto;
        const qualiteLue = (0, qualite_tiers_1.normaliserQualite)(qualite);
        const effet = (0, date_effacable_1.dateSaisieOuEffacement)(dateEffetAutorisationDebits);
        const revocation = (0, date_effacable_1.dateSaisieOuEffacement)(dateRevocationAutorisationDebits);
        if (effet !== undefined || revocation !== undefined) {
            const actuel = await this.prisma.tiers.findFirst({
                where: { id: tiersId, tenantId },
                select: { dateEffetAutorisationDebits: true, dateRevocationAutorisationDebits: true },
            });
            const motif = (0, periode_autorisation_debits_1.motifRefusPeriodeAutorisationDebits)(effet === undefined ? actuel?.dateEffetAutorisationDebits : effet, revocation === undefined ? actuel?.dateRevocationAutorisationDebits : revocation);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        return this.prisma.tiers
            .update({
            where: { id: tiersId },
            data: {
                ...reste,
                ...(qualiteLue === undefined ? {} : { qualite: qualiteLue }),
                ...(effet === undefined ? {} : { dateEffetAutorisationDebits: effet }),
                ...(revocation === undefined ? {} : { dateRevocationAutorisationDebits: revocation }),
            },
        })
            .catch((e) => {
            throw (0, reference_retiree_1.conflitSiReferenceRetiree)(e);
        });
    }
    async rattacherCompte(tenantId, tiersId, dto) {
        await this.trouver(tenantId, tiersId);
        const compte = await this.prisma.compte.findFirst({ where: { id: dto.compteId, tenantId } });
        if (!compte) {
            throw new common_1.NotFoundException('Compte introuvable pour ce tenant');
        }
        if (compte.classe !== client_1.ClasseCompte.CLASSE_4) {
            throw new common_1.BadRequestException('Seul un compte de classe 4 (Tiers) peut être rattaché à un tiers');
        }
        const motifPersonnalise = (0, comptes_proposes_1.motifComptesNonPersonnalises)(await (0, comptes_proposes_1.comptesNonPersonnalises)(this.prisma, tenantId, [compte.id]), 'le rattachement à un tiers');
        if (motifPersonnalise)
            throw new common_1.BadRequestException(motifPersonnalise);
        const dejaRattache = await this.prisma.tiersCompte.findUnique({ where: { compteId: dto.compteId } });
        if (dejaRattache && dejaRattache.tiersId !== tiersId) {
            throw new common_1.ConflictException('Ce compte est déjà rattaché à un autre tiers');
        }
        if (dejaRattache) {
            throw new common_1.ConflictException('Ce compte est déjà rattaché à ce tiers');
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (dto.estPrincipal) {
                await tx.tiersCompte.updateMany({ where: { tiersId }, data: { estPrincipal: false } });
            }
            return tx.tiersCompte.create({
                data: { tiersId, compteId: dto.compteId, estPrincipal: !!dto.estPrincipal },
            });
        });
    }
    async definirComptePrincipal(tenantId, tiersId, compteId) {
        await this.trouver(tenantId, tiersId);
        const rattachement = await this.prisma.tiersCompte.findFirst({ where: { tiersId, compteId } });
        if (!rattachement) {
            throw new common_1.NotFoundException("Ce compte n'est pas rattaché à ce tiers");
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.tiersCompte.updateMany({ where: { tiersId }, data: { estPrincipal: false } });
            return tx.tiersCompte.update({ where: { id: rattachement.id }, data: { estPrincipal: true } });
        });
    }
    async detacherCompte(tenantId, tiersId, compteId) {
        await this.trouver(tenantId, tiersId);
        const rattachement = await this.prisma.tiersCompte.findFirst({ where: { tiersId, compteId } });
        if (!rattachement) {
            throw new common_1.NotFoundException("Ce compte n'est pas rattaché à ce tiers");
        }
        await this.prisma.tiersCompte.delete({ where: { id: rattachement.id } });
        return { compteId, detache: true };
    }
    async dossiersDuGroupe(tenantId) {
        const courant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, dossierMereId: true },
        });
        if (!courant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        const membres = await this.prisma.tenant.findMany({
            where: courant.dossierMereId === null
                ? { dossierMereId: courant.id }
                : { OR: [{ id: courant.dossierMereId }, { dossierMereId: courant.dossierMereId }], NOT: { id: courant.id } },
            select: { id: true, nom: true, dossierMereId: true },
            orderBy: { nom: 'asc' },
        });
        return membres.map((m) => ({ id: m.id, nom: m.nom, estDossierMere: m.dossierMereId === null }));
    }
    async exigerMemeGroupe(tenantId, celluleGroupeId) {
        const membres = await this.dossiersDuGroupe(tenantId);
        const vise = membres.find((m) => m.id === celluleGroupeId);
        if (!vise) {
            throw new common_1.BadRequestException("Ce dossier n'appartient pas au groupe d'établissements du dossier courant · seuls le dossier mère " +
                'et ses cellules peuvent être désignés. Le rattachement sert à éliminer de la balance agrégée les ' +
                "opérations internes au groupe ; un dossier hors du périmètre en ferait disparaître des opérations " +
                'réellement conclues avec un tiers · le groupe est une seule entité, et seule une opération entre ses ' +
                'propres dossiers lui est interne.');
        }
        return vise;
    }
    async trouverModeleReglement(tenantId, id) {
        const modele = await this.prisma.modeleReglement.findFirst({ where: { id, tenantId } });
        if (!modele) {
            throw new common_1.NotFoundException('Modèle de règlement introuvable pour ce tenant');
        }
        return modele;
    }
    async listerModelesReglement(tenantId) {
        return this.prisma.modeleReglement.findMany({
            where: { tenantId },
            include: { echeances: { orderBy: { ordre: 'asc' } } },
            orderBy: { intitule: 'asc' },
        });
    }
    async verifierModelesImpression(tenantId, dto) {
        if (dto.modeleImpressionExtraitId)
            await (0, modeles_impression_service_1.modeleDuDossierPourLaZone)(this.prisma, tenantId, dto.modeleImpressionExtraitId, 'EXTRAIT');
        if (dto.modeleImpressionReglementId)
            await (0, modeles_impression_service_1.modeleDuDossierPourLaZone)(this.prisma, tenantId, dto.modeleImpressionReglementId, 'REGLEMENT');
        if (dto.modeleImpressionRappelId)
            await (0, modeles_impression_service_1.modeleDuDossierPourLaZone)(this.prisma, tenantId, dto.modeleImpressionRappelId, 'RAPPEL');
    }
    async creerModeleReglement(tenantId, dto) {
        if (dto.modeReglementId)
            await (0, modes_reglement_service_1.modeDuDossier)(this.prisma, tenantId, dto.modeReglementId);
        const existant = await this.prisma.modeleReglement.findUnique({
            where: { tenantId_intitule: { tenantId, intitule: dto.intitule } },
        });
        if (existant) {
            throw new common_1.ConflictException(`Le modèle de règlement "${dto.intitule}" existe déjà pour ce tenant`);
        }
        return this.prisma.modeleReglement.create({ data: { ...dto, tenantId } }).catch((e) => {
            throw (0, reference_retiree_1.conflitSiReferenceRetiree)(e);
        });
    }
    async modifierModeleReglement(tenantId, id, dto) {
        await this.trouverModeleReglement(tenantId, id);
        if (dto.modeReglementId)
            await (0, modes_reglement_service_1.modeDuDossier)(this.prisma, tenantId, dto.modeReglementId);
        return this.prisma.modeleReglement.update({ where: { id }, data: dto }).catch((e) => {
            throw (0, reference_retiree_1.conflitSiReferenceRetiree)(e);
        });
    }
    async listerEcheances(tenantId, modeleId) {
        await this.trouverModeleReglement(tenantId, modeleId);
        return this.prisma.echeanceReglement.findMany({ where: { modeleReglementId: modeleId }, orderBy: { ordre: 'asc' } });
    }
    async ajouterEcheance(tenantId, modeleId, dto) {
        await this.trouverModeleReglement(tenantId, modeleId);
        if (dto.modeReglementId)
            await (0, modes_reglement_service_1.modeDuDossier)(this.prisma, tenantId, dto.modeReglementId);
        if (dto.type !== client_1.TypeEcheance.EQUILIBRE && dto.valeur === undefined) {
            throw new common_1.BadRequestException(`Une échéance de type ${dto.type} doit préciser une valeur`);
        }
        const existantes = await this.prisma.echeanceReglement.findMany({ where: { modeleReglementId: modeleId } });
        if (dto.type === client_1.TypeEcheance.EQUILIBRE && existantes.some((e) => e.type === client_1.TypeEcheance.EQUILIBRE)) {
            throw new common_1.ConflictException('Ce modèle a déjà une échéance de type Équilibre · une seule est autorisée');
        }
        if (dto.type === client_1.TypeEcheance.POURCENTAGE) {
            const sommeExistante = existantes
                .filter((e) => e.type === client_1.TypeEcheance.POURCENTAGE)
                .reduce((s, e) => s + Number(e.valeur ?? 0), 0);
            if (sommeExistante + (dto.valeur ?? 0) > 100 + 0.005) {
                throw new common_1.BadRequestException(`La somme des échéances en pourcentage dépasserait 100 % (${sommeExistante} % déjà réparti)`);
            }
        }
        const dejaCetOrdre = existantes.some((e) => e.ordre === dto.ordre);
        if (dejaCetOrdre) {
            throw new common_1.ConflictException(`Une échéance à l'ordre ${dto.ordre} existe déjà pour ce modèle`);
        }
        const equilibre = existantes.find((e) => e.type === client_1.TypeEcheance.EQUILIBRE);
        if (dto.type === client_1.TypeEcheance.EQUILIBRE && existantes.some((e) => e.ordre > dto.ordre)) {
            throw new common_1.BadRequestException("L'échéance Équilibre reçoit le reste · elle se place en dernier, après toutes les autres échéances du modèle.");
        }
        if (equilibre && dto.type !== client_1.TypeEcheance.EQUILIBRE && dto.ordre > equilibre.ordre) {
            throw new common_1.BadRequestException(`L'échéance Équilibre (ordre ${equilibre.ordre}) reçoit le reste et reste la dernière · placez celle-ci avant elle.`);
        }
        return this.prisma.echeanceReglement.create({
            data: {
                modeleReglementId: modeleId,
                ordre: dto.ordre,
                type: dto.type,
                valeur: dto.type === client_1.TypeEcheance.EQUILIBRE ? null : dto.valeur,
                delaiJours: dto.delaiJours,
                echeance: dto.echeance ?? client_1.ConditionEcheance.NET,
                modeReglementId: dto.modeReglementId ?? null,
            },
        }).catch((e) => {
            throw (0, reference_retiree_1.conflitSiReferenceRetiree)(e);
        });
    }
    async supprimerEcheance(tenantId, modeleId, echeanceId) {
        await this.trouverModeleReglement(tenantId, modeleId);
        const echeance = await this.prisma.echeanceReglement.findFirst({ where: { id: echeanceId, modeleReglementId: modeleId } });
        if (!echeance) {
            throw new common_1.NotFoundException('Échéance introuvable pour ce modèle');
        }
        await this.prisma.echeanceReglement.delete({ where: { id: echeance.id } });
        return { id: echeanceId, supprimee: true };
    }
    async calculerEcheances(tenantId, modeleId, dto) {
        const modele = await this.trouverModeleReglement(tenantId, modeleId);
        const echeances = await this.prisma.echeanceReglement.findMany({
            where: { modeleReglementId: modeleId },
            orderBy: { ordre: 'asc' },
        });
        return (0, echeancier_modele_1.echeancierDuModele)(modele, echeances, new Date(dto.dateFacture), dto.montantTotal);
    }
    async echeancierDeLigne(tenantId, compteId, dto) {
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId }, select: { id: true, numero: true } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        const rattachement = await this.prisma.tiersCompte.findFirst({
            where: { compteId, tiers: { tenantId } },
            select: {
                tiers: {
                    select: {
                        id: true,
                        code: true,
                        nom: true,
                        estActif: true,
                        validationAutomatiqueEcheances: true,
                        modeReglement: { select: { id: true, code: true, estActif: true } },
                        modeleReglement: {
                            select: {
                                id: true,
                                intitule: true,
                                estActif: true,
                                delaiJours: true,
                                echeance: true,
                                modeReglementId: true,
                                echeances: { orderBy: { ordre: 'asc' } },
                            },
                        },
                    },
                },
            },
        });
        const tiers = rattachement?.tiers ?? null;
        const modeHabituel = tiers?.modeReglement?.estActif ? tiers.modeReglement : null;
        const base = {
            tiers: tiers ? { id: tiers.id, code: tiers.code, nom: tiers.nom } : null,
            modele: tiers?.modeleReglement ? { id: tiers.modeleReglement.id, intitule: tiers.modeleReglement.intitule } : null,
            validationAutomatique: tiers?.validationAutomatiqueEcheances ?? false,
            modeHabituel: modeHabituel ? { id: modeHabituel.id, code: modeHabituel.code } : null,
            applicable: false,
        };
        const motifLigne = (0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero: compte.numero, sens: dto.sens, typeJournal: dto.typeJournal ?? null });
        const motif = motifLigne ??
            (!tiers
                ? `Le compte ${compte.numero} n'est rattaché à aucun tiers.`
                : !tiers.modeleReglement
                    ? `Le tiers ${tiers.code} n'a pas de modèle de règlement.`
                    : !tiers.modeleReglement.estActif
                        ? `Le modèle de règlement « ${tiers.modeleReglement.intitule} » du tiers ${tiers.code} est en sommeil.`
                        : null);
        if (motif || !tiers?.modeleReglement)
            return { ...base, applicable: motifLigne === null, echeances: [], motif };
        const ids = [
            ...new Set([tiers.modeleReglement.modeReglementId, ...tiers.modeleReglement.echeances.map((e) => e.modeReglementId)].filter((x) => !!x)),
        ];
        const modes = ids.length
            ? await this.prisma.modeReglement.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, code: true, estActif: true } })
            : [];
        const actifs = new Map(modes.filter((m) => m.estActif).map((m) => [m.id, m.code]));
        const echeances = (0, echeancier_modele_1.echeancierDuModele)(tiers.modeleReglement, tiers.modeleReglement.echeances, new Date(dto.date), dto.montant, modeHabituel?.id ?? null).map((e) => {
            const modeId = e.modeReglementId && (actifs.has(e.modeReglementId) || e.modeReglementId === modeHabituel?.id) ? e.modeReglementId : null;
            return {
                ordre: e.ordre,
                montant: e.montant,
                dateEcheance: e.dateEcheance.toISOString().slice(0, 10),
                modeReglementId: modeId,
                modeCode: modeId ? (actifs.get(modeId) ?? modeHabituel?.code ?? null) : null,
            };
        });
        return { ...base, applicable: true, echeances, motif: null };
    }
};
exports.TiersService = TiersService;
exports.TiersService = TiersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TiersService);
//# sourceMappingURL=tiers.service.js.map