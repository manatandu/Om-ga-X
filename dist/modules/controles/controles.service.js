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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ControlesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlesService = exports.RACINES_RESERVE_PROPRIETE = exports.SEUIL_EFFECTIF_AUDITEUR = exports.SEUIL_RESSOURCES_AUDITEUR = exports.SEUIL_BILAN_AUDITEUR = void 0;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const nomenclature_stocks_1 = require("../stocks/nomenclature-stocks");
const prisma_service_1 = require("../../common/prisma.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const exemption_is_ebnl_1 = require("../fiscalite/exemption-is-ebnl");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const client_1 = require("@prisma/client");
const correspondance_exonerations_1 = require("../exonerations/correspondance-exonerations");
const regles_auditeur_1 = require("./regles-auditeur");
const conventions_interdites_1 = require("./conventions-interdites");
const moitie_capital_1 = require("./moitie-capital");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const manuel_procedures_service_1 = require("../documents-obligatoires/manuel-procedures.service");
const correspondance_compte_resultat_syscohada_1 = require("../etats-financiers-syscohada/correspondance-compte-resultat-syscohada");
const comparabilite_exercices_1 = require("../etats-financiers/comparabilite-exercices");
const centralisation_brouillard_1 = require("../comptabilite/centralisation-brouillard");
const duree_mandat_1 = require("../mandat-auditeur/duree-mandat");
const conditions_ong_etrangere_1 = require("../accord-cadre/conditions-ong-etrangere");
const ajouter_mois_1 = require("../../common/ajouter-mois");
const entree_en_vigueur_loi_23_053_1 = require("../../common/entree-en-vigueur-loi-23-053");
const rapprochement_service_1 = require("../rapprochement/rapprochement.service");
const forme_applicable_1 = require("../tenant/forme-applicable");
const comptes_du_bien_1 = require("../immobilisations/comptes-du-bien");
const partie_remplacee_1 = require("../immobilisations/partie-remplacee");
const classe_9_equilibree_1 = require("../comptabilite/classe-9-equilibree");
const reglements_sans_ecart_1 = require("../reglements/reglements-sans-ecart");
const lettrages_a_cheval_1 = require("../lettrage/lettrages-a-cheval");
const reconduction_lettrage_1 = require("../lettrage/reconduction-lettrage");
const contre_passations_de_disponibilites_1 = require("../devises/contre-passations-de-disponibilites");
const banque_et_cloture_informatique_1 = require("./banque-et-cloture-informatique");
const echeance_1 = require("../../common/echeance");
const inpp_onem_sous_le_433_1 = require("./inpp-onem-sous-le-433");
const creances_douteuses_1 = require("../creances-douteuses/creances-douteuses");
const methode_au_reclassement_1 = require("../creances-douteuses/methode-au-reclassement");
exports.SEUIL_BILAN_AUDITEUR = 100_000_000;
exports.SEUIL_RESSOURCES_AUDITEUR = 200_000_000;
exports.SEUIL_EFFECTIF_AUDITEUR = 20;
const CLASSES_BILAN = [
    client_1.ClasseCompte.CLASSE_1,
    client_1.ClasseCompte.CLASSE_2,
    client_1.ClasseCompte.CLASSE_3,
    client_1.ClasseCompte.CLASSE_4,
    client_1.ClasseCompte.CLASSE_5,
];
const ENTREE_EN_VIGUEUR_AM_007_2025 = new Date('2026-01-01T00:00:00.000Z');
const COMPTES_REEVALUATION = ['106', '154'];
const DEPRECIATIONS_STOCKS = {
    [client_1.Referentiel.SYSCOHADA]: ['391', '392', '393', '394', '395', '396', '397', '398'],
    [client_1.Referentiel.SYCEBNL]: ['391', '392', '393', '396', '397'],
};
function compteStockAdosse(numeroDepreciation) {
    return `3${numeroDepreciation.slice(2, 3)}`;
}
const STOCK_EN_COURS_DE_ROUTE = {
    [client_1.Referentiel.SYSCOHADA]: '38',
    [client_1.Referentiel.SYCEBNL]: '37',
};
const STOCK_PROVENANT_D_IMMOBILISATIONS_PAR_REFERENTIEL = {
    [client_1.Referentiel.SYSCOHADA]: nomenclature_stocks_1.STOCK_PROVENANT_D_IMMOBILISATIONS[client_1.Referentiel.SYSCOHADA].racine,
    [client_1.Referentiel.SYCEBNL]: nomenclature_stocks_1.STOCK_PROVENANT_D_IMMOBILISATIONS[client_1.Referentiel.SYCEBNL].racine,
};
const IMMOBILISATIONS_DE_LA_PRODUCTION = ['21', '23', '24'];
const SELECT_ECRITURE_CONTROLEE = {
    id: true,
    date: true,
    libelle: true,
    reference: true,
    numeroPiece: true,
    statut: true,
    createdAt: true,
    createdBy: true,
    valideeBy: true,
    secondRegardNom: true,
    estGenereeParCloture: true,
    estANouveauProvisoire: true,
    journalId: true,
    journal: { select: { code: true, type: true } },
    reevaluationEcarts: { select: { id: true } },
    reevaluationExtourne: { select: { id: true } },
    corrigeEcriture: { select: { reevaluationEcarts: { select: { id: true } }, reevaluationExtourne: { select: { id: true } } } },
    ecartsInventaire: { select: { ecart: true, compte: { select: { numero: true } } } },
    creanceDouteuseReclassement: { select: { annuleeLe: true } },
    mouvementCreanceDouteuse: { select: { annuleeLe: true, creance: { select: { annuleeLe: true } } } },
    ajustementCreanceDouteuse: { select: { annuleeLe: true, creance: { select: { annuleeLe: true } } } },
    lignes: {
        select: {
            id: true,
            debit: true,
            credit: true,
            lettre: true,
            lettrageId: true,
            compte: {
                select: {
                    id: true,
                    numero: true,
                    intitule: true,
                    creancesDouteusesSource: {
                        where: { annuleeLe: null },
                        select: { dateReclassement: true },
                        orderBy: { dateReclassement: 'desc' },
                        take: 1,
                    },
                },
            },
        },
    },
};
function estEcritureDeConversion(e) {
    return (e.reevaluationEcarts != null ||
        e.reevaluationExtourne != null ||
        (e.corrigeEcriture != null &&
            (e.corrigeEcriture.reevaluationEcarts != null || e.corrigeEcriture.reevaluationExtourne != null)));
}
function lignesHorsRedressementInventaire(e) {
    const ecarts = e.ecartsInventaire ?? [];
    if (ecarts.length === 0)
        return e.lignes;
    const restantes = [...e.lignes];
    const centimes = (x) => Math.round(Number(x) * 100);
    for (const ecart of ecarts) {
        const manquant = Math.round(Math.abs(Number(ecart.ecart)) * 100);
        const i = restantes.findIndex((l) => l.compte.numero.startsWith(ecart.compte.numero) && centimes(l.credit) === manquant && centimes(l.debit) === 0);
        if (i === -1)
            continue;
        restantes.splice(i, 1);
        const j = restantes.findIndex((l) => (l.compte.numero.startsWith('6') || l.compte.numero.startsWith('8')) &&
            centimes(l.debit) === manquant &&
            centimes(l.credit) === 0);
        if (j !== -1)
            restantes.splice(j, 1);
    }
    return restantes;
}
function chargesToutesAu67HorsDotations(lignesDeCharge) {
    return (lignesDeCharge.length > 0 &&
        lignesDeCharge.every((l) => l.compte.numero.startsWith('67') && !l.compte.numero.startsWith('679')));
}
function estTenueParUneCreanceDouteuse(e) {
    const vivant = (acte) => acte != null && acte.annuleeLe == null && (acte.creance === undefined || acte.creance.annuleeLe == null);
    return vivant(e.creanceDouteuseReclassement) || vivant(e.mouvementCreanceDouteuse) || vivant(e.ajustementCreanceDouteuse);
}
function estFactureDUneCreanceReclassee(e) {
    return e.lignes.some((l) => {
        const derniere = l.compte.creancesDouteusesSource?.[0]?.dateReclassement;
        return (!l.lettre &&
            l.compte.numero.startsWith('41') &&
            Number(l.debit) - Number(l.credit) > 0.005 &&
            derniere != null &&
            e.date.getTime() <= derniere.getTime());
    });
}
const PLAFOND_OCCURRENCES = 200;
const RACINES_SANS_POSTE_SMT = ['15', '19', '29'];
exports.RACINES_RESERVE_PROPRIETE = [
    { racine: '4016', intitule: 'Fournisseurs, réserve de propriété' },
    { racine: '4816', intitule: 'Fournisseurs d’investissements, réserve de propriété' },
    { racine: '4116', intitule: 'Clients, réserve de propriété' },
    { racine: '9043', intitule: 'Ventes avec clause de réserve de propriété' },
    { racine: '9083', intitule: 'Achats avec clause de réserve de propriété' },
];
function estAuSystemeMinimal(tenant) {
    return tenant.referentiel === client_1.Referentiel.SYSCOHADA
        ? tenant.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
        : tenant.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE;
}
function estMisEnService(i) {
    return i.dateMiseEnService !== null;
}
function nombreSiTronque(collecte) {
    return collecte.tronquee ? { nombre: collecte.nombre } : {};
}
let ControlesService = ControlesService_1 = class ControlesService {
    constructor(prisma, ecritureService, etatsSyscohada) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
        this.etatsSyscohada = etatsSyscohada;
    }
    async exercice(tenantId, exerciceId) {
        const ex = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
        if (!ex)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier');
        return ex;
    }
    async impayesAdherentReclasses(tenantId, ex, actuelle) {
        const impayes = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const candidates = [];
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.creanceDouteuse.findMany({
            where: {
                tenantId,
                annuleeLe: null,
                dateReclassement: { lte: ex.dateFin },
                ...(0, creances_douteuses_1.nonCorrigeeAu)(ex.dateFin),
                compteCreance: { tenantId, OR: [{ numero: { startsWith: '4131' } }, { numero: { startsWith: '4133' } }] },
            },
            select: {
                id: true,
                dateReclassement: true,
                montant: true,
                declareeOuverture: true,
                createdAt: true,
                methodeCotisationsReclassement: true,
                compteCreance: { select: { numero: true, intitule: true } },
                compte416: { select: { numero: true } },
                mouvements: { where: { annuleeLe: null }, select: { montant: true } },
            },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        }), (c) => {
            const montant = Number(c.montant);
            const reste = (0, creances_douteuses_1.resteFinalDeLaCreance)(montant, c.mouvements.map((m) => ({ montant: Number(m.montant) })));
            const neeDansLExercice = c.dateReclassement.getTime() >= ex.dateDebut.getTime();
            if (!(reste > 0.005) && !neeDansLExercice)
                return;
            candidates.push({
                reference: `${c.compteCreance.numero} ${c.compteCreance.intitule}`,
                detail: `${c.declareeOuverture ? 'Déclarée à l’ouverture' : 'Reclassée'} au ${c.compte416.numero} · reste au 416 après ` +
                    `tous ses mouvements ${reste.toFixed(2)}`,
                date: c.dateReclassement.toISOString().slice(0, 10),
                montant,
                createdAt: c.createdAt,
                figee: c.methodeCotisationsReclassement ?? null,
            });
        }, lecture_par_lots_1.LOT_LECTURE);
        for (const c of candidates) {
            const methode = await (0, methode_au_reclassement_1.lireMethodeAuReclassement)(this.prisma, { tenantId, figee: c.figee, geste: c.createdAt, actuelle });
            let mention;
            if (methode.connue && methode.methode === 'APPEL')
                continue;
            if (methode.connue && methode.methode === 'ENCAISSEMENT')
                mention = 'reclassée sous l’encaissement';
            else if (actuelle !== 'ENCAISSEMENT')
                continue;
            else
                mention = methode.connue ? 'aucune méthode déclarée au reclassement' : `méthode au reclassement inconnue (${methode.motif})`;
            impayes.ajouter({ reference: c.reference, detail: `${c.detail} · ${mention}`, date: c.date, montant: c.montant });
        }
        return impayes;
    }
    async controleCaisse(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        const comptes = await this.prisma.compte.findMany({
            where: {
                tenantId,
                typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                OR: [{ numero: { startsWith: '57' } }, { journauxTresorerie: { some: {} } }],
            },
            include: { journauxTresorerie: { select: { code: true, intitule: true } } },
        });
        const comptesCaisse = comptes.filter((c) => c.numero.startsWith('57') ||
            c.journauxTresorerie.some((j) => /caiss|especes|espèces/i.test(`${j.code} ${j.intitule}`)));
        return this.soldesJourParJour(tenantId, exerciceId, comptesCaisse);
    }
    async controleMonnaieElectronique(tenantId, exerciceId) {
        await this.exercice(tenantId, exerciceId);
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, numero: { startsWith: '55' } },
            include: { journauxTresorerie: { select: { code: true, intitule: true } } },
        });
        return this.soldesJourParJour(tenantId, exerciceId, comptes.filter((c) => c.numero.startsWith('55')));
    }
    async soldesJourParJour(tenantId, exerciceId, comptesCaisse) {
        if (comptesCaisse.length === 0)
            return [];
        const parCompteJour = new Map();
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ligneEcriture.findMany({
            where: {
                compteId: { in: comptesCaisse.map((c) => c.id) },
                ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId },
            },
            select: { id: true, compteId: true, debit: true, credit: true, ecriture: { select: { date: true } } },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        }), (l) => {
            const parJour = parCompteJour.get(l.compteId) ?? new Map();
            parCompteJour.set(l.compteId, parJour);
            const jour = l.ecriture.date.toISOString().slice(0, 10);
            const acc = parJour.get(jour) ?? { debit: 0, credit: 0 };
            acc.debit += Number(l.debit);
            acc.credit += Number(l.credit);
            parJour.set(jour, acc);
        });
        return comptesCaisse.map((compte) => {
            const parJour = parCompteJour.get(compte.id) ?? new Map();
            let cumul = 0;
            const journees = [...parJour.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, m]) => {
                cumul += m.debit - m.credit;
                return {
                    date,
                    mouvementDebit: m.debit,
                    mouvementCredit: m.credit,
                    soldeFinJournee: cumul,
                    negatif: cumul < -0.005,
                };
            });
            const negatives = journees.filter((j) => j.negatif);
            return {
                compteId: compte.id,
                numero: compte.numero,
                intitule: compte.intitule,
                journal: compte.journauxTresorerie[0]?.code ?? null,
                soldeFinal: cumul,
                premierJourNegatif: negatives[0]?.date ?? null,
                nombreJoursNegatifs: negatives.length,
                journees,
            };
        });
    }
    async evolutionMensuelle(tenantId, exerciceId, options = {}) {
        const ex = await this.exercice(tenantId, exerciceId);
        const lire = (curseur) => this.prisma.ligneEcriture.findMany({
            where: {
                compte: { tenantId, ...(options.classe ? { classe: options.classe } : {}) },
                ecriture: {
                    tenantId,
                    exerciceId,
                    ...(0, ecritures_de_situation_1.filtreDuStatut)(options.inclureBrouillard !== false),
                },
            },
            select: {
                id: true,
                debit: true,
                credit: true,
                compte: { select: { id: true, numero: true, intitule: true, classe: true, typeCompte: true } },
                ecriture: { select: { date: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
            },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        });
        const mois = [];
        const curseur = new Date(Date.UTC(ex.dateDebut.getUTCFullYear(), ex.dateDebut.getUTCMonth(), 1));
        const fin = new Date(Date.UTC(ex.dateFin.getUTCFullYear(), ex.dateFin.getUTCMonth(), 1));
        while (curseur <= fin) {
            mois.push({
                cle: `${curseur.getUTCFullYear()}-${String(curseur.getUTCMonth() + 1).padStart(2, '0')}`,
                libelle: curseur.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
            });
            curseur.setUTCMonth(curseur.getUTCMonth() + 1);
        }
        const parCompte = new Map();
        await (0, lecture_par_lots_1.lireParLots)(lire, (l) => {
            if (l.compte.typeCompte === client_1.TypeCompteDetailTotal.TOTAL)
                return;
            const net = Number(l.debit) - Number(l.credit);
            let e = parCompte.get(l.compte.id);
            if (!e) {
                e = {
                    compteId: l.compte.id,
                    numero: l.compte.numero,
                    intitule: l.compte.intitule,
                    classe: l.compte.classe,
                    report: 0,
                    parMois: new Map(),
                };
                parCompte.set(l.compte.id, e);
            }
            if (l.ecriture.estSoldeDesComptesDeGestion)
                return;
            if (l.ecriture.estGenereeParCloture) {
                e.report += net;
                return;
            }
            const d = l.ecriture.date;
            const cle = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            e.parMois.set(cle, (e.parMois.get(cle) ?? 0) + net);
        });
        const comptes = [...parCompte.values()]
            .map((e) => {
            const valeurs = mois.map((m) => e.parMois.get(m.cle) ?? 0);
            const cumul = valeurs.reduce((s, v) => s + v, 0);
            const nonNuls = valeurs.filter((v) => Math.abs(v) > 0.005);
            const moyenne = nonNuls.length > 0 ? cumul / nonNuls.length : 0;
            let moisAberrant = null;
            if (nonNuls.length >= 3 && Math.abs(moyenne) > 0.005) {
                let pire = 0;
                valeurs.forEach((v, i) => {
                    const ecart = Math.abs(v - moyenne) / Math.abs(moyenne);
                    if (Math.abs(v) > 0.005 && ecart > pire && ecart >= 1) {
                        pire = ecart;
                        moisAberrant = mois[i].cle;
                    }
                });
            }
            return {
                compteId: e.compteId,
                numero: e.numero,
                intitule: e.intitule,
                classe: e.classe,
                report: e.report,
                valeurs,
                cumul,
                soldeFinal: e.report + cumul,
                moisAberrant,
            };
        })
            .filter((c) => Math.abs(c.cumul) > 0.005 || Math.abs(c.report) > 0.005)
            .sort((a, b) => a.numero.localeCompare(b.numero));
        return {
            exerciceId: ex.id,
            mois,
            comptes,
            classe: options.classe ?? null,
            totaux: options.classe ? mois.map((_, i) => comptes.reduce((s, c) => s + c.valeurs[i], 0)) : null,
        };
    }
    async comptesDormants(tenantId, moisSansMouvement = 12) {
        const [comptes, premier] = await Promise.all([
            this.prisma.compte.findMany({
                where: { tenantId, typeCompte: client_1.TypeCompteDetailTotal.DETAIL },
                select: { id: true, numero: true, intitule: true, classe: true, estActif: true },
                orderBy: { numero: 'asc' },
            }),
            this.prisma.exercice.findFirst({ where: { tenantId }, orderBy: { dateDebut: 'asc' }, select: { id: true } }),
        ]);
        const seuil = (0, ajouter_mois_1.ajouterMois)(new Date(), -moisSansMouvement);
        const horsCloture = { tenantId, estGenereeParCloture: false, ...ecritures_de_situation_1.HORS_SITUATION };
        const [mouvements, soldesDeGestion, ouverture, reports, recents] = await Promise.all([
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: horsCloture },
                _sum: { debit: true, credit: true },
                _count: { _all: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, estSoldeDesComptesDeGestion: true } },
                _sum: { debit: true, credit: true },
            }),
            premier
                ? this.prisma.ligneEcriture.groupBy({
                    by: ['compteId'],
                    where: {
                        ecriture: {
                            tenantId,
                            exerciceId: premier.id,
                            estGenereeParCloture: true,
                            estSoldeDesComptesDeGestion: false,
                            estANouveauProvisoire: false,
                        },
                    },
                    _sum: { debit: true, credit: true },
                })
                : Promise.resolve([]),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, estGenereeParCloture: true } },
                _count: { _all: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: { ...horsCloture, date: { gte: seuil } } },
                _count: { _all: true },
            }),
        ]);
        const solde = new Map();
        for (const g of [...mouvements, ...soldesDeGestion, ...ouverture]) {
            solde.set(g.compteId, (solde.get(g.compteId) ?? 0) + Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0));
        }
        const nombre = new Map(mouvements.map((g) => [g.compteId, g._count._all]));
        const reporte = new Set(reports.map((g) => g.compteId));
        const actifsRecents = new Set(recents.map((g) => g.compteId));
        const dormants = comptes.filter((c) => c.estActif && !actifsRecents.has(c.id));
        const aDater = dormants.filter((c) => nombre.has(c.id)).map((c) => c.id);
        const derniers = aDater.length > 0
            ? await this.prisma.ligneEcriture.findMany({
                where: { compteId: { in: aDater }, ecriture: horsCloture },
                distinct: ['compteId'],
                orderBy: [{ compteId: 'asc' }, { ecriture: { date: 'desc' } }],
                select: { compteId: true, ecriture: { select: { date: true } } },
            })
            : [];
        const dernierPar = new Map(derniers.map((l) => [l.compteId, l.ecriture.date]));
        return dormants
            .map((c) => {
            const dernier = dernierPar.get(c.id) ?? null;
            return {
                compteId: c.id,
                numero: c.numero,
                intitule: c.intitule,
                classe: c.classe,
                estActif: c.estActif,
                dernierMouvement: dernier ? dernier.toISOString() : null,
                nombreEcritures: nombre.get(c.id) ?? 0,
                solde: Math.round((solde.get(c.id) ?? 0) * 100) / 100,
                jamaisMouvemente: !nombre.has(c.id) && !reporte.has(c.id),
            };
        })
            .sort((a, b) => {
            const poids = (x) => (Math.abs(x.solde) > 0.005 ? 0 : 1);
            return poids(a) - poids(b) || a.numero.localeCompare(b.numero);
        });
    }
    async seuilsAuditeur(tenantId, exerciceId, effectifPermanent) {
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, formeJuridiqueSyscohada: true, formeJuridiqueSyscohadaAnterieure: true, dateTransformationForme: true },
        });
        const forme = dossier.dateTransformationForme
            ? (0, forme_applicable_1.formeApplicable)(dossier, (await this.exercice(tenantId, exerciceId)).dateFin)
            : dossier.formeJuridiqueSyscohada;
        const tenant = { referentiel: dossier.referentiel, formeJuridiqueSyscohada: forme };
        const filtre = { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE };
        let gieEmetDesObligations = null;
        if (tenant.referentiel === client_1.Referentiel.SYSCOHADA &&
            tenant.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE) {
            const somme = await this.prisma.ligneEcriture.aggregate({
                where: { ecriture: filtre, compte: { tenantId, numero: { startsWith: '161' } } },
                _sum: { debit: true, credit: true },
            });
            gieEmetDesObligations = Math.abs(Number(somme._sum.credit ?? 0) - Number(somme._sum.debit ?? 0)) > 0.005;
        }
        const regle = (0, regles_auditeur_1.regleAuditeur)(tenant.referentiel, tenant.formeJuridiqueSyscohada, gieEmetDesObligations);
        if (regle.genre === 'AUCUNE_REGLE_LUE') {
            return {
                criteres: [],
                franchis: [],
                nonCompares: [],
                obligationDeclenchee: false,
                obligationIndeterminee: false,
                obligationSansSeuil: false,
                regle,
                conversionAppliquee: false,
                source: null,
            };
        }
        if (regle.genre === 'TOUJOURS') {
            return {
                criteres: [],
                franchis: [],
                nonCompares: [],
                obligationDeclenchee: false,
                obligationIndeterminee: false,
                obligationSansSeuil: true,
                regle,
                conversionAppliquee: false,
                source: regle.source,
            };
        }
        const [soldesGroupes, mouvementsGroupes] = await Promise.all([
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: filtre },
                _sum: { debit: true, credit: true },
            }),
            this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: { ...filtre, estGenereeParCloture: false } },
                _sum: { debit: true, credit: true },
            }),
        ]);
        const net = (g) => Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
        const idsComptes = [...new Set([...soldesGroupes, ...mouvementsGroupes].map((g) => g.compteId))];
        const comptes = idsComptes.length
            ? await this.prisma.compte.findMany({
                where: { tenantId, id: { in: idsComptes } },
                select: { id: true, numero: true, classe: true, typeCompte: true },
            })
            : [];
        const compteDe = new Map(comptes.map((c) => [c.id, c]));
        const estSyscohada = tenant.referentiel === client_1.Referentiel.SYSCOHADA;
        let totalBilan = 0;
        let produits = 0;
        for (const g of soldesGroupes) {
            const compte = compteDe.get(g.compteId);
            if (!compte || compte.typeCompte === client_1.TypeCompteDetailTotal.TOTAL)
                continue;
            const solde = net(g);
            if (CLASSES_BILAN.includes(compte.classe) && solde > 0)
                totalBilan += solde;
        }
        for (const g of mouvementsGroupes) {
            const compte = compteDe.get(g.compteId);
            if (!compte || compte.typeCompte === client_1.TypeCompteDetailTotal.TOTAL)
                continue;
            if (estSyscohada) {
                if (correspondance_compte_resultat_syscohada_1.PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA.some((p) => compte.numero.startsWith(p)))
                    produits -= net(g);
            }
            else if (compte.classe === client_1.ClasseCompte.CLASSE_7) {
                produits -= net(g);
            }
        }
        totalBilan = Math.round(totalBilan * 100) / 100;
        produits = Math.round(produits * 100) / 100;
        const equivalent = regle.genre === 'ALTERNATIF'
            ? "l'article 19 compare à « l'équivalent dans l'unité monétaire ayant cours légal dans l'État partie », que " +
                'le dossier ne déclare pas'
            : "l'article 906 de l'AUSCGIE fixe l'équivalent à la parité du franc CFA en vigueur le jour de l'adoption de " +
                "l'Acte uniforme (30 janvier 2014), arrondie à l'unité supérieure, et cette parité n'est pas au corpus lu";
        const nonCompare = (libelle, valeur, seuil) => ({
            critere: libelle,
            valeur,
            seuil,
            mesure: false,
            franchi: false,
            detail: `${libelle} de ${valeur.toLocaleString('fr-FR')} FC (monnaie de tenue) · seuil ` +
                `${seuil.toLocaleString('fr-FR')} FCFA · non comparé : ${equivalent}.`,
        });
        const criteres = [
            nonCompare('Total du bilan', totalBilan, regle.seuilBilan),
            nonCompare(regle.libelleProduits, produits, regle.seuilProduits),
            {
                critere: 'Effectif permanent',
                valeur: effectifPermanent,
                seuil: regle.seuilEffectif,
                mesure: true,
                franchi: effectifPermanent > regle.seuilEffectif,
                detail: effectifPermanent > 0
                    ? `${effectifPermanent} personnes employées à titre permanent · seuil ${regle.seuilEffectif}`
                    : "Effectif non renseigné · à saisir dans Structure > Paramètres du dossier pour que ce critère soit mesuré",
            },
        ];
        const franchis = criteres.filter((c) => c.franchi);
        const requis = regle.genre === 'ALTERNATIF' ? 1 : 2;
        const obligationDeclenchee = franchis.length >= requis;
        const nonCompares = criteres.filter((c) => !c.mesure && c.valeur > c.seuil);
        const obligationIndeterminee = !obligationDeclenchee && franchis.length + nonCompares.length >= requis;
        return {
            criteres,
            franchis,
            nonCompares,
            obligationDeclenchee,
            obligationIndeterminee,
            obligationSansSeuil: false,
            regle,
            conversionAppliquee: false,
            source: regle.source,
        };
    }
    async controlesBanqueEtClotureInformatique(tenantId, ex, referentiel, parcours, maintenant) {
        const anomalies = [];
        if (!(0, banque_et_cloture_informatique_1.texteEnVigueurPourLExercice)(referentiel, ex.dateDebut))
            return anomalies;
        const aujourdhui = (0, echeance_1.jourDeKinshasa)(new Date(maintenant));
        const comptes = [...parcours.comptesBancaires.values()];
        if (comptes.length > 0 && (0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)(comptes, new Map(), ex.dateFin, aujourdhui).length > 0) {
            const ids = comptes.map((c) => c.compteId);
            const [dernieres, enCours] = await Promise.all([
                this.prisma.rapprochementBancaire.groupBy({
                    by: ['compteId'],
                    where: { tenantId, compteId: { in: ids }, statut: 'CLOTURE' },
                    _max: { dateReleve: true },
                }),
                this.prisma.rapprochementBancaire.findMany({
                    where: { tenantId, compteId: { in: ids }, statut: 'EN_COURS' },
                    select: { compteId: true, dateReleve: true },
                }),
            ]);
            const etats = new Map();
            const etat = (id) => {
                const e = etats.get(id) ?? { dernierClos: null, soldeDernierClos: null, enCours: null };
                etats.set(id, e);
                return e;
            };
            for (const g of dernieres) {
                if (g._max.dateReleve)
                    etat(g.compteId).dernierClos = g._max.dateReleve;
            }
            for (const r of enCours)
                etat(r.compteId).enCours = r.dateReleve;
            const aVerifier = [];
            for (const c of comptes) {
                const e = etats.get(c.compteId);
                if (Math.abs(c.soldeCloture) < 0.005 && e && e.dernierClos !== null && !(0, banque_et_cloture_informatique_1.releveCouvreLaCloture)(e, ex.dateFin)) {
                    aVerifier.push({ compteId: c.compteId, dateReleve: e.dernierClos });
                }
            }
            if (aVerifier.length > 0) {
                const soldes = await this.prisma.rapprochementBancaire.findMany({
                    where: { tenantId, statut: 'CLOTURE', OR: aVerifier },
                    orderBy: { clotureAt: 'desc' },
                    select: { compteId: true, soldeReleve: true },
                });
                for (const r of soldes) {
                    const e = etat(r.compteId);
                    if (e.soldeDernierClos === null)
                        e.soldeDernierClos = Number(r.soldeReleve);
                }
            }
            const sans = (0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)(comptes, etats, ex.dateFin, aujourdhui);
            if (sans.length > 0) {
                const cloture = ex.dateFin.toISOString().slice(0, 10);
                anomalies.push({
                    code: 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE',
                    gravite: 'AVERTISSEMENT',
                    libelle: "Compte de banque à rapprocher avant l'arrêté des comptes",
                    consequence: '« Le solde qui ressort des livres comptables doit être rapproché du solde du compte tenu par la banque » (' +
                        (0, banque_et_cloture_informatique_1.sourceFicheCompte52)(referentiel) +
                        `), au ${cloture}, jour de la clôture où l'entité « doit procéder au recensement et à l'évaluation de ses biens, ` +
                        'créances et dettes » (art. 42). Les états financiers sont arrêtés au plus tard dans les quatre mois qui suivent la ' +
                        "clôture (AUDCIF art. 23) · tant qu'aucun rapprochement clos n'atteint ce jour, le solde porté au bilan n'est pas confronté " +
                        'au relevé, et une différence qui ne tient pas à un chevauchement de dates reste sans écriture de redressement.',
                    action: 'À rapprocher avant l’arrêté des comptes · ouvrez puis clôturez, dans Traitement > Tiers et trésorerie > Rapprochement ' +
                        'bancaire, le rapprochement d’un relevé daté au plus tôt de la clôture, et passez les écritures de redressement des ' +
                        'différences qui ne tiennent pas aux dates. Un compte fermé en cours d’exercice est couvert par son dernier relevé à ' +
                        'solde nul, daté au plus tôt de sa dernière opération, quand son solde comptable est nul. Pour un compte en devises, ' +
                        'le solde du relevé se compare en francs au cours de clôture, une fois passée la réévaluation de l’exercice ' +
                        '(Traitement > Clôture > Devises et réévaluation).',
                    occurrences: [
                        ...(parcours.contrePassationsAnnuleesTronquees
                            ? [
                                {
                                    reference: 'Lecture bornée',
                                    detail: `${contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES} réévaluations à contre-passation annulée lues · une contre-passation annulée ` +
                                        "plus ancienne peut avancer la dernière opération d'un compte fermé, et le faire paraître non couvert.",
                                },
                            ]
                            : []),
                        ...(parcours.contrePassationsDeclareesTronquees
                            ? [
                                {
                                    reference: 'Lecture bornée',
                                    detail: `${contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES} contre-passations déclarées lues dans l'exercice · une autre, qui inverse ` +
                                        "l'écart d'une banque, peut avancer la dernière opération d'un compte fermé, et le faire paraître non couvert.",
                                },
                            ]
                            : []),
                        ...sans,
                    ],
                });
            }
        }
        if (ex.statut !== client_1.StatutExercice.CLOTURE &&
            parcours.journauxEcrits.size > 0 &&
            (0, banque_et_cloture_informatique_1.premiereEcheanceDepassee)(ex.dateDebut, ex.dateFin, aujourdhui)) {
            const clotures = await this.prisma.cloture.findMany({
                where: {
                    tenantId,
                    annuleeAt: null,
                    granularite: { in: [client_1.GranulariteCloture.PERIODE, client_1.GranulariteCloture.TOTALE] },
                    dateLimite: { gte: ex.dateDebut },
                },
                select: { granularite: true, journalId: true, dateLimite: true },
            });
            const enRetard = (0, banque_et_cloture_informatique_1.journauxEnRetardDeClotureInformatique)([...parcours.journauxEcrits.values()], clotures, ex.dateDebut, ex.dateFin, aujourdhui);
            if (enRetard.length > 0) {
                anomalies.push({
                    code: 'CLOTURE_INFORMATIQUE_EN_RETARD',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Période restée ouverte au-delà de la clôture informatique',
                    consequence: '« Une procédure périodique dite « clôture informatique » au moins trimestrielle est prévue, mise en œuvre au plus tard ' +
                        'à la fin du trimestre qui suit la fin de chaque période » (' +
                        (0, banque_et_cloture_informatique_1.sourceClotureInformatique)(referentiel) +
                        "). Tant qu'elle n'est pas posée, une écriture peut encore s'insérer dans une période qui aurait dû être figée.",
                    action: "L'administrateur du dossier pose une clôture de période, tous journaux, dans Traitement > Clôture > Fin " +
                        "d'exercice…, jusqu'au dernier jour qu'il tient pour arrêté. Elle est définitive et fige aussi, jusqu'à sa date, le " +
                        'lettrage et la ventilation analytique. Une clôture partielle, réversible, ne fige pas la chronologie. Une clôture ' +
                        "faite dans un autre logiciel avant la reprise du dossier n'est pas connue d'OmegaX · posez-la ici à la même date.",
                    occurrences: enRetard,
                });
            }
        }
        const nonSoldes = (0, banque_et_cloture_informatique_1.virementsInternesNonSoldes)([...parcours.virementsInternes.values()], ex.dateFin, aujourdhui);
        if (nonSoldes.length > 0) {
            const montres = nonSoldes.slice(0, PLAFOND_OCCURRENCES);
            anomalies.push({
                code: 'VIREMENT_INTERNE_NON_SOLDE_A_LA_CLOTURE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Compte de virements internes non soldé à la clôture',
                consequence: '« Ce sont des comptes de passage utiles à la comptabilisation d\'opérations internes à l\'entité. [...] En tout ' +
                    (referentiel === 'SYSCOHADA' ? 'état de cause, ces comptes' : 'état de cause ces comptes') +
                    ' doivent être soldés au terme de leur utilisation » ; « Il importe de s\'assurer que les ' +
                    'comptes 585 et 588 relatifs aux virements internes sont soldés à la fin de l\'exercice » (' +
                    (0, banque_et_cloture_informatique_1.sourceFicheCompte58)(referentiel) +
                    "). Un solde restant est la moitié d'un virement entre deux comptes de trésorerie dont l'autre moitié manque ou " +
                    "a été imputée ailleurs · un compte de trésorerie du bilan peut en être faux d'autant.",
                action: 'À solder avant l’arrêté des comptes · rapprochez, dans le grand livre du compte, chaque sortie de fonds de son ' +
                    'entrée dans l’autre journal de trésorerie (relevés bancaires, procès-verbaux de caisse), puis passez la moitié ' +
                    'manquante ou corrigez l’imputation erronée. Une pièce au brouillard qui le solde reste à valider.',
                occurrences: montres,
                ...(nonSoldes.length > montres.length ? { nombre: nonSoldes.length } : {}),
            });
        }
        return anomalies;
    }
    async parcourirEcrituresControlees(tenantId, exerciceId, ex, tenant, maintenant) {
        const desequilibrees = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const sansReference = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const brouillardEnRetard = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const anciennes = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const chargesDirectes = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const horsModele = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const cotisationsMouvementees = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const validesParLeurAuteur = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const valideesEnSituation = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const brouillardEnSituation = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const soldesTiers = new Map();
        const comptesCreanceReclassee = new Set();
        const comptesClasse9 = new Set();
        const classe9HorsEquilibre = new lecture_par_lots_1.Collecte(PLAFOND_OCCURRENCES);
        const journauxEcrits = new Map();
        const comptesBancaires = new Map();
        let lettrageVu = false;
        const virementsInternes = new Map();
        const tracesAnnulees = await (0, contre_passations_de_disponibilites_1.ecrituresDesContrePassationsAnnulees)(this.prisma, tenantId);
        const contrePassationsAnnulees = tracesAnnulees.ids;
        const declarees = await (0, contre_passations_de_disponibilites_1.lignesDeDisponibilitesDesContrePassationsDeclarees)(this.prisma, { tenantId, exerciceId });
        const seuilAnciennete = new Date(ex.dateFin);
        seuilAnciennete.setDate(seuilAnciennete.getDate() - ControlesService_1.JOURS_ANCIENNETE_TIERS);
        const auSystemeMinimal = estAuSystemeMinimal(tenant);
        const cotisationsAPreciser = tenant.referentiel === client_1.Referentiel.SYCEBNL &&
            tenant.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS &&
            !tenant.methodeCotisations;
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.ecriture.findMany({
            where: { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION },
            select: SELECT_ECRITURE_CONTROLEE,
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
        }), (e) => {
            let debit = 0;
            let credit = 0;
            if (!e.estANouveauProvisoire && e.journal.type !== client_1.TypeJournal.SITUATION && !journauxEcrits.has(e.journalId)) {
                journauxEcrits.set(e.journalId, { journalId: e.journalId, code: e.journal.code });
            }
            if (e.statut === client_1.StatutEcriture.VALIDEE && e.journal.type === client_1.TypeJournal.SITUATION)
                valideesEnSituation.ajouter(e);
            if (e.statut === client_1.StatutEcriture.BROUILLARD && e.journal.type === client_1.TypeJournal.SITUATION)
                brouillardEnSituation.ajouter(e);
            for (const l of e.lignes) {
                debit += Number(l.debit);
                credit += Number(l.credit);
                if (l.lettrageId)
                    lettrageVu = true;
                const n = l.compte.numero;
                if ((0, banque_et_cloture_informatique_1.estCompteBancaireARapprocher)(n)) {
                    const centimes = Math.round(Number(l.debit) * 100) - Math.round(Number(l.credit) * 100);
                    const mouvementDeBanque = !estEcritureDeConversion(e) && !contrePassationsAnnulees.has(e.id) && !declarees.lignes.has(l.id);
                    const vu = comptesBancaires.get(l.compte.id);
                    if (vu === undefined) {
                        comptesBancaires.set(l.compte.id, {
                            compteId: l.compte.id,
                            numero: n,
                            intitule: l.compte.intitule,
                            soldeCloture: centimes,
                            derniereLigne: mouvementDeBanque ? e.date : null,
                        });
                    }
                    else {
                        vu.soldeCloture += centimes;
                        if (mouvementDeBanque && (vu.derniereLigne === null || e.date.getTime() > vu.derniereLigne.getTime())) {
                            vu.derniereLigne = e.date;
                        }
                    }
                }
                if ((0, banque_et_cloture_informatique_1.estCompteDeVirementInterne)(n)) {
                    const centimes = Math.round(Number(l.debit) * 100) - Math.round(Number(l.credit) * 100);
                    const v = virementsInternes.get(l.compte.id) ?? {
                        compteId: l.compte.id,
                        numero: n,
                        intitule: l.compte.intitule,
                        soldeLivreJournalCentimes: 0,
                        soldeToutesLignesCentimes: 0,
                    };
                    if (e.statut === client_1.StatutEcriture.VALIDEE)
                        v.soldeLivreJournalCentimes += centimes;
                    v.soldeToutesLignesCentimes += centimes;
                    virementsInternes.set(l.compte.id, v);
                }
                if (n.startsWith('40') || n.startsWith('41')) {
                    soldesTiers.set(n, (soldesTiers.get(n) ?? 0) + Number(l.debit) - Number(l.credit));
                    if ((l.compte.creancesDouteusesSource?.length ?? 0) > 0)
                        comptesCreanceReclassee.add(n);
                }
                if (n.startsWith('9') && !e.estGenereeParCloture)
                    comptesClasse9.add(n);
            }
            if (Math.abs(debit - credit) > 0.005)
                desequilibrees.ajouter(e);
            if ((0, classe_9_equilibree_1.ecartClasse9)(e.lignes.map((l) => ({ numero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) }))) !== 0) {
                classe9HorsEquilibre.ajouter(e);
            }
            if (!e.reference?.trim() && !['AN', 'OD'].includes(e.journal.code) && e.lignes.length > 0) {
                sansReference.ajouter(e);
            }
            if (e.statut === client_1.StatutEcriture.BROUILLARD && (0, centralisation_brouillard_1.enRetardDeCentralisation)(e, ex.statut, tenant.referentiel, maintenant)) {
                brouillardEnRetard.ajouter(e);
            }
            if (e.date < seuilAnciennete &&
                !estTenueParUneCreanceDouteuse(e) &&
                e.lignes.some((l) => !l.lettre &&
                    (l.compte.numero.startsWith('40') || l.compte.numero.startsWith('41')) &&
                    Math.abs(Number(l.debit) - Number(l.credit)) > 0.005)) {
                anciennes.ajouter(e);
            }
            if (!auSystemeMinimal) {
                const lignesLues = lignesHorsRedressementInventaire(e);
                const aUneCharge = lignesLues.some((l) => (l.compte.numero.startsWith('6') || l.compte.numero.startsWith('8')) &&
                    Number(l.debit) - Number(l.credit) > 0.005);
                const aUneTresorerieCreditee = lignesLues.some((l) => l.compte.numero.startsWith('5') &&
                    !l.compte.numero.startsWith('59') &&
                    Number(l.credit) - Number(l.debit) > 0.005);
                const aUnTiers = e.lignes.some((l) => l.compte.numero.startsWith('4') && !l.compte.numero.startsWith('445'));
                if (aUneCharge && aUneTresorerieCreditee && !aUnTiers)
                    chargesDirectes.ajouter(e);
            }
            else if (!e.estGenereeParCloture &&
                e.lignes.some((l) => RACINES_SANS_POSTE_SMT.some((r) => l.compte.numero.startsWith(r)))) {
                horsModele.ajouter(e);
            }
            if (cotisationsAPreciser &&
                e.lignes.some((l) => l.compte.numero.startsWith('701') || l.compte.numero.startsWith('103'))) {
                cotisationsMouvementees.ajouter(e);
            }
            if (e.statut === client_1.StatutEcriture.VALIDEE &&
                e.valideeBy !== null &&
                e.createdBy === e.valideeBy &&
                !e.estGenereeParCloture &&
                e.secondRegardNom === null) {
                validesParLeurAuteur.ajouter(e);
            }
        }, lecture_par_lots_1.LOT_ECRITURES);
        return {
            desequilibrees,
            sansReference,
            brouillardEnRetard,
            anciennes,
            chargesDirectes,
            horsModele,
            cotisationsMouvementees,
            validesParLeurAuteur,
            valideesEnSituation,
            brouillardEnSituation,
            soldesTiers,
            comptesCreanceReclassee,
            comptesClasse9,
            classe9HorsEquilibre,
            journauxEcrits,
            lettrageVu,
            contrePassationsAnnuleesTronquees: tracesAnnulees.tronque,
            contrePassationsDeclareesTronquees: declarees.tronque,
            virementsInternes,
            comptesBancaires: new Map([...comptesBancaires].map(([id, c]) => [id, { ...c, soldeCloture: c.soldeCloture / 100 }])),
        };
    }
    async analyser(tenantId, exerciceId) {
        const ex = await this.exercice(tenantId, exerciceId);
        const dossier = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
        const tenant = { ...dossier, formeJuridiqueSyscohada: (0, forme_applicable_1.formeApplicable)(dossier, ex.dateFin) };
        const anomalies = [];
        const caisses = await this.controleCaisse(tenantId, exerciceId);
        const caissesNegatives = caisses.filter((c) => c.nombreJoursNegatifs > 0);
        if (caissesNegatives.length > 0) {
            anomalies.push({
                code: 'CAISSE_CREDITRICE',
                gravite: 'BLOQUANT',
                libelle: 'Caisse créditrice',
                consequence: "Une caisse ne peut pas être créditrice : on aurait décaissé de l'argent qu'on n'avait pas. C'est une erreur de saisie ou une sortie non justifiée.",
                action: "Enregistrez les approvisionnements de caisse AVANT les dépenses du même jour, ou retrouvez la pièce manquante.",
                occurrences: caissesNegatives.map((c) => ({
                    reference: `${c.numero} ${c.intitule}`,
                    detail: `Créditrice ${c.nombreJoursNegatifs} jour(s), pour la première fois le ${c.premierJourNegatif}`,
                    date: c.premierJourNegatif ?? undefined,
                    montant: Math.min(...c.journees.filter((j) => j.negatif).map((j) => j.soldeFinJournee)),
                })),
            });
        }
        const electroniques = (await this.controleMonnaieElectronique(tenantId, exerciceId)).filter((c) => c.nombreJoursNegatifs > 0);
        if (electroniques.length > 0) {
            anomalies.push({
                code: 'MONNAIE_ELECTRONIQUE_CREDITRICE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Instrument de monnaie électronique créditeur',
                consequence: '« Le solde du compte instruments monétaires électroniques ne doit être que débiteur ou nul » (' +
                    (tenant.referentiel === client_1.Referentiel.SYCEBNL
                        ? 'SYCEBNL, Partie 2 ch. 3, compte 55'
                        : 'AUDCIF, Titre VII, compte 55') +
                    '). Au bilan, un solde créditeur diminue la trésorerie-actif sans ligne qui le montre.',
                action: 'Enregistrez le chargement AVANT les paiements du même jour, ou retrouvez le chargement manquant.',
                occurrences: electroniques.map((c) => ({
                    reference: `${c.numero} ${c.intitule}`,
                    detail: `Créditeur ${c.nombreJoursNegatifs} jour(s), pour la première fois le ${c.premierJourNegatif}`,
                    date: c.premierJourNegatif ?? undefined,
                    montant: Math.min(...c.journees.filter((j) => j.negatif).map((j) => j.soldeFinJournee)),
                })),
            });
        }
        const maintenant = Date.now();
        const parcours = await this.parcourirEcrituresControlees(tenantId, exerciceId, ex, tenant, maintenant);
        const desequilibrees = parcours.desequilibrees.elements;
        if (desequilibrees.length > 0) {
            anomalies.push({
                code: 'ECRITURE_DESEQUILIBREE',
                gravite: 'BLOQUANT',
                libelle: 'Écriture déséquilibrée',
                consequence: "Une écriture dont le débit ne vaut pas le crédit fausse la balance et tous les états qui en dépendent.",
                action: "Reprenez la pièce dans la saisie. Si elle est validée, corrigez-la par inscription en négatif.",
                occurrences: desequilibrees.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                    detail: e.libelle,
                    date: e.date.toISOString().slice(0, 10),
                    montant: e.lignes.reduce((s, l) => s + Number(l.debit), 0) - e.lignes.reduce((s, l) => s + Number(l.credit), 0),
                })),
                ...nombreSiTronque(parcours.desequilibrees),
            });
        }
        const sansReference = parcours.sansReference.elements;
        if (sansReference.length > 0) {
            anomalies.push({
                code: 'SANS_PIECE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Écriture sans référence de pièce justificative',
                consequence: "Un auditeur remonte de l'écriture à sa pièce par cette référence. Sans elle, la justification repose sur la mémoire.",
                action: 'Renseignez le numéro de facture, de reçu ou de chèque sur la pièce.',
                occurrences: sansReference.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                    detail: e.libelle,
                    date: e.date.toISOString().slice(0, 10),
                })),
                ...nombreSiTronque(parcours.sansReference),
            });
        }
        const brouillardEnRetard = parcours.brouillardEnRetard.elements;
        if (brouillardEnRetard.length > 0) {
            const estSycebnlCentralisation = tenant.referentiel === client_1.Referentiel.SYCEBNL;
            anomalies.push({
                code: 'BROUILLARD_EN_RETARD',
                gravite: 'AVERTISSEMENT',
                libelle: estSycebnlCentralisation
                    ? 'Brouillard non centralisé depuis plus de sept jours'
                    : "Brouillard non centralisé depuis plus d'un mois",
                consequence: estSycebnlCentralisation
                    ? "Le SYCEBNL veut les journaux auxiliaires centralisés au moins chaque semaine dans le journal ou le grand-livre (Partie 2, ch. 2). Au-delà, ce n'est plus un document de travail."
                    : "L'AUDCIF veut les journaux auxiliaires centralisés au moins une fois par mois (art. 19). Au-delà, ce n'est plus un document de travail.",
                action: 'Relisez ces écritures dans État → Brouillard et validez-les.',
                occurrences: brouillardEnRetard.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                    detail: `${e.libelle} · saisie il y a ${(0, centralisation_brouillard_1.ancienneteJours)(e.createdAt, maintenant)} jours`,
                    date: e.date.toISOString().slice(0, 10),
                })),
                ...nombreSiTronque(parcours.brouillardEnRetard),
            });
        }
        const qualite41 = tenant.referentiel === client_1.Referentiel.SYCEBNL ? 'adhérent ou client-usager' : 'client';
        const qualite41Capitale = tenant.referentiel === client_1.Referentiel.SYCEBNL ? 'Adhérent / client-usager' : 'Client';
        const soldesTiers = parcours.soldesTiers;
        const inversesTous = [...soldesTiers.entries()].filter(([numero, solde]) => {
            if (numero.startsWith('409'))
                return solde < -0.005;
            if (numero.startsWith('419'))
                return solde > 0.005;
            return (numero.startsWith('41') && solde < -0.005) || (numero.startsWith('40') && solde > 0.005);
        });
        const origineCreditrice = inversesTous.filter(([numero]) => parcours.comptesCreanceReclassee.has(numero) && !numero.startsWith('419'));
        const inverses = inversesTous.filter(([numero]) => !origineCreditrice.some(([n]) => n === numero));
        if (origineCreditrice.length > 0) {
            anomalies.push({
                code: 'COMPTE_CREANCE_RECLASSEE_CREDITEUR',
                gravite: 'AVERTISSEMENT',
                libelle: 'Compte d’une créance reclassée au 416 devenu créditeur',
                consequence: 'Le compte du client porte une créance reclassée au 416 (« Créances douteuses ou litigieuses »), et il est créditeur · ' +
                    'le plus souvent l’encaissement de cette créance passé sur ce compte (Règlement des tiers ou saisie) au lieu du ' +
                    '« Recouvrement » du module. Le 416 garde alors une créance déjà encaissée, et le module la revoit et la déprécie.',
                action: 'Supprimez ce règlement s’il est au brouillard, ou annulez-le par inscription en négatif s’il est validé, puis passez ' +
                    'l’encaissement par « Recouvrement » dans « Créances douteuses ou litigieuses ». S’il s’agit d’une avance sans rapport ' +
                    'avec la créance, reclassez-la au 4191 à l’arrêté.',
                occurrences: origineCreditrice.map(([numero, solde]) => ({
                    reference: numero,
                    detail: `${qualite41Capitale} créditeur, compte d’une créance reclassée au 416`,
                    montant: solde,
                })),
            });
        }
        if (inverses.length > 0) {
            anomalies.push({
                code: 'TIERS_SOLDE_INVERSE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Compte de tiers au solde inversé',
                consequence: `Un ${qualite41} (41) créditeur, ou un fournisseur (40) débiteur, traduit le plus souvent un règlement imputé au mauvais compte, un double encaissement, ou une avance à reclasser. Sur un 409 ou un 419, c'est l'inverse : leur sens normal est celui de l'avance.`,
                action: 'Interrogez le compte et lettrez-le : le solde non lettré dira ce qui reste réellement dû. ' +
                    "S'il s'agit d'une avance, reclassez-la à l'arrêté (401 débiteur vers 4091 avances versées, " +
                    '411 créditeur vers 4191 avances reçues) : la compensation entre un poste d’actif et un poste ' +
                    'de passif est interdite, et l’avance doit figurer en clair de son côté du bilan.',
                occurrences: inverses.map(([numero, solde]) => ({
                    reference: numero,
                    detail: numero.startsWith('409')
                        ? 'Fournisseur débiteur (409) au solde créditeur'
                        : numero.startsWith('419')
                            ? `${qualite41Capitale} créditeur (419) au solde débiteur`
                            : numero.startsWith('41')
                                ? `${qualite41Capitale} créditeur`
                                : 'Fournisseur débiteur',
                    montant: solde,
                })),
            });
        }
        const anciennes = parcours.anciennes.elements;
        if (anciennes.length > 0) {
            anomalies.push({
                code: 'TIERS_ANCIEN_NON_LETTRE',
                gravite: 'INFORMATION',
                libelle: `Mouvement de tiers non lettré depuis plus de ${ControlesService_1.JOURS_ANCIENNETE_TIERS} jours`,
                consequence: "Une créance ancienne non lettrée est soit déjà réglée sans que le rapprochement ait été fait, soit douteuse · dans le second cas elle se reclasse au 416 (créances litigieuses ou douteuses) et appelle une dépréciation au 491 (note annexe).",
                action: 'Lettrez ce qui est réglé ; pour le reste, appréciez le risque et dépréciez si nécessaire. Les pièces d’une créance ' +
                    'reclassée au 416 dans « Créances douteuses ou litigieuses » ne sont pas listées, le module les suit ; la facture ' +
                    'd’une telle créance, antérieure à son reclassement, est nommée comme telle et ne se lettre pas avec le ' +
                    'reclassement (la TVA deviendrait exigible).',
                occurrences: anciennes.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                    detail: estFactureDUneCreanceReclassee(e)
                        ? `${e.libelle} · compte d'une créance reclassée au 416, à ne pas lettrer avec le reclassement`
                        : e.libelle,
                    date: e.date.toISOString().slice(0, 10),
                })),
                ...nombreSiTronque(parcours.anciennes),
            });
        }
        const auSystemeMinimal = estAuSystemeMinimal(tenant);
        if (!auSystemeMinimal) {
            const chargesDirectes = parcours.chargesDirectes.elements;
            if (chargesDirectes.length > 0) {
                anomalies.push({
                    code: 'CHARGE_SANS_TIERS',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Charge imputée directement sur la trésorerie, sans passer par un tiers',
                    consequence: 'On ne saura jamais à qui cette dépense a été payée : ni relevé fournisseur, ni balance âgée, ni lettrage, ni circularisation possible. La charge et son règlement sont confondus en une seule écriture, ce que le postulat de la comptabilité d’engagement écarte ' +
                        (tenant.referentiel === client_1.Referentiel.SYCEBNL
                            ? '(SYCEBNL, Partie 1, ch. 2).'
                            : '(AUDCIF, Titre V · cadre conceptuel).'),
                    action: 'Passez deux écritures : la charge par le crédit du tiers (compte 40 fournisseur, 42 personnel, 43 organismes sociaux, 44 État selon le cas), puis le règlement par le débit de ce tiers et le crédit de la trésorerie.' +
                        (tenant.referentiel === client_1.Referentiel.SYCEBNL ? ' C’est le schéma des § 2.2 et 2.4 de la Partie 3, ch. 3.' : ''),
                    ...nombreSiTronque(parcours.chargesDirectes),
                    occurrences: chargesDirectes.map((e) => {
                        const lignesLues = lignesHorsRedressementInventaire(e);
                        const lignesDeCharge = lignesLues.filter((l) => (l.compte.numero.startsWith('6') || l.compte.numero.startsWith('8')) &&
                            Number(l.debit) - Number(l.credit) > 0.005);
                        const comptes = lignesLues
                            .filter((l) => l.compte.numero.startsWith('6') || l.compte.numero.startsWith('8'))
                            .map((l) => l.compte.numero)
                            .join(', ');
                        const fraisFinanciers = chargesToutesAu67HorsDotations(lignesDeCharge)
                            ? ' · frais financiers, que la fiche du compte 67 fait débiter « par le crédit des comptes de tiers ' +
                                'concernés ou des comptes de trésorerie » · à justifier par le relevé de banque et le décompte ' +
                                "d'intérêt (éléments de contrôle du compte 67)"
                            : '';
                        return {
                            reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                            detail: `${e.libelle} · ${comptes} soldé(s) directement en trésorerie${fraisFinanciers}`,
                            montant: lignesLues
                                .filter((l) => l.compte.numero.startsWith('6') || l.compte.numero.startsWith('8'))
                                .reduce((s2, l) => s2 + Number(l.debit) - Number(l.credit), 0),
                            date: e.date.toISOString().slice(0, 10),
                        };
                    }),
                });
            }
        }
        if (auSystemeMinimal) {
            const horsModele = parcours.horsModele.elements;
            if (horsModele.length > 0) {
                anomalies.push({
                    code: 'SMT_COMPTE_SANS_POSTE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Provision ou dépréciation dans un dossier au Système minimal de trésorerie',
                    consequence: 'Le modèle d’états du Système minimal de trésorerie n’a aucun poste pour une provision réglementée (15), ' +
                        'une provision pour risques (19) ou une dépréciation d’immobilisation (29) ' +
                        (tenant.referentiel === client_1.Referentiel.SYCEBNL
                            ? '(SYCEBNL, Partie 4 ch. 4, bilan GA à HZ).'
                            : '(AUDCIF, Titre X ch. 2).') +
                        ' Le montant sera présenté sous un poste qui n’est pas le sien.',
                    action: 'Vérifiez que le dossier relève bien du Système minimal de trésorerie. Si oui, contre-passez ces écritures ; sinon, le dossier doit tenir le Système normal.',
                    ...nombreSiTronque(parcours.horsModele),
                    occurrences: horsModele.map((e) => {
                        const lignes = e.lignes.filter((l) => RACINES_SANS_POSTE_SMT.some((r) => l.compte.numero.startsWith(r)));
                        return {
                            reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                            detail: `${e.libelle} · ${lignes.map((l) => l.compte.numero).join(', ')}`,
                            montant: lignes.reduce((s2, l) => s2 + Number(l.credit) - Number(l.debit), 0),
                            date: e.date.toISOString().slice(0, 10),
                        };
                    }),
                });
            }
        }
        if (tenant.referentiel === client_1.Referentiel.SYCEBNL &&
            tenant.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS &&
            !tenant.methodeCotisations) {
            const mouvementees = parcours.cotisationsMouvementees.elements;
            if (mouvementees.length > 0) {
                anomalies.push({
                    code: 'METHODE_COTISATIONS_NON_PRECISEE',
                    gravite: 'AVERTISSEMENT',
                    libelle: "Méthode de comptabilisation des cotisations et du droit d'entrée non précisée",
                    consequence: "Le cadre conceptuel (§ 5.4.2.1) impose de préciser en notes annexes la méthode retenue, et " +
                        "conditionne l'appel au fait que l'entité puisse justifier d'un droit d'agir en recouvrement. " +
                        'Sans ce choix, rien ne dit si les créances portées au 411 Adhérents sont recouvrables, et la ' +
                        'mention obligatoire manque à la liasse.',
                    action: 'Lire les statuts : ouvrent-ils une voie de recouvrement de la cotisation en cas de défaillance ? ' +
                        'Porter la réponse dans Structure > Paramètres du dossier, puis la reprendre dans la note ' +
                        '« Règles et méthodes comptables ».',
                    ...nombreSiTronque(parcours.cotisationsMouvementees),
                    occurrences: mouvementees.map((e) => ({
                        reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                        detail: `${e.libelle} · cotisations ou droit d'entrée mouvementés`,
                        date: e.date.toISOString().slice(0, 10),
                    })),
                });
            }
        }
        if (tenant.referentiel === client_1.Referentiel.SYCEBNL && tenant.methodeCotisations === 'ENCAISSEMENT') {
            const impayes = await this.impayesAdherentReclasses(tenantId, ex, 'ENCAISSEMENT');
            if (impayes.nombre > 0) {
                anomalies.push({
                    code: 'CREANCE_ADHERENT_RECLASSEE_SOUS_ENCAISSEMENT',
                    gravite: 'INFORMATION',
                    libelle: creances_douteuses_1.CONTROLE_CREANCE_ADHERENT_SOUS_ENCAISSEMENT.libelle,
                    consequence: creances_douteuses_1.CONTROLE_CREANCE_ADHERENT_SOUS_ENCAISSEMENT.consequence,
                    action: creances_douteuses_1.CONTROLE_CREANCE_ADHERENT_SOUS_ENCAISSEMENT.action,
                    ...nombreSiTronque(impayes),
                    occurrences: impayes.elements,
                });
            }
        }
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId },
            select: { numero: true, intitule: true, classe: true },
        });
        const incoherents = comptes.filter((c) => c.classe !== `CLASSE_${c.numero[0]}`);
        if (incoherents.length > 0) {
            anomalies.push({
                code: 'COMPTE_HORS_NOMENCLATURE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Compte dont la classe ne suit pas son numéro',
                consequence: "Les états financiers rangent chaque compte d'après sa classe : un compte mal classé apparaît au mauvais poste du bilan ou du compte de résultat.",
                action: 'Corrigez le numéro ou la classe du compte dans le plan comptable.',
                occurrences: incoherents.map((c) => ({
                    reference: c.numero,
                    detail: `${c.intitule} · rangé en ${c.classe.replace('CLASSE_', 'classe ')}`,
                })),
            });
        }
        const classe9 = [...parcours.comptesClasse9];
        const estSycebnlClasse9 = tenant.referentiel === client_1.Referentiel.SYCEBNL;
        const horsEquilibre9 = parcours.classe9HorsEquilibre.elements;
        if (horsEquilibre9.length > 0) {
            anomalies.push({
                code: 'CLASSE_9_HORS_EQUILIBRE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Écriture dont les comptes 90 et 91 ne s’équilibrent pas entre eux',
                consequence: estSycebnlClasse9
                    ? 'Les contributions volontaires en nature « ne doi[vent] pas impacter le bilan et le compte de résultat » ' +
                        '(SYCEBNL, Partie 2 ch. 1), les 900 à 904 se débitant par le crédit des 910 à 914 (ch. 3, classe 9). ' +
                        'Soldée contre un compte des classes 1 à 8, la pièce déplace ce compte et le bilan cesse de boucler.'
                    : 'Les 901 à 904 ont pour contrepartie les 911 à 914, les 905 à 908 les 915 à 918 (AUDCIF, Titre VII, ' +
                        'classe 9). Soldée contre un compte des classes 1 à 8, la pièce déplace ce compte et le bilan cesse de boucler.',
                action: 'Corrigez la pièce par inscription en négatif, puis passez la contrepartie sur le compte 91 qui lui répond.',
                occurrences: horsEquilibre9.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                    detail: e.libelle,
                    date: e.date.toISOString().slice(0, 10),
                })),
                ...nombreSiTronque(parcours.classe9HorsEquilibre),
            });
        }
        const reserveHorsEquilibre = horsEquilibre9.length > 0 ? ' Sauf sur les écritures signalées par le contrôle des comptes 90 et 91 hors équilibre.' : '';
        const contributions = estSycebnlClasse9 ? classe9.filter((n) => /^9[01]/.test(n)) : [];
        const analytiqueSycebnl = estSycebnlClasse9 ? classe9.filter((n) => !/^9[01]/.test(n)) : [];
        if (contributions.length > 0) {
            anomalies.push({
                code: 'CLASSE_9_MOUVEMENTEE',
                gravite: 'INFORMATION',
                libelle: 'Contributions volontaires en nature enregistrées',
                consequence: 'Les comptes de classe 9 sont hors bilan et hors résultat : ils ne modifient ni le résultat ni la situation nette, et se présentent en note annexe.' +
                    reserveHorsEquilibre,
                action: 'Vérifiez que la note annexe des contributions volontaires est renseignée.',
                occurrences: contributions.map((n) => ({ reference: n, detail: 'Compte de contributions volontaires mouvementé' })),
            });
        }
        if (analytiqueSycebnl.length > 0) {
            anomalies.push({
                code: 'CLASSE_9_ANALYTIQUE_MOUVEMENTEE',
                gravite: 'INFORMATION',
                libelle: 'Comptes de la comptabilité analytique de gestion mouvementés (92 à 99)',
                consequence: 'Les comptes 92 à 99 relèvent de la comptabilité analytique de gestion (Partie 2 ch. 3, section 9, sous-section 2) · hors bilan et hors compte de résultat, ils n’entrent dans aucun état de synthèse.',
                action: 'Vérifiez que ces écritures relèvent bien de la comptabilité analytique et non des contributions volontaires.',
                occurrences: analytiqueSycebnl.map((n) => ({ reference: n, detail: 'Compte de comptabilité analytique mouvementé' })),
            });
        }
        if (!estSycebnlClasse9 && classe9.length > 0) {
            anomalies.push({
                code: 'CLASSE_9_MOUVEMENTEE',
                gravite: 'INFORMATION',
                libelle: 'Comptes de classe 9 mouvementés (engagements hors bilan ou comptabilité analytique)',
                consequence: 'Les comptes de classe 9 sont hors bilan et hors compte de résultat. Les engagements des comptes 90 et 91 se portent aux Notes annexes · ils supposent une convention écrite. Les comptes 92 à 99 relèvent de la comptabilité analytique de gestion et n’entrent dans aucun état de synthèse.' +
                    reserveHorsEquilibre,
                action: 'Vérifiez que la note annexe des engagements hors bilan est renseignée.',
                occurrences: classe9.map((n) => ({ reference: n, detail: 'Compte de classe 9 mouvementé' })),
            });
        }
        const seuils = await this.seuilsAuditeur(tenantId, exerciceId, tenant.effectifPermanent);
        const sortieAuscgie = "La société cesse d'être tenue de désigner un commissaire aux comptes lorsqu'elle n'a pas rempli deux des " +
            "conditions pendant les deux exercices précédant l'expiration du mandat du commissaire aux comptes " +
            `(${seuils.source}) · ce contrôle ne regarde qu'un exercice.`;
        const sanctionAuscgie = "L'article 897 de l'AUSCGIE punit les dirigeants qui n'ont pas provoqué la désignation.";
        if (seuils.obligationDeclenchee) {
            const alternatif = seuils.regle.genre === 'ALTERNATIF';
            anomalies.push({
                code: 'SEUIL_AUDITEUR_FRANCHI',
                gravite: 'AVERTISSEMENT',
                libelle: alternatif
                    ? "Seuil de désignation d'un auditeur franchi"
                    : 'Deux des trois seuils de désignation du commissaire aux comptes sont franchis',
                consequence: alternatif
                    ? "L'article 19 de l'Acte uniforme SYCEBNL rend la désignation d'un auditeur OBLIGATOIRE dès qu'un SEUL des " +
                        'trois critères est franchi : total du bilan supérieur à 100 000 000 FCFA, ressources annuelles supérieures ' +
                        "à 200 000 000 FCFA, ou plus de vingt personnes employées à titre permanent. Les articles 24 à 27 prévoient " +
                        'des sanctions pénales.'
                    : `${seuils.source} rend la désignation d'un commissaire aux comptes obligatoire dès que DEUX des trois ` +
                        `conditions sont remplies à la clôture. Le dossier en remplit deux ou plus. ${sanctionAuscgie}`,
                action: alternatif
                    ? "Faites désigner un auditeur, et prévoyez de lui remettre les états financiers et le rapport de gestion au " +
                        "moins 45 jours avant l'assemblée générale (art. 19, alinéa 4)."
                    : `Faites désigner un commissaire aux comptes. ${sortieAuscgie}`,
                occurrences: seuils.franchis.map((f) => ({ reference: f.critere, detail: f.detail })),
            });
        }
        if (seuils.obligationIndeterminee) {
            const alternatif = seuils.regle.genre === 'ALTERNATIF';
            anomalies.push({
                code: 'SEUILS_AUDITEUR_NON_COMPARES',
                gravite: 'INFORMATION',
                libelle: alternatif
                    ? "Seuils de désignation d'un auditeur à comparer en francs congolais"
                    : 'Seuils de désignation du commissaire aux comptes à comparer en francs congolais',
                consequence: `${seuils.source} exprime ses seuils en francs CFA, le dossier est tenu en francs congolais. Les montants ` +
                    'ci-dessous dépassent le nombre du seuil sans lui être comparables · ' +
                    (alternatif
                        ? "l'article 19 compare à « l'équivalent dans l'unité monétaire ayant cours légal dans l'État partie »."
                        : "l'article 906 de l'AUSCGIE fixe l'équivalent à la parité du franc CFA en vigueur le jour de l'adoption " +
                            "de l'Acte uniforme (30 janvier 2014), arrondie à l'unité supérieure. " +
                            sanctionAuscgie),
                action: 'Établissez l’équivalent des seuils en francs congolais avec sa source, puis confrontez-le aux montants de ' +
                    'la liasse arrêtée · OmegaX ne convertit pas et ne conclut pas.' +
                    (alternatif ? '' : ` ${sortieAuscgie}`),
                occurrences: seuils.nonCompares.map((f) => ({ reference: f.critere, detail: f.detail })),
            });
        }
        if (seuils.obligationSansSeuil && seuils.regle.genre === 'TOUJOURS') {
            anomalies.push({
                code: 'COMMISSAIRE_AUX_COMPTES_OBLIGATOIRE',
                gravite: 'INFORMATION',
                libelle: 'Commissaire aux comptes obligatoire, sans condition de taille',
                consequence: `${seuils.regle.source} · ${seuils.regle.motif}` +
                    (tenant.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME ? ` ${sanctionAuscgie}` : ''),
                action: "Vérifiez que le mandat est en cours et que le commissaire recevra les comptes en temps utile.",
                occurrences: [],
            });
        }
        const aujourdhui = new Date();
        const exonerations = tenant.referentiel !== client_1.Referentiel.SYCEBNL
            ? []
            : await this.prisma.exoneration.findMany({
                where: {
                    tenantId,
                    statut: client_1.StatutExoneration.ACCORDE,
                    dateFinValidite: { not: null, lte: new Date(aujourdhui.getTime() + correspondance_exonerations_1.JOURS_ALERTE_RENOUVELLEMENT * 86_400_000) },
                },
                orderBy: { dateFinValidite: 'asc' },
            });
        if (exonerations.length > 0) {
            const perimes = exonerations.filter((e) => e.dateFinValidite < aujourdhui);
            anomalies.push({
                code: 'EXONERATION_A_RENOUVELER',
                gravite: perimes.length > 0 ? 'BLOQUANT' : 'AVERTISSEMENT',
                libelle: perimes.length > 0
                    ? "Arrêté d'exonération EXPIRÉ"
                    : "Arrêté d'exonération à renouveler sous soixante jours",
                consequence: "Aucune franchise ne se présume : « Il ne peut être accordé de franchise des droits et taxes qu'en " +
                    "application des conventions internationales ou que par la loi ou en vertu de celle-ci » (code des " +
                    "douanes, ordonnance-loi n° 10/002, art. 338). Sans arrêté en cours de validité, les droits et taxes " +
                    'sont dus à l’importation, et la marchandise reste au port aux frais de l’entité.',
                action: "Déposez le dossier de renouvellement au Ministère du Plan : requête signée, copie de l'ancien arrêté, " +
                    "rapport d'évaluation sur terrain et liste quantifiée des biens (note circulaire n° 003/2013, " +
                    'section B.III). Le rapport de terrain suppose une descente · c’est lui qui commande le délai.',
                occurrences: exonerations.map((e) => ({
                    reference: e.referenceArrete ?? e.objet,
                    detail: e.dateFinValidite < aujourdhui
                        ? `Expiré le ${e.dateFinValidite.toISOString().slice(0, 10)}`
                        : `Expire le ${e.dateFinValidite.toISOString().slice(0, 10)}`,
                })),
            });
        }
        const premierExercice = await this.prisma.exercice.findFirst({
            where: { tenantId },
            orderBy: { dateDebut: 'asc' },
            select: { dateDebut: true },
        });
        if (premierExercice) {
            const reprises = (await this.prisma.immobilisation.findMany({
                where: {
                    tenantId,
                    statut: 'EN_SERVICE',
                    dateMiseEnService: { not: null, lt: premierExercice.dateDebut },
                    amortissementAnterieur: 0,
                },
                select: {
                    designation: true,
                    dureeNonLimitee: true,
                    dateMiseEnService: true,
                    valeurOrigine: true,
                    compteImmobilisation: { select: { numero: true } },
                },
                orderBy: { dateMiseEnService: 'asc' },
            }))
                .filter(estMisEnService)
                .filter((i) => !(0, comptes_du_bien_1.motifNonAmortissable)(i.compteImmobilisation.numero, tenant.referentiel))
                .filter((i) => !i.dureeNonLimitee)
                .filter(() => !(0, comptes_du_bien_1.motifSansAmortissementProjet)(tenant.jeuEtatsFinanciersSycebnl));
            if (reprises.length > 0) {
                anomalies.push({
                    code: 'IMMO_REPRISE_SANS_ANTERIEUR',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Bien mis en service avant le dossier, sans amortissement antérieur repris',
                    consequence: "Le calcul de la dotation ne connaît que les annuités passées dans ce logiciel : il repart de zéro et " +
                        "amortira le bien sa durée entière une seconde fois. La valeur nette comptable des états s'écartera " +
                        'alors du solde du compte 28 repris par le bilan d’ouverture, sans qu’aucun total ne le signale.',
                    action: "Renseignez l'amortissement déjà pratiqué sur la fiche du bien (Structure > Immobilisations) · c'est le " +
                        'cumul porté au compte 28 pour ce bien à la date de reprise.',
                    occurrences: reprises.slice(0, 200).map((i) => ({
                        reference: i.designation,
                        detail: `Mis en service le ${i.dateMiseEnService.toISOString().slice(0, 10)}, avant l'ouverture du dossier`,
                        montant: Number(i.valeurOrigine),
                        date: i.dateMiseEnService.toISOString().slice(0, 10),
                    })),
                });
            }
        }
        const amortissables = (await this.prisma.immobilisation.findMany({
            where: {
                tenantId,
                statut: 'EN_SERVICE',
                dateMiseEnService: { not: null, lte: ex.dateFin },
            },
            select: {
                designation: true,
                dureeNonLimitee: true,
                dateMiseEnService: true,
                valeurOrigine: true,
                valeurResiduelle: true,
                amortissementAnterieur: true,
                amortissementsDetaches: true,
                reprisesAmortissement: true,
                amortissementsReevaluation: true,
                dotations: { select: { exerciceId: true, montant: true } },
                compteImmobilisation: { select: { numero: true } },
            },
            orderBy: { dateMiseEnService: 'asc' },
        }))
            .filter(estMisEnService)
            .filter((i) => !(0, comptes_du_bien_1.motifNonAmortissable)(i.compteImmobilisation.numero, tenant.referentiel))
            .filter((i) => !i.dureeNonLimitee)
            .filter(() => !(0, comptes_du_bien_1.motifSansAmortissementProjet)(tenant.jeuEtatsFinanciersSycebnl));
        const sansDotation = amortissables.filter((i) => {
            if (i.dotations.some((d) => d.exerciceId === exerciceId))
                return false;
            const base = Number(i.valeurOrigine) - Number(i.valeurResiduelle);
            const cumul = (0, partie_remplacee_1.amortissementsHorsDotations)(i) +
                i.dotations.reduce((t, d) => t + Number(d.montant), 0);
            return base - cumul > 0.005;
        });
        if (sansDotation.length > 0) {
            anomalies.push({
                code: 'IMMO_SANS_DOTATION',
                gravite: 'AVERTISSEMENT',
                libelle: 'Immobilisation amortissable sans dotation sur cet exercice',
                consequence: "L'AUDCIF, art. 45, rend la dotation obligatoire « même en cas d'absence ou d'insuffisance de bénéfice ». " +
                    'Sans elle, le résultat est surévalué du montant non doté et la valeur nette comptable reste à la valeur ' +
                    'brute, sans qu’aucun total ne le signale : les écritures s’équilibrent et la balance boucle. La clôture ' +
                    'rendra l’oubli irréparable, l’exercice n’acceptant plus aucune écriture.',
                action: 'Passez les dotations de l’exercice (Structure > Immobilisations > Dotations) avant de clôturer. Si vos ' +
                    'dotations ont été saisies à la main par une écriture 68/28 sans passer par le module, ce signalement est ' +
                    'sans objet pour les biens concernés.',
                occurrences: sansDotation.slice(0, 200).map((i) => ({
                    reference: i.designation,
                    detail: `Mis en service le ${i.dateMiseEnService.toISOString().slice(0, 10)}, aucune dotation sur cet exercice`,
                    montant: Number(i.valeurOrigine),
                    date: i.dateMiseEnService.toISOString().slice(0, 10),
                })),
            });
        }
        const lignes637 = await this.prisma.ligneEcriture.findMany({
            where: {
                compte: { tenantId, numero: { startsWith: '637' } },
                ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId, estSoldeDesComptesDeGestion: false },
            },
            select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
        });
        const soldes637 = new Map();
        for (const l of lignes637) {
            const acc = soldes637.get(l.compte.numero) ?? { intitule: l.compte.intitule, solde: 0 };
            acc.solde += Number(l.debit) - Number(l.credit);
            soldes637.set(l.compte.numero, acc);
        }
        const restes637 = [...soldes637.entries()]
            .filter(([, v]) => Math.abs(v.solde) > 0.005)
            .sort(([a], [b]) => a.localeCompare(b));
        if (restes637.length > 0) {
            const sourceVirement = tenant.referentiel === client_1.Referentiel.SYCEBNL
                ? 'SYCEBNL, Partie 2 ch. 3, fiches des comptes 63 et 66'
                : 'AUDCIF, Titre VIII ch. 27 § 2';
            anomalies.push({
                code: 'PERSONNEL_EXTERIEUR_NON_VIRE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Personnel extérieur resté au compte 637 à la clôture',
                consequence: `Le texte (${sourceVirement}) veut qu'à la clôture le compte 637 soit viré, POUR SOLDE, au débit du ` +
                    "compte 667 : c'est l'une des quatre applications de la prééminence de la réalité sur l'apparence, la " +
                    "facture étant juridiquement un service extérieur mais économiquement du travail. Tant que le virement " +
                    "n'est pas passé, la charge s'imprime sur la ligne « Services extérieurs » au lieu de « Charges de " +
                    'personnel ». Le résultat net ne bouge pas, les deux comptes étant en classe 6 : rien ne se ' +
                    "déséquilibre et l'oubli ne se signale jamais de lui-même.",
                action: 'Passez le virement de fin d’exercice : débit 667 « Rémunération transférée de personnel extérieur », ' +
                    'crédit 637 pour le solde. Pensez à indiquer aux notes annexes l’origine des charges ainsi transférées, ' +
                    'afin de ne pas fausser l’assiette des prélèvements assis sur la masse salariale.',
                occurrences: restes637.slice(0, 200).map(([numero, v]) => ({
                    reference: `${numero} ${v.intitule}`,
                    detail: 'Solde débiteur non viré au compte 667',
                    montant: Math.round(v.solde * 100) / 100,
                })),
            });
        }
        const lignes29 = await this.prisma.ligneEcriture.findMany({
            where: {
                compte: { tenantId, numero: { startsWith: '29' } },
                ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId },
            },
            select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
        });
        const soldes29 = new Map();
        for (const l of lignes29) {
            const acc = soldes29.get(l.compte.numero) ?? { intitule: l.compte.intitule, solde: 0 };
            acc.solde += Number(l.credit) - Number(l.debit);
            soldes29.set(l.compte.numero, acc);
        }
        if ([...soldes29.values()].some((v) => v.solde > 0.005)) {
            const duModule = await this.prisma.depreciationImmobilisation.findMany({
                where: { exerciceId, immobilisation: { tenantId } },
                select: { sens: true, montant: true, compteDepreciation: { select: { numero: true } } },
            });
            for (const d of duModule) {
                const acc = soldes29.get(d.compteDepreciation.numero);
                if (!acc)
                    continue;
                acc.solde -= d.sens === client_1.SensDepreciation.DOTATION ? Number(d.montant) : -Number(d.montant);
            }
        }
        const depreciations = [...soldes29.entries()]
            .filter(([, v]) => v.solde > 0.005)
            .sort(([a], [b]) => a.localeCompare(b));
        if (depreciations.length > 0) {
            const immosDuModule = await this.prisma.immobilisation.count({
                where: { tenantId, statut: 'EN_SERVICE' },
            });
            if (immosDuModule > 0) {
                const sourceDepreciation = tenant.referentiel === client_1.Referentiel.SYCEBNL
                    ? 'SYCEBNL, Partie 2 ch. 3, fiche du compte 29'
                    : 'AUDCIF art. 46 et Titre VIII ch. 12';
                anomalies.push({
                    code: 'DEPRECIATION_IMMO_HORS_MODULE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Dépréciation d’immobilisation que le module ne connaît pas',
                    consequence: `Le texte (${sourceDepreciation}) inscrit la dépréciation en diminution de la valeur brute pour ` +
                        'donner la valeur comptable nette. Le module d’immobilisations ne la connaît pas : sa base ' +
                        'amortissable reste la valeur d’origine diminuée de la seule valeur résiduelle, et sa SORTIE de bien ' +
                        'ne solde pas le compte 29. Sur un bien déprécié, la valeur comptable nette portée au compte 81 sera ' +
                        'donc surévaluée du montant déprécié, la plus ou moins-value de cession fausse d’autant, et le ' +
                        'compte 29 gardera un solde pour un bien qui n’existe plus. Rien ne se déséquilibre : l’écriture ' +
                        'reste équilibrée et la balance boucle.',
                    action: 'Avant de sortir un bien déprécié, passez la reprise de sa dépréciation à la main (débit 29, crédit ' +
                        '79 ou 863 selon le caractère de l’opération), puis sortez le bien. Vérifiez aussi le plan ' +
                        'd’amortissement des biens dépréciés, que le module continue de calculer sur la base d’origine.',
                    occurrences: depreciations.slice(0, 200).map(([numero, v]) => ({
                        reference: `${numero} ${v.intitule}`,
                        detail: 'Dépréciation portée hors du module d’immobilisations',
                        montant: Math.round(v.solde * 100) / 100,
                    })),
                });
            }
        }
        {
            const [immosEcr, dotationsEcr, depreciationsEcr, reclassementsEcr, derogatoiresEcr, cloturesEcr] = await Promise.all([
                this.prisma.immobilisation.findMany({
                    where: {
                        tenantId,
                        OR: [
                            { ecritureAcquisition: { exerciceId } },
                            { ecritureSortie: { exerciceId } },
                            { ecritureProduitCession: { exerciceId } },
                        ],
                    },
                    select: { ecritureAcquisitionId: true, ecritureSortieId: true, ecritureProduitCessionId: true },
                }),
                this.prisma.dotationAmortissement.findMany({ where: { exerciceId, immobilisation: { tenantId } }, select: { ecritureId: true } }),
                this.prisma.depreciationImmobilisation.findMany({ where: { exerciceId, immobilisation: { tenantId } }, select: { ecritureId: true } }),
                this.prisma.reclassementImmobilisation.findMany({ where: { exerciceId, immobilisation: { tenantId } }, select: { ecritureId: true } }),
                this.prisma.amortissementDerogatoire.findMany({ where: { tenantId, exerciceId }, select: { ecritureId: true } }),
                this.prisma.clotureLocationAcquisition.findMany({ where: { tenantId, exerciceId }, select: { ecritureId: true, ecritureExtourneId: true } }),
            ]);
            const retenues = new Set([
                ...immosEcr.flatMap((i) => [i.ecritureAcquisitionId, i.ecritureSortieId, i.ecritureProduitCessionId]),
                ...dotationsEcr.map((d) => d.ecritureId),
                ...depreciationsEcr.map((d) => d.ecritureId),
                ...reclassementsEcr.map((d) => d.ecritureId),
                ...derogatoiresEcr.map((d) => d.ecritureId),
                ...cloturesEcr.flatMap((c) => [c.ecritureId, c.ecritureExtourneId]),
            ].filter((x) => !!x));
            const lignes28 = await this.prisma.ligneEcriture.findMany({
                where: {
                    compte: { tenantId, numero: { startsWith: '28' } },
                    credit: { gt: 0 },
                    ecriture: {
                        tenantId,
                        exerciceId,
                        ...ecritures_de_situation_1.HORS_SITUATION,
                        estGenereeParCloture: false,
                        estANouveauProvisoire: false,
                        id: { notIn: [...retenues] },
                        reevaluationBilan: null,
                        annulationTraitementOrigine: null,
                        annulationTraitementNegatif: null,
                    },
                },
                select: { credit: true, compte: { select: { numero: true, intitule: true } } },
            });
            const hors = new Map();
            for (const l of lignes28) {
                const acc = hors.get(l.compte.numero) ?? { intitule: l.compte.intitule, montant: 0 };
                acc.montant += Number(l.credit);
                hors.set(l.compte.numero, acc);
            }
            const amortissementsHors = [...hors.entries()].filter(([, v]) => v.montant > 0.005).sort(([a], [b]) => a.localeCompare(b));
            if (amortissementsHors.length > 0) {
                const source = tenant.referentiel === client_1.Referentiel.SYCEBNL ? 'SYCEBNL, Partie 2 ch. 3, fiche du compte 28' : 'AUDCIF, Titre VII, fiche du compte 28';
                anomalies.push({
                    code: 'AMORTISSEMENT_IMMO_HORS_MODULE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Amortissement d’immobilisation que le module ne connaît pas',
                    consequence: `Le compte 28 (${source}) a reçu dans l’exercice des amortissements passés hors de la fiche du bien. ` +
                        'Le module ne les connaît pas : sur un bien qui a sa fiche, il passera sa propre dotation et le bien sera ' +
                        'amorti deux fois ; sur un bien sans fiche, aucun tableau ne le porte et sa sortie ne soldera pas le 28. ' +
                        'Rien ne se déséquilibre : l’écriture reste équilibrée et la balance boucle.',
                    action: 'Créez la fiche du bien (ou déclarez-le repris avec son amortissement antérieur), puis contre-passez ' +
                        'l’amortissement passé à la main et dotez par la fiche.',
                    occurrences: amortissementsHors.slice(0, 200).map(([numero, v]) => ({
                        reference: `${numero} ${v.intitule}`,
                        detail: 'Amortissement porté hors du module d’immobilisations',
                        montant: Math.round(v.montant * 100) / 100,
                    })),
                });
            }
        }
        const lignes106 = await this.prisma.ligneEcriture.findMany({
            where: {
                compte: { tenantId, numero: { startsWith: '106' } },
                ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId, reevaluationBilan: null, immobilisationSortieEcartReevaluation: null },
            },
            select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
        });
        const soldes106 = new Map();
        for (const l of lignes106) {
            const acc = soldes106.get(l.compte.numero) ?? { intitule: l.compte.intitule, solde: 0 };
            acc.solde += Number(l.credit) - Number(l.debit);
            soldes106.set(l.compte.numero, acc);
        }
        const ecartsReevaluation = [...soldes106.entries()]
            .filter(([, v]) => v.solde > 0.005)
            .sort(([a], [b]) => a.localeCompare(b));
        if (ecartsReevaluation.length > 0) {
            const immosReevaluees = await this.prisma.immobilisation.count({
                where: { tenantId, statut: 'EN_SERVICE' },
            });
            if (immosReevaluees > 0) {
                const estSycebnlReevaluation = tenant.referentiel === client_1.Referentiel.SYCEBNL;
                anomalies.push({
                    code: 'REEVALUATION_IMMO_HORS_MODULE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Écart de réévaluation que le module d’immobilisations ne connaît pas',
                    consequence: (estSycebnlReevaluation
                        ? 'Le SYCEBNL (cadre conceptuel § 3.3.1.2.1 et fiche du compte 106) fait de l’écart de ' +
                            'réévaluation la contrepartie au passif de l’augmentation de valeur portée à l’actif. '
                        : 'L’AUDCIF (art. 62 à 65 et Titre VIII ch. 28) impose en outre que la valeur RÉÉVALUÉE serve de ' +
                            'base aux amortissements sur la durée restant à courir (art. 64), et que le solde de l’écart ' +
                            'd’un bien cédé soit transféré à une réserve non distribuable (ch. 28 § 6). ') +
                        'Or le module d’immobilisations garde la valeur d’origine historique : il continue d’amortir et de ' +
                        'sortir le bien sur cette base. Le bilan porte la valeur réévaluée, le module la valeur ancienne, et ' +
                        'aucune écriture ne se déséquilibre · la balance boucle des deux façons.',
                    action: 'Reprenez à la main le plan d’amortissement des biens réévalués, et, avant toute cession, la sortie ' +
                        'de l’écart de réévaluation correspondant. Vérifiez aussi que la réévaluation porte bien sur ' +
                        'l’ENSEMBLE des immobilisations corporelles et financières : une réévaluation partielle est ' +
                        'interdite.',
                    occurrences: ecartsReevaluation.slice(0, 200).map(([numero, v]) => ({
                        reference: `${numero} ${v.intitule}`,
                        detail: 'Écart de réévaluation porté hors du module d’immobilisations',
                        montant: Math.round(v.solde * 100) / 100,
                    })),
                });
            }
        }
        const lignesFiscales = await this.prisma.ligneEcriture.findMany({
            where: {
                compte: { tenantId, OR: [{ numero: { startsWith: '613' } }, { numero: { startsWith: '781' } }] },
                ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId, estSoldeDesComptesDeGestion: false },
            },
            select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
        });
        const mouvement = (prefixe) => lignesFiscales
            .filter((l) => l.compte.numero.startsWith(prefixe))
            .reduce((t, l) => t + Number(l.debit) + Number(l.credit), 0);
        const solde613 = lignesFiscales
            .filter((l) => l.compte.numero.startsWith('613'))
            .reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0);
        if (tenant.referentiel === client_1.Referentiel.SYSCOHADA && solde613 > 0.005 && mouvement('781') <= 0.005) {
            anomalies.push({
                code: 'TRANSPORT_TIERS_SANS_TRANSFERT',
                gravite: 'AVERTISSEMENT',
                libelle: 'Transport pour le compte de tiers sans transfert de charges',
                consequence: 'Le compte 613 porte un solde débiteur alors qu’aucun compte 781 « Transferts de charges » n’a été ' +
                    'mouvementé de l’exercice. Un transport avancé pour le compte d’un tiers se refacture : sans le ' +
                    'transfert, la charge reste dans le résultat de l’entité, qui s’en trouve minoré du montant refacturé. ' +
                    'L’administration fiscale lit cette absence comme un indice de minoration de la base imposable.',
                action: 'Si ces transports ont bien été refacturés, passez le transfert de charges au crédit du compte 781. ' +
                    'S’ils sont restés à votre charge, le compte 613 n’est pas le bon : ils relèvent alors du compte 61 ' +
                    'correspondant à la nature du transport.',
                occurrences: [{ reference: '613 Transports pour le compte de tiers', detail: 'Solde débiteur non transféré', montant: Math.round(solde613 * 100) / 100 }],
            });
        }
        const exercicePrecedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lt: ex.dateDebut } },
            orderBy: { dateFin: 'desc' },
            select: { id: true, dateDebut: true, dateFin: true, motifOuvertureSuivanteConservee: true, ecartsOuvertureSuivanteConservee: true },
        });
        if (exercicePrecedent && exercicePrecedent.dateFin < ex.dateDebut) {
            const lignesRegul = await this.prisma.ligneEcriture.findMany({
                where: {
                    compte: { tenantId, OR: [{ numero: { startsWith: '476' } }, { numero: { startsWith: '477' } }] },
                    ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId: { in: [exerciceId, exercicePrecedent.id] } },
                },
                select: {
                    debit: true,
                    credit: true,
                    ecriture: { select: { exerciceId: true } },
                    compte: { select: { numero: true, intitule: true } },
                },
            });
            const ecarts = [];
            for (const prefixe of ['476', '477']) {
                const duCompte = lignesRegul.filter((l) => l.compte.numero.startsWith(prefixe));
                const numeros = [...new Set(duCompte.map((l) => l.compte.numero))];
                for (const numero of numeros) {
                    const lignes = duCompte.filter((l) => l.compte.numero === numero);
                    const soldePrecedent = lignes
                        .filter((l) => l.ecriture.exerciceId === exercicePrecedent.id)
                        .reduce((t, l) => t + (prefixe === '476' ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit)), 0);
                    const extourne = lignes
                        .filter((l) => l.ecriture.exerciceId === exerciceId)
                        .reduce((t, l) => t + (prefixe === '476' ? Number(l.credit) : Number(l.debit)), 0);
                    if (soldePrecedent > 0.005 && Math.abs(extourne - soldePrecedent) > 0.005) {
                        ecarts.push({ numero, intitule: lignes[0].compte.intitule, repris: soldePrecedent, extourne });
                    }
                }
            }
            if (ecarts.length > 0) {
                anomalies.push({
                    code: 'EXTOURNE_REGULARISATION_INCOHERENTE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Extourne de régularisation d’un montant différent du solde repris',
                    consequence: 'Une charge ou un produit constaté d’avance à la clôture précédente doit être extourné à l’ouverture ' +
                        'POUR SON MONTANT EXACT. Extourner moins laisse au bilan une régularisation qui n’a plus d’objet ; ' +
                        'extourner plus crée une charge ou un produit qui n’a jamais existé. Dans les deux sens le résultat ' +
                        'de l’exercice est faux, et rien ne le signale : l’écriture s’équilibre et le solde de clôture peut ' +
                        'redevenir parfaitement normal. C’est précisément ce que l’administration fiscale recherche sur ces ' +
                        'deux comptes.',
                    action: 'Rapprochez l’extourne du solde repris, compte par compte, et corrigez l’écart. Si l’écart est ' +
                        'volontaire (une part de la régularisation court encore), la reprise doit être étalée par une ' +
                        'écriture explicite, pas par une extourne partielle silencieuse.',
                    occurrences: ecarts.slice(0, 200).map((e) => ({
                        reference: `${e.numero} ${e.intitule}`,
                        detail: `Solde repris ${e.repris.toFixed(2)}, extourné ${e.extourne.toFixed(2)}`,
                        montant: Math.round((e.extourne - e.repris) * 100) / 100,
                    })),
                });
            }
            if (tenant.referentiel === client_1.Referentiel.SYSCOHADA) {
                const lignes419 = await this.prisma.ligneEcriture.findMany({
                    where: {
                        compte: { tenantId, numero: { startsWith: '419' } },
                        ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId: exercicePrecedent.id },
                    },
                    select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
                });
                const soldes419 = new Map();
                for (const l of lignes419.filter((x) => x.compte.numero.startsWith('419'))) {
                    const acc = soldes419.get(l.compte.numero) ?? { intitule: l.compte.intitule, solde: 0 };
                    acc.solde += Number(l.credit) - Number(l.debit);
                    soldes419.set(l.compte.numero, acc);
                }
                const avancesReportees = [...soldes419.entries()]
                    .filter(([, v]) => v.solde > 0.005)
                    .sort(([a], [b]) => a.localeCompare(b));
                if (avancesReportees.length > 0) {
                    anomalies.push({
                        code: 'AVANCE_CLIENT_REPORTEE',
                        gravite: 'INFORMATION',
                        libelle: 'Avances clients reçues à l’exercice précédent, à rattacher au chiffre d’affaires',
                        consequence: 'Des avances et acomptes reçus des clients figuraient au compte 419 à la clôture précédente. ' +
                            'L’administration fiscale considère que ces avances constituent le chiffre d’affaires de ' +
                            'l’exercice suivant : maintenues au passif sans que la vente soit constatée, elles minorent le ' +
                            'produit imposable. Ce n’est pas une règle de l’AUDCIF mais une position de contrôle, d’où un ' +
                            'simple signalement.',
                        action: 'Vérifiez, avance par avance, que la livraison ou la prestation a été facturée sur cet exercice et ' +
                            'que le compte 419 a été soldé en conséquence. Une avance qui subsiste doit pouvoir être ' +
                            'justifiée par une commande encore en cours.',
                        occurrences: avancesReportees.slice(0, 200).map(([numero, v]) => ({
                            reference: `${numero} ${v.intitule}`,
                            detail: 'Solde créditeur à la clôture de l’exercice précédent',
                            montant: Math.round(v.solde * 100) / 100,
                        })),
                    });
                }
            }
        }
        if (tenant.referentiel === client_1.Referentiel.SYSCOHADA &&
            !(tenant.formeJuridiqueSyscohada && correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(tenant.formeJuridiqueSyscohada))) {
            const lignes462 = await this.prisma.ligneEcriture.findMany({
                where: {
                    compte: { tenantId, numero: { startsWith: '462' } },
                    ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId },
                },
                select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
            });
            const soldes462 = new Map();
            for (const l of lignes462.filter((x) => x.compte.numero.startsWith('462'))) {
                const acc = soldes462.get(l.compte.numero) ?? { intitule: l.compte.intitule, solde: 0 };
                acc.solde += Number(l.debit) - Number(l.credit);
                soldes462.set(l.compte.numero, acc);
            }
            const debiteurs = [...soldes462.entries()].filter(([, v]) => v.solde > 0.005).sort(([a], [b]) => a.localeCompare(b));
            if (debiteurs.length > 0) {
                const interdiction = (0, conventions_interdites_1.conventionInterditeCompteCourant)(tenant.formeJuridiqueSyscohada);
                anomalies.push({
                    code: 'COMPTE_COURANT_ASSOCIE_DEBITEUR',
                    gravite: 'INFORMATION',
                    libelle: 'Compte courant d’associé débiteur',
                    consequence: 'Les sommes mises à la disposition des associés à titre d’avances, de prêts ou d’acomptes sont ' +
                        'présumées revenus distribués, sauf preuve contraire (loi n° 23/053, art. 73, al. 2, 2°, a), et portent ' +
                        'la retenue de 20 % de l’art. 120. Remboursées, elles viennent en déduction pour la période du remboursement.' +
                        (interdiction ? ` ${interdiction}` : ''),
                    action: interdiction
                        ? 'Identifiez le titulaire de chaque solde débiteur. Justifiez-le par un remboursement intervenu, ou par une ' +
                            'convention de prêt seulement si le titulaire n’est pas visé par l’interdiction ci-dessus, ou traitez-le ' +
                            'en revenu distribué. OmegaX ne qualifie aucun solde et ne chiffre aucune retenue.'
                        : 'Justifiez chaque solde débiteur (convention de prêt, remboursement intervenu) ou traitez-le en revenu ' +
                            'distribué. OmegaX ne chiffre aucune retenue.',
                    occurrences: debiteurs.slice(0, 200).map(([numero, v]) => ({
                        reference: `${numero} ${v.intitule}`,
                        detail: 'Solde débiteur sur l’exercice',
                        montant: Math.round(v.solde * 100) / 100,
                    })),
                });
            }
        }
        if (tenant.referentiel === client_1.Referentiel.SYSCOHADA && this.ecritureService && this.etatsSyscohada) {
            const lignes = await (0, etats_financiers_communs_1.chargerLignes)(this.ecritureService, tenantId, exerciceId);
            const soldeRacine = (racine) => lignes.filter((l) => l.numero.startsWith(racine)).reduce((t, l) => t + Number(l.solde), 0);
            const cp = this.etatsSyscohada.resoudreBilanSurLignes(lignes).resolution.parRef.get('CP')?.montant ?? 0;
            const verdict = (0, moitie_capital_1.verdictMoitieCapital)(tenant.formeJuridiqueSyscohada, cp, soldeRacine('109'), -soldeRacine('101'));
            const solde109 = soldeRacine('109');
            const solde1011 = soldeRacine('1011');
            if (Math.abs(solde109 + solde1011) > 0.005) {
                anomalies.push({
                    code: 'CAPITAL_NON_APPELE_DISCORDANT',
                    gravite: 'INFORMATION',
                    libelle: 'Capital souscrit non appelé · le 109 et le 1011 ne se correspondent pas',
                    consequence: 'La fiche du compte 109 (AUDCIF, Titre VII) donne pour élément de contrôle le « compte 1011 (Capital ' +
                        'souscrit, non appelé), de solde opposé et de montant identique ». Ici les deux soldes ne se ' +
                        'compensent pas.',
                    action: 'Vérifiez les décisions d’appel de fonds · un appel se passe au 1011 vers le 1012 et au 467 par le crédit ' +
                        'du 109.',
                    occurrences: [
                        { reference: '109', detail: 'Solde débiteur (positif) ou créditeur (négatif)', montant: Math.round(solde109 * 100) / 100 },
                        { reference: '1011', detail: 'Solde débiteur (positif) ou créditeur (négatif)', montant: Math.round(solde1011 * 100) / 100 },
                    ],
                });
            }
            if (verdict) {
                anomalies.push({
                    code: 'CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL',
                    gravite: 'INFORMATION',
                    libelle: 'Capitaux propres inférieurs à la moitié du capital social',
                    consequence: verdict.consequence,
                    action: verdict.action,
                    occurrences: [
                        { reference: 'Capitaux propres', detail: 'Total du bilan augmenté du capital non appelé', montant: verdict.capitauxPropres },
                        { reference: 'Capital social', detail: 'Solde créditeur du compte 101', montant: verdict.capital },
                    ],
                });
            }
        }
        if (tenant.referentiel === client_1.Referentiel.SYSCOHADA && !auSystemeMinimal) {
            const groupesRp = await this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: {
                    ecriture: { tenantId, exerciceId, statut: client_1.StatutEcriture.VALIDEE },
                    OR: exports.RACINES_RESERVE_PROPRIETE.map((r) => ({ compte: { tenantId, numero: { startsWith: r.racine } } })),
                },
                _sum: { debit: true, credit: true },
            });
            const idsRp = groupesRp.map((g) => g.compteId);
            const comptesRp = idsRp.length
                ? await this.prisma.compte.findMany({
                    where: { tenantId, id: { in: idsRp } },
                    select: { id: true, numero: true },
                })
                : [];
            const numeroRp = new Map(comptesRp.map((c) => [c.id, c.numero]));
            const soldeParRacine = new Map();
            for (const g of groupesRp) {
                const numero = numeroRp.get(g.compteId);
                const racine = numero && exports.RACINES_RESERVE_PROPRIETE.find((r) => numero.startsWith(r.racine));
                if (!racine)
                    continue;
                const solde = Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
                soldeParRacine.set(racine.racine, (soldeParRacine.get(racine.racine) ?? 0) + solde);
            }
            const soldesRp = exports.RACINES_RESERVE_PROPRIETE.map((r) => ({
                ...r,
                solde: Math.round((soldeParRacine.get(r.racine) ?? 0) * 100) / 100,
            })).filter((r) => Math.abs(r.solde) > 0.005);
            if (soldesRp.length > 0) {
                anomalies.push({
                    code: 'RESERVE_PROPRIETE_A_MENTIONNER',
                    gravite: 'INFORMATION',
                    libelle: 'Réserve de propriété à mentionner aux Notes annexes',
                    consequence: 'Les Notes annexes doivent indiquer, quelle que soit leur importance relative, les montants des ' +
                        'immobilisations, des stocks, des clients (et autres créances) et des fournisseurs (et autres dettes) ' +
                        'frappés de réserve de propriété (AUDCIF, Titre VIII ch. 9, section 3). Seul le montant des clients a ' +
                        'une ligne propre, en Note 7 (4116) · les trois autres n’ont aucune case.',
                    action: 'Portez les trois autres montants en Note 2 D, informations complémentaires relatives au bilan ' +
                        '(emplacement retenu par OmegaX, le texte n’en désigne aucun). Des montants dérisoires peuvent ne pas ' +
                        'être fournis (même section). Le montant des stocks frappés de réserve de propriété ne se suit que ' +
                        'dans une entité qui tient un inventaire permanent (§ 3.1).',
                    occurrences: soldesRp.map((r) => ({
                        reference: `${r.racine} ${r.intitule}`,
                        detail: `Solde ${r.solde > 0 ? 'débiteur' : 'créditeur'} à la clôture (livre-journal)`,
                        montant: r.solde,
                    })),
                });
            }
        }
        if (!ex.dateArreteComptes) {
            const sourceArrete = tenant.referentiel === client_1.Referentiel.SYCEBNL
                ? "AUDCIF art. 23, rendu applicable aux entités à but non lucratif par l'art. 3 du SYCEBNL, qui ne " +
                    "l'exclut pas"
                : 'AUDCIF art. 23 et Titre IX ch. 1 § 2.4';
            anomalies.push({
                code: 'DATE_ARRETE_NON_RENSEIGNEE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Date d’arrêté des comptes non renseignée',
                consequence: `Le texte (${sourceArrete}) exige que la date d’arrêté figure dans toute publication des états ` +
                    'financiers. Ce n’est pas la date de clôture : l’arrêté par les organes dirigeants lui est postérieur ' +
                    'de plusieurs semaines, dans la limite de quatre mois (Titre VIII ch. 31 § 1.3). Tant qu’elle manque, ' +
                    'les états s’impriment et s’exportent sans elle, avec des totaux justes et une mention obligatoire en ' +
                    'moins · rien ne le signale avant le dépôt.',
                action: 'Renseignez la date à laquelle les organes dirigeants ont arrêté les comptes, dans la fenêtre ' +
                    'Exercices. Elle s’imprimera ensuite sur chaque page des états.',
                occurrences: [
                    {
                        reference: `Exercice clos le ${ex.dateFin.toISOString().slice(0, 10)}`,
                        detail: 'Aucune date d’arrêté enregistrée pour cet exercice',
                        date: ex.dateFin.toISOString().slice(0, 10),
                    },
                ],
            });
        }
        const manuel = await this.prisma.manuelProcedures.findFirst({
            where: { tenantId },
            orderBy: { version: 'desc' },
            select: { version: true, sections: true },
        });
        if (!manuel) {
            anomalies.push({
                code: 'MANUEL_PROCEDURES_ABSENT',
                gravite: 'AVERTISSEMENT',
                libelle: 'Manuel des procédures et de l’organisation comptables absent',
                consequence: `Le texte (${(0, manuel_procedures_service_1.sourceManuel)(tenant.referentiel)}) impose ce manuel à toute entité, et l’article 17, 3° y ` +
                    'renvoie pour l’ordre de classement des pièces justificatives. Sans lui, cet ordre n’est écrit nulle ' +
                    'part, et la justification des écritures perd son point d’appui. Rien ne le signale par ailleurs : la ' +
                    'comptabilité reste équilibrée et les états se produisent normalement.',
                action: 'Établissez le manuel dans la fenêtre Documents obligatoires · un squelette des sept rubriques ' +
                    'proposées par le CPCC vous y attend, à compléter et à adapter. Ni la forme ni le contenu ne sont ' +
                    'imposés par le texte.',
                occurrences: [
                    { reference: tenant.nom ?? 'Dossier', detail: 'Aucune version de manuel enregistrée pour ce dossier' },
                ],
            });
        }
        else if (!manuel.sections.some((sec) => sec.cle === 'classement-archivage' && sec.texte.trim().length > 0)) {
            anomalies.push({
                code: 'MANUEL_SANS_ORDRE_DE_CLASSEMENT',
                gravite: 'INFORMATION',
                libelle: 'Le manuel ne décrit pas l’ordre de classement des pièces',
                consequence: 'L’article 17, 3° de l’AUDCIF exige que les pièces justificatives soient « conservées, classées dans ' +
                    'un ordre DÉFINI DANS LE MANUEL décrivant les procédures et l’organisation comptables ». La version ' +
                    `${manuel.version} du manuel existe mais laisse cette section vide : l’article renvoie alors à un ` +
                    'ordre que personne n’a écrit.',
                action: 'Complétez la section « Système de classement et d’archivage des documents et pièces comptables » du ' +
                    'manuel, puis enregistrez une nouvelle version.',
                occurrences: [
                    { reference: `Manuel version ${manuel.version}`, detail: 'Section de classement et d’archivage vide' },
                ],
            });
        }
        const brut12 = await this.prisma.ligneEcriture.findMany({
            where: {
                compte: { tenantId, numero: { startsWith: '12' } },
                ecriture: {
                    tenantId,
                    exerciceId,
                    ...ecritures_de_situation_1.HORS_SITUATION,
                    estGenereeParCloture: false,
                    motifImputationOuverture: null,
                    affectationResultat: null,
                },
            },
            select: {
                debit: true,
                credit: true,
                compte: { select: { numero: true, intitule: true } },
                ecriture: { select: { numeroPiece: true, date: true, libelle: true } },
            },
        });
        const lignes12 = brut12.filter((l) => l.compte?.numero?.startsWith('12') && l.ecriture);
        if (lignes12.length > 0) {
            anomalies.push({
                code: 'IMPUTATION_REPORT_A_NOUVEAU_NON_DECLAREE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Report à nouveau mouvementé hors clôture et hors exception déclarée',
                consequence: `Le bilan d’ouverture d’un exercice doit correspondre au bilan de clôture du précédent (${tenant.referentiel === client_1.Referentiel.SYCEBNL
                    ? 'SYCEBNL art. 16, 4) et cadre conceptuel § 3.3.1.2.4'
                    : 'AUDCIF art. 34 et Titre V'}). Les incidences d’un changement de méthode et les charges ou produits d’exercices antérieurs omis ` +
                    'transitent par le compte de résultat, JAMAIS directement par les capitaux propres. Deux exceptions ' +
                    'seulement : un changement de méthode à impact fort significatif, et la correction d’une erreur ' +
                    'significative d’un exercice antérieur. Ces écritures n’en déclarent aucune · elles rompent donc la ' +
                    'correspondance sans qu’aucun total ne bouge, et rien ne les distingue d’une erreur d’imputation.',
                action: 'Si l’imputation relève de l’une des deux exceptions, refaites-la depuis la fenêtre Exercices, bloc ' +
                    '« Imputation aux capitaux propres d’ouverture », en indiquant le motif et sa justification (les deux ' +
                    'textes exigent l’information en Notes annexes). Sinon, extournez et passez l’opération par le compte ' +
                    'de résultat.',
                occurrences: lignes12.slice(0, 200).map((l) => ({
                    reference: `${l.compte.numero} ${l.compte.intitule}`,
                    detail: `Pièce ${l.ecriture.numeroPiece} · ${l.ecriture.libelle}`,
                    montant: Math.round((Number(l.debit) - Number(l.credit)) * 100) / 100,
                    date: l.ecriture.date.toISOString().slice(0, 10),
                })),
            });
        }
        if (exercicePrecedent && exercicePrecedent.dateFin < ex.dateDebut && exercicePrecedent.motifOuvertureSuivanteConservee) {
            const gardes = (exercicePrecedent.ecartsOuvertureSuivanteConservee ?? null);
            const positions = gardes?.ecarts ?? [];
            anomalies.push({
                code: 'OUVERTURE_DIFFERENTE_DE_LA_CLOTURE_DECLAREE',
                gravite: 'INFORMATION',
                libelle: 'Ouverture conservée, différente du bilan de clôture de l’exercice précédent',
                consequence: `Le bilan d’ouverture d’un exercice correspond au bilan de clôture du précédent (${tenant.referentiel === client_1.Referentiel.SYCEBNL ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34'}). À la clôture de l’exercice précédent, l’ouverture déjà passée dans celui-ci a été déclarée faire foi · ` +
                    `motif · « ${exercicePrecedent.motifOuvertureSuivanteConservee} ». Dans OmegaX, les deux bilans diffèrent sur ` +
                    `${gardes?.total ?? positions.length} position(s) · les colonnes N-1 et les cumuls pluriannuels ne s’enchaînent pas sur ces comptes.`,
                action: 'Rien à corriger si la déclaration est exacte · gardez le motif et ses pièces au dossier, et dites l’écart en Notes annexes ' +
                    '(comparabilité de la colonne N-1).',
                occurrences: positions.slice(0, 200).map((p) => ({
                    reference: `${p.numero ?? '?'}${p.devise ? ` (${p.devise})` : ''}`,
                    detail: `Clôture précédente ${p.cloture.toFixed(2)} · ouverture conservée ${p.ouverture.toFixed(2)}`,
                    montant: Math.round((p.ouverture - p.cloture) * 100) / 100,
                })),
            });
        }
        const batimentsSolPropre = await this.prisma.immobilisation.findMany({
            where: {
                tenantId,
                statut: 'EN_SERVICE',
                compteImmobilisation: { numero: { startsWith: '231' } },
            },
            select: {
                designation: true,
                valeurOrigine: true,
                dateAcquisition: true,
                compteImmobilisation: { select: { numero: true, intitule: true } },
                ecritureAcquisition: {
                    select: { numeroPiece: true, lignes: { select: { compte: { select: { numero: true } } } } },
                },
            },
        });
        const sansLigneDeTerrain = batimentsSolPropre.filter((i) => i.compteImmobilisation?.numero?.startsWith('231') &&
            i.ecritureAcquisition &&
            !i.ecritureAcquisition.lignes.some((l) => l.compte?.numero?.startsWith('22')));
        let sansTerrain = sansLigneDeTerrain;
        if (sansLigneDeTerrain.length > 0) {
            const jour = (d) => d.toISOString().slice(0, 10);
            const dates = [...new Set(sansLigneDeTerrain.map((i) => jour(i.dateAcquisition)))].map((d) => new Date(d));
            const [terrains, lignesTerrain] = await Promise.all([
                this.prisma.immobilisation.findMany({
                    where: { tenantId, compteImmobilisation: { numero: { startsWith: '22' } } },
                    select: { dateAcquisition: true },
                }),
                this.prisma.ligneEcriture.findMany({
                    where: {
                        debit: { gt: 0 },
                        compte: { tenantId, numero: { startsWith: '22' } },
                        ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, date: { in: dates } },
                    },
                    select: { ecriture: { select: { date: true } } },
                }),
            ]);
            const joursVentiles = new Set([
                ...terrains.map((t) => jour(t.dateAcquisition)),
                ...lignesTerrain.map((l) => jour(l.ecriture.date)),
            ]);
            sansTerrain = sansLigneDeTerrain.filter((i) => !joursVentiles.has(jour(i.dateAcquisition)));
        }
        if (sansTerrain.length > 0) {
            const sourceVentilation = tenant.referentiel === client_1.Referentiel.SYCEBNL
                ? 'SYCEBNL, Partie 2 ch. 3, fiche du compte 23'
                : 'AUDCIF, Titre VIII ch. 11 § 1.7.1 et art. 38';
            anomalies.push({
                code: 'BATIMENT_SANS_VENTILATION_TERRAIN',
                gravite: 'AVERTISSEMENT',
                libelle: 'Bâtiment sur sol propre entré sans part de terrain',
                consequence: `Le texte (${sourceVentilation}) impose de distinguer dès l’origine la valeur du terrain de celle de ` +
                    'la construction. Aucun terrain (compte 22) n’est entré le jour de l’acquisition de ces biens, ni par ' +
                    'leur écriture, ni sur une fiche, ni par une autre écriture : le prix global est ' +
                    'donc resté sur le bâtiment, et il s’amortit EN ENTIER, terrain compris. La dotation est majorée de la ' +
                    'part du terrain à chaque exercice, le résultat minoré d’autant, et la valeur nette du terrain s’érode ' +
                    'alors qu’un terrain ne s’use pas. Rien ne le trahit : l’écriture s’équilibre et la balance boucle. ' +
                    'Au SYSCOHADA, la dotation excédentaire n’est de surcroît pas déductible.',
                action: 'Ventilez le prix d’acquisition entre le terrain (compte 22) et la construction (compte 231), pour le ' +
                    'montant porté dans l’acte notarié. Si l’acte ne le détaille pas, l’art. 38 laisse le choix de la ' +
                    'méthode (comparaison avec des terrains nus voisins, ou coût de reconstruction) · le montant retenu ' +
                    'vous appartient, le logiciel ne le devine pas. Aucun avertissement n’est levé sur un bâtiment sur ' +
                    'sol d’autrui (compte 232), qui n’a pas de terrain à ventiler.',
                occurrences: sansTerrain.slice(0, 200).map((i) => ({
                    reference: `${i.compteImmobilisation.numero} ${i.designation}`,
                    detail: `Acquisition ${i.ecritureAcquisition?.numeroPiece ?? ''} · aucun terrain entré le même jour`,
                    montant: Math.round(Number(i.valeurOrigine) * 100) / 100,
                    date: i.dateAcquisition.toISOString().slice(0, 10),
                })),
            });
        }
        if (tenant.referentiel === client_1.Referentiel.SYCEBNL) {
            const maintenant = new Date();
            const conventions = await this.prisma.conventionFinancement.findMany({
                where: { tenantId, statut: 'EN_COURS' },
                select: {
                    reference: true,
                    objet: true,
                    dateFin: true,
                    montantAccorde: true,
                    caractere: true,
                    ecritSigne: true,
                    bailleur: { select: { code: true, nom: true } },
                    rapports: { select: { intitule: true, dateEcheance: true, dateTransmission: true } },
                },
            });
            const expirees = conventions.filter((c) => c.dateFin < maintenant);
            if (expirees.length > 0) {
                anomalies.push({
                    code: 'CONVENTION_FINANCEMENT_EXPIREE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Convention de financement arrivée à terme et toujours en cours',
                    consequence: 'Ces conventions portent une date de fin dépassée et restent marquées EN COURS. Leur reste à recevoir ' +
                        'continue donc d’être présenté comme attendu, alors que rien ne le fonde plus.',
                    action: 'Faites constater l’avenant de prorogation s’il existe, et reportez sa date de fin sur la convention. ' +
                        'À défaut, clôturez la convention, ou résiliez-la avec son motif si le solde ne sera pas versé · la ' +
                        'résiliation fait tomber le reste à recevoir.',
                    occurrences: expirees.slice(0, 200).map((c) => ({
                        reference: `${c.bailleur.code} · ${c.reference}`,
                        detail: `${c.objet} · échue le ${c.dateFin.toISOString().slice(0, 10)}`,
                        montant: Math.round(Number(c.montantAccorde) * 100) / 100,
                        date: c.dateFin.toISOString().slice(0, 10),
                    })),
                });
            }
            const rapportsEnRetard = conventions.flatMap((c) => c.rapports
                .filter((r) => r.dateTransmission === null && r.dateEcheance < maintenant)
                .map((r) => ({ convention: c, rapport: r })));
            if (rapportsEnRetard.length > 0) {
                anomalies.push({
                    code: 'RAPPORT_BAILLEUR_NON_TRANSMIS',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Rapport dû à un bailleur, échu et non transmis',
                    consequence: 'Un rapport en retard n’est pas une omission administrative : la plupart des conventions en font la ' +
                        'condition du versement de la tranche suivante. Aucun solde ne le dit, et c’est le décaissement ' +
                        'attendu qui ne viendra pas.',
                    action: 'Transmettez le rapport et datez sa transmission ici. Si la convention a été prorogée ou le rapport ' +
                        'reporté, corrigez son échéance plutôt que de laisser l’avertissement se répéter à chaque clôture.',
                    occurrences: rapportsEnRetard.slice(0, 200).map(({ convention, rapport }) => ({
                        reference: `${convention.bailleur.code} · ${convention.reference}`,
                        detail: `${rapport.intitule} · dû le ${rapport.dateEcheance.toISOString().slice(0, 10)}`,
                        date: rapport.dateEcheance.toISOString().slice(0, 10),
                    })),
                });
            }
            const fermesSansEcrit = conventions.filter((c) => c.caractere === 'FERME_INCONDITIONNEL' && !c.ecritSigne);
            if (fermesSansEcrit.length > 0) {
                anomalies.push({
                    code: 'ENGAGEMENT_FERME_SANS_ECRIT_SIGNE',
                    gravite: 'INFORMATION',
                    libelle: 'Engagement déclaré ferme, sans écrit signé enregistré',
                    consequence: 'Le cadre conceptuel SYCEBNL, § 5.4.2.4, pose DEUX conditions à la comptabilisation d’un engagement ' +
                        'de financement en créances à recevoir : qu’il soit « ferme et inconditionnel » ET qu’il ait « fait ' +
                        'l’objet d’un écrit signé par les représentants habilités des tiers financeurs ». Ces conventions ne ' +
                        'remplissent que la première : portées en créance, elles gonfleraient l’actif sans pièce opposable à ' +
                        'un réviseur.',
                    action: 'Joignez la référence de l’écrit signé et nommez son signataire sur la convention. Tant qu’il manque, ' +
                        'l’engagement reste une mention de Notes annexes et non une créance.',
                    occurrences: fermesSansEcrit.slice(0, 200).map((c) => ({
                        reference: `${c.bailleur.code} · ${c.reference}`,
                        detail: `${c.objet} · aucun écrit signé enregistré`,
                        montant: Math.round(Number(c.montantAccorde) * 100) / 100,
                    })),
                });
            }
        }
        if (tenant.referentiel === client_1.Referentiel.SYCEBNL && ex.dateFin >= ENTREE_EN_VIGUEUR_AM_007_2025) {
            const qualification = (0, exemption_is_ebnl_1.qualifierExemptionIs)({
                formeJuridique: tenant.formeJuridique,
                droitEtranger: tenant.droitEtranger,
                actePersonnaliteJuridique: tenant.actePersonnaliteJuridique,
                attestationExemptionIs: tenant.attestationExemptionIs,
                dateAttestationExemptionIs: tenant.dateAttestationExemptionIs,
            });
            if (qualification.attestationRequise === true && !qualification.attestationConnue) {
                anomalies.push({
                    code: 'ATTESTATION_EXEMPTION_IS_ABSENTE',
                    gravite: 'AVERTISSEMENT',
                    libelle: "Attestation d'exemption d'impôt sur les sociétés non enregistrée",
                    consequence: 'Arrêté n° 007/2025, art. 2 : « Le bénéfice de l’exemption n’est pas automatique : il passe par une ' +
                        'attestation d’exemption, délivrée par l’Administration des Impôts sur demande de la structure ' +
                        'concernée, dont elle définit le modèle. La demande est adressée au Directeur Général des Impôts. » ' +
                        'Aucune attestation n’est enregistrée dans ce dossier, dont la forme juridique relève du point 5 de ' +
                        'l’art. 5 de la loi n° 23/053. Tant qu’elle manque, l’exemption ne peut pas être présentée comme ' +
                        'acquise, et c’est la première pièce demandée au contrôle. Le logiciel ne conclut pas à ' +
                        'l’imposition : l’art. 5 de l’arrêté n’attache l’impôt qu’au non-respect des conditions des art. 3 ' +
                        'et 4, que nulle comptabilité ne permet de vérifier.',
                    action: 'Adressez la demande d’attestation au Directeur Général des Impôts, puis reportez sa référence et sa ' +
                        'date de délivrance dans Paramètres du dossier, rubrique « Exemption d’impôt sur les sociétés ». ' +
                        'Le détail des pièces à joindre, propre à votre forme juridique, y est rappelé.',
                    occurrences: [
                        {
                            reference: tenant.formeJuridique,
                            detail: qualification.enonce,
                        },
                    ],
                });
            }
        }
        const validesParLeurAuteur = parcours.validesParLeurAuteur.elements;
        if (validesParLeurAuteur.length > 0) {
            anomalies.push({
                code: 'VALIDATION_PAR_SON_AUTEUR',
                gravite: 'INFORMATION',
                libelle: 'Écritures validées par la personne qui les a saisies',
                consequence: 'Ces écritures sont entrées au livre-journal sur la seule décision de leur auteur. ' +
                    (tenant.referentiel === client_1.Referentiel.SYCEBNL
                        ? 'Le SYCEBNL, art. 16, 2), demande « la mise en place de procédures nécessaires à une organisation ' +
                            'comptable permettant un contrôle interne fiable et le contrôle externe […] ». L’art. 69 de ' +
                            'l’AUDCIF, qui délègue expressément ces procédures à l’entité, lui est exclu par l’art. 3.'
                        : 'L’AUDCIF, art. 69, pose que « l’entité détermine, SOUS SA RESPONSABILITÉ, les procédures ' +
                            'nécessaires à la mise en place d’une organisation comptable permettant aussi bien un contrôle ' +
                            'interne fiable que le contrôle externe […] ».') +
                    ' AUCUN TEXTE N’EXIGE que le validateur diffère de l’auteur : l’art. 22, 2° impose la validation et ne ' +
                    'nomme personne. Ce signalement CONSTATE une coïncidence d’identité, il ne qualifie ni ne conclut, et ' +
                    'un cabinet à un seul comptable est dans son droit.',
                action: 'Si votre organisation prévoit un second regard, activez-le dans Paramètres du dossier · une écriture ' +
                    'ne sera plus validable par son auteur. Pour le dossier à un seul comptable, la validation peut porter ' +
                    'le nom du second regard exercé hors logiciel et son motif, qui s’impriment alors au journal. Rien ' +
                    'n’est dévalidé rétroactivement : l’art. 22, 2° interdit « toute suppression, addition ou modification ' +
                    'ultérieure ».',
                ...nombreSiTronque(parcours.validesParLeurAuteur),
                occurrences: validesParLeurAuteur.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? ''}`,
                    detail: e.libelle,
                    date: e.date.toISOString().slice(0, 10),
                })),
            });
        }
        const valideesEnSituation = parcours.valideesEnSituation.elements;
        if (valideesEnSituation.length > 0) {
            anomalies.push({
                code: 'JOURNAL_DE_SITUATION_AU_LIVRE_JOURNAL',
                gravite: 'AVERTISSEMENT',
                libelle: 'Écritures validées dans un journal de situation',
                consequence: "Validées avant que les écritures de situation ne sortent du livre-journal, elles y sont entrées et figurent " +
                    "aux états · l'art. 22, 2° de l'AUDCIF interdit de les dévalider.",
                action: "Si elles ne correspondent à aucune opération, saisissez dans un journal ordinaire une pièce qui inscrit leurs " +
                    'lignes en négatif (AUDCIF art. 20, al. 2) ; si elles en enregistrent une, elles restent.',
                ...nombreSiTronque(parcours.valideesEnSituation),
                occurrences: valideesEnSituation.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? ''}`,
                    detail: e.libelle,
                    date: e.date.toISOString().slice(0, 10),
                })),
            });
        }
        const brouillardEnSituation = parcours.brouillardEnSituation.elements;
        if (brouillardEnSituation.length > 0) {
            anomalies.push({
                code: 'JOURNAL_DE_SITUATION_AU_BROUILLARD',
                gravite: 'AVERTISSEMENT',
                libelle: 'Écritures au brouillard dans un journal de situation',
                consequence: "Saisies avant la règle des écritures de situation, elles sont tenues par une lettre, un pointage ou un module · " +
                    'elles ne se valident pas dans ce journal, et la clôture de l’exercice refuse tout brouillard.',
                action: `Si elle enregistre une opération, ${ecritures_de_situation_1.ISSUE_TRANSFERT}. Sinon, transférée et validée, elle se corrige par ` +
                    'inscription en négatif (AUDCIF art. 20, al. 2) ; libre de toute lettre, de tout pointage et de tout module, ' +
                    'elle se supprime aussi.',
                ...nombreSiTronque(parcours.brouillardEnSituation),
                occurrences: brouillardEnSituation.map((e) => ({
                    reference: `${e.journal.code} n° ${e.numeroPiece ?? ''}`,
                    detail: e.libelle,
                    date: e.date.toISOString().slice(0, 10),
                })),
            });
        }
        if (ex.dateFin >= entree_en_vigueur_loi_23_053_1.ENTREE_EN_VIGUEUR_LOI_23_053) {
            const lignesReevaluation = await this.prisma.ligneEcriture.findMany({
                where: {
                    ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId },
                    OR: COMPTES_REEVALUATION.map((r) => ({ compte: { tenantId, numero: { startsWith: r } } })),
                },
                select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
            });
            const parCompte = new Map();
            for (const l of lignesReevaluation) {
                const acc = parCompte.get(l.compte.numero) ?? { intitule: l.compte.intitule, mouvement: 0 };
                acc.mouvement += Math.abs(Number(l.debit)) + Math.abs(Number(l.credit));
                parCompte.set(l.compte.numero, acc);
            }
            const mouvementees = [...parCompte.entries()]
                .filter(([, v]) => v.mouvement > 0.005)
                .map(([numero, v]) => ({ numero, intitule: v.intitule }))
                .sort((a, b) => a.numero.localeCompare(b.numero));
            if (mouvementees.length > 0) {
                anomalies.push({
                    code: 'DECLARATION_REEVALUATION_A_DEPOSER',
                    gravite: 'INFORMATION',
                    libelle: 'Réévaluation constatée · déclaration spéciale à déposer au plus tard le 30 avril',
                    consequence: 'Un compte de réévaluation a été mouvementé sur cet exercice. Loi n° 23/053, art. 136 : « Toutes ' +
                        'les entreprises procédant à la réévaluation doivent faire parvenir à l’Administration des Impôts, ' +
                        'AU PLUS TARD LE 30 AVRIL de chaque année, une déclaration spéciale de résultat de la réévaluation ' +
                        'en plus de la déclaration de revenus réalisés au cours de l’exercice. » L’art. 138 sanctionne ' +
                        'l’absence de dépôt d’« une astreinte fiscale de 300.000,00 Francs congolais PAR JOUR jusqu’à la ' +
                        'régularisation de la situation ». OmegaX NE CONSTATE AUCUN MANQUEMENT · le dépôt est un fait ' +
                        'externe qu’aucune comptabilité ne porte, et ce signalement est un rappel, pas un reproche. ' +
                        'Réserve à connaître : l’art. 136 vise « toutes les entreprises » sans définir le mot et sans ' +
                        'réserve d’exemption. Pour une entité à but non lucratif, le point n’est tranché par aucun ' +
                        'texte lu.',
                    action: 'Établissez la déclaration spéciale sur le modèle des imprimés du Conseil Permanent de la ' +
                        'Comptabilité au Congo, avec ses annexes par catégorie d’immobilisations (art. 137), et déposez-la ' +
                        'au plus tard le 30 avril. Vérifiez au passage les trois exigences comptables de l’opération : la ' +
                        'réévaluation porte sur l’ENSEMBLE des immobilisations corporelles et financières (art. 130 de la ' +
                        'loi, art. 62 de l’AUDCIF · toute réévaluation partielle est interdite), la décision émane des ' +
                        'organes de gestion et indique la méthode, les postes concernés, les montants et le traitement ' +
                        'fiscal de l’écart, et l’écart n’est ni distribuable (art. 65 AUDCIF) ni, pour les éléments AMORTISSABLES, imputable sur des pertes (loi n° 23/053, art. 133, alinéa 4). Les deux interdits viennent de DEUX textes distincts : l’article 65 de l’AUDCIF ne pose que la non-distribution, et la compensation des pertes n’est prohibée que par la loi fiscale.',
                    occurrences: mouvementees.slice(0, 50).map((l) => ({
                        reference: l.numero,
                        detail: l.intitule,
                    })),
                });
            }
        }
        const referentielDossier = tenant.referentiel;
        const racinesStocks = [
            '3',
            ...IMMOBILISATIONS_DE_LA_PRODUCTION,
            '603',
            '72',
        ];
        const lignesStocks = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId, estSoldeDesComptesDeGestion: false },
                OR: racinesStocks.map((r) => ({ compte: { tenantId, numero: { startsWith: r } } })),
            },
            select: { debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
        });
        const cumul = (predicat) => lignesStocks
            .filter((l) => predicat(l.compte.numero))
            .reduce((t, l) => ({
            debit: t.debit + Number(l.debit),
            credit: t.credit + Number(l.credit),
        }), { debit: 0, credit: 0 });
        const parNumero = new Map();
        for (const l of lignesStocks) {
            const acc = parNumero.get(l.compte.numero) ?? { intitule: l.compte.intitule, debit: 0, credit: 0 };
            acc.debit += Number(l.debit);
            acc.credit += Number(l.credit);
            parNumero.set(l.compte.numero, acc);
        }
        const subdivisionsAdmises = DEPRECIATIONS_STOCKS[referentielDossier];
        const depreciationsMouvementees = [...parNumero.entries()]
            .filter(([n, v]) => n.startsWith('39') && n.length >= 3 && v.debit + v.credit > 0.005)
            .sort(([a], [b]) => a.localeCompare(b));
        const horsNomenclature = depreciationsMouvementees.filter(([n]) => !subdivisionsAdmises.includes(n.slice(0, 3)));
        if (horsNomenclature.length > 0) {
            anomalies.push({
                code: 'DEPRECIATION_STOCK_HORS_NOMENCLATURE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Dépréciation de stocks à une subdivision que le plan n’ouvre pas',
                consequence: `Le plan ${referentielDossier} ouvre au compte 39 les seules subdivisions ` +
                    `${subdivisionsAdmises.join(', ')}. ` +
                    (referentielDossier === client_1.Referentiel.SYCEBNL
                        ? 'Il n’a ni 394 « produits en cours », ni 395 « services en cours », ni 398 : son 396 couvre à lui ' +
                            'seul « produits finis, produits intermédiaires et résiduels », et son 397 les stocks en cours de ' +
                            'route. Une dépréciation portée ailleurs déduit un poste de bilan qui n’existe pas dans ce plan, ' +
                            'et la Note annexe la publiera sous un intitulé emprunté à l’autre référentiel.'
                        : 'Une dépréciation portée hors de cette liste déduit un poste de bilan qui n’existe pas, et la Note ' +
                            'annexe la publiera sous un intitulé qui n’est pas celui du plan.'),
                action: 'Reclassez la dépréciation à la subdivision correspondant au stock déprécié · la règle est mécanique, ' +
                    '39X déprécie 3X. Attention à l’intitulé et non au seul numéro : le 397 déprécie les produits ' +
                    'intermédiaires et résiduels au SYSCOHADA, et les stocks en cours de route au SYCEBNL.',
                occurrences: horsNomenclature.slice(0, 200).map(([numero, v]) => ({
                    reference: numero,
                    detail: v.intitule,
                    montant: Math.round((v.credit - v.debit) * 100) / 100,
                })),
            });
        }
        const depreciationsOrphelines = depreciationsMouvementees
            .filter(([n, v]) => {
            if (!subdivisionsAdmises.includes(n.slice(0, 3)))
                return false;
            if (v.credit - v.debit <= 0.005)
                return false;
            const stock = cumul((x) => x.startsWith(compteStockAdosse(n.slice(0, 3))));
            return Math.abs(stock.debit - stock.credit) <= 0.005;
        })
            .map(([numero, v]) => ({ numero, intitule: v.intitule, solde: v.credit - v.debit }));
        if (depreciationsOrphelines.length > 0) {
            anomalies.push({
                code: 'DEPRECIATION_STOCK_SANS_STOCK',
                gravite: 'AVERTISSEMENT',
                libelle: 'Dépréciation de stocks sans le poste qu’elle déduit',
                consequence: 'Une dépréciation de stocks porte un solde créditeur alors que le compte de stock adossé est à zéro. ' +
                    'Les deux plans écrivent la même phrase : les dépréciations « sont portées à l’actif du bilan, EN ' +
                    'DÉDUCTION de la valeur des postes qu’elles concernent ». Une déduction sans poste n’est pas une ' +
                    'déduction, c’est un actif négatif · le total du bilan est minoré du montant, et aucune ligne ne le dit.',
                action: 'Deux cas seulement. Le stock a été soldé sans que sa dépréciation le soit : reprenez la dépréciation ' +
                    'par le crédit du 7593 (ou du 849 si elle était H.A.O.). Ou la dépréciation est au mauvais numéro : ' +
                    'reclassez-la sur la subdivision du stock réellement déprécié.',
                occurrences: depreciationsOrphelines.slice(0, 200).map((d) => ({
                    reference: `${d.numero} ${d.intitule}`,
                    detail: `Compte de stock ${compteStockAdosse(d.numero.slice(0, 3))} sans solde`,
                    montant: Math.round(d.solde * 100) / 100,
                })),
            });
        }
        const racineEnCoursDeRoute = STOCK_EN_COURS_DE_ROUTE[referentielDossier];
        const enCoursDeRoute = cumul((n) => n.startsWith(racineEnCoursDeRoute) &&
            !n.startsWith(STOCK_PROVENANT_D_IMMOBILISATIONS_PAR_REFERENTIEL[referentielDossier]));
        const variationsStocks = cumul((n) => n.startsWith('603'));
        if (enCoursDeRoute.debit + enCoursDeRoute.credit > 0.005 &&
            variationsStocks.debit + variationsStocks.credit <= 0.005) {
            anomalies.push({
                code: 'STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION',
                gravite: 'AVERTISSEMENT',
                libelle: 'Stock en cours de route mouvementé sans aucune variation de stock',
                consequence: `Le compte ${racineEnCoursDeRoute} a été mouvementé sur l’exercice alors qu’aucun compte 603 ` +
                    '« Variations des stocks de biens achetés » ne l’a été. Les deux plans donnent au compte le même ' +
                    'fonctionnement, dans les deux systèmes d’inventaire : il est débité « par le crédit des sous-comptes ' +
                    '603 concernés ». Sans cette contrepartie, l’achat reste seul en charge et le stock apparaît sans ' +
                    'que la charge ait été neutralisée · le résultat est minoré du montant, et l’écriture s’équilibre ' +
                    'quand même.',
                action: `Passez la variation de stock au compte 603 correspondant, en contrepartie du ${racineEnCoursDeRoute}. ` +
                    'Si la marchandise a en réalité été réceptionnée avant la clôture, ce n’est pas le bon compte : ' +
                    `ventilez-la dans le compte de stock de sa nature, le ${racineEnCoursDeRoute} n’étant qu’un compte de passage.`,
                occurrences: [
                    {
                        reference: `${racineEnCoursDeRoute} Stocks en cours de route, en consignation ou en dépôt`,
                        detail: 'Mouvement de l’exercice sans contrepartie au 603',
                        montant: Math.round((enCoursDeRoute.debit - enCoursDeRoute.credit) * 100) / 100,
                    },
                ],
            });
        }
        if (referentielDossier === client_1.Referentiel.SYSCOHADA) {
            const recupere = cumul((n) => n.startsWith(STOCK_PROVENANT_D_IMMOBILISATIONS_PAR_REFERENTIEL[client_1.Referentiel.SYSCOHADA]));
            const solde388 = Math.round((recupere.debit - recupere.credit) * 100) / 100;
            if (Math.abs(solde388) > 0.005) {
                anomalies.push({
                    code: 'STOCK_IMMOBILISATIONS_388_NON_SOLDE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Stock provenant d’immobilisations (388) non soldé à la clôture',
                    consequence: 'Le compte 388 « Stock provenant d’immobilisations mises hors service ou au rebut » porte un solde. ' +
                        'L’AUDCIF (Titre VIII, dépréciation des stocks, § 2.8) veut qu’« en fin d’exercice, le compte 388 ' +
                        'est soldé par le débit du compte 603 Variations des stocks de biens achetés », les éléments qui ' +
                        'subsistent étant inscrits « dans les comptes appropriés de la classe 3 par le crédit du compte 603 ». ' +
                        'Le bilan porte le stock sous un compte qui doit être vide, et la balance boucle quand même.',
                    action: 'Soldez le 388 par le débit du 603, puis portez ce qui subsiste au compte de stock de sa nature par le ' +
                        'crédit du 603. Le compte de classe 3 dépend de la nature des matières récupérées, et c’est à vous de le choisir.',
                    occurrences: [
                        {
                            reference: '388 Stock provenant d’immobilisations mises hors service ou au rebut',
                            detail: 'Solde à la clôture',
                            montant: solde388,
                        },
                    ],
                });
            }
        }
        const racinesProductionImmobilisee = referentielDossier === client_1.Referentiel.SYSCOHADA ? ['721', '722'] : ['72'];
        const estProductionImmobilisee = (n) => racinesProductionImmobilisee.some((r) => n.startsWith(r));
        const productionImmobilisee = cumul(estProductionImmobilisee);
        const entreesImmobilisations = IMMOBILISATIONS_DE_LA_PRODUCTION.reduce((t, r) => t + cumul((n) => n.startsWith(r)).debit, 0);
        if (productionImmobilisee.credit - productionImmobilisee.debit > 0.005 && entreesImmobilisations <= 0.005) {
            anomalies.push({
                code: 'PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION',
                gravite: 'AVERTISSEMENT',
                libelle: 'Production immobilisée créditée sans entrée d’immobilisation',
                consequence: (referentielDossier === client_1.Referentiel.SYSCOHADA
                    ? 'Les comptes 721 et 722 de la production immobilisée portent un solde créditeur alors qu’aucun ' +
                        'compte 21, 23 ou 24 n’a été débité de l’exercice. La fiche du compte 72 (AUDCIF, Titre VII) le fait ' +
                        'créditer « par le débit du compte 21 […] ou par le débit du compte 23 […] ou 24 » · la production ' +
                        'autoconsommée (724), elle, a pour contrepartie le 104 ou les 6617 et 6627, et n’est pas lue ici.'
                    : 'Le compte 72 « Production immobilisée » porte un solde créditeur alors qu’aucun compte 21, 23 ou 24 ' +
                        'n’a été débité de l’exercice. La fiche du compte 72 le fait créditer « du montant des travaux ' +
                        'effectués au cours de l’exercice par l’entité pour elle-même (au coût de production) ; par le débit : ' +
                        'du compte 21 […] ; du compte 23 […] ; ou 24 ».') +
                    ' Sans l’entrée en immobilisation, le produit est constaté sans l’actif qui le justifie, et l’exercice ' +
                    'suivant ne portera aucun amortissement sur un bien pourtant en service.',
                action: 'Portez le bien produit à l’actif, au coût de production, par le débit du compte d’immobilisation de ' +
                    'sa nature · ou, si les travaux ne sont pas achevés à la clôture, du compte en cours de sa nature ' +
                    '(219, 239 ou 249). Le coût retenu doit intégrer ' +
                    'tous les intrants : matériaux consommés, charges directes et charges indirectes rattachables, et les ' +
                    'frais financiers des emprunts exclusivement affectés à la fabrication, pour la seule période de ' +
                    'fabrication.',
                occurrences: [...parNumero.entries()]
                    .filter(([n, v]) => estProductionImmobilisee(n) && v.credit - v.debit > 0.005)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .slice(0, 50)
                    .map(([numero, v]) => ({
                    reference: `${numero} ${v.intitule}`,
                    detail: 'Aucune immobilisation entrée sur l’exercice',
                    montant: Math.round((v.credit - v.debit) * 100) / 100,
                })),
            });
        }
        const comparabilite = (0, comparabilite_exercices_1.evaluerComparabilite)(tenant.referentiel, { dateDebut: ex.dateDebut, dateFin: ex.dateFin }, exercicePrecedent && exercicePrecedent.dateFin < ex.dateDebut
            ? { dateDebut: exercicePrecedent.dateDebut, dateFin: exercicePrecedent.dateFin }
            : null);
        if (!comparabilite.comparable) {
            anomalies.push({
                code: 'COMPARATIF_N1_NON_COMPARABLE',
                gravite: 'AVERTISSEMENT',
                libelle: 'Colonne N-1 servie alors que les deux exercices ne se comparent pas',
                consequence: `${comparabilite.motifs.map((m) => m.phrase).join(' ')} Le texte (${comparabilite.article}) impose ` +
                    'la colonne comparative, mais aussi d’adapter l’exercice précédent quand un poste n’est pas ' +
                    'comparable, et de signaler l’absence de comparabilité ou l’adaptation dans les Notes annexes. ' +
                    'Tant que rien n’est dit, la colonne s’imprime et se dépose telle quelle : tous les totaux sont ' +
                    'justes, le bilan boucle, et le lecteur en tire une variation qui ne veut rien dire.',
                action: 'Adaptez les chiffres de l’exercice précédent si vous le pouvez, et portez la mention dans les ' +
                    'Notes annexes (règles et méthodes comptables). OmegaX n’adapte aucun chiffre de lui-même : ' +
                    'proratiser des charges ou des produits fabriquerait des montants que personne n’a décidés, et un ' +
                    'bilan, qui est un stock à une date, ne se proratise pas du tout.',
                occurrences: comparabilite.motifs.map((m) => ({
                    reference: `Exercice clos le ${ex.dateFin.toISOString().slice(0, 10)}`,
                    detail: m.phrase,
                    date: ex.dateFin.toISOString().slice(0, 10),
                })),
            });
        }
        const mandats = await this.prisma.mandatAuditeur.findMany({
            where: { tenantId, finAnticipeeLe: null },
            orderBy: { premierExercice: 'desc' },
            select: { id: true, nom: true, premierExercice: true, nombreExercices: true, refusDeProrogation: true },
        });
        const anneeExercice = ex.dateFin.getUTCFullYear();
        const couvrant = (0, duree_mandat_1.mandatCouvrant)(mandats, anneeExercice);
        const echu = mandats.find((m) => (0, duree_mandat_1.dernierExerciceCouvert)(m.premierExercice, m.nombreExercices) < anneeExercice);
        const prorogation = (0, duree_mandat_1.regleDeProrogation)(tenant.referentiel, tenant.formeJuridiqueSyscohada);
        const dansLaProrogation = !!echu && !!prorogation && (0, duree_mandat_1.estDansLaProrogation)(echu.premierExercice, echu.nombreExercices, anneeExercice);
        const prorogationEnCours = !!echu && !!prorogation && dansLaProrogation && !echu.refusDeProrogation;
        if (!couvrant && (seuils.obligationDeclenchee || seuils.obligationSansSeuil || prorogationEnCours)) {
            if (echu && prorogation && echu.refusDeProrogation) {
                anomalies.push({
                    code: 'MANDAT_AUDITEUR_SANS_PROROGATION',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Mandat échu et prorogation refusée par le contrôleur',
                    consequence: `Le mandat est arrivé à son terme et le contrôleur a opposé le refus exprès que prévoit le ` +
                        `${prorogation.source}. La prorogation ne joue donc pas · l’entité est sans contrôleur des comptes ` +
                        'alors que le texte lui en impose un.',
                    action: 'Faites désigner un contrôleur par l’assemblée, et enregistrez son mandat.',
                    occurrences: [
                        {
                            reference: echu.nom,
                            detail: `Mandat couvrant jusqu’à l’exercice ${(0, duree_mandat_1.dernierExerciceCouvert)(echu.premierExercice, echu.nombreExercices)}, prorogation refusée`,
                        },
                    ],
                });
            }
            else if (echu && prorogation && dansLaProrogation) {
                anomalies.push({
                    code: 'MANDAT_AUDITEUR_PROROGE',
                    gravite: 'INFORMATION',
                    libelle: 'Mandat échu, prorogé jusqu’à la prochaine assemblée',
                    consequence: `${prorogation.source} · ${prorogation.citation}. Le contrôleur est donc toujours en fonction pour ` +
                        'cet exercice · ce n’est pas un manquement.',
                    action: 'Portez à l’ordre du jour de la prochaine assemblée le renouvellement ou le remplacement, puis ' +
                        'enregistrez le nouveau mandat.',
                    occurrences: [
                        {
                            reference: echu.nom,
                            detail: `Mandat couvrant jusqu’à l’exercice ${(0, duree_mandat_1.dernierExerciceCouvert)(echu.premierExercice, echu.nombreExercices)}`,
                        },
                    ],
                });
            }
            else {
                const motifEchu = !echu
                    ? 'Aucun mandat ne couvre cet exercice'
                    : !prorogation
                        ? `Dernier mandat enregistré (${echu.nom}) échu avec l’exercice ${(0, duree_mandat_1.dernierExerciceCouvert)(echu.premierExercice, echu.nombreExercices)} · aucun texte lu ne proroge le mandat pour cette forme`
                        : `Dernier mandat enregistré (${echu.nom}) échu avec l’exercice ${(0, duree_mandat_1.dernierExerciceCouvert)(echu.premierExercice, echu.nombreExercices)} · la prorogation du ${prorogation.source} ne couvrait que l’exercice suivant`;
                anomalies.push({
                    code: 'AUDITEUR_OBLIGATOIRE_SANS_MANDAT',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Aucun mandat de contrôleur des comptes ne couvre l’exercice',
                    consequence: `${'source' in seuils.regle ? seuils.regle.source : 'Le texte applicable au dossier'} rend la ` +
                        'désignation obligatoire pour ce dossier, et aucun mandat enregistré dans OmegaX ne couvre ' +
                        'l’exercice. Le logiciel ne peut donc dire ni qui contrôle les comptes, ni depuis quand, ni ' +
                        'jusqu’à quel exercice.',
                    action: 'Enregistrez le mandat dans la fenêtre Mandat du contrôleur des comptes · nom, référence ' +
                        'd’inscription au tableau de l’ordre, organe qui a désigné, date et premier exercice couvert.',
                    occurrences: [{ reference: `Exercice ${anneeExercice}`, detail: motifEchu }],
                });
            }
        }
        if ((0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(tenant.formeJuridique, tenant.droitEtranger)) {
            const accords = await this.prisma.accordCadrePlan.findMany({
                where: { tenantId, denonceLe: null },
                orderBy: { dateSignature: 'desc' },
            });
            const accord = accords[0];
            if (!accord) {
                anomalies.push({
                    code: 'ACCORD_CADRE_PLAN_ABSENT',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Aucun accord-cadre avec le Ministère du Plan',
                    consequence: 'La loi n° 004/2001, art. 37, impose à l’organisation étrangère de « conclure un accord-cadre avec ' +
                        'le Ministère ayant le plan dans ses attributions ». Aucun n’est enregistré dans OmegaX pour ce ' +
                        'dossier, qui se déclare pourtant ONG de droit étranger. L’arrêté n° 007/2025 en fait aussi une ' +
                        'pièce de la demande d’attestation d’exemption d’impôt sur les sociétés.',
                    action: 'Enregistrez l’accord dans la fenêtre Accord-cadre (Ministère du Plan) · référence, date de ' +
                        'signature et durée recopiées de l’acte signé.',
                    occurrences: [],
                });
            }
            else {
                const etat = (0, conditions_ong_etrangere_1.etatAccordCadre)({
                    dateSignature: accord.dateSignature,
                    dureeAnnees: accord.dureeAnnees,
                    taciteReconduction: accord.taciteReconduction,
                    preavisMois: accord.preavisMois,
                    denonceLe: accord.denonceLe,
                    reference: ex.dateFin,
                });
                if (etat.periodeEcoulee && !etat.enTaciteReconduction) {
                    anomalies.push({
                        code: 'ACCORD_CADRE_PLAN_ECHU',
                        gravite: 'AVERTISSEMENT',
                        libelle: 'Accord-cadre échu, sans tacite reconduction',
                        consequence: `L’accord ${accord.reference} couvrait ${accord.dureeAnnees} an(s) à compter du ` +
                            `${accord.dateSignature.toISOString().slice(0, 10)} et l’accord enregistré ne prévoit pas de ` +
                            'tacite reconduction. La condition de l’art. 37, point 2 n’est donc plus remplie à la clôture.',
                        action: 'Concluez un nouvel accord avec le Ministère du Plan, ou corrigez la clause enregistrée.',
                        occurrences: [
                            {
                                reference: accord.reference,
                                detail: `Période close le ${etat.finDePeriode.toISOString().slice(0, 10)}`,
                                date: etat.finDePeriode.toISOString().slice(0, 10),
                            },
                        ],
                    });
                }
            }
            if (accord &&
                accord.partMainOeuvreLocale !== null &&
                accord.partMainOeuvreLocale < conditions_ong_etrangere_1.PART_MAIN_OEUVRE_LOCALE_MINIMALE) {
                anomalies.push({
                    code: 'MAIN_OEUVRE_LOCALE_SOUS_SEUIL',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Part de main-d’œuvre locale déclarée sous le minimum légal',
                    consequence: `L’art. 37, point 4 impose d’« utiliser la main d’œuvre locale à concurrence de ` +
                        `${conditions_ong_etrangere_1.PART_MAIN_OEUVRE_LOCALE_MINIMALE}% au minimum ». La part déclarée est de ` +
                        `${accord.partMainOeuvreLocale} %. OmegaX ne calcule pas ce chiffre · il reprend celui qui a été ` +
                        'saisi, avec sa source.',
                    action: 'Vérifiez le relevé et sa source, et régularisez la composition des effectifs si l’écart est réel.',
                    occurrences: [
                        {
                            reference: accord.sourceMainOeuvre ?? 'Source non précisée',
                            detail: `${accord.partMainOeuvreLocale} % de main-d’œuvre locale déclarés`,
                            montant: accord.partMainOeuvreLocale,
                        },
                    ],
                });
            }
        }
        const rapprochementsANouveau = await this.prisma.rapprochementBancaire.findMany({
            where: {
                tenantId,
                dateReleve: { gte: ex.dateDebut, lte: ex.dateFin },
                lignes: { some: { ecriture: (0, rapprochement_service_1.filtreANouveauEcarte)() } },
            },
            select: {
                id: true,
                compteId: true,
                statut: true,
                dateReleve: true,
                clotureAt: true,
                soldeDepartDeclare: true,
                compte: { select: { numero: true, intitule: true } },
                lignes: {
                    where: { ecriture: (0, rapprochement_service_1.filtreANouveauEcarte)() },
                    select: {
                        debit: true,
                        credit: true,
                        ecriture: {
                            select: { date: true, exerciceId: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true },
                        },
                    },
                },
            },
        });
        if (rapprochementsANouveau.length > 0) {
            const [clos, premierExercice] = await Promise.all([
                this.prisma.rapprochementBancaire.findMany({
                    where: {
                        tenantId,
                        compteId: { in: [...new Set(rapprochementsANouveau.map((r) => r.compteId))] },
                        statut: 'CLOTURE',
                    },
                    select: { compteId: true, clotureAt: true },
                }),
                this.prisma.exercice.findFirst({ where: { tenantId }, orderBy: { dateDebut: 'asc' }, select: { id: true } }),
            ]);
            const occurrences = [];
            for (const r of rapprochementsANouveau) {
                const avant = (r.clotureAt ?? new Date(maintenant)).getTime();
                const place = {
                    ancre: clos.some((c) => c.compteId === r.compteId && c.clotureAt !== null && c.clotureAt.getTime() < avant),
                    departDeclare: r.soldeDepartDeclare !== null,
                    premierExerciceId: premierExercice?.id ?? null,
                };
                for (const l of r.lignes) {
                    if (!(0, rapprochement_service_1.aNouveauEnTrop)(l.ecriture, place))
                        continue;
                    occurrences.push({
                        reference: `${r.compte.numero} ${r.compte.intitule} · relevé du ${r.dateReleve.toISOString().slice(0, 10)}`,
                        detail: `${r.statut === 'CLOTURE' ? 'Rapprochement clos' : 'Rapprochement en cours'} · report à-nouveau du ${l.ecriture.date
                            .toISOString()
                            .slice(0, 10)} pointé`,
                        date: l.ecriture.date.toISOString().slice(0, 10),
                        montant: Number(l.debit) - Number(l.credit),
                    });
                }
            }
            if (occurrences.length > 0) {
                anomalies.push({
                    code: 'RAPPROCHEMENT_A_NOUVEAU_POINTE',
                    gravite: 'AVERTISSEMENT',
                    libelle: "Rapprochement bancaire qui compte l'ouverture deux fois",
                    consequence: "Un report à-nouveau recopie le solde de clôture de l'exercice précédent · ce n'est pas une opération de la banque. " +
                        "Pointé, il ajoute l'ouverture au solde de départ qui la contient déjà, et l'écart du rapprochement se referme sur un chiffre faux.",
                    action: "Rapprochement en cours · dépointez la ligne. Rapprochement clos · l'administrateur rouvre le dernier rapprochement clos du compte, " +
                        'motif à l\'appui, puis la ligne se dépointe ; un rapprochement plus ancien ne se rouvre pas, les suivants partent de son solde de relevé.',
                    occurrences,
                });
            }
        }
        if (ex.statut !== client_1.StatutExercice.CLOTURE) {
            const sansEcart = await (0, reglements_sans_ecart_1.reglementsSansEcart)(this.prisma, { tenantId, exerciceId, referentiel: tenant.referentiel });
            if (sansEcart.elements.length > 0 || sansEcart.tronque) {
                anomalies.push({
                    code: 'REGLEMENT_DEVISE_SANS_ECART',
                    gravite: 'INFORMATION',
                    libelle: 'Règlement en devise qui a soldé le tiers au payé, sans écart de change',
                    consequence: "La ligne du tiers porte les francs du jour au lieu du coût historique de ce qu'elle règle · l'écart de change réalisé " +
                        "sur la part réglée n'est pas constaté (AUDCIF art. 55), il reste mêlé au tiers et se lirait en écart de conversion à la clôture.",
                    action: "Corrigez la pièce par inscription en négatif, puis passez le règlement exact depuis Règlement des tiers, qui solde le tiers " +
                        "au coût historique et porte l'écart sur sa ligne (AUDCIF art. 20, al. 2). Rien n'est corrigé d'office.",
                    occurrences: [
                        ...(sansEcart.tronque
                            ? [{ reference: 'Lecture bornée', detail: `${reglements_sans_ecart_1.PLAFOND_LIGNES_EXAMINEES} lignes de lettrages partiels lues · d'autres règlements peuvent exister.` }]
                            : []),
                        ...sansEcart.elements.map((e) => ({
                            reference: `${e.compteNumero} · ${e.piece}`,
                            detail: `${e.montantDevise} en devise portés ${e.francsPortes.toFixed(2)} au tiers contre ${e.francsHistoriques.toFixed(2)} au coût historique · ` +
                                `${e.ecart > 0 ? 'perte' : 'gain'} de change non constaté${e.ecart > 0 ? 'e' : ''}`,
                            date: e.date.toISOString().slice(0, 10),
                            montant: e.ecart,
                        })),
                    ],
                });
            }
            if (sansEcart.nonReconnaissables > 0) {
                anomalies.push({
                    code: 'LETTRAGES_DEVISE_NON_EXAMINES',
                    gravite: 'INFORMATION',
                    libelle: 'Lettrages partiels en devise non examinés',
                    consequence: `${sansEcart.nonReconnaissables} lettrage(s) partiel(s) en devise n'ont pas pu être examinés · le règlement ne s'y distingue pas ` +
                        'de la facture (acompte antérieur à la facture, avoir, pièce sans ligne de trésorerie). Rien n’en est conclu.',
                    action: 'Aucune, sauf à vérifier ces lettrages à la main si un règlement en devise y a soldé le tiers aux francs du jour.',
                    occurrences: [],
                });
            }
        }
        {
            const contrePassees = await (0, contre_passations_de_disponibilites_1.contrePassationsDeDisponibilites)(this.prisma, { tenantId, exerciceId });
            if (contrePassees.elements.length > 0 || contrePassees.tronque) {
                const anciennes = contrePassees.elements.filter((e) => e.exception === null && !e.manuelle);
                const annulable = anciennes.filter((e) => !e.exerciceContrePassationClos);
                const aRepasser = annulable.some((e) => e.aRepasser);
                const rienARepasser = annulable.some((e) => !e.aRepasser);
                const close = anciennes.some((e) => e.exerciceContrePassationClos);
                const manuelles = contrePassees.elements.filter((e) => e.manuelle);
                const manuelleOuverte = manuelles.some((e) => !e.exerciceContrePassationClos);
                const groupee = manuelles.some((e) => !e.exerciceContrePassationClos && e.autresGestes);
                const manuelleClose = manuelles.some((e) => e.exerciceContrePassationClos);
                const parException = contrePassees.elements.some((e) => e.exception !== null);
                anomalies.push({
                    code: 'CONTRE_PASSATION_DE_DISPONIBILITE',
                    gravite: 'INFORMATION',
                    libelle: "Contre-passation d'écarts qui a inversé une banque ou une caisse en devise",
                    consequence: "L'écart d'une disponibilité en devise est réalisé et reste au résultat de l'exercice où il est constaté (AUDCIF art. 57) · " +
                        "contre-passé, il remet la trésorerie au cours historique jusqu'à la réévaluation de cet exercice et inscrit au 676 ou au 776 " +
                        "le contraire d'une perte ou d'un gain déjà supporté. La réévaluation de clôture de l'exercice qui porte la contre-passation " +
                        "mesure la banque sans l'écart contre-passé et le repasse · une fois elle passée, le résultat cumulé des exercices en sort juste " +
                        "(d'ici là, l'exercice porte la contre-passation seule) ; la présentation des pertes et gains de change ne l’est pas.",
                    action: (annulable.length > 0
                        ? 'Contre-passation dans un exercice encore ouvert · annulez-la (Devises, « Annuler la contre-passation », AUDCIF ' +
                            "art. 20, al. 2), après avoir annulé la réévaluation de cet exercice-ci s'il est déjà réévalué" +
                            (aRepasser
                                ? ', puis repassez-la · seuls le 478, le 479 et les comptes de tiers le seront, si leur état porte l’écart en place ' +
                                    '(« Contre-passer » le rejuge et nomme l’issue sinon)'
                                : '') +
                            (rienARepasser
                                ? `${aRepasser ? ' ; ' : ' · '}une réévaluation des seules disponibilités n'a aucun écart de conversion, il n'y a rien à repasser`
                                : '') +
                            '. '
                        : '') +
                        (manuelleOuverte
                            ? "Contre-passation manuelle déclarée, dans un exercice encore ouvert · retirez la déclaration (Devises, « Retirer la " +
                                "déclaration »), après avoir annulé la réévaluation de cet exercice-ci s'il est déjà réévalué, corrigez l'écriture " +
                                'manuelle par inscription en négatif (AUDCIF art. 20, al. 2), puis contre-passez le seul 478, 479 et comptes de tiers ' +
                                '(« Contre-passer » rejuge l’état des comptes de l’écart et nomme l’issue s’il n’est pas en place)' +
                                (groupee
                                    ? " ; l'écriture portait d'autres gestes, que son inscription en négatif annule avec elle · repassez-les. "
                                    : '. ')
                            : '') +
                        (manuelleClose
                            ? "Contre-passation manuelle déclarée, dans un exercice clôturé · elle ne se corrige plus ; toute régularisation est à décider par le cabinet. "
                            : '') +
                        (close
                            ? "Contre-passation dans un exercice clôturé · elle ne s'annule plus ; toute régularisation est à décider par le cabinet. "
                            : '') +
                        (parException
                            ? "Contre-passation intégrale par exception nommée (exercice suivant réévalué sous l'ancien régime, ou écriture des écarts " +
                                'qui ne se partage pas) · voulue, rien à reprendre. '
                            : '') +
                        'Ne repassez pas à la main la seule ligne de la banque · la réévaluation de clôture, qui mesure la banque depuis son coût ' +
                        'historique, passerait l’écart une seconde fois.',
                    occurrences: [
                        ...(contrePassees.tronque
                            ? [{ reference: 'Lecture bornée', detail: `${contre_passations_de_disponibilites_1.PLAFOND_REEVALUATIONS_EXAMINEES} réévaluations lues · d'autres contre-passations peuvent exister.` }]
                            : []),
                        ...contrePassees.elements.map((e) => ({
                            reference: `${e.compteNumero} · contre-passation n° ${e.piece ?? '·'}`,
                            detail: `Réévaluation du ${e.dateReevaluation.toISOString().slice(0, 10)}${e.exerciceReevaluationClos ? ' (exercice clôturé)' : ''} · ` +
                                `disponibilité ${e.montant > 0 ? 'débitée' : 'créditée'} de ${Math.abs(e.montant).toFixed(2)} à l'ouverture` +
                                (e.exception ? ` · contre-passation intégrale par exception (${e.exception})` : '') +
                                (e.manuelle ? ' · contre-passation manuelle déclarée' : ''),
                            date: e.date.toISOString().slice(0, 10),
                            montant: e.montant,
                        })),
                    ],
                });
            }
        }
        anomalies.push(...(await this.controlesBanqueEtClotureInformatique(tenantId, ex, tenant.referentiel, parcours, maintenant)));
        if (parcours.lettrageVu) {
            const aCheval = await (0, lettrages_a_cheval_1.lettragesACheval)(this.prisma, { tenantId, exerciceId });
            const borne = aCheval.tronque
                ? [{ reference: 'Lecture bornée', detail: `${lettrages_a_cheval_1.PLAFOND_LETTRAGES_A_CHEVAL} groupes lus · d'autres lettrages à cheval peuvent exister.` }]
                : [];
            const auDetail = aCheval.groupes.filter((g) => g.auDetail);
            if (auDetail.length > 0) {
                anomalies.push({
                    code: 'LETTRAGE_A_CHEVAL_D_EXERCICES',
                    gravite: 'INFORMATION',
                    libelle: 'Lettrage qui mêle deux exercices sur un compte au Détail',
                    consequence: "Le report à-nouveau lit chaque exercice pour lui-même · ces lignes y passent comme ouvertes, et la ligne d'à-nouveau de la facture " +
                        "se lit réglée par le groupe dans l'exercice suivant au règlement des tiers, aux relances et à la réévaluation. Le solde du compte est " +
                        'juste ; la balance âgée et les notes par échéance lisent encore ouverte la ligne d’à-nouveau d’un groupe soldé.',
                    action: "Rien à défaire · ne délettrez pas le groupe (soldé dans sa devise, il rouvrirait ses lignes à la réévaluation), et ne lettrez la " +
                        'ligne d’à-nouveau de sa facture avec aucun autre règlement. Justifiez au dossier de travail la ligne que la balance âgée montre ouverte.',
                    occurrences: [...borne, ...auDetail.map((g) => ({ reference: `${g.compteNumero} · lettrage ${g.code}`, detail: (0, lettrages_a_cheval_1.issueLettrageACheval)(g) }))],
                });
            }
            const ecarts = aCheval.groupes.filter((g) => g.ecartNonPasse !== null);
            if (ecarts.length > 0) {
                anomalies.push({
                    code: 'ECART_CHANGE_A_CHEVAL_NON_CONSTATE',
                    gravite: 'AVERTISSEMENT',
                    libelle: 'Écart de change réalisé non passé sur un lettrage à cheval de deux exercices',
                    consequence: "Le groupe est soldé dans sa devise et pas en francs · l'écart de change réalisé « est constaté » à la date du règlement " +
                        '(AUDCIF art. 55) ; non passé, il reste au compte du tiers comme un reste qui n’est plus une créance ni une dette, et manque au résultat.',
                    action: "Passez l'écart proposé sur le groupe (Interrogation et lettrage, « Écart de change »), figé ou non · jamais par une écriture hors " +
                        "du groupe, que la réévaluation recompterait. Dénouement dans une période close · report au premier jour non clôturé (AUDCIF art. 22, 4°). " +
                        "La clôture de l'exercice est refusée tant que l'écart n'est pas passé.",
                    occurrences: [
                        ...borne,
                        ...ecarts.map((g) => ({ reference: `${g.compteNumero} · lettrage ${g.code}`, detail: (0, lettrages_a_cheval_1.issueEcartACheval)(g, tenant.referentiel), montant: g.ecartNonPasse })),
                    ],
                });
            }
        }
        const precedentClos = ex.statut !== client_1.StatutExercice.CLOTURE
            ? await this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: { lt: ex.dateDebut }, statut: client_1.StatutExercice.CLOTURE },
                select: { id: true },
            })
            : null;
        if (precedentClos) {
            const nonReconduits = await (0, reconduction_lettrage_1.groupesNonReconduits)(this.prisma, { tenantId, exerciceSuivantId: exerciceId });
            if (nonReconduits.total > 0) {
                anomalies.push({
                    code: 'LETTRAGE_PARTIEL_NON_RECONDUIT',
                    gravite: 'INFORMATION',
                    libelle: "Lettrage partiel de l'exercice précédent non reconduit sur ses lignes d'à-nouveau",
                    consequence: "La facture réunie en N avec son acompte ou son règlement partiel arrive en N+1 seule · elle se lit due en entier au règlement des " +
                        "tiers et aux relances, et l'acompte reste à part au compte du tiers, alors que le tiers ne doit que le reste (fiches des comptes 40 et 41).",
                    action: "Lignes d'à-nouveau libres · « Reconduire » au pré-lettrage du compte. Déjà lettrées ailleurs · vérifiez que le règlement passé ne " +
                        'dépasse pas le reste dû, et relettrez à la main. Rien n’est délettré ni corrigé d’office.',
                    occurrences: [
                        ...(nonReconduits.tronque
                            ? [{ reference: 'Lecture bornée', detail: `${nonReconduits.groupes.length} groupes nommés sur ${nonReconduits.total}.` }]
                            : []),
                        ...nonReconduits.groupes.map((g) => ({ reference: `${g.compteNumero} · lettrage ${g.code}`, detail: (0, reconduction_lettrage_1.detailNonReconduit)(g), montant: g.reste })),
                    ],
                });
            }
        }
        const anciensInppOnem = (await this.prisma.compte.findMany({
            where: { tenantId, OR: inpp_onem_sous_le_433_1.RACINES_ANCIENNES_INPP_ONEM.map((r) => ({ numero: { startsWith: r } })) },
            select: { id: true, numero: true, intitule: true, estActif: true, _count: { select: { lignesEcriture: true } } },
        })).filter((c) => (0, inpp_onem_sous_le_433_1.estCompteAncienInppOnem)(c.numero));
        if (anciensInppOnem.length > 0) {
            const ids = anciensInppOnem.map((c) => c.id);
            const [saisies, reports] = await Promise.all([false, true].map((genere) => this.prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { compteId: { in: ids }, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION, exerciceId, estGenereeParCloture: genere } },
                _sum: { debit: true, credit: true },
                _count: { _all: true },
            })));
            const lu = (liste, id) => liste.find((g) => g.compteId === id);
            const anomalie = (0, inpp_onem_sous_le_433_1.anomalieInppOnemSousLe433)(anciensInppOnem.map((c) => {
                const s = lu(saisies, c.id);
                const r = lu(reports, c.id);
                const solde = [s, r].reduce((n, g) => n + Number(g?._sum.credit ?? 0) - Number(g?._sum.debit ?? 0), 0);
                return {
                    numero: c.numero,
                    intitule: c.intitule,
                    estActif: c.estActif,
                    lignesTotal: c._count.lignesEcriture,
                    lignesSaisiesExercice: s?._count._all ?? 0,
                    lignesReportExercice: r?._count._all ?? 0,
                    soldeCrediteurExercice: solde,
                };
            }), ex.statut === 'CLOTURE');
            if (anomalie)
                anomalies.push(anomalie);
        }
        const ordre = { BLOQUANT: 0, AVERTISSEMENT: 1, INFORMATION: 2 };
        anomalies.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
        return {
            exerciceId,
            genereLe: new Date().toISOString(),
            anomalies,
            totaux: {
                bloquants: anomalies.filter((a) => a.gravite === 'BLOQUANT').length,
                avertissements: anomalies.filter((a) => a.gravite === 'AVERTISSEMENT').length,
                informations: anomalies.filter((a) => a.gravite === 'INFORMATION').length,
            },
        };
    }
};
exports.ControlesService = ControlesService;
ControlesService.JOURS_ANCIENNETE_TIERS = 180;
exports.ControlesService = ControlesService = ControlesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService])
], ControlesService);
//# sourceMappingURL=controles.service.js.map