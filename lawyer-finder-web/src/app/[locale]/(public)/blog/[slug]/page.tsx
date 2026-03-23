import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          practiceAreas: true,
          district: true,
          isVerified: true,
        },
      },
    },
  });

  if (!article || article.status !== 'PUBLISHED') notFound();

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Back link */}
        <Link
          href={`/${locale}/blog`}
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Articles
        </Link>

        {/* Article header */}
        <article>
          <header className="mb-10">
            {article.author.practiceAreas[0] && (
              <Badge variant="secondary" className="mb-4">
                {article.author.practiceAreas[0]}
              </Badge>
            )}
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl leading-tight">
              {article.title}
            </h1>

            <Separator className="my-6" />

            {/* Author card */}
            <div className="flex items-center gap-4">
              <Link href={`/${locale}/lawyers/${article.author.id}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 text-primary font-bold">
                  {article.author.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${locale}/lawyers/${article.author.id}`}
                    className="font-semibold hover:text-primary transition-colors"
                  >
                    {article.author.fullName}
                  </Link>
                  {article.author.isVerified && (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(article.createdAt).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                  {article.author.district && (
                    <span className="ml-2">from {article.author.district}</span>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Article body */}
          <div className="prose prose-neutral max-w-none text-foreground leading-relaxed">
            {article.content.split('\n').map((paragraph, i) => (
              <p key={i} className="mb-4 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>

          <Separator className="my-10" />

          {/* Footer CTA */}
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <h3 className="text-lg font-semibold">Need legal assistance?</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Connect with {article.author.fullName} or browse our directory of verified Sri Lankan legal professionals.
              </p>
              <div className="flex gap-3">
                <Link href={`/${locale}/lawyers/${article.author.id}`}>
                  <Button className="gap-2 font-semibold">Contact Author</Button>
                </Link>
                <Link href={`/${locale}/lawyers`}>
                  <Button variant="outline">Browse Directory</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </article>
      </div>
    </div>
  );
}
