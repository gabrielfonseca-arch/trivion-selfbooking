import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Montserrat é a tipografia de apoio oficial do manual de marca do Grupo
// Trivion. A principal (Mugen Grotesk FW) não é uma fonte web e aparece só no
// logo — que está vetorizado em src/components/brand/logo.tsx.
//
// A fonte é servida do próprio projeto (src/fonts) em vez de vir do Google
// Fonts: assim o build não depende de rede externa para passar, e o app não
// faz requisição a um domínio de terceiros em produção.
const montserrat = localFont({
  src: [
    { path: "../fonts/montserrat-latin-wght-normal.woff2", style: "normal" },
    { path: "../fonts/montserrat-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "TRIVION | SELF BOOKING",
  description: "Central de Controle e Performance Comercial — Grupo Trivion",
};

export const viewport: Viewport = {
  themeColor: "#0d1a2a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`h-full antialiased ${montserrat.variable}`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
