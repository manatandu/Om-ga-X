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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.MOTIF_LICENCE_EDITEUR_A_LA_CREATION = exports.EMPREINTE_FACTICE = exports.SALT_ROUNDS = void 0;
const faits_declares_1 = require("../tenant/faits-declares");
const common_1 = require("@nestjs/common");
const licence_sur_site_service_1 = require("../sur-site/licence-sur-site.service");
const mentions_societe_1 = require("../tenant/mentions-societe");
const conditions_ong_etrangere_1 = require("../accord-cadre/conditions-ong-etrangere");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const bcrypt = require("bcryptjs");
const reponse_referentiel_1 = require("../../common/reponse-referentiel");
const prisma_service_1 = require("../../common/prisma.service");
const tenant_service_1 = require("../tenant/tenant.service");
const compte_service_1 = require("../comptes/compte.service");
const exercice_service_1 = require("../exercice/exercice.service");
const journal_service_1 = require("../journaux/journal.service");
const taux_tva_service_1 = require("../tva/taux-tva.service");
const immobilisation_service_1 = require("../immobilisations/immobilisation.service");
const analytique_service_1 = require("../analytique/analytique.service");
const relances_service_1 = require("../relances/relances.service");
const inscription_essai_1 = require("./inscription-essai");
const client_1 = require("@prisma/client");
const extension_audit_1 = require("../../common/audit/extension-audit");
const contexte_cloisonnement_1 = require("../../common/cloisonnement/contexte-cloisonnement");
const courriel_1 = require("../../common/courriel");
const contexte_audit_1 = require("../../common/audit/contexte-audit");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const avis_double_authentification_1 = require("./avis-double-authentification");
const courrier_service_1 = require("../courrier/courrier.service");
const modules_optionnels_1 = require("../tenant/modules-optionnels");
const verrouillage_1 = require("./verrouillage");
const double_authentification_1 = require("./double-authentification");
const session_longue_1 = require("./session-longue");
exports.SALT_ROUNDS = 12;
exports.EMPREINTE_FACTICE = '$2b$12$zNSRXkByzfZhOQSR4/60ze6WWpSytqcVD.yZf5fl0OqDCsgj6X03y';
exports.MOTIF_LICENCE_EDITEUR_A_LA_CREATION = "La licence de l'éditeur ne s'attribue pas à la création d'un dossier · elle se pose une seule fois, par le geste " +
    "« Désigner comme dossier de l'éditeur… » de la console.";
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwt, tenantService, compteService, exerciceService, journalService, tauxTvaService, immobilisationService, analytiqueService, relancesService, surSite, courrier) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.tenantService = tenantService;
        this.compteService = compteService;
        this.exerciceService = exerciceService;
        this.journalService = journalService;
        this.tauxTvaService = tauxTvaService;
        this.immobilisationService = immobilisationService;
        this.analytiqueService = analytiqueService;
        this.relancesService = relancesService;
        this.surSite = surSite;
        this.courrier = courrier;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async register(dto, options = {}) {
        if (dto.typeLicence === client_1.TypeLicence.PROPRIETAIRE) {
            throw new common_1.BadRequestException(exports.MOTIF_LICENCE_EDITEUR_A_LA_CREATION);
        }
        dto = { ...dto, email: (0, courriel_1.normaliserCourriel)(dto.email) };
        const emailExistant = await (0, contexte_cloisonnement_1.horsCloisonnement)('inscription · unicité du courriel sur toute la plateforme', () => this.prisma.user.findUnique({ where: { email: dto.email } }));
        if (emailExistant) {
            throw new common_1.ConflictException('Un compte existe déjà avec cet email');
        }
        if (this.surSite?.surSite) {
            const ouverts = await (0, contexte_cloisonnement_1.horsCloisonnement)('installation sur site · plafond de dossiers de la licence', () => this.prisma.tenant.count({ where: { combinaisonPour: null } }));
            this.surSite.verifierPlafondDossiers(ouverts);
            dto = { ...dto, typeLicence: client_1.TypeLicence.PERPETUEL_ONPREMISE };
        }
        const motDePasseHache = await bcrypt.hash(dto.motDePasse, exports.SALT_ROUNDS);
        const idDossier = (0, crypto_1.randomUUID)();
        const { tenant, user, exercice } = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => (0, contexte_audit_1.dansContexteAudit)({ ...((0, contexte_audit_1.acteurCourant)() ?? { acteurEmail: contexte_audit_1.ACTEUR_SYSTEME }), tenantId: idDossier }, async () => {
            const tenant = await this.tenantService.creerTenant({
                id: idDossier,
                nom: dto.nomEntite,
                referentiel: dto.referentiel,
                typeLicence: dto.typeLicence ?? client_1.TypeLicence.ABONNEMENT,
                dateExpiration: options.dateExpirationLicence,
                jeuEtatsFinanciersSycebnl: dto.referentiel === client_1.Referentiel.SYCEBNL ? dto.jeuEtatsFinanciersSycebnl : undefined,
                systemeComptableSyscohada: dto.referentiel === client_1.Referentiel.SYSCOHADA
                    ? (dto.systemeComptableSyscohada ?? client_1.SystemeComptableSyscohada.NORMAL)
                    : undefined,
                activite: dto.activite,
                adresse: dto.adresse,
                ville: dto.ville,
                pays: dto.pays,
                telephone: dto.telephone,
            }, tx);
            {
                const user = await tx.user.create({
                    data: {
                        tenantId: tenant.id,
                        email: dto.email,
                        motDePasse: motDePasseHache,
                        role: client_1.RoleUtilisateur.ADMIN_CABINET,
                        ...(options.motDePasseProvisoire ? { doitChangerMotDePasse: true } : {}),
                    },
                });
                await this.compteService.seedPlan(tenant.id, dto.referentiel, tx);
                await this.journalService.seedJournauxDefaut(tenant.id, dto.referentiel, tx);
                await this.tauxTvaService.seedTauxDefaut(tenant.id, dto.referentiel, tx);
                await this.immobilisationService.seedFamillesDefaut(tenant.id, dto.referentiel, tx);
                await this.analytiqueService.seedPlansDefaut(tenant.id, dto.referentiel, tx);
                await this.relancesService.seedNiveauxDefaut(tenant.id, dto.referentiel, tx);
                const exercice = dto.dateDebutExercice && dto.dateFinExercice
                    ? await this.exerciceService.creer(tenant.id, { dateDebut: dto.dateDebutExercice, dateFin: dto.dateFinExercice }, tx)
                    : await this.exerciceService.creerExerciceCourant(tenant.id, tx);
                return { tenant, user, exercice };
            }
        }), { maxWait: 10_000, timeout: 30_000 });
        return {
            tenant: {
                id: tenant.id,
                nom: tenant.nom,
                referentiel: tenant.referentiel,
                jeuEtatsFinanciersSycebnl: (0, reponse_referentiel_1.siSycebnl)(tenant.referentiel, tenant.jeuEtatsFinanciersSycebnl),
                systemeComptableSyscohada: tenant.systemeComptableSyscohada,
                numeroImpot: tenant.numeroImpot,
            },
            exercice,
            ...(0, session_longue_1.emettreSession)(this.jwt, user.id, { longue: false, connexionComplete: 'maintenant' }),
        };
    }
    async inscrireEnEssai(dto) {
        if (!this.courrier || !this.courrier.etatDuTransport().configure) {
            throw new common_1.ServiceUnavailableException("L'ouverture d'un dossier d'essai est momentanément indisponible · écrivez à admin@vmgconsulting.net pour démarrer.");
        }
        const courrier = this.courrier;
        const email = (0, courriel_1.normaliserCourriel)(dto.email);
        const maintenant = new Date();
        const reponse = {
            message: "Si l'adresse est valide, un courriel part dans quelques instants avec votre mot de passe provisoire. " +
                "Pensez à regarder le dossier des courriers indésirables. Rien après un quart d'heure · écrivez à admin@vmgconsulting.net.",
            joursEssai: inscription_essai_1.JOURS_ESSAI,
        };
        const existant = await (0, contexte_cloisonnement_1.horsCloisonnement)("inscription d'essai · unicité du courriel sur toute la plateforme", () => this.prisma.user.findUnique({ where: { email } }));
        if (existant) {
            const licenceExistante = await (0, contexte_cloisonnement_1.horsCloisonnement)("inscription d'essai · la licence du dossier du courriel donné", () => this.prisma.licence.findUnique({ where: { tenantId: existant.tenantId } }));
            if (existant.role === client_1.RoleUtilisateur.ADMIN_CABINET && (0, inscription_essai_1.estUnDossierDEssai)(licenceExistante) && (0, inscription_essai_1.renvoiPossible)(existant, maintenant)) {
                const mot = (0, inscription_essai_1.motDePasseTireAuSort)();
                const avis = (0, inscription_essai_1.avisInscriptionEssai)(mot, maintenant, false);
                await (0, contexte_cloisonnement_1.horsCloisonnement)("inscription d'essai · mot de passe renvoyé au seul titulaire", async () => {
                    await courrier.envoyerUnSecret(existant.tenantId, { destinataire: email, sujet: avis.sujet, corps: avis.corps, origine: inscription_essai_1.ORIGINE_INSCRIPTION_ESSAI, origineId: existant.id }, avis.corpsGarde);
                    await this.prisma.user.update({
                        where: { id: existant.id },
                        data: {
                            motDePasse: await bcrypt.hash(mot, exports.SALT_ROUNDS),
                            doitChangerMotDePasse: true,
                            sessionsInvalidesAvant: maintenant,
                            ...verrouillage_1.DECOMPTE_REMIS_A_ZERO,
                        },
                    });
                });
                this.logger.log(`Dossier d'essai · mot de passe provisoire renvoyé (${existant.id})`);
            }
            return reponse;
        }
        const mot = (0, inscription_essai_1.motDePasseTireAuSort)();
        const finEssai = (0, inscription_essai_1.finDeLEssai)(maintenant);
        let tenant;
        try {
            ({ tenant } = await this.register({
                nomEntite: dto.nomEntite.trim(),
                referentiel: dto.referentiel,
                email,
                motDePasse: mot,
                jeuEtatsFinanciersSycebnl: dto.jeuEtatsFinanciersSycebnl,
                systemeComptableSyscohada: dto.systemeComptableSyscohada,
            }, { dateExpirationLicence: finEssai, motDePasseProvisoire: true }));
        }
        catch (erreur) {
            const conflit = erreur instanceof common_1.ConflictException || erreur?.code === 'P2002';
            if (conflit)
                return reponse;
            throw erreur;
        }
        const avis = (0, inscription_essai_1.avisInscriptionEssai)(mot, finEssai, true);
        try {
            await (0, contexte_cloisonnement_1.horsCloisonnement)("inscription d'essai · mot de passe remis au seul courriel donné", () => courrier.envoyerUnSecret(tenant.id, { destinataire: email, sujet: avis.sujet, corps: avis.corps, origine: inscription_essai_1.ORIGINE_INSCRIPTION_ESSAI, origineId: tenant.id }, avis.corpsGarde));
        }
        catch (erreur) {
            this.logger.warn(`Dossier d'essai créé, courriel non parti (${tenant.id}) · ${erreur instanceof Error ? erreur.message : String(erreur)}`);
            throw new common_1.ServiceUnavailableException("Le courriel n'est pas parti. Recommencez dans une dizaine de minutes avec la même adresse, le mot de passe sera renvoyé.");
        }
        return reponse;
    }
    async dossierDInstallation() {
        const t = await (0, contexte_cloisonnement_1.horsCloisonnement)('installation sur site · le premier dossier du poste', () => this.prisma.tenant.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } }));
        return t?.id ?? null;
    }
    async premierDossierAttendu() {
        const ouverts = await (0, contexte_cloisonnement_1.horsCloisonnement)('installation sur site · un dossier existe-t-il déjà', () => this.prisma.tenant.count());
        return ouverts === 0;
    }
    async login(dto, adresseIp = null) {
        const user = await (0, contexte_cloisonnement_1.horsCloisonnement)('connexion · le dossier n’est pas encore connu', () => this.prisma.user.findUnique({ where: { email: (0, courriel_1.normaliserCourriel)(dto.email) } }));
        if (!user) {
            await bcrypt.compare(dto.motDePasse, exports.EMPREINTE_FACTICE);
            throw new common_1.UnauthorizedException(verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES);
        }
        const maintenant = new Date();
        const motDePasseValide = await bcrypt.compare(dto.motDePasse, user.motDePasse);
        if (user.verrouilleJusqua && user.verrouilleJusqua > maintenant) {
            throw new common_1.UnauthorizedException(verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES);
        }
        const compterEchec = () => (0, contexte_cloisonnement_1.horsCloisonnement)('connexion · décompte des échecs sur un compte non encore identifié', () => this.prisma.user.update({
            where: { id: user.id },
            data: (0, verrouillage_1.decompteApresEchec)(user, maintenant),
        }));
        if (!motDePasseValide) {
            await compterEchec();
            throw new common_1.UnauthorizedException(verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES);
        }
        if (!user.estActif) {
            throw new common_1.UnauthorizedException('Ce compte a été désactivé');
        }
        let consomme = {};
        if (user.doubleAuthActiveDepuis) {
            if (!dto.code?.trim())
                return { deuxiemeFacteurRequis: true };
            const r = (0, double_authentification_1.secondFacteurAccepte)(user, dto.code, maintenant.getTime());
            if (!r) {
                await compterEchec();
                throw new common_1.UnauthorizedException('Code de vérification invalide');
            }
            consomme = r;
        }
        if (user.tentativesEchouees > 0 || user.verrouilleJusqua || user.dernierEchecLe || Object.keys(consomme).length > 0) {
            await (0, contexte_cloisonnement_1.horsCloisonnement)('connexion · remise à zéro du décompte', () => this.prisma.user.update({
                where: { id: user.id },
                data: { ...verrouillage_1.DECOMPTE_REMIS_A_ZERO, ...consomme },
            }));
        }
        const longue = dto.resterConnecte === true;
        await this.journaliserConnexion(user, adresseIp, longue);
        return (0, session_longue_1.emettreSession)(this.jwt, user.id, { longue, connexionComplete: 'maintenant' });
    }
    async journaliserConnexion(user, adresseIp, longue) {
        try {
            await (0, extension_audit_1.ajouterMaillon)(this.prisma.clientNu, {
                tenantId: user.tenantId,
                acteurId: user.id,
                acteurEmail: user.email,
                adresseIp,
                action: client_1.ActionAudit.CONNEXION,
                entite: 'User',
                entiteId: user.id,
                avant: null,
                apres: { sessionLongue: longue },
            });
        }
        catch (e) {
            this.logger.error(`Maillon de connexion non écrit · ${e.message}`);
        }
    }
    async compteDoubleAuth(userId) {
        const u = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!u)
            throw new common_1.UnauthorizedException('Utilisateur introuvable');
        return u;
    }
    async etatDoubleAuth(userId) {
        const u = await this.compteDoubleAuth(userId);
        return {
            active: u.doubleAuthActiveDepuis !== null,
            depuis: u.doubleAuthActiveDepuis,
            codesSecoursRestants: u.doubleAuthActiveDepuis ? u.codesSecoursDoubleAuth.length : 0,
            exigeePourLaConsole: u.estOperateurPlateforme,
        };
    }
    async initierDoubleAuth(userId) {
        const u = await this.compteDoubleAuth(userId);
        if (u.doubleAuthActiveDepuis)
            throw new common_1.BadRequestException('La double authentification est déjà active · désactivez-la d’abord.');
        const secret = (0, double_authentification_1.genererSecret)();
        await this.prisma.user.update({ where: { id: userId }, data: { secretDoubleAuth: secret } });
        return { secret, uri: (0, double_authentification_1.uriOtpauth)(secret, u.email) };
    }
    async activerDoubleAuth(userId, motDePasseActuel, code, maintenant = new Date(), session = null) {
        const u = await this.compteDoubleAuth(userId);
        if (u.doubleAuthActiveDepuis)
            throw new common_1.BadRequestException('La double authentification est déjà active.');
        if (!u.secretDoubleAuth)
            throw new common_1.BadRequestException('Affichez d’abord la clé à enregistrer dans l’application.');
        if (!(await bcrypt.compare(motDePasseActuel, u.motDePasse)))
            throw new common_1.UnauthorizedException('Le mot de passe actuel est incorrect');
        const pas = (0, double_authentification_1.verifierCodeTotp)(u.secretDoubleAuth, code, maintenant.getTime(), null);
        if (pas === null) {
            throw new common_1.BadRequestException('Code invalide · vérifiez que l’heure du téléphone est à l’heure, puis saisissez le code affiché.');
        }
        const { codes, empreintes } = (0, double_authentification_1.genererCodesSecours)();
        await this.prisma.user.update({
            where: { id: userId },
            data: { doubleAuthActiveDepuis: maintenant, dernierPasDoubleAuth: pas, codesSecoursDoubleAuth: empreintes, sessionsInvalidesAvant: maintenant },
        });
        await this.aviserDoubleAuth(u, 'ACTIVEE', maintenant);
        return { codesSecours: codes, ...this.reemettre(u, session, undefined, true) };
    }
    async desactiverDoubleAuth(userId, motDePasse, code, maintenant = new Date(), session = null) {
        const u = await this.compteDoubleAuth(userId);
        if (!u.doubleAuthActiveDepuis)
            throw new common_1.BadRequestException('La double authentification n’est pas active.');
        if (!(await bcrypt.compare(motDePasse, u.motDePasse)))
            throw new common_1.UnauthorizedException('Le mot de passe actuel est incorrect');
        if (!(0, double_authentification_1.secondFacteurAccepte)(u, code, maintenant.getTime()))
            throw new common_1.UnauthorizedException('Code de vérification invalide');
        await this.prisma.user.update({
            where: { id: userId },
            data: { secretDoubleAuth: null, doubleAuthActiveDepuis: null, dernierPasDoubleAuth: null, codesSecoursDoubleAuth: [], sessionsInvalidesAvant: maintenant },
        });
        await this.aviserDoubleAuth(u, 'RETIREE', maintenant);
        return { desactivee: true, ...this.reemettre(u, session, undefined, true) };
    }
    async regenererCodesSecours(userId, motDePasseActuel, code, maintenant = new Date()) {
        const u = await this.compteDoubleAuth(userId);
        if (!u.doubleAuthActiveDepuis)
            throw new common_1.BadRequestException('La double authentification n’est pas active.');
        if (!(await bcrypt.compare(motDePasseActuel, u.motDePasse)))
            throw new common_1.UnauthorizedException('Le mot de passe actuel est incorrect');
        const r = (0, double_authentification_1.secondFacteurAccepte)(u, code, maintenant.getTime());
        if (!r)
            throw new common_1.UnauthorizedException('Code de vérification invalide');
        const { codes, empreintes } = (0, double_authentification_1.genererCodesSecours)();
        await this.prisma.user.update({ where: { id: userId }, data: { ...r, codesSecoursDoubleAuth: empreintes } });
        await this.aviserDoubleAuth(u, 'CODES_SECOURS_REGENERES', maintenant);
        return { codesSecours: codes };
    }
    async aviserDoubleAuth(u, evenement, instant) {
        if (!this.courrier)
            return;
        try {
            await this.courrier.mettreEnFile(u.tenantId, {
                destinataire: u.email,
                ...(0, avis_double_authentification_1.avisDoubleAuth)(evenement, { email: u.email, instant }),
                origine: courrier_service_1.ORIGINE_DOUBLE_AUTHENTIFICATION,
                origineId: u.id,
                createdBy: u.id,
            });
        }
        catch (erreur) {
            this.logger.warn(`Avis de double authentification non mis en file · ${erreur instanceof Error ? erreur.message : String(erreur)}`);
        }
    }
    async changerMotDePasse(userId, motDePasseActuel, nouveauMotDePasse, session = null) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.UnauthorizedException('Utilisateur introuvable');
        }
        const actuelValide = await bcrypt.compare(motDePasseActuel, user.motDePasse);
        if (!actuelValide) {
            throw new common_1.UnauthorizedException('Le mot de passe actuel est incorrect');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                motDePasse: await bcrypt.hash(nouveauMotDePasse, exports.SALT_ROUNDS),
                doitChangerMotDePasse: false,
                sessionsInvalidesAvant: new Date(),
                ...verrouillage_1.DECOMPTE_REMIS_A_ZERO,
            },
        });
        return { change: true, ...this.reemettre(user, session) };
    }
    async changerAdresse(userId, motDePasseActuel, nouvelleAdresse, session = null) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('Utilisateur introuvable');
        if (!(await bcrypt.compare(motDePasseActuel, user.motDePasse))) {
            throw new common_1.UnauthorizedException('Le mot de passe actuel est incorrect');
        }
        const adresse = (0, courriel_1.normaliserCourriel)(nouvelleAdresse);
        if (adresse === user.email)
            throw new common_1.BadRequestException("C'est déjà votre adresse de connexion.");
        try {
            await this.prisma.user.update({ where: { id: userId }, data: { email: adresse, sessionsInvalidesAvant: new Date() } });
        }
        catch (e) {
            if (e?.code === 'P2002') {
                throw new common_1.ConflictException('Cette adresse est déjà utilisée par un autre compte.');
            }
            throw e;
        }
        return { adresse, ...this.reemettre(user, session) };
    }
    async deconnecterAutresAppareils(userId, motDePasseActuel, session, maintenant = new Date()) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('Utilisateur introuvable');
        if (!(await bcrypt.compare(motDePasseActuel, user.motDePasse))) {
            throw new common_1.UnauthorizedException('Le mot de passe actuel est incorrect');
        }
        await this.prisma.user.update({ where: { id: userId }, data: { sessionsInvalidesAvant: maintenant } });
        return { autresAppareilsDeconnectes: true, ...this.reemettre(user, session, maintenant.getTime()) };
    }
    async deconnecterPartout(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { sessionsInvalidesAvant: new Date() },
        });
        return { sessionsFermees: true };
    }
    async me(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { tenant: { include: { _count: { select: { cellules: true } }, licence: { select: { type: true } } } } },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Utilisateur introuvable');
        }
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            estOperateurPlateforme: user.estOperateurPlateforme,
            doitChangerMotDePasse: user.doitChangerMotDePasse,
            tenant: {
                id: user.tenant.id,
                nom: user.tenant.nom,
                referentiel: user.tenant.referentiel,
                jeuEtatsFinanciersSycebnl: (0, reponse_referentiel_1.siSycebnl)(user.tenant.referentiel, user.tenant.jeuEtatsFinanciersSycebnl),
                systemeComptableSyscohada: user.tenant.systemeComptableSyscohada,
                devise: user.tenant.devise,
                numeroImpot: user.tenant.numeroImpot,
                mentionsSociete: (0, mentions_societe_1.mentionsEmetteur)((0, mentions_societe_1.identiteSociete)(user.tenant)).ligne,
                nombreCellules: user.tenant._count.cellules,
                peutCreerCellules: user.tenant.plafondCellules !== null && user.tenant.dossierMereId === null,
                ongEtrangere: user.tenant.referentiel === client_1.Referentiel.SYCEBNL
                    ? (0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(user.tenant.formeJuridique, user.tenant.droitEtranger)
                    : null,
                assujettissementTva: (0, faits_declares_1.faitAssujettissementTva)(user.tenant),
                venteBiensServices: user.tenant.venteBiensServices,
                modulesActives: (0, modules_optionnels_1.modulesServis)(user.tenant.modulesActives, user.tenant.licence?.type),
                longueurCompte: user.tenant.longueurCompte,
                estDemonstration: user.tenant.estDemonstration === true,
            },
        };
    }
    reemettre(user, session, instantMs, complete = false) {
        const demande = (0, session_longue_1.demandeDeReemission)(session);
        return (0, session_longue_1.emettreSession)(this.jwt, user.id, complete ? { ...demande, connexionComplete: 'maintenant' } : demande, instantMs);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(10, (0, common_1.Optional)()),
    __param(11, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        tenant_service_1.TenantService,
        compte_service_1.CompteService,
        exercice_service_1.ExerciceService,
        journal_service_1.JournalService,
        taux_tva_service_1.TauxTvaService,
        immobilisation_service_1.ImmobilisationService,
        analytique_service_1.AnalytiqueService,
        relances_service_1.RelancesService,
        licence_sur_site_service_1.LicenceSurSiteService,
        courrier_service_1.CourrierService])
], AuthService);
//# sourceMappingURL=auth.service.js.map