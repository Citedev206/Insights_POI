const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const XLSX = require(path.join(root, 'js/lib/xlsx.full.min.js'));
const ctx = { console, XLSX, Date, Set, Map, Intl, setTimeout,
  document: { addEventListener() {} }, addEventListener() {},
  fetch: async (url) => {
    const file = path.join(root, url);
    return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404,
      arrayBuffer: async () => { const b = fs.readFileSync(file); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } };
  }
};
ctx.window = ctx;
vm.createContext(ctx);
for (const name of ['data', 'metrics', 'charts']) vm.runInContext(fs.readFileSync(path.join(root, `js/${name}.js`), 'utf8'), ctx);
// Expose renderers only inside this test context; production API stays unchanged.
vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8').replace('  // ---- ARRANQUE', '  // ---- ARRANQUE').replace('  window.addEventListener("hashchange"', '  global.testDashboard = { setStore(v) { STORE = v; }, FILTER, VIEWS, metasClientesComparables };\n  window.addEventListener("hashchange"'), ctx);
(async () => {
  const data = await ctx.POI.data.loadAll();
  const { metrics: m, data: d } = ctx.POI;
  const app = ctx.testDashboard;
  app.setStore(data);
  const filter = app.FILTER;
  const expectedClients = new Set(data.ejecucion.map(r => r.RUC).filter(Boolean)).size;
  assert.equal(m.kpisClientes(data.ejecucion, []).ejec_clientes, expectedClients);
  assert.equal(d.filtrarClientes(data, filter).length, data.clientes.length, 'Todos incluye metas de todos los programas');
  const blank = [{ RUC: null, CANTIDAD: 1 }, { RUC: '', CANTIDAD: 1 }];
  assert.equal(m.kpisClientes(blank, []).ejec_clientes, 0);
  assert.equal(m.clientesResumen(blank, []).total, 0);
  assert.equal(m.clientesResumen(data.ejecucion, []).nuevos, 0, 'Sin histórico no se inventan nuevos');
  const allocation = m.clientesMetaEspecialistas([], new Set(['A', 'B', 'C']), 5, 7);
  assert.ok(Math.abs(allocation.rows.reduce((n,r) => n+r.metaFoc,0)-5) < 1e-9, 'Reparto conserva la meta');
  const programs = [...new Set(data.ejecucion.map(r => r.PROGRAMA))];
  let renders = 0;
  for (const program of [null, ...programs]) {
    filter.programas = program ? [program] : [];
    for (const month of [null, 1, 12]) {
      filter.meses = month ? [month] : [];
      for (const name of Object.keys(app.VIEWS)) {
        const html = app.VIEWS[name].render();
        assert.equal(typeof html, 'string');
        assert.ok(!/NaN|Infinity|undefined%/.test(html), `${name}: cifras inválidas`);
        renders++;
      }
    }
  }
  filter.programas = []; filter.meses = [];
  filter.especialistas = [data.ejecucion[0].ESPECIALISTA];
  assert.equal(app.metasClientesComparables(data.ejecucion).length, 0, 'Sin comparación institucional para especialista');
  filter.especialistas = [];
  const totals = m.kpis(data.ejecucion, data.metas);
  console.log(JSON.stringify({ renders, clients: expectedClients, services: totals.ejecutado, target: totals.meta, compliance: totals.cumplimiento, programs }));
})().catch(e => { console.error(e); process.exitCode = 1; });
