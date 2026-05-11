import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique Jitsi Meet link for a consultation.
 * Jitsi Meet is 100% free, requires no API keys, no accounts,
 * and works instantly in the browser for all participants.
 * 
 * The room name is constructed from the booking number to be
 * unique and deterministic.
 */
export function createMeetingLink(
  bookingNumber: string,
  lawyerName: string,
  clientName: string,
): string {
  // Create a clean, unique room name
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '');
  const uniqueId = uuidv4().split('-')[0]; // Short unique suffix
  const roomName = `LawSeekr-${sanitize(bookingNumber)}-${uniqueId}`;
  
  return `https://meet.jit.si/${roomName}`;
}

/**
 * Legacy wrapper for backward compatibility with existing code
 * that calls createGoogleMeet(). Now uses Jitsi Meet instead.
 */
export async function createGoogleMeet(
  summary: string,
  description: string,
  startTime: string,
  endTime: string,
): Promise<string> {
  // Extract booking number from summary if possible
  const bookingMatch = summary.match(/BK-\d{4}-\d{4}/);
  const bookingNumber = bookingMatch ? bookingMatch[0] : `CONSULT-${Date.now()}`;
  
  return createMeetingLink(bookingNumber, 'Lawyer', 'Client');
}
