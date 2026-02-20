import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    bucket?: string;
    className?: string;
}

export function ImageUpload({
    value,
    onChange,
    bucket = "events",
    className,
}: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        // Reuse the upload logic
        // We need to construct a synthetic event or extract the logic
        // For simplicity, let's just call the upload logic directly if we extract it, 
        // or we can just duplicate the validation/upload part here.
        // Let's refactor handleUpload to accept a File object.
        await uploadFile(file);
    };

    const uploadFile = async (file: File) => {
        try {
            setUploading(true);
            setError(null);

            // Validate file type
            if (!file.type.startsWith("image/")) {
                setError("Please upload an image file");
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError("Image size must be less than 5MB");
                return;
            }

            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
            onChange(data.publicUrl);
        } catch (err: any) {
            console.error("Error uploading image:", err);
            setError(err.message || "Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await uploadFile(file);
            event.target.value = "";
        }
    };

    const handleRemove = () => {
        onChange("");
    };

    return (
        <div className={cn("space-y-4", className)}>
            {value ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                    <img
                        src={value}
                        alt="Cover"
                        className="h-full w-full object-cover"
                    />
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute right-2 top-2 h-8 w-8"
                        onClick={handleRemove}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove image</span>
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-center w-full">
                    <label
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                            isDragging
                                ? "border-primary bg-primary/10"
                                : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                        )}
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploading ? (
                                <Loader2 className="w-10 h-10 mb-3 text-gray-400 animate-spin" />
                            ) : (
                                <ImagePlus className={cn("w-10 h-10 mb-3", isDragging ? "text-primary" : "text-gray-400")} />
                            )}
                            <p className={cn("mb-2 text-sm", isDragging ? "text-primary font-medium" : "text-gray-500")}>
                                <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className={cn("text-xs", isDragging ? "text-primary/80" : "text-gray-500")}>
                                SVG, PNG, JPG or GIF (MAX. 5MB)
                            </p>
                        </div>
                        <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>
            )}
            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}
