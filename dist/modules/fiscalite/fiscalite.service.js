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
var FiscaliteService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscaliteService = exports.LECTURE_CHIFFRE_AFFAIRES = exports.COMPLEMENT_UNICITE_NON_DECLAREE = exports.COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE = exports.OBSERVATION_UNIPERSONNELLE_PASSE_F5 = exports.OBSERVATIONS_PHYSIQUE_PASSE_F5 = exports.arrondirImpotArt150 = void 0;
exports.unipersonnaliteDeLArticle63 = unipersonnaliteDeLArticle63;
exports.observationArticle63 = observationArticle63;
exports.observationBilansSuccessifs = observationBilansSuccessifs;
const common_1 = require("@nestjs/common");
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const balance_trois_colonnes_1 = require("../comptabilite/balance-trois-colonnes");
const catalogue_retraitements_1 = require("./catalogue-retraitements");
const parametres_fiscaux_1 = require("./parametres-fiscaux");
const exemption_is_ebnl_1 = require("./exemption-is-ebnl");
const arrondi_article_150_1 = require("./arrondi-article-150");
Object.defineProperty(exports, "arrondirImpotArt150", { enumerable: true, get: function () { return arrondi_article_150_1.arrondirImpotArt150; } });
const ecriture_impot_resultat_1 = require("./ecriture-impot-resultat");
const entree_en_vigueur_loi_23_053_1 = require("../../common/entree-en-vigueur-loi-23-053");
const report_deficitaire_1 = require("./report-deficitaire");
const periode_creation_1 = require("./periode-creation");
const correspondance_compte_resultat_syscohada_1 = require("../etats-financiers-syscohada/correspondance-compte-resultat-syscohada");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const liquidation_societe_1 = require("../exercice/liquidation-societe");
const arrondir = (n) => Math.round(n * 100) / 100;
const ECHELLE_REGIMES_PHYSIQUES = [
    'IRPP_MICRO_ENTREPRISE',
    'IRPP_PETITE_ENTREPRISE',
    'IRPP_REGIME_REEL',
];
exports.OBSERVATIONS_PHYSIQUE_PASSE_F5 = {
    commun: [
        "Art. 103 : sont exonérés les revenus des terres EXCLUSIVEMENT affectées à des cultures vivrières et d'une superficie INFÉRIEURE à dix hectares · deux conditions cumulatives qu'aucune écriture ne porte. Si elles sont remplies, ni le régime ni l'impôt annoncés ici ne sont dus sur ces revenus.",
    ],
    regimeReel: [
        "Art. 89, al. 2 et 3 : les revenus de capitaux mobiliers et les loyers d'immeubles NON inscrits à l'actif du bilan ne sont pas des produits taxables de l'entreprise ; inscrits à l'actif, ils le sont pour leur montant net. Art. 90 : sont en outre déductibles les versements définitifs pour rente viagère, pension, assurance maladie ou chômage, dans la limite de 20 % des revenus professionnels imposés l'année antérieure, et les frais médicaux du redevable résident, de son épouse et de ses enfants célibataires à charge, effectivement payés et justifiés. Ces montants se portent en déduction manuelle.",
        "Art. 92 à 99 : les bénéfices d'une profession libérale ou non commerciale sont l'excédent des RECETTES sur les dépenses. Les provisions et avances sur honoraires EFFECTIVEMENT ENCAISSÉES sont des recettes, sauf celles qui couvrent des débours (art. 95, 1°) · en comptabilité d'engagement, elles restent au 419 et hors du résultat, et se réintègrent ici. Les fonds des clients ne restent non imposables qu'enregistrés à un compte distinct (art. 97), et aucun loyer ne se déduit pour des locaux dont le professionnel est propriétaire (art. 99, al. 3).",
    ],
};
exports.OBSERVATION_UNIPERSONNELLE_PASSE_F5 = "Société unipersonnelle à associé ou actionnaire unique personne physique : le Titre 2, art. 3 la soumet à l'impôt sur les sociétés « même unipersonnelle », quand l'art. 63, al. 2, 1° soumet cet associé personnellement à l'IRPP, par renvoi au régime des sociétés de personnes qui n'ont pas opté pour l'IS. Aucune source lue n'articule les deux textes · le calcul reste à l'IS, et le point est à faire trancher.";
exports.COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE = "La nature de l'associé unique n'est pas déclarée (Paramètres du dossier, section Immatriculation, « Associé unique personne morale », sous « Régime de la liquidation » · la réponse vaut hors de toute dissolution) · l'observation ne vaut que s'il est une personne physique.";
exports.COMPLEMENT_UNICITE_NON_DECLAREE = "L'unicité de l'associé n'est pas déclarée (Paramètres du dossier, section Immatriculation, « Associé unique ») · l'observation ne vaut que si la société n'a qu'un associé ou actionnaire, personne physique.";
function unipersonnaliteDeLArticle63(t) {
    const forme = t.formeJuridiqueSyscohada;
    if (forme !== client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE &&
        forme !== client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE &&
        forme !== client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME) {
        return null;
    }
    if (t.associeUniquePersonneMorale === true)
        return null;
    if (t.associeUnique === false)
        return null;
    if (t.associeUnique !== true)
        return 'UNICITE_NON_DECLAREE';
    return t.associeUniquePersonneMorale === false ? 'ASSOCIE_PERSONNE_PHYSIQUE' : 'NATURE_NON_DECLAREE';
}
function observationArticle63(u) {
    switch (u) {
        case null:
            return null;
        case 'ASSOCIE_PERSONNE_PHYSIQUE':
            return exports.OBSERVATION_UNIPERSONNELLE_PASSE_F5;
        case 'NATURE_NON_DECLAREE':
            return `${exports.OBSERVATION_UNIPERSONNELLE_PASSE_F5} ${exports.COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE}`;
        case 'UNICITE_NON_DECLAREE':
            return `${exports.OBSERVATION_UNIPERSONNELLE_PASSE_F5} ${exports.COMPLEMENT_UNICITE_NON_DECLAREE}`;
    }
}
exports.LECTURE_CHIFFRE_AFFAIRES = "Chiffre d'affaires lu sur les comptes 701 à 707 (poste XB du compte de résultat), mouvements du livre-journal, rabais compris · la loi n° 23/053 vise le chiffre d'affaires « déclaré » (art. 57) ou « hors taxes » (art. 43 et 49) sans le définir ; si celui que le dossier déclare diffère de ces comptes, l'impôt minimum et les plafonds affichés diffèrent d'autant.";
function observationBilansSuccessifs(dateFin) {
    const annee = dateFin.getUTCFullYear();
    return (`BILANS SUCCESSIFS EN ${annee} · « lorsqu'il est dressé des bilans successifs au cours d'une même année, les ` +
        "résultats en sont totalisés pour l'assiette de l'impôt dû au titre de ladite année » (loi n° 23/053, art. 12 " +
        "al. 4). Le calcul ci-dessous porte sur cet exercice seul, impôt minimum et report déficitaire compris · la " +
        `totalisation des résultats de ${annee}, et l'impôt qui en résulte, restent à établir par le cabinet. En cas de ` +
        "dissolution, la cotisation spéciale est rattachée à l'exercice désigné par le millésime de l'année de la " +
        'dissolution (art. 13 al. 3).');
}
let FiscaliteService = FiscaliteService_1 = class FiscaliteService {
    constructor(prisma, ecritureService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
    }
    catalogue() {
        return { retraitements: catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS, derniereVerification: parametres_fiscaux_1.DERNIERE_VERIFICATION_FISCALE };
    }
    async tenantSyscohada(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable');
        if (tenant.referentiel !== client_1.Referentiel.SYSCOHADA) {
            const qualification = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant);
            throw new common_1.BadRequestException(`La détermination du résultat fiscal ne concerne que les dossiers tenus en SYSCOHADA. ${qualification.enonce}`);
        }
        return tenant;
    }
    async exemptionIs(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable');
        if (tenant.referentiel !== client_1.Referentiel.SYCEBNL) {
            throw new common_1.BadRequestException("Le statut d'exemption d'impôt sur les sociétés de l'article 5 de la loi n° 23/053 ne concerne que les dossiers tenus en SYCEBNL.");
        }
        return {
            formeJuridique: tenant.formeJuridique ?? null,
            droitEtranger: tenant.droitEtranger ?? false,
            ...(0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant),
        };
    }
    async exerciceDuDossier(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable');
        return exercice;
    }
    static suiviAcomptes(entree) {
        if (!entree.acomptesDus)
            return null;
        const ecart = arrondir(entree.declares - entree.comptabilises);
        const observations = [];
        if (Math.abs(ecart) >= 0.01) {
            const enTrop = ecart < 0;
            observations.push(`Les acomptes DÉCLARÉS dans cette fenêtre (${entree.declares}) et le solde débiteur du compte 4492 ` +
                `« État, avances et acomptes versés sur impôts » (${entree.comptabilises}) diffèrent de ${ecart}. ` +
                "Le 4492 est débité des sommes effectivement versées à l'État par le crédit de la trésorerie (AUDCIF " +
                'Titre VII, compte 44) : il porte le décaissement, la saisie porte une déclaration. Le solde à payer ' +
                'calculé ici est faux de cet écart. ' +
                (enTrop
                    ? "LE COMPTE PORTE PLUS QUE CE QUI EST DÉCLARÉ : ce sens-là n'est PAS une insuffisance de versement, " +
                        "et l'amende de l'art. 98 bis ne s'y applique pas. TROIS CAUSES À EXAMINER. Un acompte versé et non " +
                        'saisi dans cette fenêtre, qui se corrige à la saisie. Ou une somme qui N’EST PAS un acompte : ' +
                        "l'art. 110, alinéa 2 de la loi de procédures fiscales oblige le contribuable qui demande un sursis " +
                        'de recouvrement sur un supplément contesté à « verser un montant égal au DIXIÈME du supplément ' +
                        "d'impôt contesté ». Cette consignation n'est pas une avance sur l'impôt de l'exercice et ne " +
                        "s'impute pas comme un acompte · son sort suit l'issue de la réclamation. Le sursis ne joue pas en " +
                        "cas de taxation d'office (même article, alinéa 3). Ou, si le dossier donne des immeubles en location, " +
                        "les retenues sur loyers opérées par ses locataires en son acquit : la loi n° 83/004, art. 11, appelle " +
                        "chacune « acompte », et son art. 13 l'impute sur l'impôt sur les revenus locatifs du propriétaire, non " +
                        "sur l'impôt sur les sociétés. OmegaX ne détient aucune réclamation ni aucun bail et ne peut donc pas " +
                        'distinguer ces trois sommes : la ventilation appartient au cabinet.'
                    : "LE COMPTE PORTE MOINS QUE CE QUI EST DÉCLARÉ. Si ce sont les acomptes qui manquent, l'art. 98 bis " +
                        "LPF punit « le défaut ou l'insuffisance de paiement de l'acompte provisionnel » d'« une amende " +
                        "égale à 50 % du montant de l'acompte non versé »."));
        }
        let excedent = null;
        if (entree.impotDu !== null && entree.declares > entree.impotDu) {
            excedent = arrondir(entree.declares - entree.impotDu);
            observations.push(`Les acomptes versés dépassent l'impôt dû de ${excedent}. CE N'EST PAS UN REMBOURSEMENT À ENCAISSER : ` +
                "art. 57 ter LPF, « les crédits constatés à son compte courant fiscal PEUVENT, À SA DEMANDE, servir au " +
                "paiement d'autres impôts et droits dus ». Le crédit existe au compte courant fiscal du contribuable, " +
                "son emploi suppose une demande, et il s'impute sur d'autres impôts plutôt que de revenir en trésorerie.");
        }
        if (entree.impotDu !== null && entree.comptabilises > 0.005 && entree.declares > 0.005) {
            observations.push("À la liquidation, le 4492 se solde par imputation sur la dette d'impôt · art. 57 bis, al. 3 : « Ces trois " +
                "versements sont à déduire de l'impôt dû par le contribuable pour l'exercice fiscal considéré, le solde " +
                "éventuel de cet impôt devant être versé au moment du dépôt de la déclaration y afférente. » Un 4492 " +
                "laissé débiteur après liquidation porte à l'actif une avance qui a déjà éteint la dette : elle est " +
                "comptée deux fois, et le bilan boucle quand même.");
        }
        return { declares: arrondir(entree.declares), comptabilises: arrondir(entree.comptabilises), ecart, excedent, observations };
    }
    static reintegrationsImpot(retraitements) {
        return arrondir(retraitements
            .filter((r) => r.code === 'IMPOT_SUR_LE_RESULTAT' && r.sens === client_1.SensRetraitementFiscal.REINTEGRATION)
            .reduce((s, r) => s + Number(r.montant), 0));
    }
    static observationImpotNonReintegre(impotConstateAu89, reintegrations) {
        const ecart = arrondir(impotConstateAu89 - reintegrations);
        if (Math.abs(ecart) < 0.005)
            return null;
        return (`IMPÔT NON RÉINTÉGRÉ À SA MESURE · les comptes 891, 892 et 895 portent ${(0, ecriture_impot_resultat_1.montantFiscal)(impotConstateAu89)} au débit ` +
            `du livre-journal, la réintégration « Impôt sur les sociétés et impôt minimum comptabilisés en charges » vaut ` +
            `${(0, ecriture_impot_resultat_1.montantFiscal)(reintegrations)} (écart ${(0, ecriture_impot_resultat_1.montantFiscal)(ecart)}). L'impôt sur les sociétés et le minimum forfaitaire de ` +
            "perception ne sont pas déductibles (loi n° 23/053, art. 45 et art. 50, 2°) · tant que la réintégration n'égale pas " +
            "l'impôt constaté, le résultat fiscal et l'impôt calculés ici sont faux de cet écart. Ajustez la réintégration ; un " +
            "impôt comptabilisé hors du 89 et réintégré à raison se range sous une ligne libre, ou sa charge se reclasse au 89.");
    }
    static observationDegrevement(degrevementsAu899) {
        if (Math.abs(degrevementsAu899) < 0.005)
            return null;
        return (`DÉGRÈVEMENT AU 899 · ${(0, ecriture_impot_resultat_1.montantFiscal)(degrevementsAu899)} crédités en « Dégrèvements et annulations d'impôts sur ` +
            "résultats antérieurs ». Son traitement fiscal relève du cabinet · l'art. 45 de la loi n° 23/053 ne fait entrer en " +
            "recette que les dégrèvements « sur les impôts déductibles », et aucun texte ne dit expressément le sort de celui de " +
            "l'impôt sur les sociétés. Rien n'est déduit d'office ; une déduction se saisit en ligne libre, avec son fondement.");
    }
    async lireBalance(tenantId, exerciceId, arreteAu, inclureBrouillard = false) {
        const balance = await this.ecritureService.balance(tenantId, exerciceId, inclureBrouillard, arreteAu);
        const details = balance.lignes.filter((l) => l.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL);
        const gestion = (0, balance_trois_colonnes_1.avantSoldeDesComptesDeGestion)(details).filter((l) => /^[678]/.test(l.numero));
        const resultatClasses678 = gestion.reduce((s, l) => s - l.solde, 0);
        const lignes13 = details.filter((l) => (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero));
        const resultatCompte13 = lignes13.reduce((s, l) => s - l.solde, 0);
        const gestionNonSoldee = gestion.some((l) => Math.abs(l.solde) > 0.005);
        const mouvementPropre13 = lignes13.some((l) => Math.abs(l.mouvementDebit) > 0.005 ||
            Math.abs(l.mouvementCredit) > 0.005 ||
            Math.abs(l.clotureDebit ?? 0) > 0.005 ||
            Math.abs(l.clotureCredit ?? 0) > 0.005);
        const reportAuCompte13 = lignes13.reduce((s, l) => s + (l.reportCredit ?? 0) - (l.reportDebit ?? 0), 0);
        const avantCloture = (0, resultat_de_l_exercice_1.resultatDeLExerciceAuxClassesDeGestion)(gestionNonSoldee, mouvementPropre13);
        const chiffreAffaires = details
            .filter((l) => correspondance_compte_resultat_syscohada_1.PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA.some((p) => l.numero.startsWith(p)))
            .reduce((s, l) => s + l.mouvementCredit - l.mouvementDebit, 0);
        const acomptesAu4492 = details
            .filter((l) => l.numero.startsWith('4492'))
            .reduce((s, l) => s + l.solde, 0);
        const impotConstateAu89 = gestion
            .filter((l) => ['891', '892', '895'].some((p) => l.numero.startsWith(p)))
            .reduce((s, l) => s + l.totalDebit, 0);
        const degrevementsAu899 = gestion
            .filter((l) => l.numero.startsWith('899'))
            .reduce((s, l) => s - l.solde, 0);
        const impotExerciceAu89 = gestion
            .filter((l) => l.numero.startsWith('891') || l.numero.startsWith('895'))
            .reduce((s, l) => s + l.solde, 0);
        return {
            resultatComptable: arrondir(avantCloture ? resultatClasses678 : resultatCompte13),
            sourceResultat: avantCloture ? 'CLASSES_6_7_8' : 'COMPTE_13',
            reportAuCompte13: avantCloture || Math.abs(resultatCompte13) <= 0.005 ? 0 : arrondir(reportAuCompte13),
            chiffreAffaires: arrondir(chiffreAffaires),
            acomptesAu4492: arrondir(acomptesAu4492),
            impotConstateAu89: arrondir(impotConstateAu89),
            degrevementsAu899: arrondir(degrevementsAu899),
            impotExerciceAu89: arrondir(impotExerciceAu89),
        };
    }
    async propositionsRetraitements(tenantId, exerciceId) {
        await this.tenantSyscohada(tenantId);
        await this.exerciceDuDossier(tenantId, exerciceId);
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, codeRetraitementFiscal: { not: null } },
            select: { id: true, numero: true, intitule: true, codeRetraitementFiscal: true },
            orderBy: { numero: 'asc' },
        });
        if (!comptes.length)
            return { propositions: [], avertissements: [], chiffreAffaires: 0 };
        const [mouvements, brut] = await Promise.all([
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: {
                    compteId: { in: comptes.map((c) => c.id) },
                    ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false },
                },
                _sum: { debit: true, credit: true },
            }),
            this.resultatFiscalBrut(tenantId, exerciceId),
        ]);
        const parCompte = new Map(mouvements.map((m) => [m.compteId, m]));
        const lignes = comptes.flatMap((c) => {
            const definition = catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS.find((d) => d.code === c.codeRetraitementFiscal);
            if (!definition)
                return [];
            const m = parCompte.get(c.id);
            const mouvement = arrondir(Number(m?._sum.debit ?? 0) - Number(m?._sum.credit ?? 0));
            if (mouvement <= 0)
                return [];
            return [{ compte: c, definition, mouvement }];
        });
        const horsPortee = lignes.filter((l) => l.definition.assietteHorsPortee);
        const proposables = lignes.filter((l) => !l.definition.assietteHorsPortee);
        const avertissements = horsPortee.map((l) => ({
            compteId: l.compte.id,
            numero: l.compte.numero,
            intitule: l.compte.intitule,
            code: l.definition.code,
            libelle: l.definition.libelle,
            source: l.definition.source,
            mouvement: l.mouvement,
            motif: l.definition.assietteHorsPortee,
        }));
        const cumulParCode = new Map();
        for (const l of proposables) {
            if (l.definition.plafond?.assiette !== 'CHIFFRE_AFFAIRES')
                continue;
            cumulParCode.set(l.definition.code, arrondir((cumulParCode.get(l.definition.code) ?? 0) + l.mouvement));
        }
        const plafondsFermes = new Set();
        for (const [code, cumul] of cumulParCode) {
            const definition = catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get(code);
            if (!definition?.conditionResultatNetPositif)
                continue;
            if (!this.droitADeductionOuvert(brut, code, cumul).ouvert)
                plafondsFermes.add(code);
        }
        const excedentsRepartis = this.repartirExcedentPlafonne(proposables, cumulParCode, brut.chiffreAffaires, plafondsFermes);
        const propositions = proposables.flatMap((l) => {
            const plafond = l.definition.plafond;
            const cumulNature = cumulParCode.get(l.definition.code) ?? null;
            const conditionFermee = plafondsFermes.has(l.definition.code);
            const montant = !plafond
                ? l.mouvement
                : plafond.assiette === 'CHIFFRE_AFFAIRES'
                    ? (excedentsRepartis.get(l.compte.id) ?? 0)
                    : arrondir(Math.max(l.mouvement - arrondir(plafond.part * l.mouvement), 0));
            if (montant <= 0)
                return [];
            const partagee = plafond?.assiette === 'CHIFFRE_AFFAIRES' && cumulNature !== null && cumulNature > l.mouvement;
            return [
                {
                    compteId: l.compte.id,
                    numero: l.compte.numero,
                    intitule: l.compte.intitule,
                    code: l.definition.code,
                    sens: l.definition.sens,
                    libelle: l.definition.libelle,
                    source: l.definition.source,
                    mouvement: l.mouvement,
                    plafondEnonce: !plafond
                        ? null
                        : [
                            conditionFermee
                                ? `${plafond.enonce} · SANS EFFET ICI`
                                : partagee
                                    ? `${plafond.enonce} · plafond commun à ${cumulNature.toLocaleString('fr-FR')} de charges de cette nature, réparti au prorata`
                                    : plafond.enonce,
                            conditionFermee ? this.enonceConditionFermee(l.definition.code, brut, cumulNature ?? 0) : null,
                            plafond.assiette === 'CHIFFRE_AFFAIRES' ? exports.LECTURE_CHIFFRE_AFFAIRES : null,
                        ]
                            .filter(Boolean)
                            .join(' · '),
                    montantAdmis: !plafond ? null : arrondir(l.mouvement - montant),
                    mouvementNature: plafond?.assiette === 'CHIFFRE_AFFAIRES' ? cumulNature : null,
                    montantAdmisNature: plafond?.assiette === 'CHIFFRE_AFFAIRES'
                        ? conditionFermee
                            ? 0
                            : arrondir(plafond.part * brut.chiffreAffaires)
                        : null,
                    montant,
                },
            ];
        });
        return { propositions, avertissements, chiffreAffaires: brut.chiffreAffaires };
    }
    droitADeductionOuvert(brut, code, versements) {
        const dejaReintegre = arrondir(brut.retraitements
            .filter((r) => r.code === code && r.sens === client_1.SensRetraitementFiscal.REINTEGRATION)
            .reduce((somme, r) => somme + Number(r.montant), 0));
        const resultatAvantVersements = arrondir(brut.resultatFiscalBrut + versements - dejaReintegre);
        return { ouvert: resultatAvantVersements > 0.005, resultatAvantVersements, dejaReintegre };
    }
    conditionPlafondPourEcran(definition, brut) {
        const condition = definition.conditionResultatNetPositif;
        if (!condition)
            return { ouverte: true, enonce: null };
        const { dejaReintegre } = this.droitADeductionOuvert(brut, definition.code, 0);
        const seuilVersements = arrondir(dejaReintegre - brut.resultatFiscalBrut);
        if (seuilVersements < 0.005) {
            return {
                ouverte: true,
                enonce: `${condition.source} : « ${condition.enonce} » La condition de résultat (2°) est remplie sur cet exercice. Celle du relevé (1°) ne se lit dans aucune comptabilité · OmegaX ne peut pas la vérifier, elle reste à joindre à la déclaration.`,
            };
        }
        return {
            ouverte: false,
            enonce: `${condition.source} : « ${condition.enonce} » Le résultat fiscal de cet exercice, retraitements saisis compris, est de ${brut.resultatFiscalBrut.toLocaleString('fr-FR')} : la déduction n'est ouverte que si ces versements dépassent ${seuilVersements.toLocaleString('fr-FR')}. Au-dessous, AUCUN n'est déductible et la totalité se réintègre · le plafond est servi à zéro pour cette raison.`,
        };
    }
    enonceConditionFermee(code, brut, versements) {
        const definition = catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get(code);
        const condition = definition?.conditionResultatNetPositif;
        const { resultatAvantVersements } = this.droitADeductionOuvert(brut, code, versements);
        return `${condition?.source ?? 'Loi n° 23/053, art. 44, al. 2'} : « ${condition?.enonce ?? ''} » Le résultat net imposable avant déduction de ces versements est de ${resultatAvantVersements.toLocaleString('fr-FR')} : la condition n'est PAS remplie, aucun versement n'est déductible et la totalité se réintègre. Le plafond ne joue pas.`;
    }
    repartirExcedentPlafonne(lignes, cumulParCode, chiffreAffaires, plafondsFermes = new Set()) {
        const excedents = new Map();
        for (const [code, cumul] of cumulParCode) {
            const definition = catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get(code);
            if (!definition?.plafond)
                continue;
            const admisNature = plafondsFermes.has(code) ? 0 : arrondir(definition.plafond.part * chiffreAffaires);
            const excedentNature = arrondir(Math.max(cumul - admisNature, 0));
            const comptes = lignes.filter((l) => l.definition.code === code);
            let reparti = 0;
            comptes.forEach((l, index) => {
                const dernier = index === comptes.length - 1;
                const part = dernier || cumul <= 0 ? arrondir(excedentNature - reparti) : arrondir((excedentNature * l.mouvement) / cumul);
                reparti = arrondir(reparti + part);
                excedents.set(l.compte.id, Math.max(part, 0));
            });
        }
        return excedents;
    }
    static debutPeriodeImposable(exercice, periode) {
        return periode ? new Date(Date.UTC(periode.annee + 1, 0, 1)) : exercice.dateDebut;
    }
    avertissementsPerimetreLoi(dateDebutExercice, periode = null) {
        const avertissements = [
            "PÉRIMÈTRE TERRITORIAL NON DÉCOUPÉ (art. 7 et art. 51, alinéa 3). Le résultat fiscal calculé ici part du résultat COMPTABLE de la balance, dans son entier. OmegaX ne porte ni la source d'un produit ni le lieu d'une exploitation, et LE SENS DE LA CORRECTION DÉPEND DU RÉSULTAT DE L'EXPLOITATION ÉTRANGÈRE · les deux articles jouent en sens inverse. Si elle est BÉNÉFICIAIRE, l'article 7 ne retient « uniquement » que les bénéfices réalisés dans les entreprises exploitées ou sur les opérations réalisées en République Démocratique du Congo, plus ceux qu'une convention de double imposition attribue à la RDC : la base affichée est TROP LARGE, à retrancher par une déduction. Si elle est DÉFICITAIRE, l'article 51, alinéa 3 dispose que « les pertes subies dans les entreprises exploitées hors de la République Démocratique du Congo ne sont pas déductibles du bénéfice imposable des entreprises exploitées en République Démocratique du Congo » : la perte étrangère est déjà entrée dans le résultat comptable, la base est alors TROP ÉTROITE, et il faut la RÉINTÉGRER. Dans les deux cas, pièce à l'appui.",
        ];
        if (periode && !periode.sousLaLoi) {
            avertissements.push(`PREMIER EXERCICE LONG OUVERT AVANT LA LOI (art. 12, al. 3 et art. 153). La période de création, du ${periode.dateDebut.toISOString().slice(0, 10)} au ${periode.dateFin.toISOString().slice(0, 10)}, est imposée à part et relève du texte qui régissait ${periode.annee}, que le dossier ne contient pas · son impôt n'est PAS calculé ici, et ses bénéfices, lus au livre-journal ou déclarés, viennent seulement en déduction du premier exercice clos. L'impôt affiché est celui du premier exercice clos, période imposable ${periode.annee + 1}, sous la loi n° 23/053 en vigueur depuis le 1er janvier 2026.`);
        }
        else if (!periode && dateDebutExercice.getTime() < entree_en_vigueur_loi_23_053_1.ENTREE_EN_VIGUEUR_LOI_23_053.getTime()) {
            avertissements.push(`EXERCICE ANTÉRIEUR À L'ENTRÉE EN VIGUEUR DE LA LOI. Cet exercice ouvre le ${dateDebutExercice.toISOString().slice(0, 10)}, avant le 1er janvier 2026, date à laquelle la loi n° 23/053 du 30 novembre 2023 est entrée en vigueur. Tout ce qui est calculé ci-dessous en vient : l'assiette, le catalogue des retraitements, le taux, le minimum de perception et le report déficitaire. Le texte applicable à cet exercice n'est PAS celui-ci et n'est pas dans OmegaX · ce chiffre est une SIMULATION sous la loi de 2026, pas le résultat fiscal de l'exercice. Il ne doit servir ni de déclaration, ni de base à un report déficitaire imputé sur un exercice postérieur, ni de BASE AUX ACOMPTES PROVISIONNELS de l'exercice suivant · l'art. 57 bis LPF les assied sur « l'impôt déclaré au titre de l'exercice précédent », c'est-à-dire sur l'impôt effectivement déclaré pour cet exercice-ci, sous le texte qui le régissait.`);
        }
        return avertissements;
    }
    async resultatFiscalBrut(tenantId, exerciceId) {
        const [lecture, retraitements] = await Promise.all([
            this.lireBalance(tenantId, exerciceId),
            this.prisma.retraitementFiscal.findMany({ where: { tenantId, exerciceId }, orderBy: { createdAt: 'asc' } }),
        ]);
        const somme = (sens) => retraitements.filter((r) => r.sens === sens).reduce((s, r) => s + Number(r.montant), 0);
        const totalReintegrations = arrondir(somme(client_1.SensRetraitementFiscal.REINTEGRATION));
        const totalDeductions = arrondir(somme(client_1.SensRetraitementFiscal.DEDUCTION));
        return {
            ...lecture,
            retraitements,
            totalReintegrations,
            totalDeductions,
            resultatFiscalBrut: arrondir(lecture.resultatComptable + totalReintegrations - totalDeductions),
        };
    }
    async deficitsAnterieursCalcules(tenantId, exercice, physique) {
        const precedents = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { lt: exercice.dateDebut } },
            orderBy: { dateDebut: 'desc' },
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
        });
        const premierId = precedents.length
            ? [...precedents].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())[0].id
            : null;
        const dossiers = precedents.length
            ? await this.prisma.dossierFiscalExercice.findMany({
                where: { tenantId, exerciceId: { in: precedents.map((e) => e.id) } },
            })
            : [];
        const dossierDe = new Map(dossiers.map((d) => [d.exerciceId, d]));
        const rejoues = [];
        for (const ex of precedents) {
            const d = dossierDe.get(ex.id);
            const { base, debutImposable } = await this.baseAvantReport(tenantId, ex, ex.id === premierId && !physique, d ?? null);
            rejoues.push({
                exerciceId: ex.id,
                dateDebut: ex.dateDebut,
                dateFin: ex.dateFin,
                base,
                debutImposable,
                ouvertureDeclaree: d?.deficitAnterieurSaisi === null || d?.deficitAnterieurSaisi === undefined
                    ? null
                    : {
                        montant: Number(d.deficitAnterieurSaisi),
                        origines: FiscaliteService_1.originesDeclarees(d.deficitAnterieurOrigines, Number(d.deficitAnterieurSaisi)),
                    },
            });
        }
        const { detail, perdusParPrudence } = (0, report_deficitaire_1.rejouerReport)(rejoues, exercice, parametres_fiscaux_1.IMPOT_SOCIETES.exercicesReportDeficit);
        return {
            total: arrondir(detail.reduce((s, d) => s + d.montant, 0)),
            detail,
            avertissements: [
                ...(0, report_deficitaire_1.avertissementsReportDeclare)(detail, perdusParPrudence, new Set(precedents.filter((e) => e.statut === client_1.StatutExercice.CLOTURE).map((e) => e.id))),
                ...[(0, report_deficitaire_1.avertissementExercicesNonJointifs)(precedents, exercice, parametres_fiscaux_1.IMPOT_SOCIETES.exercicesReportDeficit)].filter((a) => a !== null),
            ],
        };
    }
    static originesDeclarees(brut, montantSaisi) {
        if (!Array.isArray(brut) || brut.length === 0)
            return null;
        const lues = brut.map((o) => {
            const x = o;
            const date = typeof x.dateFin === 'string' ? new Date(`${x.dateFin.slice(0, 10)}T00:00:00Z`) : null;
            return { dateFin: date, montant: Number(x.montant) };
        });
        if (lues.some((o) => !o.dateFin || Number.isNaN(o.dateFin.getTime()) || !Number.isFinite(o.montant)))
            return null;
        if (Math.abs(arrondir(lues.reduce((t, o) => t + o.montant, 0)) - arrondir(montantSaisi)) >= 0.005)
            return null;
        return lues;
    }
    async baseAvantReport(tenantId, exercice, appliquerArticle12, dossier) {
        const brut = (await this.resultatFiscalBrut(tenantId, exercice.id)).resultatFiscalBrut;
        const periode = appliquerArticle12 ? (0, periode_creation_1.periodeDeCreation)(exercice, true) : null;
        const debutImposable = FiscaliteService_1.debutPeriodeImposable(exercice, periode);
        if (!periode)
            return { base: brut, debutImposable };
        const lecture = await this.lirePeriodeCreation(tenantId, exercice.id, periode, dossier);
        return { base: arrondir(brut - (0, periode_creation_1.deductionPeriodeCreation)(lecture.resultatFiscal)), debutImposable };
    }
    async lirePeriodeCreation(tenantId, exerciceId, periode, dossier) {
        const lecture = await this.lireBalance(tenantId, exerciceId, periode.dateFin);
        const resultatComptable = arrondir(lecture.resultatComptable + lecture.impotConstateAu89);
        const saisi = dossier?.resultatPeriodeCreationSaisi;
        const declare = saisi === null || saisi === undefined ? null : arrondir(Number(saisi));
        const caSaisi = dossier?.chiffreAffairesPeriodeCreationSaisi;
        const caDeclare = declare === null || caSaisi === null || caSaisi === undefined ? null : arrondir(Number(caSaisi));
        return {
            resultatComptable,
            impotNeutralise: lecture.impotConstateAu89,
            chiffreAffaires: caDeclare ?? lecture.chiffreAffaires,
            chiffreAffairesLu: lecture.chiffreAffaires,
            sourceChiffreAffaires: caDeclare === null ? 'LIVRE_JOURNAL' : 'DECLARE',
            resultatFiscal: declare ?? resultatComptable,
            source: declare === null ? 'LIVRE_JOURNAL' : 'DECLARE',
            ecartDeclaration: declare === null ? null : arrondir(declare - resultatComptable),
        };
    }
    trancheSelonChiffreAffaires(chiffreAffaires) {
        const p = parametres_fiscaux_1.IMPOT_REVENU_PERSONNES_PHYSIQUES;
        if (chiffreAffaires <= p.seuilMicroEntreprise)
            return 'IRPP_MICRO_ENTREPRISE';
        if (chiffreAffaires <= p.seuilPetiteEntreprise)
            return 'IRPP_PETITE_ENTREPRISE';
        return 'IRPP_REGIME_REEL';
    }
    regimePhysiqueSelonHistorique(chiffresAffaires) {
        const trancheExercice = this.trancheSelonChiffreAffaires(chiffresAffaires[chiffresAffaires.length - 1]);
        let regime = this.trancheSelonChiffreAffaires(chiffresAffaires[0]);
        let exercicesSousLeSeuil = 0;
        for (const ca of chiffresAffaires.slice(1)) {
            const tranche = this.trancheSelonChiffreAffaires(ca);
            const rang = ECHELLE_REGIMES_PHYSIQUES.indexOf(regime);
            const rangTranche = ECHELLE_REGIMES_PHYSIQUES.indexOf(tranche);
            if (rangTranche > rang) {
                regime = tranche;
                exercicesSousLeSeuil = 0;
            }
            else if (rangTranche < rang) {
                exercicesSousLeSeuil += 1;
                if (exercicesSousLeSeuil >= 2) {
                    regime = ECHELLE_REGIMES_PHYSIQUES[rang - 1];
                    exercicesSousLeSeuil = 0;
                }
            }
            else {
                exercicesSousLeSeuil = 0;
            }
        }
        return { regime, trancheExercice, maintenu: regime !== trancheExercice, exercicesSousLeSeuil };
    }
    observationsRegimePhysique(regime, suivi, nombreExercicesAnterieurs) {
        const observations = [];
        const nom = {
            IRPP_MICRO_ENTREPRISE: 'des micro-entreprises',
            IRPP_PETITE_ENTREPRISE: 'des petites entreprises',
            IRPP_REGIME_REEL: 'réel',
        };
        if (suivi.maintenu) {
            observations.push(`Art. 113 : le chiffre d'affaires de cet exercice relève de la tranche ${nom[suivi.trancheExercice]}, mais le régime ${nom[regime]} est MAINTENU. Le déclassement « n'intervient que lorsque leur chiffre d'affaires est resté en dessous de cette limite pendant deux exercices consécutifs », et d'un seul cran vers le régime immédiatement inférieur. ${suivi.exercicesSousLeSeuil === 1 ? "Premier exercice sous le seuil : un second, consécutif, ouvrira le déclassement." : ''}`.trim());
        }
        if (nombreExercicesAnterieurs >= parametres_fiscaux_1.EXERCICES_OBSERVES_REGIME) {
            observations.push(`Art. 113 : le régime est reconstitué sur les ${parametres_fiscaux_1.EXERCICES_OBSERVES_REGIME} exercices antérieurs tenus dans ce dossier, le plus ancien d'entre eux étant supposé relever de la tranche que commande son chiffre d'affaires. Si l'entreprise est plus ancienne que cette fenêtre, contrôler cette hypothèse de départ avant de conclure.`);
        }
        if (nombreExercicesAnterieurs === 0) {
            observations.push("Aucun exercice antérieur n'est tenu dans ce dossier : le régime est déterminé sur le seul chiffre d'affaires de l'exercice. Si l'entreprise était suivie ailleurs, vérifier l'art. 113 avant de conclure · un déclassement suppose deux exercices consécutifs sous le seuil, une montée de régime est en revanche immédiate.");
        }
        if (regime === 'IRPP_MICRO_ENTREPRISE') {
            observations.push("Art. 64, 3° et art. 108 : sont EXEMPTÉS de l'Impôt sur le Revenu des Personnes Physiques, et exclus du régime des micro-entreprises, « les contribuables dispensés de l'obligation d'obtenir la patente conformément à la législation sur le petit commerce ». L'art. 108 les énumère : petits cultivateurs et petits éleveurs qui viennent occasionnellement vendre sur les marchés publics, petits marchands ambulants de produits de consommation courante, cireurs de chaussures, vendeurs de journaux à la criée, petits vendeurs à domicile. Cette dispense est un fait administratif qu'aucune écriture ne porte · OmegaX ne peut pas la connaître. Si le dossier relève de l'une de ces figures, il n'y a ni régime ni impôt, et le forfait annoncé ici ne lui est pas dû.");
        }
        if (regime === 'IRPP_PETITE_ENTREPRISE') {
            observations.push("Art. 110 et 111 : si l'entreprise a opté par écrit pour le régime réel auprès de son service gestionnaire avant le 1er février, cette option prime · elle vaut pour l'année et les deux suivantes et demeure irrévocable pendant cette période. OmegaX ne peut pas la connaître, aucune écriture ne la porte : dans ce cas, ni l'impôt ci-dessous ni le calendrier de paiement ne sont ceux du dossier. En cas de non-respect des obligations du régime réel, l'art. 111 ramène d'office au régime des petites entreprises.");
        }
        return observations;
    }
    async chiffresAffairesAnterieurs(tenantId, exercice) {
        const precedents = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { lt: exercice.dateDebut } },
            orderBy: { dateDebut: 'desc' },
            take: parametres_fiscaux_1.EXERCICES_OBSERVES_REGIME,
        });
        const chronologiques = [...precedents].reverse();
        const lectures = await Promise.all(chronologiques.map((e) => this.lireBalance(tenantId, e.id)));
        return lectures.map((l) => l.chiffreAffaires);
    }
    regimeSelonForme(forme, chiffreAffaires, chiffresAffairesAnterieurs, faits = {}) {
        const observations = [];
        const physique = forme !== null && correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(forme);
        if (physique) {
            const p = parametres_fiscaux_1.IMPOT_REVENU_PERSONNES_PHYSIQUES;
            const suivi = this.regimePhysiqueSelonHistorique([...chiffresAffairesAnterieurs, chiffreAffaires]);
            const regime = suivi.regime;
            if (regime === 'IRPP_MICRO_ENTREPRISE') {
                observations.push(`Régime des micro-entreprises (art. 107) : chiffre d'affaires hors taxes au plus égal à ${p.seuilMicroEntreprise.toLocaleString('fr-FR')} FC. Impôt forfaitaire annuel fixé par arrêté (art. 128), non redevable du minimum de perception (art. 122).`);
            }
            else if (regime === 'IRPP_PETITE_ENTREPRISE') {
                observations.push(`Régime des petites entreprises (art. 109) : chiffre d'affaires hors taxes de ${(p.seuilMicroEntreprise + 1).toLocaleString('fr-FR')} à ${p.seuilPetiteEntreprise.toLocaleString('fr-FR')} FC. Impôt assis sur le chiffre d'affaires, 1 % pour la vente et 2 % pour les prestations (art. 127).`);
            }
            else {
                observations.push(`Régime réel (art. 112) : chiffre d'affaires hors taxes supérieur à ${p.seuilPetiteEntreprise.toLocaleString('fr-FR')} FC. Le résultat fiscal déterminé ici est le bénéfice professionnel catégoriel ; le barème progressif de l'art. 118 s'applique au REVENU NET GLOBAL du contribuable, que ce dossier ne détient pas. Le minimum de perception de 1 % du chiffre d'affaires reste dû (art. 122).`);
            }
            observations.push(...this.observationsRegimePhysique(regime, suivi, chiffresAffairesAnterieurs.length));
            observations.push(...exports.OBSERVATIONS_PHYSIQUE_PASSE_F5.commun);
            if (regime !== 'IRPP_MICRO_ENTREPRISE' && regime !== 'IRPP_PETITE_ENTREPRISE') {
                observations.push(...exports.OBSERVATIONS_PHYSIQUE_PASSE_F5.regimeReel);
            }
            return { regime, observations };
        }
        switch (forme) {
            case client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF:
            case client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE:
                observations.push("Société de personnes : l'impôt sur les sociétés ne s'applique que SUR OPTION, irrévocable, levée en assemblée générale et notifiée dans les trois mois du début de l'exercice (art. 4). Sans option, les bénéfices sont imposés dans le chef des associés. Le calcul ci-dessous suppose l'option levée.");
                break;
            case client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE:
                observations.push("Groupement d'intérêt économique : exonéré pour la quote-part de bénéfice distribuée à ses membres personnes physiques (art. 6). Le calcul ci-dessous porte sur la totalité du résultat · retrancher cette quote-part par une déduction, avec le relevé des membres en commentaire.");
                break;
            case client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE:
                observations.push("Société coopérative : soumise à l'impôt sur les sociétés à raison de son activité (art. 3), SAUF les coopératives de production, de transformation, de conservation et de vente de produits agricoles, de l'élevage et de la pêche et leurs unions « fonctionnant conformément aux dispositions légales qui les régissent, lorsqu'elles revêtent la FORME CIVILE » (art. 5, 2°) · deux conditions cumulatives qu'aucun champ du dossier ne porte, le champ « forme juridique » désignant la coopérative au sens de l'Acte uniforme et non la forme civile au sens fiscal. RISTOURNES : l'art. 11, 3° n'en réintègre que DEUX catégories, celles versées « aux associés, en tant que ristournes et avantages provenant d'achats ou de ventes effectués par les NON-ASSOCIÉS » et celles versées « aux non-associés ». La ristourne servie à un associé sur ses propres opérations avec la coopérative, qui est la ristourne ordinaire, n'y figure pas · ne pas réintégrer le compte en bloc.");
                break;
            case client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE:
                observations.push("Entité publique : imposable si elle se livre à une exploitation lucrative (art. 3) ; exemptés, l'État, les Provinces, les ETD, les établissements publics en vertu de leurs statuts et les organismes dont les ressources proviennent uniquement de subventions budgétaires (art. 5).");
                break;
            case client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME:
            case client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
            case client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE: {
                const observation = observationArticle63(unipersonnaliteDeLArticle63({ formeJuridiqueSyscohada: forme, ...faits }));
                if (observation)
                    observations.push(observation);
                break;
            }
            case client_1.FormeJuridiqueSyscohada.SUCCURSALE:
                observations.push("Succursale : la forme ne dit ni si son propriétaire est une société ou une personne physique (AUSCGIE, art. 116), ni s'il est étranger (art. 118) · ses droits et obligations sont compris dans le patrimoine du propriétaire (art. 117). SI ce propriétaire est une société non-résidente, la succursale est un établissement stable imposable en RDC (loi n° 23/053, art. 7 et 8), et les frais généraux du siège se trouvant à l'étranger ne sont pas déductibles (art. 50, 7°) · voir la réintégration correspondante.");
                break;
            case null:
                observations.push("La forme juridique OHADA du dossier n'est pas renseignée (Structure > Paramètres du dossier > Forme juridique). Le calcul suppose une personne morale à l'impôt sur les sociétés · une entreprise individuelle ou un entreprenant relève d'un autre régime.");
                break;
            default:
                break;
        }
        return { regime: 'IMPOT_SOCIETES', observations };
    }
    avertissementsReportDeficitaire(deficitAnterieur) {
        if (deficitAnterieur <= 0.005)
            return [];
        return [
            "Art. 51, al. 2 : le report est PERDU pour un exercice dont la déclaration n'a pas été souscrite après une mise en demeure de déclarer. Une mise en demeure est un acte de l'Administration, qu'aucune écriture ne porte · OmegaX ne peut pas la connaître. Vérifier, exercice par exercice, qu'aucun des déficits imputés ci-dessus ne tombe sous cette déchéance.",
            "Art. 52, 1° : le report déficitaire n'est pas applicable au nouvel exploitant qui a acheté une entreprise déficitaire, ni lorsque l'entreprise a changé complètement d'activité ou subi des transformations telles qu'elle n'est plus en réalité la même. Ces faits ne se lisent pas davantage dans la comptabilité : si l'un d'eux s'est produit, ramener le déficit antérieur à zéro par la saisie manuelle.",
        ];
    }
    observationsCalendrierPaiement(regime, impotDu, contexte) {
        const acomptes = [];
        if (contexte.acomptesDus && impotDu !== null) {
            if (contexte.periodeCreation) {
                const { periode, impotDu: impotPeriode } = contexte.periodeCreation;
                acomptes.push(impotPeriode === null
                    ? `Art. 12, al. 3 et art. 57 bis LPF : les acomptes des 25 juillet, 25 septembre et 25 novembre ${periode.annee + 1} sont assis sur l'impôt déclaré pour la période de création (${periode.annee}), établi sous le texte de l'époque · OmegaX ne le connaît pas et ne les chiffre pas. Ils restent dus · calculez-les sur l'impôt réellement déclaré, et imputez-les sur l'impôt ci-dessous.`
                    : `Art. 12, al. 3 et art. 57 bis LPF : l'impôt de la période de création (${impotPeriode.toLocaleString('fr-FR')}) est l'impôt déclaré de l'exercice précédent · augmenté des suppléments établis sur lui, il fonde les acomptes des 25 juillet, 25 septembre et 25 novembre ${periode.annee + 1}, servis dans « Acomptes de l'exercice », imputés sur l'impôt du premier exercice clos (al. 3). Les trois montants « du prochain exercice » sont ceux de ${periode.annee + 2}.`);
            }
            else if (contexte.sansExerciceAnterieur) {
                acomptes.push("Art. 57 bis, al. 1er : les acomptes sont « calculés sur base de l'impôt déclaré au titre de l'exercice précédent ». Aucun exercice antérieur n'est tenu dans ce dossier · à défaut d'exercice précédent, cette base n'existe pas et AUCUN acompte n'est dû au titre de la présente année. Les trois montants ci-dessous sont ceux du PROCHAIN exercice. Si l'entreprise était suivie ailleurs, l'exercice précédent existe hors du dossier et ses acomptes restent dus : le vérifier avant de conclure. La fenêtre Retenues et déclarations présente pour sa part les trois échéances d'acompte à tout dossier SYSCOHADA, sans montant · ce sont des dates de calendrier, pas une somme à verser.");
            }
            acomptes.push("Art. 57 bis, al. 1er : la base des acomptes est l'impôt déclaré au titre de l'exercice précédent, augmenté des suppléments établis par l'Administration, « ou, en cas d'absence de déclaration, [de] l'impôt reconstitué d'office, que ces sommes fassent ou non l'objet de contestation ». " + (contexte.simulationAvantLaLoi ? "La base servie ci-dessous N'EST PAS la base légale : cet exercice est antérieur au 1er janvier 2026, l'impôt liquidé ici est une SIMULATION sous la loi n° 23/053, et l'impôt DÉCLARÉ pour cet exercice, qui seul fonde les acomptes, n'est pas dans OmegaX. Les trois montants ne valent qu'ordre de grandeur · calculer les acomptes sur l'impôt réellement déclaré." : "La base servie ci-dessous est la première branche · l'impôt liquidé ici, plus les suppléments saisis.") + " SI L'EXERCICE PRÉCÉDENT N'A PAS ÉTÉ DÉCLARÉ, la base légale est l'impôt reconstitué d'office par l'Administration, qui REMPLACE l'impôt déclaré au lieu de s'y ajouter : OmegaX ne peut pas le connaître, aucune écriture ne le porte, et le champ « suppléments » est additif. Dans ce cas, calculer les acomptes sur l'impôt reconstitué hors du logiciel · l'art. 98 bis punit « le défaut ou l'insuffisance de paiement de l'acompte provisionnel » d'une amende de 50 % de l'acompte non versé.");
        }
        if (regime === 'IRPP_PETITE_ENTREPRISE') {
            const [premiere, seconde] = parametres_fiscaux_1.QUOTITES_PETITE_ENTREPRISE;
            return [
                `Loi de procédures fiscales, art. 57, al. 3 et 57 quater : l'impôt d'une petite entreprise est payé en DEUX QUOTITÉS, ${premiere.quotite * 100} % et ${seconde.quotite * 100} % de l'impôt dû, et non par acomptes provisionnels. La première est payée à la souscription de la déclaration auto liquidative, au plus tard le ${premiere.echeance} de l'année qui suit celle de la réalisation des revenus. Les acomptes des 25 juillet, 25 septembre et 25 novembre (art. 57 bis) ne visent que l'alinéa 2 de l'art. 57, c'est-à-dire l'impôt sur les sociétés et l'IRPP au régime réel : ils ne sont pas dus ici.`,
                ...(seconde.reserve ? [seconde.reserve] : []),
                ...acomptes,
            ];
        }
        if (regime === 'IRPP_MICRO_ENTREPRISE') {
            return [
                "Loi de procédures fiscales, art. 57 : une micro-entreprise acquitte le forfait annuel de l'art. 128 de la loi " +
                    "n° 23/053 et ne verse ni acompte provisionnel (art. 57, al. 2) ni quotité (art. 57, al. 3), ces deux modes " +
                    "visant d'autres régimes.",
                ...acomptes,
            ];
        }
        if (regime === 'IRPP_REGIME_REEL' && impotDu === null) {
            return [
                ...acomptes,
                "Loi de procédures fiscales, art. 57, al. 2 et 57 bis : l'IRPP au régime réel se paie bien par acomptes provisionnels, mais leur base est l'impôt DÉCLARÉ de l'exercice précédent, augmenté des suppléments établis par l'Administration. Cet impôt dépend du barème progressif appliqué au revenu net global du contribuable, que ce dossier ne détient pas · les trois montants ne sont donc pas calculés ici, seule leur date est certaine (25 juillet, 25 septembre, 25 novembre).",
            ];
        }
        return acomptes;
    }
    async resultatFiscal(tenantId, exerciceId) {
        const tenant = await this.tenantSyscohada(tenantId);
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const [brut, dossier] = await Promise.all([
            this.resultatFiscalBrut(tenantId, exerciceId),
            this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId } }),
        ]);
        const acomptesVerses = Number(dossier?.acomptesVerses ?? 0);
        const supplementsAdministration = Number(dossier?.supplementsAdministration ?? 0);
        const supplementsPeriodeCreation = Number(dossier?.supplementsPeriodeCreation ?? 0);
        const deficitSaisi = dossier?.deficitAnterieurSaisi === null || dossier?.deficitAnterieurSaisi === undefined
            ? null
            : Number(dossier.deficitAnterieurSaisi);
        const anterieurs = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { lt: exercice.dateDebut } },
            orderBy: { dateDebut: 'desc' },
            take: 1,
        });
        const physique = tenant.formeJuridiqueSyscohada !== null && correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(tenant.formeJuridiqueSyscohada);
        const periode = physique ? null : (0, periode_creation_1.periodeDeCreation)(exercice, anterieurs.length === 0);
        const lecturePeriode = periode
            ? await this.lirePeriodeCreation(tenantId, exerciceId, periode, dossier)
            : null;
        const deductionCreation = lecturePeriode ? (0, periode_creation_1.deductionPeriodeCreation)(lecturePeriode.resultatFiscal) : 0;
        const baseAvantReport = arrondir(brut.resultatFiscalBrut - deductionCreation);
        const debutImposable = FiscaliteService_1.debutPeriodeImposable(exercice, periode);
        const simulationAvantLaLoi = debutImposable.getTime() < entree_en_vigueur_loi_23_053_1.ENTREE_EN_VIGUEUR_LOI_23_053.getTime();
        const calcules = deficitSaisi === null ? await this.deficitsAnterieursCalcules(tenantId, exercice, physique) : null;
        const saisieLue = deficitSaisi === null
            ? null
            : (0, report_deficitaire_1.partImputableDeLaSaisie)(deficitSaisi, FiscaliteService_1.originesDeclarees(dossier?.deficitAnterieurOrigines, deficitSaisi), exercice, parametres_fiscaux_1.IMPOT_SOCIETES.exercicesReportDeficit);
        const deficitAnterieur = saisieLue ? saisieLue.imputable : calcules.total;
        const deficitImpute = arrondir(Math.min(deficitAnterieur, Math.max(baseAvantReport, 0)));
        const resultatFiscal = arrondir(baseAvantReport - deficitImpute);
        const chiffresAffairesAnterieurs = physique ? await this.chiffresAffairesAnterieurs(tenantId, exercice) : [];
        const { regime, observations } = this.regimeSelonForme(tenant.formeJuridiqueSyscohada, brut.chiffreAffaires, chiffresAffairesAnterieurs, { associeUnique: tenant.associeUnique, associeUniquePersonneMorale: tenant.associeUniquePersonneMorale });
        observations.push(...this.avertissementsReportDeficitaire(deficitAnterieur));
        const deficitsSimules = (0, report_deficitaire_1.avertissementDeficitsSimules)(calcules?.detail ?? [], deficitSaisi !== null);
        if (deficitsSimules && deficitImpute > 0.005)
            observations.push(deficitsSimules);
        if (calcules)
            observations.push(...calcules.avertissements);
        if (saisieLue && saisieLue.horsFenetre.length) {
            observations.push(`PERTE DÉCLARÉE HORS FENÊTRE · ${saisieLue.horsFenetre
                .map((o) => `${(0, ecriture_impot_resultat_1.montantFiscal)(o.montant)} de l'exercice clos le ${o.dateFin.toISOString().slice(0, 10)}, report éteint le ${o.finDeFenetre.toISOString().slice(0, 10)}`)
                .join(', ')}. L'art. 51 ne reporte une perte que « jusqu'au troisième exercice qui suit l'exercice déficitaire » · cette part n'est pas imputée. Corrigez la saisie ou son origine.`);
        }
        observations.push(...this.avertissementsPerimetreLoi(exercice.dateDebut, periode));
        const finHorsDecembre = !(exercice.dateFin.getUTCMonth() === 11 && exercice.dateFin.getUTCDate() === 31);
        const precedentMemeAnnee = anterieurs.length > 0 && anterieurs[0].dateFin.getUTCFullYear() === exercice.dateFin.getUTCFullYear();
        const dissoute = !!tenant.dateDissolution &&
            (0, liquidation_societe_1.cotisationsDues)({ forme: tenant.formeJuridiqueSyscohada, dateDissolution: tenant.dateDissolution }) &&
            exercice.dateFin.getTime() >= tenant.dateDissolution.getTime();
        if (!dissoute && (finHorsDecembre || precedentMemeAnnee))
            observations.push(observationBilansSuccessifs(exercice.dateFin));
        const bornage = (0, liquidation_societe_1.echeancierDissolution)({
            forme: tenant.formeJuridiqueSyscohada,
            dateDissolution: tenant.dateDissolution,
            dateNominationLiquidateur: null,
            regimeLiquidation: tenant.regimeLiquidation,
            associeUniquePersonneMorale: tenant.associeUniquePersonneMorale,
            dateClotureLiquidation: tenant.dateClotureLiquidation,
        }, new Date());
        const anneeDesAcomptes = exercice.dateFin.getUTCFullYear() + 1;
        const CLES_ACOMPTES = ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'];
        const MOIS_ACOMPTES = { juillet: 6, septembre: 8, novembre: 10 };
        const acomptesRetenus = parametres_fiscaux_1.IMPOT_SOCIETES.acomptes.filter((a, i) => {
            const [jourDuMois, mois] = a.echeance.split(' ');
            if (!(mois in MOIS_ACOMPTES))
                throw new Error(`Échéance d'acompte illisible · ${a.echeance}`);
            return bornage.retenir(CLES_ACOMPTES[i], new Date(Date.UTC(anneeDesAcomptes, MOIS_ACOMPTES[mois], Number(jourDuMois))));
        });
        if (!dissoute && acomptesRetenus.length < parametres_fiscaux_1.IMPOT_SOCIETES.acomptes.length) {
            observations.push(`ACOMPTES APRÈS LA DISSOLUTION · ${parametres_fiscaux_1.IMPOT_SOCIETES.acomptes.length - acomptesRetenus.length} acompte(s) de ${anneeDesAcomptes} ` +
                'échoient après la dernière cotisation spéciale, ou après l’année de la dissolution · ils ne sont plus dus ' +
                '(LPF art. 57 bis ; loi n° 23/053, art. 13 al. 3) et ne sont pas servis.');
        }
        if (Math.abs(brut.reportAuCompte13) > 0.005) {
            observations.push(`RÉSULTAT LU SUR LE COMPTE 13 · aucun compte de gestion ne porte de solde dans l'exercice, et le 13 porte aussi ${(0, ecriture_impot_resultat_1.montantFiscal)(brut.reportAuCompte13)} reportés à l'ouverture, résultat d'un exercice antérieur. ` +
                "Si son affectation n'est pas passée dans cet exercice, le résultat lu ici le contient et l'impôt est faux d'autant · passez l'affectation, ou corrigez le résultat par un retraitement motivé.");
        }
        const reintegrationsImpot = FiscaliteService_1.reintegrationsImpot(brut.retraitements);
        const ecartImpotNonReintegre = FiscaliteService_1.observationImpotNonReintegre(brut.impotConstateAu89, reintegrationsImpot);
        if (ecartImpotNonReintegre)
            observations.push(ecartImpotNonReintegre);
        const degrevement = FiscaliteService_1.observationDegrevement(brut.degrevementsAu899);
        if (degrevement)
            observations.push(degrevement);
        const plafonds = catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS.filter((r) => r.plafond).map((r) => {
            const condition = this.conditionPlafondPourEcran(r, brut);
            return {
                code: r.code,
                enonce: [
                    r.plafond.enonce,
                    condition.enonce,
                    r.plafond.assiette === 'CHIFFRE_AFFAIRES' ? exports.LECTURE_CHIFFRE_AFFAIRES : null,
                ]
                    .filter(Boolean)
                    .join(' · '),
                assiette: r.plafond.assiette,
                part: r.plafond.part,
                montantAdmis: r.plafond.assiette !== 'CHIFFRE_AFFAIRES'
                    ? null
                    : condition.ouverte
                        ? arrondir(r.plafond.part * brut.chiffreAffaires)
                        : 0,
                conditionOuverte: r.conditionResultatNetPositif ? condition.ouverte : null,
            };
        });
        const chiffreAffairesMinimum = lecturePeriode
            ? (0, periode_creation_1.chiffreAffairesMinimumPremierExercice)(brut.chiffreAffaires, lecturePeriode.chiffreAffaires)
            : brut.chiffreAffaires;
        const impot = this.calculerImpot(regime, resultatFiscal, chiffreAffairesMinimum, dossier?.natureActivite ?? null);
        const impotPeriode = periode && lecturePeriode && periode.sousLaLoi
            ? this.calculerImpot('IMPOT_SOCIETES', lecturePeriode.resultatFiscal, lecturePeriode.chiffreAffaires, null)
            : null;
        if (periode && lecturePeriode) {
            observations.push(`PREMIER EXERCICE LONG · art. 12, al. 3. Entreprise tenue pour créée le ${periode.dateDebut.toISOString().slice(0, 10)} (ouverture du premier exercice du dossier) · la période de création, jusqu'au ${periode.dateFin.toISOString().slice(0, 10)}, est imposée À PART sur ses comptes intermédiaires ` +
                `(${lecturePeriode.source === 'DECLARE' ? 'bénéfice fiscal DÉCLARÉ par le cabinet' : 'résultat COMPTABLE lu au livre-journal à cette date'} : ${lecturePeriode.resultatFiscal.toLocaleString('fr-FR')}), ` +
                `et ses bénéfices (${deductionCreation.toLocaleString('fr-FR')}) viennent en déduction du premier exercice clos. L'impôt dû ci-dessous est celui du premier exercice clos ; celui de la période de création est servi à part.` +
                (lecturePeriode.source === 'LIVRE_JOURNAL'
                    ? " Les retraitements saisis valent pour l'exercice ENTIER et sont donc tous rattachés au premier exercice clos · si l'un d'eux concerne la période de création, déclarez le bénéfice fiscal de la période arrêté au 31 décembre, il prime sur la lecture."
                    : '') +
                " Si l'entreprise a été créée avant l'ouverture de ce premier exercice (dossier repris), ce cas ne s'applique pas.");
            observations.push(`${periode_creation_1.OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE} ${(0, periode_creation_1.sourceChiffreAffairesPeriode)({
                chiffreAffairesDeclare: lecturePeriode.sourceChiffreAffaires === 'DECLARE',
                beneficeDeclare: lecturePeriode.source === 'DECLARE',
            })} Ici · ${(0, ecriture_impot_resultat_1.montantFiscal)(brut.chiffreAffaires)} pour l'exercice, ` +
                `${(0, ecriture_impot_resultat_1.montantFiscal)(lecturePeriode.chiffreAffaires)} pour la période, ${(0, ecriture_impot_resultat_1.montantFiscal)(chiffreAffairesMinimum)} retenus pour le minimum du premier exercice clos.`);
            if (lecturePeriode.resultatFiscal < 0)
                observations.push(periode_creation_1.OBSERVATION_PERTE_PERIODE_CREATION);
            if (lecturePeriode.ecartDeclaration !== null && Math.abs(lecturePeriode.ecartDeclaration) >= 0.005) {
                observations.push(`BÉNÉFICE DÉCLARÉ DE LA PÉRIODE DE CRÉATION · ${(0, ecriture_impot_resultat_1.montantFiscal)(lecturePeriode.resultatFiscal)} déclarés contre ${(0, ecriture_impot_resultat_1.montantFiscal)(lecturePeriode.resultatComptable)} lus au livre-journal au ${periode.dateFin.toISOString().slice(0, 10)} (impôt sur le résultat neutralisé, art. 45), soit un écart de ${(0, ecriture_impot_resultat_1.montantFiscal)(lecturePeriode.ecartDeclaration)}. ` +
                    `Il ne peut venir que des retraitements fiscaux de la période (réintégrations moins déductions) · ceux saisis sur l'exercice entier valent ${(0, ecriture_impot_resultat_1.montantFiscal)(arrondir(brut.totalReintegrations - brut.totalDeductions))}. ` +
                    "Si l'écart ne s'explique pas par eux, une écriture de la période manque au livre-journal ou la déclaration est à revoir ; la déclaration prime, le calcul ci-dessus la retient.");
            }
            if (lecturePeriode.impotNeutralise > 0.005) {
                observations.push(`Impôt sur le résultat passé dans la période de création (${(0, ecriture_impot_resultat_1.montantFiscal)(lecturePeriode.impotNeutralise)} au débit des 891, 892 ou 895) · rajouté au résultat lu de la période, l'impôt n'étant pas déductible de sa propre base (loi n° 23/053, art. 45).`);
            }
        }
        const acomptesDus = regime === 'IMPOT_SOCIETES' || regime === 'IRPP_REGIME_REEL';
        observations.push(...this.observationsCalendrierPaiement(regime, impot.impotDu, {
            acomptesDus,
            sansExerciceAnterieur: anterieurs.length === 0,
            simulationAvantLaLoi,
            periodeCreation: periode ? { periode, impotDu: impotPeriode?.impotDu ?? null } : null,
        }));
        const bilansSuccessifs = dissoute
            ? await this.bilansSuccessifsDe(tenantId, tenant, exercice, {
                base: baseAvantReport,
                chiffreAffaires: chiffreAffairesMinimum,
                impotDu: impot.impotDu,
                acomptesVerses,
                regime,
                natureActivite: dossier?.natureActivite ?? null,
            })
            : null;
        if (bilansSuccessifs)
            observations.push(bilansSuccessifs.observation);
        const ecrituresAuBrouillard = await this.prisma.ecriture.count({
            where: {
                tenantId,
                exerciceId,
                statut: client_1.StatutEcriture.BROUILLARD,
                lignes: {
                    some: {
                        OR: [
                            { compte: { numero: { startsWith: '6' } } },
                            { compte: { numero: { startsWith: '7' } } },
                            { compte: { numero: { startsWith: '8' } } },
                        ],
                    },
                },
            },
        });
        let brouillard = { ecritures: ecrituresAuBrouillard, effetSurResultat: 0, effetSurChiffreAffaires: 0 };
        if (ecrituresAuBrouillard > 0) {
            const avec = await this.lireBalance(tenantId, exerciceId, undefined, true);
            brouillard = {
                ecritures: ecrituresAuBrouillard,
                effetSurResultat: arrondir(avec.resultatComptable - brut.resultatComptable),
                effetSurChiffreAffaires: arrondir(avec.chiffreAffaires - brut.chiffreAffaires),
            };
            observations.unshift(`CHIFFRE PROVISOIRE · ${ecrituresAuBrouillard} écriture(s) au brouillard touchent les classes 6 à 8 de l'exercice. ` +
                "Le résultat fiscal et l'impôt ne lisent que le livre-journal (AUDCIF art. 22, 2°) · validées telles quelles, " +
                `elles changeraient le résultat comptable de ${(0, ecriture_impot_resultat_1.montantFiscal)(brouillard.effetSurResultat)}` +
                (Math.abs(brouillard.effetSurChiffreAffaires) >= 0.005
                    ? ` et le chiffre d'affaires de ${(0, ecriture_impot_resultat_1.montantFiscal)(brouillard.effetSurChiffreAffaires)}`
                    : '') +
                ". L'impôt affiché n'est pas définitif tant qu'elles ne sont ni validées ni retirées.");
        }
        return {
            exerciceId,
            dateDebut: exercice.dateDebut,
            dateFin: exercice.dateFin,
            derniereVerification: parametres_fiscaux_1.DERNIERE_VERIFICATION_FISCALE,
            formeJuridiqueSyscohada: tenant.formeJuridiqueSyscohada,
            devise: tenant.devise ?? 'CDF',
            regime,
            observations,
            definitif: ecrituresAuBrouillard === 0,
            brouillard,
            simulationAvantLaLoi,
            natureActivite: dossier?.natureActivite ?? null,
            resultatComptable: brut.resultatComptable,
            sourceResultat: brut.sourceResultat,
            chiffreAffaires: brut.chiffreAffaires,
            chiffreAffairesMinimum,
            retraitements: brut.retraitements.map((r) => ({
                id: r.id,
                code: r.code,
                sens: r.sens,
                libelle: r.libelle,
                montant: Number(r.montant),
                commentaire: r.commentaire,
                source: catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get(r.code)?.source ?? null,
            })),
            totalReintegrations: brut.totalReintegrations,
            totalDeductions: brut.totalDeductions,
            impotConstateAu89: brut.impotConstateAu89,
            degrevementsAu899: brut.degrevementsAu899,
            impotExerciceAu89: brut.impotExerciceAu89,
            reintegrationsImpot,
            acomptesAu4492: brut.acomptesAu4492,
            resultatFiscalBrut: brut.resultatFiscalBrut,
            deficitAnterieur: {
                montant: deficitAnterieur,
                saisi: deficitSaisi !== null,
                montantSaisi: deficitSaisi,
                detail: calcules?.detail ?? [],
                origines: deficitSaisi === null
                    ? null
                    : (FiscaliteService_1.originesDeclarees(dossier?.deficitAnterieurOrigines, deficitSaisi)?.map((o) => ({
                        dateFin: o.dateFin.toISOString().slice(0, 10),
                        montant: o.montant,
                    })) ?? null),
            },
            periodeCreation: periode && lecturePeriode
                ? {
                    dateDebut: periode.dateDebut,
                    dateFin: periode.dateFin,
                    sousLaLoi: periode.sousLaLoi,
                    source: lecturePeriode.source,
                    resultatComptable: lecturePeriode.resultatComptable,
                    chiffreAffaires: lecturePeriode.chiffreAffaires,
                    chiffreAffairesLu: lecturePeriode.chiffreAffairesLu,
                    sourceChiffreAffaires: lecturePeriode.sourceChiffreAffaires,
                    resultatFiscal: lecturePeriode.resultatFiscal,
                    deduction: deductionCreation,
                    impotTheorique: impotPeriode?.impotTheorique ?? null,
                    impotMinimum: impotPeriode?.impotMinimum ?? null,
                    impotDu: impotPeriode?.impotDu ?? null,
                    minimumApplique: impotPeriode?.minimumApplique ?? false,
                    explication: impotPeriode
                        ? impotPeriode.explication
                        : `Période de création antérieure au 1er janvier 2026 · son impôt relève du texte qui régissait ${periode.annee} (loi n° 23/053, art. 153), que le dossier ne contient pas.`,
                    ecartDeclaration: lecturePeriode.ecartDeclaration,
                    impotNeutralise: lecturePeriode.impotNeutralise,
                    supplements: supplementsPeriodeCreation,
                    baseAcomptesExercice: impotPeriode?.impotDu === null || impotPeriode?.impotDu === undefined
                        ? null
                        : arrondir(impotPeriode.impotDu + supplementsPeriodeCreation),
                    acomptesExercice: impotPeriode?.impotDu === null || impotPeriode?.impotDu === undefined
                        ? []
                        : parametres_fiscaux_1.IMPOT_SOCIETES.acomptes.map((a) => ({
                            ...a,
                            annee: periode.annee + 1,
                            montant: arrondir(a.quotite * (impotPeriode.impotDu + supplementsPeriodeCreation)),
                        })),
                }
                : null,
            deductionPeriodeCreation: deductionCreation,
            deficitImpute,
            resultatFiscal,
            plafonds,
            ...impot,
            acomptesVerses,
            soldeAPayer: impot.impotDu === null ? null : arrondir(impot.impotDu - acomptesVerses),
            impotTotalExercice: impot.impotDu === null
                ? null
                : !periode
                    ? impot.impotDu
                    : impotPeriode?.impotDu === null || impotPeriode?.impotDu === undefined
                        ? null
                        : arrondir(impot.impotDu + impotPeriode.impotDu),
            suiviAcomptes: FiscaliteService_1.suiviAcomptes({
                acomptesDus,
                declares: acomptesVerses,
                comptabilises: brut.acomptesAu4492,
                impotDu: impot.impotDu,
            }),
            supplementsAdministration,
            baseAcomptes: !dissoute && acomptesDus && impot.impotDu !== null && acomptesRetenus.length > 0
                ? arrondir(impot.impotDu + supplementsAdministration)
                : null,
            bilansSuccessifs,
            acomptesProchainExercice: dissoute || !acomptesDus || impot.impotDu === null
                ? []
                : acomptesRetenus.map((a) => ({
                    ...a,
                    montant: arrondir(a.quotite * (impot.impotDu + supplementsAdministration)),
                })),
            quotitesPetiteEntreprise: regime !== 'IRPP_PETITE_ENTREPRISE' || impot.impotDu === null
                ? []
                : parametres_fiscaux_1.QUOTITES_PETITE_ENTREPRISE.map((q) => ({
                    rang: q.rang,
                    quotite: q.quotite,
                    echeance: q.echeance,
                    source: q.source,
                    reserve: q.reserve,
                    montant: arrondir(q.quotite * impot.impotDu),
                })),
        };
    }
    async bilansSuccessifsDe(tenantId, tenant, exercice, courant) {
        const d = tenant.dateDissolution;
        const annee = d.getUTCFullYear();
        const jour = (x) => x.toISOString().slice(0, 10).split('-').reverse().join('/');
        const sans = (0, liquidation_societe_1.sansLiquidation)({ forme: tenant.formeJuridiqueSyscohada, regimeLiquidation: tenant.regimeLiquidation, associeUniquePersonneMorale: tenant.associeUniquePersonneMorale });
        if (exercice.dateFin.getTime() === d.getTime()) {
            return {
                role: sans ? 'COTISATION_UNIQUE' : 'PREMIERE_COTISATION',
                anneeDissolution: annee,
                calculable: true,
                motif: null,
                premiereCotisation: courant.impotDu,
                totalisation: null,
                observation: `DISSOLUTION DU ${jour(d)} · l'impôt ci-dessus est ${sans ? 'la cotisation spéciale UNIQUE' : 'la PREMIÈRE cotisation spéciale'} de l'année ${annee}, sur les résultats de la période d'activité (loi n° 23/053, art. 13, al. 1), ` +
                    (sans
                        ? "la société étant dissoute sans liquidation (AUSCGIE art. 201 al. 4)."
                        : "à déduire de la seconde, qui se calcule sur le total des résultats de l'année de la dissolution (art. 12, al. 4 ; art. 13, al. 3) · servie sur l'exercice de liquidation.") +
                    " Aucun acompte n'est dû pour les années qui suivent celle de la dissolution (LPF art. 57 bis ; décision par la loi du 2026-10-07, quatrième lot, point 3).",
            };
        }
        if (!(0, liquidation_societe_1.estExerciceDeLiquidation)(exercice, d) || sans) {
            return {
                role: 'NON_CALCULEE',
                anneeDissolution: annee,
                calculable: false,
                motif: exercice.dateDebut.getTime() <= d.getTime()
                    ? `L'exercice n'est pas arrêté à la dissolution du ${jour(d)} · la période d'activité et la liquidation y sont mêlées, et les deux cotisations ne se séparent pas. Arrêtez-le dans la fenêtre Exercices (loi n° 23/053, art. 12, al. 1).`
                    : `Cet exercice suit la dissolution du ${jour(d)} sans être l'exercice de liquidation · tous les résultats de la liquidation sont rattachés à l'année ${annee} (art. 13, al. 3), et aucun impôt annuel propre n'est dû.`,
                premiereCotisation: null,
                totalisation: null,
                observation: `DISSOLUTION DU ${jour(d)} · totalisation non calculée sur cet exercice.`,
            };
        }
        const arrete = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: d },
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
        });
        if (!arrete) {
            return {
                role: 'SECONDE_COTISATION',
                anneeDissolution: annee,
                calculable: false,
                motif: `Aucun exercice n'est arrêté à la dissolution du ${jour(d)} dans le dossier · la première cotisation ne s'y lit pas, et l'impôt totalisé de l'année ${annee} ne se calcule pas ici. ` +
                    "Le calcul ci-dessus porte sur l'exercice de liquidation seul.",
                premiereCotisation: null,
                totalisation: null,
                observation: `DISSOLUTION DU ${jour(d)} · totalisation de l'année ${annee} non calculée, faute d'exercice arrêté à la dissolution.`,
            };
        }
        const premier = await this.resultatFiscal(tenantId, arrete.id);
        const constat = await this.prisma.constatImpotResultat.findFirst({
            where: { tenantId, exerciceId: arrete.id, annuleeLe: null },
            select: { montantImpot: true },
        });
        const impotAu89 = arrondir(premier.impotExerciceAu89 ?? 0);
        const ecartReintegration = arrondir((premier.impotConstateAu89 ?? 0) - (premier.reintegrationsImpot ?? 0));
        const sourcePremiereCotisation = constat
            ? 'CONSTAT'
            : impotAu89 > 0.005
                ? 'COMPTE_89'
                : arrete.statut === client_1.StatutExercice.CLOTURE
                    ? 'RECALCUL'
                    : null;
        if (!sourcePremiereCotisation || Math.abs(ecartReintegration) >= 0.005) {
            return {
                role: 'SECONDE_COTISATION',
                anneeDissolution: annee,
                calculable: false,
                motif: !sourcePremiereCotisation
                    ? `La première cotisation de l'exercice arrêté à la dissolution du ${jour(d)} n'est pas constatée · passez l'écriture de l'impôt de cet exercice (Résultat fiscal, « Écriture de l'impôt »), puis revenez ici. ` +
                        "Recalculée, elle pourrait différer de la cotisation déclarée et payée (loi n° 23/053, art. 13, al. 1), et la seconde serait fausse d'autant."
                    : `L'impôt porté au 89 de l'exercice arrêté à la dissolution du ${jour(d)} (${(0, ecriture_impot_resultat_1.montantFiscal)(premier.impotConstateAu89)}) n'est pas réintégré à sa mesure (${(0, ecriture_impot_resultat_1.montantFiscal)(premier.reintegrationsImpot)}) · la base de la période d'activité est fausse de ${(0, ecriture_impot_resultat_1.montantFiscal)(Math.abs(ecartReintegration))} (loi n° 23/053, art. 45). ` +
                        "Ajustez la réintégration « Impôt sur les sociétés et impôt minimum comptabilisés en charges » de cet exercice, puis revenez ici.",
                premiereCotisation: constat ? Number(constat.montantImpot) : impotAu89 > 0.005 ? impotAu89 : null,
                totalisation: null,
                observation: `DISSOLUTION DU ${jour(d)} · totalisation de l'année ${annee} non calculée, ${!sourcePremiereCotisation ? 'faute de première cotisation constatée' : "l'impôt de la période d'activité n'étant pas réintégré à sa mesure"}.`,
            };
        }
        const baseActivite = arrondir(premier.resultatFiscal + premier.deficitImpute);
        const deficitDisponible = premier.deficitAnterieur.montant;
        const total = arrondir(baseActivite + courant.base);
        const deficitImpute = arrondir(Math.min(deficitDisponible, Math.max(total, 0)));
        const resultatFiscal = arrondir(total - deficitImpute);
        const chiffreAffaires = arrondir(premier.chiffreAffairesMinimum + courant.chiffreAffaires);
        const impot = this.calculerImpot(courant.regime, resultatFiscal, chiffreAffaires, courant.natureActivite);
        const premiereCotisation = sourcePremiereCotisation === 'CONSTAT' ? Number(constat.montantImpot) : sourcePremiereCotisation === 'COMPTE_89' ? impotAu89 : premier.impotDu;
        const reservePremiere = sourcePremiereCotisation === 'COMPTE_89'
            ? ` La première cotisation est lue sur le débit du 891 et du 895 de l'exercice arrêté (${(0, ecriture_impot_resultat_1.montantFiscal)(impotAu89)}), l'impôt y ayant été passé hors de l'écriture de l'impôt.`
            : sourcePremiereCotisation === 'RECALCUL'
                ? " La première cotisation est RECALCULÉE · l'exercice arrêté est clôturé sans écriture de l'impôt ni impôt au 89 · à vérifier contre la déclaration déposée, qui prime (loi n° 23/053, art. 13, al. 1)."
                : '';
        const dejaRegle = premiereCotisation === null ? null : arrondir(premiereCotisation + courant.acomptesVerses);
        const reste = impot.impotDu === null || dejaRegle === null ? null : arrondir(impot.impotDu - dejaRegle);
        const totalisation = {
            periodeActivite: {
                exerciceId: arrete.id,
                dateDebut: arrete.dateDebut,
                dateFin: arrete.dateFin,
                resultatFiscalAvantReport: baseActivite,
                chiffreAffaires: premier.chiffreAffairesMinimum,
            },
            liquidation: { resultatFiscalAvantReport: courant.base, chiffreAffaires: courant.chiffreAffaires },
            total,
            deficitDisponible,
            deficitImpute,
            resultatFiscal,
            chiffreAffaires,
            impotTheorique: impot.impotTheorique,
            impotMinimum: impot.impotMinimum,
            impotTotal: impot.impotDu,
            minimumApplique: impot.minimumApplique,
            acomptesImputes: courant.acomptesVerses,
            dejaRegle,
            secondeCotisation: reste === null ? null : Math.max(reste, 0),
            excedent: reste !== null && reste < 0 ? -reste : 0,
            cotisationDeLExercice: impot.impotDu === null || premiereCotisation === null ? null : Math.max(arrondir(impot.impotDu - premiereCotisation), 0),
            tropPayePremiereCotisation: impot.impotDu === null || premiereCotisation === null ? 0 : Math.max(arrondir(premiereCotisation - impot.impotDu), 0),
            excedentAcomptes: 0,
        };
        totalisation.excedentAcomptes = Math.max(arrondir(totalisation.excedent - totalisation.tropPayePremiereCotisation), 0);
        const montant = (n) => (n === null ? 'non calculé' : (0, ecriture_impot_resultat_1.montantFiscal)(n));
        return {
            role: 'SECONDE_COTISATION',
            anneeDissolution: annee,
            calculable: true,
            motif: null,
            premiereCotisation,
            sourcePremiereCotisation,
            totalisation,
            observation: `BILANS SUCCESSIFS DE ${annee} · une assiette, deux cotisations (loi n° 23/053, art. 11, 1°, 12, al. 4, et 13, al. 3). ` +
                `Période d'activité ${montant(baseActivite)}, liquidation ${montant(courant.base)}, total ${montant(total)}` +
                (deficitImpute > 0.005 ? `, report déficitaire imputé ${montant(deficitImpute)}` : '') +
                `, chiffre d'affaires total ${montant(chiffreAffaires)} · impôt de l'année ${montant(impot.impotDu)}, ` +
                `première cotisation ${montant(premiereCotisation)}, acomptes imputés ${montant(courant.acomptesVerses)}, ` +
                (totalisation.excedent > 0.005
                    ? `seconde cotisation 0 · ce qui est réglé dépasse l'impôt totalisé de ${montant(totalisation.excedent)}` +
                        (totalisation.tropPayePremiereCotisation > 0.005
                            ? `, dont ${montant(totalisation.tropPayePremiereCotisation)} de première cotisation · créance sur l'État, gardée au bilan au débit du 441 par le crédit du 8994 « Annulations pour pertes rétroactives » (AUDCIF, Titre VII, fiches des comptes 44 et 89), proposée par l'écriture de l'impôt de l'exercice, jamais un remboursement à encaisser`
                            : '') +
                        (totalisation.excedentAcomptes > 0.005
                            ? `${totalisation.tropPayePremiereCotisation > 0.005 ? ', et' : ', dont'} ${montant(totalisation.excedentAcomptes)} d'acomptes, qui restent au 4492 (LPF art. 57 ter, « peuvent, à sa demande, servir au paiement d'autres impôts et droits dus »)`
                            : '') +
                        '.'
                    : `seconde cotisation ${montant(totalisation.secondeCotisation)}.`) +
                reservePremiere,
        };
    }
    calculerImpot(regime, resultatFiscal, chiffreAffaires, natureActivite) {
        const is = parametres_fiscaux_1.IMPOT_SOCIETES;
        const pp = parametres_fiscaux_1.IMPOT_REVENU_PERSONNES_PHYSIQUES;
        switch (regime) {
            case 'IMPOT_SOCIETES': {
                const theoriqueAvantArrondi = is.taux * Math.max(resultatFiscal, 0);
                const minimumAvantArrondi = is.tauxMinimum * chiffreAffaires;
                const theorique = (0, arrondi_article_150_1.arrondirImpotArt150)(theoriqueAvantArrondi);
                const minimum = (0, arrondi_article_150_1.arrondirImpotArt150)(minimumAvantArrondi);
                const minimumApplique = minimum > theorique;
                const egauxParArrondi = minimum === theorique && Math.abs(minimumAvantArrondi - theoriqueAvantArrondi) >= 0.005;
                const deficitaire = resultatFiscal < 0;
                const avantArrondi = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
                const explicationSeule = minimumApplique
                    ? `L'impôt minimum de ${is.tauxMinimum * 100} % du chiffre d'affaires déclaré (loi n° 23/053, art. 57) est supérieur à l'impôt sur le bénéfice : c'est lui qui est dû.`
                    : minimum === theorique
                        ? deficitaire
                            ? `RÉSULTAT DÉFICITAIRE ET CHIFFRE D'AFFAIRES NUL. L'article 57 assujettit les sociétés à l'impôt minimum de ${is.tauxMinimum * 100} % du chiffre d'affaires déclaré « lorsque les résultats sont déficitaires » : il s'applique bien ici, mais son assiette est nulle, d'où un impôt de zéro. Si le dossier a des produits ailleurs (77 financiers, 84 hors activités ordinaires), le chiffre d'affaires DÉCLARÉ à l'administration peut ne pas être celui-ci.`
                            : egauxParArrondi
                                ? `Les deux impôts sont égaux APRÈS l'arrondi de l'art. 150 de la loi n° 23/053, pas avant : ${is.taux * 100} % du bénéfice net imposable (art. 56) donne ${avantArrondi(theoriqueAvantArrondi)}, ${is.tauxMinimum * 100} % du chiffre d'affaires (art. 57) donne ${avantArrondi(minimumAvantArrondi)}, et tous deux s'arrondissent à ${theorique.toLocaleString('fr-FR')}. Ni l'art. 150 ni l'art. 57 ne disent si l'arrondi précède la comparaison · OmegaX arrondit d'abord, compare ensuite, et l'impôt est retenu AU TAUX (compte 891). Comparé avant l'arrondi, ${minimumAvantArrondi > theoriqueAvantArrondi ? "le minimum serait retenu (compte 895)" : "l'impôt au taux resterait retenu"} · le montant dû est le même dans les deux lectures.`
                                : `Les deux impôts sont ÉGAUX : ${is.taux * 100} % du bénéfice net imposable (loi n° 23/053, art. 56) et ${is.tauxMinimum * 100} % du chiffre d'affaires (même loi, art. 57) donnent le même montant. L'article 57 ne joue que si l'imposition serait INFÉRIEURE au minimum · ce n'est pas le cas.`
                        : `Impôt sur le bénéfice net imposable au taux de ${is.taux * 100} % (loi n° 23/053, art. 56), supérieur à l'impôt minimum de ${is.tauxMinimum * 100} % du chiffre d'affaires (même loi, art. 57).`;
                const explication = `${explicationSeule} ${exports.LECTURE_CHIFFRE_AFFAIRES}`;
                return {
                    impotTheorique: theorique,
                    impotMinimum: minimum,
                    impotDu: Math.max(theorique, minimum),
                    baseImpot: `${is.taux * 100} % du bénéfice net imposable (loi n° 23/053, art. 56)`,
                    minimumApplique,
                    explication,
                };
            }
            case 'IRPP_MICRO_ENTREPRISE':
                return {
                    impotTheorique: null,
                    impotMinimum: null,
                    impotDu: null,
                    baseImpot: `Forfait annuel de ${pp.forfaitMicroEntrepriseUsd} dollars américains, converti en francs (arrêté n° 015/CAB/MIN/FINANCES/2025)`,
                    minimumApplique: false,
                    explication: `Le forfait est libellé en dollars et sa contre-valeur dépend du taux fixé par la circulaire de perception, que le logiciel ne détient pas · ${pp.forfaitMicroEntrepriseUsd} USD, payable au plus tard le 30 avril de l'année suivante. Aucun minimum de perception (art. 122).`,
                };
            case 'IRPP_PETITE_ENTREPRISE': {
                if (!natureActivite) {
                    return {
                        impotTheorique: null,
                        impotMinimum: null,
                        impotDu: null,
                        baseImpot: "1 % du chiffre d'affaires pour la vente, 2 % pour les prestations (art. 127)",
                        minimumApplique: false,
                        explication: "La nature de l'activité principale n'est pas renseignée : le taux ne se devine pas. Indiquez vente ou prestations de services · en cas d'activité mixte, la loi cumule les chiffres d'affaires et impose suivant l'activité principale.",
                    };
                }
                const taux = pp.tauxPetiteEntreprise[natureActivite];
                const du = (0, arrondi_article_150_1.arrondirImpotArt150)(taux * chiffreAffaires);
                return {
                    impotTheorique: du,
                    impotMinimum: null,
                    impotDu: du,
                    baseImpot: `${taux * 100} % du chiffre d'affaires annuel réalisé, activité de ${natureActivite === 'VENTE' ? 'vente' : 'prestations de services'} (art. 127)`,
                    minimumApplique: false,
                    explication: "Impôt assis sur le chiffre d'affaires, indépendant du résultat : les retraitements ci-dessus ne le modifient pas. Ils restent utiles si l'entreprise opte pour le régime réel.",
                };
            }
            case 'IRPP_REGIME_REEL': {
                const minimum = (0, arrondi_article_150_1.arrondirImpotArt150)(pp.tauxMinimumRegimeReel * chiffreAffaires);
                return {
                    impotTheorique: null,
                    impotMinimum: minimum,
                    impotDu: null,
                    baseImpot: 'Barème progressif de l’art. 118 sur le revenu net global du contribuable',
                    minimumApplique: false,
                    explication: `Le bénéfice professionnel déterminé ici (${resultatFiscal.toLocaleString('fr-FR')}) entre dans le revenu net global du contribuable avec ses autres revenus catégoriels ; le barème progressif s'applique à ce total, que ce dossier ne détient pas. Le minimum de perception de ${pp.tauxMinimumRegimeReel * 100} % du chiffre d'affaires (art. 122) est en revanche connu.`,
                };
            }
        }
    }
    async ajouterRetraitement(tenantId, exerciceId, dto) {
        await this.tenantSyscohada(tenantId);
        await this.exerciceDuDossier(tenantId, exerciceId);
        const definition = catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get(dto.code);
        if (!definition)
            throw new common_1.BadRequestException(`Code de retraitement inconnu : ${dto.code}`);
        const libre = dto.code === catalogue_retraitements_1.CODE_LIBRE;
        if (libre && !dto.libelle?.trim()) {
            throw new common_1.BadRequestException('Une ligne libre doit porter un libellé');
        }
        if (libre && !dto.commentaire?.trim()) {
            throw new common_1.BadRequestException('Une ligne libre doit indiquer son fondement en commentaire');
        }
        await this.prisma.retraitementFiscal.create({
            data: {
                tenantId,
                exerciceId,
                code: dto.code,
                sens: libre ? (dto.sens ?? definition.sens) : definition.sens,
                libelle: libre ? dto.libelle.trim() : definition.libelle,
                montant: arrondir(dto.montant),
                commentaire: dto.commentaire?.trim() || null,
            },
        });
        return this.resultatFiscal(tenantId, exerciceId);
    }
    async modifierRetraitement(tenantId, id, dto) {
        await this.tenantSyscohada(tenantId);
        const existant = await this.prisma.retraitementFiscal.findFirst({ where: { id, tenantId } });
        if (!existant)
            throw new common_1.NotFoundException('Retraitement introuvable');
        await this.prisma.retraitementFiscal.update({
            where: { id },
            data: {
                ...(dto.montant === undefined ? {} : { montant: arrondir(dto.montant) }),
                ...(dto.commentaire === undefined ? {} : { commentaire: dto.commentaire.trim() || null }),
            },
        });
        return this.resultatFiscal(tenantId, existant.exerciceId);
    }
    async supprimerRetraitement(tenantId, id) {
        await this.tenantSyscohada(tenantId);
        const existant = await this.prisma.retraitementFiscal.findFirst({ where: { id, tenantId } });
        if (!existant)
            throw new common_1.NotFoundException('Retraitement introuvable');
        await this.prisma.retraitementFiscal.delete({ where: { id } });
        return this.resultatFiscal(tenantId, existant.exerciceId);
    }
    async modifierDossier(tenantId, exerciceId, dto) {
        await this.tenantSyscohada(tenantId);
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const touchesReport = dto.deficitAnterieurSaisi !== undefined ||
            dto.deficitAnterieurOrigines !== undefined ||
            dto.resultatPeriodeCreationSaisi !== undefined ||
            dto.chiffreAffairesPeriodeCreationSaisi !== undefined;
        if (touchesReport && exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("L'exercice est clôturé · le déficit reportable déclaré et le bénéfice de la période de création n'y changent plus, ils fondent l'impôt d'exercices déjà déclarés. Déclarez le report disponible à l'ouverture de l'exercice ouvert suivant (« Déficits antérieurs ») · cette déclaration fait foi pour la suite.");
        }
        if (dto.chiffreAffairesPeriodeCreationSaisi !== undefined && dto.chiffreAffairesPeriodeCreationSaisi !== null) {
            const beneficeApres = dto.resultatPeriodeCreationSaisi !== undefined
                ? dto.resultatPeriodeCreationSaisi
                : ((await this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId }, select: { resultatPeriodeCreationSaisi: true } }))
                    ?.resultatPeriodeCreationSaisi ?? null);
            if (beneficeApres === null) {
                throw new common_1.BadRequestException("Le chiffre d'affaires de la période de création se déclare avec son bénéfice fiscal, d'après les mêmes comptes intermédiaires (loi n° 23/053, art. 12, al. 3) · déclarez d'abord le bénéfice ; sans lui, les deux se lisent au livre-journal.");
            }
        }
        if (dto.deficitAnterieurOrigines) {
            const existant = await this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId } });
            const saisi = dto.deficitAnterieurSaisi !== undefined
                ? dto.deficitAnterieurSaisi
                : existant?.deficitAnterieurSaisi === null || existant?.deficitAnterieurSaisi === undefined
                    ? null
                    : Number(existant.deficitAnterieurSaisi);
            if (saisi === null) {
                throw new common_1.BadRequestException("L'origine d'un déficit ne se déclare qu'avec le déficit saisi qu'elle ventile.");
            }
            const somme = arrondir(dto.deficitAnterieurOrigines.reduce((t, o) => t + o.montant, 0));
            if (Math.abs(somme - arrondir(saisi)) >= 0.005) {
                throw new common_1.BadRequestException(`L'origine déclarée totalise ${(0, ecriture_impot_resultat_1.montantFiscal)(somme)} pour un déficit saisi de ${(0, ecriture_impot_resultat_1.montantFiscal)(saisi)} · chaque part se rattache à un exercice déficitaire, et leur somme est le déficit saisi.`);
            }
            const horsFenetre = (0, report_deficitaire_1.originesHorsFenetre)(dto.deficitAnterieurOrigines.map((o) => ({ dateFin: new Date(`${o.dateFin.slice(0, 10)}T00:00:00Z`), montant: o.montant })), exercice, parametres_fiscaux_1.IMPOT_SOCIETES.exercicesReportDeficit);
            if (horsFenetre.length) {
                throw new common_1.BadRequestException(`Loi n° 23/053, art. 51 · une perte ne se reporte que « jusqu'au troisième exercice qui suit l'exercice déficitaire ». ${horsFenetre
                    .map((o) => `La perte de l'exercice clos le ${o.dateFin.toISOString().slice(0, 10)} ne s'imputait plus après le ${o.finDeFenetre.toISOString().slice(0, 10)}`)
                    .join(' ; ')}, avant l'ouverture du ${exercice.dateDebut.toISOString().slice(0, 10)} · elle ne se reporte pas sur cet exercice.`);
            }
            for (const o of dto.deficitAnterieurOrigines) {
                if (new Date(`${o.dateFin.slice(0, 10)}T00:00:00Z`).getTime() >= exercice.dateDebut.getTime()) {
                    throw new common_1.BadRequestException(`Une perte reportée à l'ouverture vient d'un exercice clos AVANT elle · le ${o.dateFin.slice(0, 10)} ne précède pas l'ouverture du ${exercice.dateDebut.toISOString().slice(0, 10)}.`);
                }
            }
        }
        let origineCaduque = false;
        if (typeof dto.deficitAnterieurSaisi === 'number' && dto.deficitAnterieurOrigines === undefined) {
            const existant = await this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId } });
            const lues = Array.isArray(existant?.deficitAnterieurOrigines)
                ? existant.deficitAnterieurOrigines
                : [];
            origineCaduque =
                lues.length > 0 &&
                    Math.abs(arrondir(lues.reduce((t, o) => t + Number(o.montant), 0)) - arrondir(dto.deficitAnterieurSaisi)) >= 0.005;
        }
        const data = {
            ...(dto.acomptesVerses === undefined ? {} : { acomptesVerses: arrondir(dto.acomptesVerses) }),
            ...(dto.supplementsAdministration === undefined
                ? {}
                : { supplementsAdministration: arrondir(dto.supplementsAdministration) }),
            ...(dto.deficitAnterieurSaisi === undefined
                ? {}
                : { deficitAnterieurSaisi: dto.deficitAnterieurSaisi === null ? null : arrondir(dto.deficitAnterieurSaisi) }),
            ...(dto.deficitAnterieurSaisi === null || origineCaduque
                ? { deficitAnterieurOrigines: client_1.Prisma.DbNull }
                : dto.deficitAnterieurOrigines === undefined
                    ? {}
                    : {
                        deficitAnterieurOrigines: dto.deficitAnterieurOrigines === null
                            ? client_1.Prisma.DbNull
                            : dto.deficitAnterieurOrigines.map((o) => ({ dateFin: o.dateFin.slice(0, 10), montant: arrondir(o.montant) })),
                    }),
            ...(dto.supplementsPeriodeCreation === undefined
                ? {}
                : { supplementsPeriodeCreation: arrondir(dto.supplementsPeriodeCreation) }),
            ...(dto.natureActivite === undefined ? {} : { natureActivite: dto.natureActivite }),
            ...(dto.resultatPeriodeCreationSaisi === undefined
                ? {}
                : {
                    resultatPeriodeCreationSaisi: dto.resultatPeriodeCreationSaisi === null ? null : arrondir(dto.resultatPeriodeCreationSaisi),
                    ...(dto.resultatPeriodeCreationSaisi === null ? { chiffreAffairesPeriodeCreationSaisi: null } : {}),
                }),
            ...(dto.chiffreAffairesPeriodeCreationSaisi === undefined || dto.resultatPeriodeCreationSaisi === null
                ? {}
                : {
                    chiffreAffairesPeriodeCreationSaisi: dto.chiffreAffairesPeriodeCreationSaisi === null ? null : arrondir(dto.chiffreAffairesPeriodeCreationSaisi),
                }),
        };
        await this.prisma.dossierFiscalExercice.upsert({
            where: { exerciceId },
            create: { tenantId, exerciceId, ...data },
            update: data,
        });
        return this.resultatFiscal(tenantId, exerciceId);
    }
};
exports.FiscaliteService = FiscaliteService;
exports.FiscaliteService = FiscaliteService = FiscaliteService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService])
], FiscaliteService);
//# sourceMappingURL=fiscalite.service.js.map