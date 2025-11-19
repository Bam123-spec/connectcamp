import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createFormRecord, insertFormFields, uploadQrImage, saveQrCode } from "./api";
import { generateFormQrDataUrl } from "./utils/generateQrCode";
import FormBuilderCanvas from "./components/FormBuilderCanvas";
import type { EditableField, FieldType } from "./types";
import { useAuth } from "@/context/AuthContext";

const CreateForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<EditableField[]>([]);
  const [saving, setSaving] = useState(false);

  const addField = (type: FieldType) => {
    const id = crypto.randomUUID();
    setFields((prev) => [
      ...prev,
      {
        id,
        localId: id,
        form_id: "",
        type,
        label: type === "section" ? "" : "Untitled question",
        description: "",
        required: false,
        options: ["dropdown", "checkbox", "radio"].includes(type) ? [] : null,
        order_index: prev.length,
      },
    ]);
  };

  const updateField = (next: EditableField) => {
    setFields((prev) => prev.map((field) => (field.localId === next.localId ? next : field)));
  };

  const duplicateField = (id: string) => {
    setFields((prev) => {
      const target = prev.find((field) => field.localId === id);
      if (!target) return prev;
      const clone = { ...target, localId: crypto.randomUUID(), id: crypto.randomUUID(), order_index: prev.length };
      return [...prev, clone];
    });
  };

  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((field) => field.localId !== id).map((field, index) => ({ ...field, order_index: index })));
  };

  const reorderField = (sourceId: string, targetId: string) => {
    setFields((prev) => {
      const sourceIndex = prev.findIndex((field) => field.localId === sourceId);
      const targetIndex = prev.findIndex((field) => field.localId === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated.map((field, index) => ({ ...field, order_index: index }));
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please provide a form title." });
      return;
    }
    setSaving(true);
    try {
      const form = await createFormRecord({
        title: title.trim(),
        description: description.trim(),
        createdBy: session?.user?.id ?? null,
      });
      await insertFormFields(
        form.id,
        fields.map((field, index) => ({
          ...field,
          form_id: form.id,
          order_index: index,
        })),
      );
      const formLink = `${window.location.origin}/form-fill/${form.id}`;
      const dataUrl = await generateFormQrDataUrl(formLink);
      const blob = dataUrlToBlob(dataUrl);
      if (blob) {
        const qrUrl = await uploadQrImage(form.id, blob);
        if (qrUrl) {
          await saveQrCode(form.id, qrUrl);
        }
      }
      toast({ title: "Form created", description: "Your form is ready." });
      navigate(`/forms/${form.id}`);
    } catch (error) {
      toast({ title: "Unable to create form", description: error instanceof Error ? error.message : "Unknown error." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Create Form</h1>
          <p className="text-sm text-muted-foreground">Drop in questions and publish instantly.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Form"}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Form details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Form title" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share context with club members"
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <FormBuilderCanvas
            fields={fields}
            onAdd={addField}
            onChange={updateField}
            onDuplicate={duplicateField}
            onDelete={deleteField}
            onReorder={reorderField}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateForm;

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  const [, mime, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
