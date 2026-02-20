"use client";
import * as React from "react";
import { Clock } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
    error?: boolean;
    className?: string;
    showCurrentTimeButton?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({
    value,
    onChange,
    disabled,
    error,
    className,
    showCurrentTimeButton = true,
}) => {
    const getDefaultTime = React.useCallback(() => {
        const now = new Date();
        let h = now.getHours();
        const m = now.getMinutes();
        const ap = h >= 12 ? "PM" : "AM";
        h = h % 12;
        if (h === 0) h = 12;
        return {
            hour: String(h).padStart(2, "0"),
            minute: String(m).padStart(2, "0"),
            amPm: ap,
        };
    }, []);

    const [hour, setHour] = React.useState<string>("");
    const [minute, setMinute] = React.useState<string>("");
    const [amPm, setAmPm] = React.useState<string>("AM");

    const handleSetCurrentTime = React.useCallback(() => {
        const def = getDefaultTime();
        setHour(def.hour);
        setMinute(def.minute);
        setAmPm(def.amPm);
        if (onChange) {
            const newValue = `${def.hour}:${def.minute} ${def.amPm}`;
            onChange(newValue);
        }
    }, [getDefaultTime, onChange]);

    React.useEffect(() => {
        if (!value) {
            // Don't set default time automatically on mount if value is empty, 
            // let the user choose or click "current time".
            // But if we want to show placeholders, we leave state empty.
        } else if (
            typeof value === "string" &&
            value.match(/^\d{1,2}:\d{2} (AM|PM)$/)
        ) {
            const [hm, ap] = value.split(" ");
            const [h, m] = hm.split(":");
            setHour(h);
            setMinute(m);
            setAmPm(ap);
        }
    }, [value]);

    const handleChange = React.useCallback(
        (h: string, m: string, ap: string) => {
            setHour(h);
            setMinute(m);
            setAmPm(ap);
            if (h && m && ap && onChange) {
                const newValue = `${h}:${m} ${ap}`;
                if (newValue !== value) {
                    onChange(newValue);
                }
            }
        },
        [onChange, value]
    );

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div
                className={cn(
                    "flex items-center rounded-lg border bg-background p-0.5 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    error && "border-destructive"
                )}
            >
                <Select
                    disabled={disabled}
                    onValueChange={(val) => handleChange(val, minute, amPm)}
                    value={hour}
                >
                    <SelectTrigger
                        className="h-8 w-[64px] border-0 shadow-none focus:ring-0 px-2 text-center justify-center bg-transparent"
                        size="sm"
                    >
                        <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="min-w-[64px]">
                        {Array.from({ length: 12 }, (_, i) =>
                            String(i + 1).padStart(2, "0")
                        ).map((h) => (
                            <SelectItem key={h} value={h} className="justify-center">
                                {h}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <span className="text-muted-foreground text-sm font-medium select-none">:</span>

                <Select
                    disabled={disabled}
                    onValueChange={(val) => handleChange(hour, val, amPm)}
                    value={minute}
                >
                    <SelectTrigger
                        className="h-8 w-[64px] border-0 shadow-none focus:ring-0 px-2 text-center justify-center bg-transparent"
                        size="sm"
                    >
                        <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="min-w-[64px]">
                        {Array.from({ length: 60 }, (_, i) =>
                            String(i).padStart(2, "0")
                        ).map((m) => (
                            <SelectItem key={m} value={m} className="justify-center">
                                {m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Select
                    disabled={disabled}
                    onValueChange={(val) => handleChange(hour, minute, val)}
                    value={amPm}
                >
                    <SelectTrigger
                        className="h-8 w-[70px] border-0 shadow-none focus:ring-0 px-2 text-center justify-center bg-muted/50 hover:bg-muted text-xs font-medium rounded-md mr-0.5"
                        size="sm"
                    >
                        <SelectValue placeholder="AM/PM" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="min-w-[70px]">
                        <SelectItem value="AM" className="justify-center">AM</SelectItem>
                        <SelectItem value="PM" className="justify-center">PM</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {showCurrentTimeButton && (
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={handleSetCurrentTime}
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                    title="Set to current time"
                    type="button"
                >
                    <Clock className="h-4 w-4" />
                    <span className="sr-only">Set current time</span>
                </Button>
            )}
        </div>
    );
};
