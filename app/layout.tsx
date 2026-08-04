import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono, Courier_Prime } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import { Nav } from "@/components/nav";
import "./globals.css";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const monoFont = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const courierFont = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-courier-prime",
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Plataforma para jugar minijuegos online y competir por puntaje",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${pixelFont.variable} ${monoFont.variable} ${courierFont.variable} h-full`}
    >
      <body id="root" className="min-h-full flex flex-col">
        <div className="av-bg" />
        <div className="av-noise" />
        <SessionProvider>
          <Nav />
          <main className="av-main">{children}</main>
          <footer
            style={{
              borderTop: "1px solid var(--line)",
              padding: "20px 32px",
              textAlign: "center",
              color: "var(--ink-faint)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.16em",
            }}
          >
            © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
