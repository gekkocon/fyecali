const assert = require('assert'), { createContext, test } = require('./harness');
console.log('Repositorio y servicios (con doble de prueba de Google Sheets — NO equivale a probar en Google)');
test('setupDatabase crea 11 hojas, migra datos y es idempotente', () => {
  const ctx = createContext(); const r1 = ctx.setupDatabase();
  assert.strictEqual(Object.keys(ctx.__ss.sheets).length, 11);
  assert.strictEqual(ctx.SheetsRepository.readAll('PROPIEDADES').length, 7);
  assert.strictEqual(ctx.SheetsRepository.readAll('TARIFAS').length, 99);
  assert.ok(r1.indexOf('tarifas válidas') >= 0);
  ctx.setupDatabase(); assert.strictEqual(ctx.SheetsRepository.readAll('TARIFAS').length, 99);
});
test('lectura por nombre de encabezado: columnas reordenadas siguen funcionando', () => {
  const ctx = createContext(); ctx.setupDatabase();
  const sh = ctx.__ss.sheets.PROPIEDADES; // invertir el orden de columnas
  sh.rows = sh.rows.map(r => r.slice().reverse());
  const p = ctx.SheetsRepository.readAll('PROPIEDADES').find(x => x.nombre === 'Mansión Vallano');
  assert.strictEqual(p.capacidad_maxima, 100);
});
test('falta una columna requerida: error claro', () => {
  const ctx = createContext(); ctx.setupDatabase(); ctx.__ss.sheets.ADICIONALES.rows[0][2] = 'xx';
  assert.throws(() => ctx.SheetsRepository.readAll('ADICIONALES'), /no tiene la columna "nombre"/);
});
test('IDs secuenciales y no duplicados', () => {
  const ctx = createContext(); ctx.setupDatabase();
  const a = ctx.SheetsRepository.insert('CLIENTES', { nombre: 'Juan Pérez' }), b = ctx.SheetsRepository.insert('CLIENTES', { nombre: 'Ana' });
  assert.strictEqual(a.cliente_id, 'CLI-0001'); assert.strictEqual(b.cliente_id, 'CLI-0002');
  assert.throws(() => ctx.SheetsRepository.insert('CLIENTES', { cliente_id: 'CLI-0001', nombre: 'x' }), /Ya existe/);
});
test('catálogo de adicionales: se agregan ilimitados; los inactivos no aparecen', () => {
  const ctx = createContext(); ctx.setupDatabase();
  for (let i = 1; i <= 30; i++) ctx.AdditionalService.save({ nombre: 'Extra ' + i, precio_unitario: i * 1000, categoria: 'Varios' });
  assert.strictEqual(ctx.AdditionalService.list().length, 6 + 30);
  const id = ctx.AdditionalService.list()[0].adicional_id; ctx.AdditionalService.setActive(id, false);
  assert.strictEqual(ctx.AdditionalService.list().length, 35); assert.strictEqual(ctx.AdditionalService.list(true).length, 36);
  assert.throws(() => ctx.AdditionalService.save({ nombre: '', precio_unitario: -1 }), /obligatorio/);
});
test('guardar tarifa solapada se rechaza; tarifa válida se acepta; cambios no tocan otras filas', () => {
  const ctx = createContext(); ctx.setupDatabase();
  const p = ctx.PropertyService.list().find(x => x.nombre === 'Casa 4'), before = ctx.PropertyService.listTariffs(p.property_id).length;
  assert.throws(() => ctx.PropertyService.saveTariff({ property_id: p.property_id, personas_desde: 90, personas_hasta: 95, modalidad: 'fija', precio_base: 1 }), /solapados/);
  assert.strictEqual(ctx.PropertyService.listTariffs(p.property_id).length, before);
  const t = ctx.PropertyService.listTariffs(p.property_id)[0];
  const upd = ctx.PropertyService.saveTariff({ ...t, precio_base: 9500000 });
  assert.strictEqual(ctx.SheetsRepository.findById('TARIFAS', t.tarifa_id).precio_base, 9500000);
});
test('autorización en servidor: usuario no autorizado no puede escribir', () => {
  const opts = { email: 'dueno@test.com' }, ctx = createContext(opts); ctx.setupDatabase();
  ctx.AdditionalService.save({ nombre: 'Permitido', precio_unitario: 1 });   // el dueño sí puede
  opts.email = 'intruso@x.com';
  assert.throws(() => ctx.AdditionalService.save({ nombre: 'X', precio_unitario: 1 }), /administradores/);
  assert.throws(() => ctx.PropertyService.eligible(80, '2026-10-09'), /No autorizado/);
  opts.email = 'dueno@test.com'; ctx.ConfigService.set('admin_emails', 'ana@x.com');
  opts.email = 'ana@x.com'; ctx.AdditionalService.save({ nombre: 'Ana puede', precio_unitario: 1 });
});
test('PropertyService.eligible filtra por invitados', () => {
  const ctx = createContext(); ctx.setupDatabase();
  const names = ctx.PropertyService.eligible(110, '2026-10-09').map(p => p.nombre);
  assert.ok(names.length === 5 && names.indexOf('Mansión Vallano') < 0);
});
