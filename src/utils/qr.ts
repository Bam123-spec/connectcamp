import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { saveQrCodeUrl } from "@/lib/formsDataApi";

export async function generateFormQr(formId: string): Promise<{ publicUrl: string | null; dataUrl: string }> {
    let qrDataUrl = "";
    try {
        // 1. Build URL
        const publicUrl = `${window.location.origin}/form-fill/${formId}`;

        // 2. Generate QR code as Data URL
        qrDataUrl = await QRCode.toDataURL(publicUrl, {
            width: 400,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#ffffff",
            },
        });

        // Convert Data URL to Blob
        const res = await fetch(qrDataUrl);
        const blob = await res.blob();

        // 3. Upload to Supabase Storage
        const fileName = `${formId}-${Date.now()}.png`;
        const buckets = ["form_qr_codes", "form-qr"];
        let storagePublicUrl: string | null = null;

        for (const bucket of buckets) {
            const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, blob, {
                contentType: "image/png",
                upsert: true,
            });

            if (uploadError) {
                continue;
            }

            const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
            storagePublicUrl = data.publicUrl;
            break;
        }

        if (!storagePublicUrl) {
            return { publicUrl: null, dataUrl: qrDataUrl };
        }

        try {
            await saveQrCodeUrl(formId, storagePublicUrl);
        } catch (persistError) {
            console.error("Error saving QR URL on form:", persistError);
        }

        return { publicUrl: storagePublicUrl, dataUrl: qrDataUrl };
    } catch (error) {
        console.error("Error generating QR code:", error);
        return { publicUrl: null, dataUrl: qrDataUrl };
    }
}
