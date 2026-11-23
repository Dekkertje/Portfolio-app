import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ServiceWorker } from "@/components/ServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DekkerTracker",
  description: "Persoonlijk beleggingsdashboard — volg al je beleggingen op één plek.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // "black-translucent" maakt klok/batterij wit: onleesbaar op het lichte thema
    statusBarStyle: "default",
    title: "DekkerTracker",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // Content loopt door achter de notch/home-indicator; safe-area-padding vangt dat op
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Eén theme-color die het app-thema volgt (ook als dat afwijkt van het systeemthema) */}
        <meta name="theme-color" content="#0d0d0d" />
        {/* Thema zetten vóór de eerste paint, anders flitst/animeert alles van licht naar donker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");var d=document.documentElement.classList.contains("dark"),m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#0d0d0d":"#f4f4f1")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <SidebarProvider>
            <PrivacyProvider>
              <ToastProvider>{children}</ToastProvider>
              <ServiceWorker />
            </PrivacyProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
