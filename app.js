(function () {
    'use strict';

    /* 1. CONSTANTES Y UTILIDADES */
    const CORREO_DEMO = 'familia.morales@housepay.co';
    const CLAVE_DEMO = '12345678';
    const K_USUARIOS = 'hp_usuarios';
    const K_SESION = 'hp_sesion';
    const K_DATOS = 'hp_datos_';
    const K_TOAST = 'hp_toast';
    const VERSION_DATOS = 1;
    const VALOR_MIN = 100;
    const VALOR_MAX = 50000000;
    const DIAS_ALERTA_VENCIMIENTO = 3;   // pagos con vencimiento en 3 dias o menos disparan una alerta
    const UMBRAL_CERCA = 0.9;            // 90% del rubro indica que ya esta cerca del limite

    const CATS = [
        { nombre: 'Arriendo', corto: 'Arriendo', titulo: 'Arriendo', icono: 'fa-house', color: 'indigo' },
        { nombre: 'Mercado', corto: 'Mercado', titulo: 'Mercado y Despensa', icono: 'fa-cart-shopping', color: 'verde' },
        { nombre: 'Servicios publicos', corto: 'Servicios', titulo: 'Servicios Publicos', icono: 'fa-bolt', color: 'azul' },
        { nombre: 'Transporte', corto: 'Transporte', titulo: 'Transporte y Gasolina', icono: 'fa-car', color: 'ambar' },
        { nombre: 'Educacion', corto: 'Educacion', titulo: 'Educacion y Cursos', icono: 'fa-graduation-cap', color: 'morado' },
        { nombre: 'Entretenimiento', corto: 'Entretenimiento', titulo: 'Entretenimiento', icono: 'fa-gamepad', color: 'rosa' }
    ];
    const catPor = (nombre) => CATS.find((c) => c.nombre === nombre) || CATS[0];

    const TIPOS_MEDIO = {
        debito: { clase: 'banco-negra', titulo: 'Tarjeta Debito', icono: 'fa-building-columns', filtro: 'Tarjeta debito' },
        credito: { clase: 'banco-azul', titulo: 'Tarjeta de Credito', icono: 'fa-credit-card', filtro: 'Tarjeta de credito' },
        transferencia: { clase: 'banco-morada', titulo: 'Transferencia Bancaria', icono: 'fa-mobile-screen-button', filtro: 'Transferencia bancaria' },
        efectivo: { clase: 'banco-verde', titulo: 'Efectivo Fisico', icono: 'fa-money-bill-1-wave', filtro: 'Efectivo' }
    };

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const $ = (sel, raiz) => (raiz || document).querySelector(sel);
    const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

    const pad = (n) => String(n).padStart(2, '0');
    const aISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const deISO = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
    const hoy = () => aISO(new Date());
    const sumarDias = (iso, n) => { const d = deISO(iso); d.setDate(d.getDate() + n); return aISO(d); };
    const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);
    const mesDe = (iso) => iso.slice(0, 7);
    const mesActual = () => mesDe(hoy());
    const esFechaValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && aISO(deISO(s)) === s;
    const fmtFecha = (iso) => { const d = deISO(iso); return pad(d.getDate()) + ' ' + MESES_CORTO[d.getMonth()] + ' ' + d.getFullYear(); };
    const nombreMes = (ym) => { const p = ym.split('-').map(Number); return MESES[p[1] - 1] + ' ' + p[0]; };
    const mesAnterior = (ym, n) => { const p = ym.split('-').map(Number); const d = new Date(p[0], p[1] - 1 - n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
    const diasDelMes = (ym) => { const p = ym.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); };

    // Formato colombiano para COP: $1.267.900 con separador de miles en punto
    const pesos = (n) => {
        const neg = n < 0;
        const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (neg ? '-' : '') + '$' + s;
    };
    // Formato abreviado para resúmenes: $2.9M, $3.03M, $850k
    const pesosCorto = (n) => {
        if (n >= 1000000) return '$' + Number((n / 1000000).toFixed(2)) + 'M';
        if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
        return '$' + n;
    };

    const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const suma = (arr) => arr.reduce((a, g) => a + g.valor, 0);
    const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

    /* 2. ALMACENAMIENTO (localStorage con respaldo en memoria) */
    const memoria = {};
    function leer(clave, defecto) {
        try {
            const v = localStorage.getItem(clave);
            return v === null ? defecto : JSON.parse(v);
        } catch (e) {
            return clave in memoria ? memoria[clave] : defecto;
        }
    }
    function guardar(clave, valor) {
        try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { memoria[clave] = valor; }
    }
    function borrar(clave) {
        try { localStorage.removeItem(clave); } catch (e) { /* nada */ }
        delete memoria[clave];
    }

    async function hashTexto(texto) {
        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
            const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
            return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        }
        // Respaldo simple si el navegador no soporta crypto.subtle
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < texto.length; i++) {
            const ch = texto.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return 'c' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    }

    /* 3. USUARIOS, SESION Y DATOS DEL HOGAR */
    let U = null;   // usuario activo en la sesion actual
    let D = null;   // datos del hogar asociados al usuario actual
    let repintar = function () { };

    const usuarios = () => leer(K_USUARIOS, []);

    async function asegurarDemo() {
        const lista = usuarios();
        if (!lista.some((u) => u.correo === CORREO_DEMO)) {
            const sal = uid();
            lista.push({ correo: CORREO_DEMO, nombre: 'Camila Morales', hogar: 'Familia Morales', sal: sal, hash: await hashTexto(sal + ':' + CLAVE_DEMO), demo: true });
            guardar(K_USUARIOS, lista);
        }
    }

    function buscarUsuario(texto) {
        const t = String(texto || '').trim().toLowerCase();
        if (!t) return null;
        const lista = usuarios();
        const exacto = lista.find((u) => u.correo === t);
        if (exacto) return exacto;
        const porUsuario = lista.filter((u) => u.correo.split('@')[0] === t);
        return porUsuario.length === 1 ? porUsuario[0] : null;
    }

    async function iniciarSesion(texto, clave) {
        await asegurarDemo();
        if (!String(texto || '').trim() || !clave) return { ok: false, error: 'Ingresa tu correo o usuario y tu contrasena.' };
        const u = buscarUsuario(texto);
        if (!u) return { ok: false, error: 'No encontramos una cuenta con ese correo o usuario.' };
        if (u.hash !== await hashTexto(u.sal + ':' + clave)) return { ok: false, error: 'La contrasena no es correcta.' };
        guardar(K_SESION, u.correo);
        return { ok: true };
    }

    async function crearCuenta(f) {
        const nombre = f.nombre.trim().replace(/\s+/g, ' ');
        const correo = f.correo.trim().toLowerCase();
        if (nombre.length < 3 || nombre.length > 60) return { ok: false, error: 'El nombre debe tener entre 3 y 60 caracteres.' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { ok: false, error: 'Escribe un correo electronico valido.' };
        if (f.clave.length < 8) return { ok: false, error: 'La contrasena debe tener minimo 8 caracteres.' };
        if (f.clave !== f.clave2) return { ok: false, error: 'Las contrasenas no coinciden.' };
        await asegurarDemo();
        if (usuarios().some((u) => u.correo === correo)) return { ok: false, error: 'Ya existe una cuenta con ese correo.' };
        const sal = uid();
        const u = { correo: correo, nombre: nombre, hogar: 'Hogar de ' + nombre.split(' ')[0], sal: sal, hash: await hashTexto(sal + ':' + f.clave) };
        guardar(K_USUARIOS, usuarios().concat([u]));
        guardar(K_SESION, correo);
        return { ok: true };
    }

    function cerrarSesion() { borrar(K_SESION); }

    function datosVacios(hogar) {
        const presupuestos = {};
        CATS.forEach((c) => { presupuestos[c.nombre] = 0; });
        return { version: VERSION_DATOS, hogar: hogar, presupuestoTotal: 0, presupuestos: presupuestos, medios: [], gastos: [], pagos: [] };
    }

    // Datos de ejemplo para el hogar demo. Las fechas se calculan en funcion de la
    // fecha actual para que las alertas y los pagos proximos sigan teniendo sentido.
    function datosDemo() {
        const h = hoy();
        const ym = mesDe(h);
        const diaHoy = new Date().getDate();
        const dia = (n) => ym + '-' + pad(Math.min(n, diaHoy));
        let orden = Date.now();

        const medios = [
            { id: 'm-deb', tipo: 'debito', nombre: 'Bancolombia', detalle: 'CUENTA CORRIENTE FAMILIAR', digitos: '3410', titular: 'Familia Morales', principal: true },
            { id: 'm-cre', tipo: 'credito', nombre: 'Visa Hogar', detalle: 'VISA HOGAR COMPARTIDA', digitos: '9822', titular: 'Familia Morales', cupo: 2500000 },
            { id: 'm-tra', tipo: 'transferencia', nombre: 'Nequi', detalle: 'NEQUI / DAVIPLATA HOGAR', digitos: '4482', numero: '315 ••• 4482', titular: 'Familia Morales' },
            { id: 'm-efe', tipo: 'efectivo', nombre: 'Caja Chica', detalle: 'GAVETA DE SALON', saldo: 150000, ultimoMov: sumarDias(h, -1), titular: 'Familia Morales' }
        ];

        // [nombre, categoria, valor, dia del mes, medio]
        const mesEnCurso = [
            ['Canon de arriendo', 'Arriendo', 1300000, 1, 'm-tra'],
            ['Compra semanal Exito', 'Mercado', 185000, 13, 'm-deb'],
            ['Plaza de mercado y verduras', 'Mercado', 280000, 7, 'm-deb'],
            ['Compra mensual de despensa', 'Mercado', 315000, 3, 'm-deb'],
            ['Factura de Gas Natural', 'Servicios publicos', 68500, 12, 'm-tra'],
            ['Servicio de agua', 'Servicios publicos', 95500, 8, 'm-tra'],
            ['Factura de energia', 'Servicios publicos', 156000, 4, 'm-deb'],
            ['Gasolina del carro', 'Transporte', 60000, 9, 'm-efe'],
            ['Tanque lleno de gasolina', 'Transporte', 75000, 4, 'm-cre'],
            ['Recarga tarjeta de transporte', 'Transporte', 80000, 2, 'm-efe'],
            ['Suscripcion streaming', 'Entretenimiento', 32900, 10, 'm-cre'],
            ['Cine en familia', 'Entretenimiento', 95000, 5, 'm-cre'],
            ['Cena de cumpleanos', 'Entretenimiento', 142100, 11, 'm-cre'],
            ['Cuota curso de ingles', 'Educacion', 147100, 7, 'm-deb']
        ];
        const gastos = mesEnCurso.map((r) => ({ id: uid(), nombre: r[0], categoria: r[1], valor: r[2], fecha: dia(r[3]), vencimiento: '', medioId: r[4], creado: orden++ }));

        // historial de los 3 meses anteriores (para la grafica de reportes)
        [[3, 2900000], [2, 3400000], [1, 3200000]].forEach((par) => {
            const m = mesAnterior(ym, par[0]);
            const resto = par[1] - 1300000;
            const mer = Math.round(resto * 0.38 / 100) * 100;
            const ser = Math.round(resto * 0.14 / 100) * 100;
            const tra = Math.round(resto * 0.12 / 100) * 100;
            const ent = Math.round(resto * 0.16 / 100) * 100;
            const edu = resto - mer - ser - tra - ent;
            [
                ['Canon de arriendo', 'Arriendo', 1300000, 1, 'm-tra'],
                ['Compras del mes', 'Mercado', mer, 10, 'm-deb'],
                ['Servicios del mes', 'Servicios publicos', ser, 12, 'm-tra'],
                ['Gasolina y transporte', 'Transporte', tra, 15, 'm-efe'],
                ['Salidas y streaming', 'Entretenimiento', ent, 18, 'm-cre'],
                ['Cuotas y cursos', 'Educacion', edu, 20, 'm-deb']
            ].forEach((r) => gastos.push({ id: uid(), nombre: r[0], categoria: r[1], valor: r[2], fecha: m + '-' + pad(r[3]), vencimiento: '', medioId: r[4], creado: orden++ }));
        });

        return {
            version: VERSION_DATOS,
            hogar: 'Familia Morales',
            presupuestoTotal: 4300000,
            presupuestos: { 'Arriendo': 1300000, 'Mercado': 1200000, 'Servicios publicos': 400000, 'Transporte': 350000, 'Educacion': 310000, 'Entretenimiento': 250000 },
            medios: medios,
            gastos: gastos,
            pagos: [
                { id: 'p-int', nombre: 'Factura Internet Fibra Optica', categoria: 'Servicios publicos', valor: 45000, vence: sumarDias(h, 2), icono: 'fa-wifi' },
                { id: 'p-ene', nombre: 'Energia y Gas Natural', categoria: 'Servicios publicos', valor: 132000, vence: sumarDias(h, 5), icono: 'fa-bolt' },
                { id: 'p-arr', nombre: 'Cuota Canon Arriendo', categoria: 'Arriendo', valor: 650000, vence: sumarDias(h, 14), icono: 'fa-house' }
            ]
        };
    }

    function cargarDatos() {
        let d = leer(K_DATOS + U.correo, null);
        if (!d || d.version !== VERSION_DATOS) {
            d = U.demo ? datosDemo() : datosVacios(U.hogar);
            guardar(K_DATOS + U.correo, d);
        }
        return d;
    }
    const guardarDatos = () => guardar(K_DATOS + U.correo, D);

    /* 4. CALCULOS */
    const gastosMes = (ym) => D.gastos.filter((g) => mesDe(g.fecha) === ym);
    const medioPor = (id) => D.medios.find((m) => m.id === id);

    function porCategoria(ym) {
        const r = {};
        CATS.forEach((c) => { r[c.nombre] = 0; });
        gastosMes(ym).forEach((g) => { r[g.categoria] = (r[g.categoria] || 0) + g.valor; });
        return r;
    }

    function resumenMes(ym) {
        const gastado = suma(gastosMes(ym));
        const limite = D.presupuestoTotal || 0;
        const esActual = ym === mesActual();
        const dm = diasDelMes(ym);
        const diaHoy = new Date().getDate();
        const transcurridos = esActual ? diaHoy : dm;
        const pct = limite > 0 ? Math.round(gastado / limite * 100) : 0;
        let nivel = 'ok';
        if (limite <= 0) nivel = 'sin';
        else if (gastado > limite) nivel = 'excedido';
        else if (gastado / limite >= UMBRAL_CERCA) nivel = 'alerta';
        return {
            gastado: gastado, limite: limite, disponible: limite - gastado, pct: pct, nivel: nivel,
            promedio: Math.round(gastado / Math.max(transcurridos, 1)),
            restantes: esActual ? dm - diaHoy : 0
        };
    }

    function textoVencimiento(dias) {
        if (dias < 0) return 'Vencido hace ' + plural(-dias, 'dia', 'dias');
        if (dias === 0) return 'Vence hoy';
        if (dias === 1) return 'Vence manana';
        return 'Vence en ' + dias + ' dias';
    }

    function calcularAlertas() {
        const lista = [];
        const h = hoy();
        const ym = mesActual();
        const pc = porCategoria(ym);

        D.pagos.forEach((p) => {
            const dias = diasEntre(h, p.vence);
            if (dias <= DIAS_ALERTA_VENCIMIENTO) lista.push({ tipo: 'vencimiento', nivel: dias < 0 ? 4 : 3, pago: p, dias: dias });
        });
        CATS.forEach((c) => {
            const lim = D.presupuestos[c.nombre] || 0;
            const g = pc[c.nombre];
            if (lim <= 0) return;
            if (g > lim) lista.push({ tipo: 'excedido', nivel: 3, cat: c, limite: lim, gastado: g });
            else if (g < lim && g / lim >= UMBRAL_CERCA) lista.push({ tipo: 'cerca', nivel: 1, cat: c, limite: lim, gastado: g });
        });
        const r = resumenMes(ym);
        if (r.nivel === 'excedido') lista.push({ tipo: 'total-excedido', nivel: 4, limite: r.limite, gastado: r.gastado });
        else if (r.nivel === 'alerta') lista.push({ tipo: 'total-cerca', nivel: 1, limite: r.limite, gastado: r.gastado, pct: r.pct });

        lista.sort((a, b) => b.nivel - a.nivel || (a.dias === undefined ? 99 : a.dias) - (b.dias === undefined ? 99 : b.dias));
        return lista;
    }

    function notificacionesPositivas() {
        const arr = [];
        const pagosArriendo = gastosMes(mesActual()).filter((g) => g.categoria === 'Arriendo');
        if (pagosArriendo.length) {
            arr.push({ titulo: 'Servicio de Arriendo al dia', texto: 'El pago del canon de este mes por ' + pesos(suma(pagosArriendo)) + ' COP ya esta registrado.' });
        }
        return arr;
    }

    // Avisos informativos que no bloquean la accion cuando un gasto empuja el presupuesto por encima del limite
    function avisosPresupuesto(categoria, valor, fecha) {
        const ym = mesDe(fecha);
        const avisos = [];
        const lim = D.presupuestos[categoria] || 0;
        const nuevoCat = (porCategoria(ym)[categoria] || 0) + valor;
        if (lim > 0 && nuevoCat > lim) {
            avisos.push('El rubro "' + categoria + '" quedaria en ' + pesos(nuevoCat) + ' de ' + pesos(lim) + ' (se pasa por ' + pesos(nuevoCat - lim) + ').');
        }
        const total = D.presupuestoTotal || 0;
        const nuevoTotal = suma(gastosMes(ym)) + valor;
        if (total > 0 && nuevoTotal > total) {
            avisos.push('El gasto total del mes quedaria en ' + pesos(nuevoTotal) + ' de ' + pesos(total) + ' (se pasa por ' + pesos(nuevoTotal - total) + ').');
        }
        return avisos;
    }

    // Sugerencia para equilibrar presupuestos: mover recursos desde un rubro con holgura hacia el que se excedio
    function sugerenciaEquilibrio() {
        const pc = porCategoria(mesActual());
        const excedidos = CATS
            .filter((c) => (D.presupuestos[c.nombre] || 0) > 0 && pc[c.nombre] > D.presupuestos[c.nombre])
            .map((c) => ({ cat: c, exceso: pc[c.nombre] - D.presupuestos[c.nombre] }))
            .sort((a, b) => b.exceso - a.exceso);
        if (!excedidos.length) return null;
        const ex = excedidos[0];
        const donante = CATS
            .filter((c) => c.nombre !== ex.cat.nombre && (D.presupuestos[c.nombre] || 0) > 0)
            .map((c) => ({ cat: c, holgura: D.presupuestos[c.nombre] - pc[c.nombre] }))
            .filter((d) => d.holgura >= ex.exceso)
            .sort((a, b) => b.holgura - a.holgura)[0] || null;
        return { exceso: ex, donante: donante };
    }

    /* 5. OPERACIONES */
    function validarGastoBasico(d) {
        const nombre = (d.nombre || '').trim().replace(/\s+/g, ' ');
        if (nombre.length < 3 || nombre.length > 80) return 'El nombre del gasto debe tener entre 3 y 80 caracteres.';
        if (!Number.isInteger(d.valor) || d.valor < VALOR_MIN || d.valor > VALOR_MAX || d.valor % 100 !== 0) {
            return 'El valor debe ser un numero entero entre ' + pesos(VALOR_MIN) + ' y ' + pesos(VALOR_MAX) + ', en multiplos de $100.';
        }
        if (!CATS.some((c) => c.nombre === d.categoria)) return 'Selecciona una categoria.';
        return '';
    }

    function validarMedioParaPagar(medio, valor) {
        if (!medio) return 'Selecciona un medio de pago registrado.';
        if (medio.tipo === 'credito' && valor > medio.cupo) return 'El cupo disponible de "' + medio.nombre + '" (' + pesos(medio.cupo) + ') no alcanza para ' + pesos(valor) + '.';
        if (medio.tipo === 'efectivo' && valor > medio.saldo) return 'El saldo de "' + medio.nombre + '" (' + pesos(medio.saldo) + ') no alcanza para ' + pesos(valor) + '.';
        return '';
    }

    function aplicarGasto(d) {
        const medio = medioPor(d.medioId);
        if (medio) {
            if (medio.tipo === 'credito') medio.cupo -= d.valor;
            if (medio.tipo === 'efectivo') { medio.saldo -= d.valor; medio.ultimoMov = hoy(); }
        }
        const gasto = {
            id: uid(), nombre: d.nombre.trim().replace(/\s+/g, ' '), categoria: d.categoria, valor: d.valor,
            fecha: d.fecha, vencimiento: d.vencimiento || '', medioId: d.medioId, creado: Date.now()
        };
        D.gastos.push(gasto);
        guardarDatos();
        let nota = '';
        if (medio && medio.tipo === 'credito') nota = ' Cupo disponible de ' + medio.nombre + ': ' + pesos(medio.cupo) + '.';
        if (medio && medio.tipo === 'efectivo') nota = ' Saldo de ' + medio.nombre + ': ' + pesos(medio.saldo) + '.';
        return { ok: true, gasto: gasto, nota: nota, mensaje: 'Gasto registrado: ' + gasto.nombre + ' por ' + pesos(gasto.valor) + '.' + nota };
    }

    function registrarGasto(d) {
        let error = validarGastoBasico(d);
        if (error) return { ok: false, error: error };
        if (!esFechaValida(d.fecha)) return { ok: false, error: 'Selecciona la fecha de pago.' };
        if (d.fecha > hoy()) return { ok: false, error: 'La fecha de pago no puede ser futura. Si es un pago que aun no haces, marca "programarlo como pago pendiente".' };
        if (d.vencimiento && !esFechaValida(d.vencimiento)) return { ok: false, error: 'La fecha de vencimiento no es valida.' };
        const medio = medioPor(d.medioId);
        error = validarMedioParaPagar(medio, d.valor);
        if (error) return { ok: false, error: error };
        return aplicarGasto(d);
    }

    function programarPago(d) {
        const error = validarGastoBasico(d);
        if (error) return { ok: false, error: error };
        if (!esFechaValida(d.vencimiento)) return { ok: false, error: 'Indica la fecha de vencimiento del pago.' };
        D.pagos.push({ id: uid(), nombre: d.nombre.trim().replace(/\s+/g, ' '), categoria: d.categoria, valor: d.valor, vence: d.vencimiento, icono: catPor(d.categoria).icono });
        guardarDatos();
        return { ok: true, mensaje: 'Pago programado para el ' + fmtFecha(d.vencimiento) + '. Lo veras en Proximos Pagos.' };
    }

    function pagarPendiente(pagoId, medioId) {
        const p = D.pagos.find((x) => x.id === pagoId);
        if (!p) return { ok: false, error: 'Ese pago ya no existe.' };
        const error = validarMedioParaPagar(medioPor(medioId), p.valor);
        if (error) return { ok: false, error: error };
        const r = aplicarGasto({ nombre: p.nombre, categoria: p.categoria, valor: p.valor, fecha: hoy(), vencimiento: p.vence, medioId: medioId });
        D.pagos = D.pagos.filter((x) => x.id !== pagoId);
        guardarDatos();
        r.mensaje = 'Pago realizado: ' + p.nombre + ' por ' + pesos(p.valor) + '.' + r.nota;
        return r;
    }

    function eliminarGasto(id) {
        const g = D.gastos.find((x) => x.id === id);
        if (!g) return;
        const medio = medioPor(g.medioId);
        if (medio) {                       // devolver el dinero al medio de pago
            if (medio.tipo === 'credito') medio.cupo += g.valor;
            if (medio.tipo === 'efectivo') medio.saldo += g.valor;
        }
        D.gastos = D.gastos.filter((x) => x.id !== id);
        guardarDatos();
    }

    function agregarMedio(f) {
        const nombre = f.nombre.trim().replace(/\s+/g, ' ');
        if (!TIPOS_MEDIO[f.tipo]) return { ok: false, error: 'Selecciona el tipo de medio.' };
        if (nombre.length < 3 || nombre.length > 40) return { ok: false, error: 'El nombre debe tener entre 3 y 40 caracteres.' };
        if (D.medios.some((m) => norm(m.nombre) === norm(nombre))) return { ok: false, error: 'Ya tienes un medio de pago con ese nombre.' };
        if (f.tipo !== 'efectivo') {
            if (!/^\d{4}$/.test(f.digitos)) return { ok: false, error: 'Ingresa exactamente 4 digitos numericos.' };
            if (D.medios.some((m) => m.tipo === f.tipo && m.digitos === f.digitos)) return { ok: false, error: 'Ya registraste un medio de ese tipo terminado en ' + f.digitos + '.' };
        }
        const monto = f.monto === '' || f.monto === undefined ? 0 : Number(f.monto);
        if ((f.tipo === 'credito' || f.tipo === 'efectivo') && (!Number.isFinite(monto) || monto < 0 || monto > 500000000)) {
            return { ok: false, error: 'El monto inicial debe estar entre $0 y $500.000.000.' };
        }
        const m = { id: uid(), tipo: f.tipo, nombre: nombre, detalle: nombre.toUpperCase(), digitos: f.tipo === 'efectivo' ? '' : f.digitos, titular: D.hogar, principal: D.medios.length === 0 };
        if (f.tipo === 'credito') m.cupo = Math.round(monto);
        if (f.tipo === 'efectivo') { m.saldo = Math.round(monto); m.ultimoMov = hoy(); }
        D.medios.push(m);
        guardarDatos();
        return { ok: true, mensaje: 'Medio de pago "' + nombre + '" agregado.' };
    }

    function guardarPresupuestos(total, limites) {
        if (!Number.isInteger(total) || total < 0 || total > 5000000000) return { ok: false, error: 'El presupuesto total debe ser un numero entero entre $0 y $5.000.000.000.' };
        let sumaLim = 0;
        for (const c of CATS) {
            const v = limites[c.nombre];
            if (!Number.isInteger(v) || v < 0) return { ok: false, error: 'El limite de "' + c.titulo + '" debe ser un numero entero mayor o igual a 0.' };
            sumaLim += v;
        }
        if (sumaLim > total) return { ok: false, error: 'La suma de los rubros (' + pesos(sumaLim) + ') supera el presupuesto total (' + pesos(total) + ').' };
        D.presupuestoTotal = total;
        CATS.forEach((c) => { D.presupuestos[c.nombre] = limites[c.nombre]; });
        guardarDatos();
        return { ok: true, mensaje: 'Presupuesto actualizado.' };
    }

    /* 6. INTERFAZ COMUN */
    function toast(msg, tipo) {
        let c = $('.toast-contenedor');
        if (!c) { c = document.createElement('div'); c.className = 'toast-contenedor'; document.body.appendChild(c); }
        const t = document.createElement('div');
        t.className = 'toast toast-' + (tipo || 'ok');
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => t.remove(), 5000);
    }
    function toastDiferido(msg, tipo) {
        try { sessionStorage.setItem(K_TOAST, JSON.stringify({ msg: msg, tipo: tipo })); } catch (e) { /* nada */ }
    }
    function mostrarToastPendiente() {
        try {
            const raw = sessionStorage.getItem(K_TOAST);
            if (!raw) return;
            sessionStorage.removeItem(K_TOAST);
            const t = JSON.parse(raw);
            toast(t.msg, t.tipo);
        } catch (e) { /* nada */ }
    }

    function mostrarError(form, msg) {
        let e = form.querySelector('.mensaje-error');
        if (!e) {
            e = document.createElement('div');
            e.className = 'mensaje-error';
            e.setAttribute('role', 'alert');
            form.insertBefore(e, form.firstChild);
        }
        e.textContent = msg;
        e.hidden = false;
        if (e.scrollIntoView) e.scrollIntoView({ block: 'nearest' });
    }
    function limpiarError(form) {
        const e = form.querySelector('.mensaje-error');
        if (e) e.hidden = true;
    }

    let modalActivo = null;
    function abrirModal(titulo, cuerpo, ancho) {
        cerrarModal();
        const fondo = document.createElement('div');
        fondo.className = 'fondo-modal abierto';
        fondo.innerHTML =
            '<div class="caja-modal" role="dialog" aria-modal="true" style="' + (ancho ? 'max-width:' + ancho + 'px;' : '') + 'max-height:92vh; overflow-y:auto;">' +
            '<div class="cabecera-modal"><h4 style="font-weight:800; font-size:18px;">' + esc(titulo) + '</h4>' +
            '<a href="#" class="boton-cerrar-modal" data-cerrar aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></a></div>' +
            '<div class="cuerpo-modal">' + cuerpo + '</div>' +
            '</div>';
        fondo.addEventListener('click', (e) => {
            if (e.target === fondo || e.target.closest('[data-cerrar]')) { e.preventDefault(); cerrarModal(); }
        });
        document.body.appendChild(fondo);
        modalActivo = fondo;
        return fondo;
    }
    function cerrarModal() {
        if (modalActivo) { modalActivo.remove(); modalActivo = null; }
    }
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        cerrarModal();
        if (location.hash === '#modal-medio-pago') location.hash = '';
    });

    function actualizarBadges() {
        const n = calcularAlertas().length;
        $$('.globo-aviso').forEach((el) => { el.textContent = n; el.style.display = n ? '' : 'none'; });
        $$('.punto-aviso').forEach((el) => { el.style.display = n ? '' : 'none'; });
        const enlace = $('#dash-alertas-link');
        if (enlace) enlace.textContent = 'Ver todas las alertas (' + n + ')';
    }

    function iniciales(nombre) {
        const p = nombre.trim().split(/\s+/);
        return ((p[0] || '')[0] + ((p[1] || '')[0] || '')).toUpperCase();
    }

    function pintarMarco(pagina) {
        const hogar = $('.logo-app span');
        if (hogar) hogar.textContent = 'Hogar: ' + D.hogar;
        const av = $('.tarjeta-usuario .avatar');
        if (av) av.textContent = iniciales(U.nombre);
        const nombre = $('.tarjeta-usuario p');
        if (nombre) nombre.textContent = U.nombre;
        const salir = $('.tarjeta-usuario a[href="index.html"]');
        if (salir) salir.addEventListener('click', cerrarSesion);

        // buscador de la barra superior: manda a Gastos con el texto buscado
        const bus = $('.buscador input');
        if (bus && pagina !== 'gastos') {
            bus.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const q = bus.value.trim();
                location.href = 'gastos.html' + (q ? '?q=' + encodeURIComponent(q) : '');
            });
        }
    }

    function etiquetaMedio(m) {
        if (!m) return 'Medio eliminado';
        switch (m.tipo) {
            case 'debito': return 'Tarjeta debito ••' + m.digitos;
            case 'credito': return 'Tarjeta credito ••' + m.digitos;
            case 'transferencia': return 'Transferencia ' + m.nombre;
            default: return 'Efectivo ' + m.nombre;
        }
    }
    function etiquetaOpcionMedio(m) {
        switch (m.tipo) {
            case 'debito': return 'Tarjeta debito ' + m.nombre + ' (••' + m.digitos + ')';
            case 'credito': return 'Tarjeta de credito ' + m.nombre + ' (••' + m.digitos + ') - cupo ' + pesos(m.cupo);
            case 'transferencia': return 'Transferencia bancaria / ' + m.nombre;
            default: return 'Efectivo en ' + m.nombre + ' - saldo ' + pesos(m.saldo);
        }
    }
    const opcionesMedios = () => D.medios.map((m) => '<option value="' + m.id + '">' + esc(etiquetaOpcionMedio(m)) + '</option>').join('');

    /* ---- Modal: pagar un pago pendiente ---- */
    function abrirModalPago(pagoId) {
        const p = D.pagos.find((x) => x.id === pagoId);
        if (!p) return;
        const cuerpo =
            '<p class="texto-pequeno">' + esc(p.nombre) + ' · ' + esc(p.categoria) + '</p>' +
            '<p class="texto-pequeno mb-16">' + textoVencimiento(diasEntre(hoy(), p.vence)) + ' (' + fmtFecha(p.vence) + ')</p>' +
            '<h3 style="font-size:28px; font-weight:800; margin-bottom:16px;">' + pesos(p.valor) + ' <span class="texto-pequeno">COP</span></h3>' +
            (D.medios.length
                ? '<form class="formulario" id="form-pago">' +
                '<div class="campo"><label for="pago-medio">Medio de pago</label>' +
                '<select id="pago-medio" required><option value="" selected disabled>Selecciona medio de pago...</option>' + opcionesMedios() + '</select></div>' +
                '<div class="formulario-acciones">' +
                '<a href="#" class="boton boton-secundario" data-cerrar>Cancelar</a>' +
                '<button type="submit" class="boton boton-primario"><i class="fa-solid fa-check"></i><span>Confirmar pago</span></button>' +
                '</div>' +
                '<p style="text-align:center; margin-top:14px;"><a href="#" id="pago-eliminar" class="texto-pequeno" style="color:var(--rosa-600); font-weight:700;">Eliminar este pago programado</a></p>' +
                '</form>'
                : '<p class="texto-pequeno">Primero agrega un medio de pago en <a href="medios.html" style="color:var(--azul-600); font-weight:700;">Medios de Pago</a>.</p>');
        const modal = abrirModal('Pagar ahora', cuerpo);
        const form = $('#form-pago', modal);
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            limpiarError(form);
            const medioId = $('#pago-medio').value;
            const medio = medioPor(medioId);
            const err = validarMedioParaPagar(medio, p.valor);
            if (err) return mostrarError(form, err);
            const avisos = avisosPresupuesto(p.categoria, p.valor, hoy());
            if (avisos.length && !window.confirm(avisos.join('\n') + '\n\n¿Pagar de todas formas?')) return;
            const r = pagarPendiente(pagoId, medioId);
            if (!r.ok) return mostrarError(form, r.error);
            cerrarModal();
            toast(r.mensaje);
            repintar();
            actualizarBadges();
        });
        $('#pago-eliminar', modal).addEventListener('click', (e) => {
            e.preventDefault();
            if (!window.confirm('¿Eliminar el pago programado "' + p.nombre + '"?')) return;
            D.pagos = D.pagos.filter((x) => x.id !== pagoId);
            guardarDatos();
            cerrarModal();
            toast('Pago programado eliminado.');
            repintar();
            actualizarBadges();
        });
    }

    /* ---- Modal: ajustar presupuesto ---- */
    function abrirModalPresupuesto() {
        const filas = CATS.map((c, i) =>
            '<div class="campo"><label for="pr-' + i + '">' + esc(c.titulo) + '</label>' +
            '<input type="number" id="pr-' + i + '" data-cat="' + esc(c.nombre) + '" min="0" step="1000" inputmode="numeric" value="' + (D.presupuestos[c.nombre] || 0) + '"></div>'
        ).join('');
        const cuerpo =
            '<form class="formulario" id="form-presupuesto">' +
            '<div class="campo"><label for="pr-total">Presupuesto total del mes (COP)</label>' +
            '<input type="number" id="pr-total" min="0" step="1000" inputmode="numeric" value="' + (D.presupuestoTotal || 0) + '"></div>' +
            '<p class="texto-pequeno mb-16" id="pr-resumen"></p>' +
            '<h5 style="font-size:13px; font-weight:800; margin-bottom:12px;">Limite por rubro</h5>' + filas +
            '<div class="formulario-acciones">' +
            '<a href="#" class="boton boton-secundario" data-cerrar>Cancelar</a>' +
            '<button type="submit" class="boton boton-primario"><i class="fa-solid fa-check"></i><span>Guardar presupuesto</span></button>' +
            '</div>' +
            '</form>';
        const modal = abrirModal('Ajustar presupuesto', cuerpo, 480);
        const form = $('#form-presupuesto', modal);
        const leerLimites = () => {
            const limites = {};
            $$('[data-cat]', form).forEach((inp) => { limites[inp.dataset.cat] = inp.value === '' ? 0 : Number(inp.value); });
            return limites;
        };
        const resumen = () => {
            const total = $('#pr-total').value === '' ? 0 : Number($('#pr-total').value);
            const s = Object.values(leerLimites()).reduce((a, b) => a + b, 0);
            const el = $('#pr-resumen');
            el.innerHTML = 'Asignado a rubros: <strong>' + pesos(s) + '</strong> · ' + (s > total
                ? '<strong class="texto-rosa">te pasas por ' + pesos(s - total) + '</strong>'
                : 'sin asignar: <strong>' + pesos(total - s) + '</strong>');
        };
        form.addEventListener('input', resumen);
        resumen();
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            limpiarError(form);
            const total = $('#pr-total').value === '' ? 0 : Number($('#pr-total').value);
            const r = guardarPresupuestos(total, leerLimites());
            if (!r.ok) return mostrarError(form, r.error);
            cerrarModal();
            toast(r.mensaje);
            repintar();
            actualizarBadges();
        });
    }

    /* ---- Acciones globales con delegacion de eventos ---- */
    document.addEventListener('click', (e) => {
        const pagar = e.target.closest('[data-pagar]');
        if (pagar) { e.preventDefault(); abrirModalPago(pagar.dataset.pagar); return; }
        const ajustar = e.target.closest('[data-ajustar]');
        if (ajustar) { e.preventDefault(); abrirModalPresupuesto(); }
    });

    /* 7. PAGINAS */

    /* ---------- Login ---------- */
    async function initLogin() {
        await asegurarDemo();
        const form = $('#form-login');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            limpiarError(form);
            const r = await iniciarSesion($('#correo').value, $('#clave').value);
            if (!r.ok) return mostrarError(form, r.error);
            location.href = 'dashboard.html';
        });
        const demo = $('a.boton-secundario[href="dashboard.html"]');
        if (demo) demo.addEventListener('click', (e) => {
            e.preventDefault();
            guardar(K_SESION, CORREO_DEMO);
            location.href = 'dashboard.html';
        });
        const reset = $('#reset-demo');
        if (reset) reset.addEventListener('click', (e) => {
            e.preventDefault();
            borrar(K_DATOS + CORREO_DEMO);
            toast('Datos de demostracion restablecidos.');
        });
    }

    /* ---------- Registro ---------- */
    function initRegistro() {
        const form = $('#form-registro');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            limpiarError(form);
            if (!$('#terminos').checked) return mostrarError(form, 'Debes aceptar los terminos para continuar.');
            const r = await crearCuenta({ nombre: $('#nombre').value, correo: $('#correo2').value, clave: $('#clave1').value, clave2: $('#clave2').value });
            if (!r.ok) return mostrarError(form, r.error);
            toastDiferido('¡Cuenta creada! Empieza definiendo tu presupuesto y tus medios de pago.');
            location.href = 'dashboard.html';
        });
    }

    /* ---------- Dashboard ---------- */
    function htmlFilaPago(p) {
        const dias = diasEntre(hoy(), p.vence);
        const cat = catPor(p.categoria);
        const vencido = dias < 0;
        const urgente = dias <= DIAS_ALERTA_VENCIMIENTO;
        const fondo = vencido ? 'var(--rosa-500)' : urgente ? 'var(--ambar-500)' : 'var(--' + cat.color + '-500)';
        const estiloTexto = vencido ? 'font-size:12px; color:var(--rosa-600); font-weight:700;' : urgente ? 'font-size:12px; color:var(--ambar-700); font-weight:600;' : '';
        return '<div class="fila-pago ' + (urgente ? 'fila-pago-urgente' : 'fila-pago-normal') + '">' +
            '<div style="display:flex; align-items:center; gap:12px;">' +
            '<div class="icono-pago" style="background-color:' + fondo + ';"><i class="fa-solid ' + (p.icono || cat.icono) + '"></i></div>' +
            '<div><h5 style="font-size:14px; font-weight:700;">' + esc(p.nombre) + '</h5>' +
            '<p class="' + (estiloTexto ? '' : 'texto-pequeno') + '" style="' + estiloTexto + '"><i class="fa-regular fa-clock"></i> ' + textoVencimiento(dias) + ' (' + fmtFecha(p.vence) + ')</p></div>' +
            '</div>' +
            '<div style="text-align:right;"><p style="font-weight:800;">' + pesos(p.valor) + '</p>' +
            '<a href="#" class="boton boton-secundario boton-pequeno" data-pagar="' + p.id + '">Pagar ahora</a></div>' +
            '</div>';
    }

    function htmlFilaGastoCorta(g) {
        return '<tr><td>' + esc(g.nombre) + '</td><td>' + esc(g.categoria) + '</td><td>' + fmtFecha(g.fecha) + '</td><td>' + esc(etiquetaMedio(medioPor(g.medioId))) + '</td><td style="text-align:right;">' + pesos(g.valor) + '</td></tr>';
    }

    function ordenarGastos(arr) {
        return arr.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.creado - a.creado));
    }

    function renderDashboard() {
        const ym = mesActual();
        const r = resumenMes(ym);
        const pc = porCategoria(ym);

        $('#dash-disponible').innerHTML = '<span' + (r.disponible < 0 ? ' class="texto-rosa"' : '') + '>' + pesos(r.disponible) + '</span> <span class="texto-pequeno">COP</span>';
        $('#dash-disponible-sub').textContent = r.nivel === 'sin' ? 'Aun no defines un presupuesto mensual' : r.disponible < 0 ? 'Te pasaste del presupuesto del mes' : 'Saldo libre para lo que resta de mes';
        $('#dash-limite').textContent = pesos(r.limite) + ' COP';
        $('#dash-gastado').innerHTML = pesos(r.gastado) + ' <span class="texto-pequeno">COP</span>';
        $('#dash-promedio').textContent = pesos(r.promedio) + ' COP / dia';
        $('#dash-pct').textContent = r.nivel === 'sin' ? 'Sin presupuesto' : r.pct + '% ejecutado';
        const barra = $('#dash-barra');
        barra.style.width = Math.min(r.pct, 100) + '%';
        barra.className = 'progreso-relleno ' + (r.nivel === 'excedido' ? 'progreso-rosa' : 'progreso-ambar');
        $('#dash-estado').innerHTML = {
            ok: '<span class="texto-verde texto-negrita"><i class="fa-solid fa-circle-check"></i> En rango seguro</span>',
            alerta: '<span class="texto-negrita" style="color:var(--ambar-600);"><i class="fa-solid fa-triangle-exclamation"></i> Cerca del limite</span>',
            excedido: '<span class="texto-rosa texto-negrita"><i class="fa-solid fa-triangle-exclamation"></i> Presupuesto excedido</span>',
            sin: '<span class="texto-pequeno">Define tu presupuesto</span>'
        }[r.nivel];

        // proximos pagos (los 3 mas cercanos)
        const pagos = D.pagos.slice().sort((a, b) => (a.vence < b.vence ? -1 : 1)).slice(0, 3);
        $('#dash-pagos').innerHTML = pagos.length
            ? pagos.map(htmlFilaPago).join('')
            : '<p class="vacio">No tienes pagos pendientes. Puedes programar uno desde <a href="registrar.html" style="color:var(--azul-600); font-weight:700;">Registrar Gasto</a>.</p>';

        // distribucion por categoria
        const visibles = CATS.filter((c) => (D.presupuestos[c.nombre] || 0) > 0 || pc[c.nombre] > 0);
        $('#dash-cats').innerHTML = visibles.length ? visibles.map((c) => {
            const lim = D.presupuestos[c.nombre] || 0;
            const g = pc[c.nombre];
            const exc = lim > 0 && g > lim;
            const pct = lim > 0 ? Math.round(g / lim * 100) : 0;
            return '<div class="mb-16">' +
                '<div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:4px;">' +
                '<span class="' + (exc ? 'texto-rosa' : '') + '"><i class="fa-solid ' + (exc ? 'fa-triangle-exclamation' : c.icono) + '"' + (exc ? '' : ' style="color:var(--' + c.color + '-500);"') + '></i> ' + esc(c.nombre === 'Servicios publicos' ? 'Servicios Publicos' : c.corto) + '</span>' +
                '<span class="' + (exc ? 'texto-rosa' : '') + '">' + pesos(g) + ' <span class="texto-pequeno">/ ' + (lim > 0 ? pesos(lim) + ' (' + pct + '%)' : 'sin presupuesto') + '</span></span>' +
                '</div>' +
                '<div class="progreso-fondo"><div class="progreso-relleno progreso-' + (exc ? 'rosa' : c.color) + '" style="width:' + (lim > 0 ? Math.min(pct, 100) : 0) + '%;"></div></div>' +
                '</div>';
        }).join('') : '<p class="vacio">Aun no hay gastos ni presupuestos este mes.</p>';
        const configuradas = CATS.filter((c) => (D.presupuestos[c.nombre] || 0) > 0).length;
        $('#dash-cats-pie').textContent = plural(configuradas, 'categoria configurada', 'categorias configuradas') + ' en este ciclo';

        // ultimos movimientos
        const delMes = gastosMes(ym);
        const recientes = ordenarGastos(D.gastos).slice(0, 5);
        $('#dash-movs').innerHTML = recientes.length
            ? recientes.map(htmlFilaGastoCorta).join('')
            : '<tr><td colspan="5" class="vacio">Aun no has registrado gastos.</td></tr>';
        $('#dash-movs-link').textContent = 'Ver todos los gastos (' + delMes.length + ')';
    }

    /* ---------- Gastos ---------- */
    function initGastos() {
        const params = new URLSearchParams(location.search);
        const f = { q: params.get('q') || '', categoria: params.get('categoria') || '', medio: '', periodo: params.get('periodo') || '', visibles: 10 };
        const inpNombre = $('#f-nombre');
        const inpBuscador = $('.buscador input');
        const selCat = $('#f-categoria');
        const selMedio = $('#f-medio');
        const selPeriodo = $('#f-periodo');

        selCat.innerHTML = '<option value="">Todas las categorias</option>' + CATS.map((c) => '<option value="' + esc(c.nombre) + '">' + esc(c.nombre) + '</option>').join('');
        selMedio.innerHTML = '<option value="">Todos los medios</option>' + Object.keys(TIPOS_MEDIO).map((k) => '<option value="' + k + '">' + TIPOS_MEDIO[k].filtro + '</option>').join('');

        function llenarPeriodos() {
            const set = new Set(D.gastos.map((g) => mesDe(g.fecha)));
            set.add(mesActual());
            const meses = Array.from(set).sort().reverse();
            selPeriodo.innerHTML = '<option value="">Todos los meses</option>' + meses.map((m) => '<option value="' + m + '">' + nombreMes(m) + (m === mesActual() ? ' (Actual)' : '') + '</option>').join('');
            if (!meses.includes(f.periodo)) f.periodo = '';
        }
        function sincronizarControles() {
            inpNombre.value = f.q;
            if (inpBuscador) inpBuscador.value = f.q;
            selCat.value = f.categoria;
            selMedio.value = f.medio;
            selPeriodo.value = f.periodo;
            if (selCat.value !== f.categoria) f.categoria = '';
        }

        function filtrar() {
            const q = norm(f.q.trim());
            return ordenarGastos(D.gastos).filter((g) => {
                if (q && !norm(g.nombre).includes(q) && !norm(g.categoria).includes(q)) return false;
                if (f.categoria && g.categoria !== f.categoria) return false;
                if (f.periodo && mesDe(g.fecha) !== f.periodo) return false;
                if (f.medio) { const m = medioPor(g.medioId); if (!m || m.tipo !== f.medio) return false; }
                return true;
            });
        }

        function pintar() {
            const lista = filtrar();
            const visibles = lista.slice(0, f.visibles);
            $('#gastos-ciclo').textContent = plural(gastosMes(mesActual()).length, 'movimiento registrado', 'movimientos registrados') + ' este ciclo';
            $('#gastos-mostrando').textContent = 'Mostrando ' + visibles.length + ' de ' + lista.length + ' registros';
            let filas;
            if (!D.gastos.length) {
                filas = '<tr><td colspan="6" class="vacio">Aun no has registrado gastos. <a href="registrar.html" style="color:var(--azul-600); font-weight:700;">Registra el primero</a>.</td></tr>';
            } else if (!lista.length) {
                filas = '<tr><td colspan="6" class="vacio">Ningun gasto coincide con los filtros.</td></tr>';
            } else {
                filas = visibles.map((g) =>
                    '<tr><td>' + esc(g.nombre) + '</td><td>' + esc(g.categoria) + '</td><td>' + fmtFecha(g.fecha) + '</td>' +
                    '<td>' + esc(etiquetaMedio(medioPor(g.medioId))) + '</td><td style="text-align:right;">' + pesos(g.valor) + '</td>' +
                    '<td style="text-align:center;"><a href="#" data-ver="' + g.id + '" title="Ver detalle" style="color:var(--azul-600); font-size:12px; font-weight:700;"><i class="fa-regular fa-eye"></i> Ver</a></td></tr>'
                ).join('') +
                    '<tr style="background-color:var(--gris-50);"><td colspan="4" style="font-weight:700;">Total de los ' + plural(lista.length, 'registro filtrado', 'registros filtrados') + '</td><td style="text-align:right; font-weight:800;">' + pesos(suma(lista)) + '</td><td></td></tr>';
            }
            $('#tabla-gastos').innerHTML = filas;
            $('#gastos-mas-wrap').innerHTML = lista.length > visibles.length
                ? '<a href="#" id="gastos-mas" class="boton boton-secundario boton-pequeno">Ver mas registros</a>' : '';
        }

        function refrescar() { f.visibles = 10; pintar(); }

        inpNombre.addEventListener('input', () => { f.q = inpNombre.value; if (inpBuscador) inpBuscador.value = f.q; refrescar(); });
        if (inpBuscador) inpBuscador.addEventListener('input', () => { f.q = inpBuscador.value; inpNombre.value = f.q; refrescar(); });
        selCat.addEventListener('change', () => { f.categoria = selCat.value; refrescar(); });
        selMedio.addEventListener('change', () => { f.medio = selMedio.value; refrescar(); });
        selPeriodo.addEventListener('change', () => { f.periodo = selPeriodo.value; refrescar(); });
        $('main form').addEventListener('submit', (e) => e.preventDefault());
        $('#limpiar-filtros').addEventListener('click', (e) => {
            e.preventDefault();
            f.q = ''; f.categoria = ''; f.medio = ''; f.periodo = '';
            sincronizarControles();
            refrescar();
        });
        $('#gastos-mas-wrap').addEventListener('click', (e) => {
            if (!e.target.closest('#gastos-mas')) return;
            e.preventDefault();
            f.visibles += 10;
            pintar();
        });
        $('#tabla-gastos').addEventListener('click', (e) => {
            const a = e.target.closest('[data-ver]');
            if (!a) return;
            e.preventDefault();
            abrirDetalleGasto(a.dataset.ver);
        });

        llenarPeriodos();
        sincronizarControles();
        pintar();
        repintar = () => { llenarPeriodos(); sincronizarControles(); pintar(); };
    }

    function abrirDetalleGasto(id) {
        const g = D.gastos.find((x) => x.id === id);
        if (!g) return;
        const fila = (k, v) => '<div style="display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid var(--gris-100); font-size:14px;"><span class="texto-pequeno" style="font-size:13px;">' + k + '</span><span style="font-weight:700; text-align:right;">' + v + '</span></div>';
        const cuerpo =
            '<h3 style="font-size:26px; font-weight:800; margin-bottom:8px;">' + pesos(g.valor) + ' <span class="texto-pequeno">COP</span></h3>' +
            fila('Concepto', esc(g.nombre)) + fila('Categoria', esc(g.categoria)) + fila('Fecha de pago', fmtFecha(g.fecha)) +
            fila('Medio de pago', esc(etiquetaMedio(medioPor(g.medioId)))) +
            (g.vencimiento ? fila('Fecha de vencimiento', fmtFecha(g.vencimiento)) : '') +
            '<div class="formulario-acciones">' +
            '<a href="#" class="boton boton-secundario" data-cerrar>Cerrar</a>' +
            '<a href="#" class="boton" id="detalle-eliminar" style="background-color:var(--rosa-500); color:#fff;"><i class="fa-solid fa-trash"></i><span>Eliminar gasto</span></a>' +
            '</div>';
        const modal = abrirModal('Detalle del gasto', cuerpo);
        $('#detalle-eliminar', modal).addEventListener('click', (e) => {
            e.preventDefault();
            if (!window.confirm('¿Eliminar "' + g.nombre + '" por ' + pesos(g.valor) + '? Si se pago con tarjeta de credito o efectivo, se devuelve el valor al medio de pago.')) return;
            eliminarGasto(id);
            cerrarModal();
            toast('Gasto eliminado.');
            repintar();
            actualizarBadges();
        });
    }

    /* ---------- Registrar gasto ---------- */
    function initRegistrar() {
        const form = $('#form-gasto');
        const selMedio = $('#g-medio');
        const inpValor = $('#g-valor');
        const inpFecha = $('#g-fecha');
        const chkPend = $('#g-pendiente');
        const campoFecha = inpFecha.closest('.campo');
        const campoMedio = selMedio.closest('.campo');
        const btnTexto = $('button[type="submit"] span', form);

        selMedio.innerHTML = '<option value="" selected disabled>Selecciona medio de pago registrado...</option>' + opcionesMedios();
        if (!D.medios.length) {
            const nota = campoMedio.querySelector('p');
            if (nota) nota.innerHTML = 'Aun no tienes medios de pago. <a href="medios.html#modal-medio-pago" style="color:var(--azul-600); font-weight:700;">Agrega uno aqui</a>.';
        }
        inpFecha.value = hoy();
        inpFecha.max = hoy();

        // Acciones rapidas para sumar valor: +20k, +50k y +100k
        $$('.etiqueta-gris', form).forEach((chip) => {
            const m = /\+(\d+)k/i.exec(chip.textContent);
            if (!m) return;
            const inc = Number(m[1]) * 1000;
            chip.classList.add('chip-click');
            chip.setAttribute('role', 'button');
            chip.setAttribute('tabindex', '0');
            const sumar = () => { inpValor.value = Math.min((Number(inpValor.value) || 0) + inc, VALOR_MAX); };
            chip.addEventListener('click', sumar);
            chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sumar(); } });
        });

        // Modo "pago pendiente": no se registra fecha ni medio real; la fecha de vencimiento si es obligatoria
        chkPend.addEventListener('change', () => {
            const p = chkPend.checked;
            campoFecha.style.display = p ? 'none' : '';
            campoMedio.style.display = p ? 'none' : '';
            inpFecha.required = !p;
            selMedio.required = !p;
            $('#g-vencimiento').required = p;
            $('label[for="g-vencimiento"]', form).textContent = p ? 'Fecha de Vencimiento *' : 'Fecha de Vencimiento (Opcional)';
            btnTexto.textContent = p ? 'Programar Pago' : 'Guardar y Actualizar Saldos';
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            limpiarError(form);
            const datos = {
                nombre: $('#g-nombre').value,
                valor: inpValor.value === '' ? NaN : Number(inpValor.value),
                categoria: $('#g-categoria').value,
                fecha: inpFecha.value,
                vencimiento: $('#g-vencimiento').value,
                medioId: selMedio.value
            };
            if (chkPend.checked) {
                const r = programarPago(datos);
                if (!r.ok) return mostrarError(form, r.error);
                toastDiferido(r.mensaje);
                location.href = 'dashboard.html';
                return;
            }
            // validar antes de preguntar por el presupuesto
            let err = validarGastoBasico(datos);
            if (!err && !esFechaValida(datos.fecha)) err = 'Selecciona la fecha de pago.';
            if (!err) err = validarMedioParaPagar(medioPor(datos.medioId), datos.valor);
            if (err) return mostrarError(form, err);
            const avisos = avisosPresupuesto(datos.categoria, datos.valor, datos.fecha);
            if (avisos.length && !window.confirm(avisos.join('\n') + '\n\n¿Registrar de todas formas?')) return;
            const r = registrarGasto(datos);
            if (!r.ok) return mostrarError(form, r.error);
            toastDiferido(r.mensaje);
            location.href = 'gastos.html';
        });
    }

    /* ---------- Medios de pago ---------- */
    function htmlTarjetaMedio(m) {
        const t = TIPOS_MEDIO[m.tipo];
        const oscuro = m.tipo === 'debito';
        const cTitulo = oscuro ? 'color:#cbd5e1;' : '';
        const cSub = oscuro ? 'color:#94a3b8;' : '';
        let icono = '<i class="fa-solid ' + t.icono + '" style="' + (oscuro ? 'color:#94a3b8;' : '') + '"></i>';
        if (m.tipo === 'credito') {
            const marca = norm(m.nombre);
            icono = marca.includes('visa') ? '<i class="fa-brands fa-cc-visa" style="font-size:22px;"></i>'
                : marca.includes('master') ? '<i class="fa-brands fa-cc-mastercard" style="font-size:22px;"></i>'
                    : '<i class="fa-solid fa-credit-card" style="font-size:22px;"></i>';
        }
        let central, pieLabel, pieValor, etiqueta;
        if (m.tipo === 'efectivo') {
            central = '<p style="font-size:22px; font-weight:800;">' + pesos(m.saldo) + ' <span style="font-size:12px; font-weight:400;">COP</span></p>';
            pieLabel = 'Ultimo movimiento';
            pieValor = m.ultimoMov ? fmtFecha(m.ultimoMov) : '-';
            etiqueta = 'En casa';
        } else {
            central = '<p class="numero">' + (m.tipo === 'transferencia' ? esc(m.numero || '•••• ' + m.digitos) : '•••• •••• •••• ' + m.digitos) + '</p>';
            if (m.tipo === 'credito') { pieLabel = 'Cupo Disponible'; pieValor = pesos(m.cupo) + ' COP'; etiqueta = 'Activa'; }
            else if (m.tipo === 'transferencia') { pieLabel = 'Tipo'; pieValor = 'Pagos Instantaneos'; etiqueta = 'Sincronizado'; }
            else { pieLabel = 'Titular'; pieValor = esc(m.titular || D.hogar); etiqueta = m.principal ? 'Principal' : 'Activa'; }
        }
        const estiloEtiqueta = oscuro ? 'background-color:rgba(14,165,233,0.2); color:#7dd3fc;' : 'background-color:rgba(255,255,255,0.2);';
        return '<article class="tarjeta-banco ' + t.clase + '">' +
            '<div style="display:flex; justify-content:space-between;"><span style="font-size:12px; ' + cTitulo + '">' + t.titulo + '</span>' + icono + '</div>' +
            '<div><p style="font-size:11px; font-family:monospace; ' + cSub + '">' + esc(m.detalle || m.nombre.toUpperCase()) + '</p>' + central + '</div>' +
            '<div class="fila-final"><div><p style="font-size:10px; ' + cSub + '">' + pieLabel + '</p><p style="font-size:12px; font-weight:700;">' + pieValor + '</p></div>' +
            '<span class="etiqueta" style="' + estiloEtiqueta + '">' + etiqueta + '</span></div>' +
            '</article>';
    }

    function initMedios() {
        const grid = $('#medios-grid');
        const form = $('#form-medio');
        const selTipo = $('#m-tipo');
        const inpDigitos = $('#m-digitos');
        const campoDigitos = inpDigitos.closest('.campo');

        selTipo.innerHTML = '<option value="" selected disabled>Selecciona tipo de medio...</option>' +
            '<option value="credito">Tarjeta de credito</option><option value="debito">Tarjeta debito</option>' +
            '<option value="transferencia">Transferencia bancaria / Nequi</option><option value="efectivo">Efectivo</option>';

        // Campo adicional: cupo para credito o saldo inicial para efectivo
        const extra = document.createElement('div');
        extra.className = 'campo';
        extra.style.display = 'none';
        extra.innerHTML = '<label for="m-monto" id="m-monto-lbl"></label><input type="number" id="m-monto" min="0" max="500000000" step="1000" inputmode="numeric" placeholder="Ej. 2500000">';
        form.insertBefore(extra, $('.formulario-acciones', form));

        selTipo.addEventListener('change', () => {
            const t = selTipo.value;
            const efectivo = t === 'efectivo';
            campoDigitos.style.display = efectivo ? 'none' : '';
            inpDigitos.required = !efectivo;
            extra.style.display = t === 'credito' || efectivo ? '' : 'none';
            $('#m-monto-lbl').textContent = efectivo ? 'Saldo inicial en efectivo (COP)' : 'Cupo disponible (COP)';
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            limpiarError(form);
            const r = agregarMedio({ tipo: selTipo.value, nombre: $('#m-nombre').value, digitos: inpDigitos.value.trim(), monto: $('#m-monto').value });
            if (!r.ok) return mostrarError(form, r.error);
            form.reset();
            selTipo.dispatchEvent(new Event('change'));
            location.hash = '';
            toast(r.mensaje);
            repintar();
        });

        repintar = () => {
            grid.innerHTML = D.medios.length
                ? D.medios.map(htmlTarjetaMedio).join('')
                : '<p class="vacio" style="grid-column:1/-1;">Aun no tienes medios de pago. Usa "Agregar Medio de Pago" para registrar el primero.</p>';
        };
        repintar();
    }

    /* ---------- Presupuestos ---------- */
    function htmlTarjetaPresupuesto(c, g) {
        const lim = D.presupuestos[c.nombre] || 0;
        const pct = lim > 0 ? Math.round(g / lim * 100) : 0;
        const exc = lim > 0 && g > lim;
        const cerca = lim > 0 && !exc && g < lim && g / lim >= UMBRAL_CERCA;
        const clasesEtiqueta = { indigo: 'etiqueta-gris', verde: 'etiqueta-verde', azul: 'etiqueta-azul-suave', ambar: 'etiqueta-ambar', morado: '', rosa: 'etiqueta-rosa' };
        const estiloMorado = c.color === 'morado' ? ' style="background-color:var(--morado-100); color:var(--morado-700);"' : '';
        const etiqueta = exc
            ? '<span class="etiqueta etiqueta-rosa"><i class="fa-solid fa-triangle-exclamation"></i> ' + pct + '% Excedido</span>'
            : lim > 0 ? '<span class="etiqueta ' + clasesEtiqueta[c.color] + '"' + estiloMorado + '>' + pct + '% gastado</span>'
                : '<span class="etiqueta etiqueta-gris">Sin presupuesto</span>';
        let pie;
        if (lim <= 0) pie = '<p class="texto-pequeno mt-8">Define un limite para este rubro con "Ajustar Presupuesto Total".</p>';
        else if (exc) pie = '<p style="font-size:12px; color:var(--rosa-600); font-weight:700; margin-top:8px;">¡Atencion! Has sobrepasado este rubro por ' + pesos(g - lim) + ' COP.</p>';
        else if (g === lim) pie = '<p class="texto-pequeno mt-8">Cupo utilizado en su totalidad.</p>';
        else if (cerca) pie = '<p style="font-size:12px; color:var(--ambar-700); font-weight:600; margin-top:8px;">Cerca del limite: quedan ' + pesos(lim - g) + ' COP.</p>';
        else if (pct < 70) pie = '<p class="texto-verde mt-8" style="font-size:12px; font-weight:600;">Quedan ' + pesos(lim - g) + ' COP disponibles.</p>';
        else pie = '<p class="texto-pequeno mt-8">Quedan ' + pesos(lim - g) + ' COP disponibles.</p>';

        return '<article class="tarjeta" style="' + (exc ? 'border:2px solid var(--rosa-200); background-color:#fff1f2;' : 'border-color:var(--gris-200);') + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
            '<span style="font-weight:700;' + (exc ? ' color:var(--rosa-800);' : '') + '"><i class="fa-solid ' + c.icono + '" style="' + (exc ? '' : 'color:var(--' + c.color + '-500);') + ' margin-right:6px;"></i>' + esc(c.titulo) + '</span>' + etiqueta +
            '</div>' +
            '<div class="progreso-fondo mb-8"' + (exc ? ' style="background-color:var(--rosa-200);"' : '') + '><div class="progreso-relleno progreso-' + (exc ? 'rosa' : c.color) + '" style="width:' + Math.min(pct, 100) + '%;"></div></div>' +
            '<div style="display:flex; justify-content:space-between; font-size:12px;"><span>Gastado: <strong>' + pesos(g) + '</strong></span><span>Cupo: <strong>' + pesos(lim) + '</strong></span></div>' +
            pie +
            '</article>';
    }

    function initPresupuestos() {
        repintar = () => {
            const ym = mesActual();
            const r = resumenMes(ym);
            const pc = porCategoria(ym);
            $('#presu-ciclo').textContent = 'Ciclo ' + nombreMes(ym);
            $('#presu-gastado').innerHTML = pesos(r.gastado) + ' <span style="font-size:16px; font-weight:400; color:#e0f2fe;">gastados de</span> ' + pesos(r.limite) + ' COP';
            $('#presu-quedan').innerHTML = r.nivel === 'sin'
                ? 'Aun no defines un presupuesto mensual. Usa <strong>Ajustar Presupuesto Total</strong>.'
                : r.disponible < 0
                    ? 'Te pasaste por <strong>' + pesos(-r.disponible) + ' COP</strong> del presupuesto del mes.'
                    : 'Quedan <strong>' + pesos(r.disponible) + ' COP</strong> disponibles para ' + plural(r.restantes, 'dia restante', 'dias restantes') + '.';
            $('#presu-pct').textContent = r.nivel === 'sin' ? '-' : r.pct + '%';
            $('#presu-estado').textContent = { ok: 'Ritmo equilibrado', alerta: 'Cerca del limite', excedido: 'Presupuesto excedido', sin: 'Sin presupuesto' }[r.nivel];
            $('#presu-grid').innerHTML = CATS.map((c) => htmlTarjetaPresupuesto(c, pc[c.nombre])).join('');
        };
        repintar();
        if (location.hash === '#ajustar') abrirModalPresupuesto();
    }

    /* ---------- Reportes ---------- */
    function initReportes() {
        $('#btn-exportar').addEventListener('click', (e) => { e.preventDefault(); window.print(); });

        repintar = () => {
            const ym = mesActual();
            const meses = [mesAnterior(ym, 3), mesAnterior(ym, 2), mesAnterior(ym, 1), ym];
            const totales = meses.map((m) => suma(gastosMes(m)));
            const max = Math.max.apply(null, totales.concat([1]));
            const conDatos = totales.filter((t) => t > 0);
            const prom = conDatos.length ? Math.round(conDatos.reduce((a, b) => a + b, 0) / conDatos.length) : 0;
            $('#rep-promedio').textContent = 'Promedio: ' + pesos(prom) + ' / mes';
            $('#rep-barras').innerHTML = meses.map((m, i) => {
                const actual = m === ym;
                const alto = Math.max(6, Math.round(totales[i] / max * 110));
                const nombre = MESES[Number(m.slice(5)) - 1];
                const color = actual ? 'var(--azul-500)' : i === 0 ? '#bae6fd' : '#7dd3fc';
                return '<div class="barra-mes">' +
                    '<span style="font-size:12px; font-weight:700;' + (actual ? ' color:var(--azul-600);' : '') + '">' + pesosCorto(totales[i]) + '</span>' +
                    '<div class="relleno" style="height:' + alto + 'px; background-color:' + color + ';"></div>' +
                    '<span class="' + (actual ? '' : 'texto-pequeno') + '" style="' + (actual ? 'font-size:12px; font-weight:700; color:var(--azul-600);' : '') + '">' + nombre + '</span>' +
                    '</div>';
            }).join('');

            // participacion porcentual del mes en curso
            const pc = porCategoria(ym);
            const total = suma(gastosMes(ym));
            const orden = CATS.slice().sort((a, b) => pc[b.nombre] - pc[a.nombre]);
            $('#rep-participacion').innerHTML = orden.map((c) => {
                const exc = (D.presupuestos[c.nombre] || 0) > 0 && pc[c.nombre] > D.presupuestos[c.nombre];
                const pct = total > 0 ? (pc[c.nombre] / total * 100).toFixed(1) : '0.0';
                return '<div style="background-color:var(--gris-50); border:1px solid var(--gris-200); border-radius:16px; padding:12px; text-align:center;">' +
                    '<p class="texto-pequeno">' + esc(c.corto) + '</p>' +
                    '<p style="font-size:18px; font-weight:800; margin-top:4px;' + (exc ? ' color:var(--rosa-600);' : '') + '">' + pct + '%</p></div>';
            }).join('');

            pintarConsejo(total, pc);
        };
        repintar();
    }

    function pintarConsejo(total, pc) {
        const caja = $('#rep-consejo');
        const r = resumenMes(mesActual());
        const sug = sugerenciaEquilibrio();
        let texto;
        let boton = '<a href="presupuestos.html" class="boton boton-primario" style="width:100%; margin-top:16px;">Ver presupuestos</a>';
        if (sug) {
            const ex = sug.exceso;
            const lim = D.presupuestos[ex.cat.nombre];
            texto = 'Notamos que el rubro de <strong>' + esc(ex.cat.corto) + '</strong> supero el limite fijado (' + pesos(lim) + ' vs ' + pesos(pc[ex.cat.nombre]) + ' gastados).';
            if (sug.donante) {
                texto += ' Puedes equilibrarlo reasignando ' + pesos(ex.exceso) + ' COP desde el excedente favorable de <strong>' + esc(sug.donante.cat.corto) + '</strong>.';
                boton = '<a href="#" id="btn-equilibrar" class="boton boton-primario" style="width:100%; margin-top:16px;">Equilibrar presupuestos</a>';
            } else {
                texto += ' Ningun otro rubro tiene holgura suficiente: revisa tus gastos o sube el presupuesto.';
                boton = '<a href="#" class="boton boton-primario" data-ajustar style="width:100%; margin-top:16px;">Ajustar presupuesto</a>';
            }
        } else if (!D.gastos.length) {
            texto = 'Registra tus primeros gastos y aqui veras recomendaciones para equilibrar tu presupuesto.';
        } else if (r.nivel === 'excedido') {
            texto = 'Ya superaste el presupuesto total del mes por ' + pesos(-r.disponible) + '. Revisa los gastos grandes o ajusta la meta.';
        } else if (r.nivel === 'alerta') {
            texto = 'Llevas el ' + r.pct + '% del presupuesto total. Cuida los gastos que faltan para no pasarte este mes.';
        } else {
            const mayor = CATS.slice().sort((a, b) => pc[b.nombre] - pc[a.nombre])[0];
            texto = total > 0
                ? 'Vas bien este mes: ningun rubro supera su limite. El de mayor peso es <strong>' + esc(mayor.corto) + '</strong> con ' + (pc[mayor.nombre] / total * 100).toFixed(1) + '% del gasto.'
                : 'Aun no hay gastos este mes.';
        }
        caja.innerHTML =
            '<div><div class="icono-redondo" style="background-color:var(--azul-500); color:#fff; margin-bottom:12px;"><i class="fa-solid fa-lightbulb"></i></div>' +
            '<h5 style="font-weight:800; margin-bottom:8px;">Consejo de Ahorro Domestico</h5>' +
            '<p style="font-size:13px; color:var(--gris-600); line-height:1.6;">' + texto + '</p></div>' + boton;

        const btn = $('#btn-equilibrar');
        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            const monto = sug.exceso.exceso;
            if (!window.confirm('¿Mover ' + pesos(monto) + ' del presupuesto de "' + sug.donante.cat.nombre + '" a "' + sug.exceso.cat.nombre + '"? El presupuesto total no cambia.')) return;
            D.presupuestos[sug.exceso.cat.nombre] += monto;
            D.presupuestos[sug.donante.cat.nombre] -= monto;
            guardarDatos();
            toast('Presupuestos equilibrados.');
            repintar();
            actualizarBadges();
        });
    }

    /* ---------- Alertas ---------- */
    function htmlAlerta(a) {
        const btnBase = 'boton boton-pequeno';
        if (a.tipo === 'vencimiento') {
            const vencido = a.dias < 0;
            const col = vencido ? 'rosa' : 'ambar';
            const etq = vencido ? 'background-color:var(--rosa-200); color:var(--rosa-800);' : 'background-color:var(--ambar-200); color:var(--ambar-800);';
            const claseFila = vencido ? 'fila-pago' : 'fila-pago fila-pago-urgente';
            const estiloFila = vencido ? 'background-color:var(--rosa-50); border:1px solid var(--rosa-200);' : '';
            return '<article class="' + claseFila + '" style="' + estiloFila + '">' +
                '<div style="display:flex; align-items:flex-start; gap:12px;">' +
                '<div class="icono-pago" style="background-color:var(--' + col + '-500); flex-shrink:0;"><i class="fa-solid fa-clock"></i></div>' +
                '<div><span class="etiqueta" style="' + etq + '">' + (vencido ? 'Pago vencido' : 'Vencimiento cercano') + '</span>' +
                '<h5 style="font-size:15px; font-weight:700; margin-top:6px;">' + esc(a.pago.nombre) + '</h5>' +
                '<p class="texto-pequeno mt-8">Fecha limite: <strong>' + fmtFecha(a.pago.vence) + ' (' + textoVencimiento(a.dias).toLowerCase() + ')</strong>. Monto: <strong>' + pesos(a.pago.valor) + ' COP</strong></p></div>' +
                '</div>' +
                '<div style="display:flex; gap:8px;">' +
                '<a href="#" class="' + btnBase + '" data-pagar="' + a.pago.id + '" style="background-color:var(--' + col + '-500); color:#fff;">Pagar Factura</a>' +
                '<a href="gastos.html?categoria=' + encodeURIComponent(a.pago.categoria) + '" class="' + btnBase + ' boton-secundario">Ver en Gastos</a>' +
                '</div></article>';
        }
        const rosa = a.tipo === 'excedido' || a.tipo === 'total-excedido';
        const col = rosa ? 'rosa' : 'ambar';
        let etiqueta, titulo, detalle, revisar;
        if (a.tipo === 'excedido' || a.tipo === 'cerca') {
            const pct = Math.round(a.gastado / a.limite * 100);
            etiqueta = rosa ? 'Presupuesto superado' : 'Cerca del limite';
            titulo = 'Rubro de ' + a.cat.corto + ' al ' + pct + '%';
            detalle = 'Limite fijado: <strong>' + pesos(a.limite) + ' COP</strong> · Gastado actual: <strong' + (rosa ? ' class="texto-rosa"' : '') + '>' + pesos(a.gastado) + ' COP</strong>' + (rosa ? ' (+ ' + pesos(a.gastado - a.limite) + ')' : ' (quedan ' + pesos(a.limite - a.gastado) + ')');
            revisar = 'gastos.html?categoria=' + encodeURIComponent(a.cat.nombre);
        } else {
            etiqueta = rosa ? 'Presupuesto total superado' : 'Presupuesto total al limite';
            titulo = rosa ? 'Superaste el presupuesto total del mes' : 'Llevas el ' + a.pct + '% del presupuesto total';
            detalle = 'Presupuesto total: <strong>' + pesos(a.limite) + ' COP</strong> · Gastado actual: <strong' + (rosa ? ' class="texto-rosa"' : '') + '>' + pesos(a.gastado) + ' COP</strong>' + (rosa ? ' (+ ' + pesos(a.gastado - a.limite) + ')' : '');
            revisar = 'gastos.html?periodo=' + mesActual();
        }
        return '<article class="fila-pago" style="background-color:var(--' + col + '-50); border:1px solid var(--' + col + '-200);">' +
            '<div style="display:flex; align-items:flex-start; gap:12px;">' +
            '<div class="icono-pago" style="background-color:var(--' + col + '-500); flex-shrink:0;"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
            '<div><span class="etiqueta" style="background-color:var(--' + col + '-200); color:var(--' + col + '-800);">' + etiqueta + '</span>' +
            '<h5 style="font-size:15px; font-weight:700; margin-top:6px;">' + esc(titulo) + '</h5>' +
            '<p class="texto-pequeno mt-8">' + detalle + '</p></div>' +
            '</div>' +
            '<div style="display:flex; gap:8px;">' +
            '<a href="presupuestos.html#ajustar" class="' + btnBase + '" style="background-color:var(--' + col + '-500); color:#fff;">Modificar Limite</a>' +
            '<a href="' + revisar + '" class="' + btnBase + ' boton-secundario">Revisar Gastos</a>' +
            '</div></article>';
    }

    function renderAlertas() {
        const lista = calcularAlertas();
        const positivas = notificacionesPositivas();
        $('#alertas-contador').textContent = lista.length === 1 ? '1 alerta activa' : lista.length + ' alertas activas';
        let html = lista.map(htmlAlerta).join('');
        if (!lista.length) {
            html = '<p class="vacio">No tienes alertas activas. Todo esta en orden.</p>';
        }
        html += positivas.map((p, i) =>
            '<article class="fila-pago" style="background-color:var(--verde-50); border:1px solid var(--verde-200);' + (i === positivas.length - 1 ? ' margin-bottom:0;' : '') + '">' +
            '<div style="display:flex; align-items:center; gap:12px;">' +
            '<div class="icono-pago" style="background-color:var(--verde-500);"><i class="fa-solid fa-shield-check"></i></div>' +
            '<div><h5 style="font-size:14px; font-weight:700; color:var(--verde-900);">' + esc(p.titulo) + '</h5>' +
            '<p style="font-size:12px; color:var(--verde-700);">' + esc(p.texto) + '</p></div>' +
            '</div></article>'
        ).join('');
        $('#alertas-lista').innerHTML = html;
        repintar = renderAlertas;
    }

    /* 7. PAGINAS */
    function init() {
        const pagina = document.body.dataset.pagina;
        if (pagina === 'login') return initLogin();
        if (pagina === 'registro') return initRegistro();

        const correo = leer(K_SESION, null);
        U = correo ? usuarios().find((u) => u.correo === correo) || null : null;
        if (!U) { location.replace('index.html'); return; }
        D = cargarDatos();
        pintarMarco(pagina);

        const paginas = {
            dashboard: () => { renderDashboard(); repintar = renderDashboard; },
            gastos: initGastos,
            registrar: initRegistrar,
            medios: initMedios,
            presupuestos: initPresupuestos,
            reportes: initReportes,
            alertas: renderAlertas
        };
        if (paginas[pagina]) paginas[pagina]();
        actualizarBadges();
        mostrarToastPendiente();
    }

    init();
})();
