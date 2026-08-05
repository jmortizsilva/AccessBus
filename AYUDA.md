# Ayuda de AccessBus

AccessBus te dice cuándo llega tu autobús en Madrid. Es una app **independiente**
(no oficial) que usa los datos públicos en tiempo real de **EMT Madrid MobilityLabs**.

No necesita registro, no muestra publicidad y no envía tu ubicación a ningún sitio:
las coordenadas se usan solo dentro del teléfono para calcular qué paradas tienes cerca.

---

## Las cuatro pestañas

- **Inicio**: tus paradas favoritas y las que tienes cerca.
- **Líneas**: todas las líneas de la EMT, con su recorrido y horarios.
- **Buscar**: encontrar una parada por calle o por su número.
- **Ajustes**: preferencias de la app.

---

## Inicio

Al entrar, la app **actualiza tu ubicación automáticamente** y muestra las paradas
cercanas ordenadas por distancia. La primera vez tendrás que pulsar
**"Actualizar ubicación"** para conceder el permiso.

Arriba verás el **servicio de hoy** (laborable, sábado o festivo) y, si la hubiera,
un aviso de **huelga convocada**.

- **Paradas favoritas**: las que hayas guardado. Se conservan aunque cierres la app.
- **Paradas cercanas**: dentro del radio que elijas en Ajustes (300 m por defecto).

---

## Acciones del rotor de VoiceOver (lo más útil)

En **cualquier lista de paradas** (favoritas, cercanas, resultados de búsqueda y
paradas de una línea), cada parada ofrece estas acciones en el **rotor de acciones**:

- **Una acción por cada línea** que pasa por la parada. Al activarla, la app
  **consulta el tiempo en ese momento** y te lo dice en voz alta. Por ejemplo:
  *"Línea 27, en 4 minutos, a 1200 metros"*. Los datos son siempre frescos: cada vez
  que activas la acción se hace una consulta nueva.
- **"Líneas de la parada"**, con el número de líneas entre paréntesis. Verbaliza la
  **lista completa** de líneas con su destino. Útil en paradas grandes: la de Cibeles
  tiene 20 líneas.
- **"Añadir a favoritos"** o **"Quitar de favoritos"**.

Y el **doble toque** de siempre abre la parada.

---

## Detalle de una parada

Se abre con doble toque sobre cualquier parada. Arriba están el nombre y el número
de parada; se vuelve atrás con el botón de la esquina superior izquierda.

Contiene:

- **Próximos autobuses**: línea, destino, minutos que faltan y a cuántos metros está
  el autobús. Se actualiza solo cada 30 segundos.
  - *"En parada"* significa que el autobús ya está ahí.
  - *"+45 min"* significa que falta más de tres cuartos de hora.
  - **Al pulsar una línea** se abre su recorrido, ya en el sentido de ese autobús,
    para poder seguir el viaje parada a parada.
- **Vigilar esta parada**: ver más abajo.
- **Avisos**: incidencias que están afectando ahora mismo (obras, manifestaciones,
  cortes). Solo se muestran las vigentes en este momento.
- **Líneas en esta parada**: todas las líneas que paran ahí, con su destino. Cada una
  es un elemento independiente, así que puedes recorrerlas una a una.
- **Otras paradas cerca**: por si te conviene caminar a otra parada.
- Botón para **añadir o quitar de favoritos**.

---

## Vigilar una parada

En el detalle de una parada, el botón **"Vigilar esta parada"** hace que la app te
avise cuando un autobús esté llegando. Recibirás una **notificación y un aviso hablado**
como: *"Línea 116 llegando. Vía Lusitana-Faro: llega en 2 minutos, hacia Embajadores"*.

La antelación se elige en Ajustes (2, 3, 5 o 10 minutos).

**Importante**: la vigilancia funciona **con la app abierta**. Es una limitación de
iOS: el sistema no permite que una app consulte datos en segundo plano cada pocos
segundos, que es lo que haría falta para un aviso de "llega en 2 minutos". Pensada
para cuando estás esperando en la parada con el móvil en la mano.

---

## Líneas

Muestra todas las líneas de la EMT. Como son más de 230, arriba hay un **buscador**
que filtra **por número o por destino** (por ejemplo, "Moncloa").

Ojo con un detalle de la EMT: **la línea 1 y la línea 001 son distintas** (igual que
la 2 y la 002). Las que llevan ceros delante son otras líneas, con su propio color.

Al entrar en una línea encontrarás:

- **Seguir esta línea**: para recibir avisos de sus incidencias.
- **Cambiar sentido**: alterna entre los dos sentidos, indicando hacia dónde va.
- **Horarios y frecuencias**: primera y última hora y cada cuántos minutos pasa, por
  sentido y por tipo de día. El día de hoy aparece el primero.
- **Listado de paradas** en orden. Al recorrerlas con VoiceOver, cada parada dice su
  nombre y sus **correspondencias con el destino**, por ejemplo:
  *"Vía Lusitana-Faro. Enlace con línea 116 hacia Embajadores."*
  En paradas con muchas líneas se resumen las primeras; para oírlas todas, usa la
  acción de rotor **"Líneas de la parada"**.

---

## Buscar

Dos formas de encontrar una parada:

- **Por nombre de calle**: escribe la calle (por ejemplo, "Gran Vía") y pulsa Buscar.
  Aparecen las paradas de esa zona con su distancia.
- **Por número de parada**: si escribes solo cifras, aparece un acceso directo para
  ir a esa parada.

---

## Ajustes

- **Radio de búsqueda** de paradas cercanas: de 300 m a 3 km.
- **Avisos de líneas seguidas**: activa o desactiva las notificaciones de incidencias.
  Se comprueban al abrir la app y al volver a ella; solo se avisa de las **novedades**.
- **Líneas seguidas**: las que has marcado desde la pantalla de cada línea.
- **Aviso de llegada**: con cuánta antelación avisar al vigilar una parada.
- **Versión** de la app.

---

## Preguntas frecuentes

**¿Por qué a veces no aparece ningún autobús?**
Porque no hay ninguno en camino en ese momento: puede ser fuera de horario, o que el
siguiente esté a más de 45 minutos.

**¿Los tiempos son fiables?**
Vienen del sistema en tiempo real de la EMT, calculados con la posición GPS de los
autobuses. Pueden variar con el tráfico.

**¿Funciona sin conexión?**
No para los tiempos, que necesitan conexión. Las líneas, las paradas y las
correspondencias sí están guardadas en la app.

**¿Gasta muchos datos o batería?**
Muy poco. La pantalla de una parada se actualiza cada 30 segundos (cada 20 al vigilar),
y solo mientras la tienes abierta.

---

## Aviso

AccessBus es una aplicación independiente, sin relación con la EMT ni con el
Ayuntamiento de Madrid. Fuente de los datos: **EMT Madrid MobilityLabs**.
