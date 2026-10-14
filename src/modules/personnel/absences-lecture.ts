import type { NatureAbsenceSalarie, Prisma } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import { absencesPourLeCompteur, type AbsenceLue, type JourIso } from './absences';
import { serviceEnCours } from './service-du-salarie';

/**
 * LIGNE SAGE-L5, FONCTION 78 · LE LECTEUR DES ABSENCES, un seul pour le
 * compteur des congés et pour l'émission du bulletin qui porte une allocation
 * de congé (fonction 79) · les jours qui ne sont pas un service au sens de
 * l'art. 141, al. 2, et les jours de maladie que l'al. 4 retranche d'un congé.
 */

type Db = PrismaService | Prisma.TransactionClient;

export type AbsencesPourLesConges = {
  joursHorsService: { du: JourIso; au: JourIso; motif: string }[];
  joursMaladie: Set<JourIso>;
};

export type LecteurAbsences = (db: Db, tenantId: string, salarieId: string) => Promise<AbsencesPourLesConges>;

/** Aucun jour retranché · pour les tests qui ne lisent pas les absences. */
export const AUCUNE_ABSENCE: LecteurAbsences = async () => ({ joursHorsService: [], joursMaladie: new Set() });

/** Les absences d'un salarié · bien au-delà de ce qu'une carrière en compte. */
export const PLAFOND_ABSENCES_SALARIE = 2_000;

const iso = (d: Date): JourIso => d.toISOString().slice(0, 10);

/** Les absences NON ANNULÉES d'un salarié, lues pour le moteur. */
export async function absencesDuSalarie(db: Db, tenantId: string, salarieId: string): Promise<AbsenceLue[]> {
  const lignes = await db.absenceSalarie.findMany({
    where: { tenantId, salarieId, annuleLe: null },
    orderBy: { du: 'asc' },
    take: PLAFOND_ABSENCES_SALARIE,
    select: { id: true, nature: true, du: true, au: true, demiJourneeDebut: true, demiJourneeFin: true },
  });
  return lignes.map((a: { id: string; nature: NatureAbsenceSalarie; du: Date; au: Date; demiJourneeDebut: boolean; demiJourneeFin: boolean }) => ({
    id: a.id,
    nature: a.nature,
    du: iso(a.du),
    au: iso(a.au),
    demiJourneeDebut: a.demiJourneeDebut,
    demiJourneeFin: a.demiJourneeFin,
  }));
}

/** LE lecteur des absences pour les congés. */
export const lireAbsencesPourConges: LecteurAbsences = async (db, tenantId, salarieId) => {
  const [absences, contrats] = await Promise.all([
    absencesDuSalarie(db, tenantId, salarieId),
    db.contratTravail.findMany({
      where: { tenantId, salarieId },
      select: { id: true, dateEntreeEnVigueur: true, dateFin: true, renouvelleDeId: true },
      take: 500,
    }),
  ]);
  const service = serviceEnCours(contrats);
  return absencesPourLeCompteur(absences, service ? iso(service.origine) : null);
};
