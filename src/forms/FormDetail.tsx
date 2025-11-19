import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchForm, fetchFormFields, fetchSubmissions } from "./api";
import QRCodeDisplay from "./components/QRCodeDisplay";
import FormFieldCard from "./components/FormFieldCard";
import type { FormFieldRecord, FormRecord } from "./types";

const FormDetail = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<FormRecord | null>(null);
  const [fields, setFields] = useState<FormFieldRecord[]>([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [formData, fieldData, submissions] = await Promise.all([
          fetchForm(formId),
          fetchFormFields(formId),
          fetchSubmissions(formId),
        ]);
        if (!active) return;
        setForm(formData);
        setFields(fieldData);
        setSubmissionCount(submissions.length);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load form.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [formId]);

  const formLink =
    formId && typeof window !== "undefined" ? `${window.location.origin}/form-fill/${formId}` : `/form-fill/${formId ?? ""}`;

  const copyLink = () => {
    if (!formLink) return;
    navigator.clipboard.writeText(formLink);
    toast({ title: "Link copied", description: "Form link copied to clipboard." });
  };

  const downloadQr = async () => {
    if (!form?.qr_url) return;
    const response = await fetch(form.qr_url);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${form.title.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  if (error || !form) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error ?? "Form not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Form detail</p>
          <h1 className="text-2xl font-semibold">{form.title}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate(`/forms/${form.id}/submissions`)}>
            View Submissions
          </Button>
          <Button variant="outline" onClick={copyLink}>
            Copy Link
          </Button>
          <Button onClick={() => navigate("/forms/create")}>Create New</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Description</p>
            <p>{form.description || "No description provided."}</p>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Submissions</p>
              <p className="text-2xl font-semibold">{submissionCount}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <QRCodeDisplay url={form.qr_url} />
            <div className="flex gap-3">
              <Button variant="outline" onClick={copyLink}>
                Copy Form Link
              </Button>
              <Button onClick={downloadQr} disabled={!form.qr_url}>
                Download QR
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fields configured.</p>
          ) : (
            fields.map((field) => <FormFieldCard key={field.id} field={field} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FormDetail;
