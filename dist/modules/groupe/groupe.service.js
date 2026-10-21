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
var GroupeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupeService = void 0;
const common_1 = require("@nestjs/common");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const fondement_elimination_1 = require("./fondement-elimination");
const courriel_1 = require("../../common/courriel");
const exceljs_1 = require("exceljs");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const numerotation_piece_1 = require("../journaux/numerotation-piece");
const ouverture_passee_1 = require("../exercice/ouverture-passee");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const auth_service_1 = require("../auth/auth.service");
const export_service_1 = require("../exports/export.service");
const contexte_cloisonnement_1 = require("../../common/cloisonnement/contexte-cloisonnement");
const canevas_tresorerie_1 = require("./canevas-tresorerie");
const licence_de_cellule_1 = require("../licence/licence-de-cellule");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const lecture_des_dossiers_1 = require("./lecture-des-dossiers");
const libelle_exercice_1 = require("../../common/libelle-exercice");
const exercice_requis_1 = require("../../common/exercice-requis");
const aucunePartHorsMouvement = () => ({
    reportDebit: 0,
    reportCredit: 0,
    clotureDebit: 0,
    clotureCredit: 0,
});
const MOTIF_CREANCE_DETTE = 'Créance ou dette réciproque';
const MOTIF_CHARGE_PRODUIT = 'Charge ou produit réciproque';
const MOTIF_LIAISON_ETABLISSEMENTS = 'Compte de liaison siège / établissement';
const PREFIXES_LIAISON_ETABLISSEMENTS = ['184', '185', '186', '187'];
const estLiaisonEtablissement = (numero) => PREFIXES_LIAISON_ETABLISSEMENTS.some((p) => numero.startsWith(p));
let GroupeService = GroupeService_1 = class GroupeService {
    constructor(prisma, ecritureService, authService, exportService) {
        this.prisma = prisma;
        this.ecritureService = ecritureService;
        this.authService = authService;
        this.exportService = exportService;
    }
    async assurerDossierCombinaison(tenantId) {
        const mere = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { nom: true, dossierCombinaisonId: true, referentiel: true, systemeComptableSyscohada: true, jeuEtatsFinanciersSycebnl: true },
        });
        const caracteres = GroupeService_1.caracteresCombinaison(mere);
        if (mere?.dossierCombinaisonId) {
            await this.prisma.tenant.update({ where: { id: mere.dossierCombinaisonId }, data: caracteres });
            return mere.dossierCombinaisonId;
        }
        const combinaison = await this.prisma.tenant.create({
            data: { nom: `${mere.nom} · liasse du groupe`, ...caracteres },
            select: { id: true },
        });
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { dossierCombinaisonId: combinaison.id },
        });
        return combinaison.id;
    }
    static partsHorsMouvement(l) {
        return {
            reportDebit: Number(l.reportDebit ?? 0),
            reportCredit: Number(l.reportCredit ?? 0),
            clotureDebit: Number(l.clotureDebit ?? 0),
            clotureCredit: Number(l.clotureCredit ?? 0),
        };
    }
    static colonnesDeCombinaison(lignes) {
        const arrondi = (x) => Math.round(x * 100) / 100;
        const ligne = (numero, debit, credit) => {
            const d = arrondi(debit);
            const c = arrondi(credit);
            return { numero, debit: Math.max(d, 0) + Math.max(-c, 0), credit: Math.max(c, 0) + Math.max(-d, 0) };
        };
        const nonNulle = (l) => l.debit !== 0 || l.credit !== 0;
        return {
            report: lignes.map((l) => ligne(l.numero, l.reportDebit, l.reportCredit)).filter(nonNulle),
            mouvement: lignes
                .map((l) => ligne(l.numero, l.totalDebit - l.reportDebit - l.clotureDebit, l.totalCredit - l.reportCredit - l.clotureCredit))
                .filter(nonNulle),
            cloture: lignes.map((l) => ligne(l.numero, l.clotureDebit, l.clotureCredit)).filter(nonNulle),
        };
    }
    static caracteresCombinaison(mere) {
        if (mere.referentiel === client_1.Referentiel.SYSCOHADA) {
            return {
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: mere.systemeComptableSyscohada ?? client_1.SystemeComptableSyscohada.NORMAL,
            };
        }
        return {
            referentiel: client_1.Referentiel.SYCEBNL,
            jeuEtatsFinanciersSycebnl: mere.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT
                ? client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT
                : client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
            systemeComptableSyscohada: null,
        };
    }
    async virements585DuGroupe(tenantId, dateArrete) {
        const dossier = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { dossierMereId: true } });
        const mere = dossier?.dossierMereId ?? tenantId;
        const membres = (await this.prisma.tenant.findMany({
            where: { OR: [{ id: mere }, { dossierMereId: mere }] },
            select: { id: true },
        })).map((m) => m.id);
        return (0, contexte_cloisonnement_1.perimetreDeGroupe)(membres, async () => {
            const exercices = await this.prisma.exercice.findMany({
                where: { tenantId: { in: membres }, dateDebut: { lte: dateArrete } },
                select: { id: true, tenantId: true, dateDebut: true, statut: true },
                orderBy: { dateDebut: 'asc' },
            });
            const lire585 = async (membre, exerciceId) => {
                const a = await this.prisma.ligneEcriture.aggregate({
                    where: {
                        compte: { tenantId: membre, numero: { startsWith: '585' }, virementFonds: { is: null } },
                        ecriture: {
                            tenantId: membre,
                            exerciceId,
                            date: { lte: dateArrete },
                            statut: client_1.StatutEcriture.VALIDEE,
                            estSoldeDesComptesDeGestion: false,
                        },
                    },
                    _sum: { debit: true, credit: true },
                });
                return Number(a._sum.debit ?? 0) - Number(a._sum.credit ?? 0);
            };
            const ouvertureValidee = async (membre, exercice) => (await (0, ouverture_passee_1.ouverturePasseeNonNulle)(this.prisma, membre, exercice, { validees: true })) !== null;
            let total = 0;
            for (const membre of membres) {
                const siens = exercices.filter((e) => e.tenantId === membre);
                let i = siens.length - 1;
                if (i < 0)
                    continue;
                total += await lire585(membre, siens[i].id);
                while (i > 0 && siens[i - 1].statut !== client_1.StatutExercice.CLOTURE && !(await ouvertureValidee(membre, siens[i]))) {
                    i -= 1;
                    total += await lire585(membre, siens[i].id);
                }
            }
            return { solde: Math.round(total * 100) / 100 };
        });
    }
    async dansLeGroupe(tenantId, suite) {
        const [cellules, siege] = await Promise.all([
            this.prisma.tenant.findMany({ where: { dossierMereId: tenantId }, select: { id: true } }),
            this.prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { dossierCombinaisonId: true },
            }),
        ]);
        const perimetre = [tenantId, ...cellules.map((c) => c.id)];
        if (siege?.dossierCombinaisonId)
            perimetre.push(siege.dossierCombinaisonId);
        return (0, contexte_cloisonnement_1.perimetreDeGroupe)(perimetre, suite);
    }
    async cellules(tenantId) {
        const [mere, cellules] = await Promise.all([
            this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { plafondCellules: true } }),
            this.prisma.tenant.findMany({
                where: { dossierMereId: tenantId },
                orderBy: { nom: 'asc' },
                select: {
                    id: true,
                    nom: true,
                    jeuEtatsFinanciersSycebnl: true,
                    ville: true,
                    _count: { select: { ecritures: true } },
                },
            }),
        ]);
        return {
            plafondCellules: mere?.plafondCellules ?? null,
            peutCreerCellule: mere?.plafondCellules !== null && cellules.length < (mere?.plafondCellules ?? 0),
            cellules: cellules.map((c) => ({
                id: c.id,
                nom: c.nom,
                jeuEtatsFinanciersSycebnl: c.jeuEtatsFinanciersSycebnl,
                ville: c.ville,
                nbEcritures: c._count.ecritures,
            })),
        };
    }
    async creerCellule(tenantId, dto) {
        const mere = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                dossierMereId: true,
                plafondCellules: true,
                referentiel: true,
                systemeComptableSyscohada: true,
                licence: { select: { type: true, statut: true, dateExpiration: true } },
                _count: { select: { cellules: true } },
            },
        });
        if (!mere || mere.dossierMereId !== null) {
            throw new common_1.BadRequestException('Seul un dossier mère peut créer des cellules');
        }
        const licence = (0, licence_de_cellule_1.licenceDeCellule)(mere.licence);
        if (mere.plafondCellules === null) {
            throw new common_1.BadRequestException("La création de cellules n'est pas activée pour ce dossier · rapprochez-vous de VMG Consulting");
        }
        if (mere._count.cellules >= mere.plafondCellules) {
            throw new common_1.BadRequestException(`Plafond de ${mere.plafondCellules} cellules atteint · rapprochez-vous de VMG Consulting pour l'augmenter`);
        }
        const motDePasseTemporaire = (0, crypto_1.randomBytes)(12).toString('base64url');
        const resultat = await this.authService.register({
            nomEntite: dto.nom,
            referentiel: mere.referentiel,
            email: dto.emailAdmin,
            motDePasse: motDePasseTemporaire,
            jeuEtatsFinanciersSycebnl: mere.referentiel === client_1.Referentiel.SYCEBNL ? dto.jeuEtatsFinanciersSycebnl : undefined,
            systemeComptableSyscohada: mere.referentiel === client_1.Referentiel.SYSCOHADA
                ? (mere.systemeComptableSyscohada ?? client_1.SystemeComptableSyscohada.NORMAL)
                : undefined,
            typeLicence: licence?.type,
        });
        await this.prisma.tenant.update({
            where: { id: resultat.tenant.id },
            data: { dossierMereId: tenantId },
        });
        await (0, contexte_cloisonnement_1.horsCloisonnement)('siège · cellule ouverte à l’instant', () => this.prisma.user.update({
            where: { email: (0, courriel_1.normaliserCourriel)(dto.emailAdmin) },
            data: { doitChangerMotDePasse: true },
        }));
        if (licence) {
            await (0, contexte_cloisonnement_1.perimetreDeGroupe)([resultat.tenant.id], () => this.prisma.licence.update({
                where: { tenantId: resultat.tenant.id },
                data: { statut: licence.statut, dateExpiration: licence.dateExpiration },
            }));
        }
        return {
            tenant: resultat.tenant,
            adminEmail: dto.emailAdmin,
            motDePasseTemporaire,
        };
    }
    static jour(d) {
        return d.toISOString().slice(0, 10);
    }
    exercicePourLaPeriode(exercices, debut, fin) {
        let discordant = null;
        let recouvrementMax = 0;
        for (const e of exercices) {
            if (e.dateDebut.getTime() === debut.getTime() && e.dateFin.getTime() === fin.getTime()) {
                return { concordant: e, discordant: null };
            }
            const recouvrement = Math.min(e.dateFin.getTime(), fin.getTime()) - Math.max(e.dateDebut.getTime(), debut.getTime());
            if (recouvrement > 0 && recouvrement > recouvrementMax) {
                recouvrementMax = recouvrement;
                discordant = e;
            }
        }
        return { concordant: null, discordant };
    }
    async balanceAgregee(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        return this.dansLeGroupe(tenantId, () => this.balanceAgregeeDuGroupe(tenantId, exerciceId));
    }
    async balanceAgregeeDuGroupe(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice) {
            throw new common_1.NotFoundException('Exercice introuvable dans ce dossier');
        }
        const mere = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, nom: true, referentiel: true },
        });
        const cellules = await this.prisma.tenant.findMany({
            where: { dossierMereId: tenantId },
            orderBy: { nom: 'asc' },
            select: { id: true, nom: true, exercices: { select: { id: true, dateDebut: true, dateFin: true } } },
        });
        if (cellules.length === 0) {
            throw new common_1.BadRequestException("Ce dossier n'a aucune cellule rattachée · le rattachement se fait depuis la console plateforme");
        }
        const syscohada = mere?.referentiel === client_1.Referentiel.SYSCOHADA;
        const dossiers = [
            { id: tenantId, nom: mere.nom, estMere: true, exerciceId: exercice.id, periodeDiscordante: null },
            ...cellules.map((c) => {
                const choix = this.exercicePourLaPeriode(c.exercices, exercice.dateDebut, exercice.dateFin);
                return {
                    id: c.id,
                    nom: c.nom,
                    estMere: false,
                    exerciceId: choix.concordant?.id ?? null,
                    periodeDiscordante: choix.discordant
                        ? { dateDebut: choix.discordant.dateDebut, dateFin: choix.discordant.dateFin }
                        : null,
                };
            }),
        ];
        const idsGroupe = new Set([tenantId, ...cellules.map((c) => c.id)]);
        const rattachements = await this.prisma.tiersCompte.findMany({
            where: { tiers: { tenantId: { in: [...idsGroupe] }, celluleGroupeId: { not: null } } },
            select: {
                compteId: true,
                tiers: { select: { tenantId: true, code: true, nom: true, celluleGroupeId: true } },
            },
        });
        const nomParDossier = new Map(dossiers.map((d) => [d.id, d.nom]));
        const nomDuDossier = (id) => nomParDossier.get(id) ?? id;
        const rattachementsRefuses = [];
        const compteReciproque = new Map();
        const dejaRefuses = new Set();
        for (const r of rattachements) {
            const cible = r.tiers.celluleGroupeId;
            const motif = cible === r.tiers.tenantId
                ? 'le tiers désigne son propre dossier'
                : idsGroupe.has(cible)
                    ? null
                    : 'le dossier désigné n’appartient pas à ce groupe';
            if (motif === null) {
                compteReciproque.set(r.compteId, { dossierId: r.tiers.tenantId, cibleId: cible });
                continue;
            }
            const cle = `${r.tiers.tenantId}|${r.tiers.code}`;
            if (dejaRefuses.has(cle))
                continue;
            dejaRefuses.add(cle);
            rattachementsRefuses.push({
                dossier: nomDuDossier(r.tiers.tenantId),
                codeTiers: r.tiers.code,
                nomTiers: r.tiers.nom,
                motif,
            });
        }
        const soldeReciproqueParCompte = new Map();
        const parNumero = new Map();
        const detailParDossier = [];
        const equilibres = [];
        const lignesLiaison = [];
        const couplesRetenus = dossiers
            .filter((d) => d.exerciceId)
            .map((d) => ({ tenantId: d.id, exerciceId: d.exerciceId }));
        const balances = await (0, lecture_des_dossiers_1.balancesDesDossiers)(this.prisma, couplesRetenus);
        for (const d of dossiers) {
            if (!d.exerciceId)
                continue;
            const balance = balances.get(d.id);
            let solde58 = 0;
            let soldeLiaison18 = 0;
            for (const l of balance.lignes) {
                if (l.typeCompte === 'TOTAL')
                    continue;
                const horsMouvement = GroupeService_1.partsHorsMouvement(l);
                const existante = parNumero.get(l.numero);
                if (existante) {
                    existante.totalDebit += l.totalDebit;
                    existante.totalCredit += l.totalCredit;
                    existante.reportDebit += horsMouvement.reportDebit;
                    existante.reportCredit += horsMouvement.reportCredit;
                    existante.clotureDebit += horsMouvement.clotureDebit;
                    existante.clotureCredit += horsMouvement.clotureCredit;
                }
                else {
                    parNumero.set(l.numero, {
                        numero: l.numero,
                        intitule: l.intitule,
                        totalDebit: l.totalDebit,
                        totalCredit: l.totalCredit,
                        ...horsMouvement,
                    });
                }
                if (l.numero.startsWith('58'))
                    solde58 += l.solde;
                if (syscohada && estLiaisonEtablissement(l.numero)) {
                    soldeLiaison18 += l.solde;
                    lignesLiaison.push({
                        dossier: d.nom,
                        contrepartie: d.estMere ? 'établissements et succursales' : 'siège',
                        numero: l.numero,
                        intitule: l.intitule,
                        motif: MOTIF_LIAISON_ETABLISSEMENTS,
                        debit: l.totalDebit,
                        credit: l.totalCredit,
                        horsMouvement,
                    });
                }
                if (compteReciproque.has(l.compteId)) {
                    soldeReciproqueParCompte.set(l.compteId, l.totalDebit - l.totalCredit);
                }
                detailParDossier.push({
                    dossier: d.nom,
                    numero: l.numero,
                    intitule: l.intitule,
                    totalDebit: l.totalDebit,
                    totalCredit: l.totalCredit,
                });
            }
            equilibres.push({
                id: d.id,
                nom: d.nom,
                estMere: d.estMere,
                exerciceId: d.exerciceId,
                totalDebit: balance.totaux.debit,
                totalCredit: balance.totaux.credit,
                solde58,
                soldeLiaison18: syscohada ? Math.round(soldeLiaison18 * 100) / 100 : null,
                equilibre: Math.abs(balance.totaux.debit - balance.totaux.credit) <= 0.005,
            });
        }
        const reciproques = await this.eliminerOperationsReciproques(compteReciproque, couplesRetenus, nomParDossier, soldeReciproqueParCompte);
        const ecartLiaison18 = syscohada
            ? Math.round(equilibres.reduce((s, e) => s + (e.soldeLiaison18 ?? 0), 0) * 100) / 100
            : 0;
        const liaison18Neutralisee = Math.abs(ecartLiaison18) <= 0.005;
        if (syscohada && liaison18Neutralisee) {
            for (const e of lignesLiaison) {
                e.debit = Math.round(e.debit * 100) / 100;
                e.credit = Math.round(e.credit * 100) / 100;
                if (e.debit === 0 && e.credit === 0)
                    continue;
                reciproques.eliminations.push(e);
                reciproques.totaux.debit = Math.round((reciproques.totaux.debit + e.debit) * 100) / 100;
                reciproques.totaux.credit = Math.round((reciproques.totaux.credit + e.credit) * 100) / 100;
            }
            reciproques.eliminations.sort((a, b) => a.dossier.localeCompare(b.dossier) ||
                a.numero.localeCompare(b.numero) ||
                a.motif.localeCompare(b.motif));
        }
        const arrondi2 = (x) => Math.round(x * 100) / 100;
        const sommeParts = (cle) => arrondi2(reciproques.eliminations.reduce((s, e) => s + (e.horsMouvement?.[cle] ?? 0), 0));
        const ecartOuverture = arrondi2(sommeParts('reportDebit') - sommeParts('reportCredit'));
        const ecartCloture = arrondi2(sommeParts('clotureDebit') - sommeParts('clotureCredit'));
        const ouvertureSeCompense = Math.abs(ecartOuverture) <= 0.005;
        const clotureSeCompense = Math.abs(ecartCloture) <= 0.005;
        for (const e of reciproques.eliminations) {
            const ligne = parNumero.get(e.numero);
            if (!ligne)
                continue;
            ligne.totalDebit = arrondi2(ligne.totalDebit - e.debit);
            ligne.totalCredit = arrondi2(ligne.totalCredit - e.credit);
            const parts = e.horsMouvement ?? aucunePartHorsMouvement();
            if (ouvertureSeCompense) {
                ligne.reportDebit = arrondi2(ligne.reportDebit - parts.reportDebit);
                ligne.reportCredit = arrondi2(ligne.reportCredit - parts.reportCredit);
            }
            if (clotureSeCompense) {
                ligne.clotureDebit = arrondi2(ligne.clotureDebit - parts.clotureDebit);
                ligne.clotureCredit = arrondi2(ligne.clotureCredit - parts.clotureCredit);
            }
        }
        const lignes = [...parNumero.values()]
            .filter((l) => l.totalDebit !== 0 ||
            l.totalCredit !== 0 ||
            l.reportDebit !== 0 ||
            l.reportCredit !== 0 ||
            l.clotureDebit !== 0 ||
            l.clotureCredit !== 0)
            .sort((a, b) => a.numero.localeCompare(b.numero))
            .map((l) => ({ ...l, solde: l.totalDebit - l.totalCredit }));
        const totaux = {
            debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
            credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
        };
        const ecartLiaison = equilibres.reduce((s, e) => s + e.solde58, 0);
        const ecartElimination = Math.round((reciproques.totaux.debit - reciproques.totaux.credit) * 100) / 100;
        const avertissements = [];
        if (!ouvertureSeCompense) {
            avertissements.push(`Soldes réciproques d'OUVERTURE non concordants (écart ${ecartOuverture.toFixed(2)}) · une opération entre ` +
                "dossiers du groupe n'était enregistrée que d'un seul côté à la clôture précédente. Le total se confirme, " +
                "l'ouverture non : l'élimination de ces soldes est donc prise sur les mouvements de l'exercice, et le " +
                'tableau des flux du groupe lit leur variation comme un flux de l’exercice.');
        }
        if (reciproques.comptesHao.length > 0) {
            avertissements.push(`Cession interne d'immobilisation NON neutralisée · une écriture interne au groupe porte un compte de la ` +
                `classe 8 (${reciproques.comptesHao.join(', ')}). Un résultat de cession entre établissements n'est pas réalisé ` +
                `avec un tiers · ${(0, fondement_elimination_1.fondementEliminationGroupe)(syscohada)}. L'agrégat ne dispose que de soldes · la valeur brute et ` +
                `les amortissements du cédant, tenus au registre des immobilisations des dossiers, ne sont pas reconstitués. Le produit de cession et la valeur d'entrée chez le preneur restent ` +
                `donc dans l'agrégat, à retraiter à la main.`);
        }
        const stocksAgreges = lignes.filter((l) => l.numero.startsWith('3')).reduce((s, l) => s + l.solde, 0);
        if (Math.abs(stocksAgreges) > 0.005 &&
            reciproques.eliminations.some((e) => e.motif === MOTIF_CHARGE_PRODUIT)) {
            avertissements.push(`Marge interne comprise dans les stocks NON neutralisée · des achats et des ventes internes ont été éliminés ` +
                `alors que l'agrégat porte encore ${(Math.round(stocksAgreges * 100) / 100).toFixed(2)} de stocks (classe 3). ` +
                `Une marge prise entre établissements n'est pas réalisée avec un tiers · ${(0, fondement_elimination_1.fondementEliminationGroupe)(syscohada)}. ` +
                `Rien dans les comptes ne dit quelle part du stock de clôture vient d'un achat interne, ni à quelle marge. ` +
                `À retraiter à la main.`);
        }
        return {
            exercice,
            dossiers: equilibres,
            cellulesSansExercice: dossiers
                .filter((d) => !d.exerciceId && !d.periodeDiscordante)
                .map((d) => ({ id: d.id, nom: d.nom })),
            cellulesPeriodeDiscordante: dossiers
                .filter((d) => d.periodeDiscordante)
                .map((d) => ({
                id: d.id,
                nom: d.nom,
                dateDebut: d.periodeDiscordante.dateDebut,
                dateFin: d.periodeDiscordante.dateFin,
            })),
            lignes,
            totaux,
            eliminations: reciproques.eliminations,
            totauxEliminations: reciproques.totaux,
            ecartsReciprocite: reciproques.ecarts,
            rattachementsRefuses,
            avertissements,
            controles: {
                ecartLiaison: Math.round(ecartLiaison * 100) / 100,
                liaisonNeutralisee: Math.abs(ecartLiaison) <= 0.005,
                tousEquilibres: equilibres.every((e) => e.equilibre),
                periodesConcordantes: dossiers.every((d) => !d.periodeDiscordante),
                reciprocitesEquilibrees: reciproques.ecarts.length === 0,
                ecartElimination,
                eliminationsSymetriques: Math.abs(ecartElimination) <= 0.005,
                rattachementsValides: rattachementsRefuses.length === 0,
                ecartLiaison18: syscohada ? ecartLiaison18 : null,
                liaison18Neutralisee: syscohada ? liaison18Neutralisee : null,
            },
            referentiel: syscohada ? client_1.Referentiel.SYSCOHADA : client_1.Referentiel.SYCEBNL,
            detailParDossier,
        };
    }
    async eliminerOperationsReciproques(compteReciproque, dossiersRetenus, nomParDossier, soldeReciproqueParCompte) {
        const arrondi = (x) => Math.round(x * 100) / 100;
        const nom = (id) => nomParDossier.get(id) ?? id;
        if (compteReciproque.size === 0) {
            return { eliminations: [], totaux: { debit: 0, credit: 0 }, ecarts: [], comptesHao: [] };
        }
        const lignesInternes = await this.prisma.ligneEcriture.findMany({
            where: {
                ecriture: {
                    tenantId: { in: dossiersRetenus.map((d) => d.tenantId) },
                    exerciceId: { in: dossiersRetenus.map((d) => d.exerciceId) },
                    lignes: { some: { compteId: { in: [...compteReciproque.keys()] } } },
                    ...ecritures_de_situation_1.HORS_SITUATION,
                },
            },
            select: {
                ecritureId: true,
                compteId: true,
                debit: true,
                credit: true,
                ecriture: { select: { tenantId: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
                compte: { select: { numero: true, intitule: true } },
            },
        });
        const contrepartieDeLEcriture = new Map();
        for (const l of lignesInternes) {
            const rec = compteReciproque.get(l.compteId);
            if (!rec)
                continue;
            const vues = contrepartieDeLEcriture.get(l.ecritureId) ?? new Set();
            vues.add(nom(rec.cibleId));
            contrepartieDeLEcriture.set(l.ecritureId, vues);
        }
        const cumul = new Map();
        const comptesHao = new Set();
        for (const l of lignesInternes) {
            const numero = l.compte.numero;
            if (numero.startsWith('8'))
                comptesHao.add(numero);
            const estReciproque = compteReciproque.has(l.compteId);
            const estChargeOuProduit = numero.startsWith('6') || numero.startsWith('7');
            if (!estReciproque && !estChargeOuProduit)
                continue;
            const motif = estReciproque ? MOTIF_CREANCE_DETTE : MOTIF_CHARGE_PRODUIT;
            const contrepartie = [...(contrepartieDeLEcriture.get(l.ecritureId) ?? [])].sort().join(', ');
            const cle = `${l.ecriture.tenantId}|${contrepartie}|${numero}|${motif}`;
            const ligne = cumul.get(cle) ?? {
                dossier: nom(l.ecriture.tenantId),
                contrepartie,
                numero,
                intitule: l.compte.intitule,
                motif,
                debit: 0,
                credit: 0,
                horsMouvement: aucunePartHorsMouvement(),
            };
            const debit = Number(l.debit);
            const credit = Number(l.credit);
            ligne.debit += debit;
            ligne.credit += credit;
            const parts = ligne.horsMouvement;
            if (l.ecriture.estSoldeDesComptesDeGestion) {
                parts.clotureDebit += debit;
                parts.clotureCredit += credit;
            }
            else if (l.ecriture.estGenereeParCloture) {
                parts.reportDebit += debit;
                parts.reportCredit += credit;
            }
            cumul.set(cle, ligne);
        }
        const eliminations = [...cumul.values()]
            .map((e) => ({
            ...e,
            debit: arrondi(e.debit),
            credit: arrondi(e.credit),
            horsMouvement: {
                reportDebit: arrondi(e.horsMouvement.reportDebit),
                reportCredit: arrondi(e.horsMouvement.reportCredit),
                clotureDebit: arrondi(e.horsMouvement.clotureDebit),
                clotureCredit: arrondi(e.horsMouvement.clotureCredit),
            },
        }))
            .filter((e) => e.debit !== 0 || e.credit !== 0)
            .sort((a, b) => a.dossier.localeCompare(b.dossier) ||
            a.numero.localeCompare(b.numero) ||
            a.motif.localeCompare(b.motif));
        const totaux = {
            debit: arrondi(eliminations.reduce((s, e) => s + e.debit, 0)),
            credit: arrondi(eliminations.reduce((s, e) => s + e.credit, 0)),
        };
        const soldeVers = new Map();
        for (const [compteId, rec] of compteReciproque) {
            const cle = `${rec.dossierId}|${rec.cibleId}`;
            soldeVers.set(cle, (soldeVers.get(cle) ?? 0) + (soldeReciproqueParCompte.get(compteId) ?? 0));
        }
        const paires = new Set();
        for (const cle of soldeVers.keys()) {
            const [x, y] = cle.split('|');
            paires.add(nom(x).localeCompare(nom(y)) <= 0 ? `${x}|${y}` : `${y}|${x}`);
        }
        const ecarts = [];
        for (const paire of paires) {
            const [a, b] = paire.split('|');
            const solde = arrondi(soldeVers.get(`${a}|${b}`) ?? 0);
            const soldeContrepartie = arrondi(soldeVers.get(`${b}|${a}`) ?? 0);
            const ecart = arrondi(solde + soldeContrepartie);
            if (Math.abs(ecart) <= 0.005)
                continue;
            ecarts.push({ dossier: nom(a), contrepartie: nom(b), solde, soldeContrepartie, ecart });
        }
        ecarts.sort((x, y) => x.dossier.localeCompare(y.dossier) || x.contrepartie.localeCompare(y.contrepartie));
        return { eliminations, totaux, ecarts, comptesHao: [...comptesHao].sort() };
    }
    async balanceAgregeeExcel(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        return this.dansLeGroupe(tenantId, () => this.balanceAgregeeExcelDuGroupe(tenantId, exerciceId));
    }
    async balanceAgregeeExcelDuGroupe(tenantId, exerciceId) {
        const agregat = await this.balanceAgregee(tenantId, exerciceId);
        const annee = (0, libelle_exercice_1.libelleExercice)(agregat.exercice);
        const wb = new exceljs_1.Workbook();
        const fmt = '#,##0.00';
        const feuille = wb.addWorksheet('Balance agrégée');
        feuille.columns = [
            { header: 'Numéro', key: 'numero', width: 14 },
            { header: 'Intitulé', key: 'intitule', width: 48 },
            { header: 'Débit', key: 'debit', width: 16, style: { numFmt: fmt } },
            { header: 'Crédit', key: 'credit', width: 16, style: { numFmt: fmt } },
        ];
        feuille.getRow(1).font = { bold: true };
        for (const l of agregat.lignes) {
            feuille.addRow({ numero: l.numero, intitule: l.intitule, debit: l.totalDebit, credit: l.totalCredit });
        }
        const detail = wb.addWorksheet('Par dossier');
        detail.columns = [
            { header: 'Dossier', key: 'dossier', width: 32 },
            { header: 'Numéro', key: 'numero', width: 14 },
            { header: 'Intitulé', key: 'intitule', width: 48 },
            { header: 'Débit', key: 'debit', width: 16, style: { numFmt: fmt } },
            { header: 'Crédit', key: 'credit', width: 16, style: { numFmt: fmt } },
        ];
        detail.getRow(1).font = { bold: true };
        for (const l of agregat.detailParDossier) {
            detail.addRow({ dossier: l.dossier, numero: l.numero, intitule: l.intitule, debit: l.totalDebit, credit: l.totalCredit });
        }
        if (agregat.eliminations.length > 0) {
            const elim = wb.addWorksheet('Éliminations');
            elim.columns = [
                { header: 'Dossier', key: 'dossier', width: 32 },
                { header: 'Contrepartie du groupe', key: 'contrepartie', width: 32 },
                { header: 'Numéro', key: 'numero', width: 14 },
                { header: 'Intitulé', key: 'intitule', width: 48 },
                { header: 'À ce titre', key: 'motif', width: 30 },
                { header: 'Débit retiré', key: 'debit', width: 16, style: { numFmt: fmt } },
                { header: 'Crédit retiré', key: 'credit', width: 16, style: { numFmt: fmt } },
            ];
            elim.getRow(1).font = { bold: true };
            for (const e of agregat.eliminations) {
                elim.addRow({
                    dossier: e.dossier,
                    contrepartie: e.contrepartie,
                    numero: e.numero,
                    intitule: e.intitule,
                    motif: e.motif,
                    debit: e.debit,
                    credit: e.credit,
                });
            }
            const totalElim = elim.addRow({
                dossier: 'TOTAL ÉLIMINÉ',
                debit: agregat.totauxEliminations.debit,
                credit: agregat.totauxEliminations.credit,
                motif: agregat.controles.eliminationsSymetriques
                    ? 'élimination symétrique'
                    : `ÉLIMINATION BOITEUSE (écart ${agregat.controles.ecartElimination.toFixed(2)})`,
            });
            totalElim.font = { bold: true };
        }
        const controles = wb.addWorksheet('Contrôles');
        controles.columns = [
            { header: 'Dossier', key: 'nom', width: 32 },
            { header: 'Débit', key: 'debit', width: 16, style: { numFmt: fmt } },
            { header: 'Crédit', key: 'credit', width: 16, style: { numFmt: fmt } },
            { header: 'Solde 58 (virements internes)', key: 'solde58', width: 24, style: { numFmt: fmt } },
            ...(agregat.controles.liaison18Neutralisee !== null
                ? [{ header: 'Solde 184 à 187 (liaison siège / établissements)', key: 'liaison18', width: 30, style: { numFmt: fmt } }]
                : []),
            { header: 'Équilibre', key: 'equilibre', width: 14 },
        ];
        controles.getRow(1).font = { bold: true };
        for (const e of agregat.dossiers) {
            controles.addRow({
                nom: e.estMere ? `${e.nom} (siège)` : e.nom,
                debit: e.totalDebit,
                credit: e.totalCredit,
                solde58: e.solde58,
                liaison18: e.soldeLiaison18 ?? undefined,
                equilibre: e.equilibre ? 'Oui' : 'DÉSÉQUILIBRÉ',
            });
        }
        controles.addRow({});
        if (agregat.eliminations.length > 0) {
            controles.addRow({
                nom: 'Éliminations des opérations réciproques',
                debit: -agregat.totauxEliminations.debit,
                credit: -agregat.totauxEliminations.credit,
                equilibre: agregat.controles.eliminationsSymetriques
                    ? 'symétrique'
                    : `ÉCART D’ÉLIMINATION ${agregat.controles.ecartElimination.toFixed(2)}`,
            });
        }
        const totalRow = controles.addRow({
            nom: 'TOTAL AGRÉGÉ',
            debit: agregat.totaux.debit,
            credit: agregat.totaux.credit,
            solde58: agregat.controles.ecartLiaison,
            liaison18: agregat.controles.ecartLiaison18 ?? undefined,
            equilibre: (agregat.controles.liaisonNeutralisee ? '58 neutralisés' : 'ÉCART SUR 58') +
                (agregat.controles.liaison18Neutralisee === null
                    ? ''
                    : agregat.controles.liaison18Neutralisee
                        ? ' · liaison 184 à 187 neutralisée'
                        : ' · ÉCART SUR LA LIAISON 184 À 187'),
        });
        totalRow.font = { bold: true };
        for (const c of agregat.cellulesSansExercice) {
            controles.addRow({ nom: c.nom, equilibre: 'SANS EXERCICE · chiffres absents de l’agrégat' });
        }
        for (const c of agregat.cellulesPeriodeDiscordante) {
            controles.addRow({
                nom: c.nom,
                equilibre: `PÉRIODE DISCORDANTE (${GroupeService_1.jour(c.dateDebut)} au ${GroupeService_1.jour(c.dateFin)}) · chiffres absents de l’agrégat`,
            });
        }
        for (const e of agregat.ecartsReciprocite) {
            controles.addRow({
                nom: e.dossier,
                debit: e.solde,
                credit: e.soldeContrepartie,
                equilibre: `ÉCART DE RÉCIPROCITÉ de ${e.ecart.toFixed(2)} avec ${e.contrepartie} · créance et dette ne se répondent pas`,
            });
        }
        for (const r of agregat.rattachementsRefuses) {
            controles.addRow({
                nom: r.dossier,
                equilibre: `RATTACHEMENT REFUSÉ · tiers ${r.codeTiers} (${r.nomTiers}) : ${r.motif} · rien n’a été éliminé pour lui`,
            });
        }
        for (const a of agregat.avertissements) {
            controles.addRow({ nom: 'AVERTISSEMENT', equilibre: a });
        }
        const buffer = Buffer.from(await wb.xlsx.writeBuffer());
        return { buffer, nomFichier: `balance-agregee-groupe-${annee}.xlsx` };
    }
    async celluleDuGroupe(tenantId, celluleId) {
        const cellule = await this.prisma.tenant.findFirst({
            where: { id: celluleId, dossierMereId: tenantId },
            select: { id: true, nom: true },
        });
        if (!cellule) {
            throw new common_1.NotFoundException('Cette cellule n’appartient pas à ce groupe');
        }
        return cellule;
    }
    async exerciceOuvert(celluleId) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { tenantId: celluleId, statut: client_1.StatutExercice.OUVERT },
            orderBy: { dateDebut: 'desc' },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice) {
            throw new common_1.BadRequestException('Cette cellule n’a aucun exercice ouvert');
        }
        return exercice;
    }
    async supervision(tenantId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        return this.dansLeGroupe(tenantId, () => this.supervisionDuGroupe(tenantId, exerciceId));
    }
    async supervisionDuGroupe(tenantId, exerciceId) {
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId },
            select: { id: true, dateDebut: true, dateFin: true },
        });
        if (!exercice) {
            throw new common_1.NotFoundException('Exercice introuvable dans ce dossier');
        }
        const cellules = await this.prisma.tenant.findMany({
            where: { dossierMereId: tenantId },
            orderBy: { nom: 'asc' },
            select: { id: true, nom: true, jeuEtatsFinanciersSycebnl: true, exercices: { select: { id: true, dateDebut: true, dateFin: true } } },
        });
        const mere = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
        const syscohada = mere?.referentiel === client_1.Referentiel.SYSCOHADA;
        const parCellule = cellules.map((c) => {
            const choix = this.exercicePourLaPeriode(c.exercices, exercice.dateDebut, exercice.dateFin);
            return { c, choix, exCellule: choix.concordant ?? choix.discordant };
        });
        const couples = parCellule
            .filter((x) => x.exCellule)
            .map((x) => ({ tenantId: x.c.id, exerciceId: x.exCellule.id }));
        const balances = await (0, lecture_des_dossiers_1.balancesDesDossiers)(this.prisma, couples);
        const comptages = await (0, lecture_des_dossiers_1.comptagesDesDossiers)(this.prisma, couples);
        const lignes = [];
        for (const { c, choix, exCellule } of parCellule) {
            if (!exCellule) {
                lignes.push({
                    id: c.id,
                    nom: c.nom,
                    jeuEtatsFinanciersSycebnl: c.jeuEtatsFinanciersSycebnl,
                    exerciceId: null,
                    periodeDiscordante: null,
                    derniereEcriture: null,
                    nbEcritures: 0,
                    nbBrouillard: 0,
                    tresorerie: 0,
                    solde58: 0,
                    soldeLiaison18: syscohada ? 0 : null,
                    equilibre: true,
                    prete: false,
                });
                continue;
            }
            const balance = balances.get(c.id);
            const { derniereEcriture, nbEcritures, nbBrouillard } = comptages.get(c.id);
            const detail = balance.lignes.filter((l) => l.typeCompte !== 'TOTAL');
            const tresorerie = detail
                .filter((l) => l.numero.startsWith('5') && !l.numero.startsWith('58'))
                .reduce((s, l) => s + l.solde, 0);
            const solde58 = detail.filter((l) => l.numero.startsWith('58')).reduce((s, l) => s + l.solde, 0);
            const soldeLiaison18 = syscohada
                ? Math.round(detail.filter((l) => estLiaisonEtablissement(l.numero)).reduce((s, l) => s + l.solde, 0) * 100) / 100
                : null;
            const equilibre = Math.abs(balance.totaux.debit - balance.totaux.credit) <= 0.005;
            lignes.push({
                id: c.id,
                nom: c.nom,
                jeuEtatsFinanciersSycebnl: c.jeuEtatsFinanciersSycebnl,
                exerciceId: exCellule.id,
                periodeDiscordante: choix.concordant
                    ? null
                    : { dateDebut: exCellule.dateDebut, dateFin: exCellule.dateFin },
                derniereEcriture,
                nbEcritures,
                nbBrouillard,
                tresorerie,
                solde58,
                soldeLiaison18,
                equilibre,
                prete: choix.concordant !== null && equilibre && nbBrouillard === 0 && nbEcritures > 0,
            });
        }
        return { exercice, cellules: lignes };
    }
    async balanceCellule(tenantId, celluleId, exerciceId) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        return this.dansLeGroupe(tenantId, () => this.balanceCelluleDuGroupe(tenantId, celluleId, exerciceId));
    }
    async balanceCelluleDuGroupe(tenantId, celluleId, exerciceId) {
        const cellule = await this.celluleDuGroupe(tenantId, celluleId);
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: exerciceId, tenantId: celluleId },
            select: { id: true },
        });
        if (!exercice) {
            throw new common_1.NotFoundException('Exercice introuvable dans cette cellule');
        }
        const balance = await this.ecritureService.balance(celluleId, exerciceId);
        return { cellule, ...balance };
    }
    async canevas(tenantId, celluleId) {
        return this.dansLeGroupe(tenantId, () => this.canevasDuGroupe(tenantId, celluleId));
    }
    async canevasDuGroupe(tenantId, celluleId) {
        const cellule = await this.celluleDuGroupe(tenantId, celluleId);
        const exercice = await this.exerciceOuvert(celluleId);
        const wb = new exceljs_1.Workbook();
        const ws = wb.addWorksheet('Journal de trésorerie');
        ws.getCell('A1').value = canevas_tresorerie_1.MARQUEUR_CANEVAS;
        ws.getCell('A1').font = { size: 8, color: { argb: 'FFBBBBBB' } };
        ws.getCell('A2').value = 'Cellule :';
        ws.getCell('B2').value = cellule.nom;
        ws.getCell('A3').value = 'Exercice :';
        ws.getCell('B3').value = `du ${exercice.dateDebut.toISOString().slice(0, 10)} au ${exercice.dateFin.toISOString().slice(0, 10)}`;
        ws.getRow(2).font = { bold: true };
        ws.getRow(3).font = { bold: true };
        const entetes = ['Date', 'Libellé', 'Rubrique', 'Encaissement', 'Décaissement', 'Caisse ou banque'];
        const ligneEntetes = ws.getRow(canevas_tresorerie_1.PREMIERE_LIGNE_DONNEES - 1);
        entetes.forEach((e, i) => {
            const cellule = ligneEntetes.getCell(i + 1);
            cellule.value = e;
            cellule.font = { bold: true };
            cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
        });
        ws.getColumn(1).width = 12;
        ws.getColumn(2).width = 42;
        ws.getColumn(3).width = 40;
        ws.getColumn(4).width = 16;
        ws.getColumn(5).width = 16;
        ws.getColumn(6).width = 18;
        ws.getColumn(1).numFmt = 'dd/mm/yyyy';
        ws.getColumn(4).numFmt = '#,##0.00';
        ws.getColumn(5).numFmt = '#,##0.00';
        const rubriques = wb.addWorksheet('Rubriques');
        rubriques.columns = [
            { header: 'Rubrique', key: 'libelle', width: 44 },
            { header: 'Sens', key: 'sens', width: 12 },
            { header: 'Compte', key: 'compte', width: 12 },
        ];
        rubriques.getRow(1).font = { bold: true };
        for (const r of canevas_tresorerie_1.RUBRIQUES_CANEVAS) {
            rubriques.addRow({ libelle: r.libelle, sens: r.sens === 'recette' ? 'Recette' : 'Dépense', compte: r.compte });
        }
        for (let l = canevas_tresorerie_1.PREMIERE_LIGNE_DONNEES; l <= canevas_tresorerie_1.DERNIERE_LIGNE_DONNEES; l++) {
            ws.getCell(`C${l}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Rubriques!$A$2:$A$${canevas_tresorerie_1.RUBRIQUES_CANEVAS.length + 1}`],
                showErrorMessage: true,
                errorTitle: 'Rubrique inconnue',
                error: 'Choisissez une rubrique dans la liste.',
            };
            ws.getCell(`F${l}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Caisse,Banque"'],
                showErrorMessage: true,
                errorTitle: 'Valeur inconnue',
                error: 'Choisissez Caisse ou Banque.',
            };
            for (let col = 1; col <= 6; col++) {
                ws.getRow(l).getCell(col).protection = { locked: false };
            }
        }
        await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true });
        const slug = cellule.nom
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
        const buffer = Buffer.from(await wb.xlsx.writeBuffer());
        return { buffer, nomFichier: `canevas-${slug || 'cellule'}-${(0, libelle_exercice_1.libelleExercice)(exercice)}.xlsx` };
    }
    async importerCanevas(tenantId, celluleId, createdBy, dto) {
        return this.dansLeGroupe(tenantId, () => this.importerCanevasDuGroupe(tenantId, celluleId, createdBy, dto));
    }
    async importerCanevasDuGroupe(tenantId, celluleId, createdBy, dto) {
        await this.celluleDuGroupe(tenantId, celluleId);
        const exercice = await this.exerciceOuvert(celluleId);
        const contenu = Buffer.from(dto.contenuBase64, 'base64');
        const wb = new exceljs_1.Workbook();
        try {
            await wb.xlsx.load(contenu);
        }
        catch {
            throw new common_1.BadRequestException('Ce fichier n’est pas un classeur Excel lisible (.xlsx attendu)');
        }
        const ws = wb.getWorksheet('Journal de trésorerie');
        if (!ws || String(ws.getCell('A1').value ?? '') !== canevas_tresorerie_1.MARQUEUR_CANEVAS) {
            throw new common_1.BadRequestException('Ce fichier n’est pas un canevas OmegaX · téléchargez le canevas officiel de la cellule et remplissez-le');
        }
        const empreinte = (0, crypto_1.createHash)('sha1').update(contenu).digest('hex').slice(0, 10);
        const reference = `CANEVAS ${empreinte}`;
        const dejaImporte = await this.prisma.ecriture.findFirst({
            where: { tenantId: celluleId, reference },
            select: { id: true },
        });
        if (dejaImporte) {
            throw new common_1.BadRequestException('Ce fichier a déjà été importé dans cette cellule (contenu identique)');
        }
        const rubriqueParLibelle = new Map(canevas_tresorerie_1.RUBRIQUES_CANEVAS.map((r) => [r.libelle, r]));
        const anomalies = [];
        const lignesValides = [];
        const texte = (v) => (v === null || v === undefined ? '' : String(v).trim());
        const nombre = (v) => {
            if (v === null || v === undefined || v === '')
                return 0;
            const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
            return Number.isFinite(n) ? n : NaN;
        };
        for (let l = canevas_tresorerie_1.PREMIERE_LIGNE_DONNEES; l <= Math.min(ws.rowCount, canevas_tresorerie_1.DERNIERE_LIGNE_DONNEES); l++) {
            const row = ws.getRow(l);
            const brutDate = row.getCell(1).value;
            const libelle = texte(row.getCell(2).value);
            const rubriqueLibelle = texte(row.getCell(3).value);
            const encaissement = nombre(row.getCell(4).value);
            const decaissement = nombre(row.getCell(5).value);
            const tresorerieLibelle = texte(row.getCell(6).value);
            if (!brutDate && !libelle && !rubriqueLibelle && !encaissement && !decaissement)
                continue;
            const date = brutDate instanceof Date ? brutDate : new Date(texte(brutDate));
            if (Number.isNaN(date.getTime())) {
                anomalies.push({ ligne: l, message: 'Date illisible' });
                continue;
            }
            if (date < exercice.dateDebut || date > exercice.dateFin) {
                anomalies.push({ ligne: l, message: `Date hors de l'exercice ouvert de la cellule` });
                continue;
            }
            const rubrique = rubriqueParLibelle.get(rubriqueLibelle);
            if (!rubrique) {
                anomalies.push({ ligne: l, message: `Rubrique inconnue « ${rubriqueLibelle} »` });
                continue;
            }
            if (Number.isNaN(encaissement) || Number.isNaN(decaissement) || encaissement < 0 || decaissement < 0) {
                anomalies.push({ ligne: l, message: 'Montant illisible ou négatif' });
                continue;
            }
            const montant = rubrique.sens === 'recette' ? encaissement : decaissement;
            const autre = rubrique.sens === 'recette' ? decaissement : encaissement;
            if (montant <= 0 || autre !== 0) {
                anomalies.push({
                    ligne: l,
                    message: rubrique.sens === 'recette'
                        ? `« ${rubrique.libelle} » est une recette · montant attendu en Encaissement seulement`
                        : `« ${rubrique.libelle} » est une dépense · montant attendu en Décaissement seulement`,
                });
                continue;
            }
            const tresorerie = canevas_tresorerie_1.TRESORERIES_CANEVAS[tresorerieLibelle];
            if (!tresorerie) {
                anomalies.push({ ligne: l, message: 'Colonne « Caisse ou banque » vide ou inconnue' });
                continue;
            }
            lignesValides.push({
                date,
                libelle: libelle || rubrique.libelle,
                compteRubrique: rubrique.compte,
                compteTresorerie: tresorerie.compte,
                journal: tresorerie.journal,
                sens: rubrique.sens,
                montant,
            });
        }
        if (anomalies.length > 0) {
            return { importe: false, lignesImportees: 0, anomalies };
        }
        if (lignesValides.length === 0) {
            throw new common_1.BadRequestException('Le canevas ne contient aucune ligne remplie');
        }
        const numeros = [...new Set(lignesValides.flatMap((l) => [l.compteRubrique, l.compteTresorerie]))];
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId: celluleId, numero: { in: numeros } },
            select: { id: true, numero: true },
        });
        const compteParNumero = new Map(comptes.map((c) => [c.numero, c.id]));
        const manquants = numeros.filter((n) => !compteParNumero.has(n));
        if (manquants.length > 0) {
            throw new common_1.BadRequestException(`Comptes absents du plan de la cellule : ${manquants.join(', ')} · rétablissez-les dans le plan de comptes de la cellule avant l'import`);
        }
        const journaux = await this.prisma.journal.findMany({
            where: { tenantId: celluleId, code: { in: ['CA', 'BQ'] } },
            select: { id: true, code: true, numerotation: true },
        });
        const journalParCode = new Map(journaux.map((j) => [j.code, j]));
        if (!journalParCode.has('CA') || !journalParCode.has('BQ')) {
            throw new common_1.BadRequestException('Journaux de trésorerie CA/BQ absents du dossier de la cellule');
        }
        const piecesCanevas = lignesValides.map((l) => {
            const tresorerie = compteParNumero.get(l.compteTresorerie);
            const rubriqueId = compteParNumero.get(l.compteRubrique);
            return {
                l,
                lignes: l.sens === 'recette'
                    ? [
                        { compteId: tresorerie, debit: l.montant, credit: 0 },
                        { compteId: rubriqueId, debit: 0, credit: l.montant },
                    ]
                    : [
                        { compteId: rubriqueId, debit: l.montant, credit: 0 },
                        { compteId: tresorerie, debit: 0, credit: l.montant },
                    ],
            };
        });
        for (const p of piecesCanevas) {
            await this.ecritureService.controlesDEntree(celluleId, {
                exerciceId: exercice.id,
                journalId: journalParCode.get(p.l.journal).id,
                date: p.l.date,
                lignes: p.lignes,
                exigerVentilationObligatoire: false,
            });
        }
        await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            for (const { l, lignes } of piecesCanevas) {
                const jal = journalParCode.get(l.journal);
                const numeroPiece = await (0, numerotation_piece_1.prochainNumeroPiece)(tx, celluleId, jal, exercice.id, l.date);
                await tx.ecriture.create({
                    data: {
                        tenantId: celluleId,
                        exerciceId: exercice.id,
                        journalId: jal.id,
                        numeroPiece,
                        date: l.date,
                        libelle: l.libelle,
                        reference,
                        createdBy,
                        lignes: { create: lignes },
                    },
                });
            }
        });
        return {
            importe: true,
            lignesImportees: lignesValides.length,
            reference,
            statut: 'BROUILLARD',
            anomalies: [],
        };
    }
    async liasseGroupe(tenantId, exerciceId, createdBy) {
        (0, exercice_requis_1.exigerExercice)(exerciceId);
        const combinaisonId = await this.assurerDossierCombinaison(tenantId);
        return this.dansLeGroupe(tenantId, () => this.liasseGroupeDuGroupe(tenantId, exerciceId, createdBy, combinaisonId));
    }
    async liasseGroupeDuGroupe(tenantId, exerciceId, createdBy, combinaisonIdOuvert) {
        const agregat = await this.balanceAgregee(tenantId, exerciceId);
        const blocages = [];
        if (!agregat.controles.tousEquilibres) {
            const noms = agregat.dossiers.filter((d) => !d.equilibre).map((d) => d.nom);
            blocages.push(`dossier(s) déséquilibré(s) : ${noms.join(', ')}`);
        }
        if (!agregat.controles.liaisonNeutralisee) {
            blocages.push(`virements internes (58) non neutralisés (écart ${agregat.controles.ecartLiaison.toFixed(2)}) · un transfert est enregistré d'un seul côté`);
        }
        if (agregat.controles.liaison18Neutralisee === false) {
            const parDossier = agregat.dossiers
                .map((d) => `${d.nom} ${(d.soldeLiaison18 ?? 0).toFixed(2)}`)
                .join(', ');
            blocages.push(`comptes de liaison siège / établissements (184 à 187) non neutralisés (écart ${agregat.controles.ecartLiaison18.toFixed(2)} · ` +
                `${parDossier}) · « les comptes de liaison sont égaux et de sens contraire dans les deux comptabilités » ` +
                '(SYSCOHADA, fiche du COMPTE 18) : une opération entre le siège et un établissement n’est enregistrée que d’un seul côté');
        }
        if (agregat.rattachementsRefuses.length > 0) {
            const nommes = agregat.rattachementsRefuses
                .map((r) => `${r.codeTiers} (${r.nomTiers}) dans ${r.dossier} : ${r.motif}`)
                .join(' ; ');
            blocages.push(`tiers rattaché(s) à un dossier qui n'est pas une cellule de ce groupe · ${nommes} · rien n'a été éliminé pour ` +
                "eux, car retirer une vente faite à une entité extérieure au groupe serait le contraire de l'élimination. " +
                'Corrigez le rattachement du tiers, ou retirez-le');
        }
        if (!agregat.controles.reciprocitesEquilibrees) {
            const nommes = agregat.ecartsReciprocite
                .map((e) => `${e.dossier} porte ${e.solde.toFixed(2)} face à ${e.contrepartie} qui porte ${e.soldeContrepartie.toFixed(2)} (écart ${e.ecart.toFixed(2)})`)
                .join(' ; ');
            blocages.push(`opérations réciproques non confirmées · ${nommes} · la créance chez l'un doit être la dette chez l'autre. ` +
                "Le logiciel ne choisit pas lequel des deux dossiers a raison : confirmez le solde entre les deux dossiers, " +
                'passez l’écriture manquante, puis relancez');
        }
        if (!agregat.controles.eliminationsSymetriques) {
            blocages.push(`élimination des opérations réciproques non symétrique (écart ${agregat.controles.ecartElimination.toFixed(2)} entre ` +
                `${agregat.totauxEliminations.debit.toFixed(2)} retirés au débit et ${agregat.totauxEliminations.credit.toFixed(2)} ` +
                "au crédit) · une opération interne n'est enregistrée que d'un seul côté, ou sa contrepartie n'est pas une " +
                'charge ni un produit · voir la feuille « Éliminations » du classeur de la balance agrégée');
        }
        if (agregat.cellulesPeriodeDiscordante.length > 0) {
            const nommees = agregat.cellulesPeriodeDiscordante
                .map((c) => `${c.nom} (du ${GroupeService_1.jour(c.dateDebut)} au ${GroupeService_1.jour(c.dateFin)})`)
                .join(', ');
            blocages.push(`cellule(s) dont l'exercice ne couvre pas la période du siège (du ${GroupeService_1.jour(agregat.exercice.dateDebut)} au ` +
                `${GroupeService_1.jour(agregat.exercice.dateFin)}) : ${nommees} · leurs chiffres ont été laissés hors de l'agrégat, ` +
                "car une liasse qui additionne deux périodes ne correspond à aucune. L'exercice coïncide avec l'année civile " +
                (agregat.referentiel === client_1.Referentiel.SYSCOHADA
                    ? '(AUDCIF art. 7) : seuls un '
                    : "(AUDCIF art. 7, non exclu par l'art. 3 du SYCEBNL et repris à l'entrée EXERCICE de son glossaire) : seuls un ") +
                'PREMIER exercice ou un exercice de LIQUIDATION peuvent être décalés · clôturez la cellule sur la période du ' +
                "siège, puis relancez, ou attendez qu'elle soit revenue à l'année civile");
        }
        if (agregat.cellulesSansExercice.length > 0) {
            blocages.push(`cellule(s) sans exercice sur la période : ${agregat.cellulesSansExercice.map((c) => c.nom).join(', ')} · leurs chiffres manqueraient`);
        }
        const comptages = await (0, lecture_des_dossiers_1.comptagesDesDossiers)(this.prisma, agregat.dossiers.map((d) => ({ tenantId: d.id, exerciceId: d.exerciceId })));
        const brouillardParDossier = agregat.dossiers.map((d) => ({
            nom: d.nom,
            pieces: comptages.get(d.id).nbBrouillard,
            provisoires: comptages.get(d.id).nbProvisoiresAuBrouillard,
        }));
        const enBrouillard = brouillardParDossier.filter((b) => b.pieces > 0);
        if (enBrouillard.length > 0) {
            const nommes = enBrouillard
                .map((b) => b.provisoires > 0
                ? `${b.nom} (${b.pieces} pièce(s), dont l'à-nouveau provisoire, qui ne se valide pas · clôturez l'exercice précédent)`
                : `${b.nom} (${b.pieces} pièce(s))`)
                .join(', ');
            blocages.push(`écritures encore au brouillard : ${nommes} · la liasse ne lit que le livre-journal, et une pièce non validée ` +
                'ne peut pas y entrer par l’écriture de combinaison. Validez-les dans leur dossier');
        }
        if (blocages.length > 0) {
            throw new common_1.BadRequestException(`La liasse du groupe ne peut pas être produite tant que l'agrégat n'est pas fiable · ${blocages.join(' ; ')}. Corrigez, puis relancez.`);
        }
        const combinaisonId = combinaisonIdOuvert;
        let exercice = await this.prisma.exercice.findFirst({
            where: { tenantId: combinaisonId, dateDebut: agregat.exercice.dateDebut, dateFin: agregat.exercice.dateFin },
            select: { id: true },
        });
        if (!exercice) {
            exercice = await this.prisma.exercice.create({
                data: { tenantId: combinaisonId, dateDebut: agregat.exercice.dateDebut, dateFin: agregat.exercice.dateFin },
                select: { id: true },
            });
        }
        await this.prisma.ligneEcriture.deleteMany({
            where: { ecriture: { tenantId: combinaisonId, exerciceId: exercice.id } },
        });
        await this.prisma.ecriture.deleteMany({ where: { tenantId: combinaisonId, exerciceId: exercice.id } });
        await this.prisma.compte.createMany({
            data: agregat.lignes.map((l) => ({
                tenantId: combinaisonId,
                numero: l.numero,
                intitule: l.intitule,
                classe: `CLASSE_${l.numero[0]}`,
            })),
            skipDuplicates: true,
        });
        const comptes = await this.prisma.compte.findMany({
            where: { tenantId: combinaisonId, numero: { in: agregat.lignes.map((l) => l.numero) } },
            select: { id: true, numero: true },
        });
        const compteParNumero = new Map(comptes.map((c) => [c.numero, c.id]));
        let journal = await this.prisma.journal.findFirst({
            where: { tenantId: combinaisonId, code: 'OD' },
            select: { id: true, numerotation: true },
        });
        if (!journal) {
            journal = await this.prisma.journal.create({
                data: {
                    tenantId: combinaisonId,
                    code: 'OD',
                    intitule: 'Combinaison du groupe',
                    type: client_1.TypeJournal.GENERAL,
                    numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER,
                },
                select: { id: true, numerotation: true },
            });
        }
        const arrondi2 = (x) => Math.round(x * 100) / 100;
        const colonnes = GroupeService_1.colonnesDeCombinaison(agregat.lignes);
        const pieces = [
            {
                cle: 'report',
                libelle: 'Report à-nouveau',
                date: agregat.exercice.dateDebut,
                estGenereeParCloture: true,
                estSoldeDesComptesDeGestion: false,
            },
            {
                cle: 'mouvement',
                libelle: 'Mouvements de l’exercice',
                date: agregat.exercice.dateDebut,
                estGenereeParCloture: false,
                estSoldeDesComptesDeGestion: false,
            },
            {
                cle: 'cloture',
                libelle: 'Solde des comptes de gestion',
                date: agregat.exercice.dateFin,
                estGenereeParCloture: true,
                estSoldeDesComptesDeGestion: true,
            },
        ];
        for (const piece of pieces) {
            const lignes = colonnes[piece.cle];
            const ecart = arrondi2(lignes.reduce((s, l) => s + l.debit - l.credit, 0));
            if (Math.abs(ecart) > 0.01) {
                throw new common_1.BadRequestException(`La colonne « ${piece.libelle} » de la balance agrégée ne s'équilibre pas (écart ${ecart.toFixed(2)}) · ` +
                    "la liasse du groupe n'est pas produite.");
            }
        }
        for (const piece of pieces) {
            const lignes = colonnes[piece.cle];
            if (lignes.length === 0)
                continue;
            const numeroPiece = await (0, numerotation_piece_1.prochainNumeroPiece)(this.prisma, combinaisonId, journal, exercice.id, piece.date);
            await this.prisma.ecriture.create({
                data: {
                    tenantId: combinaisonId,
                    exerciceId: exercice.id,
                    journalId: journal.id,
                    numeroPiece,
                    date: piece.date,
                    libelle: `Combinaison du groupe · ${piece.libelle} · ${agregat.dossiers.length} dossiers`,
                    reference: 'GROUPE',
                    createdBy,
                    estGenereeParCloture: piece.estGenereeParCloture,
                    estSoldeDesComptesDeGestion: piece.estSoldeDesComptesDeGestion,
                    statut: client_1.StatutEcriture.VALIDEE,
                    valideeBy: createdBy,
                    valideeAt: new Date(),
                    lignes: {
                        create: lignes.map((l) => ({
                            compteId: compteParNumero.get(l.numero),
                            debit: l.debit,
                            credit: l.credit,
                        })),
                    },
                },
            });
        }
        const classeur = await this.exportService.liasseCompleteExcel(combinaisonId, exercice.id);
        return { ...classeur, nomFichier: `groupe-${classeur.nomFichier}` };
    }
};
exports.GroupeService = GroupeService;
exports.GroupeService = GroupeService = GroupeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        auth_service_1.AuthService,
        export_service_1.ExportService])
], GroupeService);
//# sourceMappingURL=groupe.service.js.map