import { Linea, Parada, Tiempo } from '../types';
import { toNumber } from '../utils/text';

// API oficial de EMT Madrid (MobilityLabs), HTTPS. Documentación:
// https://apidocs.emtmadrid.es
//
// Autenticación: login con email+password (nivel Basic, 25k/día) devuelve un
// accessToken que va en la cabecera `accessToken` del resto de llamadas.
// Las credenciales se toman de variables EXPO_PUBLIC_* (.env, no versionado).
// Para publicar conviene un proxy propio: si defines EXPO_PUBLIC_EMT_PROXY_BASE,
// las llamadas irán a ese proxy (que guarda las credenciales) en vez de a EMT.
const DIRECT_BASE = 'https://openapi.emtmadrid.es';
const PROXY_BASE = process.env.EXPO_PUBLIC_EMT_PROXY_BASE?.trim();
const BASE = PROXY_BASE || DIRECT_BASE;
const USE_PROXY = Boolean(PROXY_BASE);

// Dos modos de autenticación admitidos por EMT:
//  - "Protected" (recomendado): X-ClientId + passKey que da el portal al registrar la
//    app. No expone tu contraseña personal y la sesión dura más.
//  - "Basic": email + password de tu cuenta de MobilityLabs (25k peticiones/día).
const CLIENT_ID = process.env.EXPO_PUBLIC_EMT_CLIENT_ID?.trim() ?? '';
const PASS_KEY = process.env.EXPO_PUBLIC_EMT_PASSKEY?.trim() ?? '';
const EMAIL = process.env.EXPO_PUBLIC_EMT_EMAIL?.trim() ?? '';
const PASSWORD = process.env.EXPO_PUBLIC_EMT_PASSWORD?.trim() ?? '';
const NETWORK_TIMEOUT_MS = 20_000;

let token: string | undefined;
let tokenExpiresAt = 0;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado (${NETWORK_TIMEOUT_MS}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function login(): Promise<string> {
  // Con proxy, el propio proxy gestiona el login; pedimos un token "vacío".
  if (USE_PROXY) {
    token = 'proxy';
    tokenExpiresAt = Date.now() + 3600_000;
    return token;
  }
  // Se intentan por orden: passKey (si la app está activa) y luego email/password.
  // Si la app registrada aún no está habilitada, EMT responde 403/código 84 y
  // caemos al modo Basic sin que el usuario note nada.
  const attempts: { label: string; headers: Record<string, string> }[] = [];
  if (CLIENT_ID && PASS_KEY) {
    attempts.push({ label: 'passKey', headers: { 'X-ClientId': CLIENT_ID, passKey: PASS_KEY } });
  }
  if (EMAIL && PASSWORD) {
    attempts.push({ label: 'email', headers: { email: EMAIL, password: PASSWORD } });
  }
  if (attempts.length === 0) {
    throw new Error(
      'Faltan credenciales de EMT. Define EXPO_PUBLIC_EMT_CLIENT_ID y EXPO_PUBLIC_EMT_PASSKEY ' +
        '(o EXPO_PUBLIC_EMT_EMAIL y EXPO_PUBLIC_EMT_PASSWORD) en .env'
    );
  }

  let lastError = 'sin respuesta';
  for (const attempt of attempts) {
    try {
      const res = await fetchWithTimeout(`${BASE}/v2/mobilitylabs/user/login/`, {
        headers: attempt.headers,
      });
      const json = await res.json();
      const data = json?.data?.[0];
      const accessToken = data?.accessToken;
      if (accessToken) {
        token = accessToken;
        const secs = toNumber(data?.tokenSecExpiration) ?? 600;
        tokenExpiresAt = Date.now() + Math.max(60, secs - 30) * 1000;
        return accessToken;
      }
      lastError = `${attempt.label}: código ${json?.code ?? res.status}`;
    } catch (error) {
      lastError = `${attempt.label}: ${String((error as Error).message ?? error)}`;
    }
  }
  throw new Error(`Login EMT fallido (${lastError})`);
}

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiresAt) {
    return token;
  }
  return login();
}

// Ejecuta una llamada añadiendo el accessToken; si el token ha caducado
// (código de error de sesión), reintenta una vez tras re-loguear.
async function call(path: string, init: RequestInit): Promise<any> {
  const run = async () => {
    const t = await getToken();
    const res = await fetchWithTimeout(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), accessToken: t },
    });
    return res.json();
  };
  let json = await run();
  const code = String(json?.code ?? '');
  // 80/81/90 ~ token no válido/caducado. Reintenta una vez.
  if (['80', '81', '90'].includes(code)) {
    token = undefined;
    json = await run();
  }
  return json;
}

const apiGet = (path: string) => call(path, { method: 'GET' });
const apiPost = (path: string, body: unknown) =>
  call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * Etiqueta pública de una línea, tal cual la publica la EMT.
 *
 * IMPORTANTE: los ceros a la izquierda son significativos y NO se deben quitar.
 * "001" (Atocha-Moncloa, línea eléctrica) y "1" (Cristo Rey-Prosperidad) son
 * líneas distintas, igual que "002" y "2". La API es coherente y devuelve la
 * misma etiqueta en el listado de líneas y en las llegadas.
 */
export function normalizeLabel(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function dedupeLabels(labels: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) {
    const label = normalizeLabel(l);
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

export interface NearbyResult {
  parada: Parada;
  meters: number;
}

/** Paradas cercanas a una coordenada, en orden de distancia (endpoint arroundxy). */
export async function getStopsAround(
  lat: number,
  lon: number,
  radius: number
): Promise<NearbyResult[]> {
  const json = await apiGet(
    `/v2/transport/busemtmad/stops/arroundxy/${lon}/${lat}/${radius}/`
  );
  const arr: any[] = Array.isArray(json?.data) ? json.data : [];
  return arr.map((s) => ({
    parada: {
      stopCode: String(s?.stopId ?? ''),
      stopName: String(s?.stopName ?? '').trim() || `Parada ${s?.stopId}`,
      lat: toNumber(s?.geometry?.coordinates?.[1]),
      lon: toNumber(s?.geometry?.coordinates?.[0]),
      lineasPaso: dedupeLabels((s?.lines ?? []).map((l: any) => l?.label)).join(', ') || undefined,
    },
    meters: toNumber(s?.metersToPoint) ?? 0,
  }));
}

/** Mapea la estructura de paradas que comparten `arroundxy` y `arroundstreet`. */
function mapNearby(arr: any[]): NearbyResult[] {
  return arr.map((s) => ({
    parada: {
      stopCode: String(s?.stopId ?? ''),
      stopName: String(s?.stopName ?? '').trim() || `Parada ${s?.stopId}`,
      lat: toNumber(s?.geometry?.coordinates?.[1]),
      lon: toNumber(s?.geometry?.coordinates?.[0]),
      lineasPaso: dedupeLabels((s?.lines ?? []).map((l: any) => l?.label)).join(', ') || undefined,
    },
    meters: toNumber(s?.metersToPoint) ?? 0,
  }));
}

/**
 * Paradas alrededor de una calle. Es la única forma que ofrece la API de buscar
 * paradas por nombre (no existe búsqueda libre por nombre de parada).
 */
export async function getStopsAroundStreet(
  street: string,
  radius = 200,
  streetNumber = 0
): Promise<NearbyResult[]> {
  const json = await apiGet(
    `/v1/transport/busemtmad/stops/arroundstreet/${encodeURIComponent(street)}/${streetNumber}/${radius}/`
  );
  return mapNearby(Array.isArray(json?.data) ? json.data : []);
}

/** Otras paradas alrededor de una parada dada. */
export async function getStopsAroundStop(stopId: string, radius = 300): Promise<NearbyResult[]> {
  const json = await apiGet(
    `/v2/transport/busemtmad/stops/arroundstop/${encodeURIComponent(stopId)}/${radius}/`
  );
  return mapNearby(Array.isArray(json?.data) ? json.data : []).filter(
    (n) => n.parada.stopCode !== String(stopId)
  );
}

export interface DiaServicio {
  /** LA (laborable), SA (sábado) o FE (festivo). */
  dayType: string;
  etiqueta: string;
  huelga: boolean;
}

/** Tipo de día de servicio y si hay huelga convocada (endpoint calendar). */
export async function getDiaServicio(): Promise<DiaServicio | undefined> {
  const ref = todayRef();
  const json = await apiGet(`/v1/transport/busemtmad/calendar/${ref}/${ref}/`);
  const d = json?.data?.[0];
  if (!d) {
    return undefined;
  }
  const dayType = String(d?.dayType ?? '').trim().toUpperCase();
  const etiquetas: Record<string, string> = {
    LA: 'Laborable',
    SA: 'Sábado',
    FE: 'Festivo',
  };
  return {
    dayType,
    etiqueta: etiquetas[dayType] ?? dayType,
    huelga: String(d?.strike ?? 'N').trim().toUpperCase() === 'S',
  };
}

export interface FranjaLinea {
  inicio?: string;
  fin?: string;
  frecMin?: string;
  frecMax?: string;
  texto?: string;
}

export interface HorarioLinea {
  dayType: string;
  etiqueta: string;
  sentido1?: FranjaLinea;
  sentido2?: FranjaLinea;
}

function mapFranja(d: any): FranjaLinea | undefined {
  if (!d) {
    return undefined;
  }
  const franja: FranjaLinea = {
    inicio: String(d?.StartTime ?? '').trim() || undefined,
    fin: String(d?.StopTime ?? '').trim() || undefined,
    frecMin: String(d?.MinimunFrequency ?? '').trim() || undefined,
    frecMax: String(d?.MaximumFrequency ?? '').trim() || undefined,
    texto: String(d?.FrequencyText ?? '').replace(/\/$/, '').trim() || undefined,
  };
  return franja.inicio || franja.texto ? franja : undefined;
}

/**
 * Horarios y frecuencias de una línea por tipo de día y sentido.
 * Ojo: este endpoint espera la ETIQUETA pública de la línea ("001"), no el id.
 */
export async function getHorariosLinea(label: string): Promise<HorarioLinea[]> {
  const json = await apiGet(
    `/v1/transport/busemtmad/lines/${encodeURIComponent(label)}/info/${todayRef()}/`
  );
  const arr: any[] = Array.isArray(json?.data?.[0]?.timeTable) ? json.data[0].timeTable : [];
  const etiquetas: Record<string, string> = { LA: 'Laborables', SA: 'Sábados', FE: 'Festivos' };
  return arr.map((t): HorarioLinea => {
    const dayType = String(t?.idDayType ?? '').trim().toUpperCase();
    return {
      dayType,
      etiqueta: etiquetas[dayType] ?? dayType,
      sentido1: mapFranja(t?.Direction1),
      sentido2: mapFranja(t?.Direction2),
    };
  });
}

/** Detalle de una parada (nombre, coordenadas y líneas que pasan). */
export async function getStopDetail(stopId: string): Promise<Parada | undefined> {
  const json = await apiGet(`/v1/transport/busemtmad/stops/${encodeURIComponent(stopId)}/detail/`);
  const s = json?.data?.[0]?.stops?.[0];
  if (!s) {
    return undefined;
  }
  return {
    stopCode: String(s?.stop ?? stopId),
    stopName: String(s?.name ?? '').trim() || `Parada ${stopId}`,
    lat: toNumber(s?.geometry?.coordinates?.[1]),
    lon: toNumber(s?.geometry?.coordinates?.[0]),
    lineasPaso: dedupeLabels((s?.dataLine ?? []).map((l: any) => l?.label)).join(', ') || undefined,
  };
}

export interface Aviso {
  titulo: string;
  descripcion?: string;
  desde?: Date;
  hasta?: Date;
  /** Identificador estable del aviso; sirve para no notificarlo dos veces. */
  guid?: string;
}

/** Parsea las fechas de los avisos, que vienen como "24/07/2026 21:00:00". */
function parseFechaEs(value: unknown): Date | undefined {
  const m = String(value ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) {
    return undefined;
  }
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const d = new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface Llegadas {
  tiempos: Tiempo[];
  avisos: Aviso[];
  /** Datos de la parada que devuelve la propia llamada (evita una petición extra). */
  info?: { stopName?: string; address?: string; lineasPaso?: string };
}

/** Quita etiquetas HTML de las descripciones de aviso, que vienen con markup. */
function stripHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte incidencias de la API a avisos, quedándose solo con los VIGENTES.
 * La API devuelve muchas incidencias programadas para días futuros; mostrarlas
 * todas haría inservible la pantalla.
 */
function mapAvisosVigentes(incidencias: any[]): Aviso[] {
  const ahora = Date.now();
  return incidencias
    .map((i): Aviso => ({
      titulo: stripHtml(i?.title),
      descripcion: stripHtml(i?.description) || undefined,
      desde: parseFechaEs(i?.rssFrom),
      hasta: parseFechaEs(i?.rssTo),
      guid: String(i?.guid ?? '').trim() || undefined,
    }))
    .filter((a) => {
      if (!a.titulo) {
        return false;
      }
      if (a.desde && ahora < a.desde.getTime()) {
        return false;
      }
      if (a.hasta && ahora > a.hasta.getTime()) {
        return false;
      }
      return true;
    });
}

/** Incidencias vigentes de una línea concreta (la API sí filtra por línea). */
export async function getAvisosLinea(lin: string): Promise<Aviso[]> {
  const json = await apiGet(
    `/v1/transport/busemtmad/lines/incidents/${encodeURIComponent(lin)}/`
  );
  const d = json?.data?.[0];
  const items: any[] = Array.isArray(d?.ListaIncident?.data) ? d.ListaIncident.data : [];
  return mapAvisosVigentes(items);
}

/**
 * Llegadas en tiempo real de una parada. Opcionalmente devuelve también los
 * avisos/incidencias que afectan a la parada y los datos de la propia parada.
 */
export async function getLlegadas(
  stopId: string,
  opts?: { avisos?: boolean; info?: boolean }
): Promise<Llegadas> {
  const conAvisos = opts?.avisos ?? false;
  const conInfo = opts?.info ?? false;
  const json = await apiPost(
    `/v2/transport/busemtmad/stops/${encodeURIComponent(stopId)}/arrives/`,
    {
      cultureInfo: 'ES',
      Text_StopRequired_YN: conInfo ? 'Y' : 'N',
      Text_EstimationsRequired_YN: 'Y',
      Text_IncidencesRequired_YN: conAvisos ? 'Y' : 'N',
    }
  );
  const bloque = json?.data?.[0];

  const arrive: any[] = Array.isArray(bloque?.Arrive) ? bloque.Arrive : [];
  const tiempos = arrive
    .map((a): Tiempo => {
      const secs = toNumber(a?.estimateArrive);
      const isFar = secs === undefined || secs >= 999999;
      const min = isFar ? undefined : Math.max(0, Math.round(secs / 60));
      const dist = toNumber(a?.DistanceBus);
      return {
        linea: normalizeLabel(a?.line),
        minutos: min,
        tiempoText: isFar ? '+45 min' : min === 0 ? 'En parada' : `${min} min`,
        distanciaM: dist,
        distanciaText: dist !== undefined ? `${dist} m` : '',
        destino: String(a?.destination ?? '').trim() || undefined,
      };
    })
    .sort((x, y) => (x.minutos ?? Number.MAX_SAFE_INTEGER) - (y.minutos ?? Number.MAX_SAFE_INTEGER));

  const incidencias: any[] = Array.isArray(bloque?.Incident?.ListaIncident?.data)
    ? bloque.Incident.ListaIncident.data
    : [];
  // La API devuelve TODAS las incidencias de la red (una veintena), muchas
  // programadas para días futuros. Nos quedamos solo con las vigentes ahora
  // mismo; si no, la pantalla de parada se llenaría de avisos irrelevantes.
  const avisos = mapAvisosVigentes(incidencias);

  const stopInfo = bloque?.StopInfo?.[0];
  const info = stopInfo
    ? {
        stopName: String(stopInfo?.stopName ?? '').trim() || undefined,
        address: String(stopInfo?.Direction ?? '').trim() || undefined,
        lineasPaso:
          dedupeLabels((stopInfo?.lines ?? []).map((l: any) => l?.label)).join(', ') || undefined,
      }
    : undefined;

  return { tiempos, avisos, info };
}

/** Atajo usado por las acciones de rotor: solo los tiempos. */
export async function getTiempos(stopId: string): Promise<Tiempo[]> {
  return (await getLlegadas(stopId)).tiempos;
}

// Fecha de referencia YYYYMMDD que piden los endpoints de líneas.
function todayRef(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${m}${day}`;
}

/** Texto blanco o negro según el brillo del fondo, para que el badge contraste. */
function textoParaFondo(hex: string): string {
  const c = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) {
    return 'FFFFFF';
  }
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Luminancia relativa aproximada (ITU-R BT.601).
  const luz = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luz > 0.6 ? '000000' : 'FFFFFF';
}

/**
 * Listado de líneas. Se usa la v2 porque, además de los nombres, devuelve el
 * `color` corporativo y el `order` oficial de cada línea.
 */
export async function getLineas(): Promise<Linea[]> {
  const json = await apiGet(`/v2/transport/busemtmad/lines/info/${todayRef()}/`);
  const arr: any[] = Array.isArray(json?.data) ? json.data : [];
  return arr
    .map((l, index): Linea => {
      const label = normalizeLabel(l?.label ?? l?.line);
      const nameA = String(l?.nameA ?? '').trim();
      const nameB = String(l?.nameB ?? '').trim();
      const color = String(l?.color ?? '').replace('#', '').trim() || '1c5aa0';
      return {
        id: String(l?.line ?? label),
        lin: label,
        nombre: label,
        descripcion: [nameA, nameB].filter(Boolean).join(' - '),
        colorFondo: color,
        colorTexto: textoParaFondo(color),
        orden: toNumber(l?.order) ?? index,
      };
    })
    .filter((l) => l.lin)
    .sort((a, b) => a.orden - b.orden || a.lin.localeCompare(b.lin));
}

/**
 * Paradas de una línea por sentido (1 o 2).
 * Ojo: aquí `dataLine` de cada parada es un array de **IDs internos** de línea
 * (p.ej. ["361","530"]), no de etiquetas. Con `labelById` (que se construye desde
 * el listado de líneas) los traducimos a etiquetas públicas para el rotor.
 */
export async function getStopsLinea(
  lineId: string,
  direction: 1 | 2,
  labelById?: Record<string, string>
): Promise<Parada[]> {
  const json = await apiGet(
    `/v1/transport/busemtmad/lines/${encodeURIComponent(lineId)}/stops/${direction}/`
  );
  const stops: any[] = Array.isArray(json?.data?.[0]?.stops) ? json.data[0].stops : [];
  return stops.map((s, index): Parada => {
    const ids: unknown[] = Array.isArray(s?.dataLine) ? s.dataLine : [];
    const labels = dedupeLabels(
      ids.map((id) => labelById?.[String(id)] ?? normalizeLabel(id))
    );
    return {
      stopCode: String(s?.stop ?? s?.stopId ?? ''),
      stopName: String(s?.name ?? s?.stopName ?? '').trim(),
      lat: toNumber(s?.geometry?.coordinates?.[1]),
      lon: toNumber(s?.geometry?.coordinates?.[0]),
      lineasPaso: labels.join(', ') || undefined,
      sentido: direction,
      ordenSentido: index,
    };
  });
}
