import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Heebo } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./components/AuthProvider";
import { AppShell } from "./components/AppShell";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heebo",
});

const display = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-frank",
});

export const metadata: Metadata = {
  title: "סקאוט — ניתוח משחק",
  description: "כלי איסוף אירועים חי וניתוח משחק לקבוצת ליגה ג'",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "סקאוט",
  },
  icons: {
    icon: "/hapoel-oranit.png",
    apple: "/hapoel-oranit.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#070504",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${display.variable} h-full antialiased`} data-theme="dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col select-none">
        <Script
          id="scout-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('scout-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
          <ServiceWorkerRegister />
          <div className="app-bg" aria-hidden />
          <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
