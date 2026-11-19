# Sistema de diseño de Start Tank

Este documento describe los tokens visuales, el kit de componentes compartidos y las reglas de uso. El código del kit reside en `src/shared/ui/`, y los tokens en `src/styles/`.

## Alcance y principios

El kit se ubica en `src/shared/ui/` y no depende de `src/features/` ni de `src/server/`. Cada componente expone textos, nombres accesibles y acciones mediante props o `children`, de modo que el kit no contiene copy fijo. Los estilos se construyen únicamente con tokens CSS (`var(--...)`); no se definen colores literales en los módulos de estilo.

Se aplican los siguientes principios:

- Los componentes se presentan como primitivas sin lógica de negocio.
- La semántica HTML y los atributos ARIA se resuelven dentro del componente.
- El movimiento decorativo se detiene con `prefers-reduced-motion`.
- Los objetivos táctiles miden al menos 44 px en móvil.

## Tokens

Los tokens se definen en `src/styles/` y se importan desde `src/app/globals.css`.

### Color (`colors.css`)

| Token | Uso |
|---|---|
| `--st-ink-900`, `--st-ink-800`, `--st-ink-700` | Fondos oscuros de página, banda y panel. |
| `--st-indigo`, `--st-purple` | Tonos de apoyo del degradado de marca. |
| `--st-pink`, `--st-pink-light`, `--st-pink-hot` | Acento principal, enlaces y estados de hover. |
| `--st-cyan`, `--st-cyan-light` | Color positivo, estado en vivo y anillo de foco. |
| `--st-yellow` | Advertencias y estados de atención. |
| `--st-orchid` | Texto de ODS. |
| `--st-lav-100` a `--st-lav-500` | Escala de texto secundario. |
| `--bg-page`, `--bg-band`, `--bg-card` | Fondos semánticos. |
| `--fg-1` a `--fg-4` | Texto por jerarquía, del más contrastado al menos contrastado. |
| `--accent`, `--accent-2`, `--accent-3` | Acento de acción, secundario y terciario. |
| `--link`, `--link-hover` | Enlaces. |
| `--line-1`, `--line-2`, `--line-strong` | Bordes y separadores, de menor a mayor énfasis. |
| `--positive`, `--negative`, `--warning` | Estados semánticos. |
| `--grad-brand`, `--grad-hero` | Degradados de marca. |

### Forma, espaciado y sombra (`shape.css`)

| Token | Uso |
|---|---|
| `--r-pill` | Radio totalmente redondeado para botones, etiquetas y barras. |
| `--r-card`, `--r-inner` | Radios de tarjetas y paneles internos. |
| `--r-frame`, `--r-panel` | Radios asimétricos en forma de hoja del marco degradado y del panel interior. |
| `--r-leaf` | Radio de hoja de uso general. |
| `--sp-1` a `--sp-8` | Escala de espaciado, de 4 px a 96 px. |
| `--shadow-glow` | Resplandor del acento bajo tarjetas destacadas. |
| `--ease-out` | Curva de transición de entrada. |

Las animaciones `stPulse`, `stRise` y el resto de keyframes globales se definen en `shape.css`.

### Tipografía (`typography.css`)

| Token | Uso |
|---|---|
| `--font-display` | Familia de titulares: "Archivo Variable". |
| `--font-body` | Familia de texto corrido: "Manrope Variable". |
| `--fs-hero`, `--fs-h2`, `--fs-h3` | Escala de titulares. |
| `--fs-lead`, `--fs-body`, `--fs-small`, `--fs-eyebrow` | Escala de texto. |
| `--ls-display`, `--ls-eyebrow` | Interletrado de titulares y de rótulos. |

Las clases `.st-eyebrow` y `.st-num` siguen disponibles para contenido estático que no usa componentes.

## Fuentes autoalojadas

Las fuentes se cargan desde los paquetes `@fontsource-variable/archivo` y `@fontsource-variable/manrope`, importados en `src/app/layout.tsx`. De este modo, el build y la ejecución no dependen de la red. Al cambiar de versión de estos paquetes, se verifica que las familias sigan llamándose "Archivo Variable" y "Manrope Variable", porque ese nombre se referencia en `typography.css`.

## Estilos globales (`src/app/globals.css`)

El archivo define un reset mínimo, el anillo de foco `:focus-visible` (2 px, color `--st-cyan-light`, separación de 3 px), la regla global de `prefers-reduced-motion` y la clase `.visually-hidden`. La clase `visually-hidden` oculta un elemento de la vista y lo conserva para lectores de pantalla; los componentes del kit la emplean para etiquetas accesibles.

El viewport se declara en `layout.tsx` con `width=device-width`, escala inicial 1 y `themeColor` igual al fondo ink (`#0B0714`). El idioma del documento es `es`.

## Componentes

Cada componente reside en `src/shared/ui/<Nombre>/` con los archivos `<Nombre>.tsx`, `<Nombre>.module.css`, `<Nombre>.test.tsx` e `index.ts`. El barril `src/shared/ui/index.ts` reexporta todos los componentes.

| Componente | Propósito | Props principales |
|---|---|---|
| `Button` | Acción principal, secundaria o destructiva. | `variant` (`primary`, `ghost`, `danger`), `size` (`md`, `lg`), `loading`, `loadingLabel`, `fullWidth` |
| `Spinner` | Indicador de carga circular. | `label`, `decorative`, `size` |
| `Badge` | Etiqueta de estado o categoría. | `tone` (`cyan`, `pink`, `yellow`, `neutral`), `live` |
| `LiveDot` | Punto pulsante de estado en vivo. | `tone`, `label` |
| `Eyebrow` | Rótulo pequeño sobre un título. | `tone`, `as` |
| `StatBlock` | Par etiqueta y valor en lista de descripción. | `label`, `value`, `align`, `size` |
| `GradientCard` | Marco degradado con panel interior. | `as`, `glow`, `className`, `panelClassName` |
| `MarketCard` | Tarjeta de mercado de una startup. | `name`, `ods`, `price`, `delta`, `deltaTone`, `total`, `totalLabel`, `investors`, `investorsLabel`, `status`, `roundLabel`, `headingLevel` |
| `BrandLogo` | Logotipo horizontal o vertical con `next/image`. | `variant`, `alt`, `priority` |
| `AnimatedBackground` | Fondo decorativo de tiburones, burbujas y resplandores. | `fixed` |
| `Toast` | Notificación presentacional. | `tone` (`neutral`, `positive`, `negative`, `warning`), `role`, `action` |
| `Dialog` | Diálogo modal accesible. | `open`, `onClose`, `title`, `description`, `lead`, `closeOnBackdrop`, `placement` |
| `BottomSheet` | Panel inferior móvil basado en `Dialog`. | Las mismas props de `Dialog`, sin `placement` ni `lead` |
| `ProgressBar` | Barra de progreso con valores ARIA. | `value`, `max`, `label`, `valueText`, `tone` |
| `SegmentedChoice` | Selector de una opción con `radiogroup`. | `label`, `options`, `value`, `onChange`, `disabled` |
| `AmountField` | Campo numérico con etiqueta, error, sufijo y atajos. | `label`, `value`, `onChange`, `hint`, `error`, `suffix`, `shortcuts`, `shortcutsLabel` |
| `Countdown` | Contador presentacional en formato mm:ss. | `seconds`, `label`, `tone` |

### Comportamiento de los componentes interactivos

`Dialog` atrapa el foco dentro del panel, cierra con la tecla Escape, bloquea el desplazamiento del cuerpo y devuelve el foco al elemento que lo abrió. El cierre al hacer clic en el fondo solo se activa con `closeOnBackdrop`. `BottomSheet` hereda este comportamiento.

`SegmentedChoice` emplea botones de radio nativos. Por este motivo, el teclado (flechas, Tab y Espacio) funciona sin código adicional.

`AmountField` asocia la ayuda y el error al campo mediante `aria-describedby`, y marca el campo con `aria-invalid` cuando existe un error.

`AnimatedBackground` consulta la preferencia `prefers-reduced-motion` mediante el hook `usePrefersReducedMotion` (`src/shared/lib/use-prefers-reduced-motion.ts`). Con movimiento reducido, las animaciones se detienen y las burbujas no se renderizan.

## Reglas de uso

- Se emplean los componentes del kit antes de crear controles nuevos. Si una necesidad no está cubierta, se amplía el componente existente mediante props.
- Los textos visibles se pasan como props o como `children`. Los componentes no incorporan textos en español.
- Los componentes de presentación no mantienen estado de negocio. El estado proviene del consumidor.
- Los estilos nuevos usan tokens. No se introducen colores literales en los módulos CSS.
- El acento (`--accent`) se combina con texto oscuro (`--bg-page`). El texto blanco sobre el acento no alcanza el contraste mínimo de 4.5:1.
- El contraste mínimo del texto es 4.5:1. El texto secundario usa `--fg-3` como mínimo.
- Los objetivos táctiles miden al menos 44 px de alto. Los botones `lg` miden 52 px.
- Las animaciones decorativas se detienen con `prefers-reduced-motion`.
- Los componentes que reciben funciones como props (`Dialog`, `SegmentedChoice`, `AmountField`) se usan desde componentes cliente. Los componentes de servidor no pasan funciones a estos componentes.

## Pruebas

Las pruebas de componentes se ubican junto a cada componente y usan `// @vitest-environment jsdom` al inicio del archivo. El entorno global de Vitest permanece en `node`. La configuración de Vitest habilita el runtime automático de JSX porque `tsconfig.json` usa `"jsx": "preserve"`.

Las pruebas usan Testing Library (`@testing-library/react`, `@testing-library/user-event` y `@testing-library/jest-dom`). Se prueban roles, nombres accesibles, interacción por teclado, estados deshabilitados y de carga, la descripción asociada a errores y el comportamiento con movimiento reducido.

Para ejecutar las pruebas del kit, se usa `pnpm vitest run src/shared/ui`.

## Catálogo de desarrollo

La ruta `/design` renderiza todos los componentes del kit con sus variantes. La ruta llama a `notFound()` cuando `NODE_ENV` es `production`, por lo que no se publica en producción. Se recomienda consultar el catálogo al modificar un componente para verificar sus estados visuales.
