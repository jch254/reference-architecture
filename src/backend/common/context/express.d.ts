declare namespace Express {
  interface Request {
    requestId: string;
    tenantSlug: string;
  }
}
