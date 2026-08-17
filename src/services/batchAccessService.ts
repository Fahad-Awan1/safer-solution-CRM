/**
 * Batch Access & Visibility Enforcement Service
 * Handles authorization checks for batches and leads based on user roles (admin, team_leader, caller).
 */

export interface UserContext {
  id: string;
  role: 'admin' | 'team_leader' | 'caller' | string;
  name?: string;
  email?: string;
  orgId?: string;
}

export interface BatchAccessResult {
  allowed: boolean;
  reason: string;
}

/**
 * Pure evaluation function for batch/lead access control based on user role and restrictions.
 * - Admin: Unrestricted access to all batches and leads.
 * - Team Leader: Full supervisory access to all batches and leads.
 * - Caller: Access restricted to allowedCallerIds list. If empty or null, global access applies.
 */
export function canUserAccessBatchOrLead(
  user: UserContext,
  allowedCallerIds: string[] | string | null | undefined
): BatchAccessResult {
  // Admin and Team Leader roles bypass caller restrictions
  if (user.role === 'admin') {
    return { allowed: true, reason: 'Admin role has full access.' };
  }
  if (user.role === 'team_leader') {
    return { allowed: true, reason: 'Team Leader role has supervisory access.' };
  }

  // Parse allowedCallerIds if stringified JSON
  let parsedAllowed: string[] | null = null;
  if (Array.isArray(allowedCallerIds)) {
    parsedAllowed = allowedCallerIds;
  } else if (typeof allowedCallerIds === 'string') {
    try {
      const parsed = JSON.parse(allowedCallerIds);
      if (Array.isArray(parsed)) {
        parsedAllowed = parsed;
      }
    } catch {
      parsedAllowed = null;
    }
  }

  // If no restricted caller IDs set, batch is open to all callers (unrestricted)
  if (!parsedAllowed || parsedAllowed.length === 0) {
    return { allowed: true, reason: 'Batch/Lead is unrestricted (Global Access).' };
  }

  // For callers, check if user ID is in the allowed list
  if (parsedAllowed.includes(user.id)) {
    return { allowed: true, reason: `Caller ID ${user.id} is explicitly allowed.` };
  }

  return {
    allowed: false,
    reason: `Caller ID ${user.id} is restricted from accessing this batch/lead.`,
  };
}

/**
 * Builds a SQL WHERE clause condition for PostgreSQL queries enforcing visibility rules.
 */
export function buildPgVisibilityWhereClause(
  userId: string,
  userRole: string,
  paramIndex: number
): { sqlClause: string; params: any[] } {
  if (userRole === 'admin' || userRole === 'team_leader') {
    return { sqlClause: '1=1', params: [] };
  }

  return {
    sqlClause: `(
      allowed_caller_ids IS NULL 
      OR allowed_caller_ids::text = 'null' 
      OR allowed_caller_ids::text = '[]' 
      OR allowed_caller_ids @> jsonb_build_array($${paramIndex}::text)
    )`,
    params: [userId],
  };
}
