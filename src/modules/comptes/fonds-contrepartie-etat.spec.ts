import { BadRequestException } from '@nestjs/common';
import { JeuEtatsFinanciersSycebnl, Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { CompteService } from './compte.service';
import { motifRefusFondsContrepartieEtat } from './fonds-contrepartie-etat';
import { PrismaService } from '../../common/prisma.service';

/**
 * Q2 ET N7 DES CAS CHIFFRÉS DE LA CLÔTURE (2026-10-07) · le compte de
 * trésorerie qui porte la contrepartie de l'État au tableau emplois-ressources
 * se DÉCLARE (convention d'OmegaX, aucun texte ne le désigne). Trois refus,
 * et le geste juste passe.
 */
const PROJET = { referentiel: Referentiel.SYCEBNL, jeu: JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT };

describe('Contrepartie de l’État · le compte se déclare', () => {
  it('admis sur un compte de trésorerie de détail d’un dossier projets, non rattaché à un bailleur', () => {
    for (const numero of ['51210000', '52110000', '53110000', '55100000', '57100000']) {
      expect({ numero, motif: motifRefusFondsContrepartieEtat({ ...PROJET, numero, typeCompte: TypeCompteDetailTotal.DETAIL, bailleurId: null }) }).toEqual({
        numero,
        motif: null,
      });
    }
  });

  it('refusé hors du jeu projets, hors trésorerie, sur un Total, sur un compte de bailleur', () => {
    const detail = { numero: '57100000', typeCompte: TypeCompteDetailTotal.DETAIL, bailleurId: null };
    expect(motifRefusFondsContrepartieEtat({ referentiel: Referentiel.SYSCOHADA, jeu: null, ...detail })).toMatch(/projets de développement/);
    expect(
      motifRefusFondsContrepartieEtat({ referentiel: Referentiel.SYCEBNL, jeu: JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, ...detail }),
    ).toMatch(/projets de développement/);
    expect(motifRefusFondsContrepartieEtat({ ...PROJET, ...detail, numero: '46300000' })).toMatch(/51, 52, 53, 55, 57/);
    expect(motifRefusFondsContrepartieEtat({ ...PROJET, ...detail, numero: '57', typeCompte: TypeCompteDetailTotal.TOTAL })).toMatch(/Total/);
    expect(motifRefusFondsContrepartieEtat({ ...PROJET, ...detail, bailleurId: 'b1' })).toMatch(/bailleur/);
  });

  it('la route refuse la déclaration sur un compte rattaché à un bailleur, et passe le geste juste', async () => {
    const compte = {
      id: 'c1',
      tenantId: 't1',
      numero: '57100000',
      typeCompte: TypeCompteDetailTotal.DETAIL,
      bailleurId: 'b1',
      porteFondsContrepartieEtat: false,
    };
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      compte: { findFirst: jest.fn().mockResolvedValue(compte), update },
      tenant: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ referentiel: Referentiel.SYCEBNL, jeuEtatsFinanciersSycebnl: JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT }),
      },
      bailleur: { findFirst: jest.fn() },
    } as unknown as PrismaService;
    const s = new CompteService(prisma);
    await expect(s.modifier('t1', 'c1', { porteFondsContrepartieEtat: true } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    // Détaché du bailleur dans le même geste · admis.
    await s.modifier('t1', 'c1', { porteFondsContrepartieEtat: true, bailleurId: null } as never);
    expect(update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { porteFondsContrepartieEtat: true, bailleurId: null } });
  });
});
