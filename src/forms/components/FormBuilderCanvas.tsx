import { Button } from "@/components/ui/button";
import FieldEditor from "./FieldEditor";
import type { EditableField, FieldType } from "../types";

const builderTypes: { value: FieldType; label: string }[] = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "radio", label: "Radio Group" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "file", label: "File Upload" },
  { value: "section", label: "Section Text" },
];

const FormBuilderCanvas = ({
  fields,
  onAdd,
  onChange,
  onDuplicate,
  onDelete,
  onReorder,
}: {
  fields: EditableField[];
  onAdd: (type: FieldType) => void;
  onChange: (field: EditableField) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (dragId: string, targetId: string) => void;
}) => {
  const handleDragStart = (localId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", localId);
  };

  const handleDrop = (targetId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    const sourceId = event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetId) {
      onReorder(sourceId, targetId);
    }
    event.preventDefault();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {builderTypes.map((type) => (
          <Button key={type.value} variant="outline" type="button" onClick={() => onAdd(type.value)}>
            {type.label}
          </Button>
        ))}
      </div>
      {fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Start by selecting a field type above.
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field) => (
            <FieldEditor
              key={field.localId}
              field={field}
              onChange={onChange}
              onDuplicate={() => onDuplicate(field.localId)}
              onDelete={() => onDelete(field.localId)}
              dragHandleProps={{
                draggable: true,
                onDragStart: handleDragStart(field.localId),
                onDragOver: (event) => event.preventDefault(),
                onDrop: handleDrop(field.localId),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FormBuilderCanvas;
