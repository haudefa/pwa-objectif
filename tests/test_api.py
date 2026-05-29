import os
import re
import tempfile
import unittest

os.environ["OBJECTIF_DATA_FILE"] = tempfile.NamedTemporaryFile(delete=False).name

from app import app


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        login_page = self.client.get("/login").get_data(as_text=True)
        token = re.search(r'name="_csrf_token" value="([^"]+)"', login_page).group(1)
        self.client.post(
            "/login",
            data={"password": app.config["AUTH_PASSWORD"], "_csrf_token": token},
        )
        home = self.client.get("/").get_data(as_text=True)
        self.csrf = re.search(r'name="csrf-token" content="([^"]+)"', home).group(1)

    def api(self, method, path, payload=None):
        return self.client.open(
            path,
            method=method,
            json=payload,
            headers={"X-CSRF-Token": self.csrf},
        )

    def test_objectif_lifecycle_and_export(self):
        created = self.api("POST", "/api/objectifs", {
            "titre": "Objectif test",
            "categorie": "Travail",
            "start_date": "2026-05-29",
            "end_date": "2026-05-30",
        })
        self.assertEqual(created.status_code, 201)
        objectif = created.get_json()

        sous = self.api("POST", f"/api/objectifs/{objectif['id']}/sous-objectifs", {
            "texte": "Action test",
        })
        self.assertEqual(sous.status_code, 201)

        done = self.api("PATCH", f"/api/sous-objectifs/{sous.get_json()['id']}", {
            "etat": "accompli",
        })
        self.assertEqual(done.status_code, 200)
        self.assertTrue(done.get_json()["accompli"])

        objectifs = self.client.get("/api/objectifs").get_json()
        archived = next(item for item in objectifs if item["id"] == objectif["id"])
        self.assertTrue(archived["archived"])
        self.assertTrue(archived["frozen"])

        exported = self.client.get("/api/export")
        self.assertEqual(exported.status_code, 200)
        self.assertIn(b"Objectif test", exported.data)


if __name__ == "__main__":
    unittest.main()
