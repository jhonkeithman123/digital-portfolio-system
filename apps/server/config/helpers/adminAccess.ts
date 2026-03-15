type AdminCandidate = {
  userId?: number | string | null;
  email?: string | null;
  username?: string | null;
  role?: string | null;
};

function parseCsv(input?: string): string[] {
  return (input || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseNumericSet(input?: string): Set<number> {
  const set = new Set<number>();
  parseCsv(input).forEach((v) => {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) set.add(n);
  });
  return set;
}

function parseLowerSet(input?: string): Set<string> {
  return new Set(parseCsv(input).map((v) => v.toLowerCase()));
}

// Admins are explicitly allowlisted by env and still must be teacher role.
export function isAdminUser(candidate?: AdminCandidate): boolean {
  if (!candidate) return false;
  const normalizedRole = String(candidate.role ?? "")
    .trim()
    .toLowerCase();
  if (normalizedRole !== "teacher") return false;

  const adminIds = parseNumericSet(process.env.ADMIN_USER_IDS);
  const adminEmails = parseLowerSet(process.env.ADMIN_EMAILS);
  const adminUsernames = parseLowerSet(process.env.ADMIN_USERNAMES);

  const hasAnyConfigured =
    adminIds.size > 0 || adminEmails.size > 0 || adminUsernames.size > 0;
  if (!hasAnyConfigured) return false;

  const idNum = Number.parseInt(String(candidate.userId ?? ""), 10);
  if (Number.isFinite(idNum) && adminIds.has(idNum)) return true;

  const email = String(candidate.email ?? "")
    .trim()
    .toLowerCase();
  if (email && adminEmails.has(email)) return true;

  const username = String(candidate.username ?? "")
    .trim()
    .toLowerCase();
  if (username && adminUsernames.has(username)) return true;

  return false;
}
