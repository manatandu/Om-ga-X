import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { texteGroupesLusLigneALigne } from './groupes-lus-ligne-a-ligne';

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

  it('un groupe, nommé par son code et son compte', () => {
    expect(texteGroupesLusLigneALigne({ total: 1, groupes: [{ code: 'aa', compte: '41110001' }], tronque: false })).toBe(
      '1 groupe de lettrage lu ligne à ligne · leur reste ne se répartit pas sûrement entre leurs factures · aa (41110001)',
    );
  });

  it('borné · le total dit ce que la liste ne nomme pas', () => {
    const t = texteGroupesLusLigneALigne({
      total: 23,
      groupes: [
        { code: 'aa', compte: '41110001' },
        { code: 'ab', compte: '41110002' },
      ],
      tronque: true,
    });
    expect(t).toMatch(/^23 groupes de lettrage lus ligne à ligne/);
    expect(t).toMatch(/aa \(41110001\), ab \(41110002\) et 21 autres$/);
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
    ['RelancesPage.tsx', /<GroupesLusLigneALigne groupes=\{p\.groupesLusLigneALigne\}/],
    ['EtatsSmtPage.tsx', /<GroupesLusLigneALigne groupes=\{notes\.note3\.groupesLusLigneALigne\}/],
    ['EtatsSmtSyscohadaPage.tsx', /<GroupesLusLigneALigne groupes=\{notes\.note3\.groupesLusLigneALigne\}/],
  ];
  for (const [f, motif] of ecrans) {
    it(f, () => expect(lire(f)).toMatch(motif));
  }
});
