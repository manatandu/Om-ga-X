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
exports.ImputationsPaiementsService = exports.PLAFOND_LIGNES_GROUPE_IMPUTATION = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const imputation_paiements_1 = require("./imputation-paiements");
const taux_tva_service_1 = require("./taux-tva.service");
exports.PLAFOND_LIGNES_GROUPE_IMPUTATION = 500;
const FACTURES_PAR_DECLARATION = 200;
const n = (x) => Number(x ?? 0);
const c = (x) => Math.round(x * 100) / 100;
const EPSILON = 0.005;
const jour = (d) => (d ? d.toISOString().slice(0, 10) : null);
const jjmmaaaa = (d) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
const lendemain = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
const finDuJour = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
let ImputationsPaiementsService = class ImputationsPaiementsService {
    constructor(prisma, tva) {
        this.prisma = prisma;
        this.tva = tva;
        this.journalServeur = new common_1.Logger('ImputationsPaiements');
    }
    async lignesDeTiers(client, tenantId, ids) {
        const lignes = await client.ligneEcriture.findMany({
            where: { id: { in: ids }, ecriture: { tenantId } },
            select: {
                id: true,
                compteId: true,
                debit: true,
                credit: true,
                lettrageId: true,
                compte: { select: { numero: true } },
                ecriture: {
                    select: {
                        statut: true,
                        date: true,
                        numeroPiece: true,
                        estGenereeParCloture: true,
                        estANouveauProvisoire: true,
                        exercice: { select: { statut: true } },
                    },
                },
            },
            take: ids.length,
        });
        return new Map(lignes.map((l) => [
            l.id,
            {
                id: l.id,
                compteId: l.compteId,
                numero: l.compte.numero,
                sens: c(n(l.debit) - n(l.credit)),
                validee: l.ecriture.statut === client_1.StatutEcriture.VALIDEE,
                lettrageId: l.lettrageId,
                date: l.ecriture.date ?? null,
                aNouveau: !!(l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire),
                exerciceClos: l.ecriture.exercice?.statut === client_1.StatutExercice.CLOTURE,
                numeroPiece: l.ecriture.numeroPiece ?? null,
            },
        ]));
    }
    async lignesDuGroupe(client, tenantId, lettrageId) {
        const lues = (await client.ligneEcriture.findMany({
            where: { lettrageId, ecriture: { tenantId } },
            select: taux_tva_service_1.SELECT_LIGNE_D_ORIGINE,
            orderBy: { id: 'asc' },
            take: exports.PLAFOND_LIGNES_GROUPE_IMPUTATION + 1,
        }));
        return lues.length > exports.PLAFOND_LIGNES_GROUPE_IMPUTATION ? null : lues;
    }
    async lireLeGroupe(client, tenantId, lettrageId, sensFacture) {
        const brutes = await this.lignesDuGroupe(client, tenantId, lettrageId);
        if (!brutes)
            return { tronque: true };
        const traduit = await this.tva.traduireLesReports(tenantId, { id: lettrageId, statut: 'PARTIEL', solde: 0, lignes: brutes }, sensFacture);
        const lu = taux_tva_service_1.TauxTvaService.lectureDuGroupe(traduit, sensFacture);
        return {
            tronque: false,
            brutes,
            lignes: lu.lignes,
            motifEnBloc: lu.motifEnBloc,
            reportsVers: traduit.reportsVers ?? new Map(),
            paiementsReportes: traduit.paiementsReportes ?? new Map(),
        };
    }
    async dejaRecuParFacture(client, tenantId, reglement, lecture) {
        const sensFacture = reglement.sens > 0 ? -1 : 1;
        const sensDe = (l) => n(l.debit) - n(l.credit);
        const versLaFacture = (id) => lecture.reportsVers.get(id) ?? id;
        const retenues = lecture.lignes;
        const dettes = retenues
            .filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 === sensFacture > 0)
            .map((l) => ({ id: l.id, dateFacture: l.ecriture.date, dateEcheance: l.dateEcheance, montant: Math.abs(sensDe(l)) }));
        const paiements = retenues
            .filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 !== sensFacture > 0)
            .map((l) => ({ id: l.id, date: l.ecriture.date, montant: Math.abs(sensDe(l)), nom: `pièce ${l.ecriture.numeroPiece ?? 'sans numéro'} du ${jjmmaaaa(l.ecriture.date)}` }));
        const ordre = [...paiements].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
        const rang = ordre.findIndex((p) => p.id === reglement.id);
        const anterieurs = rang < 0 ? [] : ordre.slice(0, rang);
        const posterieurs = rang < 0 ? ordre.filter((p) => p.id !== reglement.id) : ordre.slice(rang + 1);
        const autres = [...anterieurs, ...posterieurs].map((p) => p.id);
        const declarees = autres.length
            ? await client.imputationPaiement.findMany({
                where: { tenantId, retireeLe: null, ligneReglementId: { in: autres } },
                select: { ligneReglementId: true, ligneFactureId: true, montant: true },
                orderBy: { id: 'asc' },
                take: autres.length * FACTURES_PAR_DECLARATION,
            })
            : [];
        const nomDe = new Map(paiements.map((p) => [p.id, p.nom]));
        const rendu = new Map();
        const ajouter = (factureId, montant, paiementId) => {
            if (montant <= EPSILON)
                return;
            const x = rendu.get(factureId) ?? { montant: 0, par: [] };
            x.montant = c(x.montant + montant);
            const nom = nomDe.get(paiementId);
            if (nom && !x.par.includes(nom))
                x.par.push(nom);
            rendu.set(factureId, x);
        };
        const idsAnterieurs = new Set(anterieurs.map((p) => p.id));
        const imputation = (0, imputation_paiements_1.imputerPaiements)(dettes, anterieurs, declarees
            .filter((d) => idsAnterieurs.has(d.ligneReglementId))
            .map((d) => ({ paiementId: d.ligneReglementId, detteId: versLaFacture(d.ligneFactureId), montant: n(d.montant) })));
        for (const [detteId, parts] of imputation.parDette)
            for (const p of parts)
                ajouter(detteId, p.montant, p.paiementId);
        const idsPosterieurs = new Set(posterieurs.map((p) => p.id));
        for (const d of declarees)
            if (idsPosterieurs.has(d.ligneReglementId))
                ajouter(versLaFacture(d.ligneFactureId), n(d.montant), d.ligneReglementId);
        return rendu;
    }
    async verrouiller(tx, tenantId, cles) {
        for (const cle of [...new Set(cles)].sort()) {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`imputation-paiement:${tenantId}:${cle}`}))`;
        }
    }
    async periodeLiquidee(tenantId, date) {
        const couvrante = (d) => this.prisma.liquidationTva.findFirst({
            where: { tenantId, dateDebut: { lte: d }, dateFin: { gte: d } },
            select: { dateDebut: true, dateFin: true },
            orderBy: { dateDebut: 'asc' },
        });
        const liquidee = await couvrante(date);
        if (!liquidee)
            return null;
        let libre = lendemain(liquidee.dateFin);
        for (let i = 0; i < 240; i++) {
            const suivante = await couvrante(libre);
            if (!suivante)
                break;
            libre = lendemain(suivante.dateFin);
        }
        return { du: liquidee.dateDebut, au: liquidee.dateFin, premierJourLibre: libre };
    }
    async taxeDuJour(tenantId, d) {
        const lue = await this.tva.declaration(tenantId, d, finDuJour(d));
        return { collecte: n(lue.totalCollecte), deductible: n(lue.totalDeductible) };
    }
    async avecEffetSurLiquidation(tenantId, datePaiement, geste) {
        const periode = datePaiement ? await this.periodeLiquidee(tenantId, datePaiement) : null;
        if (!periode)
            return { resultat: await geste(), liquidation: null };
        let avant = null;
        let motif = null;
        try {
            avant = await this.taxeDuJour(tenantId, periode.premierJourLibre);
        }
        catch (e) {
            motif = e instanceof Error ? e.message : String(e);
            this.journalServeur.error(`Taxe du premier jour libre non lue avant le geste (dossier ${tenantId}) · ${motif}`);
        }
        const resultat = await geste();
        let apres = null;
        if (avant) {
            try {
                apres = await this.taxeDuJour(tenantId, periode.premierJourLibre);
            }
            catch (e) {
                motif = e instanceof Error ? e.message : String(e);
                this.journalServeur.error(`Taxe du premier jour libre non lue après le geste (dossier ${tenantId}) · ${motif}`);
            }
        }
        const collecte = avant && apres ? c(apres.collecte - avant.collecte) : null;
        const deductible = avant && apres ? c(apres.deductible - avant.deductible) : null;
        const fc = (x) => `${x > 0 ? '+' : ''}${x.toFixed(2)} CDF`;
        const message = `Le paiement du ${jjmmaaaa(datePaiement)} tombe dans la période liquidée du ${jjmmaaaa(periode.du)} au ${jjmmaaaa(periode.au)} · ` +
            'ce que cette liquidation a déclaré reste déclaré. La taxe que ce geste déplace est portée au premier jour non liquidé, le ' +
            `${jjmmaaaa(periode.premierJourLibre)} · ` +
            (collecte === null || deductible === null
                ? `montant non calculé (${motif ?? 'lecture impossible'}), à relire sur la déclaration de cette période.`
                : `collecte ${fc(collecte)}, déduction ${fc(deductible)} (lus sur la déclaration de ce jour, avant et après le geste) ; ` +
                    'un trop-déclaré s’impute sur les encaissements suivants de la même facture.');
        return {
            resultat,
            liquidation: {
                du: jour(periode.du),
                au: jour(periode.au),
                premierJourLibre: jour(periode.premierJourLibre),
                collecte,
                deductible,
                message,
            },
        };
    }
    async declarer(tenantId, userId, dto) {
        const idsFactures = dto.factures.map((f) => f.ligneFactureId);
        const pieceDate = new Date(`${dto.pieceDate.slice(0, 10)}T00:00:00.000Z`);
        const verifier = async (client) => {
            const lues = await this.lignesDeTiers(client, tenantId, [dto.ligneReglementId, ...idsFactures]);
            const reglement = lues.get(dto.ligneReglementId) ?? null;
            let dejaRecu = new Map();
            let versLaFacture = new Map();
            let motifEnBloc = null;
            let origineDuReport = null;
            if (reglement?.lettrageId && Math.abs(reglement.sens) > EPSILON) {
                const lecture = await this.lireLeGroupe(client, tenantId, reglement.lettrageId, reglement.sens > 0 ? -1 : 1);
                if (lecture.tronque) {
                    return {
                        motif: `Le groupe de lettrage du paiement dépasse ${exports.PLAFOND_LIGNES_GROUPE_IMPUTATION} lignes · il ne se lit pas ici, et aucune imputation n’y est déclarée.`,
                        reglement,
                    };
                }
                motifEnBloc = lecture.motifEnBloc;
                const origine = lecture.paiementsReportes.get(reglement.id);
                const o = origine ? lecture.lignes.find((x) => x.id === origine) : undefined;
                if (o)
                    origineDuReport = `pièce ${o.ecriture.numeroPiece ?? 'sans numéro'} du ${jjmmaaaa(o.ecriture.date)}`;
                if (!motifEnBloc && !reglement.aNouveau && !reglement.exerciceClos) {
                    dejaRecu = await this.dejaRecuParFacture(client, tenantId, reglement, lecture);
                    versLaFacture = lecture.reportsVers;
                }
            }
            const actives = await client.imputationPaiement.count({ where: { tenantId, retireeLe: null, ligneReglementId: dto.ligneReglementId } });
            const motif = (0, imputation_paiements_1.motifRefusDeclaration)({
                reglement,
                factures: dto.factures.map((f) => ({
                    ligne: lues.get(f.ligneFactureId) ?? null,
                    idDemande: f.ligneFactureId,
                    montant: f.montant,
                    dejaDeclare: dejaRecu.get(versLaFacture.get(f.ligneFactureId) ?? f.ligneFactureId)?.montant ?? 0,
                    consommePar: dejaRecu.get(versLaFacture.get(f.ligneFactureId) ?? f.ligneFactureId)?.par,
                })),
                dejaActive: actives > 0,
                pieceReference: dto.pieceReference,
                fondement: dto.fondement,
                pieceDate,
                preuveAcceptation: dto.preuveAcceptation ?? null,
                origineDuReport,
                motifEnBloc,
            });
            return { motif, reglement };
        };
        const premier = await verifier(this.prisma);
        if (premier.motif)
            throw new common_1.BadRequestException(premier.motif);
        const { resultat, liquidation } = await this.avecEffetSurLiquidation(tenantId, premier.reglement?.date ?? null, () => (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await this.verrouiller(tx, tenantId, [
                `paiement:${dto.ligneReglementId}`,
                ...idsFactures.map((id) => `facture:${id}`),
                ...(premier.reglement?.lettrageId ? [`groupe:${premier.reglement.lettrageId}`] : []),
            ]);
            const encore = await verifier(tx);
            if (encore.motif)
                throw new common_1.ConflictException(encore.motif);
            const crees = [];
            for (const f of dto.factures) {
                crees.push(await tx.imputationPaiement.create({
                    data: {
                        tenantId,
                        ligneReglementId: dto.ligneReglementId,
                        ligneFactureId: f.ligneFactureId,
                        montant: c(f.montant),
                        fondement: dto.fondement,
                        pieceReference: dto.pieceReference.trim(),
                        pieceDate,
                        preuveAcceptation: dto.fondement === 'QUITTANCE_ACCEPTEE' ? dto.preuveAcceptation.trim() : null,
                        createdBy: userId,
                    },
                }));
            }
            return crees.map((x) => ({ ...x, montant: n(x.montant) }));
        }));
        return { imputations: resultat, liquidation };
    }
    async retirer(tenantId, userId, ligneReglementId, dto) {
        const motif = dto.motif.trim();
        if (motif.length < 3)
            throw new common_1.BadRequestException('Le motif du retrait est exigé, de 3 à 500 caractères.');
        const paiement = (await this.lignesDeTiers(this.prisma, tenantId, [ligneReglementId])).get(ligneReglementId);
        if (!paiement)
            throw new common_1.NotFoundException('Le paiement désigné est introuvable dans ce dossier.');
        if (paiement.exerciceClos)
            throw new common_1.ConflictException((0, imputation_paiements_1.motifPaiementExerciceClos)(paiement.date));
        const lire = (client) => client.imputationPaiement.findMany({
            where: { tenantId, retireeLe: null, ligneReglementId },
            select: { id: true, ligneFactureId: true },
            orderBy: { id: 'asc' },
            take: FACTURES_PAR_DECLARATION + 1,
        });
        const avantVerrou = await lire(this.prisma);
        if (avantVerrou.length === 0)
            throw new common_1.NotFoundException('Aucune imputation déclarée active pour ce paiement.');
        const le = new Date();
        const { resultat, liquidation } = await this.avecEffetSurLiquidation(tenantId, paiement.date ?? null, () => (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await this.verrouiller(tx, tenantId, [`paiement:${ligneReglementId}`, ...avantVerrou.map((a) => `facture:${a.ligneFactureId}`)]);
            const actives = await lire(tx);
            if (actives.length === 0)
                throw new common_1.ConflictException('L’imputation déclarée de ce paiement a été retirée entre-temps · rien n’est retiré.');
            for (const a of actives) {
                await tx.imputationPaiement.update({
                    where: { id: a.id },
                    data: { retireeLe: le, retireePar: userId, motifRetrait: motif },
                });
            }
            return actives.length;
        }));
        return { retirees: resultat, liquidation };
    }
    async groupe(tenantId, ligneId) {
        const ligne = await this.prisma.ligneEcriture.findFirst({
            where: { id: ligneId, ecriture: { tenantId } },
            select: { id: true, lettrageId: true, compte: { select: { numero: true, intitule: true } }, lettrage: { select: { statut: true } } },
        });
        if (!ligne)
            throw new common_1.NotFoundException('Ligne introuvable dans ce dossier.');
        const vide = { lettrageId: ligne.lettrageId, compte: ligne.compte, factures: [], paiements: [], nonImpute: [], tronque: false, declareesTronquees: false };
        const auClient = ligne.compte.numero.startsWith('41');
        if (!auClient && !ligne.compte.numero.startsWith('40')) {
            return { ...vide, nonServi: `Le compte ${ligne.compte.numero} n’est ni un compte client (41) ni un compte fournisseur (40) · l’imputation d’un paiement ne s’y déclare pas.` };
        }
        if (!ligne.lettrageId)
            return { ...vide, nonServi: 'La ligne n’est lettrée avec rien · une imputation se lit dans le groupe qui réunit le paiement et ses factures.' };
        const sensFacture = auClient ? 1 : -1;
        const lecture = await this.lireLeGroupe(this.prisma, tenantId, ligne.lettrageId, sensFacture);
        if (lecture.tronque)
            return { ...vide, tronque: true, nonServi: `Le groupe dépasse ${exports.PLAFOND_LIGNES_GROUPE_IMPUTATION} lignes · il ne se lit pas ici.` };
        if (lecture.motifEnBloc)
            return { ...vide, nonServi: (0, imputation_paiements_1.motifGroupeLuEnBloc)(lecture.motifEnBloc) };
        const sensDe = (l) => n(l.debit) - n(l.credit);
        const lignes = lecture.lignes;
        const factures = lignes.filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 === sensFacture > 0);
        const paiements = lignes.filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 !== sensFacture > 0);
        const dansLeGroupe = (l) => l.lettrageId === ligne.lettrageId;
        const ligneADesigner = new Map();
        const idsDuGroupe = new Set(lecture.brutes.map((x) => x.id));
        for (const [report, origine] of lecture.reportsVers)
            if (idsDuGroupe.has(report))
                ligneADesigner.set(origine, report);
        const etats = await this.lignesDeTiers(this.prisma, tenantId, paiements.map((p) => p.id));
        const plafondDeclarees = Math.max(1, paiements.length) * FACTURES_PAR_DECLARATION;
        const declareesLues = paiements.length
            ? await this.prisma.imputationPaiement.findMany({
                where: { tenantId, retireeLe: null, ligneReglementId: { in: paiements.map((p) => p.id) } },
                select: {
                    id: true,
                    ligneReglementId: true,
                    ligneFactureId: true,
                    montant: true,
                    fondement: true,
                    pieceReference: true,
                    pieceDate: true,
                    preuveAcceptation: true,
                },
                orderBy: { id: 'asc' },
                take: plafondDeclarees + 1,
            })
            : [];
        const declareesTronquees = declareesLues.length > plafondDeclarees;
        const declarees = declareesLues.slice(0, plafondDeclarees);
        const resultat = (0, imputation_paiements_1.imputerPaiements)(factures.map((f) => ({ id: f.id, dateFacture: f.ecriture.date, dateEcheance: f.dateEcheance, montant: Math.abs(sensDe(f)) })), paiements.map((p) => ({ id: p.id, date: p.ecriture.date, montant: Math.abs(sensDe(p)) })), declarees.map((d) => ({ paiementId: d.ligneReglementId, detteId: lecture.reportsVers.get(d.ligneFactureId) ?? d.ligneFactureId, montant: n(d.montant) })));
        const motifNonDesignable = (p) => {
            if (p.ecriture.estGenereeParCloture || p.ecriture.estANouveauProvisoire)
                return (0, imputation_paiements_1.motifReportDePaiement)(null);
            if (!dansLeGroupe(p))
                return 'Paiement d’un autre groupe de lettrage, lu avec ce groupe par la chaîne des reports · il se déclare depuis son groupe.';
            if (etats.get(p.id)?.exerciceClos)
                return (0, imputation_paiements_1.motifPaiementExerciceClos)(p.ecriture.date);
            return null;
        };
        return {
            lettrageId: ligne.lettrageId,
            compte: ligne.compte,
            tronque: false,
            declareesTronquees,
            factures: factures.map((f) => {
                const designee = ligneADesigner.get(f.id) ?? (dansLeGroupe(f) ? f.id : null);
                return {
                    id: f.id,
                    ligneADesigner: designee,
                    reportee: ligneADesigner.has(f.id),
                    libelle: f.ecriture.estGenereeParCloture || f.ecriture.estANouveauProvisoire ? f.libelle || f.ecriture.libelle : f.ecriture.libelle,
                    piece: f.ecriture.numeroPiece ?? null,
                    date: jour(f.ecriture.date),
                    echeance: jour(f.dateEcheance),
                    montant: c(Math.abs(sensDe(f))),
                    imputations: (resultat.parDette.get(f.id) ?? []).map((x) => ({ paiementId: x.paiementId, date: jour(x.date), montant: x.montant, fondement: x.fondement })),
                };
            }),
            paiements: paiements.map((p) => {
                const motif = motifNonDesignable(p);
                return {
                    id: p.id,
                    designable: motif === null,
                    ...(motif ? { motifNonDesignable: motif } : {}),
                    libelle: p.ecriture.libelle,
                    piece: p.ecriture.numeroPiece ?? null,
                    date: jour(p.ecriture.date),
                    montant: c(Math.abs(sensDe(p))),
                    validee: p.ecriture.statut === client_1.StatutEcriture.VALIDEE,
                    declarees: declarees
                        .filter((d) => d.ligneReglementId === p.id)
                        .map((d) => ({ ...d, montant: n(d.montant), pieceDate: jour(d.pieceDate) })),
                };
            }),
            nonImpute: resultat.nonImpute,
        };
    }
};
exports.ImputationsPaiementsService = ImputationsPaiementsService;
exports.ImputationsPaiementsService = ImputationsPaiementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        taux_tva_service_1.TauxTvaService])
], ImputationsPaiementsService);
//# sourceMappingURL=imputations-paiements.service.js.map