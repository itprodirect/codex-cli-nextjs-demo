import Footer from "@/app/_components/footer";
import { CMS_NAME, HOME_OG_IMAGE_URL } from "@/lib/constants";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import cn from "classnames";
import { ThemeSwitcher } from "./_components/theme-switcher";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `Next.js Blog Example with ${CMS_NAME}`,
  description: `A statically generated blog example using Next.js and ${CMS_NAME}.`,
  openGraph: {
    images: [HOME_OG_IMAGE_URL],
  },
};

import Link from "next/link";
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link
          rel="mask-icon"
          href="/favicon/safari-pinned-tab.svg"
          color="#000000"
        />
        <link rel="shortcut icon" href="/favicon/favicon.ico" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta
          name="msapplication-config"
          content="/favicon/browserconfig.xml"
        />
        <meta name="theme-color" content="#000" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const storageKey = 'nextjs-blog-starter-theme';
                const SYSTEM = 'system', DARK = 'dark', LIGHT = 'light';
                const modifyTransition = () => {
                  const css = document.createElement('style');
                  css.textContent = '*,*:after,*:before{transition:none!important;}';
                  document.head.appendChild(css);
                  return () => {
                    getComputedStyle(document.body);
                    setTimeout(() => document.head.removeChild(css), 1);
                  };
                };
                const media = window.matchMedia('(prefers-color-scheme:' + DARK + ')');
                window.updateDOM = () => {
                  const restore = modifyTransition();
                  const mode = localStorage.getItem(storageKey) || SYSTEM;
                  const systemMode = media.matches ? DARK : LIGHT;
                  const resolvedMode = mode === SYSTEM ? systemMode : mode;
                  const classList = document.documentElement.classList;
                  if (resolvedMode === DARK) classList.add(DARK);
                  else classList.remove(DARK);
                  document.documentElement.setAttribute('data-mode', mode);
                  restore();
                };
                window.updateDOM();
                media.addEventListener('change', window.updateDOM);
              })();
            `,
          }}
        />
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
      </head>
      <body className={cn(inter.className, "bg-black text-white antialiased")}>
        {/* Top navigation aligned left */}
        <nav className="w-full py-4 px-8 flex items-center space-x-6">
          <Link href="/" className="text-xl font-semibold hover:opacity-80">
            OpenAI Blog
          </Link>
        </nav>
        <ThemeSwitcher />
        <div className="min-h-screen">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
