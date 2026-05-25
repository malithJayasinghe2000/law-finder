'use client';

import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <Card className="mx-auto w-full max-w-md border-none shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl">
        <CardContent className="flex flex-col items-center gap-6 pt-10 pb-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#0a0d14]">Something went wrong</h2>
            <p className="mt-2 text-sm text-neutral-500 font-light leading-relaxed">
              An unexpected error occurred. Please try again or return to the homepage.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={reset} className="gap-2 rounded-full px-6 font-semibold">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Link href="/">
              <Button className="gap-2 rounded-full px-6 bg-[#0d1017] hover:bg-[#1a1f2e] font-semibold">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
