import { PLAN_COMPTES_SYCEBNL } from '../comptes/compte-seed';
import { PLAN_COMPTES_SYSCOHADA } from '../comptes/compte-seed-syscohada';
import type { CompteRan } from './report-a-nouveau';
import {
  appliquerVirementAuReport,
  destinationsDuVirement,
  ecartInexpliqueDuBilan,
  virementResultatNonAffecte,
} from './virement-resultat-non-affecte';

/**
 * AUDCIF, Titre VII, compte 13 · « En fin d'exercice, le résultat de l'exercice
 * précédent non affecté à un compte de réserves et non distribué est viré au
 * compte de report à nouveau » ; « Dans les entités individuelles, le solde du
 * compte 13 est viré au compte 103 ». SYCEBNL, fiche du compte 13 · même
 * phrase, vers le « compte 12 – Report à nouveau ».
 */
const c = (id: string, numero: string, debit: number, credit: number, mode: CompteRan['modeReportANouveau'] = 'SOLDE'): CompteRan => ({
  id,
  numero,
  intitule: numero,
  modeReportANouveau: mode,
  sommes: { debit, credit, enDevise: [] },
});

describe('Virement du résultat non affecté · les comptes de destination', () => {
  it('chaque destination est un compte de détail SEMÉ, sous le 12 (ou le 103 de l’entité individuelle SYSCOHADA)', () => {
    const syscohada = destinationsDuVirement('SYSCOHADA', false);
    const sycebnl = destinationsDuVirement('SYCEBNL', false);
    const individuelle = destinationsDuVirement('SYSCOHADA', true);
    const semeSyscohada = (n: string) => PLAN_COMPTES_SYSCOHADA.find((x) => x.numero === n);
    const semeSycebnl = (n: string) => PLAN_COMPTES_SYCEBNL.find((x) => x.numero === n);
    expect(semeSyscohada(syscohada.credit)?.intitule).toBe('Report à nouveau créditeur');
    expect(semeSyscohada(syscohada.debit)?.intitule).toBe('Perte nette à reporter');
    expect(semeSycebnl(sycebnl.credit)?.intitule).toBe('Report à nouveau des excédents');
    expect(semeSycebnl(sycebnl.debit)?.intitule).toBe('Report à nouveau des déficits');
    expect(semeSyscohada(individuelle.credit)?.intitule).toBe('Capital personnel');
    // Un numéro, deux sens · le 10300000 du SYCEBNL est le « Droit d'entrée ».
    expect(destinationsDuVirement('SYCEBNL', true)).toEqual(sycebnl);
  });
});

describe('Virement du résultat non affecté · le calcul', () => {
  const ids: Record<string, string> = { '12100000': 'r121', '12910000': 'r1291', '10300000': 'r103' };
  const id = (n: string) => ids[n];

  it('une perte de 46 072 000 au 139 · C 139, D 12910000', () => {
    const v = virementResultatNonAffecte([c('139', '13900000', 46_072_000, 0), c('601', '60110000', 9, 0, 'AUCUN')], destinationsDuVirement('SYSCOHADA', false), id);
    expect(v.montant).toBe(-46_072_000);
    expect(v.compteDestination).toBe('12910000');
    expect(v.lignes).toEqual([
      expect.objectContaining({ compteId: '139', debit: 0, credit: 46_072_000 }),
      expect.objectContaining({ compteId: 'r1291', debit: 46_072_000, credit: 0 }),
    ]);
  });

  it('un 13 soldé par l’affectation · rien à virer', () => {
    const v = virementResultatNonAffecte([c('139', '13900000', 46_072_000, 46_072_000)], destinationsDuVirement('SYSCOHADA', false), id);
    expect(v).toEqual({ montant: 0, lignes: [], compteDestination: null });
  });

  it('entité individuelle · au 103', () => {
    const v = virementResultatNonAffecte([c('131', '13100000', 0, 5_000)], destinationsDuVirement('SYSCOHADA', true), id);
    expect(v.compteDestination).toBe('10300000');
    expect(v.lignes[1]).toEqual(expect.objectContaining({ compteId: 'r103', credit: 5_000 }));
  });

  it('compte de destination absent du plan · refus nommé, jamais un virement sans contrepartie', () => {
    expect(() => virementResultatNonAffecte([c('139', '13900000', 10, 0)], destinationsDuVirement('SYSCOHADA', false), () => undefined)).toThrow(/12910000/);
  });

  it('fondu dans un report déjà calculé · 139 de 57 672 000 devient 11 600 000, le 12910000 reçoit 46 072 000', () => {
    const report = [{ compteId: '139', debit: 57_672_000, credit: 0, libelle: 'R' }];
    const v = virementResultatNonAffecte([c('139', '13900000', 46_072_000, 0)], destinationsDuVirement('SYSCOHADA', false), id);
    expect(appliquerVirementAuReport(report, v.lignes)).toEqual([
      expect.objectContaining({ compteId: '139', debit: 11_600_000, credit: 0 }),
      expect.objectContaining({ compteId: 'r1291', debit: 46_072_000, credit: 0 }),
    ]);
  });
});

describe('Bilan à la clôture · l’écart que le virement n’explique pas', () => {
  it('le bilan 2027 de la simulation · écart −46 072 000, tout expliqué par la perte 2026 non affectée', () => {
    expect(
      ecartInexpliqueDuBilan(
        { totalActif: 165_828_000, totalPassif: 211_900_000, controle: { resultatClasses678: -11_600_000, resultatCompte13: -46_072_000 } },
        -46_072_000,
      ),
    ).toBe(0);
  });

  it('un compte non rattaché à un poste · l’écart reste, la clôture le refusera', () => {
    expect(ecartInexpliqueDuBilan({ totalActif: 1_000, totalPassif: 900, controle: { resultatClasses678: 5, resultatCompte13: 0 } }, 0)).toBe(100);
  });

  it('après clôture (classes 6 à 8 soldées), l’état lit le 13 · seule la part non lue est attendue', () => {
    // 130 non lu par le SYSCOHADA (anomalie n° 7) · 300 attendus d'écart.
    expect(ecartInexpliqueDuBilan({ totalActif: 1_300, totalPassif: 1_000, controle: { resultatClasses678: 0, resultatCompte13: 200 } }, 500)).toBe(0);
  });

  it('un état qui ne dit pas comment il lit son résultat · rien n’est affirmé tant qu’un 13 est ouvert', () => {
    expect(ecartInexpliqueDuBilan({ totalActif: 10, totalPassif: 5 }, 0)).toBe(5);
    expect(ecartInexpliqueDuBilan({ totalActif: 10, totalPassif: 5 }, 3)).toBeNull();
  });
});
