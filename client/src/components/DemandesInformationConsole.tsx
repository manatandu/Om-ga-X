import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Aide } from './chrome/Aide';

interface Etat {
  nonEnvoyees: number;
  abandonnees: number;
}

interface Bilan {
  transportConfigure: boolean;
  envoyes: number;
  echoues: number;
  abandonnes: number;
  restants: number;
}

/**
 * LES DEMANDES D'INFORMATION NON PARTIES, dans la console de l'éditeur (ligne
 * commercial-site). Aucun ordonnanceur ne reprend la file des courriers · une
 * demande de la page publique restée en échec n'arriverait jamais sans que
 * personne le sache. Ici, des nombres seuls, et le geste qui la reprend.
 * L'état part de `null` · « aucune » ne se dit que sur une lecture réussie.
 */
export function DemandesInformationConsole() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const jeton = useRef(0);

  const charger = async () => {
    const mien = ++jeton.current;
    try {
      const r = await api.get<Etat>('/plateforme/demandes-information');
      if (mien !== jeton.current) return;
      setEtat(r);
      setErreur(null);
    } catch (err) {
      if (mien !== jeton.current) return;
      setEtat(null);
      setErreur(err instanceof ApiError ? err.message : 'Impossible de lire les demandes d’information.');
    }
  };

  useEffect(() => {
    void charger();
  }, []);

  const reprendre = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      setBilan(await api.post<Bilan>('/plateforme/demandes-information/reprendre'));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'La reprise n’a pas pu être lancée.');
    } finally {
      setEnCours(false);
      void charger();
    }
  };

  return (
    <section className="mt-4">
      <h3 className="text-[12px] font-bold mb-1.5 flex items-center gap-1">
        Demandes d’information
        <Aide
          titre="Demandes d’information"
          texte="Les demandes envoyées par le formulaire de la page publique partent par courriel aux opérateurs. Celles qui ne sont pas parties (en file, en échec, ou écrites sans messagerie) sont comptées ici et se reprennent par le bouton. Les abandonnées se lisent dans Fichier > Courrier sortant."
          source="OmegaX"
        />
      </h3>
      {erreur && <p className="text-[11.5px] text-danger mb-1">{erreur}</p>}
      {etat === null && !erreur && <p className="text-[11.5px]">Chargement…</p>}
      {etat && (
        <div className="flex items-center gap-3 text-[11.5px]">
          <span>
            {etat.nonEnvoyees === 0 ? 'Aucune demande en attente d’envoi' : `${etat.nonEnvoyees} demande(s) non envoyée(s)`}
            {etat.abandonnees > 0 ? ` · ${etat.abandonnees} abandonnée(s)` : ''}
          </span>
          {etat.nonEnvoyees > 0 && (
            <button type="button" className="bg-sel text-white rounded-full px-3 py-1" disabled={enCours} onClick={() => void reprendre()}>
              {enCours ? 'Reprise…' : 'Relancer l’envoi'}
            </button>
          )}
        </div>
      )}
      {bilan && (
        <p className="text-[11.5px] mt-1">
          {bilan.transportConfigure
            ? `Envoyées ${bilan.envoyes} · en échec ${bilan.echoues} · abandonnées ${bilan.abandonnes} · restantes ${bilan.restants}`
            : 'Aucune messagerie n’est configurée · rien n’a été tenté.'}
        </p>
      )}
    </section>
  );
}
