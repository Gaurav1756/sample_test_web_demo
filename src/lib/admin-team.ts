import type { TeamMember } from "./api-types";

/**
 * Admin event-roster helpers.
 *
 * The `admin/events/:id/team` item shape is unstated (CQ-08): only identity
 * + permissions are relied upon. By convention `manage_event` marks a
 * host/co-host and everything else (e.g. `scan_tickets`) is event staff.
 */

/** A team member that can manage the event (host or co-host). */
export function isHostMember(member: TeamMember): boolean {
  return (member.permissions ?? []).includes("manage_event");
}

/** Split a raw team roster into hosts/co-hosts and event staff. */
export function splitEventTeam(team: TeamMember[]): {
  hosts: TeamMember[];
  staff: TeamMember[];
} {
  return {
    hosts: team.filter(isHostMember),
    staff: team.filter((member) => !isHostMember(member)),
  };
}

/** Display name for a team member, with an explicit fallback. */
export function teamMemberName(member: TeamMember, fallback: string): string {
  return member.user?.name ?? member.userId ?? member.memberId ?? fallback;
}

/** Stable React key for a team member. */
export function teamMemberKey(member: TeamMember, index: number): string {
  return member.userId ?? member.memberId ?? member.id ?? `member-${index}`;
}
