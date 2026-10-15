import { issueIncertaine, messageDuRefus, messageOuDefaut } from './message-refus';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

class ErreurApi extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

describe('le message d’un refus n’est jamais vide (sage-l7, relecture M1)', () => {
  it('un 504 du relais en HTTP/2, sans phrase d’état ni corps JSON, se dit par son code', () => {
    expect(messageDuRefus(504, '', null)).toBe('Réponse 504 du serveur');
    expect(messageDuRefus(504, 'Gateway Timeout', null)).toBe('Gateway Timeout');
  });

  it('le message du corps prime, une liste se joint, un message vide se rabat', () => {
    expect(messageDuRefus(400, 'Bad Request', { message: 'Exercice introuvable.' })).toBe('Exercice introuvable.');
    expect(messageDuRefus(400, 'Bad Request', { message: ['a', 'b'] })).toBe('a, b');
    expect(messageDuRefus(409, '', { message: '' })).toBe('Réponse 409 du serveur');
  });

  it('l’écran se rabat sur sa phrase quand le refus n’a pas de message, ou quand ce n’est pas un refus', () => {
    expect(messageOuDefaut(new ErreurApi(504, ''), "L'export n'a pas abouti.")).toBe("L'export n'a pas abouti.");
    expect(messageOuDefaut(new ErreurApi(400, 'Refus nommé.'), 'défaut')).toBe('Refus nommé.');
    expect(messageOuDefaut(new TypeError('Failed to fetch'), 'défaut')).toBe('défaut');
  });

  it('une panne du réseau ou un 5xx laisse l’issue incertaine ; un 4xx est un refus', () => {
    expect(issueIncertaine(new TypeError('Failed to fetch'))).toBe(true);
    expect(issueIncertaine(new ErreurApi(504, ''))).toBe(true);
    expect(issueIncertaine(new ErreurApi(500, 'x'))).toBe(true);
    expect(issueIncertaine(new ErreurApi(409, 'Un autre export…'))).toBe(false);
  });
});
