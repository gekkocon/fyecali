/**
 * AdditionalService.gs — catálogo de adicionales ilimitado. En una cotización solo aparecen los conceptos
 * que el usuario agrega: del catálogo (con precio editable como snapshot) o líneas libres que no existen en el catálogo.
 */
var AdditionalService = {
  list: function (includeInactive) {
    return SheetsRepository.readAll('ADICIONALES').filter(function (a) { return includeInactive || a.activo === true || String(a.activo).toLowerCase() === 'true'; });
  },
  save: function (a) {
    AuthService.requireAdmin();
    var v = ValidationService.validateAdditional(a);
    if (!v.ok) throw new Error(v.errors.join(' '));
    var rec = { categoria: a.categoria || 'General', nombre: String(a.nombre).trim(), descripcion: a.descripcion || '', unidad_cobro: a.unidad_cobro || 'unidad', precio_unitario: Number(a.precio_unitario), activo: a.activo !== false };
    var out = a.adicional_id ? SheetsRepository.update('ADICIONALES', a.adicional_id, rec) : SheetsRepository.insert('ADICIONALES', rec);
    AuditService.log(a.adicional_id ? 'actualizar' : 'crear', 'ADICIONALES', 'ok', out.adicional_id);
    return out;
  },
  /** Desactiva (no borra) para no romper historial: las cotizaciones guardan snapshot de todos modos. */
  setActive: function (id, active) { AuthService.requireAdmin(); return SheetsRepository.update('ADICIONALES', id, { activo: !!active }); }
};
