import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { messageOuDefaut, statutDe } from '../lib/message-refus';
import { corpsEssai, essaiOuvert, TYPES_ENTITE_ESSAI, type EtatEssai, type TypeEntiteEssai } from '../lib/essai';
import { LogotypeOmegaX, SymboleOmegaX } from '../components/chrome/Logo';

/**
 * /essai · ouvrir un dossier d'essai soi-même, sans mot de passe à inventer.
 *
 * Le mot de passe est tiré au sort par le SERVEUR et part au seul courriel
 * saisi · l'écran ne le voit jamais. La réponse est la même pour une adresse
 * neuve et pour une adresse connue (le serveur ne dit pas qui a un compte), et
 * l'écran ne la commente pas davantage. Le verrou reste au serveur · si la
 * porte est fermée, il refuse en 403 et la page le dit, elle ne se montre pas
 * ouverte sur la foi d'un lien.
 */
export function EssaiPage() {
  const [etat, setEtat] = useState<EtatEssai | 'fermee' | 'indisponible' | null>(null);
  const enCours = useRef(false);
  const confirmation = useRef<HTMLParagraphElement>(null);
  const [type, setType] = useState<TypeEntiteEssai | ''>('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [lecture, setLecture] = useState(0);
  useEffect(() => {
    let vivant = true;
    setEtat(null);
    api
      .get<unknown>('/auth/inscription-essai/etat')
      .then((e) => vivant && setEtat(essaiOuvert(e) ? e : 'fermee'))
      // Une lecture qui échoue n'est PAS une porte fermée · elle se dit et se relit.
      .catch(() => vivant && setEtat('indisponible'));
    return () => {
      vivant = false;
    };
  }, [lecture]);

  useEffect(() => {
    if (message !== null) confirmation.current?.focus();
  }, [message]);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (type === '' || enCours.current) return;
    if (nom.trim().length < 2) {
      setErreur("Le nom de l'entité compte au moins 2 caractères.");
      return;
    }
    enCours.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ message?: string }>('/auth/inscription-essai', corpsEssai(type, nom, email));
      setMessage(typeof r?.message === 'string' && r.message.trim() !== '' ? r.message : 'Demande reçue. Consultez votre boîte de réception.');
    } catch (err) {
      setErreur(
        statutDe(err) === 429
          ? 'Trop de demandes depuis cette connexion. Réessayez dans une heure, ou écrivez à admin@vmgconsulting.net.'
          : messageOuDefaut(err, "La demande n'a pas pu être envoyée. Réessayez dans un instant."),
      );
    } finally {
      enCours.current = false;
      setEnvoi(false);
    }
  };

  const champ = 'w-full border border-border bg-surface px-2 py-1.5 text-[12px] rounded-[4px]';

  return (
    <div className="porte-fond min-h-screen flex items-center justify-center px-4 py-8 font-marque">
      <div className="w-full max-w-[460px] bg-surface border border-border rounded-[8px] overflow-hidden shadow-dominante anim-modale">
        <div className="h-[32px] flex items-center gap-2 px-3 text-text text-[11.5px] border-b border-border">
          <SymboleOmegaX taille={14} className="text-[var(--a-900)]" />
          <span>Essai gratuit</span>
        </div>
        <div className="p-5">
          <LogotypeOmegaX hauteur={20} className="text-[var(--a-900)] mb-4" />
          {etat === null && <p role="status" className="text-[12px] text-text-dim">Chargement…</p>}
          {etat === 'fermee' && (
            <p role="status" className="text-[12px]">
              L'essai en libre-service n'est pas ouvert. Écrivez à admin@vmgconsulting.net pour démarrer.
            </p>
          )}
          {etat === 'indisponible' && (
            <div role="alert" className="text-[12px]">
              <p>L'état de l'essai n'a pas pu être lu. Vérifiez votre connexion.</p>
              <button type="button" onClick={() => setLecture((n) => n + 1)} className="mt-2 underline">
                Relire
              </button>
            </div>
          )}
          {etat !== null && etat !== 'fermee' && etat !== 'indisponible' && message === null && (
            <form onSubmit={envoyer} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-text-dim">Votre entité</span>
                <select required value={type} onChange={(e) => setType(e.target.value as TypeEntiteEssai | '')} className={champ}>
                  <option value="">Choisir…</option>
                  {TYPES_ENTITE_ESSAI.map((t) => (
                    <option key={t.valeur} value={t.valeur}>
                      {t.libelle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-text-dim">Nom de l'entité</span>
                <input required minLength={2} maxLength={120} autoComplete="organization" value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-text-dim">Adresse e-mail</span>
                <input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={champ} />
              </label>
              {erreur && (
                <p role="alert" className="text-[11.5px] text-danger">
                  {erreur}
                </p>
              )}
              {/* Code du numérique, art. 220 · l'information est due « au plus
                  tard, lors de la collecte ». Nouvel onglet, pour ne pas perdre
                  le formulaire. */}
              <p className="text-[11px] text-text-dim leading-relaxed">
                Ces données servent à ouvrir votre dossier d’essai et à vous envoyer l’accès, rien d’autre.{' '}
                <a href="#/confidentialite" target="_blank" rel="noopener" className="underline">
                  Politique de confidentialité
                </a>
                {' · '}
                <a href="#/contrat-de-licence" target="_blank" rel="noopener" className="underline">
                  Contrat de licence
                </a>
              </p>
              <button type="submit" disabled={envoi || type === ''} aria-busy={envoi} className="bg-sel text-white rounded-full px-4 py-2 text-[12px] font-semibold disabled:opacity-60">
                {envoi ? 'Un instant…' : `Commencer l'essai de ${etat.joursEssai} jours`}
              </button>
            </form>
          )}
          {message !== null && (
            <p ref={confirmation} tabIndex={-1} role="status" className="text-[12px] outline-none">
              {message}
            </p>
          )}
          <a href="#/connexion" className="mt-4 inline-block text-[11.5px] underline">
            Retour à l'ouverture
          </a>
        </div>
      </div>
    </div>
  );
}
