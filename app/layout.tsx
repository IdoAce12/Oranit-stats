import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";
import { ThemeProvider } from "./components/ThemeProvider";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-assistant",
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
  themeColor: "#070d24",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`} data-theme="dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col select-none">
        <Script
          id="scout-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('scout-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
        <ThemeProvider>
          <ServiceWorkerRegister />
          <div className="app-bg" aria-hidden />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
