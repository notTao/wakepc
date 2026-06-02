/**
 * WakePC - Backend Server v2
 * - Wake-on-LAN (encender PC por Magic Packet UDP)
 * - SSH Shutdown (apagar MacBook remotamente)
 *
 * Deploy en: Railway, Render, Fly.io, o cualquier VPS
 * Instalar: npm install express cors wol ssh2
 * Correr:   node server.js
 */

const express = require('express');
const cors = require('cors');
const wol = require('wol');
const { Client } = require('ssh2');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.WOL_SECRET || 'cambia_esta_clave';
const SSH_HOST = process.env.SSH_HOST;
const SSH_USER = process.env.SSH_USER;
const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY;

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
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    ssh: !!(SSH_HOST && SSH_USER && SSH_PRIVATE_KEY)
  });
});

// ── Wake endpoint ────────────────────────────────────────
app.post('/wake', auth, (req, res) => {
  const { mac } = req.body;

  if (!mac) {
    return res.status(400).json({ error: 'Falta la MAC address' });
  }

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

// ── Shutdown endpoint ────────────────────────────────────
app.post('/shutdown', auth, (req, res) => {
  if (!SSH_HOST || !SSH_USER || !SSH_PRIVATE_KEY) {
    return res.status(500).json({ error: 'SSH no configurado en el servidor' });
  }

  console.log(`[${new Date().toISOString()}] Apagando ${SSH_USER}@${SSH_HOST}`);

  const conn = new Client();

  conn.on('ready', () => {
    conn.exec('sudo shutdown -h now', (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: 'Error ejecutando shutdown' });
      }
      stream.on('close', () => {
        conn.end();
        res.json({ success: true, message: 'Comando de apagado enviado' });
      });
      stream.stderr.on('data', (data) => {
        console.error('SSH stderr:', data.toString());
      });
    });
  });

  conn.on('error', (err) => {
    console.error('SSH error:', err.message);
    res.status(500).json({ error: 'No se pudo conectar por SSH: ' + err.message });
  });

  conn.connect({
    host: SSH_HOST,
    port: 22,
    username: SSH_USER,
    privateKey: SSH_PRIVATE_KEY,
    readyTimeout: 8000,
  });
});

// ── Restart endpoint ─────────────────────────────────────
app.post('/restart', auth, (req, res) => {
  if (!SSH_HOST || !SSH_USER || !SSH_PRIVATE_KEY) {
    return res.status(500).json({ error: 'SSH no configurado en el servidor' });
  }

  console.log(`[${new Date().toISOString()}] Reiniciando ${SSH_USER}@${SSH_HOST}`);

  const conn = new Client();

  conn.on('ready', () => {
    conn.exec('sudo shutdown -r now', (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: 'Error ejecutando restart' });
      }
      stream.on('close', () => {
        conn.end();
        res.json({ success: true, message: 'Comando de reinicio enviado' });
      });
      stream.stderr.on('data', (data) => {
        console.error('SSH stderr:', data.toString());
      });
    });
  });

  conn.on('error', (err) => {
    console.error('SSH error:', err.message);
    res.status(500).json({ error: 'No se pudo conectar por SSH: ' + err.message });
  });

  conn.connect({
    host: SSH_HOST,
    port: 22,
    username: SSH_USER,
    privateKey: SSH_PRIVATE_KEY,
    readyTimeout: 8000,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 WakePC server v2 corriendo en puerto ${PORT}`);
  console.log(`🔑 Token: ${SECRET === 'cambia_esta_clave' ? '⚠ USANDO TOKEN POR DEFECTO' : '✓ configurado'}`);
  console.log(`🖥  SSH: ${SSH_HOST ? `✓ ${SSH_USER}@${SSH_HOST}` : '⚠ no configurado'}`);
});
