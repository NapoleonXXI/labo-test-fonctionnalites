# Labo test fonctionnalités – marche à suivre de l'Agent Testeur

Page : https://napoleonxxi.github.io/labo-test-fonctionnalites/
Dépôt : NapoleonXXI/labo-test-fonctionnalites (branche `main`)

- `index.html` : page « Itérations », affichée à partir de `iterations.json` (pour chaque itération : captures, numéro de version, date).
- `test.html` : vue de test (Standard / Mobile, choix du rôle, plein écran).
  En direct : `app/lab.html?m=0` (standard) ou `app/lab.html?m=1` (mobile, à ouvrir en 390 × 844), `&r=technicien` ou `&r=reception` pour changer de rôle.
  Aucune donnée réelle : tout reste en mémoire et disparaît quand on recharge la page.
- `elements.html` : boutons, typographies et marges de l'appli (images générées par le développeur).

## Ajouter une itération

1. **Captures** : PNG dans `captures/`, nommées `captures/iNNN.png` (numéro sur trois chiffres).
2. **Itération** : ajoute un objet à la fin de la liste `iterations` de `iterations.json` :
   ```json
   { "v": 1, "date": "2026-11-18 15:30", "captures": ["captures/i001.png"] }
   ```
3. **Vérifie** que le fichier reste un JSON valide (`python3 -m json.tool iterations.json`).
4. **Publie** : `git pull --rebase && git add iterations.json captures/ && git commit -m "Itération N" && git push origin main`.
5. La page se met à jour au bout d'environ une minute (recharge-la).

## À ne jamais faire

- Ne jamais modifier `index.html`, `test.html`, `elements.html`, `app/`, `elements/` ni `outils/` : c'est le code du développeur.
- Ne touche qu'à `iterations.json` et au dossier `captures/`.
