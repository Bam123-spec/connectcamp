import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import FieldOptionsEditor from "./FieldOptionsEditor";
import type { EditableField, FieldType } from "../types";

const FIELD_LABELS: Record<FieldType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  number: "Number",
  dropdown: "Dropdown",
  checkbox: "Checkboxes",
  radio: "Radio Group",
  date: "Date",
  time: "Time",
  file: "File Upload",
  section: "Section Header",
};

type FieldEditorProps = {
  field: EditableField;
  onChange: (field: EditableField) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandleProps?: {
    draggable?: boolean;
    onDragStart?: React.DragEventHandler<HTMLDivElement>;
    onDragOver?: React.DragEventHandler<HTMLDivElement>;
    onDrop?: React.DragEventHandler<HTMLDivElement>;
  };
};

const FieldEditor = ({ field, onChange, onDuplicate, onDelete, dragHandleProps }: FieldEditorProps) => {
  const update = (patch: Partial<EditableField>) => {
    onChange({ ...field, ...patch });
  };

  const showOptions = ["dropdown", "checkbox", "radio"].includes(field.type);

  return (
    <div
      className="rounded-2xl border bg-background p-4 shadow-sm"
      draggable={dragHandleProps?.draggable}
      onDragStart={dragHandleProps?.onDragStart}
      onDragOver={dragHandleProps?.onDragOver}
      onDrop={dragHandleProps?.onDrop}
    >
      <div className="flex items-start justify-between">
          <p className="text-sm font-semibold text-muted-foreground">{FIELD_LABELS[field.type]}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      {field.type === "section" ? (
        <Textarea
          className="mt-3"
          placeholder="Section text"
          value={field.description ?? ""}
          onChange={(event) => update({ description: event.target.value })}
        />
      ) : (
        <>
          <div className="mt-3 space-y-2">
            <label className="text-sm font-medium text-foreground">Label</label>
            <Input value={field.label} onChange={(event) => update({ label: event.target.value })} placeholder="Question label" />
          </div>
          <div className="mt-3 space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              value={field.description ?? ""}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Add more context"
            />
          </div>
          <label className="mt-3 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Required</p>
              <p className="text-xs text-muted-foreground">Respondent must fill out this field.</p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={field.required}
              onChange={(event) => update({ required: event.target.checked })}
            />
          </label>
          {showOptions && (
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-foreground">Options</label>
              <FieldOptionsEditor value={field.options ?? []} onChange={(next) => update({ options: next })} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FieldEditor;
