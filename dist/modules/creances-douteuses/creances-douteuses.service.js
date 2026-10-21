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
var CreancesDouteusesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreancesDouteusesService = exports.MOTIF_VERROU_CREANCES = exports.ECHEANCE_VERROU_CREANCES_MS = exports.PLAFOND_COMPTES_416_491 = exports.PLAFOND_CANDIDATES_CORRECTION = exports.PLAFOND_CREANCES_LISTEES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const systeme_minimal_1 = require("../../common/systeme-minimal");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const methode_au_reclassement_1 = require("./methode-au-reclassement");
const taux_tva_service_1 = require("../tva/taux-tva.service");
const recuperation_tva_1 = require("./recuperation-tva");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const lettrage_service_1 = require("../lettrage/lettrage.service");
const gel_cloture_1 = require("../exercice/gel-cloture");
const report_periode_close_1 = require("../exercice/report-periode-close");
const creances_douteuses_1 = require("./creances-douteuses");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const n = (v) => Number(v ?? 0);
function methodeFigee(referentiel, methode) {
    if (referentiel !== client_1.Referentiel.SYCEBNL)
        return null;
    if (methode === 'APPEL')
        return client_1.MethodeCotisationsAuReclassement.APPEL;
    if (methode === 'ENCAISSEMENT')
        return client_1.MethodeCotisationsAuReclassement.ENCAISSEMENT;
    return client_1.MethodeCotisationsAuReclassement.NON_DECLAREE;
}
const jour = (d) => d.toISOString().slice(0, 10);
exports.PLAFOND_CREANCES_LISTEES = 500;
exports.PLAFOND_CANDIDATES_CORRECTION = 50;
const CLASSES_DE_GESTION = new Set([client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7, client_1.ClasseCompte.CLASSE_8]);
const PLAFOND_COMPTES_CANDIDATS = 1000;
exports.PLAFOND_COMPTES_416_491 = 200;
exports.ECHEANCE_VERROU_CREANCES_MS = 15 * 60 * 1000;
exports.MOTIF_VERROU_CREANCES = 'Une opération sur les créances douteuses est en cours sur ce dossier · réessayez après sa fin.';
const A_NOUVEAU = { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false, estANouveauProvisoire: false };
const HORS_REPORT_PROVISOIRE = {
    estANouveauProvisoire: false,
    ...ecritures_de_situation_1.HORS_SITUATION,
};
const INCLURE_CREANCE = {
    compteCreance: { select: { id: true, numero: true, intitule: true, tiersCompte: { select: { tiers: { select: { nom: true } } } } } },
    compte416: { select: { id: true, numero: true, intitule: true } },
    compte491: { select: { id: true, numero: true, intitule: true } },
    ajustements: {
        where: { annuleeLe: null },
        include: { exercice: { select: { dateDebut: true, dateFin: true, statut: true } } },
        orderBy: { date: 'asc' },
    },
    mouvements: {
        where: { annuleeLe: null },
        orderBy: { date: 'asc' },
    },
    ecritureCorrectionResultat: { select: { id: true, date: true, numeroPiece: true, journal: { select: { code: true } } } },
};
const INCLURE_LISTE = {
    ...INCLURE_CREANCE,
    _count: { select: { ajustements: true, mouvements: true } },
    exercice: { select: { statut: true } },
    ecritureReclassement: { select: { statut: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } } },
};
function estRetirable(c) {
    if (!c._count || !c.exercice)
        return false;
    const e = c.ecritureReclassement;
    return ((0, creances_douteuses_1.motifNonRetirable)({
        revuesTotal: c._count.ajustements,
        mouvementsTotal: c._count.mouvements,
        exerciceClos: c.exercice.statut === client_1.StatutExercice.CLOTURE,
        ecriture: e
            ? {
                statut: e.statut === client_1.StatutEcriture.BROUILLARD ? 'BROUILLARD' : 'VALIDEE',
                tenue: (0, lignes_tenues_1.motifLignesTenues)(e.lignes, 'le reclassement', 'retirer') !== null,
            }
            : null,
    }) === null);
}
let CreancesDouteusesService = CreancesDouteusesService_1 = class CreancesDouteusesService {
    constructor(prisma, ecritures, lettrage, tva) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.lettrage = lettrage;
        this.tva = tva;
        this.journalServeur = new common_1.Logger(CreancesDouteusesService_1.name);
    }
    async sousVerrou(tenantId, geste, travail) {
        const maintenant = new Date();
        await this.prisma.verrouCreancesDouteuses.deleteMany({ where: { tenantId, echeance: { lt: maintenant } } });
        let verrou;
        try {
            verrou = await this.prisma.verrouCreancesDouteuses.create({
                data: { tenantId, geste, echeance: new Date(maintenant.getTime() + exports.ECHEANCE_VERROU_CREANCES_MS) },
                select: { id: true },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                const tenu = await this.prisma.verrouCreancesDouteuses.findFirst({
                    where: { tenantId },
                    select: { geste: true, createdAt: true, echeance: true },
                });
                throw new common_1.ConflictException(tenu
                    ? `${exports.MOTIF_VERROU_CREANCES} Geste en cours · ${tenu.geste}, depuis le ${tenu.createdAt.toISOString()} ; ` +
                        `le verrou échoit au plus tard le ${tenu.echeance.toISOString()}.`
                    : exports.MOTIF_VERROU_CREANCES);
            }
            throw e;
        }
        let resultat;
        let erreur = null;
        let echec = false;
        try {
            resultat = await travail();
        }
        catch (e) {
            echec = true;
            erreur = e;
        }
        try {
            await this.prisma.verrouCreancesDouteuses.deleteMany({ where: { tenantId, id: verrou.id } });
        }
        catch (liberation) {
            this.journalServeur.error(`Verrou des créances douteuses du dossier ${tenantId} non retiré · il échoit à son échéance`, liberation instanceof Error ? liberation.stack : String(liberation));
        }
        if (echec)
            throw erreur;
        return resultat;
    }
    async compenser(tenantId, ecritureId) {
        try {
            await this.ecritures.retirerCompensation(tenantId, ecritureId);
        }
        catch (retrait) {
            this.journalServeur.error(`Écriture ${ecritureId} du dossier ${tenantId} restée au brouillard · son retrait après l'échec du geste a échoué`, retrait instanceof Error ? retrait.stack : String(retrait));
        }
    }
    async statutDansTx(tx, tenantId, ecritureId) {
        const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
        if (!e)
            throw new common_1.ConflictException(`L'écriture ${ecritureId} n'existe plus · relisez la créance avant d'annuler.`);
        return e.statut;
    }
    async supprimerBrouillardDansTx(tx, tenantId, ecritureId) {
        await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
        const r = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
        if (r.count !== 1) {
            throw new common_1.ConflictException("L'écriture a été validée ou retirée pendant l'annulation · rien n'est supprimé. Relancez l'annulation · validée, elle " +
                "s'inscrira en négatif (AUDCIF art. 20, al. 2).");
        }
    }
    async regime(tenantId) {
        return this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { referentiel: true, systemeComptableSyscohada: true, jeuEtatsFinanciersSycebnl: true, methodeCotisations: true },
        });
    }
    async exercice(tenantId, id) {
        const ex = await this.prisma.exercice.findFirst({ where: { id, tenantId } });
        if (!ex)
            throw new common_1.BadRequestException('Exercice introuvable pour ce dossier.');
        return ex;
    }
    async journal(tenantId, id) {
        const j = await this.prisma.journal.findFirst({
            where: { id, tenantId },
            select: { id: true, code: true, type: true, compteTresorerieId: true },
        });
        if (!j)
            throw new common_1.BadRequestException('Journal introuvable pour ce dossier.');
        return j;
    }
    async compteParId(tenantId, id) {
        const c = await this.prisma.compte.findFirst({
            where: { id, tenantId },
            select: { id: true, numero: true, intitule: true, typeCompte: true, estActif: true },
        });
        if (!c)
            throw new common_1.BadRequestException('Compte introuvable pour ce dossier.');
        return c;
    }
    async compteDetail(tenantId, racine) {
        const c = await this.prisma.compte.findFirst({
            where: { tenantId, numero: { startsWith: racine }, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true },
            orderBy: { numero: 'asc' },
            select: { id: true, numero: true, intitule: true, typeCompte: true },
        });
        if (!c)
            throw new common_1.BadRequestException(`Aucun compte ${racine} de détail au plan du dossier · ouvrez-le d'abord.`);
        return c;
    }
    async compte416DuTiers(tenantId, compteCreanceId, racine) {
        return this.prisma.compte.findFirst({
            where: {
                tenantId,
                numero: { startsWith: racine },
                typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                estActif: true,
                collectifId: { not: null },
                tiersCompte: { tiers: { tenantId, comptesRattaches: { some: { compteId: compteCreanceId } } } },
            },
            orderBy: { numero: 'asc' },
            select: { id: true, numero: true, intitule: true, typeCompte: true },
        });
    }
    async aUnANouveau(tenantId, exerciceId) {
        return (await this.prisma.ecriture.count({ where: { tenantId, exerciceId, ...A_NOUVEAU } })) > 0;
    }
    async aUnReportProvisoire(tenantId, exerciceId) {
        return (await this.prisma.ecriture.count({ where: { tenantId, exerciceId, estANouveauProvisoire: true } })) > 0;
    }
    async chaine(tenantId, ex) {
        const ids = [ex.id];
        let provisoire = false;
        let courant = ex;
        for (let k = 0; k < 20; k++) {
            if (await this.aUnANouveau(tenantId, courant.id))
                break;
            const precedent = await this.prisma.exercice.findFirst({
                where: { tenantId, dateFin: { lt: courant.dateDebut } },
                orderBy: { dateFin: 'desc' },
                select: { id: true, dateDebut: true },
            });
            if (!precedent)
                break;
            ids.push(precedent.id);
            provisoire = true;
            courant = precedent;
        }
        return { ids, provisoire };
    }
    async solde(tenantId, compte, ids, au) {
        const s = await this.prisma.ligneEcriture.aggregate({
            where: {
                compte: { tenantId, ...compte },
                ecriture: { tenantId, exerciceId: { in: ids }, date: { lte: au }, ...HORS_REPORT_PROVISOIRE },
            },
            _sum: { debit: true, credit: true },
        });
        return (0, creances_douteuses_1.centimes)(n(s._sum.debit) - n(s._sum.credit));
    }
    async creance(tenantId, id) {
        const c = await this.prisma.creanceDouteuse.findFirst({ where: { id, tenantId }, include: INCLURE_CREANCE });
        if (!c)
            throw new common_1.NotFoundException('Créance douteuse introuvable pour ce dossier.');
        if (c.annuleeLe)
            throw new common_1.BadRequestException(`Le reclassement de cette créance est annulé, le ${jour(c.annuleeLe)}.`);
        if (c.corrigeeParResultatLe) {
            throw new common_1.BadRequestException(`Cette créance est corrigée par le résultat de l'exercice (écriture du ${jour(c.ecritureCorrectionResultat?.date ?? c.corrigeeParResultatLe)}) · elle est sortie du module.`);
        }
        return c;
    }
    async refuserSiCorrigee(tenantId, id) {
        const c = await this.prisma.creanceDouteuse.findFirst({ where: { id, tenantId }, select: { corrigeeParResultatLe: true } });
        if (c?.corrigeeParResultatLe) {
            throw new common_1.BadRequestException("Cette créance est corrigée par le résultat de l'exercice · ses actes ne se défont plus, la correction ayant soldé " +
                'exactement ce qu’ils laissaient au 416 et au 491.');
        }
    }
    async methodeDeLaCreance(tenantId, c, referentiel, actuelle) {
        if (referentiel !== client_1.Referentiel.SYCEBNL || !(0, creances_douteuses_1.estImpayeAdherent)(c.compteCreance.numero))
            return { methode: undefined, avertissement: null };
        const m = await (0, methode_au_reclassement_1.lireMethodeAuReclassement)(this.prisma, {
            tenantId,
            figee: c.methodeCotisationsReclassement,
            geste: c.createdAt,
            actuelle,
        });
        return m.connue ? { methode: m.methode, avertissement: null } : { methode: undefined, avertissement: (0, creances_douteuses_1.avertissementMethodeInconnue)(m.motif) };
    }
    enPlace(c, avant) {
        return (0, creances_douteuses_1.enPlaceAvant)({ declareeOuverture: c.declareeOuverture, depreciationOuverture: n(c.depreciationOuverture), dateReclassement: c.dateReclassement }, c.ajustements.map((a) => ({ exerciceDateFin: a.exercice.dateFin, ecart: n(a.ecart) })), avant);
    }
    reste(c, au) {
        return (0, creances_douteuses_1.resteDeLaCreance)(n(c.montant), c.mouvements.map((m) => ({ date: m.date, montant: n(m.montant) })), au);
    }
    resteFinal(c) {
        return (0, creances_douteuses_1.resteFinalDeLaCreance)(n(c.montant), c.mouvements.map((m) => ({ montant: n(m.montant) })));
    }
    async motifSoldeReconstitue(tenantId, exerciceId, suite) {
        if (await this.aUnReportProvisoire(tenantId, exerciceId)) {
            return (" Ce solde est reconstitué depuis l'exercice précédent, brouillard compris · l'à-nouveau de cet exercice n'est qu'un " +
                "report PROVISOIRE, que ce module ne lit jamais. Clôturez l'exercice précédent ou passez un bilan d'ouverture, " +
                `vérifiez le montant, puis ${suite}.`);
        }
        return (" Ce solde est le report RECONSTITUÉ de l'exercice précédent, l'à-nouveau de cet exercice n'étant pas encore passé · " +
            `clôturez l'exercice précédent ou passez un bilan d'ouverture, puis ${suite}.`);
    }
    async soldeAuPlusTard(tenantId, compteId, ex, ids) {
        const fin = new Date('9999-12-31');
        let plusPetit = await this.solde(tenantId, { id: compteId }, ids, fin);
        const suivants = await this.prisma.exercice.findMany({
            where: { tenantId, dateFin: { gte: ex.dateFin }, id: { not: ex.id } },
            orderBy: { dateFin: 'asc' },
            select: { id: true, dateDebut: true },
            take: 20,
        });
        for (const suivant of suivants) {
            const chaineSuivant = await this.chaine(tenantId, suivant);
            plusPetit = Math.min(plusPetit, await this.solde(tenantId, { id: compteId }, chaineSuivant.ids, fin));
        }
        return plusPetit;
    }
    async compte491Choisi(tenantId, nature, choisi) {
        if (!choisi)
            return this.compteDetail(tenantId, (0, creances_douteuses_1.compte491)(nature));
        const k = await this.compteParId(tenantId, choisi);
        const refus = (0, creances_douteuses_1.motifRefus491)(nature, k.numero, k.typeCompte === client_1.TypeCompteDetailTotal.DETAIL);
        if (refus)
            throw new common_1.BadRequestException(refus);
        return k;
    }
    async comptes(tenantId, exerciceId, numero) {
        const filtre = (numero ?? '').trim();
        if (filtre && !/^\d{1,13}$/.test(filtre)) {
            throw new common_1.BadRequestException('Le début de numéro se tape en chiffres (de 1 à 13).');
        }
        const [{ referentiel, methodeCotisations }, ex] = await Promise.all([this.regime(tenantId), this.exercice(tenantId, exerciceId)]);
        const { ids, provisoire } = await this.chaine(tenantId, ex);
        const racines = creances_douteuses_1.RACINES_CREANCE_SOURCE[referentiel];
        const groupes = await this.prisma.ligneEcriture.groupBy({
            by: ['compteId'],
            where: {
                ecriture: { tenantId, exerciceId: { in: ids }, ...HORS_REPORT_PROVISOIRE },
                compte: {
                    tenantId,
                    typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                    OR: racines.map((r) => ({ numero: { startsWith: r } })),
                    ...(filtre ? { AND: [{ numero: { startsWith: filtre } }] } : {}),
                },
            },
            _sum: { debit: true, credit: true },
            orderBy: { compteId: 'asc' },
            take: PLAFOND_COMPTES_CANDIDATS + 1,
        });
        const debiteurs = groupes
            .map((g) => ({ compteId: g.compteId, solde: (0, creances_douteuses_1.centimes)(n(g._sum?.debit) - n(g._sum?.credit)) }))
            .filter((g) => g.solde > 0.005);
        const ou416 = { tenantId, numero: { startsWith: creances_douteuses_1.COMPTES_CREANCES_DOUTEUSES.creances416 }, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true };
        const ou491 = { tenantId, numero: { startsWith: '491' }, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true };
        const [comptesCreances, comptes416, comptes491, total416, total491] = await Promise.all([
            this.prisma.compte.findMany({
                where: { tenantId, id: { in: debiteurs.map((d) => d.compteId) } },
                select: { id: true, numero: true, intitule: true, tiersCompte: { select: { tiers: { select: { nom: true } } } } },
                orderBy: { numero: 'asc' },
                take: PLAFOND_COMPTES_CANDIDATS,
            }),
            this.prisma.compte.findMany({ where: { ...ou416, tenantId }, select: { id: true, numero: true, intitule: true }, orderBy: { numero: 'asc' }, take: exports.PLAFOND_COMPTES_416_491 }),
            this.prisma.compte.findMany({ where: { ...ou491, tenantId }, select: { id: true, numero: true, intitule: true }, orderBy: { numero: 'asc' }, take: exports.PLAFOND_COMPTES_416_491 }),
            this.prisma.compte.count({ where: { ...ou416, tenantId } }),
            this.prisma.compte.count({ where: { ...ou491, tenantId } }),
        ]);
        const soldes = new Map(debiteurs.map((d) => [d.compteId, d.solde]));
        const rattaches = await this.prisma.tiersCompte.findMany({
            where: { tiers: { tenantId }, compteId: { in: comptesCreances.map((c) => c.id) } },
            select: { compteId: true, tiersId: true },
        });
        const tiersDe = new Map(rattaches.map((r) => [r.compteId, r.tiersId]));
        const candidats416 = rattaches.length
            ? await this.prisma.compte.findMany({
                where: {
                    tenantId,
                    numero: { startsWith: creances_douteuses_1.COMPTES_CREANCES_DOUTEUSES.creances416 },
                    typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                    estActif: true,
                    collectifId: { not: null },
                    tiersCompte: { tiersId: { in: [...new Set(rattaches.map((r) => r.tiersId))] } },
                },
                select: { id: true, numero: true, intitule: true, tiersCompte: { select: { tiersId: true } } },
                orderBy: { numero: 'asc' },
            })
            : [];
        const propres = comptesCreances.map((c) => {
            const parNature = {};
            for (const nature of [client_1.NatureCreanceDouteuse.LITIGIEUSE, client_1.NatureCreanceDouteuse.DOUTEUSE]) {
                const racine = (0, creances_douteuses_1.compte416Propose)(referentiel, nature, c.numero);
                const k = racine
                    ? candidats416.find((x) => x.tiersCompte?.tiersId === tiersDe.get(c.id) && x.numero.startsWith(racine))
                    : undefined;
                parNature[nature] = k ? { id: k.id, numero: k.numero, intitule: k.intitule } : null;
            }
            return [c.id, parNature];
        });
        const propreDe = new Map(propres);
        const deja416 = new Set(comptes416.map((k) => k.id));
        const ajoutes416 = propres
            .flatMap(([, p]) => Object.values(p))
            .filter((k) => !!k && !deja416.has(k.id) && !!deja416.add(k.id));
        return {
            referentiel,
            soldesProvisoires: provisoire,
            creances: comptesCreances.map((c) => ({
                id: c.id,
                numero: c.numero,
                intitule: c.intitule,
                tiers: c.tiersCompte?.tiers.nom ?? null,
                solde: soldes.get(c.id) ?? 0,
                propose416: {
                    LITIGIEUSE: (0, creances_douteuses_1.compte416Propose)(referentiel, client_1.NatureCreanceDouteuse.LITIGIEUSE, c.numero),
                    DOUTEUSE: (0, creances_douteuses_1.compte416Propose)(referentiel, client_1.NatureCreanceDouteuse.DOUTEUSE, c.numero),
                },
                propre416: {
                    LITIGIEUSE: propreDe.get(c.id)?.[client_1.NatureCreanceDouteuse.LITIGIEUSE]?.id ?? null,
                    DOUTEUSE: propreDe.get(c.id)?.[client_1.NatureCreanceDouteuse.DOUTEUSE]?.id ?? null,
                },
                refusCotisations: (0, creances_douteuses_1.motifRefusCotisationsEncaissement)(referentiel, c.numero, methodeCotisations ?? null),
                avertissementCotisations: (0, creances_douteuses_1.avertissementMethodeCotisations)(referentiel, c.numero, methodeCotisations ?? null),
            })),
            tronque: groupes.length > PLAFOND_COMPTES_CANDIDATS,
            plafond: PLAFOND_COMPTES_CANDIDATS,
            filtreNumero: filtre || null,
            comptes416: [...comptes416, ...ajoutes416].sort((a, b) => a.numero.localeCompare(b.numero)),
            comptes491,
            listes416491: {
                plafond: exports.PLAFOND_COMPTES_416_491,
                total416,
                tronque416: total416 > comptes416.length,
                total491,
                tronque491: total491 > comptes491.length,
            },
        };
    }
    async lister(tenantId, exerciceId) {
        const ex = await this.exercice(tenantId, exerciceId);
        const [total, lignes, regime, annulees, mouvementsAnnules, totalRevuesAnnulees, totalMouvementsAnnules] = await Promise.all([
            this.prisma.creanceDouteuse.count({ where: { tenantId, dateReclassement: { lte: ex.dateFin }, annuleeLe: null } }),
            this.prisma.creanceDouteuse.findMany({
                where: { tenantId, dateReclassement: { lte: ex.dateFin }, annuleeLe: null },
                include: INCLURE_LISTE,
                orderBy: [{ dateReclassement: 'desc' }, { id: 'desc' }],
                take: exports.PLAFOND_CREANCES_LISTEES,
            }),
            this.regime(tenantId),
            this.prisma.ajustementCreanceDouteuse.findMany({
                where: { tenantId, exerciceId: ex.id, annuleeLe: { not: null } },
                select: { id: true, creanceId: true, annuleeLe: true, motifAnnulation: true },
                orderBy: { annuleeLe: 'desc' },
                take: exports.PLAFOND_CREANCES_LISTEES,
            }),
            this.prisma.mouvementCreanceDouteuse.findMany({
                where: { tenantId, exerciceId: ex.id, annuleeLe: { not: null } },
                select: { id: true, creanceId: true, type: true, date: true, montant: true, annuleeLe: true, motifAnnulation: true },
                orderBy: { annuleeLe: 'desc' },
                take: exports.PLAFOND_CREANCES_LISTEES,
            }),
            this.prisma.ajustementCreanceDouteuse.count({ where: { tenantId, exerciceId: ex.id, annuleeLe: { not: null } } }),
            this.prisma.mouvementCreanceDouteuse.count({ where: { tenantId, exerciceId: ex.id, annuleeLe: { not: null } } }),
        ]);
        const creances = lignes.map((c) => ({
            ...this.presenter(c, ex, regime.referentiel),
            retirable: estRetirable(c),
            revuesAnnulees: annulees.filter((a) => a.creanceId === c.id).map((a) => ({ id: a.id, annuleeLe: a.annuleeLe, motif: a.motifAnnulation })),
            mouvementsAnnules: mouvementsAnnules
                .filter((m) => m.creanceId === c.id)
                .map((m) => ({ id: m.id, type: m.type, date: m.date, montant: n(m.montant), annuleeLe: m.annuleeLe, motif: m.motifAnnulation })),
        }));
        return {
            exercice: { id: ex.id, dateDebut: ex.dateDebut, dateFin: ex.dateFin, statut: ex.statut },
            systemeMinimal: !!(0, systeme_minimal_1.motifRefusDepreciationSmt)(regime),
            total,
            tronque: total > lignes.length,
            annulations: {
                revues: { total: totalRevuesAnnulees, tronque: totalRevuesAnnulees > annulees.length },
                mouvements: { total: totalMouvementsAnnules, tronque: totalMouvementsAnnules > mouvementsAnnules.length },
            },
            creances,
            rapprochement: await this.rapprochementDuModule(tenantId, ex),
        };
    }
    async rapprochementDuModule(tenantId, ex) {
        const enVigueur = { dateReclassement: { lte: ex.dateFin }, annuleeLe: null, ...(0, creances_douteuses_1.nonCorrigeeAu)(ex.dateFin) };
        const base = { tenantId, ...enVigueur };
        const [montants, declarees, mouvements, ecarts, par416, par491, chaine] = await Promise.all([
            this.prisma.creanceDouteuse.aggregate({ where: { ...base, tenantId }, _sum: { montant: true } }),
            this.prisma.creanceDouteuse.aggregate({
                where: { ...base, tenantId, declareeOuverture: true, dateReclassement: { lte: ex.dateDebut } },
                _sum: { depreciationOuverture: true },
            }),
            this.prisma.mouvementCreanceDouteuse.aggregate({
                where: { tenantId, annuleeLe: null, date: { lte: ex.dateFin }, creance: enVigueur },
                _sum: { montant: true },
            }),
            this.prisma.ajustementCreanceDouteuse.aggregate({
                where: { tenantId, annuleeLe: null, exercice: { dateFin: { lte: ex.dateFin } }, creance: enVigueur },
                _sum: { ecart: true },
            }),
            this.prisma.creanceDouteuse.groupBy({ by: ['compte416Id'], where: { ...base, tenantId }, orderBy: { compte416Id: 'asc' } }),
            this.prisma.creanceDouteuse.groupBy({ by: ['compte491Id'], where: { ...base, tenantId }, orderBy: { compte491Id: 'asc' } }),
            this.chaine(tenantId, ex),
        ]);
        const { ids, provisoire } = chaine;
        const comptes416 = par416.map((g) => g.compte416Id);
        const comptes491 = par491.map((g) => g.compte491Id);
        const [solde416, solde491, horsModule491, reportProvisoire] = await Promise.all([
            comptes416.length > 0 ? this.solde(tenantId, { id: { in: comptes416 } }, ids, ex.dateFin) : Promise.resolve(0),
            comptes491.length > 0 ? this.solde(tenantId, { id: { in: comptes491 } }, ids, ex.dateFin) : Promise.resolve(0),
            comptes491.length > 0 ? this.horsModule491(tenantId, comptes491, ex) : Promise.resolve(0),
            provisoire ? this.aUnReportProvisoire(tenantId, ex.id) : Promise.resolve(false),
        ]);
        return {
            provisoire,
            reportProvisoire,
            solde416,
            resteModule: (0, creances_douteuses_1.centimes)(n(montants._sum.montant) - n(mouvements._sum.montant)),
            solde491: (0, creances_douteuses_1.centimes)(-solde491),
            depreciationModule: (0, creances_douteuses_1.centimes)(n(declarees._sum.depreciationOuverture) + n(ecarts._sum.ecart)),
            horsModule491,
        };
    }
    async horsModule491(tenantId, comptes491, ex) {
        const s = await this.prisma.ligneEcriture.aggregate({
            where: {
                compteId: { in: comptes491 },
                ecriture: {
                    tenantId,
                    exerciceId: ex.id,
                    date: { lte: ex.dateFin },
                    estGenereeParCloture: false,
                    ...HORS_REPORT_PROVISOIRE,
                    ajustementCreanceDouteuse: { is: null },
                    creanceDouteuseCorrection: { is: null },
                    NOT: { corrigeEcriture: { is: { ajustementCreanceDouteuse: { isNot: null } } } },
                },
            },
            _sum: { debit: true, credit: true },
        });
        return (0, creances_douteuses_1.centimes)(n(s._sum.credit) - n(s._sum.debit));
    }
    presenter(c, ex, referentiel) {
        const corrigee = !!c.ecritureCorrectionResultat && c.ecritureCorrectionResultat.date.getTime() <= ex.dateFin.getTime();
        const enPlaceOuverture = this.enPlace(c, ex.dateDebut);
        const reste = corrigee ? 0 : this.reste(c, ex.dateFin);
        const revue = c.ajustements.find((a) => a.exerciceId === ex.id) ?? null;
        return {
            correction: c.ecritureCorrectionResultat
                ? {
                    ecritureId: c.ecritureCorrectionResultat.id,
                    date: c.ecritureCorrectionResultat.date,
                    piece: `${c.ecritureCorrectionResultat.journal.code} n° ${c.ecritureCorrectionResultat.numeroPiece ?? '·'}`,
                    motif: c.motifCorrectionResultat,
                    le: c.corrigeeParResultatLe,
                    effective: corrigee,
                }
                : null,
            correctionOfferte: referentiel === client_1.Referentiel.SYCEBNL &&
                (0, creances_douteuses_1.estImpayeAdherent)(c.compteCreance.numero) &&
                !c.ecritureCorrectionResultat &&
                (c.declareeOuverture || c.dateReclassement.getTime() < ex.dateDebut.getTime()),
            id: c.id,
            nature: c.nature,
            compteCreance: { id: c.compteCreance.id, numero: c.compteCreance.numero, intitule: c.compteCreance.intitule },
            tiers: c.compteCreance.tiersCompte?.tiers.nom ?? null,
            compte416: c.compte416,
            compte491: c.compte491,
            dateReclassement: c.dateReclassement,
            declareeOuverture: c.declareeOuverture,
            sourceDeclaration: c.sourceDeclaration,
            montant: n(c.montant),
            motif: c.motif,
            pieces: c.pieces,
            ecritureReclassementId: c.ecritureReclassementId,
            resteALaCloture: reste,
            resteFinal: this.resteFinal(c),
            depreciationOuverture: enPlaceOuverture,
            depreciationALaCloture: corrigee ? 0 : (0, creances_douteuses_1.centimes)(revue ? n(revue.depreciationNecessaire) : enPlaceOuverture),
            revueAFaire: !corrigee && (0, creances_douteuses_1.revueAFaire)({ revueDeLExercice: !!revue, enPlace: enPlaceOuverture, reste, aucuneRevue: c.ajustements.length === 0 }),
            mouvementsSansRevue: (0, creances_douteuses_1.mouvementsSansRevue)({
                revueDeLExercice: !!revue,
                mouvementsDeLExercice: c.mouvements.filter((m) => m.date >= ex.dateDebut && m.date <= ex.dateFin).length,
            }),
            comptePertePropose: (0, creances_douteuses_1.comptePertePropose)(referentiel, c.compteCreance.numero),
            revue: revue
                ? {
                    id: revue.id,
                    date: revue.date,
                    depreciationNecessaire: n(revue.depreciationNecessaire),
                    depreciationEnPlace: n(revue.depreciationEnPlace),
                    ecart: n(revue.ecart),
                    motif: revue.motif,
                    pieces: revue.pieces,
                    ecritureId: revue.ecritureId,
                }
                : null,
            revues: c.ajustements.map((a) => ({
                id: a.id,
                exerciceId: a.exerciceId,
                date: a.date,
                depreciationNecessaire: n(a.depreciationNecessaire),
                ecart: n(a.ecart),
                motif: a.motif,
                ecritureId: a.ecritureId,
            })),
            mouvements: c.mouvements.map((m) => ({
                id: m.id,
                type: m.type,
                date: m.date,
                montant: n(m.montant),
                motif: m.motif,
                pieces: m.pieces,
                ecritureId: m.ecritureId,
            })),
        };
    }
    pieces(p) {
        return (0, creances_douteuses_1.piecesLisibles)(p ?? []);
    }
    reclasser(tenantId, userId, dto) {
        return this.sousVerrou(tenantId, 'RECLASSEMENT', () => this.reclasserSousVerrou(tenantId, userId, dto));
    }
    async reclasserSousVerrou(tenantId, userId, dto) {
        const [{ referentiel, methodeCotisations }, ex, journal, source] = await Promise.all([
            this.regime(tenantId),
            this.exercice(tenantId, dto.exerciceId),
            this.journal(tenantId, dto.journalId),
            this.compteParId(tenantId, dto.compteCreanceId),
        ]);
        const date = new Date(dto.date.slice(0, 10));
        const propose = (0, creances_douteuses_1.compte416Propose)(referentiel, dto.nature, source.numero);
        if (!dto.compte416Id && !propose) {
            throw new common_1.BadRequestException(`Le compte ${source.numero} ne dit pas si le débiteur est un adhérent (4161) ou un client-usager (4162) · choisissez le 416.`);
        }
        const c416 = dto.compte416Id
            ? await this.compteParId(tenantId, dto.compte416Id)
            : ((await this.compte416DuTiers(tenantId, source.id, propose)) ?? (await this.compteDetail(tenantId, propose)));
        const pieces = this.pieces(dto.pieces);
        const { ids, provisoire } = await this.chaine(tenantId, ex);
        const [soldeDebiteur, soldeDernier, enDevise, c491] = await Promise.all([
            this.solde(tenantId, { id: source.id }, ids, date),
            this.soldeAuPlusTard(tenantId, source.id, ex, ids),
            this.positionEnDeviseOuverte(tenantId, [source.id], ids, null),
            this.compte491Choisi(tenantId, dto.nature, dto.compte491Id),
        ]);
        let motif = (0, creances_douteuses_1.motifRefusReclassement)({
            referentiel,
            nature: dto.nature,
            numeroSource: source.numero,
            sourceEstDetail: source.typeCompte === client_1.TypeCompteDetailTotal.DETAIL,
            numero416: c416.numero,
            numero416EstDetail: c416.typeCompte === client_1.TypeCompteDetailTotal.DETAIL,
            montant: dto.montant,
            soldeDebiteur,
            soldeDernier,
            positionEnDevise: enDevise,
            motif: dto.motif,
            pieces,
            exerciceOuvert: ex.statut === client_1.StatutExercice.OUVERT,
            dateDansExercice: date >= ex.dateDebut && date <= ex.dateFin,
            journalGeneral: journal.type === client_1.TypeJournal.GENERAL,
            methodeCotisations: methodeCotisations ?? null,
        });
        if (motif && provisoire && motif.includes('dépasse ce que le client doit')) {
            motif += await this.motifSoldeReconstitue(tenantId, ex.id, 'reprenez le reclassement');
        }
        if (motif)
            throw new common_1.BadRequestException(motif);
        const factures = dto.factures?.length
            ? await this.facturesADesigner(tenantId, { id: null, compteCreanceId: source.id, numero: source.numero, montant: (0, creances_douteuses_1.centimes)(dto.montant) }, dto.factures)
            : [];
        const nature = dto.nature === client_1.NatureCreanceDouteuse.LITIGIEUSE ? 'litigieuse' : 'douteuse';
        const { suite: ligne } = await this.ecritures.creerAvec(tenantId, userId, {
            exerciceId: ex.id,
            journalId: journal.id,
            date: jour(date),
            libelle: `Créance ${nature} reclassée · ${source.numero} ${source.intitule}`.slice(0, 190),
            lignes: [
                { compteId: c416.id, debit: (0, creances_douteuses_1.centimes)(dto.montant), credit: 0 },
                { compteId: source.id, debit: 0, credit: (0, creances_douteuses_1.centimes)(dto.montant) },
            ],
        }, async (tx, ecriture) => {
            const creee = await tx.creanceDouteuse.create({
                data: {
                    tenantId,
                    exerciceId: ex.id,
                    nature: dto.nature,
                    compteCreanceId: source.id,
                    compte416Id: c416.id,
                    compte491Id: c491.id,
                    dateReclassement: date,
                    montant: (0, creances_douteuses_1.centimes)(dto.montant),
                    motif: dto.motif.trim(),
                    pieces: pieces,
                    ecritureReclassementId: ecriture.id,
                    methodeCotisationsReclassement: methodeFigee(referentiel, methodeCotisations ?? null),
                    createdBy: userId,
                },
            });
            for (const f of factures) {
                await tx.factureCreanceDouteuse.create({
                    data: { tenantId, creanceId: creee.id, ligneEcritureId: f.ligneEcritureId, montant: f.montant, createdBy: userId },
                });
            }
            return creee;
        });
        return { ...ligne, montant: n(ligne.montant), avertissement: (0, creances_douteuses_1.avertissementMethodeCotisations)(referentiel, source.numero, methodeCotisations ?? null) };
    }
    designerFactures(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'DÉSIGNATION DES FACTURES', async () => {
            const c = await this.creance(tenantId, id);
            await this.refuserSiRecuperee(tenantId, c.id, 'désigner une facture');
            const factures = await this.facturesADesigner(tenantId, { id: c.id, compteCreanceId: c.compteCreanceId, numero: c.compteCreance.numero, montant: n(c.montant) }, dto.factures);
            await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                for (const f of factures) {
                    await tx.factureCreanceDouteuse.create({
                        data: { tenantId, creanceId: c.id, ligneEcritureId: f.ligneEcritureId, montant: f.montant, createdBy: userId },
                    });
                }
            });
            return this.facturesDesignees(tenantId, c.id);
        });
    }
    async facturesDesignees(tenantId, creanceId) {
        const lignes = await this.prisma.factureCreanceDouteuse.findMany({
            where: { tenantId, creanceId },
            orderBy: { createdAt: 'asc' },
            take: 200,
            select: {
                id: true,
                montant: true,
                ligneEcritureId: true,
                retireeLe: true,
                motifRetrait: true,
                ligneEcriture: { select: { debit: true, credit: true, ecriture: { select: { date: true, libelle: true, numeroPiece: true } } } },
            },
        });
        return lignes.map((f) => ({
            id: f.id,
            retireeLe: f.retireeLe ? jour(f.retireeLe) : null,
            motifRetrait: f.motifRetrait,
            ligneEcritureId: f.ligneEcritureId,
            montant: n(f.montant),
            date: jour(f.ligneEcriture.ecriture.date),
            libelle: f.ligneEcriture.ecriture.libelle,
            numeroPiece: f.ligneEcriture.ecriture.numeroPiece,
            montantFacture: n(f.ligneEcriture.debit) - n(f.ligneEcriture.credit),
        }));
    }
    async facturesCandidates(tenantId, id) {
        const c = await this.prisma.creanceDouteuse.findFirst({ where: { id, tenantId }, select: { compteCreanceId: true, annuleeLe: true } });
        if (!c)
            throw new common_1.NotFoundException('Créance douteuse introuvable pour ce dossier.');
        if (c.annuleeLe)
            return { tronque: false, annulee: true, factures: [] };
        const PLAFOND = 200;
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: { compteId: c.compteCreanceId, debit: { gt: 0 }, ecriture: { tenantId, statut: client_1.StatutEcriture.VALIDEE } },
            orderBy: [{ ecriture: { date: 'desc' } }, { id: 'asc' }],
            take: PLAFOND + 1,
            select: {
                id: true,
                debit: true,
                credit: true,
                lettrage: { select: { statut: true, solde: true, lignes: { select: { debit: true, credit: true }, take: 500 } } },
                ecriture: { select: { date: true, libelle: true, numeroPiece: true, estGenereeParCloture: true, estANouveauProvisoire: true } },
                creancesDouteusesDesignees: { where: { retireeLe: null, creance: { annuleeLe: null } }, select: { creanceId: true }, take: 20 },
            },
        });
        const tronque = lignes.length > PLAFOND;
        return {
            tronque,
            annulee: false,
            factures: lignes.slice(0, PLAFOND).map((l) => ({
                ligneEcritureId: l.id,
                date: jour(l.ecriture.date),
                libelle: l.ecriture.libelle,
                numeroPiece: l.ecriture.numeroPiece,
                montant: n(l.debit) - n(l.credit),
                ouvert: CreancesDouteusesService_1.ouvertDeLaLigne(l),
                aNouveau: l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire,
                lettragePartage: (0, creances_douteuses_1.partageSonLettrage)(l),
                designeePar: l.creancesDouteusesDesignees.map((d) => d.creanceId),
            })),
        };
    }
    static ouvertDeLaLigne(l) {
        const montant = Number(l.debit) - Number(l.credit);
        if (!l.lettrage)
            return montant;
        if (l.lettrage.statut === 'SOLDE')
            return 0;
        return Math.min(montant, Math.abs(Number(l.lettrage.solde)));
    }
    retirerDesignation(tenantId, userId, id, designationId, dto) {
        return this.sousVerrou(tenantId, 'RETRAIT DE DÉSIGNATION', async () => {
            const d = await this.prisma.factureCreanceDouteuse.findFirst({
                where: { id: designationId, creanceId: id, tenantId },
                select: { id: true, retireeLe: true },
            });
            if (!d)
                throw new common_1.NotFoundException('Désignation introuvable pour cette créance.');
            if (d.retireeLe)
                throw new common_1.BadRequestException(`Cette désignation est déjà retirée, le ${jour(d.retireeLe)}.`);
            await this.refuserSiRecuperee(tenantId, id, 'retirer une désignation');
            await this.prisma.factureCreanceDouteuse.update({
                where: { id: d.id },
                data: { retireeLe: new Date(), retireePar: userId, motifRetrait: dto.motif.trim() },
            });
            return this.facturesDesignees(tenantId, id);
        });
    }
    async facturesADesigner(tenantId, c, factures) {
        const ids = factures.map((f) => f.ligneEcritureId);
        if (new Set(ids).size !== ids.length)
            throw new common_1.BadRequestException('Une même facture est désignée deux fois.');
        const [lignes, dejaCreance] = await Promise.all([
            this.prisma.ligneEcriture.findMany({
                where: { id: { in: ids }, ecriture: { tenantId } },
                take: ids.length,
                select: {
                    id: true,
                    compteId: true,
                    debit: true,
                    credit: true,
                    lettrage: { select: { statut: true, solde: true, lignes: { select: { debit: true, credit: true }, take: 500 } } },
                    ecriture: { select: { statut: true, libelle: true, date: true, estGenereeParCloture: true, estANouveauProvisoire: true } },
                    creancesDouteusesDesignees: { where: { retireeLe: null, creance: { annuleeLe: null } }, select: { creanceId: true }, take: 20 },
                },
            }),
            c.id
                ? this.prisma.factureCreanceDouteuse.aggregate({ where: { tenantId, creanceId: c.id, retireeLe: null }, _sum: { montant: true } })
                : Promise.resolve({ _sum: { montant: null } }),
        ]);
        let total = n(dejaCreance._sum.montant);
        const rendu = [];
        for (const f of factures) {
            const l = lignes.find((x) => x.id === f.ligneEcritureId);
            if (!l)
                throw new common_1.BadRequestException('Une facture désignée est introuvable pour ce dossier.');
            const montant = (0, creances_douteuses_1.centimes)(f.montant);
            total = (0, creances_douteuses_1.centimes)(total + montant);
            const motif = (0, creances_douteuses_1.motifRefusDesignation)({
                creanceAnnulee: false,
                memeCompte: l.compteId === c.compteCreanceId,
                validee: l.ecriture.statut === client_1.StatutEcriture.VALIDEE,
                sensFacture: n(l.debit) - n(l.credit),
                montant,
                ouvert: CreancesDouteusesService_1.ouvertDeLaLigne(l),
                designeeAilleurs: l.creancesDouteusesDesignees.some((d) => d.creanceId !== c.id),
                dejaDesignee: c.id !== null && l.creancesDouteusesDesignees.some((d) => d.creanceId === c.id),
                aNouveau: l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire,
                lettragePartage: (0, creances_douteuses_1.partageSonLettrage)(l),
                totalDesigne: total,
                montantCreance: c.montant,
                numeroCompte: c.numero,
            });
            if (motif)
                throw new common_1.BadRequestException(`Facture « ${l.ecriture.libelle} » du ${jour(l.ecriture.date)} · ${motif}`);
            rendu.push({ ligneEcritureId: l.id, montant });
        }
        return rendu;
    }
    declarer(tenantId, userId, dto) {
        return this.sousVerrou(tenantId, 'DECLARATION', () => this.declarerSousVerrou(tenantId, userId, dto));
    }
    async declarerSousVerrou(tenantId, userId, dto) {
        const [{ referentiel, methodeCotisations }, ex, source, c416] = await Promise.all([
            this.regime(tenantId),
            this.exercice(tenantId, dto.exerciceId),
            this.compteParId(tenantId, dto.compteCreanceId),
            this.compteParId(tenantId, dto.compte416Id),
        ]);
        const c491 = await this.compte491Choisi(tenantId, dto.nature, dto.compte491Id);
        const date = ex.dateDebut;
        const { ids } = await this.chaine(tenantId, ex);
        const [ouverture, dejaPorte, positions] = await Promise.all([
            this.soldesALOuverture(tenantId, ex, c416.id, c491.id),
            this.dejaPorteALOuverture(tenantId, ex.dateDebut, c416.id, c491.id),
            this.positionsEnDevise(tenantId, [source.id, c416.id], ids, ex.dateDebut),
        ]);
        const enDevise = positions.some((p) => p.ouverte && p.compteId === source.id);
        const enDevise416 = (0, creances_douteuses_1.centimes)(positions.filter((p) => p.ouverte && p.compteId === c416.id).reduce((t, p) => t + p.francs, 0));
        let motif = (0, creances_douteuses_1.motifRefusDeclaration)({
            referentiel,
            nature: dto.nature,
            numeroSource: source.numero,
            numero416: c416.numero,
            numero416EstDetail: c416.typeCompte === client_1.TypeCompteDetailTotal.DETAIL,
            montant: dto.montant,
            depreciation: dto.depreciationOuverture,
            source: dto.source,
            dateDebutExercice: true,
            exerciceOuvert: ex.statut === client_1.StatutExercice.OUVERT,
            aNouveau: ouverture.existe,
            aNouveau416: ouverture.solde416,
            dejaDeclare416: dejaPorte.sur416,
            aNouveau491: ouverture.solde491,
            dejaDeclare491: dejaPorte.sur491,
            sourceEstDetail: source.typeCompte === client_1.TypeCompteDetailTotal.DETAIL,
            comptesEnSommeil: [source, c416, c491].filter((k) => 'estActif' in k && k.estActif === false).map((k) => k.numero),
            positionEnDevise: enDevise,
            enDevise416,
            methodeCotisations: methodeCotisations ?? null,
        });
        if (motif && ouverture.reconstitue && motif.includes('dépasse')) {
            motif += await this.motifSoldeReconstitue(tenantId, ex.id, 'reprenez la déclaration');
        }
        if (motif)
            throw new common_1.BadRequestException(motif);
        const ligne = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => tx.creanceDouteuse.create({
            data: {
                tenantId,
                exerciceId: ex.id,
                nature: dto.nature,
                compteCreanceId: source.id,
                compte416Id: c416.id,
                compte491Id: c491.id,
                dateReclassement: date,
                montant: (0, creances_douteuses_1.centimes)(dto.montant),
                motif: (dto.motif ?? '').trim() || `Déclarée à l'ouverture · ${dto.source.trim()}`,
                pieces: this.pieces(dto.pieces),
                declareeOuverture: true,
                sourceDeclaration: dto.source.trim(),
                depreciationOuverture: (0, creances_douteuses_1.centimes)(dto.depreciationOuverture),
                methodeCotisationsReclassement: methodeFigee(referentiel, methodeCotisations ?? null),
                createdBy: userId,
            },
        }));
        return {
            ...ligne,
            montant: n(ligne.montant),
            depreciationOuverture: n(ligne.depreciationOuverture),
            borneProvisoire: ouverture.reconstitue,
            ...(ouverture.reconstitue ? { information: creances_douteuses_1.INFORMATION_BORNE_RECONSTITUEE } : {}),
            avertissement: (0, creances_douteuses_1.avertissementMethodeCotisations)(referentiel, source.numero, methodeCotisations ?? null),
        };
    }
    async positionEnDeviseOuverte(tenantId, comptes, ids, au) {
        return (await this.positionsEnDevise(tenantId, comptes, ids, au)).some((p) => p.ouverte);
    }
    async positionsEnDevise(tenantId, comptes, ids, au) {
        const date = au ? { date: { lte: au } } : {};
        const lire = (sens) => this.prisma.ligneEcriture.groupBy({
            by: ['compteId', 'deviseId'],
            where: {
                compteId: { in: comptes },
                deviseId: { not: null },
                OR: sens,
                ecriture: { tenantId, exerciceId: { in: ids }, ...date, ...HORS_REPORT_PROVISOIRE },
            },
            _sum: { montantDevise: true, debit: true, credit: true },
        });
        const [debits, credits] = await Promise.all([
            lire([{ debit: { gt: 0 } }, { credit: { lt: 0 } }]),
            lire([{ credit: { gt: 0 } }, { debit: { lt: 0 } }]),
        ]);
        const parCle = new Map();
        const cumuler = (g, signe) => {
            const cle = `${g.compteId}|${g.deviseId}`;
            const p = parCle.get(cle) ?? { compteId: g.compteId, deviseId: g.deviseId, devise: 0, francs: 0 };
            p.devise += signe * n(g._sum.montantDevise);
            p.francs += n(g._sum.debit) - n(g._sum.credit);
            parCle.set(cle, p);
        };
        for (const g of debits)
            cumuler(g, 1);
        for (const g of credits)
            cumuler(g, -1);
        return [...parCle.values()].map((p) => ({ compteId: p.compteId, deviseId: p.deviseId, ouverte: Math.abs(p.devise) >= 0.005, francs: (0, creances_douteuses_1.centimes)(p.francs) }));
    }
    async soldesALOuverture(tenantId, ex, compte416Id, compte491Id) {
        if (await this.aUnANouveau(tenantId, ex.id)) {
            const aNouveau = { tenantId, exerciceId: ex.id, ...A_NOUVEAU };
            const [an416, an491] = await Promise.all([
                this.prisma.ligneEcriture.aggregate({ where: { compteId: compte416Id, ecriture: aNouveau }, _sum: { debit: true, credit: true } }),
                this.prisma.ligneEcriture.aggregate({ where: { compteId: compte491Id, ecriture: aNouveau }, _sum: { debit: true, credit: true } }),
            ]);
            return {
                existe: true,
                reconstitue: false,
                solde416: (0, creances_douteuses_1.centimes)(n(an416._sum.debit) - n(an416._sum.credit)),
                solde491: (0, creances_douteuses_1.centimes)(n(an491._sum.credit) - n(an491._sum.debit)),
            };
        }
        const precedent = await this.prisma.exercice.findFirst({
            where: { tenantId, dateFin: { lt: ex.dateDebut } },
            orderBy: { dateFin: 'desc' },
            select: { id: true, dateDebut: true },
        });
        if (!precedent)
            return { existe: false, reconstitue: false, solde416: 0, solde491: 0 };
        const { ids } = await this.chaine(tenantId, precedent);
        const veille = new Date(ex.dateDebut.getTime() - 24 * 60 * 60 * 1000);
        const [s416, s491] = await Promise.all([
            this.solde(tenantId, { id: compte416Id }, ids, veille),
            this.solde(tenantId, { id: compte491Id }, ids, veille),
        ]);
        return { existe: true, reconstitue: true, solde416: s416, solde491: (0, creances_douteuses_1.centimes)(-s491) };
    }
    async dejaPorteALOuverture(tenantId, ouverture, compte416Id, compte491Id) {
        const veille = new Date(ouverture.getTime() - 24 * 60 * 60 * 1000);
        let sur416 = 0;
        let sur491 = 0;
        await (0, lecture_par_lots_1.lireParLots)((curseur) => this.prisma.creanceDouteuse.findMany({
            where: {
                tenantId,
                annuleeLe: null,
                ...(0, creances_douteuses_1.nonCorrigeeAu)(veille),
                AND: [
                    { OR: [{ compte416Id }, { compte491Id }] },
                    {
                        OR: [
                            { declareeOuverture: true, dateReclassement: { lte: ouverture } },
                            { declareeOuverture: false, dateReclassement: { lt: ouverture } },
                        ],
                    },
                ],
            },
            include: INCLURE_CREANCE,
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
        }), (c) => {
            const aLOuverture = c.declareeOuverture && c.dateReclassement.getTime() === ouverture.getTime();
            if (c.compte416Id === compte416Id) {
                sur416 += aLOuverture ? n(c.montant) : this.reste(c, veille);
            }
            if (c.compte491Id === compte491Id)
                sur491 += this.enPlace(c, ouverture);
        }, lecture_par_lots_1.LOT_ECRITURES);
        return { sur416: (0, creances_douteuses_1.centimes)(sur416), sur491: (0, creances_douteuses_1.centimes)(sur491) };
    }
    async entreeRevue(tenantId, id, exerciceId) {
        const [c, ex, regime] = await Promise.all([this.creance(tenantId, id), this.exercice(tenantId, exerciceId), this.regime(tenantId)]);
        const methode = await this.methodeDeLaCreance(tenantId, c, regime.referentiel, regime.methodeCotisations ?? null);
        const enPlace = this.enPlace(c, ex.dateDebut);
        const reste = this.reste(c, ex.dateFin);
        const resteNegatif = (0, creances_douteuses_1.motifResteNegatif)(`${c.compteCreance.numero} ${c.compteCreance.intitule}`, Math.min(reste, this.resteFinal(c)));
        const posterieure = c.ajustements.find((a) => a.exercice.dateDebut.getTime() > ex.dateFin.getTime()) ?? null;
        const anterieurs = await this.prisma.exercice.findMany({
            where: { tenantId, statut: client_1.StatutExercice.OUVERT, dateFin: { gte: c.dateReclassement, lt: ex.dateDebut } },
            select: { id: true, dateDebut: true, dateFin: true },
            orderBy: { dateDebut: 'asc' },
            take: 20,
        });
        const revus = new Set(c.ajustements.map((a) => a.exerciceId));
        return {
            c,
            ex,
            enPlace,
            reste,
            resteNegatif,
            posterieure,
            anterieursSansRevue: anterieurs.filter((e) => !revus.has(e.id)).map((e) => `l'exercice clos le ${jour(e.dateFin)}`),
            refusSmt: (0, systeme_minimal_1.motifRefusDepreciationSmt)(regime),
            refusImpaye: (0, creances_douteuses_1.motifRefusDotationImpayeAdherent)(regime.referentiel, c.compteCreance.numero, methode.methode),
            avertissementMethode: methode.avertissement,
        };
    }
    revoir(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'REVUE', () => this.revoirSousVerrou(tenantId, userId, id, dto));
    }
    async revoirSousVerrou(tenantId, userId, id, dto) {
        const e = await this.entreeRevue(tenantId, id, dto.exerciceId);
        const journal = await this.journal(tenantId, dto.journalId);
        const pieces = this.pieces(dto.pieces);
        if (e.c.ajustements.some((a) => a.exerciceId === e.ex.id)) {
            throw new common_1.ConflictException('La dépréciation de cette créance est déjà revue pour cet exercice · annulez la revue pour la refaire.');
        }
        const motif = (0, creances_douteuses_1.motifRefusRevue)({
            necessaire: dto.depreciationNecessaire,
            enPlace: e.enPlace,
            reste: e.reste,
            resteNegatif: e.resteNegatif,
            motif: dto.motif,
            pieces,
            exerciceOuvert: e.ex.statut === client_1.StatutExercice.OUVERT,
            avantReclassement: e.ex.dateFin.getTime() < e.c.dateReclassement.getTime(),
            revuePosterieure: e.posterieure ? jour(e.posterieure.date) : null,
            anterieursSansRevue: e.anterieursSansRevue,
            refusSmt: e.refusSmt,
            refusImpaye: e.refusImpaye,
            journalGeneral: journal.type === client_1.TypeJournal.GENERAL,
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        const ecart = (0, creances_douteuses_1.ecartDeDepreciation)(e.enPlace, dto.depreciationNecessaire);
        let ecritureId = null;
        if (Math.abs(ecart) >= 0.005) {
            const autre = await this.compteDetail(tenantId, ecart > 0 ? creances_douteuses_1.COMPTES_CREANCES_DOUTEUSES.dotation : creances_douteuses_1.COMPTES_CREANCES_DOUTEUSES.reprise);
            const montant = Math.abs(ecart);
            const ecriture = await this.ecritures.creer(tenantId, userId, {
                exerciceId: e.ex.id,
                journalId: journal.id,
                date: jour(e.ex.dateFin),
                libelle: `${ecart > 0 ? 'Dépréciation' : 'Reprise de dépréciation'} · créance ${e.c.compteCreance.numero} ${e.c.compteCreance.intitule}`.slice(0, 190),
                lignes: ecart > 0
                    ? [
                        { compteId: autre.id, debit: montant, credit: 0 },
                        { compteId: e.c.compte491.id, debit: 0, credit: montant },
                    ]
                    : [
                        { compteId: e.c.compte491.id, debit: montant, credit: 0 },
                        { compteId: autre.id, debit: 0, credit: montant },
                    ],
            });
            ecritureId = ecriture.id;
        }
        try {
            const ligne = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => tx.ajustementCreanceDouteuse.create({
                data: {
                    tenantId,
                    creanceId: e.c.id,
                    exerciceId: e.ex.id,
                    date: new Date(jour(e.ex.dateFin)),
                    depreciationNecessaire: (0, creances_douteuses_1.centimes)(dto.depreciationNecessaire),
                    depreciationEnPlace: e.enPlace,
                    ecart,
                    motif: dto.motif.trim(),
                    pieces: pieces,
                    ecritureId,
                    createdBy: userId,
                },
            }));
            return {
                ...ligne,
                depreciationNecessaire: n(ligne.depreciationNecessaire),
                depreciationEnPlace: n(ligne.depreciationEnPlace),
                ecart: n(ligne.ecart),
                avertissement: e.avertissementMethode,
            };
        }
        catch (err) {
            if (ecritureId)
                await this.compenser(tenantId, ecritureId);
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('La dépréciation de cette créance est déjà revue pour cet exercice.');
            }
            throw err;
        }
    }
    async propositionRevue(tenantId, id, exerciceId) {
        const e = await this.entreeRevue(tenantId, id, exerciceId);
        return {
            depreciationEnPlace: e.enPlace,
            resteALaCloture: e.reste,
            dateRevue: jour(e.ex.dateFin),
            comptes: {
                compte491: e.c.compte491.numero,
                dotation: creances_douteuses_1.COMPTES_CREANCES_DOUTEUSES.dotation,
                reprise: creances_douteuses_1.COMPTES_CREANCES_DOUTEUSES.reprise,
            },
            resteNegatif: e.resteNegatif,
            dejaRevue: e.c.ajustements.some((a) => a.exerciceId === e.ex.id),
            revuePosterieure: e.posterieure ? jour(e.posterieure.date) : null,
            anterieursSansRevue: e.anterieursSansRevue,
            dotationRefuseeSmt: e.refusSmt,
            dotationRefuseeImpaye: e.refusImpaye,
            avertissementMethode: e.avertissementMethode,
        };
    }
    annulerRevue(tenantId, userId, id, revueId, dto) {
        return this.sousVerrou(tenantId, 'ANNULATION DE REVUE', () => this.annulerRevueSousVerrou(tenantId, userId, id, revueId, dto.motif));
    }
    async annulerRevueSousVerrou(tenantId, userId, id, revueId, motifSaisi) {
        const revue = await this.prisma.ajustementCreanceDouteuse.findFirst({
            where: { id: revueId, creanceId: id, tenantId },
            include: {
                exercice: { select: { statut: true, dateFin: true } },
                ecriture: {
                    select: { id: true, statut: true, numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
                },
            },
        });
        if (!revue)
            throw new common_1.NotFoundException('Revue introuvable pour cette créance.');
        await this.refuserSiCorrigee(tenantId, id);
        const posterieure = await this.prisma.ajustementCreanceDouteuse.findFirst({
            where: { tenantId, creanceId: id, annuleeLe: null, date: { gt: revue.date } },
            orderBy: { date: 'asc' },
            select: { date: true },
        });
        const refus = (0, creances_douteuses_1.motifRefusAnnulationRevue)({
            dejaAnnulee: revue.annuleeLe ? jour(revue.annuleeLe) : null,
            exerciceClos: revue.exercice.statut === client_1.StatutExercice.CLOTURE,
            posterieureNonAnnulee: posterieure ? jour(posterieure.date) : null,
            motif: motifSaisi,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const motif = motifSaisi.trim();
        const objet = `l'écriture de la revue n° ${revue.ecriture?.numeroPiece ?? '·'}`;
        if (revue.ecriture) {
            const tenues = (0, lignes_tenues_1.motifLignesTenues)(revue.ecriture.lignes, objet, 'annuler', ', puis annulez la revue');
            if (tenues)
                throw new common_1.BadRequestException(tenues);
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const e = revue.ecriture;
            let annulation = { traitement: 'SANS_ECRITURE' };
            if (e) {
                const relues = await tx.ligneEcriture.findMany({
                    where: { ecritureId: e.id, ecriture: { tenantId } },
                    select: { lettre: true, lettrageId: true, rapprochementId: true },
                });
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(relues, objet, 'annuler', ', puis annulez la revue');
                if (tenues)
                    throw new common_1.BadRequestException(tenues);
                if ((await this.statutDansTx(tx, tenantId, e.id)) === client_1.StatutEcriture.BROUILLARD) {
                    annulation = { traitement: 'SUPPRIMEE', ecritureId: e.id, numeroPiece: e.numeroPiece };
                }
                else {
                    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
                    annulation = { traitement: 'INSCRITE_EN_NEGATIF', ecritureId: e.id, numeroPiece: e.numeroPiece, negatifId: negatif.id, negatifNumeroPiece: negatif.numeroPiece };
                }
            }
            try {
                await tx.ajustementCreanceDouteuse.update({
                    where: { id: revue.id, tenantId, annuleeLe: null },
                    data: {
                        annuleeLe: new Date(),
                        annuleePar: userId,
                        motifAnnulation: motif,
                        annulation: annulation,
                        ...(annulation.traitement === 'SUPPRIMEE' ? { ecritureId: null } : {}),
                    },
                });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException('Cette revue est déjà annulée.');
                }
                throw err;
            }
            if (e && annulation.traitement === 'SUPPRIMEE') {
                await this.supprimerBrouillardDansTx(tx, tenantId, e.id);
            }
            return { annulee: true, annulation };
        });
    }
    async mouvement(tenantId, userId, id, type, dto) {
        const [c, ex, journal, { referentiel, methodeCotisations }] = await Promise.all([
            this.creance(tenantId, id),
            this.exercice(tenantId, dto.exerciceId),
            this.journal(tenantId, dto.journalId),
            this.regime(tenantId),
        ]);
        const date = new Date(dto.date.slice(0, 10));
        const pieces = this.pieces(dto.pieces);
        const reste = this.reste(c, date);
        const revueApres = c.ajustements.find((a) => a.exercice.dateFin.getTime() >= date.getTime()) ?? null;
        const methode = type === client_1.TypeMouvementCreanceDouteuse.PERTE
            ? await this.methodeDeLaCreance(tenantId, c, referentiel, methodeCotisations ?? null)
            : { methode: undefined, avertissement: null };
        let comptePerte = null;
        if (type === client_1.TypeMouvementCreanceDouteuse.PERTE) {
            const choisi = dto.comptePerteId;
            if (choisi) {
                const k = await this.compteParId(tenantId, choisi);
                comptePerte = { id: k.id, numero: k.numero, estDetail: k.typeCompte === client_1.TypeCompteDetailTotal.DETAIL };
            }
            else {
                const propose = (0, creances_douteuses_1.comptePertePropose)(referentiel, c.compteCreance.numero);
                if (propose) {
                    const k = await this.compteDetail(tenantId, propose);
                    comptePerte = { id: k.id, numero: k.numero, estDetail: true };
                }
            }
        }
        const journalAttendu = type === client_1.TypeMouvementCreanceDouteuse.RECOUVREMENT
            ? journal.type === client_1.TypeJournal.TRESORERIE && !!journal.compteTresorerieId
            : journal.type === client_1.TypeJournal.GENERAL;
        const motif = (0, creances_douteuses_1.motifRefusMouvement)({
            type,
            montant: dto.montant,
            reste,
            resteFinal: this.resteFinal(c),
            motif: dto.motif,
            pieces,
            exerciceOuvert: ex.statut === client_1.StatutExercice.OUVERT,
            dateDansExercice: date >= ex.dateDebut && date <= ex.dateFin,
            avantReclassement: date.getTime() < c.dateReclassement.getTime(),
            revueApres: revueApres ? jour(revueApres.date) : null,
            journalAttendu,
            numeroPerte: comptePerte?.numero ?? null,
            numeroPerteEstDetail: comptePerte?.estDetail ?? false,
            referentiel,
            numeroSource: c.compteCreance.numero,
            methodeCotisations: methode.methode,
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        const montant = (0, creances_douteuses_1.centimes)(dto.montant);
        const duplicatas = type === client_1.TypeMouvementCreanceDouteuse.PERTE ? (dto.duplicatas ?? []) : [];
        if (duplicatas.length > 0) {
            return this.perteAvecTva(tenantId, userId, c, ex, journal, comptePerte, date, montant, dto, pieces, methode.avertissement);
        }
        let informationTva = null;
        if (type === client_1.TypeMouvementCreanceDouteuse.PERTE) {
            try {
                const l = await this.lireRecuperation(tenantId, c);
                if (l.chiffrees.some((f) => !l.dejaRecuperees.has(f.designationId) && f.tvaRecuperable > 0.005))
                    informationTva = recuperation_tva_1.MESSAGE_TVA_PAR_LA_REGLE_3;
            }
            catch (err) {
                this.journalServeur.error(`Taxe des factures de la créance non lue (dossier ${tenantId})`, err instanceof Error ? err.stack : String(err));
                informationTva = 'La taxe récupérable des factures désignées n’a pas pu être lue · non calculée. « Récupérer la TVA » la chiffrera.';
            }
        }
        const debit = type === client_1.TypeMouvementCreanceDouteuse.PERTE ? comptePerte.id : journal.compteTresorerieId;
        const lignes = [
            { compteId: debit, debit: montant, credit: 0 },
            { compteId: c.compte416.id, debit: 0, credit: montant },
        ];
        const ecriture = await this.ecritures.creer(tenantId, userId, {
            exerciceId: ex.id,
            journalId: journal.id,
            date: jour(date),
            libelle: `${type === client_1.TypeMouvementCreanceDouteuse.PERTE ? 'Perte sur créance irrécouvrable' : 'Recouvrement de créance douteuse'} · ${c.compteCreance.numero} ${c.compteCreance.intitule}`.slice(0, 190),
            lignes,
        });
        let ligne;
        try {
            ligne = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => tx.mouvementCreanceDouteuse.create({
                data: {
                    tenantId,
                    creanceId: c.id,
                    exerciceId: ex.id,
                    type,
                    date,
                    montant,
                    motif: dto.motif.trim(),
                    pieces: pieces,
                    ecritureId: ecriture.id,
                    createdBy: userId,
                },
            }));
        }
        catch (err) {
            await this.compenser(tenantId, ecriture.id);
            throw err;
        }
        const lettrage416 = await this.lettrerSiEteinteSansEchec(tenantId, userId, c.id);
        return { ...ligne, montant: n(ligne.montant), lettrage416, avertissement: methode.avertissement, information: informationTva };
    }
    async perteAvecTva(tenantId, userId, c, ex, journal, comptePerte, date, montant, dto, pieces, avertissement) {
        const l = await this.lireRecuperation(tenantId, c);
        const refus = (0, recuperation_tva_1.motifRefusPerteAvecTva)({
            montant,
            resteFinal: this.resteFinal(c),
            pertesAnterieures: c.mouvements.filter((m) => m.type === client_1.TypeMouvementCreanceDouteuse.PERTE).length,
            chiffrees: l.chiffrees,
            dejaRecuperees: l.dejaRecuperees,
            duplicatas: dto.duplicatas ?? [],
            date,
            finDerniereLiquidation: l.finDerniereLiquidation,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const choisies = (dto.duplicatas ?? []).map((d) => {
            const f = l.chiffrees.find((x) => x.designationId === d.designationId);
            return { ...f, duplicata: { reference: d.reference.trim(), dateEnvoi: d.dateEnvoi.slice(0, 10) } };
        });
        const declaree = await this.taxeEncaissementDeclaree(tenantId, choisies, l);
        if (declaree)
            throw new common_1.BadRequestException(declaree);
        const v = (0, recuperation_tva_1.ventilerPerte)(choisies);
        const ht = (0, creances_douteuses_1.centimes)(montant - v.tva - v.tvaAnnulee);
        const libelle = `${c.compteCreance.numero} ${c.compteCreance.intitule}`;
        const references = choisies.map((f) => f.duplicata.reference).join(' ; ');
        const { suite } = await this.ecritures.creerPlusieursAvec(tenantId, userId, [
            {
                exerciceId: ex.id,
                journalId: journal.id,
                date: jour(date),
                libelle: `Retour de la créance irrécouvrable au compte d’origine · ${libelle}`.slice(0, 190),
                lignes: [
                    { compteId: c.compteCreance.id, debit: montant, credit: 0 },
                    { compteId: c.compte416.id, debit: 0, credit: montant },
                ],
            },
            {
                exerciceId: ex.id,
                journalId: journal.id,
                date: jour(date),
                libelle: `Perte sur créance irrécouvrable, TVA récupérée (art. 52) · ${libelle}`.slice(0, 190),
                reference: references.slice(0, 100),
                lignes: [
                    ...(ht > 0.005 ? [{ compteId: comptePerte.id, debit: ht, credit: 0 }] : []),
                    ...v.recuperee.map((r) => ({ compteId: r.compteId, debit: r.tva, credit: 0, tauxTvaId: r.tauxTvaId, libelle: 'TVA récupérée sur créance irrécouvrable (art. 52)' })),
                    ...v.annulee.map((a) => ({ compteId: a.compteId, debit: a.tva, credit: 0, libelle: 'TVA à l’encaissement jamais exigible, annulée (art. 25, 2°)' })),
                    { compteId: c.compteCreance.id, debit: 0, credit: montant },
                ],
            },
        ], async (tx, [retour, perte]) => {
            const ligne = await tx.mouvementCreanceDouteuse.create({
                data: {
                    tenantId,
                    creanceId: c.id,
                    exerciceId: ex.id,
                    type: client_1.TypeMouvementCreanceDouteuse.PERTE,
                    date,
                    montant,
                    motif: dto.motif.trim(),
                    pieces: pieces,
                    ecritureId: retour.id,
                    ecriturePerteId: perte.id,
                    montantTva: v.tva,
                    montantTvaAnnulee: v.tvaAnnulee,
                    detailTva: choisies,
                    createdBy: userId,
                },
            });
            const lignesOrigine = [retour, perte].flatMap((e) => e.lignes.filter((x) => x.compteId === c.compteCreance.id).map((x) => x.id));
            const lettrage = await this.lettrage.lettrerLignesDuModuleDansTx(tx, tenantId, c.compteCreance.id, lignesOrigine, userId);
            if ('motif' in lettrage && !lettrage.nonLettrable)
                throw new common_1.BadRequestException(`${lettrage.motif} La perte n’est pas passée.`);
            return { ligne, lettrageOrigine: 'code' in lettrage ? { pose: true, code: lettrage.code } : { pose: false, motif: lettrage.motif } };
        });
        const { ligne, lettrageOrigine } = suite;
        const lettrage416 = await this.lettrerSiEteinteSansEchec(tenantId, userId, c.id);
        const information = [
            v.tva > 0.005
                ? `Taxe acquittée de ${v.tva.toFixed(2)} récupérée · inscrite en déduction de la déclaration de la période qui suit (décret n° 011/42, art. 126), une fois la perte validée.`
                : null,
            v.tvaAnnulee > 0.005
                ? `Taxe à l’encaissement de ${v.tvaAnnulee.toFixed(2)} jamais exigible sur l’impayé (O.-L. n° 10/001, art. 25, 2°) · annulée au 443, rien d’acquitté, rien à récupérer (art. 52, al. 1).`
                : null,
            references.length > 100 ? 'Les références des duplicatas dépassent 100 caractères · la pièce en porte le début, le détail du mouvement les garde toutes.' : null,
        ]
            .filter(Boolean)
            .join(' ');
        return {
            ...ligne,
            montant: n(ligne.montant),
            montantTva: n(ligne.montantTva),
            montantTvaAnnulee: n(ligne.montantTvaAnnulee),
            montantHt: ht,
            lettrage416,
            lettrageOrigine,
            avertissement,
            information,
        };
    }
    async taxeEncaissementDeclaree(tenantId, choisies, l) {
        const visees = choisies.filter((f) => f.tvaAnnulable > 0.005);
        if (visees.length === 0)
            return null;
        const issue = 'Passez la perte sans duplicata (au TTC entier) · la taxe acquittée à la facture se récupère ensuite par « Récupérer la ' +
            'TVA » (D 443 / C 751) ; la taxe à l’encaissement déjà déclarée n’est pas reconstituée par OmegaX · vérifiez la ' +
            'déclaration déposée et portez sa récupération vous-même (O.-L. n° 10/001, art. 52).';
        if (l.ancienMoteur) {
            return (`La facture « ${visees[0].libelle} » porte une taxe à l’encaissement, et une liquidation de TVA passée sous l’ancien moteur ` +
                '(avant la ligne A7 bis) a pu la déclarer à la facture · l’annuler au 443 sans déduction laisserait le 443 débiteur et la ' +
                `taxe acquittée jamais récupérée. ${issue}`);
        }
        const parLigne = new Map();
        for (const f of visees) {
            for (const x of l.lignesEncaissement.get(f.designationId) ?? []) {
                const v = parLigne.get(x.ligneId) ?? { tva: x.tva, annulee: 0, libelle: f.libelle };
                v.annulee = (0, creances_douteuses_1.centimes)(v.annulee + (x.ttc > 0.005 ? (f.impayeTtc * x.tva) / x.ttc : 0));
                parLigne.set(x.ligneId, v);
            }
        }
        if (parLigne.size === 0)
            return null;
        const figees = await this.prisma.liquidationTva.findMany({
            where: { tenantId, NOT: { tvaEncaissementFigee: { equals: client_1.Prisma.AnyNull } } },
            select: { dateDebut: true, dateFin: true, tvaEncaissementFigee: true },
            orderBy: { dateDebut: 'asc' },
            take: 600,
        });
        for (const [ligne, v] of parLigne) {
            let declare = 0;
            let premiere = null;
            for (const liq of figees) {
                const fige = Number((liq.tvaEncaissementFigee ?? {})[ligne] ?? 0);
                if (fige <= 0.005)
                    continue;
                declare = (0, creances_douteuses_1.centimes)(declare + fige);
                premiere ??= liq;
            }
            if (!premiere || declare + v.annulee <= v.tva + 0.01)
                continue;
            return (`La liquidation de TVA du ${jour(premiere.dateDebut)} au ${jour(premiere.dateFin)} a déclaré ${declare.toFixed(2)} de la taxe à ` +
                `l’encaissement de la facture « ${v.libelle} » (au titre d’un règlement lettré avec elle, même délettré depuis), et la perte en ` +
                `annulerait ${v.annulee.toFixed(2)} sur ${v.tva.toFixed(2)} · une part déjà déclarée n’est pas « jamais exigible », et l’annuler au ` +
                `443 le laisserait débiteur. ${issue}`);
        }
        return null;
    }
    async lettrerSiEteinte(tenantId, userId, creanceId) {
        const c = await this.creance(tenantId, creanceId);
        if (Math.abs(this.resteFinal(c)) >= 0.005)
            return null;
        if (c.mouvements.some((m) => !m.ecritureId)) {
            return { pose: false, motif: "Créance éteinte · un de ses mouvements n'a plus d'écriture, rien n'est lettré." };
        }
        const exerciceId = c.mouvements.at(-1)?.exerciceId ?? c.exerciceId;
        const lues = await this.lignesOuvertesDeLaCreance(tenantId, c, exerciceId);
        if ('motif' in lues)
            return { pose: false, motif: lues.motif };
        if (lues.ouvertes.length === 0)
            return { pose: false, motif: `Créance éteinte · ses lignes du ${c.compte416.numero} sont déjà lettrées.` };
        const somme = lues.ouvertes.reduce((t, l) => t + l.net, 0);
        if (lues.ouvertes.length < 2 || Math.abs(somme) >= 0.005) {
            return { pose: false, aDesigner: true, motif: (0, creances_douteuses_1.motifLignesANouveauADesigner)(c.compte416.numero) };
        }
        const r = await this.lettrage.lettrerLignesDuModule(tenantId, c.compte416Id, lues.ouvertes.map((l) => l.id), userId);
        return 'code' in r ? { pose: true, code: r.code } : { pose: false, motif: `Créance éteinte · ${r.motif}` };
    }
    async lignesOuvertesDeLaCreance(tenantId, c, exerciceId) {
        const ecritureIds = await this.ecrituresDeLaCreance(tenantId, c);
        if (ecritureIds.length === 0)
            return { ouvertes: [] };
        const lignes = await this.prisma.ligneEcriture.findMany({
            where: { ecritureId: { in: ecritureIds }, compteId: c.compte416Id, ecriture: { tenantId } },
            select: { id: true, ecritureId: true, lettrageId: true, debit: true, credit: true, ecriture: { select: { exerciceId: true } } },
        });
        if (lignes.length !== ecritureIds.length || new Set(lignes.map((l) => l.ecritureId)).size !== ecritureIds.length) {
            return { motif: `Créance éteinte · ses lignes du ${c.compte416.numero} ne se retrouvent pas une par écriture, rien n'est lettré.` };
        }
        return {
            ouvertes: lignes
                .filter((l) => l.lettrageId === null && l.ecriture.exerciceId === exerciceId)
                .map((l) => ({ id: l.id, net: n(l.debit) - n(l.credit) })),
        };
    }
    async propositionLettrage416(tenantId, id, exerciceId) {
        const c = await this.creance(tenantId, id);
        await this.exercice(tenantId, exerciceId);
        const lues = await this.lignesOuvertesDeLaCreance(tenantId, c, exerciceId);
        if ('motif' in lues)
            throw new common_1.BadRequestException(lues.motif);
        const luesAN = await this.prisma.ligneEcriture.findMany({
            where: { compteId: c.compte416Id, lettrageId: null, ecriture: { tenantId, exerciceId, ...A_NOUVEAU } },
            select: { id: true, debit: true, credit: true, libelle: true, ecriture: { select: { date: true, numeroPiece: true } } },
            orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
            take: exports.PLAFOND_COMPTES_416_491 + 1,
        });
        const tronque = luesAN.length > exports.PLAFOND_COMPTES_416_491;
        const aNouveaux = luesAN.slice(0, exports.PLAFOND_COMPTES_416_491);
        const reste = (0, creances_douteuses_1.centimes)(-lues.ouvertes.reduce((t, l) => t + l.net, 0));
        const seules = aNouveaux.filter((l) => Math.abs((0, creances_douteuses_1.centimes)(n(l.debit) - n(l.credit)) - reste) < 0.005);
        return {
            eteinte: Math.abs(this.resteFinal(c)) < 0.005,
            compte416: c.compte416.numero,
            ouvertes: lues.ouvertes.length,
            aApporter: reste,
            aNouveaux: aNouveaux.map((l) => ({
                id: l.id,
                date: jour(l.ecriture.date),
                numeroPiece: l.ecriture.numeroPiece,
                libelle: l.libelle,
                montant: (0, creances_douteuses_1.centimes)(n(l.debit) - n(l.credit)),
            })),
            tronque,
            propose: seules.length === 1 ? [seules[0].id] : [],
        };
    }
    lettrer416(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'LETTRAGE AU 416', async () => {
            const c = await this.creance(tenantId, id);
            if (Math.abs(this.resteFinal(c)) >= 0.005) {
                throw new common_1.BadRequestException(`La créance n'est pas éteinte (reste ${(0, creances_douteuses_1.centimes)(this.resteFinal(c)).toFixed(2)} au ${c.compte416.numero}) · ses lignes se lettrent quand perte et recouvrements l'ont soldée.`);
            }
            await this.exercice(tenantId, dto.exerciceId);
            const lues = await this.lignesOuvertesDeLaCreance(tenantId, c, dto.exerciceId);
            if ('motif' in lues)
                throw new common_1.BadRequestException(lues.motif);
            const designees = [...new Set(dto.ligneIds)];
            if (designees.length > 0) {
                const trouvees = await this.prisma.ligneEcriture.findMany({
                    where: { id: { in: designees }, ecriture: { tenantId } },
                    select: {
                        id: true,
                        compteId: true,
                        lettrageId: true,
                        ecriture: { select: { exerciceId: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true, estANouveauProvisoire: true } },
                    },
                });
                const refusee = designees.find((ligneId) => {
                    const l = trouvees.find((x) => x.id === ligneId);
                    return (!l ||
                        l.compteId !== c.compte416Id ||
                        l.lettrageId !== null ||
                        l.ecriture.exerciceId !== dto.exerciceId ||
                        !l.ecriture.estGenereeParCloture ||
                        l.ecriture.estSoldeDesComptesDeGestion ||
                        l.ecriture.estANouveauProvisoire);
                });
                if (refusee) {
                    throw new common_1.BadRequestException(`Une ligne désignée n'est pas une ligne d'à-nouveau ouverte du ${c.compte416.numero} dans cet exercice · seules ` +
                        "les lignes du report de la clôture précédente ou du bilan d'ouverture se désignent (jamais le report provisoire, " +
                        'remplacé à la clôture).');
                }
            }
            if (lues.ouvertes.length === 0) {
                throw new common_1.BadRequestException(`Rien à lettrer · les lignes de la créance au ${c.compte416.numero} sont déjà lettrées dans cet exercice.`);
            }
            const ligneIds = [...lues.ouvertes.map((l) => l.id), ...designees];
            if (ligneIds.length < 2) {
                throw new common_1.BadRequestException(`Une seule ligne de la créance au ${c.compte416.numero} · désignez la ligne d'à-nouveau qui la solde.`);
            }
            const r = await this.lettrage.lettrerLignesDuModule(tenantId, c.compte416Id, ligneIds, userId);
            if ('motif' in r)
                throw new common_1.BadRequestException(r.motif);
            return { pose: true, code: r.code };
        });
    }
    async ecrituresDeLaCreance(tenantId, c) {
        const mouvements = await this.prisma.mouvementCreanceDouteuse.findMany({
            where: { tenantId, creanceId: c.id, ecritureId: { not: null } },
            select: { ecritureId: true },
            orderBy: { date: 'asc' },
        });
        const origines = [c.ecritureReclassementId, ...mouvements.map((m) => m.ecritureId)].filter((x) => !!x);
        if (origines.length === 0)
            return [];
        const negatifs = await this.prisma.ecriture.findMany({
            where: { tenantId, corrigeEcritureId: { in: origines } },
            select: { id: true },
        });
        return [...new Set([...origines, ...negatifs.map((e) => e.id)])];
    }
    async lettrerSiEteinteSansEchec(tenantId, userId, creanceId) {
        try {
            return await this.lettrerSiEteinte(tenantId, userId, creanceId);
        }
        catch (err) {
            this.journalServeur.error(`Lettrage des lignes 416 de la créance ${creanceId} du dossier ${tenantId} non posé`, err instanceof Error ? err.stack : String(err));
            return {
                pose: false,
                motif: "Créance éteinte · le lettrage de ses lignes du 416 n'a pas pu se poser · relancez-le par « Lettrer au 416 » dans cette fenêtre.",
            };
        }
    }
    async groupeRetourEtPerte(tenantId, perte, retourId) {
        const lettree = perte.lignes.find((l) => l.lettrageId);
        if (!lettree?.lettrageId)
            return null;
        const groupe = await this.prisma.lettrage.findFirst({
            where: { id: lettree.lettrageId, tenantId },
            select: { id: true, code: true, origine: true },
        });
        if (!groupe || groupe.origine !== client_1.OrigineLettrage.MODULE)
            return null;
        const duGroupe = await this.prisma.ligneEcriture.findMany({
            where: { lettrageId: groupe.id, ecriture: { tenantId } },
            select: { id: true, ecritureId: true },
        });
        if (!duGroupe.every((l) => l.ecritureId === perte.id || l.ecritureId === retourId))
            return null;
        const figees = await (0, gel_cloture_1.lignesFigees)(this.prisma, tenantId, duGroupe.map((l) => l.id));
        const premiere = [...figees.values()][0];
        return { id: groupe.id, code: groupe.code, figee: premiere ? `la ligne du ${jour(premiere.date)} est figée, ${premiere.motif}` : null };
    }
    async groupeDuModule(tenantId, c, ecritureId) {
        const [ligne] = await this.prisma.ligneEcriture.findMany({
            where: { ecritureId, compteId: c.compte416Id, ecriture: { tenantId } },
            select: { lettrageId: true },
            take: 1,
        });
        if (!ligne?.lettrageId)
            return null;
        const groupe = await this.prisma.lettrage.findFirst({
            where: { id: ligne.lettrageId, tenantId },
            select: { id: true, code: true, origine: true },
        });
        if (!groupe)
            return null;
        const duGroupe = await this.prisma.ligneEcriture.findMany({
            where: { lettrageId: groupe.id, ecriture: { tenantId } },
            select: { id: true, compteId: true },
        });
        if (duGroupe.length === 0 || !duGroupe.every((l) => l.compteId === c.compte416Id))
            return null;
        const figees = await (0, gel_cloture_1.lignesFigees)(this.prisma, tenantId, duGroupe.map((l) => l.id));
        const premiere = [...figees.values()][0];
        const figee = premiere ? `la ligne du ${jour(premiere.date)} est figée, ${premiere.motif}` : null;
        const duModule = groupe.origine === client_1.OrigineLettrage.MODULE;
        if (!figee && !duModule)
            return null;
        return { id: groupe.id, code: groupe.code, figee, duModule };
    }
    perte(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'PERTE', () => this.mouvement(tenantId, userId, id, client_1.TypeMouvementCreanceDouteuse.PERTE, dto));
    }
    recouvrement(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'RECOUVREMENT', () => this.mouvement(tenantId, userId, id, client_1.TypeMouvementCreanceDouteuse.RECOUVREMENT, dto));
    }
    async candidatesCorrection(tenantId, id) {
        const c = await this.creance(tenantId, id);
        const exCreance = await this.exercice(tenantId, c.exerciceId);
        const filtre = {
            statut: client_1.StatutEcriture.VALIDEE,
            exercice: {
                statut: client_1.StatutExercice.OUVERT,
                dateDebut: c.declareeOuverture ? { gte: exCreance.dateDebut } : { gt: exCreance.dateFin },
            },
            creanceDouteuseCorrection: { is: null },
            creanceDouteuseReclassement: { is: null },
            mouvementCreanceDouteuse: { is: null },
            ajustementCreanceDouteuse: { is: null },
            lignes: { some: { compteId: c.compte416.id, credit: { gt: 0 } } },
        };
        const [total, ecritures] = await Promise.all([
            this.prisma.ecriture.count({ where: { ...filtre, tenantId } }),
            this.prisma.ecriture.findMany({
                where: { ...filtre, tenantId },
                select: {
                    id: true,
                    date: true,
                    numeroPiece: true,
                    libelle: true,
                    journal: { select: { code: true } },
                    lignes: { select: { compteId: true, debit: true, credit: true } },
                },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                take: exports.PLAFOND_CANDIDATES_CORRECTION,
            }),
        ]);
        return {
            reste: this.resteFinal(c),
            comptes: { compte416: c.compte416.numero, compte491: c.compte491.numero },
            total,
            tronque: total > ecritures.length,
            ecritures: ecritures.map((e) => ({
                id: e.id,
                date: jour(e.date),
                piece: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`,
                libelle: e.libelle,
                credit416: (0, creances_douteuses_1.centimes)(e.lignes.filter((l) => l.compteId === c.compte416.id).reduce((s, l) => s + n(l.credit) - n(l.debit), 0)),
                debit491: (0, creances_douteuses_1.centimes)(e.lignes.filter((l) => l.compteId === c.compte491.id).reduce((s, l) => s + n(l.debit) - n(l.credit), 0)),
                depreciationEnPlace: this.enPlace(c, e.date),
            })),
        };
    }
    corrigerParResultat(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'CORRECTION PAR LE RÉSULTAT', () => this.corrigerParResultatSousVerrou(tenantId, userId, id, dto));
    }
    async corrigerParResultatSousVerrou(tenantId, userId, id, dto) {
        const [c, regime] = await Promise.all([this.creance(tenantId, id), this.regime(tenantId)]);
        const [exCreance, ecriture] = await Promise.all([
            this.exercice(tenantId, c.exerciceId),
            this.prisma.ecriture.findFirst({
                where: { id: dto.ecritureId, tenantId },
                select: {
                    id: true,
                    date: true,
                    statut: true,
                    exercice: { select: { dateDebut: true, dateFin: true, statut: true } },
                    lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true, classe: true } } } },
                },
            }),
        ]);
        if (!ecriture)
            throw new common_1.NotFoundException('Écriture introuvable pour ce dossier.');
        const [methode, detenteurs] = await Promise.all([
            (0, methode_au_reclassement_1.lireMethodeAuReclassement)(this.prisma, {
                tenantId,
                figee: c.methodeCotisationsReclassement,
                geste: c.createdAt,
                actuelle: regime.methodeCotisations ?? null,
            }),
            this.ecritures.detenteursDeLEcriture(tenantId, ecriture.id),
        ]);
        let credit416 = 0;
        let debit491 = 0;
        const autres = new Map();
        for (const l of ecriture.lignes) {
            if (l.compteId === c.compte416.id)
                credit416 += n(l.credit) - n(l.debit);
            else if (l.compteId === c.compte491.id)
                debit491 += n(l.debit) - n(l.credit);
            else
                autres.set(l.compte.numero, CLASSES_DE_GESTION.has(l.compte.classe));
        }
        const date = ecriture.date;
        const mouvementApres = c.mouvements.find((m) => m.date.getTime() > date.getTime()) ?? null;
        const revueApres = c.ajustements.find((a) => a.exercice.dateFin.getTime() >= date.getTime()) ?? null;
        const motif = (0, creances_douteuses_1.motifRefusCorrectionParResultat)({
            referentiel: regime.referentiel,
            numeroSource: c.compteCreance.numero,
            methode,
            actuelle: regime.methodeCotisations ?? null,
            declareeOuverture: c.declareeOuverture,
            exerciceCreanceClos: exCreance.statut === client_1.StatutExercice.CLOTURE,
            exerciceEcritureApres: c.declareeOuverture
                ? ecriture.exercice.dateDebut.getTime() >= exCreance.dateDebut.getTime()
                : ecriture.exercice.dateDebut.getTime() > exCreance.dateFin.getTime(),
            exerciceEcritureOuvert: ecriture.exercice.statut === client_1.StatutExercice.OUVERT,
            ecritureValidee: ecriture.statut === client_1.StatutEcriture.VALIDEE,
            detenteurs,
            credit416,
            debit491,
            autres: [...autres.entries()].map(([numero, gestion]) => ({ numero, gestion })),
            reste: this.resteFinal(c),
            enPlace: this.enPlace(c, date),
            mouvementApres: mouvementApres ? jour(mouvementApres.date) : null,
            revueApres: revueApres ? jour(revueApres.date) : null,
            motif: dto.motif,
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        try {
            const corrigee = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, (tx) => tx.creanceDouteuse.update({
                where: { id: c.id, tenantId, annuleeLe: null, corrigeeParResultatLe: null },
                data: {
                    corrigeeParResultatLe: new Date(),
                    corrigeeParResultatPar: userId,
                    motifCorrectionResultat: dto.motif.trim(),
                    ecritureCorrectionResultatId: ecriture.id,
                },
                select: { id: true, corrigeeParResultatLe: true, ecritureCorrectionResultatId: true, motifCorrectionResultat: true },
            }));
            return { ...corrigee, avertissement: methode.connue ? null : (0, creances_douteuses_1.avertissementMethodeInconnue)(methode.motif) };
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('Cette écriture corrige déjà une autre créance · une écriture de correction par créance.');
            }
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new common_1.ConflictException('La créance a été annulée ou corrigée pendant le geste · relisez-la.');
            }
            throw err;
        }
    }
    retirerCreance(tenantId, id) {
        return this.sousVerrou(tenantId, 'RETRAIT', async () => {
            const c = await this.creance(tenantId, id);
            const [toutes, tousMouvements] = await Promise.all([
                this.prisma.ajustementCreanceDouteuse.count({ where: { tenantId, creanceId: c.id } }),
                this.prisma.mouvementCreanceDouteuse.count({ where: { tenantId, creanceId: c.id } }),
            ]);
            const ex = await this.exercice(tenantId, c.exerciceId);
            const refus = (0, creances_douteuses_1.motifNonRetirable)({
                revuesTotal: toutes,
                mouvementsTotal: tousMouvements,
                exerciceClos: ex.statut === client_1.StatutExercice.CLOTURE,
                ecriture: null,
            });
            if (refus)
                throw new common_1.BadRequestException(refus);
            const retirer = async (tx) => {
                await tx.creanceDouteuse.delete({ where: { id: c.id } });
            };
            if (!c.ecritureReclassementId) {
                await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, retirer);
                return { retire: true };
            }
            await this.ecritures.supprimer(tenantId, c.ecritureReclassementId, {
                detenteur: ecriture_service_1.DETENTEUR_RECLASSEMENT_CREANCE,
                liberer: retirer,
            });
            return { retire: true };
        });
    }
    annulerReclassement(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'ANNULATION DE RECLASSEMENT', () => this.annulerReclassementSousVerrou(tenantId, userId, id, dto.motif));
    }
    async annulerReclassementSousVerrou(tenantId, userId, id, motifSaisi) {
        const c = await this.prisma.creanceDouteuse.findFirst({
            where: { id, tenantId },
            include: {
                exercice: { select: { statut: true } },
                ecritureReclassement: {
                    select: { id: true, statut: true, numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
                },
            },
        });
        if (!c)
            throw new common_1.NotFoundException('Créance douteuse introuvable pour ce dossier.');
        const [revues, mouvements] = await Promise.all([
            this.prisma.ajustementCreanceDouteuse.count({ where: { tenantId, creanceId: c.id, annuleeLe: null } }),
            this.prisma.mouvementCreanceDouteuse.count({ where: { tenantId, creanceId: c.id, annuleeLe: null } }),
        ]);
        const refus = (0, creances_douteuses_1.motifRefusAnnulationReclassement)({
            dejaAnnulee: c.annuleeLe ? jour(c.annuleeLe) : null,
            exerciceClos: c.exercice.statut === client_1.StatutExercice.CLOTURE,
            revuesNonAnnulees: revues,
            mouvementsNonAnnules: mouvements,
            motif: motifSaisi,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const motif = motifSaisi.trim();
        const objet = `l'écriture du reclassement n° ${c.ecritureReclassement?.numeroPiece ?? '·'}`;
        const groupe = c.ecritureReclassement ? await this.groupeDuModule(tenantId, c, c.ecritureReclassement.id) : null;
        const maintenu = groupe?.figee ? groupe.id : null;
        if (c.ecritureReclassement) {
            if (groupe?.figee && c.ecritureReclassement.statut === client_1.StatutEcriture.BROUILLARD) {
                throw new common_1.BadRequestException((0, creances_douteuses_1.motifLettrageFigeAuBrouillard)(groupe.code, groupe.figee, 'le reclassement'));
            }
            const tenues = (0, lignes_tenues_1.motifLignesTenues)(c.ecritureReclassement.lignes, objet, 'annuler', ', puis annulez le reclassement', groupe?.id ?? null);
            if (tenues)
                throw new common_1.BadRequestException(tenues);
        }
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const [r, m] = await Promise.all([
                tx.ajustementCreanceDouteuse.count({ where: { tenantId, creanceId: c.id, annuleeLe: null } }),
                tx.mouvementCreanceDouteuse.count({ where: { tenantId, creanceId: c.id, annuleeLe: null } }),
            ]);
            if (r > 0 || m > 0) {
                throw new common_1.BadRequestException((0, creances_douteuses_1.motifRefusAnnulationReclassement)({ dejaAnnulee: null, exerciceClos: false, revuesNonAnnulees: r, mouvementsNonAnnules: m, motif }));
            }
            const e = c.ecritureReclassement;
            let annulation = { traitement: 'SANS_ECRITURE' };
            if (e) {
                if (groupe && !maintenu)
                    await this.lettrage.defaireLettrageDuModule(tx, tenantId, groupe.id);
                const relues = await tx.ligneEcriture.findMany({
                    where: { ecritureId: e.id, ecriture: { tenantId } },
                    select: { lettre: true, lettrageId: true, rapprochementId: true },
                });
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(relues, objet, 'annuler', ', puis annulez le reclassement', maintenu);
                if (tenues)
                    throw new common_1.BadRequestException(tenues);
                if ((await this.statutDansTx(tx, tenantId, e.id)) === client_1.StatutEcriture.BROUILLARD) {
                    if (groupe && maintenu)
                        throw new common_1.BadRequestException((0, creances_douteuses_1.motifLettrageFigeAuBrouillard)(groupe.code, groupe.figee, 'le reclassement'));
                    annulation = { traitement: 'SUPPRIMEE', ecritureId: e.id, numeroPiece: e.numeroPiece };
                }
                else {
                    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx, { groupeTolere: maintenu });
                    annulation = { traitement: 'INSCRITE_EN_NEGATIF', ecritureId: e.id, numeroPiece: e.numeroPiece, negatifId: negatif.id, negatifNumeroPiece: negatif.numeroPiece };
                }
                if (groupe)
                    annulation = { ...annulation, ...(maintenu ? { lettrageMaintenu: groupe.id } : { lettrageDefait: groupe.id }) };
            }
            try {
                await tx.creanceDouteuse.update({
                    where: { id: c.id, tenantId, annuleeLe: null },
                    data: {
                        annuleeLe: new Date(),
                        annuleePar: userId,
                        motifAnnulation: motif,
                        annulation: annulation,
                        ...(annulation.traitement === 'SUPPRIMEE' ? { ecritureReclassementId: null } : {}),
                    },
                });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException('Ce reclassement est déjà annulé.');
                }
                throw err;
            }
            if (e && annulation.traitement === 'SUPPRIMEE') {
                await this.supprimerBrouillardDansTx(tx, tenantId, e.id);
            }
            return { annule: true, annulation, ...(groupe && maintenu ? { information: (0, creances_douteuses_1.informationLettrageMaintenu)(groupe.code, groupe.figee) } : {}) };
        });
    }
    retirerMouvement(tenantId, userId, id, mouvementId) {
        return this.sousVerrou(tenantId, 'RETRAIT', async () => {
            const c = await this.creance(tenantId, id);
            const mv = c.mouvements.find((m) => m.id === mouvementId);
            if (!mv)
                throw new common_1.NotFoundException('Mouvement introuvable pour cette créance.');
            await this.refuserSiRecuperee(tenantId, id, 'retirer ce mouvement');
            const revue = c.ajustements.find((a) => a.exercice.dateFin.getTime() >= mv.date.getTime());
            if (revue) {
                throw new common_1.BadRequestException(`La revue de la clôture du ${jour(revue.date)} a compté ce mouvement dans le reste de la créance · annulez-la d’abord.`);
            }
            if (!mv.ecritureId)
                throw new common_1.BadRequestException('Ce mouvement n’a plus d’écriture · il est annulé.');
            const ecritureId = mv.ecritureId;
            const groupe = await this.groupeDuModule(tenantId, c, ecritureId);
            if (groupe?.figee) {
                const statut = await this.statutDansTx(this.prisma, tenantId, ecritureId);
                if (statut === client_1.StatutEcriture.BROUILLARD) {
                    throw new common_1.BadRequestException((0, creances_douteuses_1.motifLettrageFigeAuBrouillard)(groupe.code, groupe.figee, 'le mouvement'));
                }
            }
            const defaire = groupe && !groupe.figee ? groupe.id : null;
            let perte = null;
            let groupeOrigine = null;
            if (mv.ecriturePerteId) {
                perte = await this.prisma.ecriture.findFirst({
                    where: { id: mv.ecriturePerteId, tenantId },
                    select: { id: true, numeroPiece: true, statut: true, lignes: { select: { id: true, compteId: true, lettrageId: true } } },
                });
                if (!perte)
                    throw new common_1.ConflictException('La pièce de la perte de ce mouvement est introuvable · rien n’est retiré.');
                if (perte.statut !== client_1.StatutEcriture.BROUILLARD) {
                    throw new common_1.BadRequestException(`La perte (pièce n° ${perte.numeroPiece ?? '·'}) est validée · elle est entrée au livre-journal et ne se retire plus. ` +
                        'Annulez le mouvement (« Annuler ») · ses deux pièces s’inscrivent en négatif (AUDCIF art. 20, al. 2).');
                }
                groupeOrigine = await this.groupeRetourEtPerte(tenantId, perte, ecritureId);
                if (groupeOrigine?.figee)
                    throw new common_1.BadRequestException((0, creances_douteuses_1.motifLettrageFigeAuBrouillard)(groupeOrigine.code, groupeOrigine.figee, 'le mouvement'));
            }
            const toleres = [defaire, groupeOrigine?.id ?? null].filter((x) => !!x);
            await this.ecritures.supprimer(tenantId, ecritureId, {
                detenteur: ecriture_service_1.DETENTEUR_MOUVEMENT_CREANCE,
                lettrageTolere: toleres.length === 0 ? null : toleres.length === 1 ? toleres[0] : toleres,
                liberer: async (tx) => {
                    if (defaire)
                        await this.lettrage.defaireLettrageDuModule(tx, tenantId, defaire);
                    if (groupeOrigine)
                        await this.lettrage.defaireLettrageDuModule(tx, tenantId, groupeOrigine.id);
                    await tx.mouvementCreanceDouteuse.delete({ where: { id: mv.id } });
                    if (perte) {
                        const relues = await tx.ligneEcriture.findMany({
                            where: { ecritureId: perte.id, ecriture: { tenantId } },
                            select: { lettre: true, lettrageId: true, rapprochementId: true },
                        });
                        const tenues = (0, lignes_tenues_1.motifLignesTenues)(relues, `l'écriture de la perte n° ${perte.numeroPiece ?? '·'}`, 'retirer', ', puis retirez le mouvement', null);
                        if (tenues)
                            throw new common_1.BadRequestException(tenues);
                        await this.supprimerBrouillardDansTx(tx, tenantId, perte.id);
                    }
                },
            });
            return {
                retire: true,
                ...(defaire ? { lettrageDefait: defaire } : {}),
                ...(perte ? { perteRetiree: { ecritureId: perte.id, numeroPiece: perte.numeroPiece, ...(groupeOrigine ? { lettrageDefait: groupeOrigine.id } : {}) } } : {}),
            };
        });
    }
    annulerMouvement(tenantId, userId, id, mouvementId, dto) {
        return this.sousVerrou(tenantId, 'ANNULATION DE MOUVEMENT', () => this.annulerMouvementSousVerrou(tenantId, userId, id, mouvementId, dto.motif));
    }
    async annulerMouvementSousVerrou(tenantId, userId, id, mouvementId, motifSaisi) {
        const mv = await this.prisma.mouvementCreanceDouteuse.findFirst({
            where: { id: mouvementId, creanceId: id, tenantId },
            include: {
                exercice: { select: { statut: true } },
                ecriture: {
                    select: { id: true, statut: true, numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
                },
                ecriturePerte: {
                    select: {
                        id: true,
                        statut: true,
                        numeroPiece: true,
                        journalId: true,
                        lignes: { select: { id: true, compteId: true, lettre: true, lettrageId: true, rapprochementId: true } },
                    },
                },
            },
        });
        if (!mv)
            throw new common_1.NotFoundException('Mouvement introuvable pour cette créance.');
        let decalagePerte = null;
        if (!mv.annuleeLe && n(mv.montantTva) > 0.005 && mv.ecriturePerte) {
            const liquidation = await this.prisma.liquidationTva.findFirst({
                where: { tenantId, dateFin: { gte: mv.date } },
                orderBy: { dateFin: 'desc' },
                select: { dateFin: true },
            });
            const refusTva = (0, recuperation_tva_1.motifRefusAnnulationPerteAvecTva)(liquidation ? jour(liquidation.dateFin) : null);
            if (refusTva)
                throw new common_1.BadRequestException(refusTva);
            const clotures = await this.prisma.cloture.findMany({
                where: { tenantId, annuleeAt: null, OR: [{ journalId: mv.ecriturePerte.journalId }, { journalId: null }] },
            });
            const premier = (0, report_periode_close_1.premierJourNonCloture)(clotures, mv.ecriturePerte.journalId, mv.date);
            if (premier.getTime() !== mv.date.getTime())
                decalagePerte = (0, recuperation_tva_1.informationDecalagePerte)(jour(premier));
        }
        await this.refuserSiCorrigee(tenantId, id);
        if (!mv.annuleeLe)
            await this.refuserSiRecuperee(tenantId, id, 'annuler ce mouvement');
        const creanceDuMouvement = await this.prisma.creanceDouteuse.findFirst({
            where: { id, tenantId },
            select: { id: true, compte416Id: true, ecritureReclassementId: true, compteCreanceId: true },
        });
        const groupe = creanceDuMouvement && mv.ecriture ? await this.groupeDuModule(tenantId, creanceDuMouvement, mv.ecriture.id) : null;
        const maintenu = groupe?.figee ? groupe.id : null;
        const groupeOrigine = mv.ecriturePerte ? await this.groupeRetourEtPerte(tenantId, mv.ecriturePerte, mv.ecriture?.id ?? null) : null;
        const maintenuOrigine = groupeOrigine?.figee ? groupeOrigine.id : null;
        const unOuPlusieurs = (l) => (l.length === 0 ? null : l.length === 1 ? l[0] : l);
        const toleres = unOuPlusieurs([maintenu, maintenuOrigine].filter((x) => !!x));
        const revue = await this.prisma.ajustementCreanceDouteuse.findFirst({
            where: { tenantId, creanceId: id, annuleeLe: null, exercice: { dateFin: { gte: mv.date } } },
            orderBy: { date: 'asc' },
            select: { date: true },
        });
        const refus = (0, creances_douteuses_1.motifRefusAnnulationMouvement)({
            dejaAnnule: mv.annuleeLe ? jour(mv.annuleeLe) : null,
            exerciceClos: mv.exercice.statut === client_1.StatutExercice.CLOTURE,
            revueNonAnnulee: revue ? jour(revue.date) : null,
            motif: motifSaisi,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const motif = motifSaisi.trim();
        const nom = mv.type === client_1.TypeMouvementCreanceDouteuse.PERTE ? 'de la perte' : 'du recouvrement';
        const objet = `l'écriture ${nom} n° ${mv.ecriture?.numeroPiece ?? '·'}`;
        const tenusDuModule = unOuPlusieurs([groupe?.id ?? null, groupeOrigine?.id ?? null].filter((x) => !!x));
        if (mv.ecriture) {
            if (groupe?.figee && mv.ecriture.statut === client_1.StatutEcriture.BROUILLARD) {
                throw new common_1.BadRequestException((0, creances_douteuses_1.motifLettrageFigeAuBrouillard)(groupe.code, groupe.figee, 'le mouvement'));
            }
            const tenues = (0, lignes_tenues_1.motifLignesTenues)(mv.ecriture.lignes, objet, 'annuler', ', puis annulez le mouvement', tenusDuModule);
            if (tenues)
                throw new common_1.BadRequestException(tenues);
        }
        if (mv.ecriturePerte) {
            if (groupeOrigine?.figee && mv.ecriturePerte.statut === client_1.StatutEcriture.BROUILLARD) {
                throw new common_1.BadRequestException((0, creances_douteuses_1.motifLettrageFigeAuBrouillard)(groupeOrigine.code, groupeOrigine.figee, 'le mouvement'));
            }
            const tenues = (0, lignes_tenues_1.motifLignesTenues)(mv.ecriturePerte.lignes, `l'écriture de la perte n° ${mv.ecriturePerte.numeroPiece ?? '·'}`, 'annuler', ', puis annulez le mouvement', tenusDuModule);
            if (tenues)
                throw new common_1.BadRequestException(tenues);
        }
        const resultat = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const e = mv.ecriture;
            let annulation = { traitement: 'SANS_ECRITURE' };
            let annulationPerte = null;
            if (groupeOrigine && !maintenuOrigine)
                await this.lettrage.defaireLettrageDuModule(tx, tenantId, groupeOrigine.id);
            if (mv.ecriturePerte) {
                const p = mv.ecriturePerte;
                const relues = await tx.ligneEcriture.findMany({
                    where: { ecritureId: p.id, ecriture: { tenantId } },
                    select: { lettre: true, lettrageId: true, rapprochementId: true },
                });
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(relues, `l'écriture de la perte n° ${p.numeroPiece ?? '·'}`, 'annuler', ', puis annulez le mouvement', toleres);
                if (tenues)
                    throw new common_1.BadRequestException(tenues);
                if ((await this.statutDansTx(tx, tenantId, p.id)) === client_1.StatutEcriture.BROUILLARD) {
                    annulationPerte = { traitement: 'SUPPRIMEE', ecritureId: p.id, numeroPiece: p.numeroPiece };
                }
                else {
                    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, p.id, motifSaisi.trim(), tx, { groupeTolere: toleres });
                    annulationPerte = { traitement: 'INSCRITE_EN_NEGATIF', ecritureId: p.id, numeroPiece: p.numeroPiece, negatifId: negatif.id, negatifNumeroPiece: negatif.numeroPiece };
                }
                if (groupeOrigine)
                    annulationPerte = { ...annulationPerte, ...(maintenuOrigine ? { lettrageMaintenu: groupeOrigine.id } : { lettrageDefait: groupeOrigine.id }) };
            }
            if (e) {
                if (groupe && !maintenu)
                    await this.lettrage.defaireLettrageDuModule(tx, tenantId, groupe.id);
                const relues = await tx.ligneEcriture.findMany({
                    where: { ecritureId: e.id, ecriture: { tenantId } },
                    select: { lettre: true, lettrageId: true, rapprochementId: true },
                });
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(relues, objet, 'annuler', ', puis annulez le mouvement', toleres);
                if (tenues)
                    throw new common_1.BadRequestException(tenues);
                if ((await this.statutDansTx(tx, tenantId, e.id)) === client_1.StatutEcriture.BROUILLARD) {
                    if (groupe && maintenu)
                        throw new common_1.BadRequestException((0, creances_douteuses_1.motifLettrageFigeAuBrouillard)(groupe.code, groupe.figee, 'le mouvement'));
                    annulation = { traitement: 'SUPPRIMEE', ecritureId: e.id, numeroPiece: e.numeroPiece };
                }
                else {
                    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx, { groupeTolere: toleres });
                    annulation = {
                        traitement: 'INSCRITE_EN_NEGATIF',
                        ecritureId: e.id,
                        numeroPiece: e.numeroPiece,
                        negatifId: negatif.id,
                        negatifNumeroPiece: negatif.numeroPiece,
                    };
                }
                if (groupe)
                    annulation = { ...annulation, ...(maintenu ? { lettrageMaintenu: groupe.id } : { lettrageDefait: groupe.id }) };
            }
            try {
                await tx.mouvementCreanceDouteuse.update({
                    where: { id: mv.id, tenantId, annuleeLe: null },
                    data: {
                        annuleeLe: new Date(),
                        annuleePar: userId,
                        motifAnnulation: motif,
                        annulation: (annulationPerte ? { ...annulation, perte: annulationPerte } : annulation),
                        ...(annulation.traitement === 'SUPPRIMEE' ? { ecritureId: null } : {}),
                        ...(annulationPerte?.traitement === 'SUPPRIMEE' ? { ecriturePerteId: null } : {}),
                    },
                });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                    throw new common_1.ConflictException('Ce mouvement est déjà annulé.');
                }
                throw err;
            }
            if (e && annulation.traitement === 'SUPPRIMEE') {
                await this.supprimerBrouillardDansTx(tx, tenantId, e.id);
            }
            if (mv.ecriturePerte && annulationPerte?.traitement === 'SUPPRIMEE') {
                await this.supprimerBrouillardDansTx(tx, tenantId, mv.ecriturePerte.id);
            }
            let lettrageOrigine = null;
            if (mv.ecriturePerte && creanceDuMouvement) {
                const ecritures = [
                    annulation.traitement === 'SUPPRIMEE' ? null : (mv.ecriture?.id ?? null),
                    annulation.negatifId,
                    annulationPerte?.traitement === 'SUPPRIMEE' ? null : mv.ecriturePerte.id,
                    annulationPerte?.negatifId,
                ].filter((x) => !!x);
                const ouvertes = ecritures.length === 0
                    ? []
                    : await tx.ligneEcriture.findMany({
                        where: { ecritureId: { in: ecritures }, compteId: creanceDuMouvement.compteCreanceId, lettrageId: null, ecriture: { tenantId } },
                        select: { id: true },
                    });
                const figees = await (0, gel_cloture_1.lignesFigees)(tx, tenantId, ouvertes.map((l) => l.id));
                const libres = ouvertes.filter((l) => !figees.has(l.id));
                if (libres.length >= 2) {
                    const r = await this.lettrage.lettrerLignesDuModuleDansTx(tx, tenantId, creanceDuMouvement.compteCreanceId, libres.map((l) => l.id), userId);
                    if ('motif' in r && !r.nonLettrable)
                        throw new common_1.BadRequestException(`${r.motif} L’annulation n’est pas passée.`);
                    lettrageOrigine = 'code' in r ? { pose: true, code: r.code } : { pose: false, motif: r.motif };
                }
                if (figees.size > 0) {
                    const f = [...figees.values()][0];
                    const dit = `${figees.size} ligne(s) du compte d’origine restent ouvertes, figées (la ligne du ${jour(f.date)}, ${f.motif}) · la garde du lettrage les tient hors de tout groupe avec la facture, rien n’est lu comme un encaissement.`;
                    lettrageOrigine = lettrageOrigine && lettrageOrigine.pose ? { ...lettrageOrigine, information: dit } : { pose: false, motif: dit };
                }
            }
            return {
                annule: true,
                annulation,
                ...(mv.ecriturePerte ? { lettrageOrigine } : {}),
                ...(decalagePerte ? { decalage: decalagePerte } : {}),
                ...(groupe && maintenu ? { information: (0, creances_douteuses_1.informationLettrageMaintenu)(groupe.code, groupe.figee) } : {}),
            };
        }, { maxWait: 10_000, timeout: 30_000 });
        return resultat;
    }
    async lireRecuperation(tenantId, c) {
        const [pertes, designations, recuperations, derniereLiquidation] = await Promise.all([
            this.prisma.mouvementCreanceDouteuse.findMany({
                where: { tenantId, creanceId: c.id, annuleeLe: null, type: client_1.TypeMouvementCreanceDouteuse.PERTE },
                orderBy: { date: 'asc' },
                take: 200,
                select: {
                    id: true,
                    date: true,
                    detailTva: true,
                    ecriture: { select: { statut: true, numeroPiece: true, lignes: { where: { debit: { gt: 0 } }, select: { compteId: true }, take: 5 } } },
                    ecriturePerte: { select: { statut: true, numeroPiece: true, lignes: { where: { debit: { gt: 0 } }, select: { compteId: true }, take: 5 } } },
                },
            }),
            this.prisma.factureCreanceDouteuse.findMany({
                where: { tenantId, creanceId: c.id, retireeLe: null },
                orderBy: { createdAt: 'asc' },
                take: 200,
                select: {
                    id: true,
                    montant: true,
                    ligneEcritureId: true,
                    ligneEcriture: { select: { dateEcheance: true, ecritureId: true, ecriture: { select: { date: true, libelle: true, numeroPiece: true } } } },
                },
            }),
            this.prisma.recuperationTvaCreance.findMany({
                where: { tenantId, creanceId: c.id },
                orderBy: { createdAt: 'desc' },
                take: 200,
                include: { ecriture: { select: { id: true, numeroPiece: true, statut: true } }, exercice: { select: { statut: true } } },
            }),
            this.prisma.liquidationTva.findFirst({ where: { tenantId }, orderBy: { dateFin: 'desc' }, select: { dateFin: true } }),
        ]);
        const { factures: taxes, ancienMoteur } = await this.tva.taxeDesFactures(tenantId, [...new Set(designations.map((d) => d.ligneEcriture.ecritureId))]);
        const factures = designations.map((d) => ({
            designationId: d.id,
            ligneEcritureId: d.ligneEcritureId,
            montant: n(d.montant),
            dateFacture: d.ligneEcriture.ecriture.date,
            dateEcheance: d.ligneEcriture.dateEcheance ?? null,
            libelle: d.ligneEcriture.ecriture.libelle,
            numeroPiece: d.ligneEcriture.ecriture.numeroPiece,
            taxe: taxes.get(d.ligneEcriture.ecritureId) ?? null,
        }));
        const chiffrees = (0, recuperation_tva_1.chiffrerFactures)({
            reclasse: n(c.montant),
            factures,
            recouvrements: c.mouvements.filter((m) => m.type === client_1.TypeMouvementCreanceDouteuse.RECOUVREMENT).map((m) => ({ date: m.date, montant: n(m.montant) })),
        });
        const dejaRecuperees = new Set();
        for (const r of recuperations) {
            if (r.annuleeLe)
                continue;
            for (const f of r.detail ?? [])
                if (f.designationId)
                    dejaRecuperees.add(f.designationId);
        }
        for (const p of pertes) {
            for (const f of p.detailTva ?? [])
                if (f.designationId)
                    dejaRecuperees.add(f.designationId);
        }
        const reserveAncienMoteur = ancienMoteur && chiffrees.some((f) => f.motifs.includes(recuperation_tva_1.MOTIF_TAXE_A_L_ENCAISSEMENT))
            ? 'Une liquidation de TVA passée sous l’ancien moteur (avant la ligne A7 bis) a pu déclarer à la facture la taxe d’une prestation ' +
                'non encaissée · OmegaX ne la récupère pas. Vérifiez la déclaration déposée et, si la taxe y figure, déclarez sa récupération ' +
                'vous-même (art. 52).'
            : null;
        const lignesEncaissement = new Map(designations.map((d) => {
            const t = taxes.get(d.ligneEcriture.ecritureId);
            return [
                d.id,
                (t?.lignesTva ?? []).filter((x) => x.base === 'ENCAISSEMENT').map((x) => ({ ligneId: x.ligneId, tva: x.tva, ttc: t.ttc })),
            ];
        }));
        return {
            pertes,
            chiffrees,
            dejaRecuperees,
            recuperations,
            finDerniereLiquidation: derniereLiquidation?.dateFin ?? null,
            reserveAncienMoteur,
            ancienMoteur,
            lignesEncaissement,
        };
    }
    static entreePertes(pertes) {
        return pertes.map((p) => {
            const e = p.ecriturePerte ?? p.ecriture;
            return {
                date: p.date,
                validee: p.ecriture?.statut === client_1.StatutEcriture.VALIDEE && (!p.ecriturePerte || p.ecriturePerte.statut === client_1.StatutEcriture.VALIDEE),
                numeroPiece: e?.numeroPiece ?? null,
            };
        });
    }
    static presenterRecuperations(recuperations) {
        return recuperations.map((r) => ({
            id: r.id,
            date: jour(r.date),
            montantTva: n(r.montantTva),
            montantHt: n(r.montantHt),
            detail: r.detail,
            motif: r.motif,
            ecriture: r.ecriture ? { id: r.ecriture.id, numeroPiece: r.ecriture.numeroPiece, statut: r.ecriture.statut } : null,
            exerciceClos: r.exercice.statut === client_1.StatutExercice.CLOTURE,
            annuleeLe: r.annuleeLe ? jour(r.annuleeLe) : null,
            motifAnnulation: r.motifAnnulation,
        }));
    }
    async propositionRecuperation(tenantId, id) {
        const c = await this.creance(tenantId, id);
        const l = await this.lireRecuperation(tenantId, c);
        const pertes = CreancesDouteusesService_1.entreePertes(l.pertes);
        const derniere = pertes.length > 0 ? pertes.reduce((d, p) => (p.date > d ? p.date : d), pertes[0].date) : null;
        const refus = (0, recuperation_tva_1.motifRefusRecuperation)({
            creanceAnnulee: false,
            creanceCorrigee: false,
            resteFinal: this.resteFinal(c),
            pertes,
            designationsActives: l.chiffrees.length,
            chiffrees: l.chiffrees,
            dejaRecuperees: l.dejaRecuperees,
            duplicatas: l.chiffrees
                .filter((f) => !l.dejaRecuperees.has(f.designationId) && f.impayeTtc > 0.005)
                .map((f) => ({ designationId: f.designationId, reference: '·', dateEnvoi: f.dateFacture })),
            motif: '·',
            pieces: [{ nature: '·', reference: '·', date: null }],
            date: derniere ?? new Date(),
            exerciceOuvert: true,
            dateDansExercice: true,
            journalGeneral: true,
            finDerniereLiquidation: null,
        });
        const toutesRecuperees = l.chiffrees.length > 0 && l.chiffrees.every((f) => l.dejaRecuperees.has(f.designationId) || f.impayeTtc <= 0.005);
        const motif = toutesRecuperees && pertes.length > 0 && Math.abs(this.resteFinal(c)) <= 0.005
            ? 'Chaque facture désignée encore impayée a déjà sa récupération · rien de plus à récupérer.'
            : refus;
        return {
            factures: l.chiffrees.map((f) => ({ ...f, dejaRecuperee: l.dejaRecuperees.has(f.designationId) })),
            ouverte: motif === null,
            motif,
            derniereConstatation: derniere ? jour(derniere) : null,
            finDuDroit: derniere ? jour((0, recuperation_tva_1.finDuDroit)(derniere)) : null,
            derniereDateEcriture: derniere ? jour((0, recuperation_tva_1.derniereDateEcriture)(derniere)) : null,
            derniereDateEcritureTrimestrielle: derniere ? jour((0, recuperation_tva_1.derniereDateEcritureTrimestrielle)(derniere)) : null,
            finDerniereLiquidation: l.finDerniereLiquidation ? jour(l.finDerniereLiquidation) : null,
            reserveAncienMoteur: l.reserveAncienMoteur,
            recuperations: CreancesDouteusesService_1.presenterRecuperations(l.recuperations),
        };
    }
    recupererTva(tenantId, userId, id, dto) {
        return this.sousVerrou(tenantId, 'RÉCUPÉRATION DE LA TVA', async () => {
            const [c, ex, journal] = await Promise.all([this.creance(tenantId, id), this.exercice(tenantId, dto.exerciceId), this.journal(tenantId, dto.journalId)]);
            const l = await this.lireRecuperation(tenantId, c);
            const pertes = CreancesDouteusesService_1.entreePertes(l.pertes);
            const date = new Date(dto.date.slice(0, 10));
            const pieces = this.pieces(dto.pieces);
            const refus = (0, recuperation_tva_1.motifRefusRecuperation)({
                creanceAnnulee: false,
                creanceCorrigee: false,
                resteFinal: this.resteFinal(c),
                pertes,
                designationsActives: l.chiffrees.length,
                chiffrees: l.chiffrees,
                dejaRecuperees: l.dejaRecuperees,
                duplicatas: dto.duplicatas ?? [],
                motif: dto.motif,
                pieces,
                date,
                exerciceOuvert: ex.statut === client_1.StatutExercice.OUVERT,
                dateDansExercice: date >= ex.dateDebut && date <= ex.dateFin,
                journalGeneral: journal.type === client_1.TypeJournal.GENERAL,
                finDerniereLiquidation: l.finDerniereLiquidation,
            });
            if (refus)
                throw new common_1.BadRequestException(refus);
            const choisies = dto.duplicatas.map((d) => {
                const f = l.chiffrees.find((x) => x.designationId === d.designationId);
                return { ...f, duplicata: { reference: d.reference.trim(), dateEnvoi: d.dateEnvoi.slice(0, 10) } };
            });
            const parCompteEtTaux = new Map();
            for (const f of choisies) {
                for (const r of f.recuperable) {
                    const cle = `${r.compteId}|${r.tauxTvaId}`;
                    const v = parCompteEtTaux.get(cle) ?? { compteId: r.compteId, tauxTvaId: r.tauxTvaId, tva: 0 };
                    v.tva = (0, creances_douteuses_1.centimes)(v.tva + r.tva);
                    parCompteEtTaux.set(cle, v);
                }
            }
            const montantTva = (0, creances_douteuses_1.centimes)([...parCompteEtTaux.values()].reduce((t, v) => t + v.tva, 0));
            const montantHt = (0, creances_douteuses_1.centimes)(choisies.reduce((t, f) => t + f.impayeHt, 0));
            const compteProfits = await this.compteDetail(tenantId, recuperation_tva_1.RACINE_PROFITS_SUR_CREANCES);
            const lignes = [
                ...[...parCompteEtTaux.values()].map((v) => ({ compteId: v.compteId, debit: v.tva, credit: 0, tauxTvaId: v.tauxTvaId })),
                { compteId: compteProfits.id, debit: 0, credit: montantTva },
            ];
            const { suite: recuperation } = await this.ecritures.creerAvec(tenantId, userId, {
                exerciceId: ex.id,
                journalId: journal.id,
                date: jour(date),
                libelle: `Récupération de la TVA d’une créance irrécouvrable (art. 52) · ${c.compteCreance.numero} ${c.compteCreance.intitule}`.slice(0, 190),
                reference: choisies.map((f) => f.duplicata.reference).join(' ; ').slice(0, 100),
                lignes,
            }, (tx, ecriture) => tx.recuperationTvaCreance.create({
                data: {
                    tenantId,
                    creanceId: c.id,
                    exerciceId: ex.id,
                    date,
                    montantTva,
                    montantHt,
                    detail: choisies,
                    motif: dto.motif.trim(),
                    pieces: pieces,
                    ecritureId: ecriture.id,
                    createdBy: userId,
                },
            }));
            const perteAnterieure = l.pertes.some((p) => p.date < ex.dateDebut);
            return {
                id: recuperation.id,
                montantTva,
                montantHt,
                factures: choisies.map((f) => ({ designationId: f.designationId, libelle: f.libelle, tva: f.tvaRecuperable, mention: f.mention })),
                information: perteAnterieure
                    ? 'La perte est d’un exercice antérieur · le produit au 751 de cet exercice s’y rattache, et il doit faire l’objet d’une ' +
                        'mention spécifique dans les Notes annexes (AUDCIF art. 61, « Les produits et charges concernant des exercices antérieurs [...] ' +
                        'sont enregistrés [...] comme les produits et charges de l’exercice en cours »).'
                    : null,
                reserveAncienMoteur: l.reserveAncienMoteur,
            };
        });
    }
    annulerRecuperation(tenantId, userId, id, recuperationId, dto) {
        return this.sousVerrou(tenantId, 'ANNULATION DE LA RÉCUPÉRATION DE TVA', async () => {
            const r = await this.prisma.recuperationTvaCreance.findFirst({
                where: { id: recuperationId, creanceId: id, tenantId },
                include: {
                    exercice: { select: { statut: true } },
                    ecriture: {
                        select: { id: true, statut: true, numeroPiece: true, journalId: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
                    },
                },
            });
            if (!r)
                throw new common_1.NotFoundException('Récupération de TVA introuvable pour cette créance.');
            let periodeClose = null;
            if (r.ecriture) {
                const clotures = await this.prisma.cloture.findMany({
                    where: { tenantId, annuleeAt: null, OR: [{ journalId: r.ecriture.journalId }, { journalId: null }] },
                });
                const premier = (0, report_periode_close_1.premierJourNonCloture)(clotures, r.ecriture.journalId, r.date);
                if (premier.getTime() !== r.date.getTime())
                    periodeClose = jour(premier);
            }
            const liquidation = await this.prisma.liquidationTva.findFirst({
                where: { tenantId, dateFin: { gte: r.date } },
                orderBy: { dateFin: 'desc' },
                select: { dateFin: true },
            });
            const refus = (0, recuperation_tva_1.motifRefusAnnulationRecuperation)({
                dejaAnnulee: r.annuleeLe ? jour(r.annuleeLe) : null,
                exerciceClos: r.exercice.statut === client_1.StatutExercice.CLOTURE,
                liquidationCouvrante: liquidation ? jour(liquidation.dateFin) : null,
                periodeClose,
                motif: dto.motif,
            });
            if (refus)
                throw new common_1.BadRequestException(refus);
            const motif = dto.motif.trim();
            const objet = `l'écriture de la récupération n° ${r.ecriture?.numeroPiece ?? '·'}`;
            if (r.ecriture) {
                const tenues = (0, lignes_tenues_1.motifLignesTenues)(r.ecriture.lignes, objet, 'annuler', ', puis annulez la récupération');
                if (tenues)
                    throw new common_1.BadRequestException(tenues);
            }
            return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
                const e = r.ecriture;
                let annulation = { traitement: 'SANS_ECRITURE' };
                if (e) {
                    if ((await this.statutDansTx(tx, tenantId, e.id)) === client_1.StatutEcriture.BROUILLARD) {
                        annulation = { traitement: 'SUPPRIMEE', ecritureId: e.id, numeroPiece: e.numeroPiece };
                    }
                    else {
                        const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
                        annulation = { traitement: 'INSCRITE_EN_NEGATIF', ecritureId: e.id, numeroPiece: e.numeroPiece, negatifId: negatif.id, negatifNumeroPiece: negatif.numeroPiece };
                    }
                }
                try {
                    await tx.recuperationTvaCreance.update({
                        where: { id: r.id, tenantId, annuleeLe: null },
                        data: {
                            annuleeLe: new Date(),
                            annuleePar: userId,
                            motifAnnulation: motif,
                            annulation: annulation,
                            ...(annulation.traitement === 'SUPPRIMEE' ? { ecritureId: null } : {}),
                        },
                    });
                }
                catch (err) {
                    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                        throw new common_1.ConflictException('Cette récupération est déjà annulée.');
                    }
                    throw err;
                }
                if (e && annulation.traitement === 'SUPPRIMEE')
                    await this.supprimerBrouillardDansTx(tx, tenantId, e.id);
                return { annulee: true, annulation };
            });
        });
    }
    async refuserSiRecuperee(tenantId, creanceId, geste) {
        const nombre = await this.prisma.recuperationTvaCreance.count({ where: { tenantId, creanceId, annuleeLe: null } });
        const motif = (0, recuperation_tva_1.motifRecuperationEnPlace)(geste, nombre);
        if (motif)
            throw new common_1.BadRequestException(motif);
    }
};
exports.CreancesDouteusesService = CreancesDouteusesService;
exports.CreancesDouteusesService = CreancesDouteusesService = CreancesDouteusesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        lettrage_service_1.LettrageService,
        taux_tva_service_1.TauxTvaService])
], CreancesDouteusesService);
//# sourceMappingURL=creances-douteuses.service.js.map