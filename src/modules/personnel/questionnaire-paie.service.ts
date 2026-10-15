import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { contratCouvrantLeMois, moisValide } from './bulletin-paie';

/**
 * LIGNE SAGE-L5, FONCTION 85 · LE QUESTIONNAIRE SOCIÉTÉ ET SALARIÉ. Il ne
 * crée ni champ, ni règle, ni valeur par défaut · il LIT ce que le dossier et
 * le registre disent déjà des questions de la paie, et l'écran écrit les
 * réponses par les routes qui existent (paramètres du dossier, mode de
 * paiement, monnaie du contrat) ou dans les champs de la simulation du mois.
 * Ce qui n'est pas dit reste « pas encore dit », jamais complété ici.
 *
 * Lu par le gestionnaire de paie comme par le comptable · il ne voit pas les
 * paramètres du dossier (roles-cantonnes.ts), et la question de l'effectif
 * doit pourtant lui dire ce que le dossier porte.
 */
@Injectable()
export class QuestionnairePaieService {
  constructor(private readonly prisma: PrismaService) {}

  async lire(tenantId: string, salarieId: string | undefined, mois: string | undefined) {
    if (mois !== undefined && !moisValide(mois)) throw new BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
    const dossier = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { effectifPermanent: true, numeroAffiliationCnssEmployeur: true },
    });
    if (!salarieId) return { dossier, salarie: null };
    const s = await this.prisma.salarie.findFirst({
      where: { id: salarieId, tenantId },
      select: {
        id: true,
        nom: true,
        prenoms: true,
        numeroAffiliationCnss: true,
        modePaiement: true,
        // Un salarié porte une poignée de contrats · la borne est formelle.
        contrats: {
          take: 200,
          orderBy: { dateEntreeEnVigueur: 'desc' },
          select: {
            id: true,
            type: true,
            dateEntreeEnVigueur: true,
            dateFin: true,
            classeProfessionnelle: true,
            periodiciteRemuneration: true,
            deviseRemuneration: true,
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    // Le contrat qui couvre le mois de la simulation · sans mois, le contrat
    // en cours (sans fin). Aucun repli sur un autre · « pas de contrat » se dit.
    const contrat = mois ? contratCouvrantLeMois(s.contrats, mois) : (s.contrats.find((c) => c.dateFin === null) ?? null);
    return {
      dossier,
      salarie: {
        id: s.id,
        nomComplet: [s.nom, s.prenoms].filter(Boolean).join(' '),
        numeroAffiliationCnss: s.numeroAffiliationCnss,
        modePaiement: s.modePaiement,
        contrat: contrat
          ? {
              id: contrat.id,
              type: contrat.type,
              classeProfessionnelle: contrat.classeProfessionnelle,
              periodiciteRemuneration: contrat.periodiciteRemuneration,
              deviseRemuneration: contrat.deviseRemuneration,
            }
          : null,
      },
    };
  }
}
