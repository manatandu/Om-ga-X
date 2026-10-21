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
var EcritureService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.lignesEnNegatif = exports.EcritureService = exports.DETENTEUR_EXECUTION_ENGAGEMENT = exports.DETENTEUR_DONATION = exports.DETENTEUR_ACQUISITION_IMMOBILISATION = exports.DETENTEUR_IMPOT_RESULTAT = exports.DETENTEUR_CORRECTION_CREANCE = exports.DETENTEUR_DEVISE_A_NOUVEAU = exports.DETENTEUR_RECUPERATION_TVA_CREANCE = exports.DETENTEUR_MOUVEMENT_CREANCE = exports.DETENTEUR_REVUE_CREANCE = exports.DETENTEUR_RECLASSEMENT_CREANCE = exports.DETENTEUR_PAIE_DU_MOIS = exports.DETENTEUR_LIQUIDATION_TVA = exports.PERIMETRES_BALANCE_AGEE = exports.PLAFOND_LIGNES_GRAND_LIVRE = exports.MOTIF_COMPTE_INTROUVABLE_GRAND_LIVRE = exports.PLAFOND_ECRITURES_PAR_FENETRE = void 0;
exports.perimetreJournal = perimetreJournal;
exports.ligneVentilee = ligneVentilee;
exports.motifDateHorsExercice = motifDateHorsExercice;
exports.donneesLigneSaisie = donneesLigneSaisie;
const lignes_tenues_1 = require("./lignes-tenues");
const pieces_jointes_ecriture_1 = require("./pieces-jointes-ecriture");
const classe_9_equilibree_1 = require("./classe-9-equilibree");
const exercice_cloture_1 = require("./exercice-cloture");
const common_1 = require("@nestjs/common");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const collectifs_tiers_1 = require("../tiers/collectifs-tiers");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const lignes_en_negatif_1 = require("./lignes-en-negatif");
Object.defineProperty(exports, "lignesEnNegatif", { enumerable: true, get: function () { return lignes_en_negatif_1.lignesEnNegatif; } });
const recherche_ecritures_1 = require("./recherche-ecritures");
const reimputation_1 = require("./reimputation");
const references_1 = require("../../common/suppression/references");
const journal_service_1 = require("../journaux/journal.service");
const exercice_service_1 = require("../exercice/exercice.service");
const ouverture_passee_1 = require("../exercice/ouverture-passee");
const analytique_service_1 = require("../analytique/analytique.service");
const prisma_retry_util_1 = require("../../common/prisma-retry.util");
const ligne_en_devise_1 = require("./ligne-en-devise");
const ligne_lettree_1 = require("../lettrage/ligne-lettree");
const ouverte_a_la_cloture_1 = require("../lettrage/ouverte-a-la-cloture");
const reste_des_lignes_ouvertes_1 = require("../lettrage/reste-des-lignes-ouvertes");
const centralisation_brouillard_1 = require("./centralisation-brouillard");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const balance_trois_colonnes_1 = require("./balance-trois-colonnes");
const periode_extrait_1 = require("./periode-extrait");
const ecritures_de_situation_1 = require("./ecritures-de-situation");
const virements_mise_en_service_1 = require("../immobilisations/virements-mise-en-service");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
const familles_tiers_1 = require("./familles-tiers");
const subdivisions_du_plan_1 = require("../comptes/subdivisions-du-plan");
const comptes_proposes_1 = require("../comptes/comptes-proposes");
function estLigneDebit(l) {
    return Math.abs(Number(l.debit)) > 0.005;
}
function perimetreJournal(tenantId, filtres) {
    return {
        tenantId,
        ...(filtres.inclureBrouillard === false
            ? { statut: client_1.StatutEcriture.VALIDEE }
            : filtres.journalId
                ? {}
                : ecritures_de_situation_1.HORS_SITUATION),
        ...(filtres.exerciceId ? { exerciceId: filtres.exerciceId } : {}),
        ...(filtres.journalId ? { journalId: filtres.journalId } : {}),
        ...(filtres.dateDebut || filtres.dateFin
            ? {
                date: {
                    ...(filtres.dateDebut ? { gte: new Date(filtres.dateDebut) } : {}),
                    ...(filtres.dateFin ? { lte: new Date(filtres.dateFin) } : {}),
                },
            }
            : {}),
        ...(0, recherche_ecritures_1.filtreRecherche)(filtres),
    };
}
exports.PLAFOND_ECRITURES_PAR_FENETRE = 2000;
exports.MOTIF_COMPTE_INTROUVABLE_GRAND_LIVRE = 'Compte introuvable dans ce dossier : aucun grand livre ne peut être établi.';
exports.PLAFOND_LIGNES_GRAND_LIVRE = 20000;
function ligneVentilee(sens, numeros, solde) {
    if (Math.abs(solde) < 0.005)
        return false;
    let normal = sens;
    if (sens === 'SELON_LE_COMPTE') {
        const fournisseur = numeros.some((n) => n.startsWith('40'));
        const client = numeros.some((n) => !n.startsWith('40'));
        normal = fournisseur && client ? 'LES_DEUX' : fournisseur ? 'CREDITEUR' : 'DEBITEUR';
    }
    if (normal === 'LES_DEUX')
        return true;
    return normal === 'DEBITEUR' ? solde > 0 : solde < 0;
}
exports.PERIMETRES_BALANCE_AGEE = {
    TOUS: {
        racines: ['40', '41'],
        exclusions: [],
        sensNormal: 'SELON_LE_COMPTE',
        libelle: 'Crédit commercial · fournisseurs (40) et clients (41)',
        lecture: "Une ligne ancienne est un délai de règlement dépassé : le crédit commercial est accordé pour un temps, " +
            'et ce tableau mesure ce temps.',
    },
    CLIENTS_41: {
        racines: ['41'],
        exclusions: [],
        sensNormal: 'DEBITEUR',
        libelle: 'Clients, adhérents et usagers (41)',
        lecture: "Une créance ancienne appelle un rappel, puis une dépréciation : c'est ici que se prépare le passage au " +
            "compte de créances douteuses et l'estimation du risque de non-recouvrement.",
    },
    FOURNISSEURS: {
        racines: ['40'],
        exclusions: [],
        sensNormal: 'CREDITEUR',
        libelle: 'Fournisseurs et comptes rattachés (40)',
        lecture: "Une dette ancienne est un retard de paiement, ou une facture réglée sans être lettrée. Les deux se " +
            'traitent, et seule la seconde est une erreur de tenue.',
    },
    PERSONNEL_42: {
        racines: ['42'],
        exclusions: [],
        sensNormal: 'LES_DEUX',
        libelle: 'Personnel (42)',
        lecture: "AUCUN CRÉDIT COMMERCIAL ICI · la rémunération naît à une date et se règle à une échéance de paie. Un " +
            "solde à la clôture est NORMAL (la paie de décembre versée en janvier). Ce qui se lit, c'est une ligne " +
            "qui traverse plusieurs paies sans être soldée : une avance jamais retenue, un acompte oublié, une " +
            'opposition non reversée.',
    },
    SOCIAL_43: {
        racines: ['43'],
        exclusions: [],
        sensNormal: 'LES_DEUX',
        libelle: 'Organismes sociaux (43)',
        lecture: "AUCUN CRÉDIT COMMERCIAL ICI · les cotisations se déclarent et se règlent à une échéance légale, et un " +
            "solde à la clôture est la situation normale du dernier trimestre. Ce qui se lit, c'est une cotisation " +
            "d'une période ANTÉRIEURE encore ouverte : une déclaration non payée, qui court des majorations.",
    },
    ETAT_44: {
        racines: ['44'],
        exclusions: ['443', '444', '445', '446'],
        sensNormal: 'LES_DEUX',
        libelle: 'État et collectivités publiques (44), hors comptes de TVA',
        lecture: "AUCUN CRÉDIT COMMERCIAL ICI · l'impôt naît d'une déclaration et se règle à une échéance légale. Les " +
            "comptes de TVA (443 à 446) sont ÉCARTÉS de ce tableau : ce sont les termes d'une liquidation " +
            "périodique, remise à zéro chaque mois, et les vieillir afficherait un retard qui n'existe pas. Ce qui " +
            "se lit ici, c'est un impôt d'une période antérieure encore ouvert, ou un acompte versé jamais imputé.",
    },
    DIVERS_47: {
        racines: ['47'],
        exclusions: [],
        sensNormal: 'LES_DEUX',
        libelle: 'Débiteurs et créditeurs divers (47)',
        lecture: "C'est ici que l'antériorité dit le plus. Le compte 47 enregistre « les opérations EN INSTANCE DE " +
            "RÉGULARISATION » (AUDCIF Titre VII, compte 47) : elles n'ont pas vocation à rester ouvertes. Une " +
            'ligne ouverte depuis plusieurs exercices y appelle la question du réviseur · correspond-elle encore ' +
            "à quelque chose ?",
    },
};
exports.DETENTEUR_LIQUIDATION_TVA = 'une liquidation de TVA';
exports.DETENTEUR_PAIE_DU_MOIS = 'la paie du mois (bulletins de paie)';
exports.DETENTEUR_RECLASSEMENT_CREANCE = 'une créance douteuse (reclassement au 416)';
exports.DETENTEUR_REVUE_CREANCE = 'une créance douteuse (revue de la dépréciation)';
exports.DETENTEUR_MOUVEMENT_CREANCE = 'une créance douteuse (perte ou recouvrement)';
exports.DETENTEUR_RECUPERATION_TVA_CREANCE = 'une créance douteuse (récupération de la TVA, art. 52)';
exports.DETENTEUR_DEVISE_A_NOUVEAU = "la devise déclarée d'un à-nouveau (fenêtre Devises)";
exports.DETENTEUR_CORRECTION_CREANCE = 'une créance douteuse (correction par le résultat)';
exports.DETENTEUR_IMPOT_RESULTAT = "l'écriture de l'impôt sur le résultat (fenêtre Résultat fiscal)";
exports.DETENTEUR_ACQUISITION_IMMOBILISATION = 'une immobilisation (acquisition)';
exports.DETENTEUR_DONATION = 'une donation';
exports.DETENTEUR_EXECUTION_ENGAGEMENT = "l'exécution d'un engagement de dépense";
function modesPortesPar(lignes) {
    return new Set(lignes.map((l) => l.modeReglementId).filter((id) => !!id));
}
async function relireLExerciceDansLaTransaction(tx, tenantId, exerciceId, date) {
    const exercice = await tx.exercice.findFirst({
        where: { id: exerciceId, tenantId },
        select: { dateDebut: true, dateFin: true, statut: true },
    });
    if (!exercice)
        throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
    if (exercice.statut === client_1.StatutExercice.CLOTURE) {
        throw new common_1.ForbiddenException("Impossible d'enregistrer une écriture sur un exercice clôturé");
    }
    const horsExercice = motifDateHorsExercice(date, exercice);
    if (horsExercice)
        throw new common_1.BadRequestException(horsExercice);
}
function motifDateHorsExercice(date, exercice) {
    if (Number.isNaN(date.getTime()))
        return "La date de l'écriture est illisible.";
    if (date >= exercice.dateDebut && date <= exercice.dateFin)
        return null;
    return (`La date ${date.toISOString().slice(0, 10)} sort de l'exercice sélectionné ` +
        `(${exercice.dateDebut.toISOString().slice(0, 10)} au ${exercice.dateFin.toISOString().slice(0, 10)}) · ` +
        "une écriture est rattachée à l'exercice qu'elle concerne.");
}
function donneesLigneSaisie(l, sectionsParId) {
    return {
        compteId: l.compteId,
        libelle: l.libelle,
        debit: l.debit ?? 0,
        credit: l.credit ?? 0,
        tauxTvaId: l.tauxTvaId,
        dateEcheance: l.dateEcheance ? new Date(l.dateEcheance) : undefined,
        dateVersement: l.dateVersement ? new Date(l.dateVersement) : undefined,
        deviseId: l.deviseId,
        montantDevise: l.montantDevise,
        coursApplique: (0, ligne_en_devise_1.coursDeLaLigne)(l),
        ...(l.modeReglementId ? { modeReglementId: l.modeReglementId } : {}),
        ...(l.ventilations && l.ventilations.length > 0
            ? {
                ventilations: {
                    create: l.ventilations.map((v) => ({
                        sectionId: v.sectionId,
                        planId: sectionsParId.get(v.sectionId).planId,
                        debit: v.debit ?? 0,
                        credit: v.credit ?? 0,
                    })),
                },
            }
            : {}),
    };
}
function memoriser(memoire, cle, lire) {
    if (!memoire)
        return lire();
    if (!memoire.has(cle))
        memoire.set(cle, lire());
    return memoire.get(cle);
}
async function comptesDeLaPiece(db, tenantId, compteIds, memoire) {
    if (!memoire)
        return db.compte.findMany({ where: { id: { in: compteIds }, tenantId } });
    const manquants = compteIds.filter((id) => !memoire.has(`compte:${id}`));
    if (manquants.length) {
        const lus = db.compte.findMany({ where: { id: { in: manquants }, tenantId } });
        for (const id of manquants)
            memoire.set(`compte:${id}`, lus.then((liste) => liste.find((c) => c.id === id) ?? null));
    }
    const comptes = await Promise.all(compteIds.map((id) => memoire.get(`compte:${id}`)));
    return comptes.filter((c) => c !== null);
}
let EcritureService = EcritureService_1 = class EcritureService {
    constructor(prisma, journalService, exerciceService, analytiqueService) {
        this.prisma = prisma;
        this.journalService = journalService;
        this.exerciceService = exerciceService;
        this.analytiqueService = analytiqueService;
    }
    async imputerAuxCapitauxPropresDOuverture(tenantId, createdBy, dto) {
        if (!dto.justification.trim()) {
            throw new common_1.BadRequestException('La justification est obligatoire : les deux textes exigent que le changement de méthode ou la correction ' +
                "d'erreur soit exposé dans les Notes annexes, et c'est elle qui rend l'exception vérifiable.");
        }
        if (Math.abs(dto.montant) <= 0.005) {
            throw new common_1.BadRequestException("Une imputation d'ouverture de montant nul ne corrige rien");
        }
        const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        const [ran, contrepartie] = await Promise.all([
            this.prisma.compte.findFirst({ where: { id: dto.compteReportANouveauId, tenantId } }),
            this.prisma.compte.findFirst({ where: { id: dto.compteContrepartieId, tenantId } }),
        ]);
        if (!ran)
            throw new common_1.BadRequestException('Compte de report à nouveau introuvable pour ce tenant');
        if (!contrepartie)
            throw new common_1.BadRequestException('Compte de contrepartie introuvable pour ce tenant');
        if (!ran.numero.startsWith('12')) {
            throw new common_1.BadRequestException("L'imputation d'ouverture se porte au compte 12 « Report à nouveau ». Les deux textes parlent d'un " +
                'ajustement des capitaux propres D\'OUVERTURE, que le report à nouveau est le seul compte à porter.');
        }
        if (contrepartie.numero.startsWith('6') || contrepartie.numero.startsWith('7')) {
            throw new common_1.BadRequestException("La contrepartie d'une imputation d'ouverture est un poste de BILAN. Une contrepartie de charge ou de " +
                'produit ferait transiter l’impact par le résultat de l’exercice, ce qui est le traitement ordinaire ' +
                'auquel ces deux cas font exception.');
        }
        const motifs = {
            CHANGEMENT_METHODE: 'Changement de méthode comptable',
            CORRECTION_ERREUR_SIGNIFICATIVE: "Correction d'erreur significative d'un exercice antérieur",
        };
        const montant = Math.abs(dto.montant);
        const ecriture = await this.creer(tenantId, createdBy, {
            exerciceId: dto.exerciceId,
            journalId: dto.journalId,
            date: exercice.dateDebut.toISOString().slice(0, 10),
            libelle: `${motifs[dto.motif]} · imputation aux capitaux propres d'ouverture`,
            lignes: dto.montant > 0
                ? [
                    { compteId: ran.id, debit: montant, credit: 0 },
                    { compteId: contrepartie.id, debit: 0, credit: montant },
                ]
                : [
                    { compteId: contrepartie.id, debit: montant, credit: 0 },
                    { compteId: ran.id, debit: 0, credit: montant },
                ],
        });
        return this.prisma.ecriture.update({
            where: { id: ecriture.id },
            data: {
                motifImputationOuverture: dto.motif,
                justificationImputationOuverture: dto.justification.trim(),
            },
        });
    }
    async verifierComptesEnSommeil(tenantId, lignes, confirme) {
        if (confirme || !lignes || lignes.length === 0)
            return;
        const ids = [...new Set(lignes.map((l) => l.compteId))];
        const endormis = await this.prisma.compte.findMany({
            where: { id: { in: ids }, tenantId, estActif: false },
            select: { numero: true },
        });
        if (endormis.length === 0)
            return;
        throw new common_1.BadRequestException(`Compte en sommeil : ${endormis.map((c) => c.numero).join(', ')} · confirmez la saisie ` +
            'ou réactivez le compte dans le plan comptable.');
    }
    async verifierComptesPersonnalises(tenantId, lignes, geste = 'une saisie') {
        if (!lignes || lignes.length === 0)
            return;
        const non = await (0, comptes_proposes_1.comptesNonPersonnalises)(this.prisma, tenantId, lignes.map((l) => l.compteId));
        const motif = (0, comptes_proposes_1.motifComptesNonPersonnalises)(non, geste);
        if (motif)
            throw new common_1.BadRequestException(motif);
    }
    async verifierComptesCollectifs(tenantId, lignes, ecritureModifieeId, compteQuiSEndort) {
        if (!lignes || lignes.length === 0)
            return;
        const toutes = [...new Set(lignes.map((l) => l.compteId))];
        if (ecritureModifieeId) {
            const portees = await this.prisma.ligneEcriture.findMany({
                where: { ecritureId: ecritureModifieeId, ecriture: { tenantId } },
                select: { compteId: true },
            });
            const deja = new Set(portees.map((l) => l.compteId));
            if (toutes.every((id) => deja.has(id)))
                return;
        }
        const ids = toutes;
        const individuelsJuges = compteQuiSEndort ? { some: { id: { not: compteQuiSEndort } } } : { some: {} };
        const [collectifs, dossier, numerosDeLaPiece] = await Promise.all([
            this.prisma.compte.findMany({
                where: { tenantId, id: { in: ids }, individuels: individuelsJuges },
                select: { id: true, numero: true },
                orderBy: { numero: 'asc' },
            }),
            this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.compte.findMany({
                where: { tenantId, id: { in: toutes } },
                select: {
                    id: true,
                    numero: true,
                    journauxTresorerie: { where: { estActif: true, type: client_1.TypeJournal.TRESORERIE }, select: { id: true }, take: 1 },
                },
            }),
        ]);
        if (!dossier)
            throw new common_1.NotFoundException('Dossier introuvable');
        const referentiel = dossier.referentiel;
        const dejaCollectifs = new Set(collectifs.map((c) => c.id));
        const aJuger = numerosDeLaPiece.filter((c) => {
            if (dejaCollectifs.has(c.id))
                return false;
            if ((c.journauxTresorerie ?? []).length > 0)
                return false;
            if ((0, subdivisions_du_plan_1.estCompteDePassage)(c.numero))
                return false;
            return (0, subdivisions_du_plan_1.racineDuCompteSeme)(referentiel, c.numero) !== null;
        });
        const lus = await Promise.all(aJuger.map(async (c) => ({
            c,
            siens: await this.prisma.compte.findMany({
                where: {
                    tenantId,
                    typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                    estActif: true,
                    numero: { startsWith: (0, subdivisions_du_plan_1.racineDuCompteSeme)(referentiel, c.numero), not: c.numero },
                    NOT: (0, subdivisions_du_plan_1.racinesSousLeCompteSeme)(referentiel, c.numero).map((r) => ({ numero: { startsWith: r } })),
                    ...(compteQuiSEndort ? { id: { not: compteQuiSEndort } } : {}),
                },
                select: { numero: true, intitule: true },
                orderBy: { numero: 'asc' },
                take: 4,
            }),
        })));
        const subdivises = [];
        const exemplesDuPlan = new Map();
        for (const { c, siens } of lus) {
            if (siens.length === 0)
                continue;
            subdivises.push({ id: c.id, numero: c.numero });
            exemplesDuPlan.set(c.id, siens);
        }
        let generiques = [
            ...collectifs.map((c) => ({ ...c, nature: 'COLLECTIF' })),
            ...subdivises.map((c) => ({ ...c, nature: 'PLAN' })),
        ];
        if (generiques.length === 0)
            return;
        const idsGeneriques = generiques.map((c) => c.id);
        const [par416, par491, parEcart] = await Promise.all([
            this.prisma.creanceDouteuse.findMany({
                where: { tenantId, compte416Id: { in: idsGeneriques }, annuleeLe: null },
                select: { compte416Id: true },
                distinct: ['compte416Id'],
            }),
            this.prisma.creanceDouteuse.findMany({
                where: { tenantId, compte491Id: { in: idsGeneriques }, annuleeLe: null, corrigeeParResultatLe: null },
                select: { compte491Id: true },
                distinct: ['compte491Id'],
            }),
            this.prisma.ecartInventaire.findMany({
                where: { tenantId, compteId: { in: idsGeneriques }, ecritureId: null },
                select: { compteId: true },
                distinct: ['compteId'],
            }),
        ]);
        const tenusParUnModule = new Set([
            ...par416.map((t) => t.compte416Id),
            ...par491.map((t) => t.compte491Id),
            ...parEcart.map((t) => t.compteId),
        ]);
        generiques = generiques.filter((c) => !tenusParUnModule.has(c.id));
        if (generiques.length === 0)
            return;
        if (generiques.length === 1) {
            const seul = generiques[0];
            const siensDansLaPiece = seul.nature === 'COLLECTIF'
                ? (await this.prisma.compte.findMany({
                    where: { tenantId, id: { in: toutes }, collectifId: seul.id },
                    select: { id: true },
                })).map((c) => c.id)
                : numerosDeLaPiece
                    .filter((c) => (0, subdivisions_du_plan_1.compteSemeSubdivise)(referentiel, c.numero) === seul.numero)
                    .map((c) => c.id);
            const famille = new Set([seul.id, ...siensDansLaPiece]);
            if (siensDansLaPiece.length > 0 && toutes.every((id) => famille.has(id)))
                return;
        }
        const nommer = (numero, siens) => `${numero} (${siens
            .slice(0, 3)
            .map((c) => `${c.numero} ${c.intitule}`)
            .join(', ')}${siens.length > 3 ? '…' : ''})`;
        const phrases = [];
        const desCollectifs = generiques.filter((c) => c.nature === 'COLLECTIF');
        if (desCollectifs.length > 0) {
            const motifs = [];
            for (const col of desCollectifs) {
                const siens = await this.prisma.compte.findMany({
                    where: { tenantId, collectifId: col.id },
                    select: { numero: true, intitule: true },
                    orderBy: { numero: 'asc' },
                    take: 4,
                });
                motifs.push(nommer(col.numero, siens));
            }
            phrases.push(`Compte collectif : ${motifs.join(' ; ')} · une écriture saisie s'impute au compte du tiers, jamais à son ` +
                'collectif, sans quoi la balance des tiers, le lettrage et les relances ne la verraient pas. Un montant ' +
                'déjà porté au collectif se reporte sur le compte du tiers par une pièce qui ne porte que ce collectif ' +
                'et ses comptes de tiers.');
        }
        const duPlan = generiques.filter((c) => c.nature === 'PLAN');
        if (duPlan.length > 0) {
            phrases.push(`Compte du plan subdivisé par le dossier : ${duPlan
                .map((c) => nommer(c.numero, exemplesDuPlan.get(c.id) ?? []))
                .join(' ; ')} · une écriture saisie s'impute à l'un des comptes que le dossier a ouverts sous lui. Un ` +
                'montant déjà porté à ce compte se reporte par une pièce qui ne porte que lui et ses sous-comptes ; il ' +
                'se rouvre à la saisie quand ses sous-comptes sont mis en sommeil.');
        }
        throw new common_1.BadRequestException(phrases.join(' '));
    }
    async controlesDEntree(tenantId, piece, db = this.prisma, memoire) {
        const exercice = await memoriser(memoire, `exercice:${piece.exerciceId}`, () => db.exercice.findFirst({ where: { id: piece.exerciceId, tenantId } }));
        if (!exercice) {
            throw new common_1.BadRequestException('Exercice introuvable pour ce tenant');
        }
        if (exercice.statut === client_1.StatutExercice.CLOTURE) {
            const dossier = await db.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
            throw new common_1.ForbiddenException((0, exercice_cloture_1.motifExerciceCloture)(dossier?.referentiel ?? client_1.Referentiel.SYSCOHADA));
        }
        let date = new Date(piece.date);
        const horsExercice = motifDateHorsExercice(date, exercice);
        if (horsExercice)
            throw new common_1.BadRequestException(horsExercice);
        const journal = await memoriser(memoire, `journal:${piece.journalId}`, () => this.journalService.trouver(tenantId, piece.journalId));
        if (!journal.estActif) {
            throw new common_1.BadRequestException(`Le journal ${journal.code} est en sommeil`);
        }
        if ((0, ecritures_de_situation_1.estJournalDeSituation)(journal) && !piece.journalDeSituationAdmis) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifJournalDeSituationReserveALaSaisie)(journal.code));
        }
        let sectionsParId = new Map();
        if (piece.lignes) {
            const totalDebit = piece.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
            const totalCredit = piece.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
            if (piece.lignes.length < 2 || Math.abs(totalDebit - totalCredit) > 0.005) {
                throw new common_1.BadRequestException(`Écriture déséquilibrée : débit=${totalDebit} crédit=${totalCredit}`);
            }
            const tauxTvaIds = [...new Set(piece.lignes.map((l) => l.tauxTvaId).filter((id) => !!id))];
            if (tauxTvaIds.length > 0) {
                const tauxTrouves = await db.tauxTva.findMany({ where: { id: { in: tauxTvaIds }, tenantId } });
                if (tauxTrouves.length !== tauxTvaIds.length) {
                    throw new common_1.BadRequestException('Un ou plusieurs taux de TVA sont introuvables pour ce tenant');
                }
            }
            const modeIds = [...new Set(piece.lignes.map((l) => l.modeReglementId).filter((id) => !!id))];
            if (modeIds.length > 0) {
                const modes = await db.modeReglement.findMany({
                    where: { id: { in: modeIds }, tenantId },
                    select: { id: true, code: true, estActif: true },
                });
                if (modes.length !== modeIds.length) {
                    throw new common_1.BadRequestException('Un ou plusieurs modes de règlement sont introuvables pour ce dossier.');
                }
                const enSommeil = modes.filter((m) => !m.estActif && !piece.modesDejaPortes?.has(m.id));
                if (enSommeil.length > 0) {
                    throw new common_1.BadRequestException(`Le mode de règlement ${enSommeil.map((m) => m.code).join(', ')} est en sommeil · réactivez-le dans Modes de règlement, ou choisissez-en un autre.`);
                }
            }
            const compteIds = [...new Set(piece.lignes.map((l) => l.compteId))];
            const comptes = await comptesDeLaPiece(db, tenantId, compteIds, memoire);
            if (comptes.length !== compteIds.length) {
                throw new common_1.BadRequestException('Un ou plusieurs comptes sont introuvables pour ce tenant');
            }
            const comptesTotal = comptes.filter((c) => c.typeCompte === client_1.TypeCompteDetailTotal.TOTAL);
            if (comptesTotal.length > 0) {
                throw new common_1.BadRequestException(`Impossible de saisir sur un compte Total (${comptesTotal.map((c) => c.numero).join(', ')}) · ` +
                    'ce sont des comptes de regroupement, saisissez sur le compte Détail concerné');
            }
            const numeroParId = new Map(comptes.map((c) => [c.id, c.numero]));
            const ecart = (0, classe_9_equilibree_1.ecartClasse9)(piece.lignes.map((l) => ({ numero: numeroParId.get(l.compteId) ?? '', debit: l.debit, credit: l.credit })));
            if (ecart !== 0) {
                const dossier = await db.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
                throw new common_1.BadRequestException((0, classe_9_equilibree_1.motifRefusClasse9)(dossier?.referentiel ?? client_1.Referentiel.SYSCOHADA, ecart));
            }
        }
        let dateValeur = null;
        if (piece.reporterAuPremierJourOuvert) {
            const premier = await this.exerciceService.premierJourOuvert(tenantId, piece.journalId, date);
            if (premier.getTime() !== date.getTime()) {
                if (premier > exercice.dateFin) {
                    throw new common_1.BadRequestException(`Le premier jour non clôturé (${premier.toISOString().slice(0, 10)}) tombe hors de l'exercice ` +
                        `(clos le ${exercice.dateFin.toISOString().slice(0, 10)}) · reporter l'opération changerait l'exercice qui ` +
                        "porte la charge ou le produit. Rouvrez la période, ou traitez-la comme une opération d'exercice antérieur.");
                }
                dateValeur = date;
                date = premier;
            }
        }
        if (memoire) {
            const clotures = await memoriser(memoire, `clotures:${piece.journalId}`, () => this.exerciceService.cloturesApplicables(tenantId, piece.journalId));
            (0, exercice_service_1.refuserSiPeriodeClose)(clotures, piece.journalId, date);
        }
        else {
            await this.exerciceService.verifierEcritureAutorisee(tenantId, piece.journalId, date);
        }
        if (piece.lignes) {
            if (piece.exigerVentilationObligatoire !== false) {
                await this.analytiqueService.verifierVentilationObligatoire(tenantId, piece.lignes);
            }
            sectionsParId = await this.verifierSectionsVentilees(tenantId, piece.lignes, db);
            if (piece.lignes.some(ligne_en_devise_1.porteUneDevise)) {
                const devises = await memoriser(memoire, 'devises', () => db.devise.findMany({ where: { tenantId }, select: { id: true, code: true } }));
                const parId = new Map(devises.map((d) => [d.id, d]));
                for (const [i, l] of piece.lignes.entries()) {
                    const motif = (0, ligne_en_devise_1.motifRefusLigneEnDevise)(l, l.deviseId ? parId.get(l.deviseId) : undefined);
                    if (motif)
                        throw new common_1.BadRequestException(`Ligne ${i + 1} · ${motif}`);
                }
            }
        }
        return { exercice, journal, date, dateValeur, sectionsParId };
    }
    async creer(tenantId, createdBy, dto, options = {}) {
        return (await this.creerAvec(tenantId, createdBy, dto, async () => undefined, options)).ecriture;
    }
    async creerAvec(tenantId, createdBy, dto, suite, options = {}) {
        const r = await this.creerPlusieursAvec(tenantId, createdBy, [dto], (tx, [ecriture]) => suite(tx, ecriture), options);
        return { ecriture: r.ecritures[0], suite: r.suite };
    }
    async creerPlusieursAvec(tenantId, createdBy, dtos, suite, options = {}) {
        const controles = [];
        for (const dto of dtos) {
            controles.push({ dto, ...(await this.controlesDEntree(tenantId, { ...dto, journalDeSituationAdmis: options.saisie === true })) });
        }
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const ecritures = [];
            for (const { dto, journal, date, dateValeur, sectionsParId } of controles) {
                await relireLExerciceDansLaTransaction(tx, tenantId, dto.exerciceId, date);
                const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, journal, dto.exerciceId, date, tx);
                ecritures.push(await tx.ecriture.create({
                    data: {
                        tenantId,
                        exerciceId: dto.exerciceId,
                        journalId: dto.journalId,
                        numeroPiece,
                        date,
                        dateValeur,
                        libelle: dto.libelle,
                        reference: dto.reference,
                        createdBy,
                        statut: (0, ecritures_de_situation_1.statutDeNaissance)(journal),
                        lignes: { create: dto.lignes.map((l) => donneesLigneSaisie(l, sectionsParId)) },
                    },
                    include: { lignes: true, journal: true },
                }));
            }
            return { ecritures, suite: await suite(tx, ecritures) };
        }, `Trop d'écritures enregistrées au même instant sur le journal ${controles[0]?.journal.code ?? ''} · veuillez réessayer.`);
    }
    async verifierSectionsVentilees(tenantId, lignes, db = this.prisma) {
        const sectionIds = [
            ...new Set(lignes.flatMap((l) => (l.ventilations ?? []).map((v) => v.sectionId))),
        ];
        const sectionsParId = new Map();
        if (sectionIds.length === 0)
            return sectionsParId;
        const sections = await db.sectionAnalytique.findMany({
            where: { id: { in: sectionIds }, tenantId },
            include: { plan: { select: { code: true } } },
        });
        if (sections.length !== sectionIds.length) {
            throw new common_1.BadRequestException('Une ou plusieurs sections analytiques sont introuvables pour ce dossier');
        }
        const totale = sections.find((s) => s.type === client_1.TypeCompteDetailTotal.TOTAL);
        if (totale) {
            throw new common_1.BadRequestException(`La section ${totale.code} est de type Total : elle regroupe ses sections Détail dans les états et ne reçoit pas de ventilation directe.`);
        }
        const sommeil = sections.find((s) => !s.estActive);
        if (sommeil) {
            throw new common_1.BadRequestException(`La section analytique ${sommeil.code} est en sommeil`);
        }
        for (const s of sections) {
            sectionsParId.set(s.id, { planId: s.planId, code: s.code, planCode: s.plan.code });
        }
        for (const [index, ligne] of lignes.entries()) {
            if (!ligne.ventilations || ligne.ventilations.length === 0)
                continue;
            const parPlan = new Map();
            for (const v of ligne.ventilations) {
                const s = sectionsParId.get(v.sectionId);
                const cumul = parPlan.get(s.planId) ?? { debit: 0, credit: 0, planCode: s.planCode };
                cumul.debit += v.debit ?? 0;
                cumul.credit += v.credit ?? 0;
                parPlan.set(s.planId, cumul);
            }
            for (const [, cumul] of parPlan) {
                if (Math.abs(cumul.debit - (ligne.debit ?? 0)) > 0.005 ||
                    Math.abs(cumul.credit - (ligne.credit ?? 0)) > 0.005) {
                    throw new common_1.BadRequestException(`Ligne ${index + 1} : ventilation incomplète sur le plan ${cumul.planCode} · ` +
                        `${cumul.debit.toFixed(2)} au débit et ${cumul.credit.toFixed(2)} au crédit, ` +
                        `pour une ligne de ${(ligne.debit ?? 0).toFixed(2)} / ${(ligne.credit ?? 0).toFixed(2)}.`);
                }
            }
        }
        return sectionsParId;
    }
    async trouverEnBrouillard(tenantId, ecritureId, lettrageTolere = null) {
        const toleres = new Set(lettrageTolere === null ? [] : typeof lettrageTolere === 'string' ? [lettrageTolere] : lettrageTolere);
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            include: { lignes: true, journal: true, exercice: true },
        });
        if (!ecriture)
            throw new common_1.NotFoundException('Écriture introuvable pour ce dossier.');
        if (ecriture.statut === client_1.StatutEcriture.VALIDEE) {
            throw new common_1.ForbiddenException(`L'écriture n° ${ecriture.numeroPiece ?? ''} est validée : elle est entrée au livre-journal et ne se modifie ` +
                "plus. L'article 20 de l'AUDCIF n'ouvre qu'une voie, la correction par inscription en négatif.");
        }
        if (ecriture.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.ForbiddenException("L'exercice de cette écriture est clôturé.");
        }
        if (ecriture.estGenereeParCloture) {
            const premier = await this.prisma.exercice.findFirst({
                where: { tenantId },
                orderBy: { dateDebut: 'asc' },
                select: { id: true },
            });
            if (premier?.id !== ecriture.exerciceId) {
                throw new common_1.ForbiddenException("Cette écriture est un report à-nouveau calculé à la clôture · elle ne se modifie ni ne se supprime " +
                    "depuis le journal. Un report provisoire se relance depuis la fenêtre Exercices ; une erreur d'un " +
                    "exercice clôturé passe par l'imputation déclarée aux capitaux propres d'ouverture.");
            }
        }
        const lettree = ecriture.lignes.find((l) => (0, ligne_lettree_1.estTenueParUnLettrage)(l) && !(l.lettrageId !== null && toleres.has(l.lettrageId)));
        if (lettree) {
            throw new common_1.BadRequestException(`Une ligne de cette écriture est lettrée (${(0, ligne_lettree_1.designationLettrage)(lettree)}) : délettrez-la avant de modifier l'écriture.`);
        }
        const pointee = ecriture.lignes.find((l) => l.rapprochementId);
        if (pointee) {
            throw new common_1.BadRequestException('Une ligne de cette écriture est pointée dans un rapprochement bancaire : dépointez-la avant de modifier.');
        }
        return ecriture;
    }
    async modifier(tenantId, ecritureId, dto) {
        const ecriture = await this.trouverEnBrouillard(tenantId, ecritureId);
        await this.verifierAucunModuleNeLaTient(tenantId, [ecritureId], 'se modifie');
        const facture = await this.prisma.facture.findFirst({
            where: { tenantId, ecritureId },
            select: { numeroSerie: true },
        });
        if (facture) {
            throw new common_1.BadRequestException(`Cette écriture enregistre la facture ${facture.numeroSerie} · elle ne se modifie pas d'ici, la facture ` +
                "dirait un montant et le journal un autre. Supprimez-la au brouillard : la facture redevient « à " +
                "comptabiliser » et se repasse depuis la fenêtre Facturation.");
        }
        const { date, sectionsParId } = await this.controlesDEntree(tenantId, {
            exerciceId: ecriture.exerciceId,
            journalId: ecriture.journalId,
            date: dto.date ? new Date(dto.date) : ecriture.date,
            lignes: dto.lignes,
            journalDeSituationAdmis: true,
            modesDejaPortes: modesPortesPar(ecriture.lignes),
        });
        const changeDeMois = ecriture.journal.numerotation === client_1.NumerotationPiece.MENSUELLE &&
            (date.getUTCFullYear() !== ecriture.date.getUTCFullYear() || date.getUTCMonth() !== ecriture.date.getUTCMonth());
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const tenue = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { exerciceId: true } });
            if (!tenue)
                throw new common_1.NotFoundException('Écriture introuvable');
            await relireLExerciceDansLaTransaction(tx, tenantId, tenue.exerciceId, date);
            if (dto.lignes) {
                await tx.ligneEcriture.deleteMany({ where: { ecritureId } });
            }
            const numeroPiece = changeDeMois
                ? await this.journalService.prochainNumeroPiece(tenantId, ecriture.journal, ecriture.exerciceId, date, tx)
                : undefined;
            const modifiee = await tx.ecriture.update({
                where: { id: ecritureId },
                data: {
                    date,
                    ...(numeroPiece !== undefined ? { numeroPiece } : {}),
                    libelle: dto.libelle ?? undefined,
                    reference: dto.reference ?? undefined,
                    ...(dto.lignes ? { lignes: { create: dto.lignes.map((l) => donneesLigneSaisie(l, sectionsParId)) } } : {}),
                },
                include: { lignes: { include: { compte: true } }, journal: true },
            });
            await (0, pieces_jointes_ecriture_1.retoucherDescriptionDesPieces)(tx, tenantId, ecritureId);
            return modifiee;
        }, "Trop d'opérations simultanées sur ce journal · veuillez réessayer.");
    }
    async transfererDansUnJournalOrdinaire(tenantId, ecritureId, dto) {
        const ecriture = await this.prisma.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            select: {
                id: true,
                statut: true,
                exerciceId: true,
                journalId: true,
                numeroPiece: true,
                date: true,
                dateValeur: true,
                journal: { select: { code: true, type: true } },
            },
        });
        if (!ecriture)
            throw new common_1.NotFoundException('Écriture introuvable pour ce dossier.');
        const piece = `${ecriture.journal.code} n° ${ecriture.numeroPiece ?? '·'}`;
        const sansObjet = (0, ecritures_de_situation_1.motifTransfertSansObjet)(piece, ecriture.statut, (0, ecritures_de_situation_1.estJournalDeSituation)(ecriture.journal));
        if (sansObjet)
            throw new common_1.BadRequestException(sansObjet);
        const arrivee = await this.journalService.trouver(tenantId, dto.journalId);
        if ((0, ecritures_de_situation_1.estJournalDeSituation)(arrivee))
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifArriveeDeSituation)(arrivee.code));
        const { journal, date, dateValeur } = await this.controlesDEntree(tenantId, {
            exerciceId: ecriture.exerciceId,
            journalId: arrivee.id,
            date: ecriture.date,
            reporterAuPremierJourOuvert: dto.reporterAuPremierJourOuvert === true,
        });
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const relue = await tx.ecriture.findFirst({
                where: { id: ecritureId, tenantId },
                select: { statut: true, journalId: true, exerciceId: true },
            });
            if (!relue || relue.statut !== client_1.StatutEcriture.BROUILLARD || relue.journalId !== ecriture.journalId) {
                throw new common_1.ConflictException(`L'écriture ${piece} a changé depuis la lecture (validée, supprimée ou déjà transférée) · rechargez le brouillard.`);
            }
            await relireLExerciceDansLaTransaction(tx, tenantId, relue.exerciceId, date);
            const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, journal, relue.exerciceId, date, tx);
            const transferee = await tx.ecriture.update({
                where: { id: ecritureId },
                data: {
                    journalId: journal.id,
                    numeroPiece,
                    date,
                    ...(dateValeur ? { dateValeur: ecriture.dateValeur ?? dateValeur } : {}),
                },
                select: { id: true, numeroPiece: true, date: true, dateValeur: true, journal: { select: { code: true } } },
            });
            await (0, pieces_jointes_ecriture_1.retoucherDescriptionDesPieces)(tx, tenantId, ecritureId);
            return transferee;
        }, `Trop d'écritures enregistrées au même instant sur le journal ${journal.code} · veuillez réessayer.`);
    }
    async modifierPieceDuModule(tx, tenantId, ecritureId, dto) {
        const ecriture = await tx.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            include: { journal: true, lignes: { select: { modeReglementId: true } } },
        });
        if (!ecriture || ecriture.statut !== client_1.StatutEcriture.BROUILLARD) {
            throw new common_1.ConflictException("L'écriture a été validée ou retirée pendant la modification · rien n'est modifié.");
        }
        const { date, sectionsParId } = await this.controlesDEntree(tenantId, {
            exerciceId: ecriture.exerciceId,
            journalId: ecriture.journalId,
            date: new Date(dto.date),
            lignes: dto.lignes,
            modesDejaPortes: modesPortesPar(ecriture.lignes),
        }, tx);
        const changeDeMois = ecriture.journal.numerotation === client_1.NumerotationPiece.MENSUELLE &&
            (date.getUTCFullYear() !== ecriture.date.getUTCFullYear() || date.getUTCMonth() !== ecriture.date.getUTCMonth());
        if (changeDeMois)
            return false;
        await relireLExerciceDansLaTransaction(tx, tenantId, ecriture.exerciceId, date);
        const retirees = await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
        if (retirees.count === 0) {
            throw new common_1.ConflictException("L'écriture a été validée pendant la modification · rien n'est modifié.");
        }
        await tx.ecriture.update({
            where: { id: ecritureId },
            data: {
                date,
                ...(dto.libelle ? { libelle: dto.libelle } : {}),
                lignes: { create: dto.lignes.map((l) => donneesLigneSaisie(l, sectionsParId)) },
            },
            select: { id: true },
        });
        await (0, pieces_jointes_ecriture_1.retoucherDescriptionDesPieces)(tx, tenantId, ecritureId);
        return true;
    }
    async supprimer(tenantId, ecritureId, pourLeModule) {
        const tolere = pourLeModule?.lettrageTolere ?? null;
        const lue = await this.trouverEnBrouillard(tenantId, ecritureId, tolere);
        await this.verifierAucunModuleNeLaTient(tenantId, [ecritureId], 'se supprime', pourLeModule?.detenteur);
        const piecesDetachees = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (pourLeModule)
                await pourLeModule.liberer(tx);
            if (tolere !== null) {
                const restantes = await tx.ligneEcriture.findMany({
                    where: { ecritureId, ecriture: { tenantId } },
                    select: { lettre: true, lettrageId: true },
                });
                const lettree = restantes.find(ligne_lettree_1.estTenueParUnLettrage);
                if (lettree) {
                    throw new common_1.BadRequestException(`Une ligne de cette écriture est lettrée (${(0, ligne_lettree_1.designationLettrage)(lettree)}) : délettrez-la avant de supprimer l'écriture.`);
                }
            }
            const supprimable = lue.statut === client_1.StatutEcriture.SITUATION ? client_1.StatutEcriture.SITUATION : client_1.StatutEcriture.BROUILLARD;
            const detachees = await (0, pieces_jointes_ecriture_1.preparerLesPiecesADetacher)(tx, tenantId, ecritureId);
            await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: supprimable } } });
            const { count } = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: supprimable } });
            if (count !== 1) {
                throw new common_1.ConflictException("L'écriture a été validée ou retirée pendant sa suppression · elle n'est plus au brouillard, rien n'a été supprimé. " +
                    "Rechargez · une écriture validée se corrige par inscription en négatif (AUDCIF art. 20).");
            }
            return detachees;
        });
        return { supprime: true, piecesDetachees };
    }
    async retirerCompensation(tenantId, ecritureId, liberer) {
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const ecriture = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { id: true } });
            if (!ecriture)
                return;
            if (liberer)
                await liberer(tx);
            await tx.ligneEcriture.deleteMany({ where: { ecritureId } });
            await tx.ecriture.delete({ where: { id: ecritureId } });
        });
    }
    async detenteursDe(tenantId, ecritureIds) {
        const ecritureId = { in: [...new Set(ecritureIds)] };
        const parLEcriture = { ecritureId };
        const detenteursPossibles = [
            [exports.DETENTEUR_ACQUISITION_IMMOBILISATION, this.prisma.immobilisation.count({ where: { tenantId, ecritureAcquisitionId: ecritureId } })],
            ['une immobilisation (sortie)', this.prisma.immobilisation.count({ where: { tenantId, ecritureSortieId: ecritureId } })],
            ['une immobilisation (produit de cession)', this.prisma.immobilisation.count({ where: { tenantId, ecritureProduitCessionId: ecritureId } })],
            ['une immobilisation (mise en service d’un en-cours)', this.prisma.immobilisation.count({ where: { tenantId, ecritureMiseEnServiceId: ecritureId } })],
            ['une immobilisation (solde de la dette d\'acquisition)', this.prisma.immobilisation.count({ where: { tenantId, ecritureSoldeDetteAleatoireId: ecritureId } })],
            ['une immobilisation (écart de réévaluation soldé à la sortie)', this.prisma.immobilisation.count({ where: { tenantId, ecritureSortieEcartReevaluationId: ecritureId } })],
            ['un virement de fonds (journal d’origine)', this.prisma.virementFonds.count({ where: { tenantId, ecritureOrigineId: ecritureId } })],
            ['un virement de fonds (journal de destination)', this.prisma.virementFonds.count({ where: { tenantId, ecritureDestinationId: ecritureId } })],
            ['un virement de fonds annulé (négatif d’origine)', this.prisma.virementFonds.count({ where: { tenantId, ecritureNegatifOrigineId: ecritureId } })],
            ['un virement de fonds annulé (négatif de destination)', this.prisma.virementFonds.count({ where: { tenantId, ecritureNegatifDestinationId: ecritureId } })],
            [
                'le paiement des salaires (fenêtre Personnel)',
                this.prisma.paiementSalaires.count({ where: { tenantId, OR: [{ ecritureId }, { ecritureNegatifId: ecritureId }] } }),
            ],
            ["une dotation aux amortissements", this.prisma.dotationAmortissement.count({ where: parLEcriture })],
            ["une dépréciation d'immobilisation", this.prisma.depreciationImmobilisation.count({ where: parLEcriture })],
            ["un reclassement d'immobilisation", this.prisma.reclassementImmobilisation.count({ where: parLEcriture })],
            ['une réévaluation de devise', this.prisma.reevaluation.count({
                    where: { tenantId, annuleeLe: null, OR: [{ ecritureEcartsId: ecritureId }, { ecritureProvisionId: ecritureId }, { ecritureExtourneId: ecritureId }, { contrePassationDeclareeId: ecritureId }] },
                })],
            ['une régularisation', this.prisma.regularisation.count({
                    where: { tenantId, OR: [{ ecritureConstatationId: ecritureId }, { ecritureRepriseId: ecritureId }] },
                })],
            ["une échéance d'abonnement", this.prisma.echeanceAbonnement.count({ where: parLEcriture })],
            [exports.DETENTEUR_LIQUIDATION_TVA, this.prisma.liquidationTva.count({ where: { tenantId, ecritureId } })],
            [exports.DETENTEUR_DONATION, this.prisma.donation.count({ where: { tenantId, ecritureId } })],
            ['une affectation du résultat', this.prisma.affectationResultat.count({ where: { tenantId, ecritureId } })],
            [exports.DETENTEUR_EXECUTION_ENGAGEMENT, this.prisma.executionEngagement.count({ where: parLEcriture })],
            ['un mouvement de magasin', this.prisma.mouvementStock.count({ where: { tenantId, ecritureId, annuleLe: null } })],
            ["un écart d'inventaire (redressement)", this.prisma.ecartInventaire.count({ where: { tenantId, ecritureId } })],
            ["la clôture d'un contrat de location-acquisition", this.prisma.clotureLocationAcquisition.count({
                    where: { tenantId, OR: [{ ecritureId }, { ecritureExtourneId: ecritureId }] },
                })],
            ["la reprise d'une subvention d'investissement", this.prisma.repriseSubventionImmobilisation.count({ where: { tenantId, ecritureId } })],
            ["la réduction d'une subvention rattachée à un bien", this.prisma.reductionSubventionImmobilisation.count({ where: { tenantId, ecritureId } })],
            ["la révision rétroactive d'un plan d'amortissement", this.prisma.revisionPlanAmortissement.count({ where: { tenantId, ecritureId } })],
            ["l'incorporation de coûts d'emprunt", this.prisma.coutEmpruntIncorpore.count({ where: { tenantId, ecritureId } })],
            ['la réévaluation des immobilisations', this.prisma.reevaluationBilan.count({ where: { tenantId, ecritureId } })],
            ['la reprise de la provision spéciale de réévaluation', this.prisma.repriseProvisionReevaluation.count({ where: { tenantId, ecritureId } })],
            ['la provision pour démantèlement', this.prisma.mouvementDemantelement.count({ where: { tenantId, ecritureId } })],
            ["l'annulation d'un traitement d'immobilisation", this.prisma.annulationTraitementImmobilisation.count({
                    where: { tenantId, OR: [{ ecritureOrigineId: ecritureId }, { ecritureNegatifId: ecritureId }] },
                })],
            [exports.DETENTEUR_RECLASSEMENT_CREANCE, this.prisma.creanceDouteuse.count({ where: { tenantId, ecritureReclassementId: ecritureId, annuleeLe: null } })],
            [exports.DETENTEUR_REVUE_CREANCE, this.prisma.ajustementCreanceDouteuse.count({ where: { tenantId, ecritureId, annuleeLe: null } })],
            [
                exports.DETENTEUR_MOUVEMENT_CREANCE,
                this.prisma.mouvementCreanceDouteuse.count({ where: { tenantId, annuleeLe: null, OR: [{ ecritureId }, { ecriturePerteId: ecritureId }] } }),
            ],
            [exports.DETENTEUR_RECUPERATION_TVA_CREANCE, this.prisma.recuperationTvaCreance.count({ where: { tenantId, ecritureId, annuleeLe: null } })],
            [exports.DETENTEUR_DEVISE_A_NOUVEAU, this.prisma.declarationDeviseANouveau.count({ where: { tenantId, ecritureCorrectionId: ecritureId } })],
            [exports.DETENTEUR_CORRECTION_CREANCE, this.prisma.creanceDouteuse.count({ where: { tenantId, ecritureCorrectionResultatId: ecritureId } })],
            [exports.DETENTEUR_IMPOT_RESULTAT, this.prisma.constatImpotResultat.count({ where: { tenantId, ecritureId, annuleeLe: null } })],
            [
                exports.DETENTEUR_PAIE_DU_MOIS,
                this.prisma.bulletinPaie.count({ where: { tenantId, OR: [{ ecritureId }, { ecritureNegatifId: ecritureId }] } }),
            ],
            ['un amortissement dérogatoire', this.prisma.amortissementDerogatoire.count({ where: { tenantId, ecritureId } })],
            ['un ordre de virement', this.prisma.ligneOrdreVirement.count({ where: { tenantId, ecritureId } })],
            ["une consignation d'emballages", this.prisma.consignation.count({
                    where: { tenantId, OR: [{ ecritureConsignationId: ecritureId }, { ecritureDenouementId: ecritureId }] },
                })],
        ];
        const resultats = await Promise.all(detenteursPossibles.map(([, p]) => p));
        return detenteursPossibles.filter((_, i) => resultats[i] > 0).map(([nom]) => nom);
    }
    async detenteursDeLEcriture(tenantId, ecritureId) {
        return this.detenteursDe(tenantId, [ecritureId]);
    }
    async detenteursDesEcritures(tenantId, ecritureIds) {
        return ecritureIds.length === 0 ? [] : this.detenteursDe(tenantId, ecritureIds);
    }
    async verifierAucunModuleNeLaTient(tenantId, ecritureIds, geste, detenteurLibere) {
        const detenteurs = (await this.detenteursDe(tenantId, ecritureIds)).filter((nom) => nom !== detenteurLibere);
        if (detenteurs.length > 0) {
            throw new common_1.BadRequestException(`Cette écriture est la contrepartie comptable de ${detenteurs.join(' et ')} · ` +
                `elle ne ${geste} pas d'ici. Reprenez l'opération dans son module : ` +
                "retouchée seule, elle laisserait le module affirmer un montant ou une opération que " +
                "l'écriture ne porte plus, et rien ne le signalerait.");
        }
    }
    async valider(tenantId, valideeBy, ecritureIds, derogation) {
        const ecritures = await this.prisma.ecriture.findMany({
            where: { id: { in: ecritureIds }, tenantId },
            include: { lignes: true, exercice: { select: { statut: true } }, journal: { select: { code: true, type: true } } },
        });
        if (ecritures.length !== ecritureIds.length) {
            throw new common_1.NotFoundException('Une ou plusieurs écritures sont introuvables pour ce dossier.');
        }
        const dejaValidees = ecritures.filter((e) => e.statut === client_1.StatutEcriture.VALIDEE);
        const aValider = ecritures.filter((e) => e.statut === client_1.StatutEcriture.BROUILLARD);
        const situations = ecritures.filter((e) => e.statut === client_1.StatutEcriture.SITUATION);
        if (situations.length > 0) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifSituationNeSeValidePas)(situations.slice(0, 5).map((e) => `${e.journal.code} n° ${e.numeroPiece ?? '·'}`)));
        }
        const heritees = aValider.filter((e) => (0, ecritures_de_situation_1.estJournalDeSituation)(e.journal));
        if (heritees.length > 0) {
            throw new common_1.BadRequestException((0, ecritures_de_situation_1.motifBrouillardHeriteNeSeValidePas)(heritees.slice(0, 5).map((e) => `${e.journal.code} n° ${e.numeroPiece ?? '·'}`)));
        }
        for (const e of aValider) {
            if (e.estANouveauProvisoire) {
                throw new common_1.BadRequestException("Le report à-nouveau PROVISOIRE ne se valide pas · il est remplacé par le report définitif à la clôture de l'exercice précédent.");
            }
            if (e.exercice.statut === client_1.StatutExercice.CLOTURE) {
                throw new common_1.ForbiddenException(`L'exercice de l'écriture ${e.journal.code} n° ${e.numeroPiece ?? ''} est clôturé.`);
            }
            const debit = e.lignes.reduce((s, l) => s + Number(l.debit), 0);
            const credit = e.lignes.reduce((s, l) => s + Number(l.credit), 0);
            if (Math.abs(debit - credit) > 0.005) {
                throw new common_1.BadRequestException(`L'écriture ${e.journal.code} n° ${e.numeroPiece ?? ''} est déséquilibrée (${debit} / ${credit}) : ` +
                    'corrigez-la avant de la valider.');
            }
        }
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { doubleRegardValidation: true, referentiel: true },
        });
        const visa = this.visaSecondRegard(derogation);
        const soumises = dossier.doubleRegardValidation && !visa
            ? aValider.filter((e) => !e.estGenereeParCloture)
            : [];
        const ecartees = soumises.filter((e) => e.createdBy === valideeBy);
        const idsEcartees = new Set(ecartees.map((e) => e.id));
        const validables = aValider.filter((e) => !idsEcartees.has(e.id));
        const valideeAt = new Date();
        if (validables.length > 0) {
            await this.prisma.ecriture.updateMany({
                where: { id: { in: validables.map((e) => e.id) }, tenantId },
                data: {
                    statut: client_1.StatutEcriture.VALIDEE,
                    valideeAt,
                    valideeBy,
                    ...(visa ? { secondRegardNom: visa.nom, secondRegardMotif: visa.motif } : {}),
                },
            });
        }
        return {
            validees: validables.length,
            dejaValidees: dejaValidees.length,
            refuseesSecondRegard: ecartees.length,
            sousDerogation: visa ? validables.length : 0,
            motifRefus: ecartees.length > 0 ? this.motifDoubleRegard(dossier.referentiel) : null,
            ecarteesJournalDeSituation: 0,
        };
    }
    visaSecondRegard(d) {
        const nom = d?.secondRegardNom?.trim();
        const motif = d?.secondRegardMotif?.trim();
        if (!nom && !motif)
            return null;
        if (!nom || !motif) {
            throw new common_1.BadRequestException('Une dérogation au double regard porte un NOM et un MOTIF, et les deux sont exigés. Le nom dit qui a relu ' +
                'la pièce hors du logiciel, le motif dit ce qui a été relu · c\'est ce couple, et lui seul, qui rend le ' +
                'visa opposable à un auditeur. Un nom seul n\'atteste de rien.');
        }
        return { nom, motif };
    }
    motifDoubleRegard(referentiel) {
        const commun = 'Ce dossier exige un second regard : une écriture n’est validée que par un autre utilisateur que celui qui ' +
            'l’a saisie. Aucun texte n’impose cette séparation · c’est une procédure que l’entité s’est donnée, et elle ' +
            'se règle dans Paramètres du dossier. ';
        return referentiel === client_1.Referentiel.SYCEBNL
            ? commun +
                'SYCEBNL, art. 16, 2) : « la mise en place de procédures nécessaires à une organisation comptable ' +
                'permettant un contrôle interne fiable et le contrôle externe […] ». L’art. 69 de l’AUDCIF, qui délègue ' +
                'expressément ces procédures à l’entité, est exclu par l’art. 3 du SYCEBNL.'
            : commun +
                'AUDCIF, art. 69 : « L’entité détermine, sous sa responsabilité, les procédures nécessaires à la mise en ' +
                'place d’une organisation comptable permettant aussi bien un contrôle interne fiable que le contrôle ' +
                'externe […]. »';
    }
    async validerJusqua(tenantId, valideeBy, dto) {
        const [exercice, journal] = await Promise.all([
            this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { id: true } }),
            dto.journalId ? this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId }, select: { id: true } }) : null,
        ]);
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        if (dto.journalId && !journal)
            throw new common_1.NotFoundException('Journal introuvable pour ce dossier.');
        const perimetre = {
            tenantId,
            exerciceId: dto.exerciceId,
            statut: client_1.StatutEcriture.BROUILLARD,
            estANouveauProvisoire: false,
            date: { lte: new Date(dto.dateLimite) },
            ...(dto.journalId ? { journalId: dto.journalId } : {}),
        };
        const [ecritures, heritees] = await Promise.all([
            this.prisma.ecriture.findMany({
                where: { ...perimetre, tenantId, journal: { type: { not: client_1.TypeJournal.SITUATION } } },
                select: { id: true },
            }),
            this.prisma.ecriture.count({ where: { ...perimetre, tenantId, journal: { type: client_1.TypeJournal.SITUATION } } }),
        ]);
        const ecarteesJournalDeSituation = heritees;
        const motifEcarteesJournalDeSituation = heritees > 0
            ? `${heritees} écriture(s) restée(s) au brouillard dans un journal de situation ne se valident pas dans ce ` +
                `journal · ${ecritures_de_situation_1.ISSUE_TRANSFERT}.`
            : null;
        if (ecritures.length === 0) {
            return {
                validees: 0,
                dejaValidees: 0,
                refuseesSecondRegard: 0,
                sousDerogation: 0,
                motifRefus: null,
                ecarteesJournalDeSituation,
                motifEcarteesJournalDeSituation,
            };
        }
        const resultat = await this.valider(tenantId, valideeBy, ecritures.map((e) => e.id), dto);
        return { ...resultat, ecarteesJournalDeSituation, motifEcarteesJournalDeSituation };
    }
    async brouillard(tenantId, params) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        const joursCentralisation = centralisation_brouillard_1.JOURS_CENTRALISATION[tenant.referentiel];
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: params.exerciceId, tenantId },
            select: { statut: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        const where = {
            tenantId,
            exerciceId: params.exerciceId,
            statut: client_1.StatutEcriture.BROUILLARD,
            ...(params.journalId ? { journalId: params.journalId } : {}),
            ...(params.dateDebut || params.dateFin
                ? {
                    date: {
                        ...(params.dateDebut ? { gte: new Date(params.dateDebut) } : {}),
                        ...(params.dateFin ? { lte: new Date(params.dateFin) } : {}),
                    },
                }
                : {}),
        };
        const maintenant = Date.now();
        const totaux = { nombre: 0, debit: 0, credit: 0, desequilibrees: 0, enRetard: 0 };
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
            where: { ...where, tenantId },
            select: {
                id: true,
                createdAt: true,
                estANouveauProvisoire: true,
                estGenereeParCloture: true,
                lignes: { select: { debit: true, credit: true } },
            },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
        }), (e) => {
            const debit = e.lignes.reduce((t, l) => t + Number(l.debit), 0);
            const credit = e.lignes.reduce((t, l) => t + Number(l.credit), 0);
            totaux.nombre++;
            totaux.debit += debit;
            totaux.credit += credit;
            if (Math.abs(debit - credit) > 0.005)
                totaux.desequilibrees++;
            if ((0, centralisation_brouillard_1.enRetardDeCentralisation)(e, exercice.statut, tenant.referentiel, maintenant))
                totaux.enRetard++;
        }, lecture_par_lots_1.LOT_ECRITURES);
        const ecritures = await this.prisma.ecriture.findMany({
            where: { ...where, tenantId },
            take: exports.PLAFOND_ECRITURES_PAR_FENETRE,
            include: {
                journal: { select: { code: true, intitule: true, type: true } },
                lignes: {
                    include: {
                        compte: { select: { numero: true, intitule: true } },
                        ventilations: { select: { sectionId: true, debit: true, credit: true } },
                    },
                },
            },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        });
        const lignes = ecritures.map((e) => {
            const anciennete = (0, centralisation_brouillard_1.ancienneteJours)(e.createdAt, maintenant);
            const invalidable = (0, centralisation_brouillard_1.brouillardInvalidable)(e, exercice.statut);
            const debit = e.lignes.reduce((s, l) => s + Number(l.debit), 0);
            const credit = e.lignes.reduce((s, l) => s + Number(l.credit), 0);
            return {
                id: e.id,
                date: e.date.toISOString().slice(0, 10),
                createdAt: e.createdAt.toISOString(),
                journal: e.journal.code,
                journalIntitule: e.journal.intitule,
                numeroPiece: e.numeroPiece,
                journalDeSituation: (0, ecritures_de_situation_1.estJournalDeSituation)(e.journal),
                libelle: e.libelle,
                reference: e.reference,
                debit,
                credit,
                equilibree: Math.abs(debit - credit) <= 0.005,
                ancienneteJours: anciennete,
                invalidable,
                retardCentralisation: (0, centralisation_brouillard_1.enRetardDeCentralisation)(e, exercice.statut, tenant.referentiel, maintenant),
                lignes: e.lignes.map((l) => {
                    const dateEcheance = l.dateEcheance ? l.dateEcheance.toISOString().slice(0, 10) : null;
                    const dateVersement = l.dateVersement ? l.dateVersement.toISOString().slice(0, 10) : null;
                    return {
                        compteId: l.compteId,
                        compteNumero: l.compte.numero,
                        compteIntitule: l.compte.intitule,
                        libelle: l.libelle,
                        debit: Number(l.debit),
                        credit: Number(l.credit),
                        tauxTvaId: l.tauxTvaId ?? null,
                        dateEcheance,
                        dateVersement,
                        modeReglementId: l.modeReglementId ?? null,
                        deviseId: l.deviseId ?? null,
                        montantDevise: l.montantDevise === null || l.montantDevise === undefined ? null : Number(l.montantDevise),
                        coursApplique: l.coursApplique === null || l.coursApplique === undefined ? null : Number(l.coursApplique),
                        ventilations: (l.ventilations ?? []).map((v) => ({
                            sectionId: v.sectionId,
                            debit: Number(v.debit),
                            credit: Number(v.credit),
                        })),
                    };
                }),
            };
        });
        return {
            lignes,
            totaux,
            tronque: totaux.nombre > lignes.length,
            plafond: exports.PLAFOND_ECRITURES_PAR_FENETRE,
            delaiCentralisationJours: joursCentralisation,
        };
    }
    async reimputer(tenantId, createdBy, dto, options = {}) {
        const ids = [...new Set(dto.ligneIds)];
        const cible = await this.prisma.compte.findFirst({ where: { id: dto.compteCibleId, tenantId } });
        if (!cible)
            throw new common_1.NotFoundException('Compte cible introuvable pour ce dossier.');
        if (cible.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
            throw new common_1.BadRequestException(`Le ${cible.numero} est un compte Total · il ne reçoit pas d'écriture.`);
        }
        if (!cible.estActif) {
            throw new common_1.BadRequestException(`Le ${cible.numero} est en sommeil · réactivez-le avant d'y réimputer.`);
        }
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: { id: { in: ids }, ecriture: { tenantId } },
            include: {
                compte: { select: { numero: true } },
                ventilations: true,
                ecriture: {
                    include: {
                        exercice: true,
                        journal: true,
                        immobilisationsAcquisition: { select: { id: true }, take: 1 },
                        immobilisationSortie: { select: { id: true } },
                        dotationAmortissement: { select: { id: true } },
                    },
                },
            },
        });
        if (lignes.length !== ids.length)
            throw new common_1.NotFoundException('Une ou plusieurs lignes sont introuvables.');
        const exercices = new Set(lignes.map((l) => l.ecriture.exerciceId));
        if (exercices.size > 1)
            throw new common_1.BadRequestException('Les lignes à réimputer doivent appartenir au même exercice.');
        const refus = lignes
            .map((l) => (0, reimputation_1.motifRefusLigne)({
            id: l.id,
            compteId: l.compteId,
            compteNumero: l.compte.numero,
            debit: Number(l.debit),
            credit: Number(l.credit),
            lettre: l.lettre,
            lettrageId: l.lettrageId,
            rapprochementId: l.rapprochementId,
            tauxTvaId: l.tauxTvaId,
            statut: l.ecriture.statut,
            exerciceClos: l.ecriture.exercice.statut === client_1.StatutExercice.CLOTURE,
            estGenereeParCloture: l.ecriture.estGenereeParCloture,
            tenueParImmobilisation: !!(l.ecriture.immobilisationsAcquisition.length > 0 ||
                l.ecriture.immobilisationSortie ||
                l.ecriture.dotationAmortissement),
        }, cible.id))
            .filter((m) => m !== null);
        if (refus.length)
            throw new common_1.BadRequestException([...new Set(refus)].join(' '));
        const valideesEnSituation = [
            ...new Map(lignes
                .filter((l) => l.ecriture.statut === client_1.StatutEcriture.VALIDEE && (0, ecritures_de_situation_1.estJournalDeSituation)(l.ecriture.journal))
                .map((l) => [l.ecritureId, `${l.ecriture.journal.code} n° ${l.ecriture.numeroPiece ?? '·'}`])).values(),
        ];
        if (valideesEnSituation.length > 0) {
            throw new common_1.BadRequestException(`${valideesEnSituation.join(', ')} ${valideesEnSituation.length > 1 ? 'ont été validées' : 'a été validée'} dans un ` +
                "journal de situation avant que ses écritures ne sortent du livre-journal · elle y est entrée et reste aux états. " +
                'Pour en corriger le compte, saisissez dans un journal ordinaire une pièce qui inscrit en négatif les lignes ' +
                'erronées puis les passe au bon compte (AUDCIF art. 20, al. 2).');
        }
        await this.verifierAucunModuleNeLaTient(tenantId, lignes.map((l) => l.ecritureId), 'se réimpute');
        const auBrouillard = lignes.filter((l) => l.ecriture.statut !== client_1.StatutEcriture.VALIDEE);
        const brouillardsVus = new Set();
        for (const l of auBrouillard) {
            if (brouillardsVus.has(l.ecritureId))
                continue;
            brouillardsVus.add(l.ecritureId);
            await this.exerciceService.verifierEcritureAutorisee(tenantId, l.ecriture.journalId, l.ecriture.date);
        }
        const validees = lignes.filter((l) => l.ecriture.statut === client_1.StatutEcriture.VALIDEE);
        const exercice = lignes[0].ecriture.exercice;
        const date = dto.date ? new Date(dto.date) : new Date();
        const parEcriture = new Map();
        for (const l of validees)
            parEcriture.set(l.ecritureId, [...(parEcriture.get(l.ecritureId) ?? []), l]);
        if (validees.length) {
            if (date < exercice.dateDebut || date > exercice.dateFin) {
                throw new common_1.BadRequestException("La date de la réimputation sort de l'exercice des lignes · l'inscription en négatif ne vaut que pour une erreur « commise et découverte sur l'exercice en cours » (AUDCIF art. 20).");
            }
            for (const groupe of parEcriture.values()) {
                await this.exerciceService.verifierEcritureAutorisee(tenantId, groupe[0].ecriture.journalId, date);
            }
        }
        if (options.simuler)
            return { auBrouillard: auBrouillard.length, validees: validees.length, ecrituresPassees: [] };
        const motif = dto.motif.trim();
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            if (auBrouillard.length) {
                await tx.ligneEcriture.updateMany({ where: { id: { in: auBrouillard.map((l) => l.id) } }, data: { compteId: cible.id } });
            }
            const passees = [];
            for (const groupe of parEcriture.values()) {
                const origine = groupe[0].ecriture;
                const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, origine.journal, origine.exerciceId, date, tx);
                const e = await tx.ecriture.create({
                    data: {
                        tenantId,
                        exerciceId: origine.exerciceId,
                        journalId: origine.journalId,
                        numeroPiece,
                        date,
                        libelle: `Réimputation vers ${cible.numero} · ${origine.libelle}`.slice(0, 190),
                        reference: origine.reference,
                        createdBy,
                        motifCorrection: motif,
                        lignes: {
                            create: groupe.flatMap((l) => (0, reimputation_1.lignesDeReimputation)({ compteId: l.compteId, debit: Number(l.debit), credit: Number(l.credit) }, cible.id).map((p) => ({
                                compteId: p.compteId,
                                libelle: l.libelle,
                                debit: p.debit,
                                credit: p.credit,
                                dateEcheance: l.dateEcheance,
                                dateVersement: l.dateVersement,
                                modeReglementId: l.modeReglementId,
                                deviseId: l.deviseId,
                                montantDevise: l.montantDevise,
                                coursApplique: l.coursApplique,
                                ventilations: {
                                    create: l.ventilations.map((v) => ({
                                        sectionId: v.sectionId,
                                        planId: v.planId,
                                        debit: Number(v.debit) * p.signeAnalytique,
                                        credit: Number(v.credit) * p.signeAnalytique,
                                    })),
                                },
                            }))),
                        },
                    },
                    select: { numeroPiece: true },
                });
                passees.push({ numeroPiece: e.numeroPiece, journal: origine.journal.code });
            }
            return { auBrouillard: auBrouillard.length, validees: validees.length, ecrituresPassees: passees };
        }, "Trop d'écritures enregistrées au même instant · veuillez réessayer.", { operations: 1 + parEcriture.size * 2 + validees.reduce((t, l) => t + 2 * (1 + l.ventilations.length), 0) });
    }
    async fusionnerComptes(tenantId, createdBy, sourceId, cibleId, motif) {
        const [source, cible] = await Promise.all([
            this.prisma.compte.findFirst({ where: { id: sourceId, tenantId } }),
            this.prisma.compte.findFirst({ where: { id: cibleId, tenantId } }),
        ]);
        if (!source || !cible)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        const refus = (0, reimputation_1.motifRefusFusionComptes)(source, cible);
        if (refus)
            throw new common_1.BadRequestException(refus);
        if (!motif?.trim())
            throw new common_1.BadRequestException('Le motif de la fusion est obligatoire.');
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: { compteId: source.id, ecriture: { tenantId, exercice: { statut: client_1.StatutExercice.OUVERT } } },
            select: { id: true, ecriture: { select: { exercice: { select: { id: true, dateDebut: true, dateFin: true } } } } },
        });
        const parExercice = new Map();
        for (const l of lignes) {
            const e = l.ecriture.exercice;
            const g = parExercice.get(e.id) ?? { exercice: e, ids: [] };
            g.ids.push(l.id);
            parExercice.set(e.id, g);
        }
        const aujourdhui = new Date();
        const demandes = [...parExercice.values()].map((g) => ({
            ligneIds: g.ids,
            compteCibleId: cible.id,
            date: (0, reimputation_1.dateDansExercice)(aujourdhui, g.exercice).toISOString().slice(0, 10),
            motif: `Fusion du ${source.numero} dans le ${cible.numero} · ${motif.trim()}`,
        }));
        for (const d of demandes)
            await this.reimputer(tenantId, createdBy, d, { simuler: true });
        const resultats = [];
        for (const d of demandes)
            resultats.push(await this.reimputer(tenantId, createdBy, d));
        await this.prisma.compte.update({ where: { id: source.id }, data: { estActif: false } });
        const restantes = await (0, references_1.referencesVers)(this.prisma, 'Compte', source.id, tenantId, ['LigneEcriture.compteId']);
        return {
            fusionne: true,
            source: source.numero,
            cible: cible.numero,
            auBrouillard: resultats.reduce((t, r) => t + r.auBrouillard, 0),
            validees: resultats.reduce((t, r) => t + r.validees, 0),
            ecrituresPassees: resultats.flatMap((r) => r.ecrituresPassees),
            encoreUtilisePar: restantes.map(references_1.libelleReference),
        };
    }
    async corrigerParInscriptionEnNegatif(tenantId, createdBy, ecritureId, dto) {
        const origine = await this.prisma.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            include: {
                lignes: { include: { ventilations: true } },
                journal: true,
                exercice: true,
                correction: { select: { id: true, numeroPiece: true } },
                immobilisationsAcquisition: { select: { id: true, designation: true, ligneAcquisitionId: true }, take: 1 },
                immobilisationSortie: { select: { id: true, designation: true } },
                dotationAmortissement: { select: { id: true } },
            },
        });
        if (!origine)
            throw new common_1.NotFoundException('Écriture introuvable pour ce dossier.');
        if (origine.statut === client_1.StatutEcriture.BROUILLARD) {
            throw new common_1.BadRequestException("Cette écriture est encore en brouillard : elle n'est pas entrée au livre-journal. " +
                "Modifiez-la directement plutôt que d'y ajouter une inscription en négatif, qui laisserait " +
                'deux écritures là où il n\'y a qu\'une saisie à reprendre.');
        }
        if (origine.statut === client_1.StatutEcriture.SITUATION) {
            throw new common_1.BadRequestException("Cette écriture est une écriture de situation : elle n'est pas au livre-journal. Modifiez-la ou supprimez-la " +
                'directement, une inscription en négatif ne corrige que ce que le livre-journal a reçu (AUDCIF art. 20, al. 2).');
        }
        if ((0, ecritures_de_situation_1.estJournalDeSituation)(origine.journal)) {
            throw new common_1.BadRequestException(`L'écriture ${origine.journal.code} n° ${origine.numeroPiece ?? '·'} a été validée dans un journal de situation ` +
                "avant que ses écritures ne sortent du livre-journal · elle y est entrée et reste aux états. Pour l'annuler, " +
                "saisissez dans un journal ordinaire une pièce qui inscrit ses lignes en négatif (AUDCIF art. 20, al. 2).");
        }
        this.verifierCorrigeable(origine);
        await this.verifierAucunModuleNeLaTient(tenantId, [origine.id], 'se corrige');
        const date = dto.date ? new Date(dto.date) : new Date();
        if (date < origine.exercice.dateDebut || date > origine.exercice.dateFin) {
            throw new common_1.BadRequestException(`La date de correction (${date.toLocaleDateString('fr-FR')}) sort de l'exercice de l'écriture corrigée ` +
                `(${origine.exercice.dateDebut.toLocaleDateString('fr-FR')} – ${origine.exercice.dateFin.toLocaleDateString('fr-FR')}). ` +
                "L'inscription en négatif ne vaut que pour une erreur « commise et découverte sur l'exercice en cours ». " +
                "Une erreur d'un exercice antérieur suit un autre traitement (cadre conceptuel, § corrections d'erreurs) : " +
                'elle doit faire l’objet d’une information dans les Notes annexes, et, si elle est significative, ' +
                "être corrigée par ajustement du report à nouveau d'ouverture ; si elle ne l'est pas, directement dans les " +
                "comptes de l'exercice en cours.");
        }
        await this.exerciceService.verifierEcritureAutorisee(tenantId, origine.journalId, date);
        return (0, prisma_retry_util_1.avecRetrySerialisable)(this.prisma, async (tx) => {
            const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, origine.journal, origine.exerciceId, date, tx);
            return tx.ecriture.create({
                data: {
                    tenantId,
                    exerciceId: origine.exerciceId,
                    journalId: origine.journalId,
                    numeroPiece,
                    date,
                    libelle: `Correction (inscription en négatif) · ${origine.libelle}`,
                    reference: origine.reference,
                    createdBy,
                    corrigeEcritureId: origine.id,
                    motifCorrection: dto.motifCorrection.trim(),
                    lignes: {
                        create: (0, lignes_en_negatif_1.lignesEnNegatif)(origine.lignes),
                    },
                },
                include: { lignes: true, journal: true },
            });
        }, `Trop d'écritures enregistrées au même instant sur le journal ${origine.journal.code} · veuillez réessayer.`);
    }
    async inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, motif, tx, options = {}) {
        const db = tx ?? this.prisma;
        const origine = await db.ecriture.findFirst({
            where: { id: ecritureId, tenantId },
            include: { lignes: { include: { ventilations: true } }, journal: true, exercice: true, correction: { select: { id: true } } },
        });
        if (!origine)
            throw new common_1.NotFoundException('Écriture introuvable pour ce dossier.');
        if (origine.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException(`L'écriture n° ${origine.numeroPiece ?? '·'} appartient à un exercice clôturé · son erreur se corrige par le report à nouveau ` +
                "(AUDCIF art. 20, al. 3), hors de ce geste.");
        }
        if (origine.correction) {
            throw new common_1.BadRequestException(`L'écriture n° ${origine.numeroPiece ?? '·'} est déjà corrigée par inscription en négatif.`);
        }
        const tenues = (0, lignes_tenues_1.motifLignesTenues)(origine.lignes, `l'écriture n° ${origine.numeroPiece ?? '·'}`, 'annuler', '', options.groupeTolere ?? null);
        if (tenues)
            throw new common_1.BadRequestException(tenues);
        let date = origine.date;
        let dateValeur = null;
        const premier = await this.exerciceService.premierJourOuvert(tenantId, origine.journalId, date, tx);
        if (premier.getTime() !== date.getTime()) {
            if (premier > origine.exercice.dateFin) {
                throw new common_1.BadRequestException(`Le premier jour non clôturé du journal ${origine.journal.code} (${premier.toISOString().slice(0, 10)}) tombe hors de l'exercice · ` +
                    "la période est close jusqu'à la fin de l'exercice, définitivement, et plus rien ne s'y inscrit (AUDCIF art. 22, 4°). " +
                    "L'annulation ne passe pas dans l'exercice suivant, la charge changerait d'exercice · une fois l'exercice clôturé, " +
                    "l'erreur relève du report à nouveau (art. 20, al. 3).");
            }
            dateValeur = date;
            date = premier;
        }
        const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, origine.journal, origine.exerciceId, date, tx);
        const maintenant = new Date();
        return db.ecriture.create({
            data: {
                tenantId,
                exerciceId: origine.exerciceId,
                journalId: origine.journalId,
                numeroPiece,
                date,
                dateValeur,
                libelle: `Annulation (inscription en négatif) · ${origine.libelle}`.slice(0, 250),
                reference: origine.reference,
                createdBy: userId,
                corrigeEcritureId: origine.id,
                motifCorrection: motif.trim(),
                statut: client_1.StatutEcriture.VALIDEE,
                valideeBy: userId,
                valideeAt: maintenant,
                lignes: { create: (0, lignes_en_negatif_1.lignesEnNegatif)(origine.lignes) },
            },
            select: { id: true, numeroPiece: true, date: true },
        });
    }
    verifierCorrigeable(e) {
        if (e.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.ForbiddenException("L'exercice est clôturé. Le texte vise l'erreur « commise et découverte sur l'exercice en cours », et les " +
                'erreurs de cet exercice « doivent être corrigées AVANT l’arrêté des comptes » (cadre conceptuel).');
        }
        if (e.correction) {
            throw new common_1.BadRequestException(`Cette écriture est déjà corrigée (pièce n° ${e.correction.numeroPiece ?? '·'}). Appliquer une seconde fois ` +
                "l'inscription en négatif inverserait l'erreur au lieu de l'annuler.");
        }
        if (e.corrigeEcritureId) {
            throw new common_1.BadRequestException("Cette écriture EST une correction. La corriger à son tour ré-inscrirait l'erreur : passez une nouvelle " +
                "écriture pour l'enregistrement exact (« l'enregistrement exact est ensuite opéré »).");
        }
        if (e.estGenereeParCloture) {
            throw new common_1.BadRequestException("Cette écriture a été générée par la clôture (solde des classes 6/7, report à-nouveau). La corriger à la main " +
                "désaccorderait le report à-nouveau du bilan d'ouverture, alors que le bilan d'ouverture d'un exercice doit " +
                "correspondre au bilan de clôture de l'exercice précédent (SYCEBNL art. 16, 4 ; AUDCIF art. 34). Seules deux " +
                "exceptions rompent cette correspondance, un changement de méthode à impact fort significatif et la " +
                "correction d'une erreur significative d'un exercice antérieur · elles passent par l'imputation déclarée " +
                "aux capitaux propres d'ouverture (fenêtre Exercices).");
        }
        const acquisition = e.immobilisationsAcquisition[0] ?? null;
        if (acquisition?.ligneAcquisitionId) {
            throw new common_1.BadRequestException(`La fiche d'immobilisation « ${acquisition.designation} » est née de cette écriture. Retirez d'abord la fiche ` +
                "(Structure > Immobilisations, onglet Général · l'écriture reste au journal), corrigez l'écriture, puis " +
                'recréez la fiche depuis la ligne exacte (« Créer depuis les écritures »).');
        }
        if (acquisition || e.immobilisationSortie) {
            const immo = acquisition ?? e.immobilisationSortie;
            throw new common_1.BadRequestException(`Cette écriture porte ${acquisition ? "l'acquisition" : 'la sortie'} de l'immobilisation ` +
                `« ${immo.designation} ». La corriger seule laisserait la fiche d'immobilisation et son plan ` +
                "d'amortissement en place, désormais sans écriture exacte en face : passez par le module Immobilisations.");
        }
        if (e.dotationAmortissement) {
            throw new common_1.BadRequestException("Cette écriture porte une dotation aux amortissements. La corriger seule laisserait la dotation enregistrée " +
                'sur la fiche d’immobilisation sans contrepartie comptable : passez par le module Immobilisations.');
        }
        const tenues = (0, lignes_tenues_1.motifLignesTenues)(e.lignes, 'cette écriture', 'corriger');
        if (tenues)
            throw new common_1.BadRequestException(tenues);
    }
    async lister(tenantId, filtres) {
        const where = perimetreJournal(tenantId, filtres);
        const take = filtres.limite ?? exports.PLAFOND_ECRITURES_PAR_FENETRE;
        const ecritures = await this.prisma.ecriture.findMany({
            take,
            where,
            include: {
                lignes: { include: { compte: true } },
                journal: true,
                correction: { select: { id: true, numeroPiece: true, date: true } },
                corrigeEcriture: { select: { id: true, numeroPiece: true, date: true, libelle: true } },
            },
            orderBy: filtres.limite || filtres.plusRecentesDAbord
                ? [{ date: 'desc' }, { numeroPiece: 'desc' }, { id: 'desc' }]
                : [{ date: 'asc' }, { numeroPiece: 'asc' }, { id: 'asc' }],
        });
        const [agg, total] = await Promise.all([
            this.prisma.ligneEcriture.aggregate({
                _sum: { debit: true, credit: true },
                where: { ecriture: where },
            }),
            this.prisma.ecriture.count({ where: { ...where, tenantId } }),
        ]);
        return {
            ecritures,
            totaux: { debit: Number(agg._sum.debit ?? 0), credit: Number(agg._sum.credit ?? 0) },
            total,
            tronque: total > ecritures.length,
            plafond: take,
        };
    }
    async chargerContreparties(where) {
        const brut = await this.prisma.ligneEcriture.findMany({
            where,
            select: { ecritureId: true, debit: true, compte: { select: { numero: true } } },
        });
        const debits = new Map();
        const credits = new Map();
        for (const l of brut) {
            const cible = estLigneDebit(l) ? debits : credits;
            let ens = cible.get(l.ecritureId);
            if (!ens) {
                ens = new Set();
                cible.set(l.ecritureId, ens);
            }
            ens.add(l.compte.numero);
        }
        const parEcriture = new Map();
        for (const ecritureId of new Set([...debits.keys(), ...credits.keys()])) {
            parEcriture.set(ecritureId, {
                DEBIT: [...(credits.get(ecritureId) ?? [])],
                CREDIT: [...(debits.get(ecritureId) ?? [])],
            });
        }
        return parEcriture;
    }
    static versLigneGrandLivre(l, soldeProgressif, contreparties) {
        const sens = estLigneDebit(l) ? 'DEBIT' : 'CREDIT';
        return {
            id: l.id,
            date: l.ecriture.date,
            journalCode: l.ecriture.journal.code,
            numeroPiece: l.ecriture.numeroPiece,
            libelle: l.libelle ?? l.ecriture.libelle,
            reference: l.ecriture.reference,
            debit: Number(l.debit),
            credit: Number(l.credit),
            lettre: l.lettre,
            soldeProgressif,
            contrepartie: contreparties.get(l.ecritureId)?.[sens] ?? [],
        };
    }
    async echeancier(tenantId, params) {
        const ref = params.dateReference ? new Date(params.dateReference) : new Date();
        ref.setHours(0, 0, 0, 0);
        const tresorerie = await this.prisma.ligneEcriture.aggregate({
            where: {
                ecriture: { tenantId, exerciceId: params.exerciceId, ...ecritures_de_situation_1.HORS_SITUATION },
                compte: { numero: { startsWith: '5' }, NOT: { numero: { startsWith: '59' } } },
            },
            _sum: { debit: true, credit: true },
        });
        const tresorerieActuelle = Number(tresorerie._sum.debit ?? 0) - Number(tresorerie._sum.credit ?? 0);
        const TRANCHES = [
            { cle: 'echu', libelle: 'Échu, non réglé', deJours: null, aJours: -1 },
            { cle: 'j0a7', libelle: 'À 7 jours', deJours: 0, aJours: 7 },
            { cle: 'j8a30', libelle: 'De 8 à 30 jours', deJours: 8, aJours: 30 },
            { cle: 'j31a60', libelle: 'De 31 à 60 jours', deJours: 31, aJours: 60 },
            { cle: 'j61a90', libelle: 'De 61 à 90 jours', deJours: 61, aJours: 90 },
            { cle: 'plus90', libelle: 'Au-delà de 90 jours', deJours: 91, aJours: null },
        ];
        const trancheDe = (echeance) => {
            const jours = Math.floor((echeance.getTime() - ref.getTime()) / 86_400_000);
            if (jours < 0)
                return 'echu';
            if (jours <= 7)
                return 'j0a7';
            if (jours <= 30)
                return 'j8a30';
            if (jours <= 60)
                return 'j31a60';
            if (jours <= 90)
                return 'j61a90';
            return 'plus90';
        };
        const cumuls = new Map();
        const plusProches = new lecture_par_lots_1.PremiersSelon(exports.PLAFOND_ECRITURES_PAR_FENETRE, (a, b) => a.date.getTime() - b.date.getTime());
        let lignesSansEcheance = 0;
        const ouvertes = {
            ecriture: { tenantId, exerciceId: params.exerciceId, ...ecritures_de_situation_1.HORS_SITUATION },
            lettre: null,
            OR: ['40', '41', '42', '43', '44'].map((r) => ({ compte: { numero: { startsWith: r } } })),
        };
        const ranger = (l, net) => {
            if (l.dateEcheance === null)
                lignesSansEcheance++;
            if (Math.abs(net) < 0.005)
                return;
            const date = l.dateEcheance ?? l.ecriture.date;
            const tranche = trancheDe(date);
            const c = cumuls.get(tranche) ?? { encaissements: 0, decaissements: 0 };
            if (net > 0)
                c.encaissements += net;
            else
                c.decaissements -= net;
            cumuls.set(tranche, c);
            plusProches.ajouter({
                ligneId: l.id,
                date,
                tranche: trancheDe(date),
                compteNumero: l.compte.numero,
                compteIntitule: l.compte.intitule,
                tiers: l.compte.tiersCompte?.tiers.nom ?? null,
                libelle: l.libelle ?? l.ecriture.libelle,
                reference: l.ecriture.reference,
                montant: Math.abs(net),
                sens: net > 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT',
            });
        };
        const aPlusieurs = await (0, reste_des_lignes_ouvertes_1.groupesLusAPlusieurs)(this.prisma, ouvertes);
        const lettrees = [];
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ligneEcriture.findMany({
            where: ouvertes,
            include: {
                compte: {
                    select: {
                        id: true,
                        numero: true,
                        intitule: true,
                        tiersCompte: { select: { tiers: { select: { nom: true } } } },
                    },
                },
                ecriture: { select: { date: true, libelle: true, reference: true } },
            },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        }), (l) => {
            if (l.lettrageId && aPlusieurs.has(l.lettrageId))
                lettrees.push(l);
            else
                ranger(l, Number(l.debit) - Number(l.credit));
        });
        const poids = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(this.prisma, tenantId, lettrees, {}, 'Échéancier');
        for (const l of lettrees)
            ranger(l, (0, reste_des_lignes_ouvertes_1.poidsOuMontant)(poids, l));
        const details = plusProches.elements();
        let cumul = tresorerieActuelle;
        const tranches = TRANCHES.map((t) => {
            const { encaissements, decaissements } = cumuls.get(t.cle) ?? { encaissements: 0, decaissements: 0 };
            const net = encaissements - decaissements;
            cumul += net;
            return {
                ...t,
                encaissements: Math.round(encaissements * 100) / 100,
                decaissements: Math.round(decaissements * 100) / 100,
                net: Math.round(net * 100) / 100,
                tresorerieProjetee: Math.round(cumul * 100) / 100,
            };
        });
        const premiereTrancheNegative = tranches.find((t) => t.tresorerieProjetee < 0) ?? null;
        return {
            dateReference: ref,
            tresorerieActuelle: Math.round(tresorerieActuelle * 100) / 100,
            tranches,
            details,
            tronque: plusProches.tronquee,
            nombreDetails: plusProches.nombre,
            alerte: premiereTrancheNegative
                ? {
                    tranche: premiereTrancheNegative.cle,
                    libelle: premiereTrancheNegative.libelle,
                    tresorerieProjetee: premiereTrancheNegative.tresorerieProjetee,
                    message: `La trésorerie projetée devient négative dans la tranche « ${premiereTrancheNegative.libelle} » ` +
                        `(${premiereTrancheNegative.tresorerieProjetee.toFixed(2)}). Les échéances de cette tranche et des ` +
                        'suivantes ne pourront pas être honorées sans encaissement supplémentaire.',
                }
                : null,
            lignesSansEcheance,
            groupesLusLigneALigne: await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(this.prisma, tenantId, poids.motifs),
        };
    }
    async balanceAgee(tenantId, params) {
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({
            where: { id: params.exerciceId, tenantId },
            select: { dateDebut: true, dateFin: true },
        }));
        const demande = params.dateReference ? new Date(params.dateReference) : new Date();
        const ref = demande > exercice.dateFin ? exercice.dateFin : demande;
        const type = params.type ?? 'TOUS';
        const perimetre = exports.PERIMETRES_BALANCE_AGEE[type];
        const racines = perimetre.racines;
        const jour = (d) => d.toLocaleDateString('fr-FR');
        const MOIS_DETAILLES = 5;
        const debutsDeMois = [];
        for (let i = 0; i < MOIS_DETAILLES; i++) {
            debutsDeMois.unshift(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1)));
        }
        const debutFenetre = debutsDeMois[0];
        const tranches = [];
        const bornes = [];
        tranches.push({
            cle: 'ouverture',
            libellePeriode: `Avant le ${jour(exercice.dateDebut)}`,
            libelleAge: "Antérieur à l'exercice",
        });
        bornes.push({ min: null, max: exercice.dateDebut });
        if (exercice.dateDebut < debutFenetre) {
            const veille = new Date(debutFenetre.getTime() - 86_400_000);
            tranches.push({
                cle: 'ancien',
                libellePeriode: `Du ${jour(exercice.dateDebut)} au ${jour(veille)}`,
                libelleAge: `${MOIS_DETAILLES * 30 + 30} jours et plus`,
            });
            bornes.push({ min: exercice.dateDebut, max: debutFenetre });
        }
        debutsDeMois.forEach((debut, i) => {
            const finMois = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1));
            const dernierJour = new Date(finMois.getTime() - 86_400_000);
            const age = (MOIS_DETAILLES - i) * 30;
            tranches.push({
                cle: debut.toISOString().slice(0, 7),
                libellePeriode: `Du ${jour(debut)} au ${jour(dernierJour)}`,
                libelleAge: `Moins de ${age} jours`,
            });
            bornes.push({ min: debut, max: finMois });
        });
        const indexTranche = (echeance) => {
            for (let i = bornes.length - 1; i >= 0; i--) {
                const { min, max } = bornes[i];
                if ((min === null || echeance >= min) && (max === null || echeance < max))
                    return i;
            }
            return bornes.length - 1;
        };
        const [lignes, rattachements] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where: {
                    ecriture: { tenantId, exerciceId: params.exerciceId, date: { lte: ref }, ...ecritures_de_situation_1.HORS_SITUATION },
                    AND: [(0, ouverte_a_la_cloture_1.ouverteALaCloture)(ref)],
                    OR: racines.map((r) => ({ compte: { numero: { startsWith: r } } })),
                    ...(perimetre.exclusions.length > 0
                        ? { NOT: perimetre.exclusions.map((e) => ({ compte: { numero: { startsWith: e } } })) }
                        : {}),
                },
                include: {
                    compte: { select: { id: true, numero: true, intitule: true } },
                    ecriture: { select: { date: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
                },
            }),
            this.prisma.tiersCompte.findMany({
                where: { tiers: { tenantId } },
                select: { compteId: true, tiers: { select: { id: true, code: true, nom: true } } },
            }),
        ]);
        const tiersDuCompte = new Map(rattachements.map((r) => [r.compteId, r.tiers]));
        const poids = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(this.prisma, tenantId, lignes, { dateMax: ref }, 'Balance âgée');
        const parCle = new Map();
        const comptesDeLaCle = new Map();
        const piecesOuvertes = new Map();
        for (const l of lignes) {
            const net = (0, reste_des_lignes_ouvertes_1.poidsOuMontant)(poids, l);
            if (Math.abs(net) < 0.005)
                continue;
            const tiers = tiersDuCompte.get(l.compte.id);
            const cle = tiers ? `tiers:${tiers.id}` : `compte:${l.compte.id}`;
            const entree = parCle.get(cle) ??
                {
                    cle,
                    libelle: tiers ? `${tiers.code} - ${tiers.nom}` : `${l.compte.numero} - ${l.compte.intitule}`,
                    codeTiers: tiers?.code ?? '',
                    numero: l.compte.numero,
                    montants: tranches.map(() => 0),
                    solde: 0,
                };
            const estReport = l.ecriture.estGenereeParCloture && !l.ecriture.estSoldeDesComptesDeGestion;
            entree.montants[estReport && !l.dateEcheance ? 0 : indexTranche(l.dateEcheance ?? l.ecriture.date)] += net;
            entree.solde += net;
            if (l.compte.numero < entree.numero)
                entree.numero = l.compte.numero;
            parCle.set(cle, entree);
            const comptes = comptesDeLaCle.get(cle) ?? new Set();
            comptes.add(l.compte.numero);
            comptesDeLaCle.set(cle, comptes);
            piecesOuvertes.set(cle, (piecesOuvertes.get(cle) ?? 0) + 1);
        }
        const arrondir = (x) => Math.round(x * 100) / 100;
        const toutes = [...parCle.values()]
            .map((c) => ({ ...c, montants: c.montants.map(arrondir), solde: arrondir(c.solde) }))
            .filter((c) => Math.abs(c.solde) >= 0.005 ||
            c.montants.some((m) => Math.abs(m) >= 0.005) ||
            (piecesOuvertes.get(c.cle) ?? 0) >= 2);
        const ventilee = (c) => ligneVentilee(perimetre.sensNormal, [...(comptesDeLaCle.get(c.cle) ?? [c.numero])], c.solde);
        const debiteurs = toutes.filter((c) => c.solde > 0 && ventilee(c)).sort((a, b) => b.solde - a.solde);
        const crediteurs = toutes.filter((c) => c.solde < 0 && ventilee(c)).sort((a, b) => a.solde - b.solde);
        const soldeNul = (c) => Math.abs(c.solde) < 0.005;
        const soldesNuls = toutes
            .filter(soldeNul)
            .map((c) => ({ ...c, montants: [], solde: 0 }))
            .sort((a, b) => a.libelle.localeCompare(b.libelle));
        const sensInverse = toutes
            .filter((c) => !soldeNul(c) && !ventilee(c))
            .map((c) => ({ ...c, montants: [] }))
            .sort((a, b) => Math.abs(b.solde) - Math.abs(a.solde));
        const parTranche = tranches.map((_, i) => arrondir(debiteurs.reduce((t, c) => t + c.montants[i], 0)));
        const parTrancheCrediteurs = tranches.map((_, i) => arrondir(crediteurs.reduce((t, c) => t + c.montants[i], 0)));
        const totalDebiteurs = arrondir(debiteurs.reduce((t, c) => t + c.solde, 0));
        const totalCrediteurs = arrondir(crediteurs.reduce((t, c) => t + c.solde, 0));
        const totalSensInverse = arrondir(sensInverse.reduce((t, c) => t + c.solde, 0));
        return {
            dateReference: ref.toISOString().slice(0, 10),
            debutExercice: exercice.dateDebut.toISOString().slice(0, 10),
            type,
            lecture: perimetre.lecture,
            libellePerimetre: perimetre.libelle,
            sensNormal: perimetre.sensNormal,
            tranches,
            debiteurs,
            crediteurs,
            sensInverse,
            soldesNuls,
            groupesLusLigneALigne: await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(this.prisma, tenantId, poids.motifs),
            totaux: {
                parTranche,
                parTrancheCrediteurs,
                debiteurs: totalDebiteurs,
                crediteurs: totalCrediteurs,
                sensInverse: totalSensInverse,
                net: arrondir(totalDebiteurs + totalCrediteurs + totalSensInverse),
            },
        };
    }
    async justificatifSolde(tenantId, params) {
        const [compteLu, exerciceLu, premierExercice] = await Promise.all([
            this.prisma.compte.findFirst({
                where: { id: params.compteId, tenantId },
                select: { id: true, numero: true, intitule: true },
            }),
            this.prisma.exercice.findFirst({
                where: { id: params.exerciceId, tenantId },
                select: { id: true, dateDebut: true, dateFin: true },
            }),
            this.prisma.exercice.findFirst({
                where: { tenantId },
                orderBy: { dateDebut: 'asc' },
                select: { id: true },
            }),
        ]);
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(exerciceLu);
        if (!compteLu) {
            throw new common_1.NotFoundException('Compte introuvable dans ce dossier : aucun justificatif de solde ne peut être établi.');
        }
        const compte = compteLu;
        const demande = params.dateArret ? new Date(params.dateArret) : exercice.dateFin;
        const arret = demande > exercice.dateFin ? exercice.dateFin : demande;
        const whereJustificatif = {
            compteId: compte.id,
            ...(params.masquerLettrees ? { lettre: null } : {}),
            ecriture: {
                tenantId,
                date: { lte: arret },
                ...ecritures_de_situation_1.HORS_SITUATION,
                NOT: {
                    AND: [
                        { estGenereeParCloture: true },
                        { estSoldeDesComptesDeGestion: false },
                        { exerciceId: { not: premierExercice?.id ?? exercice.id } },
                    ],
                },
            },
        };
        const nombreLignes = await this.prisma.ligneEcriture.count({ where: whereJustificatif });
        if (nombreLignes > exports.PLAFOND_LIGNES_GRAND_LIVRE) {
            throw new common_1.BadRequestException(`Le justificatif du compte ${compte.numero} porte ${nombreLignes.toLocaleString('fr-FR')} lignes, au-delà ` +
                `de ce qu'une fenêtre peut afficher (${exports.PLAFOND_LIGNES_GRAND_LIVRE.toLocaleString('fr-FR')}). Masquez ` +
                `les lignes lettrées, ou avancez la date d'arrêt.`);
        }
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: whereJustificatif,
            include: {
                devise: { select: { code: true } },
                ecriture: {
                    select: {
                        date: true,
                        libelle: true,
                        reference: true,
                        numeroPiece: true,
                        estGenereeParCloture: true,
                        estSoldeDesComptesDeGestion: true,
                        journal: { select: { code: true } },
                    },
                },
            },
            orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
        });
        const arrondir = (x) => Math.round(x * 100) / 100;
        const detail = lignes.map((l) => ({
            ligneId: l.id,
            date: l.ecriture.date,
            journal: l.ecriture.journal.code,
            numeroPiece: l.ecriture.numeroPiece,
            reference: l.ecriture.reference ?? '',
            libelle: l.libelle ?? l.ecriture.libelle,
            debit: Number(l.debit),
            credit: Number(l.credit),
            deviseTransaction: l.devise?.code ?? '',
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            lettre: l.lettre ?? '',
            estANouveau: l.ecriture.estGenereeParCloture && !l.ecriture.estSoldeDesComptesDeGestion,
        }));
        const totalDebit = arrondir(detail.reduce((t, l) => t + l.debit, 0));
        const totalCredit = arrondir(detail.reduce((t, l) => t + l.credit, 0));
        const solde = arrondir(totalDebit - totalCredit);
        const agregat = await this.prisma.ligneEcriture.aggregate({
            where: { compteId: compte.id, ecriture: { tenantId, exerciceId: params.exerciceId, ...ecritures_de_situation_1.HORS_SITUATION } },
            _sum: { debit: true, credit: true },
        });
        const soldeBalance = arrondir(Number(agregat._sum.debit ?? 0) - Number(agregat._sum.credit ?? 0));
        const ecart = arrondir(solde - soldeBalance);
        const arreteALaCloture = arret.getTime() === exercice.dateFin.getTime();
        const ruptures = await this.rupturesDOuverture(tenantId, exercice.dateDebut, compte.numero);
        return {
            compte,
            rupturesOuverture: ruptures,
            dateArret: arret.toISOString().slice(0, 10),
            masquerLettrees: params.masquerLettrees ?? false,
            lignes: detail,
            totaux: { debit: totalDebit, credit: totalCredit, solde },
            recoupement: {
                applicable: arreteALaCloture && !params.masquerLettrees,
                soldeBalance,
                ecart,
                concordant: Math.abs(ecart) < 0.005,
            },
        };
    }
    async evolutionSoldes(tenantId, params = {}) {
        const nb = Math.min(Math.max(params.nbExercices ?? 8, 2), 20);
        const exercices = await this.prisma.exercice.findMany({
            where: { tenantId },
            orderBy: { dateDebut: 'desc' },
            take: nb,
            select: { id: true, dateDebut: true, dateFin: true, statut: true },
        });
        const [comptes, ...agregats] = await Promise.all([
            this.prisma.compte.findMany({
                where: { tenantId, typeCompte: { not: client_1.TypeCompteDetailTotal.TOTAL } },
                orderBy: { numero: 'asc' },
                select: { id: true, numero: true, intitule: true, classe: true },
            }),
            ...exercices.map((e) => this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: { tenantId, exerciceId: e.id, estSoldeDesComptesDeGestion: false, ...ecritures_de_situation_1.HORS_SITUATION } },
                _sum: { debit: true, credit: true },
            })),
        ]);
        const arrondir = (x) => Math.round(x * 100) / 100;
        const parExercice = agregats.map((groupes) => new Map(groupes.map((g) => [g.compteId, arrondir(Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0))])));
        const annee = (d) => d.toISOString().slice(0, 4);
        const colonnes = exercices.map((e) => ({
            id: e.id,
            libelle: annee(e.dateFin),
            dateFin: e.dateFin.toISOString().slice(0, 10),
            statut: e.statut,
        }));
        const lignes = comptes
            .map((c) => ({
            compteId: c.id,
            numero: c.numero,
            intitule: c.intitule,
            classe: c.classe,
            soldes: parExercice.map((m) => (m.has(c.id) ? m.get(c.id) : null)),
        }))
            .filter((l) => l.soldes.some((s) => s !== null));
        return { exercices: colonnes, lignes };
    }
    async grandLivre(tenantId, compteId, exerciceId, plafond, periode) {
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
        if (!compte) {
            throw new common_1.NotFoundException(exports.MOTIF_COMPTE_INTROUVABLE_GRAND_LIVRE);
        }
        const perimetreExercice = { tenantId, ...(exerciceId ? { exerciceId } : {}), ...ecritures_de_situation_1.HORS_SITUATION };
        const perimetreEcriture = periode ? { ...perimetreExercice, AND: [(0, periode_extrait_1.ecrituresDansLaPeriode)(periode)] } : perimetreExercice;
        if (plafond !== undefined) {
            const nombre = await this.prisma.ligneEcriture.count({ where: { compteId, ecriture: perimetreEcriture } });
            if (nombre > plafond) {
                throw new common_1.BadRequestException(`Le grand livre du compte ${compte.numero} porte ${nombre.toLocaleString('fr-FR')} lignes, au-delà de ce ` +
                    `qu'une fenêtre peut afficher (${plafond.toLocaleString('fr-FR')}). Exportez-le en Excel.`);
            }
        }
        const [lignes, contreparties, reports] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where: { compteId, ecriture: perimetreEcriture },
                include: { ecriture: { include: { journal: true } } },
                orderBy: EcritureService_1.TRI_GRAND_LIVRE,
            }),
            this.chargerContreparties({
                ecriture: { ...perimetreEcriture, lignes: { some: { compteId } } },
            }),
            periode ? this.reportsALaVeille(perimetreExercice, periode, [compteId]) : Promise.resolve(new Map()),
        ]);
        const report = reports.get(compteId) ?? null;
        let solde = report ? report.debit - report.credit : 0;
        const lignesAvecSolde = lignes.map((l) => {
            solde += Number(l.debit) - Number(l.credit);
            return EcritureService_1.versLigneGrandLivre(l, solde, contreparties);
        });
        return { compte, ...(periode ? { report } : {}), lignes: lignesAvecSolde, soldeFinal: solde };
    }
    async periodeDemandee(tenantId, exerciceId, demande) {
        if (!demande.du && !demande.au)
            return null;
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateDebut: true, dateFin: true } }));
        return (0, periode_extrait_1.periodeDeLExtrait)(exercice, demande);
    }
    async reportsALaVeille(perimetreExercice, periode, compteIds) {
        const groupes = await this.prisma.ligneEcriture.groupBy({
            by: ['compteId'],
            where: {
                ...(compteIds ? { compteId: { in: compteIds } } : {}),
                ecriture: { ...ecritures_de_situation_1.HORS_SITUATION, ...perimetreExercice, AND: [(0, periode_extrait_1.ecrituresAvantLaPeriode)(periode)] },
            },
            _sum: { debit: true, credit: true },
        });
        const parCompte = new Map();
        for (const g of groupes) {
            const debit = Number(g._sum.debit ?? 0);
            const credit = Number(g._sum.credit ?? 0);
            if (debit !== 0 || credit !== 0)
                parCompte.set(g.compteId, { au: (0, periode_extrait_1.veilleDe)(periode.du), debit, credit });
        }
        return parCompte;
    }
    async grandLivreComplet(tenantId, exerciceId, periode) {
        const perimetreExercice = { tenantId, ...(exerciceId ? { exerciceId } : {}), ...ecritures_de_situation_1.HORS_SITUATION };
        const perimetreEcriture = periode ? { ...perimetreExercice, AND: [(0, periode_extrait_1.ecrituresDansLaPeriode)(periode)] } : perimetreExercice;
        const nombreLignes = await this.prisma.ligneEcriture.count({ where: { ecriture: perimetreEcriture } });
        if (nombreLignes > exports.PLAFOND_LIGNES_GRAND_LIVRE) {
            throw new common_1.BadRequestException(`Ce grand livre porte ${nombreLignes.toLocaleString('fr-FR')} lignes, au-delà de ce qu'une fenêtre peut ` +
                `afficher (${exports.PLAFOND_LIGNES_GRAND_LIVRE.toLocaleString('fr-FR')}). Ouvrez le grand livre compte par ` +
                `compte, ou choisissez une période plus courte.`);
        }
        const [lignes, contreparties, reports] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where: { ecriture: perimetreEcriture },
                include: { compte: true, ecriture: { include: { journal: true } } },
                orderBy: [{ compte: { numero: 'asc' } }, ...EcritureService_1.TRI_GRAND_LIVRE],
            }),
            this.chargerContreparties({ ecriture: perimetreEcriture }),
            periode ? this.reportsALaVeille(perimetreExercice, periode, null) : Promise.resolve(new Map()),
        ]);
        const parCompte = new Map();
        const ouvrir = (compte) => {
            const report = reports.get(compte.id) ?? null;
            const entree = {
                compte: { id: compte.id, numero: compte.numero, intitule: compte.intitule },
                report,
                lignes: [],
                solde: report ? report.debit - report.credit : 0,
            };
            parCompte.set(compte.id, entree);
            return entree;
        };
        for (const l of lignes) {
            const entree = parCompte.get(l.compteId) ?? ouvrir(l.compte);
            entree.solde += Number(l.debit) - Number(l.credit);
            entree.lignes.push(EcritureService_1.versLigneGrandLivre(l, entree.solde, contreparties));
        }
        const sansLigne = [...reports.keys()].filter((id) => !parCompte.has(id));
        if (sansLigne.length > 0) {
            const comptes = await this.prisma.compte.findMany({ where: { tenantId, id: { in: sansLigne } }, select: { id: true, numero: true, intitule: true } });
            for (const c of comptes)
                ouvrir(c);
        }
        const sections = [...parCompte.values()]
            .map((e) => ({
            compte: e.compte,
            ...(periode ? { report: e.report } : {}),
            lignes: e.lignes,
            soldeFinal: e.solde,
            totalDebit: e.lignes.reduce((s, l) => s + l.debit, 0),
            totalCredit: e.lignes.reduce((s, l) => s + l.credit, 0),
        }))
            .filter((c) => c.totalDebit !== 0 || c.totalCredit !== 0 || (c.report && (c.report.debit !== 0 || c.report.credit !== 0)));
        return periode ? sections.sort((a, b) => (a.compte.numero < b.compte.numero ? -1 : a.compte.numero > b.compte.numero ? 1 : 0)) : sections;
    }
    async balance(tenantId, exerciceId, inclureBrouillard = true, arreteAu, options = {}) {
        if (options.periode && (arreteAu || options.avantLaCloture)) {
            throw new Error("Balance d'une période · ni date d'arrêté ni lecture avant la clôture ne s'y ajoutent.");
        }
        let avantLe = null;
        if (options.avantLaCloture) {
            const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateFin: true } });
            if (!exercice)
                throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
            avantLe = exercice.dateFin;
        }
        const filtreEcriture = {
            tenantId,
            exerciceId,
            ...(0, ecritures_de_situation_1.filtreDuStatut)(inclureBrouillard),
            ...(arreteAu ? { date: { lte: arreteAu } } : {}),
            ...(avantLe ? { AND: [{ date: { lt: avantLe } }] } : {}),
        };
        const filtres = options.periode
            ? (0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)(filtreEcriture, options.periode)
            : (0, balance_trois_colonnes_1.filtresDesTroisColonnes)(filtreEcriture);
        const [comptes, reports, mouvements, clotures] = await Promise.all([
            this.prisma.compte.findMany({ where: { tenantId }, orderBy: { numero: 'asc' } }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: filtres.reports },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: filtres.mouvements },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: filtres.clotures },
                _sum: { debit: true, credit: true },
            }),
        ]);
        const lignesBalance = (0, balance_trois_colonnes_1.lignesDeBalance)(comptes, (0, balance_trois_colonnes_1.agregatsParCompte)(reports, mouvements, clotures));
        return { lignes: lignesBalance, totaux: (0, balance_trois_colonnes_1.totauxDeBalance)(lignesBalance) };
    }
    async virementsDeMiseEnService(tenantId, exerciceId) {
        return this.mouvementsLiesParCompte(tenantId, exerciceId, { immobilisationMiseEnService: { isNot: null } });
    }
    async nombreAuBrouillard(tenantId, exerciceId) {
        return this.prisma.ecriture.count({
            where: { tenantId, exerciceId, statut: client_1.StatutEcriture.BROUILLARD, estANouveauProvisoire: false },
        });
    }
    async ouverturePasseeAuPremierJour(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true } });
        if (!exercice)
            return null;
        return (0, ouverture_passee_1.ouverturePasseeNonNulle)(this.prisma, tenantId, exercice, { validees: true });
    }
    async positionDOuvertureAuPremierJour(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true } });
        if (!exercice)
            return { etat: 'AUCUNE' };
        return (0, ouverture_passee_1.positionDOuverturePassee)(this.prisma, tenantId, exercice, { validees: true });
    }
    async mouvementsDeReevaluation(tenantId, exerciceId, arreteAu) {
        return this.mouvementsLiesParCompte(tenantId, exerciceId, { reevaluationBilan: { isNot: null } }, arreteAu);
    }
    async mouvementsDeCoutsEmpruntIncorpores(tenantId, exerciceId) {
        return this.mouvementsLiesParCompte(tenantId, exerciceId, { coutEmpruntIncorpore: { isNot: null } });
    }
    async mouvementsLiesParCompte(tenantId, exerciceId, liaison, arreteAu) {
        if (!exerciceId)
            return virements_mise_en_service_1.AUCUN_VIREMENT;
        const { mouvements } = (0, balance_trois_colonnes_1.filtresDesTroisColonnes)({
            tenantId,
            exerciceId,
            statut: client_1.StatutEcriture.VALIDEE,
            ...(arreteAu ? { date: { lte: arreteAu } } : {}),
        });
        const groupes = await this.prisma.ligneEcriture.groupBy({
            by: ['compteId'],
            where: { ecriture: { ...mouvements, ...liaison } },
            _sum: { debit: true, credit: true },
        });
        return new Map(groupes.map((g) => [g.compteId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));
    }
    async balanceRegroupeeParCollectif(tenantId, exerciceId, periode) {
        const [balance, individuels] = await Promise.all([
            this.balance(tenantId, exerciceId, true, undefined, periode ? { periode } : {}),
            this.prisma.compte.findMany({
                where: { tenantId, collectifId: { not: null } },
                select: { id: true, collectif: { select: { id: true, numero: true, intitule: true } } },
            }),
        ]);
        const collectifDe = new Map(individuels.filter((c) => c.collectif).map((c) => [c.id, c.collectif]));
        return { lignes: (0, collectifs_tiers_1.regrouperSurCollectifs)(balance.lignes, collectifDe), totaux: balance.totaux };
    }
    async rupturesDOuverture(tenantId, avant, numero) {
        const conserves = await this.prisma.exercice.findMany({
            where: { tenantId, dateDebut: { lte: avant }, dateFin: { lt: avant }, motifOuvertureSuivanteConservee: { not: null } },
            orderBy: { dateFin: 'asc' },
            select: { dateDebut: true, dateFin: true, motifOuvertureSuivanteConservee: true, ecartsOuvertureSuivanteConservee: true },
            take: 20,
        });
        return conserves.filter((e) => e.motifOuvertureSuivanteConservee && e.dateFin < avant).map((e) => {
            const positions = (e.ecartsOuvertureSuivanteConservee?.ecarts ?? []).filter((p) => numero === null || p.numero === numero);
            return {
                exerciceClos: { dateDebut: e.dateDebut, dateFin: e.dateFin },
                motif: e.motifOuvertureSuivanteConservee,
                positions,
            };
        });
    }
    async balanceCumulee(tenantId, exerciceId, inclureBrouillard = false) {
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { id: true, dateDebut: true },
        }));
        const exercices = await this.prisma.exercice.findMany({
            where: { tenantId, dateDebut: { lte: exercice.dateDebut } },
            orderBy: { dateDebut: 'asc' },
            select: { id: true },
        });
        const idsFenetre = exercices.map((e) => e.id);
        const premierExerciceId = idsFenetre[0];
        const filtreEcriture = {
            tenantId,
            exerciceId: { in: idsFenetre },
            ...(0, ecritures_de_situation_1.filtreDuStatut)(inclureBrouillard),
        };
        const [comptes, ouverture, mouvements] = await Promise.all([
            this.prisma.compte.findMany({ where: { tenantId }, orderBy: { numero: 'asc' } }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: {
                    ecriture: { ...filtreEcriture, exerciceId: premierExerciceId, estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
                },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: { ...filtreEcriture, estGenereeParCloture: false } },
                _sum: { debit: true, credit: true },
            }),
        ]);
        const parCompte = new Map();
        const cumuler = (groupes, estOuverture) => {
            for (const g of groupes) {
                const a = parCompte.get(g.compteId) ?? { debit: 0, credit: 0, reportDebit: 0, reportCredit: 0 };
                const d = Number(g._sum.debit ?? 0);
                const c = Number(g._sum.credit ?? 0);
                a.debit += d;
                a.credit += c;
                if (estOuverture) {
                    a.reportDebit += d;
                    a.reportCredit += c;
                }
                parCompte.set(g.compteId, a);
            }
        };
        cumuler(ouverture, true);
        cumuler(mouvements, false);
        const lignes = comptes
            .filter((c) => c.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL)
            .map((c) => {
            const a = parCompte.get(c.id) ?? { debit: 0, credit: 0, reportDebit: 0, reportCredit: 0 };
            return {
                compteId: c.id,
                numero: c.numero,
                intitule: c.intitule,
                classe: c.classe,
                typeCompte: c.typeCompte,
                totalDebit: a.debit,
                totalCredit: a.credit,
                reportDebit: a.reportDebit,
                reportCredit: a.reportCredit,
                mouvementDebit: a.debit,
                mouvementCredit: a.credit,
                solde: a.debit - a.credit,
            };
        })
            .filter((l) => l.totalDebit !== 0 || l.totalCredit !== 0);
        const rupturesOuverture = await this.rupturesDOuverture(tenantId, exercice.dateDebut, null);
        return {
            lignes,
            totaux: { debit: lignes.reduce((s, l) => s + l.totalDebit, 0), credit: lignes.reduce((s, l) => s + l.totalCredit, 0) },
            rupturesOuverture,
        };
    }
    async balanceAuxiliaire(tenantId, params) {
        const type = params.type ?? 'TOUS';
        const [{ lignes }, rattachements] = await Promise.all([
            this.balance(tenantId, params.exerciceId, params.inclureBrouillard ?? true),
            this.prisma.tiersCompte.findMany({
                where: { tiers: { tenantId } },
                select: { compteId: true, tiers: { select: { code: true, nom: true, type: true } } },
            }),
        ]);
        const parCompte = new Map(rattachements.map((r) => [r.compteId, r.tiers]));
        const arrondi = (x) => Math.round(x * 100) / 100;
        const comptes = lignes
            .filter((l) => type === 'TOUS'
            ? l.numero.startsWith('40') || l.numero.startsWith('41')
            : (0, familles_tiers_1.compteDeLaFamille)(type, l.numero, parCompte.has(l.compteId)))
            .map((l) => {
            const tiers = parCompte.get(l.compteId);
            const solde = arrondi(l.totalDebit - l.totalCredit);
            return {
                compteId: l.compteId,
                numero: l.numero,
                intitule: l.intitule,
                codeTiers: tiers?.code ?? '',
                nomTiers: tiers?.nom ?? '',
                sansTiers: !tiers,
                reportDebit: arrondi(l.reportDebit),
                reportCredit: arrondi(l.reportCredit),
                mouvementDebit: arrondi(l.mouvementDebit),
                mouvementCredit: arrondi(l.mouvementCredit),
                soldeDebit: solde > 0 ? solde : 0,
                soldeCredit: solde < 0 ? -solde : 0,
                solde,
            };
        })
            .sort((a, b) => a.numero.localeCompare(b.numero) || a.codeTiers.localeCompare(b.codeTiers));
        const somme = (cle) => arrondi(comptes.reduce((t, c) => t + c[cle], 0));
        return {
            type,
            comptes,
            totaux: {
                reportDebit: somme('reportDebit'),
                reportCredit: somme('reportCredit'),
                mouvementDebit: somme('mouvementDebit'),
                mouvementCredit: somme('mouvementCredit'),
                soldeDebit: somme('soldeDebit'),
                soldeCredit: somme('soldeCredit'),
                solde: somme('solde'),
            },
        };
    }
};
exports.EcritureService = EcritureService;
EcritureService.TRI_GRAND_LIVRE = [
    { ecriture: { date: 'asc' } },
    { ecriture: { numeroPiece: 'asc' } },
    { id: 'asc' },
];
exports.EcritureService = EcritureService = EcritureService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        journal_service_1.JournalService,
        exercice_service_1.ExerciceService,
        analytique_service_1.AnalytiqueService])
], EcritureService);
//# sourceMappingURL=ecriture.service.js.map