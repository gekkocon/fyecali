"""Extrae las tarifas del Excel original a data/seed/*.json y verifica consistencia
entre Libro1.xlsx (base + obsequio) y la hoja PRECIOS del .xlsm. Uso: python3 -I tools/extract_legacy.py"""
import json, openpyxl, warnings
warnings.filterwarnings("ignore")
L = openpyxl.load_workbook("legacy/Libro1.xlsx")["Hoja1"]
X = openpyxl.load_workbook("legacy/Cotizador_Eventos_Pro_automatizado.xlsm")
P = X["PRECIOS"]; A = X["ADICIONALES"]
OBS = L["M3"].value
venues = [L.cell(1, c).value for c in range(2, 9)]
assert venues == [P.cell(1, c).value for c in range(2, 9)]
rows, base_rows, diffs = [], [], []
for r in range(3, 21):
    g = 30 + (r - 3) * 10
    pr = r - 1
    assert P.cell(pr, 1).value == g
    for ci, v in enumerate(venues):
        raw = L.cell(r, 2 + ci).value
        base = int(str(raw).split("+")[0].lstrip("=")) if isinstance(raw, str) and raw.startswith("=") else None
        pv = P.cell(pr, 2 + ci).value
        if (base is None) != (pv is None): diffs.append((g, v, raw, pv))
        elif base is not None and base + OBS != pv: diffs.append((g, v, raw, pv))
        if pv is not None:
            rows.append({"venue": v, "invitados": g, "precio_lista": pv, "precio_sin_obsequio": base})
json.dump({"obsequio_cop": OBS, "venues": venues, "tarifas": rows}, open("data/seed/tarifas_legacy.json", "w"), ensure_ascii=False, indent=1)
sumario = {}
for v in venues:
    g = [x["invitados"] for x in rows if x["venue"] == v]
    sumario[v] = {"min": min(g), "max": max(g), "tramos": len(g), "huecos": [x for x in range(min(g), max(g) + 1, 10) if x not in g]}
json.dump(sumario, open("data/seed/capacidades_derivadas.json", "w"), ensure_ascii=False, indent=1)
ad = [{"adicional_id": A.cell(r, 1).value, "nombre": A.cell(r, 2).value, "descripcion": A.cell(r, 3).value,
       "precio": A.cell(r, 4).value, "activo": A.cell(r, 5).value == "Sí"} for r in range(2, 28) if A.cell(r, 2).value]
json.dump(ad, open("data/seed/adicionales_legacy.json", "w"), ensure_ascii=False, indent=1)
print("obsequio", OBS, "| tarifas", len(rows), "| diferencias Libro1 vs PRECIOS:", diffs or "ninguna")
for k, v in sumario.items(): print(k, v)
