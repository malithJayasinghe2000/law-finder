'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inquirySchema, InquiryFormValues } from '@/schemas/inquiry.schema';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

interface InquiryDialogProps {
  lawyerId: string;
  lawyerName: string;
}

export default function InquiryDialog({ lawyerId, lawyerName }: InquiryDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { lawyerId },
  });

  const onSubmit = async (data: InquiryFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to submit inquiry.');

      setSuccess(true);
      toast.success('Inquiry sent successfully.');
      reset();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSuccess(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full gap-2 font-semibold">
          <Mail className="h-4 w-4" />
          Inquire Now
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact {lawyerName}</DialogTitle>
          <DialogDescription>
            Send a brief description of your legal matter. The lawyer will receive your contact details.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Inquiry Sent</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lawyerName} will review your inquiry and get back to you.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...register('lawyerId')} />

            <div className="space-y-2">
              <Label htmlFor="inquiry-name">Your Name</Label>
              <Input id="inquiry-name" placeholder="Full name" {...register('clientName')} />
              {errors.clientName && <p className="text-xs text-destructive">{errors.clientName.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inquiry-email">Email</Label>
                <Input id="inquiry-email" type="email" placeholder="you@email.com" {...register('clientEmail')} />
                {errors.clientEmail && <p className="text-xs text-destructive">{errors.clientEmail.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inquiry-phone">Phone</Label>
                <Input id="inquiry-phone" type="tel" placeholder="+94 77 123 4567" {...register('clientPhone')} />
                {errors.clientPhone && <p className="text-xs text-destructive">{errors.clientPhone.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inquiry-message">Describe your legal matter</Label>
              <Textarea
                id="inquiry-message"
                placeholder="Brief description of your issue..."
                rows={4}
                {...register('message')}
              />
              {errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2 font-semibold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {loading ? 'Sending...' : 'Send Inquiry'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
