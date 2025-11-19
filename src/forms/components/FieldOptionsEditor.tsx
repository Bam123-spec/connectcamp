import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FieldOptionsEditorProps = {
  value: string[];
  onChange: (next: string[]) => void;
};

const FieldOptionsEditor = ({ value, onChange }: FieldOptionsEditorProps) => {
  const [draft, setDraft] = useState("");

  const addOption = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setDraft("");
  };

  const updateOption = (index: number, nextValue: string) => {
    const copy = [...value];
    copy[index] = nextValue;
    onChange(copy);
  };

  const removeOption = (index: number) => {
    const copy = [...value];
    copy.splice(index, 1);
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      {value.map((option, index) => (
        <div key={`${option}-${index}`} className="flex items-center gap-2">
          <Input value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Option ${index + 1}`} />
          <Button variant="ghost" type="button" onClick={() => removeOption(index)}>
            Remove
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add option" />
        <Button type="button" onClick={addOption}>
          Add
        </Button>
      </div>
    </div>
  );
};

export default FieldOptionsEditor;
