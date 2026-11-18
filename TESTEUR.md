# Labo test fonctionnalités – marche à suivre de l'Agent Testeur

Page : https://napoleonxxi.github.io/labo-test-fonctionnalites/
Dépôt : NapoleonXXI/labo-test-fonctionnalites (branche `main`)

- Moitié gauche : la fonctionnalité testée (en ce moment, « Nouvelle intervention »), avec la bascule Standard / Mobile.
  Pour tester en plein écran : `app/lab.html?m=0` (standard) ou `app/lab.html?m=1` (mobile, à ouvrir en 390 × 844).
  Aucune donnée réelle : tout reste en mémoire et disparaît quand on recharge la page.
- Moitié droite : ton rapport, affiché à partir de `rapport.json`.

## Ajouter un constat

1. **Capture** : fais une capture PNG nette en résolution ×2 (device scale factor 2), recadrée sur la zone concernée.
   Enregistre-la dans `captures/` avec le numéro du constat sur trois chiffres : `captures/002.png`, `captures/003.png`…
2. **Constat** : ajoute un objet à la fin de la liste `constats` de `rapport.json` :
   ```json
   {
     "id": 2,
     "titre": "Bouton coupé par une div qui le chevauche",
     "vue": "mobile",
     "gravite": "majeur",
     "statut": "ouvert",
     "capture": "captures/002.png",
     "extrait": "facultatif : extrait de code ou de texte",
     "commentaire": "Ce que tu as constaté, où, et ce qui est attendu."
   }
   ```
   - `vue` : `mobile` ou `standard`
   - `gravite` : `bloquant`, `majeur` ou `mineur`
   - `statut` : `ouvert`, `corrige` ou `valide`
   - `capture` et `extrait` sont facultatifs (supprime la ligne s'il n'y en a pas).
   - Mets aussi à jour `maj` avec la date et l'heure de Paris, par exemple `"2026-11-18T15:20:00+01:00"`.
   - Au premier vrai constat, supprime l'exemple (`"exemple": true`, id 1) et sa capture `captures/001.png`.
3. **Vérifie** que le fichier reste un JSON valide (`python3 -m json.tool rapport.json`).
4. **Publie** : `git add rapport.json captures/ && git commit -m "Rapport : constat N" && git push origin main`.
5. La page se met à jour au bout d'environ une minute (recharge-la).

## À ne jamais faire

- Ne jamais modifier `index.html` ni le dossier `app/` : c'est le code du développeur.
- Ne touche qu'à `rapport.json` et au dossier `captures/`.
