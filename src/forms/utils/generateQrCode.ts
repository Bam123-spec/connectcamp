import QRCode from "qrcode";

export async function generateFormQrDataUrl(targetUrl: string) {
  return QRCode.toDataURL(targetUrl, {
    type: "image/png",
    margin: 1,
    width: 512,
    errorCorrectionLevel: "H",
  });
}
