const QRCodeDisplay = ({ url }: { url: string | null }) => {
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Generate a QR code after saving the form.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <img src={url} alt="Form QR code" className="h-48 w-48 rounded-lg border bg-white p-3 shadow-sm" />
      <p className="text-sm text-muted-foreground">Scan to open the form</p>
    </div>
  );
};

export default QRCodeDisplay;
