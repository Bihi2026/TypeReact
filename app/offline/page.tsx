"use client";

import Link from "next/link";
import { Bookmark, Home, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader className="flex flex-col items-center space-y-3 pb-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <WifiOff className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            You are currently offline
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            TypeReact requires an internet connection to fetch real-time discussions, evidence, and updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            When connection is restored, you can continue analyzing claims and participating in debates.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 size-4" />
            Try Again
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">
              <Home className="mr-2 size-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/saved">
              <Bookmark className="mr-2 size-4" />
              Saved
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
