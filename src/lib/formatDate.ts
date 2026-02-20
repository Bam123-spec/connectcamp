export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return "TBD";
    // Append T00:00:00 to ensure local time parsing for YYYY-MM-DD strings
    // or handle it as a date-only string
    const date = new Date(dateString.includes("T") ? dateString : `${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Invalid Date";

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

export function formatTime(dateString: string | null | undefined): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    }).format(date);
}
