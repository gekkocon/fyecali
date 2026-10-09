/**
 * SheetsRepository.gs — único punto de acceso a Google Sheets.
 * - Lee y escribe por NOMBRE de encabezado (nunca por número de columna).
 * - Lecturas por lote (una llamada getValues por hoja).
 * - Escrituras críticas bajo LockService. Google Sheets no tiene transacciones: cada operación
 *   escribe una fila completa con una sola llamada setValues para minimizar estados intermedios.
 * Fechas: se normalizan a texto AAAA-MM-DD al leer; se guardan como texto para evitar conversiones de zona horaria.
 */
var SheetsRepository = {
  _ss: null,

  spreadsheet: function () {
    if (SheetsRepository._ss) return SheetsRepository._ss;
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    SheetsRepository._ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!SheetsRepository._ss) throw new Error('No hay hoja de cálculo configurada. Ejecute setupDatabase() o defina SPREADSHEET_ID en Propiedades del script.');
    return SheetsRepository._ss;
  },
  _reset: function () { SheetsRepository._ss = null; },

  _sheet: function (table) {
    if (!SCHEMA[table]) throw new Error('Tabla desconocida: ' + table);
    var sh = SheetsRepository.spreadsheet().getSheetByName(table);
    if (!sh) throw new Error('Falta la hoja ' + table + '. Ejecute setupDatabase().');
    return sh;
  },

  /** Mapa encabezado → índice (0-based) tomado de la fila 1 real de la hoja; valida que existan todos los esperados. */
  _headerMap: function (sh, table) {
    var row = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    var map = {};
    row.forEach(function (h, i) { if (h !== '') map[String(h).trim()] = i; });
    SCHEMA[table].headers.forEach(function (h) { if (!(h in map)) throw new Error('La hoja ' + table + ' no tiene la columna "' + h + '".'); });
    return { map: map, width: row.length };
  },

  _norm: function (v) {
    if (Object.prototype.toString.call(v) === '[object Date]') {
      return Utilities.formatDate(v, 'America/Bogota', 'yyyy-MM-dd');
    }
    return v;
  },

  /** @return {Object[]} filas como objetos, con _row = número de fila real en la hoja. */
  readAll: function (table) {
    var sh = SheetsRepository._sheet(table), h = SheetsRepository._headerMap(sh, table);
    var last = sh.getLastRow();
    if (last < 2) return [];
    var values = sh.getRange(2, 1, last - 1, h.width).getValues(), out = [];
    values.forEach(function (row, i) {
      if (row.every(function (c) { return c === ''; })) return;
      var o = { _row: i + 2 };
      SCHEMA[table].headers.forEach(function (name) { o[name] = SheetsRepository._norm(row[h.map[name]]); });
      out.push(o);
    });
    return out;
  },

  findById: function (table, id) {
    var key = SCHEMA[table].id;
    return SheetsRepository.readAll(table).filter(function (r) { return String(r[key]) === String(id); })[0] || null;
  },

  where: function (table, predicate) { return SheetsRepository.readAll(table).filter(predicate); },

  _withLock: function (fn) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try { return fn(); } finally { lock.releaseLock(); }
  },

  _nextId: function (table, rows) {
    var s = SCHEMA[table], max = 0, re = new RegExp('^' + s.prefix + '-(\\d+)$');
    rows.forEach(function (r) { var m = re.exec(String(r[s.id])); if (m) max = Math.max(max, Number(m[1])); });
    return s.prefix + '-' + ('0000' + (max + 1)).slice(-4);
  },

  _toRow: function (table, h, obj, base) {
    var row = base ? base.slice() : new Array(h.width).fill('');
    SCHEMA[table].headers.forEach(function (name) { if (name in obj) row[h.map[name]] = obj[name] === null || obj[name] === undefined ? '' : obj[name]; });
    return row;
  },

  /** Inserta una fila. Si falta el ID lo genera de forma secuencial bajo lock. @return objeto insertado */
  insert: function (table, obj) {
    return SheetsRepository._withLock(function () {
      var sh = SheetsRepository._sheet(table), h = SheetsRepository._headerMap(sh, table), key = SCHEMA[table].id;
      var rec = {}; for (var k in obj) rec[k] = obj[k];
      var existing = SheetsRepository.readAll(table);
      if (!rec[key]) rec[key] = SheetsRepository._nextId(table, existing);
      else if (existing.some(function (r) { return String(r[key]) === String(rec[key]); })) throw new Error('Ya existe ' + key + ' = ' + rec[key] + ' en ' + table + '.');
      var rowNum = sh.getLastRow() + 1;
      sh.getRange(rowNum, 1, 1, h.width).setValues([SheetsRepository._toRow(table, h, rec)]);
      rec._row = rowNum;
      return rec;
    });
  },

  /** Inserción por lote (una sola escritura). Usar para migración y detalles de cotización. */
  insertMany: function (table, objs) {
    if (!objs.length) return [];
    return SheetsRepository._withLock(function () {
      var sh = SheetsRepository._sheet(table), h = SheetsRepository._headerMap(sh, table), key = SCHEMA[table].id;
      var pool = SheetsRepository.readAll(table), recs = [], rows = [];
      objs.forEach(function (o) {
        var rec = {}; for (var k in o) rec[k] = o[k];
        if (!rec[key]) rec[key] = SheetsRepository._nextId(table, pool);
        pool.push(rec); recs.push(rec); rows.push(SheetsRepository._toRow(table, h, rec));
      });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, h.width).setValues(rows);
      return recs;
    });
  },

  /** Actualiza campos de una fila identificada por su ID. @return fila actualizada */
  update: function (table, id, patch) {
    return SheetsRepository._withLock(function () {
      var sh = SheetsRepository._sheet(table), h = SheetsRepository._headerMap(sh, table), key = SCHEMA[table].id;
      var cur = SheetsRepository.readAll(table).filter(function (r) { return String(r[key]) === String(id); })[0];
      if (!cur) throw new Error('No existe ' + key + ' = ' + id + ' en ' + table + '.');
      var p = {}; for (var k in patch) if (k !== key && k !== '_row') p[k] = patch[k];
      var base = sh.getRange(cur._row, 1, 1, h.width).getValues()[0];
      sh.getRange(cur._row, 1, 1, h.width).setValues([SheetsRepository._toRow(table, h, p, base)]);
      var out = {}; for (var c in cur) out[c] = cur[c]; for (var q in p) out[q] = p[q];
      return out;
    });
  },

  /** Ejecuta fn bajo el lock del script (para consecutivos y secuencias leer-modificar-escribir). */
  withLock: function (fn) { return SheetsRepository._withLock(fn); }
};
