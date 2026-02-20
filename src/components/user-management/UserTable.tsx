import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export type DisplayUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  role: string | null;
  status: "active" | "inactive";
  clubsCount: number;
  officerRole: string | null;
};

type UserTableProps = {
  users: DisplayUser[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilter: (value: string) => void;
  statusFilter: string;
  onStatusFilter: (value: string) => void;
  onSelectUser: (userId: string) => void;
};

const roleOptions = ["all", "student", "officer", "admin"];
const statusOptions = ["all", "active", "inactive"];

const UserTable = ({
  users,
  loading,
  search,
  onSearchChange,
  roleFilter,
  onRoleFilter,
  statusFilter,
  onStatusFilter,
  onSelectUser,
}: UserTableProps) => {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="md:max-w-sm"
          />
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:justify-end">
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={roleFilter}
              onChange={(event) => onRoleFilter(event.target.value)}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All roles" : option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => onStatusFilter(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All statuses" : option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Clubs</TableHead>
                <TableHead>Officer Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelectUser(user.id)}>
                  <TableCell>
                    <p className="font-medium">{user.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.createdAt ? `Joined ${new Date(user.createdAt).toLocaleDateString()}` : "Unknown date"}
                    </p>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.clubsCount}</TableCell>
                  <TableCell className="capitalize">{user.officerRole ?? "Student"}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        user.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {user.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default UserTable;
