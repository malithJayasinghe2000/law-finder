/**
 * Contact details shown in the public footer — edit them here, in one place.
 *
 * Anything left `null` is simply not shown. The footer used to carry made-up
 * details (two invented offices, a placeholder phone number, social icons that
 * linked to "#"); an empty field is better than a false one.
 */
export const SITE_CONTACT = {
  /** Shown as "Send Email". */
  email: 'hello@thelawyr.lk' as string | null,
  /** Shown as "Call Now", e.g. '+94 11 234 5678'. Hidden while null. */
  phone: null as string | null,
  company: {
    name: 'FiveNeurals',
    /** One sentence, in the company's own words (from fiveneurals.com). Hidden while null. */
    description: 'An AI and software engineering studio based in Sri Lanka.' as string | null,
    /** The company's own website. Hidden while null. */
    url: 'https://www.fiveneurals.com/' as string | null,
    /** One line, e.g. '12 Main Street, Colombo 03'. Hidden while null. */
    address: null as string | null,
  },
  /** Each icon appears only once its address is filled in. */
  social: {
    facebook: null as string | null,
    youtube: null as string | null,
    instagram: null as string | null,
    x: null as string | null,
  },
};
