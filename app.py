from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json
import uuid

app = Flask(__name__, static_folder='static')
CORS(app)

data_file = 'data.json'

def load_data():
    if os.path.exists(data_file):
        with open(data_file, 'r') as f:
            return json.load(f)
    return []

def save_data(data):
    with open(data_file, 'w') as f:
        json.dump(data, f, indent=2)

objectifs = load_data()

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/objectifs', methods=['GET'])
def get_objectifs():
    return jsonify(objectifs)

@app.route('/api/objectifs', methods=['POST'])
def create_objectif():
    data = request.get_json()
    new_obj = {
        'id': str(uuid.uuid4()),
        'titre': data['titre'],
        'categorie': data.get('categorie', 'Non défini'),
        'sous_objectifs': []
    }
    objectifs.append(new_obj)
    save_data(objectifs)
    return jsonify(success=True)

@app.route('/api/objectifs/<string:obj_id>', methods=['DELETE'])
def delete_objectif(obj_id):
    global objectifs
    objectifs = [o for o in objectifs if o['id'] != obj_id]
    save_data(objectifs)
    return jsonify(success=True)

@app.route('/api/objectifs/<string:obj_id>/sous', methods=['POST'])
def add_sous_objectif(obj_id):
    data = request.get_json()
    for obj in objectifs:
        if obj['id'] == obj_id:
            obj['sous_objectifs'].append({
                'id': str(uuid.uuid4()),
                'texte': data['texte'],
                'etat': '',
                'type': '',
                'priorite': 'moyenne',
                'temps': 0,
                'accompli': False
            })
            save_data(objectifs)
            return jsonify(success=True)
    return jsonify(success=False), 404

@app.route('/api/objectifs/<string:obj_id>/sous/<string:sous_id>', methods=['PATCH'])
def update_sous_objectif(obj_id, sous_id):
    data = request.get_json()
    for obj in objectifs:
        if obj['id'] == obj_id:
            for sous in obj['sous_objectifs']:
                if sous['id'] == sous_id:
                    sous.update(data)
                    save_data(objectifs)
                    return jsonify(success=True)
    return jsonify(success=False), 404

@app.route('/api/objectifs/<string:obj_id>/sous/<string:sous_id>', methods=['DELETE'])
def delete_sous_objectif(obj_id, sous_id):
    for obj in objectifs:
        if obj['id'] == obj_id:
            obj['sous_objectifs'] = [s for s in obj['sous_objectifs'] if s['id'] != sous_id]
            save_data(objectifs)
            return jsonify(success=True)
    return jsonify(success=False), 404

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'icon-192.png')

@app.route('/apple-touch-icon.png')
def apple_touch():
    return send_from_directory('static', 'icon-192.png')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
