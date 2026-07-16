import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "סקאוט ליגה ג'",
  description: "כלי איסוף אירועים חי וניתוח משחק לקבוצת ליגה ג'",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "סקאוט",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
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
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col select-none">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
