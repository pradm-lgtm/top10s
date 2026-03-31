import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AdminProvider } from "@/context/admin";
import { AdminBar } from "@/components/AdminBar";
import { AuthProvider } from "@/context/auth";
import { NavigationProvider } from "@/context/navigation";
import { OnboardingModal } from "@/components/OnboardingModal";
import { BottomNav } from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ranked",
  description: "Your take on the best in film & TV. Ranked.",
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <AuthProvider>
          <NavigationProvider>
            <AdminProvider>
              {children}
              <AdminBar />
            </AdminProvider>
            <OnboardingModal />
            <BottomNav />
          </NavigationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
