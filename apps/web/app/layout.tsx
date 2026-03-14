import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Portfolio Next Client",
  description: "Next.js migration target for Digital Portfolio frontend",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
