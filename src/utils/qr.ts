import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";

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
        const { error: uploadError } = await supabase.storage
            .from("form_qr_codes")
            .upload(fileName, blob, {
                contentType: "image/png",
                upsert: true,
            });

        if (uploadError) {
            console.error("Error uploading QR code:", uploadError);
            return { publicUrl: null, dataUrl: qrDataUrl };
        }

        // 4. Get Public URL
        const { data } = supabase.storage.from("form_qr_codes").getPublicUrl(fileName);
        const storagePublicUrl = data.publicUrl;

        // 5. Update forms table
        const { error: updateError } = await supabase
            .from("forms")
            .update({ qr_code_url: storagePublicUrl })
            .eq("id", formId);

        if (updateError) {
            console.error("Error updating form with QR code:", updateError);
        }

        return { publicUrl: storagePublicUrl, dataUrl: qrDataUrl };
    } catch (error) {
        console.error("Error generating QR code:", error);
        return { publicUrl: null, dataUrl: qrDataUrl };
    }
}
