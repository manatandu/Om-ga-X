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
var RestitutionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestitutionService = exports.LOT_PIECES = void 0;
exports.nomDeLArchive = nomDeLArchive;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const archiver = require("archiver");
const node_stream_1 = require("node:stream");
const prisma_service_1 = require("../../../common/prisma.service");
const extension_audit_1 = require("../../../common/audit/extension-audit");
const lecture_fichier_1 = require("../../import/lecture-fichier");
const tables_restitution_1 = require("./tables-restitution");
const manifeste_restitution_1 = require("./manifeste-restitution");
const lecture_par_lots_1 = require("../../../common/lecture-par-lots");
const LOT = 2_000;
exports.LOT_PIECES = 500;
const SEPARATEUR = ';';
function nomDeLArchive(dossier, jour) {
    const denomination = dossier.nom
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .toLowerCase()
        .slice(0, 40)
        .replace(/^-+|-+$/g, '');
    const identifiant = dossier.id.replace(/[^A-Za-z0-9-]+/g, '-');
    const date = jour.toISOString().slice(0, 10);
    return `restitution-${denomination ? `${denomination}-` : ''}${identifiant}-${date}.zip`;
}
let RestitutionService = RestitutionService_1 = class RestitutionService {
    constructor(prisma) {
        this.prisma = prisma;
        this.journal = new common_1.Logger(RestitutionService_1.name);
    }
    async nomDeLArchive(tenantId, maintenant = new Date()) {
        const dossier = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, nom: true } });
        if (!dossier)
            throw new common_1.NotFoundException('Dossier introuvable : aucune archive ne peut être produite.');
        return nomDeLArchive(dossier, maintenant);
    }
    enTexte(v) {
        if (v === null || v === undefined)
            return '';
        if (v instanceof Date)
            return v.toISOString();
        if (typeof v === 'bigint')
            return v.toString();
        if (typeof v === 'object' && typeof v.toFixed === 'function') {
            return String(v);
        }
        if (typeof v === 'object')
            return JSON.stringify(v);
        return String(v);
    }
    async *lignesCsv(modele, tenantId, compteur, interrompre) {
        try {
            yield* this.lignesCsvBrutes(modele, tenantId, compteur);
        }
        catch (e) {
            interrompre(new Error(`table ${modele} non lue · ${e instanceof Error ? e.message : String(e)}`));
        }
    }
    async *lignesCsvBrutes(modele, tenantId, compteur) {
        const colonnes = (0, tables_restitution_1.colonnesDuModele)(modele);
        const cle = (0, tables_restitution_1.ordreDuModele)(modele);
        const borne = (0, tables_restitution_1.borneDuModele)(modele, tenantId);
        const delegue = this.prisma[modele.charAt(0).toLowerCase() + modele.slice(1)];
        yield this.ligneCsv(colonnes, Object.fromEntries(colonnes.map((c) => [c, c])));
        let dernier = null;
        for (;;) {
            const lot = await delegue.findMany({
                where: dernier === null ? borne : { ...borne, [cle]: { gt: dernier } },
                orderBy: { [cle]: 'asc' },
                take: LOT,
                select: Object.fromEntries(colonnes.map((c) => [c, true])),
            });
            if (lot.length === 0)
                return;
            for (const ligne of lot) {
                yield this.ligneCsv(colonnes, ligne);
                compteur.ecrites++;
            }
            dernier = lot[lot.length - 1][cle];
            if (lot.length < LOT)
                return;
        }
    }
    ligneCsv(colonnes, ligne) {
        return `${colonnes.map((c) => (0, lecture_fichier_1.ecrireCelluleCsv)(this.enTexte(ligne[c]), SEPARATEUR)).join(SEPARATEUR)}\r\n`;
    }
    async *ligneDuDossierCsv(tenantId, compteur, interrompre) {
        const colonnes = (0, tables_restitution_1.colonnesDuModele)(tables_restitution_1.TABLE_DU_DOSSIER);
        yield this.ligneCsv(colonnes, Object.fromEntries(colonnes.map((c) => [c, c])));
        try {
            const dossier = await this.prisma.tenant.findUniqueOrThrow({
                where: { id: tenantId },
                select: Object.fromEntries(colonnes.map((c) => [c, true])),
            });
            yield this.ligneCsv(colonnes, dossier);
            compteur.ecrites++;
        }
        catch (e) {
            interrompre(new Error(`table ${tables_restitution_1.TABLE_DU_DOSSIER} non lue · ${e instanceof Error ? e.message : String(e)}`));
        }
    }
    async inventaire(tenantId) {
        const comptes = { [tables_restitution_1.TABLE_DU_DOSSIER]: 1 };
        for (const modele of tables_restitution_1.TABLES_RESTITUEES) {
            const delegue = this.prisma[modele.charAt(0).toLowerCase() + modele.slice(1)];
            comptes[modele] = await delegue.count({ where: (0, tables_restitution_1.borneDuModele)(modele, tenantId) });
        }
        return comptes;
    }
    async produire(tenantId, acteur, sortie) {
        const dossier = await this.prisma.tenant.findUniqueOrThrow({
            where: { id: tenantId },
            select: { id: true, nom: true, referentiel: true },
        });
        const lignesParTable = await this.inventaire(tenantId);
        const horodatage = new Date();
        const maillon = await (0, extension_audit_1.ajouterMaillon)(this.prisma.clientNu, {
            tenantId,
            acteurId: acteur.id,
            acteurEmail: acteur.email,
            adresseIp: acteur.adresseIp,
            action: client_1.ActionAudit.EXTRACTION,
            entite: 'Tenant',
            entiteId: tenantId,
            avant: null,
            apres: { tables: tables_restitution_1.TABLES_DE_L_ARCHIVE.length, lignes: lignesParTable },
        });
        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('warning', (e) => this.journal.warn(`Archive · ${e.message}`));
        archive.on('error', (e) => {
            this.journal.error(`Archive interrompue · ${e.message}`);
            sortie.destroy(e);
        });
        archive.pipe(sortie);
        let interrompue = false;
        let signalerArret = () => undefined;
        const arret = new Promise((resoudre) => (signalerArret = resoudre));
        const interrompre = (e) => {
            if (interrompue)
                return;
            interrompue = true;
            this.journal.error(`Restitution interrompue · ${e.message}`);
            archive.abort();
            sortie.destroy(e);
            signalerArret();
        };
        let traitees = 0;
        let ajoutees = 0;
        const attentes = [];
        archive.on('entry', () => {
            traitees++;
            for (const a of attentes.filter((x) => traitees >= x.seuil)) {
                attentes.splice(attentes.indexOf(a), 1);
                a.resoudre();
            }
        });
        const quandEcrites = (seuil) => Promise.race([traitees >= seuil ? Promise.resolve() : new Promise((resoudre) => attentes.push({ seuil, resoudre })), arret]);
        ajoutees++;
        archive.append((0, manifeste_restitution_1.ecrireManifeste)({
            dossier,
            demandeePar: acteur.email,
            horodatage: horodatage.toISOString(),
            maillon,
            lignesParTable,
        }), { name: 'MANIFESTE.md' });
        const ecrites = { [tables_restitution_1.TABLE_DU_DOSSIER]: { ecrites: 0 } };
        ajoutees++;
        archive.append(node_stream_1.Readable.from(this.ligneDuDossierCsv(tenantId, ecrites[tables_restitution_1.TABLE_DU_DOSSIER], interrompre)), {
            name: (0, tables_restitution_1.fichierDeLaTable)(tables_restitution_1.TABLE_DU_DOSSIER),
        });
        for (const modele of tables_restitution_1.TABLES_RESTITUEES) {
            ecrites[modele] = { ecrites: 0 };
            ajoutees++;
            archive.append(node_stream_1.Readable.from(this.lignesCsv(modele, tenantId, ecrites[modele], interrompre)), {
                name: (0, tables_restitution_1.fichierDeLaTable)(modele),
            });
        }
        let pieces;
        try {
            const annonces = await Promise.all(tables_restitution_1.TABLES_DE_PIECES.map((t) => this.delegueDesPieces(t.modele).count({ where: { tenantId, ...t.filtre } })));
            pieces = { annoncees: annonces.reduce((t, n) => t + n, 0), ecrites: 0, manquantes: [] };
            for (const [rang, table] of tables_restitution_1.TABLES_DE_PIECES.entries()) {
                const delegue = this.delegueDesPieces(table.modele);
                let curseur;
                let lues = 0;
                while (!interrompue) {
                    const lot = await delegue.findMany({
                        where: { tenantId, ...table.filtre, ...(0, lecture_par_lots_1.idApres)(curseur) },
                        select: { id: true, nomFichier: true },
                        orderBy: { id: 'asc' },
                        take: exports.LOT_PIECES,
                    });
                    for (const piece of lot) {
                        ajoutees++;
                        archive.append(node_stream_1.Readable.from(this.contenuDocument(tenantId, piece.id, pieces, table.modele, table.dossier)), {
                            name: (0, tables_restitution_1.fichierDeLaPiece)(table.dossier, piece.id, piece.nomFichier ?? table.nomParDefaut ?? 'piece'),
                        });
                    }
                    lues += lot.length;
                    if (lot.length < exports.LOT_PIECES)
                        break;
                    curseur = lot[lot.length - 1].id;
                    await quandEcrites(ajoutees);
                }
                if (lues < annonces[rang]) {
                    pieces.manquantes.push(`${table.dossier};${annonces[rang] - lues} pièce(s) · retirée(s) entre le décompte et la lecture`);
                }
            }
        }
        catch (e) {
            interrompre(new Error(`pièces non lues · ${e instanceof Error ? e.message : String(e)}`));
            await arret;
            return;
        }
        archive.append(node_stream_1.Readable.from(this.controlesApres(quandEcrites(ajoutees), lignesParTable, ecrites, pieces)), {
            name: 'controles.txt',
        });
        const fin = archive.finalize();
        fin.catch(() => undefined);
        await Promise.race([fin, arret]);
    }
    async *contenuDocument(tenantId, id, pieces, modele = 'DocumentTiers', dossier = 'documents-tiers') {
        try {
            const document = await this.delegueDesPieces(modele).findFirst({ where: { id, tenantId }, select: { contenu: true } });
            if (!document || document.contenu === null) {
                pieces.manquantes.push(`${dossier};${id} · retirée pendant l'extraction`);
                return;
            }
            pieces.ecrites++;
            yield Buffer.from(document.contenu);
        }
        catch (e) {
            const motif = e instanceof Error ? e.message : String(e);
            this.journal.warn(`Pièce ${dossier}/${id} non lue · ${motif}`);
            pieces.manquantes.push(`${dossier};${id} · illisible (${motif})`);
        }
    }
    delegueDesPieces(modele) {
        const nom = modele.charAt(0).toLowerCase() + modele.slice(1);
        return this.prisma[nom];
    }
    async *controlesApres(attente, annonce, ecrites, pieces) {
        await attente;
        yield* this.controles(annonce, ecrites, pieces);
    }
    async *controles(annonce, ecrites, pieces) {
        yield 'Contrôle de l\'extraction · lignes annoncées par l\'inventaire, lignes réellement écrites.\r\n';
        yield "Un écart n'est pas une erreur : les tables sont lues l'une après l'autre, sans\r\n";
        yield "transaction commune, et un dossier en cours d'usage bouge pendant l'extraction.\r\n";
        yield "Il est écrit ici plutôt que tu, pour que le lecteur sache ce qu'il tient.\r\n\r\n";
        let ecarts = 0;
        for (const modele of tables_restitution_1.TABLES_DE_L_ARCHIVE) {
            const a = annonce[modele] ?? 0;
            const e = ecrites[modele]?.ecrites ?? 0;
            if (a !== e)
                ecarts++;
            yield `${modele};${a};${e};${a === e ? 'conforme' : 'ECART'}\r\n`;
        }
        yield `\r\n${ecarts === 0 ? 'Aucun écart.' : `${ecarts} table(s) en écart.`}\r\n`;
        yield `\r\nFichiers sortis à côté des tables (documents des tiers, pièces des virements, exports des écritures, impressions différées, pièces jointes) · ${pieces.annoncees} annoncé(s), ${pieces.ecrites} écrit(s).\r\n`;
        for (const m of pieces.manquantes)
            yield `PIECE NON RESTITUEE;${m}\r\n`;
    }
};
exports.RestitutionService = RestitutionService;
exports.RestitutionService = RestitutionService = RestitutionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RestitutionService);
//# sourceMappingURL=restitution.service.js.map