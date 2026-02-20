import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Copy, ExternalLink } from "lucide-react";
import { generateFormQr } from "@/utils/qr";
import { useToast } from "@/hooks/use-toast";

interface QrCodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    formId: string | null;
    formTitle: string;
    existingQrUrl: string | null;
}

export function QrCodeDialog({
    open,
    onOpenChange,
    formId,
    formTitle,
    existingQrUrl,
}: QrCodeDialogProps) {
    const [qrUrl, setQrUrl] = useState<string | null>(existingQrUrl);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (open && formId) {
            if (existingQrUrl) {
                setQrUrl(existingQrUrl);
            } else {
                generateQr();
            }
        } else {
            setQrUrl(null);
        }
    }, [open, formId, existingQrUrl]);

    const generateQr = async () => {
        if (!formId) return;
        setLoading(true);
        const result = await generateFormQr(formId);

        if (result.publicUrl) {
            setQrUrl(result.publicUrl);
        } else if (result.dataUrl) {
            setQrUrl(result.dataUrl);
            toast({
                title: "QR Generated (Local)",
                description: "Could not save to storage, but here is the code.",
                variant: "default",
            });
        } else {
            toast({
                title: "Error",
                description: "Failed to generate QR code.",
                variant: "destructive",
            });
        }
        setLoading(false);
    };

    const handleDownload = async () => {
        if (!qrUrl) return;
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `qrcode-${formTitle.replace(/\s+/g, "-").toLowerCase()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({
                title: "Download failed",
                description: "Could not download the QR code.",
                variant: "destructive",
            });
        }
    };

    const handleCopyLink = () => {
        if (!formId) return;
        const publicUrl = `${window.location.origin}/form-fill/${formId}`;
        navigator.clipboard.writeText(publicUrl);
        toast({
            title: "Link copied",
            description: "Public form URL copied to clipboard.",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>QR Code for {formTitle}</DialogTitle>
                    <DialogDescription>
                        Scan this code to access the form, or share the link directly.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center space-y-4 py-4">
                    {loading ? (
                        <div className="flex h-48 w-48 items-center justify-center rounded-lg border bg-muted/20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : qrUrl ? (
                        <div className="relative overflow-hidden rounded-lg border bg-white p-2">
                            <img
                                src={qrUrl}
                                alt={`QR Code for ${formTitle}`}
                                className="h-48 w-48 object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex h-48 w-48 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
                            Failed to load QR
                        </div>
                    )}

                    <div className="flex w-full gap-2">
                        <Button
                            className="flex-1"
                            variant="outline"
                            onClick={handleDownload}
                            disabled={!qrUrl || loading}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download PNG
                        </Button>
                        <Button
                            className="flex-1"
                            variant="outline"
                            onClick={handleCopyLink}
                            disabled={loading}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Link
                        </Button>
                    </div>

                    {formId && (
                        <Button
                            variant="link"
                            className="text-xs text-muted-foreground"
                            onClick={() => window.open(`/form-fill/${formId}`, "_blank")}
                        >
                            Open Public Page <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
