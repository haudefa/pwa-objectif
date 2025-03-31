from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json
import uuid

app = Flask(__name__, static_folder='static')
CORS(app)

data_file = 'data.json'
objectifs = []

# --- Gestion des fichiers ---
def sauvegarder():
    with open(data_file, 'w') as f:
        json.dump(objectifs, f, indent=2)

def charger():
    global objectifs
    if os.path.exists(data_file):
        with open(data_file) as f:
            objectifs = json.load(f)

# --- Fonctions utilitaires ---
def trouver_objectif(obj_id):
    return next((o for o in objectifs if o['id'] == obj_id), None)

def trouver_sous_objectif(obj, sous_id):
    return next((s for s in obj['sous_objectifs'] if s['id'] == sous_id), None)

# --- Routes ---
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/objectifs', methods=['GET'])
def get_objectifs():
    return jsonify(objectifs)

@app.route('/api/objectifs', methods=['POST'])
def create_objectif():
    data = request.get_json()
    if 'titre' not in data or not data['titre'].strip():
        return jsonify(success=False, message="Titre requis"), 400
    new_obj = {
        'id': str(uuid.uuid4()),
        'titre': data['titre'],
        'categorie': data.get('categorie', 'Non défini'),
        'sous_objectifs': []
    }
    objectifs.append(new_obj)
    sauvegarder()
    return jsonify(success=True, id=new_obj['id'])

@app.route('/api/objectifs/<obj_id>', methods=['DELETE'])
def delete_objectif(obj_id):
    global objectifs
    objectifs = [o for o in objectifs if o['id'] != obj_id]
    sauvegarder()
    return jsonify(success=True)

@app.route('/api/objectifs/<obj_id>/sous', methods=['POST'])
def add_sous_objectif(obj_id):
    data = request.get_json()
    if 'texte' not in data or not data['texte'].strip():
        return jsonify(success=False, message="Texte requis"), 400
    obj = trouver_objectif(obj_id)
    if not obj:
        return jsonify(success=False, message="Objectif introuvable"), 404
    new_sous = {
        'id': str(uuid.uuid4()),
        'texte': data['texte'],
        'etat': '',
        'type': '',
        'priorite': 'moyenne',
        'temps': 0,
        'accompli': False
    }
    obj['sous_objectifs'].append(new_sous)
    sauvegarder()
    return jsonify(success=True, id=new_sous['id'])

@app.route('/api/objectifs/<obj_id>/sous/<sous_id>', methods=['PATCH'])
def update_sous_objectif(obj_id, sous_id):
    data = request.get_json()
    obj = trouver_objectif(obj_id)
    if not obj:
        return jsonify(success=False, message="Objectif introuvable"), 404
    sous = trouver_sous_objectif(obj, sous_id)
    if not sous:
        return jsonify(success=False, message="Sous-objectif introuvable"), 404
    sous.update(data)
    sauvegarder()
    return jsonify(success=True)

@app.route('/api/objectifs/<obj_id>/sous/<sous_id>', methods=['DELETE'])
def delete_sous_objectif(obj_id, sous_id):
    obj = trouver_objectif(obj_id)
    if not obj:
        return jsonify(success=False, message="Objectif introuvable"), 404
    obj['sous_objectifs'] = [s for s in obj['sous_objectifs'] if s['id'] != sous_id]
    sauvegarder()
    return jsonify(success=True)

if __name__ == '__main__':
    charger()
    import os
port = int(os.environ.get("PORT", 5000))
app.run(host="0.0.0.0", port=port)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'icon-192.png')  # ou autre icône existante
@app.route('/apple-touch-icon.png')
def apple_touch_icon():
    return send_from_directory('static', 'icon-192.png')

