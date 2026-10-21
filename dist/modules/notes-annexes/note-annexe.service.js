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
var NoteAnnexeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteAnnexeService = exports.lireParLots = exports.LOT_LECTURE = void 0;
exports.estRubriqueRattachable = estRubriqueRattachable;
exports.cleDeLectureDeBalance = cleDeLectureDeBalance;
exports.balanceMemorisee = balanceMemorisee;
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const prisma_retry_util_1 = require("../../common/prisma-retry.util");
const effectifs_seize_colonnes_1 = require("./effectifs-seize-colonnes");
const common_1 = require("@nestjs/common");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const exercice_service_1 = require("../exercice/exercice.service");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const indicateurs_note_33_1 = require("./indicateurs-note-33");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const intitules_notes_sycebnl_1 = require("./intitules-notes-sycebnl");
const correspondance_notes_projets_1 = require("./correspondance-notes-projets");
const cellules_libres_en_saisie_1 = require("./cellules-libres-en-saisie");
const controles_saisie_notes_1 = require("./controles-saisie-notes");
const indicateurs_note_34_syscohada_1 = require("./indicateurs-note-34-syscohada");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const passifs_eventuels_en_note_1 = require("./passifs-eventuels-en-note");
const transfert_depreciation_note_1 = require("./transfert-depreciation-note");
const correspondance_notes_syscohada_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada");
const ajouter_mois_1 = require("../../common/ajouter-mois");
const ouverte_a_la_cloture_1 = require("../lettrage/ouverte-a-la-cloture");
const reste_des_lignes_ouvertes_1 = require("../lettrage/reste-des-lignes-ouvertes");
const virements_mise_en_service_1 = require("../immobilisations/virements-mise-en-service");
var lecture_par_lots_2 = require("../../common/lecture-par-lots");
Object.defineProperty(exports, "LOT_LECTURE", { enumerable: true, get: function () { return lecture_par_lots_2.LOT_LECTURE; } });
Object.defineProperty(exports, "lireParLots", { enumerable: true, get: function () { return lecture_par_lots_2.lireParLots; } });
const NOTES_PAR_JEU = {
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: correspondance_notes_associations_1.NOTES_ASSOCIATIONS,
    [client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT]: correspondance_notes_projets_1.NOTES_PROJETS,
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: correspondance_notes_syscohada_1.NOTES_SYSCOHADA,
};
function estRubriqueRattachable(jeu, codeNote, cleRubrique) {
    return NOTES_PAR_JEU[jeu].some((n) => n.code === codeNote && n.rubriques.some((r) => r.cle === cleRubrique && !!r.subdivisionAttendue));
}
const NOTES_ATTENDUES_PAR_JEU = {
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: 45,
    [client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT]: 26,
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: correspondance_notes_syscohada_1.NOMBRE_NOTES_SYSCOHADA,
};
const CODE_NOTE_EXECUTION_BUDGETAIRE = {
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: '35',
    [client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT]: '24',
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: null,
};
const NUMERO_OFFICIEL_PAR_JEU = {
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: (code) => code,
    [client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT]: (code) => code,
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: (code) => String((0, correspondance_notes_syscohada_1.numeroDeTeteNoteSyscohada)(code)),
};
const REFERENTIEL_DU_JEU = {
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: client_1.Referentiel.SYCEBNL,
    [client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT]: client_1.Referentiel.SYCEBNL,
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: client_1.Referentiel.SYSCOHADA,
};
const ECHEANCES_NULLES = { unAn: 0, deuxAns: 0, plusDeDeuxAns: 0, nonVentile: 0 };
const VENTILATION_NULLE = () => ({
    augmentation: { EXPLOITATION: 0, FINANCIER: 0, HAO: 0 },
    diminution: { EXPLOITATION: 0, FINANCIER: 0, HAO: 0 },
    nonVentile: { augmentation: 0, diminution: 0 },
});
function natureDeLaContrepartie(numero) {
    if (numero.startsWith('8'))
        return 'HAO';
    if (['67', '77', '697', '797'].some((prefixe) => numero.startsWith(prefixe)))
        return 'FINANCIER';
    if (numero.startsWith('6') || numero.startsWith('7'))
        return 'EXPLOITATION';
    return null;
}
const parametresDeBalanceConnus = true;
void parametresDeBalanceConnus;
function cleDeLectureDeBalance(parametres) {
    const [tenantId, exerciceId, inclureBrouillard, arreteAu, options] = parametres;
    const optionsTriees = options
        ? Object.keys(options)
            .sort()
            .map((k) => [k, options[k]])
        : null;
    return JSON.stringify([tenantId, exerciceId, inclureBrouillard ?? null, arreteAu ? arreteAu.getTime() : null, optionsTriees]);
}
function balanceMemorisee(ecritureService) {
    const lues = new Map();
    const memoire = Object.create(ecritureService);
    memoire.balance = (...parametres) => {
        const cle = cleDeLectureDeBalance(parametres);
        let lecture = lues.get(cle);
        if (!lecture) {
            lecture = ecritureService.balance(...parametres);
            lues.set(cle, lecture);
        }
        return lecture;
    };
    return memoire;
}
let NoteAnnexeService = NoteAnnexeService_1 = class NoteAnnexeService {
    constructor(ecritureService, exerciceService, prisma, budgetService, etatsFinanciersService) {
        this.ecritureService = ecritureService;
        this.exerciceService = exerciceService;
        this.prisma = prisma;
        this.budgetService = budgetService;
        this.etatsFinanciersService = etatsFinanciersService;
    }
    rubriqueRattachable(jeu, codeNote, cleRubrique) {
        const specs = NOTES_PAR_JEU[jeu];
        const tableaux = specs.filter((n) => n.code === codeNote);
        if (tableaux.length === 0)
            throw new common_1.NotFoundException(`Aucune note « ${codeNote} » dans ce jeu d'états financiers.`);
        const spec = tableaux.find((n) => n.rubriques.some((r) => r.cle === cleRubrique)) ?? tableaux[0];
        const rubrique = spec.rubriques.find((r) => r.cle === cleRubrique);
        if (!rubrique) {
            throw new common_1.NotFoundException(`La note ${codeNote} n'a pas de rubrique rattachable « ${cleRubrique} » : soit la clé est erronée, ` +
                `soit elle désigne une rubrique que le plan de comptes officiel détermine déjà · celles-là ne sont ` +
                `pas modifiables et ne portent volontairement pas de clé.`);
        }
        if (!rubrique.subdivisionAttendue) {
            throw new common_1.BadRequestException(`La rubrique « ${rubrique.libelle} » de la note ${codeNote} est rattachée par le plan de comptes ` +
                `officiel : elle n'est pas modifiable. Seules les rubriques que le plan normalisé ne permet pas ` +
                `de déterminer acceptent un rattachement propre au dossier.`);
        }
        return rubrique;
    }
    async verifierJeuDuDossier(tenantId, jeu) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { referentiel: true },
        });
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable.');
        const attendu = REFERENTIEL_DU_JEU[jeu];
        if (tenant.referentiel !== attendu) {
            throw new common_1.BadRequestException(`Le jeu de notes « ${jeu} » relève du référentiel ${attendu}, alors que ce dossier est en ` +
                `${tenant.referentiel}. Les deux référentiels ne partagent ni plan de comptes, ni états ` +
                `financiers, ni notes annexes : un rattachement croisé n'aurait aucun sens comptable.`);
        }
    }
    async rattacher(tenantId, userId, jeu, codeNote, cleRubrique, compteId) {
        await this.verifierJeuDuDossier(tenantId, jeu);
        this.rubriqueRattachable(jeu, codeNote, cleRubrique);
        const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId } });
        if (!compte)
            throw new common_1.NotFoundException('Compte introuvable pour ce dossier.');
        if (compte.typeCompte === 'TOTAL') {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} est un compte Total : il n'a jamais de mouvement propre et laisserait ` +
                `la rubrique vide. Rattacher les comptes Détail qu'il regroupe.`);
        }
        const lecteur = this.rubriqueQuiLitDeja(jeu, codeNote, cleRubrique, compte.numero);
        if (lecteur) {
            throw new common_1.BadRequestException(`Le compte ${compte.numero} est déjà lu par la ligne « ${lecteur} » de la note ${codeNote} : le ` +
                `rattacher ici le compterait deux fois. Rattacher un sous-compte propre à cette ligne.`);
        }
        return this.prisma.rattachementNote.upsert({
            where: { tenantId_jeu_codeNote_cleRubrique_compteId: { tenantId, jeu, codeNote, cleRubrique, compteId } },
            create: { tenantId, jeu, codeNote, cleRubrique, compteId, createdBy: userId },
            update: {},
        });
    }
    rubriqueQuiLitDeja(jeu, codeNote, cleRubrique, numero) {
        for (const spec of NOTES_PAR_JEU[jeu].filter((n) => n.code === codeNote)) {
            for (const r of spec.rubriques) {
                if (r.cle === cleRubrique || !r.comptes?.length)
                    continue;
                if ((0, etats_financiers_communs_1.correspond)(numero, r.comptes, r.exclusions))
                    return r.libelle;
            }
        }
        return null;
    }
    async detacher(tenantId, jeu, codeNote, cleRubrique, compteId) {
        await this.verifierJeuDuDossier(tenantId, jeu);
        const supprimes = await this.prisma.rattachementNote.deleteMany({
            where: { tenantId, jeu, codeNote, cleRubrique, compteId },
        });
        if (supprimes.count === 0)
            throw new common_1.NotFoundException('Ce compte n’est pas rattaché à cette rubrique.');
        return { detache: true };
    }
    calculerRubrique(rubrique, lignes, numerosRattaches = [], echeancesParCompte, ventilationParCompte = new Map(), virements = virements_mise_en_service_1.AUCUN_VIREMENT, reevaluations = virements_mise_en_service_1.AUCUN_VIREMENT) {
        const prefixes = [...(rubrique.comptes ?? []), ...numerosRattaches];
        if (prefixes.length === 0) {
            return {
                montant: 0, comptes: [], report: 0, mouvementDebit: 0, mouvementCredit: 0, virementDebit: 0, virementCredit: 0,
                reevaluationDebit: 0, reevaluationCredit: 0,
                echeances: { ...ECHEANCES_NULLES }, ventilation: VENTILATION_NULLE(),
            };
        }
        let matches = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, prefixes, rubrique.exclusions));
        if (rubrique.sens === 'DEBITEUR')
            matches = matches.filter((l) => l.solde > 0);
        if (rubrique.sens === 'CREDITEUR')
            matches = matches.filter((l) => l.solde < 0);
        const litAuCredit = rubrique.sens === 'CREDITEUR' || rubrique.natureCreditrice === true;
        const comptes = matches.map((l) => ({
            numero: l.numero,
            intitule: l.intitule,
            montant: litAuCredit || rubrique.presenterEnNegatif ? -l.solde : l.solde,
        }));
        const brut = comptes.reduce((s, c) => s + c.montant, 0);
        const vire = (0, virements_mise_en_service_1.virementsDesLignes)(matches, virements);
        const reevalue = (0, virements_mise_en_service_1.virementsDesLignes)(matches, reevaluations);
        return {
            montant: (rubrique.presenterEnNegatif ? -brut : brut) || 0,
            comptes,
            report: matches.reduce((s, l) => s + l.reportDebit - l.reportCredit, 0),
            mouvementDebit: matches.reduce((s, l) => s + l.mouvementDebit, 0),
            mouvementCredit: matches.reduce((s, l) => s + l.mouvementCredit, 0),
            virementDebit: vire.debit,
            virementCredit: vire.credit,
            reevaluationDebit: reevalue.debit,
            reevaluationCredit: reevalue.credit,
            echeances: !echeancesParCompte
                ? { ...ECHEANCES_NULLES }
                : matches.reduce((acc, l) => {
                    const e = echeancesParCompte.get(l.numero) ?? ECHEANCES_NULLES;
                    const signe = litAuCredit || rubrique.presenterEnNegatif ? -1 : 1;
                    return {
                        unAn: acc.unAn + signe * e.unAn,
                        deuxAns: acc.deuxAns + signe * e.deuxAns,
                        plusDeDeuxAns: acc.plusDeDeuxAns + signe * e.plusDeDeuxAns,
                        nonVentile: acc.nonVentile + signe * (l.solde - e.unAn - e.deuxAns - e.plusDeDeuxAns),
                    };
                }, { ...ECHEANCES_NULLES }),
            ventilation: matches.reduce((acc, l) => {
                const v = ventilationParCompte.get(l.numero);
                if (!v)
                    return acc;
                for (const n of ['EXPLOITATION', 'FINANCIER', 'HAO']) {
                    acc.augmentation[n] += v.augmentation[n];
                    acc.diminution[n] += v.diminution[n];
                }
                acc.nonVentile.augmentation += v.nonVentile.augmentation;
                acc.nonVentile.diminution += v.nonVentile.diminution;
                return acc;
            }, VENTILATION_NULLE()),
        };
    }
    colonnesDeMouvement(spec, r) {
        const auCredit = spec.sensAccroissement === 'CREDIT';
        const ouverture = (auCredit ? -r.report : r.report) || 0;
        const sousColonnesDeVirement = spec.colonnes.some((c) => c.type === 'VIREMENTS_AUGMENTATION' || c.type === 'VIREMENTS_DIMINUTION');
        const virementsAugmentation = sousColonnesDeVirement ? (auCredit ? r.virementCredit : r.virementDebit) || 0 : 0;
        const virementsDiminution = sousColonnesDeVirement ? (auCredit ? r.virementDebit : r.virementCredit) || 0 : 0;
        const colonneReevaluation = spec.colonnes.some((c) => c.type === 'REEVALUATION');
        const reevaluationAugmentation = colonneReevaluation ? (auCredit ? r.reevaluationCredit : r.reevaluationDebit) || 0 : 0;
        const reevaluationDiminution = colonneReevaluation ? (auCredit ? r.reevaluationDebit : r.reevaluationCredit) || 0 : 0;
        const reevaluation = reevaluationAugmentation - reevaluationDiminution;
        const augmentations = ((auCredit ? r.mouvementCredit : r.mouvementDebit) || 0) - virementsAugmentation - reevaluationAugmentation;
        const diminutions = ((auCredit ? r.mouvementDebit : r.mouvementCredit) || 0) - virementsDiminution - reevaluationDiminution;
        const cloture = ouverture + augmentations + virementsAugmentation + reevaluation - diminutions - virementsDiminution;
        const reel = auCredit ? -r.montant : r.montant;
        const ecart = cloture - reel;
        return {
            valeurs: {
                OUVERTURE: ouverture,
                AUGMENTATIONS: augmentations || 0,
                DIMINUTIONS: diminutions || 0,
                CLOTURE: cloture,
                ...(Math.abs(virementsAugmentation) > 0.005 ? { VIREMENTS_AUGMENTATION: virementsAugmentation } : {}),
                ...(Math.abs(virementsDiminution) > 0.005 ? { VIREMENTS_DIMINUTION: virementsDiminution } : {}),
                ...(Math.abs(reevaluationAugmentation) > 0.005 || Math.abs(reevaluationDiminution) > 0.005
                    ? { REEVALUATION: reevaluation || 0 }
                    : {}),
            },
            ecartCloture: Math.abs(ecart) > 0.005 ? ecart : undefined,
        };
    }
    resoudreRubriques(spec, lignes, rattachements = new Map(), echeancesParCompte, ventilationParCompte = new Map(), virements = virements_mise_en_service_1.AUCUN_VIREMENT, reevaluations = virements_mise_en_service_1.AUCUN_VIREMENT) {
        const resolues = [];
        for (const rubrique of spec.rubriques) {
            if (rubrique.totalDeRubriques) {
                const cumul = (f) => rubrique.totalDeRubriques.reduce((s, i) => s + (resolues[i]?.[f] ?? 0), 0) -
                    (rubrique.moinsRubriques ?? []).reduce((s, i) => s + (resolues[i]?.[f] ?? 0), 0);
                const cumulEcheance = (f) => rubrique.totalDeRubriques.reduce((s, i) => s + (resolues[i]?.echeances[f] ?? 0), 0) -
                    (rubrique.moinsRubriques ?? []).reduce((s, i) => s + (resolues[i]?.echeances[f] ?? 0), 0);
                resolues.push({
                    montant: cumul('montant'),
                    comptes: [],
                    report: cumul('report'),
                    mouvementDebit: cumul('mouvementDebit'),
                    mouvementCredit: cumul('mouvementCredit'),
                    virementDebit: cumul('virementDebit'),
                    virementCredit: cumul('virementCredit'),
                    reevaluationDebit: cumul('reevaluationDebit'),
                    reevaluationCredit: cumul('reevaluationCredit'),
                    echeances: {
                        unAn: cumulEcheance('unAn'),
                        deuxAns: cumulEcheance('deuxAns'),
                        plusDeDeuxAns: cumulEcheance('plusDeDeuxAns'),
                        nonVentile: cumulEcheance('nonVentile'),
                    },
                    ventilation: (rubrique.totalDeRubriques ?? []).reduce((acc, i) => {
                        const v = resolues[i]?.ventilation;
                        if (!v)
                            return acc;
                        for (const n of ['EXPLOITATION', 'FINANCIER', 'HAO']) {
                            acc.augmentation[n] += v.augmentation[n];
                            acc.diminution[n] += v.diminution[n];
                        }
                        acc.nonVentile.augmentation += v.nonVentile.augmentation;
                        acc.nonVentile.diminution += v.nonVentile.diminution;
                        return acc;
                    }, VENTILATION_NULLE()),
                });
            }
            else {
                const cle = rubrique.cle ? `${spec.code}::${rubrique.cle}` : '';
                resolues.push(this.calculerRubrique(rubrique, lignes, rattachements.get(cle) ?? [], echeancesParCompte, ventilationParCompte, virements, reevaluations));
            }
        }
        return resolues;
    }
    calculerNote(spec, lignesN, lignesN1, exerciceN1Disponible, rattachements, echeancesParCompte, ventilationParCompte, saisies = new Map(), virements = virements_mise_en_service_1.AUCUN_VIREMENT, reevaluations = virements_mise_en_service_1.AUCUN_VIREMENT, repetitions = new Map()) {
        const resN = this.resoudreRubriques(spec, lignesN, rattachements, echeancesParCompte, ventilationParCompte, virements, reevaluations);
        const resN1 = this.resoudreRubriques(spec, lignesN1, rattachements);
        const aColonnesDeMouvement = spec.colonnes.some((c) => [
            'OUVERTURE', 'AUGMENTATIONS', 'DIMINUTIONS', 'CLOTURE', 'VIREMENTS_AUGMENTATION', 'VIREMENTS_DIMINUTION', 'REEVALUATION',
        ].includes(c.type));
        const aColonneVariationAbsolue = spec.colonnes.some((c) => c.type === 'VARIATION_VALEUR_ABSOLUE');
        const aColonnesVentilees = spec.colonnes.some((c) => c.type.startsWith('AUGMENTATION_') || c.type.startsWith('DIMINUTION_'));
        const aColonnesDEcheance = spec.colonnes.some((c) => ['ECHEANCE_1AN', 'ECHEANCE_2ANS', 'ECHEANCE_PLUS_2ANS'].includes(c.type));
        const toutes = spec.rubriques.map((rubrique, i) => {
            const montantN = resN[i].montant;
            const montantN1 = exerciceN1Disponible ? resN1[i].montant : undefined;
            const variationValeur = montantN1 !== undefined ? montantN - montantN1 : undefined;
            const variationPourcent = montantN1 !== undefined && Math.abs(montantN1) > 0.005 ? ((montantN - montantN1) / Math.abs(montantN1)) * 100 : undefined;
            const numerosRattaches = rattachements.get(`${spec.code}::${rubrique.cle}`) ?? [];
            const rattachee = numerosRattaches.length > 0;
            const mouvements = aColonnesDeMouvement ? this.colonnesDeMouvement(spec, resN[i]) : undefined;
            const variationAbsolue = aColonneVariationAbsolue && variationValeur !== undefined
                ? { VARIATION_VALEUR_ABSOLUE: Math.abs(variationValeur) }
                : undefined;
            const v = resN[i].ventilation;
            const ventilees = aColonnesVentilees
                ? {
                    AUGMENTATION_EXPLOITATION: v.augmentation.EXPLOITATION || 0,
                    AUGMENTATION_FINANCIERE: v.augmentation.FINANCIER || 0,
                    AUGMENTATION_HAO: v.augmentation.HAO || 0,
                    DIMINUTION_EXPLOITATION: v.diminution.EXPLOITATION || 0,
                    DIMINUTION_FINANCIERE: v.diminution.FINANCIER || 0,
                    DIMINUTION_HAO: v.diminution.HAO || 0,
                }
                : undefined;
            const e = resN[i].echeances;
            const echeances = aColonnesDEcheance
                ? {
                    ECHEANCE_1AN: e.unAn || 0,
                    ECHEANCE_2ANS: e.deuxAns || 0,
                    ECHEANCE_PLUS_2ANS: e.plusDeDeuxAns || 0,
                }
                : undefined;
            return {
                cle: rubrique.cle,
                libelle: rubrique.libelle,
                montantN,
                montantN1,
                variationValeur,
                variationPourcent,
                estTotal: rubrique.totalDeRubriques !== undefined || rubrique.sommeDesSaisies !== undefined,
                enAttenteDeRattachement: rattachee ? undefined : rubrique.subdivisionAttendue,
                rattachementDuDossier: rattachee || undefined,
                comptesRattaches: rattachee ? numerosRattaches : undefined,
                valeurs: mouvements || echeances || variationAbsolue || ventilees
                    ? { ...mouvements?.valeurs, ...echeances, ...variationAbsolue, ...ventilees }
                    : undefined,
                ecartCloture: mouvements?.ecartCloture,
                echeanceNonVentilee: aColonnesDEcheance && Math.abs(e.nonVentile) > 0.005 ? e.nonVentile : undefined,
                natureNonVentilee: aColonnesVentilees && Math.abs(v.nonVentile.augmentation) + Math.abs(v.nonVentile.diminution) > 0.005
                    ? { augmentation: v.nonVentile.augmentation, diminution: v.nonVentile.diminution }
                    : undefined,
                comptes: resN[i].comptes,
                renvoi: rubrique.renvoi,
                saisie: rubrique.saisie
                    ? spec.colonnes.map((_, ci) => saisies.get(`${spec.code}::${rubrique.cle}`)?.[ci] ?? null)
                    : undefined,
                saisieLibre: (0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(spec, rubrique)
                    ? spec.colonnes.map((c, ci) => (0, cellules_libres_en_saisie_1.colonneLibreEnSaisie)(c) ? (saisies.get(`${spec.code}::${rubrique.cle}`)?.[ci] ?? null) : null)
                    : undefined,
            };
        });
        (0, controles_saisie_notes_1.ecartsDesSaisies)(spec, toutes.map((l) => l.saisie)).forEach((ecarts, i) => {
            if (ecarts)
                toutes[i].ecartsSaisie = ecarts;
        });
        const etendues = toutes.flatMap((l, i) => {
            const r = spec.rubriques[i];
            if (!r.repetable || !r.cle || !l.saisie)
                return [l];
            const suivantes = repetitions.get(`${spec.code}::${r.cle}`) ?? new Map();
            const rangs = [...suivantes.keys()].sort((a, b) => a - b);
            return [
                { ...l, rang: 0 },
                ...rangs.map((rang) => ({
                    ...l,
                    rang,
                    saisie: spec.colonnes.map((_, ci) => suivantes.get(rang)?.[ci] ?? null),
                    ecartsSaisie: undefined,
                })),
            ];
        });
        const confrontations = [];
        spec.rubriques.forEach((r, i) => {
            if (!r.confronteSaisiesDe)
                return;
            const { cleRubrique, colonne } = r.confronteSaisiesDe;
            const nombres = etendues
                .filter((l) => l.cle === cleRubrique)
                .map((l) => (0, controles_saisie_notes_1.nombreSaisi)(l.saisie?.[colonne] ?? null))
                .filter((n) => n !== null);
            if (nombres.length === 0 || nombres.some((n) => Number.isNaN(n)))
                return;
            const sommeSaisie = Math.round(nombres.reduce((a, b) => a + b, 0) * 100) / 100;
            const montantBalance = toutes[i].montantN;
            if (Math.abs(sommeSaisie - montantBalance) > 0.005) {
                confrontations.push({
                    ligne: r.libelle,
                    colonne: spec.colonnes[colonne]?.libelle ?? `Colonne n° ${colonne + 1}`,
                    sommeSaisie,
                    montantBalance,
                });
            }
        });
        const chiffree = (l) => Math.abs(l.montantN) > 0.005 ||
            Math.abs(l.montantN1 ?? 0) > 0.005 ||
            Object.values(l.valeurs ?? {}).some((v) => Math.abs(v) > 0.005);
        const applicableChiffree = etendues.some((l) => !l.estTotal && chiffree(l));
        const renseignee = (cellules) => (cellules ?? []).some((v) => v !== null && v !== '');
        const saisieRenseignee = etendues.some((l) => renseignee(l.saisie) || renseignee(l.saisieLibre));
        const applicable = applicableChiffree || saisieRenseignee || spec.applicableDOffice !== undefined;
        const enSaisie = etendues.filter((l) => l.saisie !== undefined);
        const lignes = !applicable
            ? enSaisie
            : spec.horsBalance
                ? etendues
                : etendues.filter((l) => l.saisie !== undefined ||
                    chiffree(l) ||
                    l.estTotal ||
                    l.enAttenteDeRattachement ||
                    l.rattachementDuDossier ||
                    renseignee(l.saisieLibre));
        return {
            code: spec.code,
            sousTableau: spec.sousTableau,
            titre: spec.titre,
            colonnes: spec.colonnes,
            lignes,
            commentaire: spec.commentaire,
            renvoiOfficiel: spec.renvoiOfficiel,
            precisionEditeur: spec.precisionEditeur,
            renvoyeeDepuis: spec.renvoyeeDepuis,
            horsBalance: spec.horsBalance ?? false,
            exerciceN1Disponible,
            applicable,
            ...(confrontations.length > 0 ? { confrontations } : {}),
            rubriquesEnAttente: spec.rubriques.flatMap((r, i) => r.subdivisionAttendue && !toutes[i].rattachementDuDossier
                ? [{ cle: r.cle, libelle: r.libelle, attendu: r.subdivisionAttendue }]
                : []),
        };
    }
    async chargerVentilationParNature(tenantId, exerciceId) {
        const parCompte = new Map();
        await this.parLots((curseur) => this.prisma.ecriture.findMany({
            where: { tenantId, exerciceId, estGenereeParCloture: false, statut: client_1.StatutEcriture.VALIDEE },
            select: { id: true, lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } } } },
            orderBy: { id: 'asc' },
            take: NoteAnnexeService_1.LOT_LECTURE,
            ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
        }), (e) => {
            const lignes = e.lignes.map((l) => ({
                numero: l.compte.numero,
                debit: Number(l.debit),
                credit: Number(l.credit),
            }));
            for (const ligne of lignes) {
                const estCredit = Math.abs(ligne.credit) > 0.005;
                const sens = estCredit ? 'augmentation' : 'diminution';
                const montant = estCredit ? ligne.credit : ligne.debit;
                if (montant === 0)
                    continue;
                const contreparties = lignes.filter((c) => estCredit ? Math.abs(c.debit) > 0.005 : Math.abs(c.credit) > 0.005);
                const total = contreparties.reduce((s2, c) => s2 + (estCredit ? c.debit : c.credit), 0);
                const v = parCompte.get(ligne.numero) ?? VENTILATION_NULLE();
                if (total === 0) {
                    v.nonVentile[sens] += montant;
                }
                else {
                    for (const c of contreparties) {
                        const part = (montant * (estCredit ? c.debit : c.credit)) / total;
                        const nature = natureDeLaContrepartie(c.numero);
                        if (nature)
                            v[sens][nature] += part;
                        else
                            v.nonVentile[sens] += part;
                    }
                }
                parCompte.set(ligne.numero, v);
            }
        });
        return parCompte;
    }
    async chargerEcheances(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            return { parCompte: new Map(), nommes: new Map() };
        const unAn = (0, ajouter_mois_1.ajouterMois)(exercice.dateFin, 12);
        const deuxAns = (0, ajouter_mois_1.ajouterMois)(exercice.dateFin, 24);
        const parCompte = new Map();
        const ranger = (numero, montant, dateEcheance) => {
            if (montant === 0)
                return;
            const e = parCompte.get(numero) ?? { ...ECHEANCES_NULLES };
            if (!dateEcheance)
                e.nonVentile += montant;
            else if (dateEcheance <= unAn)
                e.unAn += montant;
            else if (dateEcheance <= deuxAns)
                e.deuxAns += montant;
            else
                e.plusDeDeuxAns += montant;
            parCompte.set(numero, e);
        };
        const ouvertes = {
            ecriture: { tenantId, exerciceId, statut: 'VALIDEE' },
            ...(0, ouverte_a_la_cloture_1.ouverteALaCloture)(exercice.dateFin),
        };
        const aPlusieurs = await (0, reste_des_lignes_ouvertes_1.groupesLusAPlusieurs)(this.prisma, ouvertes);
        const lettrees = [];
        await this.parLots((curseur) => this.prisma.ligneEcriture.findMany({
            where: ouvertes,
            select: {
                id: true,
                debit: true,
                credit: true,
                dateEcheance: true,
                lettrageId: true,
                deviseId: true,
                montantDevise: true,
                ecriture: { select: { date: true } },
                compte: { select: { numero: true } },
            },
            orderBy: { id: 'asc' },
            take: NoteAnnexeService_1.LOT_LECTURE,
            ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
        }), (l) => {
            if (l.lettrageId && aPlusieurs.has(l.lettrageId))
                lettrees.push(l);
            else
                ranger(l.compte.numero, Number(l.debit) - Number(l.credit), l.dateEcheance);
        });
        const poids = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(this.prisma, tenantId, lettrees, { dateMax: exercice.dateFin, statut: client_1.StatutEcriture.VALIDEE }, 'Notes annexes, échéances');
        for (const l of lettrees)
            ranger(l.compte.numero, (0, reste_des_lignes_ouvertes_1.poidsOuMontant)(poids, l), l.dateEcheance);
        return { parCompte, nommes: poids.motifs };
    }
    parLots(charger, traiter) {
        return (0, lecture_par_lots_1.lireParLots)(charger, traiter);
    }
    async chargerRattachements(tenantId, jeu) {
        const lignes = await this.prisma.rattachementNote.findMany({
            where: { tenantId, jeu },
            select: { codeNote: true, cleRubrique: true, compteId: true, compte: { select: { numero: true } } },
        });
        const parRubrique = new Map();
        const sansRubrique = [];
        for (const l of lignes) {
            if (!estRubriqueRattachable(jeu, l.codeNote, l.cleRubrique)) {
                sansRubrique.push({ codeNote: l.codeNote, cleRubrique: l.cleRubrique, compteId: l.compteId, numero: l.compte.numero });
                continue;
            }
            const cle = `${l.codeNote}::${l.cleRubrique}`;
            parRubrique.set(cle, [...(parRubrique.get(cle) ?? []), l.compte.numero]);
        }
        return { parRubrique, sansRubrique };
    }
    async chargerSaisies(tenantId, exerciceId, jeu) {
        const lignes = await this.prisma.saisieNote.findMany({
            where: { tenantId, exerciceId, jeu },
            select: { codeNote: true, cleRubrique: true, rang: true, colonne: true, valeurTexte: true, valeurNombre: true },
        });
        const repetitions = new Map();
        const parRubrique = new Map();
        const formatAnterieur = new Map();
        for (const l of lignes) {
            const valeur = l.valeurNombre !== null ? Number(l.valeurNombre) : l.valeurTexte;
            if (l.colonne >= effectifs_seize_colonnes_1.RANG_FORMAT_ANTERIEUR) {
                const telleQueSaisie = l.valeurTexte ?? (l.valeurNombre !== null ? String(l.valeurNombre) : null);
                if (telleQueSaisie === null)
                    continue;
                const rang = l.colonne - effectifs_seize_colonnes_1.RANG_FORMAT_ANTERIEUR;
                formatAnterieur.set(l.codeNote, [
                    ...(formatAnterieur.get(l.codeNote) ?? []),
                    {
                        cleRubrique: l.cleRubrique,
                        colonneAnterieure: effectifs_seize_colonnes_1.LIBELLES_FORMAT_HUIT_COLONNES[rang] ?? `Colonne n° ${rang + 1}`,
                        nature: (0, effectifs_seize_colonnes_1.natureColonneAnterieure)(rang),
                        valeur: telleQueSaisie,
                    },
                ]);
                continue;
            }
            const cle = `${l.codeNote}::${l.cleRubrique}`;
            const rang = l.rang ?? 0;
            if (rang > 0) {
                const parRang = repetitions.get(cle) ?? new Map();
                const cellules = parRang.get(rang) ?? [];
                cellules[l.colonne] = valeur;
                parRang.set(rang, cellules);
                repetitions.set(cle, parRang);
                continue;
            }
            const cellules = parRubrique.get(cle) ?? [];
            cellules[l.colonne] = valeur;
            parRubrique.set(cle, cellules);
        }
        return { parRubrique, formatAnterieur, repetitions };
    }
    celluleSaisissable(jeu, codeNote, cleRubrique, colonne) {
        const tableaux = NOTES_PAR_JEU[jeu].filter((n) => n.code === codeNote);
        if (tableaux.length === 0)
            throw new common_1.NotFoundException(`Aucune note « ${codeNote} » dans ce jeu d'états financiers.`);
        const spec = tableaux.find((n) => n.rubriques.some((r) => r.cle === cleRubrique));
        const rubrique = spec?.rubriques.find((r) => r.cle === cleRubrique);
        if (!spec || !rubrique) {
            throw new common_1.NotFoundException(`La note ${codeNote} n'a pas de rubrique « ${cleRubrique} ».`);
        }
        const colonneSpec = spec.colonnes[colonne];
        if (!colonneSpec) {
            throw new common_1.BadRequestException(`La note ${codeNote} n'a pas de colonne n° ${colonne} · elle en compte ${spec.colonnes.length}.`);
        }
        if (rubrique.cle === correspondance_notes_associations_1.CLE_DATE_ARRETE_NOTE_3) {
            throw new common_1.BadRequestException("La date d'arrêté se renseigne dans la fenêtre Exercices · la note 3 la reprend de l'exercice.");
        }
        if (!rubrique.saisie && !((0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(spec, rubrique) && (0, cellules_libres_en_saisie_1.colonneLibreEnSaisie)(colonneSpec))) {
            throw new common_1.BadRequestException(`La cellule « ${colonneSpec.libelle} » de la rubrique « ${rubrique.libelle} » (note ${codeNote}) est ` +
                `chiffrée par la comptabilité : elle ne se saisit pas à la main. Corriger l'écriture, ou rattacher ` +
                `les comptes du dossier.`);
        }
        return { spec, rubrique, colonneSpec };
    }
    async enregistrerSaisie(tenantId, userId, exerciceId, jeu, codeNote, cleRubrique, colonne, valeur, rang = 0) {
        await this.verifierJeuDuDossier(tenantId, jeu);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        const { colonneSpec, rubrique } = this.celluleSaisissable(jeu, codeNote, cleRubrique, colonne);
        if (rang !== 0 && !rubrique.repetable) {
            throw new common_1.BadRequestException(`La rubrique « ${rubrique.libelle} » (note ${codeNote}) n'a qu'une ligne · seules les listes du modèle ` +
                '(une ligne par apporteur, par entité, par produit ou par matière) se répètent.');
        }
        const cle = { tenantId, exerciceId, jeu, codeNote, cleRubrique, rang, colonne };
        const vide = valeur === null || valeur === undefined || (typeof valeur === 'string' && valeur.trim() === '');
        if (vide) {
            const existante = await this.prisma.saisieNote.findFirst({ where: cle, select: { id: true } });
            if (existante)
                await this.prisma.saisieNote.delete({ where: { id: existante.id } });
            return { efface: true };
        }
        const chiffree = colonneSpec.type !== 'LIBRE';
        if (chiffree) {
            const nombre = typeof valeur === 'number' ? valeur : Number(String(valeur).replace(/\s/g, '').replace(',', '.'));
            if (!Number.isFinite(nombre)) {
                throw new common_1.BadRequestException(`La colonne « ${colonneSpec.libelle} » de la note ${codeNote} attend un montant · « ${valeur} » n'en est pas un.`);
            }
            return this.ecrireCellule(cle, { valeurNombre: nombre, valeurTexte: null, updatedBy: userId });
        }
        return this.ecrireCellule(cle, { valeurTexte: String(valeur), valeurNombre: null, updatedBy: userId });
    }
    async retirerSaisieFormatAnterieur(tenantId, userId, exerciceId, jeu, codeNote, motif) {
        await this.verifierJeuDuDossier(tenantId, jeu);
        const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        if (!(0, effectifs_seize_colonnes_1.estTableauEffectifsSeizeColonnes)(jeu, codeNote, effectifs_seize_colonnes_1.SOUS_TABLEAU_PERSONNEL_PROPRE)) {
            throw new common_1.BadRequestException(`La note ${codeNote} ne porte pas de saisie au format antérieur · seules les notes 20B (projets) et 29B ` +
                '(associations) sont passées à seize colonnes.');
        }
        const texte = motif.trim();
        if (texte.length < effectifs_seize_colonnes_1.MOTIF_RETRAIT_MIN || texte.length > effectifs_seize_colonnes_1.MOTIF_RETRAIT_MAX) {
            throw new common_1.BadRequestException(`Le motif du retrait compte de ${effectifs_seize_colonnes_1.MOTIF_RETRAIT_MIN} à ${effectifs_seize_colonnes_1.MOTIF_RETRAIT_MAX} caractères.`);
        }
        const lignes = await this.prisma.saisieNote.findMany({
            where: { tenantId, exerciceId, jeu, codeNote, colonne: { gte: effectifs_seize_colonnes_1.RANG_FORMAT_ANTERIEUR } },
            select: { id: true },
        });
        if (lignes.length === 0) {
            throw new common_1.NotFoundException(`La note ${codeNote} ne porte plus de saisie au format antérieur sur cet exercice.`);
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            for (const l of lignes) {
                await tx.saisieNote.update({ where: { id: l.id }, data: { motifRetrait: texte, updatedBy: userId } });
                await tx.saisieNote.delete({ where: { id: l.id } });
            }
        }, { maxWait: 10_000, timeout: (0, prisma_retry_util_1.delaiSelonVolume)(2 * lignes.length) });
        return { retirees: lignes.length };
    }
    async ecrireCellule(cle, donnees) {
        const existante = await this.prisma.saisieNote.findFirst({ where: cle, select: { id: true } });
        if (existante)
            return this.prisma.saisieNote.update({ where: { id: existante.id }, data: donnees });
        try {
            return await this.prisma.saisieNote.create({ data: { ...cle, ...donnees } });
        }
        catch (e) {
            if (!(e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002'))
                throw e;
            const creee = await this.prisma.saisieNote.findFirst({ where: cle, select: { id: true } });
            if (!creee)
                throw e;
            return this.prisma.saisieNote.update({ where: { id: creee.id }, data: donnees });
        }
    }
    async notesDuJeu(tenantId, exerciceId, jeu) {
        const specs = NOTES_PAR_JEU[jeu];
        const exerciceN1Id = await (0, etats_financiers_communs_1.trouverExerciceN1)(this.exerciceService, tenantId, exerciceId);
        const ecriture = balanceMemorisee(this.ecritureService);
        const [lignesN, lignesN1] = await Promise.all([
            (0, etats_financiers_communs_1.chargerLignes)(ecriture, tenantId, exerciceId),
            (0, etats_financiers_communs_1.chargerLignes)(ecriture, tenantId, exerciceN1Id),
        ]);
        const [{ parRubrique: rattachements, sansRubrique: rattachementsSansRubrique }, { parCompte: echeances, nommes }, ventilation, { parRubrique: saisies, formatAnterieur, repetitions }, virements, reevaluations,] = await Promise.all([
            this.chargerRattachements(tenantId, jeu),
            this.chargerEcheances(tenantId, exerciceId),
            this.chargerVentilationParNature(tenantId, exerciceId),
            this.chargerSaisies(tenantId, exerciceId, jeu),
            this.ecritureService.virementsDeMiseEnService(tenantId, exerciceId),
            this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceId),
        ]);
        const notes = specs.map((spec) => this.calculerNote(spec, lignesN, lignesN1, exerciceN1Id !== null, rattachements, echeances, ventilation, saisies, virements, reevaluations, repetitions));
        for (const n of notes) {
            n.titreNote = (0, intitules_notes_sycebnl_1.titreDeLaNote)(jeu, n.code, notes.find((x) => x.code === n.code).titre);
        }
        for (const n of notes) {
            const gardees = formatAnterieur.get(n.code);
            if (!gardees || !(0, effectifs_seize_colonnes_1.estTableauEffectifsSeizeColonnes)(jeu, n.code, n.sousTableau))
                continue;
            n.saisiesFormatAnterieur = gardees.map((g) => ({
                ...g,
                rubrique: n.lignes.find((l) => l.cle === g.cleRubrique)?.libelle ?? `Rubrique inconnue · ${g.cleRubrique}`,
            }));
            n.applicable = true;
        }
        await this.injecterDateArrete(notes, tenantId, exerciceId);
        await this.injecterExecutionBudgetaire(notes, tenantId, exerciceId, jeu);
        await this.injecterIndicateursFinanciers(notes, tenantId, exerciceId, jeu, lignesN, lignesN1, exerciceN1Id !== null, ecriture);
        await this.injecterPassifsEventuels(notes, tenantId, exerciceId, jeu);
        await this.injecterTransfertDepreciation(notes, specs, tenantId, exerciceId, jeu);
        return {
            notes,
            exerciceN1Disponible: exerciceN1Id !== null,
            rattachementsSansRubrique,
            groupesLusLigneALigne: await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(this.prisma, tenantId, nommes),
            ficheRecapitulative: [...new Set(notes.map((n) => n.code))].map((code) => {
                const tableaux = notes.filter((n) => n.code === code);
                return {
                    code,
                    titre: (0, intitules_notes_sycebnl_1.intituleSurLaFiche)(jeu, code, tableaux[0].titre),
                    applicable: tableaux.some((n) => n.applicable),
                    rubriquesEnAttente: tableaux.flatMap((n) => n.rubriquesEnAttente),
                };
            }),
            couverture: {
                transcrites: new Set(specs.map((n) => NUMERO_OFFICIEL_PAR_JEU[jeu](n.code))).size,
                attendues: NOTES_ATTENDUES_PAR_JEU[jeu],
            },
        };
    }
    async injecterDateArrete(notes, tenantId, exerciceId) {
        const porteuses = notes.filter((n) => n.lignes.some((l) => l.cle === correspondance_notes_associations_1.CLE_DATE_ARRETE_NOTE_3));
        if (porteuses.length === 0)
            return;
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { dateArreteComptes: true },
        });
        const date = exercice?.dateArreteComptes
            ? exercice.dateArreteComptes.toLocaleDateString('fr-FR', { timeZone: 'UTC' })
            : null;
        for (const note of porteuses) {
            note.lignes = note.lignes.map((ligne) => {
                if (ligne.cle !== correspondance_notes_associations_1.CLE_DATE_ARRETE_NOTE_3)
                    return ligne;
                const anterieure = ligne.saisie?.[0];
                const texteAnterieur = anterieure === null || anterieure === undefined || String(anterieure).trim() === ''
                    ? null
                    : String(anterieure).trim();
                const principal = date ?? 'Non renseignée (fenêtre Exercices)';
                const texte = texteAnterieur && texteAnterieur !== date
                    ? `${principal} · saisie antérieure de la note : ${texteAnterieur}`
                    : principal;
                return { ...ligne, saisie: [texte], saisieVerrouillee: true };
            });
        }
    }
    async injecterExecutionBudgetaire(notes, tenantId, exerciceId, jeu) {
        const code = CODE_NOTE_EXECUTION_BUDGETAIRE[jeu];
        if (!code)
            return;
        const note = notes.find((n) => n.code === code);
        if (!note)
            return;
        let tableau;
        try {
            tableau = await this.budgetService.executionBudgetaire(tenantId, exerciceId);
        }
        catch (e) {
            if (e instanceof etats_financiers_projet_budget_service_1.AucunPlanABudgetsException)
                return;
            throw e;
        }
        const cellules = (l) => [
            l.code,
            l.libelle,
            l.budget,
            l.decaissement,
            l.engagement,
            l.realisation,
            l.creditDisponible,
            l.executionPourcent,
        ];
        const lignes = tableau.lignes.map((l) => ({
            libelle: `${l.code} · ${l.libelle}`,
            montantN: 0,
            estTotal: l.estRubrique,
            comptes: [],
            saisie: cellules(l),
            saisieVerrouillee: true,
        }));
        lignes.push({
            libelle: 'TOTAL',
            montantN: 0,
            estTotal: true,
            comptes: [],
            saisie: cellules({
                code: '',
                libelle: 'TOTAL',
                ...tableau.total,
                executionPourcent: Math.abs(tableau.total.budget) < 0.005 ? null : (tableau.total.realisation / tableau.total.budget) * 100,
            }),
            saisieVerrouillee: true,
        });
        note.lignes = lignes;
        note.applicable = lignes.some((l) => (l.saisie ?? []).some((v) => typeof v === 'number' && Math.abs(v) > 0.005));
    }
    etatsSurLaBalanceDeLAppel(ecriture) {
        const lecture = ecriture;
        return Object.create(this.etatsFinanciersService, { ecritureService: { value: lecture } });
    }
    async injecterIndicateursFinanciers(notes, tenantId, exerciceId, jeu, lignesN, lignesN1, exerciceN1Disponible, ecriture) {
        if (jeu === client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL) {
            await this.injecterFicheSyntheseSyscohada(notes, tenantId, exerciceId, lignesN, lignesN1, exerciceN1Disponible, ecriture);
            return;
        }
        if (jeu !== client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS)
            return;
        const note = notes.find((n) => n.code === '33');
        if (!note)
            return;
        const etats = this.etatsSurLaBalanceDeLAppel(ecriture);
        const [bilan, compteDeResultat, fluxTresorerie] = await Promise.all([
            etats.bilan(tenantId, exerciceId),
            etats.compteDeResultat(tenantId, exerciceId),
            etats.tableauFluxTresorerie(tenantId, exerciceId),
        ]);
        const indicateurs = new Map((0, indicateurs_note_33_1.indicateursNote33)({ bilan, compteDeResultat, fluxTresorerie }, (0, indicateurs_note_33_1.cessionsDeLExercice)(lignesN), (0, indicateurs_note_33_1.cessionsDeLExercice)(lignesN1), exerciceN1Disponible).map((i) => [i.cle, i]));
        note.lignes = note.lignes.map((ligne) => {
            const i = ligne.cle ? indicateurs.get(ligne.cle) : undefined;
            if (!i)
                return ligne;
            const { valeurN, valeurN1 } = i;
            const variationValeur = valeurN !== null && valeurN1 !== null ? valeurN - valeurN1 : null;
            const variationPourcent = i.unite === 'POURCENT' || valeurN === null || valeurN1 === null || Math.abs(valeurN1) < 0.005
                ? null
                : ((valeurN - valeurN1) / Math.abs(valeurN1)) * 100;
            return {
                ...ligne,
                saisie: [valeurN, exerciceN1Disponible ? valeurN1 : null, variationValeur, variationPourcent],
                saisieVerrouillee: true,
            };
        });
        note.applicable = note.lignes.some((l) => l.saisieVerrouillee && (l.saisie ?? []).some((v) => typeof v === 'number' && Math.abs(v) > 0.005));
        const enSaisie = note.lignes.filter((l) => !l.saisieVerrouillee).map((l) => l.cle);
        if (enSaisie.length !== indicateurs_note_33_1.INDICATEURS_LAISSES_EN_SAISIE.length) {
            throw new Error(`Note 33 : ${enSaisie.length} rubriques non calculées (${enSaisie.join(', ')}) au lieu des ` +
                `${indicateurs_note_33_1.INDICATEURS_LAISSES_EN_SAISIE.length} attendues. Une clé de rubrique a changé.`);
        }
    }
    async injecterFicheSyntheseSyscohada(notes, tenantId, exerciceId, lignesN, lignesN1, exerciceN1Disponible, ecriture) {
        const note = notes.find((n) => n.code === '34');
        if (!note)
            return;
        const etats = new etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService(ecriture, this.exerciceService);
        const [bilan, compteDeResultat, fluxTresorerie] = await Promise.all([
            etats.bilan(tenantId, exerciceId),
            etats.compteDeResultat(tenantId, exerciceId),
            etats.tableauFluxTresorerie(tenantId, exerciceId),
        ]);
        const indicateurs = new Map((0, indicateurs_note_34_syscohada_1.indicateursNote34Syscohada)({ bilan, compteDeResultat, fluxTresorerie }, lignesN, lignesN1, exerciceN1Disponible).map((i) => [i.cle, i]));
        note.lignes = note.lignes.map((ligne) => {
            const i = ligne.cle ? indicateurs.get(ligne.cle) : undefined;
            if (!i)
                return ligne;
            const { valeurN, valeurN1 } = i;
            const variationPourcent = valeurN === null || valeurN1 === null || Math.abs(valeurN1) < 0.005
                ? null
                : ((valeurN - valeurN1) / Math.abs(valeurN1)) * 100;
            return {
                ...ligne,
                saisie: [valeurN, exerciceN1Disponible ? valeurN1 : null, variationPourcent],
                saisieVerrouillee: true,
            };
        });
        note.precisionEditeur = note.precisionEditeur ? `${note.precisionEditeur} ${indicateurs_note_34_syscohada_1.PRECISION_NOTE_34}` : indicateurs_note_34_syscohada_1.PRECISION_NOTE_34;
        note.applicable = note.lignes.some((l) => l.saisieVerrouillee
            ? (l.saisie ?? []).some((v) => typeof v === 'number' && Math.abs(v) > 0.005)
            : (l.saisie ?? []).some((v) => v !== null && v !== ''));
        const enSaisie = note.lignes.filter((l) => !l.saisieVerrouillee).map((l) => l.cle);
        if (enSaisie.length !== indicateurs_note_34_syscohada_1.INDICATEURS_NOTE_34_LAISSES_EN_SAISIE.length) {
            throw new Error(`Note 34 : ${enSaisie.length} rubriques non calculées (${enSaisie.join(', ')}) au lieu des ` +
                `${indicateurs_note_34_syscohada_1.INDICATEURS_NOTE_34_LAISSES_EN_SAISIE.length} attendues. Une clé de rubrique a changé.`);
        }
    }
    async injecterPassifsEventuels(notes, tenantId, exerciceId, jeu) {
        const cible = passifs_eventuels_en_note_1.TABLEAU_PASSIFS_EVENTUELS[jeu];
        if (!cible)
            return;
        const note = notes.find((n) => n.code === cible.code && (cible.sousTableau === undefined || n.sousTableau === cible.sousTableau));
        if (!note)
            return;
        const registre = await this.prisma.provisionRisqueCharge.findMany({
            where: { tenantId, exerciceId, statut: client_1.StatutProvision.PASSIF_EVENTUEL },
            orderBy: [{ nature: 'asc' }, { objet: 'asc' }],
            select: {
                objet: true,
                statut: true,
                incertitudes: true,
                echeanceAttendue: true,
                motifNonComptabilisation: true,
                remboursementAttendu: true,
                remboursementCertain: true,
                remboursementTiers: true,
            },
        });
        const ajoutees = (0, passifs_eventuels_en_note_1.lignesPassifsEventuels)(registre, note.colonnes.length);
        if (ajoutees.length === 0)
            return;
        note.lignes = [...note.lignes, ...ajoutees];
        note.applicable = true;
    }
    async injecterTransfertDepreciation(notes, specs, tenantId, exerciceId, jeu) {
        const code = transfert_depreciation_note_1.NOTE_DU_TRANSFERT[jeu];
        if (!code)
            return;
        const note = notes.find((n) => n.code === code);
        const spec = specs.find((n) => n.code === code);
        if (!note || !spec)
            return;
        const lus = await this.prisma.depreciationImmobilisation.findMany({
            where: {
                exerciceId,
                immobilisation: { tenantId },
                nature: { in: [client_1.NatureMouvementDepreciation.TRANSFERT_REPRISE, client_1.NatureMouvementDepreciation.TRANSFERT_DOTATION] },
            },
            select: {
                nature: true,
                montant: true,
                compteDepreciation: { select: { numero: true } },
                compteContrepartie: { select: { numero: true } },
                ecriture: { select: { statut: true } },
            },
        });
        if (lus.length === 0)
            return;
        const phrases = (0, transfert_depreciation_note_1.phrasesTransfertDepreciation)(lus.map((m) => ({
            nature: m.nature,
            montant: Number(m.montant),
            numeroCompteDepreciation: m.compteDepreciation.numero,
            numeroContrepartie: m.compteContrepartie.numero,
            valide: m.ecriture.statut === client_1.StatutEcriture.VALIDEE,
        })), (numero) => (0, transfert_depreciation_note_1.rubriqueQuiLit)(numero, spec.rubriques, note.lignes));
        if (phrases.length > 0)
            note.commentaireServi = [...(note.commentaireServi ?? []), ...phrases];
    }
    async notesAssociations(tenantId, exerciceId) {
        return this.notesDuJeu(tenantId, exerciceId, client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS);
    }
    async notesProjet(tenantId, exerciceId) {
        return this.notesDuJeu(tenantId, exerciceId, client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT);
    }
    async notesSyscohada(tenantId, exerciceId) {
        return this.notesDuJeu(tenantId, exerciceId, client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL);
    }
};
exports.NoteAnnexeService = NoteAnnexeService;
NoteAnnexeService.LOT_LECTURE = lecture_par_lots_1.LOT_LECTURE;
exports.NoteAnnexeService = NoteAnnexeService = NoteAnnexeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService,
        exercice_service_1.ExerciceService,
        prisma_service_1.PrismaService,
        etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService,
        etats_financiers_service_1.EtatsFinanciersService])
], NoteAnnexeService);
//# sourceMappingURL=note-annexe.service.js.map