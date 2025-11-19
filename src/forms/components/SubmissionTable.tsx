import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FormSubmissionRecord } from "../types";

type SubmissionTableProps = {
  submissions: FormSubmissionRecord[];
};

const SubmissionTable = ({ submissions }: SubmissionTableProps) => {
  const downloadJson = (submission: FormSubmissionRecord) => {
    const blob = new Blob([JSON.stringify(submission.values, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${submission.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const rows: string[] = [];
    submissions.forEach((submission) => {
      const entry: Record<string, string> = {
        id: submission.id,
        submitted_at: submission.submitted_at,
      };
      Object.values(submission.values).forEach((value, index) => {
        entry[`field_${index + 1}`] = Array.isArray(value.value) ? value.value.join(", ") : String(value.value);
      });
      rows.push(
        Object.keys(entry)
          .map((key) => `"${entry[key].replace(/"/g, '""')}"`)
          .join(","),
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `form-submissions.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={downloadCsv} disabled={submissions.length === 0}>
          Download CSV
        </Button>
      </div>
      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submission</TableHead>
              <TableHead>Values</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell>
                  <p className="font-medium">{new Date(submission.submitted_at).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{submission.id}</p>
                </TableCell>
                <TableCell>
                  <div className="space-y-2 text-sm">
                    {Object.entries(submission.values).map(([fieldId, value]) => (
                      <div key={fieldId}>
                        <p className="font-medium">{value.label}</p>
                        <p className="text-muted-foreground">
                          {Array.isArray(value.value) ? value.value.join(", ") : String(value.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => downloadJson(submission)}>
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default SubmissionTable;
