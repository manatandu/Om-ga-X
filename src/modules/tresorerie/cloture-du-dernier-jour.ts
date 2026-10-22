import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { refuserSiPeriodeClose } from '../exercice/exercice.service';
import type { PrismaService } from '../../common/prisma.service';

/**
 * UNE PIÈCE DE CLÔTURE DATÉE D'UNE PÉRIODE CLOSE (relecture du 2026-10-22,
 * second tour, M1) · la régularisation des intérêts et la revue d'un titre
 * se datent du DERNIER jour de l'exercice. Si une clôture de période, ou du
 * journal, couvre ce jour, la saisie la refusait avec l'aide du report de
 * l'art. 22, 4°, qui ne peut rien ici · le premier jour ouvert est au-delà de
 * l'exercice, et l'y reporter changerait l'exercice qui porte la charge ou le
 * produit. Le refus nomme donc la seule issue · clôturer l'exercice, la
 * charge ou le produit omis transitant par l'exercice en cours (AUDCIF
 * art. 34 ; SYCEBNL cadre conceptuel § 3.3.1.2.4), et le dire aux Notes
 * annexes. Lu AVANT toute écriture, et pour la pièce nulle aussi, qui ne
 * passe pas par la saisie · sans quoi elle se gardait sur une période close.
 */
export async function refuserSiDernierJourClos(prisma: PrismaService, tenantId: string, journalId: string, dernierJour: Date, objet: string) {
  const clotures = await prisma.cloture.findMany({ where: { tenantId, annuleeAt: null, OR: [{ journalId }, { journalId: null }] }, select: { granularite: true, journalId: true, dateLimite: true } });
  try {
    refuserSiPeriodeClose(clotures, journalId, dernierJour);
  } catch (e) {
    if (!(e instanceof ForbiddenException)) throw e;
    throw new BadRequestException(
      `Le ${dernierJour.toISOString().slice(0, 10)}, dernier jour de l'exercice, est dans une période close pour ce journal · ${objet} ne peut s'y dater, ` +
        "et ne se reporte pas au-delà de l'exercice. Clôturez l'exercice · ce qu'elle aurait rattaché passera par l'exercice en cours (AUDCIF art. 34), à dire aux Notes annexes.",
    );
  }
}
