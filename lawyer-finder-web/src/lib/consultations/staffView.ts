/**
 * What platform staff see of a client's request: that it exists, at which
 * practice, and where it stands. Nothing more.
 *
 * Who consulted a law firm is itself confidential, and staff have no task that
 * needs it: support finds a request by its number. So no client name or email,
 * no attorney, no fee or payment, no cancel or refund reasons — those are the
 * practice's record of its own client (rules 2, 5 and 7). Before this the admin
 * list and the single-request API sent staff the whole row.
 */
export type StaffRequestView = {
  id: string;
  bookingNumber: string;
  status: string;
  firmName: string | null;
  createdAt: string;
};

export function staffRequestView(b: {
  id: string;
  bookingNumber: string;
  status: string;
  createdAt: Date;
  firm?: { name: string } | null;
}): StaffRequestView {
  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    status: b.status,
    firmName: b.firm?.name ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}
