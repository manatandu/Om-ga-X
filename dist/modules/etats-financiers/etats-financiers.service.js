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
exports.EtatsFinanciersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const virements_mise_en_service_1 = require("../immobilisations/virements-mise-en-service");
const exercice_service_1 = require("../exercice/exercice.service");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const resultat_de_l_exercice_1 = require("./resultat-de-l-exercice");
const correspondance_compte_resultat_1 = require("./correspondance-compte-resultat");
const correspondance_bilan_1 = require("./correspondance-bilan");
const correspondance_tft_1 = require("./correspondance-tft");
let EtatsFinanciersService = class EtatsFinanciersService {
    constructor(ecritureService, exerciceService) {
        this.ecritureService = ecritureService;
        this.exerciceService = exerciceService;
    }
    async trouverExerciceN1(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.trouverExerciceN1)(this.exerciceService, tenantId, exerciceId);
    }
    async chargerLignes(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId);
    }
    calculerPosteActif(poste, lignes) {
        let lignesBrut = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.sens_qualificatif === 'DEBITEUR') {
            lignesBrut = lignesBrut.filter((l) => l.solde > 0);
        }
        if (poste.comptesTransferesSiCrediteur) {
            lignesBrut = lignesBrut.filter((l) => !((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesTransferesSiCrediteur) && l.solde < 0));
        }
        const comptesBrut = lignesBrut.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
        const brut = comptesBrut.reduce((s, c) => s + c.montant, 0);
        const lignesAmort = poste.comptesAmortissement
            ? lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))
            : [];
        const comptesAmort = lignesAmort.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
        const amortissement = -comptesAmort.reduce((s, c) => s + c.montant, 0) || 0;
        return {
            ref: poste.ref,
            libelle: poste.libelle,
            montant: brut - amortissement,
            brut,
            amortissement,
            comptes: [...comptesBrut, ...comptesAmort],
        };
    }
    calculerPostePassif(poste, lignes) {
        let matches = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.sens_qualificatif === 'CREDITEUR') {
            matches = matches.filter((l) => l.solde < 0);
        }
        const comptes = matches.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
        return { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
    }
    calculerDW(lignes) {
        const posteDW = correspondance_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DW');
        const base = this.calculerPostePassif(posteDW, lignes);
        const decouverts = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR) && l.solde < 0);
        const comptes = [...base.comptes, ...decouverts.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }))];
        return { ref: 'DW', libelle: posteDW.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
    }
    calculerCH(lignes) {
        const lignes678 = lignes.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_6 || l.classe === client_1.ClasseCompte.CLASSE_7 || l.classe === client_1.ClasseCompte.CLASSE_8);
        const resultatClasses678 = lignes678.reduce((s, l) => s - l.solde, 0);
        const lignes13 = lignes.filter((l) => (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero));
        const resultatCompte13 = lignes13.reduce((s, l) => s - l.solde, 0);
        const montant = (0, resultat_de_l_exercice_1.resultatAuBilan)(resultatClasses678, resultatCompte13);
        const comptes = [...lignes13, ...lignes678]
            .filter((l) => Math.abs(l.solde) > 0.005)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
        return {
            poste: { ref: 'CH', libelle: "Résultat net de l'exercice (excédent + ou déficit -)", montant, comptes },
            resultatClasses678,
            resultatCompte13,
            parts: (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(resultatClasses678, resultatCompte13, lignes678, lignes13),
        };
    }
    resoudreTousLesPostesBilan(lignes) {
        const parRef = new Map();
        for (const poste of correspondance_bilan_1.POSTES_ACTIF) {
            parRef.set(poste.ref, this.calculerPosteActif(poste, lignes));
        }
        for (const poste of correspondance_bilan_1.POSTES_PASSIF) {
            if (poste.ref === 'DW')
                continue;
            parRef.set(poste.ref, this.calculerPostePassif(poste, lignes));
        }
        parRef.set('DW', this.calculerDW(lignes));
        const { poste: posteCH, resultatClasses678, resultatCompte13, parts } = this.calculerCH(lignes);
        parRef.set('CH', posteCH);
        for (const total of correspondance_bilan_1.TOTAUX_ACTIF) {
            const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
            const brut = total.deRefs.reduce((s, ref) => {
                const p = parRef.get(ref);
                return s + (p?.brut ?? p?.montant ?? 0);
            }, 0);
            const amortissement = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.amortissement ?? 0), 0);
            parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, brut, amortissement, comptes: [] });
        }
        for (const total of correspondance_bilan_1.TOTAUX_PASSIF) {
            const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
            parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, comptes: [] });
        }
        return { parRef, resultatClasses678, resultatCompte13, parts };
    }
    async bilan(tenantId, exerciceId) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const [lignesN, lignesN1, clos, closN1, ouvertureN] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceN1Id),
            (0, etats_financiers_communs_1.exerciceCloture)(this.exerciceService, tenantId, exerciceId),
            (0, etats_financiers_communs_1.exercicePrecedentCloture)(this.exerciceService, tenantId, exerciceN1Id),
            exerciceN1Id ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId),
        ]);
        const ouverturePassee = await (0, etats_financiers_communs_1.lireOuverturePasseeEnOd)(this.ecritureService, tenantId, exerciceId, exerciceN1Id, ouvertureN);
        const comparatif = (0, etats_financiers_communs_1.comparatifDuBilan)(exerciceN1Id, lignesN1, ouvertureN, ouverturePassee, 'SYCEBNL');
        const { parRef: parRefN, resultatClasses678, resultatCompte13, parts } = this.resoudreTousLesPostesBilan(lignesN);
        const { parRef: parRefN1, parts: partsN1 } = this.resoudreTousLesPostesBilan(comparatif.lignes);
        const refsTotaux = new Set([...correspondance_bilan_1.TOTAUX_ACTIF, ...correspondance_bilan_1.TOTAUX_PASSIF].map((t) => t.ref));
        const fusionnerN1 = (ref) => {
            const n = parRefN.get(ref);
            const n1 = comparatif.provenance ? parRefN1.get(ref) : undefined;
            return {
                ...n,
                estTotal: refsTotaux.has(ref),
                montantN1: n1?.montant,
            };
        };
        const actif = correspondance_bilan_1.ORDRE_AFFICHAGE_ACTIF.map(fusionnerN1);
        const passif = correspondance_bilan_1.ORDRE_AFFICHAGE_PASSIF.map(fusionnerN1);
        const comptesRattaches = new Set();
        for (const poste of [...correspondance_bilan_1.POSTES_ACTIF, ...correspondance_bilan_1.POSTES_PASSIF]) {
            for (const l of lignesN) {
                if ((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions) ||
                    (poste.comptesAmortissement && (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))) {
                    comptesRattaches.add(l.compteId);
                }
            }
        }
        for (const l of lignesN) {
            if ((0, etats_financiers_communs_1.correspond)(l.numero, correspondance_bilan_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR) || (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero)) {
                comptesRattaches.add(l.compteId);
            }
        }
        const CLASSES_DE_BILAN = new Set([
            client_1.ClasseCompte.CLASSE_1,
            client_1.ClasseCompte.CLASSE_2,
            client_1.ClasseCompte.CLASSE_3,
            client_1.ClasseCompte.CLASSE_4,
            client_1.ClasseCompte.CLASSE_5,
        ]);
        const comptesNonRattaches = lignesN
            .filter((l) => CLASSES_DE_BILAN.has(l.classe) && !comptesRattaches.has(l.compteId))
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
        const totalActif = parRefN.get('BZ').montant;
        const totalPassif = parRefN.get('DZ').montant;
        const totalActifN1 = comparatif.provenance ? parRefN1.get('BZ').montant : undefined;
        const totalPassifN1 = comparatif.provenance ? parRefN1.get('DZ').montant : undefined;
        return {
            actif,
            passif,
            totalActif,
            totalPassif,
            totalActifN1,
            totalPassifN1,
            exerciceN1Disponible: exerciceN1Id !== null,
            comparatif: comparatif.provenance,
            mentionComparatif: comparatif.mention,
            equilibre: Math.abs(totalActif - totalPassif) < 0.01,
            comptesNonRattaches,
            controle: {
                resultatClasses678,
                resultatCompte13,
                resultatAnterieurNonAffecte: parts.resultatAnterieurNonAffecte,
            },
            resultatAnterieurNonVire: (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(clos, parts.resultatAnterieurNonAffecte, 'CH', 'SYCEBNL'),
            resultatAnterieurNonVireN1: (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)(comparatif.provenance, closN1, partsN1.resultatAnterieurNonAffecte, 'CH', 'SYCEBNL'),
        };
    }
    resoudreTousLesPostesCR(lignes) {
        const comptesParPoste = new Map();
        const comptesNonRattaches = [];
        let resultatToutesClassesDeGestion = 0;
        for (const l of lignes) {
            if (l.classe === client_1.ClasseCompte.CLASSE_6 || l.classe === client_1.ClasseCompte.CLASSE_7 || l.classe === client_1.ClasseCompte.CLASSE_8) {
                resultatToutesClassesDeGestion += l.totalCredit - l.totalDebit;
            }
        }
        for (const l of lignes) {
            const poste = (0, correspondance_compte_resultat_1.posteDuCompte)(l.numero);
            if (!poste) {
                const estCompteDeGestion = l.classe === client_1.ClasseCompte.CLASSE_6 || l.classe === client_1.ClasseCompte.CLASSE_7 || l.classe === client_1.ClasseCompte.CLASSE_8;
                if (estCompteDeGestion) {
                    comptesNonRattaches.push({ numero: l.numero, intitule: l.intitule, montant: l.totalCredit - l.totalDebit });
                }
                continue;
            }
            const montant = poste.sens === 'PRODUIT' ? l.totalCredit - l.totalDebit : l.totalDebit - l.totalCredit;
            const existants = comptesParPoste.get(poste.ref) ?? [];
            existants.push({ numero: l.numero, intitule: l.intitule, montant });
            comptesParPoste.set(poste.ref, existants);
        }
        const calculer = (poste) => {
            const comptes = comptesParPoste.get(poste.ref) ?? [];
            return { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
        };
        const produits = correspondance_compte_resultat_1.POSTES_PRODUITS.map(calculer);
        const charges = correspondance_compte_resultat_1.POSTES_CHARGES.map(calculer);
        const [produitsHao, chargesHao] = correspondance_compte_resultat_1.POSTES_HAO.map(calculer);
        return { produits, charges, produitsHao, chargesHao, comptesNonRattaches, resultatToutesClassesDeGestion };
    }
    async compteDeResultat(tenantId, exerciceId) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const [lignesN, lignesN1, ouvertureN] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceN1Id),
            exerciceN1Id ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId),
        ]);
        const resN = this.resoudreTousLesPostesCR(lignesN);
        const resN1 = this.resoudreTousLesPostesCR(lignesN1);
        const parRefN1 = new Map([...resN1.produits, ...resN1.charges, resN1.produitsHao, resN1.chargesHao].map((p) => [p.ref, p]));
        const fusionnerN1 = (p) => ({
            ...p,
            montantN1: exerciceN1Id ? (parRefN1.get(p.ref)?.montant ?? 0) : undefined,
        });
        const produits = resN.produits.map(fusionnerN1);
        const charges = resN.charges.map(fusionnerN1);
        const produitsHao = fusionnerN1(resN.produitsHao);
        const chargesHao = fusionnerN1(resN.chargesHao);
        const totalProduits = produits.reduce((s, p) => s + p.montant, 0);
        const totalCharges = charges.reduce((s, p) => s + p.montant, 0);
        const resultatActivitesOrdinaires = totalProduits - totalCharges;
        const resultatHao = produitsHao.montant - chargesHao.montant;
        const resultatNet = resultatActivitesOrdinaires + resultatHao;
        const totalProduitsN1 = exerciceN1Id ? produits.reduce((s, p) => s + (p.montantN1 ?? 0), 0) : undefined;
        const totalChargesN1 = exerciceN1Id ? charges.reduce((s, p) => s + (p.montantN1 ?? 0), 0) : undefined;
        const resultatActivitesOrdinairesN1 = totalProduitsN1 !== undefined && totalChargesN1 !== undefined ? totalProduitsN1 - totalChargesN1 : undefined;
        const resultatHaoN1 = exerciceN1Id !== null ? (produitsHao.montantN1 ?? 0) - (chargesHao.montantN1 ?? 0) : undefined;
        const resultatNetN1 = resultatActivitesOrdinairesN1 !== undefined && resultatHaoN1 !== undefined
            ? resultatActivitesOrdinairesN1 + resultatHaoN1
            : undefined;
        const ecartControle = resN.resultatToutesClassesDeGestion - resultatNet;
        return {
            produits,
            totalProduits,
            totalProduitsN1,
            charges,
            totalCharges,
            totalChargesN1,
            resultatActivitesOrdinaires,
            resultatActivitesOrdinairesN1,
            produitsHao,
            chargesHao,
            resultatHao,
            resultatHaoN1,
            resultatNet,
            resultatNetN1,
            exerciceN1Disponible: exerciceN1Id !== null,
            motifComparatifAbsent: !exerciceN1Id && (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN) ? etats_financiers_communs_1.MOTIF_RESULTAT_N1_NON_TENU : null,
            comptesNonRattaches: resN.comptesNonRattaches,
            controle: {
                resultatToutesClassesDeGestion: resN.resultatToutesClassesDeGestion,
                ecart: ecartControle,
                coherent: Math.abs(ecartControle) < 0.01,
            },
        };
    }
    fluxDuPoste(poste, lignes, virements = virements_mise_en_service_1.AUCUN_VIREMENT, reevaluations = virements_mise_en_service_1.AUCUN_VIREMENT, incorporations = virements_mise_en_service_1.AUCUN_VIREMENT) {
        const comptes = [];
        for (const l of lignes) {
            const enFlux = (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesFlux, poste.exclusionsFlux);
            const retranche = (poste.creditsARetrancher ?? []).some((r) => (0, etats_financiers_communs_1.correspond)(l.numero, r.comptes, r.exclusions));
            const viree = poste.misesEnServiceARetrancher && !retranche ? (virements.get(l.compteId)?.credit ?? 0) : 0;
            if (!enFlux && !retranche && !viree)
                continue;
            let montant = 0;
            if (enFlux) {
                switch (poste.lectureFlux) {
                    case 'NET_PRODUIT':
                        montant = l.mouvementCredit - l.mouvementDebit;
                        break;
                    case 'NET_CHARGE':
                        montant = l.mouvementDebit - l.mouvementCredit;
                        break;
                    case 'DEBIT_SEUL':
                        montant = l.mouvementDebit;
                        break;
                    case 'CREDIT_SEUL':
                        montant = l.mouvementCredit;
                        break;
                }
            }
            if (retranche)
                montant -= l.mouvementCredit;
            montant -= viree;
            if (enFlux && poste.reevaluationARetrancher && poste.lectureFlux === 'DEBIT_SEUL') {
                montant -= reevaluations.get(l.compteId)?.debit ?? 0;
            }
            if (enFlux && poste.coutsEmpruntARetrancher && poste.lectureFlux === 'DEBIT_SEUL') {
                montant -= incorporations.get(l.compteId)?.debit ?? 0;
            }
            if (Math.abs(montant) > 0.005)
                comptes.push({ numero: l.numero, intitule: l.intitule, montant });
        }
        return comptes;
    }
    contrepartieDuPoste(poste, lignes) {
        if (!poste.comptesContrepartie)
            return 0;
        const soldes = lignes
            .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesContrepartie, poste.exclusionsContrepartie))
            .reduce((s, l) => s + l.solde, 0);
        return poste.sens === 'ENCAISSEMENT' ? soldes : -soldes;
    }
    calculerPosteFlux(poste, lignesN, lignesN1, virementsN = virements_mise_en_service_1.AUCUN_VIREMENT, reevaluationsN = virements_mise_en_service_1.AUCUN_VIREMENT, incorporationsN = virements_mise_en_service_1.AUCUN_VIREMENT) {
        const comptes = this.fluxDuPoste(poste, lignesN, virementsN, reevaluationsN, incorporationsN);
        const flux = comptes.reduce((s, c) => s + c.montant, 0);
        const contrepartieN = this.contrepartieDuPoste(poste, lignesN);
        const contrepartieN1 = this.contrepartieDuPoste(poste, lignesN1);
        const variationContrepartie = contrepartieN1 - contrepartieN;
        const encaisse = flux + variationContrepartie;
        return {
            ref: poste.ref,
            libelle: poste.libelle,
            montant: (poste.sens === 'ENCAISSEMENT' ? encaisse : -encaisse) || 0,
            flux,
            variationContrepartie,
            comptes,
        };
    }
    tresorerieNette(lignes) {
        const { parRef } = this.resoudreTousLesPostesBilan(lignes);
        return (parRef.get('BX')?.montant ?? 0) - (parRef.get('DX')?.montant ?? 0);
    }
    resoudreFluxPourExercice(lignesCourant, lignesAnterieur, virementsCourant = virements_mise_en_service_1.AUCUN_VIREMENT, reevaluationsCourant = virements_mise_en_service_1.AUCUN_VIREMENT, incorporationsCourant = virements_mise_en_service_1.AUCUN_VIREMENT, motifOuvertureIncertaine = null, motifALever = true) {
        const parRef = new Map();
        const nonCalcules = new Set();
        const postesNonCalculables = [];
        const laisserVide = (ref, libelle) => {
            parRef.set(ref, { ref, libelle, montant: 0, comptes: [] });
            nonCalcules.add(ref);
            postesNonCalculables.push({ ref, raison: motifOuvertureIncertaine, aLever: motifALever });
        };
        const libelleZA = 'Trésorerie nette au 1er janvier (Trésorerie actif N-1 – Trésorerie passif N-1)';
        const tresorerieOuverture = motifOuvertureIncertaine ? 0 : this.tresorerieNette(lignesAnterieur);
        if (motifOuvertureIncertaine) {
            laisserVide('ZA', libelleZA);
        }
        else {
            parRef.set('ZA', { ref: 'ZA', libelle: libelleZA, montant: tresorerieOuverture, comptes: [] });
        }
        for (const poste of correspondance_tft_1.TOUS_LES_POSTES_FLUX) {
            if (motifOuvertureIncertaine) {
                laisserVide(poste.ref, poste.libelle);
                continue;
            }
            parRef.set(poste.ref, this.calculerPosteFlux(poste, lignesCourant, lignesAnterieur, virementsCourant, reevaluationsCourant, incorporationsCourant));
        }
        for (const total of correspondance_tft_1.TOTAUX_FLUX) {
            parRef.set(total.ref, {
                ref: total.ref,
                libelle: total.libelle,
                montant: total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0),
                comptes: [],
            });
            if (total.deRefs.some((ref) => nonCalcules.has(ref)))
                nonCalcules.add(total.ref);
        }
        const variation = parRef.get('ZF').montant;
        const tresorerieClotureParFlux = tresorerieOuverture + variation;
        const tresorerieClotureParBilan = this.tresorerieNette(lignesCourant);
        const ecart = tresorerieClotureParFlux - tresorerieClotureParBilan;
        parRef.set('ZG', {
            ref: 'ZG',
            libelle: 'Trésorerie nette au 31 Décembre (G+A)',
            montant: tresorerieClotureParFlux,
            comptes: [],
        });
        if (nonCalcules.has('ZA') || nonCalcules.has('ZF'))
            nonCalcules.add('ZG');
        return { parRef, tresorerieOuverture, tresorerieClotureParFlux, tresorerieClotureParBilan, ecart, nonCalcules, postesNonCalculables };
    }
    async tableauFluxTresorerie(tenantId, exerciceId) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const exerciceN2Id = exerciceN1Id ? await this.trouverExerciceN1(tenantId, exerciceN1Id) : null;
        const [lignesN, lignesN1, lignesN2, virementsN, virementsN1, reevaluationsN, reevaluationsN1, incorporationsN, incorporationsN1] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceN1Id),
            this.chargerLignes(tenantId, exerciceN2Id),
            this.ecritureService.virementsDeMiseEnService(tenantId, exerciceId),
            this.ecritureService.virementsDeMiseEnService(tenantId, exerciceN1Id),
            this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceId),
            this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceN1Id),
            this.ecritureService.mouvementsDeCoutsEmpruntIncorpores(tenantId, exerciceId),
            this.ecritureService.mouvementsDeCoutsEmpruntIncorpores(tenantId, exerciceN1Id),
        ]);
        const n1Tenu = (0, etats_financiers_communs_1.exercicePrecedentTenu)(exerciceN1Id, lignesN1);
        const n2Tenu = (0, etats_financiers_communs_1.exercicePrecedentTenu)(exerciceN2Id, lignesN2);
        const [ouvertureN, ouvertureN1, brouillardN1, closN1NonTenu] = await Promise.all([
            n1Tenu ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId),
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
        const resN = this.resoudreFluxPourExercice(lignesN, n1Tenu ? lignesN1 : ouvertureN, virementsN, reevaluationsN, incorporationsN, ouverturePasseeN ? (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(ouverturePasseeN, 'SYCEBNL', precedentN) : null);
        const motifN1 = exerciceN1Id && !n1Tenu
            ? (0, etats_financiers_communs_1.motifColonneN1NonTenue)('SYCEBNL', brouillardN1, closN1NonTenu)
            : ouverturePasseeN1
                ? (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(ouverturePasseeN1, 'SYCEBNL', precedentN1)
                : null;
        const resN1 = exerciceN1Id
            ? this.resoudreFluxPourExercice(lignesN1, n2Tenu ? lignesN2 : ouvertureN1, virementsN1, reevaluationsN1, incorporationsN1, motifN1, !(exerciceN1Id && !n1Tenu && closN1NonTenu))
            : null;
        const REFS_TOTAUX = new Set(['ZA', 'ZB', 'ZC', 'ZD', 'ZE', 'ZF', 'ZG', '']);
        const lignesAffichees = correspondance_tft_1.ORDRE_AFFICHAGE_FLUX.map((entree) => {
            if ('section' in entree)
                return { section: entree.section };
            const p = resN.parRef.get(entree.ref);
            const total = correspondance_tft_1.TOTAUX_FLUX.find((t) => t.ref === entree.ref);
            return {
                ...p,
                montantN1: resN1 && !resN1.nonCalcules.has(entree.ref) ? resN1.parRef.get(entree.ref)?.montant : undefined,
                estTotal: REFS_TOTAUX.has(entree.ref),
                repere: total?.repere,
            };
        });
        const ventiles = new Set();
        for (const poste of correspondance_tft_1.TOUS_LES_POSTES_FLUX) {
            for (const l of lignesN) {
                if ((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesFlux, poste.exclusionsFlux) ||
                    (poste.comptesContrepartie && (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesContrepartie, poste.exclusionsContrepartie)) ||
                    (poste.creditsARetrancher ?? []).some((r) => (0, etats_financiers_communs_1.correspond)(l.numero, r.comptes, r.exclusions))) {
                    ventiles.add(l.compteId);
                }
            }
        }
        const mouvemente = (l) => Math.abs(l.mouvementDebit) > 0.005 || Math.abs(l.mouvementCredit) > 0.005;
        const interne = (l) => correspondance_tft_1.COMPTES_A_CONTREPARTIE_INTERNE.find((c) => l.numero.startsWith(c.numero));
        const comptesNonVentiles = lignesN
            .filter((l) => !ventiles.has(l.compteId))
            .filter((l) => !l.numero.startsWith('5') && !l.numero.startsWith('3'))
            .filter((l) => !interne(l))
            .filter((l) => !correspondance_tft_1.COMPTES_SANS_TRESORERIE.some((c) => l.numero.startsWith(c.numero)))
            .filter(mouvemente)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
        if (Math.abs(resN.ecart) >= 0.01 && !ouverturePasseeN) {
            const dotationMouvementee = lignesN.some((l) => (0, etats_financiers_communs_1.correspond)(l.numero, ['10'], ['106', '1049']) && mouvemente(l));
            for (const l of lignesN) {
                const c = interne(l);
                if (!c)
                    continue;
                const suspect = c.lecture === 'CREDIT' ? l.mouvementCredit > 0.005 : dotationMouvementee && mouvemente(l);
                if (suspect)
                    comptesNonVentiles.push({ numero: l.numero, intitule: l.intitule, montant: l.solde });
            }
        }
        return {
            lignes: lignesAffichees,
            exerciceN1Disponible: exerciceN1Id !== null,
            comptesNonVentiles,
            mentionOuverture: (0, etats_financiers_communs_1.avecNegatifsTardifs)(n1Tenu
                ? null
                : exerciceN1Id && !ouverturePasseeN
                    ? (0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYCEBNL', (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN), brouillardN1, closN1NonTenu)
                    : ouverturePasseeN
                        ? (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(ouverturePasseeN, 'SYCEBNL', precedentN)
                        : (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN)
                            ? (0, etats_financiers_communs_1.mentionComparatifSurOuverture)('SYCEBNL')
                            : (0, etats_financiers_communs_1.mentionOuverturePresumeeNulle)('SYCEBNL'), negatifsTardifsN, 'SYCEBNL'),
            postesVides: [...resN.nonCalcules],
            postesNonCalculables: resN.postesNonCalculables,
            postesNonCalculablesN1: resN1?.postesNonCalculables ?? [],
            controle: (0, etats_financiers_communs_1.controleDuTableauDesFlux)({
                ouverture: { ref: 'ZA', montant: resN.tresorerieOuverture },
                variation: { ref: 'ZF', montant: resN.parRef.get('ZF').montant },
                clotureParFlux: { ref: 'ZG', montant: resN.tresorerieClotureParFlux },
                clotureParBilan: resN.tresorerieClotureParBilan,
                vides: resN.nonCalcules,
            }),
        };
    }
};
exports.EtatsFinanciersService = EtatsFinanciersService;
exports.EtatsFinanciersService = EtatsFinanciersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService,
        exercice_service_1.ExerciceService])
], EtatsFinanciersService);
//# sourceMappingURL=etats-financiers.service.js.map