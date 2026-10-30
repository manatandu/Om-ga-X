import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { optionComptesIndividuels, ouvrirCompteSalarie } from './comptes-salaries.service';
import { lireFichier } from '../import/lecture-fichier';
import { ContratTravailDto, SalarieDto } from './dto/personnel.dto';
import { champsDuContrat, champsDuSalarie } from './personnel.service';
import { motifMonnaieExigee } from './regles-contrat-travail';
import { FOND_ENTETE_FPM } from '../exports/presentation-fpm';
import {
  COLONNES_IMPORT,
  PLAFOND_LIGNES_IMPORT,
  apparierColonnes,
  doublonsDeMatricule,
  lireLigne,
  messageDeValidation,
  type LigneLue,
} from './import-personnel';

export type LigneSimulee = {
  rang: number;
  nom: string;
  matricule: string | null;
  avecContrat: boolean;
  refus: string[];
};

/**
 * LIGNE PAIE-SUITE, FONCTION 82 · l'import du personnel · lire, juger chaque
 * ligne par les règles de la saisie (`import-personnel.ts`), simuler, puis
 * écrire tout ou rien.
 */
@Injectable()
export class ImportPersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  /** Le jugement de tout le fichier, sans rien écrire. */
  async simuler(tenantId: string, nomFichier: string, contenuBase64: string) {
    const tableau = await lireFichier(nomFichier, contenuBase64);
    const { rangs, ignorees, doublons } = apparierColonnes(tableau.colonnes);
    const manquantes = COLONNES_IMPORT.filter((c) => c.obligatoire && !rangs.has(c.cle)).map((c) => c.entete);
    if (manquantes.length) {
      throw new BadRequestException(`Colonnes obligatoires absentes · ${manquantes.join(', ')}. Partez du modèle d'import (Télécharger le modèle).`);
    }
    if (doublons.length) throw new BadRequestException(`Colonnes en double · ${doublons.join(', ')}. Une colonne ne se donne qu'une fois.`);
    if (tableau.lignes.length > PLAFOND_LIGNES_IMPORT) {
      throw new BadRequestException(`Le fichier porte ${tableau.lignes.length} lignes · un import en prend ${PLAFOND_LIGNES_IMPORT} au plus. Scindez-le.`);
    }
    // La ligne 1 est l'en-tête · la première donnée est la ligne 2 du tableur.
    const lues = tableau.lignes.map((v, i) => lireLigne(i + 2, v, rangs));
    const doublonsFichier = doublonsDeMatricule(lues);
    const matricules = [...new Set(lues.map((l) => (typeof l.salarie.matricule === 'string' ? l.salarie.matricule.trim() : '')).filter((m) => m))];
    const pris = matricules.length
      ? await this.prisma.salarie.findMany({ where: { tenantId, matricule: { in: matricules } }, select: { matricule: true, nom: true }, take: matricules.length })
      : [];
    const parMatricule = new Map(pris.map((p) => [p.matricule, p.nom]));

    const jugees: (LigneSimulee & { lue: LigneLue })[] = [];
    for (const l of lues) {
      const refus = [...l.refus];
      const d = doublonsFichier.get(l.rang);
      if (d) refus.push(d);
      const m = typeof l.salarie.matricule === 'string' ? l.salarie.matricule.trim() : '';
      if (m && parMatricule.has(m)) refus.push(`Le matricule ${m} est déjà porté par ${parMatricule.get(m)} dans ce registre.`);
      // LES RÈGLES DE LA SAISIE · les mêmes DTO, la même liste blanche.
      refus.push(...(await erreursDuDto(SalarieDto, l.salarie)));
      if (l.contrat) {
        refus.push(...(await erreursDuDto(ContratTravailDto, l.contrat)));
        const monnaie = motifMonnaieExigee(l.contrat.remunerationBase as number | undefined, l.contrat.deviseRemuneration as 'CDF' | 'USD' | undefined);
        // Le DTO le dit déjà quand sa validation porte la règle · une seule fois.
        if (monnaie && !refus.some((r) => r.includes(monnaie))) refus.push(monnaie);
      }
      jugees.push({
        rang: l.rang,
        nom: [l.salarie.nom, l.salarie.postNom, l.salarie.prenoms].filter((x) => typeof x === 'string' && x).join(' '),
        matricule: m || null,
        avecContrat: l.contrat !== null,
        refus: [...new Set(refus)],
        lue: l,
      });
    }
    const refusees = jugees.filter((l) => l.refus.length > 0).length;
    return {
      lignes: jugees.map(({ lue: _lue, ...reste }) => reste),
      jugees,
      colonnesIgnorees: ignorees,
      total: jugees.length,
      refusees,
      aImporter: jugees.length - refusees,
    };
  }

  /**
   * IMPORTER · la simulation est REJOUÉE sur le fichier reçu, jamais crue
   * du client. Une seule ligne refusée et rien n'est écrit · le refus nomme
   * les lignes. Tout s'écrit dans une transaction, au journal d'audit.
   */
  async importer(tenantId: string, userId: string, nomFichier: string, contenuBase64: string) {
    const s = await this.simuler(tenantId, nomFichier, contenuBase64);
    if (s.total === 0) throw new BadRequestException("Le fichier ne porte aucune ligne de salarié.");
    if (s.refusees > 0) {
      throw new BadRequestException({
        message: `Import refusé · ${s.refusees} ligne(s) sur ${s.total} ne passent pas les règles de la saisie, et rien n'est écrit. Corrigez-les et relancez la simulation.`,
        motifs: s.lignes.filter((l) => l.refus.length).slice(0, 50).map((l) => `Ligne ${l.rang} · ${l.refus.join(' ')}`),
      });
    }
    const crees = await transactionJournalisee(this.prisma, async (tx) => {
      // Fonction 76 · sous l'option, chaque salarié importé naît avec son compte · l'option lue ici.
      const option = await optionComptesIndividuels(tx, tenantId);
      let salaries = 0;
      let contrats = 0;
      for (const l of s.jugees) {
        const dtoSalarie = plainToInstance(SalarieDto, l.lue.salarie);
        // LE MATRICULE PRIS ENTRE LA SIMULATION ET L'IMPORT · l'index unique
        // (`@@unique([tenantId, matricule])`) le refuse ; le refus nomme la
        // ligne, et la transaction défait tout (tout ou rien).
        const cree = await tx.salarie
          .create({ data: { tenantId, createdBy: userId, ...champsDuSalarie(dtoSalarie) }, select: { id: true } })
          .catch((e: unknown) => {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              throw new ConflictException(
                `Ligne ${l.rang} · le matricule ${l.lue.salarie.matricule ?? ''} a été pris entre la simulation et l'import · rien n'est importé, relancez la simulation.`,
              );
            }
            throw e;
          });
        salaries++;
        if (option) await ouvrirCompteSalarie(tx, tenantId, cree.id);
        if (l.lue.contrat) {
          const dtoContrat = plainToInstance(ContratTravailDto, l.lue.contrat);
          await tx.contratTravail.create({ data: { tenantId, salarieId: cree.id, createdBy: userId, ...champsDuContrat(dtoContrat), renouvelleDeId: null } });
          contrats++;
        }
      }
      return { salaries, contrats };
    });
    return { ...crees, ignorees: s.colonnesIgnorees };
  }

  /** Le modèle · la ligne d'en-tête, dans l'ordre, et la feuille « Aide » qui dit ce que chaque colonne attend. */
  async modele(): Promise<Buffer> {
    const classeur = new ExcelJS.Workbook();
    const f = classeur.addWorksheet('Personnel');
    COLONNES_IMPORT.forEach((c, i) => {
      const cell = f.getCell(1, i + 1);
      cell.value = c.entete;
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOND_ENTETE_FPM } };
      f.getColumn(i + 1).width = Math.max(14, c.entete.length + 2);
    });
    const aide = classeur.addWorksheet('Aide');
    const attendus: Record<string, string> = {
      texte: 'texte',
      date: 'date, AAAA-MM-JJ ou JJ/MM/AAAA',
      entier: 'nombre entier',
      montant: 'montant, 500 000 ou 500000,00 (le point ne sépare pas les milliers)',
      booleen: 'oui ou non',
      sexe: 'M ou F',
      typeContrat: 'CDD, CDI, jour le jour ou apprentissage',
      periodicite: 'jour, semaine, mois ou année',
      devise: 'CDF ou USD',
    };
    aide.addRow(['Colonne', 'Valeur attendue', 'Obligatoire']);
    for (const c of COLONNES_IMPORT) aide.addRow([c.entete, attendus[c.genre], c.obligatoire ? 'oui' : (c.cible === 'contrat' ? 'pour un contrat · type et date d’entrée en vigueur ensemble' : 'non')]);
    aide.getColumn(1).width = 32;
    aide.getColumn(2).width = 60;
    aide.getColumn(3).width = 50;
    return Buffer.from(await classeur.xlsx.writeBuffer());
  }
}

/** Les refus d'un DTO de la saisie, en français, colonne nommée. */
async function erreursDuDto(dto: new () => object, valeurs: Record<string, unknown>): Promise<string[]> {
  const instance = plainToInstance(dto, valeurs);
  const erreurs = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  return erreurs.map((e) => messageDeValidation(e.property, e.constraints));
}
