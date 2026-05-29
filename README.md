# PWA Objectif

Application Flask/PWA pour suivre des objectifs, sous-objectifs, dates limites, progression et archives.

## Fonctionnalités MVP

- Authentification simple par mot de passe.
- Objectifs avec catégorie, date de début et date limite.
- Sous-objectifs avec état, type, priorité et chronomètre.
- Progression automatique.
- Gel et archivage automatique quand un objectif atteint 100%.
- Indicateurs d'échéance : en retard, urgent, rythme à rattraper.
- Bloc "À faire aujourd'hui" pour prioriser les prochaines actions.
- Graphique d'évolution avec légende.
- Archives dédiées.
- Export/import JSON.
- Sauvegarde automatique `data.json.bak` avant chaque écriture.
- Interface responsive.

## Lancement local

```bash
pip install -r requirements.txt
OBJECTIF_PASSWORD="mot-de-passe-fort" python app.py
```

Puis ouvrir :

```text
http://127.0.0.1:5000
```

## Production

Le démarrage production utilise Gunicorn :

```text
web: gunicorn app:app
```

Variables recommandées :

```text
SECRET_KEY=une-cle-longue-aleatoire
OBJECTIF_PASSWORD=mot-de-passe-fort
OBJECTIF_DATA_FILE=/tmp/pwa_objectif/data.json
```

Si la plateforme fournit un disque persistant, mettez `OBJECTIF_DATA_FILE` sur ce disque. Sans disque persistant, les données locales peuvent disparaître au redémarrage. Pour une production durable, configurez Supabase ou un stockage persistant.

Diagnostic production :

```text
/api/health
```

Cette route indique si Supabase est configuré, le mode utilisé et si le stockage local est écrivable.

## Variables d'environnement

- `OBJECTIF_PASSWORD` : mot de passe de connexion.
- `SECRET_KEY` : clé de session Flask.
- `OBJECTIF_DATA_FILE` : chemin optionnel du fichier JSON local.
- `SUPABASE_URL` et `SUPABASE_ANON_KEY` : optionnels. Si Supabase est indisponible, l'application utilise le stockage local.

## Stockage

Le stockage local utilise `data.json` :

```json
{
  "version": 1,
  "objectifs": []
}
```

Avant chaque écriture, l'ancien fichier est copié dans `data.json.bak`.

## Tests rapides

```bash
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests
node --check static/app.js
```
