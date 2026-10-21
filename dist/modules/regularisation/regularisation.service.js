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
var RegularisationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegularisationService = void 0;
exports.dateReprise = dateReprise;
const comptes_proposes_1 = require("../comptes/comptes-proposes");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const ajouter_mois_1 = require("../../common/ajouter-mois");
const interets_courus_1 = require("./interets-courus");
const JOUR = 86_400_000;
function dateReprise(type, cible) {
    if (type === client_1.TypeRegularisation.SUBVENTION_PLURIANNUELLE)
        return cible.dateFin;
    return cible.dateDebut;
}
const RACINE_DIFFERE = {
    [client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE]: '476',
    [client_1.TypeRegularisation.PRODUIT_CONSTATE_AVANCE]: '477',
    [client_1.TypeRegularisation.SUBVENTION_PLURIANNUELLE]: '477',
    [client_1.TypeRegularisation.CHARGE_A_PAYER]: '',
    [client_1.TypeRegularisation.PRODUIT_A_RECEVOIR]: '',
};
const RATTACHEMENT = {
    FOURNISSEURS: { charge: '4081', produit: '', libelle: 'Fournisseurs' },
    CLIENTS: { charge: '', produit: '4181', libelle: 'Clients, adhérents et usagers' },
    PERSONNEL: { charge: '4286', produit: '4287', libelle: 'Personnel' },
    ORGANISMES_SOCIAUX: { charge: '4386', produit: '4387', libelle: 'Organismes sociaux' },
    ETAT: { charge: '4486', produit: '4487', libelle: 'État et collectivités publiques' },
    PRETEURS: { charge: '', produit: '', libelle: 'Prêteurs (intérêts courus sur emprunts)' },
};
let RegularisationService = RegularisationService_1 = class RegularisationService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    static prorataDiffere(montantTotal, periodeDebut, periodeFin, finExercice) {
        const debut = periodeDebut.getTime();
        const fin = periodeFin.getTime();
        if (fin <= debut)
            return 0;
        const cloture = finExercice.getTime();
        if (cloture >= fin)
            return 0;
        if (cloture < debut)
            return Math.round(montantTotal * 100) / 100;
        const totalJours = (fin - debut) / JOUR + 1;
        const joursApres = (fin - cloture) / JOUR;
        return Math.round((montantTotal * joursApres) / totalJours * 100) / 100;
    }
    async trouverCompteDiffere(tenantId, type, compteId) {
        if (compteId) {
            const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
            if (!compte)
                throw new common_1.BadRequestException('Compte de report introuvable pour ce dossier');
            return compte;
        }
        const racine = RACINE_DIFFERE[type];
        const compte = await this.prisma.compte.findFirst({
            where: { tenantId, numero: { startsWith: racine }, typeCompte: 'DETAIL', estActif: true },
            orderBy: { numero: 'asc' },
        });
        if (!compte) {
            throw new common_1.BadRequestException(`Aucun compte ${racine} dans le plan de ce dossier (${racine === '476' ? "charges constatées d'avance" : "produits constatés d'avance"}). Créez-le, ou indiquez le compte de report.`);
        }
        return compte;
    }
    async lister(tenantId, exerciceId) {
        return this.prisma.regularisation.findMany({
            where: { tenantId, exerciceId },
            orderBy: { createdAt: 'desc' },
            include: {
                compteChargeProduit: { select: { numero: true, intitule: true } },
                compteDiffere: { select: { numero: true, intitule: true } },
                ecritureConstatation: { select: { id: true, numeroPiece: true, date: true } },
                ecritureReprise: { select: { id: true, numeroPiece: true, date: true } },
            },
        });
    }
    async trouverCompteRattachement(tenantId, dto) {
        if (!dto.natureTiers) {
            throw new common_1.BadRequestException("La nature du tiers est obligatoire pour une charge à payer ou un produit à recevoir : c'est elle qui " +
                'décide du compte de rattachement. Les deux plans les énumèrent nommément · 408 fournisseurs, 418 ' +
                "clients et adhérents, 4286/4287 personnel, 4386/4387 organismes sociaux, 4486/4487 État. Il n'y a " +
                'aucun compte fourre-tout.');
        }
        const tenant = await this.prisma.tenant.findFirst({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        if (!tenant)
            throw new common_1.BadRequestException('Dossier introuvable');
        if (dto.natureTiers === 'PRETEURS')
            return this.trouverCompteInteretsCourus(tenantId, tenant.referentiel, dto);
        if (dto.compteEmpruntId) {
            throw new common_1.BadRequestException("L'emprunt ne se désigne que pour des intérêts courus (nature « prêteurs »).");
        }
        const { racine } = RegularisationService_1.compteRattachement(tenant.referentiel, dto.natureTiers, dto.type);
        const compte = await this.prisma.compte.findFirst({
            where: { tenantId, numero: { startsWith: racine } },
            orderBy: { numero: 'asc' },
        });
        if (!compte) {
            throw new common_1.BadRequestException(`Le compte de rattachement ${racine} n'existe pas dans le plan de ce dossier. Il est prévu par le ` +
                "référentiel : le créer plutôt que d'en choisir un autre.");
        }
        return compte;
    }
    async trouverCompteInteretsCourus(tenantId, referentiel, dto) {
        if (dto.type !== client_1.TypeRegularisation.CHARGE_A_PAYER) {
            throw new common_1.BadRequestException('Les intérêts courus sur emprunts sont une charge à payer, jamais un produit à recevoir.');
        }
        if (!dto.compteEmpruntId) {
            throw new common_1.BadRequestException("Désignez l'emprunt · c'est lui qui décide du compte d'intérêts courus (166 au SYSCOHADA, 186 au SYCEBNL).");
        }
        const emprunt = await this.prisma.compte.findFirst({ where: { id: dto.compteEmpruntId, tenantId }, select: { numero: true } });
        if (!emprunt)
            throw new common_1.BadRequestException('Emprunt introuvable pour ce dossier');
        const resolu = (0, interets_courus_1.compteInteretsCourus)(referentiel, emprunt.numero);
        if ('refus' in resolu)
            throw new common_1.BadRequestException(resolu.refus);
        const charge = await this.prisma.compte.findFirst({ where: { id: dto.compteChargeProduitId, tenantId }, select: { numero: true } });
        if (!charge)
            throw new common_1.BadRequestException('Compte de charge introuvable');
        const refusCharge = (0, interets_courus_1.motifRefusChargeInterets)(charge.numero);
        if (refusCharge)
            throw new common_1.BadRequestException(refusCharge);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { dateFin: true } });
        if (exercice && new Date(dto.periodeFin).getTime() > exercice.dateFin.getTime()) {
            throw new common_1.BadRequestException("Les intérêts courus se comptent « jusqu'au jour de la clôture » · la période ne dépasse pas la fin de l'exercice.");
        }
        const compte = await this.prisma.compte.findFirst({
            where: { tenantId, numero: { startsWith: resolu.racine }, typeCompte: 'DETAIL' },
            orderBy: { numero: 'asc' },
        });
        if (!compte) {
            throw new common_1.BadRequestException(`Le compte d'intérêts courus ${resolu.racine} n'existe pas dans le plan de ce dossier · il est prévu par le ` +
                "référentiel, créez-le plutôt que d'en choisir un autre.");
        }
        return compte;
    }
    static compteRattachement(referentiel, nature, type) {
        const estCharge = type === client_1.TypeRegularisation.CHARGE_A_PAYER;
        const table = RATTACHEMENT[nature];
        let racine = estCharge ? table.charge : table.produit;
        if (!estCharge && nature === 'CLIENTS' && referentiel === client_1.Referentiel.SYCEBNL)
            racine = '4182';
        if (!racine) {
            throw new common_1.BadRequestException(estCharge
                ? `Une charge à payer ne se rattache pas au compte « ${table.libelle} » · le plan n'y prévoit aucun ` +
                    "sous-compte de charges à payer. Une somme due à un client est une dette envers un client (419, " +
                    'avances reçues, ou 4198 avoirs à accorder), pas une charge à payer.'
                : `Un produit à recevoir ne se rattache pas au compte « ${table.libelle} » · le plan n'y prévoit aucun ` +
                    "sous-compte de produits à recevoir. Une somme à recevoir d'un fournisseur est une créance sur " +
                    'fournisseur (409, avances versées, ou 4098 avoirs à obtenir), pas un produit à recevoir.');
        }
        return { racine, sens: estCharge ? 'charge' : 'produit' };
    }
    static debiteLeCompteDeGestion(type) {
        return (type === client_1.TypeRegularisation.CHARGE_A_PAYER ||
            type === client_1.TypeRegularisation.PRODUIT_CONSTATE_AVANCE ||
            type === client_1.TypeRegularisation.SUBVENTION_PLURIANNUELLE);
    }
    static montantRattache(type, montantTotal) {
        return Math.round(montantTotal * 100) / 100;
    }
    async simuler(tenantId, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        const periodeDebut = new Date(dto.periodeDebut);
        const periodeFin = new Date(dto.periodeFin);
        if (periodeFin < periodeDebut) {
            throw new common_1.BadRequestException('La fin de la période précède son début.');
        }
        const commun = {
            montantTotal: dto.montantTotal,
            finExercice: exercice.dateFin.toISOString().slice(0, 10),
            joursTotal: Math.round((periodeFin.getTime() - periodeDebut.getTime()) / JOUR) + 1,
            joursApresCloture: Math.max(0, Math.round((periodeFin.getTime() - exercice.dateFin.getTime()) / JOUR)),
        };
        if (RegularisationService_1.estRattachement(dto.type)) {
            const compte = await this.trouverCompteRattachement(tenantId, dto);
            const montant = RegularisationService_1.montantRattache(dto.type, dto.montantTotal);
            return {
                ...commun,
                rattachement: true,
                montantDiffere: montant,
                montantExercice: montant,
                compteRattachement: { numero: compte.numero, intitule: compte.intitule },
            };
        }
        const montantDiffere = dto.montantDiffere ??
            RegularisationService_1.prorataDiffere(dto.montantTotal, periodeDebut, periodeFin, exercice.dateFin);
        return {
            ...commun,
            rattachement: false,
            montantDiffere,
            montantExercice: Math.round((dto.montantTotal - montantDiffere) * 100) / 100,
            compteRattachement: null,
        };
    }
    static compteTvaRattachement(referentiel, nature, type) {
        if (referentiel !== client_1.Referentiel.SYSCOHADA)
            return null;
        if (type === client_1.TypeRegularisation.CHARGE_A_PAYER && nature === 'FOURNISSEURS')
            return '4455';
        if (type === client_1.TypeRegularisation.PRODUIT_A_RECEVOIR && nature === 'CLIENTS')
            return '4435';
        return null;
    }
    static estRattachement(type) {
        return type === client_1.TypeRegularisation.CHARGE_A_PAYER || type === client_1.TypeRegularisation.PRODUIT_A_RECEVOIR;
    }
    async creer(tenantId, createdBy, dto) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé : aucune régularisation ne peut plus y être passée.");
        }
        const compteChargeProduit = await this.prisma.compte.findFirst({
            where: { id: dto.compteChargeProduitId, tenantId },
        });
        if (!compteChargeProduit)
            throw new common_1.BadRequestException('Compte de charge ou de produit introuvable');
        const estRattachement = RegularisationService_1.estRattachement(dto.type);
        const estCharge = dto.type === client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE || dto.type === client_1.TypeRegularisation.CHARGE_A_PAYER;
        const classeAttendue = estCharge ? client_1.ClasseCompte.CLASSE_6 : client_1.ClasseCompte.CLASSE_7;
        if (compteChargeProduit.classe !== classeAttendue) {
            throw new common_1.BadRequestException(`Le compte ${compteChargeProduit.numero} est de classe ${compteChargeProduit.classe.replace('CLASSE_', '')} ; ` +
                `une ${estCharge ? 'charge constatée d\'avance' : 'régularisation de produit'} porte sur un compte de classe ` +
                `${estCharge ? '6' : '7'}.`);
        }
        const periodeDebut = new Date(dto.periodeDebut);
        const periodeFin = new Date(dto.periodeFin);
        const compteDiffere = estRattachement
            ? await this.trouverCompteRattachement(tenantId, dto)
            : await this.trouverCompteDiffere(tenantId, dto.type, dto.compteDifferId);
        const montantDiffere = estRattachement
            ? RegularisationService_1.montantRattache(dto.type, dto.montantTotal)
            : dto.montantDiffere ??
                RegularisationService_1.prorataDiffere(dto.montantTotal, periodeDebut, periodeFin, exercice.dateFin);
        if (estRattachement && dto.montantDiffere !== undefined && Math.abs(dto.montantDiffere - dto.montantTotal) > 0.005) {
            throw new common_1.BadRequestException("Une charge à payer ou un produit à recevoir ne se proratise pas · la charge n'est pas encore " +
                "comptabilisée et appartient ENTIÈREMENT à cet exercice, seule la pièce manque. Le montant rattaché " +
                'est le montant total. Si une part de la dépense concerne réellement un autre exercice, ce sont DEUX ' +
                "opérations : la charge à payer de l'exercice, et une charge constatée d'avance (476) pour le reste.");
        }
        if (!estRattachement && montantDiffere <= 0) {
            throw new common_1.BadRequestException("La période ne déborde pas la clôture de l'exercice : il n'y a rien à différer.");
        }
        if (montantDiffere > dto.montantTotal + 0.005) {
            throw new common_1.BadRequestException('La part différée dépasse le montant total.');
        }
        const montantTva = dto.montantTva ?? 0;
        let compteTva = null;
        if (montantTva > 0) {
            const dossier = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
            if (!dossier)
                throw new common_1.BadRequestException('Dossier introuvable');
            const racineTva = RegularisationService_1.compteTvaRattachement(dossier.referentiel, dto.natureTiers, dto.type);
            if (!racineTva) {
                throw new common_1.BadRequestException("La TVA ne s'ajoute qu'à une charge à payer sur un fournisseur (4455) ou à un produit à recevoir sur un " +
                    'client (4435), au SYSCOHADA · AUDCIF, Titre VII, fiches des comptes 40 et 41.');
            }
            compteTva = await this.prisma.compte.findFirst({
                where: { tenantId, numero: { startsWith: racineTva } },
                orderBy: { numero: 'asc' },
                select: { id: true },
            });
            if (!compteTva) {
                throw new common_1.BadRequestException(`Le compte ${racineTva} n'existe pas dans le plan de ce dossier.`);
            }
        }
        const montantTiers = Math.round((montantDiffere + montantTva) * 100) / 100;
        const journal = await this.journalAccueil(tenantId, dto.journalId);
        const sensEntrant = RegularisationService_1.debiteLeCompteDeGestion(dto.type);
        const ligneTva = compteTva ? { compteId: compteTva.id, montant: montantTva } : null;
        const lignes = sensEntrant
            ? [
                { compteId: compteChargeProduit.id, debit: montantDiffere, libelle: dto.libelle },
                ...(ligneTva ? [{ compteId: ligneTva.compteId, debit: ligneTva.montant, libelle: dto.libelle }] : []),
                { compteId: compteDiffere.id, credit: montantTiers, libelle: dto.libelle },
            ]
            : [
                { compteId: compteDiffere.id, debit: montantTiers, libelle: dto.libelle },
                { compteId: compteChargeProduit.id, credit: montantDiffere, libelle: dto.libelle },
                ...(ligneTva ? [{ compteId: ligneTva.compteId, credit: ligneTva.montant, libelle: dto.libelle }] : []),
            ];
        const ecriture = await this.ecritureService.creer(tenantId, createdBy, {
            exerciceId: dto.exerciceId,
            journalId: journal.id,
            date: exercice.dateFin.toISOString().slice(0, 10),
            libelle: `Régularisation · ${dto.libelle}`,
            reference: 'REGUL',
            lignes,
        });
        return this.prisma.regularisation.create({
            data: {
                tenantId,
                exerciceId: dto.exerciceId,
                type: dto.type,
                libelle: dto.libelle,
                compteChargeProduitId: compteChargeProduit.id,
                compteDifferId: compteDiffere.id,
                montantTotal: new client_1.Prisma.Decimal(dto.montantTotal),
                periodeDebut,
                periodeFin,
                montantDiffere: new client_1.Prisma.Decimal(montantDiffere),
                ecritureConstatationId: ecriture.id,
                createdBy,
            },
            include: {
                compteChargeProduit: { select: { numero: true, intitule: true } },
                compteDiffere: { select: { numero: true, intitule: true } },
            },
        });
    }
    static contrePassation(lignes, libelle) {
        const inversees = lignes.map((l) => {
            const debit = Number(l.debit ?? 0);
            const credit = Number(l.credit ?? 0);
            return credit > 0
                ? { compteId: l.compteId, debit: credit, libelle }
                : { compteId: l.compteId, credit: debit, libelle };
        });
        return [...inversees.filter((l) => l.debit !== undefined), ...inversees.filter((l) => l.debit === undefined)];
    }
    static exercicePosterieur(cible, constatation) {
        return cible.dateDebut.getTime() > constatation.dateDebut.getTime();
    }
    async reprendre(tenantId, createdBy, regularisationId, exerciceCibleId) {
        const regul = await this.prisma.regularisation.findFirst({
            where: { id: regularisationId, tenantId },
            include: { compteChargeProduit: true, compteDiffere: true, ecritureConstatation: true },
        });
        if (!regul)
            throw new common_1.NotFoundException('Régularisation introuvable pour ce dossier');
        if (regul.ecritureRepriseId) {
            throw new common_1.ConflictException('Cette régularisation a déjà été reprise.');
        }
        if (!regul.ecritureConstatationId) {
            throw new common_1.BadRequestException("La constatation n'a pas été passée : il n'y a rien à reprendre.");
        }
        const cible = await this.prisma.exercice.findFirst({ where: { id: exerciceCibleId, tenantId } });
        if (!cible)
            throw new common_1.BadRequestException('Exercice de reprise introuvable pour ce dossier');
        if (cible.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice de reprise est clôturé.");
        }
        const constatation = await this.prisma.exercice.findFirst({
            where: { id: regul.exerciceId, tenantId },
            select: { dateDebut: true },
        });
        if (!constatation)
            throw new common_1.NotFoundException('Exercice de la constatation introuvable.');
        if (!RegularisationService_1.exercicePosterieur(cible, constatation)) {
            throw new common_1.BadRequestException("La reprise se fait sur un exercice ULTÉRIEUR à celui de la constatation, jamais sur le même ni sur un antérieur.");
        }
        const journal = await this.journalAccueil(tenantId);
        const montant = Number(regul.montantDiffere);
        const constatationDebiteLaGestion = RegularisationService_1.debiteLeCompteDeGestion(regul.type);
        const lignesConstatation = RegularisationService_1.estRattachement(regul.type)
            ? (await this.prisma.ecriture.findFirst({
                where: { id: regul.ecritureConstatationId, tenantId },
                select: { lignes: { select: { compteId: true, debit: true, credit: true } } },
            }))?.lignes ?? null
            : null;
        const lignes = lignesConstatation
            ? RegularisationService_1.contrePassation(lignesConstatation, regul.libelle)
            : constatationDebiteLaGestion
                ? [
                    { compteId: regul.compteDifferId, debit: montant, libelle: regul.libelle },
                    { compteId: regul.compteChargeProduitId, credit: montant, libelle: regul.libelle },
                ]
                : [
                    { compteId: regul.compteChargeProduitId, debit: montant, libelle: regul.libelle },
                    { compteId: regul.compteDifferId, credit: montant, libelle: regul.libelle },
                ];
        const ecriture = await this.ecritureService.creer(tenantId, createdBy, {
            exerciceId: cible.id,
            journalId: journal.id,
            date: dateReprise(regul.type, cible).toISOString().slice(0, 10),
            libelle: `Reprise de régularisation · ${regul.libelle}`,
            reference: 'REGUL',
            lignes,
        });
        const { count } = await this.prisma.regularisation.updateMany({
            where: { id: regularisationId, tenantId, ecritureRepriseId: null },
            data: { ecritureRepriseId: ecriture.id },
        });
        if (count === 0) {
            await this.ecritureService.retirerCompensation(tenantId, ecriture.id);
            throw new common_1.BadRequestException('Cette régularisation vient d’être reprise par une autre demande · rien n’a été passé.');
        }
        return this.prisma.regularisation.findFirstOrThrow({
            where: { id: regularisationId, tenantId },
            include: {
                compteChargeProduit: { select: { numero: true, intitule: true } },
                compteDiffere: { select: { numero: true, intitule: true } },
                ecritureReprise: { select: { id: true, numeroPiece: true, date: true } },
            },
        });
    }
    static echeancesDe(dateDebut, dateFin, periodicite) {
        const mois = {
            [client_1.PeriodiciteAbonnement.MENSUELLE]: 1,
            [client_1.PeriodiciteAbonnement.TRIMESTRIELLE]: 3,
            [client_1.PeriodiciteAbonnement.SEMESTRIELLE]: 6,
            [client_1.PeriodiciteAbonnement.ANNUELLE]: 12,
        }[periodicite];
        const dates = [];
        for (let rang = 0; dates.length < 600; rang++) {
            const echeance = (0, ajouter_mois_1.ajouterMois)(dateDebut, rang * mois);
            if (echeance > dateFin)
                break;
            dates.push(echeance);
        }
        return dates;
    }
    async listerAbonnements(tenantId) {
        return this.prisma.modeleAbonnement.findMany({
            where: { tenantId },
            orderBy: { code: 'asc' },
            include: {
                journal: { select: { code: true, intitule: true } },
                compteDebit: { select: { numero: true, intitule: true } },
                compteCredit: { select: { numero: true, intitule: true } },
                echeances: { orderBy: { date: 'asc' }, select: { id: true, date: true, montant: true, ecritureId: true } },
            },
        });
    }
    async creerAbonnement(tenantId, createdBy, dto) {
        const existant = await this.prisma.modeleAbonnement.findFirst({ where: { tenantId, code: dto.code } });
        if (existant)
            throw new common_1.ConflictException(`Un abonnement porte déjà le code ${dto.code}`);
        const dateDebut = new Date(dto.dateDebut);
        const dateFin = new Date(dto.dateFin);
        if (dateFin < dateDebut)
            throw new common_1.BadRequestException('La fin du contrat précède son début.');
        const [journal, debit, credit, tenant] = await Promise.all([
            this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteDebitId, tenantId } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteCreditId, tenantId } }),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
        ]);
        if (!journal)
            throw new common_1.BadRequestException('Journal introuvable pour ce dossier');
        if (!debit || !credit)
            throw new common_1.BadRequestException('Compte introuvable pour ce dossier');
        if (debit.id === credit.id) {
            throw new common_1.BadRequestException("Le compte débité et le compte crédité ne peuvent pas être le même.");
        }
        const estCharge = debit.numero.startsWith('6') || debit.numero.startsWith('8');
        const estTresorerie = credit.numero.startsWith('5') && !credit.numero.startsWith('59');
        if (estCharge && estTresorerie) {
            throw new common_1.BadRequestException(`Un abonnement ne peut pas solder une charge (${debit.numero}) directement sur la trésorerie ` +
                `(${credit.numero}). Une charge se constate d'abord contre le TIERS à qui elle est due : créditez le ` +
                `compte fournisseur (40), personnel (42), organismes sociaux (43) ou État (44) concerné. Le règlement ` +
                `se saisira ensuite, à sa date réelle, en débitant ce tiers par le crédit de la trésorerie. ` +
                (tenant.referentiel === client_1.Referentiel.SYSCOHADA
                    ? `AUDCIF, art. 17, 3° et 5° (justification et imputation des écritures) · Titre VII, COMPTE 40 ` +
                        `« Fournisseurs et comptes rattachés », auquel se rattachent toutes les opérations le concernant.`
                    : `SYCEBNL, Partie 3, ch. 3, § 2.2 et 2.4.`));
        }
        const motifPersonnalise = (0, comptes_proposes_1.motifComptesNonPersonnalises)(await (0, comptes_proposes_1.comptesNonPersonnalises)(this.prisma, tenantId, [debit.id, credit.id]), 'un abonnement');
        if (motifPersonnalise)
            throw new common_1.BadRequestException(motifPersonnalise);
        const dates = RegularisationService_1.echeancesDe(dateDebut, dateFin, dto.periodicite);
        if (dates.length === 0) {
            throw new common_1.BadRequestException('Le contrat ne produit aucune échéance sur la période indiquée.');
        }
        return this.prisma.modeleAbonnement.create({
            data: {
                tenantId,
                code: dto.code,
                intitule: dto.intitule,
                journalId: journal.id,
                compteDebitId: debit.id,
                compteCreditId: credit.id,
                periodicite: dto.periodicite,
                dateDebut,
                dateFin,
                montant: new client_1.Prisma.Decimal(dto.montant),
                createdBy,
                echeances: {
                    create: dates.map((d) => ({ date: d, montant: new client_1.Prisma.Decimal(dto.montant) })),
                },
            },
            include: { echeances: { orderBy: { date: 'asc' } } },
        });
    }
    async modifierAbonnement(tenantId, abonnementId, dto) {
        const abonnement = await this.prisma.modeleAbonnement.findFirst({ where: { id: abonnementId, tenantId } });
        if (!abonnement)
            throw new common_1.NotFoundException('Abonnement introuvable pour ce dossier');
        return this.prisma.modeleAbonnement.update({ where: { id: abonnementId }, data: dto });
    }
    async supprimerAbonnement(tenantId, abonnementId) {
        const abonnement = await this.prisma.modeleAbonnement.findFirst({
            where: { id: abonnementId, tenantId },
            include: { echeances: { where: { ecritureId: { not: null } } } },
        });
        if (!abonnement)
            throw new common_1.NotFoundException('Abonnement introuvable pour ce dossier');
        if (abonnement.echeances.length > 0) {
            throw new common_1.BadRequestException(`${abonnement.echeances.length} échéance(s) ont déjà produit une écriture : l'abonnement ne peut plus être ` +
                'supprimé. Mettez-le en sommeil.');
        }
        await this.prisma.modeleAbonnement.delete({ where: { id: abonnementId } });
        return { supprime: true };
    }
    async genererEcritures(tenantId, createdBy, abonnementId, dto) {
        const abonnement = await this.prisma.modeleAbonnement.findFirst({
            where: { id: abonnementId, tenantId },
            include: { echeances: { where: { ecritureId: null }, orderBy: { date: 'asc' } } },
        });
        if (!abonnement)
            throw new common_1.NotFoundException('Abonnement introuvable pour ce dossier');
        if (!abonnement.estActif)
            throw new common_1.BadRequestException('Cet abonnement est en sommeil.');
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé.");
        }
        const jusquA = new Date(dto.jusquA);
        const aGenerer = abonnement.echeances.filter((e) => e.date <= jusquA && e.date >= exercice.dateDebut && e.date <= exercice.dateFin);
        const generees = [];
        for (const echeance of aGenerer) {
            const montant = Number(echeance.montant);
            const ecriture = await this.ecritureService.creer(tenantId, createdBy, {
                exerciceId: exercice.id,
                journalId: abonnement.journalId,
                date: echeance.date.toISOString().slice(0, 10),
                libelle: `${abonnement.intitule} · échéance du ${echeance.date.toISOString().slice(0, 10)}`,
                reference: abonnement.code,
                lignes: [
                    { compteId: abonnement.compteDebitId, debit: montant, libelle: abonnement.intitule },
                    { compteId: abonnement.compteCreditId, credit: montant, libelle: abonnement.intitule },
                ],
            });
            const { count } = await this.prisma.echeanceAbonnement.updateMany({
                where: { id: echeance.id, ecritureId: null },
                data: { ecritureId: ecriture.id },
            });
            if (count === 0) {
                await this.ecritureService.retirerCompensation(tenantId, ecriture.id);
                continue;
            }
            generees.push({
                echeanceId: echeance.id,
                ecritureId: ecriture.id,
                date: echeance.date.toISOString().slice(0, 10),
            });
        }
        return {
            generees: generees.length,
            restantes: abonnement.echeances.length - generees.length,
            detail: generees,
        };
    }
    async journalAccueil(tenantId, journalId) {
        const journaux = await this.prisma.journal.findMany({ where: { tenantId } });
        const journal = journalId
            ? journaux.find((j) => j.id === journalId)
            : (journaux.find((j) => j.code === 'OD') ?? journaux.find((j) => j.type === 'GENERAL'));
        if (!journal) {
            throw new common_1.BadRequestException("Aucun journal d'accueil : créez un journal général (code OD) ou indiquez le journal à utiliser.");
        }
        return journal;
    }
};
exports.RegularisationService = RegularisationService;
exports.RegularisationService = RegularisationService = RegularisationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], RegularisationService);
//# sourceMappingURL=regularisation.service.js.map