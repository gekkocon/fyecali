// Carga los .gs de src/backend en un contexto vm (comparten ámbito global, igual que en Apps Script)
// y ofrece dobles de prueba mínimos de SpreadsheetApp, LockService, Utilities, Session y PropertiesService.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ORDER = ['Config', 'ValidationService', 'PricingService', 'SheetsRepository', 'AuditService', 'AuthService', 'PropertyService', 'AdditionalService', 'SeedData', 'Setup'];

class FakeSheet {
  constructor(name) { this.name = name; this.rows = []; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getRange(r, c, nr = 1, nc = 1) {
    const s = this;
    const api = {
      getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const row = s.rows[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
      setValues: (v) => { for (let i = 0; i < nr; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < nc; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } return api; },
      setFontWeight: () => api
    };
    return api;
  }
  setFrozenRows() {}
}
class FakeSpreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new FakeSheet(n)); }
  getId() { return 'fake-ss'; }
}

function createContext(opts = {}) {
  const ss = new FakeSpreadsheet(), props = {};
  const ctx = {
    console, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, isNaN, isFinite, parseInt, parseFloat,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) + (arguments.length ? '' : '') },
    Session: { getActiveUser: () => ({ getEmail: () => opts.email || 'dueno@test.com' }), getEffectiveUser: () => ({ getEmail: () => 'dueno@test.com' }) }
  };
  vm.createContext(ctx);
  ORDER.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/backend', f + '.gs'), 'utf8'), ctx, { filename: f + '.gs' }));
  ctx.__ss = ss;
  return ctx;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); } catch (e) { failed++; console.log('  ✘ ' + name + '\n      ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : e)); }
}
function summary() { console.log(`\n${passed} aprobadas, ${failed} fallidas`); if (failed) process.exitCode = 1; }
module.exports = { createContext, test, summary };
