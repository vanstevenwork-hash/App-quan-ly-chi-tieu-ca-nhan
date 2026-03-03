'use client';
import React from 'react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}

export default function ChartCard({ title, subtitle, children, className, action }: ChartCardProps) {
    return (
        <div className={cn(
            'bg-card rounded-3xl p-5 shadow-card border border-border/50',
            className
        )}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    {subtitle && <p className="text-muted-foreground text-xs mt-0.5">{subtitle}</p>}
                </div>
                {action && <div>{action}</div>}
            </div>
            {children}
        </div>
    );
}
