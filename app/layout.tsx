import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import { SidebarProvider } from "@/contexts/SidebarContext";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <SidebarProvider>
            <PrivacyProvider>
              <ToastProvider>{children}</ToastProvider>
            </PrivacyProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
