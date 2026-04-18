declare namespace Express {
  interface Request {
    requestId: string;
    tenantSlug: string;
    user?: { email: string; tenantSlug: string };
  }
}
