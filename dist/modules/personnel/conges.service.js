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
exports.CongesService = exports.libelleAllocation = exports.NATURE_ALLOCATION_CONGE = exports.PLAFOND_CONGES_SALARIE = exports.lireAbsencesPourConges = exports.serviceEnCours = void 0;
exports.tauxJournalierPropose = tauxJournalierPropose;
exports.allocationsAPorter = allocationsAPorter;
exports.lierCongesAuBulletin = lierCongesAuBulletin;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const bareme_smig_1 = require("./bareme-smig");
const bulletin_paie_1 = require("./bulletin-paie");
const comptabilisation_paie_1 = require("./comptabilisation-paie");
const conges_acquis_1 = require("./conges-acquis");
const decompte_final_1 = require("./decompte-final");
const service_du_salarie_1 = require("./service-du-salarie");
Object.defineProperty(exports, "serviceEnCours", { enumerable: true, get: function () { return service_du_salarie_1.serviceEnCours; } });
const absences_lecture_1 = require("./absences-lecture");
Object.defineProperty(exports, "lireAbsencesPourConges", { enumerable: true, get: function () { return absences_lecture_1.lireAbsencesPourConges; } });
const absences_1 = require("./absences");
const echeance_1 = require("../../common/echeance");
const salaire_pendant_le_conge_1 = require("./salaire-pendant-le-conge");
const PLAFOND_BULLETINS_SALARIE = 1_000;
exports.PLAFOND_CONGES_SALARIE = 500;
const NATURES_DE_LA_MOYENNE_142 = new Set(['COMMISSION', 'PRIME', 'PRESTATION_SUPPLEMENTAIRE', 'PARTICIPATION_AUX_BENEFICES']);
exports.NATURE_ALLOCATION_CONGE = 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE';
const iso = (d) => d.toISOString().slice(0, 10);
const nombre = (d) => (d === null ? null : Number(d));
const moisPrecedent = (mois, n) => {
    const [a, m] = mois.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 - n, 1));
    return iso(d).slice(0, 7);
};
function tauxJournalierPropose(contrat) {
    if (!contrat)
        return { valeur: null, motif: 'Aucun contrat ne couvre la date du départ.' };
    if (contrat.remunerationBase === null)
        return { valeur: null, motif: 'Le contrat ne porte pas de rémunération convenue.' };
    if (!contrat.periodiciteRemuneration)
        return { valeur: null, motif: "La périodicité de la rémunération n'est pas renseignée au contrat." };
    if (!contrat.deviseRemuneration)
        return { valeur: null, motif: "La monnaie de la rémunération n'est pas renseignée au contrat." };
    const base = Number(contrat.remunerationBase);
    const diviseur = contrat.periodiciteRemuneration === 'JOUR'
        ? 1
        : bareme_smig_1.MULTIPLICATEURS_ARTICLE_7[contrat.periodiciteRemuneration];
    const valeur = Math.round((base / diviseur) * 100) / 100;
    return {
        valeur,
        devise: contrat.deviseRemuneration,
        explication: diviseur === 1
            ? 'Rémunération journalière du contrat.'
            : `Rémunération du contrat ramenée au jour par ${diviseur} (décret n° 25/22, art. 7, par analogie).`,
    };
}
async function lireFaits(db, tenantId, salarieId, lireAbsences) {
    const salarie = await db.salarie.findFirst({
        where: { id: salarieId, tenantId },
        select: {
            id: true,
            nom: true,
            dateNaissance: true,
            millesimeNaissance: true,
            contrats: {
                select: {
                    id: true,
                    dateEntreeEnVigueur: true,
                    dateFin: true,
                    renouvelleDeId: true,
                    remunerationBase: true,
                    periodiciteRemuneration: true,
                    deviseRemuneration: true,
                },
            },
        },
    });
    if (!salarie)
        throw new common_1.NotFoundException('Salarié introuvable dans ce dossier.');
    const [bulletins, reprise, conges, absences] = await Promise.all([
        db.bulletinPaie.findMany({
            where: { tenantId, salarieId, statut: client_1.StatutBulletinPaie.EMIS },
            select: { id: true, numero: true, moisDePaie: true, nature: true },
            orderBy: { moisDePaie: 'asc' },
            take: PLAFOND_BULLETINS_SALARIE,
        }),
        db.repriseCongesSalarie.findFirst({ where: { tenantId, salarieId } }),
        db.congeSalarie.findMany({
            where: { tenantId, salarieId },
            orderBy: { du: 'asc' },
            take: exports.PLAFOND_CONGES_SALARIE,
            include: { bulletin: { select: { id: true, numero: true, statut: true, moisDePaie: true } } },
        }),
        lireAbsences(db, tenantId, salarieId),
    ]);
    return { salarie, bulletins, reprise, conges, absences };
}
function joursDe(c, joursMaladie) {
    return (0, conges_acquis_1.joursDuConge)({ du: iso(c.du), au: iso(c.au), joursVoyage: c.joursVoyage, joursMaladie });
}
function faitsDuCompteur(f, aLa, sauf) {
    const service = (0, service_du_salarie_1.serviceEnCours)(f.salarie.contrats);
    if (!service)
        return { refus: "Aucun contrat n'est enregistré pour ce salarié · le service ne se compte pas sans lui." };
    const conges = [];
    for (const c of f.conges) {
        if (c.annuleLe || c.id === sauf)
            continue;
        const j = joursDe(c, f.absences.joursMaladie);
        if ('refus' in j)
            return { refus: `Congé du ${iso(c.du)} · ${j.refus}` };
        conges.push({ id: c.id, du: iso(c.du), jours: j.jours });
    }
    return {
        origine: iso(service.origine),
        fin: service.fin ? iso(service.fin) : null,
        dateNaissance: f.salarie.dateNaissance ? iso(f.salarie.dateNaissance) : null,
        millesimeNaissance: f.salarie.millesimeNaissance,
        moisPayes: f.bulletins.map((b) => b.moisDePaie),
        joursHorsService: f.absences.joursHorsService,
        reprise: f.reprise
            ? {
                arreteAu: iso(f.reprise.arreteAu),
                joursNesNonPris: Number(f.reprise.joursNesNonPris),
                moisEnCoursAccomplis: f.reprise.moisEnCoursAccomplis,
            }
            : null,
        conges,
        aLa,
    };
}
function allocationDuConge(c, joursMaladie) {
    const j = joursDe(c, joursMaladie);
    if ('refus' in j)
        return { jours: null, montant: null, tauxJournalier: null, devise: c.deviseAllocation, motif: j.refus };
    const a = (0, decompte_final_1.allocationDeConge)({
        jours: j.jours,
        remunerationJournaliereFc: nombre(c.remunerationJournaliere),
        moyenneMensuelleArticle142Fc: nombre(c.moyenneMensuelleArticle142),
    });
    const motif = a.motif ?? (c.deviseAllocation ? null : "La monnaie de la rémunération n'est pas déclarée au congé.");
    return {
        jours: j.jours,
        ouvrables: j.ouvrables,
        maladie: j.maladie,
        montant: motif ? null : a.montantFc === null ? null : Math.round(a.montantFc * 100) / 100,
        tauxJournalier: a.tauxJournalierFc,
        devise: c.deviseAllocation,
        motif,
    };
}
const porteurActif = (c) => c.bulletin?.statut === client_1.StatutBulletinPaie.EMIS;
async function allocationsAPorter(db, tenantId, salarieId, moisDePaie, congeIds, deviseStipulation, lireAbsences = absences_lecture_1.lireAbsencesPourConges) {
    if (new Set(congeIds).size !== congeIds.length)
        throw new common_1.BadRequestException('Un même congé figure deux fois dans les allocations.');
    const conges = await db.congeSalarie.findMany({
        where: { tenantId, id: { in: [...congeIds] } },
        include: { bulletin: { select: { numero: true, statut: true } } },
    });
    const absences = await lireAbsences(db, tenantId, salarieId);
    const portees = [];
    for (const id of congeIds) {
        const c = conges.find((x) => x.id === id);
        if (!c || c.salarieId !== salarieId)
            throw new common_1.BadRequestException("Congé introuvable pour ce salarié · un bulletin ne porte que les congés du salarié payé.");
        const quand = `Congé du ${iso(c.du)} au ${iso(c.au)}`;
        if (c.annuleLe)
            throw new common_1.BadRequestException(`${quand} · annulé, il ne se paie pas.`);
        if (c.moisDePaie !== moisDePaie) {
            throw new common_1.BadRequestException(`${quand} · son allocation est rattachée au bulletin de ${c.moisDePaie}, pas à celui de ${moisDePaie}.`);
        }
        if (porteurActif(c))
            throw new common_1.BadRequestException(`${quand} · son allocation est déjà portée par le bulletin n° ${c.bulletin.numero}.`);
        const a = allocationDuConge(c, absences.joursMaladie);
        if (a.montant === null || a.jours === null || a.tauxJournalier === null) {
            throw new common_1.BadRequestException(`${quand} · allocation non chiffrée · ${a.motif ?? 'élément manquant'}`);
        }
        if (a.devise !== deviseStipulation) {
            throw new common_1.BadRequestException(`${quand} · l'allocation est en ${a.devise}, le bulletin en ${deviseStipulation} · une seule monnaie par bulletin.`);
        }
        const autres = await (0, salaire_pendant_le_conge_1.confronterLesBulletinsEmis)(db, tenantId, salarieId, {
            id: c.id,
            du: iso(c.du),
            au: iso(c.au),
            joursVoyage: c.joursVoyage,
            remunerationJournaliere: nombre(c.remunerationJournaliere),
            deviseAllocation: c.deviseAllocation,
        }, {
            saufMois: moisDePaie,
            issue: (numero, mois) => `annulez le bulletin n° ${numero} et réémettez le bulletin de ${mois} en reprenant la proposition « Absences et congés du mois », puis portez l'allocation au bulletin de ${moisDePaie}.`,
        });
        if (autres.refus.length)
            throw new common_1.BadRequestException(`${quand} · ${autres.refus.join(' ')}`);
        portees.push({ congeId: c.id, du: iso(c.du), au: iso(c.au), jours: a.jours, tauxJournalier: a.tauxJournalier, devise: a.devise, montant: a.montant });
    }
    return portees;
}
const libelleAllocation = (a) => `Allocation de congé du ${a.du} au ${a.au} · ${a.jours} jour(s) ouvrable(s)`;
exports.libelleAllocation = libelleAllocation;
async function lierCongesAuBulletin(tx, tenantId, bulletinId, portees) {
    for (const a of portees) {
        const c = await tx.congeSalarie.findFirst({
            where: { id: a.congeId, tenantId },
            select: { id: true, annuleLe: true, bulletin: { select: { numero: true, statut: true } } },
        });
        if (!c || c.annuleLe)
            throw new common_1.ConflictException(`Congé du ${a.du} annulé pendant l'émission · rien n'est émis.`);
        if (porteurActif(c))
            throw new common_1.ConflictException(`Congé du ${a.du} porté entre-temps par le bulletin n° ${c.bulletin.numero} · rien n'est émis.`);
        await tx.congeSalarie.update({ where: { id: c.id }, data: { bulletinId } });
    }
}
let CongesService = class CongesService {
    constructor(prisma) {
        this.prisma = prisma;
        this.lireAbsences = absences_lecture_1.lireAbsencesPourConges;
    }
    async compteur(tenantId, salarieId, aLaBrut) {
        const aLa = aLaBrut ? aLaBrut.slice(0, 10) : (0, echeance_1.jourDeKinshasaIso)(new Date());
        if (!(0, conges_acquis_1.jourUtc)(aLa))
            throw new common_1.BadRequestException('La date de lecture du compteur se lit AAAA-MM-JJ.');
        const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
        const faits = faitsDuCompteur(f, aLa);
        const compteur = 'refus' in faits ? faits : (0, conges_acquis_1.compteurConges)(faits);
        const conges = f.conges.map((c) => {
            const a = allocationDuConge(c, f.absences.joursMaladie);
            return {
                id: c.id,
                du: iso(c.du),
                au: iso(c.au),
                joursVoyage: c.joursVoyage,
                moisDePaie: c.moisDePaie,
                deviseAllocation: c.deviseAllocation,
                remunerationJournaliere: nombre(c.remunerationJournaliere),
                moyenneMensuelleArticle142: nombre(c.moyenneMensuelleArticle142),
                auDelaDuSolde: c.auDelaDuSolde,
                motifAuDelaDuSolde: c.motifAuDelaDuSolde,
                annuleLe: c.annuleLe,
                motifAnnulation: c.motifAnnulation,
                bulletin: c.bulletin ? { numero: c.bulletin.numero, statut: c.bulletin.statut, moisDePaie: c.bulletin.moisDePaie } : null,
                paiementAuPlusTard: (0, conges_acquis_1.dernierJourOuvrableAvant)(iso(c.du)),
                allocation: a,
            };
        });
        return {
            aLa,
            compteur,
            reprise: f.reprise
                ? {
                    arreteAu: iso(f.reprise.arreteAu),
                    joursNesNonPris: Number(f.reprise.joursNesNonPris),
                    moisEnCoursAccomplis: f.reprise.moisEnCoursAccomplis,
                    source: f.reprise.source,
                    declarePar: f.reprise.declarePar,
                }
                : null,
            conges,
            tronque: f.conges.length >= exports.PLAFOND_CONGES_SALARIE,
        };
    }
    async propositions(tenantId, salarieId, duBrut) {
        const du = (0, conges_acquis_1.jourUtc)(duBrut.slice(0, 10));
        if (!du)
            throw new common_1.BadRequestException('La date du départ se lit AAAA-MM-JJ.');
        const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
        const contrat = f.salarie.contrats
            .filter((c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= du.getTime()))
            .sort((a, b) => b.dateEntreeEnVigueur.getTime() - a.dateEntreeEnVigueur.getTime())[0] ?? null;
        const taux = tauxJournalierPropose(contrat);
        const moisDepart = iso(du).slice(0, 7);
        const douze = new Set(Array.from({ length: 12 }, (_, i) => moisPrecedent(moisDepart, i + 1)));
        let moyenne;
        if (contrat?.deviseRemuneration && contrat.deviseRemuneration !== 'CDF') {
            moyenne = { valeur: null, motif: 'Le contrat est stipulé hors franc · la moyenne se déclare dans sa monnaie.' };
        }
        else {
            const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
            const bulletins = await this.prisma.bulletinPaie.findMany({
                where: { tenantId, salarieId, statut: client_1.StatutBulletinPaie.EMIS, nature: client_1.NatureBulletinPaie.MOIS, moisDePaie: { in: [...douze] } },
                select: { id: true, numero: true, nomComplet: true, statut: true, ecritureId: true, netAPayerFc: true, entree: true, calcul: true, moisDePaie: true },
                take: 12,
            });
            if (bulletins.length < 12) {
                moyenne = {
                    valeur: null,
                    motif: `${bulletins.length} bulletin(s) émis sur les douze mois précédant le départ · la moyenne de l'article 142, alinéa 2 se déclare.`,
                };
            }
            else {
                let total = 0;
                for (const b of bulletins) {
                    const e = (0, comptabilisation_paie_1.entreeDuBulletin)({ ...b, statut: 'EMIS', netAPayerFc: Number(b.netAPayerFc) }, tenant.referentiel);
                    if (!e) {
                        total = Number.NaN;
                        break;
                    }
                    total += e.elements.filter((x) => NATURES_DE_LA_MOYENNE_142.has(x.nature)).reduce((s, x) => s + x.montantFc, 0);
                }
                moyenne = Number.isNaN(total)
                    ? { valeur: null, motif: 'Un bulletin des douze mois est illisible · la moyenne se déclare.' }
                    : {
                        valeur: Math.round((total / 12) * 100) / 100,
                        explication: 'Commissions, primes, prestations supplémentaires et participation des douze bulletins précédant le départ, divisées par douze.',
                    };
            }
        }
        return { du: iso(du), tauxJournalier: taux, moyenneMensuelleArticle142: moyenne, paiementAuPlusTard: (0, conges_acquis_1.dernierJourOuvrableAvant)(iso(du)) };
    }
    async declarerReprise(tenantId, userEmail, salarieId, dto) {
        const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
        const service = (0, service_du_salarie_1.serviceEnCours)(f.salarie.contrats);
        if (!service)
            throw new common_1.BadRequestException("Aucun contrat n'est enregistré pour ce salarié · la reprise se compte depuis son entrée en service.");
        const arreteAu = dto.arreteAu.slice(0, 10);
        const refus = (0, conges_acquis_1.motifRefusReprise)({
            origine: iso(service.origine),
            arreteAu,
            joursNesNonPris: dto.joursNesNonPris,
            moisEnCoursAccomplis: dto.moisEnCoursAccomplis,
            source: dto.source,
        });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const donnees = {
            arreteAu: new Date(`${arreteAu}T00:00:00.000Z`),
            joursNesNonPris: new client_1.Prisma.Decimal(dto.joursNesNonPris),
            moisEnCoursAccomplis: dto.moisEnCoursAccomplis,
            source: dto.source.trim(),
            declarePar: userEmail,
        };
        if (f.reprise) {
            await this.prisma.repriseCongesSalarie.update({ where: { id: f.reprise.id }, data: donnees });
        }
        else {
            await this.prisma.repriseCongesSalarie.create({ data: { tenantId, salarieId, ...donnees } });
        }
        return this.compteur(tenantId, salarieId);
    }
    async creerConge(tenantId, userEmail, salarieId, dto) {
        if (!(0, bulletin_paie_1.moisValide)(dto.moisDePaie))
            throw new common_1.BadRequestException('Le mois de paie se lit AAAA-MM.');
        const du = (0, conges_acquis_1.jourUtc)(dto.du.slice(0, 10));
        const au = (0, conges_acquis_1.jourUtc)(dto.au.slice(0, 10));
        if (!du || !au)
            throw new common_1.BadRequestException('Les dates du congé se lisent AAAA-MM-JJ.');
        const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
        const couvre = f.salarie.contrats.some((c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= au.getTime()));
        if (!couvre)
            throw new common_1.BadRequestException("Aucun contrat ne couvre le congé du début à la fin · un congé s'exécute pendant le contrat.");
        const chevauche = f.conges.find((c) => !c.annuleLe && c.du.getTime() <= au.getTime() && c.au.getTime() >= du.getTime());
        if (chevauche)
            throw new common_1.BadRequestException(`Le congé chevauche celui du ${iso(chevauche.du)} au ${iso(chevauche.au)}.`);
        const absences = await (0, absences_lecture_1.absencesDuSalarie)(this.prisma, tenantId, salarieId);
        const absenceChevauchee = absences.find((a) => !absences_1.NATURES_ABSENCE[a.nature].maladie && a.du <= iso(au) && a.au >= iso(du));
        if (absenceChevauchee) {
            throw new common_1.BadRequestException(`Le congé chevauche l'absence du ${absenceChevauchee.du} au ${absenceChevauchee.au} (${absences_1.NATURES_ABSENCE[absenceChevauchee.nature].libelle}) · un jour n'a qu'une cause, et seule la maladie survenue pendant un congé s'y déclare (Code du travail, art. 141, al. 4). Annulez ou corrigez l'absence, ou posez le congé hors de ses jours.`);
        }
        const jours = (0, conges_acquis_1.joursDuConge)({ du: iso(du), au: iso(au), joursVoyage: dto.joursVoyage ?? 0, joursMaladie: f.absences.joursMaladie });
        if ('refus' in jours)
            throw new common_1.BadRequestException(jours.refus);
        if (jours.jours <= 0)
            throw new common_1.BadRequestException("Le congé ne compte aucun jour ouvrable · rien ne s'en retranche.");
        this.verifierAllocation(dto, f.salarie.contrats, du);
        const soldeA = (t) => {
            const faits = faitsDuCompteur({ ...f, conges: f.conges.filter((c) => c.du.getTime() < t.getTime()) }, iso(t));
            const compteur = 'refus' in faits ? null : (0, conges_acquis_1.compteurConges)(faits);
            return compteur && !('refus' in compteur) ? compteur.solde : null;
        };
        let solde = soldeA(du);
        let borneePar = null;
        const posterieurs = f.conges.filter((c) => !c.annuleLe && c.du.getTime() > au.getTime()).sort((x, y) => x.du.getTime() - y.du.getTime());
        for (const c of posterieurs) {
            if (solde === null)
                break;
            const j = joursDe(c, f.absences.joursMaladie);
            const soldeDuPosterieur = soldeA(c.du);
            const marge = soldeDuPosterieur === null || 'refus' in j ? null : soldeDuPosterieur - j.jours;
            if (marge === null) {
                solde = null;
                borneePar = c;
            }
            else if (marge < solde) {
                solde = marge;
                borneePar = c;
            }
        }
        const auDela = solde === null || jours.jours > solde;
        if (auDela && dto.auDelaDuSolde !== true) {
            const posterieur = borneePar ? `, compte tenu du congé déjà posé du ${iso(borneePar.du)} au ${iso(borneePar.au)}` : '';
            throw new common_1.BadRequestException(solde === null
                ? `Le solde des congés nés au ${iso(du)} n'est pas chiffré${posterieur} · cochez « Au-delà du solde » et dites pourquoi pour poser ce congé.`
                : `Le congé compte ${jours.jours} jour(s) et le solde des droits nés au ${iso(du)} est de ${Math.max(0, solde)}${posterieur} · le droit naît à l'expiration de l'année de services (article 140, alinéa 3). Cochez « Au-delà du solde » et dites pourquoi pour le poser quand même.`);
        }
        if (dto.auDelaDuSolde && (dto.motifAuDelaDuSolde ?? '').trim().length < 3) {
            throw new common_1.BadRequestException('Un congé au-delà du solde se pose avec son motif.');
        }
        const surLesBulletins = await (0, salaire_pendant_le_conge_1.confronterLesBulletinsEmis)(this.prisma, tenantId, salarieId, {
            du: iso(du),
            au: iso(au),
            joursVoyage: dto.joursVoyage ?? 0,
            remunerationJournaliere: dto.remunerationJournaliere ?? null,
            deviseAllocation: dto.deviseAllocation ?? null,
        }, {
            issue: (numero, mois) => `annulez le bulletin n° ${numero}, posez le congé, puis réémettez le bulletin de ${mois} en reprenant la proposition « Absences et congés du mois ».`,
        });
        if (surLesBulletins.refus.length)
            throw new common_1.BadRequestException(`Congé non posé · ${surLesBulletins.refus.join(' ')}`);
        const cree = await this.prisma.congeSalarie.create({
            data: {
                tenantId,
                salarieId,
                du,
                au,
                joursVoyage: dto.joursVoyage ?? 0,
                moisDePaie: dto.moisDePaie,
                deviseAllocation: dto.deviseAllocation ?? null,
                remunerationJournaliere: dto.remunerationJournaliere ?? null,
                moyenneMensuelleArticle142: dto.moyenneMensuelleArticle142 ?? null,
                auDelaDuSolde: auDela && dto.auDelaDuSolde === true,
                motifAuDelaDuSolde: auDela && dto.auDelaDuSolde ? dto.motifAuDelaDuSolde.trim() : null,
                creePar: userEmail,
            },
            select: { id: true },
        });
        return {
            id: cree.id,
            jours: jours.jours,
            ...(await this.compteur(tenantId, salarieId)),
            avertissements: surLesBulletins.avertissements,
        };
    }
    verifierAllocation(dto, contrats, du) {
        const montantDeclare = dto.remunerationJournaliere !== undefined || dto.moyenneMensuelleArticle142 !== undefined;
        if (montantDeclare && !dto.deviseAllocation)
            throw new common_1.BadRequestException("Un montant de l'allocation se déclare avec sa monnaie.");
        const contrat = contrats
            .filter((c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= du.getTime()))
            .sort((a, b) => b.dateEntreeEnVigueur.getTime() - a.dateEntreeEnVigueur.getTime())[0];
        if (dto.deviseAllocation && contrat?.deviseRemuneration && contrat.deviseRemuneration !== dto.deviseAllocation) {
            throw new common_1.BadRequestException(`La rémunération du contrat est stipulée en ${contrat.deviseRemuneration} · l'allocation se déclare dans la même monnaie.`);
        }
    }
    async modifierAllocation(tenantId, id, dto) {
        const c = await this.prisma.congeSalarie.findFirst({
            where: { id, tenantId },
            include: { bulletin: { select: { numero: true, statut: true } }, salarie: { select: { contrats: true } } },
        });
        if (!c)
            throw new common_1.NotFoundException('Congé introuvable dans ce dossier.');
        if (c.annuleLe)
            throw new common_1.BadRequestException('Ce congé est annulé.');
        if (porteurActif(c)) {
            throw new common_1.BadRequestException(`L'allocation est portée par le bulletin n° ${c.bulletin.numero} · annulez d'abord le bulletin pour la corriger.`);
        }
        this.verifierAllocation(dto, c.salarie.contrats, c.du);
        await this.prisma.congeSalarie.update({
            where: { id: c.id },
            data: {
                deviseAllocation: dto.deviseAllocation ?? null,
                remunerationJournaliere: dto.remunerationJournaliere ?? null,
                moyenneMensuelleArticle142: dto.moyenneMensuelleArticle142 ?? null,
            },
        });
        return this.compteur(tenantId, c.salarieId);
    }
    async annulerConge(tenantId, userEmail, id, motif) {
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const c = await tx.congeSalarie.findFirst({ where: { id, tenantId }, include: { bulletin: { select: { numero: true, statut: true } } } });
            if (!c)
                throw new common_1.NotFoundException('Congé introuvable dans ce dossier.');
            if (c.annuleLe)
                throw new common_1.BadRequestException('Ce congé est déjà annulé.');
            if (porteurActif(c)) {
                throw new common_1.BadRequestException(`L'allocation de ce congé est portée par le bulletin n° ${c.bulletin.numero} · annulez d'abord le bulletin, puis le congé.`);
            }
            const retranches = await (0, salaire_pendant_le_conge_1.bulletinsQuiRetranchentLeConge)(tx, tenantId, c.salarieId, {
                id: c.id,
                du: iso(c.du),
                au: iso(c.au),
                joursVoyage: c.joursVoyage,
            });
            if (retranches.refus.length)
                throw new common_1.BadRequestException(`Congé non annulé · ${retranches.refus.join(' ')}`);
            await tx.congeSalarie.update({ where: { id: c.id }, data: { annuleLe: new Date(), annulePar: userEmail, motifAnnulation: motif.trim() } });
            return { annule: true, salarieId: c.salarieId, avertissements: retranches.avertissements };
        });
    }
    async congesDuMois(tenantId, salarieId, mois) {
        if (!(0, bulletin_paie_1.moisValide)(mois))
            throw new common_1.BadRequestException('Le mois de paie se lit AAAA-MM.');
        const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
        return f.conges
            .filter((c) => !c.annuleLe && c.moisDePaie === mois)
            .map((c) => ({
            id: c.id,
            du: iso(c.du),
            au: iso(c.au),
            portePar: porteurActif(c) ? c.bulletin.numero : null,
            allocation: allocationDuConge(c, f.absences.joursMaladie),
        }));
    }
};
exports.CongesService = CongesService;
exports.CongesService = CongesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CongesService);
//# sourceMappingURL=conges.service.js.map