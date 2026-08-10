/**
 * Sentinel used only as the default parameter for public business repository
 * functions. It has no database capabilities: callers that do not inject an
 * existing transaction are redirected into withOrganization and the tenant
 * runtime client before any delegate can be accessed.
 */
export const tenantBoundary = Object.freeze({ __tenantBoundary: true });
