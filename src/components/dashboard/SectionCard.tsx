import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionCardProps {
    title?: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
    action?: ReactNode;
}

export function SectionCard({
    title,
    subtitle,
    children,
    className,
    action,
}: SectionCardProps) {
    return (
        <div
            className={cn(
                "flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md",
                className
            )}
        >
            {(title || subtitle || action) && (
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div className="space-y-1">
                        {title && (
                            <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-sm text-gray-500">{subtitle}</p>
                        )}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className="p-6">{children}</div>
        </div>
    );
}
