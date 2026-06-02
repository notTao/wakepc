# WakePC 📱💻

App web progresiva (PWA) para encender tu PC remotamente con Wake-on-LAN desde Android.

---

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | La app web (instálala en tu Android) |
| `manifest.json` | Metadatos PWA |
| `sw.js` | Service Worker para soporte offline |
| `server.js` | Backend Node.js que envía el Magic Packet |
| `package.json` | Dependencias del servidor |

---

## Paso 1 — Configurar la PC

1. Entra a la **BIOS** (F2 / Del al encender)
2. Busca **Wake-on-LAN** / **WoL** / **PME** en las opciones de energía
3. Actívalo y guarda

Para obtener tu MAC en Windows:
```
ipconfig /all
```
Busca "Dirección física" en tu adaptador de red.

---

## Paso 2 — Configurar el Router

1. Entra al panel de tu router (normalmente 192.168.1.1)
2. Ve a **Port Forwarding** / **Reenvío de puertos**
3. Crea una regla:
   - Protocolo: **UDP**
   - Puerto externo: **9**
   - IP destino: IP local de tu PC (ej: 192.168.1.100)
   - Puerto destino: **9**

---

## Paso 3 — Deploy del servidor

### Opción A: Railway (recomendado, gratis)
1. Ve a railway.app y crea una cuenta
2. "New Project" → "Deploy from GitHub" o sube los archivos del servidor
3. Agrega la variable de entorno: `WOL_SECRET=tu_clave_secreta`
4. Railway te dará una URL como: `https://wakepc-xxx.railway.app`

### Opción B: Render (también gratis)
1. Ve a render.com, crea cuenta
2. "New Web Service" → conecta tu repo o sube archivos
3. Build command: `npm install`
4. Start command: `node server.js`
5. Agrega variable: `WOL_SECRET=tu_clave_secreta`

### Opción C: Tu propio servidor / VPS
```bash
npm install
WOL_SECRET=tu_clave_secreta node server.js
```

---

## Paso 4 — Instalar la App en Android

1. Sube `index.html`, `manifest.json` y `sw.js` a un hosting estático:
   - **GitHub Pages** (gratis): sube a un repo y activa Pages
   - **Netlify** (gratis): arrastra la carpeta al dashboard
   - **Vercel** (gratis): similar a Netlify
2. Abre la URL en Chrome en tu Android
3. Toca el menú (⋮) → **"Agregar a pantalla de inicio"**
4. ¡Listo! Aparece como una app nativa

---

## Paso 5 — Configurar la App

1. Abre la app → toca **CONFIG**
2. Ingresa tu MAC address (formato: AA:BB:CC:DD:EE:FF)
3. Ingresa la URL de tu servidor backend
4. Ingresa el token secreto (el mismo que pusiste en WOL_SECRET)
5. Toca **GUARDAR CONFIG**

---

## DDNS (IP dinámica)

Si tu IP pública cambia con frecuencia, usa un servicio DDNS gratuito:
- **DuckDNS**: duckdns.org — muy fácil, completamente gratis
- **No-IP**: noip.com — también gratuito

El servidor backend necesita poder hacer broadcast UDP en tu red local, así que idealmente debe correr dentro de tu red o en un servidor que pueda alcanzar tu router por broadcast.

> **Nota**: Para WoL a través de internet funcione correctamente, el servidor backend debe estar en la misma red local que tu PC, O tu router debe aceptar el magic packet desde internet y reenviarlo como broadcast interno.
