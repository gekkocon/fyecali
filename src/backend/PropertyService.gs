/** PropertyService.gs — CRUD de propiedades y tarifas (con validación de rangos). Todas las escrituras exigen administrador. */
var PropertyService = {
  list: function (includeInactive) {
    return SheetsRepository.readAll('PROPIEDADES').filter(function (p) { return includeInactive || p.estado === 'activa'; });
  },
  save: function (p) {
    AuthService.requireAdmin();
    var v = ValidationService.validateProperty(p);
    if (!v.ok) throw new Error(v.errors.join(' '));
    var rec = { nombre: String(p.nombre).trim(), descripcion: p.descripcion || '', capacidad_minima: Number(p.capacidad_minima), capacidad_maxima: Number(p.capacidad_maxima), estado: p.estado, imagen_drive_id: p.imagen_drive_id || '', observaciones: p.observaciones || '' };
    var out = p.property_id ? SheetsRepository.update('PROPIEDADES', p.property_id, rec) : SheetsRepository.insert('PROPIEDADES', rec);
    AuditService.log(p.property_id ? 'actualizar' : 'crear', 'PROPIEDADES', 'ok', out.property_id);
    return out;
  },
  listTariffs: function (propertyId) {
    return SheetsRepository.readAll('TARIFAS').filter(function (t) { return !propertyId || t.property_id === propertyId; });
  },
  /** Guarda una tarifa validando que el conjunto resultante no tenga rangos contradictorios. */
  saveTariff: function (t) {
    AuthService.requireAdmin();
    var v = ValidationService.validateTariff(t);
    if (!v.ok) throw new Error(v.errors.join(' '));
    return SheetsRepository.withLock(function () {
      var all = SheetsRepository.readAll('TARIFAS').filter(function (x) { return x.tarifa_id !== t.tarifa_id; });
      var candidate = { tarifa_id: t.tarifa_id || '(nueva)', property_id: t.property_id, personas_desde: Number(t.personas_desde), personas_hasta: Number(t.personas_hasta), modalidad: t.modalidad, precio_base: Number(t.precio_base) || 0, precio_por_persona: Number(t.precio_por_persona) || 0, cargo_persona_adicional: Number(t.cargo_persona_adicional) || 0, vigencia_inicio: t.vigencia_inicio || '', vigencia_fin: t.vigencia_fin || '', activa: t.activa !== false };
      var check = PricingService.validateTariffs(all.concat([candidate]), PropertyService.list(true));
      if (!check.ok) throw new Error(check.errors.join(' '));
      var out = t.tarifa_id ? SheetsRepository.update('TARIFAS', t.tarifa_id, candidate) : SheetsRepository.insert('TARIFAS', candidate);
      AuditService.log(t.tarifa_id ? 'actualizar' : 'crear', 'TARIFAS', 'ok', out.tarifa_id);
      return out;
    });
  },
  /** Propiedades elegibles para N invitados con su precio (para el selector de tarjetas). */
  eligible: function (guests, onIso) {
    AuthService.requireUser();
    var props = PropertyService.list(false), tariffs = SheetsRepository.readAll('TARIFAS'), cfg = ConfigService.getAll();
    var priced = PricingService.eligibleProperties(props, tariffs, guests, onIso, cfg);
    return priced.map(function (r) {
      var p = props.filter(function (x) { return x.property_id === r.property_id; })[0];
      return { property_id: p.property_id, nombre: p.nombre, descripcion: p.descripcion, capacidad_maxima: p.capacidad_maxima, imagen_drive_id: p.imagen_drive_id, precio_total: r.total, valor_por_persona: r.perPerson };
    });
  }
};
