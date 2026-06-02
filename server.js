/**
 * WakePC - Backend Server
 * Envía Magic Packets UDP para Wake-on-LAN
 *
 * Deploy en: Railway, Render, Fly.io, o cualquier VPS
 * Instalar: npm install express cors wol
 * Correr:   node server.js
 */

const express = require('express');
const cors = require('cors');
const wol = require('wol');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.WOL_SECRET || 'cambia_esta_clave';

app.use(cors());
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ── Health check ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Wake endpoint ────────────────────────────────────────
app.post('/wake', auth, (req, res) => {
  const { mac } = req.body;

  if (!mac) {
    return res.status(400).json({ error: 'Falta la MAC address' });
  }

  // Validar formato MAC
  const macRegex = /^([0-9A-Fa-f]{2}[:\-]){5}([0-9A-Fa-f]{2})$/;
  if (!macRegex.test(mac)) {
    return res.status(400).json({ error: 'MAC address inválida' });
  }

  console.log(`[${new Date().toISOString()}] Enviando WoL a MAC: ${mac}`);

  wol.wake(mac, { address: '255.255.255.255', port: 9 }, (err) => {
    if (err) {
      console.error('Error WoL:', err);
      return res.status(500).json({ error: 'Error al enviar el paquete' });
    }
    res.json({ success: true, message: `Magic Packet enviado a ${mac}` });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 WakePC server corriendo en puerto ${PORT}`);
  console.log(`🔑 Token: ${SECRET === 'cambia_esta_clave' ? '⚠ USANDO TOKEN POR DEFECTO - cámbialo!' : '✓ configurado'}`);
});
