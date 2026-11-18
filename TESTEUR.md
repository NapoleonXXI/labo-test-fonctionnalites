# Labo test fonctionnalités – marche à suivre de l'Agent Testeur

Page : https://napoleonxxi.github.io/labo-test-fonctionnalites/
Dépôt : NapoleonXXI/labo-test-fonctionnalites (branche `main`)

- `index.html` : ton rapport, affiché à partir de `rapport.json` (colonnes Titres, Capture et versions, Suggestions).
- `test.html` : vue de test (Standard / Mobile, choix du rôle, plein écran).
  En direct : `app/lab.html?m=0` (standard) ou `app/lab.html?m=1` (mobile, à ouvrir en 390 × 844), `&r=technicien` ou `&r=reception` pour changer de rôle.
  Aucune donnée réelle : tout reste en mémoire et disparaît quand on recharge la page.
- `elements.html` : boutons, typographies et marges de l'appli (images générées par le développeur).

## Ajouter un constat

1. **Capture** : PNG nette en résolution ×2 (device scale factor 2), recadrée sur la zone concernée,
   dans `captures/` avec un numéro sur trois chiffres : `captures/009.png`, `captures/010.png`…
2. **Visuel de suggestion** (facultatif mais conseillé) : la même zone, retouchée comme elle serait mieux
   (par exemple une retouche CSS appliquée dans Playwright avant la capture), PNG ×2 nommée `captures/sNNN.png`
   avec le même numéro que la capture (`captures/s009.png`).
3. **Constat** : ajoute un objet à la fin de la liste `constats` de `rapport.json` :
   ```json
   {
     "id": 8,
     "titre": "Bouton coupé par une div qui le chevauche",
     "statut": "ouvert",
     "capture": "captures/009.png",
     "versions": [
       { "vue": "Mobile", "detail": "iPhone 390 px", "roles": ["Technicien", "Réceptionniste"] },
       { "vue": "Standard", "detail": "iPad 1024 et 1180 px", "roles": ["Responsable technique"] }
     ],
     "suggestion": "Ce qui serait mieux, en une ou deux phrases.",
     "suggestion_capture": "captures/s009.png"
   }
   ```
   - `titre` : affiché dans la colonne Titres (court).
   - `versions` : une ligne par vue. `vue` = `Mobile` ou `Standard` ; `detail` = appareil ou largeurs (facultatif) ;
     `roles` = liste parmi `Responsable technique`, `Technicien`, `Réceptionniste` (ou `["Tous les rôles"]`).
     L'ancien format texte (`"versions": "Mobile 390, tous rôles"`) reste accepté.
   - `suggestion` : texte de la colonne Suggestions ; `suggestion_capture` : image affichée au-dessus (facultative).
   - `statut` : `ouvert`, `corrige` ou `valide`.
   - En tête du fichier : `verdict` (une ligne, par exemple `"Non validée"`) et `maj` (heure de Paris, par exemple `"2026-11-18T15:20:00+01:00"`).
4. **Vérifie** que le fichier reste un JSON valide (`python3 -m json.tool rapport.json`).
5. **Publie** : `git pull --rebase && git add rapport.json captures/ && git commit -m "Rapport : constat N" && git push origin main`.
6. La page se met à jour au bout d'environ une minute (recharge-la).

## À ne jamais faire

- Ne jamais modifier `index.html`, `test.html`, `elements.html`, `app/`, `elements/` ni `outils/` : c'est le code du développeur.
- Ne touche qu'à `rapport.json` et au dossier `captures/`.
