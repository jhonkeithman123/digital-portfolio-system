import ejs from "ejs";
import path from "path";
import type { NextFunction, Request, Response } from "express";

function renderLandingFallback(
  clientUrl: string,
  docsUrl: string,
  accentColor: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Backend API Service</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Georgia, serif;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 40%),
          linear-gradient(160deg, #0b1320, #18263c 60%, #0f1726);
        color: #f8fafc;
      }
      main {
        width: min(720px, calc(100vw - 32px));
        padding: 32px;
        border-radius: 24px;
        background: rgba(15, 23, 38, 0.88);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      h1 { margin-top: 0; font-size: clamp(2rem, 5vw, 3rem); }
      p { line-height: 1.6; color: rgba(248, 250, 252, 0.82); }
      .accent { color: ${accentColor}; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
      a {
        text-decoration: none;
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.16);
        padding: 12px 16px;
        border-radius: 999px;
      }
      a.primary { background: ${accentColor}; color: #08111d; border-color: ${accentColor}; }
    </style>
  </head>
  <body>
    <main>
      <p class="accent">Backend API Service</p>
      <h1>Digital Portfolio server is online.</h1>
      <p>This deployment hosts the backend API for the frontend application. Use the frontend for normal interaction, or call the API routes directly.</p>
      <div class="actions">
        <a class="primary" href="/redirect?url=${encodeURIComponent(clientUrl)}">Open frontend</a>
        <a href="/redirect?url=${encodeURIComponent(docsUrl)}">View docs</a>
      </div>
    </main>
  </body>
</html>`;
}

export function renderLandingPage(
  templateDir: string,
  clientUrl: string,
  docsUrl: string,
  accentColor: string,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();

    ejs.renderFile(
      path.join(templateDir, "index.ejs"),
      { clientUrl, docsUrl, accent: accentColor },
      (err: Error | null, html: string) => {
        if (err) {
          console.error("EJS render error:", err);
          res
            .status(200)
            .type("html")
            .send(renderLandingFallback(clientUrl, docsUrl, accentColor));
          return;
        }

        res.type("html").send(html);
      },
    );
  };
}

export function browserHtmlRedirectGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response {
  const accept = req.headers.accept || "";
  const userAgent = req.headers["user-agent"] || "";

  const isBrowser =
    accept.includes("text/html") &&
    (userAgent.includes("Mozilla") ||
      userAgent.includes("Chrome") ||
      userAgent.includes("Safari") ||
      userAgent.includes("Edge") ||
      userAgent.includes("Firefox"));

  if (req.path === "/redirect") {
    return next();
  }

  if (isBrowser && req.path !== "/") {
    console.log(
      `[SECURITY] Browser detected accessing ${req.path}, redirecting to /`,
    );
    return res.redirect(302, "/");
  }

  next();
}

export function createSafeRedirectHandler(clientUrl: string) {
  const allowedDomains = [
    "github.com",
    "docs.google.com",
    new URL(clientUrl).hostname,
  ];

  return (req: Request, res: Response): void | Response => {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.redirect(302, "/");
    }

    try {
      const url = new URL(targetUrl);
      const isAllowed = allowedDomains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      );

      if (isAllowed) {
        console.log(`[REDIRECT] Allowing external redirect to: ${targetUrl}`);
        return res.redirect(302, targetUrl);
      }

      console.log(
        `[SECURITY] Blocked redirect to unauthorized domain: ${url.hostname}`,
      );
      return res.redirect(302, "/");
    } catch (_e) {
      console.error(`[REDIRECT] Invalid URL: ${targetUrl}`);
      return res.redirect(302, "/");
    }
  };
}
