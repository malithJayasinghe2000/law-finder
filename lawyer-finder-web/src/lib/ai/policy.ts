/**
 * What the AI may say, what it must refuse, and what it must cite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the only file that decides whether an AI answer reaches a user. Do not
 * re-implement any of it inline in a route, a component, or the RAG service.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The rule in one sentence: **the assistant may explain the law; it may never
 * advise anyone about their own case.**
 *
 * Why it is this strict. Giving legal advice without being an admitted
 * Attorney-at-Law is unauthorised practice. Worse, BASL's cautionary note of
 * June 2021 treats providing legal advice through an online platform as
 * *touting* — which lands in the Intermeddlers with Suitors Ordinance No. 11 of
 * 1894, where the offence is criminal and reaches the intermediary. That is us.
 *
 * Every other guardrail in this codebase is enforced by structure: there is no
 * commission column, an `AdCampaign` has nowhere to attach a lawyer, directory
 * ad placements are not expressible in the enum. The AI is the one surface where
 * a violation is produced at runtime, per answer, by a generative model. Schema
 * cannot prevent it. This file is what stands in its place, and it runs on the
 * server, after generation and before the user sees a single character.
 *
 * The three things it does:
 *
 *   1. Refuses the question, before any model is called, when what is being
 *      asked for is advice on the asker's own matter.
 *   2. Refuses the answer, after generation, when the model produced advice
 *      anyway, tried to steer the user toward a practitioner, or cited a source
 *      that was never retrieved.
 *   3. Withholds any answer that cannot be traced to a legal document we
 *      actually hold.
 *
 * Rule 2 is why generation is not streamed. A streamed answer has been read by
 * the time it can be checked.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 6) and
 * docs/restructure/HOW-IT-WORKS.md part 2.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** A retrieval hit as the RAG service reports it. Not model-generated. */
export type AiSource = {
  documentName: string;
  documentType: string;
  section: string;
  part: string;
  chapter: string;
  status: string;
  lastUpdatedYear: string | number;
  relevanceScore: number;
  /** The ingested file this chunk came from, used to resolve to the library. */
  sourceFile?: string;
};

/**
 * A citation we are willing to show.
 *
 * `libraryDocumentId` is the difference between a citation a person can open and
 * a citation they must take on trust. Where it is set, the UI links to it.
 */
export type ResolvedCitation = {
  documentName: string;
  documentType: string;
  section: string | null;
  part: string | null;
  status: string;
  lastUpdatedYear: string | number;
  libraryDocumentId: string | null;
};

export type RefusalCategory =
  | 'OWN_MATTER_ADVICE'
  | 'OUTCOME_PREDICTION'
  | 'DOCUMENT_DECISION'
  | 'REPRESENTATION_REQUEST'
  | 'NO_CITABLE_SOURCE'
  | 'ADVICE_IN_ANSWER'
  | 'PRACTITIONER_STEERING'
  | 'UNSUPPORTED_CITATION';

export type RequestRuling =
  | { allowed: true }
  | { allowed: false; category: RefusalCategory; message: string };

export type AnswerRuling =
  | { outcome: 'PUBLISH'; citations: ResolvedCitation[] }
  | { outcome: 'REFUSE'; category: RefusalCategory; message: string; detail: string };

// ─── What the assistant says when it will not answer ─────────────────────────

/**
 * Refusals are written to be useful, not defensive.
 *
 * A refusal that only says "I can't help with that" teaches a user to rephrase
 * until they get past it, which is the opposite of what we want. Each of these
 * says what it cannot do, why, and what it *can* do instead — so the honest way
 * forward is easier than the workaround.
 *
 * None of them names an attorney or a firm. Pointing a person who has just
 * described their legal problem at a particular practitioner is the exact act
 * the 1894 Ordinance describes, and it does not become acceptable because a
 * model said it rather than a salesperson.
 */
export const REFUSAL_MESSAGES: Record<RefusalCategory, string> = {
  OWN_MATTER_ADVICE:
    'I can explain what the law says, but I cannot advise you on your own situation — ' +
    'that is legal advice, and it can only come from an attorney-at-law who has taken you on as a client ' +
    'and knows the full facts.\n\n' +
    'What I can do is answer the general question underneath it. For example, instead of ' +
    '*"what should I do about my landlord"*, try *"what does Sri Lankan law say about a landlord ending a tenancy"*.\n\n' +
    'If you want advice on your actual matter, you can browse practices in the directory and approach one yourself.',

  OUTCOME_PREDICTION:
    'I cannot tell you how a case would turn out. Nobody can — an outcome depends on evidence, procedure, ' +
    'and findings of fact that no assistant can see, and a confident guess from me could cost you a great deal.\n\n' +
    'I can explain what the law provides, what a court considers, or how a procedure works. ' +
    'For an assessment of your own position, you need an attorney-at-law who can look at the papers.',

  DOCUMENT_DECISION:
    'I cannot tell you whether to sign, accept, or agree to something. Reviewing a document against your ' +
    'interests is legal work, and doing it badly is worse than not doing it at all.\n\n' +
    'I can explain what a type of agreement usually contains, or what the law requires of one. ' +
    'Before you sign anything that matters, have an attorney-at-law read it.',

  REPRESENTATION_REQUEST:
    'I do not choose attorneys or firms, and I will not suggest one to you — not by name, not by type, ' +
    'and not based on what you have told me. The choice has to be yours, made from neutral information.\n\n' +
    'You can browse every verified practice and practitioner in the directory. It is listed alphabetically, ' +
    'position in it cannot be bought, and nothing you say to me affects what you see there.',

  NO_CITABLE_SOURCE:
    'I could not find this in the legislation I hold, so I am not going to answer it.\n\n' +
    'I only answer from Sri Lankan legal documents I can cite and you can open. Where I have nothing to point ' +
    'to, an answer from me would be an opinion dressed as law, which is exactly what you should not rely on. ' +
    'An attorney-at-law can help with material outside my library.',

  ADVICE_IN_ANSWER:
    'I started to answer this, but the answer strayed into advising you about your own situation, ' +
    'so I have withheld it.\n\n' +
    'Try asking the general legal question instead — what the law says, what a procedure involves, ' +
    'what a term means — and I can help with that.',

  PRACTITIONER_STEERING:
    'I withheld that answer because it began steering you toward a particular kind of practitioner.\n\n' +
    'Choosing who advises you is your decision, not mine. The directory lists every verified practice ' +
    'alphabetically if you want to look.',

  UNSUPPORTED_CITATION:
    'I withheld that answer because it referred to legislation I had not actually retrieved, ' +
    'which means I could not stand behind the citation.\n\n' +
    'A wrong section number in a legal answer is worse than no answer. Try asking more specifically, ' +
    'and name the Act if you know it.',
};

// ─── 1. Refusing the question ────────────────────────────────────────────────

/**
 * Asking for a decision about the asker's own matter.
 *
 * These are matched on the *shape of the request*, not on topic. "What does the
 * Motor Traffic Act say about drink-driving penalties" is a question about the
 * law and is answered. "I was caught drink-driving, what should I do" is a
 * request for advice and is refused, even though the underlying law is identical.
 *
 * The test in HOW-IT-WORKS.md: is the answer about the law, or about them?
 */
const OWN_MATTER_PATTERNS: RegExp[] = [
  /\bwhat\s+(?:should|shall|ought|do|can|could|must)\s+i\s+do\b/i,
  /\bwhat\s+(?:are|is)\s+my\s+(?:option|choice|right|next step|best|remedie|recourse)/i,
  /\bwhat\s+would\s+you\s+do\b/i,
  /\bwhat\s+do\s+you\s+(?:advise|suggest|recommend)\b/i,
  /\b(?:advise|advice)\s+me\b/i,
  /\bgive\s+me\s+(?:legal\s+)?advice\b/i,
  /\bdo\s+i\s+have\s+(?:a|any)\s+(?:case|claim|right|defence|defense|ground)/i,
  /\b(?:can|could|should|may)\s+i\s+(?:sue|claim|appeal|file|prosecute|counterclaim)/i,
  /\bam\s+i\s+(?:liable|entitled|guilty|responsible|allowed|obliged|required)\b/i,
  /\bhow\s+(?:much|long)\s+(?:can|could|would|will)\s+i\s+(?:claim|get|recover|receive)/i,
  /\bhelp\s+me\s+(?:win|fight|sue|beat|get out of)\b/i,
  /\bhow\s+do\s+i\s+(?:win|beat|get out of|avoid paying)\b/i,
  /\bmy\s+(?:best|only)\s+(?:option|chance|bet|course)\b/i,
];

/** Asking the assistant to predict how a matter would end. */
const OUTCOME_PATTERNS: RegExp[] = [
  /\b(?:will|would|could|can|do you think)\s+i\s+win\b/i,
  /\bwhat\s+are\s+my\s+chances\b/i,
  /\bchances?\s+of\s+(?:winning|success|succeeding)\b/i,
  /\b(?:is|how strong is)\s+my\s+case\b/i,
  /\bdo\s+i\s+stand\s+a\s+chance\b/i,
  /\bwill\s+(?:i|we)\s+(?:lose|be convicted|go to (?:jail|prison)|be liable|have to pay)\b/i,
  /\bwhat\s+(?:sentence|penalty|damages)\s+(?:will|would)\s+i\b/i,
  /\bis\s+it\s+worth\s+(?:suing|appealing|fighting|going to court)\b/i,
];

/**
 * Asking the assistant to approve or reject a document or offer.
 *
 * Note the `\w+\s+` gaps: real questions are "is this *employment* contract
 * fair", not "is this contract fair". A pattern with no room for the adjective
 * matches only the example it was written from.
 */
const DOCUMENT_DECISION_PATTERNS: RegExp[] = [
  /\bshould\s+i\s+(?:sign|accept|agree|settle|take the offer|resign|pay)\b/i,
  /\bis\s+(?:this|it|the|my)\s+(?:\w+\s+){0,3}(?:contract|agreement|offer|settlement|deed|clause|lease|will)\s+(?:fair|good|safe|ok|okay|valid|legal|binding|enforceable|reasonable)\b/i,
  /\b(?:review|check|look (?:at|over))\s+(?:this|my)\s+(?:\w+\s+){0,3}(?:contract|agreement|deed|document|offer|settlement|lease)\b/i,
  /\bshould\s+i\s+sign\b/i,
];

/**
 * Asking the assistant to pick a lawyer.
 *
 * Refused outright. The platform does not choose the practitioner (rule 4), and
 * the assistant choosing on the basis of what a person just described about
 * their legal problem would be both channelling and targeting on privileged
 * material. The refusal points at the directory, which is alphabetical,
 * unfiltered by anything the user said here, and identical for everyone.
 */
const REPRESENTATION_PATTERNS: RegExp[] = [
  /\b(?:recommend|suggest|find|get|pick|choose|connect)\s+(?:me\s+)?(?:a|an|the|some)?\s*(?:good|best|top|cheap|affordable)?\s*(?:lawyer|attorney|counsel|solicitor|advocate|law firm)/i,
  /\b(?:which|what|who)\s+(?:lawyer|attorney|firm|counsel)\b/i,
  /\bwho\s+should\s+i\s+(?:hire|instruct|retain|call|contact|see)\b/i,
  /\b(?:best|top|good|cheapest)\s+(?:lawyer|attorney|law firm)\b/i,
  /\bneed\s+(?:a|an)\s+(?:lawyer|attorney|counsel)\b/i,
  /\bi\s+want\s+(?:a|an|to talk to a)\s+(?:lawyer|attorney)\b/i,
];

/**
 * Does this question ask us to do something we may not do?
 *
 * Runs before the model is called. Refusing here means the user's account of
 * their own matter is never sent anywhere, which is the confidentiality benefit
 * on top of the compliance one.
 *
 * Order matters: representation is checked first because "should I get a lawyer
 * for this" is both a representation request and own-matter advice, and the
 * representation refusal is the more useful of the two.
 */
export function classifyRequest(question: string): RequestRuling {
  const q = (question ?? '').trim();
  if (!q) return { allowed: true };

  const checks: Array<[RegExp[], RefusalCategory]> = [
    [REPRESENTATION_PATTERNS, 'REPRESENTATION_REQUEST'],
    [OUTCOME_PATTERNS, 'OUTCOME_PREDICTION'],
    [DOCUMENT_DECISION_PATTERNS, 'DOCUMENT_DECISION'],
    [OWN_MATTER_PATTERNS, 'OWN_MATTER_ADVICE'],
  ];

  for (const [patterns, category] of checks) {
    if (patterns.some((p) => p.test(q))) {
      return { allowed: false, category, message: REFUSAL_MESSAGES[category] };
    }
  }

  return { allowed: true };
}

// ─── 2. Refusing the answer ──────────────────────────────────────────────────

/**
 * Phrases that are safe even though they look directive.
 *
 * "You should consult an attorney-at-law" is the sentence we most want the
 * assistant to say. It is stripped before the advice scan so that the one piece
 * of correct guidance in the whole system does not trip the check designed to
 * catch incorrect guidance.
 */
const SAFE_HARBOUR_PATTERNS: RegExp[] = [
  /\byou\s+(?:should|may|might|can|must|will need to|are advised to)\s+(?:consult|seek|speak|talk|contact|approach|instruct|retain|engage|get)\s+[^.!?]*?(?:attorney|lawyer|counsel|legal (?:advice|professional|practitioner)|professional)[^.!?]*/gi,
  /\b(?:consult|speak to|contact|approach)\s+(?:a|an|your)\s+(?:qualified\s+)?(?:attorney(?:-at-law)?|lawyer|legal professional)[^.!?]*/gi,
  /\bthis\s+is\s+not\s+legal\s+advice[^.!?]*/gi,
  /\brecommend\s+(?:consulting|seeking|obtaining)\s+(?:legal advice|an attorney|a lawyer|professional advice)[^.!?]*/gi,
];

/**
 * The model telling the user what to do about their own situation.
 *
 * The dangerous form is not "you should sue" — a model rarely says that. It is
 * "in your case, the Act would entitle you to compensation", which reads as
 * neutral information and is a legal opinion on specific facts.
 */
const ADVICE_IN_ANSWER_PATTERNS: RegExp[] = [
  /\bin\s+your\s+(?:case|situation|circumstance|matter|position)\b/i,
  /\bbased\s+on\s+(?:what\s+you(?:'ve| have)\s+(?:told|described|said)|your\s+(?:situation|description|circumstances))\b/i,
  /\byour\s+(?:best|strongest|only)\s+(?:option|course|remedy|argument|bet)\b/i,
  /\byou\s+(?:should|ought to|need to|must)\s+(?:sue|file|claim|appeal|refuse|resign|sign|accept|settle|stop paying|withhold)\b/i,
  /\byou\s+(?:are|would be|may be|are likely)\s+(?:entitled|liable|eligible)\s+to\b/i,
  // "you have a strong case" — the article and the adjective are both optional
  // and both usually present, so neither may be mandatory in the pattern.
  /\byou\s+(?:have|appear to have|likely have|may have)\s+(?:a|an|the)?\s*(?:very\s+)?(?:strong|good|solid|valid|reasonable|arguable)?\s*(?:case|claim|grounds?|defence|defense)\b/i,
  /\bi\s+(?:would\s+)?(?:advise|recommend)\s+(?:you|that you)\b/i,
  /\byou\s+can\s+(?:sue|claim compensation|recover damages)\b/i,
  // Hedges belong here too: "you would likely win" is a prediction, and the
  // hedge is what makes it sound responsible rather than makes it safe.
  /\byou\s+(?:will|would|could|should)\s+(?:probably\s+|likely\s+|almost certainly\s+)?(?:win|lose|succeed|fail|be convicted|be liable)\b/i,

  // ── Found by running the thing, not by reading it ──────────────────────
  // Asked "my employer fired me without notice and refused my final salary",
  // the model replied "I'm sorry to hear that you've been unfairly dismissed"
  // and then gave a numbered plan of action. Every pattern above passed it.
  //
  // Characterising what happened to the user in legal terms is a finding on
  // their facts — "unfairly dismissed" is a legal conclusion, not sympathy.
  /\byou(?:'ve| have|r| were| are)\s*(?:been\s+)?(?:unfairly|wrongfully|unlawfully|illegally|constructively)\s+(?:dismissed|terminated|treated|evicted|charged|detained)\b/i,
  /\byou\s+(?:are|were|have been)\s+(?:owed|due|entitled)\b/i,

  // A numbered or bulleted plan of action addressed to the reader. The model
  // reaches for this format precisely when it has decided to help someone with
  // their own problem, which is the moment it must not.
  /\byou\s+(?:may|might|could|should)\s+(?:want\s+to\s+)?(?:consider|take|follow)\s+(?:the\s+)?following\b/i,
  /\b(?:consider|follow|take)\s+the\s+following\s+steps\b/i,
  /\bhere(?:'s| is| are)\s+(?:what|how|the steps?)\s+you\s+(?:should|can|need)\b/i,
  /^\s*\d+[.)]\s*\**(?:Review|Check|File|Contact|Gather|Send|Submit|Keep|Collect|Report|Demand|Request|Notify)\b/m,
];

/**
 * The model pushing the user toward a practitioner.
 *
 * Phase 4 removed attorney adverts from beside this chat. This catches the same
 * thing arriving in the prose instead, which is what the RAG service used to do
 * on purpose: it detected that a user had described a personal situation and
 * appended an offer to recommend a specialist.
 *
 * "Consult an attorney-at-law" is stripped by the safe harbour above and is
 * fine. Naming a *kind* of specialist off the back of what the user described is
 * not — that is the platform narrowing the field, which is counsel question 6.
 */
const STEERING_PATTERNS: RegExp[] = [
  /\b(?:lawyers|attorneys|firms|practices)\s+(?:on|from)\s+(?:our|this)\s+(?:platform|site|directory)\b/i,
  /\b(?:matching|suitable|suggested|recommended|best|top|featured|ideal)\s+(?:lawyer|attorney|firm|counsel|practice)/i,
  /\bi(?:'ve| have)\s+found\s+(?:some|a few|several)?\s*(?:lawyer|attorney|firm)/i,
  /\b(?:below|here are|see below)[^.!?]{0,40}(?:lawyers|attorneys|firms)\b/i,
  // "I'd recommend consulting **a Property Lawyer**".
  // The markdown asterisks sit *before* the article, which is why an earlier
  // version of this pattern missed the exact string the RAG service produced.
  // Capitalised words before "Lawyer" are what distinguish a named specialism
  // from the safe generic "consult a qualified attorney-at-law".
  /\brecommend\s+(?:consulting|contacting|speaking\s+to|seeing)?\s*\*{0,2}(?:a|an|the)\s+\*{0,2}(?:[A-Z][A-Za-z]*[\s/-]+){1,3}(?:Lawyer|Attorney|Solicitor|Specialist|Practitioner)/,
  /\bwould\s+you\s+like\s+me\s+to\s+(?:recommend|suggest|find)\b/i,
  /\brecommend\s+(?:a|an)\s+(?:criminal|civil|corporate|family|property|labour|labor|tax|constitutional|environmental|ip|motor|banking|immigration|insurance|real estate|employment|personal injury)\s+/i,
  /\bbest\s+match\b/i,
  /\btop[- ]rated\b/i,
];

/**
 * Strip the phrases we want, so the scan only sees the phrases we do not.
 */
function withoutSafeHarbour(answer: string): string {
  return SAFE_HARBOUR_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, ' '),
    answer
  );
}

/** Directive language found in a generated answer. Empty means clean. */
export function findAdviceLanguage(answer: string): string[] {
  const scrubbed = withoutSafeHarbour(answer ?? '');
  return ADVICE_IN_ANSWER_PATTERNS.flatMap((p) => {
    const m = scrubbed.match(p);
    return m ? [m[0].trim()] : [];
  });
}

/**
 * Practitioner-steering language found in a generated answer. Empty means clean.
 *
 * Deliberately scans the *raw* answer, unlike the advice check.
 *
 * Running it on the safe-harbour-stripped text hid a real violation: "you should
 * speak to one of the top-rated lawyers on our platform" begins with a phrase
 * that looks like the approved "you should speak to an attorney", so stripping
 * swallowed the whole sentence including the part that made it unlawful. The
 * steering patterns are specific enough — "on our platform", "top-rated",
 * "matching lawyers", a capitalised specialism — that they do not fire on the
 * generic advice to consult an attorney-at-law, so they need no protection.
 */
export function findSteeringLanguage(answer: string): string[] {
  const text = answer ?? '';
  return STEERING_PATTERNS.flatMap((p) => {
    const m = text.match(p);
    return m ? [m[0].trim()] : [];
  });
}

// ─── 3. Citations ────────────────────────────────────────────────────────────

/** Metadata values the ingestion pipeline writes when it knows nothing. */
const EMPTY_METADATA = new Set(['', 'n/a', 'na', 'unknown', 'none', 'null', 'undefined']);

function isMeaningful(value: string | null | undefined): boolean {
  if (!value) return false;
  return !EMPTY_METADATA.has(value.trim().toLowerCase());
}

/**
 * A chunk index is not a citation.
 *
 * The ingestion pipeline labels a chunk `Chunk_1` when it could not identify a
 * section. Showing that to a user as though it were a section reference invents
 * precision the retrieval never had.
 */
function isRealSection(section: string | null | undefined): boolean {
  return isMeaningful(section) && !/^chunk[_\s-]?\d+$/i.test(section!.trim());
}

/**
 * Is this retrieval hit fit to show as a citation at all?
 *
 * A source must at minimum name the document it came from. Sources are produced
 * from vector-store metadata rather than by the model, so a named document here
 * is one that was genuinely ingested — the model cannot invent an entry in this
 * list. That is what makes a citation trustworthy even before we resolve it to
 * something clickable.
 */
export function isCitableSource(source: AiSource): boolean {
  return isMeaningful(source?.documentName);
}

/**
 * Turn retrieval hits into citations, dropping anything we cannot stand behind.
 *
 * `library` maps an ingested file name and a RAG document name to the
 * `LegalDocument` row a user can open. Where a citation resolves, the UI links
 * to it. Where it does not, the citation is still shown — it names a real
 * ingested Act and a real section — but it is not dressed up as a link to
 * nowhere.
 *
 * Duplicate sections of the same document collapse to one citation. Six chunks
 * of the Companies Act is one source, not six.
 */
export function resolveCitations(
  sources: AiSource[],
  library: Map<string, string>
): ResolvedCitation[] {
  const out: ResolvedCitation[] = [];
  const seen = new Set<string>();

  for (const source of sources ?? []) {
    if (!isCitableSource(source)) continue;

    const documentName = source.documentName.trim();
    const section = isRealSection(source.section) ? source.section.trim() : null;
    const key = `${documentName.toLowerCase()}::${(section ?? '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const libraryDocumentId =
      library.get(normaliseLibraryKey(source.sourceFile)) ??
      library.get(normaliseLibraryKey(documentName)) ??
      null;

    out.push({
      documentName,
      documentType: isMeaningful(source.documentType) ? source.documentType.trim() : 'Legislation',
      section,
      part: isMeaningful(source.part) ? source.part.trim() : null,
      status: isMeaningful(source.status) ? source.status.trim() : 'Unknown',
      lastUpdatedYear: source.lastUpdatedYear ?? 'N/A',
      libraryDocumentId,
    });
  }

  return out;
}

/**
 * Match loosely enough to survive punctuation drift between the ingestion
 * pipeline and the library row, strictly enough not to collide two Acts.
 */
export function normaliseLibraryKey(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\.pdf$/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Legislation named in the prose that was never retrieved.
 *
 * The citation list cannot be hallucinated — it is retrieval metadata. The prose
 * can be. A model that retrieved the Companies Act and then wrote "under section
 * 12 of the Motor Traffic Act" has invented an authority, and a wrong section
 * number in a legal answer is worse than no answer at all.
 *
 * Only Acts, Codes and Ordinances are checked. A passing mention of "the
 * Constitution" or "the Supreme Court" is not a citation.
 */
export function findUnsupportedProseCitations(
  answer: string,
  citations: ResolvedCitation[]
): string[] {
  // The parenthetical alternative is load-bearing. Sri Lankan legislation is
  // routinely named "Employment (Amendment) Ordinance" or "Civil Procedure
  // (Special Provisions) Act", and a pattern that only accepts plain
  // capitalised words silently skips every one of them. That is not a cosmetic
  // gap: end-to-end testing caught this exact regex letting the model cite an
  // "Employment (Amendment) Ordinance No. 14 of 2017" that is not in the corpus
  // and may not exist at all.
  const named = (answer ?? '').match(
    /\b(?:(?:[A-Z][A-Za-z'-]*|\([A-Z][A-Za-z '-]*\))\s+){1,5}(?:Act|Code|Ordinance)\b(?:\s+No\.?\s*\d+\s+of\s+\d{4})?/g
  );
  if (!named) return [];

  const retrieved = citations.map((c) => normaliseLibraryKey(c.documentName));
  const unsupported = new Set<string>();

  for (const raw of named) {
    const mention = raw.trim();
    // Strip leading sentence filler the greedy match may have swept up.
    const cleaned = mention.replace(
      /^(?:The|This|That|Under|Section|Sections|In|Of|A|An|And|Per|See)\s+/i,
      ''
    );
    const key = normaliseLibraryKey(cleaned);
    if (!key) continue;

    const supported = retrieved.some(
      (r) => r.includes(key) || key.includes(r)
    );
    if (!supported) unsupported.add(cleaned);
  }

  return [...unsupported];
}

// ─── The whole decision, in one place ────────────────────────────────────────

export type AnswerInput = {
  answer: string;
  sources: AiSource[];
  library: Map<string, string>;
  /**
   * Whether this answer is expected to rest on legislation.
   *
   * A greeting is not. Everything else is: the default is that an answer needs a
   * source, and the caller has to positively say otherwise.
   */
  requiresCitation: boolean;
};

/**
 * The gate every generated answer passes through before a user sees it.
 *
 * Fails closed. An answer that trips any check is withheld whole rather than
 * edited, because rewriting a model's legal prose to make it compliant is a
 * worse idea than not showing it: we would be authoring legal content by hand,
 * which is the thing rule 6 exists to stop.
 */
export function evaluateAnswer(input: AnswerInput): AnswerRuling {
  const answer = (input.answer ?? '').trim();

  if (!answer) {
    return {
      outcome: 'REFUSE',
      category: 'NO_CITABLE_SOURCE',
      message: REFUSAL_MESSAGES.NO_CITABLE_SOURCE,
      detail: 'The model returned an empty answer.',
    };
  }

  const steering = findSteeringLanguage(answer);
  if (steering.length) {
    return {
      outcome: 'REFUSE',
      category: 'PRACTITIONER_STEERING',
      message: REFUSAL_MESSAGES.PRACTITIONER_STEERING,
      detail: `Steering language in answer: ${steering.join(' | ')}`,
    };
  }

  const advice = findAdviceLanguage(answer);
  if (advice.length) {
    return {
      outcome: 'REFUSE',
      category: 'ADVICE_IN_ANSWER',
      message: REFUSAL_MESSAGES.ADVICE_IN_ANSWER,
      detail: `Advice language in answer: ${advice.join(' | ')}`,
    };
  }

  const citations = resolveCitations(input.sources ?? [], input.library);

  if (input.requiresCitation && citations.length === 0) {
    return {
      outcome: 'REFUSE',
      category: 'NO_CITABLE_SOURCE',
      message: REFUSAL_MESSAGES.NO_CITABLE_SOURCE,
      detail: `No citable source among ${input.sources?.length ?? 0} retrieval hits.`,
    };
  }

  const unsupported = findUnsupportedProseCitations(answer, citations);
  if (unsupported.length) {
    return {
      outcome: 'REFUSE',
      category: 'UNSUPPORTED_CITATION',
      message: REFUSAL_MESSAGES.UNSUPPORTED_CITATION,
      detail: `Answer cites legislation that was not retrieved: ${unsupported.join(', ')}`,
    };
  }

  return { outcome: 'PUBLISH', citations };
}

// ─── Confidentiality ─────────────────────────────────────────────────────────

/**
 * What may be sent to the model.
 *
 * Everything the assistant sees is something the user typed into the chat box in
 * this conversation. Nothing from a matter — no `Booking.description`, no
 * subject, no conflict-check note, no quote, no engagement letter — is ever
 * added to the context, and there is deliberately no parameter here through
 * which it could be.
 *
 * That is not a style preference. A matter description is privileged under
 * Evidence Ordinance s.126, and a third party in the conversation is how
 * privilege gets argued away. The chat is a public information surface; the
 * matter file is not. They do not meet.
 *
 * Matter-scoped AI is a Phase 7 growth item and needs its own confidentiality
 * design — a firm-scoped model context, a data-processor agreement, and counsel
 * question 4 answered — before a single field crosses this line.
 */
export type ModelContext = {
  /** The user's current message, as typed. */
  question: string;
  /** Earlier turns of this same chat, nothing else. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
};

/** How many earlier turns travel with a question. */
export const MAX_HISTORY_TURNS = 10;

export function buildModelContext(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): ModelContext {
  return {
    question,
    history: (history ?? []).slice(-MAX_HISTORY_TURNS).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };
}

// ─── Retention ───────────────────────────────────────────────────────────────

/**
 * How long a saved AI conversation lives.
 *
 * These are a person's questions about their legal problems, which is sensitive
 * personal data under the PDPA whether or not it is privileged. We keep them
 * because users expect their chat history to still be there, and for no other
 * reason — so the period is the shortest one that delivers that, and it runs
 * from last use rather than creation so an active conversation is not deleted
 * under someone.
 *
 * Phase 6 owns PDPA properly: lawful basis, subject access, erasure on request.
 * This is the floor, not the finished article.
 */
export const AI_CONVERSATION_RETENTION_DAYS = 180;

export function retentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - AI_CONVERSATION_RETENTION_DAYS);
  return cutoff;
}
