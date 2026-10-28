import {
  bornesDeLecture,
  compterLaSemaine,
  finDeService,
  heuresAProposer,
  moisDePaiementDeLaSemaine,
  motifRefusCompteur,
  motifRefusHeuresDuJour,
  motifRefusPeriode,
  semainesPayeesAuMois,
  type JourConnu,
} from './feuilles-temps';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · ce qui casserait en silence dans le
 * compte des heures · une heure comptée deux fois, une semaine incomplète lue
 * comme une semaine à zéro, un total de 45 heures exactes lu au-delà par un
 * arrondi, une semaine payée deux fois ou jamais.
 */

const J = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Une semaine dont le lundi est donné, les heures du lundi au dimanche. */
function semaine(lundi: string, heures: Array<number | null>, nuit: number[] = []) {
  const jours: Record<string, JourConnu> = {};
  heures.forEach((h, k) => {
    const d = new Date(J(lundi).getTime() + k * 86_400_000).toISOString().slice(0, 10);
    jours[d] = h === null ? null : { heures: h, heuresNuit: nuit[k] ?? 0 };
  });
  const dimanche = new Date(J(lundi).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  return compterLaSemaine({ lundi, dimanche, jours });
}

describe('les heures supplémentaires · art. 119, deux limites, une heure comptée une fois', () => {
  it('neuf heures cinq jours · cinq heures au-delà de huit dans la journée, la semaine sous quarante-cinq', () => {
    const s = semaine('2026-10-05', [9, 9, 9, 9, 9, 0, 0]);
    expect(s.supplementairesDuJour).toBe(5);
    expect(s.supplementairesDeLaSemaine).toBe(0);
  });

  it('huit heures six jours · trois heures au-delà de quarante-cinq dans la semaine, aucune au jour', () => {
    const s = semaine('2026-10-05', [8, 8, 8, 8, 8, 8, 0]);
    expect(s.supplementairesDuJour).toBe(0);
    expect(s.supplementairesDeLaSemaine).toBe(3);
    expect(s.heuresSamedi).toBe(8);
  });

  it('les deux limites ensemble · les heures au-delà de huit ne se recomptent pas dans la semaine', () => {
    // Lundi 10 h, puis 8 h du mardi au samedi · 2 au jour, puis 8 + 40 = 48
    // dans les huit, 3 au-delà de 45 · cinq heures, jamais sept.
    const s = semaine('2026-10-05', [10, 8, 8, 8, 8, 8, 0]);
    expect(s.supplementairesDuJour).toBe(2);
    expect(s.supplementairesDeLaSemaine).toBe(3);
    expect(heuresAProposer([s]).totaux.supplementaires).toBe(5);
  });

  it('quarante-cinq heures exactes en dixièmes · aucun reste d’arrondi ne passe la limite', () => {
    const s = semaine('2026-10-05', [7.7, 7.7, 7.7, 7.7, 7.7, 6.5, 0]);
    expect(s.heures).toBe(45);
    expect(s.supplementairesDeLaSemaine).toBe(0);
  });

  it('UN JOUR NON COUVERT N’EST PAS UN ZÉRO · la limite de la semaine ne se calcule pas, celle du jour reste', () => {
    const s = semaine('2026-10-05', [10, 8, 8, 8, null, 8, 0]);
    expect(s.supplementairesDeLaSemaine).toBeNull();
    expect(s.supplementairesDuJour).toBe(2);
    expect(s.joursNonCouverts).toEqual(['2026-10-09']);
    const p = heuresAProposer([s]);
    expect(p.totaux.supplementairesIncompletes).toBe(true);
    expect(p.lignes.find((l) => l.nature === 'HEURES_SUPPLEMENTAIRES')).toMatchObject({ heures: 2, minimum: true });
  });

  it('un jour hors du tableau est hors contrat · connu, à zéro', () => {
    const s = compterLaSemaine({ lundi: '2026-10-05', dimanche: '2026-10-11', jours: { '2026-10-05': { heures: 9, heuresNuit: 0 } } });
    expect(s.joursNonCouverts).toEqual([]);
    expect(s.supplementairesDeLaSemaine).toBe(0);
    expect(s.supplementairesDuJour).toBe(1);
  });
});

describe('nuit, dimanche, férié et samedi · comptés à part, proposés à part', () => {
  it('le 30 juin est férié, le dimanche se compte au dimanche, la nuit parmi les heures du jour', () => {
    // Semaine du lundi 29 juin 2026 · le mardi 30 juin est férié (ordonnance
    // n° 23-042, art. 1er).
    const s = semaine('2026-06-29', [8, 4, 8, 8, 8, 0, 3], [2, 0, 0, 0, 0, 0, 0]);
    expect(s.heuresFerie).toBe(4);
    expect(s.heuresDimanche).toBe(3);
    expect(s.heuresNuit).toBe(2);
    const { lignes } = heuresAProposer([s]);
    expect(lignes.map((l) => [l.nature, l.libelle, l.heures])).toEqual([
      ['TRAVAIL_DE_NUIT', 'Heures de nuit', 2],
      ['TRAVAIL_REPOS_OU_FERIE', 'Heures du dimanche et des jours fériés', 7],
    ]);
  });

  it('le samedi reste une ligne à part · son supplément n’est dû que si la convention le prévoit', () => {
    const { lignes } = heuresAProposer([semaine('2026-10-05', [0, 0, 0, 0, 0, 5, 0])]);
    expect(lignes).toEqual([{ nature: 'TRAVAIL_REPOS_OU_FERIE', libelle: 'Heures du samedi', heures: 5, minimum: false, samedi: true }]);
  });

  it('un mois sans heure ne propose rien · un zéro ne se propose pas', () => {
    expect(heuresAProposer([semaine('2026-10-05', [0, 0, 0, 0, 0, 0, 0])]).lignes).toEqual([]);
  });
});

describe('une semaine se paie une fois, au mois de son dimanche', () => {
  it('la semaine du 29 juin 2026 finit le 5 juillet · payée en juillet', () => {
    expect(moisDePaiementDeLaSemaine(J('2026-06-29'), null)).toBe('2026-07');
  });

  it('sauf si le service s’achève avant le dimanche · payée au mois de la fin', () => {
    expect(moisDePaiementDeLaSemaine(J('2026-06-29'), J('2026-06-30'))).toBe('2026-06');
  });

  it('juillet 2026 paie les quatre semaines qui finissent en juillet, jamais celle qui finit en août', () => {
    expect(semainesPayeesAuMois('2026-07', null).map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-06-29', '2026-07-06', '2026-07-13', '2026-07-20']);
    expect(semainesPayeesAuMois('2026-08', null)[0].toISOString().slice(0, 10)).toBe('2026-07-27');
    expect(bornesDeLecture('2026-07', null)).toEqual({ du: J('2026-06-29'), au: J('2026-07-26') });
  });

  it('chaque semaine de l’année se paie à exactement un mois', () => {
    const lundis = new Map<string, number>();
    for (let m = 1; m <= 12; m += 1) {
      for (const l of semainesPayeesAuMois(`2026-${String(m).padStart(2, '0')}`, null)) {
        const k = l.toISOString().slice(0, 10);
        lundis.set(k, (lundis.get(k) ?? 0) + 1);
      }
    }
    expect([...lundis.values()].every((n) => n === 1)).toBe(true);
    expect(lundis.size).toBe(52);
  });

  it('la fin du service · celle du dernier contrat, aucune tant qu’un contrat est ouvert', () => {
    expect(finDeService([{ dateEntreeEnVigueur: J('2025-01-01'), dateFin: J('2025-12-31') }, { dateEntreeEnVigueur: J('2026-01-01'), dateFin: null }])).toBeNull();
    expect(finDeService([{ dateEntreeEnVigueur: J('2025-01-01'), dateFin: J('2025-12-31') }, { dateEntreeEnVigueur: J('2026-01-01'), dateFin: J('2026-06-30') }])).toEqual(J('2026-06-30'));
  });
});

describe('les refus de saisie', () => {
  it('une feuille couvre trente et un jours au plus', () => {
    expect(motifRefusPeriode('2026-07-01', '2026-07-31')).toBeNull();
    expect(motifRefusPeriode('2026-07-01', '2026-08-01')).toMatch(/31 jours/);
    expect(motifRefusPeriode('2026-07-10', '2026-07-01')).toMatch(/précède/);
  });

  it('la nuit va de 19 h à 5 h · dix heures au plus dans un jour civil, jamais plus que les heures du jour', () => {
    expect(motifRefusHeuresDuJour({ jour: '2026-07-01', heures: 12, heuresNuit: 10 })).toBeNull();
    expect(motifRefusHeuresDuJour({ jour: '2026-07-01', heures: 12, heuresNuit: 10.5 })).toMatch(/art\. 124/);
    expect(motifRefusHeuresDuJour({ jour: '2026-07-01', heures: 4, heuresNuit: 5 })).toMatch(/ne les dépassent pas/);
    expect(motifRefusHeuresDuJour({ jour: '2026-07-01', heures: 24.5, heuresNuit: 0 })).toMatch(/24 heures/);
    expect(motifRefusHeuresDuJour({ jour: '2026-07-01', heures: 7.333, heuresNuit: 0 })).toMatch(/centième/);
  });

  it('un compteur a un code court et un nom', () => {
    expect(motifRefusCompteur({ code: 'ASTREINTE', libelle: 'Astreintes' })).toBeNull();
    expect(motifRefusCompteur({ code: 'astreinte', libelle: 'Astreintes' })).toMatch(/majuscules/);
    expect(motifRefusCompteur({ code: 'FORM', libelle: 'F' })).toMatch(/nomme/);
  });
});
