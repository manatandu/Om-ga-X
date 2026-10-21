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
exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA = exports.EtatsFinanciersSmtSyscohadaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const etats_garanties_smt_1 = require("./etats-garanties-smt");
const prisma_service_1 = require("../../common/prisma.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const exercice_service_1 = require("../exercice/exercice.service");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const reglements_de_tresorerie_1 = require("../etats-financiers/reglements-de-tresorerie");
const dettes_rattachees_1 = require("../etats-financiers/dettes-rattachees");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const correspondance_smt_syscohada_1 = require("./correspondance-smt-syscohada");
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
const ouverte_a_la_cloture_1 = require("../lettrage/ouverte-a-la-cloture");
const reste_des_lignes_ouvertes_1 = require("../lettrage/reste-des-lignes-ouvertes");
const stocks_depuis_inventaire_1 = require("../etats-financiers/stocks-depuis-inventaire");
const immobilisation_en_cours_1 = require("../immobilisations/immobilisation-en-cours");
let EtatsFinanciersSmtSyscohadaService = class EtatsFinanciersSmtSyscohadaService {
    constructor(ecritureService, exerciceService, prisma) {
        this.ecritureService = ecritureService;
        this.exerciceService = exerciceService;
        this.prisma = prisma;
    }
    estTresorerie(numero) {
        return (0, etats_financiers_communs_1.correspond)(numero, correspondance_smt_syscohada_1.COMPTES_TRESORERIE_SMT_SYSCOHADA);
    }
    async exerciceDuDossier(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { dateDebut: true, dateFin: true },
        });
        if (!exercice) {
            throw new common_1.NotFoundException(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE);
        }
        return exercice;
    }
    async chargerLignes(tenantId, exerciceId) {
        return (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId);
    }
    aLOuverture(lignes) {
        return lignes.map((l) => ({
            ...l,
            totalDebit: l.reportDebit,
            totalCredit: l.reportCredit,
            mouvementDebit: 0,
            mouvementCredit: 0,
            solde: l.reportDebit - l.reportCredit,
        }));
    }
    calculerPosteBilan(poste, lignes) {
        let base = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions));
        if (poste.sens_qualificatif === 'DEBITEUR')
            base = base.filter((l) => l.solde > 0);
        if (poste.sens_qualificatif === 'CREDITEUR')
            base = base.filter((l) => l.solde < 0);
        const retenues = new Map();
        for (const l of base)
            retenues.set(l.compteId, l);
        if (poste.comptesSansFiltreDeSens) {
            for (const l of lignes.filter((x) => (0, etats_financiers_communs_1.correspond)(x.numero, poste.comptesSansFiltreDeSens))) {
                retenues.set(l.compteId, l);
            }
        }
        const signe = poste.sens === 'ACTIF' ? 1 : -1;
        const comptes = [...retenues.values()]
            .sort((a, b) => a.numero.localeCompare(b.numero))
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: signe * l.solde }));
        return {
            ref: poste.ref,
            libelle: poste.libelle,
            note: poste.note,
            montant: comptes.reduce((s, c) => s + c.montant, 0),
            comptes,
        };
    }
    calculerResultatBilan(lignes) {
        const lignes678 = lignes.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_6 || l.classe === client_1.ClasseCompte.CLASSE_7 || l.classe === client_1.ClasseCompte.CLASSE_8);
        const resultatClasses678 = lignes678.reduce((s, l) => s - l.solde, 0);
        const lignes13 = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_syscohada_1.COMPTES_RESULTAT_SMT_SYSCOHADA));
        const resultatCompte13 = lignes13.reduce((s, l) => s - l.solde, 0);
        const comptes = [...lignes13, ...lignes678]
            .filter((l) => Math.abs(l.solde) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero))
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
        return {
            poste: {
                ref: correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA,
                libelle: correspondance_smt_syscohada_1.LIBELLE_RESULTAT_SMT_SYSCOHADA,
                note: null,
                montant: (0, resultat_de_l_exercice_1.resultatAuBilan)(resultatClasses678, resultatCompte13),
                comptes,
            },
            resultatClasses678,
            resultatCompte13,
            parts: (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(resultatClasses678, resultatCompte13, lignes678, lignes13),
        };
    }
    resoudreBilan(lignes) {
        const parRef = new Map();
        for (const poste of [...correspondance_smt_syscohada_1.POSTES_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA]) {
            parRef.set(poste.ref, this.calculerPosteBilan(poste, lignes));
        }
        const { poste, resultatClasses678, resultatCompte13, parts } = this.calculerResultatBilan(lignes);
        parRef.set(poste.ref, poste);
        for (const total of [...correspondance_smt_syscohada_1.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA]) {
            const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
            parRef.set(total.ref, {
                ref: total.ref,
                libelle: total.libelle,
                note: null,
                montant,
                comptes: [],
                estTotal: true,
            });
        }
        return { parRef, resultatClasses678, resultatCompte13, parts };
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
        const comparatif = (0, etats_financiers_communs_1.comparatifDuBilan)(exerciceN1Id, lignesN1, ouvertureN, ouverturePassee, 'SYSCOHADA');
        const { parRef: parRefN, resultatClasses678, resultatCompte13, parts } = this.resoudreBilan(lignesN);
        const { parRef: parRefN1, parts: partsN1 } = this.resoudreBilan(comparatif.lignes);
        const fusionner = (ref) => {
            const n = parRefN.get(ref);
            return { ...n, montantN1: comparatif.provenance ? parRefN1.get(ref)?.montant : undefined };
        };
        const rattaches = new Set();
        for (const poste of [...correspondance_smt_syscohada_1.POSTES_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA]) {
            for (const l of lignesN) {
                if ((0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes, poste.exclusions) ||
                    (poste.comptesSansFiltreDeSens && (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptesSansFiltreDeSens))) {
                    rattaches.add(l.compteId);
                }
            }
        }
        for (const l of lignesN) {
            if ((0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_syscohada_1.COMPTES_RESULTAT_SMT_SYSCOHADA))
                rattaches.add(l.compteId);
        }
        const CLASSES_DE_BILAN = new Set([
            client_1.ClasseCompte.CLASSE_1,
            client_1.ClasseCompte.CLASSE_2,
            client_1.ClasseCompte.CLASSE_3,
            client_1.ClasseCompte.CLASSE_4,
            client_1.ClasseCompte.CLASSE_5,
        ]);
        const comptesNonRattaches = lignesN
            .filter((l) => CLASSES_DE_BILAN.has(l.classe) && !rattaches.has(l.compteId))
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
        const totalActif = parRefN.get('SAZ').montant;
        const totalPassif = parRefN.get('SPZ').montant;
        return {
            actif: correspondance_smt_syscohada_1.ORDRE_BILAN_ACTIF_SMT_SYSCOHADA.map(fusionner),
            passif: correspondance_smt_syscohada_1.ORDRE_BILAN_PASSIF_SMT_SYSCOHADA.map(fusionner),
            totalActif,
            totalPassif,
            totalActifN1: comparatif.provenance ? parRefN1.get('SAZ').montant : undefined,
            totalPassifN1: comparatif.provenance ? parRefN1.get('SPZ').montant : undefined,
            exerciceN1Disponible: exerciceN1Id !== null,
            comparatif: comparatif.provenance,
            mentionComparatif: comparatif.mention,
            equilibre: Math.abs(totalActif - totalPassif) < 0.01,
            comptesNonRattaches,
            renvoiImmobilisations: correspondance_smt_syscohada_1.RENVOI_IMMOBILISATIONS_SMT_SYSCOHADA,
            controle: {
                resultatClasses678,
                resultatCompte13,
                resultatAnterieurNonAffecte: parts.resultatAnterieurNonAffecte,
            },
            resultatAnterieurNonVire: (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(clos, parts.resultatAnterieurNonAffecte, 'SP2', 'SYSCOHADA'),
            resultatAnterieurNonVireN1: (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)(comparatif.provenance, closN1, partsN1.resultatAnterieurNonAffecte, 'SP2', 'SYSCOHADA'),
            resultatEnInstance: (0, resultat_de_l_exercice_1.resultatEnInstanceAuBilan)(lignesN),
        };
    }
    filtreEcrituresDeTresorerie(tenantId, exerciceId) {
        return {
            tenantId,
            exerciceId,
            statut: client_1.StatutEcriture.VALIDEE,
            estGenereeParCloture: false,
            lignes: { some: { compte: { OR: correspondance_smt_syscohada_1.COMPTES_TRESORERIE_SMT_SYSCOHADA.map((p) => ({ numero: { startsWith: p } })) } } },
        };
    }
    async parcourirEcrituresDeTresorerie(tenantId, exerciceId, traiter) {
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
            where: this.filtreEcrituresDeTresorerie(tenantId, exerciceId),
            select: SELECTION_ECRITURE_TRESORERIE_SMT,
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
        }), traiter, lecture_par_lots_1.LOT_ECRITURES);
    }
    cumulerEcritureDeTresorerie(e, cumuls) {
        const tresorerie = e.lignes.filter((l) => this.estTresorerie(l.compte.numero));
        const flux = tresorerie.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
        if (tresorerie.length === 0 || Math.abs(flux) < 0.005)
            return;
        const sens = flux > 0 ? 'RECETTE' : 'DEPENSE';
        const cible = sens === 'RECETTE' ? cumuls.recettes : cumuls.depenses;
        for (const l of e.lignes) {
            if (this.estTresorerie(l.compte.numero))
                continue;
            const numero = l.compte.numero;
            const creditMoinsDebit = Number(l.credit) - Number(l.debit);
            cumuls.avecEffetParNumero.set(numero, (cumuls.avecEffetParNumero.get(numero) ?? 0) + creditMoinsDebit);
            const montant = sens === 'RECETTE' ? creditMoinsDebit : -creditMoinsDebit;
            if (Math.abs(montant) <= 0.005)
                continue;
            if (sens === 'DEPENSE' && montant > 0 && (0, reglements_de_tresorerie_1.estDetteFournisseurRattachee)(numero)) {
                cumuls.reglements.push({ ligneId: l.id, numero, montant });
            }
            const existant = cible.get(numero);
            if (existant)
                existant.montant += montant;
            else
                cible.set(numero, { numero, intitule: l.compte.intitule, montant });
        }
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
    fluxHorsResultat(cumuls) {
        const parCle = new Map();
        for (const b of correspondance_smt_syscohada_1.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA)
            parCle.set(b.cle, new Map());
        const nonRattachees = new Map();
        const cumuler = (cible, c, montant) => {
            const existant = cible.get(c.numero);
            if (existant)
                existant.montant += montant;
            else
                cible.set(c.numero, { numero: c.numero, intitule: c.intitule, montant });
        };
        const signes = [
            [cumuls.recettes, 1],
            [cumuls.depenses, -1],
        ];
        for (const [contreparties, signe] of signes) {
            for (const c of contreparties.values()) {
                if ((0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)(c.numero))
                    continue;
                const bucket = correspondance_smt_syscohada_1.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA.find((b) => (0, etats_financiers_communs_1.correspond)(c.numero, b.comptes));
                cumuler(bucket ? parCle.get(bucket.cle) : nonRattachees, c, signe * c.montant);
            }
        }
        const trier = (m) => [...m.values()].filter((c) => Math.abs(c.montant) > 0.005).sort((a, b) => a.numero.localeCompare(b.numero));
        return {
            rubriques: correspondance_smt_syscohada_1.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA.map((b) => {
                const comptes = trier(parCle.get(b.cle));
                return { cle: b.cle, intitule: b.intitule, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
            }),
            contrepartiesNonRattachees: trier(nonRattachees),
        };
    }
    composantesEcartConcordance(lignes, avecEffetParNumero, dotations, ajustementImmobilisationsAu40 = 0) {
        const kSansEffet = new Map();
        for (const l of lignes)
            kSansEffet.set(l.numero, l.mouvementCredit - l.mouvementDebit);
        for (const [numero, k] of avecEffetParNumero)
            kSansEffet.set(numero, (kSansEffet.get(numero) ?? 0) - k);
        let classe1 = 0;
        let classe2 = ajustementImmobilisationsAu40;
        let depreciationsTresorerie = 0;
        let autresComptes = 0;
        for (const [numero, k] of kSansEffet) {
            const tiers = correspondance_smt_syscohada_1.TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA.find((t) => numero.startsWith(t.prefixe));
            if (tiers) {
                if (tiers.cle === 'financement')
                    classe1 += k;
                else
                    classe2 += k;
            }
            else if (numero.startsWith('1'))
                classe1 += k;
            else if (numero.startsWith('2'))
                classe2 += k;
            else if ((0, etats_financiers_communs_1.correspond)(numero, correspondance_smt_syscohada_1.COMPTES_DEPRECIATION_TRESORERIE_SMT_SYSCOHADA))
                depreciationsTresorerie += k;
            else if (!(0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)(numero) && !this.estTresorerie(numero)) {
                autresComptes += k;
            }
        }
        return {
            classe1,
            classe2,
            depreciationsTresorerie,
            autresComptes,
            dotations,
            total: classe1 + classe2 + depreciationsTresorerie + autresComptes - dotations,
        };
    }
    variationParCompte(cloture, ouverture, ref) {
        const parNumero = new Map();
        for (const c of ouverture.get(ref)?.comptes ?? []) {
            parNumero.set(c.numero, { numero: c.numero, intitule: c.intitule, montant: c.montant });
        }
        for (const c of cloture.get(ref)?.comptes ?? []) {
            const existant = parNumero.get(c.numero);
            if (existant)
                existant.montant -= c.montant;
            else
                parNumero.set(c.numero, { numero: c.numero, intitule: c.intitule, montant: -c.montant });
        }
        return [...parNumero.values()]
            .filter((c) => Math.abs(c.montant) > 0.005 && !(0, correspondance_smt_syscohada_1.estTiersHorsExploitationSmt)(c.numero))
            .sort((a, b) => a.numero.localeCompare(b.numero));
    }
    async construireCompteDeResultat(tenantId, exerciceId) {
        const cumuls = { recettes: new Map(), depenses: new Map(), avecEffetParNumero: new Map(), reglements: [] };
        const [, lignesN, dettesImmo] = await Promise.all([
            this.parcourirEcrituresDeTresorerie(tenantId, exerciceId, (e) => this.cumulerEcritureDeTresorerie(e, cumuls)),
            this.chargerLignes(tenantId, exerciceId),
            this.exerciceDuDossier(tenantId, exerciceId).then((d) => (0, dettes_rattachees_1.dettesFournisseursNeesDImmobilisations)(this.prisma, tenantId, { id: exerciceId, ...d }, reglements_de_tresorerie_1.DETTES_FOURNISSEURS_RATTACHEES)),
        ]);
        const natures = await (0, reglements_de_tresorerie_1.naturesDesReglementsFournisseurs)(this.prisma, tenantId, cumuls.reglements);
        const recettes = this.ventilerFlux(cumuls.recettes, correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA);
        const depenses = this.ventilerFlux((0, reglements_de_tresorerie_1.depensesRattachees)(cumuls.depenses, cumuls.reglements, natures), correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA);
        const { parRef: cloture, parts: partsCloture } = this.resoudreBilan(lignesN);
        const { parRef: ouverture } = this.resoudreBilan(this.aLOuverture(lignesN));
        const montantDe = (source, ref) => source.get(ref)?.montant ?? 0;
        const montantExploitation = (source, ref) => (source.get(ref)?.comptes ?? [])
            .filter((c) => !(0, correspondance_smt_syscohada_1.estTiersHorsExploitationSmt)(c.numero))
            .reduce((s, c) => s + c.montant, 0);
        const lignesDotations = lignesN.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_syscohada_1.COMPTES_DOTATIONS_SMT_SYSCOHADA));
        const dotations = lignesDotations.reduce((s, l) => s + (l.mouvementDebit - l.mouvementCredit), 0);
        const calcule = (0, correspondance_smt_syscohada_1.calculerResultatSmt)({
            recettes: recettes.total,
            depenses: depenses.total,
            stocks: { n: montantDe(cloture, 'SA2'), n1: montantDe(ouverture, 'SA2') },
            creances: { n: montantExploitation(cloture, 'SA3'), n1: montantExploitation(ouverture, 'SA3') },
            dettes: {
                n: montantExploitation(cloture, 'SP4') - dettesImmo.cloture,
                n1: montantExploitation(ouverture, 'SP4') - dettesImmo.ouverture,
            },
            dotations,
        });
        const retraitements = correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.map((r) => ({
            ref: r.ref,
            libelle: r.libelle,
            note: r.note,
            montant: calcule.lignes[r.ref],
            signeOfficiel: r.signeOfficiel,
            lettre: r.lettre,
            comptes: r.posteBilan !== null
                ? this.variationParCompte(cloture, ouverture, r.posteBilan)
                : lignesDotations
                    .filter((l) => Math.abs(l.mouvementDebit - l.mouvementCredit) > 0.005)
                    .sort((a, b) => a.numero.localeCompare(b.numero))
                    .map((l) => ({
                    numero: l.numero,
                    intitule: l.intitule,
                    montant: l.mouvementDebit - l.mouvementCredit,
                })),
        }));
        const parRef = new Map();
        for (const p of [...recettes.postes, ...depenses.postes, ...retraitements])
            parRef.set(p.ref, p);
        const montantsTotaux = { SRA: calcule.A, SDB: calcule.B, SC: calcule.C, SG: calcule.G };
        for (const t of correspondance_smt_syscohada_1.TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA) {
            parRef.set(t.ref, {
                ref: t.ref,
                libelle: t.libelle,
                note: null,
                montant: montantsTotaux[t.ref],
                lettre: t.lettre,
                comptes: [],
                estTotal: true,
            });
        }
        const hors = this.fluxHorsResultat(cumuls);
        const resultatBilan = partsCloture.resultatDeLExercice;
        const reglesEnClasse2 = [...natures.parLigne.values()]
            .flat()
            .filter((p) => p.numero.startsWith('2'))
            .reduce((t, p) => t + p.montant, 0);
        const composantes = this.composantesEcartConcordance(lignesN, cumuls.avecEffetParNumero, dotations, dettesImmo.cloture - dettesImmo.ouverture + reglesEnClasse2);
        const ecart = calcule.G - resultatBilan;
        return {
            parRef,
            recettes: recettes.postes,
            depenses: depenses.postes,
            retraitements,
            calcule,
            fluxHorsResultat: hors.rubriques,
            contrepartiesNonRattachees: hors.contrepartiesNonRattachees,
            reglementsNonRattaches: natures.nonRattaches,
            controle: {
                resultatBilan,
                ecart,
                concordant: Math.abs(ecart) < 0.01,
                composantesEcart: composantes,
                residuel: ecart - composantes.total,
            },
        };
    }
    async compteDeResultat(tenantId, exerciceId) {
        const exerciceN1Id = await (0, etats_financiers_communs_1.trouverExerciceN1)(this.exerciceService, tenantId, exerciceId);
        const [n, n1, lignesSansN1] = await Promise.all([
            this.construireCompteDeResultat(tenantId, exerciceId),
            exerciceN1Id ? this.construireCompteDeResultat(tenantId, exerciceN1Id) : Promise.resolve(null),
            exerciceN1Id ? Promise.resolve(null) : (0, etats_financiers_communs_1.chargerOuverture)(this.ecritureService, tenantId, exerciceId),
        ]);
        const lignes = correspondance_smt_syscohada_1.ORDRE_COMPTE_RESULTAT_SMT_SYSCOHADA.map((ref) => {
            const poste = n.parRef.get(ref);
            return { ...poste, montantN1: n1 ? (n1.parRef.get(ref)?.montant ?? 0) : undefined };
        });
        return {
            lignes,
            recettes: n.recettes,
            totalRecettes: n.calcule.A,
            depenses: n.depenses,
            totalDepenses: n.calcule.B,
            soldeCaisse: n.calcule.C,
            retraitements: n.retraitements,
            lettres: { D: n.calcule.D, E: n.calcule.E, F: n.calcule.F },
            lettresDE: correspondance_smt_syscohada_1.LETTRES_D_E_SMT_SYSCOHADA,
            definitionVariation: correspondance_smt_syscohada_1.DEFINITION_VARIATION_SMT_SYSCOHADA,
            resultatExercice: n.calcule.G,
            exerciceN1Disponible: exerciceN1Id !== null,
            motifComparatifAbsent: lignesSansN1 && (0, etats_financiers_communs_1.ouvertureTenue)(lignesSansN1) ? etats_financiers_communs_1.MOTIF_RESULTAT_N1_NON_TENU : null,
            fluxHorsResultat: n.fluxHorsResultat,
            contrepartiesNonRattachees: n.contrepartiesNonRattachees,
            reglementsNonRattaches: n.reglementsNonRattaches,
            controle: n.controle,
        };
    }
    async journalTresorerie(tenantId, exerciceId) {
        await this.exerciceDuDossier(tenantId, exerciceId);
        const ecritures = [];
        let mouvementsDeTresorerie = 0;
        const [, lignes] = await Promise.all([
            this.parcourirEcrituresDeTresorerie(tenantId, exerciceId, (e) => {
                mouvementsDeTresorerie += e.lignes.filter((l) => this.estTresorerie(l.compte.numero)).length;
                if (mouvementsDeTresorerie > exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA) {
                    throw new common_1.BadRequestException(`Le journal de trésorerie (NOTE 4) de cet exercice porte plus de ` +
                        `${exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA.toLocaleString('fr-FR')} mouvements de trésorerie, au-delà de ` +
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
                const colonnes = sens === 'RECETTE' ? correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA : correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA;
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
            colonnesRecettes: correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA.map((c) => ({
                cle: c.cle,
                libelle: c.libelle,
                rajoutAutorise: c.rajoutAutorise ?? false,
            })),
            colonnesDepenses: correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA.map((c) => ({
                cle: c.cle,
                libelle: c.libelle,
                rajoutAutorise: c.rajoutAutorise ?? false,
            })),
            nb: correspondance_smt_syscohada_1.NB_JOURNAL_TRESORERIE_SMT_SYSCOHADA,
        };
    }
    async journauxDeSuivi(tenantId, exerciceId) {
        await this.exerciceDuDossier(tenantId, exerciceId);
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE, estGenereeParCloture: false },
                OR: [
                    { compte: { numero: { startsWith: '41' } }, debit: { gt: 0 } },
                    { compte: { numero: { startsWith: '40' } }, credit: { gt: 0 } },
                ],
            },
            select: {
                id: true,
                compteId: true,
                debit: true,
                credit: true,
                lettre: true,
                lettrageId: true,
                compte: { select: { numero: true, intitule: true } },
                ecriture: { select: { date: true, reference: true, numeroPiece: true } },
            },
            orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
            take: exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA + 1,
        });
        if (lignes.length > exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA) {
            throw new common_1.BadRequestException(`Les journaux de suivi de cet exercice portent plus de ${exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA.toLocaleString('fr-FR')} ` +
                'factures, au-delà de leur plafond, qui est celui du grand livre complet. Une pièce ne se tronque pas : ' +
                'ouvrez la balance âgée des clients et des fournisseurs, qui en porte les mêmes lignes.');
        }
        const groupesSoldes = [...new Set(lignes.filter((l) => l.lettre !== null && l.lettrageId).map((l) => l.lettrageId))];
        const reglements = groupesSoldes.length
            ? await this.prisma.ligneEcriture.findMany({
                where: { lettrageId: { in: groupesSoldes }, ecriture: { tenantId } },
                select: { lettrageId: true, debit: true, credit: true, ecriture: { select: { date: true } } },
            })
            : [];
        const dernierPaiement = (groupe, sensReglement) => {
            let d = null;
            for (const r of reglements) {
                if (r.lettrageId !== groupe)
                    continue;
                const montant = sensReglement === 'DEBIT' ? Number(r.debit) : Number(r.credit);
                if (montant <= 0)
                    continue;
                if (!d || r.ecriture.date > d)
                    d = r.ecriture.date;
            }
            return d;
        };
        const rattachements = await this.prisma.tiersCompte.findMany({
            where: { tiers: { tenantId } },
            include: { tiers: { select: { nom: true } } },
        });
        const nomParCompte = new Map(rattachements.map((r) => [r.compteId, r.tiers.nom]));
        const construire = (creance) => lignes
            .filter((l) => l.compte.numero.startsWith(creance ? '41' : '40'))
            .map((l) => ({
            date: l.ecriture.date,
            numeroFacture: l.ecriture.reference ?? (l.ecriture.numeroPiece !== null ? String(l.ecriture.numeroPiece) : null),
            nom: nomParCompte.get(l.compteId) ?? `${l.compte.numero} ${l.compte.intitule}`,
            montant: creance ? Number(l.debit) : Number(l.credit),
            datePaiement: l.lettre !== null && l.lettrageId ? dernierPaiement(l.lettrageId, creance ? 'CREDIT' : 'DEBIT') : null,
            paiementPartiel: l.lettre === null && l.lettrageId !== null,
        }));
        const creancesImpayees = construire(true);
        const dettesAPayer = construire(false);
        return {
            journaux: correspondance_smt_syscohada_1.JOURNAUX_DE_SUIVI_SMT_SYSCOHADA.map((j) => ({
                cle: j.cle,
                intitule: j.intitule,
                colonnes: [...j.colonnes],
                lignes: j.cle === 'creancesImpayees' ? creancesImpayees : dettesAPayer,
            })),
            limite: "Tirés des factures que le livre-journal porte aux comptes 41 et 40 de l'exercice. Dans une comptabilité de trésorerie pure (Titre X ch. 1 § 1), les impayés ne sont pas au livre-journal : l'entité tient alors ces journaux elle-même. La date de paiement n'est portée que sur une facture dont le lettrage est soldé.",
        };
    }
    async note1MaterielMobilierCautions(tenantId, exerciceId) {
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const [immobilisations, lignes] = await Promise.all([
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
            date: i.dateAcquisition,
            designation: i.designation,
            montant: Number(i.valeurOrigine),
            dateSortie: i.dateSortie,
            prixCession: i.prixCession === null ? null : Number(i.prixCession),
        });
        const detenus = immobilisations.filter((i) => !i.dateSortie || i.dateSortie > exercice.dateFin);
        const sortis = immobilisations.filter((i) => i.dateSortie && i.dateSortie <= exercice.dateFin);
        const lignesRegistre = detenus.map(versLigne);
        const lignesCautions = lignes
            .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, COMPTES_CAUTIONS_NOTE_1) && Math.abs(l.solde) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero))
            .map((l) => ({
            origine: 'BALANCE',
            date: null,
            designation: `${l.numero} ${l.intitule}`,
            montant: l.solde,
            dateSortie: null,
            prixCession: null,
        }));
        const fichesParCompte = new Map();
        for (const i of detenus) {
            const compte = (0, immobilisation_en_cours_1.compteInscritALaDate)(i, exercice.dateFin);
            fichesParCompte.set(compte, (fichesParCompte.get(compte) ?? 0) + Number(i.valeurOrigine));
        }
        const comptesBruts = lignes.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_2 && !(0, etats_financiers_communs_1.correspond)(l.numero, ['28', '29', ...COMPTES_CAUTIONS_NOTE_1]));
        const ecartsImmobilisations = comptesBruts
            .map((l) => {
            const valeurFiches = fichesParCompte.get(l.compteId) ?? 0;
            return { numero: l.numero, intitule: l.intitule, soldeBalance: l.solde, valeurFiches, ecart: l.solde - valeurFiches };
        })
            .filter((c) => Math.abs(c.ecart) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero));
        const comptesVus = new Set(comptesBruts.map((l) => l.compteId));
        const fichesSansSolde = detenus
            .filter((i) => !comptesVus.has((0, immobilisation_en_cours_1.compteInscritALaDate)(i, exercice.dateFin)))
            .map((i) => ({ designation: i.designation, montant: Number(i.valeurOrigine) }));
        const toutes = [...lignesRegistre, ...lignesCautions];
        return {
            lignes: toutes,
            sortiesDeLExercice: sortis.map(versLigne),
            total: toutes.reduce((s, l) => s + l.montant, 0),
            totalRegistre: lignesRegistre.reduce((s, l) => s + l.montant, 0),
            totalCautions: lignesCautions.reduce((s, l) => s + l.montant, 0),
            amortissement: correspondance_smt_syscohada_1.AMORTISSEMENT_SMT,
            motifCautions: "Le titre officiel de la NOTE 1 vise « le matériel, le mobilier et les cautions ». Les cautions et dépôts de garantie ne sont pas des biens amortissables et ne figurent pas au registre des immobilisations : ils sont repris ici depuis le solde du compte 275 « Dépôts et cautionnements versés », sans date d'entrée ni prix de cession, que la comptabilité ne porte pas au niveau du compte.",
            ecartsImmobilisations,
            fichesSansSolde,
            motifEcartsImmobilisations: ecartsImmobilisations.length > 0 || fichesSansSolde.length > 0
                ? "Le poste « Immobilisations » du bilan lit toute la classe 2, la NOTE 1 le seul registre des immobilisations. Les comptes nommés ici portent un solde brut que les fiches détenues à la clôture ne reconstituent pas (écriture passée au journal sans fiche, fiche sans écriture, titre ou prêt) : ils sont au bilan et hors de la note."
                : null,
        };
    }
    async note2Stocks(tenantId, exerciceId) {
        const [, lignes] = await Promise.all([
            this.exerciceDuDossier(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceId),
        ]);
        const { parRef: cloture } = this.resoudreBilan(lignes);
        const { parRef: ouverture } = this.resoudreBilan(this.aLOuverture(lignes));
        const comptes = cloture.get('SA2').comptes.filter((c) => Math.abs(c.montant) > 0.005);
        const valeurStockFinal = cloture.get('SA2').montant;
        const valeurStockInitial = ouverture.get('SA2').montant;
        const note = (0, stocks_depuis_inventaire_1.lignesNoteStocks)(comptes.map((c) => ({ numero: c.numero, intitule: c.intitule, montant: c.montant })), await (0, stocks_depuis_inventaire_1.chargerCampagneStocks)(this.prisma, tenantId, exerciceId));
        return {
            lignes: note.lignes,
            lignesSynthese: correspondance_smt_syscohada_1.LIGNES_SYNTHESE_NOTE_2_SMT_SYSCOHADA,
            valeurStockFinal,
            valeurStockInitial,
            variationSv1: valeurStockInitial - valeurStockFinal,
            quantitesTenues: note.quantitesTenues,
            sourceQuantites: note.source,
            motifQuantites: (0, stocks_depuis_inventaire_1.motifQuantitesNote2)(note, ", à partir de l'inventaire extra-comptable que le Titre X ch. 1 § 1 impose au responsable de l'entité"),
        };
    }
    async partsParEcheance(tenantId, exercice, compteIds) {
        const parCompte = new Map();
        if (compteIds.length === 0)
            return { parCompte, nommes: new Map() };
        const exerciceId = exercice.id;
        const lignesOuvertes = {
            ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE },
            ...(0, ouverte_a_la_cloture_1.ouverteALaCloture)(exercice.dateFin),
            compteId: { in: compteIds },
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
        const porter = (groupes, part) => {
            for (const g of groupes) {
                const parts = parCompte.get(g.compteId) ?? { ...PARTS_ECHEANCE_NULLES_SMT_SYSCOHADA };
                parts[part] += Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
                parCompte.set(g.compteId, parts);
            }
        };
        porter(nonEchues, 'nonEchu');
        porter(echues, 'echu');
        const { ecarts, nommes } = await (0, reste_des_lignes_ouvertes_1.ecartsDesGroupesParEcheance)(this.prisma, tenantId, lignesOuvertes, exercice.dateFin, 'NOTE 3 du SMT (SYSCOHADA)');
        for (const [compteId, e] of ecarts) {
            const parts = parCompte.get(compteId) ?? { ...PARTS_ECHEANCE_NULLES_SMT_SYSCOHADA };
            parts.nonEchu += e.nonEchu;
            parts.echu += e.echu;
            parCompte.set(compteId, parts);
        }
        return { parCompte, nommes };
    }
    async note3CreancesDettes(tenantId, exerciceId) {
        const [exercice, lignes] = await Promise.all([
            this.exerciceDuDossier(tenantId, exerciceId),
            this.chargerLignes(tenantId, exerciceId),
        ]);
        const { parRef: cloture } = this.resoudreBilan(lignes);
        const { parRef: ouverture } = this.resoudreBilan(this.aLOuverture(lignes));
        const nomParCompte = new Map();
        const rattachements = await this.prisma.tiersCompte.findMany({
            where: { tiers: { tenantId } },
            include: { tiers: { select: { nom: true } } },
        });
        const compteIdParNumero = new Map(lignes.map((l) => [l.numero, l.compteId]));
        for (const r of rattachements)
            nomParCompte.set(r.compteId, r.tiers.nom);
        const compteIdsVentilables = [
            ...new Set(REFS_NOTE_3_SMT_SYSCOHADA.flatMap((ref) => (cloture.get(ref)?.comptes ?? []).map((c) => compteIdParNumero.get(c.numero))).filter((id) => Boolean(id))),
        ];
        const { parCompte: parts, nommes } = await this.partsParEcheance(tenantId, { id: exerciceId, dateFin: exercice.dateFin }, compteIdsVentilables);
        const construire = (ref) => {
            const signe = signePosteBilanSmtSyscohada(ref);
            const parNumero = new Map();
            for (const c of ouverture.get(ref)?.comptes ?? []) {
                parNumero.set(c.numero, { cloture: 0, ouverture: c.montant, intitule: c.intitule });
            }
            for (const c of cloture.get(ref)?.comptes ?? []) {
                const existant = parNumero.get(c.numero);
                if (existant)
                    existant.cloture = c.montant;
                else
                    parNumero.set(c.numero, { cloture: c.montant, ouverture: 0, intitule: c.intitule });
            }
            return [...parNumero.entries()]
                .filter(([, v]) => Math.abs(v.cloture) > 0.005 || Math.abs(v.ouverture) > 0.005)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([numero, v]) => {
                const compteId = compteIdParNumero.get(numero);
                const p = (compteId && parts.get(compteId)) || PARTS_ECHEANCE_NULLES_SMT_SYSCOHADA;
                const montantNonEchu = signe * p.nonEchu;
                const montantEchu = signe * p.echu;
                return {
                    date: null,
                    numero,
                    nom: (compteId && nomParCompte.get(compteId)) || v.intitule,
                    montantCloture: v.cloture,
                    montantOuverture: v.ouverture,
                    variationValeur: v.ouverture - v.cloture,
                    variationPourcent: Math.abs(v.ouverture) < 0.005 ? null : ((v.cloture - v.ouverture) / Math.abs(v.ouverture)) * 100,
                    montantNonEchu,
                    montantEchu,
                    montantNonVentile: v.cloture - montantNonEchu - montantEchu,
                };
            });
        };
        const creances = construire(REFS_NOTE_3_SMT_SYSCOHADA[0]);
        const dettes = construire(REFS_NOTE_3_SMT_SYSCOHADA[1]);
        const totalCreancesNonVentilees = creances.reduce((s, c) => s + c.montantNonVentile, 0);
        const totalDettesNonVentilees = dettes.reduce((s, d) => s + d.montantNonVentile, 0);
        const echeancesTenues = Math.abs(totalCreancesNonVentilees) < 0.005 && Math.abs(totalDettesNonVentilees) < 0.005;
        return {
            creances,
            totalCreances: creances.reduce((s, c) => s + c.montantCloture, 0),
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
                : "Le Titre X intitule cette note « État des créances et des dettes non échues au 31 décembre » (ch. 1 § 2 et ch. 3). Une ligne de tiers sans date d'échéance n'est ni échue ni non échue : elle est portée à part, jamais rangée d'office dans le non échu. Renseignez la date d'échéance sur les lignes de tiers, et tenez les comptes de tiers en report à-nouveau mode DÉTAIL, pour que la ventilation soit complète. Les dépréciations 49 et 59 et les provisions 499 et 599, qui n'ont aucun terme à porter, restent par nature en part non ventilée.",
            groupesLusLigneALigne: await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(this.prisma, tenantId, nommes),
            variationSv2: creances.filter((c) => !(0, correspondance_smt_syscohada_1.estTiersHorsExploitationSmt)(c.numero)).reduce((s, c) => s + c.variationValeur, 0),
            variationSv3: dettes.filter((d) => !(0, correspondance_smt_syscohada_1.estTiersHorsExploitationSmt)(d.numero)).reduce((s, d) => s + d.variationValeur, 0),
            reserveVariationPourcent: "Le Titre X ch. 3 écrit que « la variation en pourcentage » alimente les lignes « variation des créances » et « variation des dettes d'exploitation » du compte de résultat. Un pourcentage ne s'additionne pas à des montants : la formule G = C - D + E - F ne boucle qu'avec la variation EN VALEUR, qui est celle portée au compte de résultat. La colonne « Variation % » de la maquette est servie telle quelle pour l'impression. Anomalie du texte officiel, signalée et non corrigée.",
        };
    }
    ficheNotes() {
        return {
            documents: correspondance_smt_syscohada_1.DOCUMENTS_SMT_SYSCOHADA,
            notes: correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA,
            journauxDeSuivi: correspondance_smt_syscohada_1.JOURNAUX_DE_SUIVI_SMT_SYSCOHADA,
            inventaireExtraComptable: correspondance_smt_syscohada_1.INVENTAIRE_EXTRA_COMPTABLE_SMT,
            amortissement: correspondance_smt_syscohada_1.AMORTISSEMENT_SMT,
        };
    }
    async etatsDesGaranties(tenantId) {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { formeJuridiqueSyscohada: true },
        });
        return (0, etats_garanties_smt_1.etatsDesGarantiesDus)(tenant.formeJuridiqueSyscohada);
    }
    async eligibilite(tenantId, exerciceId) {
        const [lignes, tenant] = await Promise.all([
            this.chargerLignes(tenantId, exerciceId),
            this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: { devise: true, systemeComptableSyscohada: true },
            }),
        ]);
        const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
        const lignesCa = lignes.filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, correspondance_smt_syscohada_1.COMPTES_CHIFFRE_AFFAIRES_ART13));
        const chiffreAffaires = lignesCa.reduce((s, l) => s - l.solde, 0);
        const ventilation = ['TA', 'TB', 'TC', 'TD'].map((ref) => {
            const poste = (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)(ref);
            const comptes = lignesCa
                .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, poste.comptes))
                .sort((a, b) => a.numero.localeCompare(b.numero))
                .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
            return {
                ref,
                libelle: poste.libelle,
                lettre: poste.lettre,
                montant: comptes.reduce((s, c) => s + c.montant, 0),
                comptes,
            };
        });
        const refsTaTd = ['TA', 'TB', 'TC', 'TD'].map((r) => (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)(r));
        const comptesHorsVentilation = lignesCa
            .filter((l) => !refsTaTd.some((p) => (0, etats_financiers_communs_1.correspond)(l.numero, p.comptes)))
            .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
        return {
            exercice,
            chiffreAffaires,
            ventilation,
            comptesHorsVentilation,
            deviseDossier: (0, monnaie_de_tenue_1.monnaieDuJeuLegal)(tenant.devise),
            systemeActuel: tenant.systemeComptableSyscohada,
            conversionAppliquee: false,
            seuils: correspondance_smt_syscohada_1.SEUILS_SMT_ART13_FCFA.map((s) => ({ ...s, clause: correspondance_smt_syscohada_1.CLAUSE_EQUIVALENT_ART13 })),
            qualificationParLEntite: "L'article 13 fixe trois seuils selon que l'entité relève du négoce, de l'artisanat ou des services. OmegaX ne qualifie pas l'activité du dossier à la place de l'entité : comparez le chiffre d'affaires au seuil de VOTRE catégorie.",
            rappelArticle11: "Article 11 : « Toute entité est, sauf exception liée à sa taille, soumise au Système normal de présentation des états financiers et de tenue des comptes. » Le Système minimal de trésorerie est l'exception, et l'article 13 la laisse optionnelle (« sauf option ») : une entité sous les seuils peut choisir de rester au Système normal.",
            avertissementConversion: "Les seuils de l'article 13 sont exprimés en F CFA, « ou l'équivalent dans l'unité monétaire ayant cours légal dans l'État partie ». OmegaX ne convertit pas : la RDC n'est pas en zone franc et le cours de conversion n'appartient pas au texte comptable. Comparez le chiffre d'affaires au seuil converti au cours que retient votre entité.",
        };
    }
};
exports.EtatsFinanciersSmtSyscohadaService = EtatsFinanciersSmtSyscohadaService;
exports.EtatsFinanciersSmtSyscohadaService = EtatsFinanciersSmtSyscohadaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ecriture_service_1.EcritureService,
        exercice_service_1.ExerciceService,
        prisma_service_1.PrismaService])
], EtatsFinanciersSmtSyscohadaService);
const PARTS_ECHEANCE_NULLES_SMT_SYSCOHADA = { nonEchu: 0, echu: 0 };
const REFS_NOTE_3_SMT_SYSCOHADA = ['SA3', 'SP4'];
function signePosteBilanSmtSyscohada(ref) {
    const poste = [...correspondance_smt_syscohada_1.POSTES_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA].find((p) => p.ref === ref);
    if (!poste)
        throw new Error(`Poste de bilan S.M.T SYSCOHADA inconnu : ${ref}`);
    return poste.sens === 'ACTIF' ? 1 : -1;
}
const SELECTION_ECRITURE_TRESORERIE_SMT = {
    id: true,
    date: true,
    createdAt: true,
    libelle: true,
    reference: true,
    lignes: {
        select: { id: true, compteId: true, debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
    },
};
exports.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA = ecriture_service_1.PLAFOND_LIGNES_GRAND_LIVRE;
const COMPTES_CAUTIONS_NOTE_1 = ['275'];
//# sourceMappingURL=etats-financiers-smt-syscohada.service.js.map