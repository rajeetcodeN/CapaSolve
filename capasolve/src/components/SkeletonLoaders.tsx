import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded-md animate-shimmer" />
          <div className="h-4 w-72 bg-muted rounded-md animate-shimmer" />
        </div>
        <div className="h-10 w-32 bg-muted rounded-md animate-shimmer" />
      </div>

      {/* KPI grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border/40">
            <CardContent className="pt-6 space-y-3">
              <div className="h-3 w-24 bg-muted rounded animate-shimmer" />
              <div className="h-8 w-16 bg-muted rounded animate-shimmer" />
              <div className="h-3 w-32 bg-muted rounded animate-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards grid skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border border-border/40 h-48">
            <CardHeader className="space-y-2">
              <div className="h-5 w-36 bg-muted rounded animate-shimmer" />
              <div className="h-3 w-full bg-muted rounded animate-shimmer" />
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-9 w-28 bg-muted rounded animate-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse border border-border/60 rounded-xl p-4 bg-card">
      <div className="h-10 w-full bg-muted/60 rounded-md animate-shimmer mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="h-8 w-24 bg-muted rounded animate-shimmer" />
          <div className="h-8 flex-1 bg-muted rounded animate-shimmer" />
          <div className="h-8 w-20 bg-muted rounded animate-shimmer" />
          <div className="h-8 w-16 bg-muted rounded animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function GanttSkeleton() {
  return (
    <div className="space-y-4 animate-pulse border border-border/60 rounded-xl p-6 bg-card">
      <div className="h-8 w-64 bg-muted rounded animate-shimmer mb-6" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-24 h-12 bg-muted rounded animate-shimmer" />
          <div className="flex-1 h-12 bg-muted/40 rounded flex items-center px-4 gap-2">
            <div className="h-8 w-1/3 bg-muted rounded animate-shimmer" />
            <div className="h-8 w-1/4 bg-muted rounded animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
