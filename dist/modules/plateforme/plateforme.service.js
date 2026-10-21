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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PlateformeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlateformeService = exports.MOTIF_SUR_SITE_NON_ATTRIBUABLE = void 0;
const common_1 = require("@nestjs/common");
const courrier_service_1 = require("../courrier/courrier.service");
const reinitialisation_admin_1 = require("./reinitialisation-admin");
const courriel_1 = require("../../common/courriel");
const double_authentification_1 = require("../auth/double-authentification");
const verrouillage_1 = require("../auth/verrouillage");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const garnissage_demonstration_service_1 = require("./garnissage-demonstration.service");
const scenario_demonstration_1 = require("./scenario-demonstration");
const modules_optionnels_1 = require("../tenant/modules-optionnels");
const reponse_referentiel_1 = require("../../common/reponse-referentiel");
const prisma_service_1 = require("../../common/prisma.service");
const auth_service_1 = require("../auth/auth.service");
const contexte_cloisonnement_1 = require("../../common/cloisonnement/contexte-cloisonnement");
const bcrypt = require("bcryptjs");
const licence_de_cellule_1 = require("../licence/licence-de-cellule");
const plafond_console_1 = require("./plafond-console");
const date_effacable_1 = require("../tenant/date-effacable");
exports.MOTIF_SUR_SITE_NON_ATTRIBUABLE = 'Licence « Perpétuelle (sur site) » non attribuable à un dossier hébergé · une installation sur site ' +
    'tient sa licence d’un fichier signé, émis dans le cadre « Licences sur site » de la console. Pour une ' +
    'licence sans échéance en ligne, choisir « Perpétuelle (SaaS) ».';
let PlateformeService = PlateformeService_1 = class PlateformeService {
    constructor(prisma, config, authService, garnissage, courrier) {
        this.prisma = prisma;
        this.config = config;
        this.authService = authService;
        this.garnissage = garnissage;
        this.courrier = courrier;
        this.logger = new common_1.Logger(PlateformeService_1.name);
    }
    async onModuleInit() {
        const brut = this.config.get('OPERATEURS_PLATEFORME');
        if (!brut)
            return;
        const emails = brut
            .split(',')
            .map((e) => (0, courriel_1.normaliserCourriel)(e))
            .filter((e) => e.length > 0);
        for (const email of emails) {
            const { count } = await (0, contexte_cloisonnement_1.horsCloisonnement)('démarrage · promotion des opérateurs de la plateforme', () => this.prisma.user.updateMany({
                where: { email, estOperateurPlateforme: false },
                data: { estOperateurPlateforme: true },
            }));
            if (count > 0) {
                this.logger.log(`Opérateur de plateforme accordé : ${email}`);
            }
        }
    }
    async listeCabinets() {
        const perimetre = { combinaisonPour: null };
        const [tenants, total] = await Promise.all([
            this.prisma.tenant.findMany({
                where: perimetre,
                orderBy: { nom: 'asc' },
                take: plafond_console_1.PLAFOND_LISTE_CONSOLE,
                select: {
                    id: true,
                    nom: true,
                    referentiel: true,
                    jeuEtatsFinanciersSycebnl: true,
                    systemeComptableSyscohada: true,
                    ville: true,
                    pays: true,
                    numeroImpot: true,
                    createdAt: true,
                    licence: {
                        select: { type: true, statut: true, dateDebut: true, dateExpiration: true, dernierHeartbeatAt: true },
                    },
                    dossierMere: { select: { id: true, nom: true } },
                    plafondCellules: true,
                    _count: { select: { users: true, ecritures: true, cellules: true } },
                },
            }),
            this.prisma.tenant.count({ where: perimetre }),
        ]);
        const cabinets = tenants.map((t) => ({
            id: t.id,
            nom: t.nom,
            referentiel: t.referentiel,
            jeuEtatsFinanciersSycebnl: (0, reponse_referentiel_1.siSycebnl)(t.referentiel, t.jeuEtatsFinanciersSycebnl),
            systemeComptableSyscohada: t.systemeComptableSyscohada,
            ville: t.ville,
            pays: t.pays,
            numeroImpot: t.numeroImpot,
            createdAt: t.createdAt,
            licence: t.licence,
            dossierMere: t.dossierMere,
            plafondCellules: t.plafondCellules,
            nbCellules: t._count.cellules,
            nbUtilisateurs: t._count.users,
            nbEcritures: t._count.ecritures,
        }));
        return { cabinets, ...(0, plafond_console_1.tranche)(cabinets.length, total) };
    }
    refuserAttributionSurSite(type) {
        if (type !== client_1.TypeLicence.PERPETUEL_ONPREMISE)
            return;
        throw new common_1.BadRequestException(exports.MOTIF_SUR_SITE_NON_ATTRIBUABLE);
    }
    modifierLicence(tenantId, dto) {
        return (0, contexte_cloisonnement_1.horsCloisonnement)('console · licence d’un cabinet client', () => this.modifierLicenceSansGarde(tenantId, dto));
    }
    echeanceAbonnement(cabinetId, echeance) {
        return (0, contexte_cloisonnement_1.horsCloisonnement)('console · échéance de la licence d’un cabinet abonné', async () => {
            const retenue = await this.echeanceDeLaMere(cabinetId, echeance);
            await this.prisma.licence.updateMany({
                where: { tenant: { dossierMereId: cabinetId }, type: { not: client_1.TypeLicence.PROPRIETAIRE } },
                data: { type: client_1.TypeLicence.ABONNEMENT, dateExpiration: new Date(`${retenue}T23:59:59Z`) },
            });
            return retenue;
        });
    }
    async echeanceDeLaMere(cabinetId, echeance) {
        const l = await this.prisma.licence.findUnique({ where: { tenantId: cabinetId }, select: { type: true, dateExpiration: true } });
        const date = new Date(`${echeance}T23:59:59Z`);
        if (!l) {
            await this.prisma.licence.create({ data: { tenantId: cabinetId, type: client_1.TypeLicence.ABONNEMENT, statut: client_1.StatutLicence.ACTIVE, dateExpiration: date } });
            return echeance;
        }
        if (l.type !== client_1.TypeLicence.ABONNEMENT) {
            throw new common_1.BadRequestException(l.type === client_1.TypeLicence.PROPRIETAIRE
                ? 'Le dossier de l’éditeur n’a pas d’abonnement.'
                : 'Ce dossier a une licence perpétuelle · un abonnement ne la gouverne pas. Changez d’abord le type de licence.');
        }
        if (l.dateExpiration && l.dateExpiration >= date)
            return l.dateExpiration.toISOString().slice(0, 10);
        await this.prisma.licence.update({ where: { tenantId: cabinetId }, data: { dateExpiration: date } });
        return echeance;
    }
    async modifierLicenceSansGarde(tenantId, dto) {
        this.refuserAttributionSurSite(dto.type);
        const licence = await this.prisma.licence.findUnique({ where: { tenantId } });
        if (!licence) {
            throw new common_1.NotFoundException('Cabinet introuvable ou sans licence');
        }
        this.refuserTouchePropriete(licence.type, dto);
        if (dto.type === undefined && dto.statut === undefined && dto.dateExpiration === undefined) {
            throw new common_1.BadRequestException('Aucune modification demandée');
        }
        const donnees = {
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.statut !== undefined ? { statut: dto.statut } : {}),
            ...(dto.dateExpiration !== undefined ? { dateExpiration: (0, date_effacable_1.dateSaisieOuEffacement)(dto.dateExpiration) } : {}),
        };
        const resultat = await this.prisma.licence.update({
            where: { tenantId },
            data: donnees,
            select: { type: true, statut: true, dateDebut: true, dateExpiration: true, dernierHeartbeatAt: true },
        });
        const cellulesCascade = await this.prisma.licence.updateMany({
            where: { tenant: { dossierMereId: tenantId } },
            data: donnees,
        });
        return { ...resultat, cellulesEnCascade: cellulesCascade.count };
    }
    refuserTouchePropriete(typeActuel, dto) {
        if (typeActuel !== client_1.TypeLicence.PROPRIETAIRE) {
            if (dto.type === client_1.TypeLicence.PROPRIETAIRE) {
                throw new common_1.BadRequestException('La licence « Éditeur » désigne le dossier de VMG Consulting, propriétaire du logiciel · elle ne ' +
                    's’attribue pas depuis la console. Un second dossier incoupable ne se verrait nulle part, et rien ' +
                    'ne pourrait le refermer.');
            }
            return;
        }
        throw new common_1.BadRequestException('Ce dossier est celui de l’éditeur du logiciel : sa licence n’expire pas, ne se suspend pas et ne change ' +
            'pas de type. C’est depuis ce dossier que les licences des autres se rouvrent · le couper verrouillerait ' +
            'l’opérateur hors de la console qui sert à déverrouiller, sans autre issue qu’une intervention en base.');
    }
    async modifierGroupe(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                referentiel: true,
                systemeComptableSyscohada: true,
                licence: { select: { type: true } },
                _count: { select: { cellules: true } },
            },
        });
        if (!tenant) {
            throw new common_1.NotFoundException('Cabinet introuvable');
        }
        if (dto.plafondCellules !== undefined) {
            await this.prisma.tenant.update({
                where: { id: tenantId },
                data: { plafondCellules: dto.plafondCellules },
            });
        }
        if (dto.dossierMereId === undefined) {
            return { id: tenantId, plafondCellules: dto.plafondCellules ?? null };
        }
        const dossierMereId = dto.dossierMereId ?? null;
        if (dossierMereId !== null) {
            if (dossierMereId === tenantId) {
                throw new common_1.BadRequestException('Un dossier ne peut pas être sa propre mère');
            }
            if (tenant._count.cellules > 0) {
                throw new common_1.BadRequestException('Ce dossier a des cellules · il ne peut pas devenir lui-même une cellule');
            }
            (0, licence_de_cellule_1.refuserCelluleEditeur)(tenant.licence?.type);
            const licence = await this.verifierMere(dossierMereId, tenant);
            await this.prisma.tenant.update({ where: { id: tenantId }, data: { dossierMereId } });
            if (licence) {
                await (0, contexte_cloisonnement_1.horsCloisonnement)('console · licence d’une cellule alignée sur sa mère', () => this.prisma.licence.update({ where: { tenantId }, data: licence }));
            }
            return { id: tenantId, dossierMereId };
        }
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { dossierMereId } });
        return { id: tenantId, dossierMereId };
    }
    async verifierMere(dossierMereId, fille) {
        const mere = await this.prisma.tenant.findUnique({
            where: { id: dossierMereId },
            select: {
                id: true,
                dossierMereId: true,
                referentiel: true,
                systemeComptableSyscohada: true,
                licence: { select: { type: true, statut: true, dateExpiration: true } },
            },
        });
        if (!mere) {
            throw new common_1.NotFoundException('Dossier mère introuvable');
        }
        if (mere.dossierMereId !== null) {
            throw new common_1.BadRequestException('Le dossier mère désigné est lui-même une cellule · un groupe n’a qu’un niveau');
        }
        if (mere.referentiel !== fille.referentiel) {
            throw new common_1.BadRequestException(`La cellule et son dossier mère doivent relever du même référentiel · la mère est ${mere.referentiel}, ` +
                `ce dossier est ${fille.referentiel}.`);
        }
        if (mere.referentiel === client_1.Referentiel.SYSCOHADA) {
            const systemeMere = mere.systemeComptableSyscohada ?? client_1.SystemeComptableSyscohada.NORMAL;
            const systemeFille = fille.systemeComptableSyscohada ?? client_1.SystemeComptableSyscohada.NORMAL;
            if (systemeMere !== systemeFille) {
                throw new common_1.BadRequestException(`La cellule tient le système comptable de son siège · la mère est au système ${systemeMere}, ce dossier au système ${systemeFille}.`);
            }
        }
        return (0, licence_de_cellule_1.licenceDeCellule)(mere.licence);
    }
    async creerCabinet(dto) {
        this.refuserAttributionSurSite(dto.typeLicence);
        const referentiel = dto.referentiel ?? client_1.Referentiel.SYCEBNL;
        let licenceMere = null;
        if (dto.dossierMereId) {
            if (dto.typeLicence !== undefined || dto.dateExpiration !== undefined) {
                throw new common_1.BadRequestException('Une cellule prend la licence de son dossier mère · type et échéance ne se choisissent pas.');
            }
            licenceMere = await this.verifierMere(dto.dossierMereId, {
                referentiel,
                systemeComptableSyscohada: referentiel === client_1.Referentiel.SYSCOHADA ? dto.systemeComptableSyscohada : null,
            });
        }
        const motDePasseTemporaire = (0, crypto_1.randomBytes)(12).toString('base64url');
        const resultat = await this.authService.register({
            nomEntite: dto.nomEntite,
            referentiel,
            email: dto.emailAdmin,
            motDePasse: motDePasseTemporaire,
            jeuEtatsFinanciersSycebnl: dto.jeuEtatsFinanciersSycebnl,
            systemeComptableSyscohada: dto.systemeComptableSyscohada,
            typeLicence: licenceMere?.type ?? dto.typeLicence ?? client_1.TypeLicence.ABONNEMENT,
            activite: dto.activite,
            adresse: dto.adresse,
            ville: dto.ville,
            pays: dto.pays,
            telephone: dto.telephone,
            dateDebutExercice: dto.dateDebutExercice,
            dateFinExercice: dto.dateFinExercice,
        });
        if (dto.dateExpiration) {
            await (0, contexte_cloisonnement_1.horsCloisonnement)('console · échéance posée à la création du dossier', () => this.prisma.licence.update({
                where: { tenantId: resultat.tenant.id },
                data: { dateExpiration: new Date(dto.dateExpiration), statut: client_1.StatutLicence.ACTIVE },
            }));
        }
        if (dto.dossierMereId) {
            await this.modifierGroupe(resultat.tenant.id, { dossierMereId: dto.dossierMereId });
        }
        await (0, contexte_cloisonnement_1.horsCloisonnement)('console · dossier créé par l’opérateur', () => this.prisma.user.update({
            where: { email: (0, courriel_1.normaliserCourriel)(dto.emailAdmin) },
            data: { doitChangerMotDePasse: true },
        }));
        return {
            tenant: resultat.tenant,
            exercice: resultat.exercice,
            adminEmail: dto.emailAdmin,
            motDePasseTemporaire,
        };
    }
    async reinitialiserAdmin(tenantId, dto) {
        const admin = await (0, contexte_cloisonnement_1.horsCloisonnement)('console · lecture de l’administrateur d’un cabinet client', () => this.prisma.user.findFirst({
            where: { tenantId, email: (0, courriel_1.normaliserCourriel)(dto.email), role: client_1.RoleUtilisateur.ADMIN_CABINET },
        }));
        if (!admin) {
            throw new common_1.NotFoundException("Aucun administrateur avec cette adresse dans ce dossier · l'opérateur ne réinitialise que les administrateurs.");
        }
        if (!this.courrier || !this.courrier.etatDuTransport().configure) {
            throw new common_1.ConflictException("Aucune messagerie n'est configurée · le mot de passe provisoire ne part qu'au courriel de l'administrateur du " +
                'cabinet, jamais à la console. Configurez la messagerie, puis réinitialisez.');
        }
        const motDePasseProvisoire = (0, reinitialisation_admin_1.motDePasseTireAuSort)();
        const { sujet, corps, corpsGarde } = (0, reinitialisation_admin_1.avisReinitialisationAdmin)(motDePasseProvisoire);
        const envoi = await (0, contexte_cloisonnement_1.horsCloisonnement)('console · mot de passe provisoire remis au seul administrateur du cabinet', () => this.courrier.envoyerUnSecret(tenantId, { destinataire: admin.email, sujet, corps, origine: reinitialisation_admin_1.ORIGINE_REINITIALISATION_ADMIN, origineId: admin.id }, corpsGarde));
        await (0, contexte_cloisonnement_1.horsCloisonnement)('console · réinitialisation de l’administrateur d’un cabinet client', () => this.prisma.user.update({
            where: { id: admin.id },
            data: {
                motDePasse: bcrypt.hashSync(motDePasseProvisoire, 12),
                doitChangerMotDePasse: true,
                sessionsInvalidesAvant: new Date(),
                ...verrouillage_1.DECOMPTE_REMIS_A_ZERO,
                ...double_authentification_1.SANS_DOUBLE_AUTH,
            },
        }));
        this.logger.log(`Mot de passe administrateur réinitialisé et remis par courriel · ${admin.email}`);
        return { reinitialise: true, email: admin.email, courriel: envoi.statut };
    }
    async designerDossierEditeur(tenantId) {
        const existant = await (0, contexte_cloisonnement_1.horsCloisonnement)("console · un seul dossier d'éditeur à la fois, tous cabinets confondus", () => this.prisma.licence.findFirst({
            where: { type: client_1.TypeLicence.PROPRIETAIRE },
            select: { tenantId: true, tenant: { select: { nom: true } } },
        }));
        if (existant) {
            if (existant.tenantId === tenantId) {
                throw new common_1.BadRequestException('Ce dossier est déjà celui de l’éditeur.');
            }
            throw new common_1.BadRequestException(`Le dossier de l’éditeur est déjà « ${existant.tenant.nom} ». Il n’y en a qu’un : le logiciel a un ` +
                'propriétaire, et deux dossiers incoupables ne se verraient nulle part.');
        }
        const licence = await this.prisma.licence.findUnique({ where: { tenantId } });
        if (!licence) {
            throw new common_1.NotFoundException('Cabinet introuvable ou sans licence');
        }
        return this.prisma.licence.update({
            where: { tenantId },
            data: { type: client_1.TypeLicence.PROPRIETAIRE, statut: client_1.StatutLicence.ACTIVE, dateExpiration: null },
            select: { type: true, statut: true, dateDebut: true, dateExpiration: true, dernierHeartbeatAt: true },
        });
    }
    async dossierEditeurId() {
        const l = await (0, contexte_cloisonnement_1.horsCloisonnement)("console · le dossier de l'éditeur, où naissent les factures d'abonnement", () => this.prisma.licence.findFirst({ where: { type: client_1.TypeLicence.PROPRIETAIRE }, select: { tenantId: true } }));
        return l?.tenantId ?? null;
    }
    async preparerDossierDemonstration(dto) {
        const existant = await (0, contexte_cloisonnement_1.horsCloisonnement)('console · un seul dossier de démonstration à la fois, tous cabinets confondus', () => this.prisma.tenant.findFirst({
            where: { estDemonstration: true, referentiel: dto.referentiel ?? client_1.Referentiel.SYCEBNL },
            select: { id: true, nom: true, users: { select: { email: true }, take: 1 } },
        }));
        if (existant) {
            const repris = await this.reprendreGarnissage(existant.id);
            if (repris) {
                this.logger.log(`Garnissage du dossier de démonstration repris · ${existant.nom}`);
                return {
                    tenantId: existant.id,
                    garni: { tiers: repris.tiers, ecritures: repris.ecritures },
                    repris: true,
                    nom: existant.nom,
                    email: existant.users[0]?.email ?? '',
                    rappel: "Garnissage d'une vitrine interrompue repris et achevé · son adresse et son mot de passe restent ceux de sa création, " +
                        'ceux saisis maintenant ne sont pas repris.',
                };
            }
            throw new common_1.BadRequestException(`Un dossier de démonstration existe déjà · « ${existant.nom} » (${existant.users[0]?.email ?? 'sans utilisateur'}). ` +
                "Servez-vous de celui-là plutôt que d'en ouvrir un second : deux vitrines divergent, et c'est toujours la " +
                "mauvaise qu'on donne au magasin.");
        }
        const referentiel = dto.referentiel ?? client_1.Referentiel.SYCEBNL;
        const scenario = (0, scenario_demonstration_1.scenarioDemonstration)(referentiel);
        const resultat = await this.authService.register({
            nomEntite: dto.nomEntite ?? scenario.nomEntite,
            referentiel,
            email: dto.email,
            motDePasse: dto.motDePasse,
            typeLicence: client_1.TypeLicence.ABONNEMENT,
            activite: scenario.activite,
            pays: 'République démocratique du Congo',
            ...(referentiel === client_1.Referentiel.SYSCOHADA ? { systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL } : {}),
        });
        await (0, contexte_cloisonnement_1.horsCloisonnement)('console · marquage du dossier de démonstration', async () => {
            await this.prisma.tenant.update({
                where: { id: resultat.tenant.id },
                data: {
                    estDemonstration: true,
                    modulesActives: [...modules_optionnels_1.MODULES_OPTIONNELS],
                    ...(referentiel === client_1.Referentiel.SYSCOHADA ? { formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE } : {}),
                },
            });
            await this.prisma.user.updateMany({
                where: { tenantId: resultat.tenant.id },
                data: { doitChangerMotDePasse: false },
            });
        });
        let garni = null;
        if (this.garnissage) {
            const garnissage = this.garnissage;
            garni = await (0, contexte_cloisonnement_1.horsCloisonnement)('console · garnissage du dossier de démonstration', async () => {
                const auteur = await this.prisma.user.findFirstOrThrow({ where: { tenantId: resultat.tenant.id }, select: { id: true } });
                const r = await garnissage.garnir(resultat.tenant.id, auteur.id);
                return { tiers: r.tiers, ecritures: r.ecritures };
            });
        }
        this.logger.log(`Dossier de démonstration ouvert · ${dto.email}`);
        return {
            tenantId: resultat.tenant.id,
            garni,
            repris: false,
            nom: resultat.tenant.nom,
            email: dto.email,
            rappel: "Ce dossier est une vitrine : ses écritures doivent rester fictives, et son adresse comme son mot de passe " +
                'sont destinés à figurer dans un formulaire de soumission public.',
        };
    }
    async reprendreGarnissage(tenantId) {
        if (!this.garnissage)
            return null;
        const garnissage = this.garnissage;
        return (0, contexte_cloisonnement_1.horsCloisonnement)('console · reprise du garnissage du dossier de démonstration', async () => {
            const validees = await this.prisma.ecriture.count({ where: { tenantId, statut: client_1.StatutEcriture.VALIDEE } });
            if (validees > 0)
                return null;
            const auteur = await this.prisma.user.findFirstOrThrow({ where: { tenantId }, select: { id: true } });
            const r = await garnissage.garnir(tenantId, auteur.id);
            return { tiers: r.tiers, ecritures: r.ecritures };
        });
    }
};
exports.PlateformeService = PlateformeService;
exports.PlateformeService = PlateformeService = PlateformeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        auth_service_1.AuthService,
        garnissage_demonstration_service_1.GarnissageDemonstrationService,
        courrier_service_1.CourrierService])
], PlateformeService);
//# sourceMappingURL=plateforme.service.js.map