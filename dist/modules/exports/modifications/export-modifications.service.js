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
exports.ExportModificationsService = exports.PLAFOND_EXPORTS_LISTES = void 0;
exports.versEchange = versEchange;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const prisma_service_1 = require("../../../common/prisma.service");
const transaction_journalisee_1 = require("../../../common/audit/transaction-journalisee");
const lecture_par_lots_1 = require("../../../common/lecture-par-lots");
const ecritures_de_situation_1 = require("../../comptabilite/ecritures-de-situation");
const export_service_1 = require("../export.service");
const classeur_en_flux_1 = require("../classeur-en-flux");
const fichier_en_memoire_1 = require("../fichier-en-memoire");
const pagination_par_numero_1 = require("../pagination-par-numero");
const export_modifications_1 = require("./export-modifications");
exports.PLAFOND_EXPORTS_LISTES = 50;
const EXPORT_SANS_FICHIER = {
    id: true,
    tenantId: true,
    numero: true,
    mode: true,
    inclureBrouillard: true,
    produitAt: true,
    produitPar: true,
    nombreEcritures: true,
    nombreNouvelles: true,
    nombreModifiees: true,
    nombreSupprimees: true,
    nombreLignes: true,
    nombreEnAttente: true,
    nomFichier: true,
    taille: true,
    empreinte: true,
};
const TRANCHE_REGISTRE = 2000;
const DELAI_RANGEMENT_MS = 120_000;
const CONTENU_ECRITURE = {
    journal: { select: { code: true } },
    lignes: {
        select: {
            libelle: true,
            debit: true,
            credit: true,
            montantDevise: true,
            coursApplique: true,
            dateEcheance: true,
            compte: { select: { numero: true } },
            devise: { select: { code: true } },
        },
    },
};
function versEchange(e) {
    const texte = (d) => (d === null ? null : d.toFixed(2));
    return {
        id: e.id,
        date: e.date,
        dateValeur: e.dateValeur,
        journal: e.journal.code,
        numeroPiece: e.numeroPiece,
        reference: e.reference,
        libelle: e.libelle,
        statut: e.statut,
        lignes: e.lignes.map((l) => ({
            compte: l.compte.numero,
            libelle: l.libelle,
            debit: l.debit.toFixed(2),
            credit: l.credit.toFixed(2),
            devise: l.devise?.code ?? null,
            montantDevise: texte(l.montantDevise),
            cours: l.coursApplique === null ? null : l.coursApplique.toString(),
            echeance: l.dateEcheance ? l.dateEcheance.toISOString().slice(0, 10) : null,
        })),
    };
}
let ExportModificationsService = class ExportModificationsService {
    constructor(prisma, exportService) {
        this.prisma = prisma;
        this.exportService = exportService;
    }
    async lister(tenantId, avant) {
        const [lusEtSurplus, total] = await Promise.all([
            this.prisma.exportEcritures.findMany({
                where: { tenantId, ...(avant !== undefined ? { numero: { lt: avant } } : {}) },
                orderBy: { numero: 'desc' },
                take: exports.PLAFOND_EXPORTS_LISTES + 1,
                select: { ...EXPORT_SANS_FICHIER, tenantId: false },
            }),
            this.prisma.exportEcritures.count({ where: { tenantId } }),
        ]);
        const { page: lus, plusAnciensAvant } = (0, pagination_par_numero_1.pageDeNumeros)(lusEtSurplus, exports.PLAFOND_EXPORTS_LISTES);
        const courriels = await this.courriels(tenantId, lus.map((e) => e.produitPar));
        return {
            exports: lus.map((e) => ({ ...e, produitPar: courriels(e.produitPar) })),
            total,
            tronque: total > lus.length,
            plusAnciensAvant,
        };
    }
    async apercu(tenantId, inclureBrouillard) {
        const inv = await this.inventaire(tenantId, client_1.ModeExportEcritures.MODIFICATIONS, inclureBrouillard);
        return {
            dernierNumero: inv.dernierNumero,
            nouvelles: inv.nouvelles,
            modifiees: inv.modifiees,
            supprimees: inv.supprimees.length,
            lignes: inv.lignes,
            enAttente: inv.enAttente,
            plafondLignes: classeur_en_flux_1.MAX_LIGNES_EXPORT,
            brouillardModifieHorsPortee: inv.brouillardModifieHorsPortee,
            horsPlafond: inv.horsPlafond ? await this.motifDuHorsPlafond(tenantId, inv.horsPlafond) : null,
        };
    }
    async motifDuHorsPlafond(tenantId, c) {
        const e = await this.prisma.ecriture.findFirst({
            where: { id: c.id, tenantId, ...ecritures_de_situation_1.HORS_SITUATION },
            select: { numeroPiece: true, date: true, journal: { select: { code: true } } },
        });
        return (0, export_modifications_1.motifHorsPlafond)({ journal: e?.journal.code ?? '?', numeroPiece: e?.numeroPiece ?? null, date: e?.date ?? c.date, lignes: c.lignes }, classeur_en_flux_1.MAX_LIGNES_EXPORT);
    }
    async inventaire(tenantId, mode, inclureBrouillard) {
        const dernier = await this.prisma.exportEcritures.aggregate({ where: { tenantId }, _max: { numero: true } });
        const dernierNumero = dernier._max.numero ?? null;
        const complet = mode === client_1.ModeExportEcritures.COMPLET;
        const dejaParties = [];
        let brouillardModifieHorsPortee = 0;
        const statutsARelire = complet ? Object.values(client_1.StatutEcriture) : [client_1.StatutEcriture.BROUILLARD];
        for (const statutExporte of statutsARelire) {
            let curseur;
            for (;;) {
                const lot = await this.prisma.ecritureExportee.findMany({
                    where: { tenantId, supprimeeAuNumero: null, statutExporte, ...(0, lecture_par_lots_1.idApres)(curseur) },
                    select: { id: true, ecritureId: true, numeroExport: true, statutExporte: true, empreinte: true },
                    orderBy: [{ tenantId: 'asc' }, { supprimeeAuNumero: 'asc' }, { statutExporte: 'asc' }, { id: 'asc' }],
                    take: lecture_par_lots_1.LOT_LECTURE,
                });
                if (lot.length === 0)
                    break;
                const presentes = await this.prisma.ecriture.findMany({
                    where: { tenantId, id: { in: lot.map((r) => r.ecritureId) }, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION },
                    select: { id: true, statut: true },
                });
                const statutPresent = new Map(presentes.map((e) => [e.id, e.statut]));
                const aRelire = [];
                const horsPortee = [];
                for (const r of lot) {
                    const statut = statutPresent.get(r.ecritureId);
                    if (statut === undefined)
                        continue;
                    if (!inclureBrouillard && statut === client_1.StatutEcriture.BROUILLARD)
                        horsPortee.push(r.ecritureId);
                    else
                        aRelire.push(r.ecritureId);
                }
                const parId = new Map(lot.map((r) => [r.ecritureId, r]));
                const entreeDe = (id) => {
                    const r = parId.get(id);
                    return { numeroExport: r.numeroExport, statutExporte: r.statutExporte, empreinte: r.empreinte };
                };
                for (let i = 0; i < aRelire.length; i += classeur_en_flux_1.LOT_EXPORT) {
                    for (const e of await this.contenus(tenantId, aRelire.slice(i, i + classeur_en_flux_1.LOT_EXPORT))) {
                        const entree = entreeDe(e.id);
                        const mouvement = (0, export_modifications_1.mouvementDe)(entree, (0, export_modifications_1.empreinteEcriture)(versEchange(e)));
                        if (mouvement === 'RENVOYEE' && !complet)
                            continue;
                        dejaParties.push({ id: e.id, date: e.date, lignes: e.lignes.length, entree, mouvement });
                    }
                }
                for (let i = 0; i < horsPortee.length; i += classeur_en_flux_1.LOT_EXPORT) {
                    for (const e of await this.contenus(tenantId, horsPortee.slice(i, i + classeur_en_flux_1.LOT_EXPORT))) {
                        if ((0, export_modifications_1.mouvementDe)(entreeDe(e.id), (0, export_modifications_1.empreinteEcriture)(versEchange(e))) === 'MODIFIEE')
                            brouillardModifieHorsPortee++;
                    }
                }
                if (lot.length < lecture_par_lots_1.LOT_LECTURE)
                    break;
                curseur = lot[lot.length - 1].id;
            }
        }
        const supprimees = await this.supprimeesDepuisLeurEnvoi(tenantId);
        dejaParties.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
        const retenues = [];
        let lignes = 0;
        let enAttente = 0;
        let horsPlafond = null;
        for (const c of dejaParties) {
            if (c.lignes > classeur_en_flux_1.MAX_LIGNES_EXPORT) {
                horsPlafond ??= c;
                continue;
            }
            if (lignes + c.lignes > classeur_en_flux_1.MAX_LIGNES_EXPORT) {
                enAttente++;
                continue;
            }
            retenues.push(c);
            lignes += c.lignes;
        }
        let derniere;
        let premiereEnAttente;
        const vues = new Set(dejaParties.map((c) => c.id));
        for (;;) {
            const lot = await this.jamaisPartiesApres(tenantId, inclureBrouillard, derniere);
            if (lot.length === 0)
                break;
            const comptes = await this.prisma.ligneEcriture.groupBy({
                by: ['ecritureId'],
                where: { ecritureId: { in: lot.map((e) => e.id) }, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION } },
                _count: { _all: true },
            });
            const lignesDe = new Map(comptes.map((c) => [c.ecritureId, c._count._all]));
            for (const e of lot) {
                if (vues.has(e.id))
                    continue;
                vues.add(e.id);
                const n = lignesDe.get(e.id) ?? 0;
                if (n > classeur_en_flux_1.MAX_LIGNES_EXPORT)
                    horsPlafond ??= { id: e.id, date: e.date, lignes: n, mouvement: 'NOUVELLE' };
                if (enAttente > 0 || horsPlafond !== null || lignes + n > classeur_en_flux_1.MAX_LIGNES_EXPORT) {
                    premiereEnAttente = e;
                    break;
                }
                retenues.push({ id: e.id, date: e.date, lignes: n, mouvement: 'NOUVELLE' });
                lignes += n;
            }
            if (premiereEnAttente || lot.length < lecture_par_lots_1.LOT_LECTURE)
                break;
            derniere = lot[lot.length - 1];
        }
        if (premiereEnAttente) {
            const attendent = await this.jamaisPartiesDepuis(tenantId, inclureBrouillard, premiereEnAttente);
            enAttente += horsPlafond?.mouvement === 'NOUVELLE' && horsPlafond.id === premiereEnAttente.id ? attendent - 1 : attendent;
        }
        retenues.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
        return {
            dernierNumero,
            retenues,
            supprimees,
            lignes,
            nouvelles: retenues.filter((c) => c.mouvement === 'NOUVELLE').length,
            modifiees: retenues.filter((c) => c.mouvement === 'MODIFIEE').length,
            renvoyees: retenues.filter((c) => c.mouvement === 'RENVOYEE').length,
            enAttente,
            horsPlafond,
            brouillardModifieHorsPortee,
        };
    }
    contenus(tenantId, ids) {
        return this.prisma.ecriture.findMany({
            where: { tenantId, id: { in: ids }, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION },
            include: CONTENU_ECRITURE,
        });
    }
    async jamaisPartiesApres(tenantId, inclureBrouillard, apres) {
        const borne = apres ? client_1.Prisma.sql `AND (e."date", e."id") > (${apres.date}, ${apres.id})` : client_1.Prisma.empty;
        const lot = await this.prisma.$queryRaw `
      SELECT e."id", e."date" FROM "ecritures" e
      WHERE e."tenantId" = ${tenantId}
        AND e."estANouveauProvisoire" = false
        AND e."statut"::text <> ${client_1.StatutEcriture.SITUATION}
        AND (${inclureBrouillard} OR e."statut"::text = ${client_1.StatutEcriture.VALIDEE})
        ${borne}
        AND NOT EXISTS (
          SELECT 1 FROM "ecritures_exportees" r WHERE r."tenantId" = e."tenantId" AND r."ecritureId" = e."id"
        )
      ORDER BY e."date", e."id"
      LIMIT ${lecture_par_lots_1.LOT_LECTURE}`;
        return lot;
    }
    async jamaisPartiesDepuis(tenantId, inclureBrouillard, depuis) {
        const lignes = await this.prisma.$queryRaw `
      SELECT COUNT(*)::int AS "n" FROM "ecritures" e
      WHERE e."tenantId" = ${tenantId}
        AND e."estANouveauProvisoire" = false
        AND e."statut"::text <> ${client_1.StatutEcriture.SITUATION}
        AND (${inclureBrouillard} OR e."statut"::text = ${client_1.StatutEcriture.VALIDEE})
        AND (e."date", e."id") >= (${depuis.date}, ${depuis.id})
        AND NOT EXISTS (
          SELECT 1 FROM "ecritures_exportees" r WHERE r."tenantId" = e."tenantId" AND r."ecritureId" = e."id"
        )`;
        return lignes[0]?.n ?? 0;
    }
    async supprimeesDepuisLeurEnvoi(tenantId) {
        const supprimees = [];
        for (const statutExporte of Object.values(client_1.StatutEcriture)) {
            let apres = '';
            for (;;) {
                const lot = (await this.prisma.$queryRaw `
          SELECT r."id", r."ecritureId", r."numeroExport", r."date", r."journalCode", r."piece", r."libelle"
          FROM "ecritures_exportees" r
          WHERE r."tenantId" = ${tenantId} AND r."supprimeeAuNumero" IS NULL
            AND r."statutExporte" = CAST(${statutExporte} AS "StatutEcriture") AND r."id" > ${apres}
            AND NOT EXISTS (
              SELECT 1 FROM "ecritures" e
              WHERE e."id" = r."ecritureId" AND e."tenantId" = r."tenantId"
                AND e."estANouveauProvisoire" = false AND e."statut"::text <> ${client_1.StatutEcriture.SITUATION}
            )
          ORDER BY r."tenantId", r."supprimeeAuNumero", r."statutExporte", r."id"
          LIMIT ${lecture_par_lots_1.LOT_LECTURE}`);
                for (const r of lot) {
                    supprimees.push({ ecritureId: r.ecritureId, numeroExport: r.numeroExport, date: r.date, journalCode: r.journalCode, piece: r.piece, libelle: r.libelle });
                }
                if (lot.length < lecture_par_lots_1.LOT_LECTURE)
                    break;
                apres = lot[lot.length - 1].id;
            }
        }
        return supprimees;
    }
    async exporter(tenantId, userId, mode, inclureBrouillard) {
        const inv = await this.inventaire(tenantId, mode, inclureBrouillard);
        if (inv.horsPlafond)
            throw new common_1.PayloadTooLargeException(await this.motifDuHorsPlafond(tenantId, inv.horsPlafond));
        if (mode === client_1.ModeExportEcritures.COMPLET && inv.enAttente > 0) {
            throw new common_1.PayloadTooLargeException(`L'export complet porterait plus de ${classeur_en_flux_1.MAX_LIGNES_EXPORT.toLocaleString('fr-FR')} lignes · il est refusé plutôt ` +
                `qu'amputé. Exportez les modifications · elles partent par lots sous ce plafond, chaque lot disant ce qui attend.`);
        }
        if (inv.retenues.length === 0 && inv.supprimees.length === 0) {
            throw new common_1.BadRequestException((0, export_modifications_1.motifExportVide)(inv.dernierNumero));
        }
        const numero = (inv.dernierNumero ?? 0) + 1;
        const produitAt = new Date();
        const auteur = (await this.courriels(tenantId, [userId]))(userId);
        const identite = await this.exportService.identiteEtat(tenantId, {});
        const ecrites = new Map();
        const decompte = { ecritures: 0, nouvelles: 0, modifiees: 0, lignes: 0 };
        const { nomFichier, contenu } = await (0, fichier_en_memoire_1.produireEnMemoire)(async (ouvrir) => {
            const sortie = ouvrir((0, export_modifications_1.nomFichierExport)(numero, produitAt));
            const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, useSharedStrings: false, useStyles: true });
            classeur.creator = 'OmegaX';
            classeur.created = produitAt;
            const pied = `&L${identite.entite}${(0, classeur_en_flux_1.segmentIdentification)(identite) ? ` · ${(0, classeur_en_flux_1.segmentIdentification)(identite)}` : ''} · export n° ${numero}&RPage &P / &N`;
            const feuille = classeur.addWorksheet(export_modifications_1.FEUILLE_ECRITURES, {
                views: [{ state: 'frozen', ySplit: 1 }],
                headerFooter: { oddFooter: pied },
            });
            feuille.columns = export_modifications_1.COLONNES_ECHANGE.map((c) => ({ ...c }));
            const pieces = new export_modifications_1.PiecesDistinctes();
            for (let i = 0; i < inv.retenues.length; i += classeur_en_flux_1.LOT_EXPORT) {
                const tranche = inv.retenues.slice(i, i + classeur_en_flux_1.LOT_EXPORT);
                const lues = await this.prisma.ecriture.findMany({
                    where: { tenantId, id: { in: tranche.map((c) => c.id) }, estANouveauProvisoire: false, ...ecritures_de_situation_1.HORS_SITUATION },
                    include: CONTENU_ECRITURE,
                });
                const parId = new Map(lues.map((e) => [e.id, e]));
                for (const c of tranche) {
                    const e = parId.get(c.id);
                    if (!e || (!inclureBrouillard && e.statut === client_1.StatutEcriture.BROUILLARD))
                        continue;
                    if (ecrites.has(e.id))
                        continue;
                    const echange = versEchange(e);
                    const empreinte = (0, export_modifications_1.empreinteEcriture)(echange);
                    const mouvement = (0, export_modifications_1.mouvementDe)(c.entree, empreinte);
                    const piece = pieces.piece({ id: e.id, date: e.date, journal: echange.journal, numeroPiece: e.numeroPiece });
                    const mention = (0, export_modifications_1.libelleMouvement)(mouvement, c.entree, e.statut);
                    for (const l of (0, export_modifications_1.ordonnerLignes)(echange.lignes)) {
                        feuille
                            .addRow({
                            date: e.date,
                            journal: echange.journal,
                            piece,
                            reference: e.reference ?? '',
                            compte: l.compte,
                            libelle: l.libelle ?? e.libelle,
                            debit: Number(l.debit),
                            credit: Number(l.credit),
                            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
                            devise: l.devise ?? '',
                            cours: l.cours === null ? null : Number(l.cours),
                            echeance: l.echeance ? new Date(`${l.echeance}T00:00:00Z`) : null,
                            jourValeur: e.dateValeur,
                            statut: (0, ecritures_de_situation_1.libelleDuStatut)(e.statut),
                            mouvement: mention,
                            identifiant: e.id,
                        })
                            .commit();
                        decompte.lignes++;
                        await (0, classeur_en_flux_1.attendreLeTuyau)(sortie);
                    }
                    decompte.ecritures++;
                    if (mouvement === 'NOUVELLE')
                        decompte.nouvelles++;
                    if (mouvement === 'MODIFIEE')
                        decompte.modifiees++;
                    ecrites.set(e.id, { statut: e.statut, empreinte, date: e.date, journalCode: echange.journal, piece, libelle: e.libelle });
                }
            }
            feuille.commit();
            const supprimees = classeur.addWorksheet(export_modifications_1.FEUILLE_SUPPRIMEES, { views: [{ state: 'frozen', ySplit: 1 }], headerFooter: { oddFooter: pied } });
            supprimees.columns = export_modifications_1.COLONNES_SUPPRIMEES.map((c) => ({ ...c }));
            for (const s of inv.supprimees) {
                supprimees
                    .addRow({ identifiant: s.ecritureId, date: s.date, journal: s.journalCode, piece: s.piece, libelle: s.libelle, envoyee: s.numeroExport })
                    .commit();
                await (0, classeur_en_flux_1.attendreLeTuyau)(sortie);
            }
            supprimees.commit();
            const recap = classeur.addWorksheet(export_modifications_1.FEUILLE_EXPORT, { headerFooter: { oddFooter: pied } });
            recap.columns = [
                { header: 'Rubrique', key: 'rubrique', width: 44 },
                { header: 'Valeur', key: 'valeur', width: 60 },
            ];
            const lignesRecap = [
                ['Dossier', identite.entite],
                ['Identification', (0, classeur_en_flux_1.segmentIdentification)(identite) || 'non renseignée'],
                ['Export n°', numero],
                [
                    'Portée',
                    mode === client_1.ModeExportEcritures.COMPLET
                        ? 'Export complet'
                        : inv.dernierNumero === null
                            ? 'Premier export'
                            : `Modifications depuis l'export n° ${inv.dernierNumero}`,
                ],
                ['Brouillard compris', inclureBrouillard ? 'Oui' : 'Non, livre-journal seul'],
                ['Produit le', produitAt.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })],
                ['Produit par', auteur],
                ['Écritures portées', decompte.ecritures],
                ['dont nouvelles', decompte.nouvelles],
                ['dont modifiées depuis leur envoi', decompte.modifiees],
                ['Lignes', decompte.lignes],
                ['Écritures supprimées depuis leur envoi', inv.supprimees.length],
                ["Laissées pour l'export suivant (plafond de lignes)", inv.enAttente],
                ...(inclureBrouillard
                    ? []
                    : [['Envoyées au brouillard, modifiées depuis, hors de cette portée', inv.brouillardModifieHorsPortee]]),
                ['Unité monétaire', identite.devise],
                ['Relecture', export_modifications_1.MENTION_RELECTURE],
            ];
            for (const [rubrique, valeur] of lignesRecap)
                recap.addRow({ rubrique, valeur }).commit();
            recap.commit();
            await classeur.commit();
        });
        if (decompte.ecritures === 0 && inv.supprimees.length === 0) {
            throw new common_1.BadRequestException((0, export_modifications_1.motifExportVide)(inv.dernierNumero));
        }
        const empreinte = (0, export_modifications_1.empreinteFichier)(contenu);
        const enregistre = await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const verrou = (await tx.$queryRaw `SELECT pg_try_advisory_xact_lock(hashtext(${`exports-ecritures:${tenantId}`})) AS "pris"`);
            if (!verrou[0]?.pris) {
                throw new common_1.ConflictException("Un autre export de ce dossier est en cours de rangement · rien n'a été rangé, aucun numéro n'est pris. " +
                    "Relancez l'export dans un instant, il partira de ce nouvel envoi.");
            }
            const max = await tx.exportEcritures.aggregate({ where: { tenantId }, _max: { numero: true } });
            if ((max._max.numero ?? null) !== inv.dernierNumero) {
                throw new common_1.ConflictException(`Un autre export (n° ${max._max.numero}) a été produit pendant celui-ci · rien n'a été rangé, aucun numéro ` +
                    "n'est pris. Relancez l'export, il partira de ce nouvel envoi.");
            }
            const cree = await tx.exportEcritures.create({
                data: {
                    tenantId,
                    numero,
                    mode,
                    inclureBrouillard,
                    produitAt,
                    produitPar: userId,
                    nombreEcritures: decompte.ecritures,
                    nombreNouvelles: decompte.nouvelles,
                    nombreModifiees: decompte.modifiees,
                    nombreSupprimees: inv.supprimees.length,
                    nombreLignes: decompte.lignes,
                    nombreEnAttente: inv.enAttente,
                    nomFichier,
                    taille: contenu.length,
                    empreinte,
                    contenu,
                },
                select: EXPORT_SANS_FICHIER,
            });
            const ids = [...ecrites.keys()];
            for (let i = 0; i < ids.length; i += TRANCHE_REGISTRE) {
                const tranche = ids.slice(i, i + TRANCHE_REGISTRE);
                await tx.ecritureExportee.deleteMany({ where: { tenantId, ecritureId: { in: tranche } } });
                await tx.ecritureExportee.createMany({
                    data: tranche.map((ecritureId) => {
                        const e = ecrites.get(ecritureId);
                        return {
                            tenantId,
                            ecritureId,
                            numeroExport: numero,
                            statutExporte: e.statut,
                            empreinte: e.empreinte,
                            date: e.date,
                            journalCode: e.journalCode,
                            piece: e.piece,
                            libelle: e.libelle,
                        };
                    }),
                });
            }
            const supprimeesIds = inv.supprimees.map((s) => s.ecritureId);
            for (let i = 0; i < supprimeesIds.length; i += TRANCHE_REGISTRE) {
                await tx.ecritureExportee.updateMany({
                    where: { tenantId, ecritureId: { in: supprimeesIds.slice(i, i + TRANCHE_REGISTRE) }, supprimeeAuNumero: null },
                    data: { supprimeeAuNumero: numero },
                });
            }
            return cree;
        }, { timeout: DELAI_RANGEMENT_MS, maxWait: 10_000 });
        return {
            id: enregistre.id,
            numero,
            mode,
            inclureBrouillard,
            produitAt,
            produitPar: auteur,
            nombreEcritures: decompte.ecritures,
            nombreNouvelles: decompte.nouvelles,
            nombreModifiees: decompte.modifiees,
            nombreSupprimees: inv.supprimees.length,
            nombreLignes: decompte.lignes,
            nombreEnAttente: inv.enAttente,
            brouillardModifieHorsPortee: inv.brouillardModifieHorsPortee,
            nomFichier,
            taille: contenu.length,
            empreinte,
        };
    }
    async fichier(tenantId, id) {
        const exp = await this.prisma.exportEcritures.findFirst({ where: { id, tenantId }, select: { nomFichier: true, contenu: true } });
        if (!exp)
            throw new common_1.NotFoundException('Export introuvable pour ce dossier.');
        return { nomFichier: exp.nomFichier, contenu: exp.contenu };
    }
    async courriels(tenantId, ids) {
        const auteurs = await this.prisma.user.findMany({
            where: { tenantId, id: { in: [...new Set(ids)] } },
            select: { id: true, email: true },
        });
        const parId = new Map(auteurs.map((u) => [u.id, u.email]));
        return (id) => parId.get(id) ?? 'utilisateur retiré du dossier';
    }
};
exports.ExportModificationsService = ExportModificationsService;
exports.ExportModificationsService = ExportModificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        export_service_1.ExportService])
], ExportModificationsService);
//# sourceMappingURL=export-modifications.service.js.map