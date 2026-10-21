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
exports.EtatsFinanciersProjetService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const exercice_service_1 = require("../exercice/exercice.service");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const resultat_de_l_exercice_1 = require("./resultat-de-l-exercice");
const dettes_rattachees_1 = require("./dettes-rattachees");
const correspondance_projet_compte_exploitation_1 = require("./correspondance-projet-compte-exploitation");
const correspondance_projet_emplois_ressources_1 = require("./correspondance-projet-emplois-ressources");
const correspondance_projet_bilan_1 = require("./correspondance-projet-bilan");
const cleDeDeduction = (d) => `${d.comptes.join('|')}::${(d.exclusions ?? []).join('|')}`;
let EtatsFinanciersProjetService = class EtatsFinanciersProjetService {
    constructor(ecritureService, exerciceService, prisma) {
        this.ecritureService = ecritureService;
        this.exerciceService = exerciceService;
        this.prisma = prisma;
    }
    async trouverExerciceN1(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.trouverExerciceN1)(this.exerciceService, tenantId, exerciceId);
    }
    async chargerLignes(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId);
    }
    calculerPosteActif(poste, lignes) {
        let matches = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.sens_qualificatif === 'DEBITEUR') {
            matches = matches.filter((l) => l.solde > 0);
        }
        if (poste.comptesTransferesSiCrediteur) {
            matches = matches.filter((l) => !((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesTransferesSiCrediteur) && l.solde < 0));
        }
        const comptes = matches.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
        return { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
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
        const posteDW = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DW');
        const base = this.calculerPostePassif(posteDW, lignes);
        const decouverts = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_projet_bilan_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR) && l.solde < 0);
        const comptes = [...base.comptes, ...decouverts.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }))];
        return { ref: 'DW', libelle: posteDW.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
    }
    calculerCC(lignes) {
        const { lignes678, resultatClasses678, lignes13, resultatCompte13 } = this.sourcesDuResultat(lignes);
        const montant = (0, resultat_de_l_exercice_1.resultatAuBilan)(resultatClasses678, resultatCompte13);
        const comptes = [...lignes13, ...lignes678]
            .filter((l) => Math.abs(l.solde) > 0.005)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
        return { ref: 'CC', libelle: "Solde des opérations de l'exercice", montant, comptes };
    }
    sourcesDuResultat(lignes) {
        const lignes678 = lignes.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_6 || l.classe === client_1.ClasseCompte.CLASSE_7 || l.classe === client_1.ClasseCompte.CLASSE_8);
        const lignes13 = lignes.filter((l) => (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero));
        return {
            lignes678,
            resultatClasses678: lignes678.reduce((s, l) => s - l.solde, 0),
            lignes13,
            resultatCompte13: lignes13.reduce((s, l) => s - l.solde, 0),
        };
    }
    resoudreTousLesPostesBilan(lignes) {
        const parRef = new Map();
        for (const poste of correspondance_projet_bilan_1.POSTES_ACTIF) {
            parRef.set(poste.ref, this.calculerPosteActif(poste, lignes));
        }
        for (const poste of correspondance_projet_bilan_1.POSTES_PASSIF) {
            if (poste.ref === 'DW')
                continue;
            parRef.set(poste.ref, this.calculerPostePassif(poste, lignes));
        }
        parRef.set('DW', this.calculerDW(lignes));
        parRef.set('CC', this.calculerCC(lignes));
        for (const total of correspondance_projet_bilan_1.TOTAUX_ACTIF) {
            const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
            parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, comptes: [] });
        }
        for (const total of correspondance_projet_bilan_1.TOTAUX_PASSIF) {
            const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
            parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, comptes: [] });
        }
        return parRef;
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
        const parRefN = this.resoudreTousLesPostesBilan(lignesN);
        const parRefN1 = this.resoudreTousLesPostesBilan(comparatif.lignes);
        const refsTotaux = new Set([...correspondance_projet_bilan_1.TOTAUX_ACTIF, ...correspondance_projet_bilan_1.TOTAUX_PASSIF].map((t) => t.ref));
        const fusionnerN1 = (ref) => {
            const n = parRefN.get(ref);
            const n1 = comparatif.provenance ? parRefN1.get(ref) : undefined;
            return { ...n, estTotal: refsTotaux.has(ref), montantN1: n1?.montant };
        };
        const actif = correspondance_projet_bilan_1.ORDRE_AFFICHAGE_ACTIF.map(fusionnerN1);
        const passif = correspondance_projet_bilan_1.ORDRE_AFFICHAGE_PASSIF.map(fusionnerN1);
        const comptesRattaches = new Set();
        for (const poste of [...correspondance_projet_bilan_1.POSTES_ACTIF, ...correspondance_projet_bilan_1.POSTES_PASSIF]) {
            for (const l of lignesN) {
                if ((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions)) {
                    comptesRattaches.add(l.compteId);
                }
            }
        }
        for (const l of lignesN) {
            if ((0, etats_financiers_communs_1.correspond)(l.numero, correspondance_projet_bilan_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR) || (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero)) {
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
        const sources = this.sourcesDuResultat(lignesN);
        const parts = (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(sources.resultatClasses678, sources.resultatCompte13, sources.lignes678, sources.lignes13);
        const sourcesN1 = this.sourcesDuResultat(comparatif.lignes);
        const partsN1 = (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(sourcesN1.resultatClasses678, sourcesN1.resultatCompte13, sourcesN1.lignes678, sourcesN1.lignes13);
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
                resultatClasses678: sources.resultatClasses678,
                resultatCompte13: sources.resultatCompte13,
                resultatAnterieurNonAffecte: parts.resultatAnterieurNonAffecte,
            },
            resultatAnterieurNonVire: (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(clos, parts.resultatAnterieurNonAffecte, 'CC', 'SYCEBNL'),
            resultatAnterieurNonVireN1: (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)(comparatif.provenance, closN1, partsN1.resultatAnterieurNonAffecte, 'CC', 'SYCEBNL'),
        };
    }
    resoudreTousLesPostesCE(lignes) {
        const comptesParCle = new Map();
        const comptesNonRattaches = [];
        for (const l of lignes) {
            const poste = (0, correspondance_projet_compte_exploitation_1.posteDuCompte)(l.numero);
            if (!poste) {
                const estCompteDeGestion = l.classe === client_1.ClasseCompte.CLASSE_6 || l.classe === client_1.ClasseCompte.CLASSE_7 || l.classe === client_1.ClasseCompte.CLASSE_8;
                if (estCompteDeGestion) {
                    comptesNonRattaches.push({ numero: l.numero, intitule: l.intitule, montant: l.totalCredit - l.totalDebit });
                }
                continue;
            }
            const montant = poste.sens === 'PRODUIT' ? l.totalCredit - l.totalDebit : l.totalDebit - l.totalCredit;
            const existants = comptesParCle.get(poste.cle) ?? [];
            existants.push({ numero: l.numero, intitule: l.intitule, montant });
            comptesParCle.set(poste.cle, existants);
        }
        const calculer = (poste) => {
            const comptes = comptesParCle.get(poste.cle) ?? [];
            return { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
        };
        return {
            revenus: correspondance_projet_compte_exploitation_1.POSTES_REVENUS.map(calculer),
            charges: correspondance_projet_compte_exploitation_1.POSTES_CHARGES.map(calculer),
            comptesNonRattaches,
        };
    }
    async compteExploitation(tenantId, exerciceId) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const [lignesN, lignesN1, ouvertureN] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceN1Id),
            exerciceN1Id ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId),
        ]);
        const resN = this.resoudreTousLesPostesCE(lignesN);
        const resN1 = this.resoudreTousLesPostesCE(lignesN1);
        const fusionnerN1 = (n, n1) => ({
            ...n,
            montantN1: exerciceN1Id ? n1.montant : undefined,
        });
        const revenus = resN.revenus.map((p, i) => fusionnerN1(p, resN1.revenus[i]));
        const charges = resN.charges.map((p, i) => fusionnerN1(p, resN1.charges[i]));
        const signeDansXB = (i) => (correspondance_projet_compte_exploitation_1.POSTES_CHARGES[i].sens === 'PRODUIT' ? -1 : 1);
        const totalRevenus = revenus.reduce((s, p) => s + p.montant, 0);
        const totalCharges = charges.reduce((s, p, i) => s + signeDansXB(i) * p.montant, 0);
        const solde = totalRevenus - totalCharges;
        const totalRevenusN1 = exerciceN1Id ? revenus.reduce((s, p) => s + (p.montantN1 ?? 0), 0) : undefined;
        const totalChargesN1 = exerciceN1Id
            ? charges.reduce((s, p, i) => s + signeDansXB(i) * (p.montantN1 ?? 0), 0)
            : undefined;
        const soldeN1 = totalRevenusN1 !== undefined && totalChargesN1 !== undefined ? totalRevenusN1 - totalChargesN1 : undefined;
        return {
            revenus,
            totalRevenus,
            totalRevenusN1,
            charges,
            totalCharges,
            totalChargesN1,
            solde,
            soldeN1,
            exerciceN1Disponible: exerciceN1Id !== null,
            motifComparatifAbsent: !exerciceN1Id && (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN) ? etats_financiers_communs_1.MOTIF_RESULTAT_N1_NON_TENU : null,
            comptesNonRattaches: resN.comptesNonRattaches,
            controle: {
                boucleAZero: Math.abs(solde) < 0.01,
            },
        };
    }
    async noteBailleur(tenantId, exerciceId) {
        const PREFIXES_INVESTISSEMENT = ['162', '163', '164'];
        const PREFIXES_ADMINISTRATION = ['462', '463', '464'];
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, OR: [{ numero: { startsWith: '16' } }, { numero: { startsWith: '46' } }] },
            include: { bailleur: true },
        });
        const comptesInvestissement = comptes.filter((c) => PREFIXES_INVESTISSEMENT.some((p) => c.numero.startsWith(p)));
        const comptesAdministration = comptes.filter((c) => PREFIXES_ADMINISTRATION.some((p) => c.numero.startsWith(p)));
        const cumul = await this.ecritureService.balanceCumulee(tenantId, exerciceId);
        const cumulParCompte = new Map(cumul.lignes.map((l) => [l.compteId, l]));
        const mouvements = (comptesGroupe) => {
            const parCompte = new Map(comptesGroupe.map((c) => [c.id, { decaisse: 0, consomme: 0, soldeRestant: 0 }]));
            for (const c of comptesGroupe) {
                const l = cumulParCompte.get(c.id);
                if (!l)
                    continue;
                const acc = parCompte.get(c.id);
                acc.decaisse += l.totalCredit;
                acc.consomme += l.totalDebit;
            }
            for (const c of comptesGroupe) {
                const acc = parCompte.get(c.id);
                acc.soldeRestant = acc.decaisse - acc.consomme;
            }
            return parCompte;
        };
        const agregerParBailleur = (comptesGroupe) => {
            const parCompte = mouvements(comptesGroupe);
            const parBailleur = new Map();
            const nonAffecte = { decaisse: 0, consomme: 0, soldeRestant: 0 };
            for (const c of comptesGroupe) {
                const m = parCompte.get(c.id);
                if (!c.bailleur) {
                    nonAffecte.decaisse += m.decaisse;
                    nonAffecte.consomme += m.consomme;
                    nonAffecte.soldeRestant += m.soldeRestant;
                    continue;
                }
                const existant = parBailleur.get(c.bailleur.id) ?? {
                    bailleur: { id: c.bailleur.id, code: c.bailleur.code, nom: c.bailleur.nom },
                    decaisse: 0,
                    consomme: 0,
                    soldeRestant: 0,
                };
                existant.decaisse += m.decaisse;
                existant.consomme += m.consomme;
                existant.soldeRestant += m.soldeRestant;
                parBailleur.set(c.bailleur.id, existant);
            }
            return { parBailleur: [...parBailleur.values()].sort((a, b) => a.bailleur.code.localeCompare(b.bailleur.code)), nonAffecte };
        };
        const investissement = agregerParBailleur(comptesInvestissement);
        const administration = agregerParBailleur(comptesAdministration);
        const totalInvestissement = investissement.parBailleur.reduce((s, b) => ({
            decaisse: s.decaisse + b.decaisse,
            consomme: s.consomme + b.consomme,
            soldeRestant: s.soldeRestant + b.soldeRestant,
        }), { decaisse: 0, consomme: 0, soldeRestant: 0 });
        const totalAdministration = administration.parBailleur.reduce((s, b) => ({
            decaisse: s.decaisse + b.decaisse,
            consomme: s.consomme + b.consomme,
            soldeRestant: s.soldeRestant + b.soldeRestant,
        }), { decaisse: 0, consomme: 0, soldeRestant: 0 });
        return {
            investissement: investissement.parBailleur,
            investissementNonAffecte: investissement.nonAffecte,
            totalInvestissement,
            administration: administration.parBailleur,
            administrationNonAffecte: administration.nonAffecte,
            totalAdministration,
            totalFondsDuBailleur: {
                decaisse: totalInvestissement.decaisse + totalAdministration.decaisse,
                consomme: totalInvestissement.consomme + totalAdministration.consomme,
                soldeRestant: totalInvestissement.soldeRestant + totalAdministration.soldeRestant,
            },
        };
    }
    soldeCrediteur(lignes, comptes, exclusions, moment) {
        return lignes
            .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, comptes, exclusions))
            .reduce((s, l) => {
            const solde = moment === 'CLOTURE' ? l.solde : l.reportDebit - l.reportCredit;
            return s + (solde < 0 ? -solde : 0);
        }, 0);
    }
    brutEmploi(poste, lignes) {
        const matches = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.lectureSolde === 'DEBITEUR_CLOTURE') {
            const comptes = matches
                .filter((l) => l.solde > 0)
                .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
            return { montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
        }
        const comptes = matches
            .filter((l) => l.mouvementDebit > 0.005)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.mouvementDebit }));
        return { montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
    }
    variationDettes(lignes, comptes, exclusions) {
        return (this.soldeCrediteur(lignes, comptes, exclusions, 'OUVERTURE') -
            this.soldeCrediteur(lignes, comptes, exclusions, 'CLOTURE'));
    }
    async tableauEmploisRessources(tenantId, exerciceId) {
        const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
        const dettesRattachees = await this.dettesRattacheesDesColonnes(tenantId, exerciceId, exerciceN1Id);
        const [lignes, lignesCumulFin, lignesCumulDebut, bailleurs, comptesBailleur, comptesEtat] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            (0, etats_financiers_communs_1.chargerLignesCumulees)(this.ecritureService, tenantId, exerciceId),
            (0, etats_financiers_communs_1.chargerLignesCumulees)(this.ecritureService, tenantId, exerciceN1Id),
            this.prisma.bailleur.findMany({ where: { tenantId }, orderBy: { nom: 'asc' } }),
            this.prisma.compte.findMany({ where: { tenantId, bailleurId: { not: null } }, select: { id: true, bailleurId: true } }),
            this.prisma.compte.findMany({ where: { tenantId, porteFondsContrepartieEtat: true }, select: { id: true } }),
        ]);
        const compteIdsParBailleur = new Map();
        for (const c of comptesBailleur) {
            const ids = compteIdsParBailleur.get(c.bailleurId) ?? new Set();
            ids.add(c.id);
            compteIdsParBailleur.set(c.bailleurId, ids);
        }
        const tresorerieBailleur = new Set(comptesBailleur.map((c) => c.id));
        const tresorerieEtat = new Set(comptesEtat.map((c) => c.id));
        const colonne = (jeu, dettes) => this.construireColonne(jeu, bailleurs, compteIdsParBailleur, tresorerieBailleur, tresorerieEtat, dettes);
        const exercice = colonne(lignes, dettesRattachees.exercice);
        const cumulFin = colonne(lignesCumulFin, dettesRattachees.cumulFin);
        const cumulDebut = colonne(lignesCumulDebut, dettesRattachees.cumulDebut);
        const rendu = exercice.affichage.map((p) => ({
            ...p,
            montantCumulDebut: cumulDebut.parCle.get(p.cle)?.montant ?? 0,
            montantCumulFin: cumulFin.parCle.get(p.cle)?.montant ?? 0,
        }));
        for (const p of cumulFin.affichage) {
            if (rendu.some((r) => r.cle === p.cle))
                continue;
            const ligne = {
                ...p,
                montant: 0,
                comptes: [],
                montantCumulDebut: cumulDebut.parCle.get(p.cle)?.montant ?? 0,
                montantCumulFin: p.montant,
            };
            if (p.cle.startsWith('BAILLEUR:')) {
                let dernier = -1;
                rendu.forEach((r, i) => {
                    if (r.cle.startsWith('BAILLEUR:'))
                        dernier = i;
                });
                rendu.splice(dernier + 1, 0, ligne);
            }
            else {
                rendu.push(ligne);
            }
        }
        return {
            lignes: rendu,
            totalRessources: exercice.parRef.get('GR').montant,
            totalEmplois: exercice.parRef.get('GU').montant,
            excedent: exercice.excedent,
            encaisseDisponible: exercice.encaisse,
            fondsFinExercice: exercice.fondsFin,
            controle: {
                ecart: exercice.encaisse - exercice.fondsFin,
                boucle: Math.abs(exercice.encaisse - exercice.fondsFin) < 0.01,
                cumulDebut: {
                    ecart: cumulDebut.encaisse - cumulDebut.fondsFin,
                    boucle: Math.abs(cumulDebut.encaisse - cumulDebut.fondsFin) < 0.01,
                },
                cumulFin: {
                    ecart: cumulFin.encaisse - cumulFin.fondsFin,
                    boucle: Math.abs(cumulFin.encaisse - cumulFin.fondsFin) < 0.01,
                },
            },
            anomalies: exercice.anomalies,
            avertissements: exercice.avertissements,
            periodes: {
                exercice: exerciceId,
                cumulDebutJusquA: exerciceN1Id,
            },
        };
    }
    async dettesRattacheesDesColonnes(tenantId, exerciceId, exerciceN1Id) {
        const exercices = await this.exerciceService.lister(tenantId);
        const courant = exercices.find((e) => e.id === exerciceId);
        const precedent = exerciceN1Id ? exercices.find((e) => e.id === exerciceN1Id) ?? null : null;
        const partagees = new Map();
        for (const p of [...correspondance_projet_emplois_ressources_1.POSTES_IMMOBILISATIONS, ...correspondance_projet_emplois_ressources_1.POSTES_CHARGES]) {
            for (const d of p.deductions ?? []) {
                if (d.operation !== 'AJOUTER_VARIATION')
                    continue;
                const cle = cleDeDeduction(d);
                const e = partagees.get(cle) ?? { comptes: d.comptes, exclusions: d.exclusions, postes: [] };
                e.postes.push(p);
                partagees.set(cle, e);
            }
        }
        const rendu = { exercice: new Map(), cumulFin: new Map(), cumulDebut: new Map() };
        for (const [cle, d] of partagees) {
            if (d.postes.length < 2)
                continue;
            const postes = d.postes.map((p) => ({ ref: p.ref, comptes: p.comptes, exclusions: p.exclusions }));
            const comptes = { comptes: d.comptes, exclusions: d.exclusions };
            const [ouverture, cloture, clotureN1] = await Promise.all([
                (0, dettes_rattachees_1.dettesALOuverture)(this.prisma, tenantId, exerciceId, comptes),
                (0, dettes_rattachees_1.dettesALaCloture)(this.prisma, tenantId, courant, comptes),
                precedent ? (0, dettes_rattachees_1.dettesALaCloture)(this.prisma, tenantId, precedent, comptes) : Promise.resolve(null),
            ]);
            const [debutN, finN, finN1] = await Promise.all([
                (0, dettes_rattachees_1.dettesParPoste)(this.prisma, tenantId, ouverture, postes),
                (0, dettes_rattachees_1.dettesParPoste)(this.prisma, tenantId, cloture, postes),
                clotureN1 ? (0, dettes_rattachees_1.dettesParPoste)(this.prisma, tenantId, clotureN1, postes) : Promise.resolve(undefined),
            ]);
            rendu.exercice.set(cle, { debut: debutN, fin: finN });
            rendu.cumulFin.set(cle, { fin: finN });
            rendu.cumulDebut.set(cle, { fin: finN1 });
        }
        return rendu;
    }
    construireColonne(lignes, bailleurs, compteIdsParBailleur, tresorerieBailleur, tresorerieEtat = new Set(), dettesRattachees = new Map()) {
        const parRef = new Map();
        const parCle = new Map();
        const posteFA = correspondance_projet_emplois_ressources_1.POSTES_RESSOURCES.find((p) => p.ref === 'FA');
        const lignesFonds = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, posteFA.comptes));
        const lignesBailleurs = [];
        const rattaches = new Set();
        for (const b of bailleurs) {
            const ids = compteIdsParBailleur.get(b.id);
            if (!ids || ids.size === 0)
                continue;
            const comptes = lignesFonds
                .filter((l) => ids.has(l.compteId))
                .map((l) => {
                rattaches.add(l.compteId);
                return { numero: l.numero, intitule: l.intitule, montant: l.mouvementCredit };
            })
                .filter((c) => c.montant > 0.005);
            lignesBailleurs.push({
                cle: `BAILLEUR:${b.id}`,
                ref: lignesBailleurs.length === 0 ? 'FA' : 'FB',
                libelle: `Fonds reçus, Bailleur ${b.nom}`,
                montant: comptes.reduce((s, c) => s + c.montant, 0),
                comptes,
            });
        }
        const nonRattaches = lignesFonds
            .filter((l) => !rattaches.has(l.compteId) && l.mouvementCredit > 0.005)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.mouvementCredit }));
        if (nonRattaches.length > 0 || lignesBailleurs.length === 0) {
            lignesBailleurs.push({
                cle: 'BAILLEUR:NON_RATTACHE',
                ref: lignesBailleurs.length === 0 ? 'FA' : 'FB',
                libelle: bailleurs.length > 0 && lignesBailleurs.length > 0
                    ? 'Fonds reçus, Bailleurs (comptes non rattachés à un bailleur)'
                    : 'Fonds reçus, Bailleurs',
                montant: nonRattaches.reduce((s, c) => s + c.montant, 0),
                comptes: nonRattaches,
            });
        }
        for (const p of lignesBailleurs)
            parCle.set(p.cle, p);
        for (const poste of correspondance_projet_emplois_ressources_1.POSTES_RESSOURCES.filter((p) => p.ref !== 'FA')) {
            const comptes = lignes
                .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions) && l.mouvementCredit > 0.005)
                .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.mouvementCredit }));
            const calc = { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
            parRef.set(poste.ref, calc);
        }
        const nonRattachees = [];
        const calculerEmplois = (definitions) => {
            const bruts = definitions.map((d) => ({ definition: d, ...this.brutEmploi(d, lignes) }));
            const deductionsParCle = new Map();
            for (const b of bruts) {
                for (const d of b.definition.deductions ?? []) {
                    const cle = cleDeDeduction(d);
                    const existante = deductionsParCle.get(cle) ?? { comptes: d.comptes, exclusions: d.exclusions, operation: d.operation, refs: [] };
                    existante.refs.push(b.definition.ref);
                    deductionsParCle.set(cle, existante);
                }
            }
            const deductionParRef = new Map();
            const nonRattacheeParRef = new Map();
            for (const [cle, d] of deductionsParCle) {
                const montant = d.operation === 'RETRANCHER_MOUVEMENT'
                    ?
                        -lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, d.comptes, d.exclusions)).reduce((s, l) => s + l.mouvementCredit, 0)
                    : this.variationDettes(lignes, d.comptes, d.exclusions);
                const concernes = bruts.filter((b) => d.refs.includes(b.definition.ref));
                const rattachement = d.operation === 'AJOUTER_VARIATION' && concernes.length > 1 ? dettesRattachees.get(cle) : undefined;
                const parts = new Map();
                if (rattachement) {
                    for (const b of concernes) {
                        const ref = b.definition.ref;
                        const part = (rattachement.debut?.parRef.get(ref) ?? 0) - (rattachement.fin?.parRef.get(ref) ?? 0);
                        if (Math.abs(part) > 0.005)
                            parts.set(ref, part);
                    }
                }
                const rattache = [...parts.values()].reduce((s, x) => s + x, 0);
                const reste = Math.round((montant - rattache) * 100) / 100;
                for (const [ref, part] of parts)
                    deductionParRef.set(ref, (deductionParRef.get(ref) ?? 0) + part);
                if (Math.abs(reste) < 0.005)
                    continue;
                if (rattachement)
                    nonRattachees.push({ refs: concernes.map((b) => b.definition.ref), montant: reste });
                const totalBrut = concernes.reduce((s, b) => s + b.montant, 0);
                for (const b of concernes) {
                    const part = totalBrut > 0.005 ? (b.montant / totalBrut) * reste : b === concernes[0] ? reste : 0;
                    deductionParRef.set(b.definition.ref, (deductionParRef.get(b.definition.ref) ?? 0) + part);
                    if (rattachement)
                        nonRattacheeParRef.set(b.definition.ref, (nonRattacheeParRef.get(b.definition.ref) ?? 0) + part);
                }
            }
            return bruts.map((b) => {
                const correction = deductionParRef.get(b.definition.ref) ?? 0;
                const nonRattachee = nonRattacheeParRef.get(b.definition.ref);
                return {
                    ref: b.definition.ref,
                    libelle: b.definition.libelle,
                    montant: b.montant + correction,
                    brut: b.montant,
                    correction,
                    ...(nonRattachee !== undefined && Math.abs(nonRattachee) > 0.005 ? { correctionNonRattachee: nonRattachee } : {}),
                    comptes: b.comptes,
                };
            });
        };
        const immobilisations = calculerEmplois(correspondance_projet_emplois_ressources_1.POSTES_IMMOBILISATIONS);
        const charges = calculerEmplois(correspondance_projet_emplois_ressources_1.POSTES_CHARGES);
        for (const p of [...immobilisations, ...charges])
            parRef.set(p.ref, p);
        const lignesTresorerie = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET));
        const fonds = (ref, filtre, moment) => {
            const comptes = lignesTresorerie
                .filter(filtre)
                .map((l) => ({
                numero: l.numero,
                intitule: l.intitule,
                montant: moment === 'CLOTURE' ? l.solde : l.reportDebit - l.reportCredit,
            }))
                .filter((c) => Math.abs(c.montant) > 0.005);
            const calc = {
                ref,
                libelle: correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES[ref],
                montant: comptes.reduce((s, c) => s + c.montant, 0),
                comptes,
            };
            parRef.set(ref, calc);
        };
        const estEtat = (l) => !tresorerieBailleur.has(l.compteId) && tresorerieEtat.has(l.compteId);
        const estAutre = (l) => !tresorerieBailleur.has(l.compteId) && !tresorerieEtat.has(l.compteId);
        fonds('FU', (l) => tresorerieBailleur.has(l.compteId), 'OUVERTURE');
        fonds('FV', estEtat, 'OUVERTURE');
        fonds('FW', estAutre, 'OUVERTURE');
        fonds('FX', (l) => tresorerieBailleur.has(l.compteId), 'CLOTURE');
        fonds('FY', estEtat, 'CLOTURE');
        fonds('FZ', estAutre, 'CLOTURE');
        for (const p of lignesBailleurs) {
            const existant = parRef.get(p.ref);
            parRef.set(p.ref, existant ? { ...existant, montant: existant.montant + p.montant, comptes: [...existant.comptes, ...p.comptes] } : p);
        }
        for (const total of correspondance_projet_emplois_ressources_1.TOTAUX) {
            const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
            parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, comptes: [], estTotal: true });
        }
        const gv = (parRef.get('GR')?.montant ?? 0) - (parRef.get('GU')?.montant ?? 0);
        parRef.set('GV', { ref: 'GV', libelle: correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES.GV, montant: gv, comptes: [], estTotal: true });
        const gx = gv + (parRef.get('GW')?.montant ?? 0);
        parRef.set('GX', { ref: 'GX', libelle: correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES.GX, montant: gx, comptes: [], estTotal: true });
        const gy = parRef.get('GY')?.montant ?? 0;
        parRef.set('GZ', { ref: 'GZ', libelle: correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES.GZ, montant: gx - gy, comptes: [], estTotal: true });
        const affichage = [...lignesBailleurs];
        for (const ref of correspondance_projet_emplois_ressources_1.ORDRE_AFFICHAGE) {
            if (ref === 'FA' || ref === 'FB')
                continue;
            const p = parRef.get(ref);
            if (p) {
                const avecCle = { ...p, cle: ref };
                parCle.set(ref, avecCle);
                affichage.push(avecCle);
            }
        }
        const anomalies = [...immobilisations, ...charges]
            .filter((p) => p.montant < -0.005 && p.brut > 0.005)
            .map((p) => ({
            ref: p.ref,
            libelle: p.libelle,
            brut: p.brut,
            correction: p.correction,
            montant: p.montant,
            diagnostic: `Le poste ${p.ref} ressort négatif : la correction de dettes (${p.correction.toFixed(2)}) dépasse le ` +
                `mouvement de la période (${p.brut.toFixed(2)}). Le total des emplois reste exact, mais la répartition ` +
                "entre postes ne l'est pas. Cause la plus fréquente : une dette d'immobilisation passée au compte 401 " +
                '(fournisseurs d\'exploitation) au lieu du 481 (fournisseurs d\'investissement), ou une dette ' +
                "d'exploitation passée au 481. Le guide d'application bâtit ses renvois (2) et (4) sur cette distinction.",
        }));
        const avertissements = [];
        if (bailleurs.length === 0) {
            avertissements.push("Aucun bailleur n'est enregistré dans ce dossier : les fonds reçus tiennent sur une seule ligne. Créez les bailleurs et rattachez-leur les sous-comptes 161, 162 et 462 pour obtenir une ligne par bailleur, comme la maquette le prévoit.");
        }
        if (tresorerieEtat.size === 0 && Math.abs(parRef.get('FC')?.montant ?? 0) > 0.005) {
            avertissements.push("Postes FV et FY (fonds de contrepartie État) : aucun compte de trésorerie n'est déclaré porter la contrepartie de l'État (Structure, Bailleurs de fonds). Leur montant est compris dans « Autres fonds » (FW et FZ). Les totaux GW et GY, eux, sont exacts, et c'est sur eux que porte le contrôle GZ.");
        }
        for (const n of nonRattachees) {
            avertissements.push(`Correction des dettes de ${n.refs.join(', ')} : ${n.montant.toFixed(2)} ne se rattache à aucune facture (report au solde, bilan d'ouverture, règlement non lettré, pièce sans ligne de ces postes) et reste réparti au prorata du mouvement brut, convention d'OmegaX. Le reste de la variation suit la dette de chaque poste, née de ses propres pièces.`);
        }
        avertissements.push("Colonnes cumulées : elles couvrent le dossier DEPUIS SON ORIGINE, écritures de report à-nouveau exclues et bilan d'ouverture compris. Elles suivent la convention de financement, pas l'exercice comptable · un projet financé sur trois ans se lit sur elles, et le contrôle VII (TOTAL V = TOTAL VI) est vérifié sur chacune.");
        return { parRef, parCle, affichage, excedent: gv, encaisse: gx, fondsFin: gy, anomalies, avertissements };
    }
};
exports.EtatsFinanciersProjetService = EtatsFinanciersProjetService;
exports.EtatsFinanciersProjetService = EtatsFinanciersProjetService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService,
        exercice_service_1.ExerciceService,
        prisma_service_1.PrismaService])
], EtatsFinanciersProjetService);
//# sourceMappingURL=etats-financiers-projet.service.js.map