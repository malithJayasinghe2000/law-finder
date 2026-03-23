import prisma from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { BookOpen, Clock, User } from 'lucide-react';

export const metadata = { title: 'Legal Insights' };

export default async function BlogListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    include: { author: { select: { fullName: true, practiceAreas: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-12 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Legal Insights</h1>
          <p className="mt-3 text-muted-foreground">
            Expert articles and guidance from verified Sri Lankan attorneys
          </p>
        </div>

        {articles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <h3 className="text-lg font-semibold">No articles yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Legal experts are preparing insightful content. Check back soon.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link key={article.id} href={`/${locale}/blog/${article.slug}`}>
                <Card className="group h-full hover:shadow-lg transition-all duration-300 hover:border-primary/20 cursor-pointer overflow-hidden">
                  {/* Colored top strip */}
                  <div className="h-1 bg-primary" />
                  <CardContent className="p-6">
                    {article.author.practiceAreas[0] && (
                      <Badge variant="secondary" className="mb-3 text-xs font-normal">
                        {article.author.practiceAreas[0]}
                      </Badge>
                    )}
                    <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                      {article.content.substring(0, 150)}...
                    </p>
                    <div className="mt-5 flex items-center gap-4 pt-4 border-t">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 text-primary text-xs font-bold">
                        {article.author.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{article.author.fullName}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(article.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
