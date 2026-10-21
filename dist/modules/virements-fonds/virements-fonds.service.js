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
exports.VirementsFondsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma.service");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const exercice_service_1 = require("../exercice/exercice.service");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const comptes_de_passage_1 = require("./comptes-de-passage");
const documents_tiers_1 = require("../tiers/documents-tiers");
const virement_fonds_1 = require("./virement-fonds");
const PLAFOND_LISTE = 500;
let VirementsFondsService = class VirementsFondsService {
    constructor(prisma, ecritures, exercices) {
        this.prisma = prisma;
        this.ecritures = ecritures;
        this.exercices = exercices;
    }
    async journaux(tenantId, ids) {
        return this.prisma.journal.findMany({
            where: { tenantId, id: { in: ids } },
            select: { id: true, code: true, type: true, estActif: true, compteTresorerie: { select: { id: true, numero: true, intitule: true } } },
        });
    }
    async lister(tenantId, exerciceId) {
        const [journaux, liens, virements, total] = await Promise.all([
            this.prisma.journal.findMany({
                where: { tenantId, type: client_1.TypeJournal.TRESORERIE, estActif: true, compteTresorerieId: { not: null } },
                select: { id: true, code: true, intitule: true, compteTresorerie: { select: { id: true, numero: true, intitule: true } } },
                orderBy: { code: 'asc' },
            }),
            this.prisma.compteVirementFonds.findMany({
                where: { tenantId },
                select: { sens: true, compte: { select: { numero: true, intitule: true } } },
            }),
            this.prisma.virementFonds.findMany({
                where: { tenantId, exerciceId },
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                take: PLAFOND_LISTE,
                include: {
                    journalOrigine: { select: { code: true } },
                    journalDestination: { select: { code: true } },
                    ecritureOrigine: { select: { numeroPiece: true, statut: true } },
                    ecritureDestination: { select: { numeroPiece: true, statut: true } },
                    pieces: { select: { id: true, operation: true, nomFichier: true, taille: true }, orderBy: { createdAt: 'asc' } },
                },
            }),
            this.prisma.virementFonds.count({ where: { tenantId, exerciceId } }),
        ]);
        return {
            journaux: journaux.map((j) => ({ ...j, caisse: j.compteTresorerie ? (0, virement_fonds_1.estUneCaisse)(j.compteTresorerie.numero) : false })),
            comptesDePassage: Object.keys(virement_fonds_1.COMPTES_DE_PASSAGE).map((sens) => ({
                sens,
                libelle: virement_fonds_1.LIBELLES_SENS[sens],
                compte: liens.find((l) => l.sens === sens)?.compte ?? null,
            })),
            virements: virements.map((v) => ({ ...v, montant: Number(v.montant) })),
            total,
            tronque: total > virements.length,
        };
    }
    async creer(tenantId, userId, dto) {
        const lus = await this.journaux(tenantId, [dto.journalOrigineId, dto.journalDestinationId]);
        const origine = lus.find((j) => j.id === dto.journalOrigineId) ?? null;
        const destination = lus.find((j) => j.id === dto.journalDestinationId) ?? null;
        const motif = (0, virement_fonds_1.motifRefusVirement)(origine, destination, {
            montant: dto.montant,
            objet: dto.objet,
            sortie: dto.sortie,
            entree: dto.entree,
            porteur: dto.porteur,
        });
        if (motif)
            throw new common_1.BadRequestException(motif);
        const sortie = (0, virement_fonds_1.pieceJugee)(dto.sortie);
        const entree = (0, virement_fonds_1.pieceJugee)(dto.entree);
        if (!sortie || !entree)
            throw new common_1.BadRequestException('Les pièces du virement sont illisibles · reprenez leur nature, leur référence et leur date.');
        const exercice = await this.prisma.exercice.findFirst({
            where: { id: dto.exerciceId, tenantId },
            select: { dateDebut: true, dateFin: true, statut: true },
        });
        if (!exercice)
            throw new common_1.NotFoundException('Exercice introuvable pour ce dossier.');
        if (exercice.statut === 'CLOTURE') {
            throw new common_1.BadRequestException("Cet exercice est clôturé · aucun virement ne s'y passe (AUDCIF art. 20, al. 3).");
        }
        const [debut, fin] = [exercice.dateDebut.toISOString().slice(0, 10), exercice.dateFin.toISOString().slice(0, 10)];
        for (const [piece, operation] of [
            [sortie, client_1.OperationVirementFonds.SORTIE],
            [entree, client_1.OperationVirementFonds.ENTREE],
        ]) {
            if (piece.date < debut || piece.date > fin) {
                throw new common_1.BadRequestException(`La date ${(0, virement_fonds_1.deLOperation)(operation)} (${piece.date.split('-').reverse().join('/')}) tombe hors de l'exercice · ` +
                    "le compte de passage se solde à la fin de l'exercice (fiche du compte 58)." +
                    (operation === client_1.OperationVirementFonds.ENTREE && piece.date > fin ? " Une entrée qui tombe sur l'exercice suivant se passe à la main." : ''));
            }
        }
        const ribs = await this.prisma.ribBanque.findMany({
            where: { tenantId, journalId: { in: [origine.id, destination.id] }, devise: { not: null } },
            select: { devise: true, journal: { select: { code: true } } },
        });
        const enDevise = ribs.find((r) => (r.devise ?? '').toUpperCase() !== monnaie_de_tenue_1.MONNAIE_DE_TENUE);
        if (enDevise) {
            throw new common_1.BadRequestException(`Le journal ${enDevise.journal?.code ?? '·'} est tenu en ${enDevise.devise} · un virement de fonds se passe en francs. ` +
                'Passez ce virement à la main, avec le montant en devise et le cours de chaque ligne.');
        }
        const dossier = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
        const comptes = [origine, destination].map((j) => ({ code: j.code, ...j.compteTresorerie }));
        const lignesEnDevise = await this.prisma.ligneEcriture.findMany({
            where: { compteId: { in: comptes.map((c) => c.id) }, deviseId: { not: null }, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION } },
            select: { compteId: true },
            distinct: ['compteId'],
        });
        const enDevises = comptes.find((c) => (0, virement_fonds_1.estTresorerieEnDevises)(c.numero, dossier.referentiel) || lignesEnDevise.some((l) => l.compteId === c.id));
        if (enDevises) {
            throw new common_1.BadRequestException(`Le compte ${enDevises.numero} du journal ${enDevises.code} est tenu en devise · un virement de fonds se passe en francs, ` +
                'et la conversion des disponibilités à la clôture (AUDCIF art. 57) ne lit que les lignes en devise. ' +
                'Passez ce virement à la main, avec le montant en devise et le cours de chaque ligne.');
        }
        for (const [journal, piece, operation] of [
            [origine, sortie, client_1.OperationVirementFonds.SORTIE],
            [destination, entree, client_1.OperationVirementFonds.ENTREE],
        ]) {
            try {
                await this.exercices.verifierEcritureAutorisee(tenantId, journal.id, new Date(`${piece.date}T00:00:00.000Z`));
            }
            catch (e) {
                if (!(e instanceof common_1.ForbiddenException))
                    throw e;
                const premier = (await this.exercices.premierJourOuvert(tenantId, journal.id, new Date(`${piece.date}T00:00:00.000Z`)))
                    .toISOString()
                    .slice(0, 10);
                const issue = premier <= fin
                    ? 'Ce formulaire ne reporte pas une opération · passez ce virement à la main dans la saisie, où le report se demande.'
                    : `Aucun jour de cet exercice n'est plus ouvert au journal ${journal.code} · plus rien ne s'y inscrit à cette date.`;
                throw new common_1.ForbiddenException(`Pièce ${(0, virement_fonds_1.deLOperation)(operation)} au journal ${journal.code} · ${e.message} ${issue}`);
            }
        }
        const sens = (0, virement_fonds_1.sensDuVirement)(origine.compteTresorerie.numero, destination.compteTresorerie.numero);
        const passage = (await (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`comptes-de-passage:${tenantId}`}))`;
            return (0, comptes_de_passage_1.assurerComptesDePassage)(tx, tenantId);
        }))[sens];
        const reference = (p) => `${virement_fonds_1.LIBELLES_NATURE_PIECE[p.nature]} ${p.reference}`.slice(0, 190);
        const libelle = `Virement de fonds · ${dto.objet.trim()}`.slice(0, 190);
        const lignes = (0, virement_fonds_1.lignesDuVirement)({
            compteOrigineId: origine.compteTresorerie.id,
            compteDestinationId: destination.compteTresorerie.id,
            comptePassageId: passage.id,
            montant: dto.montant,
            libelle,
        });
        const ecriture = (journalId, p, l) => ({
            exerciceId: dto.exerciceId,
            journalId,
            date: p.date,
            libelle,
            reference: reference(p),
            lignes: l,
        });
        await this.ecritures.verifierCaisseProvisionnee(tenantId, dto.exerciceId, [
            { date: sortie.date, lignes: lignes.origine },
            { date: entree.date, lignes: lignes.destination },
        ]);
        const r = await this.ecritures.creerPlusieursAvec(tenantId, userId, [ecriture(origine.id, sortie, lignes.origine), ecriture(destination.id, entree, lignes.destination)], async (tx, [eo, ed]) => {
            const numeros = await tx.ecriture.findMany({ where: { id: { in: [eo.id, ed.id] }, tenantId }, select: { id: true, numeroPiece: true } });
            const numero = (id) => numeros.find((n) => n.id === id)?.numeroPiece ?? '·';
            return tx.virementFonds.create({
                data: {
                    tenantId,
                    exerciceId: dto.exerciceId,
                    date: new Date(`${sortie.date}T00:00:00.000Z`),
                    montant: new client_1.Prisma.Decimal(dto.montant),
                    sens,
                    journalOrigineId: origine.id,
                    journalDestinationId: destination.id,
                    naturePiece: sortie.nature,
                    referencePiece: sortie.reference,
                    datePiece: new Date(`${sortie.date}T00:00:00.000Z`),
                    naturePieceEntree: entree.nature,
                    referencePieceEntree: entree.reference,
                    datePieceEntree: new Date(`${entree.date}T00:00:00.000Z`),
                    objet: dto.objet.trim(),
                    porteur: dto.porteur?.trim() || null,
                    observations: dto.observations?.trim() || null,
                    ecritureOrigineId: eo.id,
                    ecritureDestinationId: ed.id,
                    piecesPassees: `${origine.code} n° ${numero(eo.id)} · ${destination.code} n° ${numero(ed.id)}`,
                    createdBy: userId,
                },
            });
        });
        return { ...r.suite, montant: Number(r.suite.montant), comptePassage: passage };
    }
    async annuler(tenantId, userId, id, dto) {
        const v = await this.prisma.virementFonds.findFirst({
            where: { id, tenantId },
            include: { exercice: { select: { statut: true } } },
        });
        if (!v)
            throw new common_1.NotFoundException('Virement introuvable pour ce dossier.');
        if (v.annuleLe)
            throw new common_1.ConflictException('Ce virement est déjà annulé.');
        if (v.exercice.statut === client_1.StatutExercice.CLOTURE) {
            throw new common_1.BadRequestException("Ce virement appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).");
        }
        const ids = [v.ecritureOrigineId, v.ecritureDestinationId].filter((x) => !!x);
        const ecritures = await this.prisma.ecriture.findMany({
            where: { id: { in: ids }, tenantId },
            select: { id: true, numeroPiece: true, statut: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
        });
        for (const e of ecritures) {
            const tenue = (0, lignes_tenues_1.motifLignesTenues)(e.lignes, `la pièce n° ${e.numeroPiece ?? '·'}`, 'annuler le virement');
            if (tenue)
                throw new common_1.BadRequestException(tenue);
        }
        const motif = dto.motif.trim();
        if (motif.length < 3)
            throw new common_1.BadRequestException("Le motif de l'annulation est exigé · trois caractères au moins.");
        return (0, transaction_journalisee_1.transactionJournalisee)(this.prisma, async (tx) => {
            const prise = await tx.virementFonds.updateMany({
                where: { id: v.id, tenantId, annuleLe: null },
                data: { ecritureOrigineId: null, ecritureDestinationId: null },
            });
            if (prise.count !== 1)
                throw new common_1.ConflictException('Ce virement est déjà annulé.');
            const negatifs = { origine: null, destination: null };
            const numerosNegatifs = [];
            for (const [cote, ecritureId] of [
                ['origine', v.ecritureOrigineId],
                ['destination', v.ecritureDestinationId],
            ]) {
                if (!ecritureId)
                    continue;
                const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
                if (!e)
                    throw new common_1.ConflictException("Une pièce du virement n'existe plus · relisez le virement avant de l'annuler.");
                if (e.statut === client_1.StatutEcriture.BROUILLARD) {
                    const relues = await tx.ligneEcriture.findMany({
                        where: { ecritureId, ecriture: { tenantId } },
                        select: { lettre: true, lettrageId: true, rapprochementId: true },
                    });
                    const tenue = (0, lignes_tenues_1.motifLignesTenues)(relues, 'une pièce du virement', 'annuler le virement');
                    if (tenue)
                        throw new common_1.BadRequestException(tenue);
                    await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: client_1.StatutEcriture.BROUILLARD } } });
                    const r = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: client_1.StatutEcriture.BROUILLARD } });
                    if (r.count !== 1) {
                        throw new common_1.ConflictException("Une pièce du virement a été validée pendant l'annulation · rien n'est retiré. Relancez l'annulation · validée, elle s'inscrira en négatif.");
                    }
                }
                else {
                    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, `Annulation du virement · ${motif}`, tx);
                    negatifs[cote] = negatif.id;
                    const lu = await tx.ecriture.findFirst({ where: { id: negatif.id, tenantId }, select: { numeroPiece: true } });
                    numerosNegatifs.push(`n° ${lu?.numeroPiece ?? '·'}`);
                }
            }
            return tx.virementFonds.update({
                where: { id: v.id, tenantId },
                data: {
                    annuleLe: new Date(),
                    annulePar: userId,
                    motifAnnulation: motif,
                    piecesPassees: `${v.piecesPassees ?? ''} · ${numerosNegatifs.length === 0
                        ? 'retirées du brouillard, numéros libérés'
                        : numerosNegatifs.length === 1 && ids.length === 2
                            ? `une retirée du brouillard, une inscrite en négatif (${numerosNegatifs[0]})`
                            : `inscrites en négatif (${numerosNegatifs.join(', ')})`}`.slice(0, 190),
                    ecritureOrigineId: negatifs.origine ? v.ecritureOrigineId : null,
                    ecritureDestinationId: negatifs.destination ? v.ecritureDestinationId : null,
                    ecritureNegatifOrigineId: negatifs.origine,
                    ecritureNegatifDestinationId: negatifs.destination,
                },
            });
        });
    }
    async deposerPiece(tenantId, virementId, operation, fichier, email) {
        if (operation !== client_1.OperationVirementFonds.SORTIE && operation !== client_1.OperationVirementFonds.ENTREE) {
            throw new common_1.BadRequestException("Dites à quelle opération se joint la pièce · la sortie des fonds (SORTIE) ou leur entrée (ENTREE).");
        }
        const v = await this.prisma.virementFonds.findFirst({ where: { id: virementId, tenantId }, select: { id: true } });
        if (!v)
            throw new common_1.NotFoundException('Virement introuvable pour ce dossier.');
        if (!fichier)
            throw new common_1.BadRequestException('Aucun fichier reçu · joignez le scan de la pièce.');
        const nom = (0, documents_tiers_1.nettoyerNomFichier)((0, documents_tiers_1.decoderNomMultipart)(fichier.originalname));
        const refus = (0, documents_tiers_1.motifRefusDocument)({ nom, contenu: fichier.buffer });
        if (refus)
            throw new common_1.BadRequestException(refus);
        const type = (0, documents_tiers_1.identifierType)(fichier.buffer, nom);
        if ('refus' in type)
            throw new common_1.BadRequestException(type.refus);
        const empreinte = (0, documents_tiers_1.empreinteDocument)(fichier.buffer);
        const ancien = await this.prisma.pieceVirementFonds.findFirst({
            where: { tenantId, virementId: v.id, empreinte, operation: null },
            select: { nomFichier: true },
        });
        if (ancien)
            throw new common_1.ConflictException(`Ce scan est déjà joint au virement entier (« ${ancien.nomFichier} »).`);
        try {
            return await this.prisma.pieceVirementFonds.create({
                data: {
                    tenantId,
                    virementId: v.id,
                    operation,
                    nomFichier: nom,
                    typeMime: type.typeMime,
                    taille: fichier.buffer.length,
                    empreinte,
                    contenu: fichier.buffer,
                    deposePar: email,
                },
                select: { id: true, operation: true, nomFichier: true, taille: true, createdAt: true },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException(`Cette pièce est déjà jointe ${(0, virement_fonds_1.aLOperation)(operation)}.`);
            }
            throw e;
        }
    }
    async telechargerPiece(tenantId, id) {
        const p = await this.prisma.pieceVirementFonds.findFirst({
            where: { id, tenantId },
            select: { nomFichier: true, typeMime: true, contenu: true },
        });
        if (!p)
            throw new common_1.NotFoundException('Pièce introuvable pour ce dossier.');
        return p;
    }
};
exports.VirementsFondsService = VirementsFondsService;
exports.VirementsFondsService = VirementsFondsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ecriture_service_1.EcritureService,
        exercice_service_1.ExerciceService])
], VirementsFondsService);
//# sourceMappingURL=virements-fonds.service.js.map