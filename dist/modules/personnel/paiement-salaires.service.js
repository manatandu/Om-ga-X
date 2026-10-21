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
exports.PaiementSalairesService = exports.PLAFOND_PAIEMENTS_DU_MOIS = exports.PLAFOND_BULLETINS_DU_MOIS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const ordres_virement_service_1 = require("../reglements/ordres-virement.service");
const ribs_tiers_1 = require("../tiers/ribs-tiers");
const passation_paie_1 = require("./passation-paie");
const ouverture_passee_1 = require("../exercice/ouverture-passee");
const paiement_salaires_1 = require("./paiement-salaires");
exports.PLAFOND_BULLETINS_DU_MOIS = 2_000;
exports.PLAFOND_PAIEMENTS_DU_MOIS = 200;
const nombre = (d) => Number(d);
const centimes = (n) => Math.round(n * 100);
const estUnMois = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
function estDoublon(e) {
    for (let x = e, n = 0; x && n < 5; x = x.cause, n++) {
        if (x instanceof client_1.Prisma.PrismaClientKnownRequestError && x.code === 'P2002')
            return true;
    }
    return false;
}
let PaiementSalairesService = class PaiementSalairesService {
    constructor(prisma, ecritures, ordres) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.ordres = ordres;
    }
    async dejaPayes(tenantId, mois) {
        const groupes = await this.prisma.lignePaiementSalaire.groupBy({
            by: ['bulletinId', 'salarieId'],
            where: { tenantId, annuleLe: null, paiement: { moisDePaie: mois } },
            _sum: { montant: true },
        });
        const parBulletin = new Map();
        const parSalarie = new Map();
        for (const g of groupes) {
            const montant = nombre(g._sum.montant ?? 0);
            parBulletin.set(g.bulletinId, (parBulletin.get(g.bulletinId) ?? 0) + montant);
            parSalarie.set(g.salarieId, [...(parSalarie.get(g.salarieId) ?? []), { bulletinId: g.bulletinId, montant }]);
        }
        const autres = (salarieId, bulletinId) => (parSalarie.get(salarieId) ?? []).filter((x) => x.bulletinId !== bulletinId).reduce((n, x) => n + centimes(x.montant), 0) / 100;
        return { parBulletin, autres };
    }
    async proposition(tenantId, mois, coupuresDemandees) {
        if (!estUnMois(mois))
            throw new common_1.BadRequestException('Le mois de paie se lit AAAA-MM.');
        if (coupuresDemandees && coupuresDemandees.length) {
            const refus = (0, paiement_salaires_1.motifRefusCoupures)(coupuresDemandees);
            if (refus)
                throw new common_1.BadRequestException(refus);
        }
        const [bulletins, deja, paiements, journaux, dernierEnEspeces] = await Promise.all([
            this.prisma.bulletinPaie.findMany({
                where: { tenantId, moisDePaie: mois },
                orderBy: { numero: 'asc' },
                take: exports.PLAFOND_BULLETINS_DU_MOIS + 1,
                select: {
                    id: true,
                    numero: true,
                    nature: true,
                    statut: true,
                    salarieId: true,
                    nomComplet: true,
                    netAPayerFc: true,
                    ecritureId: true,
                    remisLe: true,
                    salarie: { select: { modePaiement: true, ribs: { where: { tenantId, estPrincipal: true }, take: 1 } } },
                },
            }),
            this.dejaPayes(tenantId, mois),
            this.prisma.paiementSalaires.findMany({
                where: { tenantId, moisDePaie: mois },
                orderBy: { createdAt: 'desc' },
                take: exports.PLAFOND_PAIEMENTS_DU_MOIS,
                include: {
                    journal: { select: { code: true } },
                    ordreVirement: { select: { numero: true, statut: true } },
                    ecriture: { select: { statut: true, numeroPiece: true } },
                    lignes: { select: { bulletinId: true, nomComplet: true, montant: true, reference: true }, orderBy: { nomComplet: 'asc' } },
                },
            }),
            this.prisma.journal.findMany({
                where: { tenantId, type: 'TRESORERIE', estActif: true },
                orderBy: { code: 'asc' },
                select: { id: true, code: true, intitule: true, compteTresorerie: { select: { numero: true } }, ribsBanque: { select: { devise: true }, take: 1 } },
            }),
            this.prisma.paiementSalaires.findFirst({
                where: { tenantId, mode: client_1.ModePaiementSalaire.ESPECES, billetage: { not: client_1.Prisma.DbNull } },
                orderBy: { createdAt: 'desc' },
                select: { billetage: true },
            }),
        ]);
        const tronque = bulletins.length > exports.PLAFOND_BULLETINS_DU_MOIS;
        const lus = bulletins.slice(0, exports.PLAFOND_BULLETINS_DU_MOIS);
        const aPayer = [];
        const tropPayes = [];
        for (const b of lus) {
            if (b.statut !== 'EMIS' || nombre(b.netAPayerFc) <= 0 || deja.parBulletin.has(b.id))
                continue;
            const dejaPayeAutres = deja.autres(b.salarieId, b.id);
            const r = (0, paiement_salaires_1.resteAPayer)({ id: b.id, salarieId: b.salarieId, netAPayer: nombre(b.netAPayerFc), dejaPayeAutres });
            if (r.tropPaye > 0) {
                tropPayes.push({ bulletinId: b.id, numero: b.numero, salarieId: b.salarieId, nomComplet: b.nomComplet, netAPayer: nombre(b.netAPayerFc), dejaPaye: dejaPayeAutres, excedent: r.tropPaye });
                continue;
            }
            if (r.montant <= 0)
                continue;
            const rib = b.salarie.ribs[0] ?? null;
            aPayer.push({
                bulletinId: b.id,
                numero: b.numero,
                nature: b.nature,
                salarieId: b.salarieId,
                nomComplet: b.nomComplet,
                netAPayer: nombre(b.netAPayerFc),
                dejaPayeAutres,
                montant: r.montant,
                mode: b.salarie.modePaiement,
                rib: rib ? `${rib.banque} · ${(0, ribs_tiers_1.coordonneesImprimees)(rib)}` : null,
                passeAuJournal: b.ecritureId !== null,
                remisLe: b.remisLe,
            });
        }
        const emisParSalarie = new Set(lus.filter((b) => b.statut === 'EMIS').map((b) => b.salarieId));
        const annulesPayes = lus.filter((b) => b.statut !== 'EMIS' && deja.parBulletin.has(b.id) && !emisParSalarie.has(b.salarieId));
        const versementsSansBulletin = annulesPayes.length
            ? await this.versementsDesBulletins(tenantId, annulesPayes.map((b) => ({ id: b.id, numero: b.numero, nomComplet: b.nomComplet })))
            : [];
        const passes = aPayer.filter((l) => l.passeAuJournal);
        const confrontation422 = await this.confronterAu422(tenantId, passes.reduce((n, l) => n + centimes(l.montant), 0) / 100, lus.filter((b) => b.ecritureId !== null && passes.some((l) => l.bulletinId === b.id)).map((b) => b.ecritureId));
        const coupuresProposees = (dernierEnEspeces?.billetage?.coupures ?? []).map(Number);
        const coupures = coupuresDemandees && coupuresDemandees.length ? coupuresDemandees : coupuresProposees;
        const enEspeces = aPayer.filter((l) => l.mode === client_1.ModePaiementSalaire.ESPECES);
        const billetage = coupures.length && enEspeces.length ? (0, paiement_salaires_1.billetageDuPaiement)(enEspeces, coupures) : null;
        return {
            mois,
            echeanceArticle99: (0, paiement_salaires_1.echeanceArticle99)(mois),
            aPayer,
            tropPayes,
            versementsSansBulletin,
            confrontation422,
            tronque,
            paiements: paiements.map((p) => ({
                id: p.id,
                mode: p.mode,
                date: p.date,
                journal: p.journal.code,
                total: nombre(p.total),
                piecePassee: p.piecePassee,
                statutEcriture: p.ecriture?.statut ?? null,
                ordreVirement: p.ordreVirement ? { numero: p.ordreVirement.numero, statut: p.ordreVirement.statut } : null,
                billetage: p.billetage,
                annuleLe: p.annuleLe,
                motifAnnulation: p.motifAnnulation,
                ecritureNegatif: p.ecritureNegatifId !== null,
                lignes: p.lignes.map((l) => ({ ...l, montant: nombre(l.montant) })),
            })),
            journaux: journaux.map((j) => ({
                id: j.id,
                code: j.code,
                intitule: j.intitule,
                compte: j.compteTresorerie?.numero ?? null,
                caisse: (j.compteTresorerie?.numero ?? '').startsWith('57'),
                devise: j.ribsBanque[0]?.devise ?? null,
            })),
            coupuresProposees,
            billetage,
        };
    }
    async versementsDesBulletins(tenantId, bulletins) {
        const lignes = await this.prisma.lignePaiementSalaire.findMany({
            where: { tenantId, annuleLe: null, bulletinId: { in: bulletins.map((b) => b.id) } },
            orderBy: { paiement: { date: 'asc' } },
            take: 500,
            select: { bulletinId: true, montant: true, paiement: { select: { date: true, piecePassee: true } } },
        });
        return bulletins.map((b) => {
            const siens = lignes.filter((l) => l.bulletinId === b.id);
            return {
                bulletinId: b.id,
                numero: b.numero,
                nomComplet: b.nomComplet,
                montant: siens.reduce((n, l) => n + centimes(nombre(l.montant)), 0) / 100,
                pieces: siens.map((l) => ({ date: l.paiement.date, piece: l.paiement.piecePassee })),
            };
        });
    }
    async confronterAu422(tenantId, totalPasse, ecritureIds) {
        if (totalPasse <= 0 || ecritureIds.length === 0)
            return null;
        const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
        if (!tenant)
            return null;
        const ids = [...new Set(ecritureIds)];
        const ecritures = await this.prisma.ecriture.findMany({
            where: { tenantId, id: { in: ids } },
            take: ids.length,
            select: { exercice: { select: { id: true, dateDebut: true, dateFin: true } } },
        });
        if (ecritures.length === 0)
            return null;
        const passation = ecritures.map((e) => e.exercice).sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())[0];
        const suivants = await this.prisma.exercice.findMany({
            where: { tenantId, dateDebut: { gt: passation.dateDebut } },
            orderBy: { dateDebut: 'asc' },
            take: 20,
            select: { id: true, dateDebut: true, dateFin: true },
        });
        const racine = (0, passation_paie_1.compteDuRole)('REMUNERATIONS_DUES', tenant.referentiel).replace(/0+$/, '');
        const solde = async (ecriture) => {
            const s = await this.prisma.ligneEcriture.aggregate({
                where: { compte: { tenantId, numero: { startsWith: racine } }, ecriture: (0, ecritures_de_situation_1.avecStatut)(ecriture) },
                _sum: { debit: true, credit: true },
            });
            return centimes(nombre(s._sum.credit ?? 0)) - centimes(nombre(s._sum.debit ?? 0));
        };
        let soldeCentimes = await solde({ tenantId, exerciceId: passation.id });
        for (const f of suivants) {
            soldeCentimes += (await solde({ tenantId, exerciceId: f.id, estANouveauProvisoire: false })) - (await solde((0, ouverture_passee_1.filtreOuverturePasseeAuPremierJour)(tenantId, f)));
        }
        const soldeLu = soldeCentimes / 100;
        const ecart = (centimes(totalPasse) - soldeCentimes) / 100;
        const dernier = suivants.length ? suivants[suivants.length - 1] : passation;
        return {
            compte: racine,
            solde: soldeLu,
            totalPasse,
            exercice: { debut: passation.dateDebut, fin: dernier.dateFin },
            avertissement: ecart > 0
                ? `Le ${racine} (Personnel, rémunérations dues) ne porte plus que ${soldeLu.toFixed(2)} de rémunérations dues, quand ${totalPasse.toFixed(2)} sont proposés à payer sur des bulletins passés au journal · un salaire a pu être payé hors de ce module (débit du ${racine} saisi à la main). Vérifiez le grand livre du ${racine} avant de payer ; le module ne voit que ses propres paiements.`
                : null,
        };
    }
    async payer(tenantId, userId, email, mois, dto) {
        if (!estUnMois(mois))
            throw new common_1.BadRequestException('Le mois de paie se lit AAAA-MM.');
        const mode = dto.mode;
        const ids = [...new Set(dto.bulletinIds)];
        if (ids.length !== dto.bulletinIds.length)
            throw new common_1.BadRequestException('Un bulletin est donné deux fois.');
        const [tenant, journal, bulletins, deja] = await Promise.all([
            this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } }),
            this.prisma.journal.findFirst({
                where: { id: dto.journalId, tenantId },
                select: {
                    id: true,
                    code: true,
                    type: true,
                    estActif: true,
                    compteTresorerie: { select: { id: true, numero: true } },
                    ribsBanque: { select: { devise: true }, take: 1 },
                },
            }),
            this.prisma.bulletinPaie.findMany({
                where: { tenantId, id: { in: ids } },
                select: { id: true, numero: true, moisDePaie: true, statut: true, salarieId: true, nomComplet: true, netAPayerFc: true, salarie: { select: { modePaiement: true } } },
            }),
            this.dejaPayes(tenantId, mois),
        ]);
        if (!tenant)
            throw new common_1.NotFoundException('Dossier introuvable.');
        const refusJournal = (0, paiement_salaires_1.motifRefusJournalDuPaiement)(mode, journal, journal?.ribsBanque[0]?.devise ?? null);
        if (refusJournal)
            throw new common_1.BadRequestException(refusJournal);
        const lignes = [];
        const refus = [];
        for (const id of ids) {
            const b = bulletins.find((x) => x.id === id);
            if (!b) {
                refus.push(`bulletin ${id} introuvable dans ce dossier`);
                continue;
            }
            const nom = `n° ${b.numero} · ${b.nomComplet}`;
            if (b.moisDePaie !== mois)
                refus.push(`${nom} est du mois ${b.moisDePaie}`);
            else if (b.statut !== 'EMIS')
                refus.push(`${nom} est annulé`);
            else if (deja.parBulletin.has(b.id))
                refus.push(`${nom} est déjà payé`);
            else if (b.salarie.modePaiement !== mode) {
                refus.push(b.salarie.modePaiement
                    ? `${nom} se paie par ${paiement_salaires_1.MODES_PAIEMENT[b.salarie.modePaiement].libelle.toLowerCase()} (mode convenu)`
                    : `${nom} · son mode de paiement n'est pas encore dit (Registre du personnel)`);
            }
            else {
                const r = (0, paiement_salaires_1.resteAPayer)({ id: b.id, salarieId: b.salarieId, netAPayer: nombre(b.netAPayerFc), dejaPayeAutres: deja.autres(b.salarieId, b.id) });
                if (r.tropPaye > 0)
                    refus.push(`${nom} · un bulletin annulé du mois a déjà versé ${r.tropPaye} de plus que ce net`);
                else if (r.montant <= 0)
                    refus.push(`${nom} · rien ne reste à payer`);
                else
                    lignes.push({ bulletinId: b.id, numero: b.numero, salarieId: b.salarieId, nomComplet: b.nomComplet, montant: r.montant });
            }
        }
        if (refus.length)
            throw new common_1.BadRequestException(`Paiement refusé · ${refus.join(' ; ')}.`);
        const reference = (bulletinId) => dto.references?.find((r) => r.bulletinId === bulletinId)?.reference?.trim() || null;
        if (mode === client_1.ModePaiementSalaire.CHEQUE) {
            const refusCheques = (0, paiement_salaires_1.motifRefusReferencesCheques)(lignes.map((l) => ({ nomComplet: l.nomComplet, reference: reference(l.bulletinId) })));
            if (refusCheques)
                throw new common_1.BadRequestException(refusCheques);
        }
        let billetage = null;
        if (mode === client_1.ModePaiementSalaire.ESPECES && dto.coupures && dto.coupures.length) {
            const refusCoupures = (0, paiement_salaires_1.motifRefusCoupures)(dto.coupures);
            if (refusCoupures)
                throw new common_1.BadRequestException(refusCoupures);
            billetage = (0, paiement_salaires_1.billetageDuPaiement)(lignes, dto.coupures);
        }
        const numero422 = (0, passation_paie_1.compteDuRole)('REMUNERATIONS_DUES', tenant.referentiel);
        const compte422 = await this.prisma.compte.findFirst({ where: { tenantId, numero: numero422 }, select: { id: true, typeCompte: true } });
        if (!compte422 || compte422.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL) {
            throw new common_1.BadRequestException(`Le compte ${numero422} (Personnel, rémunérations dues) n'est pas ouvert en imputation dans ce dossier · ouvrez-le au plan comptable.`);
        }
        const preparation = mode === client_1.ModePaiementSalaire.VIREMENT
            ? await this.ordres.preparerSalaries(tenantId, journal.id, lignes.map((l) => ({ id: l.salarieId, nomComplet: l.nomComplet })))
            : null;
        const total = lignes.reduce((n, l) => n + centimes(l.montant), 0) / 100;
        const libelle = (dto.libelle?.trim() || `Salaires ${mois} · ${paiement_salaires_1.MODES_PAIEMENT[mode].libelle.toLowerCase()}`).slice(0, 190);
        const referencePiece = mode === client_1.ModePaiementSalaire.CHEQUE
            ? `Chèques n° ${lignes.map((l) => reference(l.bulletinId)).join(', ')}`.slice(0, 190)
            : `Paiement des salaires ${mois} · ${lignes.length} salarié(s)`;
        try {
            const r = await this.ecritures.creerAvec(tenantId, userId, {
                exerciceId: dto.exerciceId,
                journalId: journal.id,
                date: dto.date,
                libelle,
                reference: referencePiece,
                lignes: [
                    { compteId: compte422.id, libelle, debit: total, credit: 0 },
                    { compteId: journal.compteTresorerie.id, libelle, debit: 0, credit: total },
                ],
            }, async (tx, ecriture) => {
                const e = await tx.ecriture.findFirst({ where: { id: ecriture.id, tenantId }, select: { numeroPiece: true } });
                const piece = `${journal.code} n° ${e?.numeroPiece ?? '·'}`;
                const ordre = preparation
                    ? await this.ordres.creerDans(tx, tenantId, email, journal.id, dto.date, preparation, lignes.map((l) => ({ salarieId: l.salarieId, montant: l.montant, reference: `Salaire ${mois}`, ecritureId: ecriture.id, pieceReglement: piece })))
                    : null;
                return tx.paiementSalaires.create({
                    data: {
                        tenantId,
                        moisDePaie: mois,
                        mode,
                        exerciceId: dto.exerciceId,
                        journalId: journal.id,
                        date: new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`),
                        total: new client_1.Prisma.Decimal(total),
                        ecritureId: ecriture.id,
                        piecePassee: piece,
                        ordreVirementId: ordre?.id ?? null,
                        billetage: billetage ? billetage : client_1.Prisma.DbNull,
                        creePar: userId,
                        lignes: {
                            create: lignes.map((l) => ({
                                tenantId,
                                bulletinId: l.bulletinId,
                                salarieId: l.salarieId,
                                nomComplet: l.nomComplet,
                                montant: new client_1.Prisma.Decimal(l.montant),
                                reference: reference(l.bulletinId),
                            })),
                        },
                    },
                    select: { id: true, total: true, piecePassee: true, ordreVirement: { select: { numero: true } } },
                });
            });
            return { ...r.suite, total: nombre(r.suite.total), billetage };
        }
        catch (e) {
            if (estDoublon(e)) {
                throw new common_1.ConflictException(`Un des bulletins a été payé entre-temps · rien n'est enregistré, relisez la proposition de ${mois}.`);
            }
            throw e;
        }
    }
    async annuler(tenantId, userId, email, id, dto) {
        const p = await this.prisma.paiementSalaires.findFirst({
            where: { id, tenantId },
            include: { exercice: { select: { statut: true } }, ordreVirement: { select: { id: true, statut: true } } },
        });
        if (!p)
            throw new common_1.NotFoundException('Paiement introuvable pour ce dossier.');
        if (p.annuleLe)
            throw new common_1.ConflictException('Ce paiement est déjà annulé.');
        if (p.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("Ce paiement appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).");
        }
        const ecriture = p.ecritureId
            ? await this.prisma.ecriture.findFirst({
                where: { id: p.ecritureId, tenantId },
                select: { id: true, numeroPiece: true, statut: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
            })
            : null;
        if (ecriture) {
            const tenue = (0, lignes_tenues_1.motifLignesTenues)(ecriture.lignes, `la pièce n° ${ecriture.numeroPiece ?? '·'}`, 'annuler le paiement');
            if (tenue)
                throw new common_1.BadRequestException(tenue);
        }
        const motif = dto.motif.trim();
        const maintenant = new Date();
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            if (p.ordreVirement && p.ordreVirement.statut !== client_1.StatutOrdreVirement.ANNULE) {
                await this.ordres.annulerDans(tx, tenantId, p.ordreVirement.id, email, `Paiement des salaires annulé · ${motif}`);
            }
            await tx.paiementSalaires.update({ where: { id: p.id }, data: { ecritureId: null } });
            let negatifId = null;
            if (p.ecritureId) {
                const e = await tx.ecriture.findFirst({ where: { id: p.ecritureId, tenantId }, select: { statut: true } });
                if (!e)
                    throw new common_1.ConflictException("La pièce du paiement n'existe plus · relisez le paiement avant de l'annuler.");
                if (e.statut === client_1.StatutEcriture.BROUILLARD) {
                    await tx.ligneEcriture.deleteMany({ where: { ecritureId: p.ecritureId, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                    const r = await tx.ecriture.deleteMany({ where: { id: p.ecritureId, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                    if (r.count !== 1) {
                        throw new common_1.ConflictException("La pièce du paiement a été validée pendant l'annulation · rien n'est retiré. Relancez l'annulation · validée, elle s'inscrira en négatif.");
                    }
                }
                else {
                    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, p.ecritureId, `Annulation du paiement des salaires · ${motif}`, tx);
                    negatifId = negatif.id;
                }
            }
            await tx.lignePaiementSalaire.updateMany({ where: { tenantId, paiementId: p.id }, data: { annuleLe: maintenant } });
            return tx.paiementSalaires.update({
                where: { id: p.id },
                data: {
                    annuleLe: maintenant,
                    annulePar: userId,
                    motifAnnulation: motif,
                    ecritureId: negatifId ? p.ecritureId : null,
                    ecritureNegatifId: negatifId,
                },
                select: { id: true, annuleLe: true, ecritureNegatifId: true },
            });
        });
    }
};
exports.PaiementSalairesService = PaiementSalairesService;
exports.PaiementSalairesService = PaiementSalairesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        ordres_virement_service_1.OrdresVirementService])
], PaiementSalairesService);
//# sourceMappingURL=paiement-salaires.service.js.map