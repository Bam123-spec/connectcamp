import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function Settings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure the Connect Camp workspace and email notifications.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="org" className="text-sm font-medium">
              Organization name
            </label>
            <Input id="org" defaultValue="Connect Camp" />
          </div>
          <div className="space-y-2">
            <label htmlFor="reply" className="text-sm font-medium">
              Reply-to email
            </label>
            <Input id="reply" defaultValue="info@connectcamp.io" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="webhook" className="text-sm font-medium">
              Supabase webhook URL
            </label>
            <Input
              id="webhook"
              placeholder="https://ahvivjsmhbwbjthtiudt.supabase.co/functions/v1/sync"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button>Save preferences</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alerting</CardTitle>
          <p className="text-sm text-muted-foreground">
            Decide which updates should trigger alerts to the Connect Camp team.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "New officer requests", description: "Notify when a club submits new officer paperwork." },
            { label: "Budget approvals", description: "Alert when spending requires your approval." },
            { label: "Event escalations", description: "Send push notifications for risk flagged events." },
          ].map((item) => (
            <label
              key={item.label}
              className="flex items-start gap-3 rounded-lg border bg-background/70 p-4"
            >
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
              />
              <span>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
