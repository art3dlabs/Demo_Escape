# Escape Room Modular - v3.0

¡Bienvenido a Escape Room Modular! Un juego de escape room en 3D construido con Three.js y JavaScript puro, diseñado para ser modular y extensible.

## Descripción

Explora una habitación misteriosa llena de objetos interactivos y puzzles desafiantes. Usa tu ingenio y los objetos que encuentres para resolver los acertijos, desbloquear secretos y, finalmente, encontrar la forma de escapar antes de que se acabe el tiempo.

## Características Principales

*   **Motor 3D:** Utiliza [Three.js](https://threejs.org/) para el renderizado y la interacción en 3D.
*   **Controles en Primera Persona:** Movimiento estándar (WASD), salto (Espacio) y vista controlada por el ratón (Pointer Lock).
*   **Sistema de Interacción:** Raycasting para detectar objetos cercanos, mostrando hints contextuales.
*   **Inventario:** Recoge, selecciona, usa y suelta objetos clave.
*   **Puzzles Modulares:**
    *   Sistema diseñado para añadir nuevos puzzles fácilmente (definidos en `puzzles.js`).
    *   Incluye ejemplos como cerraduras con llave, placas de presión, botones, secuencias, códigos, mensajes ocultos (UV), minijuegos (placeholder), etc.
*   **Selección Dinámica de Puzzles:** El juego selecciona un número y una cadena de puzzles basados en la dificultad elegida, asegurando rejugabilidad.
*   **Niveles de Dificultad:** Fácil (4), Medio (7), Difícil (10), Experto (Todos).
*   **Temporizador:** ¡Escapa antes de que el tiempo se agote!
*   **Sistema de Pistas (Opcional):** Pide una pista con una penalización de tiempo.
*   **Sonido:** Efectos de sonido básicos para interacciones y eventos.
*   **Estructura Modular:** Código organizado en módulos JavaScript (`main.js`, `sceneSetup.js`, `playerControls.js`, `interaction.js`, `puzzles.js`, `inventory.js`, `ui.js`, `timer.js`, `audio.js`).

## Controles

*   **WASD:** Moverse
*   **ESPACIO:** Saltar
*   **RATÓN:** Mirar
*   **E / Clic Izquierdo:** Interactuar / Usar Objeto Seleccionado / Soltar Objeto Sostenido
*   **I / TAB:** Abrir/Cerrar Inventario
*   **Clic Izquierdo (en Inventario):** Seleccionar Objeto
*   **Q / Clic Derecho:** Deseleccionar Objeto Actual
*   **G:** Soltar Objeto Seleccionado del Inventario al Mundo
*   **ESC:** Pausa / Menú / Reanudar / Cerrar Modales

## Cómo Ejecutar

1.  **Servidor Web Local:** Debido al uso de Módulos JavaScript (`import`/`export`), no puedes abrir `index.html` directamente desde el sistema de archivos (`file://`). Necesitas un servidor web local.
    *   Si tienes Node.js instalado, puedes usar `npx serve` o `npx http-server` en la carpeta raíz del proyecto.
    *   Alternativamente, puedes usar extensiones de navegador como "Live Server" para VS Code.
2.  **Accede:** Abre tu navegador y ve a la dirección proporcionada por tu servidor local (ej. `http://localhost:8080` o `http://127.0.0.1:5500`).

## Estructura del Proyecto (Archivos JS Principales)

*   `main.js`: Orquestador principal, bucle del juego, gestión de estado.
*   `sceneSetup.js`: Creación de la escena, cámara, renderer, luces, objetos estáticos de la habitación.
*   `playerControls.js`: Lógica de movimiento del jugador (WASD, salto, gravedad, colisiones básicas), configuración de PointerLockControls.
*   `interaction.js`: Lógica de raycasting, hover, interacción con objetos, recoger/soltar objetos sostenibles.
*   `puzzles.js`: Definiciones de todos los puzzles, lógica de selección por dificultad, manejo de requisitos y recompensas, lógica específica de puzzles (libros, etc.).
*   `inventory.js`: Gestión del inventario del jugador (añadir, quitar, seleccionar, soltar), creación de objetos de recogida en el mundo.
*   `ui.js`: Manejo de todos los elementos de la interfaz (HUD, modales, overlays, tooltips), configuración de listeners de eventos de UI.
*   `timer.js`: Lógica del temporizador de cuenta atrás.
*   `audio.js`: Carga y reproducción de efectos de sonido.
*   `index.html`: Estructura HTML de la página y la UI.
*   `style.css`: Estilos CSS para la interfaz.

## Problemas Conocidos / TODO

*   Implementar lógica real para los minijuegos (actualmente son placeholders).
*   Mejorar la física de colisión (actualmente es básica).
*   Añadir más variedad de puzzles y objetos.
*   Optimizar rendimiento para escenas más complejas.
*   Completar/Verificar todas las rutas de los archivos de sonido.
*   (Añade aquí cualquier otra tarea pendiente)

---
