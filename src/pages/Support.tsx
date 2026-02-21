import { useState } from "react";
import { Mail, BookOpen, Wrench, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_EMAIL = "support@connectcamp.io";

function Support() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("Connect Camp admin support request");
  const [details, setDetails] = useState("");

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      toast({
        title: "Copied",
        description: "Support email copied to your clipboard.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Please copy the support email manually.",
      });
    }
  };

  const handleEmailSupport = () => {
    const query = new URLSearchParams({
      subject,
      body: details || "Please describe your issue here.",
    });
    window.location.href = `mailto:${SUPPORT_EMAIL}?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Support Center</CardTitle>
          <CardDescription>
            Reach support quickly and use practical troubleshooting resources.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <p className="font-medium">Email support</p>
            </div>
            <p className="text-sm text-muted-foreground">{SUPPORT_EMAIL}</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleCopyEmail} variant="outline" size="sm">
                <Copy className="mr-1 h-4 w-4" />
                Copy
              </Button>
              <Button onClick={handleEmailSupport} size="sm">
                Open Email
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="font-medium">Knowledge base</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Best practices for clubs, events, and form management.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.open("https://supabase.com/docs", "_blank", "noopener,noreferrer")}
            >
              Open Docs
              <ExternalLink className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <p className="font-medium">Fast troubleshooting</p>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>1. Verify Supabase env variables are present.</li>
              <li>2. Confirm your account still has admin role.</li>
              <li>3. Retry after hard refresh (cache clear).</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit an issue</CardTitle>
          <CardDescription>
            Pre-fill a support email with issue details and reproduction steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="support-subject" className="text-sm font-medium">
              Subject
            </label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="support-details" className="text-sm font-medium">
              Issue details
            </label>
            <Textarea
              id="support-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={8}
              placeholder="What happened? What did you expect? Include page URL and steps."
            />
          </div>
          <Button onClick={handleEmailSupport}>
            Send to support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default Support;
