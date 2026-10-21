import { causeDeLException, causeEchecEnvoi, LIBELLES_CAUSE_ECHEC } from './cause-echec-envoi';

/**
 * LA CAUSE D'UN ÉCHEC D'ENVOI · une catégorie, jamais le texte (CLAUDE.md § 8).
 * Ce qui casserait en silence · une catégorie qui recopierait un morceau de
 * l'erreur, ou une erreur rangée « autre » alors qu'elle dit le destinataire.
 */
describe('causeEchecEnvoi', () => {
  it.each([
    ['550 5.1.1 <jean@client.cd>: Recipient address rejected: User unknown', 'REFUS_DESTINATAIRE'],
    ['Adresse de destinataire inutilisable · « jean@client.cd ». Le message n’a pas été mis en file.', 'REFUS_DESTINATAIRE'],
    ['553 mailbox name not allowed', 'REFUS_DESTINATAIRE'],
    ['535 5.7.8 Username and Password not accepted', 'AUTHENTIFICATION'],
    ['Error · Invalid login: 535 Authentication failed', 'AUTHENTIFICATION'],
    ['Error · connect ECONNREFUSED 10.0.0.5:587', 'RESEAU'],
    ['Error · Connection timeout', 'RESEAU'],
    ['getaddrinfo ENOTFOUND smtp.exemple.cd', 'RESEAU'],
    ['Erreur inattendue du transport', 'AUTRE'],
  ])('%s → %s', (texte, cause) => {
    expect(causeEchecEnvoi(texte)).toBe(cause);
  });

  it('aucune erreur, aucune cause (jamais « autre » pour un silence)', () => {
    expect(causeEchecEnvoi(null)).toBeNull();
    expect(causeEchecEnvoi(undefined)).toBeNull();
    expect(causeEchecEnvoi('  ')).toBeNull();
  });

  it('les libellés sont écrits par OmegaX · aucun ne porte d’adresse ni de texte variable', () => {
    for (const libelle of Object.values(LIBELLES_CAUSE_ECHEC)) expect(libelle).not.toMatch(/@|\{|\$/);
  });

  it('une exception se lit sur son nom, son message et son code, et rend sa seule catégorie', () => {
    expect(causeDeLException(Object.assign(new Error('boom'), { code: 'ETIMEDOUT' }))).toBe('RESEAU');
    expect(causeDeLException(new Error('550 5.1.1 <a@b.cd> rejected'))).toBe('REFUS_DESTINATAIRE');
    expect(causeDeLException('quelque chose')).toBe('AUTRE');
  });
});
