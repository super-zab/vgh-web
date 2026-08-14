/* POST /api/upload?token=…&name=firmware.bin
 *
 * Upload du binaire firmware pour l'OTA du firmware V5 : l'ESP32 télécharge
 * lui-même le .bin depuis une URL HTTPS publique (voir l'action "ota" dans
 * Greenhouse_V5.ino, handleCmdJson). Cette route stocke le fichier envoyé
 * sur Vercel Blob et renvoie son URL publique.
 *
 * Corps de la requête : le .bin brut (Content-Type: application/octet-stream).
 * Nécessite la variable d'environnement BLOB_READ_WRITE_TOKEN — à activer
 * une fois sur le projet Vercel (Storage → Create Database → Blob).       */

import { put } from '@vercel/blob';
import { denied } from './_db.js';

const MAX_BYTES = 4_000_000;   // limite de taille du corps des Vercel Functions

export default async function handler(req, res) {
  if (denied(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST uniquement' }); return; }

  try {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_BYTES) {
        res.status(413).json({ error: `Fichier trop volumineux (limite ${(MAX_BYTES / 1e6).toFixed(1)} Mo).` });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);

    if (buf.length < 1000) {
      res.status(400).json({ error: 'Fichier vide ou trop petit pour être un firmware.' });
      return;
    }
    // Toute image ESP32 valide commence par l'octet magique 0xE9 — autant
    // détecter le mauvais fichier ici plutôt qu'après un OTA raté sur site.
    if (buf[0] !== 0xE9) {
      res.status(400).json({
        error: `Ce fichier ne ressemble pas à une image ESP32 valide : il commence par `
             + `0x${buf[0].toString(16).toUpperCase().padStart(2, '0')} au lieu de 0xE9. `
             + `Reprends le .bin exporté par Arduino IDE (Croquis → Exporter les binaires compilés).`,
      });
      return;
    }

    const url = new URL(req.url, 'http://x');
    const name = (url.searchParams.get('name') || 'firmware.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `firmware/${Date.now()}-${name}`;

    const blob = await put(key, buf, {
      access: 'public',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
    });

    res.status(200).json({ url: blob.url, size: buf.length });

  } catch (e) {
    console.error('upload:', e);
    res.status(500).json({ error: e.message });
  }
}
