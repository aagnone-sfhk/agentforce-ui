import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { Suspense } from "react";

// Use process.env directly for build-time metadata (only NEXT_PUBLIC vars available)
const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "AI Chat Assistant";
const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || "Your intelligent AI assistant powered by Agentforce";

export const metadata: Metadata = {
  title: appTitle,
  description: appDescription,
  keywords: ["AI", "chat", "assistant", "Agentforce", "Salesforce", "Heroku"],
  authors: [{ name: "Heroku" }],
  creator: "Heroku",
  publisher: "Heroku",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://heroku.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: appTitle,
    description: appDescription,
    type: 'website',
    locale: 'en_US',
    siteName: appTitle,
    images: [
      {
        url: '/images/heroku.svg',
        width: 1200,
        height: 630,
        alt: appTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: appTitle,
    description: appDescription,
    images: ['/images/heroku.svg'],
    creator: '@heroku',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#0176D3" />
        <meta name="msapplication-TileColor" content="#0176D3" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appTitle} />
      </head>
      <body className="m-0 p-0">
        <Suspense fallback={null}>
          <ClientProviders>
            {children}
          </ClientProviders>
        </Suspense>
      </body>
    </html>
  );
}
