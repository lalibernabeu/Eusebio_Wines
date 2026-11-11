/**
 * Eusebio Wines - Catálogo Interactivo y Carrito
 */

/* ===== CONFIGURACIÓN ===== */
const WHATSAPP = '5492615668893'; // código de país + área + número, sin + ni espacios
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT8rOJx8MT8QXcsT8ZF0yCO9CdY4Ovw0oLNNl086-ogn4MUFmySPfOPk_8T9nZsGEB0JxeghFSTW1hm/pub?gid=587360108&single=true&output=csv'; // link CSV publicado de Google Sheets; vacío = usa productos.csv

/* ===== UTILIDADES ===== */
const $ = s => document.querySelector(s);
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORES = { tinto: '#5A1E2B', blanco: '#5B624F', rosado: '#C87D8A', espumante: '#8A7240', generoso: '#6B3F1D' };
const color = c => (Object.entries(COLORES).find(([k]) => c.toLowerCase().startsWith(k)) || [0, '#5A1E2B'])[1];
const BOTELLA = '<svg viewBox="0 0 16 56" aria-hidden="true"><path d="M6 0h4v14c0 4 5 7 5 14v26a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V28c0-7 5-10 5-14z" fill="currentColor"/></svg>';

/* ===== ESTADO DE LA APLICACIÓN ===== */
let P = [];
let cat = '';
let cart = {};

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

/* ===== CARGA DE DATOS (GOOGLE SHEETS O CSV LOCAL) ===== */
fetch(SHEET_URL || 'productos.csv')
  .then(r => r.text())
  .then(t => {
    P = t.trim().split(/\r?\n/).slice(1).map(l => {
      const c = l.split(',').map(s => s.replace(/^"|"$/g, '').trim());
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

    cat = 'TODOS';
    const cats = [...new Set(P.map(p => p.cat))];
    const hayPromos = P.some(p => p.pc > 0 && p.pp > 0);
    const promoBtn = hayPromos ? `<button data-cat="PROMOS" class="tab-promo">Promos</button>` : '';

    $('#tabs').innerHTML = `<button data-cat="TODOS">Todos</button>` + promoBtn + cats.map(c => `<button data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    $('#bod').innerHTML = '<option value="">Todas las bodegas</option>' + [...new Set(P.map(p => p.bod))].map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    pintar();
  })
  .catch(() => {
    $('#lista').innerHTML = '<p class="vacio">No pudimos cargar los vinos. Probá de nuevo en unos minutos.</p>';
  });

/* ===== RENDERIZADO DEL CATÁLOGO ===== */
function lista() {
  const q = $('#q').value.toLowerCase().trim(), b = $('#bod').value;
  const esPromo = cat === 'PROMOS';
  const esTodos = cat === 'TODOS';

  const items = P.filter(p => {
    if (q && !(p.nom + p.bod + p.var + p.cat).toLowerCase().includes(q)) return false;
    if (b && p.bod !== b) return false;
    if (esPromo) return (p.pc > 0 && p.pp > 0);
    if (esTodos) return true;
    return p.cat === cat;
  });

  let h = '', last = '';
  items.forEach(p => {
    const g = (esTodos || q || esPromo) ? p.bod + ' · ' + p.cat : p.bod;
    if (g !== last) {
      h += `<h3>${esc(p.bod)}${(esTodos || q || esPromo) ? `<small style="font-size:12px;color:var(--oliva);font-weight:400;text-transform:none"> · ${esc(p.cat)}</small>` : ''}</h3>`;
      last = g;
    }

    const n = cart[p.k] || 0, k = esc(p.k);
    const foto = getImgUrl(p.img, 400);
    const fotoLg = getImgUrl(p.img, 1200);
    const col = color(p.cat);
    const media = foto
      ? `<img src="${esc(foto)}" alt="${esc(p.nom)}" class="foto" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="botella-svg" style="display:none">${BOTELLA}</span>`
      : `<span class="botella-svg">${BOTELLA}</span>`;

    h += `<div class="row">
      <span class="b" data-img-zoom="${esc(fotoLg)}" data-nom="${esc(p.nom)}" data-col="${esc(col)}" style="color:${col}" title="Tocar para ampliar imagen">${media}</span>
      <div>
        <div class="nom" title="Consultar por este vino">${esc(p.nom)}</div>
        <div class="sub">${esc(p.var)}</div>
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
  });

  $('#lista').innerHTML = h || `<p class="vacio">${b ? 'No se encontraron vinos para esta selección.' : (esPromo ? 'No hay promociones activas por el momento.' : 'No encontramos vinos con esa búsqueda.')}</p>`;
}

/* ===== CÁLCULO DE TOTALES Y PROMOCIONES ===== */
function calc() {
  let sub = 0, u = 0, g = {}, lineas = [], desc = [];
  P.forEach(p => {
    const n = cart[p.k] || 0;
    if (!n) return;
    lineas.push([p, n]);
    sub += n * p.pre;
    u += n;
    if (p.pg) {
      const x = g[p.pg] = g[p.pg] || { n: 0, s: 0, pc: p.pc, pp: p.pp };
      x.n += n;
      x.s += n * p.pre;
    }
  });

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
  ${lineas.map(([p, n]) => `<div class="li">
    <div class="li-info">
      <b>${esc(p.nom)}</b>
      <small>${p.ml !== 750 ? '(' + p.ml + ' ml) · ' : ''}${money(p.pre)} c/u</small>
    </div>
    <div class="li-actions">
      <div class="st st-sm">
        <button data-k="${esc(p.k)}" data-d="-1" aria-label="Quitar uno">−</button>
        <b>${n}</b>
        <button data-k="${esc(p.k)}" data-d="1" aria-label="Agregar uno">+</button>
      </div>
      <span class="li-sub">${money(n * p.pre)}</span>
      <button class="del" data-del="${esc(p.k)}" title="Eliminar" aria-label="Eliminar producto">✕</button>
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
  lineas.forEach(([p, n]) => {
    m += `• ${n} x ${p.nom}${p.ml !== 750 ? ' (' + p.ml + ' ml)' : ''} — ${money(n * p.pre)}\n`;
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
  // 1. Manejo del modal de zoom de imagen
  if (e.target.closest('#modalZoomClose') || e.target.id === 'modalZoom') {
    cerrarZoomModal();
    return;
  }

  // 2. Manejo del modal de info WhatsApp
  if (e.target.closest('#modalInfoBack') || e.target.id === 'modalInfo') {
    cerrarInfoModal();
    return;
  }
  if (e.target.closest('#modalInfoWa')) {
    cerrarInfoModal();
    return;
  }

  // 3. Manejo del carrito (drawer)
  const drawer = $('#drawer');
  if (e.target.closest('#cerrar') || e.target === drawer) {
    drawer.classList.remove('on');
    return;
  }
  if (drawer.classList.contains('on')) {
    const btn = e.target.closest('button');
    if (!btn) return; // Permite interactuar con inputs/selects del carrito sin cerrarlo
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

  // 4. Botones fuera del carrito (barra flotante, agregar, +/-, tabs)
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

  // 5. Clic en la imagen del vino -> agrandar imagen
  const imgBox = e.target.closest('.b');
  if (imgBox) {
    abrirZoomModal(imgBox);
    return;
  }

  // 6. Clic en el TÍTULO del vino -> abrir ventana emergente con info y WhatsApp
  const nomEl = e.target.closest('.nom');
  if (nomEl) {
    abrirInfoModal(nomEl.textContent.trim());
    return;
  }

  // 7. En cualquier otra parte (fondo, varietal, notas, tags, precios, etc.) -> NO HACE NADA (no invasivo)
});

// Tecla Escape para accesibilidad
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cerrarZoomModal();
    cerrarInfoModal();
    $('#drawer').classList.remove('on');
  }
});

// Filtros de búsqueda y bodega
$('#q').addEventListener('input', pintar);
$('#bod').addEventListener('change', function () {
  if (this.value) cat = 'TODOS';
  $('#q').value = '';
  pintar();
});
