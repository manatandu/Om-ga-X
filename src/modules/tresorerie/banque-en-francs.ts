import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TypeJournal } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { estTresorerieEnDevises } from '../virements-fonds/virement-fonds';

/**
 * UN JOURNAL DE BANQUE EN FRANCS · le compte de la banque sous le 52, actif,
 * jamais tenu en devise (RIB, racine du plan « en devises », ligne en devise
 * déjà passée · même règle que le virement de fonds). Une opération en devise
 * se passe à la main, avec son montant en devise et son cours (F49) · sans
 * quoi la réévaluation de clôture (AUDCIF art. 54, 57) ignorerait la ligne en
 * francs. Partagé par les financements et placements et par les titres de
 * placement (fonction 47), qui passent tous deux par la banque qui les tient.
 */
export async function journalDeBanqueEnFrancs(prisma: PrismaService, tenantId: string, journalId: string, objet: string) {
  const j = await prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true, code: true, type: true, estActif: true, compteTresorerie: { select: { id: true, numero: true } } } });
  if (!j) throw new NotFoundException('Journal de banque introuvable pour ce dossier.');
  if (j.type !== TypeJournal.TRESORERIE || !j.compteTresorerie) throw new BadRequestException(`Le journal ${j.code} n'est pas un journal de trésorerie qui porte son compte.`);
  if (!j.compteTresorerie.numero.startsWith('52')) throw new BadRequestException(`Le journal ${j.code} ne porte pas un compte de banque (52) · ${objet} passe par la banque qui le tient.`);
  if (!j.estActif) throw new BadRequestException(`Le journal ${j.code} est en sommeil.`);
  const [dossier, rib, ligneEnDevise] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
    prisma.ribBanque.findFirst({ where: { tenantId, journalId: j.id }, select: { devise: true } }),
    prisma.ligneEcriture.findFirst({ where: { compteId: j.compteTresorerie.id, deviseId: { not: null }, ecriture: { tenantId, ...HORS_SITUATION } }, select: { id: true } }),
  ]);
  const deviseRib = (rib?.devise ?? '').toUpperCase();
  if ((deviseRib !== '' && deviseRib !== MONNAIE_DE_TENUE) || estTresorerieEnDevises(j.compteTresorerie.numero, dossier.referentiel) || ligneEnDevise) {
    throw new BadRequestException(`Le compte ${j.compteTresorerie.numero} du journal ${j.code} est tenu en devise · ce module passe les opérations en francs. Passez celle-ci à la main, avec le montant en devise et le cours de chaque ligne.`);
  }
  return { ...j, compteTresorerie: j.compteTresorerie };
}
