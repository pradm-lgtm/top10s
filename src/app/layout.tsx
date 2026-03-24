import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AdminProvider } from "@/context/admin";
import { AdminBar } from "@/components/AdminBar";
import { AuthProvider } from "@/context/auth";
import { OnboardingModal } from "@/components/OnboardingModal";

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
          <AdminProvider>
            {children}
            <AdminBar />
          </AdminProvider>
          <OnboardingModal />
        </AuthProvider>
      </body>
    </html>
  );
}
