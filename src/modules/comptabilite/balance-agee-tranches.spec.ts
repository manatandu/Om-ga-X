import { EcritureService, PERIMETRES_BALANCE_AGEE, ligneVentilee, type PerimetreBalanceAgee } from './ecriture.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * LE CALCUL DES TRANCHES, EXERCÉ · pas seulement relu.
 *
 * Le spec voisin (`balance-agee-modele`) lit le source et verrouille le
 * MODÈLE. Il ne prouve rien de l'arithmétique : un découpage mensuel faux
 * d'un jour le passerait sans broncher. Celui-ci fait tourner le service sur
 * un jeu d'échéances placées aux bornes exactes.
 *
 * Exercice 2025 entier, date de référence au 31/12/2025 · sept tranches
 * attendues, comme dans le modèle relevé :
 *
 *   0 · avant le 01/01/2025      (antérieur à l'exercice)
 *   1 · du 01/01 au 31/07        (180 jours et plus)
 *   2 · août   3 · septembre   4 · octobre   5 · novembre   6 · décembre
 */

function ligneEcriture(compte: string, debit: number, credit: number, echeance: string | null, date: string) {
  return {
    debit,
    credit,
    dateEcheance: echeance ? new Date(echeance) : null,
    compte: { id: `c-${compte}`, numero: compte, intitule: `Compte ${compte}` },
    ecriture: { date: new Date(date) },
  };
}

function service(
  lignes: ReturnType<typeof ligneEcriture>[],
  rattachements: Array<{ compteId: string; tiers: { id: string; code: string; nom: string } }> = [],
) {
  const prisma = {
    exercice: {
      // Honore l'exercice ET le dossier · le service refuse d'un 404 ce que
      // la doublure ne rend pas (jumeau de l'audit final F222).
      findFirst: jest.fn(({ where }: { where: { id?: string; tenantId?: string } }) =>
        Promise.resolve(
          where.id === 'ex' && where.tenantId === 't'
            ? { dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }
            : null,
        ),
      ),
    },
    ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
    tiersCompte: { findMany: jest.fn().mockResolvedValue(rattachements) },
  } as unknown as PrismaService;
  return new EcritureService(prisma, {} as never, {} as never, {} as never);
}

const AU_31_12 = { exerciceId: 'ex', dateReference: '2025-12-31' };

describe('balance âgée · découpage des tranches', () => {
  it('ouvre sept tranches sur un exercice civil entier', async () => {
    const r = await service([]).balanceAgee('t', AU_31_12);
    expect(r.tranches.map((t) => t.cle)).toEqual([
      'ouverture',
      'ancien',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
    ]);
    expect(r.tranches[1].libelleAge).toBe('180 jours et plus');
    expect(r.tranches[6].libelleAge).toBe('Moins de 30 jours');
    expect(r.tranches[6].libellePeriode).toBe('Du 01/12/2025 au 31/12/2025');
  });

  it('range chaque échéance dans SA tranche, bornes comprises', async () => {
    // Une échéance au premier jour d'un mois appartient à ce mois ; au dernier
    // jour aussi. C'est l'erreur classique d'un découpage à la louche.
    const r = await service([
      ligneEcriture('411001', 100, 0, '2024-12-31', '2025-01-05'), // avant l'exercice
      ligneEcriture('411001', 200, 0, '2025-07-31', '2025-07-31'), // dernier jour du bloc ancien
      ligneEcriture('411001', 400, 0, '2025-08-01', '2025-08-01'), // premier jour d'août
      ligneEcriture('411001', 800, 0, '2025-11-30', '2025-11-30'), // dernier jour de novembre
      ligneEcriture('411001', 1600, 0, '2025-12-01', '2025-12-01'), // premier jour de décembre
    ]).balanceAgee('t', AU_31_12);

    expect(r.debiteurs).toHaveLength(1);
    expect(r.debiteurs[0].montants).toEqual([100, 200, 400, 0, 0, 800, 1600]);
    expect(r.debiteurs[0].solde).toBe(3100);
  });

  it('reprend la date d’écriture quand l’échéance n’est pas saisie', async () => {
    const r = await service([ligneEcriture('411001', 500, 0, null, '2025-09-15')]).balanceAgee('t', AU_31_12);
    expect(r.debiteurs[0].montants[3]).toBe(500);
  });

  it('réunit sur UNE ligne les deux comptes d’un même tiers', async () => {
    // Un 411 d'exploitation et un 416 douteux appartenant au même client : son
    // exposition est une, et la couper en deux la sous-estime à la lecture.
    const r = await service(
      [
        ligneEcriture('411001', 300, 0, '2025-12-10', '2025-12-10'),
        ligneEcriture('416001', 700, 0, '2025-03-10', '2025-03-10'),
      ],
      [
        { compteId: 'c-411001', tiers: { id: 'T1', code: '410038', nom: 'CREC 8' } },
        { compteId: 'c-416001', tiers: { id: 'T1', code: '410038', nom: 'CREC 8' } },
      ],
    ).balanceAgee('t', AU_31_12);

    expect(r.debiteurs).toHaveLength(1);
    expect(r.debiteurs[0].libelle).toBe('410038 - CREC 8');
    expect(r.debiteurs[0].solde).toBe(1000);
  });

  it('sépare les soldes de sens contraire, sans les ventiler', async () => {
    const r = await service([
      ligneEcriture('411001', 1000, 0, '2025-12-10', '2025-12-10'),
      ligneEcriture('411002', 0, 400, '2025-12-10', '2025-12-10'),
    ]).balanceAgee('t', AU_31_12);

    expect(r.debiteurs).toHaveLength(1);
    // Un client créditeur n'a pas d'antériorité de créance (fiche du 41).
    expect(r.crediteurs).toHaveLength(0);
    expect(r.sensInverse).toHaveLength(1);
    expect(r.sensInverse[0].montants).toEqual([]);
    expect(r.totaux.debiteurs).toBe(1000);
    expect(r.totaux.crediteurs).toBe(0);
    expect(r.totaux.sensInverse).toBe(-400);
    // Le net est ce qui doit recouper la balance auxiliaire.
    expect(r.totaux.net).toBe(600);
    // Les totaux par tranche ne portent QUE les débiteurs · y mêler les
    // créditeurs ferait un état dont les colonnes ne somment plus au total.
    expect(r.totaux.parTranche[6]).toBe(1000);
  });

  it('compense une correction en négatif dans la tranche d’origine', async () => {
    // AUDCIF art. 20 : l'erreur et sa contre-passation restent au journal. Les
    // deux lignes tombent dans la même tranche et s'y annulent, au lieu de
    // gonfler deux colonnes en sens opposés.
    const r = await service([
      ligneEcriture('411001', 900, 0, '2025-10-05', '2025-10-05'),
      ligneEcriture('411001', 0, 900, '2025-10-05', '2025-10-06'),
      ligneEcriture('411001', 250, 0, '2025-10-05', '2025-10-06'),
    ]).balanceAgee('t', AU_31_12);

    expect(r.debiteurs[0].montants[4]).toBe(250);
    expect(r.debiteurs[0].solde).toBe(250);
  });

  it('n’ouvre pas de bloc « reste de l’exercice » quand la fenêtre le couvre', async () => {
    // Date de référence au 31/03 : la fenêtre de cinq mois remonte à novembre
    // de l'exercice précédent, donc avant l'ouverture. Un bloc « du 01/01 à la
    // veille » couvrirait une période vide.
    const r = await service([]).balanceAgee('t', { exerciceId: 'ex', dateReference: '2025-03-31' });
    expect(r.tranches.map((t) => t.cle)).not.toContain('ancien');
    expect(r.tranches).toHaveLength(6);
  });

  it('borne une date de référence postérieure à la clôture', async () => {
    const r = await service([]).balanceAgee('t', { exerciceId: 'ex', dateReference: '2026-06-30' });
    expect(r.dateReference).toBe('2025-12-31');
  });
});

/**
 * LES PÉRIMÈTRES · l'antériorité ne veut pas dire la même chose partout.
 *
 * Le tableau était borné au crédit commercial (40 et 41), où une ligne
 * ancienne est un délai de règlement dépassé. Élargi tel quel aux comptes de
 * personnel, d'organismes sociaux et d'État, il ferait lire un retard là où il
 * n'y a qu'un calendrier : la paie de décembre versée en janvier et les
 * cotisations du quatrième trimestre déclarées après la clôture sont la
 * situation NORMALE d'une clôture.
 *
 * Et il ferait pire sur les comptes de TVA, qui n'ont pas d'échéance du tout ·
 * ce sont les termes d'une liquidation remise à zéro chaque mois. Chaque
 * dossier verrait un « retard » massif sur le compte le plus mouvementé de sa
 * classe 4.
 */
describe('balance âgée · les périmètres et ce que l’antériorité y signifie', () => {
  const requete = async (type: PerimetreBalanceAgee, lignes: ReturnType<typeof ligneEcriture>[] = []) => {
    const s = service(lignes);
    const r = await s.balanceAgee('t', { ...AU_31_12, type });
    return r;
  };

  it('TOUS reste le crédit commercial · 40 et 41, et rien d’autre', () => {
    expect(PERIMETRES_BALANCE_AGEE.TOUS.racines).toEqual(['40', '41']);
    expect(PERIMETRES_BALANCE_AGEE.TOUS.exclusions).toEqual([]);
  });

  it('les comptes de TVA sont ÉCARTÉS du 44 · une liquidation périodique n’a pas d’antériorité', () => {
    // 443 TVA facturée, 444 TVA due ou crédit, 445 TVA récupérable, 446 autres
    // taxes sur le chiffre d'affaires. Les vieillir afficherait un retard qui
    // n'existe pas, sur le compte le plus mouvementé de la classe 4.
    expect(PERIMETRES_BALANCE_AGEE.ETAT_44.exclusions).toEqual(['443', '444', '445', '446']);
    expect(PERIMETRES_BALANCE_AGEE.ETAT_44.racines).toEqual(['44']);
  });

  it('l’exclusion atteint bien la requête · le filtre NOT porte les quatre racines', async () => {
    const s = service([]);
    await s.balanceAgee('t', { ...AU_31_12, type: 'ETAT_44' });
    const where = (s as unknown as { prisma: { ligneEcriture: { findMany: jest.Mock } } }).prisma.ligneEcriture
      .findMany.mock.calls[0][0].where;
    expect(where.NOT).toEqual([
      { compte: { numero: { startsWith: '443' } } },
      { compte: { numero: { startsWith: '444' } } },
      { compte: { numero: { startsWith: '445' } } },
      { compte: { numero: { startsWith: '446' } } },
    ]);
  });

  it('un périmètre sans exclusion ne pose AUCUN filtre NOT · sinon Prisma exclurait tout', async () => {
    const s = service([]);
    await s.balanceAgee('t', { ...AU_31_12, type: 'PERSONNEL_42' });
    const where = (s as unknown as { prisma: { ligneEcriture: { findMany: jest.Mock } } }).prisma.ligneEcriture
      .findMany.mock.calls[0][0].where;
    expect(where.NOT).toBeUndefined();
  });

  it('chaque périmètre porte sa lecture, et les quatre nouveaux disent qu’il n’y a pas de crédit commercial', () => {
    for (const cle of Object.keys(PERIMETRES_BALANCE_AGEE) as PerimetreBalanceAgee[]) {
      const p = PERIMETRES_BALANCE_AGEE[cle];
      expect(p.lecture.length).toBeGreaterThan(60);
      expect(p.libelle.length).toBeGreaterThan(5);
    }
    for (const cle of ['PERSONNEL_42', 'SOCIAL_43', 'ETAT_44'] as const) {
      expect(PERIMETRES_BALANCE_AGEE[cle].lecture).toContain('AUCUN CRÉDIT COMMERCIAL');
    }
    // Le 47 est le seul des nouveaux où l'antériorité garde tout son sens ·
    // des opérations « en instance de régularisation » (Contenu du COMPTE 47)
    // n'ont pas vocation à rester ouvertes.
    expect(PERIMETRES_BALANCE_AGEE.DIVERS_47.lecture).not.toContain('AUCUN CRÉDIT COMMERCIAL');
    // Passe R1, B1 · la citation est celle du Contenu du COMPTE 47, lue à
    // l'AUDCIF Titre VII (titre-7-comptes-classe-4.md), et non celle du 45.
    expect(PERIMETRES_BALANCE_AGEE.DIVERS_47.lecture).toContain('EN INSTANCE DE RÉGULARISATION');
  });

  it('la lecture voyage avec l’état · sans elle le même tableau se lit de travers', async () => {
    const r = await requete('SOCIAL_43');
    expect(r.type).toBe('SOCIAL_43');
    expect(r.lecture).toContain('échéance légale');
    expect(r.libellePerimetre).toContain('43');
  });

  it('les sept périmètres sont couverts · un huitième ajouté sans sa lecture fait tomber ce test', () => {
    expect(Object.keys(PERIMETRES_BALANCE_AGEE).sort()).toEqual(
      ['CLIENTS_41', 'DIVERS_47', 'ETAT_44', 'FOURNISSEURS', 'PERSONNEL_42', 'SOCIAL_43', 'TOUS'].sort(),
    );
  });

  /**
   * LE SENS NORMAL DE CHAQUE PÉRIMÈTRE (simulation complète du 2026-10-08,
   * lot M, D1) · tout solde créditeur partait « en sens inverse, non
   * ventilé », si bien que la balance âgée des FOURNISSEURS ne ventilait
   * aucune dette, ni celle des 43 et 44 aucune dette sociale ou fiscale.
   * Fiches des comptes 40 et 41 · le 40 crédité des factures du fournisseur
   * (409 fournisseurs débiteurs), le 41 débité des factures au client (419
   * clients créditeurs) ; 42, 43, 44 et 47 portent les deux sens dans leur
   * plan (421 et 422, 4387 et 4386, 4492 et 441, débiteurs et créditeurs
   * divers).
   */
  it('chaque périmètre déclare son sens normal', () => {
    expect(Object.fromEntries(Object.entries(PERIMETRES_BALANCE_AGEE).map(([k, p]) => [k, p.sensNormal]))).toEqual({
      TOUS: 'SELON_LE_COMPTE',
      CLIENTS_41: 'DEBITEUR',
      FOURNISSEURS: 'CREDITEUR',
      PERSONNEL_42: 'LES_DEUX',
      SOCIAL_43: 'LES_DEUX',
      ETAT_44: 'LES_DEUX',
      DIVERS_47: 'LES_DEUX',
    });
  });

  it('la dette fournisseur se VENTILE dans la colonne de son échéance · un retard de paiement', async () => {
    const r = await requete('FOURNISSEURS', [
      // 2 000 000 HT + 320 000 de taxe, échue le 05/10/2025, non payée.
      ligneEcriture('401001', 0, 2_320_000, '2025-10-05', '2025-09-05'),
      // Une avance versée à un autre fournisseur · aucun retard de paiement.
      ligneEcriture('401002', 150_000, 0, '2025-11-20', '2025-11-20'),
    ]);
    expect(r.crediteurs).toHaveLength(1);
    expect(r.crediteurs[0].solde).toBe(-2_320_000);
    expect(r.crediteurs[0].montants[r.tranches.findIndex((t) => t.cle === '2025-10')]).toBe(-2_320_000);
    expect(r.totaux.parTrancheCrediteurs[r.tranches.findIndex((t) => t.cle === '2025-10')]).toBe(-2_320_000);
    expect(r.totaux.crediteurs).toBe(-2_320_000);
    expect(r.debiteurs).toHaveLength(0);
    expect(r.sensInverse.map((l) => l.solde)).toEqual([150_000]);
    expect(r.sensInverse[0].montants).toEqual([]);
    expect(r.totaux.net).toBe(-2_170_000);
  });

  it('« 40 et 41 » lit le sens sur le compte de la ligne', async () => {
    const r = await requete('TOUS', [
      ligneEcriture('411001', 1_000, 0, '2025-12-10', '2025-12-10'),
      ligneEcriture('401001', 0, 700, '2025-11-10', '2025-11-10'),
      ligneEcriture('401002', 50, 0, '2025-11-10', '2025-11-10'),
      ligneEcriture('411002', 0, 30, '2025-12-10', '2025-12-10'),
    ]);
    expect(r.debiteurs.map((l) => l.numero)).toEqual(['411001']);
    expect(r.crediteurs.map((l) => l.numero)).toEqual(['401001']);
    expect(r.sensInverse.map((l) => l.numero)).toEqual(['401002', '411002']);
    expect(r.totaux.net).toBe(1_000 - 700 + 50 - 30);
  });

  it('les dettes sociales et les produits à recevoir du 43 se ventilent tous deux', async () => {
    const r = await requete('SOCIAL_43', [
      ligneEcriture('431100', 0, 900_000, '2025-09-15', '2025-08-31'),
      ligneEcriture('438700', 40_000, 0, '2025-12-31', '2025-12-31'),
    ]);
    expect(r.crediteurs[0].montants[r.tranches.findIndex((t) => t.cle === '2025-09')]).toBe(-900_000);
    expect(r.debiteurs[0].montants[6]).toBe(40_000);
    expect(r.sensInverse).toHaveLength(0);
  });

  /**
   * PAQUET 1, B3 · une facture et son règlement non lettrés entre eux font un
   * solde nul · relevé sur vraie base, la ligne sortait sous « Soldes en sens
   * inverse », comme un client créditeur. Elle est rendue à part, hors de
   * tout total, et les totaux ne bougent pas.
   */
  it('un solde nul n’est en aucun sens · rendu à part, hors des totaux (B3)', async () => {
    const r = await requete('CLIENTS_41', [
      // C3 · facture de mars, règlement d'octobre, non lettrés · solde nul.
      ligneEcriture('411003', 1_000_000, 0, '2025-03-10', '2025-03-10'),
      ligneEcriture('411003', 0, 1_000_000, '2025-10-10', '2025-10-10'),
      // C3B · une créance ordinaire.
      ligneEcriture('411004', 500_000, 0, '2025-11-10', '2025-11-10'),
    ]);
    expect(r.sensInverse).toHaveLength(0);
    expect(r.totaux.sensInverse).toBe(0);
    expect(r.soldesNuls.map((l) => l.numero)).toEqual(['411003']);
    expect(r.soldesNuls[0]).toMatchObject({ solde: 0, montants: [] });
    expect(r.debiteurs.map((l) => l.numero)).toEqual(['411004']);
    expect(r.totaux.debiteurs).toBe(500_000);
    expect(r.totaux.net).toBe(500_000);
    // Le total par tranche ne porte que la créance ordinaire · la facture
    // compensée n'y entre pas.
    expect(r.totaux.parTranche.reduce((t, m) => t + m, 0)).toBe(500_000);
  });

  it('un solde nul n’est en aucun sens non plus sous « 40 et 41 » ni pour un fournisseur (B3)', async () => {
    for (const type of ['TOUS', 'FOURNISSEURS'] as const) {
      const r = await requete(type, [
        ligneEcriture('401005', 0, 300_000, '2025-04-10', '2025-04-10'),
        ligneEcriture('401005', 300_000, 0, '2025-09-10', '2025-09-10'),
      ]);
      expect(r.sensInverse).toHaveLength(0);
      expect(r.crediteurs).toHaveLength(0);
      expect(r.soldesNuls.map((l) => l.numero)).toEqual(['401005']);
      expect(r.totaux.net).toBe(0);
    }
  });

  /**
   * Relecture « échecs silencieux » du paquet 1, mineur 5 · une facture et
   * son règlement non lettrés dans la MÊME tranche · ses tranches valent zéro
   * comme son solde, et le filtre retirait le tiers de l'état sans un mot.
   */
  it('deux pièces ouvertes qui se compensent dans la même tranche restent rendues avec les soldes nuls (mineur 5)', async () => {
    const r = await requete('CLIENTS_41', [
      ligneEcriture('411055', 500_000, 0, '2025-12-05', '2025-12-02'),
      ligneEcriture('411055', 0, 500_000, '2025-12-20', '2025-12-20'),
      ligneEcriture('411056', 300_000, 0, '2025-12-28', '2025-12-28'),
    ]);
    expect(r.soldesNuls.map((l) => l.numero)).toEqual(['411055']);
    expect(r.debiteurs.map((l) => l.numero)).toEqual(['411056']);
    expect(r.totaux.net).toBe(300_000);
  });

  it('une seule pièce, au net nul par son poids, ne fait pas de ligne', async () => {
    // Une ligne à zéro (débit et crédit nuls) n'est pas une pièce ouverte.
    const r = await requete('CLIENTS_41', [ligneEcriture('411057', 0, 0, '2025-12-05', '2025-12-05')]);
    expect(r.soldesNuls).toHaveLength(0);
    expect(r.debiteurs).toHaveLength(0);
  });

  it('un solde nul ne se ventile jamais, quel que soit le périmètre', () => {
    for (const sens of ['DEBITEUR', 'CREDITEUR', 'LES_DEUX', 'SELON_LE_COMPTE'] as const) {
      expect(ligneVentilee(sens, ['401001'], 0)).toBe(false);
      expect(ligneVentilee(sens, ['411001'], 0.004)).toBe(false);
    }
    expect(ligneVentilee('SELON_LE_COMPTE', ['401001'], -1)).toBe(true);
    expect(ligneVentilee('SELON_LE_COMPTE', ['411001'], -1)).toBe(false);
  });

  it('un tiers à la fois fournisseur et client se lit sur TOUS ses comptes, quel que soit l’ordre de lecture', async () => {
    const rattachements = [
      { compteId: 'c-401009', tiers: { id: 'T9', code: 'X9', nom: 'Mixte' } },
      { compteId: 'c-411009', tiers: { id: 'T9', code: 'X9', nom: 'Mixte' } },
    ];
    const lignes = [
      ligneEcriture('411009', 100, 0, '2025-12-10', '2025-12-10'),
      ligneEcriture('401009', 0, 600, '2025-11-10', '2025-11-10'),
    ];
    for (const ordre of [lignes, [...lignes].reverse()]) {
      const r = await service(ordre, rattachements).balanceAgee('t', { ...AU_31_12, type: 'TOUS' });
      // Solde créditeur de 500 · la ligne porte les deux sens, elle se ventile.
      expect(r.crediteurs.map((l) => [l.libelle, l.numero, l.solde])).toEqual([['X9 - Mixte', '401009', -500]]);
      expect(r.sensInverse).toHaveLength(0);
    }
  });

  it('le calcul des tranches est le même dans tous les périmètres · seule la source change', async () => {
    const lignes = [ligneEcriture('421001', 500, 0, '2024-06-30', '2025-01-05')];
    const r = await requete('PERSONNEL_42', lignes);
    // Une échéance antérieure à l'exercice tombe dans la tranche d'ouverture,
    // ici comme sur un compte client.
    expect(r.debiteurs).toHaveLength(1);
    expect(r.debiteurs[0].montants[0]).toBe(500);
  });
});
