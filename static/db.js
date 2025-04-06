// db.js
import { openDB } from 'idb';

export const db = await openDB('objectifDB', 1, {
  upgrade(db) {
    db.createObjectStore('objectifs', { keyPath: 'id' });
    db.createObjectStore('sous_objectifs', { keyPath: 'id' });
  }
});

export async function addObjectif(objectif) {
  objectif.synced = false;
  await db.put('objectifs', objectif);
}

export async function getUnsyncedObjectifs() {
  const all = await db.getAll('objectifs');
  return all.filter(obj => !obj.synced);
}

export async function markAsSynced(id) {
  const obj = await db.get('objectifs', id);
  if (obj) {
    obj.synced = true;
    await db.put('objectifs', obj);
  }
}