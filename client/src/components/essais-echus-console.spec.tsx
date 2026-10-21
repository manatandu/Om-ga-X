import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { EssaisEchusConsole } from './EssaisEchusConsole';

// Le client d'API lit le stockage local au chargement et la bulle d'aide lit la
// session · ni l'un ni l'autre n'existe dans un rendu statique, et ni l'un ni
// l'autre n'est ce qui s'éprouve ici.
vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {},
}));
vi.mock('./chrome/Aide', () => ({ Aide: () => null }));

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * LA CONSOLE DES ESSAIS ÉCHUS · ce qui casserait en silence : « aucun dossier »
 * affiché sur une liste pas encore lue, un bouton de suppression proposé sur un
 * dossier qui ne l'est pas, une suppression sans l'identifiant retapé, une
 * donnée du client à l'écran.
 */
const source = readFileSync(join(__dirname, 'EssaisEchusConsole.tsx'), 'utf8');

describe('avant toute lecture, la liste est NULLE · « aucun dossier » ne se dit pas', () => {
  it('rend « Chargement… » et jamais « Aucun dossier d’essai échu »', () => {
    const html = renderToStaticMarkup(<EssaisEchusConsole />);
    expect(html).toContain('Chargement…');
    expect(html).not.toContain('Aucun dossier d’essai échu');
    // Le bouton des rappels est fermé tant que rien n'a été lu.
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Envoyer les rappels/);
  });
});

describe('la structure de la console', () => {
  it('« aucun dossier » ne se dit que sur une liste LUE (essais.length === 0 après lecture)', () => {
    expect(source).toContain('liste?.essais.length === 0 &&');
    expect(source).toContain('liste === null && !erreur &&');
  });

  it('un échec de lecture se dit et vide la liste, il ne laisse pas l’ancienne passer pour la nouvelle', () => {
    expect(source).toMatch(/catch \(err\) \{[\s\S]*?setListe\(null\);[\s\S]*?setErreur\(/);
  });

  it('le bouton de suppression n’est proposé que sur un dossier lu SUPPRIMABLE', () => {
    expect(source).toContain("e.etat === 'SUPPRIMABLE' && (");
    expect(source).toContain('Supprimer');
  });

  it('la suppression exige l’identifiant retapé, côté écran comme côté serveur', () => {
    expect(source).toContain('confirmation.trim() !== cible.tenantId');
    expect(source).toContain('{ confirmation: confirmation.trim() }');
    expect(source).toContain('`/plateforme/essais-echus/${cible.tenantId}/supprimer`');
  });

  it('les rappels partent par la route du serveur, et le compte rendu nomme chaque issue', () => {
    expect(source).toContain("'/plateforme/essais-echus/rappels'");
    expect(source).toContain('libelleIssueRappel(r.issue)');
    expect(source).toContain("r.issue === 'ECHEC'");
    // Les rappels dus au-delà de la borne d'un appel se disent, jamais « aucun rappel » seul.
    expect(source).toContain('bilan.restants > 0 &&');
    // « Recommencez pour la suite » était faux · le serveur lit tous les dossiers.
    expect(source).not.toContain('recommencez pour la suite');
  });

  it('le bouton des rappels se règle sur le compte du SERVEUR (tous les dossiers), jamais sur la tranche affichée', () => {
    expect(source).toContain('const aRappeler = liste?.aRappeler ?? 0;');
    expect(source).toContain('aRappeler === 0}');
    expect(source).not.toMatch(/essais\.filter\(\(e\) => e\.etat === 'RAPPEL_A_ENVOYER'\)/);
  });

  it('la boîte passe par PortailModale, se ferme à Échap, et se tient pendant l’envoi', () => {
    expect(source).toContain('<PortailModale>');
    expect(source).toContain('ecouterEchap(');
    expect(source).toContain('if (suppressionEnCours) return true;');
    expect(source).toContain('modale-bornee');
  });

  it('l’écran ne manipule aucune donnée du client · ni nom, ni adresse, ni montant', () => {
    expect(source).not.toMatch(/\b(e|cible|fait|liste|r)\??\.(nomEntite|nom|email|courriel|adresse|montant|libelle)\b/);
  });

  it('l’explication va dans la bulle d’aide, pas dans un paragraphe de l’écran', () => {
    expect(source).toContain('<Aide');
    expect(source).toContain('Fichier > Restituer le dossier complet');
  });
});
