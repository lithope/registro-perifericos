var KEY = "perifericos_v1";
var db = { reqs: [], limit: 2, months: 12 };
var tab = 1;
var conn = { url: "", key: "" };
var $ = function (id) { return document.getElementById(id); };

function load() {
  try { var r = localStorage.getItem(KEY); if (r) db = JSON.parse(r); } catch (e) {}
  try { var c = localStorage.getItem("perifericos_conn"); if (c) conn = JSON.parse(c); } catch (e) {}
  $("cu").value = conn.url; $("ck").value = conn.key;
  $("limit").value = db.limit; $("months").value = db.months;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
function setStatus(t, bad) { var s = $("status"); s.textContent = t; s.style.color = bad ? "var(--bad)" : "var(--muted)"; }
function connected() { return !!(conn.url && conn.key); }
function api(body) {
  var u = body ? conn.url : conn.url + "?key=" + encodeURIComponent(conn.key);
  var o = body ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ key: conn.key }, body)) } : {};
  return fetch(u, o).then(function (r) { return r.json(); }).then(function (d) { if (d.error) throw new Error("clave incorrecta"); return d; });
}
function sync() {
  if (!connected()) { setStatus("Modo local: los datos solo se guardan en este navegador."); return Promise.resolve(); }
  setStatus("Sincronizando con Google Sheets…");
  return api().then(function (d) {
    db.reqs = d.reqs; save(); render(); liveCheck();
    setStatus("✅ Conectado a Google Sheets · " + db.reqs.length + " registros");
  }).catch(function (e) { setStatus("⚠️ No se pudo conectar: " + e.message, true); });
}
function norm(s) { return s.trim().toLowerCase(); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function cutoff() { var d = new Date(); d.setMonth(d.getMonth() - db.months); return d.getTime(); }
function stats(name) {
  var c = cutoff(), n = norm(name), tot = 0, by = {}, all = 0;
  db.reqs.forEach(function (r) {
    if (norm(r.user) !== n) return;
    all++;
    if (r.ts >= c) { tot++; by[r.item] = (by[r.item] || 0) + 1; }
  });
  return { tot: tot, by: by, all: all };
}
function level(n) { return n >= db.limit + 1 ? "bad" : n >= db.limit ? "warn" : "ok"; }
function detail(by) { return Object.keys(by).map(function (k) { return k + ": " + by[k]; }).join(", "); }

function liveCheck() {
  var box = $("live"), name = $("user").value;
  if (!norm(name)) { box.className = "alert"; return; }
  var s = stats(name);
  if (!s.all) { box.className = "alert ok"; box.textContent = "Primera solicitud de este usuario."; return; }
  var lv = level(s.tot);
  box.className = "alert " + (lv === "ok" ? "ok" : lv);
  box.textContent = (lv === "ok" ? "" : "⚠️ ") + name.trim() + " lleva " + s.tot + " solicitud(es) en los últimos " + db.months + " meses" + (s.tot ? " (" + detail(s.by) + ")" : "") + (lv === "ok" ? "." : ". Revisa antes de entregar.");
}

function render() {
  var q = norm($("q").value), html = "";
  var dl = {};
  db.reqs.forEach(function (r) { dl[r.user] = 1; });
  $("users").innerHTML = Object.keys(dl).map(function (u) { return "<option value=\"" + esc(u) + "\">"; }).join("");
  if (tab === 1) {
    var map = {};
    db.reqs.forEach(function (r) { var k = norm(r.user); (map[k] = map[k] || { name: r.user, area: r.area }).area = r.area || map[k].area; });
    var rows = Object.keys(map).filter(function (k) { return !q || k.indexOf(q) >= 0; }).map(function (k) {
      var s = stats(map[k].name); return { n: map[k].name, a: map[k].area, s: s };
    }).sort(function (a, b) { return b.s.tot - a.s.tot; });
    html = "<table><tr><th>Usuario</th><th>Área</th><th>En ventana</th><th>Total histórico</th><th>Detalle</th></tr>" +
      (rows.map(function (r) {
        return "<tr><td>" + esc(r.n) + "</td><td>" + esc(r.a || "-") + "</td><td><span class=\"badge " + level(r.s.tot) + "\">" + r.s.tot + "</span></td><td>" + r.s.all + "</td><td class=\"small\">" + esc(detail(r.s.by)) + "</td></tr>";
      }).join("") || "<tr><td colspan=5 class=\"small\">Sin registros todavía.</td></tr>") + "</table>";
  } else {
    var list = db.reqs.slice().reverse().filter(function (r) { return !q || norm(r.user).indexOf(q) >= 0; });
    html = "<table><tr><th>Fecha</th><th>Usuario</th><th>Artículo</th><th>Motivo</th><th>Obs.</th><th></th></tr>" +
      (list.map(function (r) {
        return "<tr><td>" + new Date(r.ts).toLocaleDateString("es-CL") + "</td><td>" + esc(r.user) + "</td><td>" + esc(r.item) + "</td><td>" + esc(r.reason) + "</td><td class=\"small\">" + esc(r.note || "") + "</td><td><button class=\"x\" data-id=\"" + r.id + "\" title=\"Eliminar\">✕</button></td></tr>";
      }).join("") || "<tr><td colspan=6 class=\"small\">Sin registros todavía.</td></tr>") + "</table>";
  }
  $("view").innerHTML = html;
  $("t1").className = tab === 1 ? "on" : ""; $("t2").className = tab === 2 ? "on" : "";
}

$("save").onclick = function () {
  var name = $("user").value.trim();
  if (!name) { $("user").focus(); return; }
  var s = stats(name);
  if (s.tot >= db.limit) {
    if (!confirm(name + " ya tiene " + s.tot + " solicitud(es) en los últimos " + db.months + " meses (" + detail(s.by) + ").\n¿Registrar la entrega de todos modos?")) return;
  }
  var req = { id: Date.now() + "" + Math.floor(Math.random() * 1000), ts: Date.now(), user: name, area: $("area").value.trim(), item: $("item").value, reason: $("reason").value, note: $("note").value.trim() };
  var done = function () { db.reqs.push(req); save(); $("note").value = ""; liveCheck(); render(); };
  if (!connected()) { done(); return; }
  setStatus("Guardando…"); $("save").disabled = true;
  api({ action: "add", req: req }).then(function () { done(); setStatus("✅ Guardado en Google Sheets"); })
    .catch(function (e) { alert("No se pudo guardar en Google Sheets: " + e.message); setStatus("⚠️ Error al guardar", true); })
    .then(function () { $("save").disabled = false; });
};
$("user").oninput = function () {
  var k = norm(this.value), f = db.reqs.filter(function (r) { return norm(r.user) === k; }).pop();
  if (f && !$("area").value) $("area").value = f.area || "";
  liveCheck();
};
$("limit").onchange = $("months").onchange = function () {
  db.limit = Math.max(1, +$("limit").value || 2); db.months = Math.max(1, +$("months").value || 12);
  save(); liveCheck(); render();
};
$("q").oninput = render;
$("t1").onclick = function () { tab = 1; render(); };
$("t2").onclick = function () { tab = 2; render(); };
$("view").onclick = function (e) {
  var id = e.target.getAttribute && e.target.getAttribute("data-id");
  if (id && confirm("¿Eliminar este registro?")) {
    var rm = function () { db.reqs = db.reqs.filter(function (r) { return r.id !== id; }); save(); liveCheck(); render(); };
    if (!connected()) { rm(); return; }
    api({ action: "delete", id: id }).then(rm).catch(function (e) { alert("No se pudo eliminar: " + e.message); });
  }
};
function dl(name, text, type) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
$("csv").onclick = function () {
  var h = "fecha,usuario,area,articulo,motivo,observacion\n";
  var b = db.reqs.map(function (r) {
    return [new Date(r.ts).toISOString().slice(0, 10), r.user, r.area, r.item, r.reason, r.note].map(function (v) { return '"' + String(v || "").replace(/"/g, '""') + '"'; }).join(",");
  }).join("\n");
  dl("solicitudes.csv", "\ufeff" + h + b, "text/csv");
};
$("bk").onclick = function () { dl("respaldo-solicitudes.json", JSON.stringify(db), "application/json"); };
$("rs").onclick = function () { if (connected()) { alert("Con Google Sheets conectado los datos ya quedan respaldados en la planilla."); return; } $("file").click(); };
$("cs").onclick = function () {
  conn = { url: $("cu").value.trim(), key: $("ck").value.trim() };
  try { localStorage.setItem("perifericos_conn", JSON.stringify(conn)); } catch (e) {}
  sync();
};
$("file").onchange = function () {
  var f = this.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try { var d = JSON.parse(r.result); if (d.reqs) { db = d; save(); load(); render(); liveCheck(); } } catch (e) { alert("Archivo no válido"); }
  };
  r.readAsText(f);
};
load(); render(); sync();