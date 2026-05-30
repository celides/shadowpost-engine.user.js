// ==UserScript==
// @name         ShadowPost Pro v4 — Stealth Engine
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Motor de inyección sincronizado con ShadowPost Pro v4. Rota variaciones, avanza índice y evade detección.
// @author       ShadowPost Technologies
// @match        https://m.facebook.com/groups/*
// @match        https://www.facebook.com/groups/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ══════════════════════════════════════════════════════
    //  SHADOWPOST PRO v4 — TAMPERMONKEY ENGINE
    //  Sincronizado con el Dashboard (sp_copies, sp_idx, sp_queue)
    // ══════════════════════════════════════════════════════

    // ── UTILIDADES ──────────────────────────────────────
    const esperar = (ms) => new Promise(r => setTimeout(r, ms));

    function rndEntre(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function log(msg) {
        console.log(`%c🥷 ShadowPost %c${msg}`, 'color:#00d4aa;font-weight:bold', 'color:#e6edf3');
    }

    // ── LEER ESTADO DEL DASHBOARD ────────────────────────
    // El dashboard guarda en estas claves (ShadowPost Pro v4):
    //   sp_copies  → JSON array de 3 variaciones de texto
    //   sp_idx     → número: índice actual del grupo
    //   sp_queue   → JSON array de URLs pendientes (cola)
    //   sp_bot_active → 'true' cuando el usuario presionó PLAY

    function leerCopies() {
        try {
            return JSON.parse(localStorage.getItem('sp_copies') || '[]');
        } catch { return []; }
    }

    function leerIndice() {
        return parseInt(localStorage.getItem('sp_idx') || '0');
    }

    function escribirIndice(n) {
        localStorage.setItem('sp_idx', String(n));
    }

    function leerCola() {
        try {
            return JSON.parse(localStorage.getItem('sp_queue') || '[]');
        } catch { return []; }
    }

    function escribirCola(arr) {
        localStorage.setItem('sp_queue', JSON.stringify(arr));
    }

    function botActivo() {
        return localStorage.getItem('sp_bot_active') === 'true';
    }

    // ── SELECCIONAR VARIACIÓN ROTATIVA ───────────────────
    // Rota entre las 3 variaciones según el índice actual
    // para que cada grupo reciba un texto diferente
    function seleccionarVariacion() {
        const copies = leerCopies();
        if (!copies || copies.length === 0) {
            log('❌ No hay variaciones. Genera copies desde el dashboard primero.');
            return null;
        }
        const idx = leerIndice();
        const variacion = copies[idx % copies.length];
        log(`📝 Variación seleccionada: #${(idx % copies.length) + 1} de ${copies.length}`);
        return variacion;
    }

    // ── ESCRITURA HUMANA SIMULADA ────────────────────────
    async function escribirComoHumano(elemento, texto) {
        elemento.focus();
        await esperar(rndEntre(300, 700));

        // React/Facebook usa eventos sintéticos, necesitamos dispatchEvent correcto
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLElement.prototype, 'innerHTML'
        )?.set;

        for (let i = 0; i < texto.length; i++) {
            const char = texto[i];

            // Eventos de teclado realistas
            elemento.dispatchEvent(new KeyboardEvent('keydown',  { key: char, bubbles: true }));
            elemento.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));

            // Para textareas normales
            if (elemento.tagName === 'TEXTAREA') {
                elemento.value += char;
            } else {
                // Para divs contenteditable de Facebook
                elemento.textContent += char;
            }

            // Dispara input/change para que React detecte el cambio
            elemento.dispatchEvent(new Event('input',  { bubbles: true }));
            elemento.dispatchEvent(new Event('change', { bubbles: true }));
            elemento.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

            // Retraso variable por letra (60–220ms) con pausas largas ocasionales
            let delay = rndEntre(60, 220);
            if (Math.random() < 0.08) delay += rndEntre(400, 900); // Pausa "pensante" 8% del tiempo
            await esperar(delay);
        }

        log(`✍️ Texto inyectado: ${texto.length} caracteres.`);
    }

    // ── BUSCAR CUADRO DE TEXTO ───────────────────────────
    async function encontrarAreaTexto(intentos = 15) {
        for (let i = 0; i < intentos; i++) {
            // Selectores en orden de prioridad para Facebook móvil y escritorio
            const selectores = [
                '[role="textbox"]',
                'textarea[name="xc_message"]',
                'textarea',
                '[contenteditable="true"]',
                '[data-lexical-editor="true"]'
            ];

            for (const sel of selectores) {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) { // Verifica que sea visible
                    log(`🎯 Cuadro de texto encontrado con selector: ${sel}`);
                    return el;
                }
            }

            log(`🔍 Intento ${i + 1}/${intentos} buscando cuadro de texto...`);
            await esperar(2000);
        }
        return null;
    }

    // ── BUSCAR BOTÓN PUBLICAR ────────────────────────────
    async function encontrarBotonPublicar(intentos = 10) {
        for (let i = 0; i < intentos; i++) {
            const botones = Array.from(document.querySelectorAll('button, [role="button"]'));
            const boton   = botones.find(btn => {
                const txt = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                return txt === 'publicar' || txt === 'post' || txt === 'compartir' || txt === 'share';
            });

            if (boton && !boton.disabled) {
                log('🚀 Botón "Publicar" localizado.');
                return boton;
            }

            await esperar(1500);
        }
        return null;
    }

    // ── AVANZAR ÍNDICE Y COLA ────────────────────────────
    function avanzarIndice() {
        const actual  = leerIndice();
        const nuevo   = actual + 1;
        escribirIndice(nuevo);

        // Eliminar el primer elemento de la cola
        const cola = leerCola();
        if (cola.length > 0) {
            cola.shift();
            escribirCola(cola);
        }

        log(`✅ Grupo completado. Nuevo índice: ${nuevo}. Cola restante: ${cola.length}`);
    }

    // ── ABRIR CUADRO DE PUBLICACIÓN ──────────────────────
    // En Facebook móvil a veces hay que tocar el área primero para que abra el editor
    async function activarEditorFacebook() {
        // Primero intenta hacer clic en el placeholder "¿Qué estás pensando?"
        const placeholders = Array.from(document.querySelectorAll('*')).filter(el => {
            const txt = (el.textContent || '').trim();
            return (txt.includes('estás pensando') || txt.includes('thinking') || txt.includes('Escribe algo')) 
                   && el.children.length === 0;
        });

        if (placeholders.length > 0) {
            placeholders[0].click();
            log('👆 Clic en placeholder del editor.');
            await esperar(rndEntre(1500, 2500));
        }
    }

    // ── ALGORITMO PRINCIPAL ──────────────────────────────
    async function iniciarProcesoStealth() {
        log('🟢 Motor iniciado. Analizando entorno...');

        // 1. Verificar que el bot está activo desde el dashboard
        if (!botActivo()) {
            log('⏸️ Bot inactivo. Presiona PLAY en el Dashboard ShadowPost.');
            return;
        }

        // 2. Obtener el copy de esta sesión (variación rotativa)
        const copy = seleccionarVariacion();
        if (!copy) return;

        // 3. Espera inicial aleatoria (simula lectura humana del grupo)
        const esperaInicial = rndEntre(4000, 9000);
        log(`⏳ Esperando ${(esperaInicial/1000).toFixed(1)}s antes de interactuar...`);
        await esperar(esperaInicial);

        // 4. Activar editor de Facebook si es necesario
        await activarEditorFacebook();

        // 5. Localizar el área de texto
        const areaTexto = await encontrarAreaTexto();
        if (!areaTexto) {
            log('❌ No se encontró el cuadro de texto. ¿El grupo permite publicaciones?');
            return;
        }

        // 6. Escribir el copy con comportamiento humano
        await escribirComoHumano(areaTexto, copy);

        // 7. Pausa post-escritura (un humano revisa antes de publicar)
        const esperaRevision = rndEntre(3000, 7000);
        log(`👀 Revisando texto ${(esperaRevision/1000).toFixed(1)}s...`);
        await esperar(esperaRevision);

        // 8. Localizar botón de publicar
        const botonPublicar = await encontrarBotonPublicar();
        if (!botonPublicar) {
            log('❌ No se encontró el botón "Publicar". Puede requerir acción manual.');
            return;
        }

        // 9. Clic en publicar
        botonPublicar.click();
        log('📤 Publicación enviada correctamente.');

        // 10. Espera post-publicación antes de avanzar
        await esperar(rndEntre(2000, 4000));

        // 11. Avanzar índice en el dashboard
        avanzarIndice();

        // 12. Navegar al siguiente grupo automáticamente
        const cola = leerCola();
        if (cola.length > 0) {
            const nextUrl = cola[0];
            log(`➡️ Navegando al siguiente grupo en ${3}s...`);
            await esperar(3000);
            window.location.href = nextUrl;
        } else {
            log('🏁 Cola completada. Todos los grupos publicados.');
            localStorage.setItem('sp_bot_active', 'false');
        }
    }

    // ── DISPARADOR ───────────────────────────────────────
    // Usa 'load' y también un observer por si Facebook carga dinámicamente
    window.addEventListener('load', async () => {
        // Esperar a que Facebook cargue completamente su React
        await esperar(2500);
        iniciarProcesoStealth();
    });

})();
