import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ecouterEchap } from '../lib/echap';
import { useLogicielActif } from '../lib/logiciel-actif';
import { LOGICIELS } from '../lib/logiciels';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';

/**
 * LOGICIELS ATTRIBUÉS · l'administrateur coche les logiciels (tuiles) que
 * l'utilisateur voit après sa connexion. Décoché, tout est ouvert (les
 * utilisateurs existants ne changent pas). C'EST UN DROIT depuis la ligne
 * commercial-site (2026-11-01) · le serveur refuse, lectures comprises, ce
 * qu'aucun logiciel attribué n'ouvre (`src/common/logiciels/`), et
 * l'enregistrement ferme les sessions de l'intéressé, qui se reconnecte.
 *
 * LA LISTE PROPOSÉE EST CELLE DE TOUS LES LOGICIELS, et ceux que ce dossier ne
 * sert pas sont MARQUÉS (lus sur le menu de la session de l'administrateur,
 * `servisParLeDossier`) · cochés seuls, ils enfermeraient l'utilisateur
 * devant un écran sans tuile, et le serveur lui refuserait presque tout ·
 * d'où l'avertissement, qui le dit. Le serveur ne juge pas ce
 * point (il recopierait la règle du menu) ; le refus reste « au moins un ».
 * Une clé attribuée d'un logiciel retiré depuis est nommée, puis abandonnée
 * à l'enregistrement.
 */
export function ModaleLogiciels({
  utilisateurId,
  email,
  restreindre: restreindreInitial,
  logiciels: logicielsInitiaux,
  onFermer,
  onEnregistre,
}: {
  utilisateurId: string;
  email: string;
  restreindre: boolean;
  logiciels: string[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { estAdmin } = useAuth();
  const { servisParLeDossier } = useLogicielActif();
  const connus = new Set<string>(LOGICIELS.map((l) => l.cle));
  const retires = logicielsInitiaux.filter((c) => !connus.has(c));
  const [restreindre, setRestreindre] = useState(restreindreInitial);
  const [cochees, setCochees] = useState<Set<string>>(new Set(logicielsInitiaux.filter((c) => connus.has(c))));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const premierChamp = useRef<HTMLInputElement>(null);

  const estServi = (cle: string) => servisParLeDossier === null || servisParLeDossier.includes(cle);
  const aucuneCocheeServie = restreindre && cochees.size > 0 && [...cochees].every((c) => !estServi(c));

  // LA FERMETURE EST TENUE PENDANT L'ENVOI · fermer sous une requête en vol
  // laisserait croire à un abandon alors que l'attribution peut passer.
  const fermer = () => {
    if (!envoi) onFermer();
  };
  const fermerRef = useRef(fermer);
  fermerRef.current = fermer;
  useEffect(
    () =>
      ecouterEchap(() => {
        fermerRef.current();
        return true;
      }),
    [],
  );
  useEffect(() => premierChamp.current?.focus(), []);

  const enregistrer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await api.put(`/utilisateurs/${utilisateurId}/logiciels`, { restreindre, logiciels: restreindre ? [...cochees] : [] });
      onEnregistre();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={fermer}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-modale-logiciels"
          className="anim-modale w-[520px] max-w-full modale-bornee max-h-[calc(100dvh-2rem)] overflow-auto rounded-[4px] bg-surface border border-border-dark shadow-dominante text-[11.5px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3.5 h-[32px] border-b border-border">
            <span id="titre-modale-logiciels" className="font-bold">
              Logiciels · {email}
            </span>
            <div className="flex items-center gap-2">
              <Aide
                titre="Logiciels attribués"
                texte="Choisit les logiciels (tuiles) que l'utilisateur voit après sa connexion : comptabilité, tiers et trésorerie, paie, révision, administration. Sa barre de menus se limite à ce qu'il choisit. Le serveur refuse aussi ce qu'aucun logiciel coché n'ouvre, lectures comprises, sauf ce qu'un logiciel coché lit d'un autre (comptes, journaux, tiers pour la paie, par exemple) ; les droits du rôle et du profil de fonctions s'y ajoutent. Décoché, tous les logiciels que le dossier sert lui sont ouverts. Un logiciel que ce dossier ne sert pas (module non activé, fonction absente du référentiel) ne lui donnera aucune tuile. Un administrateur ou un gestionnaire de paie n'est jamais restreint. L'enregistrement ferme ses sessions : il se reconnecte pour lire son attribution."
                source="Règle d'OmegaX"
              />
              <button onClick={fermer} disabled={envoi} aria-label="Fermer">
                ✕
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">{erreur}</div>}
            <label className="flex items-center gap-1.5 font-semibold">
              <input ref={premierChamp} type="checkbox" checked={restreindre} onChange={(e) => setRestreindre(e.target.checked)} />
              Restreindre aux logiciels cochés
            </label>
            <div className={restreindre ? '' : 'opacity-50'}>
              {LOGICIELS.map((l) => (
                <label key={l.cle} className="flex items-center gap-1.5 py-[2px]">
                  <input
                    type="checkbox"
                    disabled={!restreindre}
                    checked={cochees.has(l.cle)}
                    onChange={() =>
                      setCochees((prev) => {
                        const n = new Set(prev);
                        if (n.has(l.cle)) n.delete(l.cle);
                        else n.add(l.cle);
                        return n;
                      })
                    }
                  />
                  {l.libelle}
                  {!estServi(l.cle) && <span className="text-text-dim">· non servi par ce dossier</span>}
                </label>
              ))}
            </div>
            {retires.length > 0 && (
              <div className="text-text-dim">Logiciels retirés, abandonnés à l'enregistrement : {retires.join(', ')}.</div>
            )}
            {aucuneCocheeServie && (
              <div role="alert" className="text-warning bg-warning-soft border border-warning/30 px-3 py-2">
                Aucun logiciel coché n'est servi par ce dossier · l'utilisateur n'aurait aucune tuile, et le serveur lui refuserait
                presque tout. Cochez un logiciel servi, ou décochez la restriction.
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={enregistrer}
                // Le serveur ne sait pas ce que le dossier sert · la modale
                // refuse donc elle-même d'enfermer l'utilisateur.
                disabled={!estAdmin || envoi || aucuneCocheeServie}
                className="bg-sel text-white font-semibold px-4 py-1.5 disabled:opacity-40"
              >
                {envoi ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
