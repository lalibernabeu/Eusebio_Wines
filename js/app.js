/**
 * Eusebio Wines - Catálogo Interactivo, Promociones y Carrito
 */

/* ===== CONFIGURACIÓN ===== */
const WHATSAPP = '5492615668893'; // código de país + área + número, sin + ni espacios
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT8rOJx8MT8QXcsT8ZF0yCO9CdY4Ovw0oLNNl086-ogn4MUFmySPfOPk_8T9nZsGEB0JxeghFSTW1hm/pub?gid=587360108&single=true&output=csv'; // link CSV pestaña Productos
const COMBOS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT8rOJx8MT8QXcsT8ZF0yCO9CdY4Ovw0oLNNl086-ogn4MUFmySPfOPk_8T9nZsGEB0JxeghFSTW1hm/pub?gid=1780938970&single=true&output=csv'; // link CSV publicado de la pestaña Combos (vacío = usa combos.csv local)

/* ===== UTILIDADES ===== */
const $ = s => document.querySelector(s);
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const COLORES = { tinto: '#5A1E2B', blanco: '#5B624F', rosado: '#C87D8A', espumante: '#8A7240', generoso: '#6B3F1D' };
const color = c => (Object.entries(COLORES).find(([k]) => norm(c).startsWith(k)) || [0, '#5A1E2B'])[1];
const BOTELLA = '<svg viewBox="0 0 16 56" aria-hidden="true"><path d="M6 0h4v14c0 4 5 7 5 14v26a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V28c0-7 5-10 5-14z" fill="currentColor"/></svg>';

/* ===== ESTADO DE LA APLICACIÓN ===== */
let P = [];         // Lista de vinos individuales
let Combos = [];    // Lista de combos armados
let cat = 'TODOS';  // Categoría seleccionada
let cart = {};      // Carrito de compras

try {
  cart = JSON.parse(localStorage.getItem('eusebio-pedido') || '{}');
} catch (e) {
  cart = {};
}

/**
 * Normaliza y devuelve la URL de imagen optimizada (Google Drive o enlace directo)
 */
function getImgUrl(url, size = 400) {
  if (!url) return '';
  url = url.trim();
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) {
    return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}`;
  }
  return url;
}

/**
 * Parsea texto CSV respetando comillas y saltos de línea estándar
 */
function parseCSV(text) {
  if (!text) return [];
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    const row = [];
    let inQuotes = false, token = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(token.trim());
        token = '';
      } else {
        token += ch;
      }
    }
    row.push(token.trim());
    return row.map(s => s.replace(/^"|"$/g, '').trim());
  });
}

/**
 * Verifica si un combo está activo y si todos sus vinos componentes tienen stock
 */
function comboDisponible(c) {
  if (!c.on || !c.nom || c.pre <= 0) return false;
  const requeridos = [c.v1, c.v2, c.v3].map(v => norm(v)).filter(Boolean);
  if (requeridos.length < 2) return false;
  // Cada vino del combo debe existir y estar activo en el catálogo de productos
  return requeridos.every(req => P.some(p => norm(p.nom) === req && p.on));
}

/* ===== CARGA DE DATOS ===== */
Promise.all([
  fetch(SHEET_URL || 'productos.csv').then(r => r.text()),
  fetch(COMBOS_SHEET_URL || 'combos.csv').then(r => r.text()).catch(() => '')
])
  .then(([tProd, tCombos]) => {
    // 1. Parseo de productos individuales
    const prodRows = parseCSV(tProd).slice(1);
    P = prodRows.map(c => {
      const pc = +c[8] || 0;
      const pp = +c[9] || 0;
      const pg = c[7] || (pc && pp ? c[2] + '|' + c[4] : '');
      return {
        cat: c[0] || '',
        bod: c[1] || '',
        nom: c[2] || '',
        var: c[3] || '',
        ml: +c[4] || 750,
        pre: +c[5] || 0,
        on: (c[6] || 'si').toLowerCase() !== 'no',
        pg: pg,
        pc: pc,
        pp: pp,
        img: c[10] || '',
        notas: c[11] || '',
        k: (c[2] || '') + '|' + (c[4] || '')
      };
    }).filter(p => p.on && p.nom);

    // 2. Parseo de combos armados
    if (tCombos) {
      const comboRows = parseCSV(tCombos).slice(1);
      Combos = comboRows.map((c, idx) => {
        const id = c[0] || `combo_${idx + 1}`;
        return {
          id: id,
          nom: c[1] || '',
          v1: c[2] || '',
          v2: c[3] || '',
          v3: c[4] || '',
          pre: +c[5] || 0,
          img: c[6] || '',
          on: (c[7] || 'si').toLowerCase() !== 'no',
          k: 'combo:' + id
        };
      }).filter(c => c.nom && c.pre > 0);
    }

    // 3. Inicialización de pestañas y selectores
    cat = 'TODOS';
    const cats = [...new Set(P.map(p => p.cat))];
    const hayPromosCant = P.some(p => p.pc > 0 && p.pp > 0);
    const hayCombos = Combos.some(c => comboDisponible(c));
    const promoBtn = (hayPromosCant || hayCombos) ? `<button data-cat="PROMOS" class="tab-promo">Promos</button>` : '';

    $('#tabs').innerHTML = `<button data-cat="TODOS">Todos</button>` + promoBtn + cats.map(c => `<button data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    $('#bod').innerHTML = '<option value="">Todas las bodegas</option>' + [...new Set(P.map(p => p.bod))].map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

    pintar();
  })
  .catch(() => {
    $('#lista').innerHTML = '<p class="vacio">No pudimos cargar los vinos. Probá de nuevo en unos minutos.</p>';
  });

/* ===== RENDERIZADO DEL CATÁLOGO ===== */
function renderItemVino(p, esTodos, q, esPromo) {
  const n = cart[p.k] || 0, k = esc(p.k);
  const foto = getImgUrl(p.img, 400);
  const fotoLg = getImgUrl(p.img, 1200);
  const col = color(p.cat);
  const media = foto
    ? `<img src="${esc(foto)}" alt="${esc(p.nom)}" class="foto" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="botella-svg" style="display:none">${BOTELLA}</span>`
    : `<span class="botella-svg">${BOTELLA}</span>`;

  return `<div class="row">
    <span class="b" data-img-zoom="${esc(fotoLg)}" data-nom="${esc(p.nom)}" data-col="${esc(col)}" style="color:${col}" title="Tocar para ampliar imagen">${media}</span>
    <div>
      <div class="nom" title="Consultar por este vino">${esc(p.nom)}</div>
      <div class="sub">${(q && !esTodos ? esc(p.bod) + ' · ' : '') + esc(p.var)}</div>
      ${p.notas ? `<div class="notas">🍷 ${esc(p.notas)}</div>` : ''}
      <div class="tags">
        <span>${p.ml} ml</span>
        ${p.ml < 500 ? '<span>Media botella</span>' : ''}
        ${p.pc ? `<span class="promo">Llevá ${p.pc} por ${money(p.pp)}</span>` : ''}
      </div>
    </div>
    <div class="der">
      <div class="pre">${money(p.pre)}</div>
      <small>por botella</small>
      ${n ? `<div class="st"><button data-k="${k}" data-d="-1" aria-label="Quitar uno">−</button><b>${n}</b><button data-k="${k}" data-d="1" aria-label="Agregar uno">+</button></div>`
      : `<button class="add" data-k="${k}" data-d="1">Agregar</button>`}
    </div>
  </div>`;
}

function renderItemCombo(c) {
  const n = cart[c.k] || 0, k = esc(c.k);
  const foto = getImgUrl(c.img, 400);
  const fotoLg = getImgUrl(c.img, 1200);
  const col = 'var(--bordo)';
  const vinos = [c.v1, c.v2, c.v3].filter(Boolean);
  const cantBotellas = vinos.length;

  const media = foto
    ? `<img src="${esc(foto)}" alt="${esc(c.nom)}" class="foto" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="botella-svg" style="display:none">${BOTELLA}</span>`
    : `<span class="botella-svg">${BOTELLA}</span>`;

  return `<div class="row">
    <span class="b b-combo" data-img-zoom="${esc(fotoLg)}" data-nom="${esc(c.nom)}" data-col="${esc(col)}" style="color:${col}" title="Tocar para ampliar imagen">${media}</span>
    <div>
      <div class="nom" title="Consultar por este combo">${esc(c.nom)}</div>
      <div class="combo-vinos">
        ${vinos.map(v => `<span class="combo-vino-item">• ${esc(v)}</span>`).join('')}
      </div>
      <div class="tags">
        <span>Combo x ${cantBotellas} botellas</span>
        <span class="promo">Combo especial</span>
      </div>
    </div>
    <div class="der">
      <div class="pre">${money(c.pre)}</div>
      <small>precio del combo</small>
      ${n ? `<div class="st"><button data-k="${k}" data-d="-1" aria-label="Quitar uno">−</button><b>${n}</b><button data-k="${k}" data-d="1" aria-label="Agregar uno">+</button></div>`
      : `<button class="add" data-k="${k}" data-d="1">Agregar combo</button>`}
    </div>
  </div>`;
}

function lista() {
  const q = $('#q').value.toLowerCase().trim();
  const b = $('#bod').value;
  const orden = $('#orden') ? $('#orden').value : '';
  const esPromo = cat === 'PROMOS';
  const esTodos = cat === 'TODOS';

  // 1. Filtrado de vinos
  let itemsVinos = P.filter(p => {
    if (q && !(p.nom + p.bod + p.var + p.cat).toLowerCase().includes(q)) return false;
    if (b && p.bod !== b) return false;
    if (esPromo) return (p.pc > 0 && p.pp > 0);
    if (esTodos) return true;
    return p.cat === cat;
  });

  // 2. Ordenamiento de vinos
  if (orden === 'asc') {
    itemsVinos.sort((x, y) => x.pre - y.pre);
  } else if (orden === 'desc') {
    itemsVinos.sort((x, y) => y.pre - x.pre);
  } else if (esTodos) {
    // TAREA 2: Orden estable en TODOS por bodega (normalizada), luego varietal/categoría, luego nombre
    itemsVinos.sort((x, y) => {
      const bComp = norm(x.bod).localeCompare(norm(y.bod));
      if (bComp !== 0) return bComp;
      const vComp = norm(x.cat).localeCompare(norm(y.cat)) || norm(x.var).localeCompare(norm(y.var));
      if (vComp !== 0) return vComp;
      return norm(x.nom).localeCompare(norm(y.nom));
    });
  }

  // 3. Filtrado y ordenamiento de combos (solo si estamos en PROMOS)
  let itemsCombos = [];
  if (esPromo) {
    itemsCombos = Combos.filter(c => {
      if (!comboDisponible(c)) return false;
      const vinosTexto = [c.nom, c.v1, c.v2, c.v3].join(' ').toLowerCase();
      if (q && !vinosTexto.includes(q)) return false;
      // Si se filtró por bodega, verificar si algún vino del combo pertenece a dicha bodega
      if (b) {
        const vinosDelCombo = [norm(c.v1), norm(c.v2), norm(c.v3)].filter(Boolean);
        const coincideBod = P.some(p => norm(p.bod) === norm(b) && vinosDelCombo.includes(norm(p.nom)));
        if (!coincideBod) return false;
      }
      return true;
    });

    if (orden === 'asc') {
      itemsCombos.sort((x, y) => x.pre - y.pre);
    } else if (orden === 'desc') {
      itemsCombos.sort((x, y) => y.pre - x.pre);
    }
  }

  // 4. Armado del HTML
  let h = '';

  if (esPromo) {
    // Renderizado en pestaña PROMOS: Combos + Promos por cantidad
    if (itemsCombos.length > 0) {
      h += `<h3 class="seccion-header" style="margin-top:10px">Combos armados</h3>`;
      itemsCombos.forEach(c => {
        h += renderItemCombo(c);
      });
    }

    if (itemsVinos.length > 0) {
      if (itemsCombos.length > 0) {
        h += `<h3 class="seccion-header">Promociones por cantidad</h3>`;
      }
      let last = '';
      itemsVinos.forEach(p => {
        if (!orden) {
          const g = p.bod + ' · ' + p.cat;
          if (g !== last) {
            h += `<h3>${esc(p.bod)}<small style="font-size:12px;color:var(--oliva);font-weight:400;text-transform:none"> · ${esc(p.cat)}</small></h3>`;
            last = g;
          }
        }
        h += renderItemVino(p, esTodos, q, esPromo);
      });
    }

    if (!itemsCombos.length && !itemsVinos.length) {
      h = `<p class="vacio">${b ? 'No se encontraron promociones para esta bodega.' : 'No hay promociones activas por el momento.'}</p>`;
    }
  } else {
    // Renderizado en pestañas habituales (TODOS, Tintos, Blancos, etc.)
    let last = '';
    itemsVinos.forEach(p => {
      if (!orden) {
        const g = esTodos ? p.bod : p.bod;
        if (g !== last) {
          h += `<h3>${esc(p.bod)}${esTodos ? `<small style="font-size:12px;color:var(--oliva);font-weight:400;text-transform:none"> · ${esc(p.cat)}</small>` : ''}</h3>`;
          last = g;
        }
      }
      h += renderItemVino(p, esTodos, q, esPromo);
    });

    if (!itemsVinos.length) {
      h = `<p class="vacio">${b ? 'No se encontraron vinos para esta selección.' : 'No encontramos vinos con esa búsqueda.'}</p>`;
    }
  }

  $('#lista').innerHTML = h;
}

/* ===== CÁLCULO DE TOTALES Y PROMOCIONES ===== */
function calc() {
  let sub = 0, u = 0, g = {}, lineas = [], desc = [];

  // 1. Líneas de vinos individuales
  P.forEach(p => {
    const n = cart[p.k] || 0;
    if (!n) return;
    lineas.push({
      esCombo: false,
      obj: p,
      n: n,
      nom: p.nom,
      subtexto: `${p.ml !== 750 ? '(' + p.ml + ' ml) · ' : ''}${money(p.pre)} c/u`,
      pre: p.pre,
      total: n * p.pre,
      k: p.k
    });
    sub += n * p.pre;
    u += n;
    if (p.pg) {
      const x = g[p.pg] = g[p.pg] || { n: 0, s: 0, pc: p.pc, pp: p.pp };
      x.n += n;
      x.s += n * p.pre;
    }
  });

  // 2. Líneas de combos armados
  Combos.forEach(c => {
    const n = cart[c.k] || 0;
    if (!n) return;
    const vinosDetalle = [c.v1, c.v2, c.v3].filter(Boolean).join(' + ');
    const cantBotellas = [c.v1, c.v2, c.v3].filter(Boolean).length;
    lineas.push({
      esCombo: true,
      obj: c,
      n: n,
      nom: c.nom,
      subtexto: `Incluye: ${vinosDetalle} · ${money(c.pre)} combo`,
      pre: c.pre,
      total: n * c.pre,
      k: c.k
    });
    sub += n * c.pre;
    u += n * cantBotellas; // Suma las botellas reales del combo al contador general
  });

  // 3. Descuentos por cantidad en vinos regulares
  Object.values(g).forEach(x => {
    const sets = Math.floor(x.n / x.pc);
    const d = sets * (x.s / x.n * x.pc - x.pp);
    if (d > 0) desc.push([`Promo ${x.pc} x ${money(x.pp)}${sets > 1 ? ' (x' + sets + ')' : ''}`, d]);
  });

  const total = sub - desc.reduce((a, d) => a + d[1], 0);
  return { lineas, desc, total, u };
}

/* ===== ACTUALIZACIÓN DE INTERFAZ GENERAL ===== */
function pintar() {
  const qVal = $('#q').value;
  document.querySelectorAll('#tabs button').forEach(b => {
    b.classList.toggle('on', !qVal && b.dataset.cat === cat);
  });

  lista();

  const { total, u } = calc(), bar = $('#bar');
  bar.className = u ? 'on' : '';
  bar.innerHTML = `<span>Ver pedido · ${u} ${u === 1 ? 'botella' : 'botellas'}</span><span>${money(total)}</span>`;

  try {
    localStorage.setItem('eusebio-pedido', JSON.stringify(cart));
  } catch (e) { }

  if ($('#drawer').classList.contains('on')) abrir();
}

/* ===== CARRITO / DRAWER ===== */
function abrir() {
  const { lineas, desc, total, u } = calc();
  if (!u) {
    $('#drawer').classList.remove('on');
    return;
  }

  $('#sheet').innerHTML = `<h2>Tu pedido</h2>
  ${lineas.map(l => `<div class="li">
    <div class="li-info">
      <b>${esc(l.nom)}</b>
      <small>${esc(l.subtexto)}</small>
    </div>
    <div class="li-actions">
      <div class="st st-sm">
        <button data-k="${esc(l.k)}" data-d="-1" aria-label="Quitar uno">−</button>
        <b>${l.n}</b>
        <button data-k="${esc(l.k)}" data-d="1" aria-label="Agregar uno">+</button>
      </div>
      <span class="li-sub">${money(l.total)}</span>
      <button class="del" data-del="${esc(l.k)}" title="Eliminar" aria-label="Eliminar producto">✕</button>
    </div>
  </div>`).join('')}
  ${desc.map(d => `<div class="li d"><span>${esc(d[0])}</span><span>−${money(d[1])}</span></div>`).join('')}
  <div class="tot"><span>Total</span><span>${money(total)}</span></div>
  <label for="nombre">Tu nombre</label>
  <input id="nombre" autocomplete="name" placeholder="Tu nombre y apellido">
  <label for="ent">¿Cómo lo recibís?</label>
  <select id="ent">
    <option value="Retiro en Mendoza (coordinamos horario)">📦 Retiro en Mendoza (coordinamos horario)</option>
    <option value="Envío en Mendoza (con costo según zona)">🚚 Envío en Mendoza (con costo según zona)</option>
  </select>
  <div class="pago-badge">💳 <b>Medios de pago:</b>&nbsp;Transferencia / Efectivo al recibir</div>
  <button class="send" id="enviar">Enviar pedido por WhatsApp</button>
  <button class="cerrar" id="cerrar">Seguir viendo vinos</button>`;

  $('#drawer').classList.add('on');
}

/* ===== ENVÍO DE PEDIDO POR WHATSAPP ===== */
function enviar() {
  const { lineas, desc, total } = calc(), nombre = $('#nombre').value.trim();
  let m = 'Hola Eusebio Wines! Quiero hacer este pedido:\n\n';
  lineas.forEach(l => {
    if (l.esCombo) {
      const vinos = [l.obj.v1, l.obj.v2, l.obj.v3].filter(Boolean).join(' + ');
      m += `• ${l.n} x ${l.nom} (${vinos}) — ${money(l.total)}\n`;
    } else {
      m += `• ${l.n} x ${l.nom}${l.obj.ml !== 750 ? ' (' + l.obj.ml + ' ml)' : ''} — ${money(l.total)}\n`;
    }
  });
  desc.forEach(d => {
    m += `• ${d[0]}: −${money(d[1])}\n`;
  });
  m += `\nTotal: ${money(total)}\nEntrega: ${$('#ent').value}`;
  if (nombre) m += `\nNombre: ${nombre}`;
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(m)}`, '_blank');
}

/* ===== MODAL INFO / CONSULTA WHATSAPP ===== */
function abrirInfoModal(vino) {
  const modal = $('#modalInfo');
  const title = $('#modalInfoTitle');
  const desc = $('#modalInfoDesc');
  const waBtn = $('#modalInfoWa');
  if (vino) {
    title.textContent = vino;
    desc.textContent = `Para conocer más sobre ${vino}, notas de cata o asesoramiento personalizado, escribinos directamente por WhatsApp.`;
    waBtn.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola! Quisiera más información sobre ' + vino)}`;
  } else {
    title.textContent = '¿Querés más información?';
    desc.textContent = 'Para más información sobre nuestros vinos o asesoramiento personalizado, escribinos directamente por WhatsApp.';
    waBtn.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola! Quisiera hacerles una consulta sobre los vinos')}`;
  }
  modal.classList.add('on');
}

function cerrarInfoModal() {
  $('#modalInfo').classList.remove('on');
}

/* ===== MODAL ZOOM IMAGEN ===== */
function abrirZoomModal(bEl) {
  const zoomUrl = bEl.dataset.imgZoom;
  const nom = bEl.dataset.nom || '';
  const col = bEl.dataset.col || '#5A1E2B';
  const wrap = $('#modalZoomWrap');
  const title = $('#modalZoomTitle');
  title.textContent = nom;
  if (zoomUrl) {
    wrap.innerHTML = `<img src="${esc(zoomUrl)}" alt="${esc(nom)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none;color:${esc(col)}" class="botella-svg-lg">${BOTELLA}</span>`;
  } else {
    wrap.innerHTML = `<span style="color:${esc(col)}" class="botella-svg-lg">${BOTELLA}</span>`;
  }
  $('#modalZoom').classList.add('on');
}

function cerrarZoomModal() {
  $('#modalZoom').classList.remove('on');
}

/* ===== MANEJADORES DE EVENTOS ===== */
document.addEventListener('click', e => {
  // 1. Modal zoom
  if (e.target.closest('#modalZoomClose') || e.target.id === 'modalZoom') {
    cerrarZoomModal();
    return;
  }

  // 2. Modal info WhatsApp
  if (e.target.closest('#modalInfoBack') || e.target.id === 'modalInfo' || e.target.closest('#modalInfoWa')) {
    cerrarInfoModal();
    return;
  }

  // 3. Carrito (drawer)
  const drawer = $('#drawer');
  if (e.target.closest('#cerrar') || e.target === drawer) {
    drawer.classList.remove('on');
    return;
  }
  if (drawer.classList.contains('on')) {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.del) {
      delete cart[btn.dataset.del];
      pintar();
    } else if (btn.dataset.k) {
      const n = (cart[btn.dataset.k] || 0) + +btn.dataset.d;
      if (n > 0) cart[btn.dataset.k] = n; else delete cart[btn.dataset.k];
      pintar();
    } else if (btn.id === 'enviar') {
      enviar();
    }
    return;
  }

  // 4. Botones principales (barra flotante, agregar, +/-, tabs)
  const t = e.target.closest('button');
  if (t) {
    if (t.id === 'bar') {
      abrir();
    } else if (t.dataset.k) {
      const n = (cart[t.dataset.k] || 0) + +t.dataset.d;
      if (n > 0) cart[t.dataset.k] = n; else delete cart[t.dataset.k];
      pintar();
    } else if (t.dataset.cat) {
      cat = t.dataset.cat;
      $('#q').value = '';
      pintar();
    }
    return;
  }

  // 5. Clic en imagen -> ampliar zoom
  const imgBox = e.target.closest('.b');
  if (imgBox) {
    abrirZoomModal(imgBox);
    return;
  }

  // 6. Clic en título del producto o combo -> abrir consulta WhatsApp
  const nomEl = e.target.closest('.nom');
  if (nomEl) {
    abrirInfoModal(nomEl.textContent.trim());
    return;
  }
});

// Tecla Escape para accesibilidad
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cerrarZoomModal();
    cerrarInfoModal();
    $('#drawer').classList.remove('on');
  }
});

// Filtros y ordenamiento
$('#q').addEventListener('input', pintar);
$('#bod').addEventListener('change', function () {
  if (this.value) cat = 'TODOS';
  $('#q').value = '';
  pintar();
});
if ($('#orden')) {
  $('#orden').addEventListener('change', pintar);
}
