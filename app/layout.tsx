import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maestro — Operações Humano–IA",
  description: "Coordenação e observabilidade para operações de desenvolvimento assistidas por IA.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
