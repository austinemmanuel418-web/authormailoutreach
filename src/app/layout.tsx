import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bulk Mailer",
  description: "Send one message to many people through Gmail",
  robots: { index: false, follow: false }, // keep search engines out
};

// Runs BEFORE the page is drawn, so there is no white flash.
// It reads the saved theme (or the phone/PC setting) and sets the class.
const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-green-50 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
