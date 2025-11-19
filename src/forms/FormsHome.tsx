import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { listForms, deleteForm, fetchSubmissions } from "./api";
import type { FormRecord } from "./types";

const FormsHome = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadForms = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listForms();
      setForms(list);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load forms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const handleDelete = async (formId: string) => {
    if (!confirm("Delete this form? This cannot be undone.")) return;
    await deleteForm(formId);
    loadForms();
  };

  const buildShareUrl = (formId: string) =>
    typeof window === "undefined" ? `/form-fill/${formId}` : `${window.location.origin}/form-fill/${formId}`;

  const openShareLink = (formId: string) => {
    const url = buildShareUrl(formId);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyShareLink = (formId: string) => {
    const url = buildShareUrl(formId);
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Forms</h1>
          <p className="text-sm text-muted-foreground">Build and manage student forms.</p>
        </div>
        <Button className="rounded-full" onClick={() => navigate("/forms/create")}>
          Create Form
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Form Library</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <Skeleton className="h-52 w-full rounded-xl" />
          ) : forms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No forms yet. Create your first form.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">{form.title}</TableCell>
                    <TableCell>{new Date(form.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {form.is_active === false ? "Inactive" : "Active"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <FormSubmissionCount formId={form.id} />
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}`)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}/submissions`)}>
                        Submissions
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openShareLink(form.id)}>
                        Share
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copyShareLink(form.id)}>
                        Copy Link
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(form.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const FormSubmissionCount = ({ formId }: { formId: string }) => {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const submissions = await fetchSubmissions(formId);
      if (active) setCount(submissions.length);
    };
    load();
    return () => {
      active = false;
    };
  }, [formId]);

  if (count === null) return <span className="text-muted-foreground">Loading...</span>;
  return <span>{count}</span>;
};

export default FormsHome;
