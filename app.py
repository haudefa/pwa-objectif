from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = Flask(__name__, static_folder='static')
CORS(app)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    try:
        user = supabase.auth.sign_up({"email": email, "password": password})
        return jsonify(success=True, user_id=user.user.id)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    try:
        user_session = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return jsonify(success=True, access_token=user_session.session.access_token, user={"id": user_session.user.id})
    except Exception as e:
        return jsonify(success=False, error=str(e)), 400

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
        "user_id": data['user_id']
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

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
