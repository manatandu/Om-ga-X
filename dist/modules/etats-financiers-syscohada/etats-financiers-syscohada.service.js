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
exports.EtatsFinanciersSyscohadaService = void 0;
exports.subdivisionsLuesParLeTft = subdivisionsLuesParLeTft;
exports.lireDateArrete = lireDateArrete;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const virements_mise_en_service_1 = require("../immobilisations/virements-mise-en-service");
const exercice_service_1 = require("../exercice/exercice.service");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const situation_intermediaire_1 = require("../etats-financiers/situation-intermediaire");
const correspondance_bilan_syscohada_1 = require("./correspondance-bilan-syscohada");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const correspondance_tft_syscohada_1 = require("./correspondance-tft-syscohada");
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
function comptesASolderALaCloture(lignes, nonRattaches, nonVire) {
    const dejaNommes = new Set(nonRattaches.map((c) => c.numero));
    return lignes.flatMap((l) => {
        if (Math.abs(l.solde) < EPSILON || dejaNommes.has(l.numero))
            return [];
        const regle = correspondance_bilan_syscohada_1.COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE.find((c) => l.numero.startsWith(c.prefixe));
        if (regle)
            return [{ numero: l.numero, intitule: l.intitule, montant: l.solde, source: regle.source }];
        if (nonVire && (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA)) {
            return [{ numero: l.numero, intitule: l.intitule, montant: l.solde, source: SOURCE_RESULTAT_ANTERIEUR_NON_VIRE }];
        }
        return [];
    });
}
const SOURCE_RESULTAT_ANTERIEUR_NON_VIRE = "Titre VII COMPTE 13 : « En fin d'exercice, le résultat de l'exercice précédent non affecté […] est viré au compte de report à nouveau » · exercice clôturé sans ce virement, CJ l'additionne au résultat de l'exercice";
const PREFIXES_LUS_PAR_LE_TFT = [
    ...new Set(correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.flatMap((p) => p.termes.flatMap((t) => t.comptes?.prefixes ?? []))),
].sort();
function subdivisionsLuesParLeTft(numero) {
    const racine = numero.replace(/0+$/, '');
    if (!racine)
        return [];
    return PREFIXES_LUS_PAR_LE_TFT.filter((p) => p.startsWith(racine) && p.length > racine.length);
}
const CLASSES_DE_BILAN = new Set([
    client_1.ClasseCompte.CLASSE_1,
    client_1.ClasseCompte.CLASSE_2,
    client_1.ClasseCompte.CLASSE_3,
    client_1.ClasseCompte.CLASSE_4,
    client_1.ClasseCompte.CLASSE_5,
]);
const CLASSES_DE_GESTION = new Set([client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7, client_1.ClasseCompte.CLASSE_8]);
const EPSILON = 0.005;
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
function lireDateArrete(arreteAu) {
    const jour = FORMAT_JOUR.test(arreteAu) ? new Date(`${arreteAu}T00:00:00.000Z`) : new Date(Number.NaN);
    if (Number.isNaN(jour.getTime()) || jour.toISOString().slice(0, 10) !== arreteAu) {
        throw new common_1.BadRequestException(`La date d'arrêté « ${arreteAu} » n'est pas lisible · elle s'écrit AAAA-MM-JJ et désigne un jour qui existe.`);
    }
    return (0, situation_intermediaire_1.finDeJournee)(jour);
}
let EtatsFinanciersSyscohadaService = class EtatsFinanciersSyscohadaService {
    constructor(ecritureService, exerciceService) {
        this.ecritureService = ecritureService;
        this.exerciceService = exerciceService;
    }
    async trouverExerciceN1(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.trouverExerciceN1)(this.exerciceService, tenantId, exerciceId);
    }
    async chargerLignes(tenantId, exerciceId, arreteAu) {
        return (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId, arreteAu);
    }
    async bornesSituation(tenantId, exerciceId, exerciceN1Id, arreteAu) {
        if (!arreteAu)
            return { borneN: undefined, borneMemePeriodeN1: null };
        const borneN = lireDateArrete(arreteAu);
        const exercices = await this.exerciceService.lister(tenantId);
        const exercice = exercices.find((e) => e.id === exerciceId);
        if (!exercice) {
            throw new common_1.NotFoundException(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE);
        }
        const motif = (0, situation_intermediaire_1.motifRefusDateArrete)(borneN, exercice);
        if (motif)
            throw new common_1.BadRequestException(motif);
        const exerciceN1 = exerciceN1Id ? (exercices.find((e) => e.id === exerciceN1Id) ?? null) : null;
        return { borneN, borneMemePeriodeN1: (0, situation_intermediaire_1.memePeriodeExercicePrecedent)(borneN, exerciceN1) };
    }
    calculerPosteActif(poste, lignes) {
        let lignesBrut = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.sens_qualificatif === 'DEBITEUR') {
            lignesBrut = lignesBrut.filter((l) => l.solde > 0);
        }
        if (poste.comptesTransferesSiCrediteur) {
            lignesBrut = lignesBrut.filter((l) => !((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesTransferesSiCrediteur) && l.solde < 0));
        }
        const comptesBrut = lignesBrut.map((l) => ({
            numero: l.numero,
            intitule: l.intitule,
            montant: l.solde,
        }));
        const brut = comptesBrut.reduce((s, c) => s + c.montant, 0);
        const lignesAmort = poste.comptesAmortissement
            ? lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))
            : [];
        const comptesAmort = lignesAmort.map((l) => ({
            numero: l.numero,
            intitule: l.intitule,
            montant: l.solde,
        }));
        const amortissement = -comptesAmort.reduce((s, c) => s + c.montant, 0) || 0;
        return {
            ref: poste.ref,
            libelle: poste.libelle,
            montant: brut - amortissement,
            brut,
            amortissement,
            comptes: [...comptesBrut, ...comptesAmort],
            comptesBrut,
        };
    }
    calculerPostePassif(poste, lignes) {
        let matches = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.sens_qualificatif === 'CREDITEUR') {
            matches = matches.filter((l) => l.solde < 0);
        }
        const comptes = matches.map((l) => ({
            numero: l.numero,
            intitule: l.intitule,
            montant: -l.solde,
        }));
        const montant = comptes.reduce((s, c) => s + c.montant, 0);
        return { ref: poste.ref, libelle: poste.libelle, montant, comptes, comptesBrut: comptes };
    }
    calculerDR(lignes) {
        const posteDR = correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.find((p) => p.ref === correspondance_bilan_syscohada_1.REF_TRESORERIE_PASSIF_SYSCOHADA);
        const base = this.calculerPostePassif(posteDR, lignes);
        const decouverts = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA) && l.solde < 0);
        const comptes = [
            ...base.comptes,
            ...decouverts.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde })),
        ];
        const montant = comptes.reduce((s, c) => s + c.montant, 0);
        return { ref: base.ref, libelle: base.libelle, montant, comptes, comptesBrut: comptes };
    }
    calculerCJ(lignes) {
        const lignes678 = lignes.filter((l) => CLASSES_DE_GESTION.has(l.classe));
        const resultatClasses678 = lignes678.reduce((s, l) => s + (0, correspondance_compte_resultat_syscohada_1.montantSigne)(l.totalDebit, l.totalCredit), 0);
        const lignes13 = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA));
        const resultatCompte13 = lignes13.reduce((s, l) => s + (0, correspondance_compte_resultat_syscohada_1.montantSigne)(l.totalDebit, l.totalCredit), 0);
        const montant = (0, resultat_de_l_exercice_1.resultatAuBilan)(resultatClasses678, resultatCompte13);
        const comptes = [...lignes13, ...lignes678]
            .filter((l) => Math.abs(l.solde) > EPSILON)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: (0, correspondance_compte_resultat_syscohada_1.montantSigne)(l.totalDebit, l.totalCredit) }));
        return {
            poste: {
                ref: correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA,
                libelle: correspondance_bilan_syscohada_1.LIBELLE_RESULTAT_SYSCOHADA,
                montant,
                comptes,
                comptesBrut: comptes,
            },
            resultatClasses678,
            resultatCompte13,
        };
    }
    resoudreTousLesPostesBilan(lignes) {
        const parRef = new Map();
        for (const poste of correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA) {
            parRef.set(poste.ref, this.calculerPosteActif(poste, lignes));
        }
        for (const poste of correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA) {
            if (poste.ref === correspondance_bilan_syscohada_1.REF_TRESORERIE_PASSIF_SYSCOHADA)
                continue;
            parRef.set(poste.ref, this.calculerPostePassif(poste, lignes));
        }
        parRef.set(correspondance_bilan_syscohada_1.REF_TRESORERIE_PASSIF_SYSCOHADA, this.calculerDR(lignes));
        const { poste: posteCJ, resultatClasses678, resultatCompte13 } = this.calculerCJ(lignes);
        parRef.set(correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA, posteCJ);
        for (const total of correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA) {
            parRef.set(total.ref, this.calculerTotalActif(total, parRef));
        }
        for (const total of correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA) {
            parRef.set(total.ref, this.calculerTotalPassif(total, parRef));
        }
        return { parRef, resultatClasses678, resultatCompte13 };
    }
    resoudreBilanSurLignes(lignes) {
        return { resolution: this.resoudreTousLesPostesBilan(lignes), nonRattaches: this.comptesNonRattachesDuBilan(lignes) };
    }
    resoudreCompteResultatSurLignes(lignes) {
        return this.resoudreTousLesPostesCR(lignes);
    }
    resoudreFluxSurLignes(lignesN, lignesN1) {
        const { parRef } = this.resoudreFluxPourExercice(lignesN, lignesN1, true);
        return new Map([...parRef.entries()].map(([ref, p]) => [ref, p.montant]));
    }
    resoudreFluxDetailleSurLignes(lignesN, lignesN1, reevaluations = virements_mise_en_service_1.AUCUN_VIREMENT) {
        const { parRef, postesNonCalculables } = this.resoudreFluxPourExercice(lignesN, lignesN1, true, reevaluations);
        return {
            montants: new Map([...parRef.entries()].map(([ref, p]) => [ref, p.montant])),
            reserves: postesNonCalculables.map((x) => `${x.ref} · ${x.raison}`),
        };
    }
    calculerTotalActif(total, parRef) {
        const composantes = total.deRefs.map((ref) => parRef.get(ref));
        return {
            ref: total.ref,
            libelle: total.libelle,
            montant: composantes.reduce((s, p) => s + (p?.montant ?? 0), 0),
            brut: composantes.reduce((s, p) => s + (p?.brut ?? p?.montant ?? 0), 0),
            amortissement: composantes.reduce((s, p) => s + (p?.amortissement ?? 0), 0),
            comptes: composantes.flatMap((p) => p?.comptes ?? []),
            comptesBrut: composantes.flatMap((p) => p?.comptesBrut ?? []),
        };
    }
    calculerTotalPassif(total, parRef) {
        const composantes = total.deRefs.map((ref) => parRef.get(ref));
        const comptes = composantes.flatMap((p) => p?.comptes ?? []);
        return {
            ref: total.ref,
            libelle: total.libelle,
            montant: composantes.reduce((s, p) => s + (p?.montant ?? 0), 0),
            comptes,
            comptesBrut: comptes,
        };
    }
    comptesNonRattachesDuBilan(lignes) {
        const rattaches = new Set();
        for (const poste of [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA]) {
            for (const l of lignes) {
                if ((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions) ||
                    (poste.comptesAmortissement &&
                        (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))) {
                    rattaches.add(l.compteId);
                }
            }
        }
        for (const l of lignes) {
            if ((0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA) ||
                (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA)) {
                rattaches.add(l.compteId);
            }
        }
        return lignes
            .filter((l) => CLASSES_DE_BILAN.has(l.classe) && !rattaches.has(l.compteId))
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
    }
    async bilan(tenantId, exerciceId, arreteAu) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const { borneN } = await this.bornesSituation(tenantId, exerciceId, exerciceN1Id, arreteAu);
        const [lignesN, lignesN1, clos, closN1, ouvertureN] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId, borneN),
            this.chargerLignes(tenantId, exerciceN1Id),
            (0, etats_financiers_communs_1.exerciceCloture)(this.exerciceService, tenantId, exerciceId),
            (0, etats_financiers_communs_1.exercicePrecedentCloture)(this.exerciceService, tenantId, exerciceN1Id),
            exerciceN1Id ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId, borneN),
        ]);
        const ouverturePassee = await (0, etats_financiers_communs_1.lireOuverturePasseeEnOd)(this.ecritureService, tenantId, exerciceId, exerciceN1Id, ouvertureN);
        const comparatif = (0, etats_financiers_communs_1.comparatifDuBilan)(exerciceN1Id, lignesN1, ouvertureN, ouverturePassee, 'SYSCOHADA');
        const resolutionN = this.resoudreTousLesPostesBilan(lignesN);
        const resolutionN1 = this.resoudreTousLesPostesBilan(comparatif.lignes);
        const refsTotaux = new Set([...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA].map((t) => t.ref));
        const metadonnees = new Map();
        for (const p of [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA]) {
            metadonnees.set(p.ref, { note: p.note, renvoi: p.renvoi });
        }
        for (const t of [...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA]) {
            metadonnees.set(t.ref, { note: t.note });
        }
        const enLigne = (ref) => {
            const n = resolutionN.parRef.get(ref);
            const n1 = comparatif.provenance ? resolutionN1.parRef.get(ref) : undefined;
            const estTotal = refsTotaux.has(ref);
            const meta = metadonnees.get(ref) ?? {};
            return {
                ref,
                libelle: n.libelle,
                montant: n.montant,
                montantN1: n1?.montant,
                brut: n.brut,
                amortissement: n.amortissement,
                estTotal,
                comptes: estTotal ? [] : n.comptes,
                note: meta.note,
                renvoi: meta.renvoi,
            };
        };
        const actif = correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_ACTIF_SYSCOHADA.map(enLigne);
        const passif = correspondance_bilan_syscohada_1.ORDRE_AFFICHAGE_PASSIF_SYSCOHADA.map(enLigne);
        const totalActif = resolutionN.parRef.get('BZ').montant;
        const totalPassif = resolutionN.parRef.get('DZ').montant;
        const comptesNonRattaches = this.comptesNonRattachesDuBilan(lignesN);
        const parts = (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(resolutionN.resultatClasses678, resolutionN.resultatCompte13, lignesN.filter((l) => CLASSES_DE_GESTION.has(l.classe)), lignesN.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA)));
        const nonVire = borneN ? null : (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(clos, parts.resultatAnterieurNonAffecte, correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA, 'SYSCOHADA');
        const partsN1 = (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(resolutionN1.resultatClasses678, resolutionN1.resultatCompte13, comparatif.lignes.filter((l) => CLASSES_DE_GESTION.has(l.classe)), comparatif.lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_syscohada_1.COMPTES_RESULTAT_SYSCOHADA)));
        const nonVireN1 = (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)(comparatif.provenance, closN1, partsN1.resultatAnterieurNonAffecte, correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA, 'SYSCOHADA');
        return {
            actif,
            passif,
            totalActif,
            totalPassif,
            totalActifN1: comparatif.provenance ? resolutionN1.parRef.get('BZ').montant : undefined,
            totalPassifN1: comparatif.provenance ? resolutionN1.parRef.get('DZ').montant : undefined,
            exerciceN1Disponible: exerciceN1Id !== null,
            comparatif: comparatif.provenance,
            mentionComparatif: comparatif.mention,
            equilibre: Math.abs(totalActif - totalPassif) < 0.01,
            comptesNonRattaches,
            comptesASolderALaCloture: borneN ? [] : comptesASolderALaCloture(lignesN, comptesNonRattaches, nonVire),
            controle: {
                resultatClasses678: resolutionN.resultatClasses678,
                resultatCompte13: resolutionN.resultatCompte13,
                resultatAnterieurNonAffecte: parts.resultatAnterieurNonAffecte,
            },
            resultatAnterieurNonVire: nonVire,
            resultatAnterieurNonVireN1: nonVireN1,
            resultatEnInstance: (0, resultat_de_l_exercice_1.resultatEnInstanceAuBilan)(lignesN),
        };
    }
    resoudreTousLesPostesCR(lignes) {
        const comptesParRef = new Map();
        const comptesNonRattaches = [];
        let resultatToutesClassesDeGestion = 0;
        for (const l of lignes) {
            const montant = (0, correspondance_compte_resultat_syscohada_1.montantSigne)(l.totalDebit, l.totalCredit);
            const estCompteDeGestion = CLASSES_DE_GESTION.has(l.classe);
            if (estCompteDeGestion)
                resultatToutesClassesDeGestion += montant;
            const poste = (0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)(l.numero);
            if (!poste) {
                if (estCompteDeGestion) {
                    comptesNonRattaches.push({ numero: l.numero, intitule: l.intitule, montant });
                }
                continue;
            }
            const existants = comptesParRef.get(poste.ref) ?? [];
            existants.push({ numero: l.numero, intitule: l.intitule, montant });
            comptesParRef.set(poste.ref, existants);
        }
        const montantsParRef = {};
        for (const poste of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
            montantsParRef[poste.ref] = (comptesParRef.get(poste.ref) ?? []).reduce((s, c) => s + c.montant, 0);
        }
        const montantsAvecSoldes = (0, correspondance_compte_resultat_syscohada_1.calculerSoldesIntermediaires)(montantsParRef);
        for (const solde of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES) {
            comptesParRef.set(solde.ref, solde.deRefs.flatMap((ref) => comptesParRef.get(ref) ?? []));
        }
        return {
            montantsParRef: montantsAvecSoldes,
            comptesParRef,
            comptesNonRattaches,
            resultatToutesClassesDeGestion,
        };
    }
    soldesNommes(montantsParRef) {
        return {
            margeCommerciale: montantsParRef.XA ?? 0,
            chiffreAffaires: montantsParRef.XB ?? 0,
            valeurAjoutee: montantsParRef.XC ?? 0,
            excedentBrutExploitation: montantsParRef.XD ?? 0,
            resultatExploitation: montantsParRef.XE ?? 0,
            resultatFinancier: montantsParRef.XF ?? 0,
            resultatActivitesOrdinaires: montantsParRef.XG ?? 0,
            resultatHorsActivitesOrdinaires: montantsParRef.XH ?? 0,
            resultatNet: montantsParRef.XI ?? 0,
        };
    }
    async compteDeResultat(tenantId, exerciceId, arreteAu) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const { borneN, borneMemePeriodeN1 } = await this.bornesSituation(tenantId, exerciceId, exerciceN1Id, arreteAu);
        const [lignesN, lignesN1, lignesMemePeriodeN1, ouvertureN] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId, borneN),
            this.chargerLignes(tenantId, exerciceN1Id),
            borneMemePeriodeN1 ? this.chargerLignes(tenantId, exerciceN1Id, borneMemePeriodeN1) : Promise.resolve(null),
            exerciceN1Id ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId, borneN),
        ]);
        const resN = this.resoudreTousLesPostesCR(lignesN);
        const resN1 = this.resoudreTousLesPostesCR(lignesN1);
        const resMemePeriodeN1 = lignesMemePeriodeN1 ? this.resoudreTousLesPostesCR(lignesMemePeriodeN1) : null;
        const lignesDuModele = correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT.map((ref) => {
            const solde = (0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)(ref);
            const poste = solde ? undefined : (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)(ref);
            return {
                ref,
                libelle: solde?.libelle ?? poste.libelle,
                montant: resN.montantsParRef[ref] ?? 0,
                montantN1: exerciceN1Id ? (resN1.montantsParRef[ref] ?? 0) : undefined,
                montantMemePeriodeN1: resMemePeriodeN1 ? (resMemePeriodeN1.montantsParRef[ref] ?? 0) : undefined,
                comptes: resN.comptesParRef.get(ref) ?? [],
                estSolde: solde ? true : undefined,
                supplementaire: poste?.supplementaire ? true : undefined,
                formuleOfficielle: solde?.formuleOfficielle,
                notes: solde?.notes ?? poste.notes,
            };
        });
        const nul = (m) => m === undefined || Math.abs(m) < 0.005;
        const lignes = lignesDuModele.filter((l) => !(correspondance_compte_resultat_syscohada_1.REFS_POSTES_SUPPLEMENTAIRES.includes(l.ref) &&
            nul(l.montant) &&
            nul(l.montantN1) &&
            nul(l.montantMemePeriodeN1)));
        const resultatNet = resN.montantsParRef.XI ?? 0;
        const ecart = resN.resultatToutesClassesDeGestion - resultatNet;
        return {
            lignes,
            soldes: this.soldesNommes(resN.montantsParRef),
            soldesN1: exerciceN1Id ? this.soldesNommes(resN1.montantsParRef) : undefined,
            soldesMemePeriodeN1: resMemePeriodeN1 ? this.soldesNommes(resMemePeriodeN1.montantsParRef) : undefined,
            exerciceN1Disponible: exerciceN1Id !== null,
            memePeriodeN1JusquAu: borneMemePeriodeN1 ? borneMemePeriodeN1.toISOString().slice(0, 10) : undefined,
            motifComparatifAbsent: !exerciceN1Id && (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN) ? etats_financiers_communs_1.MOTIF_RESULTAT_N1_NON_TENU : null,
            comptesNonRattaches: resN.comptesNonRattaches,
            controle: {
                resultatToutesClassesDeGestion: resN.resultatToutesClassesDeGestion,
                ecart,
                coherent: Math.abs(ecart) < 0.01,
            },
        };
    }
    soldeDansLeSens(solde, sens) {
        return sens === 'DEBITEUR' ? Math.max(solde, 0) : Math.max(-solde, 0);
    }
    lirePosteBilan(resolution, ref, colonne) {
        const p = resolution.parRef.get(ref);
        if (!p)
            return { montant: 0, comptes: [] };
        if (colonne === 'BRUT' && p.brut !== undefined)
            return { montant: p.brut, comptes: p.comptesBrut };
        return { montant: p.montant, comptes: p.comptes };
    }
    differenceComptes(courant, anterieur) {
        const parNumero = new Map();
        for (const c of courant) {
            const existant = parNumero.get(c.numero);
            parNumero.set(c.numero, {
                numero: c.numero,
                intitule: c.intitule,
                montant: (existant?.montant ?? 0) + c.montant,
            });
        }
        for (const c of anterieur) {
            const existant = parNumero.get(c.numero);
            parNumero.set(c.numero, {
                numero: c.numero,
                intitule: existant?.intitule ?? c.intitule,
                montant: (existant?.montant ?? 0) - c.montant,
            });
        }
        return [...parNumero.values()];
    }
    lireComptes(terme, ctx) {
        const retenues = ctx.lignesCourant.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, terme.prefixes, terme.exclusions));
        if (terme.liaison === 'REEVALUATION') {
            return retenues
                .map((l) => {
                const m = ctx.reevaluations.get(l.compteId);
                const montant = terme.lecture === 'MOUVEMENT_DEBIT' ? (m?.debit ?? 0) : terme.lecture === 'MOUVEMENT_CREDIT' ? (m?.credit ?? 0) : 0;
                return { numero: l.numero, intitule: l.intitule, montant };
            })
                .filter((c) => Math.abs(c.montant) > EPSILON);
        }
        if (terme.lecture !== 'VARIATION_SOLDE') {
            return retenues.map((l) => {
                let montant;
                switch (terme.lecture) {
                    case 'SOLDE_GESTION':
                        montant = (0, correspondance_compte_resultat_syscohada_1.montantSigne)(l.totalDebit, l.totalCredit);
                        break;
                    case 'MOUVEMENT_DEBIT':
                        montant = l.mouvementDebit;
                        break;
                    default:
                        montant = l.mouvementCredit;
                        break;
                }
                return { numero: l.numero, intitule: l.intitule, montant };
            });
        }
        const sens = terme.sensSolde ?? 'DEBITEUR';
        return retenues.map((l) => {
            const soldeN = this.soldeDansLeSens(l.solde, sens);
            const soldeN1 = this.soldeDansLeSens(ctx.soldesAnterieurs.get(l.numero) ?? 0, sens);
            return { numero: l.numero, intitule: l.intitule, montant: soldeN - soldeN1 };
        });
    }
    evaluerTerme(terme, ctx) {
        if (terme.comptes) {
            return this.lireComptes(terme.comptes, ctx).map((c) => ({ ...c, montant: terme.signe * c.montant }));
        }
        const ref = terme.poste;
        const lire = (bilan, cr) => ref.etat === 'BILAN'
            ? this.lirePosteBilan(bilan, ref.ref, ref.colonne)
            : { montant: cr.montantsParRef[ref.ref] ?? 0, comptes: cr.comptesParRef.get(ref.ref) ?? [] };
        const courant = lire(ctx.bilanCourant, ctx.crCourant);
        if (ref.lecture === 'N') {
            return courant.comptes.map((c) => ({ ...c, montant: terme.signe * c.montant }));
        }
        const anterieur = lire(ctx.bilanAnterieur, ctx.crAnterieur);
        const comptes = ref.lecture === 'N1' ? anterieur.comptes : this.differenceComptes(courant.comptes, anterieur.comptes);
        return comptes.map((c) => ({ ...c, montant: terme.signe * c.montant }));
    }
    litLOuvertureOuLesMouvements(poste) {
        const b = (0, correspondance_tft_syscohada_1.besoinsDuPoste)(poste);
        return b.exerciceN1 || b.soldesAnterieurs || b.mouvements || this.exigeCompteDeResultatAnterieur(poste);
    }
    exigeCompteDeResultatAnterieur(poste) {
        return poste.termes.some((t) => t.poste?.etat === 'COMPTE_RESULTAT' && t.poste.lecture !== 'N');
    }
    calculerPosteFlux(poste, ctx) {
        const parNumero = new Map();
        for (const terme of poste.termes) {
            for (const c of this.evaluerTerme(terme, ctx)) {
                const existant = parNumero.get(c.numero);
                parNumero.set(c.numero, {
                    numero: c.numero,
                    intitule: existant?.intitule ?? c.intitule,
                    montant: (existant?.montant ?? 0) + c.montant,
                });
            }
        }
        const comptes = [...parNumero.values()]
            .filter((c) => Math.abs(c.montant) > EPSILON)
            .sort((a, b) => a.numero.localeCompare(b.numero));
        const montant = [...parNumero.values()].reduce((s, c) => s + c.montant, 0) || 0;
        return { montant, comptes };
    }
    refsDeBaseDuBilan(ref) {
        const total = [...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA].find((t) => t.ref === ref);
        if (!total)
            return [ref];
        return total.deRefs.flatMap((r) => this.refsDeBaseDuBilan(r));
    }
    comptesNonVentiles(lignes) {
        const ventiles = new Set();
        const refsBilanLues = new Set();
        for (const poste of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
            for (const terme of poste.termes) {
                if (terme.comptes) {
                    for (const l of lignes) {
                        if ((0, etats_financiers_communs_1.correspond)(l.numero, terme.comptes.prefixes, terme.comptes.exclusions))
                            ventiles.add(l.compteId);
                    }
                }
                else if (terme.poste?.etat === 'BILAN') {
                    refsBilanLues.add(terme.poste.ref);
                }
            }
        }
        for (const terme of correspondance_tft_syscohada_1.CONTROLE_ZH_PAR_LE_BILAN) {
            if (terme.poste?.etat === 'BILAN')
                refsBilanLues.add(terme.poste.ref);
        }
        const refsDeBase = new Set([...refsBilanLues].flatMap((ref) => this.refsDeBaseDuBilan(ref)));
        for (const poste of [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA]) {
            if (!refsDeBase.has(poste.ref))
                continue;
            for (const l of lignes) {
                if ((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions) ||
                    (poste.comptesAmortissement &&
                        (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))) {
                    ventiles.add(l.compteId);
                }
            }
        }
        const mouvemente = (l) => Math.abs(l.mouvementDebit) > EPSILON || Math.abs(l.mouvementCredit) > EPSILON;
        const nonVentiles = lignes
            .filter((l) => CLASSES_DE_BILAN.has(l.classe))
            .filter((l) => !ventiles.has(l.compteId))
            .filter((l) => !correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA.some((c) => l.numero.startsWith(c.prefixe)))
            .filter(mouvemente);
        const dejaListes = new Set(nonVentiles.map((l) => l.compteId));
        const exclusSansReprise = lignes
            .filter((l) => !dejaListes.has(l.compteId))
            .filter((l) => correspondance_tft_syscohada_1.COMPTES_EXCLUS_SANS_REPRISE.some((c) => l.numero.startsWith(c.prefixe)))
            .filter(mouvemente);
        return [...nonVentiles, ...exclusSansReprise]
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }))
            .sort((a, b) => a.numero.localeCompare(b.numero));
    }
    resoudreFluxPourExercice(lignesCourant, lignesAnterieur, exerciceAnterieurDisponible, reevaluations = virements_mise_en_service_1.AUCUN_VIREMENT, motifOuvertureIncertaine = null) {
        const soldesAnterieurs = new Map();
        for (const l of lignesAnterieur)
            soldesAnterieurs.set(l.numero, l.solde);
        const ctx = {
            bilanCourant: this.resoudreTousLesPostesBilan(lignesCourant),
            bilanAnterieur: this.resoudreTousLesPostesBilan(lignesAnterieur),
            crCourant: this.resoudreTousLesPostesCR(lignesCourant),
            crAnterieur: this.resoudreTousLesPostesCR(lignesAnterieur),
            lignesCourant,
            soldesAnterieurs,
            exerciceAnterieurDisponible,
            reevaluations,
        };
        const parRef = new Map();
        const postesNonCalculables = [];
        const nonCalcules = new Set();
        for (const poste of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
            if (motifOuvertureIncertaine && this.litLOuvertureOuLesMouvements(poste)) {
                parRef.set(poste.ref, { libelle: poste.libelle, montant: 0, comptes: [] });
                nonCalcules.add(poste.ref);
                postesNonCalculables.push({ ref: poste.ref, raison: motifOuvertureIncertaine, aLever: true });
                continue;
            }
            if (!exerciceAnterieurDisponible && this.exigeCompteDeResultatAnterieur(poste)) {
                parRef.set(poste.ref, { libelle: poste.libelle, montant: 0, comptes: [] });
                nonCalcules.add(poste.ref);
                postesNonCalculables.push({
                    ref: poste.ref,
                    raison: "Aucun exercice antérieur tenu dans le dossier : ce poste lit le compte de résultat de l'exercice " +
                        "N-1, qui ne se tire pas du bilan d'ouverture. Poste laissé vide, non chiffré à zéro.",
                    aLever: false,
                });
                continue;
            }
            const { montant, comptes } = this.calculerPosteFlux(poste, ctx);
            parRef.set(poste.ref, { libelle: poste.libelle, montant, comptes });
            for (const nd of poste.nonDeterminables ?? []) {
                const mouvementHorsModule = (comptes, sens) => lignesCourant.some((l) => {
                    if (!(0, etats_financiers_communs_1.correspond)(l.numero, comptes))
                        return false;
                    const lie = ctx.reevaluations.get(l.compteId);
                    const debit = Math.abs(l.mouvementDebit - (lie?.debit ?? 0)) > EPSILON;
                    const credit = Math.abs(l.mouvementCredit - (lie?.credit ?? 0)) > EPSILON;
                    return sens === 'DEBIT' ? debit : sens === 'CREDIT' ? credit : debit || credit;
                });
                const concerne = mouvementHorsModule(nd.comptes) && (!nd.declencheur || mouvementHorsModule(nd.declencheur.comptes, nd.declencheur.sens));
                if (concerne)
                    postesNonCalculables.push({ ref: poste.ref, raison: nd.motif });
            }
        }
        for (const total of correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA) {
            parRef.set(total.ref, {
                libelle: total.libelle,
                montant: total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0),
                comptes: [],
            });
            if (total.deRefs.some((ref) => nonCalcules.has(ref)))
                nonCalcules.add(total.ref);
        }
        return { parRef, postesNonCalculables, nonCalcules, ctx };
    }
    async tableauFluxTresorerie(tenantId, exerciceId, arreteAu) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const exerciceN2Id = exerciceN1Id ? await this.trouverExerciceN1(tenantId, exerciceN1Id) : null;
        const { borneN } = await this.bornesSituation(tenantId, exerciceId, exerciceN1Id, arreteAu);
        const [lignesN, lignesN1, lignesN2, reevaluationsN, reevaluationsN1] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId, borneN),
            this.chargerLignes(tenantId, exerciceN1Id),
            this.chargerLignes(tenantId, exerciceN2Id),
            this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceId, borneN),
            this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceN1Id),
        ]);
        const n1Tenu = (0, etats_financiers_communs_1.exercicePrecedentTenu)(exerciceN1Id, lignesN1);
        const n2Tenu = (0, etats_financiers_communs_1.exercicePrecedentTenu)(exerciceN2Id, lignesN2);
        const [ouvertureN, ouvertureN1, brouillardN1, closN1NonTenu] = await Promise.all([
            n1Tenu ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId, borneN),
            exerciceN1Id && !n2Tenu ? (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceN1Id) : Promise.resolve([]),
            (0, etats_financiers_communs_1.brouillardDuPrecedentNonTenu)(this.ecritureService, tenantId, exerciceN1Id, n1Tenu),
            (0, etats_financiers_communs_1.precedentNonTenuCloture)(this.exerciceService, tenantId, exerciceN1Id, n1Tenu),
        ]);
        const [ouverturePasseeN, ouverturePasseeN1, negatifsTardifsN] = await Promise.all([
            (0, etats_financiers_communs_1.lireOuverturePasseeEnOd)(this.ecritureService, tenantId, exerciceId, n1Tenu ? exerciceN1Id : null, ouvertureN),
            exerciceN1Id
                ? (0, etats_financiers_communs_1.lireOuverturePasseeEnOd)(this.ecritureService, tenantId, exerciceN1Id, n2Tenu ? exerciceN2Id : null, ouvertureN1)
                : Promise.resolve(null),
            (0, etats_financiers_communs_1.lireNegatifsTardifsDeLOuverture)(this.ecritureService, tenantId, exerciceId, n1Tenu ? exerciceN1Id : null, ouvertureN),
        ]);
        const precedentN = exerciceN1Id && !n1Tenu ? { auBrouillard: brouillardN1, clos: closN1NonTenu } : null;
        const precedentN1 = ouverturePasseeN1
            ? await (0, etats_financiers_communs_1.etatDuPrecedentNonTenu)(this.ecritureService, this.exerciceService, tenantId, exerciceN2Id, n2Tenu)
            : null;
        const resN = this.resoudreFluxPourExercice(lignesN, n1Tenu ? lignesN1 : ouvertureN, n1Tenu, reevaluationsN, ouverturePasseeN ? (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(ouverturePasseeN, 'SYSCOHADA', precedentN) : null);
        const resN1 = exerciceN1Id
            ? this.resoudreFluxPourExercice(lignesN1, n2Tenu ? lignesN2 : ouvertureN1, n2Tenu, reevaluationsN1, ouverturePasseeN1 ? (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(ouverturePasseeN1, 'SYSCOHADA', precedentN1) : null)
            : null;
        const refsTotaux = new Map(correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA.map((t) => [t.ref, t]));
        const lignes = correspondance_tft_syscohada_1.ORDRE_AFFICHAGE_FLUX_SYSCOHADA.map((entree) => {
            if ('section' in entree)
                return { section: entree.section };
            const ligne = resN.parRef.get(entree.ref);
            const total = refsTotaux.get(entree.ref);
            return {
                ref: entree.ref,
                libelle: ligne.libelle,
                montant: ligne.montant,
                montantN1: resN1 && !resN1.nonCalcules.has(entree.ref) ? resN1.parRef.get(entree.ref)?.montant : undefined,
                comptes: ligne.comptes,
                estTotal: total !== undefined,
                repere: entree.ref === 'ZA' ? 'A' : total?.cle,
            };
        });
        const tresorerieClotureParBilan = correspondance_tft_syscohada_1.CONTROLE_ZH_PAR_LE_BILAN.reduce((s, terme) => s + this.evaluerTerme(terme, resN.ctx).reduce((t, c) => t + c.montant, 0), 0);
        const controle = (0, etats_financiers_communs_1.controleDuTableauDesFlux)({
            ouverture: { ref: 'ZA', montant: resN.parRef.get('ZA').montant },
            variation: { ref: 'ZG', montant: resN.parRef.get('ZG').montant },
            clotureParFlux: { ref: 'ZH', montant: resN.parRef.get('ZH').montant },
            clotureParBilan: tresorerieClotureParBilan,
            vides: resN.nonCalcules,
        });
        return {
            lignes,
            exerciceN1Disponible: exerciceN1Id !== null,
            comptesNonVentiles: this.comptesNonVentiles(lignesN),
            comptesTropAgreges: lignesN
                .filter((l) => /^[1-8]/.test(l.numero))
                .filter((l) => Math.abs(l.solde) > EPSILON || Math.abs(l.mouvementDebit) > EPSILON || Math.abs(l.mouvementCredit) > EPSILON)
                .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde, subdivisions: subdivisionsLuesParLeTft(l.numero) }))
                .filter((c) => c.subdivisions.length > 0),
            postesNonCalculables: resN.postesNonCalculables,
            postesVides: [...resN.nonCalcules],
            mentionOuverture: (0, etats_financiers_communs_1.avecNegatifsTardifs)(n1Tenu
                ? null
                : exerciceN1Id && !ouverturePasseeN
                    ? (0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYSCOHADA', (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN), brouillardN1, closN1NonTenu)
                    : ouverturePasseeN
                        ? (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(ouverturePasseeN, 'SYSCOHADA', precedentN)
                        : (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN)
                            ? (0, etats_financiers_communs_1.mentionComparatifSurOuverture)('SYSCOHADA')
                            : (0, etats_financiers_communs_1.mentionOuverturePresumeeNulle)('SYSCOHADA'), negatifsTardifsN, 'SYSCOHADA'),
            postesNonCalculablesN1: resN1?.postesNonCalculables ?? [],
            controle,
        };
    }
};
exports.EtatsFinanciersSyscohadaService = EtatsFinanciersSyscohadaService;
exports.EtatsFinanciersSyscohadaService = EtatsFinanciersSyscohadaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService,
        exercice_service_1.ExerciceService])
], EtatsFinanciersSyscohadaService);
//# sourceMappingURL=etats-financiers-syscohada.service.js.map