/**
 * Shown where a licence screen used to be while licensing is off for launch
 * (src/lib/licensing.ts). Plain markup: rendered from server layouts and pages.
 */
export default function LicensingOff({ admin = false }: { admin?: boolean }) {
  return (
    <div className="max-w-xl border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-bold tracking-tight text-neutral-900">Licences are not sold yet</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        {admin
          ? 'Licence billing is switched off for launch, so there are no invoices, plans or ' +
            'subscriptions to manage. ' +
            'It comes back when LICENSING_ENABLED is set to true in src/lib/licensing.ts.'
          : 'The software is free to use for now, with as many colleagues as your practice needs. ' +
            'You will be told before that changes. There is nothing to pay.'}
      </p>
    </div>
  );
}
