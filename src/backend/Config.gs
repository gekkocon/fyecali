/**
 * Config.gs — esquema de la base de datos (hojas y encabezados) y acceso a la hoja CONFIGURACION.
 * Las hojas se leen SIEMPRE por nombre de encabezado, nunca por número de columna.
 */
var SCHEMA = {
  PROPIEDADES: { id: 'property_id', prefix: 'PROP', headers: ['property_id', 'nombre', 'descripcion', 'capacidad_minima', 'capacidad_maxima', 'estado', 'imagen_drive_id', 'observaciones'] },
  TARIFAS: { id: 'tarifa_id', prefix: 'TAR', headers: ['tarifa_id', 'property_id', 'personas_desde', 'personas_hasta', 'modalidad', 'precio_base', 'precio_por_persona', 'cargo_persona_adicional', 'vigencia_inicio', 'vigencia_fin', 'activa'] },
  ADICIONALES: { id: 'adicional_id', prefix: 'ADI', headers: ['adicional_id', 'categoria', 'nombre', 'descripcion', 'unidad_cobro', 'precio_unitario', 'activo'] },
  CLIENTES: { id: 'cliente_id', prefix: 'CLI', headers: ['cliente_id', 'nombre', 'telefono', 'correo', 'fecha_registro', 'observaciones'] },
  COTIZACIONES: { id: 'cotizacion_id', prefix: 'COT', headers: ['cotizacion_id', 'consecutivo', 'cliente_id', 'fecha_emision', 'fecha_evento', 'invitados', 'modalidad', 'estado', 'fecha_vencimiento', 'version_actual', 'propiedad_seleccionada', 'valor_comercial', 'observaciones'] },
  DETALLE_COTIZACIONES: { id: 'detalle_id', prefix: 'DET', headers: ['detalle_id', 'cotizacion_id', 'version', 'tipo_concepto', 'concepto_id', 'descripcion_snapshot', 'cantidad', 'precio_unitario_snapshot', 'precio_total'] },
  ALTERNATIVAS_COTIZACION: { id: 'alternativa_id', prefix: 'ALT', headers: ['alternativa_id', 'cotizacion_id', 'version', 'property_id', 'nombre_snapshot', 'capacidad_snapshot', 'precio_total_snapshot', 'orden_presentacion'] },
  VERSIONES_COTIZACION: { id: 'version_id', prefix: 'VER', headers: ['version_id', 'cotizacion_id', 'numero_version', 'fecha_emision', 'fecha_vencimiento', 'snapshot_json', 'pdf_file_id', 'pdf_url', 'estado_exportacion'] },
  SEGUIMIENTOS: { id: 'seguimiento_id', prefix: 'SEG', headers: ['seguimiento_id', 'cotizacion_id', 'fecha', 'canal', 'resultado', 'proximo_contacto', 'observaciones'] },
  CONFIGURACION: { id: 'clave', prefix: 'CFG', headers: ['clave', 'valor', 'descripcion'] },
  AUDITORIA: { id: 'audit_id', prefix: 'AUD', headers: ['audit_id', 'fecha', 'usuario', 'operacion', 'entidad', 'resultado', 'detalle'] }
};

var ENUMS = {
  MODALIDAD_TARIFA: ['fija', 'por_invitado', 'escalonada', 'mixta'],
  ESTADO_PROPIEDAD: ['activa', 'inactiva'],
  MODALIDAD_COTIZACION: ['comparativa', 'personalizada'],
  ESTADO_COTIZACION: ['Borrador', 'Generada', 'Enviada', 'En seguimiento', 'En negociación', 'Aprobada', 'Perdida', 'Vencida']
};

var DEFAULT_CONFIG = {
  vigencia_dias: 30,
  iva_porcentaje: 0,
  cargo_invitado_adicional: 60000,
  tope_siguiente_tramo: true
};

var ConfigService = {
  /** Devuelve un objeto {clave: valor} con los valores de CONFIGURACION sobre los DEFAULT_CONFIG. */
  getAll: function () {
    var cfg = {}, k;
    for (k in DEFAULT_CONFIG) cfg[k] = DEFAULT_CONFIG[k];
    SheetsRepository.readAll('CONFIGURACION').forEach(function (r) {
      if (r.valor !== '' && r.valor !== null && r.valor !== undefined) cfg[r.clave] = r.valor;
    });
    return cfg;
  },
  get: function (key) { return ConfigService.getAll()[key]; },
  set: function (key, value, description) {
    var existing = SheetsRepository.findById('CONFIGURACION', key);
    if (existing) return SheetsRepository.update('CONFIGURACION', key, { valor: value });
    return SheetsRepository.insert('CONFIGURACION', { clave: key, valor: value, descripcion: description || '' });
  }
};
