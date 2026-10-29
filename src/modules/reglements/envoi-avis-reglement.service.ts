import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutMessage } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { CourrierService, ORIGINE_AVIS_REGLEMENT } from '../courrier/courrier.service';
import { OrdresVirementService } from './ordres-virement.service';

/**
 * L'AVIS DE RÈGLEMENT ENVOYÉ AU TIERS PAR LA MESSAGERIE (ligne gl-saisie,
 * fonction 35 · Sage i7, « transmettre les règlements par la messagerie »).
 * L'avis existait à l'impression (`avis-reglement.ts`) ; il part désormais au
 * courriel du tiers, par la FILE du dossier (`CourrierService`), jamais par
 * un second chemin d'envoi.
 *
 * LE TEXTE EST CELUI DE L'AVIS IMPRIMÉ, mot pour mot · composé par la même
 * lecture (`OrdresVirementService.avisReglement`), habillé du modèle du tiers,
 * signé du dossier, l'imputation déclarée en payant comprise (Code civil,
 * Livre III, art. 151). Les mêmes refus · un ordre annulé ou pas encore
 * imprimé n'a pas d'avis (`motifRefusAvis`).
 *
 * RIEN N'EST TENTÉ DANS LA REQUÊTE (comme les relances, audit final F241) · les
 * messages s'écrivent en file sans envoi (`ecrireEnFileSansTenter`), l'écran
 * les fait partir par la reprise bornée (`POST /courrier/reprendre`).
 *
 * UN AVIS NE PART QU'UNE FOIS · un avis déjà en file, en échec qui sera
 * retenté, ou envoyé, pour la même ligne de l'ordre, n'est pas réécrit
 * (`dejaEnvoyes`) ; un avis ABANDONNÉ n'est pas parti, il se renvoie. Le
 * contrôle et l'écriture se font sous un verrou par dossier, dans une seule
 * transaction · deux clics simultanés liraient sinon chacun « rien en file ».
 * Un tiers sans adresse est nommé (`sansAdresse`), jamais sauté en silence.
 */
const STATUTS_EN_FILE_OU_PARTIS: StatutMessage[] = [
  StatutMessage.EN_ATTENTE,
  StatutMessage.SANS_TRANSPORT,
  StatutMessage.ECHEC,
  StatutMessage.ENVOYE,
];

export interface BilanEnvoiAvis {
  misesEnFile: { ligneId: string; beneficiaire: string; destinataire: string; messageId: string; statut: StatutMessage }[];
  dejaEnvoyes: { ligneId: string; beneficiaire: string }[];
  sansAdresse: { ligneId: string; beneficiaire: string }[];
  refuses: { ligneId: string; beneficiaire: string; motif: string }[];
}

@Injectable()
export class EnvoiAvisReglementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordres: OrdresVirementService,
    private readonly courrier: CourrierService,
  ) {}

  async envoyer(tenantId: string, auteur: string, ordreId: string, personnelOuvert = true): Promise<BilanEnvoiAvis> {
    const lu = await this.ordres.avisReglement(tenantId, ordreId, personnelOuvert);
    if (lu.avis.length === 0) throw new BadRequestException('Cet ordre ne paie aucun tiers · aucun avis de règlement à envoyer.');
    const [tiers, tenant] = await Promise.all([
      this.prisma.tiers.findMany({
        where: { tenantId, id: { in: [...new Set(lu.avis.map((a) => a.tiersId))] } },
        select: { id: true, email: true, nom: true },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { nom: true } }),
    ]);
    const parTiers = new Map(tiers.map((t) => [t.id, t]));
    const sujet = `Avis de règlement · ordre n° ${lu.ordre.numero}${tenant?.nom ? ` · ${tenant.nom}` : ''}`;
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avis-reglement:${tenantId}`}))`;
      const deja = await tx.message.findMany({
        where: {
          tenantId,
          origine: ORIGINE_AVIS_REGLEMENT,
          origineId: { in: lu.avis.map((a) => a.ligneId) },
          statut: { in: STATUTS_EN_FILE_OU_PARTIS },
        },
        select: { origineId: true },
      });
      const dejaIds = new Set(deja.map((m) => m.origineId));
      const bilan: BilanEnvoiAvis = { misesEnFile: [], dejaEnvoyes: [], sansAdresse: [], refuses: [] };
      const aEcrire: { ligneId: string; beneficiaire: string; destinataire: string; nom: string; texte: string }[] = [];
      for (const a of lu.avis) {
        if (dejaIds.has(a.ligneId)) {
          bilan.dejaEnvoyes.push({ ligneId: a.ligneId, beneficiaire: a.beneficiaire });
          continue;
        }
        const t = parTiers.get(a.tiersId);
        const adresse = t?.email?.trim();
        if (!adresse) {
          bilan.sansAdresse.push({ ligneId: a.ligneId, beneficiaire: a.beneficiaire });
          continue;
        }
        aEcrire.push({ ligneId: a.ligneId, beneficiaire: a.beneficiaire, destinataire: adresse, nom: t?.nom ?? a.beneficiaire, texte: a.texte });
      }
      if (aEcrire.length) {
        const resultats = await this.courrier.ecrireEnFileSansTenter(
          tx,
          tenantId,
          aEcrire.map((m) => ({
            destinataire: m.destinataire,
            destinataireNom: m.nom,
            sujet,
            corps: m.texte,
            origine: ORIGINE_AVIS_REGLEMENT,
            origineId: m.ligneId,
            createdBy: auteur,
          })),
        );
        resultats.forEach((r, i) => {
          const m = aEcrire[i];
          if (r.motif === null) bilan.misesEnFile.push({ ligneId: m.ligneId, beneficiaire: m.beneficiaire, destinataire: m.destinataire, messageId: r.id, statut: r.statut });
          else bilan.refuses.push({ ligneId: m.ligneId, beneficiaire: m.beneficiaire, motif: r.motif });
        });
      }
      return bilan;
    });
  }
}
