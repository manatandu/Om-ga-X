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
exports.ExportFpmService = void 0;
exports.familleOuRefus = familleOuRefus;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const prisma_service_1 = require("../../common/prisma.service");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const libelle_exercice_1 = require("../../common/libelle-exercice");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const balance_trois_colonnes_1 = require("../comptabilite/balance-trois-colonnes");
const echeance_1 = require("../../common/echeance");
const periode_extrait_1 = require("../comptabilite/periode-extrait");
const familles_tiers_1 = require("../comptabilite/familles-tiers");
const classeur_en_flux_1 = require("./classeur-en-flux");
const export_service_1 = require("./export.service");
const presentation_fpm_1 = require("./presentation-fpm");
const balance_fpm_1 = require("./balance-fpm");
const FEUILLE_BALANCE = 'Balance';
const MENTION_BROUILLARD = ' · brouillard';
let ExportFpmService = class ExportFpmService {
    constructor(prisma, ecritureService, exportService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
        this.exportService = exportService;
        this.lotExport = classeur_en_flux_1.LOT_EXPORT;
    }
    async contexte(tenantId, exerciceId, periode) {
        const exercice = (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { dateDebut: true, dateFin: true },
        }));
        const [tenant, identite, auBrouillard] = await Promise.all([
            this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
            this.exportService.identiteEtat(tenantId, { exerciceId }),
            this.prisma.ecriture.count({
                where: { tenantId, exerciceId, statut: client_1.StatutEcriture.BROUILLARD, ...(periode ? { date: { lt: periode.finExclue } } : {}) },
            }),
        ]);
        const jourIso = (d) => d.toISOString().slice(0, 10);
        return {
            identite,
            referentiel: tenant.referentiel,
            debut: periode ? periode.du : exercice.dateDebut,
            fin: periode ? periode.au : exercice.dateFin,
            suffixe: `-${(0, libelle_exercice_1.libelleExercice)(exercice)}${periode ? `-du-${jourIso(periode.du)}-au-${jourIso(periode.au)}` : ''}`,
            sousTitre: periode ? `Extrait ${(0, periode_extrait_1.libellePeriode)(periode)}` : 'Complète',
            periode,
            exercice: { debut: exercice.dateDebut, fin: exercice.dateFin },
            mention: auBrouillard > 0
                ? `Brouillard compris · ${auBrouillard.toLocaleString('fr-FR')} écriture${auBrouillard > 1 ? 's' : ''} non validée${auBrouillard > 1 ? 's' : ''}`
                : undefined,
        };
    }
    avecExtrait(ctx, extrait, livre) {
        const numero = `Extrait n° ${extrait.numero}`;
        const etabli = `établi le ${(0, periode_extrait_1.jourFr)((0, echeance_1.jourDeKinshasa)(extrait.etabliLe))}`;
        const exercice = (0, periode_extrait_1.libellePeriode)({ du: ctx.exercice.debut, au: ctx.exercice.fin });
        const precision = livre ? ` · le grand livre de l'exercice est celui ${exercice}` : '';
        return {
            ...ctx,
            identite: { ...ctx.identite, periode: `${numero} · ${(0, periode_extrait_1.libellePeriode)(extrait.periode)}` },
            mention: [`${numero} ${etabli}${precision}`, ctx.mention].filter(Boolean).join(' · '),
        };
    }
    async numeroterSiExtrait(ctx, extrait, livre) {
        if (!extrait)
            return ctx;
        return this.avecExtrait(ctx, await extrait.numeroter(), livre);
    }
    async balanceFpm(tenantId, exerciceId, periode) {
        const { lignes } = await this.ecritureService.balance(tenantId, exerciceId, true, undefined, periode ? { periode } : {});
        return lignes.map((l) => ({
            compteId: l.compteId,
            numero: l.numero,
            intitule: l.intitule,
            classe: l.classe,
            avantDebit: l.reportDebit,
            avantCredit: l.reportCredit,
            mouvementDebit: l.mouvementDebit + l.clotureDebit,
            mouvementCredit: l.mouvementCredit + l.clotureCredit,
            totalDebit: l.totalDebit,
            totalCredit: l.totalCredit,
        }));
    }
    async verifierVolume(tenantId, exerciceId, lignesDeBalance, compteIds, quoi, rechange, periode) {
        const lignesDeGrandLivre = await this.prisma.ligneEcriture.count({
            where: {
                ecriture: { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION, ...(periode ? { AND: [(0, periode_extrait_1.ecrituresDansLaPeriode)(periode)] } : {}) },
                ...(compteIds ? { compteId: { in: compteIds } } : {}),
            },
        });
        const total = lignesDeBalance + lignesDeGrandLivre;
        if (total > classeur_en_flux_1.MAX_LIGNES_EXPORT) {
            throw new common_1.PayloadTooLargeException(`${quoi} : ${total.toLocaleString('fr-FR')} lignes à exporter, au-delà de la limite de ` +
                `${classeur_en_flux_1.MAX_LIGNES_EXPORT.toLocaleString('fr-FR')}. ${rechange}`);
        }
    }
    async parcourirGrandLivre(tenantId, exerciceId, compteIds, filtreComptes, traiter, periode) {
        const dates = periode ? { AND: [(0, periode_extrait_1.ecrituresDansLaPeriode)(periode)] } : {};
        const filtre = { ecriture: { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION, ...dates }, ...(filtreComptes ? { compteId: { in: filtreComptes } } : {}) };
        const comptees = await this.prisma.ligneEcriture.count({ where: filtre });
        let lues = 0;
        let curseur;
        for (;;) {
            const lot = await this.prisma.ligneEcriture.findMany({
                where: { ecriture: { tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION, ...dates }, ...(filtreComptes ? { compteId: { in: filtreComptes } } : {}) },
                include: {
                    compte: { select: { id: true, numero: true, intitule: true } },
                    ecriture: { include: { journal: { select: { code: true } } } },
                },
                ...(0, lecture_par_lots_1.pageApres)(curseur, this.lotExport),
                orderBy: [
                    { compte: { numero: 'asc' } },
                    { ecriture: { date: 'asc' } },
                    { ecriture: { estSoldeDesComptesDeGestion: 'asc' } },
                    { ecriture: { estGenereeParCloture: 'desc' } },
                    { ecriture: { numeroPiece: 'asc' } },
                    { id: 'asc' },
                ],
            });
            lues += lot.length;
            for (const l of lot)
                if (compteIds.has(l.compteId))
                    await traiter(l);
            if (lot.length < this.lotExport)
                break;
            curseur = lot[lot.length - 1].id;
        }
        (0, classeur_en_flux_1.confronterAuDecompte)(lues, comptees, 'Grand livre');
    }
    async parcourirParCompte(tenantId, exerciceId, comptes, filtreComptes, periode, ouvrir, ligne) {
        const rang = new Map(comptes.map((c, i) => [c.compteId, i]));
        const reports = periode
            ? await this.ecritureService.reportsALaVeille({ tenantId, exerciceId, ...ecritures_de_situation_1.HORS_SITUATION }, periode, filtreComptes)
            : new Map();
        let suivant = 0;
        const ouvrirJusqua = async (i) => {
            for (; suivant <= i; suivant++) {
                const c = comptes[suivant];
                if (periode || suivant === i)
                    await ouvrir(c, reports.get(c.compteId) ?? null);
            }
        };
        await this.parcourirGrandLivre(tenantId, exerciceId, new Set(rang.keys()), filtreComptes, async (l) => {
            const i = rang.get(l.compteId);
            if (i < suivant - 1)
                throw new Error(`Grand livre · la ligne ${l.id} arrive après la fermeture de son compte ${l.compte.numero}.`);
            if (i >= suivant)
                await ouvrirJusqua(i);
            await ligne(l);
        }, periode);
        if (periode)
            await ouvrirJusqua(comptes.length - 1);
    }
    async rattachements(tenantId) {
        const r = await this.prisma.tiersCompte.findMany({
            where: { tiers: { tenantId } },
            select: { compteId: true, tiers: { select: { code: true, nom: true } } },
        });
        return new Map(r.map((x) => [x.compteId, x.tiers]));
    }
    async intitulesDesCollectifs(tenantId, racines) {
        if (racines.length === 0)
            return new Map();
        const candidats = racines.flatMap((r) => [r, r.padEnd(8, '0')]);
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, numero: { in: candidats } },
            select: { numero: true, intitule: true },
        });
        const parNumero = new Map(comptes.map((c) => [c.numero, c.intitule]));
        return new Map(racines.map((r) => [r, parNumero.get(r) ?? parNumero.get(r.padEnd(8, '0')) ?? r]));
    }
    ouvrirClasseur(sortie) {
        const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, ...classeur_en_flux_1.OPTIONS_CLASSEUR_EN_FLUX });
        classeur.creator = 'OmegaX';
        classeur.created = new Date();
        return classeur;
    }
    redacteur(feuilleDe, libelleTotal) {
        let bloc = null;
        const livre = { debit: 0, credit: 0 };
        return {
            async ouvrir(numero, nom) {
                await feuilleDe().ajouter({ date: numero, libelle: nom }, { gras: true });
                bloc = { debit: 0, credit: 0, solde: 0 };
            },
            async report(r) {
                if (!bloc)
                    throw new Error('Report de grand livre écrit hors de tout bloc');
                bloc.debit += r.debit;
                bloc.credit += r.credit;
                bloc.solde += r.debit - r.credit;
                await feuilleDe().ajouter({
                    date: r.au,
                    libelle: `Report au ${(0, periode_extrait_1.jourFr)(r.au)}`,
                    debit: (0, presentation_fpm_1.montantFpm)(r.debit),
                    credit: (0, presentation_fpm_1.montantFpm)(r.credit),
                    solde: (0, presentation_fpm_1.montantFpm)(bloc.solde),
                });
            },
            async ligne(l) {
                if (!bloc)
                    throw new Error('Ligne de grand livre écrite hors de tout bloc');
                const debit = Number(l.debit);
                const credit = Number(l.credit);
                bloc.debit += debit;
                bloc.credit += credit;
                bloc.solde += debit - credit;
                const libelle = (l.libelle ?? l.ecriture.libelle) + (l.ecriture.statut === 'VALIDEE' ? '' : MENTION_BROUILLARD);
                await feuilleDe().ajouter({
                    date: l.ecriture.date,
                    journal: l.ecriture.journal.code,
                    piece: l.ecriture.numeroPiece === null ? '' : String(l.ecriture.numeroPiece),
                    libelle,
                    lettre: l.lettre ?? '',
                    debit: (0, presentation_fpm_1.montantFpm)(debit),
                    credit: (0, presentation_fpm_1.montantFpm)(credit),
                    solde: (0, presentation_fpm_1.montantFpm)(bloc.solde),
                });
            },
            async fermer() {
                if (!bloc)
                    return;
                livre.debit += bloc.debit;
                livre.credit += bloc.credit;
                await feuilleDe().ajouter({
                    libelle: libelleTotal,
                    debit: (0, presentation_fpm_1.montantFpm)(bloc.debit),
                    credit: (0, presentation_fpm_1.montantFpm)(bloc.credit),
                    solde: (0, presentation_fpm_1.montantFpm)(bloc.solde),
                }, { gras: true });
                bloc = null;
            },
            totaux: () => ({ debit: (0, balance_fpm_1.arrondi)(livre.debit), credit: (0, balance_fpm_1.arrondi)(livre.credit) }),
        };
    }
    async ecrireFinDeLivre(feuille, livre, balance, precision) {
        await feuille.ajouter({
            libelle: 'Totaux',
            debit: (0, presentation_fpm_1.montantFpm)(livre.debit),
            credit: (0, presentation_fpm_1.montantFpm)(livre.credit),
            solde: (0, presentation_fpm_1.montantFpm)(livre.debit - livre.credit),
        }, { gras: true, filetHaut: true });
        await this.ecrireControleLivre(feuille, livre, balance, precision);
    }
    async ecrireControleLivre(feuille, livre, balance, precision) {
        const solde = (d, c) => (0, presentation_fpm_1.montantFpm)(d - c);
        await feuille.ajouter({
            libelle: 'Solde à la balance générale',
            debit: (0, presentation_fpm_1.montantFpm)(balance.debit),
            credit: (0, presentation_fpm_1.montantFpm)(balance.credit),
            solde: solde(balance.debit, balance.credit),
        });
        const ecart = { debit: (0, balance_fpm_1.arrondi)(livre.debit - balance.debit), credit: (0, balance_fpm_1.arrondi)(livre.credit - balance.credit) };
        const nul = ecart.debit === 0 && ecart.credit === 0;
        await feuille.ajouter({
            libelle: nul ? 'Écart : aucun' : `Écart${precision}`,
            debit: (0, presentation_fpm_1.montantFpm)(ecart.debit),
            credit: (0, presentation_fpm_1.montantFpm)(ecart.credit),
            solde: solde(ecart.debit, ecart.credit),
        }, { gras: !nul });
    }
    async balanceGeneraleEnFlux(tenantId, exerciceId, avecGrandsLivres, ouvrir, extrait) {
        const periode = extrait?.periode;
        const lu = await this.contexte(tenantId, exerciceId, periode);
        const lignes = await this.balanceFpm(tenantId, exerciceId, periode);
        if (avecGrandsLivres) {
            await this.verifierVolume(tenantId, exerciceId, lignes.length * (periode ? 2 : 1), null, 'Balance avec le grand livre de chaque compte', "Exportez la balance seule (choix « Balance seule » à l'écran), puis le grand livre compte par compte.", periode);
        }
        const intitulesDivisions = await this.intitulesDesDivisions(tenantId, (0, balance_fpm_1.divisionsDeLaClasse9)(lignes));
        const ctx = await this.numeroterSiExtrait(lu, extrait, avecGrandsLivres);
        const noms = avecGrandsLivres ? (0, presentation_fpm_1.nomsDeFeuilles)(lignes.map((l) => l.numero), [FEUILLE_BALANCE]) : [];
        const feuilleDe = new Map(lignes.map((l, i) => [l.compteId, noms[i]]));
        const sortie = ouvrir(`balance${ctx.suffixe}.xlsx`);
        const classeur = this.ouvrirClasseur(sortie);
        const feuille = (0, presentation_fpm_1.poserFeuilleFpm)(classeur, sortie, {
            nomFeuille: FEUILLE_BALANCE,
            titre: 'Balance des comptes',
            sousTitre: ctx.sousTitre,
            identite: ctx.identite,
            mention: ctx.mention,
            debut: ctx.debut,
            fin: ctx.fin,
            colonnes: presentation_fpm_1.COLONNES_BALANCE_FPM,
            entetes: (0, presentation_fpm_1.entetesBalanceFpm)(ctx.debut, 'Numéro de compte', 'Intitulé des comptes'),
            lignesEntete: 2,
        });
        const { ligneDuCompte } = await (0, balance_fpm_1.ecrireCorpsBalance)(feuille, lignes, intitulesDivisions, feuilleDe);
        feuille.fermer();
        let lignesEcrites = lignes.length;
        if (avecGrandsLivres) {
            lignesEcrites += await this.feuillesParCompte(classeur, sortie, tenantId, exerciceId, ctx, lignes.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.intitule, totalDebit: l.totalDebit, totalCredit: l.totalCredit })), null, feuilleDe, ligneDuCompte, { titre: 'Grand-livre des comptes', sousTitre: ctx.sousTitre, totalBloc: 'Total du compte' });
        }
        await classeur.commit();
        return { lignes: lignesEcrites };
    }
    async intitulesDesDivisions(tenantId, divisions) {
        if (divisions.length === 0)
            return new Map();
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId, numero: { in: divisions } },
            select: { numero: true, intitule: true },
        });
        return new Map(comptes.map((c) => [c.numero, c.intitule]));
    }
    async feuillesParCompte(classeur, sortie, tenantId, exerciceId, ctx, comptes, filtreComptes, feuilleDe, ligneDuCompte, textes) {
        const nomDe = new Map(comptes.map((c) => [c.compteId, c.nom]));
        const balanceDe = new Map(comptes.map((c) => [c.compteId, { debit: (0, balance_fpm_1.arrondi)(c.totalDebit), credit: (0, balance_fpm_1.arrondi)(c.totalCredit) }]));
        let courante = null;
        let compteCourant = null;
        let redacteur = null;
        let nb = 0;
        const fermer = async () => {
            if (redacteur && courante && compteCourant) {
                await redacteur.fermer();
                await this.ecrireControleLivre(courante, redacteur.totaux(), balanceDe.get(compteCourant), '');
            }
            courante?.fermer();
        };
        await this.parcourirParCompte(tenantId, exerciceId, comptes, filtreComptes, ctx.periode, async (c, report) => {
            await fermer();
            compteCourant = c.compteId;
            const feuille = (0, presentation_fpm_1.poserFeuilleFpm)(classeur, sortie, {
                nomFeuille: feuilleDe.get(c.compteId) ?? c.numero,
                titre: textes.titre,
                sousTitre: textes.sousTitre,
                identite: ctx.identite,
                mention: ctx.mention,
                debut: ctx.debut,
                fin: ctx.fin,
                colonnes: presentation_fpm_1.COLONNES_GRAND_LIVRE_FPM,
                entetes: presentation_fpm_1.ENTETES_GRAND_LIVRE_FPM,
                lignesEntete: 1,
                retour: (0, presentation_fpm_1.formuleLien)(FEUILLE_BALANCE, `A${ligneDuCompte.get(c.compteId) ?? 1}`, 'Retour à la balance'),
            });
            courante = feuille;
            redacteur = this.redacteur(() => feuille, textes.totalBloc);
            await redacteur.ouvrir(c.numero, nomDe.get(c.compteId) ?? c.numero);
            if (report) {
                await redacteur.report(report);
                nb++;
            }
        }, async (l) => {
            await redacteur.ligne(l);
            nb++;
        });
        await fermer();
        return nb;
    }
    async perimetreTiers(tenantId, exerciceId, famille) {
        const [lignes, rattaches] = await Promise.all([this.balanceFpm(tenantId, exerciceId), this.rattachements(tenantId)]);
        const retenues = lignes
            .filter((l) => (0, familles_tiers_1.compteDeLaFamille)(famille, l.numero, rattaches.has(l.compteId)))
            .map((l) => {
            const tiers = rattaches.get(l.compteId);
            return { ...l, nom: tiers ? tiers.nom : `${l.intitule} · aucun tiers rattaché` };
        });
        const racines = [...new Set(retenues.map((l) => l.numero.slice(0, 3)))];
        return { retenues, racines };
    }
    async soldesDesCollectifs(tenantId, exerciceId, famille, racines) {
        const prefixes = famille === 'AUTRES' ? racines : [(0, familles_tiers_1.divisionnaireDeLaFamille)(famille)];
        if (prefixes.length === 0)
            return { avantDebit: 0, avantCredit: 0, mouvementDebit: 0, mouvementCredit: 0, solde: 0 };
        const filtres = (0, balance_trois_colonnes_1.filtresDesTroisColonnes)({ tenantId, exerciceId });
        const compte = { OR: prefixes.map((p) => ({ numero: { startsWith: p } })) };
        const somme = (colonne) => this.prisma.ligneEcriture.aggregate({ where: { ecriture: filtres[colonne], compte }, _sum: { debit: true, credit: true } });
        const [r, m, c] = await Promise.all([somme('reports'), somme('mouvements'), somme('clotures')]);
        const n = (v) => Number(v ?? 0);
        const avantDebit = n(r._sum.debit);
        const avantCredit = n(r._sum.credit);
        const mouvementDebit = n(m._sum.debit) + n(c._sum.debit);
        const mouvementCredit = n(m._sum.credit) + n(c._sum.credit);
        return {
            avantDebit: (0, balance_fpm_1.arrondi)(avantDebit),
            avantCredit: (0, balance_fpm_1.arrondi)(avantCredit),
            mouvementDebit: (0, balance_fpm_1.arrondi)(mouvementDebit),
            mouvementCredit: (0, balance_fpm_1.arrondi)(mouvementCredit),
            solde: (0, balance_fpm_1.arrondi)(avantDebit + mouvementDebit - avantCredit - mouvementCredit),
        };
    }
    async balanceTiersEnFlux(tenantId, exerciceId, famille, avecGrandsLivres, ouvrir) {
        const ctx = await this.contexte(tenantId, exerciceId);
        const { retenues, racines } = await this.perimetreTiers(tenantId, exerciceId, famille);
        const ids = retenues.map((l) => l.compteId);
        if (avecGrandsLivres) {
            await this.verifierVolume(tenantId, exerciceId, retenues.length + racines.length + 4, ids, 'Balance des tiers avec le grand livre de chaque tiers', "Exportez la balance des tiers seule (choix « Balance seule » à l'écran), puis le grand-livre des tiers.");
        }
        const intitules = await this.intitulesDesCollectifs(tenantId, racines);
        const noms = avecGrandsLivres ? (0, presentation_fpm_1.nomsDeFeuilles)(retenues.map((l) => l.numero), [FEUILLE_BALANCE]) : [];
        const feuilleDe = new Map(retenues.map((l, i) => [l.compteId, noms[i]]));
        const sousTitre = (0, familles_tiers_1.sousTitreFamille)(famille, ctx.referentiel);
        const sortie = ouvrir(`balance-tiers-${famille.toLowerCase()}${ctx.suffixe}.xlsx`);
        const classeur = this.ouvrirClasseur(sortie);
        const feuille = (0, presentation_fpm_1.poserFeuilleFpm)(classeur, sortie, {
            nomFeuille: FEUILLE_BALANCE,
            titre: 'Balance des tiers',
            sousTitre,
            identite: ctx.identite,
            mention: ctx.mention,
            debut: ctx.debut,
            fin: ctx.fin,
            colonnes: presentation_fpm_1.COLONNES_BALANCE_FPM,
            entetes: (0, presentation_fpm_1.entetesBalanceFpm)(ctx.debut, 'Numéro de compte', 'Tiers'),
            lignesEntete: 2,
        });
        const ligneDuCompte = new Map();
        const rangsSousTotaux = [];
        for (const racine of racines) {
            const groupe = retenues.filter((l) => l.numero.startsWith(racine));
            const rangs = [];
            for (const l of groupe) {
                const r = await (0, balance_fpm_1.ecrireLigneDeCompte)(feuille, l, l.nom, feuilleDe.get(l.compteId));
                ligneDuCompte.set(l.compteId, r);
                rangs.push(r);
            }
            rangsSousTotaux.push(await (0, balance_fpm_1.ecrireTotal)(feuille, `Total ${intitules.get(racine) ?? racine}`, (0, balance_fpm_1.totauxBalance)(groupe), (0, balance_fpm_1.plageBalance)(rangs[0], rangs[rangs.length - 1])));
        }
        const tGeneral = (0, balance_fpm_1.totauxBalance)(retenues);
        await (0, balance_fpm_1.ecrireTotal)(feuille, 'Total général', tGeneral, (col) => rangsSousTotaux.length === 0 ? '0' : rangsSousTotaux.map((r) => `${col}${r}`).join('+'));
        const tBalance = await this.soldesDesCollectifs(tenantId, exerciceId, famille, racines);
        await this.ecrireControle(feuille, tBalance, (0, balance_fpm_1.ecartBalance)(tGeneral, tBalance));
        feuille.fermer();
        let lignesEcrites = retenues.length;
        if (avecGrandsLivres) {
            lignesEcrites += await this.feuillesParCompte(classeur, sortie, tenantId, exerciceId, ctx, retenues.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.nom, totalDebit: l.totalDebit, totalCredit: l.totalCredit })), ids, feuilleDe, ligneDuCompte, { titre: 'Grand-livre des tiers', sousTitre, totalBloc: 'Total du tiers' });
        }
        await classeur.commit();
        return { lignes: lignesEcrites };
    }
    async ecrireControle(feuille, balance, ecart) {
        const valeurs = (t) => {
            const s = (0, presentation_fpm_1.soldeEnDeuxColonnes)(t.solde);
            return {
                avantDebit: (0, presentation_fpm_1.montantFpm)(t.avantDebit),
                avantCredit: (0, presentation_fpm_1.montantFpm)(t.avantCredit),
                mouvementDebit: (0, presentation_fpm_1.montantFpm)(t.mouvementDebit),
                mouvementCredit: (0, presentation_fpm_1.montantFpm)(t.mouvementCredit),
                soldeDebit: s.debit,
                soldeCredit: s.credit,
            };
        };
        await feuille.ajouter({ intitule: 'Solde à la balance générale', ...valeurs(balance) }, { filetHaut: true });
        const nul = (0, balance_fpm_1.estNulBalance)(ecart);
        await feuille.ajouter({
            intitule: nul ? 'Écart : aucun' : 'Écart avec la balance générale',
            avantDebit: (0, presentation_fpm_1.montantFpm)(ecart.avantDebit),
            avantCredit: (0, presentation_fpm_1.montantFpm)(ecart.avantCredit),
            mouvementDebit: (0, presentation_fpm_1.montantFpm)(ecart.mouvementDebit),
            mouvementCredit: (0, presentation_fpm_1.montantFpm)(ecart.mouvementCredit),
            ...(() => {
                const s = (0, presentation_fpm_1.soldeEnDeuxColonnes)(ecart.solde);
                return { soldeDebit: s.debit, soldeCredit: s.credit };
            })(),
        }, { gras: !nul });
    }
    async grandLivreEnFlux(tenantId, exerciceId, ouvrir, options = {}) {
        const periode = options.extrait?.periode;
        const lu = await this.contexte(tenantId, exerciceId, periode);
        const toutes = await this.balanceFpm(tenantId, exerciceId, periode);
        const lignes = options.compteId ? toutes.filter((l) => l.compteId === options.compteId) : toutes;
        if (options.compteId && lignes.length === 0) {
            const compte = await this.prisma.compte.findFirst({ where: { id: options.compteId, tenantId }, select: { numero: true } });
            if (!compte)
                throw new common_1.NotFoundException('Compte introuvable dans ce dossier.');
            throw new common_1.BadRequestException(`Aucun mouvement sur le compte ${compte.numero} ${periode ? `jusqu'au ${(0, periode_extrait_1.jourFr)(periode.au)}` : 'dans cet exercice'} · rien à exporter.`);
        }
        const filtreComptes = options.compteId ? [options.compteId] : null;
        await this.verifierVolume(tenantId, exerciceId, periode ? lignes.length : 0, filtreComptes, 'Grand livre', 'Exportez la balance seule, puis le grand livre compte par compte.', periode);
        const balance = {
            debit: (0, balance_fpm_1.arrondi)(lignes.reduce((s, l) => s + l.totalDebit, 0)),
            credit: (0, balance_fpm_1.arrondi)(lignes.reduce((s, l) => s + l.totalCredit, 0)),
        };
        const ctx = await this.numeroterSiExtrait(lu, options.extrait, true);
        const seul = options.compteId ? lignes[0] : null;
        return this.grandLivreSurUneFeuille(tenantId, exerciceId, ctx, lignes.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.intitule })), filtreComptes, balance, {
            fichier: `grand-livre${seul ? `-${seul.numero}` : ''}${ctx.suffixe}.xlsx`,
            titre: 'Grand-livre des comptes',
            sousTitre: seul ? (ctx.periode ? `${ctx.sousTitre} · compte ${seul.numero}` : `Compte ${seul.numero} · exercice entier`) : ctx.sousTitre,
            totalBloc: 'Total du compte',
            precision: '',
        }, ouvrir);
    }
    async grandLivreTiersEnFlux(tenantId, exerciceId, famille, ouvrir) {
        const ctx = await this.contexte(tenantId, exerciceId);
        const { retenues, racines } = await this.perimetreTiers(tenantId, exerciceId, famille);
        const ids = retenues.map((l) => l.compteId);
        await this.verifierVolume(tenantId, exerciceId, 0, ids, 'Grand-livre des tiers', 'Exportez la balance des tiers seule, puis le grand livre tiers par tiers.');
        const collectifs = await this.soldesDesCollectifs(tenantId, exerciceId, famille, racines);
        const balance = {
            debit: (0, balance_fpm_1.arrondi)(collectifs.avantDebit + collectifs.mouvementDebit),
            credit: (0, balance_fpm_1.arrondi)(collectifs.avantCredit + collectifs.mouvementCredit),
        };
        return this.grandLivreSurUneFeuille(tenantId, exerciceId, ctx, retenues.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.nom })), ids, balance, {
            fichier: `grand-livre-tiers-${famille.toLowerCase()}${ctx.suffixe}.xlsx`,
            titre: 'Grand-livre des tiers',
            sousTitre: (0, familles_tiers_1.sousTitreFamille)(famille, ctx.referentiel),
            totalBloc: 'Total du tiers',
            precision: famille === 'AUTRES' ? ' (comptes des collectifs sans tiers rattaché)' : '',
        }, ouvrir);
    }
    async grandLivreSurUneFeuille(tenantId, exerciceId, ctx, comptes, filtreComptes, balance, textes, ouvrir) {
        const nomDe = new Map(comptes.map((c) => [c.compteId, c.nom]));
        const sortie = ouvrir(textes.fichier);
        const classeur = this.ouvrirClasseur(sortie);
        const feuille = (0, presentation_fpm_1.poserFeuilleFpm)(classeur, sortie, {
            nomFeuille: textes.titre,
            titre: textes.titre,
            sousTitre: textes.sousTitre,
            identite: ctx.identite,
            mention: ctx.mention,
            debut: ctx.debut,
            fin: ctx.fin,
            colonnes: presentation_fpm_1.COLONNES_GRAND_LIVRE_FPM,
            entetes: presentation_fpm_1.ENTETES_GRAND_LIVRE_FPM,
            lignesEntete: 1,
        });
        const redacteur = this.redacteur(() => feuille, textes.totalBloc);
        let compteCourant = null;
        let nb = 0;
        await this.parcourirParCompte(tenantId, exerciceId, comptes, filtreComptes, ctx.periode, async (c, report) => {
            if (compteCourant)
                await redacteur.fermer();
            compteCourant = c.compteId;
            await redacteur.ouvrir(c.numero, nomDe.get(c.compteId) ?? c.numero);
            if (report) {
                await redacteur.report(report);
                nb++;
            }
        }, async (l) => {
            await redacteur.ligne(l);
            nb++;
        });
        if (compteCourant)
            await redacteur.fermer();
        await this.ecrireFinDeLivre(feuille, redacteur.totaux(), balance, textes.precision);
        feuille.fermer();
        await classeur.commit();
        return { lignes: nb };
    }
};
exports.ExportFpmService = ExportFpmService;
exports.ExportFpmService = ExportFpmService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        export_service_1.ExportService])
], ExportFpmService);
function familleOuRefus(brut) {
    if ((0, familles_tiers_1.estFamilleTiers)(brut))
        return brut;
    throw new common_1.BadRequestException('Type de tiers à préciser · FOURNISSEURS (40), CLIENTS (41), SALARIES (42) ou AUTRES (autres comptes de tiers de la classe 4). Un classeur porte une seule famille.');
}
//# sourceMappingURL=export-fpm.service.js.map