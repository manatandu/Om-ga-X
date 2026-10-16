import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { messageOuDefaut } from '../lib/message-refus';
import { useAuth } from '../lib/auth';
import { ecouterEchap } from '../lib/echap';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';
import {
  COLONNES_EDITION,
  GROUPE_EDITION,
  LIBELLES_SAUT,
  type EditionModele,
  type ListeModeles,
  type ModeleServi,
  type SautEdition,
  avecLeModele,
} from '../lib/modeles-edition';

/**
 * LE MODÈLE D'UNE ÉDITION DE TRAVAIL (ligne sage-l7, fonction 59 ; décision
 * L7-1) · « Standard » (toutes les colonnes, aucun saut) ou un modèle du
 * DOSSIER, personnalisé · colonnes facultatives gardées et saut entre les
 * groupes. Choisir un modèle est une lecture ; l'enregistrer, le remplacer ou
 * le supprimer suit `peutEcrire`, comme le serveur. Les colonnes qui
 * identifient la ligne ne se décochent pas.
 */
export function ChoixModeleEdition({
  edition,
  onChange,
}: {
  edition: EditionModele;
  onChange: (modele: ModeleServi | null) => void;
}) {
  const { peutEcrire } = useAuth();
  const [liste, setListe] = useState<ListeModeles | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [choisi, setChoisi] = useState('');
  const [ouverte, setOuverte] = useState(false);

  const recharger = useCallback(async () => {
    try {
      const l = await api.get<ListeModeles>(`/modeles-edition?edition=${edition}`);
      setListe(l);
      setErreurLecture(null);
      return l;
    } catch (e) {
      setErreurLecture(messageOuDefaut(e, "Les modèles d'édition n'ont pas pu être lus."));
      return null;
    }
  }, [edition]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  function choisir(id: string, l: ListeModeles | null = liste) {
    setChoisi(id);
    onChange(l?.modeles.find((m) => m.id === id) ?? null);
  }

  const modeleChoisi = liste?.modeles.find((m) => m.id === choisi) ?? null;

  return (
    <div className="ecran-seul flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1.5 text-[11.5px]">
          <span className="text-text-dim">Modèle d'édition</span>
          <select
            value={choisi}
            onChange={(e) => choisir(e.target.value)}
            className="border border-border bg-surface px-2 py-1 text-[11.5px] min-w-[140px]"
          >
            <option value="">Standard</option>
            {liste?.modeles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </label>
        {peutEcrire && (
          <button
            type="button"
            onClick={() => setOuverte(true)}
            className="border border-border bg-surface px-2.5 py-1 text-[11.5px] font-bold hover:bg-surface-alt"
          >
            Personnaliser l'édition…
          </button>
        )}
        <Aide
          titre="Modèle d'édition"
          texte={`Le modèle décide de la liste imprimée · les colonnes facultatives gardées et le saut entre les groupes (par ${GROUPE_EDITION[edition]}) · une ligne blanche ou une nouvelle page. « Standard » imprime toutes les colonnes, sans saut. Les colonnes qui identifient la ligne s'impriment toujours, et aucune ligne n'est retirée. Les modèles sont gardés au dossier. Les états financiers et les livres obligatoires n'ont pas de modèle · leur présentation est celle du référentiel.`}
          source="AUDCIF Titre IX ch. 2 ; art. 20, al. 1 ; art. 22, 1°."
        />
      </div>
      {erreurLecture && (
        <p role="alert" className="text-[11.5px] text-danger">
          {erreurLecture}
        </p>
      )}
      {liste?.tronque && (
        <p className="text-[11.5px] text-warning">
          {liste.modeles.length} modèles proposés sur {liste.total} · les autres ne sont pas listés.
        </p>
      )}
      {ouverte && (
        <ModalePersonnaliser
          edition={edition}
          liste={liste}
          depart={modeleChoisi}
          onFermer={() => setOuverte(false)}
          onEnregistre={async (modele) => {
            // LE MODÈLE ENREGISTRÉ RESTE CHOISI, MÊME SI LA RELECTURE TOMBE
            // (relecture m9) · il est connu par la réponse du serveur ; sans
            // cela l'édition repassait en « Standard » sous un choix affiché.
            const l = await recharger();
            if (l) choisir(modele.id, l);
            else {
              setListe((avant) => avecLeModele(avant, modele));
              setChoisi(modele.id);
              onChange(modele);
            }
            setOuverte(false);
          }}
          onSupprime={async (id) => {
            const l = await recharger();
            if (!l) setListe((avant) => (avant ? { ...avant, modeles: avant.modeles.filter((m) => m.id !== id), total: Math.max(0, avant.total - 1) } : avant));
            choisir('', l);
            setOuverte(false);
          }}
        />
      )}
    </div>
  );
}

function ModalePersonnaliser({
  edition,
  liste,
  depart,
  onFermer,
  onEnregistre,
  onSupprime,
}: {
  edition: EditionModele;
  liste: ListeModeles | null;
  depart: ModeleServi | null;
  onFermer: () => void;
  onEnregistre: (modele: ModeleServi) => Promise<void>;
  onSupprime: (id: string) => Promise<void>;
}) {
  const catalogue = COLONNES_EDITION[edition];
  const [nom, setNom] = useState(depart?.nom ?? '');
  const [colonnes, setColonnes] = useState<string[]>(
    depart ? depart.colonnes : catalogue.filter((c) => !c.identifiante).map((c) => c.cle),
  );
  const [saut, setSaut] = useState<SautEdition>(depart?.saut ?? 'AUCUN');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // UN GESTE DESTRUCTEUR SE CONFIRME EN LIGNE (relecture des écrans, second
  // tour, 7) · le modèle est partagé par tout le dossier.
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const envoiRef = useRef(false);
  envoiRef.current = envoi;
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;

  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoiRef.current) fermerRef.current();
        return true;
      }),
    [],
  );

  const homonyme = liste?.modeles.find((m) => m.nom === nom.trim()) ?? null;

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      if (homonyme) {
        const remplace = await api.put<ModeleServi>(`/modeles-edition/${homonyme.id}`, { colonnes, saut });
        await onEnregistre(remplace);
      } else {
        const cree = await api.post<ModeleServi>('/modeles-edition', { edition, nom: nom.trim(), colonnes, saut });
        await onEnregistre(cree);
      }
    } catch (e) {
      setErreur(messageOuDefaut(e, "Le modèle n'a pas pu être enregistré."));
      setEnvoi(false);
    }
  }

  async function supprimer() {
    if (!depart) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api.delete(`/modeles-edition/${depart.id}`);
      await onSupprime(depart.id);
    } catch (e) {
      setErreur(messageOuDefaut(e, "Le modèle n'a pas pu être supprimé."));
      setEnvoi(false);
    }
  }

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-modele-edition"
          className="anim-modale w-full max-w-[460px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center px-2.5 border-b border-border">
            <span id="titre-modele-edition">Personnaliser l'édition</span>
          </div>
          <div className="p-3 space-y-2.5">
            {erreur && (
              <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">
                {erreur}
              </div>
            )}
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Nom du modèle</span>
              <input autoFocus maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-text-dim mb-0.5">Colonnes imprimées</legend>
              {catalogue.map((c) => (
                <label key={c.cle} className="inline-flex items-center gap-1.5" title={c.identifiante ? 'Identifie la ligne · toujours imprimée' : undefined}>
                  <input
                    type="checkbox"
                    disabled={c.identifiante}
                    checked={c.identifiante || colonnes.includes(c.cle)}
                    onChange={(e) =>
                      setColonnes((cs) => (e.target.checked ? [...cs, c.cle] : cs.filter((x) => x !== c.cle)))
                    }
                  />
                  {c.libelle}
                </label>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-text-dim mb-0.5">Entre deux groupes (par {GROUPE_EDITION[edition]})</legend>
              {(Object.keys(LIBELLES_SAUT) as SautEdition[]).map((s) => (
                <label key={s} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="saut-edition" checked={saut === s} onChange={() => setSaut(s)} />
                  {LIBELLES_SAUT[s]}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="flex flex-wrap justify-end gap-2 px-3 pb-3">
            {depart &&
              (confirmerSuppression ? (
                <span className="mr-auto flex flex-wrap items-center gap-2">
                  <span className="text-danger">Supprimer « {depart.nom} » pour tout le dossier ?</span>
                  <button
                    type="button"
                    onClick={() => void supprimer()}
                    disabled={envoi}
                    className="border border-danger/40 px-3 py-1.5 text-danger hover:bg-danger-soft disabled:opacity-40"
                  >
                    {envoi ? 'Suppression…' : 'Oui, supprimer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmerSuppression(false)}
                    disabled={envoi}
                    className="border border-border px-3 py-1.5 hover:bg-surface-alt disabled:opacity-40"
                  >
                    Non
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmerSuppression(true)}
                  disabled={envoi}
                  className="mr-auto border border-border px-3 py-1.5 text-danger hover:bg-surface-alt disabled:opacity-40"
                >
                  Supprimer le modèle
                </button>
              ))}
            <button type="button" onClick={onFermer} disabled={envoi} className="border border-border px-3 py-1.5 hover:bg-surface-alt">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void enregistrer()}
              disabled={envoi || !nom.trim()}
              className="bg-sel text-white font-semibold px-3 py-1.5 disabled:opacity-40"
            >
              {homonyme ? `Remplacer « ${homonyme.nom} »` : 'Enregistrer le modèle'}
            </button>
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
