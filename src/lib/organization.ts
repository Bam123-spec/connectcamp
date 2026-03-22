export function resolveCurrentOrgId(profileOrgId?: string | null) {
  if (profileOrgId) return profileOrgId;

  if (typeof window === "undefined") return null;

  return (
    window.localStorage.getItem("cc.workspace.org_id") ||
    window.localStorage.getItem("cc.settings.org_id") ||
    null
  );
}
