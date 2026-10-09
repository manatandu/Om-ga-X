import { Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { PLAN_COMPTES_SYCEBNL } from './compte-seed';
import { PLAN_COMPTES_SYSCOHADA } from './compte-seed-syscohada';
import {
  compteSemeSubdivise,
  estCompteSeme,
  racineDuCompteSeme,
  racinesSousLeCompteSeme,
} from './subdivisions-du-plan';

const PLANS = [
  [Referentiel.SYCEBNL, PLAN_COMPTES_SYCEBNL],
  [Referentiel.SYSCOHADA, PLAN_COMPTES_SYSCOHADA],
] as const;

describe('la racine d’un compte semé', () => {
  it('est son numéro officiel, lu dans le plan semé', () => {
    expect(racineDuCompteSeme(Referentiel.SYSCOHADA, '52110000')).toBe('5211');
    expect(racineDuCompteSeme(Referentiel.SYCEBNL, '57100000')).toBe('571');
    expect(racineDuCompteSeme(Referentiel.SYSCOHADA, '57110000')).toBe('5711');
    // Un total, un compte du dossier · aucune racine de compte d'imputation.
    expect(racineDuCompteSeme(Referentiel.SYSCOHADA, '521')).toBeNull();
    expect(racineDuCompteSeme(Referentiel.SYSCOHADA, '52110001')).toBeNull();
  });

  it('n’est jamais le numéro dépouillé quand ce dernier est un TOTAL semé · liste gelée', () => {
    const ecarts = (ref: Referentiel, plan: readonly { numero: string; typeCompte?: TypeCompteDetailTotal }[]) =>
      plan
        .filter((c) => c.typeCompte !== TypeCompteDetailTotal.TOTAL)
        .filter((c) => racineDuCompteSeme(ref, c.numero) !== c.numero.replace(/0+$/, ''))
        .map((c) => `${c.numero}:${racineDuCompteSeme(ref, c.numero)}`);
    expect(ecarts(Referentiel.SYCEBNL, PLAN_COMPTES_SYCEBNL)).toEqual([
      '28000000:280',
      '35000000:350',
      '49000000:490',
      '59000000:590',
      '68000000:680',
      '87000000:870',
      '90000000:900',
      '91000000:910',
    ]);
    expect(ecarts(Referentiel.SYSCOHADA, PLAN_COMPTES_SYSCOHADA)).toEqual(['49000000:490', '59000000:590']);
  });

  it('tout compte d’imputation semé en a une, et tout numéro semé se reconnaît', () => {
    for (const [ref, plan] of PLANS) {
      for (const c of plan) {
        expect(estCompteSeme(ref, c.numero)).toBe(true);
        if (c.typeCompte !== TypeCompteDetailTotal.TOTAL) expect(racineDuCompteSeme(ref, c.numero)).not.toBeNull();
      }
    }
  });
});

describe('le compte semé que le dossier subdivise', () => {
  it('est la plus longue racine semée qui préfixe le numéro, si c’est un compte d’imputation', () => {
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '52110001')).toBe('52110000');
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '5211000001')).toBe('52110000');
    expect(compteSemeSubdivise(Referentiel.SYCEBNL, '57100003')).toBe('57100000');
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '41110001')).toBe('41110000');
  });

  it('490 garde les siens et ne prend pas ceux du 491 ni du 499', () => {
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '49000001')).toBe('49000000');
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '49110001')).toBe('49110000');
    expect(compteSemeSubdivise(Referentiel.SYCEBNL, '90000001')).toBe('90000000');
  });

  it('un numéro rangé sous un TOTAL, ou semé, n’est la subdivision d’aucun compte', () => {
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '52120000')).toBeNull();
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '52110000')).toBeNull();
    // Le 411 n'est pas un compte d'imputation au SYSCOHADA (4111 à 4114).
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '41100001')).toBeNull();
  });

  it('un sous-compte semé sous un compte d’imputation prend les siens · gelé', () => {
    const sous = (ref: Referentiel, plan: readonly { numero: string; typeCompte?: TypeCompteDetailTotal }[]) =>
      plan
        .filter((c) => c.typeCompte !== TypeCompteDetailTotal.TOTAL)
        .filter((c) => racinesSousLeCompteSeme(ref, c.numero).length > 0)
        .map((c) => `${c.numero}:${racinesSousLeCompteSeme(ref, c.numero).sort().join(',')}`);
    expect(sous(Referentiel.SYCEBNL, PLAN_COMPTES_SYCEBNL)).toEqual([
      '44780000:44781,44782,44783,44784,44785',
      '83100000:8311,8315',
      '84100000:8411,8412,8415',
    ]);
    expect(sous(Referentiel.SYSCOHADA, PLAN_COMPTES_SYSCOHADA)).toEqual([]);
    expect(compteSemeSubdivise(Referentiel.SYCEBNL, '83110001')).toBe('83110000');
    expect(compteSemeSubdivise(Referentiel.SYCEBNL, '83190001')).toBe('83100000');
  });
});
