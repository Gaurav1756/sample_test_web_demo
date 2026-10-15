"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/**
 * Community settings (§11b/§11d). No read endpoint is documented, so these
 * forms set values rather than editing current ones.
 */
export function CommunitySettingsForms({ communityId }: { communityId: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <VisibilitySection communityId={communityId} />
      <PermissionsSection communityId={communityId} />
      <ModerationSection communityId={communityId} />
      <ApprovalSection communityId={communityId} />
      <NotifSection communityId={communityId} />
    </div>
  );
}

function usePatch(path: string) {
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const save = async (body: Record<string, unknown>, done: string) => {
    setError(null);
    setBusy(true);
    try {
      await bff(path, { method: "PATCH", body });
      notify(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, save };
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-700"
      />
      {label}
    </label>
  );
}

function VisibilitySection({ communityId }: { communityId: string }) {
  const { busy, error, save } = usePatch(`communities/${communityId}/visibility`);
  const [visibility, setVisibility] = React.useState("public");
  const [joinPolicy, setJoinPolicy] = React.useState("open");
  const [showInSearch, setShowInSearch] = React.useState(true);
  const [allowRecommendations, setAllowRecommendations] = React.useState(true);
  const [showOnHostProfile, setShowOnHostProfile] = React.useState(true);
  const [allowMemberInvites, setAllowMemberInvites] = React.useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          { visibility, joinPolicy, showInSearch, allowRecommendations, showOnHostProfile, allowMemberInvites },
          "Visibility saved.",
        );
      }}
      className="flex flex-col gap-3"
    >
      <h3 className="font-display text-lg">Visibility & access</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Visibility" htmlFor="vis">
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </Field>
        <Field label="Join policy" htmlFor="joinPolicy">
          <Select value={joinPolicy} onChange={(e) => setJoinPolicy(e.target.value)}>
            <option value="open">Open</option>
            <option value="approval">Approval required</option>
            <option value="invite_only">Invite only</option>
          </Select>
        </Field>
      </div>
      <Toggle label="Show in search" checked={showInSearch} onChange={setShowInSearch} />
      <Toggle label="Allow recommendations" checked={allowRecommendations} onChange={setAllowRecommendations} />
      <Toggle label="Show on host profile" checked={showOnHostProfile} onChange={setShowOnHostProfile} />
      <Toggle label="Allow member invites" checked={allowMemberInvites} onChange={setAllowMemberInvites} />
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy} size="sm">
          Save visibility
        </Button>
      </div>
    </form>
  );
}

const PERMISSION_FLAGS = [
  ["canCreatePosts", "Create posts"],
  ["canComment", "Comment"],
  ["canCreatePolls", "Create polls"],
  ["canCreateEvents", "Create events"],
  ["canSubmitEventRequest", "Submit event requests"],
  ["canCreateGroups", "Create groups"],
  ["canInviteMembers", "Invite members"],
  ["canViewDirectory", "View member directory"],
  ["requireApprovalBeforePublishing", "Require approval before publishing"],
  ["allowExternalLinks", "Allow external links"],
] as const;

function PermissionsSection({ communityId }: { communityId: string }) {
  const { busy, error, save } = usePatch(`communities/${communityId}/member-permissions`);
  const [flags, setFlags] = React.useState<Record<string, boolean>>({
    canCreatePosts: true,
    canComment: true,
    canCreatePolls: false,
    canCreateEvents: false,
    canSubmitEventRequest: true,
    canCreateGroups: false,
    canInviteMembers: true,
    canViewDirectory: true,
    requireApprovalBeforePublishing: false,
    allowExternalLinks: false,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(flags, "Member permissions saved.");
      }}
      className="flex flex-col gap-2"
    >
      <h3 className="font-display text-lg">Member permissions</h3>
      {PERMISSION_FLAGS.map(([key, label]) => (
        <Toggle
          key={key}
          label={label}
          checked={flags[key]}
          onChange={(v) => setFlags((p) => ({ ...p, [key]: v }))}
        />
      ))}
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy} size="sm">
          Save permissions
        </Button>
      </div>
    </form>
  );
}

function ModerationSection({ communityId }: { communityId: string }) {
  const { busy, error, save } = usePatch(`communities/${communityId}/moderation-settings`);
  const [toggles, setToggles] = React.useState({
    autoSpamDetection: true,
    holdFlaggedForReview: true,
    adminsCanModerate: true,
    moderatorsCanModerate: true,
    requirePostApproval: false,
    requireMemberApproval: false,
  });
  const [guidelines, setGuidelines] = React.useState("");
  const [prohibited, setProhibited] = React.useState("");

  const flip = (key: keyof typeof toggles) => (v: boolean) =>
    setToggles((p) => ({ ...p, [key]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          {
            ...toggles,
            ...(guidelines.trim() ? { guidelines: guidelines.trim().slice(0, 4000) } : {}),
            ...(prohibited.trim()
              ? { prohibitedContent: prohibited.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 100) }
              : {}),
          },
          "Moderation settings saved.",
        );
      }}
      className="flex flex-col gap-2"
    >
      <h3 className="font-display text-lg">Moderation</h3>
      <Toggle label="Auto spam detection" checked={toggles.autoSpamDetection} onChange={flip("autoSpamDetection")} />
      <Toggle label="Hold flagged content for review" checked={toggles.holdFlaggedForReview} onChange={flip("holdFlaggedForReview")} />
      <Toggle label="Admins can moderate" checked={toggles.adminsCanModerate} onChange={flip("adminsCanModerate")} />
      <Toggle label="Moderators can moderate" checked={toggles.moderatorsCanModerate} onChange={flip("moderatorsCanModerate")} />
      <Toggle label="Require post approval" checked={toggles.requirePostApproval} onChange={flip("requirePostApproval")} />
      <Toggle label="Require member approval" checked={toggles.requireMemberApproval} onChange={flip("requireMemberApproval")} />
      <Field label="Guidelines" htmlFor="guidelines">
        <Textarea value={guidelines} maxLength={4000} onChange={(e) => setGuidelines(e.target.value)} />
      </Field>
      <Field label="Prohibited content (one per line)" htmlFor="prohibited">
        <Textarea value={prohibited} onChange={(e) => setProhibited(e.target.value)} />
      </Field>
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy} size="sm">
          Save moderation
        </Button>
      </div>
    </form>
  );
}

function ApprovalSection({ communityId }: { communityId: string }) {
  const { busy, error, save } = usePatch(`communities/${communityId}/approval-settings`);
  const [requireApproval, setRequireApproval] = React.useState(true);
  const [adminsCanApprove, setAdminsCanApprove] = React.useState(true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ requireApproval, adminsCanApprove }, "Approval settings saved.");
      }}
      className="flex flex-col gap-2"
    >
      <h3 className="font-display text-lg">Join approvals</h3>
      <Toggle label="Require approval to join" checked={requireApproval} onChange={setRequireApproval} />
      <Toggle label="Admins can approve" checked={adminsCanApprove} onChange={setAdminsCanApprove} />
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy} size="sm">
          Save approvals
        </Button>
      </div>
    </form>
  );
}

function NotifSection({ communityId }: { communityId: string }) {
  // CQ-16 assumption: body holds the §11l community toggles until confirmed.
  const { busy, error, save } = usePatch(`communities/${communityId}/notification-settings`);
  const [activity, setActivity] = React.useState(true);
  const [events, setEvents] = React.useState(true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ communityActivity: activity, communityEvents: events }, "Notification settings saved.");
      }}
      className="flex flex-col gap-2"
    >
      <h3 className="font-display text-lg">Community notifications</h3>
      <Toggle label="Community activity" checked={activity} onChange={setActivity} />
      <Toggle label="Community events" checked={events} onChange={setEvents} />
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy} size="sm">
          Save notifications
        </Button>
      </div>
    </form>
  );
}
