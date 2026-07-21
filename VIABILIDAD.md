# Notas técnicas: API de EMT Madrid (MobilityLabs)

_Investigación: 12 de julio de 2026_

## Resumen

La EMT de Madrid ofrece una **API oficial, documentada y con licencia Open Data**
(MobilityLabs), sobre **HTTPS**. Cubre todo lo que necesita la app: líneas, paradas,
paradas cercanas a una coordenada y tiempos de paso en tiempo real.

## Acceso y autenticación

- Base: `https://openapi.emtmadrid.es/`
- **Requiere credenciales** (no hay acceso anónimo). Tres niveles:
  - **Basic**: cabeceras `email` + `password` de una cuenta registrada en
    https://mobilitylabs.emtmadrid.es → hasta **25.000 peticiones/día**.
  - **Advanced**: además `X-ClientId` + `X-ApiKey` tras registrar la app → 250.000/día.
  - **Protected** (recomendado): `X-ClientId` + `passKey`. No expone la contraseña
    personal y la sesión dura hasta 86.400 s.
- El **login** devuelve un `accessToken` que viaja en la cabecera `accessToken` del
  resto de llamadas, con `tokenSecExpiration` para saber cuándo renovarlo.

## Endpoints que usa la app

| Necesidad | Endpoint |
|-----------|----------|
| Login / token | `GET /v2/mobilitylabs/user/login/` |
| Tiempos de llegada en tiempo real | `POST /v2/transport/busemtmad/stops/<stopId>/arrives/` |
| Paradas cercanas a una coordenada | `GET /v2/transport/busemtmad/stops/arroundxy/<lon>/<lat>/<radio>/` |
| Detalle de una parada | `GET /v1/transport/busemtmad/stops/<stopId>/detail/` |
| Listado de líneas | `GET /v1/transport/busemtmad/lines/info/<fecha>/` |
| Paradas de una línea por sentido | `GET /v1/transport/busemtmad/lines/<lineId>/stops/<sentido>/` |

Notas de las respuestas:
- `arrives` devuelve `estimateArrive` en **segundos** (`999999` = más de 45 minutos en
  líneas convencionales) y `DistanceBus` en metros, además de `line` (etiqueta pública),
  `destination` y la posición GPS del autobús.
- `arroundxy` ya devuelve las paradas **ordenadas por distancia** con `metersToPoint` y
  las líneas de cada parada: no hace falta construir un índice global de paradas.
- La API **no busca paradas por nombre**; sí por número exacto de parada.

## Licencia y condiciones

Uso gratuito. La API pide expresamente **citar "EMT Madrid MobilityLabs" como fuente de
los datos**. Conviene además dejar claro que la app es independiente y no oficial.

## Manejo de credenciales

El `passKey` (o el email/password) son **secretos**. Dos opciones:

1. **En la app** vía variables `EXPO_PUBLIC_*` (fichero `.env`, no versionado). Se
   embeben en el bundle: vale para desarrollo y uso personal.
2. **Proxy propio** (recomendado si se publica): una función serverless guarda las
   credenciales, hace el login y reenvía las llamadas; la app nunca lleva el secreto.
   Se activa definiendo `EXPO_PUBLIC_EMT_PROXY_BASE`.

## Fuentes
- API Reference: https://apidocs.emtmadrid.es/
- Portal MobilityLabs: https://mobilitylabs.emtmadrid.es/
- Datos abiertos EMT: https://datos.emtmadrid.es/
