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
exports.IfrsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const cumul_service_1 = require("../consolidation/cumul.service");
const perimetre_service_1 = require("../consolidation/perimetre.service");
const exercice_requis_1 = require("../../common/exercice-requis");
const flux_capitaux_consolides_1 = require("../consolidation/flux-capitaux-consolides");
const cumul_consolidation_1 = require("../consolidation/cumul-consolidation");
const etats_ifrs_1 = require("./etats-ifrs");
const etats_ifrs_consolides_1 = require("./etats-ifrs-consolides");
const notes_ifrs_1 = require("./notes-ifrs");
const notes_ifrs12_1 = require("./notes-ifrs12");
const flux_tresorerie_ifrs_1 = require("./flux-tresorerie-ifrs");
const rubriques_ifrs_1 = require("./rubriques-ifrs");
const premiere_application_ifrs_1 = require("./premiere-application-ifrs");
const rubriques_ifrs_2 = require("./rubriques-ifrs");
const variation_capitaux_propres_ifrs_1 = require("./variation-capitaux-propres-ifrs");
const versMoteur = (r) => ({
    id: r.id,
    libelle: r.libelle,
    fondement: r.fondement,
    correctionErreur: r.correctionErreur,
    lignes: r.lignes.map((l) => ({ rubrique: l.rubrique, montant: l.montant })),
});
const versMoteurConsolide = (r) => ({
    ...versMoteur(r),
    partMinoritairesResultat: r.partMinoritairesResultat,
    partMinoritairesOci: r.partMinoritairesOci,
    partMinoritairesCapitauxPropres: r.partMinoritairesCapitauxPropres,
});
const nombreOuNull = (x) => (x == null ? null : Number(x));
const capitauxPropresD4c = (c) => {
    const x = c.capitauxPropres;
    return Math.round((x.capital + x.primes + x.ecartsReevaluation + x.reservesGroupe + x.ecartsConversion + x.resultatGroupe + x.interetsMinoritairesHorsResultat + x.resultatMinoritaires) * 100) / 100;
};
const REF_CAPITAUX_PROPRES_SYSCOHADA = 'CP';
const EPS = 0.005;
let IfrsService = class IfrsService {
    constructor(prisma, ecritures, etatsSyscohada, cumuls, perimetre) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.etatsSyscohada = etatsSyscohada;
        this.cumuls = cumuls;
        this.perimetre = perimetre;
    }
    async exercice(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        const ex = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true, dateFin: true } });
        if (!ex)
            throw new common_1.NotFoundException('Exercice introuvable dans ce dossier.');
        return ex;
    }
    async retraitementsDe(tenantId, exerciceId, aLaTransition = false, consolide = false) {
        const rs = await this.prisma.retraitementIfrs.findMany({
            where: { tenantId, exerciceId, aLaTransition, consolide },
            include: { lignes: { orderBy: { ordre: 'asc' } } },
            orderBy: { createdAt: 'asc' },
        });
        return rs.map((r) => ({
            ...r,
            partMinoritairesResultat: nombreOuNull(r.partMinoritairesResultat),
            partMinoritairesOci: nombreOuNull(r.partMinoritairesOci),
            partMinoritairesCapitauxPropres: nombreOuNull(r.partMinoritairesCapitauxPropres),
            lignes: r.lignes.map((l) => ({ ...l, montant: Number(l.montant) })),
        }));
    }
    async precedent(tenantId, dateDebut) {
        return this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lt: dateDebut } },
            orderBy: { dateFin: 'desc' },
            select: { id: true, dateDebut: true, dateFin: true },
        });
    }
    async mouvementsDe(tenantId, exerciceId, consolide = false) {
        const ms = await this.prisma.mouvementCapitauxPropresIfrs.findMany({ where: { tenantId, exerciceId, consolide }, orderBy: { createdAt: 'asc' } });
        return ms.map((m) => ({ ...m, montant: Number(m.montant) }));
    }
    async blocVariation(tenantId, exerciceId, cloture, ouverture) {
        if (!ouverture)
            return { bloc: null, motif: 'Sans état IFRS de l’exercice précédent, le rapprochement ouverture → clôture du § 107 c ne s’établit pas.' };
        try {
            return { bloc: (0, variation_capitaux_propres_ifrs_1.construireVariationCapitauxPropres)(cloture, ouverture, await this.mouvementsDe(tenantId, exerciceId)), motif: null };
        }
        catch (e) {
            if (e instanceof etats_ifrs_1.RefusIfrs)
                return { bloc: null, motif: e.message };
            throw e;
        }
    }
    async calculer(tenantId, ex, regles, activite, lignesChargees) {
        const lignes = lignesChargees ?? (await (0, etats_financiers_communs_1.chargerLignes)(this.ecritures, tenantId, ex.id));
        const retraitements = (await this.retraitementsDe(tenantId, ex.id)).map(versMoteur);
        try {
            return (0, etats_ifrs_1.construireEtatsIfrs)({ dateDebut: ex.dateDebut }, lignes.map((l) => ({ numero: l.numero, intitule: l.intitule, solde: Number(l.solde) })), regles, retraitements, activite ?? null);
        }
        catch (e) {
            if (e instanceof etats_ifrs_1.RefusIfrs)
                throw new common_1.BadRequestException(e.message);
            throw e;
        }
    }
    capitauxPropresSyscohada(lignes) {
        return this.etatsSyscohada.resoudreBilanSurLignes(lignes).resolution.parRef.get(REF_CAPITAUX_PROPRES_SYSCOHADA)?.montant ?? 0;
    }
    async premiereApplication(tenantId, comparatif, lignesComparatif, etatComparatif, regles, activite) {
        const ouvertureLegale = lignesComparatif
            .filter((l) => /^[1-5]/.test(l.numero))
            .map((l) => {
            const rd = Number(l.reportDebit ?? 0);
            const rc = Number(l.reportCredit ?? 0);
            return { ...l, totalDebit: rd, totalCredit: rc, mouvementDebit: 0, mouvementCredit: 0, solde: rd - rc };
        });
        const ajustements = (await this.retraitementsDe(tenantId, comparatif.id, true)).map(versMoteur);
        const retraitementsComparatif = (await this.retraitementsDe(tenantId, comparatif.id)).map(versMoteur);
        const ouverture = (0, etats_ifrs_1.construireEtatsIfrs)({ dateDebut: comparatif.dateDebut }, (0, premiere_application_ifrs_1.lignesOuverture)(ouvertureLegale.map((l) => ({ numero: l.numero, intitule: l.intitule, reportDebit: l.totalDebit, reportCredit: l.totalCredit }))), regles, ajustements, activite ?? null);
        return (0, premiere_application_ifrs_1.construirePremiereApplication)({
            dateTransition: comparatif.dateDebut,
            ouverture,
            ajustementsTransition: ajustements,
            capitauxPropresSyscohadaTransition: this.capitauxPropresSyscohada(ouvertureLegale),
            comparatif: etatComparatif,
            retraitementsComparatif,
            capitauxPropresSyscohadaComparatif: this.capitauxPropresSyscohada(lignesComparatif),
        });
    }
    async fluxDe(tenantId, exerciceId, etat, lignesN, lignesN1, regles, parametres) {
        if (!lignesN1) {
            return { tableau: null, motif: 'Sans l’exercice précédent, les variations et les flux du tableau SYSCOHADA de départ ne se lisent pas.' };
        }
        const { montants, reserves } = this.etatsSyscohada.resoudreFluxDetailleSurLignes(lignesN, lignesN1, await this.ecritures.mouvementsDeReevaluation(tenantId, exerciceId));
        const cafgParCategorie = this.cafgParCategorie(lignesN, lignesN1, regles);
        const decouverts = parametres?.decouvertsDansTresorerie ?? null;
        const effet = await this.prisma.effetChangeTresorerieIfrs.findUnique({
            where: { tenantId_exerciceId_consolide: { tenantId, exerciceId, consolide: false } },
        });
        const tableau = (0, flux_tresorerie_ifrs_1.construireFluxTresorerieIfrs)({
            etat,
            fluxLegaux: Object.fromEntries(montants),
            cafgParCategorie,
            tresorerie: this.perimetreTresorerie(lignesN, lignesN1, regles, decouverts),
            declarations: {
                decouvertsDansTresorerie: decouverts,
                tresorerieEnDevises: parametres?.tresorerieEnDevises ?? null,
                effetChange: effet ? { montant: Number(effet.montant), categorie: effet.categorie } : null,
            },
            reservesLegales: reserves,
        });
        this.controlerCafg(tableau, cafgParCategorie, montants.get('FA') ?? 0, 'la CAFG légale');
        return { tableau, motif: null };
    }
    cafgParCategorie(lignesN, lignesN1, regles) {
        const categorie = (numero) => {
            const code = (0, etats_ifrs_1.rubriqueDuCompte)(numero, regles);
            return (code && rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(code)?.categorie) ?? 'OPERATIONNELLE';
        };
        const cafg = {};
        for (const c of flux_tresorerie_ifrs_1.CATEGORIES_FLUX) {
            const sousEnsemble = lignesN.filter((l) => /^[678]/.test(l.numero) && categorie(l.numero) === c);
            cafg[c] = sousEnsemble.length ? this.etatsSyscohada.resoudreFluxSurLignes(sousEnsemble, lignesN1).get('FA') ?? 0 : 0;
        }
        return cafg;
    }
    controlerCafg(tableau, cafg, reference, nom) {
        const ecart = Math.round((flux_tresorerie_ifrs_1.CATEGORIES_FLUX.reduce((s, c) => s + cafg[c], 0) - reference) * 100) / 100;
        if (Math.abs(ecart) > EPS) {
            tableau.motifsNonPubliable.push(`Tableau des flux IFRS · la CAFG répartie par catégorie diffère de ${nom} de ${ecart}.`);
        }
    }
    perimetreTresorerie(lignesN, lignesN1, regles, decouverts) {
        const bilanN = this.etatsSyscohada.resoudreBilanSurLignes(lignesN).resolution.parRef;
        const bilanN1 = this.etatsSyscohada.resoudreBilanSurLignes(lignesN1).resolution.parRef;
        const numeros = (ref) => [...(bilanN.get(ref)?.comptes ?? []), ...(bilanN1.get(ref)?.comptes ?? [])].map((c) => c.numero);
        const passif = new Set(numeros('DT'));
        const legale = new Set([...numeros('BT'), ...passif]);
        const soldeN = new Map(lignesN.map((l) => [l.numero, Number(l.solde)]));
        const soldeN1 = new Map(lignesN1.map((l) => [l.numero, Number(l.solde)]));
        const intitules = new Map([...lignesN1, ...lignesN].map((l) => [l.numero, l.intitule]));
        const bilan = [...new Set([...soldeN.keys(), ...soldeN1.keys()])].filter((n) => /^[1-5]/.test(n));
        const rangee = new Set(bilan.filter((n) => (0, etats_ifrs_1.rubriqueDuCompte)(n, regles) === 'SF_TRESORERIE'));
        const incluse = new Set([...rangee, ...(decouverts ? [...passif] : [])]);
        const somme = (m, xs) => [...xs].reduce((s, n) => s + (m.get(n) ?? 0), 0);
        return {
            ouverture: somme(soldeN1, incluse),
            cloture: somme(soldeN, incluse),
            horsTresorerieIfrs: [...legale]
                .filter((n) => !incluse.has(n))
                .map((n) => ({
                numero: n,
                intitule: intitules.get(n) ?? n,
                activite: passif.has(n) ? 'FINANCEMENT' : 'INVESTISSEMENT',
                variation: (soldeN.get(n) ?? 0) - (soldeN1.get(n) ?? 0),
            }))
                .filter((c) => Math.abs(c.variation) > EPS),
            horsBilanLegal: [...rangee].filter((n) => !legale.has(n) && (Math.abs(soldeN.get(n) ?? 0) > EPS || Math.abs(soldeN1.get(n) ?? 0) > EPS)),
            decouvertsInclus: decouverts ? somme(soldeN, [...passif].filter((n) => !rangee.has(n))) : 0,
            tresoreriePassive: Math.abs(bilanN.get('DT')?.montant ?? 0) > EPS || Math.abs(bilanN1.get('DT')?.montant ?? 0) > EPS,
        };
    }
    async etat(tenantId, exerciceId) {
        const ex = await this.exercice(tenantId, exerciceId);
        const [parametres, regles, retraitements] = await Promise.all([
            this.prisma.parametresIfrs.findUnique({ where: { tenantId } }),
            this.prisma.regleCorrespondanceIfrs.findMany({ where: { tenantId }, orderBy: { prefixe: 'asc' } }),
            this.retraitementsDe(tenantId, ex.id),
        ]);
        const activite = parametres?.activitePrincipale ?? null;
        const premierId = parametres?.premierExerciceIfrsId ?? null;
        const dejaAdoptant = parametres?.dejaAdoptant ?? false;
        const r = regles.map((x) => ({ prefixe: x.prefixe, rubrique: x.rubrique }));
        const lignesN = await (0, etats_financiers_communs_1.chargerLignes)(this.ecritures, tenantId, ex.id);
        const n = await this.calculer(tenantId, ex, r, activite, lignesN);
        const precedent = await this.precedent(tenantId, ex.dateDebut);
        let n1 = null;
        let motifN1 = null;
        let lignesN1 = [];
        if (!precedent)
            motifN1 = 'Aucun exercice précédent dans le dossier · la colonne comparative est vide.';
        else {
            try {
                lignesN1 = await (0, etats_financiers_communs_1.chargerLignes)(this.ecritures, tenantId, precedent.id);
                n1 = await this.calculer(tenantId, precedent, r, activite, lignesN1);
            }
            catch (e) {
                motifN1 = `Le comparatif ne s’établit pas · ${e.message}`;
            }
        }
        let premiereApplication = null;
        let motifPremiereApplication = null;
        const estPremier = premierId === ex.id;
        if (!premierId && !dejaAdoptant) {
            n.motifsNonPubliable.push('Première application non déclarée · les premiers états financiers IFRS relèvent d’IFRS 1 (§ 2 et 3). Déclarez le premier exercice IFRS du dossier, ou que l’entité présente déjà des états conformes aux IFRS (§ 4 et 5).');
        }
        if (estPremier) {
            if (!precedent || !n1) {
                motifPremiereApplication = `Le premier exercice IFRS présente au moins un exercice comparatif (IFRS 1 § 21), dont l’ouverture est la date de transition (annexe A) · ${motifN1 ?? 'il manque au dossier.'}`;
            }
            else {
                try {
                    premiereApplication = await this.premiereApplication(tenantId, precedent, lignesN1, n1, r, activite);
                }
                catch (e) {
                    if (!(e instanceof etats_ifrs_1.RefusIfrs))
                        throw e;
                    motifPremiereApplication = e.message;
                }
            }
            if (premiereApplication)
                n.motifsNonPubliable.push(...premiereApplication.motifsNonPubliable);
            else
                n.motifsNonPubliable.push(`Première application non établie · ${motifPremiereApplication}`);
        }
        else if (premierId && !dejaAdoptant) {
            const premier = await this.prisma.exercice.findFirst({ where: { id: premierId, tenantId }, select: { id: true, dateDebut: true, dateFin: true } });
            const comparatifDuPremier = premier ? await this.precedent(tenantId, premier.dateDebut) : null;
            const debutTransition = comparatifDuPremier?.dateDebut ?? premier?.dateDebut;
            if (debutTransition && ex.dateFin.getTime() < debutTransition.getTime()) {
                n.motifsNonPubliable.push('Exercice antérieur à la date de transition aux IFRS (IFRS 1, annexe A) · ces états projettent la balance légale sur les rubriques IFRS, ils ne sont pas des états IFRS.');
            }
        }
        let n2 = null;
        const avantPrecedent = precedent && n1 ? await this.precedent(tenantId, precedent.dateDebut) : null;
        const lignesN2 = avantPrecedent ? await (0, etats_financiers_communs_1.chargerLignes)(this.ecritures, tenantId, avantPrecedent.id) : null;
        if (avantPrecedent && !estPremier) {
            try {
                n2 = await this.calculer(tenantId, avantPrecedent, r, activite, lignesN2);
            }
            catch {
                n2 = null;
            }
        }
        if (estPremier && premiereApplication)
            n2 = premiereApplication.ouverture;
        const blocN = await this.blocVariation(tenantId, ex.id, n, n1);
        const blocN1 = precedent && n1
            ? await this.blocVariation(tenantId, precedent.id, n1, n2)
            : { bloc: null, motif: motifN1 };
        if (blocN.bloc) {
            n.motifsNonPubliable.push(...blocN.bloc.motifsNonPubliable);
            n.mentions.push(...blocN.bloc.mentions);
        }
        else {
            n.motifsNonPubliable.push(`État des variations des capitaux propres non établi · ${blocN.motif}`);
        }
        if (!blocN1.bloc) {
            n.motifsNonPubliable.push(`Bloc comparatif de l’état des variations des capitaux propres non établi (IFRS 18 § 10 f) · ${blocN1.motif ?? 'l’exercice précédent n’a pas d’état IFRS.'}`);
        }
        const fluxN = await this.fluxDe(tenantId, ex.id, n, lignesN, precedent && n1 ? lignesN1 : null, r, parametres);
        const fluxN1 = precedent && n1
            ? await this.fluxDe(tenantId, precedent.id, n1, lignesN1, lignesN2, r, parametres)
            : { tableau: null, motif: motifN1 };
        if (fluxN.tableau)
            n.motifsNonPubliable.push(...fluxN.tableau.motifsNonPubliable);
        else
            n.motifsNonPubliable.push(`Tableau des flux de trésorerie non établi · ${fluxN.motif}`);
        if (!fluxN1.tableau) {
            n.motifsNonPubliable.push(`Tableau des flux de trésorerie comparatif non établi (IFRS 18 § 10 f) · ${fluxN1.motif ?? 'l’exercice précédent n’a pas d’état IFRS.'}`);
        }
        const [notesN, notesN1, tenant, mouvements] = await Promise.all([
            this.prisma.notesIfrs.findUnique({ where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: ex.id, consolide: false } } }),
            precedent ? this.prisma.notesIfrs.findUnique({ where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: precedent.id, consolide: false } } }) : Promise.resolve(null),
            this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { nom: true, pays: true, adresse: true, ville: true, activite: true } }),
            this.mouvementsDe(tenantId, ex.id),
        ]);
        const declarationsNotes = (0, notes_ifrs_1.normaliserDeclarationsNotes)(notesN?.contenu ?? {});
        const declarationsNotesN1 = notesN1 ? (0, notes_ifrs_1.normaliserDeclarationsNotes)(notesN1.contenu) : null;
        const notes = (0, notes_ifrs_1.construireNotesIfrs)({
            declarations: declarationsNotes,
            declarationsN1: declarationsNotesN1,
            ficheDossier: {
                nom: tenant?.nom ?? '',
                formeJuridique: null,
                pays: tenant?.pays ?? null,
                adresse: [tenant?.adresse, tenant?.ville].filter((x) => x?.trim()).join(', ') || null,
                activite: tenant?.activite ?? null,
            },
            n,
            n1,
            retraitements: retraitements.map(versMoteur),
            premiereApplication,
            distributionsDeclarees: mouvements.some((m) => m.type === 'DISTRIBUTION'),
            applicationAnticipee: ex.dateDebut.getTime() < etats_ifrs_1.ENTREE_EN_VIGUEUR_IFRS18,
            motifsJeu: [...n.motifsNonPubliable],
        });
        n.motifsNonPubliable.push(...notes.motifsNonPubliable);
        return {
            notes: { ...notes, declarations: declarationsNotes, declarationsN1: declarationsNotesN1, sousTotauxReference: notes_ifrs_1.SOUS_TOTAUX_REFERENCE },
            activitePrincipale: activite,
            premierExerciceIfrsId: premierId,
            decouvertsDansTresorerie: parametres?.decouvertsDansTresorerie ?? null,
            tresorerieEnDevises: parametres?.tresorerieEnDevises ?? null,
            effetChange: await this.prisma.effetChangeTresorerieIfrs.findUnique({ where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: ex.id, consolide: false } } }),
            fluxTresorerie: { n: fluxN.tableau, motifN: fluxN.motif, n1: fluxN1.tableau, motifN1: fluxN1.motif },
            dejaAdoptant,
            regles,
            retraitements,
            exerciceTransitionId: estPremier ? (precedent?.id ?? null) : null,
            ajustementsTransition: precedent && estPremier ? await this.retraitementsDe(tenantId, precedent.id, true) : [],
            rubriques: rubriques_ifrs_2.RUBRIQUES_IFRS,
            groupes: etats_ifrs_1.LIBELLES_GROUPES,
            n,
            n1,
            motifN1,
            premiereApplication,
            motifPremiereApplication,
            variationCapitauxPropres: {
                composantes: { CAPITAL: variation_capitaux_propres_ifrs_1.COMPOSANTES_CP.CAPITAL, RESERVES: variation_capitaux_propres_ifrs_1.COMPOSANTES_CP.RESERVES, AUTRES_COMPOSANTES: variation_capitaux_propres_ifrs_1.COMPOSANTES_CP.AUTRES_COMPOSANTES },
                n: blocN.bloc,
                motifN: blocN.motif,
                n1: blocN1.bloc,
                motifN1: blocN1.motif,
                mouvements,
            },
        };
    }
    async etatConsolide(tenantId, exerciceId) {
        const ex = await this.exercice(tenantId, exerciceId);
        const [parametres, regles, reglesConsolidation, retraitements] = await Promise.all([
            this.prisma.parametresIfrs.findUnique({ where: { tenantId } }),
            this.prisma.regleCorrespondanceIfrs.findMany({ where: { tenantId }, orderBy: { prefixe: 'asc' } }),
            this.prisma.regleConsolidationIfrs.findMany({ where: { tenantId }, orderBy: { poste: 'asc' } }),
            this.retraitementsDe(tenantId, ex.id, false, true),
        ]);
        const activite = parametres?.activitePrincipale ?? null;
        const r = regles.map((x) => ({ prefixe: x.prefixe, rubrique: x.rubrique }));
        const rc = reglesConsolidation.map((x) => ({ poste: x.poste, rubrique: x.rubrique }));
        const commun = {
            activitePrincipale: activite,
            regles,
            reglesConsolidation,
            retraitements,
            rubriques: rubriques_ifrs_2.RUBRIQUES_IFRS,
            groupes: etats_ifrs_1.LIBELLES_GROUPES,
            postesRanges: Object.entries(etats_ifrs_consolides_1.POSTES_RANGES).map(([poste, v]) => ({ poste, libelle: cumul_consolidation_1.LIBELLE_POSTE[poste], ...v })),
            postesADeclarer: etats_ifrs_consolides_1.POSTES_A_DECLARER.map((poste) => ({ poste, libelle: cumul_consolidation_1.LIBELLE_POSTE[poste] })),
            decouvertsDansTresorerie: parametres?.decouvertsDansTresorerie ?? null,
            tresorerieGroupeEnDevises: parametres?.tresorerieGroupeEnDevises ?? null,
            premierExerciceIfrsConsolideId: parametres?.premierExerciceIfrsConsolideId ?? null,
            dejaAdoptantConsolide: parametres?.dejaAdoptantConsolide ?? false,
            exemptionRegroupementsC1: parametres?.exemptionRegroupementsC1 ?? null,
            effetChange: await this.prisma.effetChangeTresorerieIfrs.findUnique({
                where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: ex.id, consolide: true } },
            }),
        };
        const cumulsLus = new Map();
        const cumulDe = (id) => {
            if (!cumulsLus.has(id))
                cumulsLus.set(id, this.cumuls.cumul(tenantId, id));
            return cumulsLus.get(id);
        };
        const comparaisonDe = async (e, cumul, avant) => {
            if (!avant)
                return { cumulPrecedent: null, changements: [] };
            let cumulPrecedent = null;
            try {
                cumulPrecedent = await cumulDe(avant.id);
            }
            catch (err) {
                if (!(err instanceof common_1.BadRequestException))
                    throw err;
            }
            if (!cumulPrecedent || (!(0, etats_ifrs_consolides_1.aDesEcartsDeConversion)(cumul) && !(0, etats_ifrs_consolides_1.aDesEcartsDeConversion)(cumulPrecedent)))
                return { cumulPrecedent, changements: [] };
            const [pn, pn1] = await Promise.all([this.perimetre.etat(tenantId, e.id), this.perimetre.etat(tenantId, avant.id)]);
            return { cumulPrecedent, changements: (0, flux_capitaux_consolides_1.changementsDuPerimetre)(pn.resultats, pn1.resultats) };
        };
        const jouer = async (e, retr, avant) => {
            const cumul = await cumulDe(e.id);
            const comparaison = avant === undefined ? undefined : await comparaisonDe(e, cumul, avant);
            try {
                return { etat: (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)({ dateDebut: e.dateDebut }, cumul, r, rc, retr.map(versMoteurConsolide), activite, comparaison), cumul };
            }
            catch (err) {
                if (err instanceof etats_ifrs_1.RefusIfrs)
                    throw new common_1.BadRequestException(err.message);
                throw err;
            }
        };
        const precedent = await this.precedent(tenantId, ex.dateDebut);
        const avant = precedent ? await this.precedent(tenantId, precedent.dateDebut) : null;
        let n;
        let cumulN;
        try {
            ({ etat: n, cumul: cumulN } = await jouer(ex, retraitements, precedent));
        }
        catch (e) {
            if (!(e instanceof common_1.BadRequestException))
                throw e;
            return {
                ...commun,
                n: null,
                motifN: e.message,
                n1: null,
                motifN1: null,
                fluxTresorerie: null,
                variationCapitauxPropres: null,
                notes: null,
                premiereApplication: null,
                motifPremiereApplication: null,
                exerciceTransitionId: null,
                ajustementsTransition: [],
            };
        }
        let n1 = null;
        let cumulN1 = null;
        let motifN1 = null;
        if (!precedent)
            motifN1 = 'Aucun exercice précédent dans le dossier · la colonne comparative est vide.';
        else {
            try {
                ({ etat: n1, cumul: cumulN1 } = await jouer(precedent, await this.retraitementsDe(tenantId, precedent.id, false, true), avant));
            }
            catch (e) {
                if (!(e instanceof common_1.BadRequestException))
                    throw e;
                motifN1 = `L’exercice précédent ne se consolide pas · ${e.message}`;
            }
        }
        if (!n1)
            n.motifsNonPubliable.push(`Comparatif consolidé non établi (IFRS 18 § 10 f) · ${motifN1}`);
        const tresorerie = { decouvertsDansTresorerie: commun.decouvertsDansTresorerie, tresorerieGroupeEnDevises: commun.tresorerieGroupeEnDevises };
        const fluxN = precedent && cumulN1
            ? await this.fluxConsolideDe(tenantId, ex.id, precedent, n, cumulN, cumulN1, r, tresorerie, activite)
            : { tableau: null, motif: `Sans consolidation de l’exercice précédent, le tableau des flux consolidé ne s’établit pas · ${motifN1}` };
        let fluxN1 = { tableau: null, motif: 'Sans comparatif consolidé, pas de tableau des flux comparatif.' };
        let n2 = null;
        let cumulN2 = null;
        let motifN2 = 'Aucun exercice avant l’exercice précédent dans le dossier.';
        if (precedent && n1 && cumulN1) {
            if (avant) {
                try {
                    ({ etat: n2, cumul: cumulN2 } = await jouer(avant, await this.retraitementsDe(tenantId, avant.id, false, true)));
                }
                catch (e) {
                    if (!(e instanceof common_1.BadRequestException))
                        throw e;
                    motifN2 = `L’exercice N-2 ne se consolide pas · ${e.message}`;
                }
            }
            fluxN1 =
                avant && cumulN2
                    ? await this.fluxConsolideDe(tenantId, precedent.id, avant, n1, cumulN1, cumulN2, r, tresorerie, activite)
                    : { tableau: null, motif: `Le tableau des flux comparatif ne s’établit pas · ${motifN2}` };
        }
        const ia1 = await this.premiereApplicationConsolidee(tenantId, ex, precedent, n, n1, motifN1, cumulN1, cumulN2, motifN2, r, rc, activite, parametres);
        if (ia1.estPremier)
            n2 = ia1.premiereApplication?.ouverture ?? null;
        const blocConsolide = async (exerciceId, cloture, ouverture, motifSansOuverture) => {
            if (!ouverture)
                return { bloc: null, motif: motifSansOuverture };
            try {
                return { bloc: (0, variation_capitaux_propres_ifrs_1.construireVariationCapitauxPropresConsolidee)(cloture, ouverture, await this.mouvementsDe(tenantId, exerciceId, true)), motif: null };
            }
            catch (e) {
                if (e instanceof etats_ifrs_1.RefusIfrs)
                    return { bloc: null, motif: e.message };
                throw e;
            }
        };
        const variationN = await blocConsolide(ex.id, n, n1, `Sans consolidation de l’exercice précédent, le rapprochement ouverture → clôture ne s’établit pas · ${motifN1}`);
        const variationN1 = precedent && n1
            ? await blocConsolide(precedent.id, n1, n2, `Le bloc comparatif part de la clôture N-2 · ${motifN2}`)
            : { bloc: null, motif: 'Sans comparatif consolidé, pas de bloc comparatif.' };
        if (variationN.bloc)
            n.motifsNonPubliable.push(...variationN.bloc.motifsNonPubliable);
        else
            n.motifsNonPubliable.push(`État des variations des capitaux propres consolidé non établi (IFRS 18 § 107) · ${variationN.motif}`);
        if (variationN.bloc && !variationN1.bloc) {
            n.motifsNonPubliable.push(`Bloc comparatif de la variation des capitaux propres consolidée non établi (IFRS 18 § 10 f) · ${variationN1.motif}`);
        }
        if (fluxN.tableau)
            n.motifsNonPubliable.push(...fluxN.tableau.motifsNonPubliable);
        else
            n.motifsNonPubliable.push(`Tableau des flux de trésorerie consolidé non établi (IAS 7, IFRS 18 § 10 d) · ${fluxN.motif}`);
        if (fluxN.tableau && !fluxN1.tableau)
            n.motifsNonPubliable.push(`Tableau des flux consolidé comparatif non établi (IFRS 18 § 10 f) · ${fluxN1.motif}`);
        const [notesN, notesN1, tenant, mouvementsGroupe, perimetreN] = await Promise.all([
            this.prisma.notesIfrs.findUnique({ where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: ex.id, consolide: true } } }),
            precedent
                ? this.prisma.notesIfrs.findUnique({ where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: precedent.id, consolide: true } } })
                : Promise.resolve(null),
            this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { nom: true, pays: true, adresse: true, ville: true, activite: true } }),
            this.mouvementsDe(tenantId, ex.id, true),
            this.perimetre.etat(tenantId, ex.id),
        ]);
        const declarationsIfrs12 = (0, notes_ifrs12_1.normaliserDeclarationsIfrs12)(notesN?.ifrs12 ?? {});
        const ifrs = (liste, cle) => n[liste].find((l) => l.cle === cle)?.ifrs ?? 0;
        const ifrs12 = (0, notes_ifrs12_1.construireNoteIfrs12)({
            entites: perimetreN.resultats,
            declarations: declarationsIfrs12,
            totaux: { resultatMinoritaires: ifrs('resultat', 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'), cumulMinoritaires: ifrs('situation', 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE') },
            variationsPartsInterets: mouvementsGroupe
                .filter((m) => m.type === 'VARIATION_PARTS_INTERETS')
                .map((m) => ({ libelle: m.libelle, groupe: m.composante === 'MINORITAIRES' ? 0 : m.montant, minoritaires: m.composante === 'MINORITAIRES' ? m.montant : 0 })),
        });
        n.motifsNonPubliable.push(...ifrs12.motifs);
        const declarationsNotes = (0, notes_ifrs_1.normaliserDeclarationsNotes)(notesN?.contenu ?? {});
        const declarationsNotesN1 = notesN1 ? (0, notes_ifrs_1.normaliserDeclarationsNotes)(notesN1.contenu) : null;
        const notes = (0, notes_ifrs_1.construireNotesIfrs)({
            declarations: declarationsNotes,
            declarationsN1: declarationsNotesN1,
            ficheDossier: {
                nom: tenant?.nom ?? '',
                formeJuridique: null,
                pays: tenant?.pays ?? null,
                adresse: [tenant?.adresse, tenant?.ville].filter((x) => x?.trim()).join(', ') || null,
                activite: tenant?.activite ?? null,
            },
            n,
            n1,
            retraitements: retraitements.map(versMoteurConsolide),
            premiereApplication: ia1.premiereApplication,
            distributionsDeclarees: mouvementsGroupe.some((m) => m.type === 'DISTRIBUTION'),
            applicationAnticipee: ex.dateDebut.getTime() < etats_ifrs_1.ENTREE_EN_VIGUEUR_IFRS18,
            motifsJeu: [...n.motifsNonPubliable],
        });
        const numero = notes.notes.length + 1;
        notes.notes.push({ ...ifrs12.note, numero });
        for (const cle of ifrs12.note.postes)
            (notes.renvois[cle] ??= []).push(numero);
        n.motifsNonPubliable.push(...notes.motifsNonPubliable);
        return {
            ...commun,
            n,
            motifN: null,
            n1,
            motifN1,
            fluxTresorerie: { n: fluxN.tableau, motifN: fluxN.motif, n1: fluxN1.tableau, motifN1: fluxN1.motif },
            premiereApplication: ia1.premiereApplication,
            motifPremiereApplication: ia1.motif,
            exerciceTransitionId: ia1.estPremier ? (precedent?.id ?? null) : null,
            ajustementsTransition: ia1.estPremier && precedent ? await this.retraitementsDe(tenantId, precedent.id, true, true) : [],
            notes: {
                ...notes,
                declarations: declarationsNotes,
                declarationsN1: declarationsNotesN1,
                sousTotauxReference: notes_ifrs_1.SOUS_TOTAUX_REFERENCE,
                ifrs12: declarationsIfrs12,
                entitesIfrs12: perimetreN.resultats.map((e) => ({ nom: e.nom, methode: e.methode, estConsolidante: e.estConsolidante, pctInteret: e.pctInteret, natureControle: e.natureControle, exclue: e.exclusion != null })),
            },
            variationCapitauxPropres: {
                composantes: variation_capitaux_propres_ifrs_1.COMPOSANTES_CP,
                n: variationN.bloc,
                motifN: variationN.motif,
                n1: variationN1.bloc,
                motifN1: variationN1.motif,
                mouvements: await this.mouvementsDe(tenantId, ex.id, true),
            },
        };
    }
    async premiereApplicationConsolidee(tenantId, ex, precedent, n, n1, motifN1, cumulN1, cumulN2, motifN2, regles, reglesConsolidation, activite, parametres) {
        const premierId = parametres?.premierExerciceIfrsConsolideId ?? null;
        const deja = parametres?.dejaAdoptantConsolide ?? false;
        const estPremier = premierId === ex.id;
        if (!premierId && !deja) {
            n.motifsNonPubliable.push('Première application consolidée non déclarée · les premiers états consolidés IFRS relèvent d’IFRS 1 (§ 2 et 3). Déclarez le premier exercice IFRS du groupe, ou qu’il présente déjà des états consolidés conformes aux IFRS (§ 4 et 5).');
            return { estPremier, premiereApplication: null, motif: null };
        }
        if (!estPremier) {
            if (premierId && !deja) {
                const premier = await this.prisma.exercice.findFirst({ where: { id: premierId, tenantId }, select: { dateDebut: true } });
                const comparatifDuPremier = premier ? await this.precedent(tenantId, premier.dateDebut) : null;
                const debutTransition = comparatifDuPremier?.dateDebut ?? premier?.dateDebut;
                if (debutTransition && ex.dateFin.getTime() < debutTransition.getTime()) {
                    n.motifsNonPubliable.push('Exercice antérieur à la date de transition du groupe aux IFRS (IFRS 1, annexe A) · ces états projettent la consolidation du D4C sur les rubriques IFRS, ils ne sont pas des états IFRS.');
                }
            }
            return { estPremier, premiereApplication: null, motif: null };
        }
        let motif = null;
        let premiereApplication = null;
        if (!precedent || !n1 || !cumulN1) {
            motif = `Le premier exercice IFRS du groupe présente au moins un exercice comparatif (IFRS 1 § 21), dont l’ouverture est la date de transition (annexe A) · ${motifN1 ?? 'il manque au dossier.'}`;
        }
        else if (!cumulN2) {
            motif = `L’état d’ouverture à la date de transition est la consolidation de clôture de l’exercice qui précède le comparatif · ${motifN2}`;
        }
        else {
            const ajustements = (await this.retraitementsDe(tenantId, precedent.id, true, true)).map(versMoteurConsolide);
            const retraitementsComparatif = (await this.retraitementsDe(tenantId, precedent.id, false, true)).map(versMoteurConsolide);
            try {
                const ouverture = (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)({ dateDebut: precedent.dateDebut }, cumulN2, regles, reglesConsolidation, ajustements, activite ?? null);
                premiereApplication = (0, premiere_application_ifrs_1.construirePremiereApplication)({
                    dateTransition: precedent.dateDebut,
                    ouverture,
                    ajustementsTransition: ajustements,
                    capitauxPropresSyscohadaTransition: capitauxPropresD4c(cumulN2),
                    comparatif: n1,
                    retraitementsComparatif,
                    capitauxPropresSyscohadaComparatif: capitauxPropresD4c(cumulN1),
                });
            }
            catch (e) {
                if (!(e instanceof etats_ifrs_1.RefusIfrs))
                    throw e;
                motif = e.message;
            }
        }
        if (premiereApplication) {
            for (const r of premiereApplication.rapprochements)
                r.lignes[0].libelle = 'Capitaux propres consolidés selon le D4C (part du groupe et minoritaires)';
            const c1 = parametres?.exemptionRegroupementsC1 ?? null;
            if (c1 === true) {
                premiereApplication.mentions.push('IFRS 1 § C1 · les regroupements d’entreprises antérieurs à la date de transition ne sont pas retraités selon IFRS 3 · l’écart d’acquisition de l’ouverture est sa valeur comptable selon l’AUDCIF, sans ajustement de son amortissement antérieur (§ C4 g et h ii) ; un test de dépréciation selon IAS 36 est dû à la date de transition (§ C4 g ii), et son effet se déclare en ajustement de transition.');
            }
            else if (c1 === false) {
                premiereApplication.mentions.push('IFRS 1 § C1 · les regroupements d’entreprises antérieurs sont retraités selon IFRS 3, et IFRS 10 appliquée depuis le premier retraité · l’effet sur l’écart d’acquisition et les capitaux propres se déclare en ajustements de transition.');
            }
            else {
                premiereApplication.motifsNonPubliable.push('Première application consolidée · déclarez si les regroupements d’entreprises antérieurs à la date de transition sont retraités selon IFRS 3 ou non (IFRS 1 § C1) · le choix décide de l’écart d’acquisition de l’ouverture.');
            }
            n.motifsNonPubliable.push(...premiereApplication.motifsNonPubliable);
        }
        else
            n.motifsNonPubliable.push(`Première application consolidée non établie · ${motif}`);
        return { estPremier, premiereApplication, motif };
    }
    async fluxConsolideDe(tenantId, exerciceId, precedent, etat, cumulN, cumulN1, regles, declarations, activite) {
        const [perimetreN, perimetreN1] = await Promise.all([this.perimetre.etat(tenantId, exerciceId), this.perimetre.etat(tenantId, precedent.id)]);
        if (perimetreN1.entites.length === 0) {
            return { tableau: null, motif: 'Aucun périmètre déclaré pour l’exercice précédent · les flux ne se lisent pas sur la seule consolidante.' };
        }
        const [consolidanteN, consolidanteN1] = await Promise.all([
            this.cumuls.lignesConsolidante(tenantId, exerciceId),
            this.cumuls.lignesConsolidante(tenantId, precedent.id),
        ]);
        const resolveur = (ln, ln1) => this.etatsSyscohada.resoudreFluxSurLignes(ln, ln1);
        const d4c = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)({ cumulN, cumulN1, consolidanteN, consolidanteN1, variationsPerimetre: (0, flux_capitaux_consolides_1.variationsDuPerimetre)(perimetreN.resultats, perimetreN1.resultats) }, resolveur);
        if (!d4c.lignes)
            return { tableau: null, motif: `Le tableau des flux consolidé du D4C ne s’établit pas · ${d4c.obstacles.join(' · ')}` };
        const d = (cle) => d4c.lignes?.find((l) => l.cle === cle)?.net ?? 0;
        const lignesN = (0, flux_capitaux_consolides_1.lignesAvecMouvements)(cumulN);
        const lignesN1 = (0, flux_capitaux_consolides_1.lignesAvecMouvements)(cumulN1);
        const { montants, reserves } = this.etatsSyscohada.resoudreFluxDetailleSurLignes(lignesN, lignesN1);
        const mere = resolveur(consolidanteN, consolidanteN1);
        const fluxLegaux = {
            ...Object.fromEntries(montants),
            FK: mere.get('FK') ?? 0,
            FM: mere.get('FM') ?? 0,
            FN: mere.get('FN') ?? 0,
            ZB: d('FLUX_OPERATIONNELS'),
            ZC: d('FLUX_INVESTISSEMENT'),
            ZF: d('FLUX_FINANCEMENT'),
            ZG: d('VARIATION_PERIODE'),
        };
        const cafgParCategorie = this.cafgParCategorie(lignesN, lignesN1, regles);
        cafgParCategorie.OPERATIONNELLE += d('CAFG') - (montants.get('FA') ?? 0);
        const effet = await this.prisma.effetChangeTresorerieIfrs.findUnique({
            where: { tenantId_exerciceId_consolide: { tenantId, exerciceId, consolide: true } },
        });
        const tableau = (0, flux_tresorerie_ifrs_1.construireFluxTresorerieIfrs)({
            etat,
            fluxLegaux,
            cafgParCategorie,
            tresorerie: this.perimetreTresorerie(lignesN, lignesN1, regles, declarations.decouvertsDansTresorerie),
            declarations: {
                decouvertsDansTresorerie: declarations.decouvertsDansTresorerie,
                tresorerieEnDevises: declarations.tresorerieGroupeEnDevises,
                effetChange: effet ? { montant: Number(effet.montant), categorie: effet.categorie } : null,
            },
            reservesLegales: reserves,
            consolidation: {
                dividendesRecusMe: d('DIVIDENDES_RECUS_ME'),
                dividendesMinoritaires: d('DIVIDENDES_MINORITAIRES'),
                activiteSelonParagraphe34B: activite === 'INVESTIR_ACTIFS' || activite === 'FINANCER_CLIENTS',
            },
        });
        this.controlerCafg(tableau, cafgParCategorie, d('CAFG'), 'la CAFG du tableau consolidé du D4C');
        return { tableau, motif: null };
    }
    async ajouterRegleConsolidation(tenantId, dto) {
        const motif = (0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)(dto.poste, dto.rubrique);
        if (motif)
            throw new common_1.BadRequestException(motif);
        try {
            return await this.prisma.regleConsolidationIfrs.create({ data: { tenantId, poste: dto.poste, rubrique: dto.rubrique } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Le poste ${dto.poste} a déjà une rubrique · retirez la règle avant d’en poser une autre.`);
            }
            throw e;
        }
    }
    async supprimerRegleConsolidation(tenantId, id) {
        const r = await this.prisma.regleConsolidationIfrs.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!r)
            throw new common_1.NotFoundException('Règle introuvable dans ce dossier.');
        await this.prisma.regleConsolidationIfrs.delete({ where: { id } });
        return { supprime: true };
    }
    async declarerNotes(tenantId, dto) {
        const ex = await this.exercice(tenantId, dto.exerciceId);
        const contenu = (0, notes_ifrs_1.normaliserDeclarationsNotes)(dto.contenu);
        const refus = (0, notes_ifrs_1.motifsRefusDeclarationsNotes)(contenu);
        if (refus.length)
            throw new common_1.BadRequestException(refus.join(' '));
        const json = contenu;
        const consolide = dto.consolide ?? false;
        return this.prisma.notesIfrs.upsert({
            where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: ex.id, consolide } },
            create: { tenantId, exerciceId: ex.id, consolide, contenu: json },
            update: { contenu: json },
        });
    }
    async declarerNotesIfrs12(tenantId, dto) {
        const ex = await this.exercice(tenantId, dto.exerciceId);
        const ifrs12 = (0, notes_ifrs12_1.normaliserDeclarationsIfrs12)(dto.contenu);
        return this.prisma.notesIfrs.upsert({
            where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: ex.id, consolide: true } },
            create: { tenantId, exerciceId: ex.id, consolide: true, contenu: {}, ifrs12 },
            update: { ifrs12 },
        });
    }
    async declarerTresorerie(tenantId, dto) {
        const data = {
            ...(dto.decouvertsDansTresorerie !== undefined ? { decouvertsDansTresorerie: dto.decouvertsDansTresorerie } : {}),
            ...(dto.tresorerieEnDevises !== undefined ? { tresorerieEnDevises: dto.tresorerieEnDevises } : {}),
            ...(dto.tresorerieGroupeEnDevises !== undefined ? { tresorerieGroupeEnDevises: dto.tresorerieGroupeEnDevises } : {}),
        };
        return this.prisma.parametresIfrs.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
    }
    async declarerEffetChange(tenantId, dto) {
        const ex = await this.exercice(tenantId, dto.exerciceId);
        const consolide = dto.consolide ?? false;
        if (!dto.justification?.trim())
            throw new common_1.BadRequestException('Effet de change sans justification · nommez l’écriture de conversion de la trésorerie en devises.');
        if (!(Math.abs(dto.montant) > EPS))
            throw new common_1.BadRequestException('Effet de change sans montant.');
        const parametres = await this.prisma.parametresIfrs.findUnique({ where: { tenantId } });
        if ((consolide ? parametres?.tresorerieGroupeEnDevises : parametres?.tresorerieEnDevises) === false) {
            throw new common_1.BadRequestException(`La trésorerie ${consolide ? 'du groupe ' : ''}est déclarée sans devises · il n’y a pas d’effet de change à présenter (IAS 7 § 28).`);
        }
        const data = { montant: dto.montant, categorie: dto.categorie, justification: dto.justification.trim() };
        return this.prisma.effetChangeTresorerieIfrs.upsert({
            where: { tenantId_exerciceId_consolide: { tenantId, exerciceId: ex.id, consolide } },
            create: { tenantId, exerciceId: ex.id, consolide, ...data },
            update: data,
        });
    }
    async supprimerEffetChange(tenantId, exerciceId, consolide = false) {
        const e = await this.prisma.effetChangeTresorerieIfrs.findUnique({ where: { tenantId_exerciceId_consolide: { tenantId, exerciceId, consolide } } });
        if (!e)
            throw new common_1.NotFoundException('Aucun effet de change déclaré pour cet exercice.');
        await this.prisma.effetChangeTresorerieIfrs.delete({ where: { id: e.id } });
        return { supprime: true };
    }
    async declarerPremiereApplication(tenantId, dto) {
        const premierExerciceIfrsId = dto.premierExerciceIfrsId ?? null;
        const dejaAdoptant = dto.dejaAdoptant ?? false;
        if (premierExerciceIfrsId && dejaAdoptant) {
            throw new common_1.BadRequestException('Une entité qui applique déjà les IFRS n’a pas de premier exercice IFRS (IFRS 1 § 4 et 5) · déclarez l’un ou l’autre.');
        }
        if (premierExerciceIfrsId)
            await this.exercice(tenantId, premierExerciceIfrsId);
        if (dto.consolide) {
            const data = {
                premierExerciceIfrsConsolideId: premierExerciceIfrsId,
                dejaAdoptantConsolide: dejaAdoptant,
                exemptionRegroupementsC1: dto.exemptionRegroupementsC1 ?? null,
            };
            return this.prisma.parametresIfrs.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
        }
        return this.prisma.parametresIfrs.upsert({
            where: { tenantId },
            create: { tenantId, premierExerciceIfrsId, dejaAdoptant },
            update: { premierExerciceIfrsId, dejaAdoptant },
        });
    }
    async declarerActivite(tenantId, dto) {
        const activitePrincipale = dto.activitePrincipale ?? null;
        return this.prisma.parametresIfrs.upsert({ where: { tenantId }, create: { tenantId, activitePrincipale }, update: { activitePrincipale } });
    }
    async ajouterRegle(tenantId, dto) {
        const prefixe = dto.prefixe.trim();
        const motif = (0, rubriques_ifrs_2.motifRefusRegle)(prefixe, dto.rubrique);
        if (motif)
            throw new common_1.BadRequestException(motif);
        try {
            return await this.prisma.regleCorrespondanceIfrs.create({ data: { tenantId, prefixe, rubrique: dto.rubrique } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Une règle existe déjà pour le préfixe ${prefixe} · retirez-la avant d’en poser une autre.`);
            }
            throw e;
        }
    }
    async supprimerRegle(tenantId, id) {
        const r = await this.prisma.regleCorrespondanceIfrs.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!r)
            throw new common_1.NotFoundException('Règle introuvable dans ce dossier.');
        await this.prisma.regleCorrespondanceIfrs.delete({ where: { id } });
        return { supprime: true };
    }
    async ajouterRetraitement(tenantId, dto) {
        const ex = await this.exercice(tenantId, dto.exerciceId);
        const motif = (0, etats_ifrs_1.motifRefusRetraitement)({ libelle: dto.libelle, fondement: dto.fondement, lignes: dto.lignes });
        if (motif)
            throw new common_1.BadRequestException(motif);
        const aLaTransition = dto.aLaTransition ?? false;
        const consolide = dto.consolide ?? false;
        const parts = {
            partMinoritairesResultat: dto.partMinoritairesResultat ?? null,
            partMinoritairesOci: dto.partMinoritairesOci ?? null,
            partMinoritairesCapitauxPropres: dto.partMinoritairesCapitauxPropres ?? null,
        };
        const motifParts = (0, etats_ifrs_1.motifRefusPartsMinoritaires)({ id: '', libelle: dto.libelle, fondement: dto.fondement, lignes: dto.lignes, ...parts }, consolide);
        if (motifParts)
            throw new common_1.BadRequestException(motifParts);
        if (aLaTransition) {
            const motifTransition = (0, premiere_application_ifrs_1.motifRefusAjustementTransition)({ libelle: dto.libelle, lignes: dto.lignes });
            if (motifTransition)
                throw new common_1.BadRequestException(motifTransition);
            const parametres = await this.prisma.parametresIfrs.findUnique({ where: { tenantId } });
            const premierId = consolide ? parametres?.premierExerciceIfrsConsolideId : parametres?.premierExerciceIfrsId;
            const premier = premierId ? await this.prisma.exercice.findFirst({ where: { id: premierId, tenantId }, select: { id: true, dateDebut: true } }) : null;
            if (!premier) {
                throw new common_1.BadRequestException(`Un ajustement de transition suppose un premier exercice IFRS ${consolide ? 'du groupe ' : ''}déclaré (IFRS 1 § 3).`);
            }
            const comparatif = await this.precedent(tenantId, premier.dateDebut);
            if (!comparatif || comparatif.id !== ex.id) {
                throw new common_1.BadRequestException('Un ajustement de transition se pose sur l’exercice comparatif, celui qui précède le premier exercice IFRS · la date de transition est son ouverture (IFRS 1, annexe A).');
            }
        }
        return this.prisma.retraitementIfrs.create({
            data: {
                tenantId,
                exerciceId: ex.id,
                libelle: dto.libelle.trim(),
                fondement: dto.fondement.trim(),
                aLaTransition,
                consolide,
                ...parts,
                correctionErreur: dto.correctionErreur ?? false,
                lignes: { create: dto.lignes.map((l, i) => ({ tenantId, ordre: i + 1, rubrique: l.rubrique, montant: l.montant })) },
            },
            include: { lignes: true },
        });
    }
    async supprimerRetraitement(tenantId, id) {
        const r = await this.prisma.retraitementIfrs.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!r)
            throw new common_1.NotFoundException('Retraitement introuvable dans ce dossier.');
        await this.prisma.retraitementIfrs.delete({ where: { id } });
        return { supprime: true };
    }
    async ajouterMouvementCp(tenantId, dto) {
        const ex = await this.exercice(tenantId, dto.exerciceId);
        const consolide = dto.consolide ?? false;
        const motif = (0, variation_capitaux_propres_ifrs_1.motifRefusMouvementCp)(dto, consolide);
        if (motif)
            throw new common_1.BadRequestException(motif);
        return this.prisma.mouvementCapitauxPropresIfrs.create({
            data: {
                tenantId,
                exerciceId: ex.id,
                consolide,
                type: dto.type,
                composante: dto.composante,
                montant: dto.montant,
                libelle: dto.libelle.trim(),
                justification: dto.justification.trim(),
            },
        });
    }
    async supprimerMouvementCp(tenantId, id) {
        const m = await this.prisma.mouvementCapitauxPropresIfrs.findFirst({ where: { id, tenantId }, select: { id: true } });
        if (!m)
            throw new common_1.NotFoundException('Mouvement introuvable dans ce dossier.');
        await this.prisma.mouvementCapitauxPropresIfrs.delete({ where: { id } });
        return { supprime: true };
    }
};
exports.IfrsService = IfrsService;
exports.IfrsService = IfrsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService,
        cumul_service_1.CumulService,
        perimetre_service_1.PerimetreService])
], IfrsService);
//# sourceMappingURL=ifrs.service.js.map