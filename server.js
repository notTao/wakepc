/**
 * WakePC - Backend Server v3
 * - Wake-on-LAN (encender PC por Magic Packet UDP)
 * - SSH Shutdown/Restart via Tailscale
 */

const express = require('express');
const cors = require('cors');
const wol = require('wol');
const { Client } = require('ssh2');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 8080;
const SECRET = process.env.WOL_SECRET || 'cambia_esta_clave';
const SSH_HOST = process.env.SSH_HOST;
const SSH_USER = process.env.SSH_USER;
const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY;
const TAILSCALE_AUTHKEY = process.env.TAILSCALE_AUTHKEY;

console.log('ENV CHECK:', process.env.WOL_SECRET ? 'WOL_SECRET ok' : 'WOL_SECRET MISSING');
console.log('ENV CHECK:', process.env.SSH_HOST ? 'SSH_HOST ok' : 'SSH_HOST MISSING');

app.use(cors());
app.use(express.json());

// ── Tailscale setup ──────────────────────────────────────
function setupTailscale() {
  if (!TAILSCALE_AUTHKEY) {
    console.log('⚠ Tailscale: no configurado');
    return;
  }

  console.log('🔒 Instalando Tailscale...');

  const installCmd = `
    curl -fsSL https://tailscale.com/install.sh | sh &&
    tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
    sleep 3 &&
    tailscale up --authkey=${TAILSCALE_AUTHKEY} --hostname=wakepc-server --accept-routes
  `;

  exec(installCmd, (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Tailscale error:', err.message);
      return;
    }
    console.log('✅ Tailscale conectado');
    if (stdout) console.log('Tailscale stdout:', stdout);
  });
}

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
    ssh: !!(SSH_HOST && SSH_USER && SSH_PRIVATE_KEY),
    tailscale: !!TAILSCALE_AUTHKEY
  });
});

// ── Wake endpoint ────────────────────────────────────────
app.post('/wake', auth, (req, res) => {
  const { mac } = req.body;
  if (!mac) return res.status(400).json({ error: 'Falta la MAC address' });

  const macRegex = /^([0-9A-Fa-f]{2}[:\-]){5}([0-9A-Fa-f]{2})$/;
  if (!macRegex.test(mac)) return res.status(400).json({ error: 'MAC address inválida' });

  console.log(`[${new Date().toISOString()}] Enviando WoL a MAC: ${mac}`);

  wol.wake(mac, { address: '255.255.255.255', port: 9 }, (err) => {
    if (err) {
      console.error('Error WoL:', err);
      return res.status(500).json({ error: 'Error al enviar el paquete' });
    }
    res.json({ success: true, message: `Magic Packet enviado a ${mac}` });
  });
});

// ── SSH helper ───────────────────────────────────────────
function runSSHCommand(command, res, logMsg) {
  if (!SSH_HOST || !SSH_USER || !SSH_PRIVATE_KEY) {
    return res.status(500).json({ error: 'SSH no configurado en el servidor' });
  }

  console.log(`[${new Date().toISOString()}] ${logMsg} ${SSH_USER}@${SSH_HOST}`);

  const conn = new Client();

  conn.on('ready', () => {
    conn.exec(command, (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: 'Error ejecutando comando SSH' });
      }
      stream.on('close', () => {
        conn.end();
        res.json({ success: true, message: 'Comando enviado correctamente' });
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
    privateKey: Buffer.from(SSH_PRIVATE_KEY),
    readyTimeout: 10000,
  });
}

// ── Shutdown endpoint ────────────────────────────────────
app.post('/shutdown', auth, (req, res) => {
  runSSHCommand('sudo shutdown -h now', res, 'Apagando');
});

// ── Restart endpoint ─────────────────────────────────────
app.post('/restart', auth, (req, res) => {
  runSSHCommand('sudo shutdown -r now', res, 'Reiniciando');
});

// ── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 WakePC server v3 corriendo en puerto ${PORT}`);
  console.log(`🔑 Token: ${SECRET === 'cambia_esta_clave' ? '⚠ USANDO TOKEN POR DEFECTO' : '✓ configurado'}`);
  console.log(`🖥  SSH: ${SSH_HOST ? `✓ ${SSH_USER}@${SSH_HOST}` : '⚠ no configurado'}`);
  setupTailscale();
});
