/**
 * Declaración de los módulos CSS. Cada módulo exporta un mapa de nombres de clase
 * generado por Next.js o por Vitest.
 */
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
