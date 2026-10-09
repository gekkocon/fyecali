/**
 * PricingService.gs — motor de tarifas y cálculo. Lógica PURA: no accede a Sheets ni a Drive.
 * Todos los importes son enteros en COP.
 *
 * Reglas de tarifa por modalidad (fila de TARIFAS cuyo rango [personas_desde, personas_hasta] contiene a los invitados):
 *   fija         → precio_base
 *   escalonada   → precio_base (el tramo define el precio completo)
 *   por_invitado → precio_base + precio_por_persona × invitados
 *   mixta        → precio_base + max(0, invitados − personas_desde) × cargo_persona_adicional
 *                  (si cfg.tope_siguiente_tramo y existe el tramo contiguo siguiente, nunca supera su precio_base)
 * Una propiedad es elegible solo si invitados ≤ capacidad_maxima, está activa y tiene UNA tarifa válida que cubra los invitados.
 */
var PricingService = {
  round: function (n) { return Math.round(n); },

  // ---------- fechas (ISO AAAA-MM-DD, sin zona horaria) ----------
  addDays: function (iso, days) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  },
  /** Vencimiento = emisión + vigencia_dias (30 por defecto) días calendario. */
  dueDate: function (issueIso, cfg) { return PricingService.addDays(issueIso, Number((cfg && cfg.vigencia_dias) || 30)); },

  // ---------- validación de tarifas ----------
  /**
   * Detecta rangos contradictorios: por propiedad, dos tarifas activas con vigencias que se cruzan
   * no pueden tener rangos de personas que se solapen. También valida cada fila y que no excedan la capacidad.
   * @return {{ok:boolean, errors:string[], warnings:string[]}}
   */
  validateTariffs: function (tariffs, properties) {
    var errors = [], warnings = [], byProp = {};
    var propById = {};
    (properties || []).forEach(function (p) { propById[p.property_id] = p; });
    tariffs.forEach(function (t) {
      var r = ValidationService.validateTariff(t);
      r.errors.forEach(function (m) { errors.push(t.tarifa_id + ': ' + m); });
      if (r.ok && PricingService._isActive(t)) (byProp[t.property_id] = byProp[t.property_id] || []).push(t);
      var p = propById[t.property_id];
      if (properties && !p) errors.push(t.tarifa_id + ': la propiedad ' + t.property_id + ' no existe.');
      if (p && Number(t.personas_hasta) > Number(p.capacidad_maxima)) errors.push(t.tarifa_id + ': el rango supera la capacidad máxima de ' + p.nombre + '.');
    });
    Object.keys(byProp).forEach(function (pid) {
      var rows = byProp[pid].slice().sort(function (a, b) { return Number(a.personas_desde) - Number(b.personas_desde); });
      for (var i = 0; i < rows.length; i++) {
        for (var j = i + 1; j < rows.length; j++) {
          var a = rows[i], b = rows[j];
          if (PricingService._vigenciasOverlap(a, b) && Number(b.personas_desde) <= Number(a.personas_hasta)) {
            errors.push('Rangos solapados en ' + pid + ': ' + a.tarifa_id + ' [' + a.personas_desde + '-' + a.personas_hasta + '] y ' + b.tarifa_id + ' [' + b.personas_desde + '-' + b.personas_hasta + '].');
          }
        }
      }
      for (var k = 1; k < rows.length; k++) {
        if (PricingService._vigenciasOverlap(rows[k - 1], rows[k]) && Number(rows[k].personas_desde) > Number(rows[k - 1].personas_hasta) + 1)
          warnings.push('Hueco de cobertura en ' + pid + ' entre ' + rows[k - 1].personas_hasta + ' y ' + rows[k].personas_desde + ' invitados.');
      }
    });
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  },

  _isActive: function (t) { return t.activa === true || String(t.activa).toLowerCase() === 'true' || String(t.activa).toLowerCase() === 'sí' || t.activa === 1; },
  _vigenciasOverlap: function (a, b) {
    var aS = a.vigencia_inicio || '0000-00-00', aE = a.vigencia_fin || '9999-12-31';
    var bS = b.vigencia_inicio || '0000-00-00', bE = b.vigencia_fin || '9999-12-31';
    return aS <= bE && bS <= aE;
  },
  _inVigencia: function (t, onIso) {
    return (!t.vigencia_inicio || t.vigencia_inicio <= onIso) && (!t.vigencia_fin || t.vigencia_fin >= onIso);
  },

  // ---------- precio de una casa ----------
  /**
   * @return {{eligible:boolean, reason?:string, total?:number, perPerson?:number, tariff_id?:string, modalidad?:string}}
   * reason ∈ capacidad_excedida | propiedad_inactiva | sin_tarifa_valida | tarifa_ambigua
   */
  priceProperty: function (property, tariffs, guests, onIso, cfg) {
    cfg = cfg || DEFAULT_CONFIG;
    if (property.estado !== 'activa') return { eligible: false, reason: 'propiedad_inactiva' };
    if (guests > Number(property.capacidad_maxima)) return { eligible: false, reason: 'capacidad_excedida' };
    var mine = tariffs.filter(function (t) { return t.property_id === property.property_id && PricingService._isActive(t) && PricingService._inVigencia(t, onIso); });
    var hits = mine.filter(function (t) { return guests >= Number(t.personas_desde) && guests <= Number(t.personas_hasta); });
    if (hits.length === 0) return { eligible: false, reason: 'sin_tarifa_valida' };
    if (hits.length > 1) return { eligible: false, reason: 'tarifa_ambigua' };
    var t = hits[0], base = Number(t.precio_base) || 0, total;
    switch (t.modalidad) {
      case 'fija':
      case 'escalonada': total = base; break;
      case 'por_invitado': total = base + Number(t.precio_por_persona) * guests; break;
      case 'mixta':
        var extra = Math.max(0, guests - Number(t.personas_desde));
        var cargo = Number(t.cargo_persona_adicional) || Number(cfg.cargo_invitado_adicional) || 0;
        total = base + extra * cargo;
        if (extra > 0 && cfg.tope_siguiente_tramo) {
          var next = mine.filter(function (n) { return Number(n.personas_desde) === Number(t.personas_hasta) + 1; })[0];
          if (next && total > Number(next.precio_base)) total = Number(next.precio_base);
        }
        break;
      default: return { eligible: false, reason: 'sin_tarifa_valida' };
    }
    total = PricingService.round(total);
    return { eligible: true, total: total, perPerson: PricingService.round(total / guests), tariff_id: t.tarifa_id, modalidad: t.modalidad };
  },

  /** Lista todas las propiedades con su elegibilidad para N invitados (las no elegibles incluyen el motivo). */
  evaluateProperties: function (properties, tariffs, guests, onIso, cfg) {
    return properties.map(function (p) {
      var r = PricingService.priceProperty(p, tariffs, guests, onIso, cfg);
      r.property_id = p.property_id; r.nombre = p.nombre; r.capacidad_maxima = Number(p.capacidad_maxima);
      return r;
    });
  },
  eligibleProperties: function (properties, tariffs, guests, onIso, cfg) {
    return PricingService.evaluateProperties(properties, tariffs, guests, onIso, cfg).filter(function (r) { return r.eligible; });
  },

  // ---------- modalidad A: comparativa ----------
  /**
   * Alternativas independientes. NO produce subtotal ni total acumulado: cada casa es una opción.
   * @param {string[]} selectedIds casas elegidas manualmente por el administrador (solo entre las elegibles)
   */
  buildComparison: function (properties, tariffs, guests, selectedIds, onIso, cfg) {
    if (!selectedIds || selectedIds.length === 0) throw new Error('Seleccione al menos una propiedad.');
    var seen = {}, alternativas = [];
    selectedIds.forEach(function (id) {
      if (seen[id]) return; seen[id] = true;
      var p = properties.filter(function (x) { return x.property_id === id; })[0];
      if (!p) throw new Error('Propiedad inexistente: ' + id);
      var r = PricingService.priceProperty(p, tariffs, guests, onIso, cfg);
      if (!r.eligible) throw new Error(p.nombre + ' no es elegible para ' + guests + ' invitados (' + r.reason + ').');
      alternativas.push({
        property_id: p.property_id, nombre_snapshot: p.nombre, capacidad_snapshot: Number(p.capacidad_maxima),
        descripcion_snapshot: p.descripcion || '', imagen_drive_id: p.imagen_drive_id || '',
        precio_total_snapshot: r.total, valor_por_persona_informativo: r.perPerson, tariff_id: r.tariff_id,
        orden_presentacion: alternativas.length + 1
      });
    });
    return { modalidad: 'comparativa', invitados: guests, alternativas: alternativas };
  },

  // ---------- modalidad B: personalizada ----------
  /**
   * @param {{property:Object, tariffs:Array, guests:number, lines:Array, discount?:Object, onIso:string, cfg?:Object}} input
   *   lines: [{tipo_concepto:'adicional'|'personalizado', concepto_id?, descripcion, cantidad, precio_unitario}]
   *   discount: {tipo:'monto'|'porcentaje', valor:number, autorizado_por:string} — exige autorizado_por
   * @return resumen con subtotal, descuento, impuestos y total final
   */
  buildPersonalized: function (input) {
    var cfg = input.cfg || DEFAULT_CONFIG;
    var house = PricingService.priceProperty(input.property, input.tariffs, input.guests, input.onIso, cfg);
    if (!house.eligible) throw new Error(input.property.nombre + ' no es elegible para ' + input.guests + ' invitados (' + house.reason + ').');
    var lines = [{ tipo_concepto: 'propiedad', concepto_id: input.property.property_id, descripcion: input.property.nombre + ' — ' + input.guests + ' invitados', cantidad: 1, precio_unitario: house.total, precio_total: house.total }];
    (input.lines || []).forEach(function (l, i) {
      var q = Number(l.cantidad), pu = Number(l.precio_unitario);
      if (!(q > 0) || !isFinite(q)) throw new Error('Línea ' + (i + 1) + ': cantidad inválida.');
      if (!ValidationService.isMoney(pu)) throw new Error('Línea ' + (i + 1) + ': precio unitario inválido.');
      if (!String(l.descripcion || '').trim()) throw new Error('Línea ' + (i + 1) + ': falta descripción.');
      lines.push({ tipo_concepto: l.tipo_concepto || 'personalizado', concepto_id: l.concepto_id || '', descripcion: l.descripcion, cantidad: q, precio_unitario: PricingService.round(pu), precio_total: PricingService.round(q * pu) });
    });
    var subtotal = lines.reduce(function (s, l) { return s + l.precio_total; }, 0);
    var descuento = 0, d = input.discount;
    if (d && Number(d.valor) > 0) {
      if (!String(d.autorizado_por || '').trim()) throw new Error('El descuento requiere una autorización.');
      descuento = d.tipo === 'porcentaje' ? PricingService.round(subtotal * Number(d.valor) / 100) : PricingService.round(Number(d.valor));
      if (d.tipo === 'porcentaje' && Number(d.valor) > 100) throw new Error('El porcentaje de descuento no puede superar 100%.');
      if (descuento > subtotal) throw new Error('El descuento no puede superar el subtotal.');
    }
    var base = subtotal - descuento;
    var iva = PricingService.round(base * (Number(cfg.iva_porcentaje) || 0) / 100);
    return { modalidad: 'personalizada', invitados: input.guests, lines: lines, subtotal: subtotal, descuento: descuento, impuestos: iva, total: base + iva };
  }
};
