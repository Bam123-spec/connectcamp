import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

type ClubOption = {
  id: string;
  name: string;
};

const ROLE_OPTIONS = ["president", "vice_president", "treasurer", "secretary"] as const;
type OfficerRole = (typeof ROLE_OPTIONS)[number];
const displayRole = (role: OfficerRole) => role.replace("_", " ").replace(/^\w/, (char) => char.toUpperCase());

type BulkRow = {
  email: string;
  club: string;
  role: string;
  line: number;
};

const generateTempPassword = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(-12);
};

function AddMembers() {
  const { toast } = useToast();
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsError, setClubsError] = useState<string | null>(null);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberClubId, setMemberClubId] = useState("");
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [officerEmail, setOfficerEmail] = useState("");
  const [officerClubId, setOfficerClubId] = useState("");
  const [officerRole, setOfficerRole] = useState<OfficerRole | "">("");
  const [officerSubmitting, setOfficerSubmitting] = useState(false);
  const [officerError, setOfficerError] = useState<string | null>(null);

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [bulkFileName, setBulkFileName] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const fetchClubs = async () => {
      setClubsLoading(true);
      const { data, error } = await supabase.from("clubs").select("id,name").order("name");
      if (!isMounted) return;

      if (error) {
        setClubsError(error.message);
      } else {
        setClubs(data ?? []);
        setClubsError(null);
      }

      setClubsLoading(false);
    };

    fetchClubs();

    return () => {
      isMounted = false;
    };
  }, []);

  const ensureAuthUser = useCallback(async (email: string) => {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalized,
      email_confirm: true,
      password: generateTempPassword(),
    });

    if (error) {
      if (error.message?.toLowerCase().includes("already registered")) {
        return null;
      }

      throw new Error(error.message ?? "Unable to create user in Supabase Auth");
    }

    return data.user?.id ?? null;
  }, []);

  const addMemberRecord = useCallback(async (clubId: string, userId: string | null) => {
    const { error } = await supabase
      .from("club_members")
      .upsert(
        [
          {
            club_id: clubId,
            user_id: userId,
          },
        ],
        { onConflict: "club_id,user_id", ignoreDuplicates: true },
      );

    if (error) {
      throw new Error(error.message ?? "Unable to add member to club");
    }
  }, []);

  const findProfileByEmail = useCallback(async (email: string) => {
    const { data, error } = await supabase.from("profiles").select("id").eq("email", email).single();
    if (error || !data) {
      throw new Error("User with this email doesn’t exist.");
    }
    return data.id as string;
  }, []);

  const addMemberFlow = useCallback(
    async (email: string, clubId: string) => {
      const normalized = email.trim().toLowerCase();
      await ensureAuthUser(normalized);
      let userId: string | null = null;
      try {
        userId = await findProfileByEmail(normalized);
      } catch {
        userId = null;
      }
      await addMemberRecord(clubId, userId);
    },
    [addMemberRecord, ensureAuthUser, findProfileByEmail],
  );

  const insertOfficer = useCallback(
    async (userId: string, clubId: string, email: string, role: OfficerRole) => {
      // Enforce a single officer record per user per club; block if one already exists for this club.
      const { data: existingRows } = await supabase
        .from("officers")
        .select("id")
        .eq("user_id", userId)
        .eq("club_id", clubId)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        throw new Error("Can't add user: this account is already an officer for this club.");
      }

      // No existing record; insert new.
      const payloadWithEmail = { user_id: userId, club_id: clubId, role, email };
      const payloadWithoutEmail = { user_id: userId, club_id: clubId, role };

      const withEmail = await supabase.from("officers").insert(payloadWithEmail);
      if (!withEmail.error) return;

      const message = withEmail.error.message?.toLowerCase() ?? "";
      const columnMissing = message.includes("column") && message.includes("email");
      if (columnMissing) {
        const withoutEmail = await supabase.from("officers").insert(payloadWithoutEmail);
        if (withoutEmail.error) throw new Error(withoutEmail.error.message ?? "Unable to add officer.");
        return;
      }

      throw new Error(withEmail.error.message ?? "Unable to add officer.");
    },
    [],
  );

  const addOfficerFlow = useCallback(
    async (email: string, clubId: string, role: OfficerRole) => {
      const normalized = email.trim().toLowerCase();
      const profileId = await findProfileByEmail(normalized);
      await insertOfficer(profileId, clubId, normalized, role);
      await addMemberRecord(clubId, profileId);
    },
    [addMemberRecord, findProfileByEmail, insertOfficer],
  );

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMemberError(null);

    if (!memberEmail || !memberClubId) {
      setMemberError("Please provide both email and club.");
      return;
    }

    setMemberSubmitting(true);
    try {
      await addMemberFlow(memberEmail, memberClubId);
      toast({
        title: "Member added",
        description: `${memberEmail.trim()} is now part of the selected club.`,
      });
      setMemberEmail("");
      setMemberClubId("");
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : "Unable to add member.");
    } finally {
      setMemberSubmitting(false);
    }
  };

  const handleAddOfficer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOfficerError(null);

    if (!officerEmail || !officerClubId || !officerRole) {
      setOfficerError("Email, club, and role are required.");
      return;
    }

    setOfficerSubmitting(true);
    try {
      await addOfficerFlow(officerEmail, officerClubId, officerRole);
      toast({
        title: "Officer added",
        description: `${officerEmail.trim()} is now ${displayRole(officerRole)}.`,
      });
      setOfficerEmail("");
      setOfficerClubId("");
      setOfficerRole("");
    } catch (error) {
      setOfficerError(error instanceof Error ? error.message : "Unable to add officer.");
    } finally {
      setOfficerSubmitting(false);
    }
  };

  const parseCsv = useCallback((text: string): BulkRow[] => {
    const rows: BulkRow[] = [];
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      const values = line.split(",").map((value) => value.trim());
      if (values.length < 3) return;

      const [email, club, role] = values;
      if (index === 0 && ["email", "email address"].includes(email.toLowerCase())) {
        return;
      }

      rows.push({
        email,
        club,
        role,
        line: index + 1,
      });
    });
    return rows;
  }, []);

  const handleBulkFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setBulkResults(null);
    setBulkError(null);

    if (!file) {
      setBulkRows([]);
      setBulkFileName("");
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);
    setBulkRows(rows);
    setBulkFileName(file.name);

    if (!rows.length) {
      setBulkError("No rows were found in the uploaded CSV.");
    }
  };

  const normalizeRole = (value: string): OfficerRole | null => {
    const match = ROLE_OPTIONS.find((role) => role.toLowerCase() === value.trim().toLowerCase());
    return match ?? null;
  };

  const resolveClubIdentifier = (value: string) => {
    const trimmed = value.trim();
    return (
      clubs.find((club) => club.id === trimmed) ??
      clubs.find((club) => club.name.toLowerCase() === trimmed.toLowerCase())
    );
  };

  const handleProcessBulk = async () => {
    if (!bulkRows.length) {
      setBulkError("Upload a CSV before starting the import.");
      return;
    }

    setBulkProcessing(true);
    setBulkResults(null);
    setBulkError(null);

    const errors: string[] = [];
    let success = 0;

    for (const row of bulkRows) {
      try {
        const club = resolveClubIdentifier(row.club);
        if (!club) {
          throw new Error(`Club "${row.club}" not found.`);
        }

        const role = normalizeRole(row.role);
        if (!role) {
          throw new Error(`Invalid role "${row.role}".`);
        }

        if (!row.email) {
          throw new Error("Missing email address.");
        }

        await addOfficerFlow(row.email, club.id, role);
        success += 1;
      } catch (error) {
        errors.push(`Row ${row.line}: ${error instanceof Error ? error.message : "Unknown error."}`);
      }
    }

    setBulkResults({
      success,
      failed: errors.length,
      errors,
    });

    if (success > 0 && errors.length === 0) {
      toast({
        title: "Bulk upload complete",
        description: `${success} officer${success === 1 ? "" : "s"} added successfully.`,
      });
    } else {
      toast({
        title: "Bulk upload finished",
        description: `${success} added, ${errors.length} failed.`,
      });
    }

    setBulkProcessing(false);
  };

  const clubOptions = useMemo(
    () =>
      clubs.map((club) => (
        <option key={club.id} value={club.id}>
          {club.name}
        </option>
      )),
    [clubs],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Add Members</h1>
        <p className="text-sm text-muted-foreground">
          Invite students and officers to their clubs directly from the admin workspace.
        </p>
        {clubsError && (
          <p className="text-sm text-destructive">
            Unable to load clubs from Supabase: {clubsError}
          </p>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Member</CardTitle>
            <p className="text-sm text-muted-foreground">
              Add a single member to a club. We&apos;ll create an account if the email has not been invited yet.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleAddMember}>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="member@example.com"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Select club</label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
                  value={memberClubId}
                  onChange={(event) => setMemberClubId(event.target.value)}
                  disabled={clubsLoading || clubs.length === 0}
                >
                  <option value="">Choose a club</option>
                  {clubOptions}
                </select>
              </div>
              {memberError && <p className="text-sm text-destructive">{memberError}</p>}
              <Button type="submit" disabled={memberSubmitting}>
                {memberSubmitting ? "Adding..." : "Add Member"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Club Officer</CardTitle>
            <p className="text-sm text-muted-foreground">
              Promote officers individually or import a CSV to onboard multiple leaders at once.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleAddOfficer}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">Officer email</label>
                  <Input
                    type="email"
                    placeholder="officer@example.com"
                    value={officerEmail}
                    onChange={(event) => setOfficerEmail(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Select club</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
                    value={officerClubId}
                    onChange={(event) => setOfficerClubId(event.target.value)}
                    disabled={clubsLoading || clubs.length === 0}
                  >
                    <option value="">Choose a club</option>
                    {clubOptions}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Select role</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={officerRole}
                    onChange={(event) => setOfficerRole(event.target.value as OfficerRole)}
                  >
                    <option value="">Choose a role</option>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {displayRole(role)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {officerError && <p className="text-sm text-destructive">{officerError}</p>}
              <Button type="submit" disabled={officerSubmitting}>
                {officerSubmitting ? "Adding..." : "Add Officer"}
              </Button>
            </form>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold">Bulk officer upload</p>
                <p className="text-xs text-muted-foreground">
                  Upload a CSV with <code className="rounded bg-muted px-1">email,club,role</code> headers.
                </p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleBulkFile}
                className="text-sm"
              />
              {bulkFileName && (
                <p className="text-xs text-muted-foreground">
                  Loaded {bulkRows.length} {bulkRows.length === 1 ? "row" : "rows"} from {bulkFileName}
                </p>
              )}
              {bulkError && <p className="text-xs text-destructive">{bulkError}</p>}
              <Button type="button" variant="secondary" onClick={handleProcessBulk} disabled={bulkProcessing}>
                {bulkProcessing ? "Processing..." : "Process CSV"}
              </Button>
              {bulkResults && (
                <div className="rounded-md border bg-background px-3 py-2 text-xs">
                  <p>
                    Success: <span className="font-semibold">{bulkResults.success}</span>
                  </p>
                  <p>
                    Failed: <span className="font-semibold">{bulkResults.failed}</span>
                  </p>
                  {bulkResults.errors.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {bulkResults.errors.map((message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AddMembers;
