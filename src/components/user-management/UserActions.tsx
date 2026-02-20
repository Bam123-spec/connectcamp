import { Button } from "@/components/ui/button";

type UserActionsProps = {
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onSoftDelete: () => void;
};

const UserActions = ({ isActive, onActivate, onDeactivate, onSoftDelete }: UserActionsProps) => (
  <div className="space-y-3">
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-semibold">Account status</p>
      <p className="text-sm text-muted-foreground">Toggle whether this user can access the workspace.</p>
      <div className="mt-3 flex gap-3">
        {isActive ? (
          <Button variant="outline" onClick={onDeactivate}>
            Deactivate
          </Button>
        ) : (
          <Button onClick={onActivate}>Activate</Button>
        )}
      </div>
    </div>
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <p className="text-sm font-semibold">Danger zone</p>
      <p className="text-sm text-muted-foreground">Soft delete the user record while retaining history.</p>
      <Button variant="destructive" className="mt-3" onClick={onSoftDelete}>
        Soft delete user
      </Button>
    </div>
  </div>
);

export default UserActions;
