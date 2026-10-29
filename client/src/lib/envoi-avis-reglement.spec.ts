// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisEnAttente, phraseEnvoiAvis } from './envoi-avis-reglement';
import { libelleOrigine } from './courrier-file';

/** Ligne gl-saisie, fonction 35 · l'avis de règlement envoyé par la messagerie. */
describe('envoi des avis de règlement · l’écran', () => {
  const bilan = {
    misesEnFile: [
      { ligneId: 'l1', beneficiaire: 'SARL Amani', destinataire: 'a@x.cd', messageId: 'm1', statut: 'EN_ATTENTE' },
      { ligneId: 'l3', beneficiaire: 'Ets Cito', destinataire: 'c@x.cd', messageId: 'm2', statut: 'SANS_TRANSPORT' },
    ],
    dejaEnvoyes: [{ ligneId: 'l4', beneficiaire: 'Kin Bois' }],
    sansAdresse: [{ ligneId: 'l2', beneficiaire: 'SARL Bomoko' }],
    refuses: [],
  };

  it('dit chaque cas, jamais « envoyé » pour un avis seulement mis en file', () => {
    const phrase = phraseEnvoiAvis(bilan);
    expect(phrase).toBe('2 avis mis en file ; déjà en file ou envoyé · Kin Bois ; sans adresse sur la fiche du tiers · SARL Bomoko.');
    expect(avisEnAttente(bilan)).toBe(1);
    expect(phraseEnvoiAvis({ misesEnFile: [], dejaEnvoyes: [], sansAdresse: [], refuses: [] })).toBe('Aucun avis mis en file.');
  });

  it('la file nomme l’origine, et l’écran fait partir les avis par la reprise', () => {
    expect(libelleOrigine('AVIS_REGLEMENT')).toBe('Avis de règlement');
    const source = readFileSync(join(__dirname, '..', 'components', 'OrdresVirement.tsx'), 'utf8');
    expect(source).toContain('`/ordres-virement/${ordre.id}/avis-reglement/envoi`');
    expect(source).toContain("api.post<BilanRepriseCourrier>('/courrier/reprendre', {})");
  });
});
