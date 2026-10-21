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
exports.RetenuesService = exports.AVERTISSEMENT_PV_SANS_COMMISSAIRE = exports.PV_A_CONFIRMER_SANS_FORME = exports.PV_A_CONFIRMER_SANS_MANDAT = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const correspondance_retenues_1 = require("./correspondance-retenues");
const jour_ouvrable_1 = require("./jour-ouvrable");
const inpp_onem_du_4428_1 = require("./inpp-onem-du-4428");
const inpp_trimestriel_1 = require("./inpp-trimestriel");
const echeance_1 = require("../../common/echeance");
const mentions_societe_1 = require("../tenant/mentions-societe");
const portefeuille_etat_1 = require("../exercice/portefeuille-etat");
const duree_mandat_1 = require("../mandat-auditeur/duree-mandat");
const forme_applicable_1 = require("../tenant/forme-applicable");
const liquidation_societe_1 = require("../exercice/liquidation-societe");
exports.PV_A_CONFIRMER_SANS_MANDAT = 'à confirmer · mandat de commissaire non enregistré';
exports.PV_A_CONFIRMER_SANS_FORME = 'à confirmer · forme et mandat de commissaire non renseignés';
exports.AVERTISSEMENT_PV_SANS_COMMISSAIRE = 'Procès-verbal de l’assemblée à l’Administration des impôts non présenté comme dû · il se dépose « dans les dix ' +
    'jours de la tenue de l’Assemblée générale ordinaire approuvant les états financiers certifiés par les ' +
    'commissaires aux comptes » (loi de procédures fiscales, art. 13 bis), et aucun mandat de commissaire aux ' +
    'comptes enregistré ne couvre cet exercice. Enregistrez le mandat dans la fenêtre du contrôleur des comptes s’il ' +
    'en existe un.';
function estReportANouveau(e) {
    return e.estGenereeParCloture && !e.estSoldeDesComptesDeGestion;
}
let RetenuesService = class RetenuesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    dateDeRattachement(ligne) {
        return ligne.dateVersement ?? ligne.ecriture.date;
    }
    async soldesDOuverture(tenantId, exerciceId, dateDebut, lignesExercice) {
        const cumuler = (lignes) => {
            const soldes = new Map();
            for (const l of lignes) {
                soldes.set(l.compte.numero, (soldes.get(l.compte.numero) ?? 0) + Number(l.credit) - Number(l.debit));
            }
            return soldes;
        };
        const ancre = await this.prisma.ecriture.findFirst({
            where: {
                tenantId,
                statut: client_1.StatutEcriture.VALIDEE,
                estGenereeParCloture: true,
                estSoldeDesComptesDeGestion: false,
                date: { lte: dateDebut },
            },
            orderBy: { date: 'desc' },
            select: { date: true, exerciceId: true },
        });
        if (ancre?.exerciceId === exerciceId) {
            return cumuler(lignesExercice.filter((l) => estReportANouveau(l.ecriture)));
        }
        const anterieures = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: {
                    tenantId,
                    statut: client_1.StatutEcriture.VALIDEE,
                    date: { ...(ancre ? { gte: ancre.date } : {}), lt: dateDebut },
                },
                compte: { OR: [{ numero: { startsWith: '44' } }, { numero: { startsWith: '43' } }] },
            },
            select: { debit: true, credit: true, compte: { select: { numero: true } } },
        });
        return cumuler(anterieures);
    }
    echeanceDuMois(nature, annee, moisZeroBase) {
        return (0, jour_ouvrable_1.echeanceDeReversement)(nature.joursApresPeriode, annee, moisZeroBase, (0, correspondance_retenues_1.estEcheanceFiscale)(nature));
    }
    prochaineEcheance(nature, reference) {
        if (nature.porteLInppTrimestriel) {
            const onem = this.prochaineEcheance({ ...nature, porteLInppTrimestriel: undefined }, reference);
            const inpp = (0, inpp_trimestriel_1.prochaineEcheanceInpp)(reference);
            return inpp.getTime() < onem.getTime() ? inpp : onem;
        }
        const echeance = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), nature.joursApresPeriode));
        if ((0, echeance_1.echeanceDepassee)(echeance, reference))
            echeance.setUTCMonth(echeance.getUTCMonth() + 1);
        return (0, correspondance_retenues_1.estEcheanceFiscale)(nature) ? (0, jour_ouvrable_1.reporterAuJourOuvrable)(echeance) : echeance;
    }
    prochaineEcheanceDeclarative(obligation, reference) {
        const reporter = (d) => (0, correspondance_retenues_1.estEcheanceFiscale)(obligation) ? (0, jour_ouvrable_1.reporterAuJourOuvrable)(d, obligation.natureEcheance ?? 'DECLARATION') : d;
        if (obligation.periodicite === 'MENSUELLE') {
            const jours = obligation.joursApresPeriode ?? 10;
            for (let m = -1; m < 2; m++) {
                const finDeMois = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + m + 1, 0));
                const echeance = reporter((() => {
                    const d = new Date(finDeMois);
                    d.setUTCDate(d.getUTCDate() + jours);
                    return d;
                })());
                if (!(0, echeance_1.echeanceDepassee)(echeance, reference))
                    return echeance;
            }
        }
        if (obligation.periodicite === 'TRIMESTRIELLE') {
            const jours = obligation.joursApresPeriode ?? 10;
            for (let t = Math.floor(reference.getUTCMonth() / 3) - 1; t < 8; t++) {
                const finTrimestre = new Date(Date.UTC(reference.getUTCFullYear(), (t + 1) * 3, 0));
                const echeance = reporter((() => {
                    const d = new Date(finTrimestre);
                    d.setUTCDate(d.getUTCDate() + jours);
                    return d;
                })());
                if (!(0, echeance_1.echeanceDepassee)(echeance, reference))
                    return echeance;
            }
        }
        const mois = (obligation.moisEcheance ?? 3) - 1;
        const jour = obligation.jourEcheance ?? 31;
        const cetteAnnee = reporter(new Date(Date.UTC(reference.getUTCFullYear(), mois, jour)));
        if (!(0, echeance_1.echeanceDepassee)(cetteAnnee, reference))
            return cetteAnnee;
        return reporter(new Date(Date.UTC(reference.getUTCFullYear() + 1, mois, jour)));
    }
    async registre(tenantId, params) {
        const reference = params.dateReference ? (0, echeance_1.jourUtc)(new Date(params.dateReference)) : (0, echeance_1.jourDeKinshasa)(new Date());
        const { referentiel, formeJuridiqueSyscohada, venteBiensServices } = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, formeJuridiqueSyscohada: true, venteBiensServices: true },
        });
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: { tenantId, exerciceId: params.exerciceId, statut: client_1.StatutEcriture.VALIDEE },
                compte: { OR: [{ numero: { startsWith: '44' } }, { numero: { startsWith: '43' } }] },
            },
            include: {
                compte: { select: { numero: true, intitule: true } },
                ecriture: {
                    select: {
                        date: true,
                        libelle: true,
                        reference: true,
                        estGenereeParCloture: true,
                        estSoldeDesComptesDeGestion: true,
                        bulletinsPaie: { select: { id: true }, take: 1 },
                        bulletinsPaieRepris: { select: { id: true }, take: 1 },
                        lignes: {
                            where: { compte: { OR: inpp_onem_du_4428_1.RACINES_CHARGE_INPP_ONEM.map((r) => ({ numero: { startsWith: r } })) } },
                            select: { id: true, debit: true, credit: true, compte: { select: { numero: true } } },
                        },
                    },
                },
            },
            orderBy: { ecriture: { date: 'asc' } },
        });
        const partage4428 = (0, inpp_onem_du_4428_1.partagerLe4428)(lignes
            .filter((l) => !estReportANouveau(l.ecriture))
            .map((l) => ({
            ligne: l,
            debit: l.debit,
            credit: l.credit,
            lettrageId: l.lettrageId,
            compte: l.compte,
            ecriture: {
                estDePaie: (l.ecriture.bulletinsPaie?.length ?? 0) > 0 || (l.ecriture.bulletinsPaieRepris?.length ?? 0) > 0,
                porteUneChargeInppOnem: (l.ecriture.lignes?.length ?? 0) > 0,
            },
        })));
        const lues4428 = new Set([...partage4428.lues].map((x) => x.ligne));
        const correspond = (numero, nature) => (0, correspondance_retenues_1.compteRelevantDe)(numero, nature);
        const ligneDeLaNature = (l, nature) => correspond(l.compte.numero, nature) && (!(0, inpp_onem_du_4428_1.estDu4428)(l.compte.numero) || estReportANouveau(l.ecriture) || lues4428.has(l));
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: params.exerciceId, tenantId },
            select: { dateDebut: true },
        });
        const ouverture = exercice
            ? await this.soldesDOuverture(tenantId, params.exerciceId, exercice.dateDebut, lignes)
            : new Map();
        const ouvertureInpp = exercice && !params.sansVentilationDOuverture
            ? await this.ouvertureVentileeInpp(tenantId, exercice.dateDebut, params.dateReference)
            : null;
        const moisAnterieur = exercice
            ? { annee: exercice.dateDebut.getUTCFullYear(), mois: exercice.dateDebut.getUTCMonth() - 1 }
            : null;
        const natures = correspondance_retenues_1.NATURES_RETENUES.map((nature) => {
            const siennes = lignes.filter((l) => ligneDeLaNature(l, nature));
            const parMois = new Map();
            const parCompte = new Map();
            for (const l of siennes) {
                if (estReportANouveau(l.ecriture))
                    continue;
                const rattachement = this.dateDeRattachement(l);
                const mois = `${rattachement.getUTCFullYear()}-${String(rattachement.getUTCMonth() + 1).padStart(2, '0')}`;
                const retenu = Number(l.credit);
                const reverse = Number(l.debit);
                const m = parMois.get(mois) ?? { retenu: 0, reverseEcritures: 0, parts: new Map() };
                m.retenu += retenu;
                m.reverseEcritures += reverse;
                if (nature.porteLInppTrimestriel && retenu !== 0) {
                    for (const p of (0, inpp_trimestriel_1.ventilerInppOnem)(retenu, l.compte.numero, l.ecriture.lignes)) {
                        m.parts.set(p.part, (m.parts.get(p.part) ?? 0) + p.montant);
                    }
                }
                parMois.set(mois, m);
                const c = parCompte.get(l.compte.numero) ?? {
                    numero: l.compte.numero,
                    intitule: l.compte.intitule,
                    retenu: 0,
                    reverse: 0,
                };
                c.retenu += retenu;
                c.reverse += reverse;
                parCompte.set(l.compte.numero, c);
            }
            const retenu = [...parMois.values()].reduce((s, m) => s + m.retenu, 0);
            const reverse = [...parMois.values()].reduce((s, m) => s + m.reverseEcritures, 0);
            const natureDu4428 = correspond(`${inpp_onem_du_4428_1.RACINE_4428}0000`, nature);
            const soldeOuverture = Math.round([...ouverture.entries()]
                .filter(([numero]) => correspond(numero, nature) && (partage4428.pur || !(0, inpp_onem_du_4428_1.estDu4428)(numero)))
                .reduce((s, [, v]) => s + v, 0) * 100) / 100;
            const soldeOuverture4428 = Math.round([...ouverture.entries()].filter(([numero]) => (0, inpp_onem_du_4428_1.estDu4428)(numero)).reduce((s, [, v]) => s + v, 0) * 100) / 100;
            const retardIndetermine = natureDu4428 && !partage4428.pur && partage4428.reversementsNonRattachesFc > 0.005;
            let aImputer = reverse + Math.max(0, -soldeOuverture);
            const echeanceDeLaPart = (part, annee, moisZeroBase) => part === 'INPP' || part === 'NON_VENTILEE'
                ? (0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(annee, moisZeroBase)
                : this.echeanceDuMois(nature, annee, moisZeroBase);
            const ORDRE_DES_PARTS = ['ONEM', 'INPP', 'NON_VENTILEE'];
            const ventilationOuverture = nature.porteLInppTrimestriel && ouvertureInpp && soldeOuverture > 0.005
                ? Math.abs(ouvertureInpp.reduce((s, r) => s + r.retenu, 0) - soldeOuverture) < 0.005
                    ? ouvertureInpp
                    : null
                : null;
            const mentionOuvertureNonVentilee = nature.porteLInppTrimestriel && soldeOuverture > 0.005 && !ventilationOuverture
                ? `SOLDE D'OUVERTURE DE L'INPP ET DE L'ONEM NON VENTILÉ · ${soldeOuverture.toFixed(2)} FC repris de l'exercice précédent ne se reconstituent pas mois par mois sur son registre${ouvertureInpp ? ` (${(Math.round(ouvertureInpp.reduce((s, r) => s + r.retenu, 0) * 100) / 100).toFixed(2)} FC y restent dus)` : ''} · ils sont datés à l'échéance trimestrielle de l'INPP, la plus tardive, et un ONEM resté impayé n'y est pas dit en retard.`
                : null;
            const aImputerDans = [
                ...(ventilationOuverture ?? []).map((r) => ({ ...r, anterieur: true, reverseEcritures: 0 })),
                ...(soldeOuverture > 0.005 && moisAnterieur && !ventilationOuverture
                    ? [
                        {
                            cle: 'ANTERIEUR',
                            anterieur: true,
                            retenu: soldeOuverture,
                            reverseEcritures: 0,
                            echeance: echeanceDeLaPart(nature.porteLInppTrimestriel ? 'NON_VENTILEE' : null, moisAnterieur.annee, moisAnterieur.mois),
                            part: null,
                        },
                    ]
                    : []),
                ...[...parMois.entries()]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .flatMap(([cle, m]) => {
                    const [annee, numeroMois] = cle.split('-').map(Number);
                    const parts = ORDRE_DES_PARTS.filter((p) => Math.abs(m.parts.get(p) ?? 0) >= 0.005);
                    if (!nature.porteLInppTrimestriel || parts.length === 0) {
                        return [
                            {
                                cle,
                                anterieur: false,
                                retenu: m.retenu,
                                reverseEcritures: m.reverseEcritures,
                                echeance: this.echeanceDuMois(nature, annee, numeroMois - 1),
                                part: null,
                            },
                        ];
                    }
                    return parts.map((part, i) => ({
                        cle,
                        anterieur: false,
                        retenu: m.parts.get(part) ?? 0,
                        reverseEcritures: i === 0 ? m.reverseEcritures : 0,
                        echeance: echeanceDeLaPart(part, annee, numeroMois - 1),
                        part,
                    }));
                }),
            ];
            aImputerDans.sort((a, b) => a.echeance.getTime() - b.echeance.getTime());
            const mois = aImputerDans.map((m) => {
                const echeance = m.echeance;
                const impute = Math.max(0, Math.min(aImputer, m.retenu));
                aImputer -= impute;
                const solde = Math.round((m.retenu - impute) * 100) / 100;
                return {
                    mois: m.cle,
                    part: m.part,
                    anterieur: m.anterieur,
                    retenu: Math.round(m.retenu * 100) / 100,
                    reverse: Math.round(impute * 100) / 100,
                    reverseEcritures: Math.round(m.reverseEcritures * 100) / 100,
                    solde,
                    echeance,
                    enRetard: solde > 0.005 && (0, echeance_1.echeanceDepassee)(echeance, reference) && !retardIndetermine,
                };
            });
            const reverseNonImpute = Math.round(Math.max(0, aImputer) * 100) / 100;
            const moisEchus = mois.filter((m) => (0, echeance_1.echeanceDepassee)(m.echeance, reference));
            const retenuEchuNonReverse = moisEchus.reduce((s, m) => s + m.solde, 0);
            const echeancesEchues = moisEchus.map((m) => m.echeance);
            return {
                cle: nature.cle,
                libelle: nature.libelle,
                beneficiaire: nature.beneficiaire,
                echeance: nature.echeance,
                baseLegale: nature.baseLegale,
                imprime: nature.imprime ?? null,
                reserve: (0, correspondance_retenues_1.reservePourReferentiel)(nature, referentiel) ?? null,
                contenu: nature.contenu ?? null,
                sourceDonnees: nature.sourceDonnees ?? null,
                comptes: [...parCompte.values()].sort((a, b) => a.numero.localeCompare(b.numero)),
                mois,
                retenu: Math.round(retenu * 100) / 100,
                reverse: Math.round(reverse * 100) / 100,
                soldeOuverture,
                solde: Math.round((soldeOuverture + retenu - reverse) * 100) / 100,
                moisEnRetard: new Set(mois.filter((m) => m.enRetard).map((m) => m.mois)).size,
                retenuEchuNonReverse: Math.round(retenuEchuNonReverse * 100) / 100,
                reverseNonImpute,
                derniereEcheanceEchue: echeancesEchues.length > 0 ? echeancesEchues[echeancesEchues.length - 1] : null,
                chargeSousConditionArticle20: nature.chargeSousConditionArticle20 ?? null,
                prochaineEcheance: this.prochaineEcheance(nature, reference),
                mentionOuvertureNonVentilee,
                reserveImputation: nature.porteLInppTrimestriel ? inpp_trimestriel_1.RESERVE_IMPUTATION_INPP_ONEM : null,
                mentionNonVentilee: nature.porteLInppTrimestriel
                    ? (0, inpp_trimestriel_1.mentionNonVentilee)(Math.round([...parMois.values()].reduce((s, m) => s + (m.parts.get('NON_VENTILEE') ?? 0), 0) * 100) / 100)
                    : null,
                mention4428: natureDu4428 ? (0, inpp_onem_du_4428_1.mentionDu4428Mele)(partage4428, soldeOuverture4428) : null,
                retardIndetermine,
            };
        });
        const signalementsDeductibilite = natures
            .filter((n) => n.chargeSousConditionArticle20 !== null &&
            n.retenuEchuNonReverse > 0.005 &&
            n.derniereEcheanceEchue !== null)
            .map((n) => ({
            cle: n.cle,
            libelle: n.libelle,
            charge: n.chargeSousConditionArticle20,
            montantEchuNonReverse: n.retenuEchuNonReverse,
            derniereEcheanceEchue: n.derniereEcheanceEchue,
        }));
        const avertissementDeductibilite = (0, correspondance_retenues_1.avertissementDeductibiliteArticle20)(referentiel, signalementsDeductibilite);
        const numerosRattaches = new Set(lignes.filter((l) => correspondance_retenues_1.NATURES_RETENUES.some((n) => correspond(l.compte.numero, n))).map((l) => l.compte.numero));
        const comptesNonRattaches = [
            ...new Map(lignes
                .filter((l) => !numerosRattaches.has(l.compte.numero))
                .map((l) => [l.compte.numero, { numero: l.compte.numero, intitule: l.compte.intitule }])).values(),
        ].sort((a, b) => a.numero.localeCompare(b.numero));
        return {
            dateReference: reference,
            derniereVerificationEcheances: correspondance_retenues_1.DERNIERE_VERIFICATION,
            natures,
            totalRetenu: Math.round(natures.reduce((s, n) => s + n.retenu, 0) * 100) / 100,
            totalReverse: Math.round(natures.reduce((s, n) => s + n.reverse, 0) * 100) / 100,
            totalDu: Math.round(natures.reduce((s, n) => s + n.solde, 0) * 100) / 100,
            comptesNonRattaches,
            referentiel,
            formeJuridiqueSyscohada,
            venteBiensServices: venteBiensServices ?? null,
            signalementsDeductibilite,
            avertissements: [
                correspondance_retenues_1.AVERTISSEMENT_REGISTRE,
                (0, correspondance_retenues_1.avertissementRegimeImpot)(referentiel, formeJuridiqueSyscohada),
                correspondance_retenues_1.AVERTISSEMENT_REDEVABLE,
                ...(natures.some((n) => n.moisEnRetard > 0) ? [correspondance_retenues_1.AVERTISSEMENT_REVERSEMENT_EXERCICE_SUIVANT] : []),
                ...(natures.some((n) => n.reverseNonImpute > 0.005) ? [correspondance_retenues_1.AVERTISSEMENT_REVERSEMENT_ANTERIEUR] : []),
                ...(avertissementDeductibilite ? [avertissementDeductibilite] : []),
                ...natures.flatMap((n) => (n.mention4428 ? [n.mention4428] : [])),
                ...natures.flatMap((n) => (n.mentionNonVentilee ? [n.mentionNonVentilee] : [])),
                ...natures.flatMap((n) => (n.mentionOuvertureNonVentilee ? [n.mentionOuvertureNonVentilee] : [])),
            ],
        };
    }
    async ouvertureVentileeInpp(tenantId, dateDebut, dateReference) {
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lt: dateDebut } },
            orderBy: { dateFin: 'desc' },
            select: { id: true },
        });
        if (!precedent)
            return null;
        const r = await this.registre(tenantId, { exerciceId: precedent.id, dateReference, sansVentilationDOuverture: true });
        const nature = r.natures.find((n) => correspondance_retenues_1.NATURES_RETENUES.find((x) => x.cle === n.cle)?.porteLInppTrimestriel);
        if (!nature)
            return null;
        return nature.mois
            .filter((m) => m.solde > 0.005)
            .map((m) => ({ cle: m.mois, part: m.part, retenu: m.solde, echeance: m.echeance }));
    }
    async echeancierFiscal(tenantId, params) {
        const registre = await this.registre(tenantId, params);
        const reversements = registre.natures.flatMap((n) => {
            const base = {
                cle: n.cle,
                libelle: n.libelle,
                genre: 'REVERSEMENT',
                periodicite: 'MENSUELLE',
                beneficiaire: n.beneficiaire,
                date: n.prochaineEcheance,
                echeance: n.echeance,
                baseLegale: n.baseLegale,
                imprime: n.imprime,
                reserve: n.reserve,
                montantDu: n.solde,
                moisEnRetard: n.moisEnRetard,
                contenu: n.contenu,
                sanction: null,
                sourceDonnees: n.sourceDonnees,
            };
            const nature = correspondance_retenues_1.NATURES_RETENUES.find((x) => x.cle === n.cle);
            if (!nature?.porteLInppTrimestriel)
                return [base];
            const onem = this.prochaineEcheance({ ...nature, porteLInppTrimestriel: undefined }, registre.dateReference);
            return (0, inpp_trimestriel_1.lignesEcheancierInppOnem)(n.mois, onem, (0, inpp_trimestriel_1.prochaineEcheanceInpp)(registre.dateReference)).map((l) => ({
                ...base,
                cle: `${n.cle}-${l.part === 'ONEM' ? 'onem' : 'inpp'}`,
                libelle: l.part === 'ONEM' ? "Contribution à l'emploi (ONEM)" : 'Formation professionnelle (INPP)',
                periodicite: l.periodicite,
                date: l.date,
                echeance: l.part === 'ONEM'
                    ? 'Au plus tard le 15 du mois suivant le paiement de la rémunération'
                    : 'Par trimestre, au plus tard le 30 avril, le 31 juillet, le 31 octobre et le 31 janvier de l’année suivante',
                montantDu: l.montantDu,
                moisEnRetard: l.moisEnRetard,
            }));
        });
        const [exerciceLu, faitsDossier, mandats] = await Promise.all([
            this.prisma.exercice.findFirst({
                where: { id: params.exerciceId, tenantId },
                select: { dateAssembleeGenerale: true, dateFin: true },
            }),
            this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: {
                    entreprisePortefeuilleEtat: true,
                    formeJuridiqueSyscohada: true,
                    formeJuridiqueSyscohadaAnterieure: true,
                    dateTransformationForme: true,
                    dateDissolution: true,
                    dateClotureLiquidation: true,
                    regimeLiquidation: true,
                    associeUniquePersonneMorale: true,
                    dateDeclarationCotisationActivite: true,
                    dateDeclarationCotisationLiquidation: true,
                },
            }),
            this.prisma.mandatAuditeur.findMany({
                where: { tenantId },
                orderBy: { premierExercice: 'desc' },
                select: { premierExercice: true, nombreExercices: true, refusDeProrogation: true, finAnticipeeLe: true },
            }),
        ]);
        const forme = registre.referentiel === client_1.Referentiel.SYSCOHADA && exerciceLu
            ? (0, forme_applicable_1.formeApplicable)({
                formeJuridiqueSyscohada: faitsDossier.formeJuridiqueSyscohada ?? null,
                formeJuridiqueSyscohadaAnterieure: faitsDossier.formeJuridiqueSyscohadaAnterieure ?? null,
                dateTransformationForme: faitsDossier.dateTransformationForme ?? null,
            }, exerciceLu.dateFin)
            : (registre.formeJuridiqueSyscohada ?? null);
        const commissaire = !!exerciceLu &&
            (0, duree_mandat_1.commissaireCouvreLExercice)(mandats ?? [], exerciceLu.dateFin.getUTCFullYear(), registre.referentiel, forme, exerciceLu.dateFin);
        const formeNonDite = forme === null || forme === undefined;
        const saSansMandatEnregistre = !commissaire &&
            registre.referentiel === client_1.Referentiel.SYSCOHADA &&
            (forme === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME || formeNonDite);
        const assemblee = exerciceLu?.dateAssembleeGenerale ?? null;
        const pvAssemblee = assemblee
            ? (0, jour_ouvrable_1.reporterAuJourOuvrable)(new Date(assemblee.getTime() + 10 * 86_400_000), 'DECLARATION')
            : null;
        const pvDepuisAssemblee = (o) => o.cle === 'procesVerbalAssemblee' && pvAssemblee !== null && !(0, echeance_1.echeanceDepassee)(pvAssemblee, registre.dateReference);
        const portefeuille = faitsDossier.entreprisePortefeuilleEtat === true &&
            registre.referentiel === client_1.Referentiel.SYSCOHADA &&
            !!forme &&
            mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(forme) &&
            !!exerciceLu &&
            (0, portefeuille_etat_1.closAu31Decembre)(exerciceLu.dateFin);
        const pvPortefeuille = (o) => o.cle === 'procesVerbalAssemblee' && !pvDepuisAssemblee(o) && portefeuille;
        const applicables = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(registre.referentiel, forme, { venteBiensServices: registre.venteBiensServices });
        const pvSansCommissaire = !commissaire && !saSansMandatEnregistre && applicables.some((o) => o.cle === 'procesVerbalAssemblee');
        const pvAConfirmer = (o) => o.cle === 'procesVerbalAssemblee' && saSansMandatEnregistre;
        const dissolution = registre.referentiel === client_1.Referentiel.SYSCOHADA
            ? (0, liquidation_societe_1.echeancierDissolution)({
                forme: forme ?? null,
                dateDissolution: faitsDossier.dateDissolution ?? null,
                dateNominationLiquidateur: null,
                regimeLiquidation: faitsDossier.regimeLiquidation ?? null,
                associeUniquePersonneMorale: faitsDossier.associeUniquePersonneMorale ?? null,
                dateClotureLiquidation: faitsDossier.dateClotureLiquidation ?? null,
                dateDeclarationCotisationActivite: faitsDossier.dateDeclarationCotisationActivite ?? null,
                dateDeclarationCotisationLiquidation: faitsDossier.dateDeclarationCotisationLiquidation ?? null,
            }, registre.dateReference)
            : null;
        const estAcompte = (cle) => /^(premier|deuxieme|troisieme)AcompteIs$/.test(cle);
        const declarations = applicables
            .filter((o) => o.cle !== 'procesVerbalAssemblee' || commissaire || saSansMandatEnregistre)
            .filter((o) => !dissolution || o.periodicite !== 'ANNUELLE' || dissolution.retenir(o.cle, this.prochaineEcheanceDeclarative(o, registre.dateReference)))
            .map((o) => ({
            cle: o.cle,
            libelle: o.libelle,
            genre: 'DECLARATION',
            periodicite: o.periodicite,
            beneficiaire: 'ETAT',
            date: pvDepuisAssemblee(o)
                ? pvAssemblee
                : this.prochaineEcheanceDeclarative(pvPortefeuille(o) ? { ...o, moisEcheance: 4, jourEcheance: 10 } : o, registre.dateReference),
            echeance: (pvDepuisAssemblee(o)
                ? `${o.echeance} · assemblée déclarée tenue le ${assemblee.toISOString().slice(0, 10).split('-').reverse().join('/')}`
                : pvPortefeuille(o)
                    ? `${o.echeance} · entreprise du portefeuille de l’État, assemblée au plus tard le 31 mars (ordonnance-loi n° 13/003, art. 112)`
                    : o.echeance) + (pvAConfirmer(o) ? ` · ${formeNonDite ? exports.PV_A_CONFIRMER_SANS_FORME : exports.PV_A_CONFIRMER_SANS_MANDAT}` : ''),
            baseLegale: o.baseLegale,
            reserve: dissolution?.mentionAcompte && estAcompte(o.cle) && dissolution.cotisationsDues
                ? [o.reserve, dissolution.mentionAcompte].filter(Boolean).join(' ')
                : o.reserve,
            montantDu: 0,
            moisEnRetard: 0,
            imprime: null,
            contenu: o.contenu,
            sanction: o.sanction ?? null,
            sourceDonnees: pvDepuisAssemblee(o)
                ? "Date de l'assemblée déclarée dans la fenêtre Exercices, plus dix jours, reportée au jour ouvrable (LPF art. 110 bis, al. 2)."
                : pvPortefeuille(o)
                    ? "Faute de date d'assemblée déclarée, repère au plus tard · le 31 mars de l'ordonnance-loi n° 13/003, art. 112, plus dix jours, reporté au jour ouvrable (LPF art. 110 bis, al. 2)."
                    : o.sourceDonnees ?? null,
        }));
        const cotisations = (dissolution?.cotisations ?? []).map((c) => ({
            cle: c.cle,
            libelle: c.libelle,
            genre: 'DECLARATION',
            periodicite: 'PONCTUELLE',
            beneficiaire: 'ETAT',
            date: c.date,
            echeance: c.echeance,
            baseLegale: c.baseLegale,
            reserve: c.reserve,
            montantDu: 0,
            moisEnRetard: 0,
            imprime: null,
            contenu: null,
            sanction: null,
            sourceDonnees: 'Date de dissolution ou de clôture de la liquidation déclarée dans Paramètres du dossier, plus un mois de date à date, reportée au jour ouvrable (LPF art. 16 et 110 bis, al. 2).',
        }));
        const echeances = [...reversements, ...declarations, ...cotisations].sort((a, b) => a.date.getTime() - b.date.getTime());
        return {
            dateReference: registre.dateReference,
            derniereVerificationEcheances: registre.derniereVerificationEcheances,
            echeances,
            totalDu: registre.totalDu,
            avertissements: [
                ...registre.avertissements,
                ...(pvSansCommissaire ? [exports.AVERTISSEMENT_PV_SANS_COMMISSAIRE] : []),
                ...(dissolution?.avertissements ?? []),
            ],
        };
    }
};
exports.RetenuesService = RetenuesService;
exports.RetenuesService = RetenuesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RetenuesService);
//# sourceMappingURL=retenues.service.js.map