/**
 * Genera src/data/red.json: el índice de correspondencias de toda la red.
 *
 * Para cada línea y sentido pide sus paradas (que vienen ordenadas), y toma la
 * última como destino de ese sentido. El resultado permite saber, para cualquier
 * parada, qué líneas pasan por ella y HACIA DÓNDE van, sin ninguna petición en
 * tiempo de ejecución.
 *
 * Uso:  node scripts/build-red.mjs
 * Requiere las credenciales de .env. Conviene re-ejecutarlo de vez en cuando
 * (la red cambia poco, pero cambia).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const BASE = 'https://openapi.emtmadrid.es';
const CONCURRENCIA = 6;

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch con reintentos: la red falla de vez en cuando en tandas largas. */
async function fetchReintento(url, init, intentos = 4) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      ultimo = e;
      await espera(500 * (i + 1));
    }
  }
  throw ultimo;
}

let token;
async function login() {
  const intentos = [];
  if (env.EXPO_PUBLIC_EMT_CLIENT_ID && env.EXPO_PUBLIC_EMT_PASSKEY) {
    intentos.push({ 'X-ClientId': env.EXPO_PUBLIC_EMT_CLIENT_ID, passKey: env.EXPO_PUBLIC_EMT_PASSKEY });
  }
  if (env.EXPO_PUBLIC_EMT_EMAIL && env.EXPO_PUBLIC_EMT_PASSWORD) {
    intentos.push({ email: env.EXPO_PUBLIC_EMT_EMAIL, password: env.EXPO_PUBLIC_EMT_PASSWORD });
  }
  for (const headers of intentos) {
    const j = await (await fetchReintento(`${BASE}/v2/mobilitylabs/user/login/`, { headers })).json();
    if (j?.data?.[0]?.accessToken) {
      token = j.data[0].accessToken;
      return;
    }
  }
  throw new Error('No se pudo iniciar sesión en la API de EMT');
}

async function api(pathname, reintento = true) {
  const r = await fetchReintento(`${BASE}${pathname}`, { headers: { accessToken: token } });
  const j = await r.json();
  if (['80', '81', '90'].includes(String(j?.code)) && reintento) {
    await login();
    return api(pathname, false);
  }
  return j;
}

const norm = (v) => String(v ?? '').trim().toUpperCase();

async function main() {
  await login();
  const d = new Date();
  const ref = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  const lineasJson = await api(`/v2/transport/busemtmad/lines/info/${ref}/`);
  const lineas = (lineasJson.data ?? [])
    .map((l) => ({ id: String(l.line), lin: norm(l.label) }))
    .filter((l) => l.lin);
  console.log(`Líneas: ${lineas.length}. Descargando paradas por sentido…`);

  const tareas = [];
  for (const l of lineas) {
    for (const dir of [1, 2]) {
      tareas.push({ ...l, dir });
    }
  }

  const rutas = [];            // [{ lin, dir, destino }]
  const porParada = new Map(); // stopCode -> Set(indice de ruta)
  let hechas = 0;
  let fallos = 0;

  async function worker() {
    while (tareas.length > 0) {
      const t = tareas.shift();
      try {
        const j = await api(`/v1/transport/busemtmad/lines/${encodeURIComponent(t.id)}/stops/${t.dir}/`);
        const stops = j?.data?.[0]?.stops ?? [];
        if (stops.length > 0) {
          const destino = String(stops[stops.length - 1]?.name ?? '').trim();
          if (destino) {
            const idx = rutas.push({ lin: t.lin, dir: t.dir, destino }) - 1;
            for (const s of stops) {
              const code = String(s?.stop ?? '');
              if (!code) continue;
              if (!porParada.has(code)) porParada.set(code, new Set());
              porParada.get(code).add(idx);
            }
          }
        }
      } catch {
        fallos++;
      }
      hechas++;
      if (hechas % 50 === 0) console.log(`  ${hechas}/${lineas.length * 2}…`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCIA }, worker));

  const paradas = {};
  for (const [code, set] of porParada) {
    paradas[code] = [...set].sort((a, b) => a - b);
  }

  const salida = {
    generado: new Date().toISOString().slice(0, 10),
    rutas,
    paradas,
  };
  const destino = path.join(ROOT, 'src', 'data', 'red.json');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(salida));
  const kb = Math.round(fs.statSync(destino).size / 1024);
  console.log(`\nListo: ${rutas.length} rutas, ${Object.keys(paradas).length} paradas, ${kb} KB`);
  if (fallos) console.log(`(${fallos} peticiones fallaron)`);
}

await main();
