import { Referentiel } from '@prisma/client';
import { ExerciceService } from './exercice.service';
import {
  LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS,
  LECTEUR_BILAN_SYCEBNL_PROJETS,
  LECTEUR_BILAN_SYSCOHADA_NORMAL,
  LECTEUR_BILAN_SYSCOHADA_SMT,
} from '../../common/lecteurs-bilan';

/**
 * UN BILAN DÉSÉQUILIBRÉ NE SE CLÔTURE PAS (simulation sur vraie base du
 * 2026-10-08) · le bilan 2027 sortait à 165 828 000 contre 211 900 000 et la
 * clôture l'acceptait. Seule la part du 13 que l'état ne lit pas, et que la
 * clôture vire au report à nouveau, est un écart admis.
 */
type Refuser = (t: string, e: string, d: object) => Promise<void>;

function monter(bilan: { totalActif: number; totalPassif: number; controle?: { resultatClasses678: number; resultatCompte13: number } }, treize = { debit: 0, credit: 0 }) {
  const lecteur = { bilan: jest.fn().mockResolvedValue(bilan) };
  const moduleRef = { get: jest.fn().mockReturnValue(lecteur) };
  const prisma = { ligneEcriture: { aggregate: jest.fn().mockResolvedValue({ _sum: treize }) } };
  const service = new ExerciceService(prisma as never, {} as never, moduleRef as never);
  const refuser = (service as unknown as { refuserBilanDesequilibre: Refuser }).refuserBilanDesequilibre.bind(service);
  return { refuser, moduleRef, prisma };
}
const SARL = { referentiel: Referentiel.SYSCOHADA, systemeComptableSyscohada: 'NORMAL', jeuEtatsFinanciersSycebnl: null };

describe('Clôture · le bilan doit s’équilibrer', () => {
  it('refuse un écart que le report à nouveau n’explique pas, montants nommés', async () => {
    const { refuser } = monter({ totalActif: 1_000_100, totalPassif: 1_000_000, controle: { resultatClasses678: 50, resultatCompte13: 0 } });
    await expect(refuser('t', 'e', SARL)).rejects.toThrow(/écart de 100,00/);
  });

  it('le bilan 2027 de la simulation, perte non affectée lue au poste du résultat · la clôture passe (passe V1, B1)', async () => {
    const { refuser } = monter(
      { totalActif: 165_828_000, totalPassif: 165_828_000, controle: { resultatClasses678: -11_600_000, resultatCompte13: -46_072_000 } },
      { debit: 46_072_000, credit: 0 },
    );
    await expect(refuser('t', 'e', SARL)).resolves.toBeUndefined();
  });

  it('un 130 non lu par l\'état reste la seule part admise · elle part au report à nouveau', async () => {
    const { refuser } = monter(
      { totalActif: 1_300, totalPassif: 1_000, controle: { resultatClasses678: 50, resultatCompte13: 200 } },
      { debit: 0, credit: 500 },
    );
    await expect(refuser('t', 'e', SARL)).resolves.toBeUndefined();
  });

  it('le résultat au 13 se lit sur le livre-journal, hors écriture qui solde les comptes de gestion', async () => {
    const { refuser, prisma } = monter({ totalActif: 1, totalPassif: 1, controle: { resultatClasses678: 0, resultatCompte13: 0 } });
    await refuser('t', 'e', SARL);
    expect(prisma.ligneEcriture.aggregate.mock.calls[0][0].where).toEqual({
      compte: { tenantId: 't', numero: { startsWith: '13' } },
      ecriture: { tenantId: 't', exerciceId: 'e', statut: 'VALIDEE', estSoldeDesComptesDeGestion: false },
    });
  });

  it.each([
    [{ referentiel: Referentiel.SYSCOHADA, systemeComptableSyscohada: 'NORMAL', jeuEtatsFinanciersSycebnl: null }, LECTEUR_BILAN_SYSCOHADA_NORMAL],
    [{ referentiel: Referentiel.SYSCOHADA, systemeComptableSyscohada: 'MINIMAL_TRESORERIE', jeuEtatsFinanciersSycebnl: null }, LECTEUR_BILAN_SYSCOHADA_SMT],
    [{ referentiel: Referentiel.SYCEBNL, systemeComptableSyscohada: null, jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' }, LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS],
    [{ referentiel: Referentiel.SYCEBNL, systemeComptableSyscohada: null, jeuEtatsFinanciersSycebnl: 'PROJETS_DEVELOPPEMENT' }, LECTEUR_BILAN_SYCEBNL_PROJETS],
  ])('lit le bilan du jeu du dossier', async (dossier, jeton) => {
    const { refuser, moduleRef } = monter({ totalActif: 1, totalPassif: 1, controle: { resultatClasses678: 0, resultatCompte13: 0 } });
    await refuser('t', 'e', dossier);
    expect(moduleRef.get).toHaveBeenCalledWith(jeton, { strict: false });
  });
});
