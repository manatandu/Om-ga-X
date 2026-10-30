import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { jourDeKinshasa } from '../../common/echeance';
import { LOT_LECTURE, PremiersSelon, lireParLots, pageApres } from '../../common/lecture-par-lots';
import { HORS_SITUATION } from './ecritures-de-situation';
import { groupesLusAPlusieurs, poidsDesLignesLues, poidsOuMontant } from '../lettrage/reste-des-lignes-ouvertes';
import { estEcheanceAReglerSur } from '../reglements/reglement-tiers';

/**
 * LES ÉCHÉANCES PROCHES DES TIERS, AU TABLEAU DE BORD (ligne gl-saisie,
 * fonction 34 · Sage i7, « alertes sur les échéances »). Le tableau de bord
 * ne voyait que l'échéancier fiscal ; ce qu'un client doit payer cette
 * semaine, ce que le dossier doit à un fournisseur dans dix jours, ne se
 * lisait qu'en allant à l'échéancier de trésorerie.
 *
 * CE QUI EST LU · les factures OUVERTES des comptes de fournisseurs (40,
 * crédit) et de clients (41, débit), au sens normal seulement · la règle du
 * Règlement des tiers (`estEcheanceAReglerSur` · ni 408, 409, 418, 419, ni
 * 416), une facture réglée en partie pour son RESTE (`poidsDesLignesLues`,
 * la même lecture que l'échéancier). Simulations hors de tout.
 *
 * DEUX ALERTES, AUCUNE AFFIRMATION. À ÉCHOIR dans l'horizon (trente jours,
 * convention d'OmegaX, comme le panneau fiscal) et DÉJÀ ÉCHU, chacune
 * comptée et chiffrée sur tout le périmètre ; la liste ne garde que les plus
 * proches, et le dit. Une ligne SANS échéance n'alerte pas · elle est
 * comptée à part (`sansEcheance`), jamais rangée à la date de sa pièce. Rien
 * n'est « à jour » · une liste vide veut dire rien dans l'horizon.
 *
 * Le jour de référence est celui de Kinshasa, pris par le serveur.
 */
export const HORIZON_ECHEANCES_TIERS = 30;
export const PLAFOND_ECHEANCES_TIERS = 20;
const JOUR = 86_400_000;

export interface EcheanceTiers {
  ligneId: string;
  date: string;
  joursRestants: number;
  sens: 'A_ENCAISSER' | 'A_PAYER';
  compteNumero: string;
  tiers: string | null;
  libelle: string;
  montant: number;
}

interface Cumul {
  nombre: number;
  aEncaisser: number;
  aPayer: number;
}

@Injectable()
export class EcheancesTiersService {
  constructor(private readonly prisma: PrismaService) {}

  async echeancesProches(tenantId: string, exerciceId: string, maintenant: Date = new Date()) {
    const reference = jourDeKinshasa(maintenant);
    const borne = new Date(reference.getTime() + HORIZON_ECHEANCES_TIERS * JOUR);
    const ouvertes: Prisma.LigneEcritureWhereInput = {
      ecriture: { tenantId, exerciceId, ...HORS_SITUATION },
      lettre: null,
      OR: [{ compte: { numero: { startsWith: '40' } } }, { compte: { numero: { startsWith: '41' } } }],
    };
    const proches = new PremiersSelon<EcheanceTiers>(PLAFOND_ECHEANCES_TIERS, (a, b) => a.date.localeCompare(b.date));
    const aEchoir: Cumul = { nombre: 0, aEncaisser: 0, aPayer: 0 };
    const echu: Cumul = { nombre: 0, aEncaisser: 0, aPayer: 0 };
    let sansEcheance = 0;

    type Lue = Prisma.LigneEcritureGetPayload<{
      include: {
        compte: { select: { numero: true; tiersCompte: { select: { tiers: { select: { nom: true } } } } } };
        ecriture: { select: { date: true; libelle: true } };
      };
    }>;
    const ranger = (l: Lue, net: number) => {
      const numero = l.compte.numero;
      const sens = estEcheanceAReglerSur(numero, 'CLIENT') ? 'A_ENCAISSER' : estEcheanceAReglerSur(numero, 'FOURNISSEUR') ? 'A_PAYER' : null;
      if (!sens) return;
      // LE SENS NORMAL SEUL · un avoir ou un règlement non lettré n'échoit pas.
      const montant = sens === 'A_ENCAISSER' ? net : -net;
      if (montant < 0.005) return;
      if (!l.dateEcheance) {
        sansEcheance++;
        return;
      }
      const jours = Math.round((Date.UTC(l.dateEcheance.getUTCFullYear(), l.dateEcheance.getUTCMonth(), l.dateEcheance.getUTCDate()) - reference.getTime()) / JOUR);
      const cumul = jours < 0 ? echu : l.dateEcheance.getTime() <= borne.getTime() ? aEchoir : null;
      if (!cumul) return;
      cumul.nombre++;
      if (sens === 'A_ENCAISSER') cumul.aEncaisser += montant;
      else cumul.aPayer += montant;
      if (cumul === aEchoir) {
        proches.ajouter({
          ligneId: l.id,
          date: l.dateEcheance.toISOString().slice(0, 10),
          joursRestants: jours,
          sens,
          compteNumero: numero,
          tiers: l.compte.tiersCompte?.tiers.nom ?? null,
          libelle: l.libelle ?? l.ecriture.libelle,
          montant: Math.round(montant * 100) / 100,
        });
      }
    };

    const aPlusieurs = await groupesLusAPlusieurs(this.prisma, ouvertes);
    const enGroupe: Lue[] = [];
    await lireParLots(
      (curseur) =>
        this.prisma.ligneEcriture.findMany({
          where: ouvertes,
          include: {
            compte: { select: { numero: true, tiersCompte: { select: { tiers: { select: { nom: true } } } } } },
            ecriture: { select: { date: true, libelle: true } },
          },
          ...pageApres(curseur, LOT_LECTURE),
        }),
      (l) => {
        if (l.lettrageId && aPlusieurs.has(l.lettrageId)) enGroupe.push(l);
        else ranger(l, Number(l.debit) - Number(l.credit));
      },
    );
    // UNE FACTURE RÉGLÉE EN PARTIE N'ALERTE QUE POUR SON RESTE · la même
    // lecture que l'échéancier de trésorerie.
    const poids = await poidsDesLignesLues(this.prisma, tenantId, enGroupe, {}, 'Échéances des tiers');
    for (const l of enGroupe) ranger(l, poidsOuMontant(poids, l));

    const arrondir = (c: Cumul) => ({ nombre: c.nombre, aEncaisser: Math.round(c.aEncaisser * 100) / 100, aPayer: Math.round(c.aPayer * 100) / 100 });
    return {
      dateReference: reference.toISOString().slice(0, 10),
      horizonJours: HORIZON_ECHEANCES_TIERS,
      aEchoir: arrondir(aEchoir),
      echu: arrondir(echu),
      sansEcheance,
      proches: proches.elements(),
      /** Vrai quand la liste ne montre que les plus proches · les cumuls restent entiers. */
      tronque: proches.tronquee,
    };
  }
}
