import type { FormFieldRecord } from "../types";

const typeLabel: Record<FormFieldRecord["type"], string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  number: "Number",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  radio: "Radio",
  date: "Date",
  time: "Time",
  file: "File Upload",
  section: "Section",
};

const FormFieldCard = ({ field }: { field: FormFieldRecord }) => (
  <div className="rounded-xl border bg-background px-4 py-3">
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold">{field.label || "(untitled field)"}</p>
      <span className="text-xs text-muted-foreground">{typeLabel[field.type]}</span>
    </div>
    {field.description && <p className="mt-1 text-sm text-muted-foreground">{field.description}</p>}
    {field.options && field.options.length > 0 && (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {field.options.map((option, index) => (
          <li key={`${option}-${index}`}>{option}</li>
        ))}
      </ul>
    )}
  </div>
);

export default FormFieldCard;
