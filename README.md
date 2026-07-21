# BusMadrid (EMT Madrid)

App para consultar los autobuses de la EMT de Madrid: líneas, paradas, paradas cercanas
y tiempos de paso en tiempo real. **React Native + Expo + TypeScript**, pensada para ser
**accesible con VoiceOver**. Datos vía la API oficial de **EMT Madrid MobilityLabs**
(HTTPS). Ver [VIABILIDAD.md](VIABILIDAD.md) para el detalle de la API.

> App **independiente y no oficial**, sin relación con la EMT. Fuente de los datos:
> EMT Madrid MobilityLabs.

## Estado

Esqueleto funcional que **compila y empaqueta** (typecheck + bundle iOS OK). Falta
**enchufar credenciales** y verificar contra la API real.

### Hecho
- Config: nombre "BusMadrid", bundle `com.jmortizsilva.busmadrid`, HTTPS (sin excepción
  ATS), tema azul, iconos propios neutros.
- Capa de servicio [`src/services/emt.ts`](src/services/emt.ts): login (modo `passKey`
  o email/password) con gestión y renovación de token, y endpoints de **llegadas en
  tiempo real**, **paradas cercanas** (`arroundxy`), **detalle de parada**, y —con mapeo
  defensivo— líneas y paradas de línea.
- Estado [`src/state/AppContext.tsx`](src/state/AppContext.tsx): favoritos, ubicación,
  radio de búsqueda configurable y cercanas resueltas por la API.
- Pantallas: Inicio (favoritas + cercanas), Líneas (+ consulta por número de parada),
  detalle de parada (pantalla con atrás nativo de iOS) y Ajustes.

### Accesibilidad (VoiceOver)
- Pestañas nativas reales (`react-native-bottom-tabs`).
- **Acciones de rotor unificadas** en las listas de paradas: doble toque abre la parada;
  una acción por cada línea consulta y **anuncia su tiempo en vivo**; otra añade o quita
  de favoritos.
- Etiquetas, encabezados y anuncios en español; objetivos táctiles de 44 pt.

### Verificado contra la API real (21/07/2026)
- Login, listado de líneas (236), paradas de línea por sentido, paradas cercanas,
  detalle de parada y llegadas en tiempo real: **todo correcto**.
- Dos ajustes que hicieron falta y ya están aplicados:
  - La API devuelve la etiqueta de línea **con ceros** en unos endpoints ("001") y
    **sin ellos** en las llegadas ("1"): se normaliza para que casen (si no, las
    acciones de rotor no encontrarían el tiempo de la línea).
  - En las paradas de una línea, `dataLine` son **IDs internos**, no etiquetas: se
    traducen con el listado de líneas.

### Pendiente
1. **`passKey` de la app registrada devuelve 403/código 84.** La cuenta funciona
   (modo Basic con email), así que es la app del portal la que no está habilitada.
   El servicio **cae automáticamente a Basic** si el passKey falla, así que la app
   funciona igualmente.
2. Búsqueda de paradas por **nombre** (la API solo busca por número); se añadiría con
   GTFS estático o un índice propio.
3. Para publicar: valorar un **proxy** que guarde las credenciales
   (`EXPO_PUBLIC_EMT_PROXY_BASE`).

## Credenciales

Van en `.env` (no versionado) como variables `EXPO_PUBLIC_*`. Admite dos modos:
`X-ClientId` + `passKey` (recomendado, tras registrar la app en el portal) o
email + password de la cuenta. Ver [.env.example](.env.example).

## Comprobaciones

```
npm install
npm run typecheck
npx expo export --platform ios   # empaqueta (detecta errores de import)
```
