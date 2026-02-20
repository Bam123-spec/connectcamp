type RoleDropdownProps = {
  value: string | null;
  onChange: (value: string) => void;
};

const roles = ["President", "Vice President", "Treasurer", "Secretary", "Officer"];

const RoleDropdown = ({ value, onChange }: RoleDropdownProps) => (
  <select
    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
    value={value ?? ""}
    onChange={(event) => onChange(event.target.value)}
  >
    <option value="">Select role</option>
    {roles.map((role) => (
      <option key={role} value={role}>
        {role}
      </option>
    ))}
  </select>
);

export default RoleDropdown;
