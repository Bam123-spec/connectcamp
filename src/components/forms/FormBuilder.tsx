import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";
import {
    Trash2,
    ArrowUp,
    ArrowDown,
    Plus,
    Copy,
} from "lucide-react";
import type { FormField, FormFieldType } from "@/types/forms";

interface FormBuilderProps {
    fields: FormField[];
    onChange: (fields: FormField[]) => void;
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
    { value: "short_text", label: "Short Text" },
    { value: "long_text", label: "Long Text" },
    { value: "number", label: "Number" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkboxes", label: "Checkboxes" },
    { value: "radio", label: "Radio Group" },
    { value: "date", label: "Date" },
    { value: "time", label: "Time" },
    { value: "file", label: "File Upload" },
    { value: "section", label: "Section Header" },
];

export function FormBuilder({ fields, onChange }: FormBuilderProps) {
    const addField = (type: FormFieldType) => {
        const newField: FormField = {
            id: crypto.randomUUID(),
            form_id: "", // Will be set by parent or backend
            type,
            label: type === "section" ? "New Section" : "New Question",
            description: "",
            options: ["Option 1", "Option 2"],
            order: fields.length,
        };
        onChange([...fields, newField]);
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        onChange(
            fields.map((f) => (f.id === id ? { ...f, ...updates } : f))
        );
    };

    const removeField = (id: string) => {
        onChange(fields.filter((f) => f.id !== id));
    };

    const moveField = (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === fields.length - 1)
        ) {
            return;
        }

        const newFields = [...fields];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        [newFields[index], newFields[targetIndex]] = [
            newFields[targetIndex],
            newFields[index],
        ];

        // Update order property
        newFields.forEach((f, i) => (f.order = i));

        onChange(newFields);
    };

    const duplicateField = (field: FormField) => {
        const newField = {
            ...field,
            id: crypto.randomUUID(),
            label: `${field.label} (Copy)`,
            order: fields.length,
        };
        onChange([...fields, newField]);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <FieldCard
                        key={field.id}
                        field={field}
                        index={index}
                        isFirst={index === 0}
                        isLast={index === fields.length - 1}
                        onUpdate={(updates) => updateField(field.id, updates)}
                        onRemove={() => removeField(field.id)}
                        onMove={(dir) => moveField(index, dir)}
                        onDuplicate={() => duplicateField(field)}
                    />
                ))}

                {fields.length === 0 && (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                        No fields added yet. Click a button below to start building.
                    </div>
                )}
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
                <Label className="mb-3 block text-sm font-medium">Add Field</Label>
                <div className="flex flex-wrap gap-2">
                    {FIELD_TYPES.map((type) => (
                        <Button
                            key={type.value}
                            variant="outline"
                            size="sm"
                            onClick={() => addField(type.value)}
                            className="bg-background"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {type.label}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}

interface FieldCardProps {
    field: FormField;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onUpdate: (updates: Partial<FormField>) => void;
    onRemove: () => void;
    onMove: (dir: "up" | "down") => void;
    onDuplicate: () => void;
}

function FieldCard({
    field,
    index,
    isFirst,
    isLast,
    onUpdate,
    onRemove,
    onMove,
    onDuplicate,
}: FieldCardProps) {
    const hasOptions = ["dropdown", "checkboxes", "radio"].includes(field.type);

    const addOption = () => {
        const currentOptions = field.options || [];
        onUpdate({
            options: [...currentOptions, `Option ${currentOptions.length + 1}`],
        });
    };

    const updateOption = (optIndex: number, value: string) => {
        const currentOptions = field.options || [];
        const newOptions = [...currentOptions];
        newOptions[optIndex] = value;
        onUpdate({ options: newOptions });
    };

    const removeOption = (optIndex: number) => {
        const currentOptions = field.options || [];
        onUpdate({
            options: currentOptions.filter((_, i) => i !== optIndex),
        });
    };

    return (
        <Card className="relative group transition-all hover:border-primary/50">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4 pb-2">
                <div className="mt-1 flex flex-col gap-1 text-muted-foreground">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isFirst}
                        onClick={() => onMove("up")}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <div className="flex h-6 w-6 items-center justify-center">
                        <span className="text-xs font-mono">{index + 1}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isLast}
                        onClick={() => onMove("down")}
                    >
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                            <Input
                                value={field.label}
                                onChange={(e) => onUpdate({ label: e.target.value })}
                                className="font-medium"
                                placeholder="Question Label"
                            />
                            <Input
                                value={field.description || ""}
                                onChange={(e) => onUpdate({ description: e.target.value })}
                                className="text-sm text-muted-foreground"
                                placeholder="Description (optional)"
                            />
                        </div>
                        <Select
                            value={field.type}
                            onValueChange={(val) => onUpdate({ type: val as FormFieldType })}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {FIELD_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {hasOptions && (
                        <div className="space-y-2 rounded-md bg-muted/30 p-3">
                            <Label className="text-xs font-medium uppercase text-muted-foreground">
                                Options
                            </Label>
                            <div className="space-y-2">
                                {field.options?.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                                        <Input
                                            value={opt}
                                            onChange={(e) => updateOption(i, e.target.value)}
                                            className="h-8"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeOption(i)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addOption}
                                    className="mt-2 h-8 text-xs"
                                >
                                    <Plus className="mr-2 h-3 w-3" /> Add Option
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardFooter className="flex justify-end gap-2 p-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDuplicate}
                    title="Duplicate"
                >
                    <Copy className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={onRemove}
                    title="Delete"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    );
}
