# Fases B y C — Modelo de datos y motor de tarifas

## Decisiones del cliente (2026-10-09)
- Capacidades derivadas del tarifario: **confirmadas**.
- Adicionales: catálogo **ilimitado** editable por el administrador. En cada cotización solo aparecen los que el usuario agrega (del catálogo, con precio editable como snapshot) o **líneas libres** fuera del catálogo. Los precios los carga el cliente (hoy en 0).
- Obsequio ($2.000.000: fotografía y vestido): **ya incluido** en el precio. No se suma; se muestra como texto informativo (`obsequio_texto`).
- IVA: **no aplica** (`iva_porcentaje = 0`, configurable).
- "Precio por invitado: 60.000" → **interpretado** como cargo por invitado adicional entre tramos (ver abajo). **Supuesto por confirmar.**

## Modelo (11 hojas, `src/backend/Config.gs`)
Exactamente las tablas del brief. Importes numéricos sin símbolos; fechas AAAA-MM-DD como texto; IDs `PREFIJO-0001`. Lectura/escritura siempre por nombre de encabezado.

## Cómo se migró el Excel (`tools/build_seed.py` → `SeedData.gs`)
| Origen | Destino |
|---|---|
| 7 salones | 7 `PROPIEDADES` (capacidad = rango tarifado) |
| 99 precios de `PRECIOS` | 99 `TARIFAS`, `modalidad=mixta`, `personas_desde=N`, `personas_hasta=N+9` (el último tramo de cada casa = su capacidad máxima), `cargo_persona_adicional=60000` |
| 6 adicionales | `ADICIONALES` (categoría "General", precio 0) |
| Configuración | `CONFIGURACION` (vigencia 30, IVA 0, contactos de la infografía) |

## Reglas del motor (`PricingService.gs`, lógica pura)
- Elegible = propiedad activa **y** invitados ≤ capacidad máxima **y** exactamente una tarifa activa/vigente que cubra los invitados. Sin tarifa → no se cotiza.
- `mixta`: precio del tramo + (invitados − inicio del tramo) × $60.000. **Tope:** no supera el precio del siguiente tramo (ej. Granada 39 invitados = $10.300.000, no $10.440.000). Desactivable con `tope_siguiente_tramo`.
- Por debajo del primer tramo (ej. 20 invitados) no hay tarifa → no se cotiza automáticamente.
- Comparativa: alternativas independientes; la estructura no contiene total ni subtotal.
- Personalizada: casa + líneas → subtotal, descuento (exige `autorizado_por`), IVA, total. Redondeo a peso entero.
- Vencimiento = emisión + 30 días calendario.
- Rangos solapados (por propiedad y vigencias que se cruzan) se detectan en `validateTariffs` y se bloquean al guardar (`PropertyService.saveTariff`).

## Pruebas (`node tests/run.js`) — 28 aprobadas, 0 fallidas
Cubren: elegibilidad 80/100/110, sin tarifa, solapes, consistencia de las 99 tarifas migradas, comparativa sin total, personalizada (agregar/cambiar/eliminar), descuentos, IVA, vencimiento, repositorio por encabezados, IDs, catálogo ilimitado, autorización.
**Límite:** el repositorio se probó con un doble de prueba de Google Sheets en Node, no con Google real. Falta validar en Apps Script real: `LockService`, `SpreadsheetApp`, formato de fechas, rendimiento con hojas grandes.
**Pendiente (fases D–H):** interfaz, PDF, clientes/cotizaciones/versionado, seguimiento, dashboard, despliegue.
