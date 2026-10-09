/** ValidationService.gs — validaciones puras (sin acceso a Google). Se usan en backend y se replican en frontend por UX. */
var ValidationService = {
  isPositiveInt: function (n) { return typeof n === 'number' && isFinite(n) && n > 0 && Math.floor(n) === n; },
  isMoney: function (n) { return typeof n === 'number' && isFinite(n) && n >= 0; },
  isIsoDate: function (s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')); },

  /** @return {{ok:boolean, errors:string[]}} */
  result: function (errors) { return { ok: errors.length === 0, errors: errors }; },

  validateProperty: function (p) {
    var e = [], V = ValidationService;
    if (!p || !String(p.nombre || '').trim()) e.push('El nombre de la propiedad es obligatorio.');
    if (!V.isPositiveInt(Number(p.capacidad_minima))) e.push('La capacidad mínima debe ser un entero positivo.');
    if (!V.isPositiveInt(Number(p.capacidad_maxima))) e.push('La capacidad máxima debe ser un entero positivo.');
    if (Number(p.capacidad_minima) > Number(p.capacidad_maxima)) e.push('La capacidad mínima no puede superar la máxima.');
    if (ENUMS.ESTADO_PROPIEDAD.indexOf(p.estado) < 0) e.push('Estado de propiedad inválido.');
    return V.result(e);
  },

  validateAdditional: function (a) {
    var e = [];
    if (!a || !String(a.nombre || '').trim()) e.push('El nombre del adicional es obligatorio.');
    if (!ValidationService.isMoney(Number(a.precio_unitario))) e.push('El precio unitario debe ser numérico y no negativo.');
    return ValidationService.result(e);
  },

  validateClient: function (c) {
    var e = [];
    if (!c || !String(c.nombre || '').trim()) e.push('El nombre del cliente es obligatorio.');
    if (c && c.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c.correo))) e.push('Correo inválido.');
    if (c && c.telefono && !/^[0-9+()\s-]{7,20}$/.test(String(c.telefono))) e.push('Teléfono inválido.');
    return ValidationService.result(e);
  },

  /** Valida una sola tarifa de forma aislada (la coherencia entre tarifas la valida PricingService.validateTariffs). */
  validateTariff: function (t) {
    var e = [], V = ValidationService;
    if (!t.property_id) e.push('La tarifa debe pertenecer a una propiedad.');
    if (!V.isPositiveInt(Number(t.personas_desde)) || !V.isPositiveInt(Number(t.personas_hasta))) e.push('El rango de personas debe ser de enteros positivos.');
    else if (Number(t.personas_desde) > Number(t.personas_hasta)) e.push('personas_desde no puede ser mayor que personas_hasta.');
    if (ENUMS.MODALIDAD_TARIFA.indexOf(t.modalidad) < 0) e.push('Modalidad tarifaria inválida: ' + t.modalidad);
    ['precio_base', 'precio_por_persona', 'cargo_persona_adicional'].forEach(function (k) {
      if (t[k] !== '' && t[k] !== undefined && t[k] !== null && !V.isMoney(Number(t[k]))) e.push(k + ' debe ser numérico y no negativo.');
    });
    if (t.modalidad === 'por_invitado' && !(Number(t.precio_por_persona) > 0)) e.push('Una tarifa por invitado requiere precio_por_persona.');
    if ((t.modalidad === 'fija' || t.modalidad === 'escalonada' || t.modalidad === 'mixta') && !(Number(t.precio_base) > 0)) e.push('Esta modalidad requiere precio_base mayor que cero.');
    if (t.vigencia_inicio && !V.isIsoDate(t.vigencia_inicio)) e.push('vigencia_inicio inválida (AAAA-MM-DD).');
    if (t.vigencia_fin && !V.isIsoDate(t.vigencia_fin)) e.push('vigencia_fin inválida (AAAA-MM-DD).');
    if (t.vigencia_inicio && t.vigencia_fin && t.vigencia_inicio > t.vigencia_fin) e.push('vigencia_inicio posterior a vigencia_fin.');
    return V.result(e);
  },

  validateQuotationInput: function (q) {
    var e = [], V = ValidationService;
    if (!q || !q.cliente_id) e.push('Seleccione un cliente.');
    if (!V.isPositiveInt(Number(q && q.invitados))) e.push('La cantidad de invitados debe ser un entero positivo.');
    if (!q || !V.isIsoDate(q.fecha_evento)) e.push('La fecha del evento es obligatoria (AAAA-MM-DD).');
    if (!q || ENUMS.MODALIDAD_COTIZACION.indexOf(q.modalidad) < 0) e.push('Modalidad de cotización inválida.');
    return V.result(e);
  }
};
