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
exports.TenantService = void 0;
const faits_declares_1 = require("./faits-declares");
const common_1 = require("@nestjs/common");
const reponse_referentiel_1 = require("../../common/reponse-referentiel");
const prisma_service_1 = require("../../common/prisma.service");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const mentions_societe_1 = require("./mentions-societe");
const forme_applicable_1 = require("./forme-applicable");
const code_activite_principale_1 = require("./code-activite-principale");
const correspondance_notes_syscohada_3_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada-3");
const date_effacable_1 = require("./date-effacable");
const echeance_1 = require("../../common/echeance");
const portefeuille_etat_1 = require("../exercice/portefeuille-etat");
const modules_optionnels_1 = require("./modules-optionnels");
const client_1 = require("@prisma/client");
let TenantService = class TenantService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async creerTenant(params, client = this.prisma) {
        return client.tenant.create({
            data: {
                ...(params.id ? { id: params.id } : {}),
                nom: params.nom,
                referentiel: params.referentiel,
                jeuEtatsFinanciersSycebnl: params.jeuEtatsFinanciersSycebnl,
                systemeComptableSyscohada: params.systemeComptableSyscohada,
                activite: params.activite,
                adresse: params.adresse,
                ville: params.ville,
                pays: params.pays,
                telephone: params.telephone,
                licence: {
                    create: {
                        type: params.typeLicence,
                        dateExpiration: params.dateExpiration,
                    },
                },
            },
            include: { licence: true },
        });
    }
    async demarrage(tenantId) {
        const [tenant, exercices, journaux, tiers, ecritures] = await Promise.all([
            this.prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { modulesActives: true, licence: { select: { type: true } } },
            }),
            this.prisma.exercice.count({ where: { tenantId } }),
            this.prisma.journal.count({ where: { tenantId } }),
            this.prisma.tiers.count({ where: { tenantId } }),
            this.prisma.ecriture.count({ where: { tenantId } }),
        ]);
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        return { exercices, journaux, tiers, ecritures, modulesActives: (0, modules_optionnels_1.modulesServis)(tenant.modulesActives, tenant.licence?.type) };
    }
    async parametres(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { licence: { select: { type: true } } },
        });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        const nombreEcritures = await this.prisma.ecriture.count({ where: { tenantId } });
        const { plancher: longueurCompteMinimale, exemple: longueurCompteExemple } = await this.plancherLongueurCompte(tenantId);
        return {
            id: tenant.id,
            nom: tenant.nom,
            referentiel: tenant.referentiel,
            jeuEtatsFinanciersSycebnl: (0, reponse_referentiel_1.siSycebnl)(tenant.referentiel, tenant.jeuEtatsFinanciersSycebnl),
            systemeComptableSyscohada: tenant.systemeComptableSyscohada,
            activite: tenant.activite,
            codeActivitePrincipale: tenant.codeActivitePrincipale,
            avertissementCodeActivitePrincipale: (0, code_activite_principale_1.avertissementCodeActivite)(tenant.codeActivitePrincipale),
            groupesActivites: tenant.referentiel === client_1.Referentiel.SYSCOHADA ? correspondance_notes_syscohada_3_1.GROUPES_ACTIVITES_SYSCOHADA : [],
            adresse: tenant.adresse,
            ville: tenant.ville,
            pays: tenant.pays,
            telephone: tenant.telephone,
            email: tenant.email,
            siteWeb: tenant.siteWeb,
            capitalSocial: tenant.capitalSocial === null ? null : Number(tenant.capitalSocial),
            capitalVariable: tenant.capitalVariable,
            mentionsSociete: (0, mentions_societe_1.mentionsEmetteur)((0, mentions_societe_1.identiteSociete)(tenant)),
            devise: tenant.devise ?? monnaie_de_tenue_1.MONNAIE_DE_TENUE,
            deviseFonctionnelle: tenant.deviseFonctionnelle,
            numeroImpot: tenant.numeroImpot,
            idNat: tenant.idNat,
            rccm: tenant.rccm,
            numeroDeclarationActivite: tenant.numeroDeclarationActivite,
            locataireGerantFonds: tenant.locataireGerantFonds,
            numeroRegistreCooperatives: tenant.numeroRegistreCooperatives,
            varianteCooperative: tenant.varianteCooperative,
            modeAdministrationSa: tenant.modeAdministrationSa,
            associeUnique: tenant.associeUnique,
            entreprisePortefeuilleEtat: tenant.entreprisePortefeuilleEtat,
            dateDissolution: tenant.dateDissolution,
            liquidateurs: tenant.liquidateurs,
            dateNominationLiquidateur: tenant.dateNominationLiquidateur,
            regimeLiquidation: tenant.regimeLiquidation,
            associeUniquePersonneMorale: tenant.associeUniquePersonneMorale,
            dateClotureLiquidation: tenant.dateClotureLiquidation,
            dateDeclarationCotisationActivite: tenant.dateDeclarationCotisationActivite,
            dateDeclarationCotisationLiquidation: tenant.dateDeclarationCotisationLiquidation,
            portefeuilleSecteurMinier: tenant.portefeuilleSecteurMinier,
            quotePartEtatCapital: tenant.quotePartEtatCapital === null ? null : Number(tenant.quotePartEtatCapital),
            sourceQuotePartEtat: tenant.sourceQuotePartEtat,
            formeJuridiqueSyscohadaAnterieure: tenant.formeJuridiqueSyscohadaAnterieure,
            dateTransformationForme: tenant.dateTransformationForme,
            actePersonnaliteJuridique: tenant.actePersonnaliteJuridique,
            dateActePersonnalite: tenant.dateActePersonnalite,
            numeroEnregistrementSecteur: tenant.numeroEnregistrementSecteur,
            certificatEnregistrementPlan: tenant.certificatEnregistrementPlan,
            doubleRegardValidation: tenant.doubleRegardValidation,
            refusClotureJournalNonImprime: tenant.refusClotureJournalNonImprime,
            creationCompteEnSaisie: tenant.creationCompteEnSaisie,
            seuilEcartReglement: tenant.seuilEcartReglement === null ? null : Number(tenant.seuilEcartReglement),
            attestationExemptionIs: tenant.attestationExemptionIs,
            dateAttestationExemptionIs: tenant.dateAttestationExemptionIs,
            formeJuridique: (0, reponse_referentiel_1.siSycebnl)(tenant.referentiel, tenant.formeJuridique),
            formeJuridiqueSyscohada: tenant.formeJuridiqueSyscohada,
            droitEtranger: (0, reponse_referentiel_1.siSycebnl)(tenant.referentiel, tenant.droitEtranger),
            longueurCompte: tenant.longueurCompte,
            longueurCompteMinimale,
            longueurCompteExemple,
            assujettiTva: tenant.assujettiTva,
            assujettissementTva: (0, faits_declares_1.faitAssujettissementTva)(tenant),
            venteBiensServices: tenant.venteBiensServices,
            modulesActives: (0, modules_optionnels_1.modulesServis)(tenant.modulesActives, tenant.licence?.type),
            dateOptionTva: tenant.dateOptionTva,
            regimeExigibiliteTva: tenant.regimeExigibiliteTva,
            dateAutorisationDebitsTva: tenant.dateAutorisationDebitsTva,
            effectifPermanent: tenant.effectifPermanent,
            numeroAffiliationCnssEmployeur: tenant.numeroAffiliationCnssEmployeur,
            methodeCotisations: (0, reponse_referentiel_1.siSycebnl)(tenant.referentiel, tenant.methodeCotisations),
            methodeInventaireStocks: tenant.methodeInventaireStocks,
            nombreEcritures,
        };
    }
    async modifierJeuEtatsFinanciers(tenantId, jeu) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        if (tenant.referentiel !== client_1.Referentiel.SYCEBNL) {
            throw new common_1.BadRequestException("Le jeu d'états financiers ne concerne que les dossiers tenus en référentiel SYCEBNL");
        }
        if (tenant.jeuEtatsFinanciersSycebnl !== jeu) {
            const nombreEcritures = await this.prisma.ecriture.count({ where: { tenantId } });
            if (nombreEcritures > 0) {
                throw new common_1.BadRequestException(`Ce dossier porte déjà ${nombreEcritures} écriture(s) : le jeu d'états financiers ne peut plus être changé. Créez un nouveau dossier pour l'autre type d'entité.`);
            }
        }
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { jeuEtatsFinanciersSycebnl: jeu },
        });
        return this.parametres(tenantId);
    }
    async modifierSystemeSyscohada(tenantId, systeme) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { _count: { select: { cellules: true } } },
        });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        if (tenant.referentiel !== client_1.Referentiel.SYSCOHADA) {
            throw new common_1.BadRequestException('Le système comptable normal / minimal de trésorerie ne concerne que les dossiers tenus en SYSCOHADA');
        }
        if (tenant.systemeComptableSyscohada !== systeme) {
            if (tenant.dossierMereId !== null) {
                throw new common_1.BadRequestException('Ce dossier est une cellule · il tient le système comptable de son siège. Détachez-le du groupe pour en changer.');
            }
            if (tenant._count.cellules > 0) {
                throw new common_1.BadRequestException(`Ce dossier est le siège de ${tenant._count.cellules} cellule(s) · elles tiennent son système comptable, le changer les désaccorderait. Détachez-les d'abord.`);
            }
            const nombreEcritures = await this.prisma.ecriture.count({ where: { tenantId } });
            if (nombreEcritures > 0) {
                throw new common_1.BadRequestException(`Ce dossier porte déjà ${nombreEcritures} écriture(s) : le système comptable ne peut plus être changé. Créez un nouveau dossier pour l'autre système.`);
            }
        }
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { systemeComptableSyscohada: systeme },
        });
        return this.parametres(tenantId);
    }
    async modifierCoordonnees(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        if ((dto.capitalSocial !== undefined && dto.capitalSocial !== null) || dto.capitalVariable === true) {
            const motif = (0, mentions_societe_1.motifRefusCapital)(tenant.referentiel, tenant.formeJuridiqueSyscohada);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        if (dto.capitalVariable === true) {
            const motif = (0, mentions_societe_1.motifRefusCapitalVariable)(tenant.formeJuridiqueSyscohada);
            if (motif)
                throw new common_1.BadRequestException(motif);
        }
        const codeActivite = (0, code_activite_principale_1.normaliserCodeActivite)(dto.codeActivitePrincipale);
        const motifCode = (0, code_activite_principale_1.motifRefusCodeActivite)(tenant.referentiel, codeActivite);
        if (motifCode)
            throw new common_1.BadRequestException(motifCode);
        const fonctionnelle = dto.deviseFonctionnelle === null ? '' : dto.deviseFonctionnelle?.trim().toUpperCase();
        if (fonctionnelle) {
            if (fonctionnelle === monnaie_de_tenue_1.MONNAIE_DE_TENUE) {
                throw new common_1.BadRequestException(`La monnaie fonctionnelle ne peut pas être ${monnaie_de_tenue_1.MONNAIE_DE_TENUE} : c'est déjà la monnaie de tenue, ` +
                    'et le second jeu de documents ferait double emploi avec le jeu légal.');
            }
            const connue = await this.prisma.devise.findFirst({
                where: { tenantId, code: fonctionnelle, estActive: true },
                select: { id: true },
            });
            if (!connue) {
                throw new common_1.BadRequestException(`La devise ${fonctionnelle} n’est pas ouverte dans ce dossier. Ouvrez-la d’abord dans ` +
                    'Structure > Devises et cours, avec ses cours, avant d’en faire la monnaie fonctionnelle.');
            }
        }
        const normaliser = (v) => v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim();
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                nom: dto.nom === undefined ? undefined : dto.nom.trim(),
                activite: normaliser(dto.activite),
                codeActivitePrincipale: codeActivite,
                adresse: normaliser(dto.adresse),
                ville: normaliser(dto.ville),
                pays: normaliser(dto.pays),
                telephone: normaliser(dto.telephone),
                email: normaliser(dto.email),
                siteWeb: normaliser(dto.siteWeb),
                capitalSocial: dto.capitalSocial === undefined ? undefined : dto.capitalSocial === null ? null : new client_1.Prisma.Decimal(dto.capitalSocial),
                capitalVariable: dto.capitalVariable,
                deviseFonctionnelle: fonctionnelle === undefined ? undefined : fonctionnelle === '' ? null : fonctionnelle,
            },
        });
        return this.parametres(tenantId);
    }
    async modifierIdentite(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        const normaliser = (v) => v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim();
        const renseigne = (v) => typeof v === 'string' && v.trim() !== '';
        if (tenant.referentiel === client_1.Referentiel.SYCEBNL && renseigne(dto.rccm)) {
            throw new common_1.BadRequestException("Une entité à but non lucratif n'est pas commerçante : elle n'est pas immatriculée au registre du commerce " +
                "et du crédit mobilier, qui immatricule les commerçants, les sociétés commerciales, les GIE et les " +
                'succursales (AUDCG, art. 2 et art. 35, 1°).');
        }
        const entreprenant = tenant.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.ENTREPRENANT;
        if (entreprenant && renseigne(dto.rccm)) {
            throw new common_1.BadRequestException("L'entreprenant n'est pas immatriculé au RCCM (AUDCG art. 64) · son numéro est celui de sa déclaration d'activité (art. 62).");
        }
        if ((!entreprenant || tenant.referentiel !== client_1.Referentiel.SYSCOHADA) && renseigne(dto.numeroDeclarationActivite)) {
            throw new common_1.BadRequestException("Le numéro de déclaration d'activité est celui de l'entreprenant (AUDCG art. 62) · une personne immatriculée porte son RCCM.");
        }
        const cooperative = tenant.referentiel === client_1.Referentiel.SYSCOHADA &&
            tenant.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE;
        if (cooperative && renseigne(dto.rccm)) {
            throw new common_1.BadRequestException("La coopérative est immatriculée au Registre des Sociétés Coopératives (AUSCOOP art. 74), et « aucune société coopérative ne peut être immatriculée à plusieurs registres » (art. 77 al. 1) · saisissez ce numéro-là, pas un RCCM.");
        }
        if (!cooperative &&
            (renseigne(dto.numeroRegistreCooperatives) ||
                (dto.varianteCooperative !== undefined && dto.varianteCooperative !== 'PAS_ENCORE_DIT'))) {
            throw new common_1.BadRequestException('Le Registre des Sociétés Coopératives et la variante SCOOPS ou COOP-CA sont propres à la société coopérative (AUSCOOP).');
        }
        if (dto.locataireGerantFonds === 'OUI' && (entreprenant || tenant.referentiel !== client_1.Referentiel.SYSCOHADA)) {
            throw new common_1.BadRequestException(entreprenant
                ? "L'entreprenant ne peut être partie à un contrat de location-gérance (AUDCG art. 138)."
                : "La location-gérance d'un fonds de commerce (AUDCG art. 138 à 140) ne concerne pas une entité à but non lucratif.");
        }
        const forme = tenant.formeJuridiqueSyscohada;
        if (dto.modeAdministrationSa !== undefined &&
            dto.modeAdministrationSa !== 'PAS_ENCORE_DIT' &&
            forme !== client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME) {
            throw new common_1.BadRequestException('Le mode d’administration (conseil d’administration ou administrateur général) est celui de la société ' +
                'anonyme (AUSCGIE art. 386 et 414) · la SAS en est exclue par l’art. 853-3.');
        }
        if (dto.associeUnique !== undefined &&
            dto.associeUnique !== 'PAS_ENCORE_DIT' &&
            !(forme && mentions_societe_1.FORMES_A_ASSOCIE_UNIQUE_DECLARE.includes(forme))) {
            throw new common_1.BadRequestException('L’associé ou actionnaire unique se déclare pour une SARL, une SA ou une SAS (AUSCGIE art. 309, 385 et 853-2) · ' +
                'cette forme n’en a pas.');
        }
        const societeCommerciale = !!forme && mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(forme);
        if (dto.entreprisePortefeuilleEtat === 'OUI' && (tenant.referentiel !== client_1.Referentiel.SYSCOHADA || !societeCommerciale)) {
            throw new common_1.BadRequestException('Le portefeuille de l’État regroupe des sociétés · « toute société dans laquelle l’État ou toute personne ' +
                'morale de droit public détient la totalité des actions ou une participation » (loi n° 08/010, art. 3) · ' +
                'seules les cinq sociétés commerciales (SA, SAS, SARL, SNC, SCS) se déclarent.');
        }
        const dissolution = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateDissolution);
        if ((dissolution || renseigne(dto.liquidateurs)) && !cooperative && !(forme && mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(forme))) {
            throw new common_1.BadRequestException('La mention « société en liquidation » et le nom des liquidateurs sont ceux d’une société commerciale ' +
                '(AUSCGIE art. 203 et 204) ou d’une coopérative (AUSCOOP art. 183) · aucun texte lu ne les étend à cette forme.');
        }
        const nomination = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateNominationLiquidateur);
        if (!(societeCommerciale || cooperative) &&
            (nomination || (dto.regimeLiquidation !== undefined && dto.regimeLiquidation !== 'PAS_ENCORE_DIT'))) {
            throw new common_1.BadRequestException('La nomination du liquidateur et le régime de la liquidation sont ceux d’une société commerciale (AUSCGIE ' +
                'art. 203 et 223) ou d’une coopérative (AUSCOOP art. 182, 185 et 196).');
        }
        if (!societeCommerciale && (dto.associeUniquePersonneMorale === 'OUI' || dto.associeUniquePersonneMorale === 'NON')) {
            throw new common_1.BadRequestException('L’associé unique personne morale est celui d’une société commerciale (AUSCGIE art. 201 al. 4).');
        }
        const associePmApres = dto.associeUniquePersonneMorale === undefined
            ? tenant.associeUniquePersonneMorale
            : dto.associeUniquePersonneMorale === 'OUI'
                ? true
                : dto.associeUniquePersonneMorale === 'NON'
                    ? false
                    : null;
        const dissolutionApres = dissolution === undefined ? tenant.dateDissolution : dissolution;
        if (dissolution !== undefined &&
            tenant.dateDissolution &&
            (dissolutionApres?.getTime() ?? null) !== tenant.dateDissolution.getTime() &&
            !(tenant.dateDissolution.getUTCMonth() === 11 && tenant.dateDissolution.getUTCDate() === 31)) {
            const arrete = await this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: tenant.dateDissolution },
                select: { dateDebut: true, dateFin: true },
            });
            if (arrete) {
                throw new common_1.BadRequestException(`L'exercice du ${(0, portefeuille_etat_1.jourFr)(arrete.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(arrete.dateFin)} est arrêté à la dissolution du ` +
                    `${(0, portefeuille_etat_1.jourFr)(tenant.dateDissolution)} · annulez d'abord l'arrêt (fenêtre Exercices, « Annuler l'arrêt »), puis ` +
                    'modifiez la date de dissolution.');
            }
        }
        const nominationApres = nomination === undefined ? tenant.dateNominationLiquidateur : nomination;
        const regimeApres = dto.regimeLiquidation === undefined
            ? tenant.regimeLiquidation
            : dto.regimeLiquidation === 'PAS_ENCORE_DIT'
                ? null
                : dto.regimeLiquidation;
        const regimeAuscgie = !!regimeApres && regimeApres !== client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE;
        if (societeCommerciale && associePmApres === true && (nominationApres || regimeAuscgie)) {
            throw new common_1.BadRequestException('La dissolution d’une société dont tous les titres sont détenus par un seul associé personne morale ' +
                'entraîne la transmission universelle du patrimoine à cet associé, « sans qu’il y ait lieu à ' +
                'liquidation » (AUSCGIE art. 201 al. 4) · la dissolution se déclare, mais ni nomination de liquidateur ' +
                'ni liquidation amiable ou judiciaire. Seule la liquidation des biens prononcée dans une procédure ' +
                'collective reste possible (AUSCGIE art. 200, 6° et 203 al. 2 ; AUPCAP art. 53).');
        }
        if ((societeCommerciale || cooperative) && nominationApres && dissolutionApres && nominationApres < dissolutionApres) {
            throw new common_1.BadRequestException('Le liquidateur est nommé une fois la société dissoute · « La société est en liquidation dès l’instant ' +
                'de sa dissolution » (AUSCGIE art. 204).');
        }
        const aujourdHui = (0, echeance_1.jourDeKinshasa)(new Date());
        if (nomination && nomination > aujourdHui) {
            throw new common_1.BadRequestException('Une nomination à venir ne se déclare pas · déclarez-la une fois intervenue.');
        }
        if (dissolution && dissolution > aujourdHui) {
            throw new common_1.BadRequestException('« La société est en liquidation dès l’instant de sa dissolution » (AUSCGIE art. 204) · une dissolution à ' +
                'venir ne se déclare pas.');
        }
        const clotureL = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateClotureLiquidation);
        const declActivite = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateDeclarationCotisationActivite);
        const declLiquidation = (0, date_effacable_1.jourSaisiOuEffacement)(dto.dateDeclarationCotisationLiquidation);
        const clotureApres = clotureL === undefined ? tenant.dateClotureLiquidation : clotureL;
        const declActiviteApres = declActivite === undefined ? tenant.dateDeclarationCotisationActivite : declActivite;
        const declLiquidationApres = declLiquidation === undefined ? tenant.dateDeclarationCotisationLiquidation : declLiquidation;
        if ((clotureL || declActivite || declLiquidation) && !(societeCommerciale || cooperative)) {
            throw new common_1.BadRequestException('La clôture de la liquidation et les cotisations spéciales de la dissolution se déclarent pour une société ' +
                'commerciale ou une coopérative (AUSCGIE art. 216 ; AUSCOOP art. 191 ; loi n° 23/053, art. 3 et 13).');
        }
        for (const [date, quoi] of [
            [clotureL, 'Une clôture de liquidation à venir ne se déclare pas · déclarez-la une fois intervenue.'],
            [declActivite, 'Une déclaration à venir ne se déclare pas · déclarez-la une fois déposée.'],
            [declLiquidation, 'Une déclaration à venir ne se déclare pas · déclarez-la une fois déposée.'],
        ]) {
            if (date && date > aujourdHui)
                throw new common_1.BadRequestException(quoi);
        }
        if ((clotureApres || declActiviteApres || declLiquidationApres) && !dissolutionApres) {
            throw new common_1.BadRequestException('Déclarez d’abord la date de dissolution · la clôture de la liquidation et les cotisations spéciales la suivent.');
        }
        if (dissolutionApres) {
            for (const [date, quoi] of [
                [clotureApres, 'La clôture de la liquidation'],
                [declActiviteApres, 'La déclaration de la cotisation spéciale de la période d’activité'],
            ]) {
                if (date && date < dissolutionApres) {
                    throw new common_1.BadRequestException(`${quoi} ne peut pas précéder la dissolution du ${(0, portefeuille_etat_1.jourFr)(dissolutionApres)}.`);
                }
            }
        }
        if ((clotureApres || declLiquidationApres) && associePmApres === true && regimeApres !== client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE) {
            throw new common_1.BadRequestException('Sans liquidation, il n’y a ni clôture de liquidation ni dernier bilan de liquidation · la dissolution d’une ' +
                'société dont tous les titres sont détenus par un seul associé personne morale se fait « sans qu’il y ait ' +
                'lieu à liquidation » (AUSCGIE art. 201 al. 4).');
        }
        if (declLiquidationApres && !clotureApres) {
            throw new common_1.BadRequestException('La cotisation spéciale du dernier bilan de liquidation se déclare après la clôture · déclarez d’abord la date ' +
                'de clôture de la liquidation.');
        }
        if (declLiquidationApres && clotureApres && declLiquidationApres < clotureApres) {
            throw new common_1.BadRequestException(`La cotisation spéciale du dernier bilan de liquidation se déclare après la clôture du ${(0, portefeuille_etat_1.jourFr)(clotureApres)}.`);
        }
        const portefeuilleApres = dto.entreprisePortefeuilleEtat === undefined
            ? tenant.entreprisePortefeuilleEtat
            : dto.entreprisePortefeuilleEtat === 'OUI'
                ? true
                : dto.entreprisePortefeuilleEtat === 'NON'
                    ? false
                    : null;
        const secteurDeclare = dto.portefeuilleSecteurMinier === 'OUI' || dto.portefeuilleSecteurMinier === 'NON';
        const quoteDeclaree = dto.quotePartEtatCapital !== undefined && dto.quotePartEtatCapital !== null;
        if ((secteurDeclare || quoteDeclaree) && portefeuilleApres !== true) {
            throw new common_1.BadRequestException('Le secteur minier et la quote-part de l’État se déclarent pour une entreprise du portefeuille de l’État · ' +
                'déclarez d’abord cette qualité.');
        }
        const quoteApres = dto.quotePartEtatCapital === undefined
            ? tenant.quotePartEtatCapital === null || tenant.quotePartEtatCapital === undefined
                ? null
                : Number(tenant.quotePartEtatCapital)
            : dto.quotePartEtatCapital;
        const sourceSaisie = dto.sourceQuotePartEtat === undefined ? undefined : normaliser(dto.sourceQuotePartEtat);
        if (quoteApres === null && sourceSaisie) {
            throw new common_1.BadRequestException('La source se déclare avec la quote-part de l’État qu’elle établit · déclarez d’abord la quote-part, ou ' +
                'laissez la source vide.');
        }
        const sourceApres = quoteApres === null ? null : sourceSaisie === undefined ? tenant.sourceQuotePartEtat : sourceSaisie;
        if (quoteApres !== null && !(sourceApres && sourceApres.trim())) {
            throw new common_1.BadRequestException('La quote-part de l’État dans le capital se déclare avec sa source (statuts, registre des titres, arrêté de ' +
                'cession) · elle fait le montant du dividende prioritaire.');
        }
        if (tenant.referentiel === client_1.Referentiel.SYSCOHADA) {
            const propresAuxEbnl = [
                ['arrêté de personnalité juridique', dto.actePersonnaliteJuridique],
                ['date de cet arrêté', dto.dateActePersonnalite],
                ["numéro d'enregistrement sectoriel", dto.numeroEnregistrementSecteur],
                ["certificat d'enregistrement du Ministère du Plan", dto.certificatEnregistrementPlan],
                ["attestation d'exemption d'impôt sur les sociétés", dto.attestationExemptionIs],
                ['date de cette attestation', dto.dateAttestationExemptionIs],
            ];
            const fautif = propresAuxEbnl.find(([, v]) => renseigne(v));
            if (fautif) {
                throw new common_1.BadRequestException(`Le champ « ${fautif[0]} » est un identifiant d'entité à but non lucratif (loi n° 004/2001) · une société ` +
                    "commerciale n'en a pas. Son immatriculation est le RCCM.");
            }
        }
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                numeroImpot: normaliser(dto.numeroImpot),
                idNat: normaliser(dto.idNat),
                rccm: normaliser(dto.rccm),
                numeroDeclarationActivite: normaliser(dto.numeroDeclarationActivite),
                ...(dto.locataireGerantFonds === undefined
                    ? {}
                    : { locataireGerantFonds: dto.locataireGerantFonds === 'OUI' ? true : dto.locataireGerantFonds === 'NON' ? false : null }),
                numeroRegistreCooperatives: normaliser(dto.numeroRegistreCooperatives),
                ...(dto.varianteCooperative === undefined
                    ? {}
                    : { varianteCooperative: dto.varianteCooperative === 'PAS_ENCORE_DIT' ? null : dto.varianteCooperative }),
                ...(dto.modeAdministrationSa === undefined
                    ? {}
                    : { modeAdministrationSa: dto.modeAdministrationSa === 'PAS_ENCORE_DIT' ? null : dto.modeAdministrationSa }),
                ...(dto.associeUnique === undefined
                    ? {}
                    : { associeUnique: dto.associeUnique === 'OUI' ? true : dto.associeUnique === 'NON' ? false : null }),
                ...(dto.entreprisePortefeuilleEtat === undefined
                    ? {}
                    : {
                        entreprisePortefeuilleEtat: dto.entreprisePortefeuilleEtat === 'OUI' ? true : dto.entreprisePortefeuilleEtat === 'NON' ? false : null,
                    }),
                dateDissolution: dissolution,
                liquidateurs: normaliser(dto.liquidateurs),
                dateNominationLiquidateur: nomination,
                ...(dto.regimeLiquidation === undefined
                    ? {}
                    : { regimeLiquidation: dto.regimeLiquidation === 'PAS_ENCORE_DIT' ? null : dto.regimeLiquidation }),
                ...(dto.associeUniquePersonneMorale === undefined
                    ? {}
                    : {
                        associeUniquePersonneMorale: dto.associeUniquePersonneMorale === 'OUI' ? true : dto.associeUniquePersonneMorale === 'NON' ? false : null,
                    }),
                dateClotureLiquidation: clotureL,
                dateDeclarationCotisationActivite: declActivite,
                dateDeclarationCotisationLiquidation: declLiquidation,
                ...(dto.portefeuilleSecteurMinier === undefined
                    ? {}
                    : {
                        portefeuilleSecteurMinier: dto.portefeuilleSecteurMinier === 'OUI' ? true : dto.portefeuilleSecteurMinier === 'NON' ? false : null,
                    }),
                ...(dto.quotePartEtatCapital === undefined ? {} : { quotePartEtatCapital: dto.quotePartEtatCapital }),
                ...(dto.quotePartEtatCapital === undefined && dto.sourceQuotePartEtat === undefined
                    ? {}
                    : { sourceQuotePartEtat: sourceApres }),
                actePersonnaliteJuridique: normaliser(dto.actePersonnaliteJuridique),
                dateActePersonnalite: (0, date_effacable_1.dateSaisieOuEffacement)(dto.dateActePersonnalite),
                numeroEnregistrementSecteur: normaliser(dto.numeroEnregistrementSecteur),
                certificatEnregistrementPlan: normaliser(dto.certificatEnregistrementPlan),
                attestationExemptionIs: normaliser(dto.attestationExemptionIs),
                dateAttestationExemptionIs: (0, date_effacable_1.dateSaisieOuEffacement)(dto.dateAttestationExemptionIs),
            },
        });
        return this.parametres(tenantId);
    }
    async modifierFormeJuridique(tenantId, formeJuridique, droitEtranger) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        if (tenant.referentiel !== client_1.Referentiel.SYCEBNL) {
            throw new common_1.BadRequestException('La forme juridique de la loi n° 004/2001 ne concerne que les dossiers tenus en référentiel SYCEBNL. ' +
                "Une société commerciale relève de l'AUSCGIE : utilisez la forme juridique OHADA.");
        }
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { formeJuridique, ...(droitEtranger === undefined ? {} : { droitEtranger }) },
        });
        return this.parametres(tenantId);
    }
    async modifierFormeSyscohada(tenantId, formeJuridiqueSyscohada, dateEffetTransformation) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        if (tenant.referentiel !== client_1.Referentiel.SYSCOHADA) {
            throw new common_1.BadRequestException('La forme juridique OHADA ne concerne que les dossiers tenus en référentiel SYSCOHADA. ' +
                "Une entité à but non lucratif relève de la loi n° 004/2001, pas de l'AUSCGIE.");
        }
        const dateEffet = (0, date_effacable_1.dateSaisieOuEffacement)(dateEffetTransformation);
        let transformation;
        if (dateEffet === null) {
            transformation = { formeJuridiqueSyscohadaAnterieure: null, dateTransformationForme: null };
        }
        else if (dateEffet !== undefined) {
            const motif = (0, forme_applicable_1.motifRefusTransformation)(tenant.formeJuridiqueSyscohada, formeJuridiqueSyscohada, dateEffet, new Date());
            if (motif)
                throw new common_1.BadRequestException(motif);
            transformation = {
                formeJuridiqueSyscohadaAnterieure: tenant.formeJuridiqueSyscohada,
                dateTransformationForme: dateEffet,
            };
        }
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { formeJuridiqueSyscohada, ...(transformation ?? {}) },
        });
        return this.parametres(tenantId);
    }
    async modifierMethodeCotisations(tenantId, methodeCotisations) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        if (tenant.referentiel !== client_1.Referentiel.SYCEBNL) {
            throw new common_1.BadRequestException('Les cotisations et le droit d’entrée relèvent du SYCEBNL (cadre conceptuel § 5.4.2.1) · ' +
                "un dossier d'entreprise n'en a pas.");
        }
        if (tenant.jeuEtatsFinanciersSycebnl !== client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS) {
            throw new common_1.BadRequestException("Les cotisations sont celles des ADHÉRENTS d'une association ou d'un ordre professionnel · " +
                "un projet de développement est financé par un bailleur, il n'appelle pas de cotisation.");
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { methodeCotisations } });
        return this.parametres(tenantId);
    }
    async modifierMethodeInventaireStocks(tenantId, methodeInventaireStocks) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { methodeInventaireStocks },
        });
        return this.parametres(tenantId);
    }
    async plancherLongueurCompte(tenantId) {
        const comptes = await this.prisma.compte.findMany({ where: { tenantId }, select: { numero: true } });
        const plancher = comptes.reduce((max, c) => Math.max(max, c.numero.length), 0);
        return { plancher, exemple: comptes.find((c) => c.numero.length === plancher)?.numero ?? '' };
    }
    async modifierLongueurCompte(tenantId, longueurCompte) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        if (!Number.isInteger(longueurCompte) || longueurCompte < 3 || longueurCompte > 13) {
            throw new common_1.BadRequestException('La longueur des numéros de compte va de 3 à 13 chiffres · c’est la plage des logiciels de la place.');
        }
        const { plancher, exemple } = await this.plancherLongueurCompte(tenantId);
        if (longueurCompte < plancher) {
            throw new common_1.BadRequestException(`Ce dossier porte déjà des numéros de ${plancher} chiffres (par exemple « ${exemple} ») · ` +
                `les ramener à ${longueurCompte} les rendrait invalides rétroactivement, alors qu'ils sont ` +
                'mouvementés et repris dans les états. Supprimez d’abord les comptes plus longs, ou gardez cette longueur.');
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { longueurCompte } });
        return this.parametres(tenantId);
    }
    async modifierModules(tenantId, modulesActives) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { modulesActives: (0, modules_optionnels_1.normaliserModules)(modulesActives) } });
        return this.parametres(tenantId);
    }
    async modifierCreationCompteEnSaisie(tenantId, creationCompteEnSaisie) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { creationCompteEnSaisie } });
        return this.parametres(tenantId);
    }
    async modifierSeuilEcartReglement(tenantId, seuilEcartReglement) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { seuilEcartReglement } });
        return this.parametres(tenantId);
    }
    async modifierRefusClotureNonImprime(tenantId, refusClotureJournalNonImprime) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { refusClotureJournalNonImprime } });
        return this.parametres(tenantId);
    }
    async modifierDoubleRegard(tenantId, doubleRegardValidation) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { doubleRegardValidation } });
        return this.parametres(tenantId);
    }
    async modifierRegime(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.NotFoundException('Dossier introuvable');
        }
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                ...(0, faits_declares_1.donneesAssujettissementTva)(dto.reponseAssujettissementTva, dto.assujettiTva),
                ...(0, faits_declares_1.donneesVenteBiensServices)(dto.venteBiensServices),
                ...(dto.dateOptionTva === undefined ? {} : { dateOptionTva: (0, date_effacable_1.dateSaisieOuEffacement)(dto.dateOptionTva) }),
                ...(dto.effectifPermanent === undefined ? {} : { effectifPermanent: dto.effectifPermanent }),
                ...(dto.numeroAffiliationCnssEmployeur === undefined
                    ? {}
                    : { numeroAffiliationCnssEmployeur: dto.numeroAffiliationCnssEmployeur?.trim() || null }),
                ...(dto.regimeExigibiliteTva === undefined ? {} : { regimeExigibiliteTva: dto.regimeExigibiliteTva }),
                ...(dto.dateAutorisationDebitsTva === undefined
                    ? {}
                    : { dateAutorisationDebitsTva: (0, date_effacable_1.dateSaisieOuEffacement)(dto.dateAutorisationDebitsTva) }),
            },
        });
        return this.parametres(tenantId);
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map