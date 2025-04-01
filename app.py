from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Charger les variables d’environnement
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = Flask(__name__, static_folder='static')
CORS(app)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/objectifs', methods=['GET'])
def get_objectifs():
    objectifs = supabase.table("objectifs").select("*, sous_objectifs(*)").execute().data
    return jsonify(objectifs)

@app.route('/api/objectifs', methods=['POST'])
def create_objectif():
    data = request.get_json()
    new_obj = {
        "titre": data['titre'],
        "categorie": data.get('categorie', 'Non défini'),
        "user_id": data.get('user_id')  # À automatiser avec auth plus tard
    }
    supabase.table("objectifs").insert(new_obj).execute()
    return jsonify(success=True)

@app.route('/api/objectifs/<objectif_id>', methods=['DELETE'])
def delete_objectif(objectif_id):
    supabase.table("objectifs").delete().eq("id", objectif_id).execute()
    return jsonify(success=True)

@app.route('/api/objectifs/<objectif_id>/sous', methods=['POST'])
def add_sous_objectif(objectif_id):
    data = request.get_json()
    new_sous = {
        "texte": data['texte'],
        "objectif_id": objectif_id,
        "etat": "",
        "type": "",
        "priorite": "moyenne",
        "temps": 0,
        "accompli": False
    }
    supabase.table("sous_objectifs").insert(new_sous).execute()
    return jsonify(success=True)

@app.route('/api/objectifs/<objectif_id>/sous/<sous_id>', methods=['PATCH'])
def update_sous_objectif(objectif_id, sous_id):
    data = request.get_json()
    supabase.table("sous_objectifs").update(data).eq("id", sous_id).eq("objectif_id", objectif_id).execute()
    return jsonify(success=True)

@app.route('/api/objectifs/<objectif_id>/sous/<sous_id>', methods=['DELETE'])
def delete_sous_objectif(objectif_id, sous_id):
    supabase.table("sous_objectifs").delete().eq("id", sous_id).eq("objectif_id", objectif_id).execute()
    return jsonify(success=True)

if __name__ == '__main__':
    app.run(debug=True)
