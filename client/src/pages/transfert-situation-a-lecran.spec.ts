import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LE BROUILLARD RESTÉ DANS UN JOURNAL DE SITUATION A SON GESTE À L'ÉCRAN
 * (ligne sage-l1, second tour de relecture, BLOQUANT).
 *
 * Le serveur refuse de le valider sur place et propose son transfert dans un
 * journal ordinaire. Sans bouton, le contrôle et le refus de clôture
 * nommeraient un geste introuvable · le dossier resterait enfermé. Sans le
 * compteur, la validation par période passerait pour complète alors qu'elle
 * en a écarté.
 */

const brouillard = readFileSync(join(__dirname, 'BrouillardPage.tsx'), 'utf8');

/** Le corps d'une fonction fléchée déclarée `const nom = …`, découpé par sa structure. */
function corps(nom: string): string {
  const debut = brouillard.indexOf(`const ${nom} = `);
  expect(debut).toBeGreaterThan(-1);
  return brouillard.slice(debut, brouillard.indexOf('\n  };\n', debut));
}

describe('le transfert d’un brouillard hérité', () => {
  it('le bouton n’est offert qu’au brouillard d’un journal de situation, à qui peut écrire', () => {
    expect(brouillard).toContain('{peutEcrire && l.journalDeSituation && (');
    expect(brouillard).toContain('onClick={() => ouvrirTransfert(l)}');
  });

  it('la pièce héritée ne se coche pas pour la validation', () => {
    expect(brouillard).toContain('{peutValider && l.equilibree && !l.journalDeSituation && (');
    expect(brouillard).toContain('.filter((l) => l.equilibree && !l.journalDeSituation)');
  });

  it('le transfert vise la route du serveur, journal d’arrivée et report demandé', () => {
    const t = corps('transferer');
    expect(t).toContain('`/ecritures/${transfert.ligne.id}/transfert`');
    expect(t).toContain('journalId: transfert.journalId');
    expect(t).toContain('reporterAuPremierJourOuvert: true');
    // Un refus se dit dans la modale, jamais avalé.
    expect(t).toContain('setErreurTransfert(');
  });

  it('les journaux d’arrivée sont ordinaires et actifs, un choix unique présélectionné', () => {
    expect(brouillard).toContain("journaux.filter((j) => j.type !== 'SITUATION' && j.estActif)");
    expect(corps('ouvrirTransfert')).toContain('journauxDArrivee.length === 1 ? journauxDArrivee[0].id');
  });

  it('la validation par période dit ce qu’elle a écarté, même sans rien valider', () => {
    const p = corps('phraseValidation');
    expect(p).toContain('r.ecarteesJournalDeSituation');
    expect(p).toContain('r.motifEcarteesJournalDeSituation');
    // Le cas vide ne masque pas le compteur.
    expect(p).toContain('siRienAFaire && !situation');
  });
});
