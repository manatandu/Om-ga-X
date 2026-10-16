/**
 * LE MESSAGE D'UN REFUS, JAMAIS VIDE (relecture « échecs silencieux » de la
 * ligne sage-l7, M1). En HTTP/2 une réponse n'a pas de phrase d'état ·
 * `statusText` vaut la chaîne vide, et un 504 du relais sans corps JSON
 * donnait un message vide, donc AUCUNE erreur affichée, alors que le serveur
 * avait pu ranger l'export demandé. Le message se rabat sur le code de la
 * réponse, et l'écran sur sa phrase par défaut.
 *
 * Module sans `import.meta` (lu par le jest de la racine comme par vitest) ·
 * l'erreur se reconnaît à son statut numérique, sans importer `api.ts`.
 */

/** Le message d'une réponse refusée · celui du corps s'il en porte un, sinon la phrase d'état, sinon le code. */
export function messageDuRefus(status: number, statusText: string, corps: unknown): string {
  const lu = (corps as { message?: unknown } | null | undefined)?.message;
  const duCorps = Array.isArray(lu) ? lu.filter((m) => typeof m === 'string').join(', ') : typeof lu === 'string' ? lu : '';
  if (duCorps.trim() !== '') return duCorps;
  if (statusText.trim() !== '') return statusText;
  return `Réponse ${status} du serveur`;
}

/** Le statut HTTP d'un refus du serveur, ou rien (panne du réseau, autre erreur). */
export function statutDe(e: unknown): number | null {
  return e instanceof Error && typeof (e as { status?: unknown }).status === 'number' ? (e as unknown as { status: number }).status : null;
}

/** Le message d'un refus du serveur, ou la phrase de l'écran · jamais une chaîne vide. */
export function messageOuDefaut(e: unknown, defaut: string): string {
  return statutDe(e) !== null && e instanceof Error && e.message.trim() !== '' ? e.message : defaut;
}

/**
 * L'ISSUE D'UN GESTE EST-ELLE INCERTAINE ? Une panne du réseau (aucune
 * réponse) ou une réponse 5xx (relais, délai) ne dit pas si le serveur a fait
 * ce qui était demandé · l'écran relit alors ce qui a pu changer, au lieu de
 * conclure à l'échec. Un 4xx est un refus · rien n'a été fait.
 */
export function issueIncertaine(e: unknown): boolean {
  const s = statutDe(e);
  return s === null || s >= 500;
}
