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
exports.EtatsFinanciersSmtService = exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const exercice_service_1 = require("../exercice/exercice.service");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const reglements_de_tresorerie_1 = require("./reglements-de-tresorerie");
const dettes_rattachees_1 = require("./dettes-rattachees");
const stocks_depuis_inventaire_1 = require("./stocks-depuis-inventaire");
const resultat_de_l_exercice_1 = require("./resultat-de-l-exercice");
const correspondance_smt_1 = require("./correspondance-smt");
const ouverte_a_la_cloture_1 = require("../lettrage/ouverte-a-la-cloture");
const reste_des_lignes_ouvertes_1 = require("../lettrage/reste-des-lignes-ouvertes");
const immobilisation_en_cours_1 = require("../immobilisations/immobilisation-en-cours");
const PARTS_ECHEANCE_NULLES = { nonEchu: 0, echu: 0 };
const RACINE_TRESORERIE = '5';
const RACINE_HORS_TRESORERIE = '59';
const SELECTION_ECRITURE_DE_TRESORERIE = {
    id: true,
    date: true,
    createdAt: true,
    libelle: true,
    reference: true,
    lignes: {
        select: {
            id: true,
            compteId: true,
            debit: true,
            credit: true,
            compte: { select: { numero: true, intitule: true } },
        },
    },
};
exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL = ecriture_service_1.PLAFOND_LIGNES_GRAND_LIVRE;
let EtatsFinanciersSmtService = class EtatsFinanciersSmtService {
    constructor(ecritureService, exerciceService, prisma) {
        this.ecritureService = ecritureService;
        this.exerciceService = exerciceService;
        this.prisma = prisma;
    }
    estTresorerie(numero) {
        return numero.startsWith(RACINE_TRESORERIE) && !numero.startsWith(RACINE_HORS_TRESORERIE);
    }
    async chargerLignes(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId);
    }
    async exercice(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { dateDebut: true, dateFin: true },
        });
        if (!exercice) {
            throw new common_1.NotFoundException(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE);
        }
        return exercice;
    }
    aLOuverture(lignes) {
        return (0, etats_financiers_communs_1.lignesALOuverture)(lignes);
    }
    calculerPosteBilan(poste, lignes) {
        let matches = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.sens_qualificatif === 'DEBITEUR')
            matches = matches.filter((l) => l.solde > 0);
        if (poste.sens_qualificatif === 'CREDITEUR')
            matches = matches.filter((l) => l.solde < 0);
        if (poste.comptesSansFiltreDeSens) {
            const sansFiltre = poste.comptesSansFiltreDeSens;
            matches = [...matches, ...lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, sansFiltre) && Math.abs(l.solde) > 0.005)];
        }
        const signe = poste.sens === 'ACTIF' ? 1 : -1;
        const comptes = matches.map((l) => ({
            numero: l.numero,
            intitule: l.intitule,
            montant: signe * l.solde,
        }));
        return { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
    }
    sourcesDuResultat(lignes) {
        const lignes678 = lignes.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_6 || l.classe === client_1.ClasseCompte.CLASSE_7 || l.classe === client_1.ClasseCompte.CLASSE_8);
        const lignes13 = lignes.filter((l) => (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero));
        const resultat678 = lignes678.reduce((s, l) => s - l.solde, 0);
        const resultat13 = lignes13.reduce((s, l) => s - l.solde, 0);
        return {
            lignes678,
            resultat678,
            lignes13,
            resultat13,
            parts: (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(resultat678, resultat13, lignes678, lignes13),
        };
    }
    calculerHB(lignes) {
        const { lignes678, resultat678, lignes13, resultat13 } = this.sourcesDuResultat(lignes);
        const comptes = [...lignes13, ...lignes678]
            .filter((l) => Math.abs(l.solde) > 0.005)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
        return {
            ref: 'HB',
            libelle: "Résultat net de l'exercice (en + ou en -)",
            montant: (0, resultat_de_l_exercice_1.resultatAuBilan)(resultat678, resultat13),
            comptes,
        };
    }
    resoudreBilan(lignes) {
        const parRef = new Map();
        for (const poste of [...correspondance_smt_1.POSTES_BILAN_ACTIF, ...correspondance_smt_1.POSTES_BILAN_PASSIF]) {
            parRef.set(poste.ref, this.calculerPosteBilan(poste, lignes));
        }
        parRef.set('HB', this.calculerHB(lignes));
        for (const total of [...correspondance_smt_1.TOTAUX_BILAN_ACTIF, ...correspondance_smt_1.TOTAUX_BILAN_PASSIF]) {
            const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
            parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, comptes: [], estTotal: true });
        }
        return parRef;
    }
    async bilan(tenantId, exerciceId) {
        const exerciceN1Id = await (0, etats_financiers_communs_1.trouverExerciceN1)(this.exerciceService, tenantId, exerciceId);
        const [lignesN, lignesN1, clos, closN1, ouvertureN] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceN1Id),
            (0, etats_financiers_communs_1.exerciceCloture)(this.exerciceService, tenantId, exerciceId),
            (0, etats_financiers_communs_1.exercicePrecedentCloture)(this.exerciceService, tenantId, exerciceN1Id),
            exerciceN1Id ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId),
        ]);
        const ouverturePassee = await (0, etats_financiers_communs_1.lireOuverturePasseeEnOd)(this.ecritureService, tenantId, exerciceId, exerciceN1Id, ouvertureN);
        const comparatif = (0, etats_financiers_communs_1.comparatifDuBilan)(exerciceN1Id, lignesN1, ouvertureN, ouverturePassee, 'SYCEBNL');
        const parRefN = this.resoudreBilan(lignesN);
        const parRefN1 = this.resoudreBilan(comparatif.lignes);
        const fusionner = (ref) => {
            const n = parRefN.get(ref);
            const note = [...correspondance_smt_1.POSTES_BILAN_ACTIF, ...correspondance_smt_1.POSTES_BILAN_PASSIF].find((p) => p.ref === ref)?.note ?? null;
            return { ...n, montantN1: comparatif.provenance ? parRefN1.get(ref)?.montant : undefined, note };
        };
        const totalActif = parRefN.get('GZ').montant;
        const totalPassif = parRefN.get('HZ').montant;
        const { resultat678, resultat13, parts } = this.sourcesDuResultat(lignesN);
        const { parts: partsN1 } = this.sourcesDuResultat(comparatif.lignes);
        const compte13LuHorsDuResultat = lignesN
            .filter((l) => l.numero.startsWith('13') && !(0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero))
            .reduce((s, l) => s - l.solde, 0);
        return {
            actif: correspondance_smt_1.ORDRE_BILAN_ACTIF.map(fusionner),
            passif: correspondance_smt_1.ORDRE_BILAN_PASSIF.map(fusionner),
            totalActif,
            totalPassif,
            totalActifN1: comparatif.provenance ? parRefN1.get('GZ').montant : undefined,
            totalPassifN1: comparatif.provenance ? parRefN1.get('HZ').montant : undefined,
            exerciceN1Disponible: exerciceN1Id !== null,
            comparatif: comparatif.provenance,
            mentionComparatif: comparatif.mention,
            equilibre: Math.abs(totalActif - totalPassif) < 0.01,
            renvoiImmobilisations: correspondance_smt_1.RENVOI_IMMOBILISATIONS,
            controle: {
                resultatClasses678: resultat678,
                resultatCompte13: resultat13,
                resultatAnterieurNonAffecte: parts.resultatAnterieurNonAffecte,
                compte13LuHorsDuResultat,
            },
            resultatAnterieurNonVire: (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(clos, parts.resultatAnterieurNonAffecte, 'HB', 'SYCEBNL'),
            resultatAnterieurNonVireN1: (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)(comparatif.provenance, closN1, partsN1.resultatAnterieurNonAffecte, 'HB', 'SYCEBNL'),
        };
    }
    filtreEcrituresDeTresorerie(tenantId, exerciceId) {
        return {
            tenantId,
            exerciceId,
            statut: client_1.StatutEcriture.VALIDEE,
            estGenereeParCloture: false,
            lignes: {
                some: {
                    compte: {
                        numero: { startsWith: RACINE_TRESORERIE },
                        NOT: { numero: { startsWith: RACINE_HORS_TRESORERIE } },
                    },
                },
            },
        };
    }
    async parcourirEcrituresDeTresorerie(tenantId, exerciceId, traiter) {
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
            where: this.filtreEcrituresDeTresorerie(tenantId, exerciceId),
            select: SELECTION_ECRITURE_DE_TRESORERIE,
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
        }), traiter, lecture_par_lots_1.LOT_ECRITURES);
    }
    cumulerEcritureDeTresorerie(e, cumuls) {
        const tresorerie = e.lignes.filter((l) => this.estTresorerie(l.compte.numero));
        if (tresorerie.length === 0)
            return;
        const flux = tresorerie.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
        if (Math.abs(flux) < 0.005)
            return;
        const sens = flux > 0 ? 'RECETTE' : 'DEPENSE';
        const cible = sens === 'RECETTE' ? cumuls.recettes : cumuls.depenses;
        for (const l of e.lignes) {
            if (this.estTresorerie(l.compte.numero))
                continue;
            const montant = sens === 'RECETTE' ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
            if (Math.abs(montant) <= 0.005)
                continue;
            if (sens === 'DEPENSE' && montant > 0 && (0, reglements_de_tresorerie_1.estDetteFournisseurRattachee)(l.compte.numero)) {
                cumuls.reglements.push({ ligneId: l.id, numero: l.compte.numero, montant });
            }
            const existant = cible.get(l.compte.numero);
            if (existant)
                existant.montant += montant;
            else
                cible.set(l.compte.numero, { numero: l.compte.numero, intitule: l.compte.intitule, montant });
        }
    }
    async cumulsTresorerie(tenantId, exerciceId) {
        const cumuls = { recettes: new Map(), depenses: new Map(), reglements: [] };
        await this.parcourirEcrituresDeTresorerie(tenantId, exerciceId, (e) => this.cumulerEcritureDeTresorerie(e, cumuls));
        return cumuls;
    }
    ventilerFlux(contreparties, postes) {
        const comptesParRef = new Map();
        for (const poste of postes)
            comptesParRef.set(poste.ref, new Map());
        for (const c of contreparties.values()) {
            const poste = postes.find((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions));
            if (!poste)
                continue;
            comptesParRef.get(poste.ref).set(c.numero, { numero: c.numero, intitule: c.intitule, montant: c.montant });
        }
        const resultat = postes.map((p) => {
            const comptes = [...comptesParRef.get(p.ref).values()]
                .filter((c) => Math.abs(c.montant) > 0.005)
                .sort((a, b) => a.numero.localeCompare(b.numero));
            return {
                ref: p.ref,
                libelle: p.libelle,
                note: p.note,
                montant: comptes.reduce((s, c) => s + c.montant, 0),
                comptes,
            };
        });
        return { postes: resultat, total: resultat.reduce((s, p) => s + p.montant, 0) };
    }
    fluxHorsExploitation(cumuls) {
        const parCompte = new Map();
        for (const [contreparties, signe] of [
            [cumuls.recettes, 1],
            [cumuls.depenses, -1],
        ]) {
            for (const c of contreparties.values()) {
                if (!/^[12]/.test(c.numero) && !(0, etats_financiers_communs_1.correspond)(c.numero, correspondance_smt_1.DETTES_HORS_EXPLOITATION))
                    continue;
                const montant = signe * c.montant;
                const existant = parCompte.get(c.numero);
                if (existant)
                    existant.montant += montant;
                else
                    parCompte.set(c.numero, { numero: c.numero, intitule: c.intitule, montant });
            }
        }
        const comptes = [...parCompte.values()]
            .filter((c) => Math.abs(c.montant) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero));
        return { montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
    }
    construireCompteDeResultat(cumuls, lignesN, dettesImmobilisations = { ouverture: 0, cloture: 0 }) {
        const recettes = this.ventilerFlux(cumuls.recettes, correspondance_smt_1.POSTES_RECETTES);
        const depenses = this.ventilerFlux(cumuls.depenses, correspondance_smt_1.POSTES_DEPENSES);
        const soldeCaisse = recettes.total - depenses.total;
        const bilanCloture = this.resoudreBilan(lignesN);
        const bilanOuverture = this.resoudreBilan(this.aLOuverture(lignesN));
        const variation = (ref) => (bilanCloture.get(ref)?.montant ?? 0) - (bilanOuverture.get(ref)?.montant ?? 0);
        const dettesExploitation = (bilan) => bilan.get('HD').comptes.filter((c) => !(0, etats_financiers_communs_1.correspond)(c.numero, correspondance_smt_1.DETTES_HORS_EXPLOITATION));
        const somme = (comptes) => comptes.reduce((s, c) => s + c.montant, 0);
        const lignes68 = lignesN.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_1.COMPTES_DOTATIONS_AMORTISSEMENTS));
        const dotations = lignes68.reduce((s, l) => s + l.solde, 0);
        const valeurs = {
            VA: variation('GB'),
            VB: variation('GC'),
            VC: somme(dettesExploitation(bilanCloture)) -
                dettesImmobilisations.cloture -
                (somme(dettesExploitation(bilanOuverture)) - dettesImmobilisations.ouverture),
            JG: dotations,
        };
        const comptesDe = {
            VA: bilanCloture.get('GB').comptes,
            VB: bilanCloture.get('GC').comptes,
            VC: [
                ...dettesExploitation(bilanCloture),
                ...(Math.abs(dettesImmobilisations.cloture) > 0.005
                    ? [{ numero: '40', intitule: "Dettes du 40 nées d'immobilisations (hors exploitation)", montant: -dettesImmobilisations.cloture }]
                    : []),
            ],
            JG: lignes68
                .filter((l) => Math.abs(l.solde) > 0.005)
                .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde })),
        };
        const retraitements = correspondance_smt_1.RETRAITEMENTS.map((r) => ({
            ref: r.ref,
            libelle: r.libelle,
            montant: valeurs[r.ref],
            signe: r.signe,
            comptes: comptesDe[r.ref],
        }));
        const resultatNet = retraitements.reduce((s, r) => s + r.signe * r.montant, soldeCaisse);
        return {
            recettes: recettes.postes,
            totalRecettes: recettes.total,
            depenses: depenses.postes,
            totalDepenses: depenses.total,
            soldeCaisse,
            retraitements,
            resultatNet,
            resultatBilan: this.sourcesDuResultat(lignesN).parts.resultatDeLExercice,
        };
    }
    async compteDeResultat(tenantId, exerciceId) {
        const [exerciceN, exerciceN1Id] = await Promise.all([
            this.exercice(tenantId, exerciceId),
            (0, etats_financiers_communs_1.trouverExerciceN1)(this.exerciceService, tenantId, exerciceId),
        ]);
        const dettesImmo = async (id, dates) => (0, dettes_rattachees_1.dettesFournisseursNeesDImmobilisations)(this.prisma, tenantId, { id, ...dates }, reglements_de_tresorerie_1.DETTES_FOURNISSEURS_RATTACHEES);
        const [cumuls, lignesN, cumulsN1, lignesN1, immoN, immoN1, ouvertureN] = await Promise.all([
            this.cumulsTresorerie(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceId),
            exerciceN1Id ? this.cumulsTresorerie(tenantId, exerciceN1Id) : Promise.resolve(null),
            exerciceN1Id ? this.chargerLignes(tenantId, exerciceN1Id) : Promise.resolve(null),
            dettesImmo(exerciceId, exerciceN),
            exerciceN1Id ? this.exercice(tenantId, exerciceN1Id).then((d) => dettesImmo(exerciceN1Id, d)) : Promise.resolve(undefined),
            exerciceN1Id ? Promise.resolve([]) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId),
        ]);
        const [naturesN, naturesN1] = await Promise.all([
            (0, reglements_de_tresorerie_1.naturesDesReglementsFournisseurs)(this.prisma, tenantId, cumuls.reglements),
            cumulsN1 ? (0, reglements_de_tresorerie_1.naturesDesReglementsFournisseurs)(this.prisma, tenantId, cumulsN1.reglements) : Promise.resolve(null),
        ]);
        const rattacher = (c, natures) => ({
            ...c,
            depenses: (0, reglements_de_tresorerie_1.depensesRattachees)(c.depenses, c.reglements, natures),
        });
        const n = this.construireCompteDeResultat(rattacher(cumuls, naturesN), lignesN, immoN);
        const n1 = cumulsN1 && lignesN1 && naturesN1 ? this.construireCompteDeResultat(rattacher(cumulsN1, naturesN1), lignesN1, immoN1) : null;
        const avecN1 = (postes, postesN1) => postes.map((p) => ({ ...p, montantN1: postesN1 ? (postesN1.find((x) => x.ref === p.ref)?.montant ?? 0) : undefined }));
        const hors = this.fluxHorsExploitation(rattacher(cumuls, naturesN));
        return {
            recettes: avecN1(n.recettes, n1?.recettes),
            totalRecettes: n.totalRecettes,
            depenses: avecN1(n.depenses, n1?.depenses),
            totalDepenses: n.totalDepenses,
            soldeCaisse: n.soldeCaisse,
            retraitements: avecN1(n.retraitements, n1?.retraitements),
            resultatNet: n.resultatNet,
            exerciceN1Disponible: n1 !== null,
            motifComparatifAbsent: n1 === null && (0, etats_financiers_communs_1.ouvertureTenue)(ouvertureN) ? etats_financiers_communs_1.MOTIF_RESULTAT_N1_NON_TENU : null,
            totalRecettesN1: n1?.totalRecettes,
            totalDepensesN1: n1?.totalDepenses,
            soldeCaisseN1: n1?.soldeCaisse,
            resultatNetN1: n1?.resultatNet,
            reglementsNonRattaches: naturesN.nonRattaches,
            controle: {
                resultatBilan: n.resultatBilan,
                fluxHorsExploitation: hors.montant,
                comptesHorsExploitation: hors.comptes,
                ecart: n.resultatNet - n.resultatBilan,
                concordant: Math.abs(n.resultatNet - n.resultatBilan) < 0.01,
            },
        };
    }
    async journalTresorerie(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        const ecritures = [];
        let mouvementsDeTresorerie = 0;
        const [, lignes] = await Promise.all([
            this.parcourirEcrituresDeTresorerie(tenantId, exerciceId, (e) => {
                mouvementsDeTresorerie += e.lignes.filter((l) => this.estTresorerie(l.compte.numero)).length;
                if (mouvementsDeTresorerie > exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL) {
                    throw new common_1.BadRequestException(`Le journal de trésorerie (NOTE 4) de cet exercice porte plus de ` +
                        `${exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL.toLocaleString('fr-FR')} mouvements de trésorerie, au-delà de ` +
                        `son plafond, qui est celui du grand livre complet. Un livre ne se tronque pas : ouvrez le grand ` +
                        `livre de chaque compte de trésorerie (banques et caisse), compte par compte, qui en porte les ` +
                        `mêmes mouvements, sans la ventilation par nature.`);
                }
                ecritures.push(e);
            }),
            this.chargerLignes(tenantId, exerciceId),
        ]);
        ecritures.sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
        const comptesTresorerie = lignes
            .filter((l) => this.estTresorerie(l.numero))
            .sort((a, b) => a.numero.localeCompare(b.numero));
        const journaux = comptesTresorerie.map((compte) => {
            const reportANouveau = compte.reportDebit - compte.reportCredit;
            let solde = reportANouveau;
            let nonVentilees = 0;
            const operations = ecritures.flatMap((e) => {
                const surCeCompte = e.lignes.filter((l) => l.compteId === compte.compteId);
                if (surCeCompte.length === 0)
                    return [];
                const mouvement = surCeCompte.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
                if (Math.abs(mouvement) < 0.005)
                    return [];
                const tresorerieDeLEcriture = e.lignes.filter((l) => this.estTresorerie(l.compte.numero));
                const contreparties = e.lignes.filter((l) => !this.estTresorerie(l.compte.numero));
                const virementInterne = contreparties.length === 0;
                const ventilable = !virementInterne && tresorerieDeLEcriture.length === 1;
                if (!virementInterne && !ventilable)
                    nonVentilees += 1;
                const sens = mouvement > 0 ? 'RECETTE' : 'DEPENSE';
                const colonnes = sens === 'RECETTE' ? correspondance_smt_1.VENTILATION_RECETTES : correspondance_smt_1.VENTILATION_DEPENSES;
                const ventilation = {};
                for (const col of colonnes)
                    ventilation[col.cle] = 0;
                if (ventilable) {
                    for (const l of contreparties) {
                        const montant = sens === 'RECETTE' ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
                        const col = colonnes.find((k) => (0, etats_financiers_communs_1.correspond)(l.compte.numero, k.comptes, k.exclusions));
                        if (col)
                            ventilation[col.cle] += montant;
                    }
                }
                solde += mouvement;
                return [
                    {
                        date: e.date,
                        libelle: e.libelle,
                        reference: e.reference,
                        sens,
                        recette: mouvement > 0 ? mouvement : 0,
                        depense: mouvement < 0 ? -mouvement : 0,
                        solde,
                        virementInterne,
                        ventile: ventilable,
                        ventilation,
                    },
                ];
            });
            return {
                compteId: compte.compteId,
                numero: compte.numero,
                intitule: compte.intitule,
                reportANouveau,
                operations,
                soldeAReporter: solde,
                totalRecettes: operations.reduce((s, o) => s + o.recette, 0),
                totalDepenses: operations.reduce((s, o) => s + o.depense, 0),
                lignesNonVentilees: nonVentilees,
                soldeBalance: compte.solde,
                boucle: Math.abs(solde - compte.solde) < 0.01,
            };
        });
        return {
            journaux,
            colonnesRecettes: correspondance_smt_1.VENTILATION_RECETTES.map((c) => ({ cle: c.cle, libelle: c.libelle })),
            colonnesDepenses: correspondance_smt_1.VENTILATION_DEPENSES.map((c) => ({ cle: c.cle, libelle: c.libelle })),
            nb: correspondance_smt_1.NB_JOURNAL_TRESORERIE,
        };
    }
    async note1Immobilisations(tenantId, exerciceId) {
        const exercice = await this.exercice(tenantId, exerciceId);
        const [immobilisations, lignesBalance] = await Promise.all([
            this.prisma.immobilisation.findMany({
                where: {
                    tenantId,
                    dateAcquisition: { lte: exercice.dateFin },
                    OR: [{ dateSortie: null }, { dateSortie: { gte: exercice.dateDebut } }],
                },
                orderBy: [{ dateAcquisition: 'asc' }],
            }),
            this.chargerLignes(tenantId, exerciceId),
        ]);
        const versLigne = (i) => ({
            origine: 'REGISTRE',
            dateMiseEnService: i.dateMiseEnService,
            designation: i.designation,
            montant: Number(i.valeurOrigine),
            dateAcquisition: i.dateAcquisition,
            dureeUtiliteAns: i.dureeAmortissementAns,
            dateSortie: i.dateSortie,
            prixCession: i.prixCession === null ? null : Number(i.prixCession),
        });
        const detenus = immobilisations.filter((i) => !i.dateSortie || i.dateSortie > exercice.dateFin);
        const sortis = immobilisations.filter((i) => i.dateSortie && i.dateSortie <= exercice.dateFin);
        const cautions = lignesBalance
            .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_1.COMPTES_CAUTIONS_NOTE_1) && Math.abs(l.solde) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero))
            .map((l) => ({
            origine: 'BALANCE',
            dateMiseEnService: null,
            designation: `${l.numero} ${l.intitule}`,
            montant: l.solde,
            dateAcquisition: null,
            dureeUtiliteAns: null,
            dateSortie: null,
            prixCession: null,
        }));
        const fichesParCompte = new Map();
        for (const i of detenus) {
            const compte = (0, immobilisation_en_cours_1.compteInscritALaDate)(i, exercice.dateFin);
            fichesParCompte.set(compte, (fichesParCompte.get(compte) ?? 0) + Number(i.valeurOrigine));
        }
        const comptesBruts = lignesBalance.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_2 && !(0, etats_financiers_communs_1.correspond)(l.numero, ['28', '29', ...correspondance_smt_1.COMPTES_CAUTIONS_NOTE_1]));
        const ecartsGA = comptesBruts
            .map((l) => {
            const valeurFiches = fichesParCompte.get(l.compteId) ?? 0;
            return { numero: l.numero, intitule: l.intitule, soldeBalance: l.solde, valeurFiches, ecart: l.solde - valeurFiches };
        })
            .filter((c) => Math.abs(c.ecart) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero));
        const comptesVus = new Set(comptesBruts.map((l) => l.compteId));
        const fichesSansSolde = detenus.filter((i) => !comptesVus.has((0, immobilisation_en_cours_1.compteInscritALaDate)(i, exercice.dateFin)));
        const lignesRegistre = detenus.map(versLigne);
        const totalRegistre = lignesRegistre.reduce((s, l) => s + l.montant, 0);
        const totalCautions = cautions.reduce((s, l) => s + l.montant, 0);
        return {
            lignes: [...lignesRegistre, ...cautions],
            sortiesDeLExercice: sortis.map(versLigne),
            total: totalRegistre + totalCautions,
            totalRegistre,
            totalCautions,
            motifCautions: cautions.length > 0
                ? "Le titre de la note vise « le matériel, le mobilier et les cautions ». Les dépôts et cautionnements ne sont pas au registre des immobilisations : ils sont repris depuis le solde du compte 275 « Dépôts et cautionnements versés », sans date ni prix de cession, que la comptabilité ne porte pas au niveau du compte."
                : null,
            ecartsGA,
            fichesSansSolde: fichesSansSolde.map((i) => ({ designation: i.designation, montant: Number(i.valeurOrigine) })),
            motifEcartsGA: ecartsGA.length > 0 || fichesSansSolde.length > 0
                ? "Le poste GA du bilan lit toute la classe 2, la Note 1 le seul registre des immobilisations. Les comptes nommés ici portent un solde brut que les fiches détenues à la clôture ne reconstituent pas (écriture passée au journal sans fiche, fiche sans écriture, avance, titre ou prêt) : ils sont au bilan et hors de la note."
                : null,
        };
    }
    async note2Stocks(tenantId, exerciceId) {
        const [, lignes] = await Promise.all([this.exercice(tenantId, exerciceId), this.chargerLignes(tenantId, exerciceId)]);
        const stocks = lignes
            .filter((l) => l.classe === client_1.ClasseCompte.CLASSE_3)
            .sort((a, b) => a.numero.localeCompare(b.numero));
        const note = (0, stocks_depuis_inventaire_1.lignesNoteStocks)(stocks.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde })), await (0, stocks_depuis_inventaire_1.chargerCampagneStocks)(this.prisma, tenantId, exerciceId));
        return {
            lignes: note.lignes,
            valeurStockFinal: stocks.reduce((s, l) => s + l.solde, 0),
            valeurStockInitial: stocks.reduce((s, l) => s + (l.reportDebit - l.reportCredit), 0),
            quantitesTenues: note.quantitesTenues,
            sourceQuantites: note.source,
            motifQuantites: (0, stocks_depuis_inventaire_1.motifQuantitesNote2)(note, ''),
        };
    }
    async partsParEcheance(tenantId, exerciceId) {
        const exercice = await this.exercice(tenantId, exerciceId);
        const lignesOuvertes = {
            ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE },
            ...(0, ouverte_a_la_cloture_1.ouverteALaCloture)(exercice.dateFin),
            compte: { classe: client_1.ClasseCompte.CLASSE_4 },
        };
        const [nonEchues, echues] = await Promise.all([
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ...lignesOuvertes, dateEcheance: { gt: exercice.dateFin } },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ...lignesOuvertes, dateEcheance: { lte: exercice.dateFin } },
                _sum: { debit: true, credit: true },
            }),
        ]);
        const parCompte = new Map();
        const porter = (groupes, part) => {
            for (const g of groupes) {
                const parts = parCompte.get(g.compteId) ?? { ...PARTS_ECHEANCE_NULLES };
                parts[part] += Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
                parCompte.set(g.compteId, parts);
            }
        };
        porter(nonEchues, 'nonEchu');
        porter(echues, 'echu');
        const { ecarts, nommes } = await (0, reste_des_lignes_ouvertes_1.ecartsDesGroupesParEcheance)(this.prisma, tenantId, lignesOuvertes, exercice.dateFin, 'NOTE 3 du SMT (SYCEBNL)');
        for (const [compteId, e] of ecarts) {
            const parts = parCompte.get(compteId) ?? { ...PARTS_ECHEANCE_NULLES };
            parts.nonEchu += e.nonEchu;
            parts.echu += e.echu;
            parCompte.set(compteId, parts);
        }
        return { parCompte, nommes };
    }
    async note3CreancesDettes(tenantId, exerciceId) {
        const lignes = await this.chargerLignes(tenantId, exerciceId);
        const tiersParCompte = new Map();
        const rattachements = await this.prisma.tiersCompte.findMany({
            where: { tiers: { tenantId } },
            include: { tiers: { select: { nom: true } } },
        });
        for (const r of rattachements)
            tiersParCompte.set(r.compteId, r.tiers.nom);
        const { parCompte: parts, nommes } = await this.partsParEcheance(tenantId, exerciceId);
        const construire = (filtre, signe) => lignes
            .filter((l) => l.classe === client_1.ClasseCompte.CLASSE_4 && filtre(l))
            .sort((a, b) => a.numero.localeCompare(b.numero))
            .map((l) => {
            const cloture = signe * l.solde;
            const ouverture = signe * (l.reportDebit - l.reportCredit);
            const p = parts.get(l.compteId) ?? PARTS_ECHEANCE_NULLES;
            return {
                numero: l.numero,
                nom: tiersParCompte.get(l.compteId) ?? l.intitule,
                montantCloture: cloture,
                montantOuverture: ouverture,
                variationValeur: cloture - ouverture,
                variationPourcent: Math.abs(ouverture) < 0.005 ? null : ((cloture - ouverture) / Math.abs(ouverture)) * 100,
                montantNonEchu: signe * p.nonEchu,
                montantEchu: signe * p.echu,
                montantNonVentile: cloture - signe * p.nonEchu - signe * p.echu,
            };
        });
        const estDepreciation = (l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_1.DEPRECIATIONS_DES_TIERS);
        const creances = construire((l) => l.solde > 0 && !estDepreciation(l), 1);
        const dettes = construire((l) => l.solde < 0 && !estDepreciation(l), -1);
        const depreciationsCreances = lignes
            .filter((l) => l.classe === client_1.ClasseCompte.CLASSE_4 && estDepreciation(l))
            .filter((l) => Math.abs(l.solde) > 0.005 || Math.abs(l.reportDebit - l.reportCredit) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero))
            .map((l) => ({
            numero: l.numero,
            intitule: l.intitule,
            montantCloture: l.solde,
            montantOuverture: l.reportDebit - l.reportCredit,
            variationValeur: l.solde - (l.reportDebit - l.reportCredit),
        }));
        const totalDepreciationsCreances = depreciationsCreances.reduce((s, d) => s + d.montantCloture, 0);
        const totalCreancesNonVentilees = creances.reduce((s, c) => s + c.montantNonVentile, 0);
        const totalDettesNonVentilees = dettes.reduce((s, d) => s + d.montantNonVentile, 0);
        const echeancesTenues = Math.abs(totalCreancesNonVentilees) < 0.005 && Math.abs(totalDettesNonVentilees) < 0.005;
        const totalCreances = creances.reduce((s, c) => s + c.montantCloture, 0);
        return {
            creances,
            totalCreances,
            depreciationsCreances,
            totalDepreciationsCreances,
            totalCreancesNettes: totalCreances + totalDepreciationsCreances,
            totalCreancesNonEchues: creances.reduce((s, c) => s + c.montantNonEchu, 0),
            totalCreancesEchues: creances.reduce((s, c) => s + c.montantEchu, 0),
            totalCreancesNonVentilees,
            dettes,
            totalDettes: dettes.reduce((s, d) => s + d.montantCloture, 0),
            totalDettesNonEchues: dettes.reduce((s, d) => s + d.montantNonEchu, 0),
            totalDettesEchues: dettes.reduce((s, d) => s + d.montantEchu, 0),
            totalDettesNonVentilees,
            echeancesTenues,
            motifEcheances: echeancesTenues
                ? null
                : "La maquette officielle intitule cette note « Etat des créances et des dettes non échues » (Partie 4, ch. 4). Une ligne de tiers sans date d'échéance n'est ni échue ni non échue : elle est portée à part et non rangée d'office dans le non échu. Renseigner la date d'échéance sur les lignes de tiers, et tenir les comptes de tiers en report à-nouveau mode DÉTAIL, pour que la ventilation soit complète.",
            groupesLusLigneALigne: await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(this.prisma, tenantId, nommes),
        };
    }
    async note5Dotation(tenantId, exerciceId) {
        const [, lignes] = await Promise.all([this.exercice(tenantId, exerciceId), this.chargerLignes(tenantId, exerciceId)]);
        const rubriques = [
            { cle: 'nonConsomptible', libelle: 'Dotation non consomptible', comptes: ['101', '102'] },
            { cle: 'droitEntree', libelle: "Droit d'entrée", comptes: ['103'] },
            { cle: 'consomptible', libelle: 'Dotation consomptible', comptes: ['104'] },
        ].map((r) => {
            const comptes = lignes
                .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, r.comptes))
                .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
            return { ...r, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
        });
        const comptesDesRubriques = rubriques.flatMap((r) => r.comptes.map((c) => c.numero));
        const posteHA = correspondance_smt_1.POSTES_BILAN_PASSIF.find((p) => p.ref === 'HA');
        const horsRubriques = lignes
            .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, posteHA.comptes, posteHA.exclusions) && !comptesDesRubriques.includes(l.numero))
            .filter((l) => Math.abs(l.solde) > 0.005)
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
        const total = rubriques.reduce((s, r) => s + r.montant, 0);
        const totalHorsRubriques = horsRubriques.reduce((s, c) => s + c.montant, 0);
        const comptes45 = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_1.SOUS_COMPTES_APPORTEURS));
        const rattachements = comptes45.length
            ? await this.prisma.tiersCompte.findMany({
                where: { compteId: { in: comptes45.map((l) => l.compteId) } },
                include: { tiers: { select: { nom: true } } },
            })
            : [];
        const membres = rattachements
            .filter((r) => comptes45.some((l) => l.compteId === r.compteId))
            .map((r) => {
            const ligne = comptes45.find((l) => l.compteId === r.compteId);
            return {
                nom: r.tiers.nom,
                nationalite: null,
                montant: ligne.mouvementDebit,
                precisionDroitEntree: null,
                numero: ligne.numero,
            };
        });
        return {
            rubriques,
            total,
            horsRubriques,
            totalHorsRubriques,
            totalPosteHA: total + totalHorsRubriques,
            motifHorsRubriques: horsRubriques.length > 0
                ? "La maquette de la Note 5 (Partie 4, ch. 4) n'ouvre aucune rubrique pour le compte 106 « Écarts de réévaluation », que le plan range sous le 10 « DOTATION » et que le poste HA reprend. Lacune du texte, signalée et non comblée : ces comptes sont rappelés hors rubriques, le TOTAL de la maquette reste celui des trois rubriques."
                : null,
            membres,
            nationaliteTenue: false,
            precisionDroitEntreeTenue: false,
            motifColonnesNonTenues: "La nationalité des membres apporteurs et la précision « avec droit d'entrée ou sans droit d'entrée » ne sont pas des données du dossier comptable : ces deux colonnes de la maquette officielle sont à compléter à la main sur l'état imprimé.",
            motifMembres: "Membres lus sur les seuls sous-comptes d'apporteurs du compte 45 (4511, 4512, 4521, 4522, 4531, 4532, 4541, 4542, 4551, 4552). Les comptes courants (4515, 4525, 4535, 4545, 4555), les mécènes et bénévoles (457), les organisations religieuses (456) et les autres fondateurs (458) n'en sont pas : leur débit n'est pas un apport à la dotation.",
        };
    }
    ficheNotes() {
        return correspondance_smt_1.NOTES_SMT;
    }
    async notesApplicables(tenantId, exerciceId, notes) {
        const lignes = await this.chargerLignes(tenantId, exerciceId);
        const nonNul = (v) => Math.abs(v) > 0.005;
        const journalTenu = lignes.some((l) => this.estTresorerie(l.numero) &&
            (nonNul(l.reportDebit - l.reportCredit) || nonNul(l.mouvementDebit) || nonNul(l.mouvementCredit)));
        const { note1, note2, note3, note5 } = notes;
        const applicable = {
            1: note1.lignes.length > 0 || note1.sortiesDeLExercice.length > 0,
            2: note2.lignes.length > 0,
            3: note3.creances.length > 0 || note3.dettes.length > 0,
            4: journalTenu,
            5: note5.rubriques.some((r) => nonNul(r.montant)) || note5.membres.length > 0 || note5.horsRubriques.length > 0,
        };
        return correspondance_smt_1.NOTES_SMT.map((n) => n.numero).filter((numero) => applicable[numero]);
    }
    async ressourcesParCategorie(tenantId, exerciceId) {
        const lignes = await this.chargerLignes(tenantId, exerciceId);
        return correspondance_smt_1.CATEGORIES_RESSOURCES_ART6.map((c) => {
            const comptes = lignes
                .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, c.comptes, c.exclusions))
                .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
            return { cle: c.cle, libelle: c.libelle, montant: comptes.reduce((s, x) => s + x.montant, 0), comptes };
        });
    }
    async eligibilite(tenantId, exerciceId) {
        const [categories, tenant, exercice] = await Promise.all([
            this.ressourcesParCategorie(tenantId, exerciceId),
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { devise: true } }),
            this.exercice(tenantId, exerciceId),
        ]);
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lte: exercice.dateDebut } },
            orderBy: { dateFin: 'desc' },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        const categoriesPrecedent = precedent ? await this.ressourcesParCategorie(tenantId, precedent.id) : null;
        const cumulBiennal = categoriesPrecedent
            ? correspondance_smt_1.CATEGORIES_RESSOURCES_ART6.map((c) => {
                const courant = categories.find((x) => x.cle === c.cle).montant;
                const anterieur = categoriesPrecedent.find((x) => x.cle === c.cle).montant;
                return { cle: c.cle, libelle: c.libelle, exerciceCourant: courant, exercicePrecedent: anterieur, cumule: courant + anterieur };
            })
            : null;
        return {
            categories,
            totalRessources: categories.reduce((s, c) => s + c.montant, 0),
            cumulBiennal,
            exercicePrecedent: precedent ? { id: precedent.id, dateDebut: precedent.dateDebut, dateFin: precedent.dateFin } : null,
            avertissementCumul: cumulBiennal
                ? "L'article 6 ajoute que « si, de manière cumulée sur deux exercices, les ressources dépassent trente millions […] l'entité est éligible au Système normal ». Comparez donc AUSSI la colonne cumulée au seuil : une entité sous le seuil chaque année peut le franchir sur deux."
                : "Aucun exercice antérieur n'est clos dans ce dossier : le cumul sur deux exercices de l'article 6 ne peut pas être mesuré. Il le sera à partir du deuxième exercice.",
            seuilParCategorieFcfa: correspondance_smt_1.SEUIL_SMT_FCFA,
            deviseDossier: (0, monnaie_de_tenue_1.monnaieDuJeuLegal)(tenant.devise),
            conversionAppliquee: false,
            avertissement: "L'article 6 fixe le seuil à 30 000 000 FCFA « ou l'équivalent dans l'unité monétaire ayant cours légal dans l'État partie ». OmegaX ne convertit pas : comparez chaque catégorie au seuil converti au cours que retient votre entité. L'article 5 rappelle que le Système normal est la règle et le S.M.T l'exception liée à la taille.",
        };
    }
};
exports.EtatsFinanciersSmtService = EtatsFinanciersSmtService;
exports.EtatsFinanciersSmtService = EtatsFinanciersSmtService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService,
        exercice_service_1.ExerciceService,
        prisma_service_1.PrismaService])
], EtatsFinanciersSmtService);
//# sourceMappingURL=etats-financiers-smt.service.js.map