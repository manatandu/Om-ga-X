import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Referentiel } from '@prisma/client';
import { ExerciceService } from './exercice.service';
import {
  LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS,
  LECTEUR_BILAN_SYCEBNL_PROJETS,
  LECTEUR_BILAN_SYSCOHADA_NORMAL,
  LECTEUR_BILAN_SYSCOHADA_SMT,
  LECTEUR_VIREMENTS_GROUPE,
} from '../../common/lecteurs-bilan';

/**
 * UN BILAN DÉSÉQUILIBRÉ NE SE CLÔTURE PAS (simulation sur vraie base du
 * 2026-10-08) · le bilan 2027 sortait à 165 828 000 contre 211 900 000 et la
 * clôture l'acceptait. Seule la part du 13 que l'état ne lit pas, et que la
 * clôture vire au report à nouveau, est un écart admis.
 */
type Refuser = (t: string, e: string, d: object, p?: object) => Promise<void>;
const PERIODE = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };

function monter(
  bilan: { totalActif: number; totalPassif: number; controle?: { resultatClasses678: number; resultatCompte13: number } },
  treize = { debit: 0, credit: 0 },
  virements585 = { debit: 0, credit: 0 },
  // Le 585 de tout le groupe sur la période · soldé par défaut.
  groupe: { solde: number } | 'absent' = { solde: 0 },
) {
  const lecteur = { bilan: jest.fn().mockResolvedValue(bilan) };
  const lecteurGroupe = { virements585DuGroupe: jest.fn().mockResolvedValue(groupe) };
  const moduleRef = {
    get: jest.fn((jeton: string) => {
      if (jeton !== LECTEUR_VIREMENTS_GROUPE) return lecteur;
      if (groupe === 'absent') throw new Error(`${jeton} introuvable`);
      return lecteurGroupe;
    }),
  };
  // La doublure honore la requête · le 13 et le 585 se lisent par leur racine.
  const prisma = {
    ligneEcriture: {
      aggregate: jest.fn((args: { where: { compte: { numero: { startsWith: string } } } }) =>
        Promise.resolve({ _sum: args.where.compte.numero.startsWith === '585' ? virements585 : treize }),
      ),
    },
  };
  const service = new ExerciceService(prisma as never, {} as never, moduleRef as never);
  const brut = (service as unknown as { refuserBilanDesequilibre: Refuser }).refuserBilanDesequilibre.bind(service);
  const refuser: Refuser = (t, e, d, p = PERIODE) => brut(t, e, d, p);
  return { refuser, moduleRef, prisma, lecteurGroupe };
}
const SARL = {
  referentiel: Referentiel.SYSCOHADA,
  systemeComptableSyscohada: 'NORMAL',
  jeuEtatsFinanciersSycebnl: null,
  dossierMereId: null,
  _count: { cellules: 0 },
};
const ASSOCIATION = {
  referentiel: Referentiel.SYCEBNL,
  systemeComptableSyscohada: null,
  jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
  dossierMereId: null,
  _count: { cellules: 0 },
};
const CELLULE = { ...ASSOCIATION, dossierMereId: 'siege', _count: { cellules: 0 } };
const SIEGE = { ...ASSOCIATION, dossierMereId: null, _count: { cellules: 2 } };
const SANS_RESULTAT = { resultatClasses678: 0, resultatCompte13: 0 };

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

  /**
   * G1 (simulation complète du 2026-10-08, décision de Manasse) · le 585 des
   * transferts entre dossiers d'un groupe SYCEBNL n'est lu par aucun poste du
   * bilan des associations. Fiche SYCEBNL du compte 58 · comptes de passage
   * « internes à l'entité », soldés sur l'entité, que la liasse du groupe
   * contrôle.
   */
  describe('le 585 d’un groupe SYCEBNL', () => {
    it('la cellule qui a reçu 2 000 000 du siège clôture · l’écart est son 585 créditeur, le groupe l’a soldé', async () => {
      const { refuser, lecteurGroupe } = monter({ totalActif: 5_000_000, totalPassif: 3_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 0,
        credit: 2_000_000,
      });
      await expect(refuser('t', 'e', CELLULE)).resolves.toBeUndefined();
      // Le groupe se lit à la date de clôture de l'exercice.
      expect(lecteurGroupe.virements585DuGroupe).toHaveBeenCalledWith('t', PERIODE.dateFin);
    });

    it('un transfert passé d’un seul côté refuse la clôture · le 585 du groupe n’est pas soldé (relecture du 2026-10-08)', async () => {
      // Le siège a envoyé 2 000 000 le 30/12, la cellule n'a rien passé ·
      // admise, la clôture enfermait la liasse du groupe pour de bon.
      const { refuser } = monter(
        { totalActif: 3_000_000, totalPassif: 5_000_000, controle: SANS_RESULTAT },
        undefined,
        { debit: 2_000_000, credit: 0 },
        { solde: 2_000_000 },
      );
      await expect(refuser('t', 'e', SIEGE)).rejects.toThrow(
        /585[\s\S]*du groupe n'est pas soldé au 31\/12\/2026[\s\S]*2\s000\s000,00 au débit[\s\S]*quitté le groupe/,
      );
    });

    it('sans lecteur du groupe, rien n’est présumé · refus nommé', async () => {
      const { refuser } = monter(
        { totalActif: 5_000_000, totalPassif: 3_000_000, controle: SANS_RESULTAT },
        undefined,
        { debit: 0, credit: 2_000_000 },
        'absent',
      );
      await expect(refuser('t', 'e', CELLULE)).rejects.toThrow(/585 du groupe n'a pas pu être lu/);
    });

    it('le Système minimal lit le 585 à son bilan · un écart égal par hasard n’y est pas admis', async () => {
      const { refuser, lecteurGroupe } = monter({ totalActif: 5_000_000, totalPassif: 3_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 0,
        credit: 2_000_000,
      });
      const siegeSmt = { ...SIEGE, jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE' };
      await expect(refuser('t', 'e', siegeSmt)).rejects.toThrow(/ne s'équilibre pas/);
      expect(lecteurGroupe.virements585DuGroupe).not.toHaveBeenCalled();
    });

    it('le siège qui a envoyé 2 000 000 clôture · l’écart est son 585 débiteur', async () => {
      const { refuser } = monter({ totalActif: 3_000_000, totalPassif: 5_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 2_000_000,
        credit: 0,
      });
      await expect(refuser('t', 'e', SIEGE)).resolves.toBeUndefined();
    });

    it('un écart qui dépasse le 585 refuse encore, et nomme le 585', async () => {
      const { refuser } = monter({ totalActif: 5_000_100, totalPassif: 3_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 0,
        credit: 2_000_000,
      });
      await expect(refuser('t', 'e', CELLULE)).rejects.toThrow(/écart de 2\s000\s100,00[\s\S]*585[\s\S]*créditeur de 2\s000\s000,00[\s\S]*seul un écart égal/);
    });

    it('un écart du mauvais sens n’est pas le 585 · refusé', async () => {
      const { refuser } = monter({ totalActif: 3_000_000, totalPassif: 5_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 0,
        credit: 2_000_000,
      });
      await expect(refuser('t', 'e', CELLULE)).rejects.toThrow(/ne s'équilibre pas/);
    });

    it('hors groupe, le 585 non soldé refuse, et le message le nomme', async () => {
      const { refuser } = monter({ totalActif: 5_000_000, totalPassif: 3_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 0,
        credit: 2_000_000,
      });
      const isole = { ...ASSOCIATION, dossierMereId: null, _count: { cellules: 0 } };
      await expect(refuser('t', 'e', isole)).rejects.toThrow(/585[\s\S]*fiche du compte 58\)\.$/);
    });

    it('au SYSCOHADA le 585 ne se lit pas · un établissement passe par les 184 à 187', async () => {
      const { refuser, prisma } = monter({ totalActif: 5_000_000, totalPassif: 3_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 0,
        credit: 2_000_000,
      });
      await expect(refuser('t', 'e', { ...SARL, dossierMereId: 'siege' })).rejects.toThrow(/ne s'équilibre pas/);
      expect(prisma.ligneEcriture.aggregate).toHaveBeenCalledTimes(1);
    });

    it('le 585 se lit sur le livre-journal de l’exercice, et seulement quand le bilan a un écart', async () => {
      const equilibre = monter({ totalActif: 1, totalPassif: 1, controle: SANS_RESULTAT });
      await equilibre.refuser('t', 'e', CELLULE);
      expect(equilibre.prisma.ligneEcriture.aggregate).toHaveBeenCalledTimes(1);
      const { refuser, prisma } = monter({ totalActif: 5_000_000, totalPassif: 3_000_000, controle: SANS_RESULTAT }, undefined, {
        debit: 0,
        credit: 2_000_000,
      });
      await refuser('t', 'e', CELLULE);
      expect(prisma.ligneEcriture.aggregate.mock.calls[1][0].where).toEqual({
        compte: { tenantId: 't', numero: { startsWith: '585' } },
        ecriture: { tenantId: 't', exerciceId: 'e', statut: 'VALIDEE', estSoldeDesComptesDeGestion: false },
      });
    });
  });

  it('la clôture sélectionne le groupe du dossier et passe la période de l’exercice (le branchement avec la règle)', () => {
    // Découpe le CORPS de `cloturer` · la propriété se cherche dedans, jamais
    // à une distance (CLAUDE.md § 10).
    const source = readFileSync(join(__dirname, 'exercice.service.ts'), 'utf8');
    const debut = source.indexOf('  async cloturer(');
    const corps = source.slice(debut, source.indexOf('\n  async ', debut + 10));
    expect(corps).toContain('dossierMereId: true,');
    expect(corps).toContain('_count: { select: { cellules: true } },');
    expect(corps).toContain('await this.refuserBilanDesequilibre(tenantId, exerciceId, dossier, exercice);');
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
