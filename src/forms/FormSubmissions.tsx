import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SubmissionTable from "./components/SubmissionTable";
import { fetchForm, fetchSubmissions } from "./api";
import type { FormRecord, FormSubmissionRecord } from "./types";

const FormSubmissions = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormRecord | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [formData, submissionData] = await Promise.all([fetchForm(formId), fetchSubmissions(formId)]);
        if (!active) return;
        setForm(formData);
        setSubmissions(submissionData);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load submissions.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [formId]);

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
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
          <p className="text-sm text-muted-foreground">Submissions</p>
          <h1 className="text-2xl font-semibold">{form.title}</h1>
        </div>
        <Button variant="outline" onClick={() => navigate(`/forms/${form.id}`)}>
          Back to form
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <SubmissionTable submissions={submissions} />
        </CardContent>
      </Card>
    </div>
  );
};

export default FormSubmissions;
