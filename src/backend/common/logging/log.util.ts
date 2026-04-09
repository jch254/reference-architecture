export const caller = (svc: string, method: string): string =>
  `${svc}.${method}`;
