"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

interface StatCardProps {
  title: string
  value: string
  note: string
}

export function StatCard({ title, value, note }: StatCardProps) {
  const { palette } = useTheme()

  return (
    <Card className={cn("rounded-3xl border shadow-none", palette.panel)}>
      <CardHeader className="pb-2">
        <CardDescription className={palette.muted}>{title}</CardDescription>
        <CardTitle className={cn("text-2xl", palette.text)}>{value}</CardTitle>
      </CardHeader>
      <CardContent className={cn("text-sm", palette.subtext)}>{note}</CardContent>
    </Card>
  )
}
