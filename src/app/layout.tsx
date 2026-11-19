import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "Start Tank",
  description: "Shark Tank Universitario de Hult Prize at UNI",
};

/** Configuración de viewport: ancho del dispositivo y color de la barra del navegador (fondo ink). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0714",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
