const assert = require('assert'), { createContext, test } = require('./harness');
const ctx = createContext(), P = ctx.PricingService;
const clone = o => JSON.parse(JSON.stringify(o));
const SEED = clone(vm_seed());
function vm_seed() { return JSON.parse(JSON.stringify(ctx.SEED_DATA)); }
const props = SEED.PROPIEDADES, tars = SEED.TARIFAS, cfg = { ...ctx.DEFAULT_CONFIG };
const byName = n => props.find(p => p.nombre === n).property_id;
const DAY = '2026-10-09';
const mk = (id, max, extra = {}) => ({ property_id: id, nombre: id, estado: 'activa', capacidad_minima: 30, capacidad_maxima: max, ...extra });
const fixedT = (id, pid, d, h, base, extra = {}) => ({ tarifa_id: id, property_id: pid, personas_desde: d, personas_hasta: h, modalidad: 'fija', precio_base: base, precio_por_persona: 0, cargo_persona_adicional: 0, vigencia_inicio: '', vigencia_fin: '', activa: true, ...extra });

console.log('Tarifas');
test('capacidad 100, evento 80: elegible', () => {
  const r = P.priceProperty(mk('A', 100), [fixedT('t', 'A', 1, 100, 5e6)], 80, DAY, cfg); assert.ok(r.eligible);
});
test('capacidad 100, evento 100: elegible', () => {
  assert.ok(P.priceProperty(mk('A', 100), [fixedT('t', 'A', 1, 100, 5e6)], 100, DAY, cfg).eligible);
});
test('capacidad 100, evento 110: NO elegible (capacidad_excedida)', () => {
  const r = P.priceProperty(mk('A', 100), [fixedT('t', 'A', 1, 120, 5e6)], 110, DAY, cfg);
  assert.strictEqual(r.eligible, false); assert.strictEqual(r.reason, 'capacidad_excedida');
});
test('casa sin tarifa válida: no cotiza automáticamente', () => {
  const r = P.priceProperty(mk('A', 100), [], 80, DAY, cfg); assert.strictEqual(r.reason, 'sin_tarifa_valida');
  const inactive = P.priceProperty(mk('A', 100), [fixedT('t', 'A', 1, 100, 5e6, { activa: false })], 80, DAY, cfg); assert.strictEqual(inactive.eligible, false);
  const expired = P.priceProperty(mk('A', 100), [fixedT('t', 'A', 1, 100, 5e6, { vigencia_fin: '2026-01-01' })], 80, DAY, cfg); assert.strictEqual(expired.eligible, false);
});
test('rangos solapados: se detecta el error', () => {
  const r = P.validateTariffs([fixedT('t1', 'A', 30, 60, 1), fixedT('t2', 'A', 50, 90, 1)], [mk('A', 100)]);
  assert.strictEqual(r.ok, false); assert.ok(/solapados/.test(r.errors[0]));
});
test('rangos iguales en vigencias que no se cruzan NO son conflicto', () => {
  const r = P.validateTariffs([fixedT('t1', 'A', 30, 60, 1, { vigencia_fin: '2026-06-30' }), fixedT('t2', 'A', 30, 60, 1, { vigencia_inicio: '2026-07-01' })], [mk('A', 100)]);
  assert.ok(r.ok, r.errors.join());
});
test('tarifa que excede la capacidad máxima y propiedad inexistente se rechazan', () => {
  assert.strictEqual(P.validateTariffs([fixedT('t1', 'A', 30, 150, 1)], [mk('A', 100)]).ok, false);
  assert.strictEqual(P.validateTariffs([fixedT('t1', 'Z', 30, 50, 1)], [mk('A', 100)]).ok, false);
});
test('las 99 tarifas migradas del Excel son consistentes', () => {
  assert.strictEqual(tars.length, 99);
  const r = P.validateTariffs(tars, props); assert.ok(r.ok, r.errors.join()); assert.strictEqual(r.warnings.length, 0);
});
test('Vallano (máx. 100) no aparece con 110 invitados; sí aparecen Casa 74/4/5/Orquideorama/Pance', () => {
  const names = P.eligibleProperties(props, tars, 110, DAY, cfg).map(r => r.nombre).sort();
  assert.deepStrictEqual(names, ['Casa 4', 'Casa 5', 'Casa 74', 'Casa Pance', 'Orquideorama']);
});
test('precios exactos de tramo coinciden con el Excel (Casa 74 @110 = 14.800.000; Granada @30 = 9.900.000)', () => {
  assert.strictEqual(P.priceProperty(props.find(p => p.nombre === 'Casa 74'), tars, 110, DAY, cfg).total, 14800000);
  assert.strictEqual(P.priceProperty(props.find(p => p.nombre === 'Salón Granada'), tars, 30, DAY, cfg).total, 9900000);
});
test('entre tramos (85 invitados, Casa 74): base tramo 80 + 5 × 60.000', () => {
  assert.strictEqual(P.priceProperty(props.find(p => p.nombre === 'Casa 74'), tars, 85, DAY, cfg).total, 13600000 + 300000);
});
test('entre tramos se limita al precio del siguiente tramo (Granada 39: 9.900.000+9×60.000 > 10.300.000)', () => {
  assert.strictEqual(P.priceProperty(props.find(p => p.nombre === 'Salón Granada'), tars, 39, DAY, cfg).total, 10300000);
});
test('modalidad por_invitado y escalonada', () => {
  const t = { ...fixedT('t', 'A', 1, 100, 1e6), modalidad: 'por_invitado', precio_por_persona: 50000 };
  assert.strictEqual(P.priceProperty(mk('A', 100), [t], 40, DAY, cfg).total, 3e6);
  assert.strictEqual(P.priceProperty(mk('A', 100), [{ ...t, modalidad: 'escalonada' }], 40, DAY, cfg).total, 1e6);
});
test('fecha de vencimiento = emisión + 30 días (incluye fin de mes/año bisiesto)', () => {
  assert.strictEqual(P.dueDate('2026-10-09', cfg), '2026-11-08');
  assert.strictEqual(P.dueDate('2026-12-15', cfg), '2027-01-14');
  assert.strictEqual(P.dueDate('2028-02-01', cfg), '2028-03-02');
});

console.log('Comparativas');
test('3 casas, excluir 1 manualmente: cada casa con su precio y sin total acumulado', () => {
  const elig = P.eligibleProperties(props, tars, 110, DAY, cfg);
  const ids = elig.slice(0, 3).map(r => r.property_id); // 3 elegidas
  const c = P.buildComparison(props, tars, 110, ids.slice(0, 2), DAY, cfg); // excluye la tercera
  assert.strictEqual(c.alternativas.length, 2);
  c.alternativas.forEach(a => assert.ok(a.precio_total_snapshot > 0));
  assert.deepStrictEqual(Object.keys(c).sort(), ['alternativas', 'invitados', 'modalidad']);
  assert.ok(!JSON.stringify(c).match(/"(total|subtotal|suma)"/));
  assert.strictEqual(P.buildComparison(props, tars, 110, ids, DAY, cfg).alternativas.length, 3);
});
test('no se puede incluir una casa no elegible ni duplicar', () => {
  assert.throws(() => P.buildComparison(props, tars, 110, [byName('Mansión Vallano')], DAY, cfg), /no es elegible/);
  assert.strictEqual(P.buildComparison(props, tars, 80, [byName('Casa 4'), byName('Casa 4')], DAY, cfg).alternativas.length, 1);
  assert.throws(() => P.buildComparison(props, tars, 80, [], DAY, cfg), /al menos una/);
});

console.log('Personalizadas');
const casa4 = props.find(p => p.nombre === 'Casa 4');
const base = () => ({ property: casa4, tariffs: tars, guests: 100, onIso: DAY, cfg });
test('casa + adicionales; cambiar cantidades; eliminar adicionales; IVA 0', () => {
  const lines = [{ tipo_concepto: 'adicional', concepto_id: 'ADI-1', descripcion: 'DJ en vivo', cantidad: 1, precio_unitario: 800000 }, { tipo_concepto: 'personalizado', descripcion: 'Torta extra', cantidad: 3, precio_unitario: 120000 }];
  let q = P.buildPersonalized({ ...base(), lines });
  assert.strictEqual(q.lines[0].precio_total, 14700000);
  assert.strictEqual(q.subtotal, 14700000 + 800000 + 360000); assert.strictEqual(q.impuestos, 0); assert.strictEqual(q.total, q.subtotal);
  lines[1].cantidad = 5; q = P.buildPersonalized({ ...base(), lines }); assert.strictEqual(q.subtotal, 14700000 + 800000 + 600000);
  q = P.buildPersonalized({ ...base(), lines: [lines[0]] }); assert.strictEqual(q.subtotal, 14700000 + 800000);
  q = P.buildPersonalized({ ...base(), lines: [] }); assert.strictEqual(q.total, 14700000);
});
test('descuento exige autorización y no supera el subtotal; IVA configurable', () => {
  assert.throws(() => P.buildPersonalized({ ...base(), discount: { tipo: 'monto', valor: 100000 } }), /autorización/);
  assert.throws(() => P.buildPersonalized({ ...base(), discount: { tipo: 'monto', valor: 99e6, autorizado_por: 'x' } }), /superar/);
  const q = P.buildPersonalized({ ...base(), discount: { tipo: 'porcentaje', valor: 10, autorizado_por: 'gerente' } });
  assert.strictEqual(q.descuento, 1470000); assert.strictEqual(q.total, 13230000);
  const iva = P.buildPersonalized({ ...base(), cfg: { ...cfg, iva_porcentaje: 19 } }); assert.strictEqual(iva.impuestos, Math.round(14700000 * .19));
});
test('líneas inválidas se rechazan (cantidad 0, precio negativo, sin descripción)', () => {
  const bad = l => () => P.buildPersonalized({ ...base(), lines: [l] });
  assert.throws(bad({ descripcion: 'x', cantidad: 0, precio_unitario: 1 }), /cantidad/);
  assert.throws(bad({ descripcion: 'x', cantidad: 1, precio_unitario: -1 }), /precio/);
  assert.throws(bad({ descripcion: ' ', cantidad: 1, precio_unitario: 1 }), /descripción/);
});
test('casa no elegible no puede cotizarse como personalizada', () => {
  assert.throws(() => P.buildPersonalized({ ...base(), property: props.find(p => p.nombre === 'Mansión Vallano'), guests: 110 }), /no es elegible/);
});
