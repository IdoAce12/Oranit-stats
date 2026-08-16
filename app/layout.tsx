import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

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
  themeColor: "#080c17",
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
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col select-none">
        <ServiceWorkerRegister />
        <div className="app-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
