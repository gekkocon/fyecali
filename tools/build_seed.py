"""Genera src/backend/SeedData.gs a partir de data/seed/*.json (migración del Excel original).
Uso: python3 -I tools/build_seed.py"""
import json
T = json.load(open("data/seed/tarifas_legacy.json"))
AD = json.load(open("data/seed/adicionales_legacy.json"))
NOMBRES = {"Granada": "Salón Granada", "Vallano": "Mansión Vallano"}
props, tar = [], []
for i, v in enumerate(T["venues"], 1):
    rows = sorted([x for x in T["tarifas"] if x["venue"] == v], key=lambda x: x["invitados"])
    pid = "PROP-%03d" % i
    props.append({"property_id": pid, "nombre": NOMBRES.get(v, v), "descripcion": "",
                  "capacidad_minima": rows[0]["invitados"], "capacidad_maxima": rows[-1]["invitados"],
                  "estado": "activa", "imagen_drive_id": "", "observaciones": "Capacidad derivada del tarifario original"})
    for j, r in enumerate(rows, 1):
        last = j == len(rows)
        tar.append({"tarifa_id": "TAR-%03d-%02d" % (i, j), "property_id": pid, "personas_desde": r["invitados"],
                    "personas_hasta": r["invitados"] if last else r["invitados"] + 9,
                    "modalidad": "mixta", "precio_base": r["precio_lista"], "precio_por_persona": 0,
                    "cargo_persona_adicional": 60000, "vigencia_inicio": "", "vigencia_fin": "", "activa": True})
adds = [{"adicional_id": a["adicional_id"], "categoria": "General", "nombre": a["nombre"], "descripcion": a["descripcion"],
         "unidad_cobro": "unidad", "precio_unitario": a["precio"], "activo": a["activo"]} for a in AD]
conf = [
 ("empresa_nombre", "Fiestas y Eventos Cali", "Nombre comercial"),
 ("vigencia_dias", 30, "Vigencia de la cotización en días calendario"),
 ("moneda", "COP", "Moneda"),
 ("iva_porcentaje", 0, "IVA no aplica"),
 ("cargo_invitado_adicional", 60000, "Cargo por invitado entre tramos (COP)"),
 ("tope_siguiente_tramo", True, "El cálculo entre tramos no supera la tarifa del siguiente tramo"),
 ("obsequio_texto", "Incluye obsequio: fotografía y vestido", "Texto informativo; ya está incluido en el precio, no se suma"),
 ("contacto_1", "Ángela Morales García · 302 303 5472", "Asesora"),
 ("contacto_2", "Stephany López · 318 417 1201", "Asesora"),
 ("instagram", "@fiestasyeventoscali02", "Red social"),
 ("lema", "Tu fiesta, nuestra pasión", "Lema"),
 ("correo", "", "PENDIENTE: correo corporativo"),
 ("direccion", "", "PENDIENTE: dirección"),
 ("admin_emails", "", "Correos con permiso administrativo, separados por coma"),
 ("usuarios_emails", "", "Correos autorizados a cotizar, separados por coma"),
 ("spreadsheet_nota", "IDs de carpetas Drive se guardan aquí (drive_folder_pdf, drive_folder_img)", ""),
 ("drive_folder_pdf", "", "ID carpeta de PDFs"), ("drive_folder_img", "", "ID carpeta de imágenes"),
]
js = lambda o: json.dumps(o, ensure_ascii=False, indent=1)
open("src/backend/SeedData.gs", "w").write(
 "/** GENERADO por tools/build_seed.py — no editar a mano. Datos migrados del Excel original. */\n"
 "var SEED_DATA = {\n PROPIEDADES: %s,\n TARIFAS: %s,\n ADICIONALES: %s,\n CONFIGURACION: %s\n};\n" %
 (js(props), js(tar), js(adds), js([{"clave": a, "valor": b, "descripcion": c} for a, b, c in conf])))
print(len(props), len(tar), len(adds), len(conf))
