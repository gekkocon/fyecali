# Fase A — Inventario de datos y dependencias

Fecha de inspección: 2026-10-09. Fuentes originales conservadas sin modificar en `/legacy`.
Datos extraídos en `/data/seed` (regenerables con `python3 -I tools/extract_legacy.py`).

## 1. Archivos recibidos

| Archivo | Contenido | Destino |
|---|---|---|
| `Cotizador_Eventos_Pro_automatizado.xlsm` | Cotizador actual: 6 hojas, 3 tablas, 2 gráficos, macro VBA | Fuente de tarifas, adicionales, estructura |
| `Libro1.xlsx` | Tarifario "base + obsequio" por salón y número de invitados | Fuente primaria de tarifas |
| `GenerarPDF.bas` | Macro VBA de exportación PDF | Solo referencia (no portable a Apps Script) |
| `Paquete_15_Años_infografía.pdf` | Infografía 1 página (730×6060 pt), 4 secciones | Identidad visual, contenido del paquete, contactos |

## 2. Propiedades (7) y capacidad derivada de la tarifa

La capacidad no está declarada en ningún archivo; se **deriva** de los tramos con precio. Debe ser confirmada por el cliente.

| Propiedad (Excel) | Nombre en infografía | Desde | Hasta | Tramos |
|---|---|---|---|---|
| Granada | Salón Granada | 30 | 100 | 8 |
| Vallano | Mansión Vallano | 30 | **100** | 8 |
| Casa 74 | Casa 74 | 30 | 200 | 18 |
| Casa 4 | Casa 4 | 30 | 200 | 18 |
| Casa 5 | Casa 5 | 30 | 170 | 15 |
| Orquideorama | Orquideorama | 50 | 200 | 16 |
| Casa Pance | Casa Pance | 50 | 200 | 16 |

- Vallano máx. 100 coincide con el ejemplo del brief (110 invitados → no elegible).
- 99 precios en total, sin huecos dentro de cada rango. Celdas vacías o `-` = sin tarifa.
- Casa 5 termina en 170 (180–200 sin precio); Granada/Vallano terminan en 100.

## 3. Modelo tarifario real

- **Escalonado por tramos de 10 invitados**, precio **fijo de paquete** por tramo (no hay valor por persona explícito).
- `Libro1.xlsx`: precio = base + **Obsequio $2.000.000** (celda M3, fórmula `=base+$M$3`). La hoja `PRECIOS` del .xlsm contiene exactamente el precio ya sumado. Verificado por script: **0 diferencias** en 99 precios.
- Se conserva `precio_sin_obsequio` además del `precio_lista` en `tarifas_legacy.json`.
- El Excel busca coincidencia **exacta** (`MATCH(...,0)`): 85 invitados devuelve 0.

## 4. Adicionales (hoja ADICIONALES, 26 filas)

6 definidos, 20 vacíos (A007–A026 inactivos). **Todos con precio 0** → falta el precio comercial:
A001 Pista de cristal con luces y flores · A002 DJ en vivo · A003 Plataforma 360° (2 h) · A004 Barra coctelera · A005 Ventury · A006 Plato valluno.
La infografía añade **"Neblina"** como adicional separado de "Ventury" (el Excel lo describe como efecto de neblina). No existe categoría ni unidad de cobro.

## 5. Cotizador actual (hoja COTIZADOR)

Campos: Cliente (C4), Fecha evento (C5), N.º cotización `COT-0501` (F5, texto fijo), Tipo de evento (C6; lista: 15 años, Boda, Cumpleaños, Corporativo, Otro), Invitados (C7), Salón (C8), Asesor (C9), texto de paquete (B12), 10 filas de adicionales (B17:E26), total salón/adicionales/cotización (E28:E30). Texto de paquete: *"Una celebración diseñada para crear momentos inolvidables…"*.
HISTORIAL: 500 filas prenumeradas **sin datos** (columnas N°, Fecha registro, Cliente, Fecha evento, Tipo evento, Invitados, Salón, Precio salón, Adicionales, Total, Estado="Cotizada"). DASHBOARD: conteos por salón y por rango de invitados + 2 gráficos. CONFIGURACIÓN: empresa "TU EMPRESA", **validez 15 días**, moneda COP; teléfono/correo/dirección vacíos.

**No hay clientes ni cotizaciones históricas que migrar.** Todo el historial está vacío.

## 6. Macros VBA — hallazgos

- `GenerarPDF.bas` exporta la hoja `COTIZACION`, que **no existe** en el .xlsm (la hoja se llama `COTIZADOR`).
- `NuevaCotizacion` limpia `B15:B34` / `C15:C34`, pero los adicionales están en filas 17–26 (la fila 16 es el encabezado) y escribe `C7=30`/`C8="Granada"`. Desalineada con la hoja actual.
- El .xlsm contiene `vbaProject.bin`; el código embebido no se extrajo (no hay herramienta confiable disponible); se asume equivalente al .bas.
- Nombre de archivo actual: `Cotizacion_<cliente>_<yyyymmdd_hhnnss>.pdf` → se reemplaza por `FEC-COT-AAAA-NNNN-Cliente-vNN.pdf`.
- Equivalencias a replicar: limpieza de caracteres inválidos en nombres, y reinicio de formulario.

## 7. Identidad visual (infografía)

- **Estilo:** lujo oscuro y editorial; fondo casi negro, dorado como acento, mucho espacio, fotografía de evento a sangre.
- **Colores medidos (muestreo de píxeles):** fondo `#0B0A09`; superficie/banda `#1C1B19` y `#272624`; dorado etiquetas `#BB9956`; dorado claro (títulos grandes) `#E6CF9A`; crema texto `#F2EDE4`; gris secundario `#8B8473`; separadores `#2D2520`/`#3A3226`. Logo: azul marino (escudo) + dorado metálico.
- **Tipografía:** títulos **Bodoni Moda** (a menudo en cursiva, tamaños grandes); texto y etiquetas **Jost** (Light/Regular/Medium), etiquetas en MAYÚSCULAS con interletrado amplio. Ambas son Google Fonts.
- **Logotipo:** escudo "F&E" azul marino con corona dorada y script dorado "Fiestas y Eventos Cali" sobre negro (241×244 px: baja resolución, para PDF conviene el original vectorial o ≥1000 px).
- **Imágenes:** fotos cálidas de evento, recortes rectangulares sin bordes ni sombras, superpuestas con degradados oscuros.
- **Contraste:** crema/dorado claro sobre negro = alto; el gris `#8B8473` sobre negro ≈ 5,3:1 (aceptable en texto pequeño). Dorado `#BB9956` sobre blanco **no** cumple AA: en PDF con fondo claro usar dorado oscuro (p. ej. `#8A6D2F`, contraste calculado 4,9:1 sobre blanco; `#BB9956` da 2,7:1).
- **Contacto (infografía):** Asesora Ángela Morales García 302 303 5472 · Asesora Stephany López 318 417 1201 · Instagram `@fiestasyeventoscali02`. Lema: "Tu fiesta, nuestra pasión". Sin dirección ni correo.
- **Contenido del paquete 15 años (reutilizable en PDF):** I. El lugar, II. Decoración, III. Montaje de mesas, IV. Banquete, V. Música y servicio; Obsequio del mes (vestidos, paquete de fotografía, hora loca); Adicionales; Sedes disponibles.
- Imágenes extraídas en `/assets` (logo + 6 fotos de la infografía, solo como referencia/fotos de muestra; **no** son fotos de las propiedades).

## 8. Brechas frente al brief (datos faltantes — se necesitan del cliente)

1. **Capacidad máxima/mínima declarada** de cada propiedad (hoy derivada de la tarifa).
2. **Fotografías y descripciones** de las 7 propiedades (ninguna recibida).
3. **Precios de los adicionales** (todos en 0), categorías y unidad de cobro.
4. **Regla para invitados entre tramos** (ej. 85): ¿cobrar el tramo superior (90) o rechazar?
5. **El obsequio de $2.000.000**: ¿ya incluido siempre en el precio, o es variable/mensual ("del mes")? ¿Se muestra en PDF?
6. **Impuestos (IVA) y descuentos autorizados:** tasas y quién autoriza; si el precio de lista incluye IVA.
7. **Validez:** Excel dice 15 días, el brief 30 → se usará 30 salvo indicación.
8. Datos corporativos faltantes: correo, dirección, NIT/razón social, condiciones comerciales (anticipo, cancelación), cuentas de pago.
9. Logo en alta resolución; cuenta Google (Workspace) y lista de usuarios autorizados/administradores.
10. Si "Paquete básico 15 años" es un producto con precio propio o solo la descripción del salón; ¿hay otros paquetes (bodas, etc.)?
11. Mapeo de modalidades: ¿"cotización personalizada" incluye el contenido del paquete 15 años como texto estándar?

## 9. Dependencias y restricciones técnicas

| Tema | Estado |
|---|---|
| Acceso a Google Workspace / Drive / Sheets desde esta sesión | **No disponible**: no se puede ejecutar Apps Script ni exportar PDF reales. Todo lo de Drive/PDF quedará como código + guía, marcado "no validado" hasta ejecutarse |
| `clasp` | No instalado (solo `node` 22 y Python 3). Se puede instalar vía npm si hay red; el login OAuth requiere al usuario |
| Pruebas lógicas (tarifas, cálculo, versionado) | Ejecutables localmente en Node con un repositorio de datos simulado, separando la lógica pura de las llamadas a `SpreadsheetApp`/`DriveApp` |
| Motor PDF | Candidato 1: HTML → `Blob.getAs('application/pdf')` (motor nativo limitado, CSS de impresión no fiable). Candidato 2: plantilla Google Docs → `DriveApp`/export PDF (más fiable). Decisión y evidencia en Fase E, sin pruebas reales no se declarará fidelidad |
| Fuentes Jost/Bodoni Moda | Disponibles en Google Fonts; su render en export a PDF desde Docs/HTML **no validado** |
| Fórmulas/macros Excel | No se migran; lógica reescrita (rango → `TARIFAS`; `MATCH` exacto → regla de tramo configurable) |
| Dependencia externa | Ninguna librería/CDN prevista. Fuentes solo por Google Fonts si el HtmlService lo permite (a validar) |

## 10. Mapeo de migración (Excel → modelo del brief)

- `PRECIOS` (99 celdas) → `TARIFAS`: una fila por (propiedad, tramo): `personas_desde = tramo−9` (con el primer tramo desde el mínimo), `personas_hasta = tramo`, `modalidad = fija`, `precio_base = precio_lista`. *(Supuesto pendiente del punto 4.)*
- Encabezados `PRECIOS!B1:H1` → `PROPIEDADES` (7 filas; capacidades derivadas, `estado=activa`, imagen vacía).
- `ADICIONALES` → `ADICIONALES` (6 activos, `precio_unitario=0`, categoría vacía, `unidad_cobro="unidad"` por defecto).
- `CONFIGURACIÓN` → `CONFIGURACION` (`vigencia_dias=30`, `moneda=COP`, `obsequio_cop=2000000`, contactos de la infografía).
- `HISTORIAL`/`DASHBOARD`: sin datos que migrar; la lógica del dashboard se recrea desde cero.
- Todo lo anterior queda preservado en `data/seed/*.json`.

## 11. Siguiente paso propuesto (Fase B)

Con tus respuestas a la sección 8 (mínimo: puntos 1, 3, 4, 5 y 6), definir el esquema de hojas y un script de migración. Mientras tanto avanzaré con lo que no depende de esos datos.
