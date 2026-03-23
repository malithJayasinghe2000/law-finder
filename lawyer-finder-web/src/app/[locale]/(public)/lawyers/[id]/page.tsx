import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, MapPin, Languages, Star, Briefcase, Clock, Mail,
} from 'lucide-react';
import InquiryDialog from '@/components/shared/InquiryDialog';

export default async function LawyerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { createdAt: true } },
      reviews: { where: { isApproved: true }, orderBy: { rating: 'desc' } },
    },
  });

  if (!lawyer) notFound();

  const avgRating =
    lawyer.reviews.length > 0
      ? lawyer.reviews.reduce((sum, r) => sum + r.rating, 0) / lawyer.reviews.length
      : 0;

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Profile header */}
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {/* Avatar */}
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary text-3xl font-bold border">
            {lawyer.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lawyer.fullName}</h1>
              {lawyer.isVerified && (
                <Badge className="gap-1" variant="default">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
              {lawyer.district && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {lawyer.district}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" />
                {lawyer.languages.join(', ')}
              </span>
              {lawyer.user?.createdAt && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Member since {new Date(lawyer.user.createdAt).getFullYear()}
                </span>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Briefcase className="h-4 w-4" />
                  About
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lawyer.bio || 'This attorney has not yet added a biography.'}
                </p>
              </CardContent>
            </Card>

            {/* Practice Areas */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">Practice Areas</h2>
                <div className="flex flex-wrap gap-2">
                  {lawyer.practiceAreas.length > 0 ? (
                    lawyer.practiceAreas.map((area) => (
                      <Badge key={area} variant="secondary" className="px-3 py-1">
                        {area}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No practice areas specified.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Star className="h-4 w-4" />
                  Client Reviews
                  {lawyer.reviews.length > 0 && (
                    <Badge variant="outline" className="ml-2 font-normal">
                      {avgRating.toFixed(1)} avg
                    </Badge>
                  )}
                </h2>

                {lawyer.reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviews yet.</p>
                ) : (
                  <div className="space-y-4">
                    {lawyer.reviews.map((review) => (
                      <div key={review.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{review.reviewerName}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Fee Card */}
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Consultation Fee Range</p>
                <p className="text-2xl font-bold">
                  {lawyer.baseFeeRange || 'Contact for pricing'}
                </p>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{lawyer.reviews.length}</p>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : '--'}</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <InquiryDialog lawyerId={lawyer.id} lawyerName={lawyer.fullName} />
          </div>
        </div>
      </div>
    </div>
  );
}
