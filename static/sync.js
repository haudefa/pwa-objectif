import { getUnsyncedObjectifs, markAsSynced } from './db.js';
import { supabase } from './supabase.js';

export async function syncToSupabase() {
  const unsynced = await getUnsyncedObjectifs();
  if (unsynced.length === 0) return;

  for (const objectif of unsynced) {
    const { error } = await supabase.from('objectifs').insert([objectif]);
    if (!error) {
      await markAsSynced(objectif.id);
      console.log(`🔄 Objectif synchronisé : ${objectif.titre}`);
    } else {
      console.error('❌ Erreur de synchro :', error);
    }
  }
}
// sync.js
import { getUnsyncedObjectifs, markAsSynced, getUnsyncedSousObjectifs, markSousObjectifAsSynced } from './db.js';
import { supabase } from './supabase.js';

export async function syncToSupabase() {
  await syncObjectifs();
  await syncSousObjectifs();
}

async function syncObjectifs() {
  const unsynced = await getUnsyncedObjectifs();
  if (unsynced.length === 0) return;

  for (const objectif of unsynced) {
    const { error } = await supabase.from('objectifs').insert([objectif]);
    if (!error) {
      await markAsSynced(objectif.id);
      console.log(`✅ Objectif synchronisé : ${objectif.titre}`);
    } else {
      console.error('❌ Erreur de synchro objectif :', error);
    }
  }
}

async function syncSousObjectifs() {
  const unsynced = await getUnsyncedSousObjectifs();
  if (unsynced.length === 0) return;

  for (const sous of unsynced) {
    const { error } = await supabase.from('sous_objectifs').insert([sous]);
    if (!error) {
      await markSousObjectifAsSynced(sous.id);
      console.log(`✅ Sous-objectif synchronisé : ${sous.texte}`);
    } else {
      console.error('❌ Erreur de synchro sous-objectif :', error);
    }
  }
}
