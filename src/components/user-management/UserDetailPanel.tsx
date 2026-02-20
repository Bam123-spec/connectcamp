import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RoleDropdown from "./RoleDropdown";
import UserActions from "./UserActions";

type ClubInfo = {
  membershipId: string;
  clubId: string;
  name: string;
};

type UserDetailPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    id: string;
    name: string;
    email: string;
    createdAt: string | null;
    role: string | null;
    status: "active" | "inactive";
    officerRole: string | null;
  };
  clubs: ClubInfo[];
  officerRole: string | null;
  activity: { events: number; forms: number };
  onRemoveClub: (membershipId: string) => void;
  onPromote: (role: string) => void;
  onRevoke: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onSoftDelete: () => void;
};

const UserDetailPanel = ({
  open,
  onOpenChange,
  user,
  clubs,
  officerRole,
  activity,
  onRemoveClub,
  onPromote,
  onRevoke,
  onActivate,
  onDeactivate,
  onSoftDelete,
}: UserDetailPanelProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      {user ? (
        <div className="space-y-6">
          <SheetHeader>
            <SheetTitle>{user.name}</SheetTitle>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </SheetHeader>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm">
              Joined: <span className="font-medium">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline" className="capitalize">
                {user.role ?? "student"}
              </Badge>
              <Badge variant={user.status === "active" ? "default" : "destructive"}>{user.status}</Badge>
            </div>
          </div>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Clubs</p>
              <p className="text-xs text-muted-foreground">{clubs.length} joined</p>
            </div>
            {clubs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clubs linked to this account.</p>
            ) : (
              <div className="space-y-2">
                {clubs.map((club) => (
                  <div key={club.membershipId} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                    <p className="text-sm font-medium">{club.name}</p>
                    <Button variant="ghost" size="sm" onClick={() => onRemoveClub(club.membershipId)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-semibold">Officer role</p>
            <p className="text-sm text-muted-foreground">
              {officerRole ? `Currently ${officerRole}` : "Not serving as an officer."}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <RoleDropdown
                value={officerRole}
                onChange={(value) => {
                  if (value) onPromote(value);
                }}
              />
              {officerRole && (
                <Button variant="outline" onClick={onRevoke}>
                  Revoke
                </Button>
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-background p-4">
            <p className="text-sm font-semibold">Activity summary</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Events attended</p>
                <p className="text-xl font-semibold">{activity.events}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Forms submitted</p>
                <p className="text-xl font-semibold">{activity.forms}</p>
              </div>
            </div>
          </section>
          <UserActions
            isActive={user.status === "active"}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
            onSoftDelete={onSoftDelete}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select a user to view details.</p>
      )}
    </SheetContent>
  </Sheet>
);

export default UserDetailPanel;
