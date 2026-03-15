import ejs from "ejs";
import path from "path";
import type { NextFunction, Request, Response } from "express";

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
          res.status(500).json({ error: "Template render failed" });
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
