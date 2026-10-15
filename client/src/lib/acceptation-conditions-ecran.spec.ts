import { dateEnLettres, ecartDeTexte, phraseAccuse, phraseEcartDeTexte } from './acceptation-conditions-ecran';

// Aucun import de « vitest » · convention du dépôt.

/**
 * L'ÉCRAN DE L'ACCEPTATION (ligne pages-legales, second tour de relecture).
 * Ce qui casserait en silence · une page plus récente que le service qui
 * ferait recharger sans fin, un accusé en échec offert au renvoi (doublon), une
 * consigne d'administrateur adressée à un comptable qui ne peut pas la suivre.
 */

const E = 'a'.repeat(64);

describe('le texte de la page face à celui du service (second tour, m-2 et mineur 3)', () => {
  it('trois écarts, trois issues', () => {
    expect(ecartDeTexte({ numero: 2, empreinte: E }, { numero: 2, empreinte: E })).toBe('A_JOUR');
    expect(ecartDeTexte({ numero: 3, empreinte: E }, { numero: 2, empreinte: E })).toBe('PAGE_ANCIENNE');
    expect(ecartDeTexte({ numero: 2, empreinte: E }, { numero: 3, empreinte: E })).toBe('SERVICE_EN_RETARD');
    expect(ecartDeTexte({ numero: 2, empreinte: E }, { numero: 2, empreinte: 'b'.repeat(64) })).toBe('TEXTE_DIFFERENT');
  });

  it('une page plus récente que le service attend le service, elle ne fait pas recharger', () => {
    const p = phraseEcartDeTexte('SERVICE_EN_RETARD', 2, 3, true);
    expect(p).toContain('le service n’est pas encore à jour, réessayez dans quelques minutes');
    expect(p).not.toContain('rechargez');
  });

  it('la consigne s’adresse à celui qui lit · l’administrateur accepte, les autres lisent (mineur 6)', () => {
    expect(phraseEcartDeTexte('PAGE_ANCIENNE', 3, 2, true)).toContain('rechargez la page avant d’accepter');
    expect(phraseEcartDeTexte('PAGE_ANCIENNE', 3, 2, false)).toContain('rechargez la page pour lire la version en vigueur');
    expect(phraseEcartDeTexte('PAGE_ANCIENNE', 3, 2, false)).not.toContain('accepter');
    expect(phraseEcartDeTexte('TEXTE_DIFFERENT', 2, 2, true)).toContain('diffère de celui que le service tient pour la même version 2');
  });
});

describe('ce que devient l’accusé (second tour, M-b et mineur 6)', () => {
  it('en échec, la file le retente · aucun renvoi n’est offert', () => {
    const p = phraseAccuse('ECHEC', true);
    expect(p).toContain('la file le retente d’elle-même');
    expect(p).not.toContain('renvoy');
  });

  it('abandonné ou jamais mis en file, il se renvoie · par l’administrateur, et c’est dit aux autres', () => {
    expect(phraseAccuse('ABANDONNE', true)).toContain('il peut être renvoyé');
    expect(phraseAccuse('ABANDONNE', false)).toContain('l’administrateur du dossier peut le renvoyer');
    expect(phraseAccuse('NON_MIS_EN_FILE', true)).toContain('l’accusé peut être renvoyé');
    expect(phraseAccuse('NON_MIS_EN_FILE', false)).toContain('l’administrateur du dossier peut renvoyer l’accusé');
    expect(phraseAccuse(null, false)).toContain('l’administrateur du dossier peut renvoyer l’accusé');
  });

  it('en attente, il part à la prochaine reprise de la file ; sans messagerie, il ne part pas', () => {
    expect(phraseAccuse('EN_ATTENTE', true)).toContain('il part à la prochaine reprise de la file');
    expect(phraseAccuse('SANS_TRANSPORT', true)).toContain('il ne partira qu’une fois une messagerie configurée');
    expect(phraseAccuse('ENVOYE', true)).toContain('est parti');
  });
});

describe('les dates de l’abonnement s’écrivent en toutes lettres (mineur 5)', () => {
  it('au jour dit, sans décalage de fuseau', () => {
    expect(dateEnLettres('2026-10-01')).toBe('1er octobre 2026');
    expect(dateEnLettres('2026-10-31')).toBe('31 octobre 2026');
    expect(dateEnLettres('2027-01-15')).toBe('15 janvier 2027');
  });
});
