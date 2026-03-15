import type { Metadata } from "next";
import "./globals.css";
import "@/src/index.css";
import { ThemeProvider } from "@/src/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "Digital Portfolio Next Client",
  description: "Next.js migration target for Digital Portfolio frontend",
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    var role = null;
    var rawUser = localStorage.getItem('user');
    if (rawUser) {
      try {
        var parsed = JSON.parse(rawUser);
        if (parsed && (parsed.role === 'teacher' || parsed.role === 'student')) {
          role = parsed.role;
        }
      } catch (e) {}
    }

    if (!role) {
      var storedRole = localStorage.getItem('role');
      if (storedRole === 'teacher' || storedRole === 'student') {
        role = storedRole;
      }
    }

    if (role) {
      document.documentElement.setAttribute('data-role', role);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the inline script mutates data-theme before
    // React hydrates, so the attribute on <html> may differ from what the
    // server rendered. This prop tells React to ignore that one attribute.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
