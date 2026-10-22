import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutRapprochement } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import type { Writable } from 'stream';
import { PrismaService } from '../../common/prisma.service';
import { ExportService } from '../exports/export.service';
import { MAX_LIGNES_EXPORT, OPTIONS_CLASSEUR_EN_FLUX } from '../exports/classeur-en-flux';
import { FORMAT_DATE_FPM, poserFeuilleFpm, type ColonneFpm, type EnteteFpm } from '../exports/presentation-fpm';
import { RapprochementService } from './rapprochement.service';
import { arrondi } from './releve-bancaire';
import {
  COLONNES_EXTRAIT_FPM,
  ENTETES_EXTRAIT_FPM,
  MENTION_EXTRAIT,
  bornesDeLExtrait,
  nomDeFeuilleExtrait,
  ordonnerExtraits,
  soldesProgressifs,
  totauxExtrait,
  type LigneExtrait,
  type SelectionExtraits,
  type TeteExtrait,
} from './extraits-bancaires';

/** La liste des extraits d'un dossier se sert par tranche · au-delà, elle le dit (§ 8 bis). */
export const LIMITE_EXTRAITS = 200;

const FEUILLE_SOMMAIRE = 'Sommaire';

const COLONNES_SOMMAIRE: ColonneFpm[] = [
  { cle: 'compte', largeur: 14, genre: 'texte', filetGauche: true },
  { cle: 'intitule', largeur: 36, genre: 'texte' },
  { cle: 'date', largeur: 12, genre: 'date' },
  { cle: 'lignes', largeur: 10, genre: 'texte' },
  { cle: 'solde', largeur: 16, genre: 'montant', filetDroit: true },
  { cle: 'feuille', largeur: 28, genre: 'texte', filetDroit: true },
];
const ENTETES_SOMMAIRE: EnteteFpm[] = [
  { colonne: 1, ligne: 0, texte: 'Compte' },
  { colonne: 2, ligne: 0, texte: 'Intitulé' },
  { colonne: 3, ligne: 0, texte: 'Date du relevé' },
  { colonne: 4, ligne: 0, texte: 'Lignes' },
  { colonne: 5, ligne: 0, texte: 'Solde imprimé' },
  { colonne: 6, ligne: 0, texte: 'Feuille' },
];

const horodatage = (d: Date) => d.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'short', timeStyle: 'short' });

/**
 * EXTRAITS BANCAIRES (ligne sage-l3, fonction 45) · la liste des relevés
 * importés, compte par compte, et leur ÉDITION CHAÎNÉE en un classeur, une
 * feuille par extrait dans l'ordre de la banque (règles dans
 * `extraits-bancaires.ts`, décision D14). Rien n'est écrit en base par ce
 * service, hors ce que l'import pose déjà (`releveImporteLe`, `releveNomFichier`).
 */
@Injectable()
export class ExtraitsBancairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rapprochements: RapprochementService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * La liste par compte · chaque rapprochement qui porte au moins une ligne
   * de relevé, du plus ancien au plus récent, avec ses nombres et son solde
   * de départ (celui du rapprochement précédent clos, ou déclaré · `depart`).
   * Les nombres viennent d'agrégats, jamais d'une boucle sur les lignes.
   */
  async lister(tenantId: string, compteId?: string): Promise<{ extraits: TeteExtrait[]; total: number; tronque: boolean }> {
    // La borne du dossier est ÉCRITE dans chaque appel (le balayage de
    // `cloisonnement.spec.ts` la lit par sa structure, jamais dans une
    // variable) · `filtre` ne porte que le reste.
    const filtre: Prisma.RapprochementBancaireWhereInput = {
      ...(compteId ? { compteId } : {}),
      releve: { some: { tenantId } },
    };
    const [total, rapprochements] = await Promise.all([
      this.prisma.rapprochementBancaire.count({ where: { tenantId, ...filtre } }),
      this.prisma.rapprochementBancaire.findMany({
        where: { tenantId, ...filtre },
        include: { compte: { select: { id: true, numero: true, intitule: true } } },
        orderBy: [{ compte: { numero: 'asc' } }, { dateReleve: 'asc' }, { id: 'asc' }],
        take: LIMITE_EXTRAITS,
      }),
    ]);
    const ids = rapprochements.map((r) => r.id);
    const [sommes, rapprochees] = await Promise.all([
      this.prisma.ligneReleveBancaire.groupBy({
        by: ['rapprochementId'],
        where: { tenantId, rapprochementId: { in: ids } },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      }),
      this.prisma.ligneReleveBancaire.groupBy({
        by: ['rapprochementId'],
        where: {
          tenantId,
          rapprochementId: { in: ids },
          OR: [{ lignesEcriture: { some: { ecriture: { tenantId } } } }, { encoursOuverture: { some: { tenantId } } }],
        },
        _count: { _all: true },
      }),
    ]);
    const sommeDe = new Map(sommes.map((s) => [s.rapprochementId, s]));
    const rapprocheesDe = new Map(rapprochees.map((s) => [s.rapprochementId, s._count._all]));
    const extraits: TeteExtrait[] = [];
    for (const r of rapprochements) {
      const s = sommeDe.get(r.id);
      const debit = Number(s?._sum.debit ?? 0);
      const credit = Number(s?._sum.credit ?? 0);
      const { soldeDepart } = await this.rapprochements.depart(tenantId, r);
      const mouvementsNet = arrondi(credit - debit);
      extraits.push({
        rapprochementId: r.id,
        compteId: r.compte.id,
        compteNumero: r.compte.numero,
        compteNom: r.compte.intitule,
        dateReleve: r.dateReleve,
        soldeReleve: Number(r.soldeReleve),
        soldeDepart,
        mouvementsNet,
        ecartReleve: soldeDepart === null ? null : arrondi(soldeDepart + mouvementsNet - Number(r.soldeReleve)),
        nombreLignes: s?._count._all ?? 0,
        nombreRapprochees: rapprocheesDe.get(r.id) ?? 0,
        statut: r.statut === StatutRapprochement.CLOTURE ? 'CLOTURE' : 'EN_COURS',
        releveImporteLe: r.releveImporteLe,
        releveNomFichier: r.releveNomFichier,
      });
    }
    return { extraits, total, tronque: total > rapprochements.length };
  }

  /**
   * L'ÉDITION CHAÎNÉE · un classeur, une feuille de sommaire puis une feuille
   * par extrait retenu, compte par compte et du plus ancien au plus récent.
   * Tout se juge AVANT le premier octet · comptes du dossier, sélection non
   * vide, volume sous le plafond des exports (sinon un classeur tronqué
   * passerait pour complet). Un compte choisi sans extrait dans les bornes est
   * dit au sommaire, jamais tu.
   */
  async editionChainee(
    tenantId: string,
    selection: SelectionExtraits,
    ouvrir: (nomFichier: string) => Writable,
  ): Promise<{ feuilles: number; lignes: number; comptesSansExtrait: string[] }> {
    const comptesChoisis =
      selection.compteIds.length === 0
        ? []
        : await this.prisma.compte.findMany({ where: { tenantId, id: { in: selection.compteIds } }, select: { id: true, numero: true, intitule: true } });
    if (comptesChoisis.length !== selection.compteIds.length) {
      throw new NotFoundException('Un des comptes choisis est introuvable pour ce dossier · relisez la liste des comptes.');
    }
    const liste = await this.lister(tenantId);
    if (liste.tronque) {
      throw new BadRequestException(
        `Ce dossier porte ${liste.total} extraits, au-delà des ${LIMITE_EXTRAITS} qu'une édition chaînée réunit · restreignez-la par compte ou par dates.`,
      );
    }
    const parCompte = selection.compteIds.length === 0 ? liste.extraits : liste.extraits.filter((e) => selection.compteIds.includes(e.compteId));
    const retenus = ordonnerExtraits(parCompte, selection);
    if (retenus.length === 0) throw new BadRequestException('Aucun extrait dans la sélection · aucun relevé importé sur ces comptes et ces dates.');
    const lignesTotales = retenus.reduce((s, e) => s + e.nombreLignes, 0);
    if (lignesTotales > MAX_LIGNES_EXPORT) {
      throw new BadRequestException(
        `${lignesTotales.toLocaleString('fr-FR')} lignes de relevé, au-delà du plafond de ${MAX_LIGNES_EXPORT.toLocaleString('fr-FR')} · restreignez l'édition par compte ou par dates.`,
      );
    }
    const comptesSansExtrait = comptesChoisis.filter((c) => !retenus.some((e) => e.compteId === c.id)).map((c) => `${c.numero} ${c.intitule}`);

    const jour = (d: Date) => d.toISOString().slice(0, 10);
    const identite = await this.exportService.identiteEtat(tenantId, {
      ...(selection.du ? { dateDebut: jour(selection.du) } : {}),
      ...(selection.au ? { dateFin: jour(selection.au) } : {}),
    });
    const debut = selection.du ?? retenus[0].dateReleve;
    const fin = selection.au ?? retenus[retenus.length - 1].dateReleve;

    const sortie = ouvrir(`extraits-bancaires-${jour(debut)}-${jour(fin)}.xlsx`);
    const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, ...OPTIONS_CLASSEUR_EN_FLUX });
    classeur.creator = 'OmegaX';
    classeur.created = new Date();

    // Les noms de feuille se posent AVANT le sommaire, qui les cite.
    const pris = new Set<string>([FEUILLE_SOMMAIRE]);
    const feuilleDe = new Map(retenus.map((e) => [e.rapprochementId, nomDeFeuilleExtrait(e.compteNumero, e.dateReleve, pris)]));

    const sommaire = poserFeuilleFpm(classeur, sortie, {
      nomFeuille: FEUILLE_SOMMAIRE,
      titre: 'Extraits bancaires',
      sousTitre: `Édition chaînée · ${retenus.length} extrait${retenus.length > 1 ? 's' : ''}`,
      identite,
      debut,
      fin,
      colonnes: COLONNES_SOMMAIRE,
      entetes: ENTETES_SOMMAIRE,
      lignesEntete: 1,
      mention: MENTION_EXTRAIT,
    });
    for (const e of retenus) {
      await sommaire.ajouter({
        compte: e.compteNumero,
        intitule: e.compteNom,
        date: e.dateReleve,
        lignes: e.nombreLignes,
        solde: e.soldeReleve,
        feuille: feuilleDe.get(e.rapprochementId),
      });
    }
    for (const c of comptesSansExtrait) {
      await sommaire.ajouter({ compte: c.split(' ')[0], intitule: c.slice(c.indexOf(' ') + 1), feuille: 'Aucun extrait dans la sélection' });
    }
    sommaire.fermer();

    let lignesEcrites = 0;
    for (const e of retenus) {
      const lues = await this.prisma.ligneReleveBancaire.findMany({
        where: { tenantId, rapprochementId: e.rapprochementId },
        orderBy: { rang: 'asc' },
        include: { _count: { select: { lignesEcriture: true, encoursOuverture: true } } },
      });
      const lignes: LigneExtrait[] = lues.map((l) => ({
        rang: l.rang,
        date: l.date,
        libelle: l.libelle,
        reference: l.reference,
        debit: Number(l.debit),
        credit: Number(l.credit),
        rapprochee: l._count.lignesEcriture > 0 || l._count.encoursOuverture > 0,
      }));
      const bornes = bornesDeLExtrait(e, lignes);
      const importe = e.releveImporteLe
        ? `fichier « ${e.releveNomFichier ?? 'sans nom'} » importé le ${horodatage(e.releveImporteLe)}`
        : 'import non daté (relevé importé avant la fonction)';
      const feuille = poserFeuilleFpm(classeur, sortie, {
        nomFeuille: feuilleDe.get(e.rapprochementId)!,
        titre: `Extrait ${e.compteNumero}`,
        sousTitre: `${e.compteNom} · relevé au ${e.dateReleve.toLocaleDateString('fr-FR')} · rapprochement ${e.statut === 'CLOTURE' ? 'clos' : 'en cours'}`,
        identite,
        debut: bornes.debut,
        fin: bornes.fin,
        colonnes: COLONNES_EXTRAIT_FPM,
        entetes: ENTETES_EXTRAIT_FPM,
        lignesEntete: 1,
        mention: `${MENTION_EXTRAIT} · ${importe}`,
      });
      await feuille.ajouter({ libelle: 'Solde de départ', solde: e.soldeDepart, rapprochee: e.soldeDepart === null ? 'inconnu' : null }, { gras: true });
      const soldes = soldesProgressifs(e.soldeDepart, lignes);
      for (const [i, l] of lignes.entries()) {
        await feuille.ajouter({
          rang: l.rang,
          date: l.date,
          libelle: l.libelle,
          reference: l.reference,
          debit: l.debit === 0 ? null : l.debit,
          credit: l.credit === 0 ? null : l.credit,
          solde: soldes[i],
          rapprochee: l.rapprochee ? 'Oui' : null,
        });
      }
      const totaux = totauxExtrait(lignes);
      await feuille.ajouter({ libelle: 'Total des mouvements', debit: totaux.debit, credit: totaux.credit }, { gras: true, filetHaut: true });
      await feuille.ajouter({ libelle: 'Solde du relevé (imprimé par la banque)', solde: e.soldeReleve }, { gras: true });
      if (e.ecartReleve !== null && Math.abs(e.ecartReleve) >= 0.005) {
        await feuille.ajouter({ libelle: 'Écart entre le solde reconstitué et le solde imprimé', solde: e.ecartReleve }, { gras: true });
      }
      await feuille.ajouter({ libelle: `${e.nombreRapprochees} ligne(s) rapprochée(s) sur ${lignes.length}` });
      feuille.fermer();
      lignesEcrites += lignes.length;
    }
    await classeur.commit();
    return { feuilles: retenus.length + 1, lignes: lignesEcrites, comptesSansExtrait };
  }
}

/** Le format de date du cartouche, repris pour les cellules de date des lignes. */
export const FORMAT_DATE_EXTRAIT = FORMAT_DATE_FPM;
