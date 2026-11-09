var KEY = "perifericos_v1";
var db = { reqs: [], limit: 2, months: 12 };
var tab = 1;
var $ = function (id) { return document.getElementById(id); };

function load() {
  try { var r = localStorage.getItem(KEY); if (r) db = JSON.parse(r); } catch (e) {}
  $("limit").value = db.limit; $("months").value = db.months;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
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
  db.reqs.push({ id: Date.now() + "" + Math.floor(Math.random() * 1000), ts: Date.now(), user: name, area: $("area").value.trim(), item: $("item").value, reason: $("reason").value, note: $("note").value.trim() });
  save(); $("note").value = ""; liveCheck(); render();
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
  if (id && confirm("¿Eliminar este registro?")) { db.reqs = db.reqs.filter(function (r) { return r.id !== id; }); save(); liveCheck(); render(); }
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
$("rs").onclick = function () { $("file").click(); };
$("file").onchange = function () {
  var f = this.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try { var d = JSON.parse(r.result); if (d.reqs) { db = d; save(); load(); render(); liveCheck(); } } catch (e) { alert("Archivo no válido"); }
  };
  r.readAsText(f);
};
load(); render();