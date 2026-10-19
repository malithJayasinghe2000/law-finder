import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/security';
import {
  classifyRequest,
  evaluateAnswer,
  REFUSAL_MESSAGES,
  buildModelContext,
  acceptGeneralQuestion,
  generalAnswerLead,
  generalNotHeldNote,
  safetyNote,
  SAFETY_MARKER,
  SAFETY_NOTE,
  type ResolvedCitation,
  type RefusalCategory,
} from '@/lib/ai/policy';
import { askRag, generaliseQuestion, loadLibraryIndex, RagUnavailableError } from '@/lib/ai/rag';

/**
 * POST /api/ai/ask — the only route that produces an AI answer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Every AI answer on this platform is generated here, on the server, and passes
 * `src/lib/ai/policy.ts` before it is returned. There is no other path.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Before Phase 5 the browser called the RAG service directly on a
 * `NEXT_PUBLIC_` URL and then posted the answer it had received back to us to be
 * stored. Two consequences, neither of them survivable:
 *
 *   - No rule could be enforced. A refusal check on our side would have been
 *     decoration; the page told anyone who looked where the model actually
 *     lived, and it answered without us.
 *   - The stored transcript was whatever the client said it was. `sources` and
 *     the assistant's text arrived as request body fields, so "this answer was
 *     properly cited" was a claim made by the caller about itself.
 *
 * The order of operations below is the compliance measure, not an
 * implementation detail:
 *
 *   1. Classify the question. If it asks for advice on the user's own matter,
 *      it is never answered as asked. Since 2026-10-19 the model service is
 *      asked for the general question behind it (no personal details), and
 *      only that is answered — see step 1b. The person's facts never reach the
 *      model that writes the answer. (They do reach the rewrite: the privacy
 *      notice used to say own-case questions are sent nowhere, and its next
 *      version must say otherwise.)
 *   2. Generate.
 *   3. Evaluate the answer whole. Withhold if it advises, steers toward a
 *      practitioner, or cites something that was never retrieved.
 *   4. Only then persist, and only then return.
 *
 * Step 3 is why nothing here streams. A streamed answer has already been read by
 * the time it could be checked, which makes the check theatre.
 */

/** Questions a signed-out visitor may ask per day, per IP. */
const GUEST_DAILY_LIMIT = 5;
/** Questions a signed-in user may ask per hour. Abuse control, not metering. */
const USER_HOURLY_LIMIT = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type AskResponse = {
  answer: string;
  citations: ResolvedCitation[];
  refused: boolean;
  refusalCategory: RefusalCategory | null;
  conversationId: string | null;
};

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const body = await req.json().catch(() => ({}));

    const question = typeof body.message === 'string' ? body.message.trim() : '';
    const conversationId =
      typeof body.conversationId === 'string' && body.conversationId ? body.conversationId : null;

    if (!question) {
      return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
    }
    if (question.length > 4000) {
      return NextResponse.json(
        { error: 'That question is too long. Please shorten it.' },
        { status: 400 }
      );
    }

    // ── Rate limiting ──────────────────────────────────────────────────────
    // The guest allowance used to live in localStorage, where the user could
    // reset it from the browser console. It is counted here now. Note this
    // meters *questions asked of software*, never anything to do with how much
    // legal work flows through the platform — see guardrail rule 1.
    const ip = getClientIp(req);
    const limit = session
      ? checkRateLimit(`ai:user:${session.userId}`, USER_HOURLY_LIMIT, HOUR_MS)
      : checkRateLimit(`ai:guest:${ip}`, GUEST_DAILY_LIMIT, DAY_MS);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: session
            ? 'You have asked a lot of questions in a short time. Please wait a few minutes.'
            : 'You have used all your free questions for today. Sign in to continue.',
          requiresLogin: !session,
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }

    // ── 1. Refuse before generating ────────────────────────────────────────
    // A refusal here means the user's description of their own legal problem is
    // never sent to any model. That is the confidentiality dividend of checking
    // the request rather than only the answer.
    // Emergency numbers on any reply to a question about violence or danger —
    // and on every later reply in that conversation, because the follow-up
    // ("what legal action for this?") no longer names the danger. Signed in:
    // read from our own store. A guest has no stored history, so the page says
    // whether it has already shown the note; trusting it is safe, because the
    // flag can only ADD the emergency numbers, never remove a check.
    const priorHistory =
      conversationId && session ? await loadHistory(conversationId, session.userId) : [];
    const dangerEarlier =
      body.safetyShown === true ||
      priorHistory.some((m) => (m.role === 'user' ? safetyNote(m.content) !== null : m.content.includes(SAFETY_MARKER)));
    const safety = safetyNote(question) ?? (dangerEarlier ? SAFETY_NOTE : null);
    const withSafety = (text: string) => (safety ? text + safety : text);

    const ruling = classifyRequest(question);
    if (!ruling.allowed) {
      // ── 1b. Own case: answer the general question behind it ──────────────
      let message = ruling.message;
      if (ruling.category === 'OWN_MATTER_ADVICE') {
        const general = await answerGeneralVersion(question);
        if (general?.kind === 'ANSWERED') {
          const answer = withSafety(generalAnswerLead(general.question) + general.answer);
          const saved = await persist({
            session,
            conversationId,
            question,
            answer,
            citations: general.citations,
            refusalCategory: null,
          });
          return NextResponse.json<AskResponse>({
            answer,
            citations: general.citations,
            refused: false,
            refusalCategory: null,
            conversationId: saved,
          });
        }
        if (general?.kind === 'NOT_HELD') message += generalNotHeldNote(general.question);
      }

      const saved = await persist({
        session,
        conversationId,
        question,
        answer: withSafety(message),
        citations: [],
        refusalCategory: ruling.category,
      });

      return NextResponse.json<AskResponse>({
        answer: withSafety(message),
        citations: [],
        refused: true,
        refusalCategory: ruling.category,
        conversationId: saved,
      });
    }

    // ── 2. Generate ────────────────────────────────────────────────────────
    // History comes from the database for a signed-in user, so a client cannot
    // fabricate a conversation to steer the model. A guest has no stored
    // history, so their context is this question alone.
    const context = buildModelContext(question, priorHistory);

    let generated;
    try {
      generated = await askRag(context);
    } catch (error) {
      if (error instanceof RagUnavailableError) {
        console.error('[AI_ASK_RAG_UNAVAILABLE]', error.message);
        return NextResponse.json(
          {
            error:
              'The legal database is not responding at the moment. Please try again shortly.',
          },
          { status: 503 }
        );
      }
      throw error;
    }

    // ── 2b. A follow-up with nothing behind it ─────────────────────────────
    //
    // Handled before the citation check, because it is not a legal answer and
    // has no citations by definition — so evaluateAnswer would withhold it as
    // NO_CITABLE_SOURCE and tell the user "I could not find this in the
    // legislation I hold". That is FALSE: the corpus may hold the subject
    // perfectly well, and what is missing is any way to know what "that" means.
    //
    // A signed-out visitor hits this on every follow-up, because a guest has no
    // stored conversation (see the history note above). Reported by a user on
    // 2026-09-13, who read the old message as the assistant having lost the
    // legislation it had just quoted.
    //
    // The service supplies only the SIGNAL. The words come from
    // REFUSAL_MESSAGES, like every other refusal, so the model service can never
    // put its own prose in front of a reader.
    if (generated.needsContext) {
      const saved = await persist({
        session,
        conversationId,
        question,
        answer: withSafety(REFUSAL_MESSAGES.FOLLOW_UP_WITHOUT_CONTEXT),
        citations: [],
        refusalCategory: 'FOLLOW_UP_WITHOUT_CONTEXT',
      });

      return NextResponse.json<AskResponse>({
        answer: withSafety(REFUSAL_MESSAGES.FOLLOW_UP_WITHOUT_CONTEXT),
        citations: [],
        refused: true,
        refusalCategory: 'FOLLOW_UP_WITHOUT_CONTEXT',
        conversationId: saved,
      });
    }

    // ── 3. Evaluate the whole answer before anyone reads any of it ─────────
    const library = await loadLibraryIndex();
    const verdict = evaluateAnswer({
      answer: generated.answer,
      sources: generated.sources,
      library,
      // A greeting needs no legislation behind it. Everything else does, and the
      // default when the service tells us nothing is that a citation is required.
      requiresCitation: !generated.isConversational,
    });

    if (verdict.outcome === 'REFUSE') {
      // Logged with the reason, because a rising count here is a signal about
      // the model or the corpus, not noise.
      console.warn('[AI_ASK_WITHHELD]', verdict.category, verdict.detail);

      const saved = await persist({
        session,
        conversationId,
        question,
        answer: withSafety(verdict.message),
        citations: [],
        refusalCategory: verdict.category,
      });

      return NextResponse.json<AskResponse>({
        answer: withSafety(verdict.message),
        citations: [],
        refused: true,
        refusalCategory: verdict.category,
        conversationId: saved,
      });
    }

    // ── 4. Publish ─────────────────────────────────────────────────────────
    const saved = await persist({
      session,
      conversationId,
      question,
      answer: withSafety(generated.answer),
      citations: verdict.citations,
      refusalCategory: null,
    });

    return NextResponse.json<AskResponse>({
      answer: withSafety(generated.answer),
      citations: verdict.citations,
      refused: false,
      refusalCategory: null,
      conversationId: saved,
    });
  } catch (error) {
    console.error('[AI_ASK_ERROR]', error);
    return NextResponse.json(
      { error: 'Something went wrong answering that. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Answer the general question behind an own-case question, or say why not.
 *
 * ANSWERED only when the rewrite passes acceptGeneralQuestion AND the answer
 * passes evaluateAnswer, exactly as a question typed in that form would.
 * NOT_HELD when the general question has no source in the library, so the
 * refusal can say it looked. null for everything else — the service is down,
 * the rewrite carried the person with it, or the answer was withheld for
 * advising or steering — and the caller shows the plain refusal.
 *
 * No history: earlier turns can hold the person's facts, and keeping them out
 * of the answering model is the whole point.
 */
async function answerGeneralVersion(question: string): Promise<
  | { kind: 'ANSWERED'; question: string; answer: string; citations: ResolvedCitation[] }
  | { kind: 'NOT_HELD'; question: string }
  | null
> {
  const general = acceptGeneralQuestion(await generaliseQuestion(question));
  if (!general) return null;

  let generated;
  try {
    generated = await askRag(buildModelContext(general, []));
  } catch {
    return null;
  }
  if (generated.needsContext || !generated.answer) return null;

  const verdict = evaluateAnswer({
    answer: generated.answer,
    sources: generated.sources,
    library: await loadLibraryIndex(),
    requiresCitation: true,
  });
  if (verdict.outcome === 'REFUSE') {
    console.warn('[AI_ASK_GENERAL_WITHHELD]', verdict.category, verdict.detail);
    return verdict.category === 'NO_CITABLE_SOURCE' || verdict.category === 'UNSUPPORTED_CITATION'
      ? { kind: 'NOT_HELD', question: general }
      : null;
  }
  return { kind: 'ANSWERED', question: general, answer: generated.answer, citations: verdict.citations };
}

/**
 * Earlier turns of this conversation, read from our own store.
 *
 * Deliberately not taken from the request body. History shapes what the model
 * says, so accepting it from the client would let a caller assemble a fake
 * conversation — including a fake assistant turn — to move the answer somewhere
 * the policy would otherwise have refused to go.
 */
async function loadHistory(conversationId: string, userId: string) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { role: true, content: true },
      },
    },
  });

  if (!conversation) return [];

  return conversation.messages.map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: m.content,
  }));
}

/**
 * Store the exchange, for a signed-in user only.
 *
 * A guest's questions are not written anywhere. There is no product reason to
 * keep them — a guest has no history to come back to — and they are a person's
 * questions about their legal problems, which is sensitive personal data under
 * the PDPA. The cheapest way to hold data safely is not to hold it.
 *
 * Returns the conversation id so the client can keep using it, or null for a
 * guest.
 */
async function persist(input: {
  session: Awaited<ReturnType<typeof getSession>>;
  conversationId: string | null;
  question: string;
  answer: string;
  citations: ResolvedCitation[];
  refusalCategory: RefusalCategory | null;
}): Promise<string | null> {
  const { session } = input;
  if (!session) return null;

  let conversationId = input.conversationId;

  if (conversationId) {
    const owned = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: session.userId },
      select: { id: true },
    });
    if (!owned) conversationId = null;
  }

  if (!conversationId) {
    const created = await prisma.aiConversation.create({
      data: {
        userId: session.userId,
        title: input.question.slice(0, 80) + (input.question.length > 80 ? '…' : ''),
      },
      select: { id: true },
    });
    conversationId = created.id;
  }

  await prisma.$transaction([
    prisma.aiMessage.create({
      data: { conversationId, role: 'user', content: input.question },
    }),
    prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: input.answer,
        citations: input.citations.length ? (input.citations as unknown as object) : undefined,
        refusalCategory: input.refusalCategory,
      },
    }),
    // Touches `updatedAt`, which is what retention counts from — a conversation
    // still in use is not deleted under the person using it.
    prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return conversationId;
}

/** Kept explicit so nothing accidentally caches a legal answer. */
export const dynamic = 'force-dynamic';
