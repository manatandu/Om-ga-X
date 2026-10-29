// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMMANDES_PROPOSEES, commandesDuMenu, normaliser, rechercherCommandes } from './commandes-du-menu';
import type { MenuDef } from './menu-groupes';

/** Ligne gl-saisie, fonction 97 · aller à une fonction par son nom (F7). */
describe('aller à une fonction par son nom', () => {
  const ouvertes: string[] = [];
  const cmd = (label: string, extra: object = {}) => ({ label, onClick: () => ouvertes.push(label), ...extra });
  const menus: MenuDef[] = [
    { titre: 'Fichier', items: [cmd('Mon compte…'), cmd('Imprimer la fenêtre…', { disabled: true })] },
    {
      titre: 'Traitement',
      items: [
        cmd('Saisie des journaux'),
        { titre: 'Tiers et trésorerie', items: [cmd('Interrogation et lettrage'), cmd('Rapprochement bancaire'), cmd('Rappel et relevé')] },
      ],
    },
    { titre: 'État', items: [{ titre: 'Livres comptables', items: [cmd('Balance des comptes'), cmd('Grand livre des comptes')] }, cmd('Balance âgée')] },
    { titre: 'Fenêtre', items: [cmd('Réorganiser (cascade)')] },
  ];
  const commandes = commandesDuMenu(menus);

  it('la liste est celle du menu, groupes compris, sans le menu Fenêtre ni les commandes éteintes', () => {
    expect(commandes.map((c) => `${c.chemin} | ${c.libelle}`)).toEqual([
      'Fichier | Mon compte',
      'Traitement | Saisie des journaux',
      'Traitement › Tiers et trésorerie | Interrogation et lettrage',
      'Traitement › Tiers et trésorerie | Rapprochement bancaire',
      'Traitement › Tiers et trésorerie | Rappel et relevé',
      'État › Livres comptables | Balance des comptes',
      'État › Livres comptables | Grand livre des comptes',
      'État | Balance âgée',
    ]);
  });

  it('se trouve sans accents, mot par mot, le début du libellé d’abord', () => {
    expect(normaliser('  État  des Comptes ')).toBe('etat des comptes');
    expect(rechercherCommandes(commandes, 'balance').map((c) => c.libelle)).toEqual(['Balance des comptes', 'Balance âgée']);
    expect(rechercherCommandes(commandes, 'agee').map((c) => c.libelle)).toEqual(['Balance âgée']);
    expect(rechercherCommandes(commandes, 'tresorerie rappel').map((c) => c.libelle)).toEqual(['Rappel et relevé']);
    expect(rechercherCommandes(commandes, 'lettrage').map((c) => c.libelle)).toEqual(['Interrogation et lettrage']);
    expect(rechercherCommandes(commandes, 'zzz')).toEqual([]);
    expect(rechercherCommandes(commandes, '   ')).toEqual([]);
  });

  it('ouvre par le même geste que le menu', () => {
    rechercherCommandes(commandes, 'rapprochement')[0].executer();
    expect(ouvertes).toEqual(['Rapprochement bancaire']);
  });

  it('borne la liste proposée', () => {
    const beaucoup: MenuDef[] = [{ titre: 'État', items: Array.from({ length: 40 }, (_, i) => cmd(`Balance ${i}`)) }];
    expect(rechercherCommandes(commandesDuMenu(beaucoup), 'balance')).toHaveLength(COMMANDES_PROPOSEES);
  });

  it('l’espace de travail l’ouvre par F7 et par le menu Fenêtre, sur le menu affiché', () => {
    const source = readFileSync(join(__dirname, 'AppShell.tsx'), 'utf8');
    expect(source).toContain("if (e.key !== 'F7' || e.ctrlKey || e.metaKey || e.altKey) return;");
    expect(source).toContain("label: 'Aller à une fonction… (F7)'");
    expect(source).toContain('<AllerAFonction commandes={commandesDuMenu(menus)}');
  });
});
