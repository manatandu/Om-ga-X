import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBELLE_MOTIF, raisonGroupesLusLigneALigne, texteGroupesLusLigneALigne } from './groupes-lus-ligne-a-ligne';

/**
 * Paquet 1, B5 · un groupe de lettrage lu ligne à ligne se dit en une ligne,
 * sur chaque écran qui le lit. Rejoué sur vraie base (scénario paquet1-b,
 * B5) · `main` ne le consignait qu'au journal du serveur.
 */
describe('texteGroupesLusLigneALigne', () => {
  it('rien quand le serveur ne le sert pas, ni quand la lecture n’en a trouvé aucun', () => {
    expect(texteGroupesLusLigneALigne(undefined)).toBeNull();
    expect(texteGroupesLusLigneALigne(null)).toBeNull();
    expect(texteGroupesLusLigneALigne({ total: 0, groupes: [], tronque: false })).toBeNull();
  });

  it('un groupe, nommé par son code, son compte et son motif', () => {
    expect(
      texteGroupesLusLigneALigne({ total: 1, groupes: [{ code: 'aa', compte: '41110001', motif: 'DEVISE_REGLEE_EN_PARTIE' }], tronque: false }),
    ).toBe('1 groupe de lettrage à la répartition incertaine · aa (41110001, facture en devise réglée en partie)');
  });

  it('borné · le total dit ce que la liste ne nomme pas', () => {
    const t = texteGroupesLusLigneALigne({
      total: 23,
      groupes: [
        { code: 'aa', compte: '41110001', motif: 'NEGATIF_SANS_ORIGINE' },
        { code: 'ab', compte: '41110002', motif: 'RESTE_NON_REPARTI' },
      ],
      tronque: true,
    });
    expect(t).toMatch(/^23 groupes de lettrage à la répartition incertaine/);
    expect(t).toMatch(/aa \(41110001, négatif sans son origine\), ab \(41110002, reste non réparti\) et 21 autres$/);
  });
});

/**
 * Relecture « échecs silencieux » du paquet 1, mineur 7 · l'infobulle disait
 * « écart de change non passé » pour tout groupe, faux pour une facture en
 * devise réglée en PARTIE · l'écart réalisé ne se passe qu'au groupe soldé
 * (AUDCIF art. 55 ; ligne A6). La raison dit le motif de chaque groupe nommé.
 */
describe('raisonGroupesLusLigneALigne', () => {
  it('rien quand il n’y a rien à dire', () => {
    expect(raisonGroupesLusLigneALigne(undefined)).toBeNull();
    expect(raisonGroupesLusLigneALigne({ total: 0, groupes: [], tronque: false })).toBeNull();
  });

  it('une facture en devise réglée en partie · le reste au coût historique, l’écart au groupe soldé', () => {
    expect(
      raisonGroupesLusLigneALigne({ total: 1, groupes: [{ code: 'aa', compte: '41110001', motif: 'DEVISE_REGLEE_EN_PARTIE' }], tronque: false }),
    ).toBe(
      "Une facture en devise réglée en partie à un autre cours · son reste au coût historique ne rend pas le solde en francs, et l'écart réalisé ne se passe qu'au groupe soldé · le groupe est lu ligne à ligne. " +
        "Le total est exact ; la répartition par échéance de ces groupes n'est pas sûre.",
    );
  });

  it('une facture soldée dans sa devise · l’écart réalisé non passé', () => {
    expect(
      raisonGroupesLusLigneALigne({ total: 1, groupes: [{ code: 'ab', compte: '41110001', motif: 'DEVISE_SOLDEE_ECART_NON_PASSE' }], tronque: false }),
    ).toBe(
      "Des factures soldées dans leur devise et non en francs · l'écart de change réalisé n'est pas passé (AUDCIF art. 55) · le groupe est lu ligne à ligne. " +
        "Le total est exact ; la répartition par échéance de ces groupes n'est pas sûre.",
    );
  });

  it('la relance réclame le groupe pour son net · la raison le dit, jamais « lu ligne à ligne » (relecture, M2)', () => {
    expect(
      raisonGroupesLusLigneALigne(
        { total: 1, groupes: [{ code: 'aa', compte: '41110001', motif: 'DEVISE_REGLEE_EN_PARTIE' }], tronque: false },
        'relance',
      ),
    ).toBe(
      "Une facture en devise réglée en partie à un autre cours · son reste au coût historique ne rend pas le solde en francs, et l'écart réalisé ne se passe qu'au groupe soldé · le groupe se réclame pour son net, à l'échéance de sa facture encore ouverte la plus ancienne. " +
        "Le net de ces groupes est exact ; l'échéance qui leur est prêtée n'est pas sûre, et avec elle leur place parmi les sommes échues ou à venir.",
    );
  });

  it('un à-nouveau sans pièce d’origine · imputé à la date du report (relecture, M1)', () => {
    const g = { total: 1, groupes: [{ code: 'ad', compte: '41110002', motif: 'A_NOUVEAU_SANS_ORIGINE' as const }], tronque: false };
    expect(texteGroupesLusLigneALigne(g)).toBe('1 groupe de lettrage à la répartition incertaine · ad (41110002, à-nouveau sans pièce d’origine)');
    expect(raisonGroupesLusLigneALigne(g)).toBe(
      "Une ligne d'à-nouveau n'a pas retrouvé sa pièce d'origine dans l'exercice précédent · les lignes d'à-nouveau du groupe prennent la date du report · les échues d'abord, puis au prorata entre elles. " +
        "Le total est exact ; la répartition par échéance de ces groupes n'est pas sûre.",
    );
  });

  it('un motif par cas présent, une fois chacun, et la réserve des groupes non nommés', () => {
    const r = raisonGroupesLusLigneALigne({
      total: 30,
      groupes: [
        { code: 'aa', compte: '41110001', motif: 'NEGATIF_SANS_ORIGINE' },
        { code: 'ab', compte: '41110001', motif: 'NEGATIF_SANS_ORIGINE' },
        { code: 'ac', compte: '41110002', motif: 'IMPUTATION_DECLAREE_NON_LUE' },
      ],
      tronque: true,
    });
    expect(r).toBe(
      "Une inscription en négatif n'a pas sa ligne d'origine parmi les lignes lues · le groupe est lu ligne à ligne. " +
        'Une imputation déclarée dépasse ce que la facture doit, ou porte sur un groupe en devise · le groupe est lu ligne à ligne. ' +
        'Les groupes que la liste ne nomme pas peuvent porter un autre motif. ' +
        "Le total est exact ; la répartition par échéance de ces groupes n'est pas sûre.",
    );
  });
});

describe('les écrans qui lisent les restes le disent (paquet 1, B5)', () => {
  // Le câblage se teste avec la règle (F4a) · chaque écran rend le composant
  // avec ce que son état sert.
  const lire = (f: string) => readFileSync(join(__dirname, '..', 'pages', f), 'utf8');
  const ecrans: Array<[string, RegExp]> = [
    ['NotesAnnexesPage.tsx', /<GroupesLusLigneALigne groupes=\{resultat\?\.groupesLusLigneALigne\}/],
    ['NotesAnnexesSyscohadaPage.tsx', /<GroupesLusLigneALigne groupes=\{resultat\?\.groupesLusLigneALigne\}/],
    ['BalanceAgeePage.tsx', /<GroupesLusLigneALigne groupes=\{donnees\?\.groupesLusLigneALigne\}/],
    ['EcheancierPage.tsx', /<GroupesLusLigneALigne groupes=\{etat\.groupesLusLigneALigne\}/],
    ['RelancesPage.tsx', /<GroupesLusLigneALigne groupes=\{p\.groupesLusLigneALigne\} lecture="relance"/],
    ['EtatsSmtPage.tsx', /<GroupesLusLigneALigne groupes=\{notes\.note3\.groupesLusLigneALigne\}/],
    ['EtatsSmtSyscohadaPage.tsx', /<GroupesLusLigneALigne groupes=\{notes\.note3\.groupesLusLigneALigne\}/],
  ];
  for (const [f, motif] of ecrans) {
    it(f, () => expect(lire(f)).toMatch(motif));
  }
});

/**
 * LES MOTIFS EN MIROIR (second tour du paquet 1, ligne B, mineur 6) · le
 * serveur nomme chaque groupe par un motif (`MotifGroupeNomme`,
 * `reste-des-lignes-ouvertes.ts`) ; un motif ajouté là sans son libellé ici
 * s'afficherait sans texte, et l'infobulle tairait sa cause. Les deux unions
 * se relisent l'une contre l'autre, et chaque motif a son libellé.
 */
describe('motifs des groupes nommés · le client en miroir du serveur', () => {
  const membres = (source: string) => {
    const bloc = /export type MotifGroupeNomme =([\s\S]*?);/.exec(source)?.[1] ?? '';
    return [...bloc.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();
  };
  const serveur = membres(readFileSync(join(__dirname, '../../../src/modules/lettrage/reste-des-lignes-ouvertes.ts'), 'utf8'));
  const client = membres(readFileSync(join(__dirname, 'types.ts'), 'utf8'));

  it('les deux unions portent les mêmes motifs', () => {
    expect(serveur.length).toBeGreaterThan(0);
    expect(client).toEqual(serveur);
  });

  it('le classeur du serveur nomme chaque motif par le libellé de l’écran (LIBELLE_MOTIF_GROUPE)', () => {
    const source = readFileSync(join(__dirname, '../../../src/modules/lettrage/reste-des-lignes-ouvertes.ts'), 'utf8');
    const bloc = /export const LIBELLE_MOTIF_GROUPE[^=]*=\s*\{([\s\S]*?)\};/.exec(source)?.[1] ?? '';
    for (const [motif, libelle] of Object.entries(LIBELLE_MOTIF)) expect(bloc).toContain(`${motif}: '${libelle}'`);
  });

  it('chaque motif du serveur a son libellé et sa raison', () => {
    expect(Object.keys(LIBELLE_MOTIF).sort()).toEqual(serveur);
    for (const motif of serveur) {
      const raison = raisonGroupesLusLigneALigne({ total: 1, groupes: [{ code: 'A', compte: '411', motif: motif as never }] });
      // La cause du motif, puis sa conséquence · une raison vide le tairait.
      expect(raison?.split(' · ').length ?? 0).toBeGreaterThan(1);
    }
  });
});
