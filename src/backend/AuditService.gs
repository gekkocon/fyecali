/** AuditService.gs — registro de auditoría. Nunca debe romper la operación principal. */
var AuditService = {
  log: function (operation, entity, result, detail) {
    try {
      var user = '';
      try { user = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail(); } catch (e) { user = 'desconocido'; }
      SheetsRepository.insert('AUDITORIA', {
        fecha: Utilities.formatDate(new Date(), 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ss"),
        usuario: user, operacion: operation, entidad: entity, resultado: result,
        detalle: typeof detail === 'string' ? detail : JSON.stringify(detail || '')
      });
    } catch (e) { console.error('Auditoría falló: ' + e); }
  }
};
