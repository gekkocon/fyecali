/**
 * Setup.gs — crea/verifica las hojas y migra los datos iniciales (SEED_DATA, generado desde el Excel original).
 * Idempotente: no duplica datos ni borra información existente. Ejecutar manualmente una vez: setupDatabase().
 */
function setupDatabase() {
  var ss = SheetsRepository.spreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  var report = [];
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name), headers = SCHEMA[name].headers;
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
      report.push('creada ' + name);
    } else {
      SheetsRepository._headerMap(sh, name); // lanza si faltan columnas
    }
  });
  Object.keys(SEED_DATA).forEach(function (name) {
    if (SheetsRepository.readAll(name).length === 0) {
      SheetsRepository.insertMany(name, SEED_DATA[name]);
      report.push('migrados ' + SEED_DATA[name].length + ' registros en ' + name);
    }
  });
  var check = PricingService.validateTariffs(SheetsRepository.readAll('TARIFAS'), SheetsRepository.readAll('PROPIEDADES'));
  report.push(check.ok ? 'tarifas válidas' : 'ERRORES DE TARIFAS: ' + check.errors.join(' | '));
  AuditService.log('setupDatabase', 'SISTEMA', check.ok ? 'ok' : 'error', report);
  return report;
}
